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
    pagination.innerHTML = SP.paginationHtml(page, pages);
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

  // 내 책
  const myBody = document.getElementById('mybooks-body');
  let myBooks = [];
  let myLoaded = false;

  async function loadMyBooks() {
    myBody.innerHTML = '<tr class="empty-row"><td colspan="7"><span class="spinner sm"></span> 불러오는 중...</td></tr>';
    try {
      const res = await SP.api('api/books.php?action=mine');
      myBooks = res.books;
      myBody.innerHTML = myBooks.length ? myBooks.map((b) => `
        <tr data-id="${b.id}">
          <td><img class="thumb" src="${esc(b.cover_url)}" alt="" loading="lazy"></td>
          <td class="cell-title">${esc(b.title)}${b.popular_rank ? ` <span class="badge badge-sky">🏆 ${b.popular_rank}위</span>` : ''}
            <div class="muted small">${esc(b.filename)}</div></td>
          <td>${esc(b.author)}</td>
          <td><span class="badge ${b.format === 'pdf' ? 'badge-peach' : 'badge-sky'}">${esc(b.format.toUpperCase())}</span></td>
          <td class="nowrap">${esc(b.created_at.slice(0, 10))}</td>
          <td class="nowrap">${b.download_count}회</td>
          <td class="actions">
            <button type="button" class="btn btn-ghost btn-sm js-edit" title="수정">✏️</button>
            <button type="button" class="btn btn-danger btn-sm js-delete" title="삭제">🗑️</button>
          </td>
        </tr>`).join('') : `<tr class="empty-row"><td colspan="7">📭 아직 등록한 책이 없습니다.${res.can_upload ? ' 위에서 첫 번째 책을 등록해 보세요.' : ''}</td></tr>`;
    } catch (err) {
      myBody.innerHTML = `<tr class="empty-row"><td colspan="7">${esc(err.message)}</td></tr>`;
    }
  }

  myBody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    const book = row && myBooks.find((b) => b.id === Number(row.dataset.id));
    if (!book) return;
    if (e.target.closest('.js-edit')) SP.editBook(book, loadMyBooks);
    if (e.target.closest('.js-delete')) SP.deleteBook(book, loadMyBooks);
  });

  SP.initUploader({ onUploaded: loadMyBooks });

  SP.initTabs(document.querySelector('.tabs'), (tab) => {
    if (tab === 'history' && !state.loaded) {
      state.loaded = true;
      loadHistory();
    }
    if (tab === 'mybooks' && !myLoaded) {
      myLoaded = true;
      loadMyBooks();
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
