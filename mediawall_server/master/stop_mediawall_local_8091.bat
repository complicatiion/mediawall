@echo off
setlocal EnableExtensions
title MediaWall V8 - Stop Local Server (8091)

set "PORT=8091"
set "FOUND_PID="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    set "FOUND_PID=%%P"
    goto :killit
)

echo [INFO ] No listening process was found on port %PORT%.
echo.
pause
exit /b 0

:killit
echo [INFO ] Stopping process on port %PORT% ...
echo [INFO ] PID: %FOUND_PID%
taskkill /PID %FOUND_PID% /F
echo.
pause
exit /b 0
