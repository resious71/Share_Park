<?php
/** 책 검색 / 목록 (사용자 순서 적용) */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
$q = input_str('q', 100);
if ($q === '' && isset($_GET['q'])) {
    $q = mb_substr(trim((string)$_GET['q']), 0, 100);
}

$books = books_for_user((int)$user['id']);
if ($q !== '') {
    $books = array_values(array_filter($books, fn($b) =>
        mb_stripos($b['title'], $q) !== false || mb_stripos($b['author'], $q) !== false));
}

json_ok([
    'query'            => $q,
    'books'            => array_map('public_book', $books),
    'total'            => count(json_read('books')),
    'has_custom_order' => user_has_custom_order((int)$user['id']),
    'limit'            => download_limit_info($user),
]);
