'use strict';

/**
 * Build SteamPipe-ready depot folders:
 *   desktop/dist/steam-depot-windows/
 *   desktop/dist/steam-depot-linux/
 *   desktop/dist/steam-depot-macos/
 *
 * Also mirrors Windows → desktop/dist/steam-depot/ (compat).
 *
 * Usage (repo root):
 *   node desktop/scripts/pack-steam-depot.js
 *   node desktop/scripts/pack-steam-depot.js --windows-only
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const STEAM_DIR = path.join(DESKTOP, 'steam');
const DIST = path.join(DESKTOP, 'dist');
const CACHE = path.join(DESKTOP, '.cache', 'node-runtime');
const APP_ID = '5069920';
const NODE_VER = 'v20.19.5';
const WINDOWS_ONLY = process.argv.includes('--windows-only');

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

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const get = (u, redirects) => {
      const mod = String(u).startsWith('https') ? https : http;
      mod.get(u, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects < 5) return get(new URL(res.headers.location, u).href, redirects + 1);
          reject(new Error('too many redirects'));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ' for ' + u));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      }).on('error', reject);
    };
    get(url, 0);
  });
}

function extractNodeFromTarGz(archive, destDir, platform, arch) {
  // Windows tar often fails on npm/npx symlinks inside the official Node tarball.
  // We only need bin/node — extract that path alone.
  fs.mkdirSync(destDir, { recursive: true });
  const inner = `node-${NODE_VER}-${platform}-${arch}/bin/node`;
  const r = spawnSync('tar', ['-xzf', archive, '-C', destDir, inner], {
    stdio: 'inherit',
    shell: false
  });
  if (r.status) {
    // Fallback: full extract, ignore symlink errors if node appeared
    spawnSync('tar', ['-xzf', archive, '-C', destDir], { stdio: 'inherit', shell: false });
  }
  const bin = path.join(destDir, inner);
  if (!fs.existsSync(bin)) throw new Error('tar extract missing ' + bin);
  return bin;
}

async function ensureNodeBinary(platform, arch) {
  // platform: linux|darwin, arch: x64|arm64
  const name = `node-${NODE_VER}-${platform}-${arch}`;
  const url = `https://nodejs.org/dist/${NODE_VER}/${name}.tar.gz`;
  const archive = path.join(CACHE, name + '.tar.gz');
  const extracted = path.join(CACHE, name);
  const bin = path.join(extracted, name, 'bin', 'node');
  if (!fs.existsSync(bin)) {
    console.log('Downloading', name, '…');
    if (!fs.existsSync(archive)) await download(url, archive);
    rmDir(extracted);
    fs.mkdirSync(extracted, { recursive: true });
    extractNodeFromTarGz(archive, extracted, platform, arch);
  }
  if (!fs.existsSync(bin)) throw new Error('Node binary missing after extract: ' + bin);
  return bin;
}

function writeCommonSteamFiles(outDir, launchHint) {
  const steamOut = path.join(outDir, 'steam');
  fs.mkdirSync(steamOut, { recursive: true });
  for (const f of ['bridge.js', 'launch-game.js', 'package.json', 'package-lock.json']) {
    const src = path.join(STEAM_DIR, f);
    if (fs.existsSync(src)) copyFile(src, path.join(steamOut, f));
  }
  fs.writeFileSync(path.join(steamOut, 'steam_appid.txt'), APP_ID + '\n');
  copyDir(path.join(STEAM_DIR, 'node_modules'), path.join(steamOut, 'node_modules'));

  fs.writeFileSync(path.join(outDir, 'steam_appid.txt'), APP_ID + '\n');
  fs.writeFileSync(path.join(outDir, 'steam_session.json'), JSON.stringify({
    ok: 0,
    err: 'no_session',
    detail: 'Run ' + launchHint + ' to fetch a Steam ticket',
    at: Date.now()
  }, null, 2));
  // Unique per pack so SteamPipe/Web Upload never treats rebuilds as identical.
  fs.writeFileSync(path.join(outDir, 'BUILD_STAMP.txt'), [
    'appId=' + APP_ID,
    'packedAt=' + new Date().toISOString(),
    'launch=' + launchHint,
    'host=' + require('os').hostname(),
    ''
  ].join('\n'));
}

function copySharedResources(neuDist, outDir) {
  for (const name of fs.readdirSync(neuDist)) {
    const from = path.join(neuDist, name);
    if (fs.statSync(from).isDirectory()) {
      copyDir(from, path.join(outDir, name));
      continue;
    }
    if (/^asteroids-/i.test(name)) continue; // platform binaries handled separately
    copyFile(from, path.join(outDir, name));
  }
}

async function packWindows(neuDist) {
  const out = path.join(DIST, 'steam-depot-windows');
  rmDir(out);
  fs.mkdirSync(out, { recursive: true });
  copySharedResources(neuDist, out);

  const winExe = fs.readdirSync(neuDist).find((n) => /\.exe$/i.test(n) && !/helper/i.test(n));
  if (!winExe) throw new Error('No Windows .exe in Neutralino dist');
  copyFile(path.join(neuDist, winExe), path.join(out, 'asteroids-win_x64.exe'));

  const runtimeDir = path.join(out, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  copyFile(process.execPath, path.join(runtimeDir, 'node.exe'));

  writeCommonSteamFiles(out, 'AsteroidsArena.vbs');
  copyFile(path.join(STEAM_DIR, 'AsteroidsArena.bat'), path.join(out, 'AsteroidsArena.bat'));
  copyFile(path.join(STEAM_DIR, 'AsteroidsArena.vbs'), path.join(out, 'AsteroidsArena.vbs'));

  fs.writeFileSync(path.join(out, 'README-STEAM.txt'), [
    'Asteroids Arena Online — Windows Steam depot',
    '',
    'Steamworks Launch Option (Windows):',
    '  Executable: AsteroidsArena.vbs',
    '  Working Directory: (blank)',
    '',
    '(AsteroidsArena.bat also works but shows a CMD window.)',
    'Upload this folder as your Windows depot via SteamPipe.',
    ''
  ].join('\n'));

  // compat alias
  const alias = path.join(DIST, 'steam-depot');
  rmDir(alias);
  copyDir(out, alias);

  console.log('Windows depot:', out);
  return out;
}

async function packLinux(neuDist) {
  const out = path.join(DIST, 'steam-depot-linux');
  rmDir(out);
  fs.mkdirSync(out, { recursive: true });
  copySharedResources(neuDist, out);

  const linuxBin = 'asteroids-linux_x64';
  if (!fs.existsSync(path.join(neuDist, linuxBin))) {
    throw new Error('Missing ' + linuxBin + ' in Neutralino dist');
  }
  copyFile(path.join(neuDist, linuxBin), path.join(out, linuxBin));
  // optional arm64
  if (fs.existsSync(path.join(neuDist, 'asteroids-linux_arm64'))) {
    copyFile(path.join(neuDist, 'asteroids-linux_arm64'), path.join(out, 'asteroids-linux_arm64'));
  }

  const nodeBin = await ensureNodeBinary('linux', 'x64');
  const runtimeDir = path.join(out, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  copyFile(nodeBin, path.join(runtimeDir, 'node'));

  writeCommonSteamFiles(out, 'AsteroidsArena.sh');
  copyFile(path.join(STEAM_DIR, 'AsteroidsArena.sh'), path.join(out, 'AsteroidsArena.sh'));

  fs.writeFileSync(path.join(out, 'README-STEAM.txt'), [
    'Asteroids Arena Online — Linux Steam depot',
    '',
    'Steamworks Launch Option (Linux):',
    '  Executable: AsteroidsArena.sh',
    '  Working Directory: (blank)',
    '',
    'If the script is not executable after upload, set FileProperties Attributes=1',
    'on AsteroidsArena.sh / runtime/node / asteroids-linux_x64 in the depot VDF,',
    'or Launch Option Executable: runtime/node  Arguments: steam/launch-game.js',
    ''
  ].join('\n'));

  console.log('Linux depot:', out);
  return out;
}

async function packMac(neuDist) {
  const out = path.join(DIST, 'steam-depot-macos');
  rmDir(out);
  fs.mkdirSync(out, { recursive: true });
  copySharedResources(neuDist, out);

  const macCandidates = ['asteroids-mac_universal', 'asteroids-mac_arm64', 'asteroids-mac_x64'];
  let macBin = macCandidates.find((n) => fs.existsSync(path.join(neuDist, n)));
  if (!macBin) throw new Error('No macOS Neutralino binary in dist');
  copyFile(path.join(neuDist, macBin), path.join(out, macBin));
  // Prefer shipping universal under a stable name when present
  if (macBin === 'asteroids-mac_universal') {
    // keep as-is; launch-game resolves it
  }

  const runtimeDir = path.join(out, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const nodeX64 = await ensureNodeBinary('darwin', 'x64');
  const nodeArm = await ensureNodeBinary('darwin', 'arm64');
  copyFile(nodeX64, path.join(runtimeDir, 'node-x64'));
  copyFile(nodeArm, path.join(runtimeDir, 'node-arm64'));
  // default "node" → arm64 (Apple Silicon majority); script also probes -x64
  copyFile(nodeArm, path.join(runtimeDir, 'node'));

  writeCommonSteamFiles(out, 'AsteroidsArena.sh');
  copyFile(path.join(STEAM_DIR, 'AsteroidsArena.sh'), path.join(out, 'AsteroidsArena.sh'));

  fs.writeFileSync(path.join(out, 'README-STEAM.txt'), [
    'Asteroids Arena Online — macOS Steam depot',
    '',
    'Steamworks Launch Option (macOS):',
    '  Executable: AsteroidsArena.sh',
    '  Working Directory: (blank)',
    '',
    'Includes Node runtimes for Intel (node-x64) and Apple Silicon (node-arm64).',
    'Game binary: ' + macBin,
    ''
  ].join('\n'));

  console.log('macOS depot:', out);
  return out;
}

async function main() {
  console.log('=== 1/3 Building Neutralino Steam package ===');
  run(process.execPath, [path.join(STEAM_DIR, 'run-steam.js'), '--build']);

  const neuDist = path.join(DIST, 'asteroids');
  if (!fs.existsSync(neuDist)) {
    console.error('Neutralino dist not found at', neuDist);
    process.exit(1);
  }

  console.log('=== 2/3 Assembling Steam depots ===');
  await packWindows(neuDist);
  if (!WINDOWS_ONLY) {
    await packLinux(neuDist);
    await packMac(neuDist);
  }

  console.log('=== 3/3 Done ===');
  console.log('Upload each folder as its own SteamPipe depot (OS filter in Steamworks).');
  console.log('  Windows:', path.join(DIST, 'steam-depot-windows'));
  if (!WINDOWS_ONLY) {
    console.log('  Linux:  ', path.join(DIST, 'steam-depot-linux'));
    console.log('  macOS:  ', path.join(DIST, 'steam-depot-macos'));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
