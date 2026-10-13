<?php
/** 로그인 처리 */
require_once __DIR__ . '/../config.php';

require_post();

$username = input_str('username', 50);
$password = (string)(request_input()['password'] ?? '');

if ($username === '' || $password === '') {
    json_error('아이디와 비밀번호를 모두 입력해 주세요.');
}

// 연속 실패 시 응답 지연 (무차별 대입 완화)
$fails = (int)($_SESSION['login_fails'] ?? 0);
if ($fails >= 5) {
    sleep(min(5, $fails - 4));
}

$user = find_user_by_name($username);
if (!$user || !password_verify($password, $user['password'])) {
    $_SESSION['login_fails'] = $fails + 1;
    json_error('아이디 또는 비밀번호가 올바르지 않습니다. 대소문자와 입력 내용을 확인해 주세요.', 401);
}

// 해시 알고리즘 갱신이 필요하면 재해싱
if (password_needs_rehash($user['password'], PASSWORD_BCRYPT)) {
    json_update('users', function (&$users) use ($user, $password) {
        foreach ($users as &$u) {
            if ((int)$u['id'] === (int)$user['id']) {
                $u['password'] = password_hash($password, PASSWORD_BCRYPT);
            }
        }
    });
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['login_fails'] = 0;
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

json_ok([
    'redirect' => 'dashboard.php',
    'user'     => public_user($user),
]);
