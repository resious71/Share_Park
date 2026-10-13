<?php
/** 로그아웃 */
require_once __DIR__ . '/config.php';

start_session();
if (!verify_csrf((string)($_GET['token'] ?? ''))) {
    header('Location: dashboard.php');
    exit;
}
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();
header('Location: index.php?logged_out=1');
