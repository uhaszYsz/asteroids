/* Asteroids asset service worker: hash-keyed forever cache, origin-first + CDN fallback. */
/* eslint-disable no-restricted-globals */

const META_CACHE = 'asteroids-meta-v3';
const ASSET_CACHE = 'asteroids-assets-v3';
const OLD_CACHES = ['asteroids-meta-v1', 'asteroids-assets-v1', 'asteroids-meta-v2', 'asteroids-assets-v2'];
/** Always hit network for these — forever-cache once poisoned the live game.js parse. */
const NETWORK_ONLY = new Set(['game.js', 'config.js', 'music.js', 'sw.js', 'asset-manifest.json']);
/** Repo path prefix for client files (browser URLs omit this; CDN needs it). */
const REPO_PUBLIC = 'public';
const MANIFEST_URLS = (repo, ref, originManifest) => ([
  // Origin first — VPS `npm run manifest` must win over stale jsDelivr @main.
  originManifest,
  `https://raw.githubusercontent.com/${repo}/${ref}/${REPO_PUBLIC}/asset-manifest.json`,
  `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${REPO_PUBLIC}/asset-manifest.json`
].filter(Boolean));

let manifest = null; // { repo, ref, files: { path: hash } }

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await refreshManifest();
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all(OLD_CACHES.map((n) => caches.delete(n)));
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

/** Scope path prefix (e.g. "/asteroids/" or "/"). */
function scopePath() {
  try {
    return new URL(self.registration.scope).pathname || '/';
  } catch (_) {
    return '/';
  }
}

function scopeUrl(rel) {
  try {
    return new URL(rel.split('/').map(encodeURIComponent).join('/'), self.registration.scope).href;
  } catch (_) {
    return self.location.origin + '/' + rel.split('/').map(encodeURIComponent).join('/');
  }
}

/** Map request pathname → manifest-relative path (strip /asteroids/ etc.). */
function pathToRel(pathname) {
  const base = scopePath();
  let p = String(pathname || '');
  if (base && base !== '/' && p.startsWith(base)) p = p.slice(base.length);
  else p = p.replace(/^\//, '');
  return decodeURIComponent(p.replace(/^\//, ''));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Same-origin navigations / HTML: always network (keep deploys instant).
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) return;
  // Never touch API-ish endpoints (also /asteroids/health behind nginx).
  if (url.pathname.endsWith('/sw.js') || /\/health\/?$/.test(url.pathname)) return;

  const rel = pathToRel(url.pathname);
  if (!rel || rel.includes('..')) return;
  // Critical JS / manifest: never serve from SW cache (query-bust + origin only).
  if (NETWORK_ONLY.has(rel) || rel.endsWith('/sw.js')) return;

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

  const body = await fetchAssetBody(rel, hash, manifest.repo, manifest.ref);
  if (!body) {
    // Last resort: original request (origin + query).
    return fetch(req);
  }
  // Cache forever under content hash (immutable) — only after hash verify.
  await cache.put(key, body.clone());
  return body;
}

function assetCacheRequest(rel, hash) {
  return new Request(`https://asteroids-asset-cache.local/${hash}/${rel}`);
}

function assetFetchUrls(rel, repo, ref) {
  const enc = rel.split('/').map(encodeURIComponent).join('/');
  return [
    // Origin first so a VPS deploy is not blocked by stale jsDelivr @main.
    scopeUrl(rel),
    `https://raw.githubusercontent.com/${repo}/${ref}/${REPO_PUBLIC}/${enc}`,
    `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${REPO_PUBLIC}/${enc}`
  ];
}

async function sha256hex(buf) {
  const dig = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchAssetBody(rel, expectedHash, repo, ref) {
  const urls = assetFetchUrls(rel, repo || 'uhaszYsz/asteroids', ref || 'main');

  for (const u of urls) {
    try {
      const res = await fetch(u, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (expectedHash) {
        const got = await sha256hex(buf);
        if (got !== expectedHash) continue; // stale CDN / wrong body
      }
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

  const candidates = MANIFEST_URLS(repo, ref, scopeUrl('asset-manifest.json'));

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
