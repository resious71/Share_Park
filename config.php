<?php
/**
 * Share Park - 전역 설정 파일
 *
 * 폴더 경로와 상수를 정의합니다.
 * 파일 저장 경로는 관리자 페이지 > 설정에서도 변경할 수 있으며,
 * 설정 화면에서 지정한 값(data/settings.json)이 아래 기본값보다 우선합니다.
 */

define('APP_NAME', 'Share Park');
define('APP_VERSION', '1.4.0');
define('APP_ROOT', __DIR__);
define('DATA_DIR', __DIR__ . '/data');

date_default_timezone_set('Asia/Seoul');

// ---------------------------------------------------------------------------
// 파일 저장 경로 (기본값)
//  - Windows 로컬 환경에서는 요구사항 명세의 경로를 사용합니다.
//  - 그 외 환경에서는 사이트 폴더 안의 uploads/, covers/ 를 사용합니다.
//  - 파일은 PHP를 통해서만 전송되므로 웹 루트 밖의 경로여도 괜찮습니다.
// ---------------------------------------------------------------------------
if (PHP_OS_FAMILY === 'Windows') {
    define('DEFAULT_BOOKS_DIR', 'C:/Users/resisa/Documents/ebook-files/books');
    define('DEFAULT_COVERS_DIR', 'C:/Users/resisa/Documents/ebook-files/covers');
} else {
    define('DEFAULT_BOOKS_DIR', __DIR__ . '/uploads');
    define('DEFAULT_COVERS_DIR', __DIR__ . '/covers');
}

// 업로드 허용 형식
define('ALLOWED_BOOK_EXT', ['pdf', 'epub']);
define('ALLOWED_IMAGE_EXT', ['jpg', 'jpeg', 'png', 'webp']);

// 최초 실행 시 생성되는 관리자 계정 (로그인 후 반드시 비밀번호를 변경하세요)
define('DEFAULT_ADMIN_USERNAME', 'admin');
define('DEFAULT_ADMIN_PASSWORD', 'admin');

// 동의 후 발급되는 1회용 다운로드 토큰 유효 시간(초)
define('DOWNLOAD_TOKEN_TTL', 300);

// 마이페이지 다운로드 히스토리 페이지 크기
define('HISTORY_PAGE_SIZE', 10);

// 도서 목록에 강조 표시할 인기 도서 수
define('POPULAR_BOOK_COUNT', 3);

// 책 소개 최대 길이
define('BOOK_DESCRIPTION_MAX', 2000);

// 기본 다운로드 동의서
define('DEFAULT_AGREEMENT_TEXT', <<<'TXT'
## 1. 개인용도 제한
- 다운로드한 전자책은 **개인적인 학습, 참고, 감상 목적**으로만 사용합니다.
- **상업적 목적의 이용은 엄격히 금지**됩니다.
## 2. 공유 및 배포 금지
- 타인과의 **공유, 배포, 판매를 금지**합니다.
- SNS, 클라우드, 파일 공유 서비스 등을 통한 **배포를 금지**합니다.
- **가족 구성원이라도** 무단으로 공유할 수 없습니다.
## 3. 저작권 보호
- 모든 저작권은 **저자 및 출판사**에게 있습니다.
- 무단 복제, 번역, 개작은 **저작권법에 의해 처벌**될 수 있습니다.
## 4. 법적 책임
- 약관 위반 시 **민사 및 형사상 법적 책임**이 발생할 수 있습니다.
- 저작권 침해로 인한 **손해배상 청구**의 대상이 될 수 있습니다.
## 5. 플랫폼의 권리
- 약관을 위반한 사용자의 **계정을 제한하거나 삭제**할 수 있습니다.
- 위반 내용을 **관련 기관에 신고**할 수 있습니다.
TXT);

// settings.json 기본값
define('DEFAULT_SETTINGS', [
    'site_title'            => 'Share Park',
    'daily_download_limit'  => 1,
    'reset_time'            => '00:00',
    'max_file_size'         => 52428800, // 50MB
    'max_image_size'        => 5242880,  // 5MB
    'days_ignore_agreement' => 7,
    'books_path'            => '',       // 비워두면 DEFAULT_BOOKS_DIR 사용
    'covers_path'           => '',       // 비워두면 DEFAULT_COVERS_DIR 사용
    'agreement_text'        => DEFAULT_AGREEMENT_TEXT,
    'agreement_version'     => '1.0',
    'allow_member_upload'   => true,     // 일반 회원의 책 등록 허용
]);

require_once __DIR__ . '/includes/bootstrap.php';
