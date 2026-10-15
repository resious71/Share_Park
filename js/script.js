/**
 * Share Park - 공통 클라이언트 스크립트
 * API 호출, 토스트, 모달/확인 다이얼로그, 탭, 로딩 스피너, 로그인 처리
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});

  // ---------------------------------------------------------------------------
  // 유틸리티
  // ---------------------------------------------------------------------------
  SP.escapeHtml = function (value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  };

  SP.debounce = function (fn, wait = 250) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  SP.storage = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* 저장소 사용 불가 */ }
    },
  };

  SP.csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data || {};
    }
  }
  SP.ApiError = ApiError;

  function handleResponse(status, json) {
    if (status >= 200 && status < 300 && json && json.ok !== false) {
      return json;
    }
    const message = (json && json.error) || `요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. (HTTP ${status})`;
    if (status === 401) {
      setTimeout(() => { location.href = 'index.php'; }, 1500);
    }
    throw new ApiError(message, status, json);
  }

  /**
   * @param {string} url
   * @param {{method?: string, data?: object, form?: FormData}} options
   */
  SP.api = async function (url, { method, data, form } = {}) {
    const opts = {
      method: method || (data || form ? 'POST' : 'GET'),
      headers: { 'X-CSRF-Token': SP.csrf(), Accept: 'application/json' },
      credentials: 'same-origin',
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    } else if (form) {
      opts.body = form;
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw new ApiError('서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요.', 0);
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* JSON 아님 */ }
    return handleResponse(res.status, json);
  };

  /** 업로드 진행률이 필요한 경우 (XMLHttpRequest) */
  SP.upload = function (url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('X-CSRF-Token', SP.csrf());
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        let json = null;
        try { json = JSON.parse(xhr.responseText); } catch (e) { /* JSON 아님 */ }
        try { resolve(handleResponse(xhr.status, json)); } catch (err) { reject(err); }
      });
      xhr.addEventListener('error', () => reject(new ApiError('업로드 중 네트워크 오류가 발생했습니다. 연결 상태를 확인해 주세요.', 0)));
      xhr.send(formData);
    });
  };

  // ---------------------------------------------------------------------------
  // 토스트
  // ---------------------------------------------------------------------------
  const TOAST_ICONS = { success: '✅', error: '⚠️', warning: '🔔', info: 'ℹ️' };
  SP.toast = function (message, type = 'success', duration = 3500) {
    let box = document.getElementById('toast-container');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-container';
      box.className = 'toast-container';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span>${TOAST_ICONS[type] || ''}</span><span>${SP.escapeHtml(message)}</span>`;
    box.appendChild(el);
    const remove = () => {
      el.classList.add('hide');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };
    el.addEventListener('click', remove);
    setTimeout(remove, type === 'error' ? Math.max(duration, 5500) : duration);
  };

  // ---------------------------------------------------------------------------
  // 모달
  // ---------------------------------------------------------------------------
  const modalStack = [];

  /**
   * @param {{title: string, body: string|Node, footer?: Node[]|string, size?: string,
   *          headerClass?: string, onClose?: Function, closeOnBackdrop?: boolean}} o
   */
  SP.openModal = function (o) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 8);
    backdrop.innerHTML = `
      <div class="modal ${o.size ? 'modal-' + o.size : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-header ${o.headerClass || ''}">
          <h3 class="modal-title" id="${titleId}"></h3>
          <button type="button" class="modal-close" aria-label="닫기">×</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer"></div>
      </div>`;
    const modal = backdrop.querySelector('.modal');
    backdrop.querySelector('.modal-title').innerHTML = o.title;
    const body = backdrop.querySelector('.modal-body');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const footer = backdrop.querySelector('.modal-footer');
    if (Array.isArray(o.footer)) o.footer.forEach((b) => footer.appendChild(b));
    else if (typeof o.footer === 'string') footer.innerHTML = o.footer;
    else footer.remove();

    const previousFocus = document.activeElement;
    let closed = false;
    const api = {
      el: modal,
      backdrop,
      close(reason) {
        if (closed) return;
        closed = true;
        const i = modalStack.indexOf(api);
        if (i >= 0) modalStack.splice(i, 1);
        backdrop.classList.add('closing');
        setTimeout(() => backdrop.remove(), 180);
        if (!modalStack.length) document.body.style.overflow = '';
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (o.onClose) o.onClose(reason);
      },
    };
    backdrop.querySelector('.modal-close').addEventListener('click', () => api.close('close'));
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop && o.closeOnBackdrop !== false) api.close('backdrop');
    });

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    modalStack.push(api);
    setTimeout(() => {
      const target = modal.querySelector('[autofocus]') || modal.querySelector('.modal-body input, .modal-body textarea, .modal-body select') || modal.querySelector('.modal-close');
      if (target) target.focus();
    }, 30);
    return api;
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      e.preventDefault();
      modalStack[modalStack.length - 1].close('escape');
    }
  });

  SP.button = function (label, className, onClick, attrs = {}) {
    const b = document.createElement('button');
    b.type = attrs.type || 'button';
    b.className = 'btn ' + (className || '');
    b.innerHTML = label;
    Object.entries(attrs).forEach(([k, v]) => { if (k !== 'type') b.setAttribute(k, v); });
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };

  /** 확인 다이얼로그 → Promise<boolean> */
  SP.confirm = function ({ title = '확인', message, detail = '', confirmText = '확인', danger = false } = {}) {
    return new Promise((resolve) => {
      let result = false;
      const body = `<p class="confirm-message">${SP.escapeHtml(message)}</p>${detail ? `<p class="confirm-detail">${SP.escapeHtml(detail)}</p>` : ''}`;
      const cancel = SP.button('취소', 'btn-ghost', () => m.close());
      const ok = SP.button(SP.escapeHtml(confirmText), danger ? 'btn-danger' : 'btn-primary', () => { result = true; m.close(); });
      const m = SP.openModal({
        title: (danger ? '⚠️ ' : '💬 ') + SP.escapeHtml(title),
        body,
        footer: [cancel, ok],
        size: 'sm',
        headerClass: danger ? 'peach' : '',
        onClose: () => resolve(result),
      });
      setTimeout(() => ok.focus(), 40);
    });
  };

  /** 버튼 로딩 상태 */
  SP.setLoading = function (btn, loading, text) {
    if (!btn) return;
    if (loading) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner sm"></span> ${text || '처리 중...'}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };

  // ---------------------------------------------------------------------------
  // 페이지네이션 (버튼에 data-page 가 들어 있으므로 클릭 이벤트에서 읽어 사용)
  // ---------------------------------------------------------------------------
  SP.paginationHtml = function (page, pages) {
    if (pages <= 1) return '';
    const btn = (p, label, opts = {}) =>
      `<button type="button" data-page="${p}" ${opts.disabled ? 'disabled' : ''} class="${opts.active ? 'active' : ''}" ${opts.active ? 'aria-current="page"' : ''} aria-label="${opts.aria || p + '페이지'}">${label}</button>`;
    let html = btn(1, '«', { disabled: page <= 1, aria: '첫 페이지' });
    html += btn(page - 1, '‹', { disabled: page <= 1, aria: '이전 페이지' });
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p++) html += btn(p, p, { active: p === page });
    html += btn(page + 1, '›', { disabled: page >= pages, aria: '다음 페이지' });
    html += btn(pages, '»', { disabled: page >= pages, aria: '마지막 페이지' });
    return html;
  };

  // ---------------------------------------------------------------------------
  // 탭
  // ---------------------------------------------------------------------------
  SP.initTabs = function (tabList, onChange) {
    if (!tabList) return null;
    const tabs = Array.from(tabList.querySelectorAll('.tab'));
    const activate = (name, updateHash = true) => {
      const tab = tabs.find((t) => t.dataset.tab === name) || tabs[0];
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        const panel = document.getElementById('tab-' + t.dataset.tab);
        if (panel) { panel.hidden = !active; panel.classList.toggle('active', active); }
      });
      if (updateHash) history.replaceState(null, '', '#' + tab.dataset.tab);
      if (onChange) onChange(tab.dataset.tab);
    };
    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));
    tabList.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      activate(next.dataset.tab);
    });
    const initial = location.hash.slice(1);
    activate(tabs.some((t) => t.dataset.tab === initial) ? initial : tabs[0].dataset.tab, false);
    return { activate };
  };

  // ---------------------------------------------------------------------------
  // 로딩 스피너
  // ---------------------------------------------------------------------------
  SP.hideLoader = function () {
    const l = document.getElementById('page-loader');
    if (l) {
      l.classList.add('done');
      setTimeout(() => l.remove(), 350);
    }
  };
  // 안전장치: 데이터 로딩이 실패해도 스피너가 계속 남지 않도록
  setTimeout(SP.hideLoader, 8000);

  // ---------------------------------------------------------------------------
  // 다운로드 제한 배너
  // ---------------------------------------------------------------------------
  SP.renderLimitBanner = function (el, limit) {
    if (!el || !limit) return;
    el.hidden = false;
    el.classList.remove('exhausted', 'unlimited');
    if (limit.unlimited) {
      el.classList.add('unlimited');
      el.innerHTML = `<span class="big">∞</span><span>${limit.is_admin ? '관리자는 다운로드 제한 없이 이용할 수 있습니다.' : '다운로드 횟수 제한이 없습니다.'}</span>`;
    } else if (limit.remaining > 0) {
      el.innerHTML = `<span>📥 오늘</span><span class="big">${limit.remaining}회</span><span>남음</span>
        <span class="sub">(${limit.used}/${limit.limit} 사용 · ${SP.escapeHtml(limit.next_reset)}에 초기화)</span>`;
    } else {
      el.classList.add('exhausted');
      el.innerHTML = `<span>⏳ 오늘의 다운로드 횟수를 초과했습니다.</span>
        <span class="sub">${SP.escapeHtml(limit.next_reset)} 이후에 다시 다운로드할 수 있습니다.</span>`;
    }
  };

  // ---------------------------------------------------------------------------
  // 로그인 페이지
  // ---------------------------------------------------------------------------
  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const errorBox = document.getElementById('login-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      const username = form.username.value.trim();
      const password = form.password.value;
      if (!username || !password) {
        errorBox.textContent = '아이디와 비밀번호를 모두 입력해 주세요.';
        errorBox.hidden = false;
        (username ? form.password : form.username).focus();
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      SP.setLoading(btn, true, '로그인 중...');
      try {
        const res = await SP.api('api/login.php', { data: { username, password } });
        location.href = res.redirect || 'dashboard.php';
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        form.password.select();
        SP.setLoading(btn, false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'login') {
      initLogin();
      SP.hideLoader();
    }
  });
})();
