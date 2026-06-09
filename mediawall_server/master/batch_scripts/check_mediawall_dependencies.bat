@echo off
setlocal EnableExtensions
title MediaWall V8 - Dependency Check

set "PROJECT_ROOT=%~dp0"
set "PHP_EXE=C:\php\php.exe"
set "PYTHON_EXE=C:\python\python.exe"
set "FFMPEG_EXE=C:\ffmpeg\bin\ffmpeg.exe"
set "FFPROBE_EXE=C:\ffmpeg\bin\ffprobe.exe"
set "CONFIG_FILE=%PROJECT_ROOT%api\config.php"
set "INDEX_FILE=%PROJECT_ROOT%index.php"

echo.
echo ============================================================
echo  MediaWall V8 - Dependency Check
echo ============================================================
echo.

if exist "%INDEX_FILE%" (
    echo [OK   ] index.php found
) else (
    echo [FAIL ] index.php missing
)

if exist "%CONFIG_FILE%" (
    echo [OK   ] api\config.php found
) else (
    echo [WARN ] api\config.php missing
)

if exist "%PHP_EXE%" (
    echo [OK   ] PHP found: %PHP_EXE%
) else (
    echo [FAIL ] PHP missing: %PHP_EXE%
)

if exist "%PYTHON_EXE%" (
    echo [OK   ] Python found: %PYTHON_EXE%
) else (
    echo [WARN ] Python missing: %PYTHON_EXE%
)

if exist "%FFMPEG_EXE%" (
    echo [OK   ] FFmpeg found: %FFMPEG_EXE%
) else (
    echo [WARN ] FFmpeg missing: %FFMPEG_EXE%
)

if exist "%FFPROBE_EXE%" (
    echo [OK   ] FFprobe found: %FFPROBE_EXE%
) else (
    echo [WARN ] FFprobe missing: %FFPROBE_EXE%
)

echo.
echo Done.
echo.
pause
exit /b 0
