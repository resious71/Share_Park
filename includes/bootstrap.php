<?php
/**
 * 공통 함수: 세션, JSON 저장소, 인증, 설정, 다운로드 제한, 동의서
 */
if (!defined('APP_ROOT')) {
    http_response_code(403);
    exit;
}

// ===========================================================================
// 세션
// ===========================================================================

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('SHAREPARKSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(?string $token = null): bool
{
    start_session();
    $token ??= $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    return !empty($_SESSION['csrf_token']) && is_string($token)
        && hash_equals($_SESSION['csrf_token'], $token);
}

// ===========================================================================
// JSON 저장소 (파일 잠금으로 동시 쓰기 보호)
// ===========================================================================

/** 비어 있어도 객체({})로 저장해야 하는 파일 */
const JSON_OBJECT_FILES = ['settings', 'user-custom-orders', 'agreement-skips'];

function data_path(string $name): string
{
    return DATA_DIR . '/' . $name . '.json';
}

function json_encode_pretty($data, string $name): string
{
    if ($data === [] && in_array($name, JSON_OBJECT_FILES, true)) {
        return "{}\n";
    }
    return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
}

function json_read(string $name, array $default = []): array
{
    $file = data_path($name);
    if (!is_file($file)) {
        return $default;
    }
    $fp = @fopen($file, 'rb');
    if (!$fp) {
        return $default;
    }
    flock($fp, LOCK_SH);
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : $default;
}

/**
 * 배타적 잠금 상태에서 읽기-수정-쓰기를 수행합니다.
 * $fn 은 데이터를 참조로 받아 수정하고, 반환값은 그대로 전달됩니다.
 * 주의: $fn 안에서 같은 파일을 json_read 하면 교착 상태가 될 수 있습니다.
 */
function json_update(string $name, callable $fn, array $default = [])
{
    $file = data_path($name);
    $fp = fopen($file, 'c+b');
    if (!$fp) {
        throw new RuntimeException('데이터 파일을 열 수 없습니다: ' . $name);
    }
    try {
        flock($fp, LOCK_EX);
        $raw = stream_get_contents($fp);
        $data = json_decode((string)$raw, true);
        if (!is_array($data)) {
            $data = $default;
        }
        $before = $data;
        $result = $fn($data);
        if ($data !== $before || trim((string)$raw) === '') {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode_pretty($data, $name));
            fflush($fp);
        }
        return $result;
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

function json_write(string $name, array $data): void
{
    json_update($name, function (&$d) use ($data) {
        $d = $data;
    });
}

function next_id(array $list): int
{
    $max = 0;
    foreach ($list as $item) {
        $max = max($max, (int)($item['id'] ?? 0));
    }
    return $max + 1;
}

// ===========================================================================
// 설정
// ===========================================================================

function get_settings(bool $refresh = false): array
{
    static $cache = null;
    if ($cache === null || $refresh) {
        $cache = array_merge(DEFAULT_SETTINGS, json_read('settings', []));
    }
    return $cache;
}

function setting(string $key)
{
    return get_settings()[$key] ?? (DEFAULT_SETTINGS[$key] ?? null);
}

function normalize_dir(string $dir): string
{
    return rtrim(str_replace('\\', '/', $dir), '/');
}

function books_dir(): string
{
    $p = trim((string)setting('books_path'));
    return normalize_dir($p !== '' ? $p : DEFAULT_BOOKS_DIR);
}

function covers_dir(): string
{
    $p = trim((string)setting('covers_path'));
    return normalize_dir($p !== '' ? $p : DEFAULT_COVERS_DIR);
}

// ===========================================================================
// 초기화: 필요한 폴더와 파일을 자동 생성
// ===========================================================================

function protect_dir(string $dir): void
{
    $ht = $dir . '/.htaccess';
    if (is_dir($dir) && !is_file($ht) && strpos(normalize_dir($dir), normalize_dir(APP_ROOT)) === 0) {
        @file_put_contents($ht, "# 직접 접근 차단\n<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Deny from all\n</IfModule>\n");
    }
}

function init_storage(): void
{
    foreach ([DATA_DIR, books_dir(), covers_dir()] as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        protect_dir($dir);
    }

    $files = [
        'users'               => [],
        'books'               => [],
        'downloads'           => [],
        'user-custom-orders'  => [],
        'download-agreements' => [],
        'agreement-skips'     => [],
    ];
    foreach ($files as $name => $default) {
        if (!is_file(data_path($name))) {
            @file_put_contents(data_path($name), json_encode_pretty($default, $name), LOCK_EX);
        }
    }

    // 설정 파일: 누락된 기본값 보충
    $stored = json_read('settings', []);
    if (!is_file(data_path('settings')) || array_diff_key(DEFAULT_SETTINGS, $stored)) {
        json_update('settings', function (&$s) {
            $s = array_merge(DEFAULT_SETTINGS, $s);
        });
        get_settings(true);
    }

    // 사용자가 없으면 기본 관리자 생성
    if (!json_read('users', [])) {
        json_update('users', function (&$users) {
            if (!$users) {
                $users[] = [
                    'id'         => 1,
                    'username'   => DEFAULT_ADMIN_USERNAME,
                    'password'   => password_hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_BCRYPT),
                    'is_admin'   => true,
                    'created_at' => now(),
                ];
            }
        });
    }
}

// ===========================================================================
// 유틸리티
// ===========================================================================

function now(): string
{
    return date('Y-m-d H:i:s');
}

function h($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

/** JSON 본문 또는 폼 데이터를 배열로 반환 */
function request_input(): array
{
    static $input = null;
    if ($input !== null) {
        return $input;
    }
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== false) {
        $decoded = json_decode((string)file_get_contents('php://input'), true);
        $input = is_array($decoded) ? $decoded : [];
    } else {
        $input = $_POST;
    }
    return $input;
}

function input_str(string $key, int $maxLen = 200): string
{
    $v = request_input()[$key] ?? '';
    if (!is_scalar($v)) {
        return '';
    }
    // 제어 문자 제거 후 길이 제한
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', trim((string)$v)) ?? '';
    return mb_substr($v, 0, $maxLen);
}

function input_int(string $key, int $default = 0): int
{
    $v = request_input()[$key] ?? $default;
    return is_numeric($v) ? (int)$v : $default;
}

function input_bool(string $key): bool
{
    $v = request_input()[$key] ?? false;
    return $v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on';
}

function json_response(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $code = 400, array $extra = []): void
{
    json_response(array_merge(['ok' => false, 'error' => $message], $extra), $code);
}

function json_ok(array $data = []): void
{
    json_response(array_merge(['ok' => true], $data));
}

function format_bytes(int $bytes): string
{
    $units = ['B', 'KB', 'MB', 'GB'];
    $i = 0;
    $size = (float)$bytes;
    while ($size >= 1024 && $i < count($units) - 1) {
        $size /= 1024;
        $i++;
    }
    return ($i === 0 ? (string)$bytes : number_format($size, 1)) . ' ' . $units[$i];
}

/** 업로드된 원본 파일명을 안전하게 정리 (경로 조작 방지) */
function safe_filename(string $name): string
{
    $name = str_replace('\\', '/', $name);
    $name = basename($name);
    $name = preg_replace('/[\x00-\x1F\x7F<>:"\/\\\\|?*]/u', '', $name) ?? '';
    $name = trim($name, " .\t");
    if (mb_strlen($name) > 150) {
        $ext = pathinfo($name, PATHINFO_EXTENSION);
        $name = mb_substr(pathinfo($name, PATHINFO_FILENAME), 0, 140) . ($ext !== '' ? '.' . $ext : '');
    }
    return $name;
}

/** 저장 폴더 안의 파일 경로 (경로 조작 방지) */
function path_in(string $dir, string $file): ?string
{
    $file = basename(str_replace('\\', '/', $file));
    if ($file === '' || $file === '.' || $file === '..') {
        return null;
    }
    return $dir . '/' . $file;
}

// ===========================================================================
// 사용자 & 인증
// ===========================================================================

function find_user(int $id): ?array
{
    foreach (json_read('users') as $u) {
        if ((int)$u['id'] === $id) {
            return $u;
        }
    }
    return null;
}

function find_user_by_name(string $username): ?array
{
    foreach (json_read('users') as $u) {
        if (mb_strtolower($u['username']) === mb_strtolower($username)) {
            return $u;
        }
    }
    return null;
}

function public_user(array $u): array
{
    return [
        'id'         => (int)$u['id'],
        'username'   => $u['username'],
        'is_admin'   => !empty($u['is_admin']),
        'created_at' => $u['created_at'] ?? '',
    ];
}

function current_user(): ?array
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $user = find_user((int)$_SESSION['user_id']);
    if (!$user) {
        // 삭제된 계정의 세션은 종료
        $_SESSION = [];
        return null;
    }
    return $user;
}

function is_admin(?array $user): bool
{
    return $user !== null && !empty($user['is_admin']);
}

function require_login_page(): array
{
    $user = current_user();
    if (!$user) {
        header('Location: index.php');
        exit;
    }
    return $user;
}

function require_admin_page(): array
{
    $user = require_login_page();
    if (!is_admin($user)) {
        header('Location: dashboard.php');
        exit;
    }
    return $user;
}

function require_login_api(): array
{
    $user = current_user();
    if (!$user) {
        json_error('로그인이 필요합니다. 다시 로그인해 주세요.', 401);
    }
    return $user;
}

function require_admin_api(): array
{
    $user = require_login_api();
    if (!is_admin($user)) {
        json_error('관리자만 사용할 수 있는 기능입니다.', 403);
    }
    return $user;
}

function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_error('잘못된 요청 방식입니다.', 405);
    }
    if (!verify_csrf()) {
        json_error('보안 토큰이 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.', 419);
    }
}

// ===========================================================================
// 도서
// ===========================================================================

function find_book(int $id): ?array
{
    foreach (json_read('books') as $b) {
        if ((int)$b['id'] === $id) {
            return $b;
        }
    }
    return null;
}

/** 관리자가 지정한 전체 표시 순서 */
function books_in_global_order(?array $books = null): array
{
    $books ??= json_read('books');
    usort($books, fn($a, $b) => [(int)($a['order'] ?? 0), (int)$a['id']] <=> [(int)($b['order'] ?? 0), (int)$b['id']]);
    return $books;
}

/** 사용자 커스텀 순서 (저장된 순서 + 이후 추가된 책은 전체 순서대로 뒤에) */
function books_for_user(int $userId): array
{
    $books = books_in_global_order();
    $orders = json_read('user-custom-orders');
    $custom = $orders[(string)$userId] ?? null;
    if (!is_array($custom) || !$custom) {
        return $books;
    }
    $byId = [];
    foreach ($books as $b) {
        $byId[(int)$b['id']] = $b;
    }
    $result = [];
    foreach ($custom as $id) {
        if (isset($byId[(int)$id])) {
            $result[] = $byId[(int)$id];
            unset($byId[(int)$id]);
        }
    }
    foreach ($byId as $b) {
        $result[] = $b;
    }
    return $result;
}

function user_has_custom_order(int $userId): bool
{
    $orders = json_read('user-custom-orders');
    return !empty($orders[(string)$userId]);
}

function cover_url(array $book): string
{
    $v = substr(md5(($book['cover'] ?? '') . ($book['updated_at'] ?? $book['created_at'] ?? '')), 0, 8);
    return 'api/cover.php?id=' . (int)$book['id'] . '&v=' . $v;
}

/**
 * 책별 다운로드 수, 인기 순위, 사용자 이름 (요청당 한 번 계산)
 * @return array{counts: array<int,int>, ranks: array<int,int>, names: array<int,string>}
 */
function book_stats(bool $refresh = false): array
{
    static $cache = null;
    if ($cache !== null && !$refresh) {
        return $cache;
    }
    $counts = [];
    foreach (json_read('downloads') as $d) {
        $counts[(int)$d['book_id']] = ($counts[(int)$d['book_id']] ?? 0) + 1;
    }
    $existing = array_map(fn($b) => (int)$b['id'], json_read('books'));
    $popular = array_filter($counts, fn($n, $id) => $n > 0 && in_array($id, $existing, true), ARRAY_FILTER_USE_BOTH);
    // 다운로드 수가 같으면 먼저 등록된 책이 앞 순위
    uksort($popular, fn($a, $b) => [$popular[$b], $a] <=> [$popular[$a], $b]);
    $ranks = [];
    foreach (array_slice(array_keys($popular), 0, POPULAR_BOOK_COUNT) as $i => $id) {
        $ranks[$id] = $i + 1;
    }
    $names = [];
    foreach (json_read('users') as $u) {
        $names[(int)$u['id']] = $u['username'];
    }
    return $cache = ['counts' => $counts, 'ranks' => $ranks, 'names' => $names];
}

/** 등록자 ID (이전 버전에서 등록된 책은 관리자 등록으로 간주) */
function book_owner_id(array $b): int
{
    return (int)($b['owner_id'] ?? 0);
}

function public_book(array $b): array
{
    $stats = book_stats();
    $id = (int)$b['id'];
    $owner = book_owner_id($b);
    return [
        'id'             => $id,
        'title'          => $b['title'],
        'author'         => $b['author'],
        'description'    => (string)($b['description'] ?? ''),
        'format'         => $b['format'],
        'filesize'       => (int)$b['filesize'],
        'filesize_h'     => format_bytes((int)$b['filesize']),
        'created_at'     => $b['created_at'],
        'cover_url'      => cover_url($b),
        'owner_id'       => $owner,
        'owner_name'     => $owner ? ($stats['names'][$owner] ?? '탈퇴한 회원') : '관리자',
        'download_count' => $stats['counts'][$id] ?? 0,
        'popular_rank'   => $stats['ranks'][$id] ?? null,
    ];
}

/** 책을 수정·삭제할 수 있는지 (관리자 또는 등록한 회원) */
function can_manage_book(array $user, array $book): bool
{
    return is_admin($user) || (book_owner_id($book) !== 0 && book_owner_id($book) === (int)$user['id']);
}

/** 회원이 책을 등록할 수 있는지 */
function can_upload_books(array $user): bool
{
    return is_admin($user) || !empty(setting('allow_member_upload'));
}

// ===========================================================================
// 다운로드 제한
// ===========================================================================

/** 현재 제한 주기의 시작 시각 (설정된 초기화 시간 기준) */
function period_start(?int $now = null): int
{
    $now ??= time();
    [$h, $m] = array_map('intval', explode(':', (string)setting('reset_time')) + [0, 0]);
    $start = mktime($h, $m, 0, (int)date('n', $now), (int)date('j', $now), (int)date('Y', $now));
    if ($now < $start) {
        $start = strtotime('-1 day', $start);
    }
    return $start;
}

/**
 * 현재 주기에 사용한 다운로드 수
 * $downloads 를 넘기면 해당 목록으로 계산합니다 (잠금 중 재사용).
 */
function downloads_used(array $user, ?array $downloads = null): int
{
    $downloads ??= json_read('downloads');
    $since = period_start();
    // 관리자 초기화: 초기화 시점의 마지막 다운로드 ID 이후 기록만 계산
    // (시각은 초 단위라 같은 초에 기록된 다운로드를 구분할 수 없음)
    $afterId = isset($user['limit_reset_download_id']) ? (int)$user['limit_reset_download_id'] : null;
    if ($afterId === null && !empty($user['limit_reset_at'])) {
        $since = max($since, (int)strtotime($user['limit_reset_at']));
    }
    $count = 0;
    foreach ($downloads as $d) {
        if ((int)$d['user_id'] === (int)$user['id'] && strtotime($d['downloaded_at']) >= $since
            && ($afterId === null || (int)$d['id'] > $afterId)) {
            $count++;
        }
    }
    return $count;
}

function download_limit_info(array $user, ?array $downloads = null): array
{
    $limit = (int)setting('daily_download_limit');
    $admin = is_admin($user);
    $used = downloads_used($user, $downloads);
    $unlimited = $admin || $limit <= 0;
    return [
        'limit'        => $unlimited ? 0 : $limit,
        'used'         => $used,
        'remaining'    => $unlimited ? null : max(0, $limit - $used),
        'unlimited'    => $unlimited,
        'is_admin'     => $admin,
        'can_download' => $unlimited || $used < $limit,
        'next_reset'   => date('Y-m-d H:i', strtotime('+1 day', period_start())),
    ];
}

// ===========================================================================
// 동의서
// ===========================================================================

/** "다시 보지 않기"가 유효하면 만료 시각을, 아니면 null 을 반환 */
function agreement_skip_until(int $userId): ?string
{
    if ((int)setting('days_ignore_agreement') <= 0) {
        return null;
    }
    $skips = json_read('agreement-skips');
    $s = $skips[(string)$userId] ?? null;
    if (!is_array($s) || empty($s['expires_at'])) {
        return null;
    }
    if (($s['version'] ?? '') !== (string)setting('agreement_version')) {
        return null; // 동의서가 개정되면 다시 표시
    }
    return strtotime($s['expires_at']) > time() ? $s['expires_at'] : null;
}

/** 동의서 텍스트(## 제목, - 항목, **굵게**)를 안전한 HTML 로 변환 */
function render_agreement_html(string $text): string
{
    $inline = function (string $s): string {
        $s = h($s);
        return preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s) ?? $s;
    };
    $html = '';
    $inList = false;
    $sectionOpen = false;
    foreach (preg_split('/\R/u', $text) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        if (str_starts_with($line, '- ')) {
            if (!$inList) {
                $html .= '<ul>';
                $inList = true;
            }
            $html .= '<li>' . $inline(substr($line, 2)) . '</li>';
            continue;
        }
        if ($inList) {
            $html .= '</ul>';
            $inList = false;
        }
        if (str_starts_with($line, '## ')) {
            if ($sectionOpen) {
                $html .= '</section><hr>';
            }
            $html .= '<section class="agreement-section"><h4>' . $inline(substr($line, 3)) . '</h4>';
            $sectionOpen = true;
        } else {
            $html .= '<p>' . $inline($line) . '</p>';
        }
    }
    if ($inList) {
        $html .= '</ul>';
    }
    if ($sectionOpen) {
        $html .= '</section>';
    }
    return $html;
}

// 모든 요청에서 저장소 준비
init_storage();
