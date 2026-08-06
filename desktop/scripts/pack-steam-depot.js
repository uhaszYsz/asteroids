'use strict';

/**
 * Build a SteamPipe-ready depot folder:
 *   desktop/dist/steam-depot/
 *
 * Contents:
 *   AsteroidsArena.bat     ← set as Steam Launch Option
 *   asteroids-win_x64.exe  ← Neutralino game
 *   resources.neu
 *   steam_appid.txt
 *   runtime/node.exe       ← portable Node for the Steam bridge
 *   steam/                 ← bridge + steamworks.js
 *
 * Usage (repo root):
 *   node desktop/scripts/pack-steam-depot.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const STEAM_DIR = path.join(DESKTOP, 'steam');
const OUT = path.join(DESKTOP, 'dist', 'steam-depot');
const APP_ID = '5069920';

function run(cmd, args, opts) {
  const o = Object.assign({
    cwd: ROOT,
    stdio: 'inherit',
    shell: false
  }, opts || {});
  if (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')) o.shell = true;
  const r = spawnSync(cmd, args, o);
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  if (r.status) process.exit(r.status || 1);
}

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

console.log('=== 1/3 Building Neutralino Steam package ===');
run(process.execPath, [path.join(STEAM_DIR, 'run-steam.js'), '--build']);

const neuDist = path.join(DESKTOP, 'dist', 'asteroids');
if (!fs.existsSync(neuDist)) {
  // newer neu may nest under dist/<binaryName>
  const alt = path.join(DESKTOP, 'dist');
  const kids = fs.existsSync(alt) ? fs.readdirSync(alt) : [];
  console.error('Neutralino dist not found at', neuDist, 'dist contains:', kids.join(', '));
  process.exit(1);
}

const exeName = fs.readdirSync(neuDist).find((n) => /\.exe$/i.test(n) && !/helper/i.test(n));
if (!exeName) {
  console.error('No .exe in', neuDist);
  process.exit(1);
}

console.log('=== 2/3 Assembling Steam depot ===');
rmDir(OUT);
fs.mkdirSync(OUT, { recursive: true });

// Game binaries / resources from neu build (Windows depot only)
for (const name of fs.readdirSync(neuDist)) {
  const from = path.join(neuDist, name);
  if (fs.statSync(from).isDirectory()) {
    copyDir(from, path.join(OUT, name));
    continue;
  }
  // Skip non-Windows Neutralino binaries
  if (/\.exe$/i.test(name)) {
    copyFile(from, path.join(OUT, 'asteroids-win_x64.exe'));
    continue;
  }
  if (/^asteroids-(linux|mac)/i.test(name)) continue;
  copyFile(from, path.join(OUT, name));
}

// Portable Node (same major as build machine)
const runtimeDir = path.join(OUT, 'runtime');
fs.mkdirSync(runtimeDir, { recursive: true });
copyFile(process.execPath, path.join(runtimeDir, 'node.exe'));

// Steam bridge runtime
const steamOut = path.join(OUT, 'steam');
fs.mkdirSync(steamOut, { recursive: true });
for (const f of ['bridge.js', 'launch-game.js', 'package.json', 'package-lock.json']) {
  const src = path.join(STEAM_DIR, f);
  if (fs.existsSync(src)) copyFile(src, path.join(steamOut, f));
}
fs.writeFileSync(path.join(steamOut, 'steam_appid.txt'), APP_ID + '\n');
copyDir(path.join(STEAM_DIR, 'node_modules'), path.join(steamOut, 'node_modules'));

// Launcher + AppID at depot root (Steam Launch Option = AsteroidsArena.bat)
copyFile(path.join(STEAM_DIR, 'AsteroidsArena.bat'), path.join(OUT, 'AsteroidsArena.bat'));
fs.writeFileSync(path.join(OUT, 'steam_appid.txt'), APP_ID + '\n');
fs.writeFileSync(path.join(OUT, 'steam_session.json'), JSON.stringify({
  ok: 0,
  err: 'no_session',
  detail: 'Run AsteroidsArena.bat (Steam launcher) to fetch a ticket',
  at: Date.now()
}, null, 2));

fs.writeFileSync(path.join(OUT, 'README-STEAM.txt'), [
  'Asteroids Arena Online — Steam depot folder',
  '',
  'Steamworks Launch Options:',
  '  Executable: AsteroidsArena.bat',
  '  Working Directory: (leave blank)',
  '',
  'Upload this entire folder as your Windows depot via SteamPipe.',
  'Requires Steam client running; uses WebView2 (preinstalled on modern Windows).',
  ''
].join('\n'));

console.log('=== 3/3 Done ===');
console.log('Depot ready:', OUT);
console.log('Steam Launch Option executable: AsteroidsArena.bat');
