<?php
/** 내 다운로드 히스토리 (본인 기록만) */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
$q = mb_substr(trim((string)($_GET['q'] ?? '')), 0, 100);
$page = max(1, (int)($_GET['page'] ?? 1));

$books = [];
foreach (json_read('books') as $b) {
    $books[(int)$b['id']] = $b;
}

$list = array_values(array_filter(json_read('downloads'), fn($d) => (int)$d['user_id'] === (int)$user['id']));
if ($q !== '') {
    $list = array_values(array_filter($list, fn($d) => mb_stripos($d['book_title'], $q) !== false));
}
usort($list, fn($a, $b) => strcmp($b['downloaded_at'], $a['downloaded_at']) ?: $b['id'] <=> $a['id']);

$total = count($list);
$pages = max(1, (int)ceil($total / HISTORY_PAGE_SIZE));
$page = min($page, $pages);
$items = array_map(function ($d) use ($books) {
    $book = $books[(int)$d['book_id']] ?? null;
    return [
        'book_id'     => (int)$d['book_id'],
        'book_title'  => $book['title'] ?? $d['book_title'],
        'book_author' => $book['author'] ?? ($d['book_author'] ?? '-'),
        'date'        => substr($d['downloaded_at'], 0, 10),
        'time'        => substr($d['downloaded_at'], 11, 8),
        'available'   => $book !== null,
    ];
}, array_slice($list, ($page - 1) * HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE));

json_ok([
    'items' => $items,
    'total' => $total,
    'page'  => $page,
    'pages' => $pages,
    'limit' => download_limit_info($user),
]);
