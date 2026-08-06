'use strict';

/**
 * Steam desktop launcher:
 * 1) fetch Steam ticket → session.json
 * 2) sync Neutralino resources with Steam boot
 * 3) run / build Neutralino
 *
 * Usage from repo root:
 *   node desktop/steam/run-steam.js
 *   node desktop/steam/run-steam.js --build
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const build = process.argv.includes('--build');

function run(cmd, args, opts) {
  const o = Object.assign({
    cwd: ROOT,
    stdio: 'inherit',
    // shell:true breaks absolute paths with spaces (e.g. C:\Program Files\nodejs\node.exe)
    shell: false
  }, opts || {});
  // npm/npx need the shell on Windows to resolve .cmd shims
  if (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')) {
    o.shell = true;
  }
  const r = spawnSync(cmd, args, o);
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  if (r.status) process.exit(r.status || 1);
}

// Ensure steamworks deps exist
const steamNm = path.join(__dirname, 'node_modules', 'steamworks.js');
if (!fs.existsSync(steamNm)) {
  console.log('Installing desktop/steam dependencies…');
  run('npm', ['install'], { cwd: __dirname });
}

if (!build) {
  console.log('Fetching Steam auth ticket…');
  const sessionOutRun = path.join(DESKTOP, 'bin', 'steam_session.json');
  process.env.STEAM_SESSION_OUT = sessionOutRun;
  run(process.execPath, [path.join(__dirname, 'bridge.js')], { env: process.env });
} else {
  // Depot launcher fetches a fresh ticket at runtime — placeholder is enough for the bundle.
  const placeholder = {
    ok: 0,
    err: 'no_session',
    detail: 'Launch via AsteroidsArena.bat to fetch a Steam ticket',
    at: Date.now()
  };
  fs.writeFileSync(path.join(__dirname, 'session.json'), JSON.stringify(placeholder, null, 2));
  console.log('Build mode: skipping live Steam ticket (launcher fetches at runtime).');
}

console.log('Syncing Neutralino resources (Steam)…');
run(process.execPath, [path.join(DESKTOP, 'scripts', 'sync-resources.js'), '--steam']);

process.chdir(DESKTOP);
const neuBin = path.join(DESKTOP, 'bin');
if (!fs.existsSync(neuBin) || !fs.readdirSync(neuBin).length) {
  console.log('Downloading Neutralino binaries (first run)…');
  run('npx', ['neu', 'update'], { cwd: DESKTOP });
}
// neu run loads from bin/ — put session next to the binary for boot-steam.js
try {
  const sess = path.join(__dirname, 'session.json');
  if (!build && fs.existsSync(sess)) {
    fs.mkdirSync(neuBin, { recursive: true });
    fs.copyFileSync(sess, path.join(neuBin, 'steam_session.json'));
  }
} catch (_) {}

if (build) {
  console.log('Building Neutralino Steam package…');
  run('npx', ['neu', 'build'], { cwd: DESKTOP });
} else {
  console.log('Launching Neutralino…');
  run('npx', ['neu', 'run'], { cwd: DESKTOP });
}
