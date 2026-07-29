/**
 * Event-based demo recorder (server-side).
 * sv_demo: 0 = off, 1 = PvP only, 2 = PvP + matchmaking/coop wave rooms.
 * Solo-only rooms are never recorded (even at 2).
 * Buffered in RAM; gzip JSON written async on match end.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEMO_DIR = path.join(__dirname, 'demos');
/** 0 off · 1 PvP · 2 PvP + coop/queue waves. Default 2 so matchmaking waves record. Env DEMO_RECORD=0|1 overrides. */
let svDemo = process.env.DEMO_RECORD === '0' ? 0
  : process.env.DEMO_RECORD === '1' ? 1
  : 2;
const MAX_EVENTS = 400000;
const LIST_CACHE_MS = 4000;

let dirReady = false;
let writeQueue = 0;
let listCache = { at: 0, rows: [] };

function ensureDemoDir() {
  if (dirReady) return true;
  try {
    fs.mkdirSync(DEMO_DIR, { recursive: true });
    dirReady = true;
    return true;
  } catch (err) {
    console.error('[demo] mkdir failed:', err.message || err);
    return false;
  }
}

function getDemoMode() {
  return svDemo | 0;
}

function setDemoMode(v) {
  const n = Math.max(0, Math.min(2, v | 0));
  svDemo = n;
  return svDemo;
}

/** Which rooms may record under current sv_demo. */
function roomAllowed(room) {
  const mode = svDemo | 0;
  if (!mode || !room) return false;
  // Dedicated solo never records.
  if (room.soloOnly) return false;
  if (!room.practice) return mode >= 1; // PvP
  // Wave rooms on server: coop match, or matchmaking queue wait (pvp/coop).
  if (room.coop) return mode >= 2;
  if (room.queueKind === 'pvp' || room.queueKind === 'coop') return mode >= 2;
  return false;
}

function shouldRecord(room) {
  return !!(room && room.demo && roomAllowed(room));
}

function push(room, ev) {
  if (!shouldRecord(room) || !ev) return;
  const demo = room.demo;
  if (demo.events.length >= MAX_EVENTS) {
    if (!demo.truncated) {
      demo.truncated = true;
      console.warn(`[demo] room ${demo.roomId} hit MAX_EVENTS — stopping further events`);
    }
    return;
  }
  demo.events.push(ev);
}

function packPlayerMeta(room) {
  const out = [];
  for (const p of room.players.values()) {
    if (p.bot) continue;
    out.push({
      id: p.id,
      name: p.name || '',
      accountKey: p.accountKey || null,
      playerColor: p.playerColor || null,
      shootColor: p.shootColor || null,
      score: room.practice ? (p.coinsCollected | 0) : (p.score | 0)
    });
  }
  return out;
}

function demoModeLabel(room) {
  if (!room) return 'pvp';
  if (!room.practice) return 'pvp';
  if (room.coop) return 'coop';
  if (room.queueKind === 'coop') return 'queue_coop';
  if (room.queueKind === 'pvp') return 'queue_pvp';
  return 'wave';
}

/** Begin recording when a room becomes eligible. Caller should seed a snap via recordSnap. */
function start(room, opts) {
  if (!roomAllowed(room)) return false;
  if (room.demo) return true;
  if (!ensureDemoDir()) return false;

  const o = opts || {};
  const mode = demoModeLabel(room);
  room.demo = {
    v: 2,
    kind: mode === 'pvp' ? 'pvp' : 'wave',
    mode,
    roomId: room.id,
    tps: o.tps || 30,
    w: o.w || 0,
    h: o.h || 0,
    practice: !!room.practice,
    startedAt: new Date().toISOString(),
    startTick: room.tick | 0,
    wave: room.practice ? (room.wave | 0) : 0,
    players: packPlayerMeta(room),
    events: [],
    truncated: false
  };

  push(room, { t: 'go', k: room.tick | 0, mode });
  console.log(`[demo] recording room ${room.id} mode=${mode} (sv_demo=${svDemo})`);
  return true;
}

/** Full keyframe for client playback (packed ship / asteroid / bullet rows). */
function recordSnap(room, payload) {
  if (!shouldRecord(room) || !payload) return;
  push(room, Object.assign({
    t: 'snap',
    k: room.tick | 0,
    kind: 'start',
    practice: !!room.practice
  }, payload));
}

/** Per-tick ship poses for client playback. */
function recordPose(room, ships) {
  if (!shouldRecord(room) || !ships) return;
  push(room, { t: 'pose', k: room.tick | 0, ships });
}

/** Mirror a client-compatible net message into the demo. */
function recordNet(room, msg) {
  if (!shouldRecord(room) || !msg || !msg.t) return;
  const copy = Object.assign({}, msg);
  copy.k = room.tick | 0;
  push(room, copy);
}

function recordInput(room, p) {
  if (!shouldRecord(room) || !p || p.bot) return;
  const inp = p.inp || {};
  push(room, {
    t: 'in',
    k: room.tick | 0,
    id: p.id | 0,
    l: inp.l ? 1 : 0,
    r: inp.r ? 1 : 0,
    u: inp.u ? 1 : 0,
    sp: inp.sp ? 1 : 0,
    sh: inp.sh ? 1 : 0
  });
}

function recordBulletFire(room, bRow) {
  if (!shouldRecord(room) || bRow == null) return;
  push(room, { t: 'bf', k: room.tick | 0, b: bRow });
}

/** `row` must be a packed asteroid array (same as net `af`). */
function recordAsteroidCreate(room, row) {
  if (!shouldRecord(room) || row == null) return;
  push(room, { t: 'af', k: room.tick | 0, a: row });
}

function recordAsteroidDead(room, id, silent) {
  if (!shouldRecord(room) || id == null) return;
  push(room, {
    t: 'ad',
    k: room.tick | 0,
    id: id | 0,
    silent: silent ? 1 : 0
  });
}

function recordAsteroidWrap(room, row) {
  if (!shouldRecord(room) || row == null) return;
  push(room, { t: 'aw', k: room.tick | 0, a: row });
}

function recordPause(room, reason) {
  if (!shouldRecord(room)) return;
  push(room, { t: 'pause', k: room.tick | 0, reason: reason || 'manual' });
}

function recordResume(room) {
  if (!shouldRecord(room)) return;
  push(room, { t: 'resume', k: room.tick | 0 });
}

function finish(room, extra) {
  if (!room || !room.demo) return;
  const demo = room.demo;
  room.demo = null;

  demo.endedAt = new Date().toISOString();
  demo.endTick = room.tick | 0;
  // Refresh player scores when entities still present (destroy may already be empty).
  if (room.players && room.players.size) demo.players = packPlayerMeta(room);
  if (room.practice) demo.wave = room.wave | 0;
  if (extra) {
    if (extra.winnerId != null) demo.winnerId = extra.winnerId;
    if (extra.scores) demo.scores = extra.scores;
    if (extra.reason) demo.reason = extra.reason;
    if (extra.wave != null) demo.wave = extra.wave | 0;
  }
  pushMetaEvent(demo, { t: 'over', k: demo.endTick, winner: demo.winnerId || 0, wave: demo.wave | 0 });

  if (!ensureDemoDir()) return;

  const stamp = Date.now();
  const safeNames = (demo.players || [])
    .map(p => String(p.name || p.id).replace(/[^\w\-]+/g, '_').slice(0, 24))
    .join('_') || 'match';
  const base = `r${demo.roomId}_${stamp}_${demo.mode || 'pvp'}_${safeNames}`;
  const file = path.join(DEMO_DIR, `${base}.json.gz`);
  const metaFile = path.join(DEMO_DIR, `${base}.meta.json`);
  const json = JSON.stringify(demo);
  const summary = summarizeDemo(demo, path.basename(file));

  try {
    fs.writeFileSync(metaFile, JSON.stringify(summary), 'utf8');
  } catch (err) {
    console.error('[demo] meta write failed:', err.message || err);
  }
  listCache.at = 0;

  writeQueue++;
  zlib.gzip(json, (err, buf) => {
    if (err) {
      writeQueue--;
      console.error('[demo] gzip failed:', err.message || err);
      return;
    }
    fs.writeFile(file, buf, (werr) => {
      writeQueue--;
      if (werr) {
        console.error('[demo] write failed:', werr.message || werr);
        return;
      }
      const kb = (buf.length / 1024).toFixed(1);
      console.log(`[demo] saved ${path.basename(file)} (${kb} KB gz, ${demo.events.length} events)`);
    });
  });
}

function pushMetaEvent(demo, ev) {
  if (!demo || !demo.events) return;
  if (demo.events.length < MAX_EVENTS) demo.events.push(ev);
}

function scoreLine(demo) {
  const players = demo.players || [];
  const scores = demo.scores;
  const scoreFor = (id) => {
    if (scores == null) return null;
    if (Array.isArray(scores)) {
      for (const row of scores) {
        if ((row[0] | 0) === (id | 0)) return row[1] | 0;
      }
      return null;
    }
    if (typeof scores === 'object') {
      if (scores[id] != null) return scores[id] | 0;
      if (scores[String(id)] != null) return scores[String(id)] | 0;
    }
    return null;
  };
  if (demo.kind === 'pvp' || demo.mode === 'pvp') {
    const parts = players.map((p) => {
      const s = scoreFor(p.id);
      return s != null ? s : (p.score | 0);
    });
    if (parts.length) return parts.join('–');
    return '—';
  }
  const wave = demo.wave | 0;
  const coins = players.map((p) => {
    const s = scoreFor(p.id);
    return s != null ? s : (p.score | 0);
  });
  if (wave > 0 && coins.length) return `W${wave} · ${coins.join('–')}`;
  if (wave > 0) return `W${wave}`;
  return coins.join('–') || '—';
}

function summarizeDemo(demo, file) {
  const players = (demo.players || []).map((p) => ({
    id: p.id | 0,
    name: p.name || '',
    accountKey: p.accountKey || null,
    score: p.score | 0
  }));
  return {
    file: file || '',
    mode: demo.mode || (demo.kind === 'pvp' ? 'pvp' : 'wave'),
    kind: demo.kind || 'pvp',
    players,
    score: scoreLine(demo),
    wave: demo.wave | 0,
    winnerId: demo.winnerId | 0,
    startedAt: demo.startedAt || null,
    endedAt: demo.endedAt || null,
    reason: demo.reason || null,
    roomId: demo.roomId | 0
  };
}

function modePretty(mode) {
  if (mode === 'pvp') return 'PvP';
  if (mode === 'coop') return 'Coop';
  if (mode === 'queue_pvp') return 'Queue (PvP wait)';
  if (mode === 'queue_coop') return 'Queue (Coop wait)';
  return mode || '—';
}

function readMetaFromGz(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const raw = zlib.gunzipSync(buf);
    const demo = JSON.parse(raw.toString('utf8'));
    return summarizeDemo(demo, path.basename(filePath));
  } catch (_) {
    return null;
  }
}

/** Lightweight rows for leaderboard Games history tab. */
function listSummaries(limit) {
  const cap = Math.max(1, Math.min(500, limit | 0 || 200));
  const now = Date.now();
  if (listCache.rows.length && now - listCache.at < LIST_CACHE_MS) {
    return listCache.rows.slice(0, cap);
  }
  if (!ensureDemoDir()) return [];
  let names = [];
  try {
    names = fs.readdirSync(DEMO_DIR);
  } catch (_) {
    return [];
  }

  const rows = [];
  const seen = new Set();

  // Prefer sidecar .meta.json (fast).
  for (const name of names) {
    if (!name.endsWith('.meta.json')) continue;
    const full = path.join(DEMO_DIR, name);
    try {
      const row = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!row.file) {
        const base = name.slice(0, -'.meta.json'.length);
        row.file = base + '.json.gz';
      }
      row.modeLabel = modePretty(row.mode);
      rows.push(row);
      seen.add(row.file);
    } catch (_) { /* skip */ }
  }

  // Legacy gz-only demos.
  for (const name of names) {
    if (!name.endsWith('.json.gz')) continue;
    if (seen.has(name)) continue;
    const row = readMetaFromGz(path.join(DEMO_DIR, name));
    if (!row) continue;
    row.modeLabel = modePretty(row.mode);
    rows.push(row);
  }

  rows.sort((a, b) => String(b.endedAt || '').localeCompare(String(a.endedAt || '')));
  listCache = { at: now, rows };
  return rows.slice(0, cap);
}

/** Safe basename for demo files under DEMO_DIR. */
function safeDemoBasename(name) {
  const base = String(name || '').split(/[/\\]/).pop();
  if (!base || !/^[A-Za-z0-9._\-]+\.json\.gz$/.test(base)) return null;
  return base;
}

/** Absolute path if file exists under DEMO_DIR. */
function resolveDemoFile(name) {
  const base = safeDemoBasename(name);
  if (!base || !ensureDemoDir()) return null;
  const full = path.join(DEMO_DIR, base);
  if (!full.startsWith(DEMO_DIR)) return null;
  try {
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  } catch (_) {
    return null;
  }
  return full;
}

module.exports = {
  DEMO_DIR,
  get DEMO_ENABLED() { return (svDemo | 0) > 0; },
  getDemoMode,
  setDemoMode,
  roomAllowed,
  start,
  recordSnap,
  recordPose,
  recordNet,
  recordInput,
  recordBulletFire,
  recordAsteroidCreate,
  recordAsteroidDead,
  recordAsteroidWrap,
  recordPause,
  recordResume,
  finish,
  listSummaries,
  safeDemoBasename,
  resolveDemoFile
};
