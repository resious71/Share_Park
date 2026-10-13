# 변경 이력

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### 추가
- 오픈소스 저장소 구성: README(배지 · 스크린샷), 영문 README, 기여 가이드, 행동 강령, 보안 정책, 이슈 · PR 템플릿
- GitHub Actions CI: PHP 8.1 · 8.2 · 8.3 문법 검사, JavaScript 문법 검사, 스모크 테스트

## [1.0.1] - 2026-10-13

### 변경
- 도서 카드 크기를 줄여 데스크톱에서 한 줄에 6개 표시 (모바일 2 · 520px+ 3 · 760px+ 4 · 1080px+ 6)

### 수정
- 드래그 중 카드가 이동하면 포인터 캡처가 풀려 정렬이 멈추던 문제
- 닫히는 중인 모달이 클릭을 가로채던 문제

## [1.0.0] - 2026-10-13

### 추가
- ID/PW 로그인 (PHP 세션 + bcrypt), 관리자 · 일반 사용자 권한
- 타일형 도서 목록, 검색, 정렬, 드래그 앤 드롭 개인 순서 저장
- 개인용도 동의서 모달, 서버 검증 1회용 다운로드 토큰, 동의 기록, "다시 보지 않기"
- 하루 다운로드 제한과 초기화 시각 설정, 남은 횟수 배너
- 마이페이지 (프로필, 비밀번호 변경, 다운로드 히스토리)
- 관리자: 계정 · 도서 · 설정 · 다운로드 관리, 통계, 가이드 · FAQ · 도움말 팝업 · 둘러보기
- PDF/EPUB 표지 하이브리드 추출
- JSON 파일 저장소와 자동 초기화

[Unreleased]: https://github.com/resious71/Share_Park/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/resious71/Share_Park/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/resious71/Share_Park/releases/tag/v1.0.0
