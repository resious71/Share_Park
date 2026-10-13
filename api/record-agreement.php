<?php
/**
 * 동의 기록 저장 + 1회용 다운로드 토큰 발급
 *
 * 동의(또는 유효한 "다시 보지 않기")가 확인된 경우에만 토큰을 발급하며,
 * api/download.php 는 이 토큰이 있어야만 파일을 전송합니다.
 */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
require_post();

$bookId = input_int('book_id');
$book = find_book($bookId);
if (!$book) {
    json_error('책을 찾을 수 없습니다. 목록을 새로고침해 주세요.', 404);
}

$limit = download_limit_info($user);
if (!$limit['can_download']) {
    json_error('오늘의 다운로드 횟수를 초과했습니다. ' . $limit['next_reset'] . ' 이후에 다시 시도해 주세요.', 429, ['limit' => $limit]);
}

$viaSkip = input_bool('via_skip');
$skipUntil = agreement_skip_until((int)$user['id']);
if ($viaSkip) {
    if ($skipUntil === null) {
        json_error('동의서 확인이 필요합니다.', 403, ['need_agreement' => true]);
    }
} elseif (!input_bool('agreed')) {
    json_error('동의서에 동의해야 다운로드할 수 있습니다.', 403, ['need_agreement' => true]);
}

$version = (string)setting('agreement_version');
$record = json_update('download-agreements', function (&$list) use ($user, $book, $version, $viaSkip) {
    $rec = [
        'id'         => next_id($list),
        'user_id'    => (int)$user['id'],
        'username'   => $user['username'],
        'book_id'    => (int)$book['id'],
        'book_title' => $book['title'],
        'agreed_at'  => now(),
        'agreed_date'=> date('Y-m-d'),
        'ip_address' => client_ip(),
        'version'    => $version,
        'method'     => $viaSkip ? 'remembered' : 'modal',
    ];
    $list[] = $rec;
    return $rec;
});

// "다시 보지 않기"
$days = (int)setting('days_ignore_agreement');
if (!$viaSkip && $days > 0 && input_bool('dont_show_again')) {
    $expires = date('Y-m-d H:i:s', strtotime("+{$days} days"));
    json_update('agreement-skips', function (&$skips) use ($user, $expires, $version) {
        $skips[(string)$user['id']] = [
            'expires_at' => $expires,
            'version'    => $version,
            'set_at'     => now(),
        ];
    });
}

// 1회용 다운로드 토큰
$token = bin2hex(random_bytes(24));
$tokens = array_filter($_SESSION['download_tokens'] ?? [], fn($t) => $t['expires'] > time());
$tokens[$token] = [
    'book_id'      => (int)$book['id'],
    'agreement_id' => (int)$record['id'],
    'expires'      => time() + DOWNLOAD_TOKEN_TTL,
];
$_SESSION['download_tokens'] = $tokens;

json_ok([
    'download_url' => 'api/download.php?token=' . $token,
    'agreement_id' => $record['id'],
]);
