@echo off
cd /d "%~dp0"
rem Force WebView2 hardware acceleration (also set in launch-game.js / VBS)
set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-ipc-flooding-protection --enable-gpu --enable-gpu-rasterization --ignore-gpu-blocklist --use-angle=d3d11"
".\runtime\node.exe" ".\steam\launch-game.js"
if errorlevel 1 (
  echo.
  echo Steam launch failed. Is Steam running and are you logged in?
  pause
  exit /b 1
)
