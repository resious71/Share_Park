/**
 * Share Park - 다운로드 동의서 모달
 *
 * 1. 다운로드 버튼 클릭 → 서버에 동의서 표시 여부와 다운로드 가능 여부 확인
 * 2. 동의서 모달 표시 → 체크박스 선택 시 "동의하고 다운로드" 활성화
 * 3. 동의 → 서버가 동의 기록 후 1회용 다운로드 주소 발급 → 파일 다운로드
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});
  const esc = (v) => SP.escapeHtml(v);

  function beginDownload(url) {
    // 첨부 파일 응답이므로 현재 페이지는 그대로 유지됩니다.
    window.location.assign(url);
  }

  async function requestToken(bookId, payload) {
    return SP.api('api/record-agreement.php', { data: Object.assign({ book_id: bookId }, payload) });
  }

  function showAgreementModal(info, onDone) {
    const book = info.book;
    const days = info.days_ignore;
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="agreement-book">
        <img src="${esc(book.cover_url)}" alt="">
        <div><strong>${esc(book.title)}</strong><span class="muted small">${esc(book.author)} · ${esc(book.format.toUpperCase())} · ${esc(book.filesize_h)}</span></div>
      </div>
      <div class="agreement-notice">📌 이 전자책은 <strong>개인 용도</strong>로만 제공됩니다. 아래 내용을 확인하고 동의해 주세요.</div>
      <div class="agreement-content" tabindex="0" aria-label="동의서 내용">${info.agreement_html}</div>
      <div class="agreement-options">
        <label class="checkbox" id="agree-label">
          <input type="checkbox" id="agree-check">
          <span><strong>위 내용을 모두 읽었으며, 개인 용도로만 사용할 것에 동의합니다.</strong></span>
        </label>
        ${days > 0 ? `<label class="checkbox subtle" id="skip-label">
          <input type="checkbox" id="skip-check">
          <span>${days}일 동안 동의서 다시 보지 않기</span>
        </label>` : ''}
        <p class="muted small" style="margin:4px 0 0">동의서 버전 ${esc(info.agreement_version)} · 동의 시각과 IP 주소가 기록됩니다.</p>
      </div>`;

    const agreeCheck = body.querySelector('#agree-check');
    const agreeLabel = body.querySelector('#agree-label');
    const skipCheck = body.querySelector('#skip-check');

    const cancelBtn = SP.button('취소', 'btn-ghost', () => modal.close('cancel'));
    const okBtn = SP.button('✅ 동의하고 다운로드', 'btn-mint', null, { disabled: 'disabled', 'aria-disabled': 'true' });

    const sync = () => {
      okBtn.disabled = !agreeCheck.checked;
      okBtn.setAttribute('aria-disabled', okBtn.disabled ? 'true' : 'false');
      agreeLabel.classList.toggle('checked', agreeCheck.checked);
    };
    agreeCheck.addEventListener('change', sync);
    if (skipCheck) {
      skipCheck.addEventListener('change', () => body.querySelector('#skip-label').classList.toggle('checked', skipCheck.checked));
    }

    okBtn.addEventListener('click', async () => {
      if (!agreeCheck.checked) return;
      SP.setLoading(okBtn, true, '다운로드 준비 중...');
      cancelBtn.disabled = true;
      try {
        const res = await requestToken(book.id, { agreed: true, dont_show_again: !!(skipCheck && skipCheck.checked) });
        modal.close('agreed');
        SP.toast(`'${book.title}' 다운로드를 시작합니다.`, 'success');
        beginDownload(res.download_url);
        if (onDone) setTimeout(onDone, 1200);
      } catch (err) {
        SP.toast(err.message, 'error');
        SP.setLoading(okBtn, false);
        cancelBtn.disabled = false;
        sync();
        if (err.status === 429 && onDone) { modal.close('limit'); onDone(); }
      }
    });

    const modal = SP.openModal({
      title: '📜 다운로드 동의서',
      body,
      footer: [cancelBtn, okBtn],
      closeOnBackdrop: true,
    });
    setTimeout(() => agreeCheck.focus(), 60);
  }

  /**
   * 다운로드 시작 (동의 절차 포함)
   * @param {number} bookId
   * @param {{button?: HTMLElement, onDone?: Function}} opts
   */
  SP.startDownload = async function (bookId, { button, onDone } = {}) {
    SP.setLoading(button, true, '확인 중...');
    try {
      const info = await SP.api('api/verify-agreement.php?book_id=' + encodeURIComponent(bookId));
      if (!info.limit.can_download) {
        SP.toast(`오늘의 다운로드 횟수를 초과했습니다. ${info.limit.next_reset} 이후에 다시 시도해 주세요.`, 'warning');
        if (onDone) onDone();
        return;
      }
      if (info.need_agreement) {
        showAgreementModal(info, onDone);
        return;
      }
      // "다시 보지 않기" 기간: 서버가 다시 검증한 뒤 기록하고 토큰 발급
      const res = await requestToken(bookId, { via_skip: true });
      SP.toast(`'${info.book.title}' 다운로드를 시작합니다. (동의서 생략: ${info.skip_until.slice(0, 10)}까지)`, 'success');
      beginDownload(res.download_url);
      if (onDone) setTimeout(onDone, 1200);
    } catch (err) {
      SP.toast(err.message, 'error');
      if (onDone && err.status === 429) onDone();
    } finally {
      SP.setLoading(button, false);
    }
  };
})();
