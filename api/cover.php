<?php
/** 표지 이미지 전송 (표지가 없으면 기본 표지 SVG 생성) */
require_once __DIR__ . '/../config.php';

if (!current_user()) {
    http_response_code(401);
    exit;
}
session_write_close();

$book = find_book((int)($_GET['id'] ?? 0));
if (!$book) {
    http_response_code(404);
    exit;
}

header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=86400');

$path = !empty($book['cover']) ? path_in(covers_dir(), $book['cover']) : null;
if ($path && is_file($path)) {
    $info = @getimagesize($path);
    $mime = $info['mime'] ?? 'image/jpeg';
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        http_response_code(415);
        exit;
    }
    $etag = '"' . md5($path . filemtime($path)) . '"';
    header('ETag: ' . $etag);
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        exit;
    }
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// 기본 표지: 파스텔 그라데이션 + 제목
$palettes = [
    ['#a29bfe', '#dcd6ff'], ['#74b9ff', '#d4e9ff'], ['#00b894', '#c8f5e8'],
    ['#ff9ff3', '#ffe0fb'], ['#fdcb6e', '#fff1d0'], ['#81ecec', '#dcfafa'],
];
[$c1, $c2] = $palettes[(int)$book['id'] % count($palettes)];

$lines = [];
$line = '';
foreach (preg_split('//u', $book['title'], -1, PREG_SPLIT_NO_EMPTY) as $ch) {
    $line .= $ch;
    if (mb_strwidth($line) >= 16) {
        $lines[] = $line;
        $line = '';
    }
}
if ($line !== '') {
    $lines[] = $line;
}
$lines = array_slice($lines, 0, 5);
$text = '';
$y = 150 - (count($lines) - 1) * 14;
foreach ($lines as $i => $l) {
    $text .= '<tspan x="100" y="' . ($y + $i * 28) . '">' . h(trim($l)) . '</tspan>';
}
$fmt = h(strtoupper($book['format']));
$author = h(mb_substr($book['author'], 0, 20));

header('Content-Type: image/svg+xml; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'");
echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{$c2}"/><stop offset="1" stop-color="{$c1}"/>
  </linearGradient></defs>
  <rect width="200" height="300" fill="url(#g)"/>
  <rect x="12" y="12" width="176" height="276" rx="6" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>
  <text x="100" y="52" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30">📖</text>
  <text text-anchor="middle" font-family="system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="18" font-weight="700" fill="#2d3436">{$text}</text>
  <text x="100" y="250" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#2d3436" fill-opacity="0.75">{$author}</text>
  <text x="100" y="274" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#2d3436" fill-opacity="0.6" letter-spacing="2">{$fmt}</text>
</svg>
SVG;
