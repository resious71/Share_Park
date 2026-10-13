<?php
/** 공통 레이아웃 (헤더 / 푸터) */
if (!defined('APP_ROOT')) {
    http_response_code(403);
    exit;
}

function send_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: same-origin');
}

function render_head(string $pageTitle, string $page): void
{
    send_security_headers();
    $site = h(setting('site_title'));
    ?>
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title><?= h($pageTitle) ?> · <?= $site ?></title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
  <link rel="stylesheet" href="css/style.css?v=<?= APP_VERSION ?>">
</head>
<body data-page="<?= h($page) ?>">
<div id="page-loader" class="page-loader" aria-hidden="true"><div class="spinner"></div></div>
    <?php
}

function render_header(array $user, string $page): void
{
    $site = h(setting('site_title'));
    $admin = is_admin($user);
    ?>
<header class="app-header">
  <div class="header-inner">
    <a class="brand" href="dashboard.php"><span class="brand-icon">📚</span><span class="brand-name"><?= $site ?></span></a>
    <nav class="header-nav" aria-label="주 메뉴">
      <a href="dashboard.php" class="nav-link<?= $page === 'dashboard' ? ' active' : '' ?>">📖 <span>도서</span></a>
      <?php if ($admin): ?>
      <a href="admin.php" class="nav-link<?= $page === 'admin' ? ' active' : '' ?>">🛠️ <span>관리자</span></a>
      <?php endif; ?>
      <a href="mypage.php" class="nav-link user-link<?= $page === 'mypage' ? ' active' : '' ?>" title="마이페이지">
        <span class="avatar"><?= h(mb_strtoupper(mb_substr($user['username'], 0, 1))) ?></span>
        <span class="user-name"><?= h($user['username']) ?></span>
        <?php if ($admin): ?><span class="badge badge-lavender">관리자</span><?php endif; ?>
      </a>
      <a href="logout.php?token=<?= h(csrf_token()) ?>" class="nav-link logout-link" title="로그아웃">🚪 <span>로그아웃</span></a>
    </nav>
  </div>
</header>
    <?php
}

function render_footer(array $scripts = []): void
{
    ?>
<div id="toast-container" class="toast-container" role="status" aria-live="polite"></div>
<script src="js/script.js?v=<?= APP_VERSION ?>"></script>
<?php foreach ($scripts as $src): ?>
<script src="<?= h($src) ?>?v=<?= APP_VERSION ?>"></script>
<?php endforeach; ?>
</body>
</html>
    <?php
}
