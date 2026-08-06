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
' Low-latency WebView2 hints for the game process tree
sh.Environment("PROCESS")("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") = "--disable-features=CalculateNativeWinOcclusion --disable-background-timer-throttling --disable-renderer-backgrounding --disable-ipc-flooding-protection --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist"
' WindowStyle 0 = hidden (no console flash)
sh.Run """" & node & """ """ & script & """", 0, False
