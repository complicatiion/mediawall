@echo off
setlocal EnableExtensions
title MediaWall V8 - Local Server (8091, no browser)

set "HOST=127.0.0.1"
set "PORT=8091"
set "PROJECT_ROOT=%~dp0"
set "PHP_EXE=C:\php\php.exe"

cd /d "%PROJECT_ROOT%" >nul 2>&1

if not exist "%PHP_EXE%" (
    echo [ERROR] PHP not found:
    echo         %PHP_EXE%
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%index.php" (
    echo [ERROR] index.php not found in:
    echo         %PROJECT_ROOT%
    pause
    exit /b 1
)

echo Starting MediaWall on http://%HOST%:%PORT%/
echo Press Ctrl+C to stop.
echo.

"%PHP_EXE%" -S %HOST%:%PORT% -t "%PROJECT_ROOT%"
set "EXITCODE=%ERRORLEVEL%"
echo.
echo MediaWall stopped. Exit code: %EXITCODE%
pause
exit /b %EXITCODE%
