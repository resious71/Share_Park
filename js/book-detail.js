/**
 * Share Park - 책 상세 정보 모달
 * SP.showBookDetail(bookId, { onDone })  책 카드를 누르면 표지 · 정보 · 소개 · 다운로드 버튼을 보여 줍니다.
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});
  const esc = (v) => SP.escapeHtml(v);

  /** 줄바꿈을 유지한 안전한 텍스트 */
  const multiline = (text) => esc(text).replace(/\n/g, '<br>');

  SP.showBookDetail = async function (bookId, { onDone } = {}) {
    let res;
    try {
      res = await SP.api('api/books.php?action=detail&id=' + encodeURIComponent(bookId));
    } catch (err) {
      SP.toast(err.message, 'error');
      return;
    }
    const b = res.book;
    const canDownload = res.limit.can_download;
    const rank = b.popular_rank ? `<span class="badge badge-sky">🏆 인기 ${b.popular_rank}위</span>` : '';

    const body = `
      <div class="book-detail">
        <div class="book-detail-cover${b.popular_rank ? ' popular' : ''}">
          <img src="${esc(b.cover_url)}" alt="${esc(b.title)} 표지">
        </div>
        <div class="book-detail-info">
          <div class="book-detail-badges">
            <span class="badge ${b.format === 'pdf' ? 'badge-peach' : 'badge-sky'}">${esc(b.format.toUpperCase())}</span>
            ${rank}
          </div>
          <h2 class="book-detail-title">${esc(b.title)}</h2>
          <p class="book-detail-author">${esc(b.author)}</p>
          <dl class="book-detail-meta">
            <div><dt>⬇️ 다운로드</dt><dd><strong>${b.download_count.toLocaleString('ko-KR')}회</strong></dd></div>
            <div><dt>📦 파일 크기</dt><dd>${esc(b.filesize_h)}</dd></div>
            <div><dt>📅 등록일</dt><dd>${esc(b.created_at.slice(0, 10))}</dd></div>
            <div><dt>👤 등록자</dt><dd>${esc(b.owner_name)}</dd></div>
            ${res.my_downloads ? `<div><dt>✅ 내 다운로드</dt><dd>${res.my_downloads}회 · 마지막 ${esc(res.my_last_download.slice(0, 16))}</dd></div>` : ''}
          </dl>
        </div>
      </div>
      <div class="book-detail-desc">
        <h4>📖 책 소개</h4>
        ${b.description ? `<p>${multiline(b.description)}</p>` : '<p class="muted">등록된 소개가 없습니다.</p>'}
      </div>`;

    const footer = [];
    if (res.can_manage && SP.editBook) {
      footer.push(SP.button('✏️ 수정', 'btn-ghost', () => {
        m.close();
        SP.editBook(b, onDone);
      }));
    }
    footer.push(SP.button('닫기', 'btn-ghost', () => m.close()));
    const dl = SP.button(canDownload ? '⬇️ 다운로드' : '⏳ 오늘 횟수 초과', canDownload ? 'btn-mint' : '', () => {
      m.close();
      SP.startDownload(b.id, { onDone });
    });
    if (!canDownload) dl.disabled = true;
    footer.push(dl);

    const m = SP.openModal({ title: '📘 책 정보', body, footer });
  };
})();
