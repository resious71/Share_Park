<?php
/** 내 비밀번호 변경 (기존 비밀번호 확인) */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
require_post();

$input = request_input();
$current = (string)($input['current_password'] ?? '');
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');

if ($current === '' || $new === '') {
    json_error('현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.');
}
if ($new !== $confirm) {
    json_error('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
}
if (!password_verify($current, $user['password'])) {
    json_error('현재 비밀번호가 올바르지 않습니다.', 403);
}

$hash = password_hash($new, PASSWORD_BCRYPT);
json_update('users', function (&$users) use ($user, $hash) {
    foreach ($users as &$u) {
        if ((int)$u['id'] === (int)$user['id']) {
            $u['password'] = $hash;
        }
    }
});
json_ok(['message' => '비밀번호를 변경했습니다.']);
