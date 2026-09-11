@echo off
setlocal EnableExtensions
title 1132 Fixer Chrome Installer

set "REPO_DIR=%~dp0"
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"
set "EXT_DIR=%REPO_DIR%\dist\chrome"

if not exist "%EXT_DIR%\manifest.json" (
  echo.
  echo [ERROR] No Chrome build found at:
  echo   %EXT_DIR%
  echo.
  echo Build it first from the repository root:
  echo   npm ci
  echo   npm run build:chrome
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  1132 Fixer for Chrome - Local Installer Helper
echo ================================================================
echo.
echo  NOTE: Chrome does not allow a .bat file to silently install an
echo  unpacked extension. This helper just opens the two windows you
echo  need - the Chrome extensions page and the built extension
echo  folder - so you only have to click "Load unpacked" and pick it.
echo.
echo  No admin rights. No registry changes. No downloads.
echo.
echo  Extension folder:
echo    %EXT_DIR%
echo.
echo ================================================================
echo  Steps:
echo    1. In the Chrome tab that opens, toggle "Developer mode" ON
echo       (top-right of chrome://extensions).
echo    2. Click "Load unpacked".
echo    3. In the Explorer window that opens, copy the folder path
echo       above (or browse to it) and select it.
echo    4. Pin "1132 Fixer" to the toolbar.
echo    5. Visit https://zoom.us and click the 1132 Fixer icon.
echo ================================================================
echo.

set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
  echo Opening Chrome extensions page...
  start "" "%CHROME_EXE%" "chrome://extensions"
) else (
  echo Chrome not found in the usual locations.
  echo Falling back to the default browser handler for chrome://extensions
  echo (will only work if Chrome is installed and is the default for chrome:// URLs).
  start "" "chrome://extensions"
)

echo Opening the extension folder in Explorer...
start "" explorer "%EXT_DIR%"

echo.
echo Done. Switch to the Chrome tab and click "Load unpacked".
echo.
pause
endlocal
