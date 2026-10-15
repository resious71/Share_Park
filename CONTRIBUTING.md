# 기여 가이드

Share Park에 관심을 가져 주셔서 감사합니다! 🎉
버그 제보, 기능 제안, 문서 개선, 코드 기여 모두 환영합니다.

## 시작하기 전에

- 모든 참여자는 [행동 강령](CODE_OF_CONDUCT.md)을 지켜 주세요.
- 보안 취약점은 공개 이슈로 올리지 말고 [SECURITY.md](SECURITY.md)의 방법을 따라 주세요.
- 큰 변경은 먼저 [이슈](https://github.com/resious71/Share_Park/issues)로 방향을 이야기한 뒤 시작하면 좋습니다.

## 개발 환경

```bash
git clone https://github.com/<your-id>/Share_Park.git
cd Share_Park
php -S localhost:8000 -d upload_max_filesize=64M -d post_max_size=70M
```

- PHP 8.1 이상만 있으면 됩니다. Composer, npm, 빌드 도구가 필요 없습니다.
- `data/`, `uploads/`, `covers/` 의 런타임 파일은 git에 올라가지 않습니다.
- 처음 접속하면 `admin / admin` 계정이 만들어집니다.

## 커밋 전 확인

```bash
# PHP 문법 검사
find . -name "*.php" -not -path "./.git/*" -print0 | xargs -0 -n1 php -l

# JavaScript 문법 검사 (Node.js 가 있다면)
for f in js/*.js; do node --check "$f"; done

# 스모크 테스트 (서버를 띄워 로그인 · API 동작 확인)
bash tests/smoke.sh
```

CI(GitHub Actions)에서도 같은 검사를 PHP 8.1 · 8.2 · 8.3 으로 실행합니다.

## 코드 스타일

- **PHP**: 순수 PHP, 4칸 들여쓰기, PSR-12 에 가까운 스타일. 사용자 입력은 `input_str()` 등으로 받고 출력은 `h()` 로 이스케이프합니다.
- **JSON 저장**: 쓰기는 반드시 `json_update()` 로 잠금 안에서 처리합니다.
- **API**: 상태를 바꾸는 요청은 `require_post()` (POST + CSRF) 를 거치고, 결과는 `json_ok()` / `json_error()` 로 반환합니다.
- **JavaScript**: 프레임워크 없는 ES2020, 2칸 들여쓰기, 화면에 넣는 값은 `SP.escapeHtml()` 로 이스케이프합니다.
- **CSS**: `css/style.css` 의 `:root` 색상 변수(파스텔 팔레트)를 사용합니다.
- **문구**: 사용자에게 보이는 메시지는 한국어로, 해결 방법을 알 수 있게 작성합니다.

## 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/ko/) 형식을 권장합니다.

```
feat: 책 카테고리 필터 추가
fix: 다운로드 제한 초기화 시각 계산 오류 수정
docs: 설치 가이드에 Nginx 설정 추가
style: 도서 카드 간격 조정
refactor: 표지 추출 함수 분리
```

## Pull Request

1. `main` 에서 브랜치를 만듭니다. (`feat/…`, `fix/…`, `docs/…`)
2. 변경은 작고 하나의 목적에 집중하게 유지합니다.
3. 화면이 바뀌면 스크린샷을 PR에 첨부해 주세요.
4. 사용자에게 보이는 변경은 [CHANGELOG.md](CHANGELOG.md)의 `Unreleased` 에 적어 주세요.
5. PR 템플릿의 체크리스트를 채워 주세요.

## 릴리스 만들기 (관리자)

1. `CHANGELOG.md` 에 새 버전 섹션(`## [X.Y.Z] - 날짜`)을 쓰고 `config.php` 의 `APP_VERSION` 을 올려 `main` 에 합칩니다.
2. 필요하면 `docs/releases/vX.Y.Z.md` 에 릴리스 노트를 따로 씁니다. 없으면 CHANGELOG 의 해당 버전 내용이 그대로 쓰입니다.
3. GitHub **Actions → Release → Run workflow** 에서 버전(예: `1.5.0`)을 입력하고 실행합니다.
   워크플로우가 `vX.Y.Z` 태그를 만들고 GitHub 릴리스를 등록합니다.

감사합니다! 💜
