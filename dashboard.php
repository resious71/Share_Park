<?php
/** 사용자 도서 목록 (대시보드) */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/layout.php';

$user = require_login_page();

render_head('도서 목록', 'dashboard');
render_header($user, 'dashboard');
?>
<main class="container">
  <div id="limit-banner" class="limit-banner" hidden></div>

  <section class="toolbar card">
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" id="book-search" class="input" placeholder="책 제목이나 저자로 검색" aria-label="책 검색">
    </div>
    <div class="toolbar-right">
      <span id="custom-order-badge" class="badge badge-star" hidden title="나만의 순서가 저장되어 있습니다">★ 내 순서 저장됨</span>
      <label class="sort-label" for="sort-select">정렬</label>
      <select id="sort-select" class="input select">
        <option value="custom">⭐ 커스텀 (내 순서)</option>
        <option value="title">가나다 · 제목순</option>
        <option value="author">저자순</option>
        <option value="newest">최근 추가순</option>
        <option value="oldest">오래된 추가순</option>
      </select>
      <button type="button" id="reset-order-btn" class="btn btn-ghost btn-sm" hidden title="관리자가 정한 기본 순서로 되돌립니다">↺ 기본 순서</button>
    </div>
  </section>

  <p id="drag-hint" class="hint" hidden>💡 카드 왼쪽 위의 <strong>⠿</strong> 손잡이를 끌어서 책 순서를 바꿀 수 있어요. 순서는 자동으로 저장됩니다.</p>

  <section id="book-grid" class="book-grid" aria-live="polite"></section>

  <div id="empty-state" class="empty-state card" hidden>
    <div class="empty-icon">📭</div>
    <h2>아직 등록된 책이 없어요</h2>
    <p class="muted">관리자가 책을 등록하면 이곳에 표시됩니다.<?= is_admin($user) ? ' <a href="admin.php#books">관리자 페이지에서 책을 등록해 보세요 →</a>' : '' ?></p>
  </div>
  <div id="no-results" class="empty-state card" hidden>
    <div class="empty-icon">🔎</div>
    <h2>검색 결과가 없습니다</h2>
    <p class="muted">다른 검색어를 입력하거나 철자를 확인해 보세요.</p>
  </div>
</main>
<?php render_footer(['js/dragdrop.js', 'js/agreement.js', 'js/dashboard.js']);
