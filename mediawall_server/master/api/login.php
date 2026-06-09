<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

mw_enforce_ip_allowlist();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    mw_json(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
if (mw_is_rate_limited()) {
    mw_json(['ok' => false, 'error' => 'Too many login attempts.'], 429);
}

$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) $input = $_POST;

$honeypot = trim((string)($input['website'] ?? ''));
if ($honeypot !== '') {
    mw_record_login_attempt(false);
    mw_json(['ok' => false, 'error' => 'Invalid request.'], 400);
}

$user = trim((string)($input['username'] ?? ''));
$pass = (string)($input['password'] ?? '');

$cfg = mw_config();
$ok = hash_equals((string)($cfg['admin_username'] ?? ''), $user)
    && password_verify($pass, (string)($cfg['admin_password_hash'] ?? ''));

mw_record_login_attempt($ok);
if (!$ok) {
    mw_json(['ok' => false, 'error' => 'Invalid username or password.'], 401);
}

mw_session_start();
session_regenerate_id(true);
$_SESSION['mw_auth'] = true;
$_SESSION['mw_user'] = $user;
$_SESSION['mw_csrf'] = bin2hex(random_bytes(32));

mw_json([
    'ok' => true,
    'user' => $user,
    'csrf' => $_SESSION['mw_csrf'],
    'app' => [
        'name' => (string)($cfg['app_name'] ?? 'MediaWall'),
        'version' => (string)($cfg['version'] ?? 'V8'),
    ],
]);
