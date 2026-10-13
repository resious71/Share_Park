/**
 * Share Park - 드래그 앤 드롭 정렬
 * 마우스와 터치(포인터 이벤트)를 모두 지원하며, 손잡이 키보드 조작(방향키)도 지원합니다.
 *
 * SP.makeSortable(container, {
 *   item: '.book-card',         // 정렬 대상 요소
 *   handle: '.drag-handle',     // 손잡이
 *   enabled: () => true,        // 드래그 가능 여부
 *   onEnd: (ids) => {}          // 순서가 바뀌었을 때 data-id 배열 전달
 * })
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});

  SP.makeSortable = function (container, options) {
    const opts = Object.assign({ enabled: () => true, onEnd: () => {} }, options);
    let dragging = null;
    let startOrder = '';
    let lastTarget = null;

    const items = () => Array.from(container.querySelectorAll(opts.item));
    const ids = () => items().map((el) => el.dataset.id);

    function clearTarget() {
      if (lastTarget) lastTarget.classList.remove('sortable-target');
      lastTarget = null;
    }

    function autoScroll(y) {
      const edge = 70;
      if (y < edge) window.scrollBy(0, -12);
      else if (y > window.innerHeight - edge) window.scrollBy(0, 12);
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      autoScroll(e.clientY);
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest(opts.item);
      if (!target || target === dragging || !container.contains(target)) return;
      clearTarget();
      lastTarget = target;
      target.classList.add('sortable-target');
      const list = items();
      if (list.indexOf(target) > list.indexOf(dragging)) target.after(dragging);
      else target.before(dragging);
    }

    function finish() {
      if (!dragging) return;
      dragging.classList.remove('sortable-dragging');
      document.body.classList.remove('sortable-active');
      clearTarget();
      dragging = null;
      const now = ids();
      if (now.join(',') !== startOrder) opts.onEnd(now);
    }

    container.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest(opts.handle);
      if (!handle || !container.contains(handle) || e.button !== 0 || !opts.enabled()) return;
      const el = handle.closest(opts.item);
      if (!el) return;
      e.preventDefault();
      dragging = el;
      startOrder = ids().join(',');
      el.classList.add('sortable-dragging');
      document.body.classList.add('sortable-active');
      // 요소를 DOM 에서 옮기면 포인터 캡처가 풀리므로 window 에서 이벤트를 받습니다.
      const up = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        finish();
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    // 키보드: 손잡이에 포커스 후 방향키로 이동
    container.addEventListener('keydown', (e) => {
      const handle = e.target.closest(opts.handle);
      if (!handle || !opts.enabled()) return;
      const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      if (!back && !fwd) return;
      e.preventDefault();
      const el = handle.closest(opts.item);
      const list = items();
      const i = list.indexOf(el);
      const j = back ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      if (back) list[j].before(el); else list[j].after(el);
      handle.focus();
      opts.onEnd(ids());
    });

    // 손잡이 영역의 기본 드래그(이미지 끌기 등) 방지
    container.addEventListener('dragstart', (e) => {
      if (e.target.closest && e.target.closest(opts.item)) e.preventDefault();
    });
  };
})();
