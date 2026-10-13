<?php
/**
 * 시스템 설정 (관리자)
 *  GET                      현재 설정
 *  POST action=save         설정 저장
 *  POST action=reset_skips  모든 "다시 보지 않기" 초기화
 *  POST action=reset_agreement  동의서 기본 문구로 복원
 */
require_once __DIR__ . '/../config.php';

require_admin_api();

function settings_payload(): array
{
    $s = get_settings(true);
    return [
        'settings' => [
            'site_title'            => $s['site_title'],
            'daily_download_limit'  => (int)$s['daily_download_limit'],
            'reset_time'            => $s['reset_time'],
            'max_file_size_mb'      => round($s['max_file_size'] / 1048576, 1),
            'max_image_size_mb'     => round($s['max_image_size'] / 1048576, 1),
            'days_ignore_agreement' => (int)$s['days_ignore_agreement'],
            'books_path'            => $s['books_path'],
            'covers_path'           => $s['covers_path'],
            'agreement_text'        => $s['agreement_text'],
            'agreement_version'     => $s['agreement_version'],
        ],
        'effective' => [
            'books_dir'           => books_dir(),
            'covers_dir'          => covers_dir(),
            'books_writable'      => is_writable(books_dir()),
            'covers_writable'     => is_writable(covers_dir()),
            'default_books_dir'   => DEFAULT_BOOKS_DIR,
            'default_covers_dir'  => DEFAULT_COVERS_DIR,
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size'       => ini_get('post_max_size'),
        ],
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_ok(settings_payload());
}

require_post();
$action = input_str('action', 30);

if ($action === 'reset_skips') {
    json_write('agreement-skips', []);
    json_ok(['message' => "모든 사용자의 '다시 보지 않기' 설정을 초기화했습니다."]);
}

if ($action !== 'save' && $action !== 'reset_agreement') {
    json_error('알 수 없는 요청입니다.');
}

$current = get_settings(true);
$new = $current;

if ($action === 'reset_agreement') {
    $new['agreement_text'] = DEFAULT_AGREEMENT_TEXT;
} else {
    $title = input_str('site_title', 100);
    if ($title === '') {
        json_error('사이트 제목을 입력해 주세요.');
    }
    $limit = input_int('daily_download_limit', -1);
    if ($limit < 0 || $limit > 1000) {
        json_error('하루 다운로드 제한은 0~1000 사이의 숫자로 입력해 주세요. (0 = 무제한)');
    }
    $reset = input_str('reset_time', 5);
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $reset)) {
        json_error('초기화 시간은 HH:MM 형식(예: 00:00)으로 입력해 주세요.');
    }
    $fileMb = (float)(request_input()['max_file_size_mb'] ?? 0);
    $imgMb = (float)(request_input()['max_image_size_mb'] ?? 0);
    if ($fileMb <= 0 || $fileMb > 2048) {
        json_error('최대 파일 크기는 0보다 크고 2048MB 이하로 입력해 주세요.');
    }
    if ($imgMb <= 0 || $imgMb > 100) {
        json_error('최대 이미지 크기는 0보다 크고 100MB 이하로 입력해 주세요.');
    }
    $days = input_int('days_ignore_agreement', -1);
    if ($days < 0 || $days > 365) {
        json_error("'다시 보지 않기' 기간은 0~365일 사이로 입력해 주세요. (0 = 사용 안 함)");
    }

    foreach (['books_path' => '책 저장 경로', 'covers_path' => '표지 저장 경로'] as $key => $label) {
        $p = normalize_dir(input_str($key, 500));
        if ($p !== '') {
            if (str_contains($p, "\0") || preg_match('#(^|/)\.\.(/|$)#', $p)) {
                json_error("{$label}에 '..' 은 사용할 수 없습니다.");
            }
            if (!preg_match('#^(/|[A-Za-z]:/)#', $p)) {
                json_error("{$label}는 절대 경로로 입력해 주세요. (예: C:/ebook-files/books 또는 /var/ebook/books)");
            }
            if (!is_dir($p) && !@mkdir($p, 0775, true)) {
                json_error("{$label} 폴더를 만들 수 없습니다: {$p}");
            }
            if (!is_writable($p)) {
                json_error("{$label} 폴더에 쓰기 권한이 없습니다: {$p}");
            }
        }
        $new[$key] = $p;
    }

    $agreement = (string)(request_input()['agreement_text'] ?? $current['agreement_text']);
    $agreement = trim(str_replace("\r\n", "\n", mb_substr($agreement, 0, 10000)));
    if ($agreement === '') {
        json_error('동의서 내용을 비워둘 수 없습니다.');
    }

    $new['site_title'] = $title;
    $new['daily_download_limit'] = $limit;
    $new['reset_time'] = $reset;
    $new['max_file_size'] = (int)round($fileMb * 1048576);
    $new['max_image_size'] = (int)round($imgMb * 1048576);
    $new['days_ignore_agreement'] = $days;
    $new['agreement_text'] = $agreement;
}

// 동의서가 바뀌면 버전을 올려 모든 사용자에게 다시 동의를 받음
$versionBumped = false;
if (trim($new['agreement_text']) !== trim($current['agreement_text'])) {
    [$major, $minor] = array_map('intval', explode('.', $current['agreement_version'] . '.0'));
    $new['agreement_version'] = $major . '.' . ($minor + 1);
    $versionBumped = true;
}

json_update('settings', function (&$s) use ($new) {
    $s = $new;
});
get_settings(true);
init_storage();

$msg = $action === 'reset_agreement' ? '동의서를 기본 문구로 복원했습니다.' : '설정을 저장했습니다. 즉시 적용됩니다.';
if ($versionBumped) {
    $msg .= " (동의서 버전 {$new['agreement_version']})";
}
json_ok(['message' => $msg] + settings_payload());
