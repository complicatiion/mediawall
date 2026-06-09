<?php
declare(strict_types=1);

function mw_config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = __DIR__ . '/config.php';
    if (!is_file($file)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Missing api/config.php']);
        exit;
    }
    $cfg = require $file;
    return $cfg;
}

function mw_root_path(string $relative): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . ltrim($relative, '/\\');
}

function mw_data_path(string $relative = ''): string
{
    $root = mw_root_path('data');
    if (!is_dir($root)) @mkdir($root, 0775, true);
    return $relative ? $root . DIRECTORY_SEPARATOR . ltrim($relative, '/\\') : $root;
}

function mw_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $cfg = mw_config();
    session_name((string)($cfg['session_name'] ?? 'mediawall_admin'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => !empty($cfg['secure_cookies']),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function mw_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function mw_client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function mw_enforce_ip_allowlist(): void
{
    $allowed = mw_config()['allowed_ips'] ?? [];
    if (!$allowed) return;
    if (!in_array(mw_client_ip(), $allowed, true)) {
        mw_json(['ok' => false, 'error' => 'Access denied.'], 403);
    }
}

function mw_require_auth(): void
{
    mw_enforce_ip_allowlist();
    mw_session_start();
    if (empty($_SESSION['mw_auth'])) {
        mw_json(['ok' => false, 'error' => 'Authentication required.'], 401);
    }
}

function mw_require_csrf(): void
{
    mw_session_start();
    $header = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!$header || !hash_equals((string)($_SESSION['mw_csrf'] ?? ''), $header)) {
        mw_json(['ok' => false, 'error' => 'Invalid CSRF token.'], 419);
    }
}

function mw_read_json_file(string $file, array $fallback = []): array
{
    if (!is_file($file)) return $fallback;
    $raw = file_get_contents($file);
    if ($raw === false || $raw === '') return $fallback;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $fallback;
}

function mw_write_json_file(string $file, array $data): void
{
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function mw_rate_limit_file(): string
{
    return mw_data_path('ratelimit/login-' . preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', mw_client_ip()) . '.json');
}

function mw_record_login_attempt(bool $success): void
{
    $file = mw_rate_limit_file();
    $cfg = mw_config();
    $window = (int)($cfg['login_window_seconds'] ?? 900);
    $max = (int)($cfg['login_max_attempts'] ?? 6);
    $now = time();
    $state = mw_read_json_file($file, ['attempts' => []]);
    $attempts = array_values(array_filter($state['attempts'] ?? [], static function ($ts) use ($now, $window) {
        return is_int($ts) && ($now - $ts) < $window;
    }));
    if ($success) {
        @unlink($file);
        return;
    }
    $attempts[] = $now;
    mw_write_json_file($file, ['attempts' => $attempts, 'blocked' => count($attempts) >= $max]);
}

function mw_is_rate_limited(): bool
{
    $file = mw_rate_limit_file();
    $cfg = mw_config();
    $window = (int)($cfg['login_window_seconds'] ?? 900);
    $max = (int)($cfg['login_max_attempts'] ?? 6);
    $now = time();
    $state = mw_read_json_file($file, ['attempts' => []]);
    $attempts = array_values(array_filter($state['attempts'] ?? [], static function ($ts) use ($now, $window) {
        return is_int($ts) && ($now - $ts) < $window;
    }));
    if (count($attempts) >= $max) {
        mw_write_json_file($file, ['attempts' => $attempts, 'blocked' => true]);
        return true;
    }
    if ($attempts !== ($state['attempts'] ?? [])) {
        mw_write_json_file($file, ['attempts' => $attempts, 'blocked' => false]);
    }
    return false;
}

function mw_public_cache_path(): string
{
    return mw_data_path('library-cache.json');
}

function mw_private_cache_path(): string
{
    return mw_data_path('library-private.json');
}

function mw_scan_config_file(): string
{
    return mw_data_path('scan-config.json');
}

function mw_run_scan(bool $force = false): array
{
    $cfg = mw_config();
    $libraryRoot = (string)($cfg['library_root'] ?? '');
    if ($libraryRoot === '' || !is_dir($libraryRoot)) {
        mw_json(['ok' => false, 'error' => 'Configured library_root is missing or invalid.'], 500);
    }

    $public = mw_public_cache_path();
    $private = mw_private_cache_path();

    if (!$force && is_file($public) && is_file($private)) {
        return [
            'public' => mw_read_json_file($public, []),
            'private' => mw_read_json_file($private, []),
        ];
    }

    $scanConfig = [
        'library_root' => $libraryRoot,
        'library_label' => (string)($cfg['library_label'] ?? 'Media library'),
        'ffmpeg_path' => (string)($cfg['ffmpeg_path'] ?? ''),
        'ffprobe_path' => (string)($cfg['ffprobe_path'] ?? ''),
        'public_cache' => $public,
        'private_cache' => $private,
        'thumb_dir' => mw_data_path('thumbs'),
    ];
    mw_write_json_file(mw_scan_config_file(), $scanConfig);

    $python = (string)($cfg['python_path'] ?? 'python');
    $script = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'python' . DIRECTORY_SEPARATOR . 'scan_engine.py';

    $cmd = escapeshellarg($python) . ' ' . escapeshellarg($script) . ' ' . escapeshellarg(mw_scan_config_file());
    $output = [];
    $status = 0;
    exec($cmd . ' 2>&1', $output, $status);

    if ($status !== 0) {
        mw_json(['ok' => false, 'error' => 'Scan failed.', 'details' => implode("\n", $output)], 500);
    }

    return [
        'public' => mw_read_json_file($public, []),
        'private' => mw_read_json_file($private, []),
    ];
}

function mw_private_index(): array
{
    return mw_read_json_file(mw_private_cache_path(), ['trackIndex' => [], 'thumbIndex' => []]);
}

function mw_mime_for_path(string $path): string
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = [
        'mp4' => 'video/mp4',
        'm4v' => 'video/mp4',
        'webm' => 'video/webm',
        'mov' => 'video/quicktime',
        'mkv' => 'video/x-matroska',
        'avi' => 'video/x-msvideo',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'avif' => 'image/avif',
    ];
    return $map[$ext] ?? 'application/octet-stream';
}

function mw_stream_file(string $path, string $mime): void
{
    if (!is_file($path)) {
        http_response_code(404);
        exit;
    }

    $size = filesize($path);
    $start = 0;
    $end = max(0, $size - 1);
    $length = $size;

    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, max-age=3600');

    if (!empty($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d*)-(\d*)/', (string)$_SERVER['HTTP_RANGE'], $m)) {
        if ($m[1] !== '') $start = (int)$m[1];
        if ($m[2] !== '') $end = (int)$m[2];
        if ($end >= $size) $end = $size - 1;
        if ($start > $end || $start >= $size) {
            header('Content-Range: bytes */' . $size);
            http_response_code(416);
            exit;
        }
        $length = $end - $start + 1;
        http_response_code(206);
        header("Content-Range: bytes {$start}-{$end}/{$size}");
    }

    header('Content-Length: ' . (string)$length);

    $fp = fopen($path, 'rb');
    if ($fp === false) exit;
    fseek($fp, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($fp)) {
        $read = min(8192, $remaining);
        $buffer = fread($fp, $read);
        if ($buffer === false) break;
        echo $buffer;
        flush();
        $remaining -= strlen($buffer);
    }
    fclose($fp);
    exit;
}
