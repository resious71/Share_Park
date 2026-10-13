<?php
/** 다운로드 통계 / 최근 다운로드 / 동의 기록 (관리자) */
require_once __DIR__ . '/../config.php';

require_admin_api();

$downloads = json_read('downloads');
$today = date('Y-m-d');
$month = date('Y-m');
$todayCount = $monthCount = 0;
$bookCounts = [];
foreach ($downloads as $d) {
    if ($d['downloaded_date'] === $today) {
        $todayCount++;
    }
    if (str_starts_with($d['downloaded_date'], $month)) {
        $monthCount++;
    }
    $key = (int)$d['book_id'];
    $bookCounts[$key] ??= ['book_id' => $key, 'book_title' => $d['book_title'], 'count' => 0];
    $bookCounts[$key]['count']++;
}
usort($bookCounts, fn($a, $b) => $b['count'] <=> $a['count']);

$names = [];
foreach (json_read('users') as $u) {
    $names[(int)$u['id']] = $u['username'];
}
$withName = function (array $row) use ($names) {
    $row['username'] = $names[(int)$row['user_id']] ?? (($row['username'] ?? '') . ' (삭제됨)');
    return $row;
};

$recent = $downloads;
usort($recent, fn($a, $b) => $b['id'] <=> $a['id']);
$recent = array_map($withName, array_slice($recent, 0, 10));

$agreements = json_read('download-agreements');
$filterUser = (int)($_GET['agreement_user'] ?? 0);
if ($filterUser) {
    $agreements = array_filter($agreements, fn($a) => (int)$a['user_id'] === $filterUser);
}
usort($agreements, fn($a, $b) => $b['id'] <=> $a['id']);

json_ok([
    'stats' => [
        'today'      => $todayCount,
        'month'      => $monthCount,
        'total'      => count($downloads),
        'users'      => count($names),
        'books'      => count(json_read('books')),
        'agreements' => count(json_read('download-agreements')),
    ],
    'top_books'  => array_slice($bookCounts, 0, 5),
    'recent'     => $recent,
    'agreements' => array_map($withName, array_slice($agreements, 0, 50)),
]);
