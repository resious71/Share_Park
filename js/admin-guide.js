/**
 * Share Park - 관리자 도움말 팝업, 가이드, FAQ, 둘러보기(투어)
 */
(function () {
  'use strict';

  const SP = (window.SP = window.SP || {});
  const esc = (v) => SP.escapeHtml(v);

  // ---------------------------------------------------------------------------
  // 도움말 팝업 내용
  // ---------------------------------------------------------------------------
  const HELP = {
    accounts: {
      title: '👥 계정 관리',
      desc: '사이트에 로그인할 수 있는 사용자 계정을 추가합니다. 아이디는 중복될 수 없으며, 비밀번호에는 길이나 문자 제한이 없습니다.',
      steps: ['아이디를 입력합니다. (2~30자, 한글·영문·숫자·_ . -)', '비밀번호를 입력합니다.', '권한을 선택합니다. 관리자는 이 관리자 페이지에 들어올 수 있고 다운로드 제한을 받지 않습니다.', '➕ 추가 버튼을 누르면 목록에 바로 나타납니다.'],
      example: '예) 아이디 <code>reader01</code>, 비밀번호 <code>1234</code>, 권한 <strong>일반 사용자</strong>',
      tip: '사용자에게 처음 비밀번호를 알려준 뒤, 마이페이지에서 직접 비밀번호를 바꾸도록 안내하세요.',
    },
    limits: {
      title: '📋 사용자 목록 & 다운로드 제한',
      desc: '모든 사용자와 오늘의 다운로드 사용량을 보여줍니다. "1/1"은 하루 제한 1회 중 1회를 사용했다는 뜻입니다.',
      steps: ['아이디를 클릭하면 해당 사용자의 다운로드 히스토리와 동의 기록을 볼 수 있습니다.', '🎚️ 버튼(또는 하루 제한 열)을 누르면 사용자별 하루 다운로드 횟수를 정할 수 있습니다. (기본 설정 따르기 · 직접 지정 · 무제한)', '🔑 버튼으로 비밀번호를 새로 지정할 수 있습니다.', '↺ 버튼으로 해당 사용자의 오늘 다운로드 횟수를 즉시 초기화합니다.', '🗑️ 버튼으로 계정을 삭제합니다. (다운로드·동의 기록은 보관)'],
      tip: '자주 이용하는 사용자는 "하루 3회"처럼 개인 횟수를 늘려 줄 수 있습니다. 새 사용자를 추가할 때 "하루 다운로드" 칸에 바로 입력해도 됩니다. 비워 두면 설정 탭의 기본값을 따릅니다.',
      example: '사용자가 "다운로드가 안 돼요"라고 하면 목록에서 <strong>오늘 사용</strong>이 꽉 찼는지 확인하고 ↺ 로 초기화해 주세요.',
      warn: '본인 계정과 마지막 관리자 계정은 삭제할 수 없습니다.',
    },
    books: {
      title: '📚 책 등록',
      desc: 'PDF 또는 EPUB 파일을 올려 새 책을 등록합니다. 표지는 파일에서 자동으로 추출됩니다.',
      steps: ['파일을 점선 영역에 끌어다 놓거나 클릭해서 선택합니다.', '제목과 저자를 입력합니다. 비워두면 EPUB 정보 또는 파일명이 사용됩니다.', '책 소개를 적으면 책 상세 화면에 표시됩니다. (선택)', '원하는 표지가 있다면 표지 이미지를 직접 선택합니다. (JPG, PNG, WebP)', '⬆️ 업로드를 누르면 진행률이 표시되고, 완료되면 목록에 추가됩니다.'],
      example: 'PDF는 첫 페이지, EPUB은 책에 지정된 표지 이미지가 표지로 사용됩니다. 둘 다 실패하면 파스텔 색상의 기본 표지가 만들어집니다.',
      warn: '같은 파일명의 책은 중복 등록할 수 없습니다. 파일 크기 제한은 설정 탭에서 바꿀 수 있습니다.',
    },
    order: {
      title: '↕️ 등록된 책 & 표시 순서',
      desc: '등록된 모든 책을 표로 보여줍니다. 이 표의 순서가 사용자 대시보드의 기본 순서가 됩니다.',
      steps: ['⠿ 손잡이를 마우스(또는 손가락)로 끌어 원하는 위치에 놓습니다.', '놓는 즉시 순서가 저장됩니다. 손잡이에 포커스한 뒤 방향키로도 옮길 수 있습니다.', '다운로드 열의 "N회 👥"를 누르면 그 책을 누가 언제 다운로드했는지 볼 수 있습니다.', '책이 많으면 표 아래의 페이지 번호로 이동하고, 오른쪽 위 "페이지당"에서 10·20·50권 또는 전체를 고를 수 있습니다.', '✏️ 버튼으로 제목·저자·소개·표지를 수정합니다.', '🗑️ 버튼으로 책을 삭제합니다. 파일과 표지도 함께 삭제됩니다.'],
      example: '등록자 열에서 관리자가 올린 책과 회원이 올린 책을 구분할 수 있습니다. 🏆 배지는 다운로드가 가장 많은 인기 도서 TOP 3입니다.',
      warn: '드래그로 순서를 바꿀 때는 보고 있는 페이지 안에서만 옮길 수 있습니다. 다른 페이지로 옮기려면 "페이지당: 전체"로 바꾼 뒤 옮기세요.',
      tip: '사용자가 자신만의 순서를 저장했다면 그 사용자에게는 개인 순서가 우선 적용되고, 새로 추가된 책은 뒤쪽에 표시됩니다.',
    },
    settings: {
      title: '⚙️ 일반 설정',
      desc: '사이트 전체에 적용되는 설정입니다. 저장하면 즉시 적용됩니다.',
      steps: ['각 항목의 설명과 기본값을 확인합니다.', '값을 변경합니다.', '화면 아래의 💾 설정 저장 버튼을 누릅니다.'],
      example: '하루 다운로드 제한 <code>3</code>, 초기화 시간 <code>06:00</code> → 사용자는 매일 오전 6시부터 다음 날 오전 6시 전까지 3권을 받을 수 있습니다.',
      tip: '하루 다운로드 제한을 0으로 하면 무제한이 됩니다.',
    },
    paths: {
      title: '📁 파일 저장 경로',
      desc: '전자책 파일과 표지 이미지가 저장되는 폴더입니다. 비워두면 config.php 의 기본 경로가 사용됩니다.',
      steps: ['새 폴더를 만들고 기존 파일을 모두 복사합니다.', '절대 경로를 입력합니다. (예: C:/ebook-files/books)', '설정 저장 후 책 다운로드가 정상인지 확인합니다.'],
      warn: '경로를 바꿔도 기존 파일은 옮겨지지 않습니다. 파일을 옮기지 않고 경로만 바꾸면 기존 책을 다운로드할 수 없게 됩니다.',
    },
    agreement: {
      title: '📜 다운로드 동의서',
      desc: '사용자가 책을 다운로드하기 전에 보여주는 개인용도 동의서입니다. 모든 동의는 서버에 기록됩니다.',
      steps: ['<code>## 제목</code> 으로 섹션을 나눕니다.', '<code>- 내용</code> 으로 항목을 적습니다.', '<code>**강조**</code> 로 중요한 단어를 굵게 표시합니다.', '👁️ 미리보기로 확인한 뒤 설정을 저장합니다.'],
      example: '<code>## 1. 개인용도 제한</code><br><code>- **상업적 목적의 이용은 금지**됩니다.</code>',
      tip: '내용을 바꾸면 버전(예: 1.0 → 1.1)이 자동으로 올라가고, \'다시 보지 않기\'를 선택한 사용자에게도 동의서가 다시 표시됩니다.',
    },
    downloads: {
      title: '📊 다운로드 관리',
      desc: '오늘·이번 달·누적 다운로드 수와 최근 다운로드, 인기 도서, 동의 기록을 확인합니다.',
      steps: ['상단 카드에서 전체 통계를 확인합니다.', '최근 다운로드 10건으로 누가 어떤 책을 받았는지 봅니다.', '동의 기록에서 사용자별 동의 일시·IP·동의서 버전을 확인합니다.', '필요하면 ↺ 전체 다운로드 제한 초기화를 누릅니다.'],
      tip: '동의 기록은 법적 분쟁에 대비한 자료이므로 삭제되지 않습니다. 방식이 "다시 보지 않기"인 기록은 사용자가 이전에 동의한 기간 안에 받은 다운로드입니다.',
    },
  };

  function helpHtml(h) {
    return `<div class="help-content">
      <p>${h.desc}</p>
      <h4>📝 사용 방법</h4>
      <ol>${h.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      ${h.example ? `<div class="help-example">💡 <strong>예시</strong><br>${h.example}</div>` : ''}
      ${h.tip ? `<div class="help-tip">✨ <strong>팁</strong> ${h.tip}</div>` : ''}
      ${h.warn ? `<div class="help-warn">⚠️ <strong>주의</strong> ${h.warn}</div>` : ''}
    </div>`;
  }

  SP.showHelp = function (key) {
    const h = HELP[key];
    if (!h) return;
    SP.openModal({
      title: esc(h.title) + ' 도움말',
      body: helpHtml(h),
      headerClass: 'sky',
      footer: [SP.button('닫기', 'btn-sky', function () { this.closest('.modal-backdrop').querySelector('.modal-close').click(); })],
    });
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.help-btn[data-help]');
    if (btn) SP.showHelp(btn.dataset.help);
  });

  // ---------------------------------------------------------------------------
  // 가이드 탭
  // ---------------------------------------------------------------------------
  const GUIDE = [
    {
      icon: '👥', title: '계정 관리', help: 'accounts',
      what: '사용자 계정을 추가·삭제하고 비밀번호를 바꾸며, 다운로드 사용량을 관리합니다.',
      steps: ['계정 탭 → 새 사용자 추가에서 아이디/비밀번호/권한 입력 후 추가', '사용자 목록에서 🔑 로 비밀번호 재설정', '↺ 로 해당 사용자의 오늘 다운로드 제한 초기화', '아이디 클릭으로 다운로드 히스토리·동의 기록 조회', '🗑️ 로 계정 삭제 (확인 후 삭제)'],
      tips: ['관리자 권한 계정은 다운로드 제한을 받지 않습니다.', '사용자는 마이페이지에서 스스로 비밀번호를 바꿀 수 있습니다.'],
      warns: ['계정을 삭제해도 다운로드·동의 기록은 법적 대비를 위해 보관됩니다.', '본인 계정과 마지막 관리자는 삭제할 수 없습니다.'],
    },
    {
      icon: '📚', title: '도서 관리', help: 'books',
      what: 'PDF/EPUB 전자책을 등록하고 정보 수정, 삭제, 표시 순서 변경, 책별 다운로드한 사용자 확인을 합니다.',
      steps: ['도서 탭 → 파일을 끌어다 놓거나 클릭해서 선택', '제목·저자 입력 (비우면 자동)', '필요하면 표지 이미지를 직접 선택', '⬆️ 업로드 후 진행률 확인', '등록된 책 표에서 ⠿ 로 순서 변경, ✏️ 로 수정, 🗑️ 로 삭제', '다운로드 열의 "N회 👥" 로 그 책을 다운로드한 사용자 확인'],
      tips: ['표지 자동 추출: EPUB은 책에 지정된 표지, PDF는 첫 페이지를 사용합니다.', '표지가 마음에 들지 않으면 ✏️ 수정에서 새 이미지로 교체할 수 있습니다.', '설정에서 "일반 회원의 책 등록 허용"을 켜면 회원도 마이페이지 → 내 책에서 책을 올릴 수 있습니다.', '다운로드가 가장 많은 책 3권은 도서 목록에서 옅은 파랑 테두리와 🏆 배지로 강조됩니다.'],
      warns: ['같은 파일명의 책은 등록할 수 없습니다.', '삭제한 책은 복구할 수 없습니다.', '회원은 자신이 등록한 책만 수정·삭제할 수 있고, 관리자는 모든 책을 관리할 수 있습니다.'],
    },
    {
      icon: '⚙️', title: '설정', help: 'settings',
      what: '사이트 제목, 업로드 크기, 다운로드 제한, 초기화 시간, 저장 경로, 동의서를 관리합니다.',
      steps: ['설정 탭에서 원하는 항목 수정', '각 항목 아래의 설명과 기본값 확인', '💾 설정 저장 → 즉시 적용', '동의서는 👁️ 미리보기로 확인 후 저장'],
      tips: ['하루 다운로드 제한 0 = 무제한', "'다시 보지 않기' 기간 0 = 매번 동의서 표시"],
      warns: ['분홍색으로 표시된 저장 경로 변경은 기존 파일을 옮기지 않습니다.', 'PHP 업로드 한도(upload_max_filesize)보다 큰 파일은 설정과 관계없이 업로드되지 않습니다.'],
    },
    {
      icon: '📊', title: '다운로드 관리', help: 'downloads',
      what: '다운로드 통계와 최근 기록, 동의 기록을 확인하고 제한을 초기화합니다.',
      steps: ['다운로드 관리 탭에서 오늘/이번 달/누적 통계 확인', '최근 다운로드 10건과 인기 도서 확인', '동의 기록에서 사용자별 필터로 조회', '필요 시 전체 다운로드 제한 초기화'],
      tips: ['다운로드 횟수는 설정한 초기화 시간마다 자동으로 0이 됩니다.'],
      warns: ['전체 초기화는 모든 사용자에게 즉시 적용됩니다.'],
    },
  ];

  const FAQ = [
    ['사용자가 "오늘의 다운로드 횟수를 초과했습니다"라는 메시지를 봐요.', '하루 제한 횟수를 모두 사용한 상태입니다. 계정 탭의 사용자 목록에서 해당 사용자의 ↺ 버튼을 누르면 즉시 다시 받을 수 있습니다. 모두에게 더 많은 횟수를 주려면 설정 탭에서 하루 다운로드 제한 값을 올리세요.'],
    ['다운로드 제한은 언제 초기화되나요?', '설정 탭의 "제한 초기화 시간"(기본 00:00)마다 자동으로 초기화됩니다. 예를 들어 06:00으로 설정하면 매일 오전 6시에 횟수가 다시 채워집니다.'],
    ['특정 사용자만 다운로드 횟수를 다르게 할 수 있나요?', '네. 계정 탭 사용자 목록에서 🎚️ 버튼(또는 "하루 제한" 열)을 누르면 그 사용자만 "하루 N회" 또는 "무제한"으로 정할 수 있습니다. "기본 설정 따르기"를 고르면 다시 설정 탭의 하루 다운로드 제한을 따릅니다. 새 사용자를 추가할 때 "하루 다운로드" 칸에 바로 입력할 수도 있습니다.'],
    ['관리자도 다운로드 제한을 받나요?', '아니요. 관리자 권한 계정은 다운로드 횟수 제한 없이 이용할 수 있습니다. 다만 동의서 절차와 기록은 동일하게 적용됩니다.'],
    ['표지가 자동으로 추출되지 않고 기본 표지가 나와요.', 'PDF는 서버의 Imagick/pdftoppm 또는 브라우저(pdf.js)로 첫 페이지를 렌더링합니다. 모두 실패하면 기본 표지가 사용됩니다. 도서 표의 ✏️ 수정에서 표지 이미지를 직접 올려 교체하세요.'],
    ['파일 업로드가 실패해요.', '① 파일 크기가 설정의 최대 크기 이하인지, ② PHP의 upload_max_filesize / post_max_size 한도 이하인지, ③ 저장 경로에 쓰기 권한이 있는지, ④ 같은 파일명의 책이 이미 있는지 확인하세요. 오류 메시지에 원인이 표시됩니다.'],
    ['같은 책을 다시 올리고 싶어요.', '같은 파일명은 중복 등록할 수 없습니다. 기존 책을 삭제한 뒤 다시 올리거나, 파일명을 바꿔서 업로드하세요.'],
    ['동의서 내용을 바꾸면 어떻게 되나요?', '동의서 버전이 자동으로 올라가고(예: 1.0 → 1.1), \'다시 보지 않기\'를 선택했던 사용자에게도 다음 다운로드 때 새 동의서가 표시됩니다. 이전 동의 기록은 그대로 보관됩니다.'],
    ["'다시 보지 않기'는 어떻게 동작하나요?", '사용자가 동의할 때 이 옵션을 선택하면 설정한 기간(기본 7일) 동안 동의서를 생략합니다. 생략된 경우에도 서버가 기간을 다시 확인하고 동의 기록을 "다시 보지 않기" 방식으로 남깁니다.'],
    ['사용자가 비밀번호를 잊어버렸어요.', '계정 탭의 사용자 목록에서 🔑 버튼을 눌러 새 비밀번호를 지정한 뒤 사용자에게 알려주세요. 사용자는 마이페이지에서 다시 바꿀 수 있습니다.'],
    ['계정을 삭제하면 기록도 사라지나요?', '아니요. 다운로드 기록과 동의 기록은 법적 분쟁에 대비해 보관됩니다. 삭제되는 것은 계정 정보와 개인 정렬 순서, \'다시 보지 않기\' 설정입니다.'],
    ['사용자 대시보드의 책 순서는 어떻게 정해지나요?', '도서 탭의 표 순서가 기본 순서이며, 도서 목록은 한 페이지에 12권씩 나뉘어 표시됩니다. 사용자가 대시보드에서 드래그로 자신만의 순서를 저장하면 그 사용자에게는 개인 순서가 우선 적용됩니다.'],
    ['책 파일과 표지는 어디에 저장되나요?', 'config.php 의 기본 경로 또는 설정 탭에서 지정한 경로에 저장됩니다. 현재 경로는 설정 탭의 "파일 저장 경로" 카드에서 확인할 수 있습니다. 파일은 로그인과 동의를 거쳐야만 PHP를 통해 전송됩니다.'],
    ['데이터는 어디에 저장되나요? 백업은 어떻게 하나요?', '모든 정보는 data 폴더의 JSON 파일(users, books, settings, downloads, user-custom-orders, download-agreements)에 저장됩니다. data 폴더와 책/표지 폴더를 함께 복사하면 백업이 됩니다.'],
    ['회원도 책을 등록할 수 있나요?', '네. 설정 탭의 "일반 회원의 책 등록 허용"이 켜져 있으면(기본값) 회원이 마이페이지 → 📚 내 책 탭에서 책을 등록할 수 있습니다. 회원은 자신이 올린 책만 수정·삭제할 수 있고, 관리자는 도서 탭에서 모든 책을 관리합니다. 끄면 관리자만 등록할 수 있습니다.'],
    ['특정 책을 누가 다운로드했는지 알고 싶어요.', '도서 탭의 등록된 책 표에서 다운로드 열의 "N회 👥" 를 누르면 사용자별 다운로드 횟수와 전체 다운로드 일시가 표시됩니다.'],
    ['인기 도서(🏆)는 어떻게 정해지나요?', '전체 다운로드 횟수가 가장 많은 책 3권이 인기 도서입니다. 횟수가 같으면 먼저 등록된 책이 앞 순위가 됩니다. 도서 목록에서 옅은 파랑 테두리와 오른쪽 아래 🏆 배지로 표시되고, 정렬에서 "인기순"을 고를 수도 있습니다.'],
    ['책 카드를 누르면 무엇이 보이나요?', '표지, 제목, 저자, 다운로드 횟수, 파일 크기, 등록일, 등록자, 책 소개가 담긴 상세 정보 창이 열리고, 그 창에서 바로 다운로드할 수 있습니다. 관리자나 책을 등록한 회원에게는 ✏️ 수정 버튼도 보입니다.'],
    ['책이 많아서 다른 페이지에 있는 책의 순서를 바꾸고 싶어요.', '도서 탭 등록된 책 표의 오른쪽 위 "페이지당"을 "전체"로 바꾸면 모든 책이 한 화면에 나와서 자유롭게 끌어 옮길 수 있습니다. 페이지당 개수는 브라우저에 기억됩니다.'],
    ['초기 관리자 비밀번호는 무엇인가요?', '처음 설치하면 admin / admin 계정이 만들어집니다. 보안을 위해 로그인 후 바로 마이페이지에서 비밀번호를 변경하세요.'],
  ];

  function renderGuide() {
    const box = document.getElementById('guide-sections');
    if (!box) return;
    box.innerHTML = GUIDE.map((g) => `
      <div class="card guide-section">
        <h3>${g.icon} ${esc(g.title)} <button type="button" class="help-btn" data-help="${g.help}" aria-label="도움말">?</button></h3>
        <p>${esc(g.what)}</p>
        <h5>단계별 사용 방법</h5>
        <ol>${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <h5>팁</h5>
        <ul>${g.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        <h5>주의사항</h5>
        <ul class="warn-text">${g.warns.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>`).join('');

    const list = document.getElementById('faq-list');
    list.innerHTML = FAQ.map(([q, a], i) => `
      <div class="faq-item" data-q="${esc(q.toLowerCase())}">
        <button type="button" class="faq-question" aria-expanded="false" aria-controls="faq-a-${i}">
          <span><span class="q">Q.</span>${esc(q)}</span><span class="faq-arrow">▾</span>
        </button>
        <div class="faq-answer" id="faq-a-${i}" role="region"><div><div class="faq-answer-inner">${esc(a)}</div></div></div>
      </div>`).join('');

    // 아코디언: 여러 항목을 동시에 펼칠 수 있음
    list.addEventListener('click', (e) => {
      const q = e.target.closest('.faq-question');
      if (!q) return;
      const item = q.closest('.faq-item');
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    const search = document.getElementById('faq-search');
    const empty = document.getElementById('faq-empty');
    search.addEventListener('input', () => {
      const term = search.value.trim().toLowerCase();
      let shown = 0;
      list.querySelectorAll('.faq-item').forEach((el) => {
        const match = !term || el.dataset.q.includes(term);
        el.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown > 0;
    });
  }

  // ---------------------------------------------------------------------------
  // 둘러보기(투어)
  // ---------------------------------------------------------------------------
  const TOUR_KEY = 'sharepark.admin.tour.done';
  const TOUR = [
    { sel: '#admin-tabs', title: '👋 관리자 페이지에 오신 것을 환영합니다', text: '이 탭으로 계정, 도서, 설정, 다운로드 관리, 가이드 화면을 오갈 수 있습니다. 주요 기능을 차례로 소개할게요.' },
    { sel: '[data-tab="accounts"]', tab: 'accounts', title: '👥 계정', text: '사용자를 추가·삭제하고, 비밀번호 변경과 다운로드 제한 초기화를 할 수 있습니다.' },
    { sel: '#user-create-card', tab: 'accounts', title: '➕ 새 사용자 추가', text: '아이디, 비밀번호, 권한을 입력하고 추가 버튼을 누르면 됩니다.' },
    { sel: '[data-tab="books"]', tab: 'books', title: '📚 도서', text: 'PDF/EPUB 파일을 끌어다 놓아 등록합니다. 표지는 자동으로 추출되고, 표에서 순서를 드래그로 바꿀 수 있습니다.' },
    { sel: '[data-tab="settings"]', tab: 'settings', title: '⚙️ 설정', text: '사이트 제목, 하루 다운로드 제한, 초기화 시간, 파일 크기, 저장 경로, 동의서 내용을 바꿀 수 있습니다.' },
    { sel: '[data-tab="downloads"]', tab: 'downloads', title: '📊 다운로드 관리', text: '오늘·이번 달·누적 통계, 최근 다운로드, 동의 기록을 확인합니다.' },
    { sel: '[data-tab="guide"]', tab: 'guide', title: '📘 가이드', text: '모든 기능의 자세한 사용법과 자주 묻는 질문(FAQ)이 있습니다.' },
    { sel: '#tab-guide .help-btn', tab: 'guide', title: '❓ 도움말 버튼', text: '각 기능 옆의 ? 버튼을 누르면 그 기능의 도움말이 팝업으로 열립니다.' },
    { sel: '#tour-restart', tab: 'accounts', title: '🧭 다시 보기', text: '이 둘러보기는 언제든지 이 버튼으로 다시 볼 수 있습니다. 즐거운 관리 되세요!' },
  ];

  SP.startTour = function () {
    let i = 0;
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    const spot = document.createElement('div');
    spot.className = 'tour-spotlight';
    const pop = document.createElement('div');
    pop.className = 'tour-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-live', 'polite');
    document.body.append(overlay, spot, pop);

    const end = () => {
      SP.storage.set(TOUR_KEY, '1');
      overlay.remove(); spot.remove(); pop.remove();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
      if (SP.adminTabs) SP.adminTabs.activate('accounts');
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); end(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    const next = () => { if (i < TOUR.length - 1) { i++; show(); } else end(); };

    function place() {
      const step = TOUR[i];
      const el = document.querySelector(step.sel);
      if (!el) { spot.style.cssText = 'width:0;height:0;left:50%;top:50%'; return; }
      const r = el.getBoundingClientRect();
      const pad = 6;
      Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      const pw = pop.offsetWidth;
      const ph = pop.offsetHeight;
      let top = r.bottom + 14;
      if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 14);
      const left = Math.min(Math.max(10, r.left), window.innerWidth - pw - 10);
      Object.assign(pop.style, { top: top + 'px', left: left + 'px' });
    }

    function show() {
      const step = TOUR[i];
      if (step.tab && SP.adminTabs) SP.adminTabs.activate(step.tab, false);
      const el = document.querySelector(step.sel);
      if (el) el.scrollIntoView({ block: 'center' });
      pop.innerHTML = `
        <h4>${esc(step.title)}</h4>
        <p>${esc(step.text)}</p>
        <div class="tour-footer">
          <span class="tour-step">${i + 1} / ${TOUR.length}</span>
          <span class="btn-row" style="margin:0">
            <button type="button" class="btn btn-ghost btn-sm js-skip">건너뛰기</button>
            ${i > 0 ? '<button type="button" class="btn btn-ghost btn-sm js-prev">이전</button>' : ''}
            <button type="button" class="btn btn-primary btn-sm js-next">${i === TOUR.length - 1 ? '완료' : '다음 →'}</button>
          </span>
        </div>`;
      pop.querySelector('.js-skip').onclick = end;
      pop.querySelector('.js-next').onclick = next;
      const prev = pop.querySelector('.js-prev');
      if (prev) prev.onclick = () => { i--; show(); };
      requestAnimationFrame(place);
      pop.querySelector('.js-next').focus();
    }

    overlay.addEventListener('click', next);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    show();
  };

  SP.maybeStartTour = function () {
    if (SP.storage.get(TOUR_KEY) !== '1') setTimeout(SP.startTour, 600);
  };

  document.addEventListener('DOMContentLoaded', renderGuide);
})();
