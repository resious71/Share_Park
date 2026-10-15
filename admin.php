<?php
/** 관리자 페이지 (탭: 계정, 도서, 설정, 다운로드 관리, 가이드) */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/upload-form.php';

$user = require_admin_page();

function help_btn(string $key): string
{
    return '<button type="button" class="help-btn" data-help="' . h($key) . '" aria-label="도움말 보기" title="도움말">?</button>';
}

render_head('관리자', 'admin');
render_header($user, 'admin');
?>
<main class="container" id="admin-main" data-me="<?= (int)$user['id'] ?>">
  <div class="page-heading">
    <h1 class="page-title">🛠️ 관리자 페이지</h1>
    <button type="button" id="tour-restart" class="btn btn-ghost btn-sm">🧭 둘러보기 다시 보기</button>
  </div>

  <div class="tabs" role="tablist" id="admin-tabs">
    <button class="tab active" role="tab" data-tab="accounts" aria-selected="true">👥 계정</button>
    <button class="tab" role="tab" data-tab="books" aria-selected="false">📚 도서</button>
    <button class="tab" role="tab" data-tab="settings" aria-selected="false">⚙️ 설정</button>
    <button class="tab" role="tab" data-tab="downloads" aria-selected="false">📊 다운로드 관리</button>
    <button class="tab" role="tab" data-tab="guide" aria-selected="false">📘 가이드</button>
  </div>

  <!-- ===================== 계정 ===================== -->
  <section class="tab-panel active" id="tab-accounts" role="tabpanel">
    <div class="card" id="user-create-card">
      <div class="card-header">
        <h2 class="card-title">새 사용자 추가 <?= help_btn('accounts') ?></h2>
      </div>
      <form id="user-create-form" class="form form-inline" novalidate>
        <div class="form-group">
          <label for="new-username">아이디</label>
          <input type="text" id="new-username" name="username" class="input" required maxlength="30" placeholder="예: reader01" autocomplete="off">
        </div>
        <div class="form-group">
          <label for="new-password">비밀번호</label>
          <input type="text" id="new-password" name="password" class="input" required placeholder="제한 없음" autocomplete="off">
        </div>
        <div class="form-group">
          <label for="new-role">권한</label>
          <select id="new-role" name="is_admin" class="input select">
            <option value="0">일반 사용자</option>
            <option value="1">관리자</option>
          </select>
        </div>
        <button type="submit" class="btn btn-mint">➕ 추가</button>
      </form>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">사용자 목록 <?= help_btn('limits') ?></h2>
        <button type="button" class="btn btn-ghost btn-sm js-reset-all">↺ 전체 다운로드 제한 초기화</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>아이디</th><th>권한</th><th>가입일</th><th>오늘 사용</th><th>누적</th><th class="actions-col">관리</th></tr></thead>
          <tbody id="user-table-body"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ===================== 도서 ===================== -->
  <section class="tab-panel" id="tab-books" role="tabpanel" hidden>
    <?php render_upload_form(help_btn('books')); ?>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">등록된 책 <?= help_btn('order') ?></h2>
        <label class="page-size">
          <span class="muted small">페이지당</span>
          <select id="book-page-size" class="input select small" aria-label="페이지당 책 수">
            <option value="10">10권</option>
            <option value="20">20권</option>
            <option value="50">50권</option>
            <option value="0">전체</option>
          </select>
        </label>
      </div>
      <p class="muted small table-hint">⠿ 손잡이로 기본 표시 순서 변경(보고 있는 페이지 안에서) · 다운로드 횟수를 누르면 다운로드한 사용자를 볼 수 있습니다</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th class="handle-col"></th><th>표지</th><th>제목</th><th>저자</th><th>등록자</th><th>형식</th><th>등록일</th><th>크기</th><th>다운로드</th><th class="actions-col">관리</th></tr></thead>
          <tbody id="book-table-body"></tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="book-page-info" class="muted small"></span>
        <div id="book-pagination" class="pagination"></div>
      </div>
    </div>
  </section>

  <!-- ===================== 설정 ===================== -->
  <section class="tab-panel" id="tab-settings" role="tabpanel" hidden>
    <form id="settings-form" class="form" novalidate>
      <div class="card">
        <div class="card-header"><h2 class="card-title">일반 설정 <?= help_btn('settings') ?></h2></div>
        <div class="setting-item">
          <label for="s-site_title">사이트 제목</label>
          <input type="text" id="s-site_title" name="site_title" class="input" maxlength="100" required>
          <p class="form-help">헤더와 브라우저 탭에 표시되는 이름입니다. <span class="default">기본값: Share Park</span></p>
        </div>
        <div class="form-row">
          <div class="setting-item">
            <label for="s-daily_download_limit">하루 다운로드 제한 (회)</label>
            <input type="number" id="s-daily_download_limit" name="daily_download_limit" class="input" min="0" max="1000" required>
            <p class="form-help">사용자 1명이 하루에 다운로드할 수 있는 횟수입니다. 0이면 무제한입니다. 관리자는 제한을 받지 않습니다. <span class="default">기본값: 1</span></p>
          </div>
          <div class="setting-item">
            <label for="s-reset_time">제한 초기화 시간</label>
            <input type="time" id="s-reset_time" name="reset_time" class="input" required>
            <p class="form-help">매일 이 시각에 다운로드 횟수가 초기화됩니다. <span class="default">기본값: 00:00 (자정)</span></p>
          </div>
        </div>
        <div class="form-row">
          <div class="setting-item">
            <label for="s-max_file_size_mb">최대 전자책 파일 크기 (MB)</label>
            <input type="number" id="s-max_file_size_mb" name="max_file_size_mb" class="input" min="1" max="2048" step="0.1" required>
            <p class="form-help">PDF/EPUB 업로드 최대 크기입니다. <span class="default">기본값: 50MB</span> <span id="php-limit-note" class="warn-text"></span></p>
          </div>
          <div class="setting-item">
            <label for="s-max_image_size_mb">최대 표지 이미지 크기 (MB)</label>
            <input type="number" id="s-max_image_size_mb" name="max_image_size_mb" class="input" min="0.1" max="100" step="0.1" required>
            <p class="form-help">수동 업로드하는 표지 이미지의 최대 크기입니다. <span class="default">기본값: 5MB</span></p>
          </div>
        </div>
        <div class="setting-item">
          <label class="checkbox" for="s-allow_member_upload">
            <input type="checkbox" id="s-allow_member_upload" name="allow_member_upload">
            <span><strong>일반 회원의 책 등록 허용</strong><br><span class="form-help">켜면 회원이 마이페이지 → 내 책에서 직접 책을 등록하고, 자신이 등록한 책을 수정·삭제할 수 있습니다. <span class="default">기본값: 허용</span></span></span>
          </label>
        </div>
        <div class="setting-item">
          <label for="s-days_ignore_agreement">동의서 '다시 보지 않기' 기간 (일)</label>
          <input type="number" id="s-days_ignore_agreement" name="days_ignore_agreement" class="input" min="0" max="365" required>
          <p class="form-help">사용자가 '다시 보지 않기'를 선택하면 이 기간 동안 동의서를 생략합니다. 0이면 이 옵션을 숨기고 매번 동의서를 표시합니다. 생략된 다운로드도 동의 기록이 남습니다. <span class="default">기본값: 7일</span></p>
        </div>
      </div>

      <div class="card card-warning">
        <div class="card-header"><h2 class="card-title">⚠️ 파일 저장 경로 <?= help_btn('paths') ?></h2></div>
        <p class="warn-text">경로를 바꾸면 기존 파일은 자동으로 옮겨지지 않습니다. 기존 파일을 새 폴더로 직접 복사한 뒤 변경하세요. 잘못 설정하면 책을 다운로드할 수 없게 됩니다.</p>
        <div class="form-row">
          <div class="setting-item">
            <label for="s-books_path">전자책 저장 경로</label>
            <input type="text" id="s-books_path" name="books_path" class="input" placeholder="비워두면 기본 경로 사용">
            <p class="form-help">현재: <code id="eff-books"></code><br><span class="default">기본값: <code id="def-books"></code></span></p>
          </div>
          <div class="setting-item">
            <label for="s-covers_path">표지 이미지 저장 경로</label>
            <input type="text" id="s-covers_path" name="covers_path" class="input" placeholder="비워두면 기본 경로 사용">
            <p class="form-help">현재: <code id="eff-covers"></code><br><span class="default">기본값: <code id="def-covers"></code></span></p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">다운로드 동의서 <span class="badge badge-sky" id="agreement-version"></span> <?= help_btn('agreement') ?></h2>
          <button type="button" class="btn btn-ghost btn-sm" id="agreement-preview-btn">👁️ 미리보기</button>
        </div>
        <p class="form-help">작성 규칙: <code>## 제목</code> 은 섹션 제목, <code>- 내용</code> 은 항목, <code>**강조**</code> 는 굵게 표시됩니다. 내용을 바꾸면 버전이 올라가고 모든 사용자에게 동의서가 다시 표시됩니다.</p>
        <textarea id="s-agreement_text" name="agreement_text" class="input textarea" rows="14"></textarea>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost btn-sm" id="agreement-reset-btn">↺ 기본 문구로 복원</button>
        </div>
      </div>

      <div class="sticky-actions">
        <button type="submit" class="btn btn-primary btn-lg">💾 설정 저장</button>
      </div>
    </form>

    <div class="card card-danger">
      <div class="card-header"><h2 class="card-title">🚨 위험 구역</h2></div>
      <div class="danger-item">
        <div><strong>모든 사용자의 다운로드 제한 초기화</strong><p class="muted small">오늘 사용한 다운로드 횟수를 모두 0으로 되돌립니다.</p></div>
        <button type="button" class="btn btn-danger js-reset-all">초기화</button>
      </div>
      <div class="danger-item">
        <div><strong>모든 '다시 보지 않기' 설정 초기화</strong><p class="muted small">모든 사용자가 다음 다운로드 때 동의서를 다시 보게 됩니다.</p></div>
        <button type="button" class="btn btn-danger" id="reset-skips-btn">초기화</button>
      </div>
    </div>
  </section>

  <!-- ===================== 다운로드 관리 ===================== -->
  <section class="tab-panel" id="tab-downloads" role="tabpanel" hidden>
    <div class="section-heading">
      <h2>다운로드 통계 <?= help_btn('downloads') ?></h2>
      <button type="button" class="btn btn-ghost btn-sm js-reset-all">↺ 전체 다운로드 제한 초기화</button>
    </div>
    <div class="stat-grid" id="stat-grid"></div>

    <div class="grid-2">
      <div class="card">
        <h2 class="card-title">🕒 최근 다운로드 (10건)</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>사용자</th><th>책 제목</th><th>일시</th></tr></thead>
            <tbody id="recent-body"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title">🏆 인기 도서 TOP 5</h2>
        <ol class="rank-list" id="top-books"></ol>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📝 동의 기록 (최근 50건) <?= help_btn('agreement') ?></h2>
        <select id="agreement-user-filter" class="input select small"><option value="0">전체 사용자</option></select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>사용자</th><th>책 제목</th><th>동의 일시</th><th>IP</th><th>버전</th><th>방식</th></tr></thead>
          <tbody id="agreement-body"></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- ===================== 가이드 ===================== -->
  <section class="tab-panel" id="tab-guide" role="tabpanel" hidden>
    <div class="card guide-intro">
      <h2 class="card-title">📘 관리자 가이드</h2>
      <p>Share Park 관리자 기능의 사용 방법을 정리했습니다. 각 화면의 <span class="help-btn inline">?</span> 버튼을 누르면 해당 기능의 간단한 도움말도 볼 수 있습니다.</p>
      <button type="button" class="btn btn-sky btn-sm js-tour-start">🧭 둘러보기 시작</button>
    </div>
    <div id="guide-sections" class="guide-sections"></div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">❓ 자주 묻는 질문 (FAQ)</h2>
        <div class="search-box small">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input type="search" id="faq-search" class="input" placeholder="질문 검색" aria-label="FAQ 검색">
        </div>
      </div>
      <div id="faq-list" class="faq-list"></div>
      <p id="faq-empty" class="muted center" hidden>검색 결과가 없습니다.</p>
    </div>
  </section>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" defer></script>
<?php render_footer(['js/dragdrop.js', 'js/uploader.js', 'js/admin-guide.js', 'js/admin.js']);
