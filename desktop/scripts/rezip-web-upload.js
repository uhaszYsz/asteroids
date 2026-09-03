'use strict';

/** Rezip existing steam-depot-* folders for Steam Web Upload (no rebuild). */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const DIST = path.resolve(__dirname, '..', 'dist');

function zipDepot(srcDir, zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
  const tmpDir = path.join(srcDir, '.tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

  const ps = [
    '-NoProfile', '-Command',
    `$ErrorActionPreference='Stop'; ` +
    `Add-Type -AssemblyName System.IO.Compression; ` +
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
    `$src='${srcDir.replace(/'/g, "''")}'; $dst='${zipPath.replace(/'/g, "''")}'; ` +
    `if (Test-Path $dst) { Remove-Item -Force $dst }; ` +
    `$zip=[IO.Compression.ZipFile]::Open($dst, [IO.Compression.ZipArchiveMode]::Create); ` +
    `try { ` +
    `  Get-ChildItem -LiteralPath $src -Recurse -Force -File | ForEach-Object { ` +
    `    $rel = $_.FullName.Substring($src.Length).TrimStart('\\','/').Replace('\\','/'); ` +
    `    if ($rel -match '^(\\.tmp|README-STEAM\\.txt)(/|$)') { return }; ` +
    `    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [IO.Compression.CompressionLevel]::Optimal); ` +
    `  }; ` +
    `} finally { $zip.Dispose() }`
  ];
  const r = spawnSync('powershell', ps, { stdio: 'inherit', shell: false });
  if (r.status) throw new Error('Failed to zip ' + srcDir);
  const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log('ZIP:', zipPath, mb + ' MB');
}

const up = path.join(DIST, 'steam-web-upload');
zipDepot(path.join(DIST, 'steam-depot-windows'), path.join(up, 'depot-5069921-windows.zip'));
zipDepot(path.join(DIST, 'steam-depot-linux'), path.join(up, 'depot-5069922-linux.zip'));
zipDepot(path.join(DIST, 'steam-depot-macos'), path.join(up, 'depot-5069923-macos.zip'));
