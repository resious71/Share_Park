<?php
/**
 * 파일 다운로드
 * record-agreement.php 에서 발급한 1회용 토큰이 있어야 하며,
 * 다운로드 제한을 잠금 상태에서 다시 확인한 뒤 기록하고 파일을 전송합니다.
 */
require_once __DIR__ . '/../config.php';

function download_fail(string $message, int $code = 400): void
{
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    $title = h(setting('site_title'));
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>다운로드 오류 - ' . $title . '</title><link rel="stylesheet" href="../css/style.css"></head>'
        . '<body class="center-page"><div class="card narrow-card"><div class="empty-icon">⚠️</div>'
        . '<h1 class="card-title">다운로드할 수 없습니다</h1><p class="muted">' . h($message) . '</p>'
        . '<a class="btn btn-primary" href="../dashboard.php">도서 목록으로 돌아가기</a></div></body></html>';
    exit;
}

$user = current_user();
if (!$user) {
    download_fail('로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.', 401);
}

$token = (string)($_GET['token'] ?? '');
$entry = $_SESSION['download_tokens'][$token] ?? null;
if ($token === '' || !$entry) {
    download_fail('다운로드 동의 정보가 없습니다. 도서 목록에서 다운로드 버튼을 눌러 동의서에 동의해 주세요.', 403);
}
// 1회용: 즉시 폐기
unset($_SESSION['download_tokens'][$token]);
if ($entry['expires'] < time()) {
    download_fail('다운로드 유효 시간이 지났습니다. 다시 다운로드 버튼을 눌러 주세요.', 403);
}

$book = find_book((int)$entry['book_id']);
if (!$book) {
    download_fail('책을 찾을 수 없습니다. 삭제되었을 수 있습니다.', 404);
}
$path = path_in(books_dir(), $book['stored_name'] ?? $book['filename']);
if (!$path || !is_file($path)) {
    download_fail('파일을 찾을 수 없습니다. 관리자에게 문의해 주세요.', 404);
}

// 제한 확인 + 기록 (원자적)
$result = json_update('downloads', function (&$list) use ($user, $book, $entry) {
    $limit = download_limit_info($user, $list);
    if (!$limit['can_download']) {
        return $limit;
    }
    $list[] = [
        'id'              => next_id($list),
        'user_id'         => (int)$user['id'],
        'username'        => $user['username'],
        'book_id'         => (int)$book['id'],
        'book_title'      => $book['title'],
        'book_author'     => $book['author'],
        'agreement_id'    => (int)$entry['agreement_id'],
        'downloaded_at'   => now(),
        'downloaded_date' => date('Y-m-d'),
    ];
    return true;
});
if ($result !== true) {
    download_fail('오늘의 다운로드 횟수를 초과했습니다. ' . $result['next_reset'] . ' 이후에 다시 시도해 주세요.', 429);
}

session_write_close();

$filename = $book['filename'];
$ascii = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename);
if (!preg_match('/[A-Za-z0-9]/', pathinfo($ascii, PATHINFO_FILENAME))) {
    $ascii = 'ebook_' . (int)$book['id'] . '.' . $book['format']; // 한글 파일명용 대체 이름 (최신 브라우저는 filename* 사용)
}
$mime = $book['format'] === 'epub' ? 'application/epub+zip' : 'application/pdf';

while (ob_get_level()) {
    ob_end_clean();
}
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header("Content-Disposition: attachment; filename=\"{$ascii}\"; filename*=UTF-8''" . rawurlencode($filename));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');

$fp = fopen($path, 'rb');
while (!feof($fp)) {
    echo fread($fp, 1024 * 256);
    flush();
}
fclose($fp);
exit;
