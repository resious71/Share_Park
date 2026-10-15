<?php
/**
 * 책 업로드 (관리자 + 회원)
 * 필드: book(파일), title, author, description(선택), cover(수동 표지, 선택),
 *       cover_auto(브라우저에서 렌더링한 PDF 첫 페이지, 선택)
 * 회원 업로드는 설정의 allow_member_upload 가 켜져 있을 때만 허용됩니다.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/extract-cover.php';

$user = require_login_api();
if (!can_upload_books($user)) {
    json_error('현재 관리자만 책을 등록할 수 있습니다. 관리자에게 문의해 주세요.', 403);
}

// post_max_size 초과 시 $_POST, $_FILES 가 모두 비어 있음
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && empty($_POST) && empty($_FILES)
    && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_error('파일이 서버 업로드 한도(post_max_size: ' . ini_get('post_max_size') . ')를 초과했습니다. php.ini 설정을 확인해 주세요.', 413);
}
require_post();

function upload_error_message(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE   => '파일이 서버 업로드 한도(upload_max_filesize: ' . ini_get('upload_max_filesize') . ')를 초과했습니다.',
        UPLOAD_ERR_FORM_SIZE  => '파일 크기가 너무 큽니다.',
        UPLOAD_ERR_PARTIAL    => '파일이 일부만 업로드되었습니다. 다시 시도해 주세요.',
        UPLOAD_ERR_NO_FILE    => '업로드할 파일을 선택해 주세요.',
        default               => '파일 업로드 중 서버 오류가 발생했습니다. (코드 ' . $code . ')',
    };
}

/** 업로드된 이미지 필드 검증 후 바이트 반환 */
function uploaded_image(string $field): ?string
{
    $f = $_FILES[$field] ?? null;
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($f['error'] !== UPLOAD_ERR_OK) {
        json_error('표지 이미지: ' . upload_error_message((int)$f['error']));
    }
    if ($f['size'] > (int)setting('max_image_size')) {
        json_error('표지 이미지는 최대 ' . format_bytes((int)setting('max_image_size')) . '까지 업로드할 수 있습니다.');
    }
    if ($field === 'cover') {
        $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_IMAGE_EXT, true)) {
            json_error('표지 이미지는 JPG, PNG, WebP 형식만 업로드할 수 있습니다.');
        }
    }
    $bytes = (string)file_get_contents($f['tmp_name']);
    if (!validate_image_bytes($bytes)) {
        json_error('표지 이미지 파일이 올바르지 않습니다. JPG, PNG, WebP 이미지인지 확인해 주세요.');
    }
    return $bytes;
}

$file = $_FILES['book'] ?? null;
if (!$file) {
    json_error('업로드할 PDF 또는 EPUB 파일을 선택해 주세요.');
}
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_error(upload_error_message((int)$file['error']));
}

$original = safe_filename((string)$file['name']);
$ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
if ($original === '' || !in_array($ext, ALLOWED_BOOK_EXT, true)) {
    json_error('PDF 또는 EPUB 파일만 업로드할 수 있습니다.');
}
if ($file['size'] > (int)setting('max_file_size')) {
    json_error('파일은 최대 ' . format_bytes((int)setting('max_file_size')) . '까지 업로드할 수 있습니다. (현재 ' . format_bytes((int)$file['size']) . ')');
}

// 실제 파일 내용 확인
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if ($ext === 'pdf' && $mime !== 'application/pdf') {
    json_error('올바른 PDF 파일이 아닙니다. 파일이 손상되었거나 확장자만 바뀐 파일일 수 있습니다.');
}
if ($ext === 'epub') {
    $zip = class_exists('ZipArchive') ? new ZipArchive() : null;
    if (!in_array($mime, ['application/epub+zip', 'application/zip', 'application/octet-stream'], true)
        || ($zip && $zip->open($file['tmp_name']) !== true)) {
        json_error('올바른 EPUB 파일이 아닙니다. 파일이 손상되었는지 확인해 주세요.');
    }
    $zip?->close();
}

$isDuplicate = function (array $books) use ($original): bool {
    foreach ($books as $b) {
        if (mb_strtolower($b['filename']) === mb_strtolower($original)) {
            return true;
        }
    }
    return false;
};
if ($isDuplicate(json_read('books'))) {
    json_error("같은 파일명('{$original}')의 책이 이미 등록되어 있습니다.", 409);
}

$manualCover = uploaded_image('cover');
$clientCover = $manualCover === null ? uploaded_image('cover_auto') : null;

// 파일 저장
$dir = books_dir();
if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
    json_error('책 저장 폴더를 만들 수 없습니다. 설정의 파일 저장 경로를 확인해 주세요.', 500);
}
$stored = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$target = $dir . '/' . $stored;
if (!move_uploaded_file($file['tmp_name'], $target)) {
    json_error('파일을 저장하지 못했습니다. 저장 폴더의 쓰기 권한을 확인해 주세요.', 500);
}

// 제목 / 저자 (비워두면 EPUB 메타데이터 또는 파일명 사용)
$title = input_str('title', 200);
$author = input_str('author', 100);
$description = input_str('description', BOOK_DESCRIPTION_MAX);
if ($ext === 'epub' && ($title === '' || $author === '')) {
    $meta = extract_epub_metadata($target);
    $title = $title !== '' ? $title : mb_substr($meta['title'], 0, 200);
    $author = $author !== '' ? $author : mb_substr($meta['author'], 0, 100);
}
if ($title === '') {
    $title = pathinfo($original, PATHINFO_FILENAME);
}
if ($author === '') {
    $author = '작자 미상';
}

// 표지 결정: 수동 > 서버 추출(EPUB/PDF 렌더링) > 브라우저 렌더링 > PDF 내장 이미지 > 기본
$coverBytes = null;
$coverSource = 'default';
if ($manualCover !== null) {
    [$coverBytes, $coverSource] = [$manualCover, 'manual'];
} else {
    $extracted = $ext === 'epub' ? extract_epub_cover($target) : render_pdf_first_page($target);
    if ($extracted) {
        [$coverBytes, $coverSource] = [$extracted['bytes'], $extracted['method']];
    } elseif ($clientCover !== null) {
        [$coverBytes, $coverSource] = [$clientCover, 'browser'];
    } elseif ($ext === 'pdf' && ($embedded = extract_pdf_embedded_jpeg($target))) {
        [$coverBytes, $coverSource] = [$embedded['bytes'], 'embedded'];
    }
}

$book = json_update('books', function (&$books) use ($isDuplicate, $original, $stored, $title, $author, $description, $ext, $target, $coverBytes, $coverSource, $user) {
    if ($isDuplicate($books)) {
        return null;
    }
    $id = next_id($books);
    $maxOrder = -1;
    foreach ($books as $b) {
        $maxOrder = max($maxOrder, (int)($b['order'] ?? 0));
    }
    $cover = $coverBytes !== null ? save_cover_bytes($coverBytes, $id) : null;
    $book = [
        'id'           => $id,
        'title'        => $title,
        'author'       => $author,
        'description'  => $description,
        'owner_id'     => (int)$user['id'],
        'filename'     => $original,
        'stored_name'  => $stored,
        'filesize'     => (int)filesize($target),
        'format'       => $ext,
        'cover'        => $cover,
        'cover_source' => $cover ? $coverSource : 'default',
        'created_at'   => now(),
        'order'        => $maxOrder + 1,
    ];
    $books[] = $book;
    return $book;
});

if ($book === null) {
    @unlink($target);
    json_error("같은 파일명('{$original}')의 책이 이미 등록되어 있습니다.", 409);
}

$sourceLabel = [
    'manual' => '직접 올린 표지', 'epub' => 'EPUB 표지 자동 추출', 'imagick' => 'PDF 첫 페이지 자동 추출',
    'pdftoppm' => 'PDF 첫 페이지 자동 추출', 'convert' => 'PDF 첫 페이지 자동 추출',
    'browser' => 'PDF 첫 페이지 자동 추출(브라우저)', 'embedded' => 'PDF 내장 이미지 추출', 'default' => '기본 표지 사용',
][$book['cover_source']] ?? '';

json_ok([
    'message' => "'{$book['title']}' 등록 완료 ({$sourceLabel})",
    'book'    => public_book($book),
]);
