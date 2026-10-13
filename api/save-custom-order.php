<?php
/** 사용자별 책 순서 저장 / 초기화 */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
require_post();

$uid = (string)$user['id'];

if (input_bool('reset')) {
    json_update('user-custom-orders', function (&$orders) use ($uid) {
        unset($orders[$uid]);
    });
    json_ok(['message' => '기본 순서로 되돌렸습니다.', 'has_custom_order' => false]);
}

$order = request_input()['order'] ?? null;
if (!is_array($order)) {
    json_error('저장할 순서 정보가 없습니다.');
}

$valid = [];
foreach (json_read('books') as $b) {
    $valid[(int)$b['id']] = true;
}
$clean = [];
foreach ($order as $id) {
    $id = (int)$id;
    if (isset($valid[$id]) && !in_array($id, $clean, true)) {
        $clean[] = $id;
    }
}

json_update('user-custom-orders', function (&$orders) use ($uid, $clean) {
    $orders[$uid] = $clean;
});

json_ok(['message' => '나만의 순서를 저장했습니다.', 'has_custom_order' => true]);
