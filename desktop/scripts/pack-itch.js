#!/usr/bin/env node
/**
 * Build desktop/dist/asteroids-itch.zip for itch.io HTML5 upload.
 * - index.html at zip root (contents of public/)
 * - forward-slash zip paths (Windows Compress-Archive breaks itch/Linux)
 * - pins ASTEROIDS_SERVER (itch origin cannot reach same-host multiplayer)
 * - no service worker (itch iframe + SW cache was poisoning live clients)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'desktop', 'dist');
const STAGE = path.join(OUT_DIR, 'itch-stage');
const OUT_ZIP = path.join(OUT_DIR, 'asteroids-itch.zip');
const SERVER = 'https://szkodnik.com/asteroids';

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

rmrf(STAGE);
fs.mkdirSync(OUT_DIR, { recursive: true });
copyDir(PUBLIC, STAGE);

fs.writeFileSync(
  path.join(STAGE, 'config.js'),
  [
    '// Dedicated server for itch.io clients (cross-origin).',
    `window.ASTEROIDS_SERVER = '${SERVER}';`,
    ''
  ].join('\n'),
  'utf8'
);

const itchBoot = `<script>
window.ASTEROIDS_SERVER = '${SERVER}';
(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(s);
    });
  }
  async function boot() {
    // Unregister any SW itch/CDN may have left; do not register a new one.
    if ('serviceWorker' in navigator) {
      try {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(function (r) { return r.unregister(); }));
        if (window.caches) {
          var keys = await caches.keys();
          await Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }
      } catch (_) {}
    }
    try {
      await loadScript('lib/bassoonplayer.js');
      await loadScript('music.js?v=7');
      await loadScript('config.js?v=itch2');
      await loadScript('sim/local-server.js?v=85');
      await loadScript('game.js?v=1009');
    } catch (err) {
      console.error(err);
    }
  }
  boot();
})();
</script>
</body>
</html>`;

let html = fs.readFileSync(path.join(STAGE, 'index.html'), 'utf8');
html = html.replace(/<script>\s*\(function \(\) \{[\s\S]*?<\/script>\s*<\/body>\s*<\/html>\s*$/m, itchBoot);
if (!html.includes("ASTEROIDS_SERVER = '" + SERVER + "'") && !html.includes('ASTEROIDS_SERVER="' + SERVER + '"')) {
  html = html.replace(
    '<title>Asteroids</title>',
    `<title>Asteroids</title>\n  <script>window.ASTEROIDS_SERVER='${SERVER}';</script>`
  );
}
fs.writeFileSync(path.join(STAGE, 'index.html'), html, 'utf8');

rmrf(OUT_ZIP);

const ps = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stage = '${STAGE.replace(/'/g, "''")}'
$out = '${OUT_ZIP.replace(/'/g, "''")}'
if (Test-Path $out) { Remove-Item $out -Force }
$fs = [System.IO.File]::Open($out, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
function Add-Tree($dir, $prefix) {
  Get-ChildItem -LiteralPath $dir -Force | ForEach-Object {
    $name = if ($prefix) { "$prefix/$($_.Name)" } else { $_.Name }
    $name = $name -replace '\\\\','/'
    if ($_.PSIsContainer) { Add-Tree $_.FullName $name }
    else {
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $_.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  }
}
Add-Tree $stage ''
$zip.Dispose(); $fs.Dispose()
Write-Host "zipped $out"
`;
const script = path.join(OUT_DIR, '_pack-itch.ps1');
fs.writeFileSync(script, ps, 'utf8');
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`, { stdio: 'inherit' });
fs.rmSync(script, { force: true });
rmrf(STAGE);

const verify = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${OUT_ZIP.replace(/'/g, "''")}')
$names = @($z.Entries | ForEach-Object { $_.FullName })
$cfg = New-Object System.IO.StreamReader(($z.GetEntry('config.js')).Open())
$cfgText = $cfg.ReadToEnd(); $cfg.Close()
$z.Dispose()
$bs = @($names | Where-Object { $_.Contains([char]92) }).Count
Write-Output ("entries=" + $names.Count)
Write-Output ("backslash=" + $bs)
Write-Output ("hasIndex=" + ($names -contains 'index.html'))
Write-Output ("hasBassoon=" + ($names -contains 'lib/bassoonplayer.js'))
Write-Output ("hasSim=" + ($names -contains 'sim/local-server.js'))
Write-Output ("config=" + ($cfgText -replace "\`r|\`n"," "))
`;
const vscript = path.join(OUT_DIR, '_verify-itch.ps1');
fs.writeFileSync(vscript, verify, 'utf8');
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${vscript}"`, { stdio: 'inherit' });
fs.rmSync(vscript, { force: true });

const mb = (fs.statSync(OUT_ZIP).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${OUT_ZIP} (${mb} MB)`);
