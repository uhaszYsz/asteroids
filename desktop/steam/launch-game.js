'use strict';

/**
 * Steam depot entry (called by AsteroidsArena.bat).
 * 1) Fetch a fresh Steam Web API ticket
 * 2) Write steam_session.json next to the game exe
 * 3) Launch asteroids-win_x64.exe
 */

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const STEAM_DIR = __dirname;
const ROOT = path.resolve(STEAM_DIR, '..');
const SESSION_OUT = path.join(ROOT, 'steam_session.json');
const GAME_EXE = path.join(ROOT, 'asteroids-win_x64.exe');
const BRIDGE = path.join(STEAM_DIR, 'bridge.js');

if (!fs.existsSync(GAME_EXE)) {
  console.error('Missing game exe:', GAME_EXE);
  process.exit(1);
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

console.log('Launching game…');
const child = spawn(GAME_EXE, [], {
  cwd: ROOT,
  detached: true,
  stdio: 'ignore',
  windowsHide: false
});
child.unref();
