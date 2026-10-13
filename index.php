<?php
/** 로그인 페이지 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/layout.php';

if (current_user()) {
    header('Location: dashboard.php');
    exit;
}

// 기본 관리자 비밀번호가 그대로인 경우 안내
$defaultHint = false;
$users = json_read('users');
if (count($users) === 1 && $users[0]['username'] === DEFAULT_ADMIN_USERNAME
    && password_verify(DEFAULT_ADMIN_PASSWORD, $users[0]['password'])) {
    $defaultHint = true;
}

render_head('로그인', 'login');
?>
<main class="login-page">
  <div class="login-card card">
    <div class="login-logo">📚</div>
    <h1 class="login-title"><?= h(setting('site_title')) ?></h1>
    <p class="login-subtitle">개인 전자책 라이브러리에 오신 것을 환영합니다</p>

    <?php if (isset($_GET['logged_out'])): ?>
      <div class="alert alert-info">👋 안전하게 로그아웃되었습니다.</div>
    <?php endif; ?>
    <?php if ($defaultHint): ?>
      <div class="alert alert-warning">🔑 초기 관리자 계정: <strong>admin / admin</strong><br>로그인 후 마이페이지에서 비밀번호를 꼭 변경해 주세요.</div>
    <?php endif; ?>

    <form id="login-form" class="form" autocomplete="on" novalidate>
      <div class="form-group">
        <label for="username">아이디</label>
        <input type="text" id="username" name="username" class="input" autocomplete="username" required autofocus placeholder="아이디를 입력하세요">
      </div>
      <div class="form-group">
        <label for="password">비밀번호</label>
        <input type="password" id="password" name="password" class="input" autocomplete="current-password" required placeholder="비밀번호를 입력하세요">
      </div>
      <div id="login-error" class="form-error" role="alert" hidden></div>
      <button type="submit" class="btn btn-primary btn-block btn-lg">로그인</button>
    </form>
  </div>
  <p class="login-footer">© <?= date('Y') ?> <?= h(APP_NAME) ?></p>
</main>
<?php render_footer();
