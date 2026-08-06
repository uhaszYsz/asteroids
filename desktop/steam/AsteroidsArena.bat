@echo off
cd /d "%~dp0"
".\runtime\node.exe" ".\steam\launch-game.js"
if errorlevel 1 (
  echo.
  echo Steam launch failed. Is Steam running and are you logged in?
  pause
  exit /b 1
)
