'use strict';

/**
 * Accounts store — SQLite (same approach as pro/server/database.js).
 * Hot path stays sync via an in-memory cache; SQLite is the durable source of truth.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.ACCOUNTS_DB_PATH
  ? path.resolve(process.env.ACCOUNTS_DB_PATH)
  : path.join(__dirname, 'accounts.db');
const JSON_LEGACY = path.join(__dirname, 'accounts.json');

const DEFAULT_PLAYER_COLOR = '#59D9FF';
const DEFAULT_SHOOT_COLOR = '#59F2FF';
const DEFAULT_SHIP_ID = 'tiny_1';

/** Accept ship id like tiny_1 / arrow — alphanumeric + underscore, max 32. */
function normalizeShipId(raw) {
  const s = String(raw == null ? '' : raw).trim().slice(0, 32);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(s)) return null;
  return s;
}

/** @type {{ users: Record<string, object> }} */
let data = { users: {} };

/** @type {import('sqlite3').Database | null} */
let db = null;
let readyDone = false;

/** @type {{ resolve: Function, reject: Function }} */
let readyResolve;
const ready = new Promise((resolve, reject) => {
  readyResolve = { resolve, reject };
});

function ensureReady() {
  if (!readyDone) {
    throw new Error('accounts-db not ready; await accounts.ready first');
  }
}

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
  u.shipId = normalizeShipId(u.shipId) || DEFAULT_SHIP_ID;
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

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), String(salt), 32).toString('hex');
}

/** PIN must be exactly 4 digits. */
function normalizePin(pin) {
  const s = String(pin == null ? '' : pin).replace(/\D/g, '').slice(0, 4);
  return s.length === 4 ? s : null;
}

function rowToUser(row) {
  if (!row) return null;
  let friends = [];
  try {
    friends = JSON.parse(row.friends || '[]');
  } catch (_) {
    friends = [];
  }
  if (!Array.isArray(friends)) friends = [];
  return migrateUser({
    pinHash: row.pin_hash || undefined,
    salt: row.salt || undefined,
    steamId: row.steam_id || undefined,
    displayName: row.display_name || undefined,
    matchesWon: row.matches_won | 0,
    bestWaves: row.best_waves | 0,
    bestWavesDuo: row.best_waves_duo | 0,
    friends,
    playerColor: row.player_color,
    shootColor: row.shoot_color,
    shipId: row.ship_id,
    createdAt: row.created_at || undefined,
    lastSteamLoginAt: row.last_steam_login_at || undefined
  });
}

function userToParams(username, u) {
  migrateUser(u);
  return [
    username,
    u.pinHash || null,
    u.salt || null,
    u.steamId || null,
    u.displayName || null,
    u.matchesWon | 0,
    u.bestWaves | 0,
    u.bestWavesDuo | 0,
    JSON.stringify(u.friends || []),
    u.playerColor || DEFAULT_PLAYER_COLOR,
    u.shootColor || DEFAULT_SHOOT_COLOR,
    u.shipId || DEFAULT_SHIP_ID,
    u.createdAt || null,
    u.lastSteamLoginAt || null
  ];
}

const UPSERT_SQL = `
INSERT INTO users (
  username, pin_hash, salt, steam_id, display_name,
  matches_won, best_waves, best_waves_duo, friends,
  player_color, shoot_color, ship_id, created_at, last_steam_login_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(username) DO UPDATE SET
  pin_hash = excluded.pin_hash,
  salt = excluded.salt,
  steam_id = excluded.steam_id,
  display_name = excluded.display_name,
  matches_won = excluded.matches_won,
  best_waves = excluded.best_waves,
  best_waves_duo = excluded.best_waves_duo,
  friends = excluded.friends,
  player_color = excluded.player_color,
  shoot_color = excluded.shoot_color,
  ship_id = excluded.ship_id,
  created_at = excluded.created_at,
  last_steam_login_at = excluded.last_steam_login_at
`;

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function persistUser(username, u) {
  if (!db) return;
  const params = userToParams(username, u);
  db.run(UPSERT_SQL, params, (err) => {
    if (err) console.error('accounts upsert failed:', err.message || err);
  });
}

function deleteUserRow(username) {
  if (!db) return;
  db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
    if (err) console.error('accounts delete failed:', err.message || err);
  });
}

function persistMany(usernames) {
  if (!db) return;
  db.serialize(() => {
    db.run('BEGIN');
    for (const name of usernames) {
      const u = data.users[name];
      if (!u) continue;
      db.run(UPSERT_SQL, userToParams(name, u));
    }
    db.run('COMMIT', (err) => {
      if (err) console.error('accounts commit failed:', err.message || err);
    });
  });
}

function loadLegacyJson() {
  try {
    if (!fs.existsSync(JSON_LEGACY)) return null;
    const parsed = JSON.parse(fs.readFileSync(JSON_LEGACY, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const users = parsed.users && typeof parsed.users === 'object' ? parsed.users : {};
    for (const k of Object.keys(users)) users[k] = migrateUser(users[k]);
    return users;
  } catch (err) {
    console.error('accounts.json migrate read failed:', err.message || err);
    return null;
  }
}

async function migrateJsonIfNeeded(rowCount) {
  if (rowCount > 0) return;
  // Never touch accounts.json when tests/override point at another DB file.
  if (process.env.ACCOUNTS_DB_PATH) return;
  const users = loadLegacyJson();
  if (!users || !Object.keys(users).length) return;
  console.log(`Migrating ${Object.keys(users).length} accounts from accounts.json → SQLite…`);
  await runAsync('BEGIN');
  try {
    for (const [username, u] of Object.entries(users)) {
      await runAsync(UPSERT_SQL, userToParams(username, migrateUser(u)));
    }
    await runAsync('COMMIT');
    try {
      const bak = JSON_LEGACY + '.bak';
      if (!fs.existsSync(bak)) fs.renameSync(JSON_LEGACY, bak);
      else fs.renameSync(JSON_LEGACY, JSON_LEGACY + '.' + Date.now() + '.bak');
      console.log('accounts.json archived after SQLite migrate');
    } catch (err) {
      console.warn('Could not rename accounts.json after migrate:', err.message || err);
    }
  } catch (err) {
    try { await runAsync('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

async function init() {
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await runAsync('PRAGMA foreign_keys = ON');
  await runAsync('PRAGMA journal_mode = WAL');

  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY NOT NULL,
      pin_hash TEXT,
      salt TEXT,
      steam_id TEXT,
      display_name TEXT,
      matches_won INTEGER NOT NULL DEFAULT 0,
      best_waves INTEGER NOT NULL DEFAULT 0,
      best_waves_duo INTEGER NOT NULL DEFAULT 0,
      friends TEXT NOT NULL DEFAULT '[]',
      player_color TEXT NOT NULL DEFAULT '#59D9FF',
      shoot_color TEXT NOT NULL DEFAULT '#59F2FF',
      ship_id TEXT NOT NULL DEFAULT 'tiny_1',
      created_at INTEGER,
      last_steam_login_at INTEGER
    )
  `);

  try {
    await runAsync(`ALTER TABLE users ADD COLUMN ship_id TEXT NOT NULL DEFAULT 'tiny_1'`);
  } catch (_) { /* column already exists */ }

  const countRows = await allAsync('SELECT COUNT(*) AS n FROM users');
  const n = (countRows[0] && countRows[0].n) | 0;
  await migrateJsonIfNeeded(n);

  const rows = await allAsync('SELECT * FROM users');
  const users = {};
  for (const row of rows) {
    users[row.username] = rowToUser(row);
  }
  data = { users };
  readyDone = true;
  console.log(`Accounts SQLite ready (${Object.keys(users).length} users) → ${DB_PATH}`);
}

init()
  .then(() => readyResolve.resolve())
  .catch((err) => {
    console.error('accounts DB init failed:', err.message || err);
    readyResolve.reject(err);
  });

/**
 * Create or load a Steam-backed account (no PIN).
 * @returns {{ ok: 1, key: string, user: object, created: boolean } | { ok: 0, err: string }}
 */
function upsertSteamUser(steamId, personaName) {
  ensureReady();
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
    persistUser(key, existing);
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
    shipId: DEFAULT_SHIP_ID,
    createdAt: Date.now(),
    lastSteamLoginAt: Date.now()
  };
  persistUser(key, data.users[key]);
  return { ok: 1, key, user: data.users[key], created: true };
}

function getUser(username) {
  ensureReady();
  if (!username) return null;
  return data.users[username] || null;
}

function createUser(username, pin) {
  ensureReady();
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
    shipId: DEFAULT_SHIP_ID,
    createdAt: Date.now()
  };
  persistUser(username, data.users[username]);
  return { ok: 1, user: data.users[username] };
}

function verifyUser(username, pin) {
  ensureReady();
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  const clean = normalizePin(pin);
  if (!clean) return { ok: 0, err: 'pin' };
  if (hashPin(clean, u.salt) !== u.pinHash) return { ok: 0, err: 'pin' };
  migrateUser(u);
  return { ok: 1, user: u };
}

function addWin(username) {
  ensureReady();
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  u.matchesWon = (u.matchesWon | 0) + 1;
  persistUser(username, u);
  return u.matchesWon | 0;
}

function setBestWaves(username, wave) {
  ensureReady();
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  const w = Math.max(0, wave | 0);
  if (w > (u.bestWaves | 0)) {
    u.bestWaves = w;
    persistUser(username, u);
  }
  return u.bestWaves | 0;
}

function setBestWavesDuo(username, wave) {
  ensureReady();
  const u = data.users[username];
  if (!u) return 0;
  migrateUser(u);
  const w = Math.max(0, wave | 0);
  if (w > (u.bestWavesDuo | 0)) {
    u.bestWavesDuo = w;
    persistUser(username, u);
  }
  return u.bestWavesDuo | 0;
}

function setColors(username, playerColor, shootColor) {
  ensureReady();
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  migrateUser(u);
  const pc = normalizeColor(playerColor);
  const sc = normalizeColor(shootColor);
  if (!pc || !sc) return { ok: 0, err: 'color' };
  u.playerColor = pc;
  u.shootColor = sc;
  persistUser(username, u);
  return { ok: 1, playerColor: pc, shootColor: sc, shipId: u.shipId || DEFAULT_SHIP_ID };
}

function setShip(username, shipId) {
  ensureReady();
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  migrateUser(u);
  const sid = normalizeShipId(shipId);
  if (!sid) return { ok: 0, err: 'ship' };
  u.shipId = sid;
  persistUser(username, u);
  return { ok: 1, shipId: sid };
}

function renameUser(oldName, newName) {
  ensureReady();
  if (!oldName || !newName || oldName === newName) return { ok: 1 };
  if (!data.users[oldName]) return { ok: 0, err: 'missing' };
  const u = migrateUser(data.users[oldName]);
  // Steam accounts keep a fixed key; only the display name changes.
  if (u.steamId) {
    u.displayName = String(newName).trim().slice(0, 32) || u.displayName;
    persistUser(oldName, u);
    return { ok: 1, user: u, displayOnly: true };
  }
  if (data.users[newName]) return { ok: 0, err: 'taken' };
  data.users[newName] = u;
  delete data.users[oldName];
  const touched = [newName];
  for (const k of Object.keys(data.users)) {
    const ou = data.users[k];
    if (!Array.isArray(ou.friends)) continue;
    let changed = false;
    for (let i = 0; i < ou.friends.length; i++) {
      if (ou.friends[i] === oldName) {
        ou.friends[i] = newName;
        changed = true;
      }
    }
    if (changed) touched.push(k);
  }
  deleteUserRow(oldName);
  persistMany(touched);
  return { ok: 1, user: data.users[newName] };
}

function listFriends(username) {
  ensureReady();
  const u = getUser(username);
  if (!u) return [];
  migrateUser(u);
  return (u.friends || []).slice();
}

/** Mutual friend add (both registered). */
function addFriend(username, friendName) {
  ensureReady();
  if (!username || !friendName || username === friendName) return { ok: 0, err: 'name' };
  const u = data.users[username];
  const f = data.users[friendName];
  if (!u || !f) return { ok: 0, err: 'missing' };
  migrateUser(u);
  migrateUser(f);
  if (!u.friends.includes(friendName)) u.friends.push(friendName);
  if (!f.friends.includes(username)) f.friends.push(username);
  persistMany([username, friendName]);
  return { ok: 1, friends: u.friends.slice() };
}

function removeFriend(username, friendName) {
  ensureReady();
  if (!username || !friendName) return { ok: 0, err: 'name' };
  const u = data.users[username];
  if (!u) return { ok: 0, err: 'missing' };
  migrateUser(u);
  u.friends = (u.friends || []).filter((n) => n !== friendName);
  const touched = [username];
  const f = data.users[friendName];
  if (f) {
    migrateUser(f);
    f.friends = (f.friends || []).filter((n) => n !== username);
    touched.push(friendName);
  }
  persistMany(touched);
  return { ok: 1, friends: u.friends.slice() };
}

/** Public leaderboard rows (no secrets). */
function listLeaderboard() {
  ensureReady();
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

module.exports = {
  ready,
  DB_PATH,
  normalizePin,
  normalizeColor,
  normalizeShipId,
  DEFAULT_PLAYER_COLOR,
  DEFAULT_SHOOT_COLOR,
  DEFAULT_SHIP_ID,
  getUser,
  createUser,
  verifyUser,
  steamAccountKey,
  upsertSteamUser,
  addWin,
  setBestWaves,
  setBestWavesDuo,
  setColors,
  setShip,
  renameUser,
  listFriends,
  addFriend,
  removeFriend,
  listLeaderboard
};
