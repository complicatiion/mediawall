<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

mw_require_auth();
$payload = mw_run_scan(false);
mw_json([
    'ok' => true,
    'library' => $payload['public'],
    'csrf' => (string)($_SESSION['mw_csrf'] ?? ''),
]);
