'use strict';

/**
 * Fetch a Steam Web API auth ticket and write desktop/steam/session.json
 * for the Neutralino Steam build to pick up.
 *
 * Requires:
 *   - Steam client running and logged in
 *   - STEAM_APP_ID env or desktop/steam/steam_appid.txt
 *   - npm install in desktop/steam (steamworks.js)
 *
 * Usage (from repo root):
 *   node desktop/steam/bridge.js
 */

const fs = require('fs');
const path = require('path');

const STEAM_DIR = __dirname;
const SESSION_FILE = path.join(STEAM_DIR, 'session.json');
const APPID_FILE = path.join(STEAM_DIR, 'steam_appid.txt');
const IDENTITY = process.env.STEAM_AUTH_IDENTITY || 'asteroids-game-server';

function readAppId() {
  if (process.env.STEAM_APP_ID) return String(process.env.STEAM_APP_ID).trim();
  if (fs.existsSync(APPID_FILE)) {
    return String(fs.readFileSync(APPID_FILE, 'utf8')).trim().split(/\s+/)[0];
  }
  return '';
}

function writeSession(obj) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2));
}

async function main() {
  const appId = readAppId();
  if (!appId) {
    writeSession({ ok: 0, err: 'no_appid', at: Date.now() });
    console.error('Set STEAM_APP_ID or create desktop/steam/steam_appid.txt');
    process.exit(1);
  }

  // steamworks.js looks for steam_appid.txt in cwd
  process.chdir(STEAM_DIR);
  if (!fs.existsSync(APPID_FILE)) {
    fs.writeFileSync(APPID_FILE, appId + '\n');
  }

  let steamworks;
  try {
    steamworks = require('steamworks.js');
  } catch (err) {
    writeSession({ ok: 0, err: 'no_steamworks', detail: String(err && err.message || err), at: Date.now() });
    console.error('Run: cd desktop/steam && npm install');
    process.exit(1);
  }

  let client;
  try {
    client = steamworks.init(Number(appId));
  } catch (err) {
    writeSession({ ok: 0, err: 'init', detail: String(err && err.message || err), at: Date.now() });
    console.error('SteamAPI_Init failed — is Steam running?', err);
    process.exit(1);
  }

  const steamId = String(client.localplayer.getSteamId().steamId64);
  const personaName = String(client.localplayer.getName() || '');

  let ticket;
  try {
    ticket = await client.auth.getAuthTicketForWebApi(IDENTITY, 45);
  } catch (err) {
    writeSession({
      ok: 0,
      err: 'ticket',
      steamId,
      personaName,
      detail: String(err && err.message || err),
      at: Date.now()
    });
    console.error('getAuthTicketForWebApi failed', err);
    process.exit(1);
  }

  const bytes = ticket.getBytes();
  const ticketHex = Buffer.from(bytes).toString('hex');

  const session = {
    ok: 1,
    appId: String(appId),
    identity: IDENTITY,
    steamId,
    personaName,
    ticketHex,
    at: Date.now()
  };
  writeSession(session);

  const outExtra = String(process.env.STEAM_SESSION_OUT || '').trim();
  if (outExtra) {
    fs.mkdirSync(path.dirname(outExtra), { recursive: true });
    fs.writeFileSync(outExtra, JSON.stringify(session, null, 2));
    console.log('Steam session also written:', outExtra);
  }

  console.log('Steam session written:', SESSION_FILE);
  console.log('steamId=', steamId, 'name=', personaName, 'ticketBytes=', bytes.length);

  // Do NOT cancel the ticket here — Neutralino starts afterward and the game server
  // must AuthenticateUserTicket while the ticket is still valid.
  // steamworks.js keeps native handles; force exit so launchers (spawnSync) continue.
  process.exit(0);
}

main().catch((err) => {
  writeSession({ ok: 0, err: 'crash', detail: String(err && err.message || err), at: Date.now() });
  console.error(err);
  process.exit(1);
});
