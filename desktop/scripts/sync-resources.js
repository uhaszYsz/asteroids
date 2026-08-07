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
  // Neutralino: SW registration 404s / breaks asset loads (black WebGL, UI-only).
  html = html.replace(/\r\n/g, '\n').replace(
    /\n  <script>\n    \/\/ Hash-keyed asset cache:[\s\S]*?\n  <\/script>\n/,
    '\n  <!-- serviceWorker disabled for Neutralino desktop -->\n'
  );

  let boot = `
<script src="js/neutralino.js"></script>
<script>
(function () {
  if (typeof Neutralino === 'undefined') return;
  Neutralino.init();
  // Block browser/WebView DevTools shortcuts in the shipped desktop shell.
  document.addEventListener('keydown', function (e) {
    var k = e.key || '';
    if (k === 'F12' || (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c'))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  // Drop any SW that slipped in from a prior session.
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      });
    }
  } catch (_) {}
  var covering = false;
  var coveredOnce = false;
  function coverDisplay(force) {
    if (covering) return Promise.resolve();
    if (coveredOnce && !force) return Promise.resolve();
    covering = true;
    // One-shot borderless fullscreen. Do NOT refocus / resize on a timer —
    // that steals focus from dropdowns and Windows Snipping Tool.
    return Promise.resolve()
      .then(function () { return Neutralino.window.setAlwaysOnTop(true); })
      .catch(function () {})
      .then(function () {
        return Neutralino.window.isMaximized().then(function (m) {
          return m ? Neutralino.window.unmaximize() : null;
        });
      })
      .catch(function () {})
      .then(function () { return Neutralino.window.setFullScreen(true); })
      .catch(function () {})
      .then(function () { return Neutralino.computer.getDisplays(); })
      .then(function (displays) {
        var d = displays && displays[0];
        var rw = d && d.resolution && d.resolution.width;
        var rh = d && d.resolution && d.resolution.height;
        var w = Math.max(screen.width || 0, rw || 0, 800);
        var h = Math.max(screen.height || 0, rh || 0, 600);
        return Neutralino.window.setSize({ width: w, height: h, resizable: false })
          .then(function () { return Neutralino.window.move(0, 0); });
      })
      .catch(function () {
        try {
          Neutralino.window.setSize({
            width: screen.width || 1920,
            height: screen.height || 1080,
            resizable: false
          });
          Neutralino.window.move(0, 0);
        } catch (_) {}
      })
      .then(function () {
        try { Neutralino.window.setAlwaysOnTop(true); } catch (_) {}
        coveredOnce = true;
      })
      .then(function () { covering = false; }, function () { covering = false; });
  }
  coverDisplay(true);
  setTimeout(function () { coverDisplay(true); }, 300);
  try {
    Neutralino.events.on('windowRestore', function () {
      coveredOnce = false;
      setTimeout(function () { coverDisplay(true); }, 100);
    });
  } catch (_) {}
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
