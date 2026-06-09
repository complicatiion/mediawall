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
$thumbPath = $private['thumbIndex'][$id]['path'] ?? null;
$type = $private['thumbIndex'][$id]['type'] ?? '';

if (is_string($thumbPath) && $thumbPath !== '' && is_file($thumbPath)) {
    mw_stream_file($thumbPath, mw_mime_for_path($thumbPath));
}

$track = $private['trackIndex'][$id] ?? null;
if (is_array($track) && ($track['type'] ?? '') === 'image' && is_string($track['path'] ?? '')) {
    mw_stream_file($track['path'], mw_mime_for_path($track['path']));
}

http_response_code(404);
