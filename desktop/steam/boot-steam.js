/**
 * Injected ONLY into Neutralino Steam builds (not browser, not plain desktop).
 * Prefer steam_session.json next to the .exe (written by the Steam launcher each run),
 * then fall back to bundled steam/session.json for local neu run.
 *
 * Must wait for Neutralino "ready" before filesystem APIs work.
 */
(function () {
  window.__ASTEROIDS_STEAM__ = window.__ASTEROIDS_STEAM__ || { pending: true };

  function fail(err, detail) {
    window.__ASTEROIDS_STEAM__ = { ok: 0, err: err || 'fail', detail: detail || '', pending: false };
    try { console.warn('[steam]', err, detail || ''); } catch (_) {}
  }

  function ok(data) {
    window.__ASTEROIDS_STEAM__ = {
      ok: 1,
      pending: false,
      steamId: data.steamId,
      personaName: data.personaName || '',
      ticketHex: data.ticketHex,
      identity: data.identity || 'asteroids-game-server',
      appId: data.appId || ''
    };
    try { console.log('[steam] session ready', data.personaName || data.steamId); } catch (_) {}
  }

  function apply(data) {
    if (!data || !data.ok || !data.ticketHex) {
      fail((data && data.err) || 'session', data && data.detail);
      return false;
    }
    ok(data);
    return true;
  }

  function fromFetch() {
    return fetch('steam/session.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!apply(data)) return;
      })
      .catch(function (e) {
        fail('session_fetch', String(e && e.message || e));
      });
  }

  function sessionPath() {
    var base = (typeof NL_PATH === 'string' && NL_PATH) ? NL_PATH : '';
    // Neutralino accepts / on Windows; also try native separator.
    return [
      base + '/steam_session.json',
      base + '\\steam_session.json'
    ];
  }

  function readDiskOnce() {
    if (typeof Neutralino === 'undefined' || !Neutralino.filesystem) {
      return Promise.reject(new Error('no_filesystem'));
    }
    var paths = sessionPath();
    var i = 0;
    function next() {
      if (i >= paths.length) return Promise.reject(new Error('missing_session_file'));
      var p = paths[i++];
      return Neutralino.filesystem.readFile(p).catch(function () { return next(); });
    }
    return next();
  }

  function fromDiskWithRetry(attempt) {
    attempt = attempt || 0;
    return readDiskOnce()
      .then(function (raw) {
        var data = JSON.parse(raw);
        if (apply(data)) return;
        // Placeholder / stale — retry a few times (launcher may still be writing).
        if (attempt < 15) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(fromDiskWithRetry(attempt + 1));
            }, 150);
          });
        }
        return fromFetch();
      })
      .catch(function () {
        if (attempt < 15) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(fromDiskWithRetry(attempt + 1));
            }, 150);
          });
        }
        return fromFetch();
      });
  }

  function start() {
    fromDiskWithRetry(0);
  }

  if (typeof Neutralino !== 'undefined' && Neutralino.events && Neutralino.events.on) {
    Neutralino.events.on('ready', start);
    // If ready already fired before this script loaded, still try shortly.
    setTimeout(function () {
      if (window.__ASTEROIDS_STEAM__ && window.__ASTEROIDS_STEAM__.pending) start();
    }, 500);
  } else {
    start();
  }
})();
