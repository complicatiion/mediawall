@echo off
setlocal EnableExtensions
title MediaWall V8 - Open Config

set "PROJECT_ROOT=%~dp0"
set "CONFIG_FILE=%PROJECT_ROOT%api\config.php"
set "CONFIG_EXAMPLE=%PROJECT_ROOT%api\config.example.php"

if exist "%CONFIG_FILE%" (
    start "" notepad "%CONFIG_FILE%"
    exit /b 0
)

if exist "%CONFIG_EXAMPLE%" (
    echo [INFO ] api\config.php not found. Opening config.example.php instead.
    start "" notepad "%CONFIG_EXAMPLE%"
    exit /b 0
)

echo [ERROR] No config file was found.
echo.
pause
exit /b 1
