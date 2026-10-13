<?php
/**
 * 표지 추출 함수 (하이브리드 방식)
 *
 *  EPUB : OPF 매니페스트에서 표지 이미지를 찾아 추출 (ZipArchive)
 *  PDF  : 서버 렌더링 (Imagick → pdftoppm → ImageMagick convert)
 *         → 브라우저(pdf.js)에서 렌더링한 첫 페이지 이미지 (upload.php 에서 처리)
 *         → PDF 안에 포함된 JPEG 이미지
 *  실패 : 기본 표지 (api/cover.php 가 SVG 로 생성)
 *
 * 이 파일은 다른 스크립트에서 include 하는 용도이며 직접 접근할 수 없습니다.
 */
if (!defined('APP_ROOT')) {
    http_response_code(403);
    exit;
}

const COVER_MAX_WIDTH = 600;

/**
 * @return array{bytes:string, ext:string, method:string}|null
 */
function extract_cover(string $path, string $format): ?array
{
    try {
        if ($format === 'epub') {
            return extract_epub_cover($path);
        }
        if ($format === 'pdf') {
            return extract_pdf_cover($path);
        }
    } catch (Throwable $e) {
        error_log('[cover] ' . $e->getMessage());
    }
    return null;
}

// ---------------------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------------------

function epub_load_xml(string $xml): ?DOMDocument
{
    if ($xml === '') {
        return null;
    }
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $ok = $doc->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    if (!$ok) {
        // XHTML 이 엄격한 XML 이 아닐 수 있으므로 HTML 로 재시도
        $ok = $doc->loadHTML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    }
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $ok ? $doc : null;
}

/** 네임스페이스와 무관하게 로컬 이름으로 요소 검색 */
function xml_elements(DOMDocument $doc, string $localName): array
{
    $result = [];
    foreach ($doc->getElementsByTagName('*') as $el) {
        if (strcasecmp($el->localName, $localName) === 0) {
            $result[] = $el;
        }
    }
    return $result;
}

function zip_resolve(string $baseDir, string $href): string
{
    $href = rawurldecode(explode('#', $href)[0]);
    $path = ($baseDir !== '' ? $baseDir . '/' : '') . $href;
    $parts = [];
    foreach (explode('/', str_replace('\\', '/', $path)) as $seg) {
        if ($seg === '' || $seg === '.') {
            continue;
        }
        if ($seg === '..') {
            array_pop($parts);
        } else {
            $parts[] = $seg;
        }
    }
    return implode('/', $parts);
}

/** @return array{zip:ZipArchive, opf:DOMDocument, base:string}|null */
function epub_open(string $path): ?array
{
    if (!class_exists('ZipArchive')) {
        return null;
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return null;
    }
    $container = epub_load_xml((string)$zip->getFromName('META-INF/container.xml'));
    $opfPath = null;
    if ($container) {
        foreach (xml_elements($container, 'rootfile') as $rf) {
            $opfPath = $rf->getAttribute('full-path');
            if ($opfPath) {
                break;
            }
        }
    }
    if (!$opfPath) {
        // container.xml 이 없으면 .opf 파일을 직접 탐색
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $n = $zip->getNameIndex($i);
            if (str_ends_with(strtolower($n), '.opf')) {
                $opfPath = $n;
                break;
            }
        }
    }
    $opf = $opfPath ? epub_load_xml((string)$zip->getFromName($opfPath)) : null;
    if (!$opf) {
        $zip->close();
        return null;
    }
    $base = dirname($opfPath);
    return ['zip' => $zip, 'opf' => $opf, 'base' => $base === '.' ? '' : $base];
}

/** EPUB 메타데이터(제목, 저자) */
function extract_epub_metadata(string $path): array
{
    $meta = ['title' => '', 'author' => ''];
    $epub = epub_open($path);
    if (!$epub) {
        return $meta;
    }
    $t = xml_elements($epub['opf'], 'title');
    $c = xml_elements($epub['opf'], 'creator');
    $meta['title'] = $t ? trim($t[0]->textContent) : '';
    $meta['author'] = $c ? trim($c[0]->textContent) : '';
    $epub['zip']->close();
    return $meta;
}

function extract_epub_cover(string $path): ?array
{
    $epub = epub_open($path);
    if (!$epub) {
        return null;
    }
    ['zip' => $zip, 'opf' => $opf, 'base' => $base] = $epub;

    $items = [];
    foreach (xml_elements($opf, 'item') as $item) {
        $items[] = [
            'id'    => $item->getAttribute('id'),
            'href'  => $item->getAttribute('href'),
            'type'  => strtolower($item->getAttribute('media-type')),
            'props' => $item->getAttribute('properties'),
        ];
    }
    $isImage = fn($it) => str_starts_with($it['type'], 'image/') && $it['type'] !== 'image/svg+xml';

    $candidates = [];
    // 1) EPUB3: properties="cover-image"
    foreach ($items as $it) {
        if (preg_match('/\bcover-image\b/', $it['props']) && $isImage($it)) {
            $candidates[] = zip_resolve($base, $it['href']);
        }
    }
    // 2) EPUB2: <meta name="cover" content="ID">
    foreach (xml_elements($opf, 'meta') as $meta) {
        if (strtolower($meta->getAttribute('name')) === 'cover') {
            $coverId = $meta->getAttribute('content');
            foreach ($items as $it) {
                if ($it['id'] === $coverId) {
                    if ($isImage($it)) {
                        $candidates[] = zip_resolve($base, $it['href']);
                    } else {
                        $candidates = array_merge($candidates, epub_images_in_page($zip, zip_resolve($base, $it['href'])));
                    }
                }
            }
        }
    }
    // 3) <guide><reference type="cover">
    foreach (xml_elements($opf, 'reference') as $ref) {
        if (strtolower($ref->getAttribute('type')) === 'cover') {
            $candidates = array_merge($candidates, epub_images_in_page($zip, zip_resolve($base, $ref->getAttribute('href'))));
        }
    }
    // 4) id 또는 파일명에 cover 가 포함된 이미지
    foreach ($items as $it) {
        if ($isImage($it) && (stripos($it['id'], 'cover') !== false || stripos($it['href'], 'cover') !== false)) {
            $candidates[] = zip_resolve($base, $it['href']);
        }
    }
    // 5) 첫 번째 이미지
    foreach ($items as $it) {
        if ($isImage($it)) {
            $candidates[] = zip_resolve($base, $it['href']);
            break;
        }
    }

    foreach (array_unique($candidates) as $candidate) {
        $bytes = $zip->getFromName($candidate);
        if ($bytes !== false && ($img = validate_image_bytes($bytes))) {
            $zip->close();
            return ['bytes' => $bytes, 'ext' => $img['ext'], 'method' => 'epub'];
        }
    }
    $zip->close();
    return null;
}

/** 표지 XHTML 페이지 안의 이미지 경로 */
function epub_images_in_page(ZipArchive $zip, string $pagePath): array
{
    $doc = epub_load_xml((string)$zip->getFromName($pagePath));
    if (!$doc) {
        return [];
    }
    $dir = dirname($pagePath);
    $dir = $dir === '.' ? '' : $dir;
    $result = [];
    foreach (xml_elements($doc, 'img') as $img) {
        $result[] = zip_resolve($dir, $img->getAttribute('src'));
    }
    foreach (xml_elements($doc, 'image') as $img) {
        $href = $img->getAttribute('href') ?: $img->getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if ($href) {
            $result[] = zip_resolve($dir, $href);
        }
    }
    return $result;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** 서버 측 렌더링 (첫 페이지). 실패 시 null */
function render_pdf_first_page(string $path): ?array
{
    // 1) Imagick 확장
    if (extension_loaded('imagick')) {
        try {
            $im = new Imagick();
            $im->setResolution(100, 100);
            $im->readImage($path . '[0]');
            $im->setImageBackgroundColor('white');
            $im = $im->mergeImageLayers(Imagick::LAYERMETHOD_FLATTEN);
            $im->setImageFormat('jpeg');
            $bytes = $im->getImageBlob();
            $im->clear();
            if ($bytes) {
                return ['bytes' => $bytes, 'ext' => 'jpg', 'method' => 'imagick'];
            }
        } catch (Throwable $e) {
            // 다음 방법 시도
        }
    }

    if (!function_exists('exec') || in_array('exec', array_map('trim', explode(',', (string)ini_get('disable_functions'))), true)) {
        return null;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'spcover');
    if ($tmp === false) {
        return null;
    }
    @unlink($tmp);
    $null = PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null';

    // 2) poppler-utils: pdftoppm
    $cmd = 'pdftoppm -f 1 -l 1 -singlefile -jpeg -scale-to ' . COVER_MAX_WIDTH . ' '
        . escapeshellarg($path) . ' ' . escapeshellarg($tmp) . ' 2>' . $null;
    @exec($cmd, $out, $code);
    if ($code === 0 && is_file($tmp . '.jpg') && filesize($tmp . '.jpg') > 0) {
        $bytes = file_get_contents($tmp . '.jpg');
        @unlink($tmp . '.jpg');
        return ['bytes' => $bytes, 'ext' => 'jpg', 'method' => 'pdftoppm'];
    }
    @unlink($tmp . '.jpg');

    // 3) ImageMagick convert (Ghostscript 필요)
    $cmd = 'convert -density 100 ' . escapeshellarg($path . '[0]') . ' -background white -flatten -quality 85 '
        . escapeshellarg($tmp . '.jpg') . ' 2>' . $null;
    @exec($cmd, $out, $code);
    if ($code === 0 && is_file($tmp . '.jpg') && filesize($tmp . '.jpg') > 0) {
        $bytes = file_get_contents($tmp . '.jpg');
        @unlink($tmp . '.jpg');
        return ['bytes' => $bytes, 'ext' => 'jpg', 'method' => 'convert'];
    }
    @unlink($tmp . '.jpg');
    return null;
}

/** PDF 내부에 포함된 첫 번째 큰 JPEG 이미지 */
function extract_pdf_embedded_jpeg(string $path): ?array
{
    $fp = @fopen($path, 'rb');
    if (!$fp) {
        return null;
    }
    $data = (string)fread($fp, 20 * 1024 * 1024);
    fclose($fp);

    $offset = 0;
    while (($pos = strpos($data, '/DCTDecode', $offset)) !== false) {
        $offset = $pos + 10;
        $streamPos = strpos($data, 'stream', $offset);
        if ($streamPos === false) {
            break;
        }
        $start = $streamPos + 6;
        if (($data[$start] ?? '') === "\r") {
            $start++;
        }
        if (($data[$start] ?? '') === "\n") {
            $start++;
        }
        $end = strpos($data, 'endstream', $start);
        if ($end === false) {
            break;
        }
        $bytes = rtrim(substr($data, $start, $end - $start), "\r\n");
        if (str_starts_with($bytes, "\xFF\xD8")) {
            $info = @getimagesizefromstring($bytes);
            if ($info && $info[0] >= 200 && $info[1] >= 200) {
                return ['bytes' => $bytes, 'ext' => 'jpg', 'method' => 'embedded'];
            }
        }
        $offset = $end;
    }
    return null;
}

function extract_pdf_cover(string $path): ?array
{
    return render_pdf_first_page($path) ?? extract_pdf_embedded_jpeg($path);
}

// ---------------------------------------------------------------------------
// 이미지 검증 & 저장
// ---------------------------------------------------------------------------

/** 허용된 이미지(JPG/PNG/WebP)인지 확인. @return array{ext:string, mime:string}|null */
function validate_image_bytes(string $bytes): ?array
{
    $info = @getimagesizefromstring($bytes);
    if (!$info) {
        return null;
    }
    $map = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!isset($map[$info[2]])) {
        return null;
    }
    return ['ext' => $map[$info[2]], 'mime' => $info['mime']];
}

/**
 * 표지 이미지를 covers 폴더에 저장하고 파일명을 반환합니다.
 * GD 가 있으면 너비 600px 이하 JPEG 로 다시 인코딩하여 용량과 위험 요소를 줄입니다.
 */
function save_cover_bytes(string $bytes, int $bookId): ?string
{
    $img = validate_image_bytes($bytes);
    if (!$img) {
        return null;
    }
    $dir = covers_dir();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    // 같은 책의 이전 표지 삭제
    foreach (glob($dir . '/' . $bookId . '_cover.*') ?: [] as $old) {
        @unlink($old);
    }

    $ext = $img['ext'];
    $out = $bytes;
    if (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring($bytes);
        if ($src) {
            $w = imagesx($src);
            $hgt = imagesy($src);
            $scale = min(1, COVER_MAX_WIDTH / max(1, $w));
            $nw = max(1, (int)round($w * $scale));
            $nh = max(1, (int)round($hgt * $scale));
            $dst = imagecreatetruecolor($nw, $nh);
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $hgt);
            ob_start();
            imagejpeg($dst, null, 85);
            $out = (string)ob_get_clean();
            $ext = 'jpg';
            imagedestroy($src);
            imagedestroy($dst);
        }
    }
    $name = $bookId . '_cover.' . $ext;
    return file_put_contents($dir . '/' . $name, $out) !== false ? $name : null;
}
