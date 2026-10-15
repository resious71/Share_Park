/**
 * Share Park - 관리자 페이지
 * 계정 / 도서 / 설정 / 다운로드 관리 탭
 */
(function () {
  'use strict';

  const SP = window.SP;
  const esc = (v) => SP.escapeHtml(v);
  const $ = (sel, root = document) => root.querySelector(sel);
  const ME = Number($('#admin-main').dataset.me);

  const state = {
    users: [],
    settings: null,
    loaded: {},
  };

  async function run(promise, { reload } = {}) {
    try {
      const res = await promise;
      if (res.message) SP.toast(res.message, 'success');
      if (reload) await reload();
      return res;
    } catch (err) {
      SP.toast(err.message, 'error');
      return null;
    }
  }

  // ===========================================================================
  // 계정
  // ===========================================================================
  const userBody = $('#user-table-body');

  function usageHtml(u) {
    if (u.usage.unlimited) return '<span class="badge badge-lavender">무제한</span>';
    const cls = u.usage.can_download ? 'badge-mint' : 'badge-peach';
    return `<span class="badge ${cls}">오늘 ${u.usage.used}/${u.usage.limit} 사용</span>`;
  }

  async function loadUsers() {
    try {
      const res = await SP.api('api/users.php?action=list');
      state.users = res.users;
      userBody.innerHTML = res.users.length ? res.users.map((u) => `
        <tr data-id="${u.id}">
          <td><button type="button" class="link-btn js-history" title="다운로드 히스토리 보기">${esc(u.username)}</button>${u.id === ME ? ' <span class="badge badge-gray">나</span>' : ''}</td>
          <td>${u.is_admin ? '<span class="badge badge-lavender">관리자</span>' : '<span class="badge badge-sky">일반</span>'}</td>
          <td class="nowrap">${esc(u.created_at.slice(0, 10))}</td>
          <td class="nowrap">${usageHtml(u)}</td>
          <td>${u.total_downloads}회</td>
          <td class="actions">
            <button type="button" class="btn btn-ghost btn-sm js-password" title="비밀번호 변경">🔑</button>
            <button type="button" class="btn btn-ghost btn-sm js-reset" title="오늘 다운로드 제한 초기화" ${u.usage.unlimited ? 'disabled' : ''}>↺</button>
            <button type="button" class="btn btn-danger btn-sm js-delete" title="계정 삭제" ${u.id === ME ? 'disabled' : ''}>🗑️</button>
          </td>
        </tr>`).join('') : '<tr class="empty-row"><td colspan="6">등록된 사용자가 없습니다.</td></tr>';
      fillAgreementFilter();
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  }

  $('#user-create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = { action: 'create', username: f.username.value.trim(), password: f.password.value, is_admin: f.is_admin.value === '1' };
    if (!data.username || !data.password) {
      SP.toast('아이디와 비밀번호를 모두 입력해 주세요.', 'warning');
      return;
    }
    const btn = f.querySelector('button[type="submit"]');
    SP.setLoading(btn, true, '추가 중...');
    const res = await run(SP.api('api/users.php', { data }), { reload: loadUsers });
    SP.setLoading(btn, false);
    if (res) { f.reset(); f.username.focus(); }
  });

  userBody.addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const user = state.users.find((u) => u.id === Number(row.dataset.id));
    if (!user) return;

    if (e.target.closest('.js-history')) showUserHistory(user.id);
    if (e.target.closest('.js-password')) changeUserPassword(user);
    if (e.target.closest('.js-reset')) {
      run(SP.api('api/users.php', { data: { action: 'reset_limit', id: user.id } }), { reload: loadUsers });
    }
    if (e.target.closest('.js-delete')) {
      const ok = await SP.confirm({
        title: '계정 삭제',
        message: `정말 '${user.username}' 계정을 삭제하시겠습니까?`,
        detail: '삭제한 계정은 복구할 수 없습니다. 다운로드·동의 기록은 보관됩니다.',
        confirmText: '삭제',
        danger: true,
      });
      if (ok) run(SP.api('api/users.php', { data: { action: 'delete', id: user.id } }), { reload: loadUsers });
    }
  });

  function changeUserPassword(user) {
    const body = document.createElement('form');
    body.className = 'form';
    body.innerHTML = `
      <div class="form-group">
        <label for="pw-new">'${esc(user.username)}' 의 새 비밀번호</label>
        <input type="text" id="pw-new" class="input" autocomplete="off" required autofocus>
        <p class="form-help">비밀번호에는 제한이 없습니다. 변경 후 사용자에게 알려주세요.</p>
      </div>`;
    const save = SP.button('변경', 'btn-primary', null, { type: 'submit' });
    save.setAttribute('form', 'pw-form');
    body.id = 'pw-form';
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = body.querySelector('#pw-new').value;
      if (!pw) { SP.toast('새 비밀번호를 입력해 주세요.', 'warning'); return; }
      SP.setLoading(save, true);
      const res = await run(SP.api('api/users.php', { data: { action: 'password', id: user.id, password: pw } }));
      SP.setLoading(save, false);
      if (res) m.close();
    });
    const m = SP.openModal({
      title: '🔑 비밀번호 변경',
      body,
      size: 'sm',
      footer: [SP.button('취소', 'btn-ghost', () => m.close()), save],
    });
  }

  async function showUserHistory(userId) {
    let res;
    try {
      res = await SP.api('api/users.php?action=history&user_id=' + userId);
    } catch (err) {
      SP.toast(err.message, 'error');
      return;
    }
    const u = res.user;
    const rows = res.downloads.map((d) => `
      <tr><td class="cell-title">${esc(d.book_title)}</td><td class="nowrap">${esc(d.downloaded_at.slice(0, 10))}</td><td class="nowrap">${esc(d.downloaded_at.slice(11))}</td></tr>`).join('');
    const agreements = res.agreements.map((a) => `
      <tr><td class="cell-title">${esc(a.book_title)}</td><td class="nowrap">${esc(a.agreed_at)}</td><td>${esc(a.ip_address || '-')}</td><td>v${esc(a.version)}</td></tr>`).join('');
    const body = `
      <div class="form-row" style="margin-bottom:12px">
        <div>${usageHtml(u)} <span class="badge badge-gray">누적 ${u.total_downloads}회</span>
        ${res.skip_until ? `<span class="badge badge-sky">동의서 생략 ~${esc(res.skip_until.slice(0, 10))}</span>` : ''}</div>
      </div>
      <h4 style="margin:0 0 8px">📥 다운로드 히스토리</h4>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>책 이름</th><th>날짜</th><th>시간</th></tr></thead>
        <tbody>${rows || '<tr class="empty-row"><td colspan="3">다운로드 기록이 없습니다.</td></tr>'}</tbody>
      </table></div>
      <h4 style="margin:20px 0 8px">📝 동의 기록</h4>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>책 이름</th><th>동의 일시</th><th>IP</th><th>버전</th></tr></thead>
        <tbody>${agreements || '<tr class="empty-row"><td colspan="4">동의 기록이 없습니다.</td></tr>'}</tbody>
      </table></div>`;
    const resetBtn = SP.button('↺ 다운로드 제한 초기화', 'btn-ghost', async () => {
      const r = await run(SP.api('api/users.php', { data: { action: 'reset_limit', id: u.id } }), { reload: loadUsers });
      if (r) m.close();
    });
    if (u.usage.unlimited) resetBtn.disabled = true;
    const m = SP.openModal({
      title: `📚 ${esc(u.username)} 님의 다운로드 기록`,
      body,
      size: 'lg',
      footer: [resetBtn, SP.button('닫기', 'btn-primary', () => m.close())],
    });
  }

  async function resetAll() {
    const ok = await SP.confirm({
      title: '전체 다운로드 제한 초기화',
      message: '모든 사용자의 오늘 다운로드 횟수를 초기화하시겠습니까?',
      detail: '모든 사용자가 즉시 다시 다운로드할 수 있게 됩니다.',
      confirmText: '전체 초기화',
      danger: true,
    });
    if (!ok) return;
    await run(SP.api('api/users.php', { data: { action: 'reset_all' } }), {
      reload: async () => { await loadUsers(); if (state.loaded.downloads) loadStats(); },
    });
  }
  document.querySelectorAll('.js-reset-all').forEach((b) => b.addEventListener('click', resetAll));

  // ===========================================================================
  // 도서
  // ===========================================================================
  const bookBody = $('#book-table-body');

  const bookPageSize = $('#book-page-size');
  const bookPagination = $('#book-pagination');
  const bookPageInfo = $('#book-page-info');
  const PAGE_SIZE_KEY = 'sharepark.admin.books.pageSize';
  state.books = [];
  state.bookPage = 1;
  state.bookPageSize = Number(SP.storage.get(PAGE_SIZE_KEY, '10'));
  if (![10, 20, 50, 0].includes(state.bookPageSize)) state.bookPageSize = 10;
  bookPageSize.value = String(state.bookPageSize);

  const bookPages = () => (state.bookPageSize ? Math.max(1, Math.ceil(state.books.length / state.bookPageSize)) : 1);

  /** @param {{toLast?: boolean}} opts 업로드 직후에는 새 책이 있는 마지막 페이지로 이동 */
  async function loadBooks(opts = {}) {
    try {
      const res = await SP.api('api/books.php?action=list');
      state.books = res.books;
      if (opts.toLast) state.bookPage = bookPages();
      renderBooks();
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  }

  function renderBooks() {
    const books = state.books;
    const pages = bookPages();
    state.bookPage = Math.min(Math.max(1, state.bookPage), pages);
    const size = state.bookPageSize || books.length;
    const start = (state.bookPage - 1) * size;
    const list = books.slice(start, start + size);

    bookBody.innerHTML = list.length ? list.map((b) => `
        <tr data-id="${b.id}">
          <td><button type="button" class="row-handle" aria-label="'${esc(b.title)}' 순서 이동 (방향키 사용 가능)" title="끌어서 순서 변경">⠿</button></td>
          <td><img class="thumb" src="${esc(b.cover_url)}" alt="" loading="lazy" draggable="false" title="${esc(SP.COVER_LABELS[b.cover_source] || '')}"></td>
          <td class="cell-title">${esc(b.title)}${b.popular_rank ? ` <span class="badge badge-sky" title="인기 도서">🏆 ${b.popular_rank}위</span>` : ''}
            <div class="muted small" title="원본 파일명">${esc(b.filename)}</div>
            ${b.file_exists ? '' : '<span class="badge badge-peach">⚠️ 파일 없음</span>'}</td>
          <td>${esc(b.author)}</td>
          <td class="nowrap">${b.owner_id ? esc(b.owner_name) : '<span class="muted">관리자</span>'}</td>
          <td><span class="badge ${b.format === 'pdf' ? 'badge-peach' : 'badge-sky'}">${esc(b.format.toUpperCase())}</span></td>
          <td class="nowrap">${esc(b.created_at.slice(0, 10))}</td>
          <td class="nowrap">${esc(b.filesize_h)}</td>
          <td class="nowrap"><button type="button" class="link-btn js-downloaders" title="다운로드한 사용자 보기">${b.download_count}회 👥</button></td>
          <td class="actions">
            <button type="button" class="btn btn-ghost btn-sm js-edit" title="수정">✏️</button>
            <button type="button" class="btn btn-danger btn-sm js-delete" title="삭제">🗑️</button>
          </td>
        </tr>`).join('') : '<tr class="empty-row"><td colspan="10">📭 아직 등록된 책이 없습니다. 위에서 첫 번째 책을 등록해 보세요.</td></tr>';

    bookPageInfo.textContent = books.length ? `전체 ${books.length}권 중 ${start + 1}–${start + list.length}번째` : '';
    bookPagination.innerHTML = SP.paginationHtml(state.bookPage, pages);
  }

  bookPagination.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    state.bookPage = Number(b.dataset.page);
    renderBooks();
    bookBody.closest('.card').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  bookPageSize.addEventListener('change', () => {
    // 지금 보던 첫 번째 책이 계속 보이도록 페이지를 다시 계산
    const firstIndex = (state.bookPage - 1) * (state.bookPageSize || state.books.length);
    state.bookPageSize = Number(bookPageSize.value);
    SP.storage.set(PAGE_SIZE_KEY, String(state.bookPageSize));
    state.bookPage = state.bookPageSize ? Math.floor(firstIndex / state.bookPageSize) + 1 : 1;
    renderBooks();
  });

  SP.makeSortable(bookBody, {
    item: 'tr[data-id]',
    handle: '.row-handle',
    // 현재 페이지의 새 순서를 전체 목록의 같은 위치에 반영해 저장
    onEnd: (ids) => {
      const size = state.bookPageSize || state.books.length;
      const start = (state.bookPage - 1) * size;
      const byId = new Map(state.books.map((b) => [String(b.id), b]));
      state.books.splice(start, ids.length, ...ids.map((id) => byId.get(id)));
      run(SP.api('api/books.php', { data: { action: 'reorder', order: state.books.map((b) => b.id) } }));
    },
  });

  bookBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const book = state.books.find((b) => b.id === Number(row.dataset.id));
    if (!book) return;
    if (e.target.closest('.js-edit')) SP.editBook(book, loadBooks);
    if (e.target.closest('.js-delete')) SP.deleteBook(book, loadBooks);
    if (e.target.closest('.js-downloaders')) showDownloaders(book);
  });

  /** 책별 다운로드한 사용자 */
  async function showDownloaders(book) {
    let res;
    try {
      res = await SP.api('api/books.php?action=downloaders&id=' + book.id);
    } catch (err) {
      SP.toast(err.message, 'error');
      return;
    }
    const summary = res.users.map((u) => `
      <tr><td><strong>${esc(u.username)}</strong></td><td>${u.count}회</td><td class="nowrap">${esc(u.last)}</td></tr>`).join('');
    const rows = res.downloads.map((d) => `
      <tr><td>${esc(d.username)}</td><td class="nowrap">${esc(d.downloaded_at.slice(0, 10))}</td><td class="nowrap">${esc(d.downloaded_at.slice(11))}</td></tr>`).join('');
    const m = SP.openModal({
      title: `👥 '${esc(res.book.title)}' 다운로드 기록`,
      size: 'lg',
      body: `
        <div class="agreement-book">
          <img src="${esc(res.book.cover_url)}" alt="">
          <div><strong>${esc(res.book.title)}</strong><span class="muted small">${esc(res.book.author)} · 총 ${res.book.download_count}회 · ${res.users.length}명</span></div>
        </div>
        <h4 style="margin:0 0 8px">사용자별</h4>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>사용자</th><th>횟수</th><th>마지막 다운로드</th></tr></thead>
          <tbody>${summary || '<tr class="empty-row"><td colspan="3">아직 이 책을 다운로드한 사용자가 없습니다.</td></tr>'}</tbody>
        </table></div>
        ${rows ? `<h4 style="margin:20px 0 8px">전체 기록</h4>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>사용자</th><th>날짜</th><th>시간</th></tr></thead><tbody>${rows}</tbody>
        </table></div>` : ''}`,
      footer: [SP.button('닫기', 'btn-primary', () => m.close())],
    });
  }

  const uploader = SP.initUploader({ onUploaded: () => loadBooks({ toLast: true }) });

  // ===========================================================================
  // 설정
  // ===========================================================================
  const settingsForm = $('#settings-form');
  const FIELDS = ['site_title', 'daily_download_limit', 'reset_time', 'max_file_size_mb', 'max_image_size_mb', 'days_ignore_agreement', 'books_path', 'covers_path', 'agreement_text'];
  const memberUpload = $('#s-allow_member_upload');

  function parseIniSize(v) {
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*([KMG]?)/i);
    if (!m) return Infinity;
    return Number(m[1]) * ({ K: 1024, M: 1048576, G: 1073741824 }[m[2].toUpperCase()] || 1);
  }

  function applySettings(res) {
    state.settings = res.settings;
    FIELDS.forEach((k) => { $('#s-' + k).value = res.settings[k]; });
    memberUpload.checked = !!res.settings.allow_member_upload;
    if (uploader) uploader.setMaxFileMb(res.settings.max_file_size_mb);
    $('#agreement-version').textContent = 'v' + res.settings.agreement_version;
    $('#eff-books').textContent = res.effective.books_dir + (res.effective.books_writable ? '' : ' ⚠️ 쓰기 불가');
    $('#eff-covers').textContent = res.effective.covers_dir + (res.effective.covers_writable ? '' : ' ⚠️ 쓰기 불가');
    $('#def-books').textContent = res.effective.default_books_dir;
    $('#def-covers').textContent = res.effective.default_covers_dir;
    const phpMax = Math.min(parseIniSize(res.effective.upload_max_filesize), parseIniSize(res.effective.post_max_size));
    $('#php-limit-note').textContent = res.settings.max_file_size_mb * 1048576 > phpMax
      ? `⚠️ PHP 업로드 한도(upload_max_filesize ${res.effective.upload_max_filesize}, post_max_size ${res.effective.post_max_size})가 더 작아 그 이상은 업로드되지 않습니다.`
      : '';
    $('#dropzone-limit').textContent = `최대 ${res.settings.max_file_size_mb}MB · 표지 이미지 최대 ${res.settings.max_image_size_mb}MB`;
  }

  async function loadSettings() {
    try {
      applySettings(await SP.api('api/settings.php'));
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { action: 'save' };
    FIELDS.forEach((k) => { data[k] = $('#s-' + k).value; });
    data.allow_member_upload = memberUpload.checked;
    const btn = settingsForm.querySelector('button[type="submit"]');
    SP.setLoading(btn, true, '저장 중...');
    const res = await run(SP.api('api/settings.php', { data }));
    SP.setLoading(btn, false);
    if (res) {
      applySettings(res);
      document.querySelectorAll('.brand-name').forEach((el) => { el.textContent = res.settings.site_title; });
      document.title = document.title.replace(/·.*$/, '· ' + res.settings.site_title);
    }
  });

  /** 동의서 미리보기 (서버의 render_agreement_html 과 같은 규칙) */
  function agreementHtml(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    let html = '';
    let inList = false;
    let section = false;
    text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      if (line.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inline(line.slice(2))}</li>`;
        return;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (line.startsWith('## ')) {
        if (section) html += '</section><hr>';
        html += `<section class="agreement-section"><h4>${inline(line.slice(3))}</h4>`;
        section = true;
      } else {
        html += `<p>${inline(line)}</p>`;
      }
    });
    if (inList) html += '</ul>';
    if (section) html += '</section>';
    return html;
  }

  $('#agreement-preview-btn').addEventListener('click', () => {
    const m = SP.openModal({
      title: '👁️ 동의서 미리보기',
      body: `<div class="agreement-notice">📌 이 전자책은 <strong>개인 용도</strong>로만 제공됩니다. 아래 내용을 확인하고 동의해 주세요.</div>
        <div class="agreement-content">${agreementHtml($('#s-agreement_text').value)}</div>`,
      footer: [SP.button('닫기', 'btn-primary', () => m.close())],
    });
  });

  $('#agreement-reset-btn').addEventListener('click', async () => {
    const ok = await SP.confirm({
      title: '동의서 복원',
      message: '동의서를 기본 문구로 복원하시겠습니까?',
      detail: '내용이 바뀌면 버전이 올라가고 모든 사용자에게 동의서가 다시 표시됩니다.',
      confirmText: '복원',
      danger: true,
    });
    if (!ok) return;
    const res = await run(SP.api('api/settings.php', { data: { action: 'reset_agreement' } }));
    if (res) applySettings(res);
  });

  $('#reset-skips-btn').addEventListener('click', async () => {
    const ok = await SP.confirm({
      title: "'다시 보지 않기' 초기화",
      message: "모든 사용자의 '다시 보지 않기' 설정을 초기화하시겠습니까?",
      detail: '모든 사용자가 다음 다운로드 때 동의서를 다시 보게 됩니다.',
      confirmText: '초기화',
      danger: true,
    });
    if (ok) run(SP.api('api/settings.php', { data: { action: 'reset_skips' } }));
  });

  // ===========================================================================
  // 다운로드 관리
  // ===========================================================================
  const agreementFilter = $('#agreement-user-filter');

  function fillAgreementFilter() {
    const current = agreementFilter.value;
    agreementFilter.innerHTML = '<option value="0">전체 사용자</option>'
      + state.users.map((u) => `<option value="${u.id}">${esc(u.username)}</option>`).join('');
    agreementFilter.value = state.users.some((u) => String(u.id) === current) ? current : '0';
  }

  async function loadStats() {
    try {
      const res = await SP.api('api/stats.php?agreement_user=' + encodeURIComponent(agreementFilter.value || 0));
      const s = res.stats;
      const cards = [
        ['📥', '오늘 다운로드', s.today, 'mint'],
        ['📅', '이번 달 다운로드', s.month, 'sky'],
        ['📈', '누적 다운로드', s.total, 'lavender'],
        ['📝', '누적 동의 기록', s.agreements, 'peach'],
        ['👥', '사용자', s.users, ''],
        ['📚', '등록된 책', s.books, ''],
      ];
      $('#stat-grid').innerHTML = cards.map(([icon, label, value, cls]) => `
        <div class="stat-card ${cls}"><div class="stat-icon">${icon}</div><div class="stat-value">${Number(value).toLocaleString('ko-KR')}</div><div class="stat-label">${label}</div></div>`).join('');

      $('#recent-body').innerHTML = res.recent.length ? res.recent.map((d) => `
        <tr><td>${esc(d.username)}</td><td class="cell-title">${esc(d.book_title)}</td><td class="nowrap">${esc(d.downloaded_at.slice(5, 16))}</td></tr>`).join('')
        : '<tr class="empty-row"><td colspan="3">아직 다운로드 기록이 없습니다.</td></tr>';

      $('#top-books').innerHTML = res.top_books.length ? res.top_books.map((b) => `
        <li><span class="rank-title">${esc(b.book_title)}</span><span class="badge badge-lavender">${b.count}회</span></li>`).join('')
        : '<li class="muted" style="counter-increment:none">데이터가 없습니다.</li>';

      $('#agreement-body').innerHTML = res.agreements.length ? res.agreements.map((a) => `
        <tr>
          <td>${esc(a.username)}</td>
          <td class="cell-title">${esc(a.book_title)}</td>
          <td class="nowrap">${esc(a.agreed_at)}</td>
          <td>${esc(a.ip_address || '-')}</td>
          <td>v${esc(a.version)}</td>
          <td>${a.method === 'remembered' ? '<span class="badge badge-sky">다시 보지 않기</span>' : '<span class="badge badge-mint">동의서 확인</span>'}</td>
        </tr>`).join('') : '<tr class="empty-row"><td colspan="6">동의 기록이 없습니다.</td></tr>';
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  }
  agreementFilter.addEventListener('change', loadStats);

  // ===========================================================================
  // 초기화
  // ===========================================================================
  const loaders = { accounts: loadUsers, books: loadBooks, settings: loadSettings, downloads: loadStats };

  SP.adminTabs = SP.initTabs($('#admin-tabs'), (tab) => {
    if (loaders[tab] && !state.loaded[tab]) {
      state.loaded[tab] = true;
      loaders[tab]();
    }
  });

  document.querySelectorAll('#tour-restart, .js-tour-start').forEach((b) => b.addEventListener('click', SP.startTour));

  (async () => {
    await Promise.all([state.loaded.accounts ? null : loadUsers(), state.loaded.settings ? null : loadSettings()]);
    state.loaded.accounts = true;
    state.loaded.settings = true;
    SP.hideLoader();
    SP.maybeStartTour();
  })();
})();
