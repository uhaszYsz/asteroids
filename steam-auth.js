'use strict';

/**
 * Steam Web API ticket verification (server-only).
 * Requires env:
 *   STEAM_WEB_API_KEY  — publisher/web API key from Steamworks
 *   STEAM_APP_ID       — your Steam AppID
 *
 * Identity must match the string used in GetAuthTicketForWebApi on the client.
 */

const https = require('https');
const { URL } = require('url');

const DEFAULT_IDENTITY = 'asteroids-game-server';

function configured() {
  const key = String(process.env.STEAM_WEB_API_KEY || '').trim();
  const appId = String(process.env.STEAM_APP_ID || '').trim();
  return !!(key && appId);
}

function identity() {
  return String(process.env.STEAM_AUTH_IDENTITY || DEFAULT_IDENTITY).trim() || DEFAULT_IDENTITY;
}

function appId() {
  return String(process.env.STEAM_APP_ID || '').trim();
}

/**
 * @param {string} ticketHex hex-encoded ticket from GetAuthTicketForWebApi
 * @param {string} [ticketIdentity] must match client identity string
 * @returns {Promise<{ ok: true, steamId: string } | { ok: false, err: string }>}
 */
function authenticateTicket(ticketHex, ticketIdentity) {
  if (!configured()) {
    return Promise.resolve({ ok: false, err: 'disabled' });
  }
  const hex = String(ticketHex || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex) || hex.length < 32 || hex.length > 8192) {
    return Promise.resolve({ ok: false, err: 'ticket' });
  }
  const id = String(ticketIdentity || identity()).trim() || identity();
  const key = String(process.env.STEAM_WEB_API_KEY || '').trim();
  const aid = appId();

  const u = new URL('https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/');
  u.searchParams.set('key', key);
  u.searchParams.set('appid', aid);
  u.searchParams.set('ticket', hex);
  u.searchParams.set('identity', id);

  return new Promise((resolve) => {
    const req = https.get(u, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const params = json && json.response && json.response.params;
          if (params && params.result === 'OK' && params.steamid) {
            resolve({ ok: true, steamId: String(params.steamid) });
            return;
          }
          const err = (json && json.response && (json.response.error && json.response.error.errordesc))
            || (params && params.result)
            || 'reject';
          resolve({ ok: false, err: String(err) });
        } catch (_) {
          resolve({ ok: false, err: 'parse' });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, err: 'network' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
  });
}

module.exports = {
  DEFAULT_IDENTITY,
  configured,
  identity,
  appId,
  authenticateTicket
};
