/* Asteroids asset service worker: hash-keyed forever cache, GitHub/jsDelivr first, origin fallback. */
/* eslint-disable no-restricted-globals */

const META_CACHE = 'asteroids-meta-v1';
const ASSET_CACHE = 'asteroids-assets-v1';
/** Repo path prefix for client files (browser URLs omit this; CDN needs it). */
const REPO_PUBLIC = 'public';
const MANIFEST_URLS = (repo, ref) => ([
  `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${REPO_PUBLIC}/asset-manifest.json`,
  `https://raw.githubusercontent.com/${repo}/${ref}/${REPO_PUBLIC}/asset-manifest.json`,
  './asset-manifest.json'
]);

let manifest = null; // { repo, ref, files: { path: hash } }

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await refreshManifest();
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await refreshManifest();
    await pruneStaleAssets();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SYNC_ASSETS') return;
  event.waitUntil((async () => {
    await refreshManifest();
    await pruneStaleAssets();
    if (event.source) event.source.postMessage({ type: 'ASSETS_SYNCED', count: manifest ? Object.keys(manifest.files || {}).length : 0 });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Same-origin navigations / HTML: always network (keep deploys instant).
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) return;
  // Never touch API-ish endpoints.
  if (url.pathname === '/health' || url.pathname === '/sw.js') return;

  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.includes('..')) return;

  event.respondWith(handleAsset(req, rel));
});

async function handleAsset(req, rel) {
  if (!manifest) await refreshManifest();
  const hash = manifest && manifest.files && manifest.files[rel];
  if (!hash) {
    // Not in manifest — pass through to network (origin).
    try {
      return await fetch(req);
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  }

  const key = assetCacheRequest(rel, hash);
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;

  const body = await fetchAssetBody(rel, manifest.repo, manifest.ref);
  if (!body) {
    // Last resort: original request (origin + query).
    return fetch(req);
  }
  // Cache forever under content hash (immutable).
  await cache.put(key, body.clone());
  return body;
}

function assetCacheRequest(rel, hash) {
  return new Request(`https://asteroids-asset-cache.local/${hash}/${rel}`);
}

function cdnUrls(rel, repo, ref) {
  const enc = rel.split('/').map(encodeURIComponent).join('/');
  return [
    `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${REPO_PUBLIC}/${enc}`,
    `https://raw.githubusercontent.com/${repo}/${ref}/${REPO_PUBLIC}/${enc}`
  ];
}

async function fetchAssetBody(rel, repo, ref) {
  const urls = cdnUrls(rel, repo || 'uhaszYsz/asteroids', ref || 'main');
  // Origin fallback (same path, no query).
  urls.push(self.location.origin + '/' + rel.split('/').map(encodeURIComponent).join('/'));

  for (const u of urls) {
    try {
      const res = await fetch(u, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
      if (!res.ok) continue;
      // Re-wrap so we always expose a same-origin-ish response to the page.
      const buf = await res.arrayBuffer();
      const ctype = res.headers.get('Content-Type') || guessMime(rel);
      return new Response(buf, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': ctype,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Asteroids-Asset-Source': u
        }
      });
    } catch (_) { /* try next */ }
  }
  return null;
}

function guessMime(rel) {
  const ext = rel.split('.').pop().toLowerCase();
  const map = {
    js: 'text/javascript', json: 'application/json',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
    mod: 'audio/x-mod', xm: 'audio/x-xm'
  };
  return map[ext] || 'application/octet-stream';
}

async function refreshManifest() {
  // Prefer last-known repo/ref from meta cache for CDN manifest URL.
  let repo = 'uhaszYsz/asteroids';
  let ref = 'main';
  try {
    const meta = await caches.open(META_CACHE);
    const prev = await meta.match('manifest');
    if (prev) {
      const j = await prev.json();
      if (j.repo) repo = j.repo;
      if (j.ref) ref = j.ref;
    }
  } catch (_) { /* ignore */ }

  const candidates = MANIFEST_URLS(repo, ref);
  // Also try origin first for brand-new deploys where CDN may lag.
  candidates.push(self.location.origin + '/asset-manifest.json');

  for (const u of candidates) {
    try {
      const res = await fetch(u, { cache: 'no-cache', credentials: 'omit', mode: u.startsWith('http') ? 'cors' : 'same-origin' });
      if (!res.ok) continue;
      const j = await res.json();
      if (!j || !j.files || typeof j.files !== 'object') continue;
      manifest = j;
      const meta = await caches.open(META_CACHE);
      await meta.put('manifest', new Response(JSON.stringify(j), {
        headers: { 'Content-Type': 'application/json' }
      }));
      return manifest;
    } catch (_) { /* try next */ }
  }

  // Fall back to previously cached manifest.
  try {
    const meta = await caches.open(META_CACHE);
    const prev = await meta.match('manifest');
    if (prev) {
      manifest = await prev.json();
      return manifest;
    }
  } catch (_) { /* ignore */ }
  manifest = { repo, ref: 'main', files: {} };
  return manifest;
}

async function pruneStaleAssets() {
  if (!manifest || !manifest.files) return;
  const live = new Set();
  for (const [rel, hash] of Object.entries(manifest.files)) {
    live.add(`https://asteroids-asset-cache.local/${hash}/${rel}`);
  }
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.map((req) => {
    if (!live.has(req.url)) return cache.delete(req);
    return null;
  }));
}
