'use strict';

/**
 * Steam depot entry (AsteroidsArena.bat / AsteroidsArena.sh).
 * 1) Fetch a fresh Steam Web API ticket
 * 2) Write steam_session.json next to the game binary
 * 3) Launch the platform game binary
 */

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const STEAM_DIR = __dirname;
const ROOT = path.resolve(STEAM_DIR, '..');
const SESSION_OUT = path.join(ROOT, 'steam_session.json');
const BRIDGE = path.join(STEAM_DIR, 'bridge.js');

function resolveGameBinary() {
  const plat = process.platform;
  const arch = process.arch;
  const names = [];
  if (plat === 'win32') {
    names.push('asteroids-win_x64.exe');
  } else if (plat === 'darwin') {
    names.push('asteroids-mac_universal', 'asteroids-mac_arm64', 'asteroids-mac_x64');
  } else {
    if (arch === 'arm64') names.push('asteroids-linux_arm64', 'asteroids-linux_x64');
    else if (arch === 'arm') names.push('asteroids-linux_armhf', 'asteroids-linux_x64');
    else names.push('asteroids-linux_x64', 'asteroids-linux_arm64');
  }
  for (const n of names) {
    const p = path.join(ROOT, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const GAME_EXE = resolveGameBinary();
if (!GAME_EXE) {
  console.error('Missing game binary in', ROOT);
  process.exit(1);
}

if (process.platform !== 'win32') {
  try { fs.chmodSync(GAME_EXE, 0o755); } catch (_) {}
}

process.env.STEAM_SESSION_OUT = SESSION_OUT;
if (!process.env.STEAM_APP_ID) process.env.STEAM_APP_ID = '5069920';

console.log('Fetching Steam auth ticket…');
const ticket = spawnSync(process.execPath, [BRIDGE], {
  cwd: STEAM_DIR,
  env: process.env,
  stdio: 'inherit',
  shell: false
});
if (ticket.error) {
  console.error(ticket.error);
  process.exit(1);
}
if (ticket.status) process.exit(ticket.status || 1);

if (!fs.existsSync(SESSION_OUT)) {
  console.error('Steam session was not written to', SESSION_OUT);
  process.exit(1);
}

console.log('Launching', path.basename(GAME_EXE), '…');
const child = spawn(GAME_EXE, [], {
  cwd: ROOT,
  detached: true,
  stdio: 'ignore',
  windowsHide: false
});
child.on('error', (err) => {
  console.error('Failed to start game:', err);
  process.exit(1);
});
child.unref();
