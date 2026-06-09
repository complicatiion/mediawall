<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

mw_enforce_ip_allowlist();
mw_session_start();
$cfg = mw_config();

if (empty($_SESSION['mw_auth'])) {
    mw_json([
        'ok' => true,
        'authenticated' => false,
        'app' => [
            'name' => (string)($cfg['app_name'] ?? 'MediaWall'),
            'version' => (string)($cfg['version'] ?? 'V8'),
        ],
    ]);
}

mw_json([
    'ok' => true,
    'authenticated' => true,
    'user' => (string)($_SESSION['mw_user'] ?? ''),
    'csrf' => (string)($_SESSION['mw_csrf'] ?? ''),
    'app' => [
        'name' => (string)($cfg['app_name'] ?? 'MediaWall'),
        'version' => (string)($cfg['version'] ?? 'V8'),
    ],
]);
