/**
 * Share Park - 대시보드 (도서 목록)
 * 검색, 정렬, 커스텀 순서(드래그 앤 드롭), 페이지네이션(12권), 다운로드 제한 배너
 */
(function () {
  'use strict';

  const SP = window.SP;
  const esc = (v) => SP.escapeHtml(v);
  const SORT_KEY = 'sharepark.sort';
  const PAGE_SIZE = 12;

  const grid = document.getElementById('book-grid');
  const searchInput = document.getElementById('book-search');
  const sortSelect = document.getElementById('sort-select');
  const banner = document.getElementById('limit-banner');
  const customBadge = document.getElementById('custom-order-badge');
  const resetOrderBtn = document.getElementById('reset-order-btn');
  const dragHint = document.getElementById('drag-hint');
  const emptyState = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const pager = document.getElementById('book-pager');
  const pagination = document.getElementById('book-pagination');
  const pageInfo = document.getElementById('book-page-info');

  const state = {
    books: [],          // 서버 순서(사용자 커스텀 순서 적용)
    total: 0,
    query: '',
    sort: SP.storage.get(SORT_KEY, 'custom'),
    hasCustom: false,
    limit: null,
    page: 1,
  };
  if (!['custom', 'popular', 'title', 'author', 'newest', 'oldest'].includes(state.sort)) state.sort = 'custom';
  sortSelect.value = state.sort;

  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

  function sortedBooks() {
    const list = state.books.slice();
    switch (state.sort) {
      case 'popular': return list.sort((a, b) => b.download_count - a.download_count || a.id - b.id);
      case 'title': return list.sort((a, b) => collator.compare(a.title, b.title));
      case 'author': return list.sort((a, b) => collator.compare(a.author, b.author) || collator.compare(a.title, b.title));
      case 'newest': return list.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
      case 'oldest': return list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
      default: return list;
    }
  }

  const canDrag = () => state.sort === 'custom' && !state.query;

  function render() {
    const canDownload = !state.limit || state.limit.can_download;
    const all = sortedBooks();
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const list = all.slice(start, start + PAGE_SIZE);
    const draggable = canDrag();

    pager.hidden = all.length === 0;
    pageInfo.textContent = all.length ? `전체 ${all.length}권 중 ${start + 1}–${start + list.length}번째` : '';
    pagination.innerHTML = SP.paginationHtml(state.page, pages);

    emptyState.hidden = state.total !== 0;
    noResults.hidden = !(state.total > 0 && all.length === 0);
    dragHint.hidden = !(draggable && list.length > 1);
    customBadge.hidden = !(state.hasCustom && state.sort === 'custom');
    resetOrderBtn.hidden = !(state.hasCustom && state.sort === 'custom');

    grid.innerHTML = list.map((b, i) => `
      <article class="book-card${b.popular_rank ? ' popular' : ''}" data-id="${b.id}" style="animation-delay:${Math.min(i, 12) * 30}ms"
        tabindex="0" role="button" aria-label="${esc(b.title)} 상세 정보 보기${b.popular_rank ? ` (인기 ${b.popular_rank}위)` : ''}">
        ${draggable ? `<button type="button" class="drag-handle" aria-label="'${esc(b.title)}' 순서 이동 (방향키 사용 가능)" title="끌어서 순서 변경">⠿</button>` : ''}
        <div class="book-cover">
          <img src="${esc(b.cover_url)}" alt="${esc(b.title)} 표지" loading="lazy" draggable="false">
          <span class="format-badge">${esc(b.format.toUpperCase())}</span>
          ${b.popular_rank ? `<span class="popular-badge" title="인기 도서 ${b.popular_rank}위"><span aria-hidden="true">🏆</span>${b.popular_rank}위</span>` : ''}
        </div>
        <div class="book-info">
          <h3 class="book-title" title="${esc(b.title)}">${esc(b.title)}</h3>
          <p class="book-author" title="${esc(b.author)}">${esc(b.author)}</p>
          <p class="book-stats" title="전체 다운로드 횟수">⬇️ ${b.download_count.toLocaleString('ko-KR')}회 다운로드</p>
          <button type="button" class="btn ${canDownload ? 'btn-mint' : ''} btn-block js-download"
            data-id="${b.id}" data-tooltip="${esc(b.title)}" ${canDownload ? '' : 'disabled aria-disabled="true"'}>
            ${canDownload ? '⬇️ 다운로드' : '⏳ 오늘 횟수 초과'}
          </button>
        </div>
      </article>`).join('');
  }

  async function load() {
    try {
      const res = await SP.api('api/search.php?q=' + encodeURIComponent(state.query));
      state.books = res.books;
      state.total = res.total;
      state.hasCustom = res.has_custom_order;
      state.limit = res.limit;
      SP.renderLimitBanner(banner, state.limit);
      render();
    } catch (err) {
      SP.toast(err.message, 'error');
    } finally {
      SP.hideLoader();
    }
  }

  async function saveOrder(ids) {
    // 현재 페이지의 새 순서를 전체 목록의 같은 위치에 반영 (다른 페이지 순서는 유지)
    const byId = new Map(state.books.map((b) => [String(b.id), b]));
    state.books.splice((state.page - 1) * PAGE_SIZE, ids.length, ...ids.map((id) => byId.get(id)).filter(Boolean));
    try {
      const res = await SP.api('api/save-custom-order.php', { data: { order: state.books.map((b) => b.id) } });
      state.hasCustom = res.has_custom_order;
      customBadge.hidden = false;
      resetOrderBtn.hidden = false;
      SP.toast(res.message, 'success', 2000);
    } catch (err) {
      SP.toast(err.message, 'error');
      load();
    }
  }

  // 이벤트 ---------------------------------------------------------------
  // 다운로드 후 다운로드 횟수 · 인기 순위 · 남은 횟수를 새로 반영
  const afterChange = () => load();

  grid.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle')) return;
    const btn = e.target.closest('.js-download');
    if (btn) {
      if (!btn.disabled) SP.startDownload(Number(btn.dataset.id), { button: btn, onDone: afterChange });
      return;
    }
    const card = e.target.closest('.book-card');
    if (card) SP.showBookDetail(Number(card.dataset.id), { onDone: afterChange });
  });

  grid.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('book-card')) {
      e.preventDefault();
      SP.showBookDetail(Number(e.target.dataset.id), { onDone: afterChange });
    }
  });

  pagination.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    render();
    document.querySelector('.toolbar').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  searchInput.addEventListener('input', SP.debounce(() => {
    state.query = searchInput.value.trim();
    state.page = 1;
    load();
  }, 250));

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    SP.storage.set(SORT_KEY, state.sort);
    state.page = 1;
    render();
    if (state.sort === 'custom' && state.query) {
      SP.toast('검색 중에는 순서를 바꿀 수 없어요. 검색어를 지우면 드래그할 수 있습니다.', 'info');
    }
  });

  resetOrderBtn.addEventListener('click', async () => {
    const ok = await SP.confirm({
      title: '기본 순서로 되돌리기',
      message: '저장한 나만의 순서를 지우고 기본 순서로 되돌릴까요?',
      confirmText: '되돌리기',
    });
    if (!ok) return;
    try {
      const res = await SP.api('api/save-custom-order.php', { data: { reset: true } });
      SP.toast(res.message, 'success');
      load();
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  });

  SP.makeSortable(grid, { item: '.book-card', handle: '.drag-handle', enabled: canDrag, onEnd: saveOrder });

  load();
})();
