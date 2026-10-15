#!/usr/bin/env bash
# Share Park 스모크 테스트
# 저장소를 임시 폴더에 복사해 PHP 내장 서버로 띄우고, 로그인 · 권한 · 동의 · 다운로드 · 회원 책 등록 흐름을 확인합니다.
# 사용법: bash tests/smoke.sh   (PHP 8.1+ 와 curl 필요, 실제 data/ 폴더는 건드리지 않음)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT="${PORT:-8089}"
BASE="http://127.0.0.1:${PORT}"
PASS=0

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# 런타임 데이터 없이 복사
tar -C "$ROOT" --exclude=.git --exclude='data/*.json' --exclude='uploads/*' --exclude='covers/*' -cf - . | tar -C "$WORK" -xf -
mkdir -p "$WORK/data" "$WORK/uploads" "$WORK/covers"

php -S "127.0.0.1:${PORT}" -t "$WORK" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do curl -s -o /dev/null "$BASE/index.php" && break; sleep 0.1; done

ok()   { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; echo "--- server.log"; cat "$WORK/server.log"; exit 1; }
expect() { # expect <설명> <기대값> <실제값>
  if [[ "$3" == *"$2"* ]]; then ok "$1"; else fail "$1 (기대: $2, 실제: $3)"; fi
}
token() { curl -s -b "$1" -c "$1" "$BASE/$2" | sed -n 's/.*name="csrf-token" content="\([^"]*\)".*/\1/p'; }
post_json() { # post_json <jar> <token> <url> <json>
  curl -s -b "$1" -c "$1" -H "X-CSRF-Token: $2" -H 'Content-Type: application/json' -d "$4" "$BASE/$3"
}

echo "▶ Share Park smoke test ($BASE)"

ADMIN="$WORK/admin.jar"; USER="$WORK/user.jar"

expect "로그인 페이지 응답" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/index.php")"
expect "비로그인 대시보드 → 로그인으로 이동" "302" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dashboard.php")"
expect "비로그인 API 차단" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/search.php")"
expect "함수 파일 직접 접근 차단" "403" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/extract-cover.php")"

T=$(token "$ADMIN" index.php)
expect "CSRF 토큰 없는 요청 거부" "보안 토큰" "$(post_json "$ADMIN" "" api/login.php '{"username":"admin","password":"admin"}')"
expect "잘못된 비밀번호 거부" '"ok":false' "$(post_json "$ADMIN" "$T" api/login.php '{"username":"admin","password":"wrong"}')"
expect "기본 관리자 로그인" '"ok":true' "$(post_json "$ADMIN" "$T" api/login.php '{"username":"admin","password":"admin"}')"
T=$(token "$ADMIN" dashboard.php)

expect "사용자 추가" '"ok":true' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"create","username":"reader","password":"pw"}')"
expect "중복 아이디 거부" '이미 사용 중' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"create","username":"Reader","password":"pw"}')"

# 최소 PDF 파일 생성 후 업로드
PDF="$WORK/smoke-book.pdf"
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > "$PDF"
UP=$(curl -s -b "$ADMIN" -H "X-CSRF-Token: $T" -F "book=@$PDF" -F "title=스모크 테스트 책" -F "author=CI" "$BASE/api/upload.php")
expect "PDF 업로드" '"ok":true' "$UP"
expect "같은 파일명 중복 거부" '이미 등록' "$(curl -s -b "$ADMIN" -H "X-CSRF-Token: $T" -F "book=@$PDF" "$BASE/api/upload.php")"
echo "not a pdf" > "$WORK/fake.pdf"
expect "가짜 PDF 거부" '올바른 PDF' "$(curl -s -b "$ADMIN" -H "X-CSRF-Token: $T" -F "book=@$WORK/fake.pdf" "$BASE/api/upload.php")"

# 일반 사용자
U=$(token "$USER" index.php)
expect "일반 사용자 로그인" '"ok":true' "$(post_json "$USER" "$U" api/login.php '{"username":"reader","password":"pw"}')"
U=$(token "$USER" dashboard.php)
expect "일반 사용자의 관리자 API 차단" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$USER" "$BASE/api/users.php")"
expect "도서 검색" '스모크 테스트 책' "$(curl -s -b "$USER" "$BASE/api/search.php?q=%EC%8A%A4%EB%AA%A8%ED%81%AC")"
expect "토큰 없는 다운로드 거부" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$USER" "$BASE/api/download.php?token=x")"
expect "동의 없이 다운로드 요청 거부" '동의' "$(post_json "$USER" "$U" api/record-agreement.php '{"book_id":1}')"

R=$(post_json "$USER" "$U" api/record-agreement.php '{"book_id":1,"agreed":true}')
expect "동의 기록 + 토큰 발급" 'download_url' "$R"
URL=$(echo "$R" | sed -n 's/.*"download_url":"\([^"]*\)".*/\1/p')
expect "파일 다운로드" "200" "$(curl -s -o "$WORK/out.pdf" -w '%{http_code}' -b "$USER" "$BASE/$URL")"
cmp -s "$PDF" "$WORK/out.pdf" && ok "원본과 동일한 파일" || fail "다운로드 파일이 원본과 다름"
expect "1회용 토큰 재사용 거부" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$USER" "$BASE/$URL")"
expect "하루 제한 초과 차단" '초과' "$(post_json "$USER" "$U" api/record-agreement.php '{"book_id":1,"agreed":true}')"
expect "내 다운로드 히스토리" '"total":1' "$(curl -s -b "$USER" "$BASE/api/my-downloads.php")"

expect "관리자 제한 초기화" '"ok":true' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"reset_limit","id":2}')"
expect "초기화 후 다운로드 가능" '"can_download":true' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
expect "통계 집계" '"total":1' "$(curl -s -b "$ADMIN" "$BASE/api/stats.php")"

# v1.4: 사용자별 하루 다운로드 횟수 (reader 는 오늘 1회 사용한 상태)
expect "일반 사용자의 개인 제한 설정 차단" '관리자만' "$(post_json "$USER" "$U" api/users.php '{"action":"set_limit","id":2,"download_limit":5}')"
expect "잘못된 개인 제한 값 거부" '0~1000' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"set_limit","id":2,"download_limit":"abc"}')"
expect "개인 제한 하루 3회 설정" '하루 3회로' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"set_limit","id":2,"download_limit":3}')"
expect "개인 제한 적용" '"limit":3' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
expect "개인 제한 표시값" '"custom":true' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
R=$(post_json "$USER" "$U" api/record-agreement.php '{"book_id":1,"agreed":true}')
URL=$(echo "$R" | sed -n 's/.*"download_url":"\([^"]*\)".*/\1/p')
expect "개인 제한으로 추가 다운로드" "200" "$(curl -s -o /dev/null -w '%{http_code}' -b "$USER" "$BASE/$URL")"
expect "개인 제한 무제한(0) 설정" '무제한으로' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"set_limit","id":2,"download_limit":0}')"
expect "무제한 적용" '"unlimited":true' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
expect "기본 설정으로 되돌리기" '전체 설정' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"set_limit","id":2,"download_limit":""}')"
expect "기본 설정 적용" '"custom":false' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
expect "기본 제한 초과 차단 복귀" '"can_download":false' "$(curl -s -b "$USER" "$BASE/api/check-download-limit.php")"
expect "사용자 추가 시 개인 제한 지정" '"download_limit":5' "$(post_json "$ADMIN" "$T" api/users.php '{"action":"create","username":"heavy","password":"pw","download_limit":5}')"
post_json "$ADMIN" "$T" api/users.php '{"action":"reset_limit","id":2}' >/dev/null

# v1.1: 다운로드 횟수 · 인기 도서 · 상세 정보
expect "도서 목록에 다운로드 횟수" '"download_count":2' "$(curl -s -b "$USER" "$BASE/api/search.php")"
expect "인기 도서 순위" '"popular_rank":1' "$(curl -s -b "$USER" "$BASE/api/search.php")"
DETAIL=$(curl -s -b "$USER" "$BASE/api/books.php?action=detail&id=1")
expect "책 상세 정보" '"owner_name"' "$DETAIL"
expect "상세 정보의 내 다운로드 횟수" '"my_downloads":2' "$DETAIL"

# v1.1: 책별 다운로드한 사용자 (관리자 전용)
expect "일반 사용자의 다운로드 사용자 조회 차단" "403" "$(curl -s -o /dev/null -w '%{http_code}' -b "$USER" "$BASE/api/books.php?action=downloaders&id=1")"
expect "관리자의 책별 다운로드 사용자 조회" '"username":"reader"' "$(curl -s -b "$ADMIN" "$BASE/api/books.php?action=downloaders&id=1")"

# v1.1: 회원 책 등록
cp "$PDF" "$WORK/member-book.pdf"
expect "회원 책 등록" '"ok":true' "$(curl -s -b "$USER" -H "X-CSRF-Token: $U" -F "book=@$WORK/member-book.pdf" -F "title=회원이 올린 책" -F "description=소개 문구" "$BASE/api/upload.php")"
expect "내가 등록한 책 목록" '회원이 올린 책' "$(curl -s -b "$USER" "$BASE/api/books.php?action=mine")"
expect "회원 책 소개 저장" '소개 문구' "$(curl -s -b "$USER" "$BASE/api/books.php?action=detail&id=2")"
expect "남의 책 수정 거부" '본인이 등록한 책만' "$(post_json "$USER" "$U" api/books.php '{"action":"update","id":1,"title":"x"}')"
expect "남의 책 삭제 거부" '본인이 등록한 책만' "$(post_json "$USER" "$U" api/delete.php '{"id":1}')"
expect "내 책 수정" '"ok":true' "$(post_json "$USER" "$U" api/books.php '{"action":"update","id":2,"title":"회원 책 (수정)","author":"회원"}')"
expect "회원의 표시 순서 변경 차단" '관리자만' "$(post_json "$USER" "$U" api/books.php '{"action":"reorder","order":[2,1]}')"
expect "내 책 삭제" '"ok":true' "$(post_json "$USER" "$U" api/delete.php '{"id":2}')"

# v1.1: 회원 책 등록 끄기
SETTINGS='{"action":"save","site_title":"Share Park","daily_download_limit":1,"reset_time":"00:00","max_file_size_mb":50,"max_image_size_mb":5,"days_ignore_agreement":7,"books_path":"","covers_path":"","agreement_text":"## 1. 테스트\n- 개인 용도","allow_member_upload":false}'
expect "회원 책 등록 끄기" '"allow_member_upload":false' "$(post_json "$ADMIN" "$T" api/settings.php "$SETTINGS")"
expect "등록 금지 시 회원 업로드 거부" '관리자만 책을 등록' "$(curl -s -b "$USER" -H "X-CSRF-Token: $U" -F "book=@$WORK/member-book.pdf" "$BASE/api/upload.php")"

if grep -qiE 'PHP (Fatal|Warning|Parse|Deprecated)' "$WORK/server.log"; then fail "PHP 경고/오류 발생"; fi
ok "PHP 경고 · 오류 없음"

echo "▶ 통과: ${PASS}개"
