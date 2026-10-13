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

  const formatBytes = (n) => {
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB'];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(1) + ' ' + u[i];
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
  const uploadForm = $('#upload-form');
  const dropzone = $('#dropzone');
  const fileInput = $('#book-file');
  const coverInput = $('#book-cover');
  const preview = $('#cover-preview');
  const previewLabel = $('#cover-preview-label');
  const progress = $('#upload-progress');
  const progressBar = $('#upload-progress-bar');
  const progressText = $('#upload-progress-text');
  const upload = { file: null, autoCover: null, autoCoverPromise: null, previewUrl: null };

  const COVER_LABELS = {
    manual: '직접 올림', epub: 'EPUB 추출', imagick: 'PDF 추출', pdftoppm: 'PDF 추출', convert: 'PDF 추출',
    browser: 'PDF 추출', embedded: 'PDF 이미지', default: '기본 표지',
  };

  async function loadBooks() {
    try {
      const res = await SP.api('api/books.php');
      bookBody.innerHTML = res.books.length ? res.books.map((b) => `
        <tr data-id="${b.id}">
          <td><button type="button" class="row-handle" aria-label="'${esc(b.title)}' 순서 이동 (방향키 사용 가능)" title="끌어서 순서 변경">⠿</button></td>
          <td><img class="thumb" src="${esc(b.cover_url)}" alt="" loading="lazy" draggable="false" title="${esc(COVER_LABELS[b.cover_source] || '')}"></td>
          <td class="cell-title">${esc(b.title)}<div class="muted small" title="원본 파일명">${esc(b.filename)}</div>
            ${b.file_exists ? '' : '<span class="badge badge-peach">⚠️ 파일 없음</span>'}</td>
          <td>${esc(b.author)}</td>
          <td><span class="badge ${b.format === 'pdf' ? 'badge-peach' : 'badge-sky'}">${esc(b.format.toUpperCase())}</span></td>
          <td class="nowrap">${esc(b.created_at.slice(0, 10))}</td>
          <td class="nowrap">${esc(b.filesize_h)}</td>
          <td>${b.download_count}회</td>
          <td class="actions">
            <button type="button" class="btn btn-ghost btn-sm js-edit" title="수정">✏️</button>
            <button type="button" class="btn btn-danger btn-sm js-delete" title="삭제">🗑️</button>
          </td>
        </tr>`).join('') : '<tr class="empty-row"><td colspan="9">📭 아직 등록된 책이 없습니다. 위에서 첫 번째 책을 등록해 보세요.</td></tr>';
      state.books = res.books;
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  }

  SP.makeSortable(bookBody, {
    item: 'tr[data-id]',
    handle: '.row-handle',
    onEnd: (ids) => run(SP.api('api/books.php', { data: { action: 'reorder', order: ids.map(Number) } })),
  });

  bookBody.addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const book = (state.books || []).find((b) => b.id === Number(row.dataset.id));
    if (!book) return;
    if (e.target.closest('.js-edit')) editBook(book);
    if (e.target.closest('.js-delete')) {
      const ok = await SP.confirm({
        title: '책 삭제',
        message: `정말 '${book.title}' 책을 삭제하시겠습니까?`,
        detail: '전자책 파일과 표지 이미지가 함께 삭제되며 복구할 수 없습니다.',
        confirmText: '삭제',
        danger: true,
      });
      if (ok) run(SP.api('api/delete.php', { data: { id: book.id } }), { reload: loadBooks });
    }
  });

  function editBook(book) {
    const body = document.createElement('form');
    body.className = 'form';
    body.id = 'edit-book-form';
    body.innerHTML = `
      <div class="form-row cover-row">
        <div>
          <div class="form-group"><label for="eb-title">제목</label><input id="eb-title" name="title" class="input" maxlength="200" required value="${esc(book.title)}"></div>
          <div class="form-group"><label for="eb-author">저자</label><input id="eb-author" name="author" class="input" maxlength="100" value="${esc(book.author)}"></div>
          <div class="form-group"><label for="eb-cover">표지 교체 (선택)</label><input id="eb-cover" name="cover" type="file" class="input" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
            <p class="form-help">JPG, PNG, WebP · 비워두면 현재 표지 유지</p></div>
        </div>
        <div class="cover-preview-wrap"><img class="cover-preview" src="${esc(book.cover_url)}" alt="현재 표지"><span class="muted small">${esc(COVER_LABELS[book.cover_source] || '')}</span></div>
      </div>
      <p class="muted small">파일: ${esc(book.filename)} (${esc(book.filesize_h)})</p>`;
    const img = body.querySelector('.cover-preview');
    body.querySelector('#eb-cover').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) img.src = URL.createObjectURL(f);
    });
    const save = SP.button('💾 저장', 'btn-primary', null, { type: 'submit', form: 'edit-book-form' });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!body.querySelector('#eb-title').value.trim()) { SP.toast('제목을 입력해 주세요.', 'warning'); return; }
      const fd = new FormData(body);
      fd.append('action', 'update');
      fd.append('id', book.id);
      SP.setLoading(save, true, '저장 중...');
      const res = await run(SP.api('api/books.php', { form: fd }), { reload: loadBooks });
      SP.setLoading(save, false);
      if (res) m.close();
    });
    const m = SP.openModal({
      title: '✏️ 책 정보 수정',
      body,
      footer: [SP.button('취소', 'btn-ghost', () => m.close()), save],
    });
  }

  // ---- 업로드 ----
  function setPreview(blob, label) {
    if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    upload.previewUrl = blob ? URL.createObjectURL(blob) : null;
    preview.hidden = !blob;
    if (blob) preview.src = upload.previewUrl;
    previewLabel.textContent = label || '';
  }

  /** 브라우저에서 PDF 첫 페이지를 이미지로 렌더링 (하이브리드 표지 추출) */
  async function renderPdfCover(file) {
    const lib = window.pdfjsLib;
    if (!lib) return null;
    try {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 600 / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pdf.destroy();
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    } catch (e) {
      return null;
    }
  }

  function selectFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'epub'].includes(ext)) {
      SP.toast('PDF 또는 EPUB 파일만 업로드할 수 있습니다.', 'warning');
      return;
    }
    const max = state.settings ? state.settings.max_file_size_mb * 1048576 : Infinity;
    if (file.size > max) {
      SP.toast(`파일이 너무 큽니다. 최대 ${state.settings.max_file_size_mb}MB까지 업로드할 수 있습니다. (현재 ${formatBytes(file.size)})`, 'warning');
      return;
    }
    upload.file = file;
    upload.autoCover = null;
    const box = $('#dropzone-file');
    box.hidden = false;
    box.innerHTML = `<span>${ext === 'pdf' ? '📕' : '📗'}</span><span>${esc(file.name)}</span><span class="muted">${formatBytes(file.size)}</span>`;

    if (coverInput.files[0]) return; // 수동 표지가 우선
    if (ext === 'pdf') {
      previewLabel.innerHTML = '<span class="spinner sm"></span> 표지 추출 중';
      preview.hidden = true;
      upload.autoCoverPromise = renderPdfCover(file).then((blob) => {
        if (upload.file !== file) return;
        upload.autoCover = blob;
        if (!coverInput.files[0]) setPreview(blob, blob ? '자동 추출 미리보기' : '업로드 시 서버에서 추출');
      });
    } else {
      upload.autoCoverPromise = null;
      setPreview(null, 'EPUB 표지는 업로드 시 자동 추출');
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'dragleave' && dropzone.contains(e.relatedTarget)) return;
    dropzone.classList.remove('dragover');
  }));
  dropzone.addEventListener('drop', (e) => selectFile(e.dataTransfer.files[0]));
  // 드롭 영역 밖에 떨어뜨려 파일이 열리는 것을 방지
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  coverInput.addEventListener('change', () => {
    const f = coverInput.files[0];
    if (f) {
      if (!/\.(jpe?g|png|webp)$/i.test(f.name)) {
        SP.toast('표지 이미지는 JPG, PNG, WebP 형식만 업로드할 수 있습니다.', 'warning');
        coverInput.value = '';
        return;
      }
      setPreview(f, '직접 선택한 표지');
    } else {
      setPreview(upload.autoCover, upload.autoCover ? '자동 추출 미리보기' : '');
    }
  });

  function resetUploadForm() {
    uploadForm.reset();
    upload.file = null;
    upload.autoCover = null;
    upload.autoCoverPromise = null;
    $('#dropzone-file').hidden = true;
    setPreview(null, '');
  }

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!upload.file) {
      SP.toast('업로드할 PDF 또는 EPUB 파일을 선택해 주세요.', 'warning');
      dropzone.focus();
      return;
    }
    const btn = $('#upload-btn');
    SP.setLoading(btn, true, '업로드 중...');
    if (upload.autoCoverPromise) await upload.autoCoverPromise;

    const fd = new FormData();
    fd.append('book', upload.file);
    fd.append('title', $('#book-title').value.trim());
    fd.append('author', $('#book-author').value.trim());
    if (coverInput.files[0]) fd.append('cover', coverInput.files[0]);
    else if (upload.autoCover) fd.append('cover_auto', upload.autoCover, 'cover_auto.jpg');

    progress.hidden = false;
    const setProgress = (p) => {
      progressBar.style.width = p + '%';
      progressText.textContent = p < 100 ? `${p}%` : '서버에서 처리 중... (표지 추출)';
    };
    setProgress(0);
    try {
      const res = await SP.upload('api/upload.php', fd, setProgress);
      SP.toast(res.message, 'success', 5000);
      resetUploadForm();
      loadBooks();
    } catch (err) {
      SP.toast(err.message, 'error');
    } finally {
      SP.setLoading(btn, false);
      setTimeout(() => { progress.hidden = true; }, 600);
    }
  });

  // ===========================================================================
  // 설정
  // ===========================================================================
  const settingsForm = $('#settings-form');
  const FIELDS = ['site_title', 'daily_download_limit', 'reset_time', 'max_file_size_mb', 'max_image_size_mb', 'days_ignore_agreement', 'books_path', 'covers_path', 'agreement_text'];

  function parseIniSize(v) {
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*([KMG]?)/i);
    if (!m) return Infinity;
    return Number(m[1]) * ({ K: 1024, M: 1048576, G: 1073741824 }[m[2].toUpperCase()] || 1);
  }

  function applySettings(res) {
    state.settings = res.settings;
    FIELDS.forEach((k) => { $('#s-' + k).value = res.settings[k]; });
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
