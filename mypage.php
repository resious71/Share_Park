<?php
/** 사용자 마이페이지 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_login_page();
$limit = download_limit_info($user);

render_head('마이페이지', 'mypage');
render_header($user, 'mypage');
?>
<main class="container narrow">
  <h1 class="page-title">👤 마이페이지</h1>

  <div class="tabs" role="tablist">
    <button class="tab active" role="tab" data-tab="profile" aria-selected="true">프로필</button>
    <button class="tab" role="tab" data-tab="history" aria-selected="false">다운로드 히스토리</button>
  </div>

  <section class="tab-panel active" id="tab-profile" role="tabpanel">
    <div class="card">
      <h2 class="card-title">계정 정보</h2>
      <dl class="info-list">
        <div><dt>아이디</dt><dd><?= h($user['username']) ?></dd></div>
        <div><dt>가입일</dt><dd><?= h($user['created_at'] ?? '-') ?></dd></div>
        <div><dt>권한</dt><dd><?= is_admin($user) ? '<span class="badge badge-lavender">관리자</span>' : '<span class="badge badge-sky">일반 사용자</span>' ?></dd></div>
        <div><dt>오늘 남은 다운로드</dt><dd class="js-remaining"><?=
            $limit['unlimited'] ? '<span class="badge badge-mint">무제한</span>'
            : h($limit['remaining'] . '회 남음 (' . $limit['used'] . '/' . $limit['limit'] . ' 사용)') ?></dd></div>
      </dl>
    </div>

    <div class="card">
      <h2 class="card-title">비밀번호 변경</h2>
      <form id="password-form" class="form" novalidate>
        <div class="form-group">
          <label for="current_password">현재 비밀번호</label>
          <input type="password" id="current_password" name="current_password" class="input" autocomplete="current-password" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="new_password">새 비밀번호</label>
            <input type="password" id="new_password" name="new_password" class="input" autocomplete="new-password" required>
          </div>
          <div class="form-group">
            <label for="confirm_password">새 비밀번호 확인</label>
            <input type="password" id="confirm_password" name="confirm_password" class="input" autocomplete="new-password" required>
          </div>
        </div>
        <p class="form-help">비밀번호에는 길이나 문자 종류 제한이 없습니다.</p>
        <button type="submit" class="btn btn-primary">비밀번호 변경</button>
      </form>
    </div>
  </section>

  <section class="tab-panel" id="tab-history" role="tabpanel" hidden>
    <div id="history-limit" class="limit-banner"></div>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">내가 다운로드한 책</h2>
        <div class="search-box small">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input type="search" id="history-search" class="input" placeholder="책 제목 검색" aria-label="다운로드 히스토리 검색">
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>책 제목</th><th>저자</th><th>날짜</th><th>시간</th></tr></thead>
          <tbody id="history-body"></tbody>
        </table>
      </div>
      <div id="history-pagination" class="pagination"></div>
    </div>
  </section>
</main>
<?php render_footer(['js/mypage.js']);
