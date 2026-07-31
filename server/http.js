/** @file server/http.js — loaded into shared server scope (do not require() alone). */
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.mod': 'audio/x-mod',
  '.xm': 'audio/x-xm',
  '.gz': 'application/gzip',
  '.json': 'application/json'
};

/** Client static root (browser URLs stay /sprites/... etc.). */
const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      rooms: rooms.size,
      queue: matchQueue.length,
      steamAuth: steamAuth.configured() ? 1 : 0
    }));
    return;
  }
  let file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try { file = decodeURIComponent(file); } catch (_) {}
  file = String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
  // Never expose tooling / path traversal over the public HTTP server.
  if (!file || file.includes('..') || /^(?:desktop|node_modules|\.git)(?:\/|$)/i.test(file)) {
    res.writeHead(404); res.end(); return;
  }
  const fp = path.join(PUBLIC_DIR, file);
  if (!fp.startsWith(PUBLIC_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  const ext = path.extname(fp);
  const base = path.basename(fp);
  const headers = { 'Content-Type': MIME[ext] || 'text/plain' };
  // HTML / SW / manifest must revalidate so deploys take effect.
  if (base === 'index.html' || base === 'sw.js' || base === 'asset-manifest.json') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else {
    // Long-lived; service worker also hash-keys assets. Query ?v= still busts browsers without SW.
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }
  res.writeHead(200, headers);
  fs.createReadStream(fp).pipe(res);
});

const wss = new WebSocketServer({ server });

/** Shared console admin password (default hardcoded; change via `password`). */
const ADMIN_PASS_DEFAULT = 'admin1';
const ADMIN_PASS_FILE = path.join(__dirname, 'admin-password.txt');
let adminPassword = ADMIN_PASS_DEFAULT;

function loadAdminPassword() {
  try {
    if (fs.existsSync(ADMIN_PASS_FILE)) {
      const s = String(fs.readFileSync(ADMIN_PASS_FILE, 'utf8') || '').trim();
      if (s) adminPassword = s;
    }
  } catch (_) {}
}

function saveAdminPassword(pw) {
  adminPassword = String(pw);
  try {
    fs.writeFileSync(ADMIN_PASS_FILE, adminPassword + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to save admin password:', err.message || err);
  }
}

loadAdminPassword();
