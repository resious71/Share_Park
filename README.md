# 📚 Share Park

개인이 소유한 PDF/EPUB 전자책을 등록·관리하고, 로그인한 사용자가 **개인용도 동의서**에 동의한 뒤 다운로드할 수 있는 웹사이트입니다.
순수 PHP + JSON 파일 저장소로 동작하며 데이터베이스가 필요 없습니다.

## 빠른 시작

```bash
# PHP 8.1 이상 (확장: json, mbstring, fileinfo, zip, gd 권장)
php -S localhost:8000 -d upload_max_filesize=64M -d post_max_size=70M
```

브라우저에서 `http://localhost:8000` 접속 → **초기 관리자 계정 `admin` / `admin`** 으로 로그인 → 마이페이지에서 비밀번호를 바로 변경하세요.

처음 실행하면 `data/` 폴더와 JSON 파일, 책/표지 저장 폴더, 기본 관리자 계정이 자동으로 생성됩니다.

## 주요 기능

| 영역 | 기능 |
|------|------|
| 사용자 | ID/PW 로그인, 타일형 도서 목록(2~4열 반응형), 제목·저자 검색, 정렬(커스텀/제목/저자/추가일), 드래그 앤 드롭 개인 순서 저장 |
| 다운로드 | 개인용도 동의서 모달 → 서버 검증 후 1회용 토큰으로 다운로드, 원본 파일명 유지, 하루 다운로드 제한 + 남은 횟수 배너, "N일 동안 다시 보지 않기" |
| 마이페이지 | 프로필, 비밀번호 변경(기존 비밀번호 확인), 다운로드 히스토리(검색·페이지) |
| 관리자 | 계정 CRUD·제한 초기화·히스토리 조회 / 도서 업로드(드래그 앤 드롭·진행률)·수정·삭제·표시 순서 / 설정 / 다운로드 통계·동의 기록 / 가이드·FAQ·도움말 팝업·첫 방문 둘러보기 |

## 표지 추출 (하이브리드)

1. 수동 업로드한 표지 (JPG/PNG/WebP)
2. **EPUB**: OPF 매니페스트의 표지 이미지 (`cover-image`, `<meta name="cover">`, guide 등)
3. **PDF**: 서버 렌더링 (Imagick → `pdftoppm` → ImageMagick `convert`)
4. **PDF**: 브라우저(pdf.js)에서 렌더링한 첫 페이지
5. **PDF**: 파일 안에 포함된 JPEG 이미지
6. 모두 실패하면 제목이 들어간 파스텔 기본 표지(SVG)

## 파일 저장 경로

`config.php` 에서 기본값을 정의합니다.

- Windows: `C:/Users/resisa/Documents/ebook-files/books/`, `.../covers/`
- 그 외: 사이트 폴더의 `uploads/`, `covers/`

관리자 페이지 > 설정에서 경로를 바꿀 수 있습니다 (`data/settings.json` 에 저장되며 config 값보다 우선).
파일은 로그인·동의·제한 확인을 거쳐 PHP로만 전송되므로 웹 루트 밖이어도 되며 심볼릭 링크가 필요 없습니다.

## 디렉토리 구조

```
index.php  dashboard.php  mypage.php  admin.php  logout.php  config.php
includes/  bootstrap.php(공통 함수)  layout.php(헤더/푸터)
api/       login, search, upload, download, delete, books, users, settings, stats,
           check-download-limit, save-custom-order, verify-agreement, record-agreement,
           my-downloads, change-password, cover, extract-cover(함수 전용)
css/style.css
js/        script.js(공통) dragdrop.js agreement.js dashboard.js mypage.js admin.js admin-guide.js
data/      users.json books.json settings.json downloads.json
           user-custom-orders.json download-agreements.json agreement-skips.json
```

## 보안

- 비밀번호 bcrypt 해시, 로그인 시 세션 ID 재발급, 연속 실패 시 응답 지연
- 모든 변경 요청에 CSRF 토큰 검증, 출력은 HTML 이스케이프 (XSS 방지), DB 미사용
- 업로드 확장자 + 실제 파일 내용(MIME/이미지 헤더) 검증, 저장 파일명은 서버에서 무작위 생성 (경로 조작 방지)
- 다운로드는 서버가 동의를 기록한 뒤 발급한 **1회용·5분 유효 토큰**이 있어야 하며, 제한 확인과 기록은 파일 잠금 안에서 원자적으로 처리
- `data/`, `uploads/`, `covers/`, `includes/` 는 `.htaccess` 로 직접 접근 차단
  (Nginx 사용 시 `location ~ ^/(data|uploads|covers|includes)/ { deny all; }` 를 추가하세요)
- 동의 기록과 다운로드 기록은 계정 삭제 후에도 보관

## 백업

`data/` 폴더와 책·표지 저장 폴더를 함께 복사하면 됩니다.
