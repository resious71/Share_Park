<?php
/**
 * 동의서 검증
 * 다운로드 전 동의서 표시가 필요한지, 다운로드 가능한지 확인합니다.
 */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
$bookId = (int)($_GET['book_id'] ?? 0);
$book = find_book($bookId);
if (!$book) {
    json_error('책을 찾을 수 없습니다. 목록을 새로고침해 주세요.', 404);
}

$skipUntil = agreement_skip_until((int)$user['id']);

json_ok([
    'book'               => public_book($book),
    'need_agreement'     => $skipUntil === null,
    'skip_until'         => $skipUntil,
    'days_ignore'        => (int)setting('days_ignore_agreement'),
    'agreement_version'  => (string)setting('agreement_version'),
    'agreement_html'     => render_agreement_html((string)setting('agreement_text')),
    'limit'              => download_limit_info($user),
]);
