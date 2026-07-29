'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'accounts.json');

const DEFAULT_PLAYER_COLOR = '#59D9FF';
const DEFAULT_SHOOT_COLOR = '#59F2FF';

/** @type {{ users: Record<string, object> }} */
let data = { users: {} };

/** Accept #RGB / #RRGGBB → normalized #RRGGBB uppercase, or null. */
function normalizeColor(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

function migrateUser(u) {
  if (!u || typeof u !== 'object') return u;
  if (u.matchesWon == null) u.matchesWon = 0;
  if (u.bestWaves == null) u.bestWaves = 0;
  if (u.bestWavesDuo == null) u.bestWavesDuo = 0;
  if (!Array.isArray(u.friends)) u.friends = [];
  u.playerColor = normalizeColor(u.playerColor) || DEFAULT_PLAYER_COLOR;
  u.shootColor = normalizeColor(u.shootColor) || DEFAULT_SHOOT_COLOR;
  if (u.steamId != null) u.steamId = String(u.steamId);
  if (u.displayName != null) u.displayName = String(u.displayName);
  return u;
}

/** Stable account key for a SteamID64. */
function steamAccountKey(steamId) {
  const id = String(steamId == null ? '' : steamId).replace(/\D/g, '');
  if (id.length < 10) return null;
  return 'S' + id;
}

/**
 * Create or load a Steam-backed account (no PIN).
 * @returns {{ ok: 1, key: string, user: object, created: boolean } | { ok: 0, err: string }}
 */
function upsertSteamUser(steamId, personaName) {
  const key = steamAccountKey(steamId);
  if (!key) return { ok: 0, err: 'steamid' };
  const existing = data.users[key];
  if (existing) {
    migrateUser(existing);
    if (personaName) {
      const dn = String(personaName).trim().slice(0, 32);
      if (dn) existing.displayName = dn;
    }
    existing.lastSteamLoginAt = Date.now();
    save();
    return { ok: 1, key, user: existing, created: false };
  }
  const dn = String(personaName || '').trim().slice(0, 32) || key;
  data.users[key] = {
    steamId: String(steamId).replace(/\D/g, ''),
    displayName: dn,
    matchesWon: 0,
    bestWaves: 0,
    bestWavesDuo: 0,
    friends: [],
    playerColor: DEFAULT_PLAYER_COLOR,
    shootColor: DEFAULT_SHOOT_COLOR,
    createdAt: Date.now(),
    lastSteamLoginAt: Date.now()
  };
  save();
  return { ok: 1, key, user: data.users[key], created: true };
}

function load() {
  try {
    if (!fs.existsSync(FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return;
    const users = parsed.users && typeof parsed.users === 'object' ? parsed.users : {};
    for (const k of Object.keys(users)) users[k] = migrateUser(users[k]);
    data = { users };
  } catch (err) {
    console.error('accounts load failed:', err.message || err);
    data = { users: {} };
  }
}

function save() {
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('accounts save failed:', err.message || err);
  }
}

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), String(salt), 32).toString('hex');
}

/** PIN must be exactly 4 digits. */
function normalizePin(pin) {
  const s = String(pin == null ? '' : pin).replace(/\D/g, '').slice(0, 4);
  return s.length === 4 ? s : null;
}

function getUser(username) {
  if (!username) return null;
  return data.users[username] || null;
}

function createUser(username, pin) {
  if (!username) return { ok: 0, err: 'name' };
  if (data.users[username]) return { ok: 0, err: 'taken' };
  const clean = normalizePin(pin);
  if (!clean) return { ok: 0, err: 'pin' };
  const salt = crypto.randomBytes(16).toString('hex');
  data.users[username] = {
    pinHash: hashPin(clean, salt),
    salt,
    matchesWon: 0,
    bestWaves: 0,
    bestWavesDuo: 0,
    friends: [],
    playerColor: DEFAULT_PLAYER_COLOR,
    shootColor: DEFAULT_SHOOT_COLOR,
    createdAt: Date.now()
  };
  save();
  return { ok: 1, user: data.users[username] };
}

function verifyUser(username, pin) {
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  const clean = normalizePin(pin);
  if (!clean) return { ok: 0, err: 'pin' };
  if (hashPin(clean, u.salt) !== u.pinHash) return { ok: 0, err: 'pin' };
  migrateUser(u);
  return { ok: 1, user: u };
}

function addWin(username) {
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  u.matchesWon = (u.matchesWon | 0) + 1;
  save();
  return u.matchesWon | 0;
}

function setBestWaves(username, wave) {
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  const w = Math.max(0, wave | 0);
  if (w > (u.bestWaves | 0)) {
    u.bestWaves = w;
    save();
  }
  return u.bestWaves | 0;
}

function setBestWavesDuo(username, wave) {
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  const w = Math.max(0, wave | 0);
  if (w > (u.bestWavesDuo | 0)) {
    u.bestWavesDuo = w;
    save();
  }
  return u.bestWavesDuo | 0;
}

function setColors(username, playerColor, shootColor) {
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  migrateUser(u);
  const pc = normalizeColor(playerColor);
  const sc = normalizeColor(shootColor);
  if (!pc || !sc) return { ok: 0, err: 'color' };
  u.playerColor = pc;
  u.shootColor = sc;
  save();
  return { ok: 1, playerColor: pc, shootColor: sc };
}

function renameUser(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return { ok: 1 };
  if (!data.users[oldName]) return { ok: 0, err: 'missing' };
  const u = migrateUser(data.users[oldName]);
  // Steam accounts keep a fixed key; only the display name changes.
  if (u.steamId) {
    u.displayName = String(newName).trim().slice(0, 32) || u.displayName;
    save();
    return { ok: 1, user: u, displayOnly: true };
  }
  if (data.users[newName]) return { ok: 0, err: 'taken' };
  data.users[newName] = u;
  delete data.users[oldName];
  for (const k of Object.keys(data.users)) {
    const ou = data.users[k];
    if (!Array.isArray(ou.friends)) continue;
    for (let i = 0; i < ou.friends.length; i++) {
      if (ou.friends[i] === oldName) ou.friends[i] = newName;
    }
  }
  save();
  return { ok: 1, user: data.users[newName] };
}

function listFriends(username) {
  const u = getUser(username);
  if (!u) return [];
  migrateUser(u);
  return (u.friends || []).slice();
}

/** Mutual friend add (both registered). */
function addFriend(username, friendName) {
  if (!username || !friendName || username === friendName) return { ok: 0, err: 'name' };
  const u = data.users[username];
  const f = data.users[friendName];
  if (!u || !f) return { ok: 0, err: 'missing' };
  migrateUser(u);
  migrateUser(f);
  if (!u.friends.includes(friendName)) u.friends.push(friendName);
  if (!f.friends.includes(username)) f.friends.push(username);
  save();
  return { ok: 1, friends: u.friends.slice() };
}

function removeFriend(username, friendName) {
  if (!username || !friendName) return { ok: 0, err: 'name' };
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  migrateUser(u);
  u.friends = (u.friends || []).filter((n) => n !== friendName);
  const f = data.users[friendName];
  if (f) {
    migrateUser(f);
    f.friends = (f.friends || []).filter((n) => n !== username);
  }
  save();
  return { ok: 1, friends: u.friends.slice() };
}

/** Public leaderboard rows (no secrets). */
function listLeaderboard() {
  const rows = [];
  for (const name of Object.keys(data.users)) {
    const u = migrateUser(data.users[name]);
    rows.push({
      name: u.displayName || name,
      accountKey: name,
      steam: !!u.steamId,
      wins: u.matchesWon | 0,
      bestWaves: u.bestWaves | 0,
      bestWavesDuo: u.bestWavesDuo | 0
    });
  }
  return rows;
}

load();

module.exports = {
  normalizePin,
  normalizeColor,
  DEFAULT_PLAYER_COLOR,
  DEFAULT_SHOOT_COLOR,
  getUser,
  createUser,
  verifyUser,
  steamAccountKey,
  upsertSteamUser,
  addWin,
  setBestWaves,
  setBestWavesDuo,
  setColors,
  renameUser,
  listFriends,
  addFriend,
  removeFriend,
  listLeaderboard
};
