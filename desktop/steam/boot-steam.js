/**
 * Injected ONLY into Neutralino Steam builds (not browser, not plain desktop).
 * Prefer steam_session.json next to the .exe (written by the Steam launcher each run),
 * then fall back to bundled steam/session.json for local neu run.
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

  function fromDiskThenFetch() {
    var hasNeu = typeof Neutralino !== 'undefined'
      && Neutralino.filesystem
      && typeof NL_PATH === 'string'
      && NL_PATH;
    if (!hasNeu) return fromFetch();

    Neutralino.filesystem.readFile(NL_PATH + '/steam_session.json')
      .then(function (raw) {
        try {
          if (apply(JSON.parse(raw))) return;
        } catch (e) {
          fail('session_parse', String(e && e.message || e));
          return;
        }
        return fromFetch();
      })
      .catch(function () {
        return fromFetch();
      });
  }

  fromDiskThenFetch();
})();
