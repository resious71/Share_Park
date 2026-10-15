<?php
/** 책 등록 양식 (관리자 · 마이페이지 공용) - js/uploader.js 와 함께 사용 */
if (!defined('APP_ROOT')) {
    http_response_code(403);
    exit;
}

function render_upload_form(string $helpButton = ''): void
{
    $maxFile = round((int)setting('max_file_size') / 1048576, 1);
    $maxImage = round((int)setting('max_image_size') / 1048576, 1);
    ?>
    <div class="card" id="upload-card">
      <div class="card-header">
        <h2 class="card-title">새 책 등록 <?= $helpButton ?></h2>
      </div>
      <form id="upload-form" class="form" novalidate data-max-file-mb="<?= h($maxFile) ?>">
        <div id="dropzone" class="dropzone" tabindex="0" role="button" aria-label="PDF 또는 EPUB 파일 선택">
          <input type="file" id="book-file" name="book" accept=".pdf,.epub,application/pdf,application/epub+zip" hidden>
          <div class="dropzone-icon">📥</div>
          <p class="dropzone-text"><strong>PDF / EPUB 파일</strong>을 여기에 끌어다 놓거나 클릭해서 선택하세요</p>
          <p class="dropzone-sub muted" id="dropzone-limit">최대 <?= h($maxFile) ?>MB · 표지 이미지 최대 <?= h($maxImage) ?>MB</p>
          <div id="dropzone-file" class="dropzone-file" hidden></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="book-title">제목</label>
            <input type="text" id="book-title" name="title" class="input" maxlength="200" placeholder="비워두면 파일에서 자동으로 가져옵니다">
          </div>
          <div class="form-group">
            <label for="book-author">저자</label>
            <input type="text" id="book-author" name="author" class="input" maxlength="100" placeholder="비워두면 파일에서 자동으로 가져옵니다">
          </div>
        </div>
        <div class="form-group">
          <label for="book-description">책 소개 (선택)</label>
          <textarea id="book-description" name="description" class="input" rows="3" maxlength="<?= BOOK_DESCRIPTION_MAX ?>" placeholder="책 상세 화면에 표시될 간단한 소개를 적어 주세요"></textarea>
        </div>
        <div class="form-row cover-row">
          <div class="form-group">
            <label for="book-cover">표지 이미지 (선택)</label>
            <input type="file" id="book-cover" name="cover" class="input" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
            <p class="form-help">비워두면 PDF/EPUB에서 표지를 자동 추출합니다. 실패하면 기본 표지가 사용됩니다. (JPG, PNG, WebP)</p>
          </div>
          <div class="cover-preview-wrap">
            <img id="cover-preview" class="cover-preview" alt="표지 미리보기" hidden>
            <span id="cover-preview-label" class="muted small"></span>
          </div>
        </div>
        <div id="upload-progress" class="progress" hidden>
          <div class="progress-bar" id="upload-progress-bar"></div>
          <span class="progress-text" id="upload-progress-text">0%</span>
        </div>
        <button type="submit" class="btn btn-primary" id="upload-btn">⬆️ 업로드</button>
      </form>
    </div>
    <?php
}
