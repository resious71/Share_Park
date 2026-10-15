<?php
/**
 * 도서 API
 *  GET  action=list                 전체 목록 (관리자)
 *  GET  action=mine                 내가 등록한 책
 *  GET  action=detail&id=           책 상세 정보 (로그인 사용자)
 *  GET  action=downloaders&id=      책을 다운로드한 사용자 목록 (관리자)
 *  POST action=update               제목/저자/소개 수정 (+ 선택: 표지 교체 cover) - 관리자 또는 등록한 회원
 *  POST action=reorder              전체 표시 순서 저장 (order: [id...]) - 관리자
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/extract-cover.php';

$user = require_login_api();

/** 관리 화면용 책 정보 */
function managed_book(array $b): array
{
    return public_book($b) + [
        'filename'     => $b['filename'],
        'cover_source' => $b['cover_source'] ?? '',
        'file_exists'  => is_file((string)path_in(books_dir(), $b['stored_name'] ?? $b['filename'])),
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $action = (string)($_GET['action'] ?? 'list');

    if ($action === 'detail') {
        $book = find_book((int)($_GET['id'] ?? 0));
        if (!$book) {
            json_error('책을 찾을 수 없습니다. 삭제되었을 수 있습니다.', 404);
        }
        $mine = array_values(array_filter(json_read('downloads'),
            fn($d) => (int)$d['book_id'] === (int)$book['id'] && (int)$d['user_id'] === (int)$user['id']));
        $last = $mine ? max(array_column($mine, 'downloaded_at')) : null;
        json_ok([
            'book'       => public_book($book) + ['updated_at' => $book['updated_at'] ?? null],
            'can_manage' => can_manage_book($user, $book),
            'my_downloads' => count($mine),
            'my_last_download' => $last,
            'limit'      => download_limit_info($user),
        ]);
    }

    if ($action === 'mine') {
        $list = array_values(array_filter(books_in_global_order(), fn($b) => book_owner_id($b) === (int)$user['id']));
        usort($list, fn($a, $b) => strcmp($b['created_at'], $a['created_at']) ?: $b['id'] <=> $a['id']);
        json_ok([
            'books'      => array_map('managed_book', $list),
            'can_upload' => can_upload_books($user),
        ]);
    }

    if (!is_admin($user)) {
        json_error('관리자만 사용할 수 있는 기능입니다.', 403);
    }

    if ($action === 'downloaders') {
        $book = find_book((int)($_GET['id'] ?? 0));
        if (!$book) {
            json_error('책을 찾을 수 없습니다.', 404);
        }
        $names = book_stats()['names'];
        $rows = [];
        $byUser = [];
        foreach (json_read('downloads') as $d) {
            if ((int)$d['book_id'] !== (int)$book['id']) {
                continue;
            }
            $uid = (int)$d['user_id'];
            $name = $names[$uid] ?? (($d['username'] ?? '알 수 없음') . ' (삭제됨)');
            $rows[] = ['user_id' => $uid, 'username' => $name, 'downloaded_at' => $d['downloaded_at']];
            $byUser[$uid] ??= ['user_id' => $uid, 'username' => $name, 'count' => 0, 'last' => ''];
            $byUser[$uid]['count']++;
            $byUser[$uid]['last'] = max($byUser[$uid]['last'], $d['downloaded_at']);
        }
        usort($rows, fn($a, $b) => strcmp($b['downloaded_at'], $a['downloaded_at']));
        $users = array_values($byUser);
        usort($users, fn($a, $b) => [$b['count'], $b['last']] <=> [$a['count'], $a['last']]);
        json_ok([
            'book'      => public_book($book),
            'users'     => $users,
            'downloads' => $rows,
        ]);
    }

    json_ok(['books' => array_map('managed_book', books_in_global_order())]);
}

require_post();
$action = input_str('action', 20);

if ($action === 'update') {
    $id = input_int('id');
    $current = find_book($id);
    if (!$current) {
        json_error('책을 찾을 수 없습니다.', 404);
    }
    if (!can_manage_book($user, $current)) {
        json_error('본인이 등록한 책만 수정할 수 있습니다.', 403);
    }
    $title = input_str('title', 200);
    $author = input_str('author', 100);
    $description = input_str('description', BOOK_DESCRIPTION_MAX);
    if ($title === '') {
        json_error('제목을 입력해 주세요.');
    }
    if ($author === '') {
        $author = '작자 미상';
    }

    $coverBytes = null;
    $f = $_FILES['cover'] ?? null;
    if ($f && $f['error'] !== UPLOAD_ERR_NO_FILE) {
        $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        if ($f['error'] !== UPLOAD_ERR_OK || !in_array($ext, ALLOWED_IMAGE_EXT, true)) {
            json_error('표지 이미지는 JPG, PNG, WebP 형식만 업로드할 수 있습니다.');
        }
        if ($f['size'] > (int)setting('max_image_size')) {
            json_error('표지 이미지는 최대 ' . format_bytes((int)setting('max_image_size')) . '까지 업로드할 수 있습니다.');
        }
        $coverBytes = (string)file_get_contents($f['tmp_name']);
        if (!validate_image_bytes($coverBytes)) {
            json_error('표지 이미지 파일이 올바르지 않습니다.');
        }
    }

    $book = json_update('books', function (&$books) use ($id, $title, $author, $description, $coverBytes) {
        foreach ($books as &$b) {
            if ((int)$b['id'] === $id) {
                $b['title'] = $title;
                $b['author'] = $author;
                $b['description'] = $description;
                if ($coverBytes !== null && ($name = save_cover_bytes($coverBytes, $id))) {
                    $b['cover'] = $name;
                    $b['cover_source'] = 'manual';
                }
                $b['updated_at'] = now();
                return $b;
            }
        }
        return null;
    });
    if (!$book) {
        json_error('책을 찾을 수 없습니다.', 404);
    }
    json_ok(['message' => '책 정보를 수정했습니다.', 'book' => public_book($book)]);
}

if ($action === 'reorder') {
    if (!is_admin($user)) {
        json_error('관리자만 사용할 수 있는 기능입니다.', 403);
    }
    $order = request_input()['order'] ?? null;
    if (!is_array($order)) {
        json_error('저장할 순서 정보가 없습니다.');
    }
    $pos = [];
    foreach (array_values($order) as $i => $id) {
        $pos[(int)$id] ??= $i;
    }
    json_update('books', function (&$books) use ($pos) {
        $n = count($pos);
        foreach ($books as &$b) {
            $b['order'] = $pos[(int)$b['id']] ?? $n++;
        }
    });
    json_ok(['message' => '기본 표시 순서를 저장했습니다.']);
}

json_error('알 수 없는 요청입니다.');
