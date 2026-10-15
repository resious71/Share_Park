/**
 * Share Park - 책 등록 · 수정 · 삭제 (관리자 페이지와 마이페이지 공용)
 *
 * SP.initUploader({ onUploaded })   includes/upload-form.php 양식에 업로드 기능 연결
 * SP.editBook(book, onSaved)        책 정보 수정 모달 (제목 · 저자 · 소개 · 표지)
 * SP.deleteBook(book, onDeleted)    확인 후 책 삭제
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});
  const esc = (v) => SP.escapeHtml(v);
  const $ = (sel) => document.querySelector(sel);

  SP.formatBytes = function (n) {
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB'];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(1) + ' ' + u[i];
  };

  SP.COVER_LABELS = {
    manual: '직접 올림', epub: 'EPUB 추출', imagick: 'PDF 추출', pdftoppm: 'PDF 추출', convert: 'PDF 추출',
    browser: 'PDF 추출', embedded: 'PDF 이미지', default: '기본 표지',
  };

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

  SP.initUploader = function ({ onUploaded } = {}) {
    const form = $('#upload-form');
    if (!form) return;
    const dropzone = $('#dropzone');
    const fileInput = $('#book-file');
    const coverInput = $('#book-cover');
    const preview = $('#cover-preview');
    const previewLabel = $('#cover-preview-label');
    const progress = $('#upload-progress');
    const progressBar = $('#upload-progress-bar');
    const progressText = $('#upload-progress-text');
    const upload = { file: null, autoCover: null, autoCoverPromise: null, previewUrl: null };
    const maxMb = () => Number(form.dataset.maxFileMb) || Infinity;

    function setPreview(blob, label) {
      if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      upload.previewUrl = blob ? URL.createObjectURL(blob) : null;
      preview.hidden = !blob;
      if (blob) preview.src = upload.previewUrl;
      previewLabel.textContent = label || '';
    }

    function selectFile(file) {
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'epub'].includes(ext)) {
        SP.toast('PDF 또는 EPUB 파일만 업로드할 수 있습니다.', 'warning');
        return;
      }
      if (file.size > maxMb() * 1048576) {
        SP.toast(`파일이 너무 큽니다. 최대 ${maxMb()}MB까지 업로드할 수 있습니다. (현재 ${SP.formatBytes(file.size)})`, 'warning');
        return;
      }
      upload.file = file;
      upload.autoCover = null;
      const box = $('#dropzone-file');
      box.hidden = false;
      box.innerHTML = `<span>${ext === 'pdf' ? '📕' : '📗'}</span><span>${esc(file.name)}</span><span class="muted">${SP.formatBytes(file.size)}</span>`;

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

    function reset() {
      form.reset();
      upload.file = null;
      upload.autoCover = null;
      upload.autoCoverPromise = null;
      $('#dropzone-file').hidden = true;
      setPreview(null, '');
    }

    form.addEventListener('submit', async (e) => {
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
      fd.append('description', $('#book-description').value.trim());
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
        reset();
        if (onUploaded) onUploaded(res.book);
      } catch (err) {
        SP.toast(err.message, 'error');
      } finally {
        SP.setLoading(btn, false);
        setTimeout(() => { progress.hidden = true; }, 600);
      }
    });

    return { setMaxFileMb: (mb) => { form.dataset.maxFileMb = mb; } };
  };

  /** 책 정보 수정 모달 */
  SP.editBook = function (book, onSaved) {
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
        <div class="cover-preview-wrap"><img class="cover-preview" src="${esc(book.cover_url)}" alt="현재 표지"><span class="muted small">${esc(SP.COVER_LABELS[book.cover_source] || '')}</span></div>
      </div>
      <div class="form-group"><label for="eb-description">책 소개</label>
        <textarea id="eb-description" name="description" class="input" rows="4" maxlength="2000">${esc(book.description || '')}</textarea></div>
      <p class="muted small">파일: ${esc(book.filename || '')} (${esc(book.filesize_h)})</p>`;
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
      try {
        const res = await SP.api('api/books.php', { form: fd });
        SP.toast(res.message, 'success');
        m.close();
        if (onSaved) onSaved(res.book);
      } catch (err) {
        SP.toast(err.message, 'error');
        SP.setLoading(save, false);
      }
    });
    const m = SP.openModal({
      title: '✏️ 책 정보 수정',
      body,
      footer: [SP.button('취소', 'btn-ghost', () => m.close()), save],
    });
  };

  /** 확인 후 책 삭제 */
  SP.deleteBook = async function (book, onDeleted) {
    const ok = await SP.confirm({
      title: '책 삭제',
      message: `정말 '${book.title}' 책을 삭제하시겠습니까?`,
      detail: '전자책 파일과 표지 이미지가 함께 삭제되며 복구할 수 없습니다.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await SP.api('api/delete.php', { data: { id: book.id } });
      SP.toast(res.message, 'success');
      if (onDeleted) onDeleted();
    } catch (err) {
      SP.toast(err.message, 'error');
    }
  };
})();
