/**
 * Share Park - 마이페이지 (프로필, 비밀번호 변경, 다운로드 히스토리)
 */
(function () {
  'use strict';

  const SP = window.SP;
  const esc = (v) => SP.escapeHtml(v);

  const historyBody = document.getElementById('history-body');
  const pagination = document.getElementById('history-pagination');
  const searchInput = document.getElementById('history-search');
  const limitBox = document.getElementById('history-limit');
  const state = { page: 1, q: '', loaded: false };

  async function loadHistory() {
    historyBody.innerHTML = '<tr class="empty-row"><td colspan="4"><span class="spinner sm"></span> 불러오는 중...</td></tr>';
    try {
      const res = await SP.api(`api/my-downloads.php?page=${state.page}&q=${encodeURIComponent(state.q)}`);
      state.page = res.page;
      SP.renderLimitBanner(limitBox, res.limit);
      if (!res.items.length) {
        historyBody.innerHTML = `<tr class="empty-row"><td colspan="4">${state.q
          ? '🔎 검색 결과가 없습니다.'
          : '📭 아직 다운로드한 책이 없습니다. <a href="dashboard.php">도서 목록 보러 가기 →</a>'}</td></tr>`;
      } else {
        historyBody.innerHTML = res.items.map((d) => `
          <tr>
            <td class="cell-title">${esc(d.book_title)}${d.available ? '' : ' <span class="badge badge-gray">삭제됨</span>'}</td>
            <td>${esc(d.book_author)}</td>
            <td class="nowrap">${esc(d.date)}</td>
            <td class="nowrap">${esc(d.time)}</td>
          </tr>`).join('');
      }
      renderPagination(res.page, res.pages);
    } catch (err) {
      historyBody.innerHTML = `<tr class="empty-row"><td colspan="4">${esc(err.message)}</td></tr>`;
    }
  }

  function renderPagination(page, pages) {
    if (pages <= 1) { pagination.innerHTML = ''; return; }
    const btn = (p, label, opts = {}) =>
      `<button type="button" data-page="${p}" ${opts.disabled ? 'disabled' : ''} class="${opts.active ? 'active' : ''}" ${opts.active ? 'aria-current="page"' : ''} aria-label="${opts.aria || p + '페이지'}">${label}</button>`;
    let html = btn(page - 1, '‹', { disabled: page <= 1, aria: '이전 페이지' });
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p++) html += btn(p, p, { active: p === page });
    html += btn(page + 1, '›', { disabled: page >= pages, aria: '다음 페이지' });
    pagination.innerHTML = html;
  }

  pagination.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    loadHistory();
  });

  searchInput.addEventListener('input', SP.debounce(() => {
    state.q = searchInput.value.trim();
    state.page = 1;
    loadHistory();
  }, 300));

  SP.initTabs(document.querySelector('.tabs'), (tab) => {
    if (tab === 'history' && !state.loaded) {
      state.loaded = true;
      loadHistory();
    }
  });

  // 비밀번호 변경
  const pwForm = document.getElementById('password-form');
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      current_password: pwForm.current_password.value,
      new_password: pwForm.new_password.value,
      confirm_password: pwForm.confirm_password.value,
    };
    if (!data.current_password || !data.new_password) {
      SP.toast('현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.', 'warning');
      return;
    }
    if (data.new_password !== data.confirm_password) {
      SP.toast('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'warning');
      pwForm.confirm_password.focus();
      return;
    }
    const btn = pwForm.querySelector('button[type="submit"]');
    SP.setLoading(btn, true, '변경 중...');
    try {
      const res = await SP.api('api/change-password.php', { data });
      SP.toast(res.message, 'success');
      pwForm.reset();
    } catch (err) {
      SP.toast(err.message, 'error');
    } finally {
      SP.setLoading(btn, false);
    }
  });

  SP.hideLoader();
})();
