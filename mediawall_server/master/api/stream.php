<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

mw_require_auth();

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    http_response_code(400);
    exit;
}

$private = mw_private_index();
$path = $private['trackIndex'][$id]['path'] ?? null;
if (!is_string($path) || $path === '') {
    http_response_code(404);
    exit;
}

mw_stream_file($path, mw_mime_for_path($path));
