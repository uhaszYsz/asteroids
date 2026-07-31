/** @file server/net.js — loaded into shared server scope (do not require() alone). */
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function sendBinary(ws, buf) {
  if (ws.readyState === 1) ws.send(buf);
}

function initClientLimits(ws) {
  const now = Date.now();
  ws.rl = {
    msgTokens: RATE_MSG_BURST,
    msgLast: now,
    inTokens: RATE_INPUT_FRAMES_BURST,
    inLast: now,
    strikes: 0,
    lastAction: Object.create(null)
  };
}

function rlRefill(tokens, last, ratePerSec, burst, now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  return Math.min(burst, tokens + elapsed * ratePerSec);
}

function rlStrike(ws) {
  if (!ws.rl) return;
  ws.rl.strikes = (ws.rl.strikes | 0) + 1;
  if (ws.rl.strikes >= RATE_STRIKES_KICK) {
    try { ws.close(4008, 'rate'); } catch (_) {}
  }
}

function rlForgive(ws) {
  if (!ws.rl || !(ws.rl.strikes > 0)) return;
  ws.rl.strikes = Math.max(0, (ws.rl.strikes | 0) - 1);
}

/** Global per-socket message rate limit. Returns false → drop message. */
function allowSocketMessage(ws) {
  if (!ws.rl) initClientLimits(ws);
  const now = Date.now();
  const rl = ws.rl;
  rl.msgTokens = rlRefill(rl.msgTokens, rl.msgLast, RATE_MSG_PER_SEC, RATE_MSG_BURST, now);
  rl.msgLast = now;
  if (rl.msgTokens < 1) {
    rlStrike(ws);
    return false;
  }
  rl.msgTokens -= 1;
  rlForgive(ws);
  return true;
}

/** Cap accepted input frames/sec. Returns how many frames may be taken now. */
function allowInputFrames(ws, count) {
  if (!ws.rl) initClientLimits(ws);
  const n = Math.max(0, count | 0);
  if (!n) return 0;
  const now = Date.now();
  const rl = ws.rl;
  rl.inTokens = rlRefill(rl.inTokens, rl.inLast, RATE_INPUT_FRAMES_PER_SEC, RATE_INPUT_FRAMES_BURST, now);
  rl.inLast = now;
  if (rl.inTokens < 1) {
    rlStrike(ws);
    return 0;
  }
  const take = Math.min(n, Math.floor(rl.inTokens));
  rl.inTokens -= take;
  return take;
}

/** Cooldown for sparse actions (shop/pause/queue…). */
function allowAction(ws, key, minMs) {
  if (!ws.rl) initClientLimits(ws);
  const now = Date.now();
  const last = ws.rl.lastAction[key] | 0;
  if (now - last < (minMs | 0)) return false;
  ws.rl.lastAction[key] = now;
  return true;
}

/** Coerce to 0/1; returns -1 if the value is not a valid bit. */
function coerceInputBit(v) {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0 || v == null || v === undefined) return 0;
  if (typeof v === 'number' && v === 0) return 0;
  return -1;
}

function sanitizeInputFrame(frame, lastSeq, maxQueuedSeq) {
  if (!frame || typeof frame !== 'object') return null;
  const seqNum = Number(frame.seq);
  if (!Number.isFinite(seqNum)) return null;
  const seq = seqNum | 0;
  if (seq !== seqNum || seq < 1) return null;
  if (seq <= lastSeq) return { stale: 1 };
  // Huge forward jump (cheat / desync dump).
  if (lastSeq > 0 && seq > lastSeq + MAX_SEQ_JUMP) return null;
  if (maxQueuedSeq > 0 && seq > maxQueuedSeq + MAX_SEQ_JUMP) return null;

  const l = coerceInputBit(frame.l);
  const r = coerceInputBit(frame.r);
  const u = coerceInputBit(frame.u);
  const sp = coerceInputBit(frame.sp);
  const sh = coerceInputBit(frame.sh);
  if (l < 0 || r < 0 || u < 0 || sp < 0 || sh < 0) return null;

  return { seq, l, r, u, sp, sh };
}

/** Drop oldest queued frames so latency cannot stick. Prefer keeping shoot pulses. */
function trimInputQueue(pl, maxLen) {
  const cap = Math.max(1, maxLen | 0);
  if (!pl || !pl.inputQueue || pl.inputQueue.length <= cap) return;
  const q = pl.inputQueue;
  // Drop from the front, but skip over a shoot pulse when a later idle frame
  // can be discarded instead (keeps the shot, sheds backlog).
  while (q.length > cap) {
    let dropAt = 0;
    if ((q[0].sp | 0) === 1) {
      for (let i = 1; i < q.length; i++) {
        if ((q[i].sp | 0) === 0) {
          dropAt = i;
          break;
        }
      }
    }
    q.splice(dropAt, 1);
  }
}

function enqueuePlayerInputs(ws, pl, frames) {
  if (!pl || !Array.isArray(frames) || !frames.length) return;
  if (frames.length > MAX_FRAMES_PER_MSG) rlStrike(ws);
  const slice = frames.length > MAX_FRAMES_PER_MSG
    ? frames.slice(0, MAX_FRAMES_PER_MSG)
    : frames;
  const budget = allowInputFrames(ws, slice.length);
  if (budget <= 0) return;

  let maxQueuedSeq = pl.lastSeq | 0;
  for (let i = 0; i < pl.inputQueue.length; i++) {
    const s = pl.inputQueue[i].seq | 0;
    if (s > maxQueuedSeq) maxQueuedSeq = s;
  }

  let accepted = 0;
  for (let i = 0; i < slice.length && accepted < budget; i++) {
    if (pl.inputQueue.length >= MAX_INPUT_QUEUE) trimInputQueue(pl, MAX_INPUT_QUEUE - 1);
    const cleaned = sanitizeInputFrame(slice[i], pl.lastSeq | 0, maxQueuedSeq);
    if (!cleaned) {
      rlStrike(ws);
      continue;
    }
    if (cleaned.stale) continue;
    if (pl.inputQueue.some(q => q.seq === cleaned.seq)) continue;
    pl.inputQueue.push({
      seq: cleaned.seq,
      l: cleaned.l,
      r: cleaned.r,
      u: cleaned.u,
      sp: cleaned.sp,
      sh: cleaned.sh
    });
    if (cleaned.seq > maxQueuedSeq) maxQueuedSeq = cleaned.seq;
    accepted++;
  }
  if (accepted) {
    pl.inputQueue.sort((a, b) => a.seq - b.seq);
    // Soft trim first so mild overproduce never sits for hundreds of ms.
    trimInputQueue(pl, SOFT_INPUT_QUEUE);
    trimInputQueue(pl, MAX_INPUT_QUEUE);
  }
}

/** Lobby presence: total online + PvP/coop ingame & queue counts. */
function packOnlineNames() {
  const names = [];
  for (const c of wss.clients) {
    if (c.readyState === 1 && c.registered && c.accountKey) names.push(c.accountKey);
  }
  names.sort();
  return names;
}

function findOnlineByAccount(name) {
  const key = resolveAccountKey(name);
  if (!key) return null;
  for (const c of wss.clients) {
    if (c.readyState === 1 && c.registered && c.accountKey === key) return c;
  }
  return null;
}

function packTeamMsg(ws) {
  const mate = ws.teamMate;
  if (!mate || mate.readyState !== 1 || !ws.accountKey || !mate.accountKey) {
    return { t: 'team', members: [] };
  }
  return { t: 'team', members: [ws.accountKey, mate.accountKey] };
}

function sendTeamState(ws) {
  if (ws && ws.readyState === 1) send(ws, packTeamMsg(ws));
}

function dissolveTeam(ws, reason) {
  if (!ws) return;
  const mate = ws.teamMate;
  ws.teamMate = null;
  ws.pendingTeamFrom = null;
  if (mate) {
    if (mate.teamMate === ws) mate.teamMate = null;
    mate.pendingTeamFrom = null;
    if (mate.readyState === 1) {
      send(mate, { t: 'team', members: [], reason: reason || 'left' });
    }
  }
  if (ws.readyState === 1) {
    send(ws, { t: 'team', members: [], reason: reason || 'left' });
  }
}

function formTeam(a, b) {
  if (!a || !b || a === b) return { ok: 0, err: 'team' };
  if (a.teamMate && a.teamMate !== b) dissolveTeam(a, 'replaced');
  if (b.teamMate && b.teamMate !== a) dissolveTeam(b, 'replaced');
  a.teamMate = b;
  b.teamMate = a;
  a.pendingTeamFrom = null;
  b.pendingTeamFrom = null;
  sendTeamState(a);
  sendTeamState(b);
  return { ok: 1 };
}

function packPresence() {
  let online = 0;
  for (const c of wss.clients) {
    if (c.readyState === 1) online++;
  }
  let pvpIngame = 0;
  let coopIngame = 0;
  for (const room of rooms.values()) {
    const n = room.clients.size;
    if (!n) continue;
    if (room.coop) coopIngame += n;
    else if (!room.practice) pvpIngame += n;
  }
  return {
    t: 'presence',
    online,
    onlineNames: packOnlineNames(),
    pvp: { ingame: pvpIngame, queue: matchQueue.length },
    coop: { ingame: coopIngame, queue: coopQueue.length }
  };
}

let presenceBroadcastTimer = null;
function broadcastPresence() {
  if (presenceBroadcastTimer) return;
  presenceBroadcastTimer = setTimeout(() => {
    presenceBroadcastTimer = null;
    const msg = packPresence();
    for (const c of wss.clients) {
      if (c.readyState === 1) send(c, msg);
    }
  }, 50);
}

const DEMO_MIRROR_TYPES = new Set([
  'bd', 'bu', 'lf', 'rf', 'rc', 'die', 'boom', 'round', 'go',
  'paused', 'resumed', 'wpn', 'pup', 'eh', 'ed', 'ef', 'eu', 'es', 'ech', 'vd',
  'colors', 'roster'
]);

function roomBroadcast(room, msg) {
  if (msg && msg.t === 'bf' && msg.b != null) {
    demoRecorder.recordBulletFire(room, msg.b);
  } else if (msg && DEMO_MIRROR_TYPES.has(msg.t)) {
    demoRecorder.recordNet(room, msg);
  }
  const raw = JSON.stringify(msg);
  for (const ws of room.clients) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

function roomBroadcastBinary(room, buf) {
  for (const ws of room.clients) sendBinary(ws, buf);
}

function packBullet(b) {
  return [b.id, b.spawnX, b.spawnY, b.vx, b.vy, b.owner, b.spawnSt, b.type || 'default'];
}

function asteroidSizeCode(a) {
  // 3 = huge, 2 = big, 1 = medium, 0 = small (legacy clients treated non-zero as big).
  if (a.size === 'huge') return 3;
  if (a.size === 'big' || a.big) return 2;
  if (a.size === 'medium') return 1;
  return 0;
}

/** Match client asteroidColor seed (S=1,V=1). */
function asteroidHash01(id) {
  let x = ((id | 0) * 2654435761) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function wrapHue01(h) {
  const x = +h;
  if (!Number.isFinite(x)) return 0;
  return ((x % 1) + 1) % 1;
}
function asteroidHueFromShape(shapeId) {
  return asteroidHash01((shapeId | 0) ^ 0xc0ffee);
}
/** Child shards: parent hue ±20°. */
function shardHueFromParent(parentHue) {
  return wrapHue01(parentHue + (Math.random() * 40 - 20) / 360);
}
function packAsteroidHue(a) {
  const h = a && a.hue != null ? wrapHue01(a.hue)
    : asteroidHueFromShape(a && a.shapeId != null ? a.shapeId : 0);
  return ((h * 360) | 0) % 360;
}

function packAsteroid(a) {
  return [
    a.aid, a.spawnX, a.spawnY, a.vx, a.vy,
    a.spawnAngle, a.spin, a.r,
    0, // pts omitted — both sides rebuild from shapeId
    asteroidSizeCode(a), a.spawnSt,
    specialAsteroidCode(a), a.centerRock ? 1 : 0,
    a.portalOfAid ? 1 : 0,
    a.shapeId != null ? (a.shapeId | 0) : shapeIdFromPos(a.spawnX, a.spawnY),
    a.edgeWraps | 0,
    asteroidEdgeWrapMax(a),
    a.playerShot ? 1 : 0,
    a.ownerId != null ? (a.ownerId | 0) : 0,
    packAsteroidHue(a),
    // Create-time for 20s lifetime (wraps refresh spawnSt, not life).
    asteroidBornAt(a)
  ];
}

function packAsteroidWrap(a) {
  return [
    a.aid, a.spawnX, a.spawnY, a.vx, a.vy, a.spawnAngle, a.spin, a.spawnSt,
    a.portalOfAid ? 1 : 0,
    a.edgeWraps | 0,
    asteroidEdgeWrapMax(a)
  ];
}

function emitAsteroidFire(room, a) {
  const packed = packAsteroid(a);
  demoRecorder.recordAsteroidCreate(room, packed);
  roomBroadcast(room, { t: 'af', a: packed });
}

function emitAsteroidDead(room, id, silent, x, y, coins, by) {
  demoRecorder.recordAsteroidDead(room, id, silent);
  const msg = { t: 'ad', id };
  if (silent) {
    msg.silent = 1;
  } else {
    if (x != null) msg.x = x;
    if (y != null) msg.y = y;
    if (coins != null) msg.coins = coins | 0;
    if (by != null && (by | 0) > 0) msg.by = by | 0;
    msg.tick = room.tick | 0;
  }
  roomBroadcast(room, msg);
}

/** Visual coin burst for golden-asteroid hit rewards (authoritative grant is separate). */
function emitGoldAsteroidCoins(room, x, y, coins, by) {
  const n = coins | 0;
  const pid = by | 0;
  if (n <= 0 || pid <= 0) return;
  roomBroadcast(room, { t: 'gc', x, y, n, by: pid });
}

function emitAsteroidWrap(room, a) {
  const packed = packAsteroidWrap(a);
  demoRecorder.recordAsteroidWrap(room, packed);
  roomBroadcast(room, { t: 'aw', a: packed });
}

function packPickup(u) {
  let code = 0;
  if (u.kind === 'health') code = PICKUP_CODE_HEALTH;
  else if (u.kind === 'powerup') {
    const idx = POWERUP_TYPES.indexOf(u.powerup);
    code = PICKUP_CODE_POWERUP_BASE + (idx >= 0 ? idx : 0);
  } else code = WEAPON_SLOTS.indexOf(u.weapon) + 1;
  return [
    u.id, u.spawnX, u.spawnY, u.vx, u.vy,
    u.spawnAngle, u.spin, code, u.spawnSt,
    u.bounces | 0
  ];
}

function packPickupSync(u) {
  return [u.id, u.spawnX, u.spawnY, u.vx, u.vy, u.spawnAngle, u.spin, u.spawnSt, u.bounces | 0];
}

function emitPickupFire(room, u) {
  roomBroadcast(room, { t: 'pf', u: packPickup(u) });
}

function emitPickupDead(room, id, x, y, extra) {
  roomBroadcast(room, Object.assign({ t: 'pd', id, x, y }, extra || {}));
}

function emitPickupBounce(room, u) {
  roomBroadcast(room, { t: 'pb', u: packPickupSync(u) });
}

function resyncPickupSpawn(u) {
  u.spawnX = u.x;
  u.spawnY = u.y;
  u.spawnAngle = u.angle;
  u.spawnSt = Date.now();
}

function resyncAsteroidSpawn(a) {
  a.spawnX = a.x;
  a.spawnY = a.y;
  a.spawnAngle = a.angle;
  a.spawnSt = Date.now();
}

function resyncBulletSpawn(b) {
  if (!b) return;
  b.spawnX = b.x;
  b.spawnY = b.y;
  b.spawnSt = Date.now();
}

function resyncAllBullets(room) {
  if (!room || !room.bullets) return;
  for (const b of room.bullets) resyncBulletSpawn(b);
}

function resyncEnemySpawn(e) {
  if (!e) return;
  const now = Date.now();
  if (enemyMoveType(e) === ENEMY_MOVE_DESTINATION_SMOOTH) {
    // Authoritative x/y already advanced each tick — just reset net clock.
    e.spawnX = e.x;
    e.spawnY = e.y;
    e.spawnSt = now;
    return;
  }
  // Destination dead-reckon: bake travel so pause doesn't age on the client.
  const age = Math.max(0, (now - (e.spawnSt || now)) / 1000 * TPS);
  const traveled = enemySpeed(e) * age;
  const travelDist = Math.hypot((e.tx - (e.spawnX || 0)), (e.ty - (e.spawnY || 0)));
  if (traveled >= travelDist) {
    e.spawnX = e.tx;
    e.spawnY = e.ty;
    e.vx = 0;
    e.vy = 0;
  } else {
    e.spawnX = (e.spawnX || 0) + (e.vx || 0) * age;
    e.spawnY = (e.spawnY || 0) + (e.vy || 0) * age;
  }
  e.spawnSt = now;
}

function resyncAllEnemies(room) {
  if (!room || !room.enemies) return;
  for (const e of room.enemies) resyncEnemySpawn(e);
}
