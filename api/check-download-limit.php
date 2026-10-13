<?php
/** 다운로드 제한 확인 */
require_once __DIR__ . '/../config.php';

$user = require_login_api();
json_ok(['limit' => download_limit_info($user)]);
