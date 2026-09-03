' Silent Steam launcher — no CMD window.
' Steam Launch Option executable: AsteroidsArena.vbs
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = dir & "\runtime\node.exe"
script = dir & "\steam\launch-game.js"
If Not fso.FileExists(node) Then
  MsgBox "Missing runtime\node.exe", 16, "Asteroids Arena Online"
  WScript.Quit 1
End If
If Not fso.FileExists(script) Then
  MsgBox "Missing steam\launch-game.js", 16, "Asteroids Arena Online"
  WScript.Quit 1
End If
' WebView2: GPU + no background throttle (keep WebGL-safe — no disable-direct-composition)
sh.Environment("PROCESS")("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") = "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-ipc-flooding-protection --enable-gpu --enable-gpu-rasterization --ignore-gpu-blocklist --use-angle=d3d11"
' WindowStyle 0 = hidden (no console flash)
sh.Run """" & node & """ """ & script & """", 0, False
