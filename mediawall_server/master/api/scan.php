<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

mw_require_auth();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    mw_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
mw_require_csrf();

$payload = mw_run_scan(true);
mw_json([
    'ok' => true,
    'library' => $payload['public'],
]);
