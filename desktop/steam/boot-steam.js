/**
 * Injected ONLY into Neutralino Steam builds (not browser, not plain desktop).
 * Reads /steam/session.json from the Neutralino static server and exposes
 * window.__ASTEROIDS_STEAM__ for game.js.
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

  fetch('steam/session.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!data || !data.ok || !data.ticketHex) {
        fail((data && data.err) || 'session', data && data.detail);
        return;
      }
      ok(data);
    })
    .catch(function (e) {
      fail('session_fetch', String(e && e.message || e));
    });
})();
