@echo off
setlocal EnableExtensions EnableDelayedExpansion
title MediaWall V8 - Local Server (8091)

rem --- Fixed local settings ---
set "HOST=127.0.0.1"
set "PORT=8091"
set "PROJECT_ROOT=%~dp0"
set "CONFIG_FILE=%PROJECT_ROOT%api\config.php"
set "PHP_EXE=C:\php\php.exe"
set "PYTHON_EXE=C:\python\python.exe"
set "FFMPEG_EXE=C:\ffmpeg\bin\ffmpeg.exe"
set "FFPROBE_EXE=C:\ffmpeg\bin\ffprobe.exe"

rem --- Resolve project root ---
cd /d "%PROJECT_ROOT%" >nul 2>&1

echo.
echo ============================================================
echo  MediaWall V8 - Local Start
echo ============================================================
echo  Project: %PROJECT_ROOT%
echo  URL    : http://%HOST%:%PORT%
echo ============================================================
echo.

rem --- Basic checks ---
if not exist "%PHP_EXE%" (
    echo [ERROR] PHP not found:
    echo         %PHP_EXE%
    echo.
    echo Install PHP into C:\php or adjust this script.
    echo.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%index.php" (
    echo [ERROR] index.php not found in:
    echo         %PROJECT_ROOT%
    echo.
    echo Place this script in the MediaWall project root.
    echo.
    pause
    exit /b 1
)

if not exist "%CONFIG_FILE%" (
    echo [WARN ] api\config.php was not found.
    echo         Create it before using the server features.
    echo.
)

rem --- Optional dependency hints ---
if not exist "%PYTHON_EXE%" (
    echo [WARN ] Python not found at %PYTHON_EXE%
)
if not exist "%FFMPEG_EXE%" (
    echo [WARN ] FFmpeg not found at %FFMPEG_EXE%
)
if not exist "%FFPROBE_EXE%" (
    echo [WARN ] FFprobe not found at %FFPROBE_EXE%
)

rem --- Check whether the target port is already in use ---
set "PORT_BUSY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "PORT_BUSY=1"
    set "BUSY_PID=%%P"
)

if defined PORT_BUSY (
    echo.
    echo [ERROR] Port %PORT% is already in use.
    echo         Listening PID: %BUSY_PID%
    echo.
    echo Close the other process or use the stop script if it belongs to MediaWall.
    echo.
    pause
    exit /b 1
)

echo [INFO ] Starting PHP built-in server...
echo [INFO ] Press Ctrl+C in this window to stop MediaWall.
echo.

rem --- Open the browser shortly after server start ---
start "" cmd /c "ping 127.0.0.1 -n 2 >nul && start "" "http://%HOST%:%PORT%/""

"%PHP_EXE%" -S %HOST%:%PORT% -t "%PROJECT_ROOT%"
set "EXITCODE=%ERRORLEVEL%"

echo.
echo [INFO ] MediaWall stopped. Exit code: %EXITCODE%
echo.
pause
exit /b %EXITCODE%
