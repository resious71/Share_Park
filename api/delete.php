<?php
/** 책 삭제 (파일 + 표지 + 메타데이터) */
require_once __DIR__ . '/../config.php';

require_admin_api();
require_post();

$id = input_int('id');
$deleted = json_update('books', function (&$books) use ($id) {
    foreach ($books as $i => $b) {
        if ((int)$b['id'] === $id) {
            array_splice($books, $i, 1);
            return $b;
        }
    }
    return null;
});
if (!$deleted) {
    json_error('책을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.', 404);
}

if ($p = path_in(books_dir(), $deleted['stored_name'] ?? $deleted['filename'])) {
    @unlink($p);
}
if (!empty($deleted['cover']) && ($p = path_in(covers_dir(), $deleted['cover']))) {
    @unlink($p);
}
json_update('user-custom-orders', function (&$orders) use ($id) {
    foreach ($orders as $uid => $list) {
        $orders[$uid] = array_values(array_filter($list, fn($x) => (int)$x !== $id));
    }
});

json_ok(['message' => "'{$deleted['title']}' 책을 삭제했습니다."]);
