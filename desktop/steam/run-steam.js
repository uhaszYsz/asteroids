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

console.log('Fetching Steam auth ticket…');
run(process.execPath, [path.join(__dirname, 'bridge.js')]);

console.log('Syncing Neutralino resources (Steam)…');
run(process.execPath, [path.join(DESKTOP, 'scripts', 'sync-resources.js'), '--steam']);

process.chdir(DESKTOP);
if (build) {
  console.log('Building Neutralino Steam package…');
  run('npx', ['neu', 'build']);
} else {
  console.log('Launching Neutralino…');
  run('npx', ['neu', 'run']);
}
