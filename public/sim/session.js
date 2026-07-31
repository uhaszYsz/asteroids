/** @file server/session.js — loaded into shared server scope (do not require() alone). */
function sanitizeName(raw) {
  const s = String(raw == null ? '' : raw)
    .toUpperCase()
    .replace(/[^A-Z0-9 _.\-]/g, '')
    .trim()
    .slice(0, 12);
  return s || null;
}

/** PIN callsign or Steam account key (`S` + SteamID64). */
function resolveAccountKey(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (/^S\d{10,22}$/i.test(s)) return 'S' + s.slice(1);
  return sanitizeName(s);
}

function defaultCallsign(id) {
  return CALLSIGN_POOL[(id | 0) % CALLSIGN_POOL.length] + '-' + String((id | 0) % 100).padStart(2, '0');
}

function randomGuestName() {
  const base = CALLSIGN_POOL[(Math.random() * CALLSIGN_POOL.length) | 0];
  const n = ((Math.random() * 100) | 0);
  return base + '-' + String(n).padStart(2, '0');
}

function sessionFields(ws) {
  const friends = (ws.registered && ws.accountKey)
    ? accountsDb.listFriends(ws.accountKey)
    : [];
  return {
    name: ws.displayName || 'PILOT',
    accountKey: ws.registered ? (ws.accountKey || null) : null,
    steam: !!(ws.steamId),
    registered: !!ws.registered,
    matchesWon: ws.matchesWon | 0,
    bestWaves: ws.bestWaves | 0,
    bestWavesDuo: ws.bestWavesDuo | 0,
    hasSnapshot: !!ws.soloSnapshot,
    playerColor: ws.playerColor || accountsDb.DEFAULT_PLAYER_COLOR,
    shootColor: ws.shootColor || accountsDb.DEFAULT_SHOOT_COLOR,
    shipId: ws.shipId || accountsDb.DEFAULT_SHIP_ID,
    friends
  };
}

function packSession(ws) {
  return Object.assign({ t: 'session' }, sessionFields(ws));
}

function sendSession(ws) {
  if (ws && ws.readyState === 1) send(ws, packSession(ws));
}

function initGuestSession(ws) {
  ws.registered = false;
  ws.accountKey = null;
  ws.steamId = null;
  ws.matchesWon = 0;
  ws.bestWaves = 0;
  ws.bestWavesDuo = 0;
  ws.soloSnapshot = null;
  ws.queueMode = null;
  ws.playerColor = accountsDb.DEFAULT_PLAYER_COLOR;
  ws.shootColor = accountsDb.DEFAULT_SHOOT_COLOR;
  ws.shipId = accountsDb.DEFAULT_SHIP_ID;
  ws.displayName = randomGuestName();
  ws.teamMate = null;
  ws.pendingTeamFrom = null;
}

function applyColorsToRoom(ws) {
  const room = ws.room;
  if (!room || ws.playerId == null) return;
  const p = room.players.get(ws.playerId);
  if (!p || p.bot) return;
  p.playerColor = ws.playerColor || accountsDb.DEFAULT_PLAYER_COLOR;
  p.shootColor = ws.shootColor || accountsDb.DEFAULT_SHOOT_COLOR;
  p.shipId = ws.shipId || accountsDb.DEFAULT_SHIP_ID;
  broadcastPlayerColors(room);
}

function packPlayerColors(room) {
  const rows = [];
  for (const p of room.players.values()) {
    if (p.bot) continue;
    rows.push([
      p.id,
      p.playerColor || accountsDb.DEFAULT_PLAYER_COLOR,
      p.shootColor || accountsDb.DEFAULT_SHOOT_COLOR,
      p.shipId || accountsDb.DEFAULT_SHIP_ID
    ]);
  }
  return rows;
}

function broadcastPlayerColors(room) {
  if (!room) return;
  roomBroadcast(room, { t: 'colors', colors: packPlayerColors(room) });
}

function handleSetColors(ws, playerColor, shootColor, shipId) {
  const pc = accountsDb.normalizeColor(playerColor);
  const sc = accountsDb.normalizeColor(shootColor);
  if (!pc || !sc) return { ok: 0, err: 'color' };
  ws.playerColor = pc;
  ws.shootColor = sc;
  let sid = null;
  if (shipId != null && String(shipId).length) {
    sid = accountsDb.normalizeShipId(shipId);
    if (!sid) return { ok: 0, err: 'ship' };
    ws.shipId = sid;
  }
  if (ws.registered && ws.accountKey) {
    const saved = accountsDb.setColors(ws.accountKey, pc, sc);
    if (!saved.ok) return { ok: 0, err: saved.err || 'fail' };
    if (sid) {
      const shipSaved = accountsDb.setShip(ws.accountKey, sid);
      if (!shipSaved.ok) return { ok: 0, err: shipSaved.err || 'fail' };
    }
  }
  applyColorsToRoom(ws);
  return {
    ok: 1,
    playerColor: pc,
    shootColor: sc,
    shipId: ws.shipId || accountsDb.DEFAULT_SHIP_ID
  };
}

function applyDisplayNameToRoom(ws, name) {
  const room = ws.room;
  if (!room || ws.playerId == null) return;
  const p = room.players.get(ws.playerId);
  if (!p || p.bot) return;
  p.name = name;
  roomBroadcast(room, { t: 'roster', names: packRosterNames(room) });
}

function handleSetName(ws, rawName) {
  const name = sanitizeName(rawName);
  if (!name) return { ok: 0, err: 'name' };
  if (ws.registered && ws.accountKey) {
    if (ws.steamId || String(ws.accountKey).charAt(0) === 'S') {
      const renamed = accountsDb.renameUser(ws.accountKey, name);
      if (!renamed.ok) return { ok: 0, err: renamed.err || 'taken' };
      ws.displayName = name;
      applyDisplayNameToRoom(ws, name);
      return { ok: 1 };
    }
    if (name !== ws.accountKey) {
      const renamed = accountsDb.renameUser(ws.accountKey, name);
      if (!renamed.ok) return { ok: 0, err: renamed.err || 'taken' };
      ws.accountKey = name;
    }
  } else if (accountsDb.getUser(name)) {
    // Guests may not claim a registered callsign.
    return { ok: 0, err: 'taken' };
  }
  ws.displayName = name;
  applyDisplayNameToRoom(ws, name);
  return { ok: 1 };
}

async function handleSteamLogin(ws, ticketHex, ticketIdentity, personaName) {
  if (!steamAuth.configured()) return { ok: 0, err: 'disabled' };
  if (ws.registered) return { ok: 0, err: 'already' };
  const verified = await steamAuth.authenticateTicket(ticketHex, ticketIdentity);
  if (!verified.ok) return { ok: 0, err: verified.err || 'reject' };
  const upserted = accountsDb.upsertSteamUser(verified.steamId, personaName);
  if (!upserted.ok) return { ok: 0, err: upserted.err || 'fail' };
  const u = upserted.user;
  ws.registered = true;
  ws.accountKey = upserted.key;
  ws.steamId = verified.steamId;
  ws.displayName = sanitizeName(u.displayName) || sanitizeName(personaName) || ('S' + String(verified.steamId).slice(-8));
  ws.matchesWon = u.matchesWon | 0;
  ws.bestWaves = u.bestWaves | 0;
  ws.bestWavesDuo = u.bestWavesDuo | 0;
  ws.playerColor = u.playerColor || accountsDb.DEFAULT_PLAYER_COLOR;
  ws.shootColor = u.shootColor || accountsDb.DEFAULT_SHOOT_COLOR;
  ws.shipId = accountsDb.normalizeShipId(u.shipId) || accountsDb.DEFAULT_SHIP_ID;
  applyDisplayNameToRoom(ws, ws.displayName);
  applyColorsToRoom(ws);
  return { ok: 1, created: upserted.created ? 1 : 0 };
}

function handleRegister(ws, pin, pinConfirm, rawName) {
  if (ws.registered) return { ok: 0, err: 'already' };
  if (rawName != null && String(rawName).trim()) {
    const renamed = handleSetName(ws, rawName);
    if (!renamed.ok) return renamed;
  }
  const name = sanitizeName(ws.displayName);
  if (!name) return { ok: 0, err: 'name' };
  const a = accountsDb.normalizePin(pin);
  const b = accountsDb.normalizePin(pinConfirm);
  if (!a || !b) return { ok: 0, err: 'pin' };
  if (a !== b) return { ok: 0, err: 'mismatch' };
  const created = accountsDb.createUser(name, a);
  if (!created.ok) return { ok: 0, err: created.err || 'fail' };
  ws.registered = true;
  ws.accountKey = name;
  ws.steamId = null;
  ws.displayName = name;
  ws.matchesWon = 0;
  ws.bestWaves = 0;
  ws.bestWavesDuo = 0;
  // Keep current session colors / ship on the new account.
  ws.playerColor = accountsDb.normalizeColor(ws.playerColor) || accountsDb.DEFAULT_PLAYER_COLOR;
  ws.shootColor = accountsDb.normalizeColor(ws.shootColor) || accountsDb.DEFAULT_SHOOT_COLOR;
  ws.shipId = accountsDb.normalizeShipId(ws.shipId) || accountsDb.DEFAULT_SHIP_ID;
  accountsDb.setColors(name, ws.playerColor, ws.shootColor);
  accountsDb.setShip(name, ws.shipId);
  applyDisplayNameToRoom(ws, name);
  applyColorsToRoom(ws);
  return { ok: 1 };
}

function handleLogin(ws, rawName, pin) {
  const name = sanitizeName(rawName);
  if (!name) return { ok: 0, err: 'name' };
  const verified = accountsDb.verifyUser(name, pin);
  if (!verified.ok) return { ok: 0, err: verified.err || 'pin' };
  ws.registered = true;
  ws.accountKey = name;
  ws.steamId = null;
  ws.displayName = name;
  ws.matchesWon = verified.user.matchesWon | 0;
  ws.bestWaves = verified.user.bestWaves | 0;
  ws.bestWavesDuo = verified.user.bestWavesDuo | 0;
  ws.playerColor = verified.user.playerColor || accountsDb.DEFAULT_PLAYER_COLOR;
  ws.shootColor = verified.user.shootColor || accountsDb.DEFAULT_SHOOT_COLOR;
  ws.shipId = accountsDb.normalizeShipId(verified.user.shipId) || accountsDb.DEFAULT_SHIP_ID;
  applyDisplayNameToRoom(ws, name);
  applyColorsToRoom(ws);
  return { ok: 1 };
}

function recordMatchWin(ws) {
  if (!ws || !ws.registered || !ws.accountKey) return;
  ws.matchesWon = accountsDb.addWin(ws.accountKey);
  sendSession(ws);
}

function recordBestWaves(ws, wave, duo) {
  if (!ws || !ws.registered || !ws.accountKey) return;
  const n = Math.max(0, wave | 0);
  if (duo) ws.bestWavesDuo = accountsDb.setBestWavesDuo(ws.accountKey, n);
  else ws.bestWaves = accountsDb.setBestWaves(ws.accountKey, n);
  sendSession(ws);
}

/** Wave rooms: solo wait, dedicated solo, and coop. */
function isWaveRoom(room) {
  return !!(room && room.practice);
}

/** No player-vs-player damage in coop (enemies still hurt players). */
function blocksFriendlyFire(room, attackerId) {
  if (!room || !room.coop) return false;
  return (attackerId | 0) > 0;
}
