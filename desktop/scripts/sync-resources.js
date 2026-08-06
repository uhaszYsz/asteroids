'use strict';

/**
 * Copy the browser client into desktop/resources for Neutralino.
 * Run from repo root:
 *   node desktop/scripts/sync-resources.js
 *   node desktop/scripts/sync-resources.js --steam
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const DESKTOP = path.resolve(__dirname, '..');
const RES = path.join(DESKTOP, 'resources');
const STEAM_DIR = path.join(DESKTOP, 'steam');
const WITH_STEAM = process.argv.includes('--steam');

const FILES = [
  'index.html',
  'game.js',
  'music.js',
  'sw.js',
  'ship-meshes.js',
  'alien-ship-meshes.js'
];

const DIRS = [
  'lib',
  'sim',
  'sounds',
  'music',
  'sprites',
  'textures'
];

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

function patchIndex(html) {
  let boot = `
<script src="js/neutralino.js"></script>
<script>
(function () {
  if (typeof Neutralino === 'undefined') return;
  Neutralino.init();
  Neutralino.events.on('windowClose', function () {
    Neutralino.app.exit();
  });
})();
</script>`;

  if (WITH_STEAM) {
    boot += `\n<script src="steam/boot-steam.js"></script>`;
  }

  if (html.includes('js/neutralino.js')) {
    // Already patched from a previous sync copy — rebuild from source instead.
    return html;
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', boot + '\n</head>');
  }
  return boot + html;
}

// Preserve Neutralino client + icons across resync.
const keepJs = path.join(RES, 'js');
const keepIcons = path.join(RES, 'icons');
const tmpKeep = path.join(DESKTOP, '.sync-keep');
rmDir(tmpKeep);
fs.mkdirSync(tmpKeep, { recursive: true });
if (fs.existsSync(keepJs)) copyDir(keepJs, path.join(tmpKeep, 'js'));
if (fs.existsSync(keepIcons)) copyDir(keepIcons, path.join(tmpKeep, 'icons'));

rmDir(RES);
fs.mkdirSync(RES, { recursive: true });

for (const f of FILES) {
  const src = path.join(PUBLIC, f);
  if (!fs.existsSync(src)) {
    console.warn('skip missing', f);
    continue;
  }
  if (f === 'index.html') {
    const html = patchIndex(fs.readFileSync(src, 'utf8'));
    fs.writeFileSync(path.join(RES, f), html);
  } else {
    copyFile(src, path.join(RES, f));
  }
}

for (const d of DIRS) {
  copyDir(path.join(PUBLIC, d), path.join(RES, d));
}

// Desktop-specific server config (do not use repo config.js empty default).
copyFile(path.join(DESKTOP, 'config.client.js'), path.join(RES, 'config.js'));

if (fs.existsSync(path.join(tmpKeep, 'js'))) {
  copyDir(path.join(tmpKeep, 'js'), path.join(RES, 'js'));
}
if (fs.existsSync(path.join(tmpKeep, 'icons'))) {
  copyDir(path.join(tmpKeep, 'icons'), path.join(RES, 'icons'));
}
rmDir(tmpKeep);

fs.mkdirSync(path.join(RES, 'js'), { recursive: true });
fs.mkdirSync(path.join(RES, 'icons'), { recursive: true });

const iconSrc = path.join(DESKTOP, 'appIcon.png');
if (fs.existsSync(iconSrc)) {
  copyFile(iconSrc, path.join(RES, 'icons', 'appIcon.png'));
}

if (WITH_STEAM) {
  const steamOut = path.join(RES, 'steam');
  fs.mkdirSync(steamOut, { recursive: true });
  copyFile(path.join(STEAM_DIR, 'boot-steam.js'), path.join(steamOut, 'boot-steam.js'));
  const sessionSrc = path.join(STEAM_DIR, 'session.json');
  if (fs.existsSync(sessionSrc)) {
    copyFile(sessionSrc, path.join(steamOut, 'session.json'));
  } else {
    fs.writeFileSync(path.join(steamOut, 'session.json'), JSON.stringify({
      ok: 0,
      err: 'no_session',
      detail: 'Run desktop/steam/bridge.js first',
      at: Date.now()
    }, null, 2));
  }
}

console.log('Synced client → desktop/resources' + (WITH_STEAM ? ' (STEAM)' : ''));
