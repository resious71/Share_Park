<?php
/**
 * 사용자 관리 (관리자)
 *  GET  action=list                     사용자 목록 + 오늘 사용량
 *  GET  action=history&user_id=         사용자 다운로드 히스토리
 *  POST action=create                   username, password, is_admin
 *  POST action=password                 id, password
 *  POST action=delete                   id
 *  POST action=reset_limit              id
 *  POST action=reset_all
 */
require_once __DIR__ . '/../config.php';

$admin = require_admin_api();

function user_row(array $u, array $downloads): array
{
    $total = 0;
    foreach ($downloads as $d) {
        if ((int)$d['user_id'] === (int)$u['id']) {
            $total++;
        }
    }
    return public_user($u) + ['usage' => download_limit_info($u, $downloads), 'total_downloads' => $total];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $action = (string)($_GET['action'] ?? 'list');
    $downloads = json_read('downloads');

    if ($action === 'history') {
        $user = find_user((int)($_GET['user_id'] ?? 0));
        if (!$user) {
            json_error('사용자를 찾을 수 없습니다.', 404);
        }
        $list = array_values(array_filter($downloads, fn($d) => (int)$d['user_id'] === (int)$user['id']));
        usort($list, fn($a, $b) => strcmp($b['downloaded_at'], $a['downloaded_at']) ?: $b['id'] <=> $a['id']);
        $agreements = array_values(array_filter(json_read('download-agreements'), fn($a) => (int)$a['user_id'] === (int)$user['id']));
        usort($agreements, fn($a, $b) => $b['id'] <=> $a['id']);
        json_ok([
            'user'       => user_row($user, $downloads),
            'downloads'  => $list,
            'agreements' => array_slice($agreements, 0, 100),
            'skip_until' => agreement_skip_until((int)$user['id']),
        ]);
    }

    $users = json_read('users');
    json_ok(['users' => array_map(fn($u) => user_row($u, $downloads), $users)]);
}

require_post();
$action = input_str('action', 20);

switch ($action) {
    case 'create':
        $username = input_str('username', 50);
        $password = (string)(request_input()['password'] ?? '');
        $isAdmin = input_bool('is_admin');
        if (!preg_match('/^[\p{L}\p{N}_.\-]{2,30}$/u', $username)) {
            json_error('아이디는 2~30자의 한글, 영문, 숫자, 밑줄(_), 점(.), 하이픈(-)만 사용할 수 있습니다.');
        }
        if ($password === '') {
            json_error('비밀번호를 입력해 주세요.');
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $created = json_update('users', function (&$users) use ($username, $hash, $isAdmin) {
            foreach ($users as $u) {
                if (mb_strtolower($u['username']) === mb_strtolower($username)) {
                    return null;
                }
            }
            $u = ['id' => next_id($users), 'username' => $username, 'password' => $hash, 'is_admin' => $isAdmin, 'created_at' => now()];
            $users[] = $u;
            return $u;
        });
        if (!$created) {
            json_error("'{$username}' 아이디는 이미 사용 중입니다. 다른 아이디를 입력해 주세요.", 409);
        }
        json_ok(['message' => "'{$username}' 계정을 추가했습니다.", 'user' => public_user($created)]);

    case 'password':
        $id = input_int('id');
        $password = (string)(request_input()['password'] ?? '');
        if ($password === '') {
            json_error('새 비밀번호를 입력해 주세요.');
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $found = json_update('users', function (&$users) use ($id, $hash) {
            foreach ($users as &$u) {
                if ((int)$u['id'] === $id) {
                    $u['password'] = $hash;
                    return $u['username'];
                }
            }
            return null;
        });
        if (!$found) {
            json_error('사용자를 찾을 수 없습니다.', 404);
        }
        json_ok(['message' => "'{$found}' 계정의 비밀번호를 변경했습니다."]);

    case 'delete':
        $id = input_int('id');
        if ($id === (int)$admin['id']) {
            json_error('현재 로그인한 본인 계정은 삭제할 수 없습니다.');
        }
        $result = json_update('users', function (&$users) use ($id) {
            $admins = count(array_filter($users, fn($u) => !empty($u['is_admin'])));
            foreach ($users as $i => $u) {
                if ((int)$u['id'] === $id) {
                    if (!empty($u['is_admin']) && $admins <= 1) {
                        return 'last_admin';
                    }
                    array_splice($users, $i, 1);
                    return $u;
                }
            }
            return null;
        });
        if ($result === 'last_admin') {
            json_error('마지막 관리자 계정은 삭제할 수 없습니다.');
        }
        if (!$result) {
            json_error('사용자를 찾을 수 없습니다.', 404);
        }
        // 다운로드/동의 기록은 법적 대비를 위해 보관하고, 개인 설정만 정리
        foreach (['user-custom-orders', 'agreement-skips'] as $file) {
            json_update($file, function (&$data) use ($id) {
                unset($data[(string)$id]);
            });
        }
        json_ok(['message' => "'{$result['username']}' 계정을 삭제했습니다. (다운로드·동의 기록은 보관됩니다)"]);

    case 'reset_limit':
    case 'reset_all':
        $id = input_int('id');
        $all = $action === 'reset_all';
        $lastDownloadId = next_id(json_read('downloads')) - 1;
        $count = json_update('users', function (&$users) use ($id, $all, $lastDownloadId) {
            $n = 0;
            foreach ($users as &$u) {
                if ($all || (int)$u['id'] === $id) {
                    $u['limit_reset_at'] = now();
                    $u['limit_reset_download_id'] = $lastDownloadId;
                    $n++;
                }
            }
            return $n;
        });
        if (!$count) {
            json_error('사용자를 찾을 수 없습니다.', 404);
        }
        json_ok(['message' => $all ? "모든 사용자({$count}명)의 다운로드 제한을 초기화했습니다." : '다운로드 제한을 초기화했습니다.']);
}

json_error('알 수 없는 요청입니다.');
