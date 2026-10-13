<?php
/**
 * 도서 관리 (관리자)
 *  GET                 목록
 *  POST action=update  제목/저자 수정 (+ 선택: 표지 교체 cover)
 *  POST action=reorder 전체 표시 순서 저장 (order: [id...])
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/extract-cover.php';

require_admin_api();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $counts = [];
    foreach (json_read('downloads') as $d) {
        $counts[(int)$d['book_id']] = ($counts[(int)$d['book_id']] ?? 0) + 1;
    }
    $list = array_map(function ($b) use ($counts) {
        return public_book($b) + [
            'filename'       => $b['filename'],
            'cover_source'   => $b['cover_source'] ?? '',
            'download_count' => $counts[(int)$b['id']] ?? 0,
            'file_exists'    => is_file((string)path_in(books_dir(), $b['stored_name'] ?? $b['filename'])),
        ];
    }, books_in_global_order());
    json_ok(['books' => $list]);
}

require_post();
$action = input_str('action', 20);

if ($action === 'update') {
    $id = input_int('id');
    $title = input_str('title', 200);
    $author = input_str('author', 100);
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

    $book = json_update('books', function (&$books) use ($id, $title, $author, $coverBytes) {
        foreach ($books as &$b) {
            if ((int)$b['id'] === $id) {
                $b['title'] = $title;
                $b['author'] = $author;
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
