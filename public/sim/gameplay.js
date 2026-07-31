/** @file server/gameplay.js — loaded into shared server scope (do not require() alone). */
function buildAsteroidShape(r, size) {
  // Unused legacy helper — silhouette comes from buildAsteroidSilhouettePts.
  return buildAsteroidSilhouettePts(0, r, size || 'medium');
}

/* ========== Vector asteroid silhouette (matches client: jagged 2D outline) ========== */
function asteroidHash01(id) {
  let x = ((id | 0) * 2654435761) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function asteroidRng(id) {
  let s = ((id | 0) * 2654435761) >>> 0;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function asteroidOutlineCount(id, size) {
  const h = asteroidHash01(id);
  if (size === 'huge') return 16 + ((h * 4) | 0);
  if (size === 'big') return 12 + ((h * 3) | 0);
  if (size === 'medium') return 10 + ((h * 3) | 0);
  return 8 + ((h * 3) | 0);
}

function getAsteroidOutlineRadii(id, size) {
  const n = asteroidOutlineCount(id, size);
  const rnd = asteroidRng(id ^ 0x9e3779b9);
  const radii = new Float64Array(n);
  for (let i = 0; i < n; i++) radii[i] = 0.6 + rnd() * 0.4;
  return radii;
}

/**
 * Fixed jagged 2D collision outline from id (+ size). Spins with a.angle only.
 */
function buildAsteroidSilhouettePts(id, r, size) {
  const radii = getAsteroidOutlineRadii(id, size || 'medium');
  const radius = r || 16;
  const n = radii.length;
  const pts = new Array(n * 2);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const d = radius * radii[i];
    pts[i * 2] = Math.cos(th) * d;
    pts[i * 2 + 1] = Math.sin(th) * d;
  }
  return pts;
}

function refreshAsteroidCollisionPts(a) {
  const sid = a.shapeId != null ? a.shapeId : shapeIdFromPos(a.x, a.y);
  a.shapeId = sid | 0;
  a.pts = buildAsteroidSilhouettePts(sid, a.r, a.size);
}

/** Deterministic silhouette seed from spawn position (portal twins pass shapeId instead). */
function shapeIdFromPos(x, y) {
  const s = (
    Math.imul(Math.floor(x * 1024) | 0, 374761393) +
    Math.imul(Math.floor(y * 1024) | 0, 668265263)
  ) >>> 0;
  return s || 1;
}

/**
 * Place a replacement asteroid just outside the playfield with velocity aimed
 * inward so it drifts onto screen (no on-screen pop-in).
 * preferSide: 0 left, 1 right, 2 top, 3 bottom (optional).
 */
function spawnOffscreenIncoming(r, speedMul, preferSide) {
  const mul = speedMul == null ? 1 : speedMul;
  // Fully clear of the playfield so the whole rock enters gradually.
  const margin = (r || 16) + 8;
  const side = preferSide != null ? (preferSide | 0) & 3 : (Math.random() * 4 | 0);
  const drift = () => (Math.random() - 0.5) * ASTEROID_SPEED_SPREAD * mul;
  const inward = () => Math.abs(drift()) + ASTEROID_SPEED_MIN * mul;
  if (side === 0) return { x: -margin, y: Math.random() * H, vx: inward(), vy: drift() };
  if (side === 1) return { x: W + margin, y: Math.random() * H, vx: -inward(), vy: drift() };
  if (side === 2) return { x: Math.random() * W, y: -margin, vx: drift(), vy: inward() };
  return { x: Math.random() * W, y: H + margin, vx: drift(), vy: -inward() };
}

function asteroidSpeedBand(special) {
  if (special === 'meteor') {
    return { min: 4, max: 6 };
  }
  if (special === 'huge') {
    // Cap at half of the normal random-speed max.
    return { min: ASTEROID_SPEED_MIN, max: ASTEROID_SPEED_MAX * 0.5 };
  }
  return { min: ASTEROID_SPEED_MIN, max: ASTEROID_SPEED_MAX };
}

/** Clamp/resample |v| into the special's speed band (keeps direction). */
function fitAsteroidSpeed(vx, vy, special) {
  const { min, max } = asteroidSpeedBand(special);
  let s = Math.hypot(vx, vy);
  if (!(s > 1e-6)) {
    const ang = Math.random() * Math.PI * 2;
    const spd = min + Math.random() * Math.max(0, max - min);
    return { vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd };
  }
  let spd = s;
  if (spd < min) spd = min;
  if (spd > max) spd = max;
  const k = spd / s;
  return { vx: vx * k, vy: vy * k };
}

function rollNormalAsteroidVelocity() {
  return {
    vx: (Math.random() - 0.5) * ASTEROID_SPEED_SPREAD,
    vy: (Math.random() - 0.5) * ASTEROID_SPEED_SPREAD
  };
}

function rollSpecialAsteroid(allowSpecial, allowHuge) {
  if (!allowSpecial || Math.random() >= SPECIAL_ASTEROID_CHANCE) return null;
  const kinds = allowHuge ? SPECIAL_ASTEROID_KINDS_START : SPECIAL_ASTEROID_KINDS;
  return kinds[Math.random() * kinds.length | 0];
}

function makeAsteroid(opts) {
  const o = opts || {};
  const special = o.special !== undefined
    ? o.special
    : rollSpecialAsteroid(!!o.allowSpecial, !!o.allowHuge);
  let size = o.size || (o.big === false ? 'medium' : 'big');
  // Huge specials always use the huge tier (2× big radius).
  if (special === 'huge') size = 'huge';
  const big = size === 'big' || size === 'huge';
  const baseR = ASTEROID_R[size] || ASTEROID_R.big;
  const r = o.r != null ? o.r : baseR * (0.92 + Math.random() * 0.16);
  let hp = ASTEROID_HP;
  if (special === 'golden') hp = GOLDEN_ASTEROID_HP;
  if (special === 'huge') hp = HUGE_ASTEROID_HP;
  if (o.hp != null) hp = o.hp;
  const angle = Math.random() * Math.PI * 2;
  const now = Date.now();
  let x, y, vx, vy, entered;
  if (o.x != null && o.y != null) {
    // Explicit pose (splits): keep parent location / given velocity.
    x = o.x;
    y = o.y;
    if (o.vx != null && o.vy != null) {
      vx = o.vx;
      vy = o.vy;
    } else {
      const rolled = rollNormalAsteroidVelocity();
      vx = rolled.vx;
      vy = rolled.vy;
    }
    if (special === 'meteor' || special === 'huge') {
      const fitted = fitAsteroidSpeed(vx, vy, special);
      vx = fitted.vx;
      vy = fitted.vy;
    }
    entered = true;
  } else if (o.offscreen) {
    // Replacements only: start outside and drift in.
    const pose = spawnOffscreenIncoming(r, special === 'meteor' ? 2 : 1);
    x = pose.x;
    y = pose.y;
    vx = o.vx != null ? o.vx : pose.vx;
    vy = o.vy != null ? o.vy : pose.vy;
    if (special === 'meteor' || special === 'huge') {
      const fitted = fitAsteroidSpeed(vx, vy, special);
      vx = fitted.vx;
      vy = fitted.vy;
    }
    entered = false;
  } else {
    // Match start: already on the playfield (always normal — no specials).
    x = Math.random() * W;
    y = Math.random() * H;
    if (o.vx != null && o.vy != null) {
      vx = o.vx;
      vy = o.vy;
    } else {
      const rolled = rollNormalAsteroidVelocity();
      vx = rolled.vx;
      vy = rolled.vy;
    }
    entered = true;
  }
  const aid = nextAsteroidId++;
  const a = {
    aid,
    size,
    big,
    special,
    hp,
    maxHp: hp,
    x, y, vx, vy,
    angle,
    spin: o.spin != null ? o.spin : rollAsteroidSpin(),
    r,
    pts: null,
    spawnX: x,
    spawnY: y,
    spawnAngle: angle,
    spawnSt: now,
    entered,
    centerRock: !!o.centerRock,
    // New rocks: seed from pose. Portal twins pass parent shapeId (no rebuild).
    shapeId: o.shapeId != null ? (o.shapeId | 0) : shapeIdFromPos(x, y),
    portalArmed: o.portalArmed != null ? !!o.portalArmed : true,
    /** Edge wraps used so far (player meteor-gun shots only). */
    edgeWraps: o.edgeWraps != null ? (o.edgeWraps | 0) : 0,
    /** Allowed teleports for meteor-gun shots. World rocks use ASTEROID_LIFE_MS instead. */
    edgeWrapMax: o.edgeWrapMax != null ? Math.max(0, o.edgeWrapMax | 0) : (big ? 5 : 1),
    /** Creation time for world-rock TTL (portal twins inherit parent). */
    bornAt: o.bornAt != null ? o.bornAt : now,
    playerShot: !!o.playerShot,
    ownerId: o.ownerId != null ? (o.ownerId | 0) : 0,
    bounceCd: 0,
    // 0–1 hue (S=V=1). Splits inherit parent ±20°; portals copy parent.
    hue: o.hue != null
      ? wrapHue01(o.hue)
      : (special === 'golden' ? 0.13 : asteroidHueFromShape(o.shapeId != null ? (o.shapeId | 0) : shapeIdFromPos(x, y)))
  };
  refreshAsteroidCollisionPts(a);
  return a;
}

const CENTER_ROCK_SPEED = 0.5;
/** 2D outline spin (rad/tick) — constant magnitude band, fixed sign. */
const ASTEROID_SPIN_MIN = 0.012;
const ASTEROID_SPIN_MAX = 0.028;

function rollAsteroidSpin() {
  const mag = ASTEROID_SPIN_MIN + Math.random() * (ASTEROID_SPIN_MAX - ASTEROID_SPIN_MIN);
  return (Math.random() < 0.5 ? -1 : 1) * mag;
}

function centerRockVelocity() {
  const ang = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(ang) * CENTER_ROCK_SPEED,
    vy: Math.sin(ang) * CENTER_ROCK_SPEED
  };
}

function makeCenterAsteroid() {
  const vel = centerRockVelocity();
  return makeAsteroid({
    size: 'big',
    special: null,
    allowSpecial: false,
    x: W * 0.5,
    y: H * 0.5,
    vx: vel.vx,
    vy: vel.vy,
    spin: rollAsteroidSpin(),
    centerRock: true
  });
}

/** Keep/place the center marker rock at mid-map with light drift. */
function resetCenterAsteroid(room) {
  let a = null;
  for (let i = 0; i < room.asteroids.length; i++) {
    if (room.asteroids[i].centerRock) {
      a = room.asteroids[i];
      break;
    }
  }
  if (!a) {
    a = makeCenterAsteroid();
    pushAsteroid(room, a);
    emitAsteroidFire(room, a);
    return a;
  }
  const vel = centerRockVelocity();
  a.x = W * 0.5;
  a.y = H * 0.5;
  a.vx = vel.vx;
  a.vy = vel.vy;
  a.spin = rollAsteroidSpin();
  a.angle = Math.random() * Math.PI * 2;
  a.entered = true;
  a.hp = ASTEROID_HP;
  a.maxHp = ASTEROID_HP;
  resyncAsteroidSpawn(a);
  emitAsteroidWrap(room, a);
  return a;
}

/** Apply damage; destroy/split when HP reaches 0. Returns true if destroyed.
 *  `ownerId` (optional) — last player who dealt damage; credited for coins on kill. */
function damageAsteroid(room, a, dmg, ownerId) {
  const oid = ownerId | 0;
  if (oid > 0) a.lastHitBy = oid;
  const raw = +dmg;
  const hpBefore = a.hp;
  if (a.special === 'golden' && oid > 0 && raw > 0 && hpBefore > 0) {
    const applied = Math.min(raw, hpBefore);
    const coinN = Math.floor(applied * GOLDEN_ASTEROID_COIN_PER_DMG);
    if (coinN > 0) {
      const p = room.players.get(oid);
      if (p && !p.bot) {
        grantCoins(p, coinN);
        notifyPlayerCoins(room, p);
        emitGoldAsteroidCoins(room, a.x, a.y, coinN, oid);
      }
    }
  }
  a.hp -= raw;
  if (a.hp > 0) {
    // Keep linked portal pair HP in sync while both exist.
    if (a.portalTwinAid != null) {
      const twin = findAsteroidByAid(room, a.portalTwinAid);
      if (twin) twin.hp = a.hp;
    }
    if (a.portalOfAid != null) {
      const parent = findAsteroidByAid(room, a.portalOfAid);
      if (parent) parent.hp = a.hp;
    }
    return false;
  }
  // Player-shot rocks: destroy only — no split / coins / pickups.
  if (a.playerShot) {
    removeAsteroid(room, a);
    emitAsteroidDead(room, a.aid, false, a.x, a.y, 0);
    return true;
  }
  // Dying as inbound twin: quietly drop the exiting parent (same rock).
  if (a.portalOfAid != null) {
    const parent = findAsteroidByAid(room, a.portalOfAid);
    a.portalOfAid = null;
    if (parent) {
      parent.portalTwinAid = null;
      removePortalTwin(room, parent);
      emitAsteroidDead(room, parent.aid, true);
      removeAsteroid(room, parent);
    }
  }
  removePortalTwin(room, a);
  removeAsteroid(room, a);
  splitAsteroid(room, a);
  return true;
}

function spawnBigAsteroid(room) {
  // Shop holds the next wave — never drip asteroids while anyone is shopping.
  if (room.shopOpen) return;
  const a = makeAsteroid({ size: 'big', offscreen: true, allowSpecial: true });
  pushAsteroid(room, a);
  emitAsteroidFire(room, a);
}

function scheduleBigAsteroidSpawn(room) {
  // Solo waves: no endless big refill — clear the field to advance.
  if (room.practice) return;
  if (room.shopOpen) return;
  if (!room.pendingBigSpawns) room.pendingBigSpawns = [];
  room.pendingBigSpawns.push(BIG_SPAWN_DELAY_TICKS);
}

function tickPendingBigSpawns(room) {
  if (room.shopOpen) return;
  const q = room.pendingBigSpawns;
  if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) {
    q[i]--;
    if (q[i] > 0) continue;
    q.splice(i, 1);
    spawnBigAsteroid(room);
  }
}

function countMediumAsteroids(room) {
  const rev = room ? (room.asteroidRev | 0) : 0;
  if (room && room.mediumCountRev === rev) return room.mediumCount | 0;
  let n = 0;
  for (const a of room.asteroids) {
    // Portal inbound twins don't count toward the soft medium cap.
    if (a.size === 'medium' && !a.centerRock && !a.portalOfAid) n++;
  }
  if (room) {
    room.mediumCount = n;
    room.mediumCountRev = rev;
  }
  return n;
}

function mediumAsteroidCap(room) {
  return room.practice ? SOLO_MEDIUM_CAP : MEDIUM_ASTEROID_MAX;
}

/**
 * Solo wave composition:
 *   always 3 smalls
 *   bigs grow only on odd (no-enemy) waves: 1,1,2,2,3,3…
 *   mediums = half of bigs (cap 8)
 *   enemy waves (even): half the bigs and mediums
 */
function soloWaveCounts(wave) {
  const n = Math.max(1, wave | 0);
  // Odd waves add +1 big; even waves keep the previous odd count.
  let big = (n + 1) >> 1;
  let medium = Math.min(SOLO_MEDIUM_CAP, big >> 1);
  // Even waves spawn enemies — ease asteroid pressure.
  if (n % 2 === 0) {
    big = (big / 2) | 0;
    medium = (medium / 2) | 0;
  }
  return {
    big,
    medium,
    small: 3
  };
}

function createSoloWaveAsteroids(wave) {
  const c = soloWaveCounts(wave);
  const list = [];
  const allowSpecial = wave > 1;
  for (let i = 0; i < c.big; i++) {
    // Huge only here (wave start) — not from destroyed-big replacements / shards.
    list.push(makeAsteroid({ size: 'big', offscreen: true, allowSpecial, allowHuge: allowSpecial }));
  }
  for (let i = 0; i < c.medium; i++) {
    list.push(makeAsteroid({ size: 'medium', offscreen: true, allowSpecial: false }));
  }
  for (let i = 0; i < c.small; i++) {
    // Always enter from off-screen (no on-field pop-in at wave start).
    // Lifetime is ASTEROID_LIFE_MS from create (not edge-teleport counts).
    list.push(makeAsteroid({
      size: 'small',
      allowSpecial: false,
      offscreen: true
    }));
  }
  return list;
}

function broadcastSoloWave(room, opts) {
  roomBroadcast(room, {
    t: 'wave',
    n: room.wave | 0,
    counts: soloWaveCounts(room.wave | 0),
    // Solo waves: always spawn in the middle.
    center: (!!room.practice && !room.coop) ? 1 : 0
  });
}

/** Stamp net origin for client dead-reckon (destination move / retarget). */
function stampEnemyNet(e) {
  e.spawnX = e.x;
  e.spawnY = e.y;
  e.spawnSt = Date.now();
}

function randomEnemyWanderSpeed() {
  return ENEMY_WANDER_SPEED_MIN
    + Math.random() * (ENEMY_WANDER_SPEED_MAX - ENEMY_WANDER_SPEED_MIN);
}

function enemySpeed(e) {
  const s = e && +e.speed;
  if (Number.isFinite(s) && s > 0) return s;
  return ENEMY_WANDER_SPEED;
}

function enemyMoveType(e) {
  return e && e.move === ENEMY_MOVE_DESTINATION_SMOOTH
    ? ENEMY_MOVE_DESTINATION_SMOOTH
    : ENEMY_MOVE_DESTINATION;
}

/**
 * Pack for ef/eu (spawn / retarget).
 * [id, kind, spawnX, spawnY, tx, ty, spawnSt, hp, weapon, angle, move, vx, vy, x, y, dir, speed]
 */
function packEnemy(e) {
  const move = enemyMoveType(e);
  const dir = e.dir != null && Number.isFinite(e.dir) ? e.dir : e.angle;
  return [
    e.id,
    e.kind,
    e.spawnX != null ? e.spawnX : e.x,
    e.spawnY != null ? e.spawnY : e.y,
    e.tx, e.ty,
    e.spawnSt || Date.now(),
    e.hp,
    e.weapon || '',
    e.angle,
    move,
    e.vx || 0,
    e.vy || 0,
    e.x,
    e.y,
    dir,
    enemySpeed(e)
  ];
}

/** Compact pose snap: [id, kind, x, y, vx, vy, angle, tx, ty, hp, weapon, move, dir, entered, speed] */
function packEnemySnap(e) {
  const move = enemyMoveType(e);
  const dir = e.dir != null && Number.isFinite(e.dir) ? e.dir : e.angle;
  return [
    e.id,
    e.kind,
    e.x, e.y,
    e.vx || 0, e.vy || 0,
    e.angle,
    e.tx, e.ty,
    e.hp,
    e.weapon || '',
    move,
    dir,
    e.enteredPlay ? 1 : 0,
    enemySpeed(e)
  ];
}

function emitEnemyFire(room, e) {
  stampEnemyNet(e);
  roomBroadcast(room, { t: 'ef', e: packEnemy(e) });
}

function emitEnemyUpdate(room, e) {
  stampEnemyNet(e);
  roomBroadcast(room, { t: 'eu', e: packEnemy(e) });
}

function emitEnemySnap(room) {
  if (!room.enemies || !room.enemies.length) return;
  const list = [];
  for (const e of room.enemies) {
    if (!enemyIsSpawned(e)) continue;
    list.push(packEnemySnap(e));
  }
  if (!list.length) return;
  roomBroadcast(room, { t: 'es', st: Date.now(), e: list });
}

/** Common / UFO about to fire — charge telegraph for clients. */
function emitEnemyCharge(room, e, opts) {
  if (!e || (e.kind !== 'common' && e.kind !== 'ufo')) return;
  const ms = e.kind === 'ufo'
    ? Math.round((ENEMY_UFO_CHARGE * 1000) / TPS)
    : Math.round((ENEMY_COMMON_CHARGE * 1000) / TPS);
  roomBroadcast(room, {
    t: 'ech',
    id: e.id | 0,
    ms,
    kind: e.kind,
    side: opts && opts.side != null ? (opts.side | 0) : 0
  });
}

/** Which UFO flank faces the target (for charge orb / turret visual). */
function pickUfoFireSide(e, tx, ty) {
  const { ly } = enemyLocalDelta(e, tx, ty);
  return ly < 0 ? -1 : 1;
}

function emitEnemyHp(room, e) {
  roomBroadcast(room, { t: 'eh', id: e.id, hp: e.hp | 0 });
}

function emitEnemyDead(room, e, silent) {
  roomBroadcast(room, { t: 'ed', id: e.id, x: e.x, y: e.y, silent: !!silent });
}

function clearSoloEnemies(room, silent) {
  if (!room.enemies) room.enemies = [];
  for (const e of room.enemies) {
    if (enemyIsSpawned(e)) emitEnemyDead(room, e, silent);
  }
  room.enemies.length = 0;
}

function randomWanderPoint() {
  const pad = 30 * RES_SCALE;
  return {
    x: pad + Math.random() * (W - pad * 2),
    y: pad + Math.random() * (H - pad * 2)
  };
}

/** Spawn just outside a random screen edge so the ship flies into view. */
function randomOffscreenSpawnPoint(margin) {
  const m = margin != null ? margin : 36 * RES_SCALE;
  const side = (Math.random() * 4) | 0;
  if (side === 0) return { x: -m, y: Math.random() * H };
  if (side === 1) return { x: W + m, y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: -m };
  return { x: Math.random() * W, y: H + m };
}

/** Place enemy off-screen aimed at an on-field wander point. */
function placeEnemyOffscreenEntry(e) {
  const spawn = randomOffscreenSpawnPoint((e.r || 12) + 24 * RES_SCALE);
  const target = randomWanderPoint();
  e.x = spawn.x;
  e.y = spawn.y;
  e.spawnX = spawn.x;
  e.spawnY = spawn.y;
  e.tx = target.x;
  e.ty = target.y;
  rollEnemyWanderTimer(e);
  const ang = Math.atan2(target.y - spawn.y, target.x - spawn.x);
  e.angle = ang;
  e.dir = ang;
  e.vx = Math.cos(ang) * enemySpeed(e);
  e.vy = Math.sin(ang) * enemySpeed(e);
  e.enteredPlay = false;
}

function makeEnemy(kind, wave, weapon) {
  let k = 'common';
  if (kind === 'ufo') k = 'ufo';
  else if (kind === 'carrier') k = 'carrier';
  else if (kind === 'worm') k = 'worm';
  // Random 4–6s before first shot (reuse fireCd / shootCd — no extra timer).
  const firstShotCd = Math.round(
    (ENEMY_FIRST_SHOT_MIN_S + Math.random() * (ENEMY_FIRST_SHOT_MAX_S - ENEMY_FIRST_SHOT_MIN_S)) * TPS
  );
  const e = {
    id: 0,
    kind: k,
    weapon: k === 'carrier' ? (weapon || 'laser') : '',
    move: ENEMY_MOVE_DESTINATION_SMOOTH,
    x: 0,
    y: 0,
    spawnX: 0,
    spawnY: 0,
    spawnSt: Date.now(),
    vx: 0,
    vy: 0,
    angle: 0,
    dir: 0,
    hp: ENEMY_HP[k] != null ? ENEMY_HP[k] : ENEMY_HP.common,
    r: k === 'ufo' ? ENEMY_UFO_HIT_R : (ENEMY_R[k] || ENEMY_R.common),
    tx: 0,
    ty: 0,
    fireCd: firstShotCd,
    shootAmmo: 0,
    // Carriers gate on shootCd; commons/UFOs use fireCd.
    shootCd: k === 'carrier' ? firstShotCd : 0,
    reloadLeft: 0,
    bursting: false,
    railChargeLeft: 0,
    lastLaserAng: null,
    enteredPlay: false,
    speed: randomEnemyWanderSpeed()
  };
  placeEnemyOffscreenEntry(e);
  if (k === 'carrier') {
    if (e.weapon === 'laser') e.shootAmmo = ENEMY_LASER.ammo;
    else if (e.weapon === 'plasma') e.shootAmmo = ENEMY_PLASMA.ammo;
    else if (e.weapon === 'rail') e.shootAmmo = 1;
  }
  return e;
}

/**
 * Commons only on even waves: wave 2→2, 4→4, 6→6… (odd waves: 0).
 * UFO is not planned here — rolled at spawn time (15% UFO-only wave).
 */
const MAX_COMMON_ON_FIELD = 4;
const COMMON_QUEUE_SPAWN_DELAY = Math.round(2 * TPS);
const UFO_WAVE_CHANCE = 0.25;

function soloEnemyCounts(wave) {
  const n = Math.max(1, wave | 0);
  return {
    common: n % 2 === 0 ? n : 0,
    ufo: 0,
    carrier: 0
  };
}

function enemyIsSpawned(e) {
  return !e.queued && (e.appearLeft | 0) <= 0;
}

/** Commons that already hold a field slot (active or counting down to appear). */
function countCommonSlots(room) {
  let n = 0;
  for (const e of room.enemies || []) {
    if (e.kind !== 'common' || e.queued) continue;
    n++;
  }
  return n;
}

/** When a slot frees, pull the next queued common in with a 2s delay. */
function tryPromoteQueuedCommons(room) {
  if (!room.enemies) return;
  while (countCommonSlots(room) < MAX_COMMON_ON_FIELD) {
    const next = room.enemies.find(e => e.kind === 'common' && e.queued);
    if (!next) break;
    next.queued = false;
    next.appearLeft = COMMON_QUEUE_SPAWN_DELAY;
  }
}

function spawnSoloWaveEnemies(room, wave) {
  if (!room.enemies) room.enemies = [];
  if (!room.nextEnemyId) room.nextEnemyId = 1;
  const c = soloEnemyCounts(wave);
  let commonN = c.common | 0;
  if (commonN <= 0) return;

  // 25% UFO wave: add one UFO and keep half the commons (random).
  const spawnUfo = Math.random() < UFO_WAVE_CHANCE;
  if (spawnUfo) {
    const e = makeEnemy('ufo', wave);
    e.id = room.nextEnemyId++;
    e.appearLeft = 0;
    e.queued = false;
    room.enemies.push(e);
    emitEnemyFire(room, e);
    commonN = Math.max(0, (commonN / 2) | 0);
  }

  for (let i = 0; i < commonN; i++) {
    const e = makeEnemy('common', wave);
    e.id = room.nextEnemyId++;
    if (i < MAX_COMMON_ON_FIELD) {
      e.queued = false;
      // Random delay 0–7s before the common appears on the field.
      e.appearLeft = (Math.random() * (7 * TPS + 1)) | 0;
      room.enemies.push(e);
      if (enemyIsSpawned(e)) emitEnemyFire(room, e);
    } else {
      // Over the live cap — wait until a common is destroyed.
      e.queued = true;
      e.appearLeft = 1;
      room.enemies.push(e);
    }
  }
}

function soloHumanTarget(room) {
  for (const p of room.players.values()) {
    if (!p.bot && p.hp > 0) return p;
  }
  return null;
}

function pushSoloAimHist(room, target) {
  if (!room.soloAimHist) room.soloAimHist = [];
  if (!target) return;
  room.soloAimHist.push({ x: target.x, y: target.y });
  while (room.soloAimHist.length > ENEMY_LASER_AIM_DELAY + 8) room.soloAimHist.shift();
}

function carrierLaserAimAngle(room, e, target) {
  const hist = room.soloAimHist || [];
  if (hist.length > ENEMY_LASER_AIM_DELAY) {
    const p = hist[hist.length - 1 - ENEMY_LASER_AIM_DELAY];
    return Math.atan2(p.y - e.y, p.x - e.x);
  }
  if (e.lastLaserAng != null && Number.isFinite(e.lastLaserAng)) return e.lastLaserAng;
  return Math.atan2(target.y - e.y, target.x - e.x);
}

function enemyFxOwner(e) {
  return -(e.id | 0);
}

function enemyHasLosToPlayer(room, e, target) {
  const ang = Math.atan2(target.y - e.y, target.x - e.x);
  const dist = Math.hypot(target.x - e.x, target.y - e.y);
  return !asteroidBlocksRay(room, e.x, e.y, ang, dist + 4);
}

function fireEnemyLaserBeam(room, e, ang) {
  const range = ENEMY_LASER.range;
  const dmg = ENEMY_LASER.dmg;
  const ox = e.x + Math.cos(ang) * (e.r + 4);
  const oy = e.y + Math.sin(ang) * (e.r + 4);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const width = 2 + (Math.random() * 4 | 0);
  const now = Date.now();
  const owner = enemyFxOwner(e);
  const hit = raycastFirst(room, 0, ox, oy, dx, dy, range);
  if (!hit) {
    roomBroadcast(room, {
      t: 'lf',
      l: [room.nextBulletId++, ox, oy, ox + dx * range, oy + dy * range, width, now, owner],
      hit: 0,
      w: 'laser'
    });
  } else {
    const hitKind = hit.kind === 'player' || hit.kind === 'rocket' ? 1 : 2;
    roomBroadcast(room, {
      t: 'lf',
      l: [room.nextBulletId++, ox, oy, hit.x, hit.y, width, now, owner],
      hit: hitKind,
      w: 'laser'
    });
    if (hit.kind === 'player') dealDamageToPlayer(room, hit.target, dmg);
    else if (hit.kind === 'asteroid') damageAsteroid(room, hit.target, dmg, 0);
    else if (hit.kind === 'rocket') deflectRocketAwayFrom(room, hit.target, ox, oy);
  }
  e.angle = ang;
  e.lastLaserAng = ang;
}

function fireEnemyRailBeam(room, e, target) {
  const ang = Math.atan2(target.y - e.y, target.x - e.x);
  const range = Math.hypot(W, H);
  const ox = e.x + Math.cos(ang) * (e.r + 4);
  const oy = e.y + Math.sin(ang) * (e.r + 4);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const width = 4 * RES_SCALE;
  const now = Date.now();
  const owner = enemyFxOwner(e);
  const hit = raycastFirst(room, 0, ox, oy, dx, dy, range);
  const x1 = hit ? hit.x : ox + dx * range;
  const y1 = hit ? hit.y : oy + dy * range;
  const hitKind = !hit ? 0 : hit.kind === 'player' || hit.kind === 'rocket' ? 1 : 2;
  roomBroadcast(room, {
    t: 'rf',
    l: [room.nextBulletId++, ox, oy, x1, y1, width, now, owner],
    hit: hitKind
  });
  if (hit) {
    if (hit.kind === 'player') dealDamageToPlayer(room, hit.target, ENEMY_RAIL_DMG);
    else if (hit.kind === 'asteroid') damageAsteroid(room, hit.target, ENEMY_RAIL_DMG, 0);
    else if (hit.kind === 'rocket') deflectRocketAwayFrom(room, hit.target, ox, oy);
  }
  e.angle = ang;
}

function fireEnemyPlasmaBolt(room, e, ang) {
  const spd = ENEMY_PLASMA.speed;
  const x = e.x + Math.cos(ang) * (e.r + 4);
  const y = e.y + Math.sin(ang) * (e.r + 4);
  const now = Date.now();
  const b = {
    id: room.nextBulletId++,
    owner: 0,
    enemyOwner: e.id,
    type: 'plasma',
    dmg: ENEMY_PLASMA.dmg,
    x, y,
    spawnX: x,
    spawnY: y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    spawnSt: now
  };
  room.bullets.push(b);
  roomBroadcast(room, { t: 'bf', b: packBullet(b) });
  e.angle = ang;
}

function consumeCarrierShot(e, wpn) {
  e.shootAmmo--;
  if (wpn === 'laser') e.shootCd = ENEMY_LASER.cooldown;
  else if (wpn === 'plasma') e.shootCd = ENEMY_PLASMA.cooldown;
  else if (wpn === 'rail') e.shootCd = WEAPONS.railgun.cooldown;
  if (e.shootAmmo <= 0) {
    e.bursting = false;
    e.railChargeLeft = 0;
    if (wpn === 'rail') {
      e.shootAmmo = 1;
      e.reloadLeft = 0;
    } else if (wpn === 'laser') {
      e.reloadLeft = ENEMY_LASER.reload;
    } else {
      e.reloadLeft = ENEMY_PLASMA.reload;
    }
  }
}

function updateCarrierWeapon(room, e, target) {
  if ((e.shootCd | 0) > 0) e.shootCd--;
  if ((e.reloadLeft | 0) > 0) {
    e.reloadLeft--;
    if (e.reloadLeft === 0) {
      if (e.weapon === 'laser') e.shootAmmo = ENEMY_LASER.ammo;
      else if (e.weapon === 'plasma') e.shootAmmo = ENEMY_PLASMA.ammo;
      else e.shootAmmo = 1;
    }
    e.bursting = false;
    e.railChargeLeft = 0;
    return;
  }

  const wpn = e.weapon;
  if (wpn === 'laser') {
    const los = enemyHasLosToPlayer(room, e, target);
    if (!los) {
      e.bursting = false;
      return;
    }
    if (!e.bursting && e.shootAmmo > 0) e.bursting = true;
    if (!e.bursting || e.shootCd > 0 || e.shootAmmo <= 0) return;
    const ang = carrierLaserAimAngle(room, e, target);
    fireEnemyLaserBeam(room, e, ang);
    consumeCarrierShot(e, 'laser');
    return;
  }

  if (wpn === 'rail') {
    const los = enemyHasLosToPlayer(room, e, target);
    if (!los) {
      if ((e.railChargeLeft | 0) > 0) {
        e.railChargeLeft = 0;
        e.bursting = false;
      }
      return;
    }
    if ((e.shootCd | 0) > 0) return;
    if (e.shootAmmo <= 0) return;

    if ((e.railChargeLeft | 0) <= 0 && !e.bursting) {
      e.bursting = true;
      e.railChargeLeft = ENEMY_RAIL_CHARGE;
      roomBroadcast(room, {
        t: 'rc',
        id: enemyFxOwner(e),
        ms: Math.round(ENEMY_RAIL_CHARGE * (1000 / TPS)),
        st: Date.now()
      });
    }
    if ((e.railChargeLeft | 0) <= 0) return;
    e.railChargeLeft--;
    e.angle = Math.atan2(target.y - e.y, target.x - e.x);
    if (e.railChargeLeft > 0) return;
    fireEnemyRailBeam(room, e, target);
    consumeCarrierShot(e, 'rail');
    e.bursting = false;
    return;
  }

  if (wpn === 'plasma') {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    if (dist > ENEMY_PLASMA_RANGE) {
      e.bursting = false;
      return;
    }
    if (!e.bursting && e.shootAmmo > 0) e.bursting = true;
    if (!e.bursting || e.shootCd > 0 || e.shootAmmo <= 0) return;
    const ang = Math.atan2(target.y - e.y, target.x - e.x);
    fireEnemyPlasmaBolt(room, e, ang);
    consumeCarrierShot(e, 'plasma');
  }
}

function fireEnemyLineBullet(room, e, ang, spd, dmg) {
  const speed = spd != null ? spd : ENEMY_BULLET_SPEED;
  const damage = dmg != null ? dmg : BULLET_TYPES.enemy.dmg;
  const x = e.x + Math.cos(ang) * (e.r + 4);
  const y = e.y + Math.sin(ang) * (e.r + 4);
  const now = Date.now();
  const b = {
    id: room.nextBulletId++,
    owner: 0,
    enemyOwner: e.id,
    type: 'enemy',
    dmg: damage,
    x, y,
    spawnX: x,
    spawnY: y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    spawnSt: now
  };
  room.bullets.push(b);
  roomBroadcast(room, { t: 'bf', b: packBullet(b) });
}

/** UFO lead-aim rocket (tiny, skips asteroids). Spawn + aim from hull center — turrets visual only. */
function fireEnemyRocket(room, e, ang, spd, dmg) {
  const speed = spd != null ? spd : ENEMY_UFO_ROCKET_SPEED;
  const damage = dmg != null ? dmg : BULLET_TYPES.enemyRocket.dmg;
  const x = e.x;
  const y = e.y;
  const now = Date.now();
  const b = {
    id: room.nextBulletId++,
    owner: 0,
    enemyOwner: e.id,
    type: 'enemyRocket',
    dmg: damage,
    x, y,
    spawnX: x,
    spawnY: y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    spawnSt: now
  };
  room.bullets.push(b);
  roomBroadcast(room, { t: 'bf', b: packBullet(b) });
}

function enemyTryFire(room, e) {
  const target = soloHumanTarget(room);
  if (!target) return;

  if (e.kind === 'carrier') {
    updateCarrierWeapon(room, e, target);
    return;
  }

  // Worm is visual/test for now — wanders, does not shoot.
  if (e.kind === 'worm') return;

  if ((e.fireCd | 0) > 0) return;

  if (e.kind === 'ufo') {
    // Full 360° lead aim from hull — not clamped to turret arcs.
    const ang = leadInterceptAngleFlat(
      e.x, e.y,
      target.x, target.y,
      target.vx || 0, target.vy || 0,
      ENEMY_UFO_ROCKET_SPEED
    );
    fireEnemyRocket(room, e, ang);
    e.fireCd = ENEMY_UFO_RELOAD;
    return;
  }

  // Commons: fire along current facing (wander / turn), not at the player.
  // Charge orbs sit on the nose — aiming at the player while facing elsewhere
  // looked like a charge with no bullets.
  const base = (e.dir != null && Number.isFinite(e.dir)) ? e.dir
    : (Number.isFinite(e.angle) ? e.angle : 0);
  const spread = (15 * Math.PI) / 180;
  fireEnemyLineBullet(room, e, base, ENEMY_COMMON_BULLET_SPEED, ENEMY_COMMON_BULLET_DMG);
  fireEnemyLineBullet(room, e, base - spread, ENEMY_COMMON_BULLET_SPEED, ENEMY_COMMON_BULLET_DMG);
  fireEnemyLineBullet(room, e, base + spread, ENEMY_COMMON_BULLET_SPEED, ENEMY_COMMON_BULLET_DMG);
  e.fireCd = ENEMY_COMMON_RELOAD;
}

function rollEnemyWanderTimer(e) {
  const lo = ENEMY_WANDER_RETARGET_MIN_S;
  const hi = ENEMY_WANDER_RETARGET_MAX_S;
  const sec = lo + Math.random() * (hi - lo);
  e.wanderLeft = Math.max(1, Math.round(sec * TPS));
}

function pickEnemyWanderTarget(e) {
  const t = randomWanderPoint();
  e.tx = t.x;
  e.ty = t.y;
  rollEnemyWanderTimer(e);
  if (enemyMoveType(e) === ENEMY_MOVE_DESTINATION_SMOOTH) {
    if (e.dir == null || !Number.isFinite(e.dir)) e.dir = e.angle || 0;
    e.vx = Math.cos(e.dir) * enemySpeed(e);
    e.vy = Math.sin(e.dir) * enemySpeed(e);
  } else {
    const ang = Math.atan2(e.ty - e.y, e.tx - e.x);
    e.angle = ang;
    e.dir = ang;
    e.vx = Math.cos(ang) * enemySpeed(e);
    e.vy = Math.sin(ang) * enemySpeed(e);
  }
  stampEnemyNet(e);
}

function clampEnemyPlayfield(e) {
  if (!e.enteredPlay) {
    if (e.x >= 8 && e.x <= W - 8 && e.y >= 8 && e.y <= H - 8) {
      e.enteredPlay = true;
    }
    return;
  }
  if (e.x < 8) e.x = 8;
  if (e.x > W - 8) e.x = W - 8;
  if (e.y < 8) e.y = 8;
  if (e.y > H - 8) e.y = H - 8;
}

/** One sim tick of movement. Returns true if arrived at wander target. */
function stepEnemyMovement(e) {
  const dx = e.tx - e.x;
  const dy = e.ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ENEMY_ARRIVE_R) return true;

  const desired = Math.atan2(dy, dx);
  const carrierLocked = e.kind === 'carrier' && (e.bursting || (e.railChargeLeft | 0) > 0);

  if (enemyMoveType(e) === ENEMY_MOVE_DESTINATION_SMOOTH) {
    if (e.dir == null || !Number.isFinite(e.dir)) e.dir = e.angle || 0;
    e.dir = turnAngleToward(e.dir, desired, ENEMY_TURN_MAX);
    e.vx = Math.cos(e.dir) * enemySpeed(e);
    e.vy = Math.sin(e.dir) * enemySpeed(e);
    e.x += e.vx;
    e.y += e.vy;
    if (!carrierLocked) e.angle = e.dir;
  } else {
    if (!carrierLocked) {
      e.angle = desired;
      e.dir = desired;
    }
    e.vx = Math.cos(desired) * enemySpeed(e);
    e.vy = Math.sin(desired) * enemySpeed(e);
    e.x += e.vx;
    e.y += e.vy;
  }
  clampEnemyPlayfield(e);
  return false;
}

function updateEnemies(room) {
  if (!room.practice || !room.enemies) return;
  const target = soloHumanTarget(room);
  pushSoloAimHist(room, target);

  for (let i = room.enemies.length - 1; i >= 0; i--) {
    const e = room.enemies[i];
    if (e.queued) continue;
    if ((e.appearLeft | 0) > 0) {
      e.appearLeft--;
      if ((e.appearLeft | 0) <= 0) {
        // Fresh edge entry when the delay ends (queued or staggered commons).
        placeEnemyOffscreenEntry(e);
        emitEnemyFire(room, e);
      }
      continue;
    }
    if ((e.fireCd | 0) > 0) e.fireCd--;
    // Pre-shot charge telegraph (commons 1s, UFO turrets 0.5s).
    if (e.kind === 'common' && (e.fireCd | 0) === ENEMY_COMMON_CHARGE) {
      emitEnemyCharge(room, e);
    }
    if (e.kind === 'ufo' && (e.fireCd | 0) === ENEMY_UFO_CHARGE) {
      // Charge at hull center (same origin as rocket spawn / lead aim).
      emitEnemyCharge(room, e);
    }

    if (e.wanderLeft == null || !Number.isFinite(e.wanderLeft)) rollEnemyWanderTimer(e);
    if ((e.wanderLeft | 0) > 0) e.wanderLeft--;
    const arrived = stepEnemyMovement(e);
    const timedOut = (e.wanderLeft | 0) <= 0;
    if (arrived || timedOut) {
      pickEnemyWanderTarget(e);
      emitEnemyUpdate(room, e);
    }

    enemyTryFire(room, e);
  }

  // Periodic full pose snap (~2 Hz) so clients stay locked.
  room.enemySnapLeft = (room.enemySnapLeft | 0) - 1;
  if ((room.enemySnapLeft | 0) <= 0) {
    room.enemySnapLeft = ENEMY_SNAP_INTERVAL;
    emitEnemySnap(room);
  }
}

function damageEnemy(room, e, dmg) {
  if (!e || e.hp <= 0) return;
  e.hp -= dmg;
  if (e.hp > 0) {
    emitEnemyHp(room, e);
    return;
  }
  const wasCommon = e.kind === 'common';
  emitEnemyDead(room, e, false);
  const idx = room.enemies.indexOf(e);
  if (idx >= 0) room.enemies.splice(idx, 1);
  if (wasCommon) tryPromoteQueuedCommons(room);
}

function enemyUsesRectHit(e) {
  return !!(e && e.kind === 'ufo');
}

/** Local coords of world point relative to enemy center/facing (toroidal). */
function enemyLocalDelta(e, px, py) {
  const wx = shortestWrapDelta(e.x, px, W);
  const wy = shortestWrapDelta(e.y, py, H);
  const c = Math.cos(e.angle || 0);
  const s = Math.sin(e.angle || 0);
  return {
    lx: wx * c + wy * s,
    ly: -wx * s + wy * c
  };
}

function circleHitsEnemyRect(cx, cy, cr, e) {
  const hl = ENEMY_UFO_HIT_LEN * 0.5;
  const hw = ENEMY_UFO_HIT_WID * 0.5;
  const { lx, ly } = enemyLocalDelta(e, cx, cy);
  const qx = Math.max(-hl, Math.min(hl, lx));
  const qy = Math.max(-hw, Math.min(hw, ly));
  const dx = lx - qx;
  const dy = ly - qy;
  return dx * dx + dy * dy <= cr * cr;
}

/** Ray vs oriented rect; returns distance t along ray or null. */
function raycastOrientedRect(ox, oy, dx, dy, cx, cy, angle, hl, hw, maxDist) {
  const c = Math.cos(angle || 0);
  const s = Math.sin(angle || 0);
  const fx = ox - cx;
  const fy = oy - cy;
  const lx = fx * c + fy * s;
  const ly = -fx * s + fy * c;
  const ldx = dx * c + dy * s;
  const ldy = -dx * s + dy * c;
  let tmin = 0;
  let tmax = maxDist != null ? maxDist : 1e12;

  function slab(p, d, minB, maxB) {
    if (Math.abs(d) < 1e-12) {
      if (p < minB || p > maxB) return false;
      return true;
    }
    let t1 = (minB - p) / d;
    let t2 = (maxB - p) / d;
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    return tmin <= tmax;
  }

  if (!slab(lx, ldx, -hl, hl)) return null;
  if (!slab(ly, ldy, -hw, hw)) return null;
  const tHit = tmin >= 0 ? tmin : tmax;
  if (tHit < 0 || (maxDist != null && tHit > maxDist)) return null;
  return tHit;
}

function raycastEnemyRectToroidal(ox, oy, dx, dy, e, maxDist) {
  const hl = ENEMY_UFO_HIT_LEN * 0.5;
  const hw = ENEMY_UFO_HIT_WID * 0.5;
  let best = null;
  for (let oxw = -W; oxw <= W; oxw += W) {
    for (let oyw = -H; oyw <= H; oyw += H) {
      const t = raycastOrientedRect(
        ox, oy, dx, dy,
        e.x + oxw, e.y + oyw, e.angle || 0,
        hl, hw, maxDist
      );
      if (t == null) continue;
      if (best == null || t < best.t) {
        best = { t, x: ox + dx * t, y: oy + dy * t };
      }
    }
  }
  return best;
}

function distToEnemyHit(px, py, e) {
  if (enemyUsesRectHit(e)) {
    const hl = ENEMY_UFO_HIT_LEN * 0.5;
    const hw = ENEMY_UFO_HIT_WID * 0.5;
    const { lx, ly } = enemyLocalDelta(e, px, py);
    const qx = Math.max(-hl, Math.min(hl, lx));
    const qy = Math.max(-hw, Math.min(hw, ly));
    return Math.hypot(lx - qx, ly - qy);
  }
  const er = e.r || ENEMY_R.common || 10;
  return Math.max(0, Math.sqrt(torusDistSq(px, py, e.x, e.y)) - er);
}

function hitBulletEnemy(b, e) {
  if (enemyUsesRectHit(e)) {
    const cfg = BULLET_TYPES[b.type] || BULLET_TYPES.default;
    let br = cfg.size || 2;
    if (cfg.col === 'ellipse') br = Math.max(cfg.size || 2, (cfg.size || 2) * (cfg.scaleY || 1));
    if (cfg.col === 'line') br = Math.max(cfg.width || 2, 2);
    return circleHitsEnemyRect(b.x, b.y, br, e);
  }
  return hitBulletTarget(b, e.x, e.y, e.r, false);
}

function beginSoloWave(room, wave, opts) {
  room.wave = Math.max(1, wave | 0);
  room.waveClearLeft = 0;
  room.pendingBigSpawns = [];
  room.soloAimHist = [];
  // Quietly remove leftover rocks / inbound spawns.
  for (const a of room.asteroids) {
    emitAsteroidDead(room, a.aid, true);
  }
  setAsteroidsList(room, createSoloWaveAsteroids(room.wave));
  for (const a of room.asteroids) emitAsteroidFire(room, a);
  clearSoloEnemies(room, true);
  spawnSoloWaveEnemies(room, room.wave);
  placePlayersAtWaveStart(room, opts);
  broadcastSoloWave(room, opts);
  console.log(
    `Solo room ${room.id} wave ${room.wave} (${room.asteroids.length} asteroids, ${room.enemies.length} enemies)`
  );
}

/** New wave: refresh godmode / clear stun. Solo waves always teleport to world middle. */
function placePlayersAtWaveStart(room, opts) {
  const center = !!room.practice && !room.coop;
  for (const p of room.players.values()) {
    if (p.bot || (p.hp | 0) <= 0) continue;
    if (center) {
      p.x = W * 0.5;
      p.y = H * 0.5;
      p.vx = 0;
      p.vy = 0;
      p.av = 0;
      p.angle = -Math.PI / 2;
    }
    p.stunned = false;
    p.collideCd = 0;
    p.godLeft = GODMODE_TICKS;
    p.inputQueue = [];
  }
}

function tickSoloWaves(room) {
  if (!room.practice) return;
  if (room.shopOpen) {
    // Safety: shop with nobody connected to finish it → force next wave.
    tryFinishSoloShop(room);
    return;
  }
  if ((room.deathShakeLeft | 0) > 0 || (room.deathBoomLeft | 0) > 0 || room.deathBoomed) return;

  if ((room.waveClearLeft | 0) > 0) {
    room.waveClearLeft--;
    if (room.waveClearLeft <= 0) {
      const next = (room.wave | 0) + 1;
      if (next >= 5 && next % 5 === 0) {
        openSoloShop(room, next);
      } else {
        beginSoloWave(room, next);
      }
    }
    return;
  }

  if (soloWaveHasFieldThreats(room)) return;
  if (room.pendingBigSpawns && room.pendingBigSpawns.length) {
    // Practice never schedules big refills; drop stale entries so waves can't soft-lock.
    if (room.practice) room.pendingBigSpawns.length = 0;
    else return;
  }
  // Field clear → brief beat, then next wave.
  room.waveClearLeft = SOLO_WAVE_CLEAR_TICKS;
  roomBroadcast(room, { t: 'waveClear', n: room.wave | 0 });
}

/** True if anything still blocks advancing the solo wave. */
function soloWaveHasFieldThreats(room) {
  for (const a of room.asteroids || []) {
    // Meteor-gun rocks are player shots — never block wave clear.
    if (a.playerShot) continue;
    // Off-screen inbound portal twins are handoff ghosts — don't soft-lock the wave.
    if (a.portalOfAid != null && isOffScreen(a)) continue;
    // Already entered then left the screen: wrap/cull owns these. Counting them
    // soft-locked empty fields (invisible rocks, turret skips isOffScreen).
    if (a.entered && isOffScreen(a)) continue;
    // Still inbound (not entered) or on-field → must clear.
    return true;
  }
  for (const e of room.enemies || []) {
    // Queued commons aren't on the field yet but still belong to this wave.
    return true;
  }
  return false;
}

function freshUnlockedWeapons() {
  const o = {};
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    o[WEAPON_SLOTS[i]] = WEAPON_SLOTS[i] === 'default';
  }
  return o;
}

function ensureUnlockedWeapons(p) {
  if (!p.unlockedWeapons) p.unlockedWeapons = freshUnlockedWeapons();
  return p.unlockedWeapons;
}

/** Exactly one owned weapon; all other unlocks/levels wiped. */
function ownOnlyWeapon(p, name, level) {
  if (!name || WEAPON_SLOTS.indexOf(name) < 0) name = 'default';
  const lvl = Math.max(1, Math.min(WEAPON_MAX_LEVEL, level != null ? (level | 0) : 1));
  if (!p.weaponLevels) p.weaponLevels = freshWeaponLevels();
  p.unlockedWeapons = {};
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    const k = WEAPON_SLOTS[i];
    p.unlockedWeapons[k] = k === name;
    p.weaponLevels[k] = k === name ? lvl : 1;
  }
  p.weapon = name;
}

function shopWeaponCost(p, weaponName) {
  ensureUnlockedWeapons(p);
  // Only the currently equipped gun can be upgraded; anything else is a fresh buy.
  if (p.weapon !== weaponName || !p.unlockedWeapons[weaponName]) return 800;
  const lvl = getWeaponLevel(p, weaponName);
  if (lvl >= WEAPON_MAX_LEVEL) return -1;
  const next = lvl + 1;
  return 800 + 200 * next;
}

function packShopState(room, p) {
  return {
    t: 'shop',
    wave: room.shopWave | 0,
    coins: p.coins | 0,
    score: p.coinsCollected | 0,
    lives: p.lives | 0,
    weapon: p.weapon || 'default',
    levels: Object.assign({}, p.weaponLevels || freshWeaponLevels()),
    unlocked: Object.assign({}, ensureUnlockedWeapons(p)),
    powerups: Object.assign({}, p.powerups || freshPowerups())
  };
}

function grantCoins(p, n) {
  const g = n | 0;
  if (!p || g <= 0) return 0;
  p.coins = (p.coins | 0) + g;
  p.coinsCollected = (p.coinsCollected | 0) + g;
  return g;
}

function notifyPlayerCoins(room, p) {
  for (const ws of room.clients) {
    if (ws.playerId === p.id && ws.readyState === 1) {
      send(ws, { t: 'coins', n: p.coins | 0, score: p.coinsCollected | 0 });
      return;
    }
  }
}

function notifyPlayerLives(room, p) {
  for (const ws of room.clients) {
    if (ws.playerId === p.id && ws.readyState === 1) {
      send(ws, { t: 'lives', n: p.lives | 0 });
      return;
    }
  }
}

function livingShopHumans(room) {
  // Only connected clients can Continue — disconnected ghosts must not block the shop.
  // room.clients is a Set (not an Array) — iterate, don't call Array#some on it.
  return [...room.players.values()].filter(p => {
    if (p.bot || (p.lives | 0) <= 0) return false;
    if (!room.clients) return false;
    for (const ws of room.clients) {
      if (ws.playerId === p.id && ws.readyState === 1) return true;
    }
    return false;
  });
}

/** Clear field so the shop wave is the only spawn source after everyone continues. */
function clearAsteroidsForShop(room) {
  room.pendingBigSpawns = [];
  if (!room.asteroids || !room.asteroids.length) return;
  for (const a of room.asteroids) {
    emitAsteroidDead(room, a.aid, true);
  }
  clearAsteroidsList(room);
}

function openSoloShop(room, nextWave) {
  room.shopOpen = true;
  room.shopWave = nextWave | 0;
  room.waveClearLeft = 0;
  room.shopDoneIds = new Set();
  clearAsteroidsForShop(room);
  clearSoloEnemies(room, true);
  for (const p of room.players.values()) {
    // Hard stop — stay parked for the whole shop session.
    p.vx = 0;
    p.vy = 0;
    p.av = 0;
    p.bursting = false;
    p.railChargeLeft = 0;
    if (p.bot) continue;
    // Normalize legacy multi-unlock loadouts to a single owned gun.
    if (p.weapon) ownOnlyWeapon(p, p.weapon, getWeaponLevel(p, p.weapon));
    for (const ws of room.clients) {
      if (ws.playerId === p.id && ws.readyState === 1) {
        send(ws, packShopState(room, p));
      }
    }
  }
}

function closeSoloShopAndStartWave(room) {
  if (!room.shopOpen) return;
  const wave = room.shopWave | 0;
  room.shopOpen = false;
  room.shopWave = 0;
  room.shopDoneIds = new Set();
  // Wave rooms only — admin dbgShop can open in PvP without restarting the match.
  if (!room.practice) return;
  // Asteroids for this wave spawn only here — after every living player continued.
  beginSoloWave(room, wave, { center: true });
}

function tryFinishSoloShop(room) {
  if (!room || !room.shopOpen) return;
  if (!room.shopDoneIds) room.shopDoneIds = new Set();
  const humans = livingShopHumans(room);
  if (!humans.length || humans.every(h => room.shopDoneIds.has(h.id))) {
    closeSoloShopAndStartWave(room);
  }
}

function markShopDone(room, playerId) {
  if (!room || !room.shopOpen) return;
  if (!room.shopDoneIds) room.shopDoneIds = new Set();
  room.shopDoneIds.add(playerId);
  tryFinishSoloShop(room);
}

/**
 * Shop purchase. item: 'weapon'|'powerup'|'life', name: weapon/powerup id.
 * Returns { ok, err? } and syncs buyer.
 */
function handleShopBuy(room, p, item, name) {
  if (!room || !room.shopOpen || !p || p.hp <= 0) return { ok: 0, err: 'closed' };
  ensureUnlockedWeapons(p);
  if (!p.weaponLevels) p.weaponLevels = freshWeaponLevels();
  if (!p.powerups) p.powerups = freshPowerups();

  if (item === 'life') {
    const cost = 2400;
    if ((p.coins | 0) < cost) return { ok: 0, err: 'coins' };
    p.coins = (p.coins | 0) - cost;
    p.lives = (p.lives | 0) + 1;
    notifyPlayerCoins(room, p);
    notifyPlayerLives(room, p);
    return { ok: 1 };
  }

  if (item === 'health') {
    const cost = 400;
    const cap = room.practice ? SOLO_MAX_HP : MAX_HP;
    if ((p.hp | 0) >= cap) return { ok: 0, err: 'full' };
    if ((p.coins | 0) < cost) return { ok: 0, err: 'coins' };
    p.coins = (p.coins | 0) - cost;
    p.hp = cap;
    notifyPlayerCoins(room, p);
    return { ok: 1, hp: p.hp | 0 };
  }

  if (item === 'powerup') {
    if (!POWERUP_TYPES.includes(name)) return { ok: 0, err: 'item' };
    if (p.powerups[name]) return { ok: 0, err: 'owned' };
    const cost = 1000;
    if ((p.coins | 0) < cost) return { ok: 0, err: 'coins' };
    p.coins = (p.coins | 0) - cost;
    p.powerups[name] = true;
    if (name === 'turret') resetTurretState(p);
    if (name === 'reload') {
      if (p.reloadLeft > 0) p.reloadLeft = Math.max(1, Math.round(p.reloadLeft * 0.5));
      if (p.turretReload > 0) p.turretReload = Math.max(1, Math.round(p.turretReload * 0.5));
    }
    notifyPlayerCoins(room, p);
    notifyPowerups(room, p);
    return { ok: 1 };
  }

  if (item === 'weapon') {
    if (WEAPON_SLOTS.indexOf(name) < 0) return { ok: 0, err: 'item' };
    const cost = shopWeaponCost(p, name);
    if (cost < 0) return { ok: 0, err: 'max' };
    if ((p.coins | 0) < cost) return { ok: 0, err: 'coins' };
    p.coins = (p.coins | 0) - cost;
    const upgrading = p.weapon === name && ensureUnlockedWeapons(p)[name];
    if (upgrading) {
      const next = Math.min(WEAPON_MAX_LEVEL, (getWeaponLevel(p, name) | 0) + 1);
      ownOnlyWeapon(p, name, next);
      const w = effectiveWeapon(p, name);
      p.shootAmmo = w.ammo;
      p.shootCd = 0;
      p.reloadLeft = 0;
      p.bursting = false;
      p.railChargeLeft = 0;
    } else {
      // Buy / switch: wipe previous gun completely, start at level 1.
      ownOnlyWeapon(p, name, 1);
      const w = effectiveWeapon(p, name);
      p.shootAmmo = w.ammo;
      p.shootCd = 0;
      p.reloadLeft = 0;
      p.bursting = false;
      p.railChargeLeft = 0;
    }
    notifyPlayerCoins(room, p);
    notifyPlayerWeapon(room, p, false);
    return { ok: 1 };
  }

  return { ok: 0, err: 'item' };
}

function splitAsteroid(room, parent) {
  const deathX = parent.x;
  const deathY = parent.y;
  const killerId = parent.lastHitBy | 0;
  const killer = killerId > 0 ? room.players.get(killerId) : null;

  // Golden ore: no shards / no flat kill bonus (coins already paid per hit).
  if (parent.special === 'golden') {
    emitAsteroidDead(room, parent.aid, false, deathX, deathY, 0, killerId > 0 ? killerId : null);
    if (!parent.centerRock && Math.random() < PICKUP_DROP_CHANCE) {
      spawnPickup(room, parent);
    }
    if (parent.big && !parent.centerRock) scheduleBigAsteroidSpawn(room);
    return;
  }

  let coinN = 0;
  if (killer && !killer.bot) {
    coinN = ASTEROID_COIN_GRANT;
    grantCoins(killer, coinN);
    notifyPlayerCoins(room, killer);
  }
  emitAsteroidDead(room, parent.aid, false, deathX, deathY, coinN, killerId > 0 ? killerId : null);
  // Any size can drop a pickup on destroy.
  if (!parent.centerRock && Math.random() < PICKUP_DROP_CHANCE) {
    spawnPickup(room, parent);
  }

  // Huge: 1 big + 4 small shards.
  if (parent.special === 'huge' || parent.size === 'huge') {
    if (!parent.centerRock) scheduleBigAsteroidSpawn(room);
    const parentHue = parent.hue != null
      ? wrapHue01(parent.hue)
      : asteroidHueFromShape(parent.shapeId != null ? parent.shapeId : parent.aid);
    const shards = [
      { size: 'big', count: 1 },
      { size: 'small', count: 4 }
    ];
    for (let s = 0; s < shards.length; s++) {
      const spec = shards[s];
      for (let i = 0; i < spec.count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const kick = (0.4 + Math.random() * 0.8) * RES_SCALE;
        const child = makeAsteroid({
          size: spec.size,
          allowSpecial: true,
          x: parent.x + Math.cos(ang) * parent.r * 0.25,
          y: parent.y + Math.sin(ang) * parent.r * 0.25,
          vx: parent.vx * 0.4 + Math.cos(ang) * kick,
          vy: parent.vy * 0.4 + Math.sin(ang) * kick,
          edgeWrapMax: 1,
          hue: shardHueFromParent(parentHue)
        });
        clampSpeed(child);
        pushAsteroid(room, child);
        emitAsteroidFire(room, child);
      }
    }
    return;
  }

  if (parent.size === 'small') return;

  // Non-center big destroyed → replacement enters from off-screen after a delay.
  if (parent.big && !parent.centerRock) scheduleBigAsteroidSpawn(room);

  const childSize = parent.big ? 'medium' : 'small';
  const count = parent.big
    ? (3 + (Math.random() * 2 | 0))   // big → medium: 3–4
    : (2 + (Math.random() * 2 | 0));  // medium → small: 2–3
  // Soft medium cap: never suppress shards from a destroyed big (that looked like
  // the rock "vanished"). Over-cap mediums are culled when they leave the screen.
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const kick = (0.4 + Math.random() * 0.8) * RES_SCALE;
    const parentHue = parent.hue != null
      ? wrapHue01(parent.hue)
      : asteroidHueFromShape(parent.shapeId != null ? parent.shapeId : parent.aid);
    const child = makeAsteroid({
      size: childSize,
      allowSpecial: true,
      x: parent.x + Math.cos(ang) * parent.r * 0.25,
      y: parent.y + Math.sin(ang) * parent.r * 0.25,
      vx: parent.vx * 0.4 + Math.cos(ang) * kick,
      vy: parent.vy * 0.4 + Math.sin(ang) * kick,
      edgeWrapMax: 1,
      hue: shardHueFromParent(parentHue)
    });
    clampSpeed(child);
    pushAsteroid(room, child);
    emitAsteroidFire(room, child);
  }
}

function spawnPickup(room, parent) {
  const ang = Math.random() * Math.PI * 2;
  const kick = (0.4 + Math.random() * 0.8) * RES_SCALE;
  const roll = Math.random();
  let kind = 'weapon';
  let weapon = null;
  let powerup = null;
  if (roll < 0.28) {
    kind = 'powerup';
    powerup = POWERUP_TYPES[Math.random() * POWERUP_TYPES.length | 0];
  } else if (roll < 0.64) {
    kind = 'health';
  } else {
    weapon = WEAPON_SLOTS[Math.random() * WEAPON_SLOTS.length | 0];
  }
  const x = parent.x + Math.cos(ang) * parent.r * 0.25;
  const y = parent.y + Math.sin(ang) * parent.r * 0.25;
  const vx = parent.vx * 0.4 + Math.cos(ang) * kick;
  const vy = parent.vy * 0.4 + Math.sin(ang) * kick;
  const angle = Math.random() * Math.PI * 2;
  const now = Date.now();
  const u = {
    id: room.nextPickupId++,
    kind,
    weapon,
    powerup,
    x, y, vx, vy,
    angle,
    spin: (Math.random() - 0.5) * 0.12,
    r: PICKUP_R,
    spawnX: x,
    spawnY: y,
    spawnAngle: angle,
    spawnSt: now,
    bounces: 0
  };
  clampSpeed(u);
  u.spawnX = u.x;
  u.spawnY = u.y;
  room.pickups.push(u);
  emitPickupFire(room, u);
}

/** F1 debug: spawn a random powerup pickup at world pose with given velocity. */
function spawnDebugPowerup(room, x, y, vx, vy, powerupName) {
  let powerup = powerupName;
  if (!POWERUP_TYPES.includes(powerup)) {
    powerup = POWERUP_TYPES[Math.random() * POWERUP_TYPES.length | 0];
  }
  const px = Math.max(PICKUP_R, Math.min(W - PICKUP_R, Number(x) || W * 0.5));
  const py = Math.max(PICKUP_R, Math.min(H - PICKUP_R, Number(y) || H * 0.5));
  const angle = Math.random() * Math.PI * 2;
  const now = Date.now();
  const u = {
    id: room.nextPickupId++,
    kind: 'powerup',
    weapon: null,
    powerup,
    x: px,
    y: py,
    vx: Number(vx) || 0,
    vy: Number(vy) || 0,
    angle,
    spin: (Math.random() - 0.5) * 0.18,
    r: PICKUP_R,
    spawnX: px,
    spawnY: py,
    spawnAngle: angle,
    spawnSt: now,
    bounces: 0
  };
  clampSpeed(u);
  u.spawnX = u.x;
  u.spawnY = u.y;
  room.pickups.push(u);
  emitPickupFire(room, u);
}

function applyPickupToPlayer(room, p, u) {
  if (u.kind === 'health') {
    const cap = room.practice ? SOLO_MAX_HP : MAX_HP;
    p.hp = Math.min(cap, p.hp + HEALTH_PICKUP_HEAL);
    for (const ws of room.clients) {
      if (ws.playerId === p.id && ws.readyState === 1) {
        send(ws, { t: 'pup', kind: 'health', hp: p.hp });
        break;
      }
    }
    return;
  }
  if (u.kind === 'powerup') {
    if (!p.powerups) p.powerups = freshPowerups();
    const name = u.powerup;
    if (!name || !POWERUP_TYPES.includes(name)) return;
    if (p.powerups[name]) return; // already owned — collect still removes pickup
    p.powerups[name] = true;
    if (name === 'turret') resetTurretState(p);
    if (name === 'reload') {
      if (p.reloadLeft > 0) p.reloadLeft = Math.max(1, Math.round(p.reloadLeft * 0.5));
      if (p.turretReload > 0) p.turretReload = Math.max(1, Math.round(p.turretReload * 0.5));
    }
    notifyPowerups(room, p);
    return;
  }
  const slot = WEAPON_SLOTS.indexOf(u.weapon) + 1;
  setPlayerWeapon(p, slot, true);
  notifyPlayerWeapon(room, p, true);
}

function isOffScreen(a) {
  const m = a.r + 2;
  return a.x < -m || a.x > W + m || a.y < -m || a.y > H + m;
}

/** True if any part of the rock circle intersects the playfield. */
function asteroidOverlapsPlayfield(a) {
  const r = a.r || 0;
  return a.x + r > 0 && a.x - r < W && a.y + r > 0 && a.y - r < H;
}

/** Twin spawn lead: circle reaches within this many px of the edge. */
const PORTAL_EDGE_LEAD = 30;

/** True when center is within lead+r of an edge and moving outward. */
function asteroidExitingScreen(a) {
  const r = (a.r || 0) + PORTAL_EDGE_LEAD;
  if (a.x + r > W && a.vx > 0) return true;
  if (a.x - r < 0 && a.vx < 0) return true;
  if (a.y + r > H && a.vy > 0) return true;
  if (a.y - r < 0 && a.vy < 0) return true;
  return false;
}

/** Center farther than lead+r from every edge — safe to arm / drop a pending twin. */
function asteroidClearOfPortalZone(a) {
  const r = (a.r || 0) + PORTAL_EDGE_LEAD;
  return a.x - r >= 0 && a.x + r <= W && a.y - r >= 0 && a.y + r <= H;
}

/** Circle completely inside the playfield (no edge overlap). */
function asteroidFullyInside(a) {
  const r = a.r || 0;
  return a.x - r >= 0 && a.x + r <= W && a.y - r >= 0 && a.y + r <= H;
}

/** Rocks that wrap (vs cull) when fully off-screen.
 *  World rocks: wrap until ASTEROID_LIFE_MS; after that, stay on-screen then cull
 *  off-screen with no further teleports.
 *  PvP: medium/big wrap while alive; smalls never wrap.
 *  Player meteor-gun shots: exactly edgeWrapMax classic teleports (default 1), then cull. */
function asteroidEdgeWrapMax(a) {
  const m = a && a.edgeWrapMax != null ? (a.edgeWrapMax | 0) : 1;
  return m > 0 ? m : 1;
}

function asteroidBornAt(a) {
  if (!a) return Date.now();
  if (a.bornAt != null) return a.bornAt;
  return a.spawnSt || Date.now();
}

/** True when a world rock's create-time lifetime has elapsed. */
function asteroidLifeExpired(a) {
  if (!a || a.playerShot || a.centerRock) return false;
  return Date.now() - asteroidBornAt(a) >= ASTEROID_LIFE_MS;
}

function asteroidWrapsExhausted(room, a) {
  // World rocks no longer die by wrap count — only meteor-gun shots do.
  if (a && a.playerShot) {
    return (a.edgeWraps | 0) >= asteroidEdgeWrapMax(a);
  }
  return false;
}

function asteroidWouldWrap(room, a) {
  if (a && a.playerShot) return !asteroidWrapsExhausted(room, a);
  // Lifetime over: no more portals/teleports — cull once fully off-screen.
  if (asteroidLifeExpired(a)) return false;
  if (asteroidWrapsExhausted(room, a)) return false;
  if (a.size === 'medium' && !a.centerRock && countMediumAsteroids(room) > mediumAsteroidCap(room)) {
    return false;
  }
  if (a.size === 'small' && !room.practice) return false;
  return true;
}

function touchAsteroidList(room) {
  if (!room) return;
  room.asteroidRev = ((room.asteroidRev | 0) + 1) | 0;
}

/** Rebuild aid → asteroid map from `room.asteroids` (after bulk replace). */
function syncAsteroidByAid(room) {
  let m = room.asteroidByAid;
  if (!m) {
    m = new Map();
    room.asteroidByAid = m;
  } else {
    m.clear();
  }
  const list = room.asteroids;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a && a.aid != null) m.set(a.aid, a);
  }
  touchAsteroidList(room);
  return m;
}

function pushAsteroid(room, a) {
  room.asteroids.push(a);
  let m = room.asteroidByAid;
  if (!m) {
    m = new Map();
    room.asteroidByAid = m;
  }
  m.set(a.aid, a);
  touchAsteroidList(room);
  return a;
}

/** Remove by list index (reverse-iteration culls). Keeps aid map in sync. */
function spliceAsteroidAt(room, idx) {
  if (idx < 0) return null;
  const a = room.asteroids[idx];
  room.asteroids.splice(idx, 1);
  if (a && room.asteroidByAid) room.asteroidByAid.delete(a.aid);
  if (a) touchAsteroidList(room);
  return a;
}

function removeAsteroid(room, a) {
  if (!a) return false;
  if (room.asteroidByAid) room.asteroidByAid.delete(a.aid);
  const idx = room.asteroids.indexOf(a);
  if (idx < 0) return false;
  room.asteroids.splice(idx, 1);
  touchAsteroidList(room);
  return true;
}

function clearAsteroidsList(room) {
  room.asteroids = [];
  if (room.asteroidByAid) room.asteroidByAid.clear();
  else room.asteroidByAid = new Map();
  touchAsteroidList(room);
}

function setAsteroidsList(room, list) {
  room.asteroids = list || [];
  syncAsteroidByAid(room);
}

function findAsteroidByAid(room, aid) {
  if (aid == null || !room) return null;
  const m = room.asteroidByAid;
  if (m) return m.get(aid) || null;
  for (const a of room.asteroids) {
    if (a.aid === aid) return a;
  }
  return null;
}

/** Remove a linked portal twin quietly (parent destroyed / culled). */
function removePortalTwin(room, a) {
  if (!a || a.portalTwinAid == null) return;
  const twinAid = a.portalTwinAid;
  a.portalTwinAid = null;
  const twin = findAsteroidByAid(room, twinAid);
  if (!twin) return;
  // If the twin already spawned its own twin, kill that too.
  removePortalTwin(room, twin);
  twin.portalOfAid = null;
  twin.noCollide = false;
  emitAsteroidDead(room, twin.aid, true);
  removeAsteroid(room, twin);
}

/** Drop an inbound portal twin (and clear its parent link). */
function destroyPortalInbound(room, twin) {
  if (!twin) return;
  if (twin.portalOfAid != null) {
    const parent = findAsteroidByAid(room, twin.portalOfAid);
    if (parent && parent.portalTwinAid === twin.aid) parent.portalTwinAid = null;
    twin.portalOfAid = null;
  }
  removePortalTwin(room, twin);
  emitAsteroidDead(room, twin.aid, true);
  removeAsteroid(room, twin);
}

/**
 * Single-axis wrap offset (dominant outward edge only).
 * Dual-axis corner offsets caused stacked twins / re-portals.
 */
function portalWrapOffset(a) {
  const r = (a.r || 0) + PORTAL_EDGE_LEAD;
  const right = (a.x + r > W && a.vx > 0) ? (a.x + r - W) : 0;
  const left = (a.x - r < 0 && a.vx < 0) ? (r - a.x) : 0;
  const bot = (a.y + r > H && a.vy > 0) ? (a.y + r - H) : 0;
  const top = (a.y - r < 0 && a.vy < 0) ? (r - a.y) : 0;
  const mx = Math.max(right, left);
  const my = Math.max(bot, top);
  if (mx <= 0 && my <= 0) return { ox: 0, oy: 0 };
  if (mx >= my) return { ox: right >= left ? -W : W, oy: 0 };
  return { ox: 0, oy: bot >= top ? -H : H };
}

/**
 * Spawn a same-pose clone on the opposite side of the arena so the exit
 * looks continuous. Twin starts noCollide while fully off-screen; collisions
 * enable as soon as any part overlaps the playfield (see asteroid tick).
 */
function spawnAsteroidPortalTwin(room, a) {
  if (!svPortal || !a || a.playerShot || a.portalTwinAid != null || a.portalOfAid != null) return null;
  if (room && room.shopOpen) return null;
  if (!a.portalArmed) return null;
  if (!asteroidWouldWrap(room, a)) return null;
  const { ox, oy } = portalWrapOffset(a);
  if (!ox && !oy) return null;

  const twin = makeAsteroid({
    size: a.size,
    special: a.special,
    allowSpecial: false,
    x: a.x + ox,
    y: a.y + oy,
    vx: a.vx,
    vy: a.vy,
    spin: a.spin,
    r: a.r,
    hp: a.hp,
    centerRock: false,
    shapeId: a.shapeId != null ? a.shapeId : a.aid,
    edgeWraps: a.edgeWraps | 0,
    edgeWrapMax: asteroidEdgeWrapMax(a),
    bornAt: asteroidBornAt(a),
    hue: a.hue != null
      ? wrapHue01(a.hue)
      : asteroidHueFromShape(a.shapeId != null ? a.shapeId : a.aid)
  });
  twin.angle = a.angle;
  twin.spawnAngle = a.angle;
  twin.maxHp = a.maxHp;
  twin.bornAt = asteroidBornAt(a);
  twin.entered = false;
  twin.noCollide = true;
  twin.portalOfAid = a.aid;
  twin.portalArmed = false;
  twin.portalGrace = 0;
  a.portalTwinAid = twin.aid;
  a.portalArmed = false; // one twin per exit; re-arm after leaving the approach zone
  resyncAsteroidSpawn(twin);
  pushAsteroid(room, twin);
  emitAsteroidFire(room, twin);
  return twin;
}

/**
 * Finish a portal wrap: keep inbound twin, delete exiting parent.
 * Returns true if parent was removed from room.asteroids.
 */
function handoffPortalTwin(room, parent) {
  if (!parent || parent.portalTwinAid == null) return false;
  const twin = findAsteroidByAid(room, parent.portalTwinAid);
  parent.portalTwinAid = null;
  if (!twin) return false;
  removePortalTwin(room, twin); // nested only
  twin.hp = parent.hp;
  twin.entered = true;
  twin.noCollide = false;
  twin.portalOfAid = null;
  twin.portalArmed = false;
  twin.portalGrace = Math.max(twin.portalGrace | 0, Math.round(0.2 * TPS));
  // Preserve create-time so wraps don't refresh the 20s lifetime.
  twin.bornAt = asteroidBornAt(parent);
  twin.edgeWrapMax = asteroidEdgeWrapMax(parent);
  twin.edgeWraps = parent.playerShot ? ((parent.edgeWraps | 0) + 1) : 0;
  resyncAsteroidSpawn(twin);
  emitAsteroidWrap(room, twin);
  emitAsteroidDead(room, parent.aid, true);
  removeAsteroid(room, parent);
  return true;
}

function playerSpawnPose(id, room) {
  // Solo waves: middle of the arena facing up.
  if (room && room.practice && !room.coop) {
    return { x: W * 0.5, y: H * 0.5, angle: -Math.PI / 2 };
  }
  // 1v1 / coop: left of center aiming left, right of center aiming right.
  const slot = (id - 1) & 1;
  if (slot === 0) {
    return { x: W * 0.5 - SPAWN_CENTER_OFFSET, y: H * 0.5, angle: Math.PI };
  }
  return { x: W * 0.5 + SPAWN_CENTER_OFFSET, y: H * 0.5, angle: 0 };
}

const CALLSIGN_POOL = [
  'VIPER', 'FOX', 'ACE', 'NOVA', 'REX', 'BLADE', 'GHOST', 'HAWK',
  'ORBIT', 'PULSE', 'DRIFT', 'COMET', 'RAZOR', 'ECHO', 'SPARK', 'WOLF'
];

function playerCallsign(p) {
  if (!p) return 'PILOT';
  return p.name || defaultCallsign(p.id);
}

function spawnPlayer(id, name, colors, room) {
  const pose = playerSpawnPose(id, room);
  const wpn = 'default';
  const levels = freshWeaponLevels();
  const w = effectiveWeapon({ weapon: wpn, weaponLevels: levels }, wpn);
  const pc = (colors && accountsDb.normalizeColor(colors.playerColor)) || accountsDb.DEFAULT_PLAYER_COLOR;
  const sc = (colors && accountsDb.normalizeColor(colors.shootColor)) || accountsDb.DEFAULT_SHOOT_COLOR;
  const tc = (colors && accountsDb.normalizeColor(colors.thrustColor)) || accountsDb.DEFAULT_THRUST_COLOR;
  const sid = (colors && accountsDb.normalizeShipId(colors.shipId)) || accountsDb.DEFAULT_SHIP_ID;
  return {
    id, name: sanitizeName(name) || defaultCallsign(id),
    playerColor: pc,
    shootColor: sc,
    thrustColor: tc,
    shipId: sid,
    x: pose.x, y: pose.y, vx: 0, vy: 0, angle: pose.angle, hp: MAX_HP,
    prevX: pose.x, prevY: pose.y,
    av: 0, turnDecelStep: 0, turnDecelLeft: 0, turnDecelRev: 0,
    stunned: false, collideCd: 0, godLeft: GODMODE_TICKS,
    /** Last opposing player who damaged this ship (frag credit). */
    lastHitBy: 0,
    score: 0,
    coins: 0,
    /** Lifetime coins picked up (never decreases on spend). */
    coinsCollected: 0,
    lives: 0,
    weapon: wpn,
    weaponLevels: levels,
    powerups: freshPowerups(),
    /** Admin cheat: buffed turret (see give admingun). */
    admingun: false,
    turretAmmo: TURRET_AMMO,
    turretCd: 0,
    turretReload: 0,
    turretRetry: 0,
    shootAmmo: w.ammo, shootCd: 0, reloadLeft: 0, bursting: false,
    railChargeLeft: 0,
    /** Legacy snap pad (always 0 — ground coin pools removed). */
    coinPoolPickup: 0,
    /** Fire origin lead ticks (sv_predict_shoot_step). */
    predictShootStep: 1,
    /** Aim lead ticks via av (sv_predict_shoot_angle). */
    predictShootAngle: 1,
    inp: { l: 0, r: 0, u: 0, sp: 0, sh: 0 },
    inputQueue: [],
    lastSeq: 0
  };
}

function respawnPlayer(room, p, keepLoadout, maxHp) {
  const pose = playerSpawnPose(p.id, room);
  p.x = pose.x; p.y = pose.y; p.vx = 0; p.vy = 0;
  p.angle = pose.angle;
  p.av = 0; p.turnDecelStep = 0; p.turnDecelLeft = 0; p.turnDecelRev = 0;
  p.stunned = false; p.collideCd = 0;
  p.godLeft = GODMODE_TICKS;
  p.lastHitBy = 0;
  p.hp = maxHp != null ? maxHp : MAX_HP;
  if (keepLoadout) {
    // Round winner: keep equipped weapon + its level only; wipe other guns.
    if (!p.weapon) p.weapon = 'default';
    if (!p.weaponLevels) p.weaponLevels = freshWeaponLevels();
    ownOnlyWeapon(p, p.weapon, getWeaponLevel(p, p.weapon));
    if (!p.powerups) p.powerups = freshPowerups();
  } else {
    // Round loser (or fresh): default gun, no upgrades, no powerups.
    ownOnlyWeapon(p, 'default', 1);
    p.powerups = freshPowerups();
  }
  const w = effectiveWeapon(p, p.weapon);
  p.shootAmmo = w.ammo;
  p.shootCd = 0; p.reloadLeft = 0; p.bursting = false;
  p.railChargeLeft = 0;
  resetTurretState(p);
  p.inputQueue = [];
}

/**
 * Equip a weapon slot.
 * Same weapon + pickup → upgrade level (max 3).
 * Different weapon → wipe old gun completely and start at level 1.
 */
function setPlayerWeapon(p, slot, fromPickup) {
  const name = WEAPON_SLOTS[(slot | 0) - 1];
  if (!name) return false;
  if (!p.weaponLevels) p.weaponLevels = freshWeaponLevels();
  ensureUnlockedWeapons(p);

  if (fromPickup && p.weapon === name) {
    ownOnlyWeapon(p, name, Math.min(WEAPON_MAX_LEVEL, (getWeaponLevel(p, name) | 0 || 1) + 1));
  } else if (p.weapon !== name) {
    ownOnlyWeapon(p, name, 1);
  } else {
    ownOnlyWeapon(p, name, getWeaponLevel(p, name));
  }

  const w = effectiveWeapon(p, name);
  p.shootAmmo = w.ammo;
  p.shootCd = 0;
  p.reloadLeft = 0;
  p.bursting = false;
  p.railChargeLeft = 0;
  return true;
}

function notifyPlayerWeapon(room, p, fromPickup) {
  const slot = WEAPON_SLOTS.indexOf(p.weapon) + 1;
  const lvl = getWeaponLevel(p, p.weapon);
  for (const ws of room.clients) {
    if (ws.playerId === p.id && ws.readyState === 1) {
      send(ws, {
        t: 'wpn',
        w: slot,
        weapon: p.weapon,
        lvl,
        levels: p.weaponLevels,
        unlocked: Object.assign({}, ensureUnlockedWeapons(p)),
        pickup: !!fromPickup
      });
      return;
    }
  }
}

/** Normalize console give aliases → canonical weapon / powerup / admingun. */
function resolveAdminGiveItem(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!s) return null;
  if (s === 'admingun' || s === 'admin') return { kind: 'admingun', name: 'admingun' };
  const weaponAlias = {
    default: 'default', gun: 'default', blaster: 'default',
    rocket: 'rocket', rockets: 'rocket',
    laser: 'laser',
    shotgun: 'shotgun', shot: 'shotgun', sg: 'shotgun',
    railgun: 'railgun', rail: 'railgun',
    plasma: 'plasma',
    voidcannon: 'voidcannon', void: 'voidcannon',
    asteroidgun: 'asteroidgun', meteor: 'asteroidgun', meteorgun: 'asteroidgun',
    asteroid: 'asteroidgun', meteorite: 'asteroidgun'
  };
  if (weaponAlias[s]) return { kind: 'weapon', name: weaponAlias[s] };
  if (WEAPON_SLOTS.indexOf(s) >= 0) return { kind: 'weapon', name: s };
  const powerAlias = {
    damage: 'damage', dmg: 'damage',
    turret: 'turret',
    shield: 'shield',
    homing: 'homing',
    lead: 'lead',
    emp: 'emp',
    reload: 'reload'
  };
  if (powerAlias[s]) return { kind: 'powerup', name: powerAlias[s] };
  if (POWERUP_TYPES.indexOf(s) >= 0) return { kind: 'powerup', name: s };
  return null;
}

/**
 * Admin console `spawn <kind>` — off-screen asteroid / enemy with normal entry path.
 * kinds: big medium small huge meteor common ufo worm
 */
function handleAdminSpawn(ws, kindRaw) {
  if (!ws || !ws.isAdmin) return { ok: 0, err: 'not admin' };
  const room = ws.room;
  if (!room || !room.matchLive) return { ok: 0, err: 'not in a live match' };
  const kind = String(kindRaw == null ? '' : kindRaw).toLowerCase().trim();

  if (kind === 'big' || kind === 'medium' || kind === 'small') {
    const a = makeAsteroid({ size: kind, offscreen: true, allowSpecial: false, special: null });
    pushAsteroid(room, a);
    emitAsteroidFire(room, a);
    return { ok: 1, kind, what: 'asteroid', aid: a.aid | 0 };
  }
  if (kind === 'huge') {
    const a = makeAsteroid({ size: 'huge', special: 'huge', offscreen: true, allowSpecial: false });
    pushAsteroid(room, a);
    emitAsteroidFire(room, a);
    return { ok: 1, kind, what: 'asteroid', aid: a.aid | 0 };
  }
  if (kind === 'meteor') {
    const a = makeAsteroid({ size: 'big', special: 'meteor', offscreen: true, allowSpecial: false });
    pushAsteroid(room, a);
    emitAsteroidFire(room, a);
    return { ok: 1, kind, what: 'asteroid', aid: a.aid | 0 };
  }
  if (kind === 'common' || kind === 'ufo' || kind === 'worm') {
    if (!room.practice) return { ok: 0, err: 'enemies only in solo/coop wave rooms' };
    if (!room.enemies) room.enemies = [];
    if (!room.nextEnemyId) room.nextEnemyId = 1;
    const e = makeEnemy(kind, room.wave || 1);
    e.id = room.nextEnemyId++;
    e.appearLeft = 0;
    e.queued = false;
    room.enemies.push(e);
    emitEnemyFire(room, e);
    return { ok: 1, kind, what: 'enemy', id: e.id | 0 };
  }
  return {
    ok: 0,
    err: 'usage: spawn big|medium|small|huge|meteor|common|ufo|worm'
  };
}

/**
 * Admin console `give <item>` — equip weapon, grant powerup, or enable buffed admingun turret.
 */
function handleAdminGive(ws, itemRaw) {
  if (!ws || !ws.isAdmin) return { ok: 0, err: 'not admin' };
  const room = ws.room;
  if (!room || ws.playerId == null) return { ok: 0, err: 'not in game' };
  const p = room.players.get(ws.playerId);
  if (!p || (p.hp | 0) <= 0) return { ok: 0, err: 'not in game' };

  const item = resolveAdminGiveItem(itemRaw);
  if (!item) {
    return {
      ok: 0,
      err: 'unknown item — weapons: default rocket laser shotgun rail plasma void meteor | powerups: damage turret shield homing lead emp reload | admingun'
    };
  }

  if (item.kind === 'admingun') {
    p.admingun = true;
    if (!p.powerups) p.powerups = freshPowerups();
    p.powerups.turret = true;
    resetTurretState(p);
    notifyPowerups(room, p);
    return { ok: 1, kind: 'admingun', item: 'admingun' };
  }

  if (item.kind === 'weapon') {
    const slot = WEAPON_SLOTS.indexOf(item.name) + 1;
    // Same as world pickup: new gun → L1, same gun again → upgrade (max 3).
    if (!setPlayerWeapon(p, slot, true)) return { ok: 0, err: 'bad weapon' };
    notifyPlayerWeapon(room, p, false);
    return {
      ok: 1,
      kind: 'weapon',
      item: item.name,
      lvl: getWeaponLevel(p, item.name),
      w: slot
    };
  }

  if (item.kind === 'powerup') {
    if (!p.powerups) p.powerups = freshPowerups();
    p.powerups[item.name] = true;
    if (item.name === 'turret') resetTurretState(p);
    if (item.name === 'reload') {
      if (p.reloadLeft > 0) p.reloadLeft = Math.max(1, Math.round(p.reloadLeft * 0.5));
      if (p.turretReload > 0) p.turretReload = Math.max(1, Math.round(p.turretReload * 0.5));
    }
    notifyPowerups(room, p);
    return { ok: 1, kind: 'powerup', item: item.name };
  }

  return { ok: 0, err: 'unknown item' };
}

function applyTurn(p, l, r, sh) {
  const dir = (l && !r) ? -1 : ((r && !l) ? 1 : 0);
  const precise = !!sh;
  const step = precise ? TURN_ACCEL_PRECISE : TURN_ACCEL;
  const avMax = precise ? TURN_AV_MAX_PRECISE : TURN_AV_MAX;
  const stunned = !!p.stunned;

  if (dir !== 0) {
    const opposite = p.av !== 0 && Math.sign(p.av) !== dir;
    if (opposite) {
      if (!(p.turnDecelLeft > 0) || !p.turnDecelRev) {
        p.turnDecelStep = p.av / TURN_DECEL_REVERSE_FRAMES;
        p.turnDecelLeft = TURN_DECEL_REVERSE_FRAMES;
        p.turnDecelRev = 1;
      }
      p.av -= p.turnDecelStep;
      p.turnDecelLeft--;
      if (p.turnDecelLeft <= 0) {
        p.turnDecelStep = 0;
        p.turnDecelLeft = 0;
        p.turnDecelRev = 0;
      }
      p.av += dir * step;
    } else {
      p.turnDecelLeft = 0;
      p.turnDecelStep = 0;
      p.turnDecelRev = 0;
      p.av += dir * step;
    }
    if (!stunned) {
      // Clamp every tick so precision can kick in mid-turn (not only at spin-up).
      if (p.av > avMax) p.av = avMax;
      if (p.av < -avMax) p.av = -avMax;
    } else {
      if (p.av > STUN_AV_MAX) p.av = STUN_AV_MAX;
      if (p.av < -STUN_AV_MAX) p.av = -STUN_AV_MAX;
    }
  } else if (p.av !== 0) {
    const frames = stunned ? STUN_DECEL_TICKS : TURN_DECEL_FRAMES;
    if (!(p.turnDecelLeft > 0) || p.turnDecelRev) {
      p.turnDecelStep = p.av / frames;
      p.turnDecelLeft = frames;
      p.turnDecelRev = 0;
    }
    p.av -= p.turnDecelStep;
    p.turnDecelLeft--;
    if (p.turnDecelLeft <= 0) {
      p.av = 0;
      p.turnDecelStep = 0;
      p.turnDecelLeft = 0;
      p.turnDecelRev = 0;
    }
  }
  p.angle += p.av;
  if (Math.abs(p.av) < 1e-5) {
    p.av = 0;
    p.turnDecelStep = 0;
    p.turnDecelLeft = 0;
    p.turnDecelRev = 0;
  }
  if (stunned && Math.abs(p.av) < STUN_END_AV) p.stunned = false;
}

function applyInput(p) {
  const { l, r, u, sh, sp } = p.inp;
  if (p.av == null) p.av = 0;
  if (p.collideCd > 0) p.collideCd--;
  // Shoot pulse ends godmode (tryStartBurst also clears; this covers the same tick).
  if (p.godLeft > 0 && sp) p.godLeft = 0;
  if (p.godLeft > 0) p.godLeft--;
  applyTurn(p, l, r, sh);
  if (p.stunned || u) {
    p.vx += Math.cos(p.angle) * THRUST;
    p.vy += Math.sin(p.angle) * THRUST;
  }
  limitPlayerSpeed(p);
}

/** True while still inside the spawn face-off circle. */
function playerInSpawnArea(room, p) {
  const spawn = playerSpawnPose(p.id, room);
  const dx = p.x - spawn.x;
  const dy = p.y - spawn.y;
  return dx * dx + dy * dy <= GODMODE_SPAWN_CLEAR_R * GODMODE_SPAWN_CLEAR_R;
}

/** End godmode (time expired or left spawn) and cancel any in-progress shot. */
function clearPlayerGodmode(p) {
  if (!(p.godLeft > 0)) return;
  p.godLeft = 0;
  p.bursting = false;
  p.railChargeLeft = 0;
}

/** After movement: leave spawn zone → godmode ends immediately. */
function clearGodmodeIfLeftSpawn(room, p) {
  if (!(p.godLeft > 0)) return;
  if (!playerInSpawnArea(room, p)) clearPlayerGodmode(p);
}

/** Two hit circles along ship facing: front (+offset) + back (−offset). Same volumes as bullets. */
function playerHitCircles(p) {
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  return [
    {
      x: p.x + c * PLAYER_HIT_OFFSET_FRONT,
      y: p.y + s * PLAYER_HIT_OFFSET_FRONT,
      r: PLAYER_HIT_R_FRONT
    },
    {
      x: p.x - c * PLAYER_HIT_OFFSET_BACK,
      y: p.y - s * PLAYER_HIT_OFFSET_BACK,
      r: PLAYER_HIT_R_BACK
    }
  ];
}

/** Closest point on segment (x0,y0)-(x1,y1) to (px,py). */
function closestOnSeg(px, py, x0, y0, x1, y1) {
  const ex = x1 - x0, ey = y1 - y0;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 1e-12 ? ((px - x0) * ex + (py - y0) * ey) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return { x: x0 + ex * t, y: y0 + ey * t };
}

function asteroidHitR(a) {
  // Outline unit radii are ≤ 1.0; collision verts use ASTEROID_HIT_SCALE.
  return (a.r || 0) * ASTEROID_HIT_SCALE;
}

/**
 * Cache cos/sin(a.angle) on the asteroid. Invalidates when angle changes.
 * world→local uses (c, -s); local→world uses (c, s).
 */
function asteroidCosSin(a) {
  if (a._tAng === a.angle) return a;
  a._tAng = a.angle;
  a._tc = Math.cos(a.angle);
  a._ts = Math.sin(a.angle);
  return a;
}

/**
 * Uniform-grid spatial hash for asteroid broadphase.
 * Stamp-based rebuild (no full cell clears). Insert collideable rocks that
 * overlap the playfield; query with circle → dedup via per-query id.
 */
const AST_HASH_CELL = 64;
const AST_HASH_PAD_CELLS = Math.ceil(ASTEROID_R.huge / AST_HASH_CELL) + 1;
const AST_HASH_COLS = Math.ceil(W / AST_HASH_CELL) + AST_HASH_PAD_CELLS * 2;
const AST_HASH_ROWS = Math.ceil(H / AST_HASH_CELL) + AST_HASH_PAD_CELLS * 2;
const AST_HASH_OX = -AST_HASH_PAD_CELLS * AST_HASH_CELL;
const AST_HASH_OY = -AST_HASH_PAD_CELLS * AST_HASH_CELL;
const AST_HASH_N = AST_HASH_COLS * AST_HASH_ROWS;
/** Conservative ship query radius (dual hit-circles from center). */
const PLAYER_AST_QUERY_R = Math.max(
  PLAYER_HIT_OFFSET_FRONT + PLAYER_HIT_R_FRONT,
  PLAYER_HIT_OFFSET_BACK + PLAYER_HIT_R_BACK
) + 2;

function createAsteroidSpatialHash() {
  const cells = new Array(AST_HASH_N);
  for (let i = 0; i < AST_HASH_N; i++) cells[i] = [];
  return {
    cells,
    cellStamp: new Uint32Array(AST_HASH_N),
    stamp: 1,
    queryId: 1
  };
}

function rebuildAsteroidSpatialHash(room) {
  let h = room.astHash;
  if (!h) {
    h = createAsteroidSpatialHash();
    room.astHash = h;
  }
  let stamp = h.stamp + 1;
  if (stamp >= 0xfffffff0) {
    h.cellStamp.fill(0);
    stamp = 1;
  }
  h.stamp = stamp;
  const { cells, cellStamp } = h;
  const list = room.asteroids;
  const inv = 1 / AST_HASH_CELL;
  const cols = AST_HASH_COLS;
  const rows = AST_HASH_ROWS;
  const ox = AST_HASH_OX;
  const oy = AST_HASH_OY;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a || a.noCollide || !asteroidOverlapsPlayfield(a)) continue;
    asteroidCosSin(a);
    const r = asteroidHitR(a);
    a._hq = 0;
    let x0 = ((a.x - r - ox) * inv) | 0;
    let y0 = ((a.y - r - oy) * inv) | 0;
    let x1 = ((a.x + r - ox) * inv) | 0;
    let y1 = ((a.y + r - oy) * inv) | 0;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 >= cols) x1 = cols - 1;
    if (y1 >= rows) y1 = rows - 1;
    if (x1 < x0 || y1 < y0) continue;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * cols;
      for (let cx = x0; cx <= x1; cx++) {
        const idx = row + cx;
        if (cellStamp[idx] !== stamp) {
          cellStamp[idx] = stamp;
          cells[idx].length = 0;
        }
        cells[idx].push(a);
      }
    }
  }
}

/** Bullet extent used to query the asteroid hash (must cover hitBulletTarget shape). */
function bulletBroadR(b) {
  const cfg = BULLET_TYPES[b.type] || BULLET_TYPES.default;
  if (cfg.col === 'line') {
    return Math.max(cfg.length || 0, cfg.width || 0) * 0.5 + 1;
  }
  let br = cfg.size || 2 * RES_SCALE;
  if (cfg.col === 'ellipse') br = Math.max(br, br * (cfg.scaleY || 1));
  return br;
}

/**
 * Visit each unique asteroid whose hash footprint overlaps circle (x,y,rad).
 * `fn(a)` — return true to stop early. Safe to nest (fresh query id).
 */
function forEachAsteroidNear(room, x, y, rad, fn) {
  const h = room.astHash;
  if (!h) return false;
  const stamp = h.stamp;
  let qid = h.queryId + 1;
  if (qid >= 0xfffffff0) qid = 1;
  h.queryId = qid;
  const { cells, cellStamp } = h;
  const inv = 1 / AST_HASH_CELL;
  const cols = AST_HASH_COLS;
  const rows = AST_HASH_ROWS;
  const ox = AST_HASH_OX;
  const oy = AST_HASH_OY;
  let x0 = ((x - rad - ox) * inv) | 0;
  let y0 = ((y - rad - oy) * inv) | 0;
  let x1 = ((x + rad - ox) * inv) | 0;
  let y1 = ((y + rad - oy) * inv) | 0;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 >= cols) x1 = cols - 1;
  if (y1 >= rows) y1 = rows - 1;
  if (x1 < x0 || y1 < y0) return false;
  for (let cy = y0; cy <= y1; cy++) {
    const row = cy * cols;
    for (let cx = x0; cx <= x1; cx++) {
      const idx = row + cx;
      if (cellStamp[idx] !== stamp) continue;
      const bucket = cells[idx];
      for (let i = 0, n = bucket.length; i < n; i++) {
        const a = bucket[i];
        if (a._hq === qid) continue;
        a._hq = qid;
        if ((a.hp | 0) <= 0) continue;
        if (fn(a) === true) return true;
      }
    }
  }
  return false;
}

/**
 * Circle vs asteroid collision polygon (jagged 2D outline × ASTEROID_HIT_SCALE).
 * Euclidean only — asteroids edge-teleport (not toroidal).
 * Local pts spun by a.angle.
 */
function circleVsAsteroidPoly(cir, a) {
  const ar = asteroidHitR(a);
  if (!hitCircleCircle(cir.x, cir.y, cir.r, a.x, a.y, ar, false)) return null;
  const pts = a.pts;
  const s = ASTEROID_HIT_SCALE;
  if (!pts || pts.length < 6) {
    let dx = cir.x - a.x, dy = cir.y - a.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
    const overlap = cir.r + ar - dist;
    if (overlap <= 0) return null;
    return { cir, nx: dx / dist, ny: dy / dist, overlap };
  }

  let dx = cir.x - a.x, dy = cir.y - a.y;
  asteroidCosSin(a);
  const ca = a._tc, sa = -a._ts; // cos(-angle), sin(-angle)
  const lx = dx * ca - dy * sa;
  const ly = dx * sa + dy * ca;

  const n = (pts.length / 2) | 0;
  let inside = false;
  let bestD2 = Infinity;
  let qx = 0, qy = 0;
  let enx = 1, eny = 0;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const x0 = pts[j * 2] * s, y0 = pts[j * 2 + 1] * s;
    const x1 = pts[i * 2] * s, y1 = pts[i * 2 + 1] * s;
    const ex = x1 - x0, ey = y1 - y0;
    if (((y0 > ly) !== (y1 > ly)) && (lx < (ex * (ly - y0)) / (ey || 1e-12) + x0)) {
      inside = !inside;
    }
    const c = closestOnSeg(lx, ly, x0, y0, x1, y1);
    const ddx = lx - c.x, ddy = ly - c.y;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      qx = c.x;
      qy = c.y;
      const el = Math.hypot(ex, ey) || 1;
      let nx = ey / el, ny = -ex / el;
      if (nx * (lx - (x0 + x1) * 0.5) + ny * (ly - (y0 + y1) * 0.5) < 0) {
        nx = -nx;
        ny = -ny;
      }
      enx = nx;
      eny = ny;
    }
  }

  let lnx, lny, overlap;
  if (inside) {
    // Center is inside the rock — eject toward the nearest boundary (NOT along
    // the inward edge normal, which previously trapped ships bouncing inside).
    const dist = Math.sqrt(bestD2);
    if (dist < 1e-6) {
      lnx = -enx;
      lny = -eny;
    } else {
      lnx = (qx - lx) / dist;
      lny = (qy - ly) / dist;
    }
    overlap = cir.r + dist;
  } else {
    const dist = Math.sqrt(bestD2);
    if (dist >= cir.r) return null;
    if (dist < 1e-6) {
      lnx = enx;
      lny = eny;
    } else {
      lnx = (lx - qx) / dist;
      lny = (ly - qy) / dist;
    }
    overlap = cir.r - dist;
  }

  const cw = a._tc, sw = a._ts;
  return {
    cir,
    nx: lnx * cw - lny * sw,
    ny: lnx * sw + lny * cw,
    overlap,
    inside
  };
}

/** Bullet vs asteroid: small rocks are circles; medium/big/huge stay jagged polys. */
function hitBulletAsteroid(b, a) {
  if (!hitBulletTarget(b, a.x, a.y, asteroidHitR(a), false)) return false;
  if (a.size === 'small') return true;
  const cfg = BULLET_TYPES[b.type] || BULLET_TYPES.default;
  let br = cfg.size || 2 * RES_SCALE;
  if (cfg.col === 'line') br = Math.max(cfg.width || 1, 1.5 * RES_SCALE);
  if (cfg.col === 'ellipse') br = Math.max(br, br * (cfg.scaleY || 1) * 0.55);
  return !!circleVsAsteroidPoly({ x: b.x, y: b.y, r: br }, a);
}

function pointInAsteroidLocal(lx, ly, pts, s) {
  const n = (pts.length / 2) | 0;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const x0 = pts[j * 2] * s, y0 = pts[j * 2 + 1] * s;
    const x1 = pts[i * 2] * s, y1 = pts[i * 2 + 1] * s;
    if (((y0 > ly) !== (y1 > ly)) && (lx < ((x1 - x0) * (ly - y0)) / ((y1 - y0) || 1e-12) + x0)) {
      inside = !inside;
    }
  }
  return inside;
}

/** Ray vs segment in 2D; returns t along ray or null. */
function raySegT(ox, oy, dx, dy, x0, y0, x1, y1) {
  const ex = x1 - x0, ey = y1 - y0;
  const det = dx * ey - dy * ex;
  if (Math.abs(det) < 1e-12) return null;
  const fx = x0 - ox, fy = y0 - oy;
  const t = (fx * ey - fy * ex) / det;
  const u = (fx * dy - fy * dx) / det;
  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}

/** Raycast against asteroid. Small = circle; others = jagged outline. */
function raycastAsteroid(ox, oy, dx, dy, a, maxDist) {
  const pts = a.pts;
  const s = ASTEROID_HIT_SCALE;
  if (a.size === 'small' || !pts || pts.length < 6) {
    const t = raycastCircle(ox, oy, dx, dy, a.x, a.y, asteroidHitR(a));
    if (t == null || t > maxDist) return null;
    return { t, x: ox + dx * t, y: oy + dy * t };
  }
  asteroidCosSin(a);
  const ca = a._tc, sa = -a._ts;
  const ox0 = ox - a.x, oy0 = oy - a.y;
  const lox = ox0 * ca - oy0 * sa;
  const loy = ox0 * sa + oy0 * ca;
  const ldx = dx * ca - dy * sa;
  const ldy = dx * sa + dy * ca;
  if (pointInAsteroidLocal(lox, loy, pts, s)) {
    return { t: 0, x: ox, y: oy };
  }
  let bestT = null;
  const n = (pts.length / 2) | 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const x0 = pts[j * 2] * s, y0 = pts[j * 2 + 1] * s;
    const x1 = pts[i * 2] * s, y1 = pts[i * 2 + 1] * s;
    const t = raySegT(lox, loy, ldx, ldy, x0, y0, x1, y1);
    if (t != null && t <= maxDist && (bestT == null || t < bestT)) bestT = t;
  }
  if (bestT == null) return null;
  return { t: bestT, x: ox + dx * bestT, y: oy + dy * bestT };
}

/** First ship hit-circle overlapping asteroid polygon, or null. */
function playerAsteroidHit(p, a) {
  for (const cir of playerHitCircles(p)) {
    const hit = circleVsAsteroidPoly(cir, a);
    if (hit) return hit;
  }
  return null;
}

function asteroidCollideDamage(p, a, scale) {
  const s = scale != null ? scale : 1;
  const impact = Math.hypot(p.vx - (a.vx || 0), p.vy - (a.vy || 0));
  const frac = Math.min(1, impact / MAX_SPEED);
  const minDmg = Math.max(1, Math.round(ASTEROID_COLLIDE_DMG_MIN * s));
  return Math.max(minDmg, Math.round(frac * MAX_HP * s));
}

/** Shared crash response (asteroid + ship): bounce, stun spin, HP, iframes.
 *  bounceScale: restitution (1 = full reflect, 0.5 = half bounce power). */
function applyShipCrash(room, p, nx, ny, overlap, dmg, bounceScale) {
  const e = bounceScale != null ? bounceScale : 1;
  const cross = nx * p.vy - ny * p.vx;
  const spinDir = cross >= 0 ? 1 : -1;
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    p.vx -= (1 + e) * vn * nx;
    p.vy -= (1 + e) * vn * ny;
  } else {
    p.vx += nx * (1.2 * RES_SCALE * e);
    p.vy += ny * (1.2 * RES_SCALE * e);
  }
  p.stunned = true;
  limitPlayerSpeed(p);
  if (overlap > 0) {
    p.x += nx * (overlap + 3);
    p.y += ny * (overlap + 3);
    wrap(p);
  }
  if (!consumeShield(room, p)) p.hp -= dmg;
  p.av = spinDir * STUN_SPIN;
  p.turnDecelStep = 0;
  p.turnDecelLeft = 0;
  p.turnDecelRev = 0;
  p.collideCd = COLLIDE_IFRAME_TICKS;
}

/** Position-only eject so a ship can't stay embedded during collide iframes. */
function separatePlayerFromAsteroids(p, room, maxIters) {
  const iters = maxIters == null ? 6 : maxIters;
  for (let n = 0; n < iters; n++) {
    let moved = false;
    forEachAsteroidNear(room, p.x, p.y, PLAYER_AST_QUERY_R, (a) => {
      if (isOffScreen(a)) return false;
      const hit = playerAsteroidHit(p, a);
      if (!hit) return false;
      const pad = hit.inside ? 4 : 2;
      p.x += hit.nx * (hit.overlap + pad);
      p.y += hit.ny * (hit.overlap + pad);
      wrap(p);
      const vn = p.vx * hit.nx + p.vy * hit.ny;
      if (vn < 0) {
        p.vx -= vn * hit.nx;
        p.vy -= vn * hit.ny;
      }
      moved = true;
      return false;
    });
    if (!moved) break;
  }
}

function notifyShipHit(room, p) {
  if (p.hp <= 0) {
    handlePlayerDeath(room, p);
    return;
  }
  for (const ws of room.clients) {
    if (ws.playerId === p.id && ws.readyState === 1) {
      send(ws, {
        t: 'astHit',
        you: [p.x, p.y, p.vx, p.vy, p.angle, p.av, p.hp, 1]
      });
      break;
    }
  }
}

/**
 * Death sequence: freeze frame + shake (1s) → explode → watch (4s) → respawn.
 */
function handlePlayerDeath(room, victim) {
  if (!room || !victim || room.roundResetting) return;

  const killerId = victim.lastHitBy | 0;
  victim.lastHitBy = 0;
  const killer = (!room.practice && killerId > 0 && killerId !== (victim.id | 0))
    ? room.players.get(killerId)
    : null;
  const creditedKillerId = (killer && !killer.bot) ? (killer.id | 0) : 0;

  // Perf-test rooms: instant respawn with a new random gun (no freeze / no match end).
  if (room.perfTest) {
    for (const p of room.players.values()) {
      if (p.id !== victim.id && !p.bot) p.score = (p.score | 0) + 1;
    }
    equipRandomPerfWeapon(victim);
    respawnPlayer(room, victim, true, PERF_BOT_HP);
    victim.godLeft = Math.round(0.35 * TPS);
    return;
  }

  room.roundResetting = true;
  // Keep corpse pose for the shake beat; mark dead for gameplay.
  victim.hp = 0;
  victim.vx = 0;
  victim.vy = 0;
  victim.bursting = false;
  victim.railChargeLeft = 0;
  victim.powerups = freshPowerups();
  notifyPowerups(room, victim);
  if (room.practice) {
    victim.lives = Math.max(0, (victim.lives | 0) - 1);
  }

  // PvP: any death scores for living humans (asteroid / self / frag — not frags-only).
  for (const p of room.players.values()) {
    if (!room.practice && p.id !== victim.id && !p.bot) p.score = (p.score | 0) + 1;
  }

  for (const p of room.players.values()) {
    p.vx = 0;
    p.vy = 0;
    p.bursting = false;
    p.railChargeLeft = 0;
    p.inp.sp = 0;
  }

  for (const b of room.bullets) {
    roomBroadcast(room, { t: 'bd', id: b.id });
  }
  room.bullets.length = 0;

  room.deathVictimId = victim.id;
  room.deathX = victim.x;
  room.deathY = victim.y;
  room.deathShakeLeft = DEATH_SHAKE_TICKS;
  room.deathBoomLeft = DEATH_BOOM_TICKS;
  if (room.pendingRailBounces) room.pendingRailBounces.length = 0;
  room.deathBoomed = false;

  roomBroadcast(room, {
    t: 'die',
    id: victim.id,
    by: creditedKillerId,
    names: packRosterNames(room),
    x: victim.x,
    y: victim.y,
    scores: packScoreboard(room),
    scoreToWin: SCORE_TO_WIN,
    lives: victim.lives | 0,
    shakeMs: Math.round(DEATH_SHAKE_TICKS * (1000 / TPS)),
    boomMs: Math.round(DEATH_BOOM_TICKS * (1000 / TPS))
  });
}

function resyncAllAsteroids(room) {
  for (const a of room.asteroids) resyncAsteroidSpawn(a);
}

function packScoreboard(room) {
  return [...room.players.values()]
    .filter(p => !p.bot)
    .map(p => [p.id, p.score | 0, playerCallsign(p)]);
}

function packRosterNames(room) {
  return [...room.players.values()]
    .filter(p => !p.bot)
    .map(p => [p.id, playerCallsign(p)]);
}

function findMatchWinner(room) {
  if (room.practice || room.perfTest) return null;
  let best = null;
  for (const p of room.players.values()) {
    if (p.bot) continue;
    if ((p.score | 0) >= SCORE_TO_WIN) {
      if (!best || p.score > best.score) best = p;
    }
  }
  return best;
}

/** Match over: notify clients, then tear down the room back to lobby. */
function endMatch(room, winner) {
  const scores = packScoreboard(room);
  const clients = [...room.clients];
  demoRecorder.finish(room, {
    winnerId: winner ? winner.id : 0,
    scores,
    reason: 'over',
    wave: 0
  });
  if (winner) {
    for (const ws of clients) {
      if (ws.playerId === winner.id) recordMatchWin(ws);
    }
  }

  let mmrByWs = new Map();
  if (winner && !room.practice && !room.coop) {
    let winnerWs = null;
    let loserWs = null;
    for (const ws of clients) {
      if (ws.playerId === winner.id) winnerWs = ws;
      else if (ws.playerId != null) loserWs = ws;
    }
    if (winnerWs && loserWs) mmrByWs = applyPvpMmrResults(winnerWs, loserWs);
  }

  for (const ws of clients) {
    const mmr = mmrByWs.get(ws) || null;
    send(ws, {
      t: 'over',
      winner: winner ? winner.id : 0,
      scores,
      names: packRosterNames(room),
      scoreToWin: SCORE_TO_WIN,
      mmr: mmr ? {
        before: mmr.before | 0,
        after: mmr.after | 0,
        delta: mmr.delta | 0,
        games: mmr.games | 0
      } : null
    });
  }
  for (const ws of clients) {
    leaveRoom(ws);
    if (ws.readyState === 1) ws.state = 'lobby';
  }
}

/** Solo / coop lives depleted. */
function endSoloPractice(room) {
  const wave = room.wave | 0;
  const clients = [...room.clients];
  const wasCoop = !!room.coop;
  const soloOnly = !!room.soloOnly;
  const queueKind = room.queueKind || null;
  const waveScores = {};
  for (const p of room.players.values()) {
    if (p.bot) continue;
    waveScores[p.id] = p.coinsCollected | 0;
  }
  demoRecorder.finish(room, {
    reason: 'soloOver',
    wave,
    scores: waveScores
  });
  for (const ws of clients) {
    if (ws.registered) recordBestWaves(ws, wave, wasCoop);
    if (ws.readyState === 1) {
      const pl = room.players.get(ws.playerId);
      send(ws, {
        t: 'soloOver',
        wave,
        lives: 0,
        coop: wasCoop ? 1 : 0,
        score: pl ? (pl.coinsCollected | 0) : 0
      });
    }
    leaveRoom(ws);
    if (ws.readyState !== 1) continue;
    if (soloOnly || !queueKind) {
      ws.state = 'lobby';
      ws.queueMode = null;
      // Client already got `soloOver` — don't also send `lobby` (that force-opens the
      // main menu and hides the game-over screen). Session sync is enough.
      sendSession(ws);
      continue;
    }
    // Still matchmaking — stay queued on the game-over screen. Do NOT auto-start
    // a new practice room (that would send `welcome` and hide soloOver).
    if (queueKind === 'coop') {
      if (!coopQueue.includes(ws)) coopQueue.push(ws);
      ws.state = 'queued';
      ws.queueMode = 'coop';
      send(ws, queueStatusFor('coop'));
      notifyQueueKind('coop');
      tryMatchmakeCoop();
    } else {
      if (!matchQueue.includes(ws)) matchQueue.push(ws);
      ws.state = 'queued';
      ws.queueMode = 'pvp';
      send(ws, queueStatusFor('pvp'));
      notifyQueueKind('pvp');
      tryMatchmake();
    }
  }
}

function finishDeathRound(room) {
  if (room.practice) {
    const victim = room.players.get(room.deathVictimId);
    room.deathShakeLeft = 0;
    room.deathBoomLeft = 0;
    room.deathBoomed = false;
    room.deathVictimId = null;
    room.roundResetting = false;

    if (room.coop) {
      const anyAlive = [...room.players.values()].some(p => !p.bot && (p.lives | 0) > 0);
      if (!anyAlive) {
        endSoloPractice(room);
        return;
      }
      if (victim && (victim.lives | 0) > 0) {
        respawnPlayer(room, victim, false, SOLO_MAX_HP);
        resyncAllAsteroids(room);
        emitRoundReset(room);
      }
      return;
    }

    if (!victim || (victim.lives | 0) <= 0) {
      endSoloPractice(room);
      return;
    }
    // Keep wave field / enemies; only respawn the pilot (1 HP).
    respawnPlayer(room, victim, false, SOLO_MAX_HP);
    resyncAllAsteroids(room);
    emitRoundReset(room);
    return;
  }

  const winner = findMatchWinner(room);
  if (winner) {
    room.deathShakeLeft = 0;
    room.deathBoomLeft = 0;
    room.deathBoomed = false;
    room.deathVictimId = null;
    room.roundResetting = false;
    endMatch(room, winner);
    return;
  }
  for (const p of room.players.values()) {
    // Round winner keeps gun + upgrades; the dead player resets to default.
    respawnPlayer(room, p, p.id !== room.deathVictimId);
  }
  resetCenterAsteroid(room);
  // Bake frozen poses into spawn clocks so clients don't extrapolate death-freeze time.
  resyncAllAsteroids(room);
  emitRoundReset(room);
  room.deathShakeLeft = 0;
  room.deathBoomLeft = 0;
  room.deathBoomed = false;
  room.deathVictimId = null;
  room.roundResetting = false;
}

function emitRoundReset(room) {
  // Clear in-flight shots so the new round starts clean.
  for (const b of room.bullets) {
    roomBroadcast(room, { t: 'bd', id: b.id });
  }
  room.bullets.length = 0;

  const scores = packScoreboard(room);
  const asteroids = room.asteroids.map(packAsteroid);
  const players = packSnap(room).players;
  const powerupsByPlayer = {};
  for (const pl of room.players.values()) {
    powerupsByPlayer[pl.id] = pl.powerups || freshPowerups();
  }
  for (const ws of room.clients) {
    if (ws.readyState !== 1) continue;
    const p = room.players.get(ws.playerId);
    if (!p) continue;
    const wpnSlot = WEAPON_SLOTS.indexOf(p.weapon) + 1;
    send(ws, {
      t: 'round',
      scores,
      you: [
        p.id, p.x, p.y, p.vx, p.vy, p.angle, p.hp, p.lastSeq,
        p.av || 0, 0, p.godLeft | 0
      ],
      w: wpnSlot,
      levels: p.weaponLevels,
      ammo: p.shootAmmo,
      powerups: p.powerups || freshPowerups(),
      powerupsByPlayer,
      asteroids,
      players,
      lives: p.lives | 0
    });
  }
}

/**
 * Edge-teleport: mirror across the exit edge, keep the same vx/vy/spin.
 * Left↔right keeps y; top↔bottom keeps x. No random speed/direction.
 * preferSide: 0 left, 1 right, 2 top, 3 bottom (optional).
 */
/** Global: seamless asteroid edge portals (sv_portal). Default off for throughput. */
let svPortal = 0;
/** Global: scale for ping-based fire lead (sv_dynamic_prediction). 0 = fixed step/angle. */
let svDynamicPrediction = 1;
/** Global demo recording: 0 off · 1 PvP · 2 PvP + coop/queue waves (sv_demo). Default 2. */
let svDemo = demoRecorder.getDemoMode();

function clampDynamicPredictionScale(n) {
  n = Number(n);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function broadcastSvDynamicPrediction() {
  const msg = { t: 'svDynamicPrediction', v: svDynamicPrediction };
  for (const c of wss.clients) {
    if (c.readyState === 1) send(c, msg);
  }
}

function teleportAsteroidToEdge(room, a, preferSide) {
  // PvP smalls are culled off-screen — never edge-teleport them back in.
  // Waves smalls may wrap once (same as medium/big).
  // Player meteor-gun shots always teleport (they are size small).
  if (a && a.size === 'small' && !room.practice && !a.playerShot) {
    if (a.portalOfAid != null) {
      const parent = findAsteroidByAid(room, a.portalOfAid);
      if (parent && parent.portalTwinAid === a.aid) parent.portalTwinAid = null;
      a.portalOfAid = null;
    }
    removePortalTwin(room, a);
    emitAsteroidDead(room, a.aid, true);
    removeAsteroid(room, a);
    return;
  }
  // Never promote a linked inbound twin via teleport — that orphans a duplicate.
  if (a.portalOfAid != null) {
    destroyPortalInbound(room, a);
    return;
  }
  removePortalTwin(room, a);
  a.noCollide = false;
  const margin = (a.r || 16) + 8;
  let side = preferSide;
  if (side == null) {
    // From travel direction: appear on the side you would wrap into.
    if (Math.abs(a.vx) >= Math.abs(a.vy)) side = a.vx < 0 ? 1 : 0;
    else side = a.vy < 0 ? 3 : 2;
  }
  side = (side | 0) & 3;
  if (side === 0) {
    // Place off left — keep y.
    a.x = -margin;
  } else if (side === 1) {
    a.x = W + margin;
  } else if (side === 2) {
    a.y = -margin;
  } else {
    a.y = H + margin;
  }
  a.entered = false;
  a.portalArmed = false;
  resyncAsteroidSpawn(a);
  // Full `af` (not just wrap) so clients that lost this rock can recreate it with pts.
  emitAsteroidFire(room, a);
}

/** Opposite edge from where the rock left the playfield. */
function oppositeEdgeFromExit(a) {
  const m = (a.r || 0) + 2;
  if (a.x < -m) return 1; // left → right
  if (a.x > W + m) return 0;
  if (a.y < -m) return 3;
  if (a.y > H + m) return 2;
  return null;
}

/**
 * Spawn-clear eject: random screen edge (never the same as last clear for this
 * rock) + velocity aimed at arena center ±150.
 */
function teleportAsteroidSpawnClear(room, a) {
  // PvP: smalls cull instead of bounce. Waves: eject all sizes.
  if (a && a.size === 'small' && !room.practice) {
    if (a.portalOfAid != null) {
      const parent = findAsteroidByAid(room, a.portalOfAid);
      if (parent && parent.portalTwinAid === a.aid) parent.portalTwinAid = null;
      a.portalOfAid = null;
    }
    removePortalTwin(room, a);
    emitAsteroidDead(room, a.aid, true);
    removeAsteroid(room, a);
    return;
  }
  if (a.portalOfAid != null) {
    destroyPortalInbound(room, a);
    return;
  }
  removePortalTwin(room, a);
  a.noCollide = false;

  const margin = (a.r || 16) + 8;
  let side = (Math.random() * 4) | 0;
  const last = a.lastSpawnClearSide;
  if (last != null && ((last | 0) & 3) === side) {
    side = (side + 1 + ((Math.random() * 3) | 0)) % 4;
  }
  a.lastSpawnClearSide = side;

  if (side === 0) {
    a.x = -margin;
    a.y = Math.random() * H;
  } else if (side === 1) {
    a.x = W + margin;
    a.y = Math.random() * H;
  } else if (side === 2) {
    a.x = Math.random() * W;
    a.y = -margin;
  } else {
    a.x = Math.random() * W;
    a.y = H + margin;
  }

  const tx = W * 0.5 + (Math.random() * 2 - 1) * 150;
  const ty = H * 0.5 + (Math.random() * 2 - 1) * 150;
  let dx = tx - a.x;
  let dy = ty - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist;
  dy /= dist;
  let spd = Math.hypot(a.vx, a.vy);
  const band = asteroidSpeedBand(a.special);
  if (!(spd >= band.min)) {
    spd = band.min + Math.random() * Math.max(0, band.max - band.min);
  }
  const fitted = fitAsteroidSpeed(dx * spd, dy * spd, a.special);
  a.vx = fitted.vx;
  a.vy = fitted.vy;

  a.entered = false;
  a.portalArmed = false;
  resyncAsteroidSpawn(a);
  emitAsteroidFire(room, a);
}

/** While godmode, shove any asteroid near that player's spawn point to a screen edge. */
function clearGodmodeSpawnZones(room) {
  for (const p of room.players.values()) {
    if (!(p.godLeft > 0)) continue;
    const spawn = playerSpawnPose(p.id, room);
    for (const a of room.asteroids) {
      if (a.portalOfAid) continue; // parent handoff owns these
      // PvP: smalls leave permanently — don't bounce. Waves: bounce all sizes.
      if (a.size === 'small' && !room.practice) continue;
      const dx = a.x - spawn.x;
      const dy = a.y - spawn.y;
      const lim = GODMODE_SPAWN_CLEAR_R + (a.r || 0);
      if (dx * dx + dy * dy >= lim * lim) continue;
      teleportAsteroidSpawnClear(room, a);
    }
  }
}

function hitPlayerAsteroid(room, p, a, hit) {
  hit = hit || playerAsteroidHit(p, a);
  if (!hit) return;
  if (p.godLeft > 0) return;
  // Practice filler bots are invuln; perf-test bots must take asteroid hits.
  if (p.bot && !(room && room.perfTest)) return;
  // Own lobbed rock never hits the shooter.
  if (a.playerShot && (a.ownerId | 0) === (p.id | 0)) return;
  if (a.playerShot && blocksFriendlyFire(room, a.ownerId)) return;
  let dmg;
  if (a.playerShot) {
    const spd = Math.hypot(a.vx || 0, a.vy || 0);
    const frac = Math.max(0, spd / Math.max(1e-6, MAX_SPEED));
    dmg = PLAYER_SHOT_HIT_BASE + PLAYER_SHOT_HIT_SPEED_BONUS * frac;
    notePlayerAttacker(p, a.ownerId);
  } else {
    dmg = asteroidCollideDamage(p, a, 0.5);
  }
  applyShipCrash(room, p, hit.nx, hit.ny, hit.overlap, dmg, 0.5);
  // Hard eject in case dual hit-circles / spin left us still overlapping.
  separatePlayerFromAsteroids(p, room, 8);
  notifyShipHit(room, p);
}

/** Dual hit-circles of A vs B. Normal pushes A away from B. */
function playerPlayerHit(a, b) {
  const ca = playerHitCircles(a);
  const cb = playerHitCircles(b);
  for (const A of ca) {
    for (const B of cb) {
      if (!hitCircleCircle(A.x, A.y, A.r, B.x, B.y, B.r, true)) continue;
      let dx = A.x - B.x, dy = A.y - B.y;
      ({ dx, dy } = wrapDelta(dx, dy));
      let dist = Math.hypot(dx, dy);
      if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
      const overlap = A.r + B.r - dist;
      if (overlap <= 0) continue;
      return { cir: A, nx: dx / dist, ny: dy / dist, overlap };
    }
  }
  return null;
}

function hitPlayers(room, a, b, hit) {
  hit = hit || playerPlayerHit(a, b);
  if (!hit) return;
  const dmg = asteroidCollideDamage(a, b);
  const half = hit.overlap * 0.5;
  applyShipCrash(room, a, hit.nx, hit.ny, half, dmg);
  applyShipCrash(room, b, -hit.nx, -hit.ny, half, dmg);
  notifyShipHit(room, a);
  notifyShipHit(room, b);
}

function resolvePlayerAsteroidCollisions(room) {
  for (const p of room.players.values()) {
    if (p.hp <= 0 || p.godLeft > 0) continue;
    // Iframes: keep separating so the ship can't rattle around inside a rock.
    if (p.collideCd > 0) {
      separatePlayerFromAsteroids(p, room, 4);
      continue;
    }
    forEachAsteroidNear(room, p.x, p.y, PLAYER_AST_QUERY_R, (a) => {
      if (a.playerShot && (a.ownerId | 0) === (p.id | 0)) return false;
      const hit = playerAsteroidHit(p, a);
      if (!hit) return false;
      hitPlayerAsteroid(room, p, a, hit);
      return true;
    });
  }
}

/** Circle vs circle for player-shot rock bouncing off field asteroids. */
function asteroidAsteroidHit(a, b) {
  const ra = asteroidHitR(a);
  const rb = asteroidHitR(b);
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  ({ dx, dy } = wrapDelta(dx, dy));
  const dist = Math.hypot(dx, dy);
  if (!(dist > 1e-6) || dist >= ra + rb) return null;
  return { nx: dx / dist, ny: dy / dist, overlap: ra + rb - dist };
}

/** Player-shot asteroids bounce off other rocks and deal flat bounce damage. */
function resolvePlayerShotAsteroidBounces(room) {
  const list = room.asteroids;
  for (let i = 0; i < list.length; i++) {
    const shot = list[i];
    if (!shot || !shot.playerShot) continue;
    if ((shot.bounceCd | 0) > 0) {
      shot.bounceCd--;
      continue;
    }
    if (shot.noCollide || !asteroidOverlapsPlayfield(shot)) continue;
    const qR = asteroidHitR(shot);
    forEachAsteroidNear(room, shot.x, shot.y, qR, (other) => {
      if (other === shot || other.playerShot) return false; // only bounce off world rocks
      const hit = asteroidAsteroidHit(shot, other);
      if (!hit) return false;
      // Reflect shot off the contact normal (other rock keeps its motion).
      const vn = shot.vx * hit.nx + shot.vy * hit.ny;
      if (vn < 0) {
        shot.vx -= 2 * vn * hit.nx;
        shot.vy -= 2 * vn * hit.ny;
      }
      shot.x += hit.nx * (hit.overlap + 2);
      shot.y += hit.ny * (hit.overlap + 2);
      shot.bounceCd = 4;
      resyncAsteroidSpawn(shot);
      emitAsteroidWrap(room, shot);
      {
        const ra = asteroidHitR(shot);
        const cx = shot.x - hit.nx * Math.max(0, ra - hit.overlap * 0.5);
        const cy = shot.y - hit.ny * Math.max(0, ra - hit.overlap * 0.5);
        roomBroadcast(room, {
          t: 'mc',
          id: shot.aid,
          x: cx,
          y: cy,
          nx: hit.nx,
          ny: hit.ny
        });
      }
      damageAsteroid(room, other, PLAYER_SHOT_BOUNCE_DMG, shot.ownerId | 0);
      return true;
    });
  }
}

/** Meteor Gun rocks vs enemies: 100 dmg, no stun / no push. */
function resolvePlayerShotEnemyHits(room) {
  if (!room.practice || !room.enemies || !room.enemies.length) return;
  const list = room.asteroids;
  for (let i = 0; i < list.length; i++) {
    const shot = list[i];
    if (!shot || !shot.playerShot) continue;
    if ((shot.enemyHitCd | 0) > 0) {
      shot.enemyHitCd--;
      continue;
    }
    if (shot.noCollide || !asteroidOverlapsPlayfield(shot)) continue;
    for (let ei = room.enemies.length - 1; ei >= 0; ei--) {
      const e = room.enemies[ei];
      if (!e || (e.hp | 0) <= 0 || !enemyIsSpawned(e)) continue;
      const hit = enemyUsesRectHit(e)
        ? circleHitsEnemyRect(shot.x, shot.y, shot.r || 10, e)
        : circleVsAsteroidPoly({ x: e.x, y: e.y, r: e.r || 10 }, shot);
      if (!hit) continue;
      // Damage only — leave velocities alone (no push / stun).
      shot.enemyHitCd = 6;
      damageEnemy(room, e, PLAYER_SHOT_ENEMY_DMG);
      break;
    }
  }
}

function resolvePlayerPlayerCollisions(room) {
  return; // ship↔ship collisions disabled for now
  const list = [...room.players.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.hp <= 0 || a.collideCd > 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.hp <= 0 || b.collideCd > 0) continue;
      const hit = playerPlayerHit(a, b);
      if (hit) hitPlayers(room, a, b, hit);
    }
  }
}

/** Fake opponents for queue practice — fly around, never shoot. */
function updateBotInput(p) {
  if (p.botTimer == null || p.botTimer <= 0) {
    p.botTimer = 20 + (Math.random() * 50 | 0);
    const turnRoll = Math.random();
    p.inp.l = turnRoll < 0.32 ? 1 : 0;
    p.inp.r = turnRoll > 0.68 ? 1 : 0;
    p.inp.u = Math.random() < 0.72 ? 1 : 0;
    p.inp.sh = Math.random() < 0.15 ? 1 : 0;
  } else {
    p.botTimer--;
  }
  p.inp.sp = 0;
}

function equipRandomPerfWeapon(p) {
  const name = WEAPON_SLOTS[Math.random() * WEAPON_SLOTS.length | 0];
  ownOnlyWeapon(p, name, 1);
  const w = effectiveWeapon(p, p.weapon);
  p.shootAmmo = w.ammo;
  p.shootCd = 0;
  p.reloadLeft = 0;
  p.bursting = false;
  p.railChargeLeft = 0;
}

/**
 * Perf-test AI: thrust, dodge nearby asteroids, aim/shoot ships + rocks.
 */
function updatePerfBotInput(room, p) {
  p.inp.l = 0;
  p.inp.r = 0;
  p.inp.u = 0;
  p.inp.sp = 0;
  p.inp.sh = 0;
  if ((p.hp | 0) <= 0) return;

  let avoidDx = 0;
  let avoidDy = 0;
  let avoidW = 0;
  let target = null;
  let targetD = Infinity;
  let targetIsShip = false;

  const inspectAsteroid = (a) => {
    if (!a || a.noCollide) return;
    if (a.playerShot && (a.ownerId | 0) === (p.id | 0)) return;
    const dx = shortestWrapDelta(p.x, a.x, W);
    const dy = shortestWrapDelta(p.y, a.y, H);
    const dist = Math.hypot(dx, dy);
    const clear = dist - (a.r || 0) - PLAYER_R;
    if (clear < 110) {
      const w = Math.max(0.15, 1 - clear / 110);
      // Flee opposite the rock.
      if (dist > 1e-3) {
        avoidDx -= (dx / dist) * w;
        avoidDy -= (dy / dist) * w;
        avoidW += w;
      }
    }
    if (clear < targetD && clear < 420) {
      targetD = clear;
      target = a;
      targetIsShip = false;
    }
  };
  if (room.astHash) {
    // Query near-field asteroids from the hash instead of full scans.
    forEachAsteroidNear(room, p.x, p.y, 430, (a) => {
      inspectAsteroid(a);
      return false;
    });
  } else {
    for (const a of room.asteroids) inspectAsteroid(a);
  }

  for (const o of room.players.values()) {
    if (o === p || (o.hp | 0) <= 0) continue;
    const dx = shortestWrapDelta(p.x, o.x, W);
    const dy = shortestWrapDelta(p.y, o.y, H);
    const dist = Math.hypot(dx, dy);
    // Prefer ships over rocks when reasonably close.
    const score = dist * 0.85;
    if (score < targetD && dist < 520) {
      targetD = score;
      target = o;
      targetIsShip = true;
    }
  }

  let wantAng = p.angle;
  if (avoidW > 0.55) {
    wantAng = Math.atan2(avoidDy, avoidDx);
    p.inp.u = 1;
  } else if (target) {
    const dx = shortestWrapDelta(p.x, target.x, W);
    const dy = shortestWrapDelta(p.y, target.y, H);
    wantAng = Math.atan2(dy, dx);
    p.inp.u = Math.random() < (targetIsShip ? 0.88 : 0.75) ? 1 : 0;
  } else {
    // Wander when nothing interesting is nearby.
    if (p.botTimer == null || p.botTimer <= 0) {
      p.botTimer = 18 + (Math.random() * 40 | 0);
      p.botWanderAng = (Math.random() * Math.PI * 2) - Math.PI;
    } else {
      p.botTimer--;
    }
    wantAng = p.botWanderAng != null ? p.botWanderAng : p.angle;
    p.inp.u = Math.random() < 0.7 ? 1 : 0;
  }

  const diff = angleDiff(wantAng, p.angle);
  if (diff > 0.12) p.inp.l = 1;
  else if (diff < -0.12) p.inp.r = 1;

  // Fire when roughly lined up (or occasionally spray).
  if (target && Math.abs(diff) < (targetIsShip ? 0.38 : 0.48)) p.inp.sp = 1;
  else if (Math.random() < 0.04) p.inp.sp = 1;
}

function tryStartBurst(p) {
  // Space while invuln: drop godmode and fire (same as leaving the spawn pad).
  if (p.godLeft > 0) p.godLeft = 0;
  if (p.bursting || p.reloadLeft > 0 || p.shootAmmo <= 0 || (p.shootCd | 0) > 0) {
    return;
  }
  if (p.weapon === 'railgun' && (p.railChargeLeft | 0) > 0) return;
  p.bursting = true;
  if (p.weapon === 'railgun') {
    const w = effectiveWeapon(p, 'railgun');
    p.railChargeLeft = w.charge | 0;
  }
}

/** Ship pose N ticks ahead: position via vx/vy, aim via av (separate leads).
 *  With sv_dynamic_prediction: lead = round((one-way/tick − cmdDelay) * scale) from RTT. */
function clampPredictLeadTicks(n) {
  n = n | 0;
  if (n < 0) n = 0;
  if (n > 16) n = 16;
  return n;
}

function pingBasedPredictLeadTicks(room, p) {
  const rtt = playerRttMs(room, p && p.id) || 0;
  // Scale the one-way delay, then subtract cmd delay (inputs already applied locally).
  // Old (oneWay - cmdDelay) * scale stayed 0 whenever oneWay < cmdDelay — scale did nothing.
  const oneWayTicks = (rtt * 0.5) / TICK_MS;
  const cmdDelay = playerCmdDelayTicks(room, p && p.id);
  const scale = svDynamicPrediction > 0 ? svDynamicPrediction : 1;
  return clampPredictLeadTicks(Math.round(oneWayTicks * scale - cmdDelay));
}

function playerCmdDelayTicks(room, playerId) {
  for (const ws of room.clients) {
    if (ws.playerId === playerId) {
      const d = ws.cmdDelayTicks | 0;
      return d < 0 ? 0 : (d > 8 ? 8 : d);
    }
  }
  return 1; // mirrors cl_cmddelay default
}

function playerPredictShootSteps(room, p) {
  if (svDynamicPrediction) return pingBasedPredictLeadTicks(room, p);
  let n = p && p.predictShootStep != null ? (p.predictShootStep | 0) : 1;
  return clampPredictLeadTicks(n);
}

function playerPredictShootAngleSteps(room, p) {
  if (svDynamicPrediction) return pingBasedPredictLeadTicks(room, p);
  let n = p && p.predictShootAngle != null ? (p.predictShootAngle | 0) : 1;
  return clampPredictLeadTicks(n);
}

function predictedFirePose(room, p, leadTicks, angleLeadTicks) {
  const lead = leadTicks == null ? playerPredictShootSteps(room, p) : leadTicks;
  const aLead = angleLeadTicks == null ? playerPredictShootAngleSteps(room, p) : angleLeadTicks;
  let x = p.x + p.vx * lead;
  let y = p.y + p.vy * lead;
  if (x < 0) x += W; else if (x > W) x -= W;
  if (y < 0) y += H; else if (y > H) y -= H;
  let angle = p.angle + (p.av || 0) * aLead;
  return { x, y, angle };
}

/** Closest forward hit distance of a ray vs a circle (null if miss). */
function raycastCircle(ox, oy, dx, dy, cx, cy, cr) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (dx * fx + dy * fy);
  const c = fx * fx + fy * fy - cr * cr;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) * 0.5;
  const t1 = (-b + s) * 0.5;
  let best = null;
  if (t0 >= 0) best = t0;
  if (t1 >= 0 && (best == null || t1 < best)) best = t1;
  return best;
}

/** Raycast against a circle, also checking torus images for wrapped targets. */
function raycastCircleToroidal(ox, oy, dx, dy, cx, cy, cr, maxDist) {
  let best = null;
  for (let oxw = -W; oxw <= W; oxw += W) {
    for (let oyw = -H; oyw <= H; oyw += H) {
      const t = raycastCircle(ox, oy, dx, dy, cx + oxw, cy + oyw, cr);
      if (t == null || t > maxDist) continue;
      if (best == null || t < best.t) {
        best = { t, x: ox + dx * t, y: oy + dy * t };
      }
    }
  }
  return best;
}

function raycastFirst(room, ownerId, ox, oy, dx, dy, maxDist) {
  let best = null;
  for (const p of room.players.values()) {
    if (p.id === ownerId || p.hp <= 0 || p.godLeft > 0) continue;
    if (blocksFriendlyFire(room, ownerId)) continue;
    const target = lagCompPose(room, ownerId, p);
    const [front, back] = playerHitCircles(target);
    const hitF = raycastCircleToroidal(ox, oy, dx, dy, front.x, front.y, PLAYER_HIT_R_FRONT, maxDist);
    if (hitF && (!best || hitF.t < best.t)) best = { ...hitF, kind: 'player', target: p };
    const hitB = raycastCircleToroidal(ox, oy, dx, dy, back.x, back.y, PLAYER_HIT_R_BACK, maxDist);
    if (hitB && (!best || hitB.t < best.t)) best = { ...hitB, kind: 'player', target: p };
  }
  for (const a of room.asteroids) {
    const hit = raycastAsteroid(ox, oy, dx, dy, a, maxDist);
    if (!hit) continue;
    if (!best || hit.t < best.t) {
      best = { t: hit.t, x: hit.x, y: hit.y, kind: 'asteroid', target: a };
    }
  }
  // Solo / coop enemies (commons, UFOs, carriers).
  for (const e of room.enemies || []) {
    if (!enemyIsSpawned(e) || e.hp <= 0) continue;
    let hit = null;
    if (enemyUsesRectHit(e)) {
      hit = raycastEnemyRectToroidal(ox, oy, dx, dy, e, maxDist);
    } else {
      const er = e.r || ENEMY_R.common || 10;
      hit = raycastCircleToroidal(ox, oy, dx, dy, e.x, e.y, er, maxDist);
    }
    if (!hit) continue;
    if (!best || hit.t < best.t) {
      best = { t: hit.t, x: hit.x, y: hit.y, kind: 'enemy', target: e };
    }
  }
  // Player rockets — hits deflect heading (do not destroy).
  for (const b of room.bullets || []) {
    if (!b || b.type !== 'rocket') continue;
    if ((b.owner | 0) === (ownerId | 0)) continue;
    if (blocksFriendlyFire(room, ownerId)) continue;
    const rr = rocketHitR(b);
    const hit = raycastCircleToroidal(ox, oy, dx, dy, b.x, b.y, rr, maxDist);
    if (!hit) continue;
    if (!best || hit.t < best.t) {
      best = { t: hit.t, x: hit.x, y: hit.y, kind: 'rocket', target: b };
    }
  }
  return best;
}

function rocketHitR(b) {
  const cfg = BULLET_TYPES.rocket || BULLET_TYPES.default;
  return Math.max(2, cfg.size || 7 * RES_SCALE);
}

/** Linear falloff: maxDmg at center, 0 at radius. */
function rocketBlastDamageAt(dist, radius, maxDmg) {
  if (!(radius > 0) || dist >= radius) return 0;
  return Math.max(0, Math.round(maxDmg * (1 - dist / radius)));
}

/**
 * Rocket explosion AoE. `preAids` = asteroid ids that existed before this frame's
 * direct hit / earlier blast kills — shards spawned mid-explosion are ignored.
 */
function applyRocketBlast(room, ownerId, x, y, preAids) {
  if (!room) return;
  const R = ROCKET_BLAST_RADIUS;
  let maxDmg = ROCKET_BLAST_DMG;
  const owner = ownerId > 0 ? room.players.get(ownerId) : null;
  if (owner && playerHasPowerup(owner, 'damage')) maxDmg *= DAMAGE_POWERUP_MULT;

  for (const p of room.players.values()) {
    if ((p.id | 0) === (ownerId | 0) || p.hp <= 0 || p.godLeft > 0) continue;
    if (blocksFriendlyFire(room, ownerId)) continue;
    let best = Infinity;
    for (const cir of playerHitCircles(p)) {
      const d = Math.sqrt(torusDistSq(x, y, cir.x, cir.y)) - cir.r;
      if (d < best) best = d;
    }
    const dist = Math.max(0, best);
    const dmg = rocketBlastDamageAt(dist, R, maxDmg);
    if (dmg > 0) dealDamageToPlayer(room, p, dmg, ownerId);
    if (room.roundResetting) return;
  }

  // Snapshot list so mid-loop splits don't feed new shards into this pass.
  const rocks = room.asteroids.slice();
  for (let i = 0; i < rocks.length; i++) {
    const a = rocks[i];
    if (!a || !preAids.has(a.aid)) continue;
    if (room.asteroids.indexOf(a) < 0) continue; // already destroyed this blast
    if (a.noCollide || !asteroidOverlapsPlayfield(a)) continue;
    const cd = Math.hypot(a.x - x, a.y - y);
    const dist = Math.max(0, cd - asteroidHitR(a));
    const dmg = rocketBlastDamageAt(dist, R, maxDmg);
    if (dmg > 0) damageAsteroid(room, a, dmg, ownerId | 0);
  }

  if (room.practice && room.enemies) {
    const enemies = room.enemies.slice();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!enemyIsSpawned(e) || e.hp <= 0) continue;
      const dist = distToEnemyHit(x, y, e);
      const dmg = rocketBlastDamageAt(dist, R, maxDmg);
      if (dmg > 0) damageEnemy(room, e, dmg);
    }
  }
}

/**
 * Remove rocket on impact: broadcast, then circle blast only (no separate direct hit dmg).
 * `preAids` = asteroid ids before this frame so split shards are not damaged this blast.
 */
function detonateRocket(room, b, hitKind, _applyDirectIgnored) {
  const x = b.x;
  const y = b.y;
  const preAids = new Set();
  for (const a of room.asteroids) preAids.add(a.aid);
  roomBroadcast(room, { t: 'bd', id: b.id, hit: hitKind, x, y });
  if (room.roundResetting) return;
  applyRocketBlast(room, b.owner | 0, x, y, preAids);
}

/**
 * Nudge rocket velocity 10° away from the shooter (rocket stays alive).
 * Resyncs spawn pose and broadcasts bu so clients follow the new heading.
 */
function deflectRocketAwayFrom(room, rocket, sx, sy) {
  if (!rocket || rocket.type !== 'rocket') return;
  const spd = Math.hypot(rocket.vx, rocket.vy);
  if (!(spd > 1e-6)) return;
  const ang = Math.atan2(rocket.vy, rocket.vx);
  const toShooter = Math.atan2(
    shortestWrapDelta(rocket.y, sy, H),
    shortestWrapDelta(rocket.x, sx, W)
  );
  let toward = toShooter - ang;
  while (toward > Math.PI) toward -= Math.PI * 2;
  while (toward < -Math.PI) toward += Math.PI * 2;
  // Turn opposite the way toward the shooter (+10° away).
  const defl = toward >= 0 ? -ROCKET_DEFLECT_RAD : ROCKET_DEFLECT_RAD;
  const nang = ang + defl;
  rocket.vx = Math.cos(nang) * spd;
  rocket.vy = Math.sin(nang) * spd;
  rocket.spawnX = rocket.x;
  rocket.spawnY = rocket.y;
  rocket.spawnSt = Date.now();
  roomBroadcast(room, { t: 'bu', b: packBullet(rocket) });
}

function deflectRocketFromShooter(room, rocket, shooterId) {
  const shooter = room.players.get(shooterId);
  if (shooter) deflectRocketAwayFrom(room, rocket, shooter.x, shooter.y);
  else deflectRocketAwayFrom(room, rocket, rocket.x, rocket.y);
}

/** Muzzle velocity; optional ship kickstart when weapon.relative is set. */
function bulletVelocity(p, ang, speed, relative) {
  let vx = Math.cos(ang) * speed;
  let vy = Math.sin(ang) * speed;
  if (relative) {
    vx += p.vx;
    vy += p.vy;
  }
  return { vx, vy };
}

/**
 * Deterministic pellet RNG from muzzle position (same on client).
 * One bf per shell; pellet aim/speed expand from this seed.
 */
function makeShotgunRng(x, y) {
  let s = (
    Math.imul(Math.floor(x * 1024) | 0, 374761393) +
    Math.imul(Math.floor(y * 1024) | 0, 668265263)
  ) >>> 0;
  if (!s) s = 1;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shotgunPelletMotion(aimAngle, spreadDeg, spdMin, spdMax, rnd) {
  const spreadRad = (spreadDeg || 0) * Math.PI / 180;
  const ang = aimAngle + (rnd() - 0.5) * spreadRad;
  const spd = spdMin + rnd() * (spdMax - spdMin);
  return { ang, spd };
}

function fireProjectile(room, p, typeName) {
  const w = effectiveWeapon(p);
  const pose = predictedFirePose(room, p);
  const x = pose.x + Math.cos(pose.angle) * MUZZLE;
  const y = pose.y + Math.sin(pose.angle) * MUZZLE;
  const vel = bulletVelocity(p, pose.angle, w.speed, !!w.relative);
  const b = {
    id: room.nextBulletId++,
    owner: p.id,
    type: typeName,
    dmg: effectiveBulletDmg(p, typeName),
    x, y, spawnX: x, spawnY: y,
    vx: vel.vx,
    vy: vel.vy,
    spawnSt: Date.now()
  };
  room.bullets.push(b);
  roomBroadcast(room, { t: 'bf', b: packBullet(b) });
}

/** One network message per shell; pellets derived from muzzle x/y seed. */
function fireShotgun(room, p) {
  const w = effectiveWeapon(p, 'shotgun');
  const count = Math.max(1, w.shotgun | 0);
  const [spdMin, spdMax] = w.shotgunSpeeds || [7.5 * RES_SCALE * 0.85, 10.5 * RES_SCALE * 0.85];
  const pose = predictedFirePose(room, p);
  const x = pose.x + Math.cos(pose.angle) * MUZZLE;
  const y = pose.y + Math.sin(pose.angle) * MUZZLE;
  const now = Date.now();
  const dmg = effectiveBulletDmg(p, 'shotgun');
  const baseId = room.nextBulletId;
  room.nextBulletId += count;
  const rnd = makeShotgunRng(x, y);
  for (let i = 0; i < count; i++) {
    const m = shotgunPelletMotion(pose.angle, w.spread || 0, spdMin, spdMax, rnd);
    const vel = bulletVelocity(p, m.ang, m.spd, !!w.relative);
    room.bullets.push({
      id: baseId + i,
      owner: p.id,
      type: 'shotgun',
      dmg,
      x, y, spawnX: x, spawnY: y,
      vx: vel.vx,
      vy: vel.vy,
      spawnSt: now
    });
  }
  // row: [baseId, x, y, aimAngle, 0, owner, spawnSt, 'shotgun', pelletCount]
  roomBroadcast(room, {
    t: 'bf',
    b: [baseId, x, y, pose.angle, 0, p.id, now, 'shotgun', count]
  });
}

function fireLaser(room, p, weaponName) {
  const name = weaponName || 'laser';
  const w = effectiveWeapon(p, name);
  const dmg = effectiveBulletDmg(p, name);
  const pose = predictedFirePose(room, p);
  const ox = pose.x + Math.cos(pose.angle) * MUZZLE;
  const oy = pose.y + Math.sin(pose.angle) * MUZZLE;
  const dx = Math.cos(pose.angle);
  const dy = Math.sin(pose.angle);
  const remaining = w.range || Math.hypot(W, H);
  const width = 2 + (Math.random() * 4 | 0);
  const now = Date.now();
  const hit = raycastFirst(room, p.id, ox, oy, dx, dy, remaining);
  if (!hit) {
    roomBroadcast(room, {
      t: 'lf',
      l: [room.nextBulletId++, ox, oy, ox + dx * remaining, oy + dy * remaining, width, now, p.id],
      hit: 0,
      w: name
    });
    return;
  }
  const hitKind = hit.kind === 'player' || hit.kind === 'rocket' ? 1 : hit.kind === 'enemy' ? 3 : 2;
  roomBroadcast(room, {
    t: 'lf',
    l: [room.nextBulletId++, ox, oy, hit.x, hit.y, width, now, p.id],
    hit: hitKind,
    w: name
  });
  if (hit.kind === 'player') {
    dealDamageToPlayer(room, hit.target, dmg, p.id);
    tryEmpStun(room, p, hit.target, name, null);
  } else if (hit.kind === 'asteroid') {
    damageAsteroid(room, hit.target, dmg, p.id);
  } else if (hit.kind === 'enemy') {
    damageEnemy(room, hit.target, dmg);
  } else if (hit.kind === 'rocket') {
    deflectRocketFromShooter(room, hit.target, p.id);
  }
}

/** Rear thruster hit — same range/dmg/width as old melee; drawn for now. */
function fireThrustRay(room, p) {
  if (!p || p.hp <= 0 || (p.godLeft | 0) > 0) return;
  if (!playerThrustRayAligned(p)) return;
  const dmg = effectiveBulletDmg(p, 'thrust');
  const ang = p.angle + Math.PI;
  const ox = p.x + Math.cos(ang) * THRUST_RAY_MUZZLE;
  const oy = p.y + Math.sin(ang) * THRUST_RAY_MUZZLE;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const remaining = THRUST_RAY_RANGE;
  const width = 3 + (Math.random() * 3 | 0);
  const now = Date.now();
  const hit = raycastFirst(room, p.id, ox, oy, dx, dy, remaining);
  if (!hit) {
    roomBroadcast(room, {
      t: 'lf',
      l: [room.nextBulletId++, ox, oy, ox + dx * remaining, oy + dy * remaining, width, now, p.id],
      hit: 0,
      w: 'thrust'
    });
    return;
  }
  const hitKind = hit.kind === 'player' || hit.kind === 'rocket' ? 1 : hit.kind === 'enemy' ? 3 : 2;
  roomBroadcast(room, {
    t: 'lf',
    l: [room.nextBulletId++, ox, oy, hit.x, hit.y, width, now, p.id],
    hit: hitKind,
    w: 'thrust'
  });
  if (hit.kind === 'player') {
    dealDamageToPlayer(room, hit.target, dmg, p.id);
    tryEmpStun(room, p, hit.target, 'thrust', null);
  } else if (hit.kind === 'asteroid') {
    damageAsteroid(room, hit.target, dmg, p.id);
  } else if (hit.kind === 'enemy') {
    damageEnemy(room, hit.target, dmg);
  } else if (hit.kind === 'rocket') {
    deflectRocketFromShooter(room, hit.target, p.id);
  }
}

/**
 * Thruster ray only when nose points opposite last-tick travel
 * (facing ≈ travel + 180° — engine points along the path you're flying).
 */
function playerThrustRayAligned(p) {
  if (p.prevX == null || p.prevY == null) return false;
  const mdx = shortestWrapDelta(p.prevX, p.x, W);
  const mdy = shortestWrapDelta(p.prevY, p.y, H);
  if (Math.hypot(mdx, mdy) < THRUST_RAY_MIN_MOVE) return false;
  const travelBack = Math.atan2(mdy, mdx) + Math.PI;
  let diff = p.angle - travelBack;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= THRUST_RAY_ALIGN_RAD;
}

/** First world AABB edge hit for a ray. Normal points into the playfield. */
function raycastWorldEdge(ox, oy, dx, dy, maxDist) {
  let best = null;
  const tryEdge = (t, nx, ny) => {
    if (!(t > 1e-6) || t > maxDist) return;
    const x = ox + dx * t;
    const y = oy + dy * t;
    if (x < -0.75 || x > W + 0.75 || y < -0.75 || y > H + 0.75) return;
    if (!best || t < best.t) best = { t, x, y, nx, ny };
  };
  if (dx < -1e-9) tryEdge((0 - ox) / dx, 1, 0);
  if (dx > 1e-9) tryEdge((W - ox) / dx, -1, 0);
  if (dy < -1e-9) tryEdge((0 - oy) / dy, 0, 1);
  if (dy > 1e-9) tryEdge((H - oy) / dy, 0, -1);
  return best;
}

function reflectRailDir(dx, dy, nx, ny) {
  const dot = dx * nx + dy * ny;
  return { dx: dx - 2 * dot * nx, dy: dy - 2 * dot * ny };
}

/**
 * One rail pierce segment: gather hits, broadcast `rf`, apply damage.
 * `opts.toroidal` — wrap images (L1). Bounce segments use Euclidean only.
 */
function applyRailgunSegment(room, p, ox, oy, dx, dy, range, opts) {
  opts = opts || {};
  const dmg = effectiveBulletDmg(p, 'railgun');
  const width = 4 * RES_SCALE;
  const now = Date.now();
  const toroidal = opts.toroidal !== false;
  const maxDist = Math.max(0, range);

  const asteroidHits = [];
  for (const a of room.asteroids) {
    const hit = raycastAsteroid(ox, oy, dx, dy, a, maxDist);
    if (!hit) continue;
    asteroidHits.push({ t: hit.t, x: hit.x, y: hit.y, kind: 'asteroid', target: a });
  }

  const softHits = [];
  for (const other of room.players.values()) {
    if (other.id === p.id || other.hp <= 0 || other.godLeft > 0) continue;
    if (blocksFriendlyFire(room, p.id)) continue;
    const target = lagCompPose(room, p.id, other);
    const [front, back] = playerHitCircles(target);
    let best = null;
    if (toroidal) {
      const hitF = raycastCircleToroidal(ox, oy, dx, dy, front.x, front.y, PLAYER_HIT_R_FRONT, maxDist);
      const hitB = raycastCircleToroidal(ox, oy, dx, dy, back.x, back.y, PLAYER_HIT_R_BACK, maxDist);
      if (hitF) best = hitF;
      if (hitB && (!best || hitB.t < best.t)) best = hitB;
    } else {
      const tF = raycastCircle(ox, oy, dx, dy, front.x, front.y, PLAYER_HIT_R_FRONT);
      const tB = raycastCircle(ox, oy, dx, dy, back.x, back.y, PLAYER_HIT_R_BACK);
      if (tF != null && tF <= maxDist) best = { t: tF, x: ox + dx * tF, y: oy + dy * tF };
      if (tB != null && tB <= maxDist && (!best || tB < best.t)) {
        best = { t: tB, x: ox + dx * tB, y: oy + dy * tB };
      }
    }
    if (best) softHits.push({ t: best.t, x: best.x, y: best.y, kind: 'player', target: other });
  }
  for (const e of room.enemies || []) {
    if (!enemyIsSpawned(e) || e.hp <= 0) continue;
    let hit = null;
    if (enemyUsesRectHit(e)) {
      if (toroidal) {
        hit = raycastEnemyRectToroidal(ox, oy, dx, dy, e, maxDist);
      } else {
        const t = raycastOrientedRect(
          ox, oy, dx, dy,
          e.x, e.y, e.angle || 0,
          ENEMY_UFO_HIT_LEN * 0.5, ENEMY_UFO_HIT_WID * 0.5,
          maxDist
        );
        if (t != null) hit = { t, x: ox + dx * t, y: oy + dy * t };
      }
    } else {
      const er = e.r || ENEMY_R.common || 10;
      if (toroidal) {
        hit = raycastCircleToroidal(ox, oy, dx, dy, e.x, e.y, er, maxDist);
      } else {
        const t = raycastCircle(ox, oy, dx, dy, e.x, e.y, er);
        if (t != null && t <= maxDist) hit = { t, x: ox + dx * t, y: oy + dy * t };
      }
    }
    if (hit) softHits.push({ t: hit.t, x: hit.x, y: hit.y, kind: 'enemy', target: e });
  }
  const rocketHits = [];
  for (const b of room.bullets || []) {
    if (!b || b.type !== 'rocket') continue;
    if ((b.owner | 0) === (p.id | 0)) continue;
    if (blocksFriendlyFire(room, p.id)) continue;
    const rr = rocketHitR(b);
    let hit = null;
    if (toroidal) {
      hit = raycastCircleToroidal(ox, oy, dx, dy, b.x, b.y, rr, maxDist);
    } else {
      const t = raycastCircle(ox, oy, dx, dy, b.x, b.y, rr);
      if (t != null && t <= maxDist) hit = { t, x: ox + dx * t, y: oy + dy * t };
    }
    if (hit) rocketHits.push({ t: hit.t, x: hit.x, y: hit.y, kind: 'rocket', target: b });
  }

  const x1 = ox + dx * maxDist;
  const y1 = oy + dy * maxDist;
  let hitKind = 0;
  if (softHits.some((h) => h.kind === 'player')) hitKind = 1;
  else if (softHits.some((h) => h.kind === 'enemy')) hitKind = 3;
  else if (asteroidHits.length) hitKind = 2;
  else if (rocketHits.length) hitKind = 1;

  let impact = null;
  for (const h of asteroidHits) {
    if (!impact || h.t < impact.t) impact = h;
  }
  for (const h of softHits) {
    if (!impact || h.t < impact.t) impact = h;
  }
  for (const h of rocketHits) {
    if (!impact || h.t < impact.t) impact = h;
  }

  const msg = {
    t: 'rf',
    l: [room.nextBulletId++, ox, oy, x1, y1, width, now, p.id],
    hit: hitKind
  };
  if (opts.bounce) msg.bounce = 1;
  if (impact) {
    msg.ix = impact.x;
    msg.iy = impact.y;
  }
  roomBroadcast(room, msg);

  for (let i = 0; i < asteroidHits.length; i++) {
    const a = asteroidHits[i].target;
    if (room.asteroids.indexOf(a) < 0) continue;
    damageAsteroid(room, a, dmg, p.id);
  }

  for (let i = 0; i < softHits.length; i++) {
    const h = softHits[i];
    const throughRock = asteroidHits.some((ah) => ah.t < h.t - 1e-6);
    const pdmg = throughRock
      ? Math.max(1, Math.round(dmg * RAIL_THROUGH_ASTEROID_MULT))
      : dmg;
    if (h.kind === 'player') {
      dealDamageToPlayer(room, h.target, pdmg, p.id);
      tryEmpStun(room, p, h.target, 'railgun', null);
    } else if (h.kind === 'enemy') {
      damageEnemy(room, h.target, pdmg);
    }
  }

  for (let i = 0; i < rocketHits.length; i++) {
    deflectRocketFromShooter(room, rocketHits[i].target, p.id);
  }
}

/** Charged rail shot — pierces all asteroids on the line; soft targets
 *  behind at least one asteroid take RAIL_THROUGH_ASTEROID_MULT damage.
 *  L2+: first segment to world edge, then one bounce hitscan 2 ticks later. */
function fireRailgun(room, p) {
  const w = effectiveWeapon(p, 'railgun');
  const pose = predictedFirePose(room, p);
  const ox = pose.x + Math.cos(pose.angle) * MUZZLE;
  const oy = pose.y + Math.sin(pose.angle) * MUZZLE;
  const dx = Math.cos(pose.angle);
  const dy = Math.sin(pose.angle);
  const fullRange = w.range || Math.hypot(W, H);
  const bounce = getWeaponLevel(p, 'railgun') >= 2;

  if (!bounce) {
    applyRailgunSegment(room, p, ox, oy, dx, dy, fullRange, { toroidal: true });
    return;
  }

  const edge = raycastWorldEdge(ox, oy, dx, dy, fullRange + 2);
  const segLen = edge ? edge.t : fullRange;
  applyRailgunSegment(room, p, ox, oy, dx, dy, segLen, { toroidal: false });

  if (!edge) return;
  const reflected = reflectRailDir(dx, dy, edge.nx, edge.ny);
  const eps = 0.75;
  const bx = edge.x + edge.nx * eps;
  const by = edge.y + edge.ny * eps;
  const next = raycastWorldEdge(bx, by, reflected.dx, reflected.dy, fullRange + 2);
  const bounceRange = next ? next.t : fullRange;
  if (!room.pendingRailBounces) room.pendingRailBounces = [];
  room.pendingRailBounces.push({
    tick: (room.tick | 0) + 2,
    ownerId: p.id | 0,
    ox: bx,
    oy: by,
    dx: reflected.dx,
    dy: reflected.dy,
    range: bounceRange
  });
}

function processPendingRailBounces(room) {
  const q = room.pendingRailBounces;
  if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) {
    const job = q[i];
    if ((room.tick | 0) < (job.tick | 0)) continue;
    q.splice(i, 1);
    const p = room.players.get(job.ownerId);
    if (!p || (p.hp | 0) <= 0) continue;
    applyRailgunSegment(room, p, job.ox, job.oy, job.dx, job.dy, job.range, {
      toroidal: false,
      bounce: true
    });
  }
}

function consumeShot(room, p) {
  const w = effectiveWeapon(p);
  p.shootAmmo--;
  p.shootCd = w.cooldown;
  if (p.shootAmmo <= 0) {
    p.bursting = false;
    p.railChargeLeft = 0;
    // Magazine empty → reload (infinite reserves).
    if (p.weapon === 'railgun') {
      // Chamber next round immediately; shootCd is the wait between shots.
      p.shootAmmo = w.ammo;
      p.reloadLeft = 0;
    } else {
      p.reloadLeft = effectiveReloadTicks(p, w.reload);
    }
  }
}

function fireAsteroidGun(room, p) {
  const pose = predictedFirePose(room, p);
  const ang = pose.angle;
  const dx = p.prevX != null ? shortestWrapDelta(p.prevX, p.x, W) : (p.vx || 0);
  const dy = p.prevY != null ? shortestWrapDelta(p.prevY, p.y, H) : (p.vy || 0);
  let spd = Math.hypot(dx, dy) * 1.25;
  const minSpd = WEAPONS.rocket.speed * 0.75;
  if (spd < minSpd) spd = minSpd;
  const x = pose.x + Math.cos(ang) * (MUZZLE + 6);
  const y = pose.y + Math.sin(ang) * (MUZZLE + 6);
  const a = makeAsteroid({
    size: 'small',
    allowSpecial: false,
    special: 'meteor',
    hp: PLAYER_SHOT_ASTEROID_HP,
    x, y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    r: ASTEROID_R.small * 0.85,
    edgeWrapMax: 1,
    playerShot: true,
    ownerId: p.id
  });
  // Keep shot speed (makeAsteroid would clamp meteors into the world band).
  a.vx = Math.cos(ang) * spd;
  a.vy = Math.sin(ang) * spd;
  a.maxHp = PLAYER_SHOT_ASTEROID_HP;
  a.portalArmed = false;
  a.noCollide = false;
  pushAsteroid(room, a);
  emitAsteroidFire(room, a);
}

function fireOneShot(room, p) {
  if (p.weapon === 'laser') fireLaser(room, p, 'laser');
  else if (p.weapon === 'rocket') fireProjectile(room, p, 'rocket');
  else if (p.weapon === 'shotgun') fireShotgun(room, p);
  else if (p.weapon === 'railgun') fireRailgun(room, p);
  else if (p.weapon === 'plasma') fireProjectile(room, p, 'plasma');
  else if (p.weapon === 'voidcannon') fireProjectile(room, p, 'voidcannon');
  else if (p.weapon === 'asteroidgun') fireAsteroidGun(room, p);
  else fireProjectile(room, p, 'default');
  consumeShot(room, p);
}

function updateShooting(room, p) {
  const w = effectiveWeapon(p);
  // Always tick cooldown so railgun/etc. can become ready while idle.
  if (p.shootCd > 0) p.shootCd--;

  if (p.godLeft > 0) {
    // Burst started this tick (or kept after shoot-clear) → stay armed.
    if (p.bursting || (p.railChargeLeft | 0) > 0) {
      p.godLeft = 0;
    } else {
      if (p.reloadLeft > 0) {
        p.reloadLeft--;
        if (p.reloadLeft === 0) p.shootAmmo = w.ammo;
      }
      return;
    }
  }

  if (p.reloadLeft > 0) {
    p.reloadLeft--;
    if (p.reloadLeft === 0) p.shootAmmo = w.ammo;
    return;
  }
  if (!p.bursting) return;

  // Railgun: charge telegraph, then one raycast shot.
  if (p.weapon === 'railgun') {
    if ((p.railChargeLeft | 0) <= 0) {
      p.bursting = false;
      return;
    }
    const chargeMax = w.charge | 0;
    if (p.railChargeLeft === chargeMax) {
      roomBroadcast(room, {
        t: 'rc',
        id: p.id,
        ms: Math.round(chargeMax * (1000 / TPS)),
        st: Date.now(),
        bounce: getWeaponLevel(p, 'railgun') >= 2 ? 1 : 0
      });
    }
    p.railChargeLeft--;
    if (p.railChargeLeft > 0) return;
    fireRailgun(room, p);
    consumeShot(room, p);
    p.bursting = false;
    return;
  }

  if (p.shootCd > 0) return;
  fireOneShot(room, p);
}

function hitBulletTarget(b, tx, ty, tr, torus) {
  const cfg = BULLET_TYPES[b.type] || BULLET_TYPES.default;
  const angle = Math.atan2(b.vy, b.vx);
  if (cfg.col === 'ellipse') {
    return hitEllipseCircle(b.x, b.y, cfg.size, cfg.size * cfg.scaleY, angle, tx, ty, tr, torus);
  }
  if (cfg.col === 'line') {
    return hitLineCircle(b.x, b.y, cfg.length, cfg.width, angle, tx, ty, tr, torus);
  }
  return hitCircleCircle(b.x, b.y, cfg.size, tx, ty, tr, torus);
}

function hitBulletPlayer(b, p) {
  const circles = playerHitCircles(p);
  for (const cir of circles) {
    if (hitBulletTarget(b, cir.x, cir.y, cir.r, true)) return true;
  }
  return false;
}

function playerRttMs(room, playerId) {
  for (const ws of room.clients) {
    if (ws.playerId === playerId) return ws.rttMs || 0;
  }
  return 0;
}

/** Admin console `status` — room dump for wave soft-lock debugging. */
function packAdminStatus(ws) {
  const listenHost = HOST === '0.0.0.0' ? '0.0.0.0' : HOST;
  let localIp = listenHost;
  try {
    const sock = ws && ws._socket;
    if (sock) {
      if (sock.localAddress) localIp = sock.localAddress;
      else if (typeof sock.address === 'function') {
        const a = sock.address();
        if (a && a.address) localIp = a.address;
      }
    }
  } catch (_) {}

  const out = {
    t: 'adminStatus',
    ok: 1,
    ip: localIp,
    listen: listenHost + ':' + PORT,
    rooms: rooms.size,
    queue: { pvp: matchQueue.length, coop: coopQueue.length },
    inRoom: 0
  };

  const room = ws.room;
  if (!room) {
    out.err = 'not in a room';
    return out;
  }
  out.inRoom = 1;
  out.room = {
    id: room.id,
    practice: !!room.practice,
    coop: !!room.coop,
    soloOnly: !!room.soloOnly,
    matchLive: !!room.matchLive,
    paused: !!room.paused,
    tick: room.tick | 0,
    wave: room.wave | 0,
    shopOpen: !!room.shopOpen,
    shopWave: room.shopWave | 0,
    waveClearLeft: room.waveClearLeft | 0,
    pendingBigSpawns: (room.pendingBigSpawns && room.pendingBigSpawns.length) || 0,
    deathShakeLeft: room.deathShakeLeft | 0,
    deathBoomLeft: room.deathBoomLeft | 0,
    deathBoomed: !!room.deathBoomed,
    bullets: (room.bullets && room.bullets.length) || 0,
    pickups: (room.pickups && room.pickups.length) || 0
  };

  out.players = [];
  for (const p of room.players.values()) {
    if (p.bot) continue;
    const connected = [...room.clients].some(c => c.playerId === p.id && c.readyState === 1);
    out.players.push({
      id: p.id,
      name: playerCallsign(p),
      ping: Math.round(playerRttMs(room, p.id) || 0),
      hp: p.hp | 0,
      lives: p.lives | 0,
      score: room.practice ? (p.coinsCollected | 0) : (p.score | 0),
      coins: p.coins | 0,
      weapon: p.weapon || 'default',
      connected: connected ? 1 : 0,
      god: p.godLeft | 0
    });
  }

  const ast = room.asteroids || [];
  let blockingAst = 0;
  let portalGhosts = 0;
  let offscreenEntered = 0;
  let inbound = 0;
  let offscreen = 0;
  const bySize = { big: 0, medium: 0, small: 0 };
  const blockers = [];
  for (const a of ast) {
    const size = a.size || (a.big ? 'big' : 'medium');
    if (bySize[size] != null) bySize[size]++;
    else bySize[size] = 1;
    // Gun rocks never block wave clear — skip threat accounting.
    if (a.playerShot) continue;
    const off = isOffScreen(a);
    if (off) offscreen++;
    const ghost = a.portalOfAid != null && off;
    if (ghost) {
      portalGhosts++;
      continue;
    }
    if (a.entered && off) {
      offscreenEntered++;
      continue; // ignored by soloWaveHasFieldThreats
    }
    if (!a.entered && off) inbound++;
    blockingAst++;
    if (blockers.length < 12) {
      blockers.push({
        aid: a.aid,
        size,
        off: off ? 1 : 0,
        entered: a.entered ? 1 : 0,
        portalTwin: a.portalOfAid != null ? 1 : 0,
        wraps: a.edgeWraps | 0,
        wrapMax: asteroidEdgeWrapMax(a),
        x: Math.round(a.x),
        y: Math.round(a.y)
      });
    }
  }
  out.asteroids = {
    total: ast.length,
    blocking: blockingAst,
    portalGhosts,
    offscreenEntered,
    inbound,
    offscreen,
    bySize,
    blockers
  };

  const enemies = room.enemies || [];
  let spawned = 0;
  let queued = 0;
  let appearing = 0;
  const enemyRows = [];
  for (const e of enemies) {
    const isSpawned = enemyIsSpawned(e);
    if (e.queued) queued++;
    else if (!isSpawned) appearing++;
    else spawned++;
    if (enemyRows.length < 16) {
      enemyRows.push({
        id: e.id,
        kind: e.kind,
        hp: e.hp | 0,
        spawned: isSpawned ? 1 : 0,
        queued: e.queued ? 1 : 0,
        appearLeft: e.appearLeft | 0,
        weapon: e.weapon || ''
      });
    }
  }
  out.enemies = {
    total: enemies.length,
    spawned,
    queued,
    appearing,
    list: enemyRows
  };

  // Why the wave is / isn't advancing (practice / wave rooms).
  const reasons = [];
  if (!room.practice) {
    reasons.push('not wave mode (PvP)');
  } else if (room.shopOpen) {
    const done = room.shopDoneIds ? room.shopDoneIds.size : 0;
    const need = livingShopHumans(room).length;
    reasons.push(`shop open (next wave ${room.shopWave | 0}, continued ${done}/${need})`);
  } else if ((room.deathShakeLeft | 0) > 0 || (room.deathBoomLeft | 0) > 0 || room.deathBoomed) {
    reasons.push(`death sequence (shake ${room.deathShakeLeft | 0}, boom ${room.deathBoomLeft | 0}, boomed ${room.deathBoomed ? 1 : 0})`);
  } else if ((room.waveClearLeft | 0) > 0) {
    reasons.push(`wave clear countdown ${room.waveClearLeft | 0} ticks (~${((room.waveClearLeft | 0) / TPS).toFixed(1)}s) → wave ${(room.wave | 0) + 1}`);
  } else if (blockingAst > 0) {
    reasons.push(`${blockingAst} asteroid(s) still count as field threats (${portalGhosts} portal ghosts, ${offscreenEntered} offscreen-entered ignored)`);
  } else if (enemies.length > 0) {
    reasons.push(`${enemies.length} enemy(ies) still in room (${spawned} spawned, ${queued} queued, ${appearing} appearing)`);
  } else if (room.pendingBigSpawns && room.pendingBigSpawns.length && !room.practice) {
    reasons.push(`pending big spawns ${room.pendingBigSpawns.length}`);
  } else {
    reasons.push('field clear — next tick should start wave-clear countdown');
  }
  out.waveProgress = {
    wave: room.wave | 0,
    nextShopAt: room.practice ? (Math.ceil(((room.wave | 0) + 1) / 5) * 5) : 0,
    blocked: !!(room.practice && (
      room.shopOpen
      || (room.deathShakeLeft | 0) > 0
      || (room.deathBoomLeft | 0) > 0
      || room.deathBoomed
      || (room.waveClearLeft | 0) > 0
      || soloWaveHasFieldThreats(room)
    )),
    reasons
  };

  return out;
}

function pushPoseHistory(room) {
  const poses = new Map();
  for (const p of room.players.values()) {
    poses.set(p.id, { x: p.x, y: p.y, angle: p.angle, hp: p.hp });
  }
  room.poseHistory.push({ tick: room.tick, poses });
  while (room.poseHistory.length > POSE_HISTORY_TICKS) room.poseHistory.shift();
  if (room.demo) demoRecorder.recordPose(room, packDemoShips(room));
}

/** Ship rows for server→client demo playback (matches client demoCollectShips). */
function packDemoShips(room) {
  const ships = [];
  for (const p of room.players.values()) {
    ships.push([
      p.id, p.x, p.y, p.vx, p.vy, p.angle, p.hp | 0, p.av || 0,
      p.godLeft | 0
    ]);
  }
  return ships;
}

/** Seed snap + meta after demoRecorder.start so history demos are playable. */
function seedDemoRecording(room) {
  if (!room || !room.demo) return;
  const scores = packScoreboard(room).map((row) => [row[0] | 0, row[1] | 0]);
  const enemyRows = [];
  for (const e of room.enemies || []) {
    if (enemyIsSpawned(e)) enemyRows.push(packEnemy(e));
  }
  demoRecorder.recordSnap(room, {
    ships: packDemoShips(room),
    asteroids: (room.asteroids || []).map(packAsteroid),
    bullets: (room.bullets || []).map(packBullet),
    enemies: enemyRows,
    scores,
    names: packRosterNames(room),
    myId: 0,
    practice: !!room.practice
  });
}

/** Rewind a target to approximately when the shooter saw them (one-way latency). */
function lagCompPose(room, shooterId, target) {
  const rtt = playerRttMs(room, shooterId);
  const rewind = Math.min(LAGCOMP_MAX_TICKS, Math.max(0, Math.round((rtt * 0.5) / TICK_MS)));
  if (rewind <= 0 || !room.poseHistory.length) return target;
  const want = room.tick - rewind;
  let best = null;
  for (let i = room.poseHistory.length - 1; i >= 0; i--) {
    const f = room.poseHistory[i];
    if (f.tick <= want) {
      best = f;
      break;
    }
  }
  if (!best) best = room.poseHistory[0];
  const pose = best.poses.get(target.id);
  if (!pose) return target;
  return { id: target.id, x: pose.x, y: pose.y, angle: pose.angle, hp: target.hp };
}

/**
 * Void orb: on enter + every 7 ticks while overlapping.
 * Damage = 5 + (pulse-1)*6 → 5, 11, 17, 23, …
 * Contact reset when overlap ends. Bullet is never consumed by hits.
 */
function applyVoidOverlapPulse(b, key, applyDmg) {
  if (!b.voidTouch) b.voidTouch = new Map();
  let st = b.voidTouch.get(key);
  if (!st) {
    st = { ticks: 0, pulses: 0 };
    b.voidTouch.set(key, st);
  }
  const pulseEvery = 7;
  if (st.ticks % pulseEvery === 0) {
    st.pulses++;
    const base = (BULLET_TYPES.voidcannon && BULLET_TYPES.voidcannon.dmg) || 5;
    applyDmg(base + (st.pulses - 1) * 6);
  }
  st.ticks++;
}

/** Nudge player aim by a random ±deg (void hit scramble). */
function voidScramblePlayerAim(p, deg) {
  if (!p) return;
  const max = (deg != null ? deg : 4) * Math.PI / 180;
  p.angle += (Math.random() * 2 - 1) * max;
}

function asteroidBlocksRay(room, ox, oy, ang, maxDist) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  for (const a of room.asteroids) {
    if (a.noCollide || !asteroidOverlapsPlayfield(a)) continue;
    const hit = raycastAsteroid(ox, oy, dx, dy, a, maxDist);
    if (hit) return true;
  }
  return false;
}

function fireTurretBullet(room, p, ang) {
  const x = p.x + Math.cos(ang) * TURRET_MUZZLE;
  const y = p.y + Math.sin(ang) * TURRET_MUZZLE;
  const vel = bulletVelocity(p, ang, TURRET_SPEED, false);
  const b = {
    id: room.nextBulletId++,
    owner: p.id,
    type: 'turret',
    dmg: effectiveBulletDmg(p, 'turret'),
    x, y, spawnX: x, spawnY: y,
    vx: vel.vx,
    vy: vel.vy,
    spawnSt: Date.now()
  };
  room.bullets.push(b);
  roomBroadcast(room, { t: 'bf', b: packBullet(b) });
}

function updateTurrets(room) {
  for (const p of room.players.values()) {
    if (p.hp <= 0 || !playerHasPowerup(p, 'turret')) continue;
    if (p.turretReload > 0) {
      p.turretReload--;
      if (p.turretReload === 0) p.turretAmmo = turretMaxAmmo(p);
      continue;
    }
    if (p.turretRetry > 0) {
      p.turretRetry--;
      continue;
    }
    if (p.turretCd > 0) {
      p.turretCd--;
      continue;
    }
    if ((p.turretAmmo | 0) <= 0) {
      p.turretReload = turretReloadTicksFor(p);
      continue;
    }

    let best = null;
    let bestD2 = Infinity;
    let bestKind = null; // 'player' | 'enemy' | 'asteroid'
    for (const e of room.players.values()) {
      if (e.id === p.id || e.hp <= 0 || e.godLeft > 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
        bestKind = 'player';
      }
    }
    // Solo: prefer AI ships, then asteroids if none are around.
    if (!best && room.practice) {
      for (const e of room.enemies || []) {
        if (!enemyIsSpawned(e) || e.hp <= 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = e;
          bestKind = 'enemy';
        }
      }
      if (!best) {
        for (const a of room.asteroids || []) {
          if (isOffScreen(a)) continue;
          const dx = a.x - p.x;
          const dy = a.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = a;
            bestKind = 'asteroid';
          }
        }
      }
    }
    if (!best) continue;

    const ang = leadInterceptAngle(
      p.x, p.y,
      best.x, best.y,
      best.vx || 0, best.vy || 0,
      TURRET_SPEED
    );
    const range = Math.sqrt(bestD2) + 80 * RES_SCALE;
    // Don't ray-block against the rock we're trying to shoot.
    if (bestKind !== 'asteroid' && asteroidBlocksRay(room, p.x, p.y, ang, range)) {
      p.turretRetry = TURRET_RETRY;
      continue;
    }
    fireTurretBullet(room, p, ang);
    p.turretAmmo--;
    p.turretCd = turretCooldownFor(p);
    if (p.turretAmmo <= 0) p.turretReload = turretReloadTicksFor(p);
  }
}

/** Nudge projectile velocity toward nearest living enemy (homing powerup). */
function steerHomingBullet(room, b) {
  if (!b) return;
  if (!HOMING_BULLET_TYPES.has(b.type || 'default')) return;
  if (b.type === 'enemy' || b.type === 'enemyRocket') return;
  const owner = room.players.get(b.owner);
  if (!playerHasPowerup(owner, 'homing')) return;
  let best = null;
  let bestD2 = Infinity;
  for (const e of room.players.values()) {
    if (e.id === b.owner || e.hp <= 0 || e.godLeft > 0) continue;
    if (blocksFriendlyFire(room, b.owner)) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  if (!best) return;
  const spd = Math.hypot(b.vx, b.vy);
  if (!(spd > 1e-6)) return;
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  let diff = want - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > HOMING_TURN_RAD) diff = HOMING_TURN_RAD;
  else if (diff < -HOMING_TURN_RAD) diff = -HOMING_TURN_RAD;
  const nang = cur + diff;
  b.vx = Math.cos(nang) * spd;
  b.vy = Math.sin(nang) * spd;
}

function updateBullets(room) {
  const { bullets, players } = room;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b) continue;
    // Death sequence clears the bullet list mid-pass — stop cleanly.
    if (room.roundResetting) return;
    steerHomingBullet(room, b);
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      roomBroadcast(room, { t: 'bd', id: b.id, hit: 0, x: b.x, y: b.y });
      bullets.splice(i, 1);
      continue;
    }

    if (b.type === 'voidcannon') {
      if (!b.voidTouch) b.voidTouch = new Map();
      const active = new Set();
      for (const p of players.values()) {
        if (p.id === b.owner || p.hp <= 0 || p.godLeft > 0) continue;
        if (blocksFriendlyFire(room, b.owner)) continue;
        const target = lagCompPose(room, b.owner, p);
        if (!hitBulletPlayer(b, target)) continue;
        const key = 'p:' + p.id;
        active.add(key);
        applyVoidOverlapPulse(b, key, (dmg) => {
          let d = dmg;
          const owner = players.get(b.owner);
          if (owner && playerHasPowerup(owner, 'damage')) d *= DAMAGE_POWERUP_MULT;
          dealDamageToPlayer(room, p, d, b.owner | 0);
          voidScramblePlayerAim(p, 4);
          if (owner) tryEmpStun(room, owner, p, 'voidcannon', b);
          roomBroadcast(room, { t: 'vd', k: 'p', id: p.id | 0, x: p.x, y: p.y });
        });
      }
      forEachAsteroidNear(room, b.x, b.y, bulletBroadR(b), (a) => {
        if (!hitBulletAsteroid(b, a)) return false;
        const key = 'a:' + a.id;
        active.add(key);
        applyVoidOverlapPulse(b, key, (dmg) => {
          let d = dmg;
          const owner = players.get(b.owner);
          if (owner && playerHasPowerup(owner, 'damage')) d *= DAMAGE_POWERUP_MULT;
          damageAsteroid(room, a, d, b.owner | 0);
          roomBroadcast(room, { t: 'vd', k: 'a', id: a.id | 0, x: a.x, y: a.y });
        });
        return false;
      });
      if (room.practice && room.enemies && b.owner > 0) {
        for (let ei = room.enemies.length - 1; ei >= 0; ei--) {
          const e = room.enemies[ei];
          if (!enemyIsSpawned(e) || e.hp <= 0) continue;
          if (!hitBulletEnemy(b, e)) continue;
          const key = 'e:' + e.id;
          active.add(key);
          applyVoidOverlapPulse(b, key, (dmg) => {
            let d = dmg;
            const owner = players.get(b.owner);
            if (owner && playerHasPowerup(owner, 'damage')) d *= DAMAGE_POWERUP_MULT;
            damageEnemy(room, e, d);
            roomBroadcast(room, { t: 'vd', k: 'e', id: e.id | 0, x: e.x, y: e.y });
          });
        }
      }
      for (let j = bullets.length - 1; j >= 0; j--) {
        const r = bullets[j];
        if (!r || r.type !== 'rocket') continue;
        if ((r.owner | 0) === (b.owner | 0)) continue;
        if (blocksFriendlyFire(room, b.owner)) continue;
        if (!hitBulletTarget(b, r.x, r.y, rocketHitR(r), false)) continue;
        const key = 'r:' + r.id;
        active.add(key);
        applyVoidOverlapPulse(b, key, () => {
          deflectRocketFromShooter(room, r, b.owner);
        });
      }
      for (const key of [...b.voidTouch.keys()]) {
        if (!active.has(key)) b.voidTouch.delete(key);
      }
      continue;
    }

    let hit = false;
    let hitPlayer = null;
    for (const p of players.values()) {
      if (p.id === b.owner || p.hp <= 0 || p.godLeft > 0) continue;
      if (p.bot && !room.perfTest) continue;
      if (blocksFriendlyFire(room, b.owner)) continue;
      // Enemy bullets: no lag-comp rewind from fake owner.
      const target = (b.type === 'enemy' || b.type === 'enemyRocket')
        ? p
        : lagCompPose(room, b.owner, p);
      if (hitBulletPlayer(b, target)) {
        hitPlayer = p;
        hit = true;
        break;
      }
    }
    if (hit) {
      const p = hitPlayer;
      if (b.type === 'rocket') {
        detonateRocket(room, b, 1);
        const owner = players.get(b.owner);
        if (owner) tryEmpStun(room, owner, p, 'rocket', b);
      } else if (b.type === 'enemyRocket') {
        // UFO micro-rocket: damage + asteroid-style stun / bounce.
        let nx = b.vx || 0, ny = b.vy || 0;
        let len = Math.hypot(nx, ny);
        if (len < 1e-6) {
          nx = shortestWrapDelta(b.x, p.x, W);
          ny = shortestWrapDelta(b.y, p.y, H);
          len = Math.hypot(nx, ny);
        }
        if (len > 1e-6) { nx /= len; ny /= len; }
        else { nx = 1; ny = 0; }
        applyShipCrash(room, p, nx, ny, 0, b.dmg, 0.5);
        notifyShipHit(room, p);
        roomBroadcast(room, { t: 'bd', id: b.id, hit: 1, x: b.x, y: b.y });
      } else {
        dealDamageToPlayer(room, p, b.dmg, b.owner | 0);
        const owner = players.get(b.owner);
        if (owner) tryEmpStun(room, owner, p, b.type || 'default', b);
        roomBroadcast(room, { t: 'bd', id: b.id, hit: 1, x: b.x, y: b.y });
      }
      if (room.roundResetting) return; // death already wiped bullets
      bullets.splice(i, 1);
      continue;
    }

    // Player projectiles can destroy solo enemies.
    if (room.practice && room.enemies && b.type !== 'enemy' && b.type !== 'enemyRocket' && b.owner > 0) {
      let hitEnemy = false;
      for (let ei = room.enemies.length - 1; ei >= 0; ei--) {
        const e = room.enemies[ei];
        if (!enemyIsSpawned(e)) continue;
        if (!hitBulletEnemy(b, e)) continue;
        if (b.type === 'rocket') {
          detonateRocket(room, b, 3);
        } else {
          damageEnemy(room, e, b.dmg);
          roomBroadcast(room, { t: 'bd', id: b.id, hit: 3, x: b.x, y: b.y });
        }
        bullets.splice(i, 1);
        hitEnemy = true;
        break;
      }
      if (hitEnemy) continue;
    }

    // Hitting another player's rocket deflects it 10° away (does not destroy).
    {
      let hitRocket = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        if (j === i) continue;
        const r = bullets[j];
        if (!r || r.type !== 'rocket') continue;
        if ((r.owner | 0) === (b.owner | 0)) continue;
        if (blocksFriendlyFire(room, b.owner)) continue;
        if (!hitBulletTarget(b, r.x, r.y, rocketHitR(r), false)) continue;
        if ((b.owner | 0) > 0) deflectRocketFromShooter(room, r, b.owner);
        else deflectRocketAwayFrom(room, r, b.x, b.y);
        if (b.type === 'rocket') {
          detonateRocket(room, b, 1);
        } else {
          roomBroadcast(room, { t: 'bd', id: b.id, hit: 1, x: b.x, y: b.y });
        }
        bullets.splice(i, 1);
        hitRocket = true;
        break;
      }
      if (hitRocket) continue;
    }

    const bcfg = BULLET_TYPES[b.type] || BULLET_TYPES.default;
    if (bcfg.skipAsteroids) continue;

    forEachAsteroidNear(room, b.x, b.y, bulletBroadR(b), (a) => {
      if (!hitBulletAsteroid(b, a)) return false;
      if (b.type === 'rocket') {
        detonateRocket(room, b, 2);
      } else {
        roomBroadcast(room, { t: 'bd', id: b.id, hit: 2, x: b.x, y: b.y });
        damageAsteroid(room, a, b.dmg, b.owner | 0);
      }
      bullets.splice(i, 1);
      return true;
    });
  }
}

/** Reflect pickups at the playfield edge and let players collect them.
 *  All pickups except health: max PICKUP_BOUNCE_MAX edge bounces, then drift off and despawn. */
function updatePickups(room) {
  const pickups = room.pickups;
  if (!pickups.length) return;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const u = pickups[i];
    u.x += u.vx;
    u.y += u.vy;
    u.angle += u.spin;
    const m = u.r + 2;
    const bounceLimited = u.kind !== 'health';
    const bounces = u.bounces | 0;
    const spent = bounceLimited && bounces >= PICKUP_BOUNCE_MAX;

    if (spent) {
      // No 4th bounce — leave the field and despawn off-screen.
      if (u.x < -m || u.x > W + m || u.y < -m || u.y > H + m) {
        emitPickupDead(room, u.id, null, null, { silent: 1 });
        pickups.splice(i, 1);
        continue;
      }
    } else {
      let bounced = false;
      if (u.x < m) { u.x = m; u.vx = Math.abs(u.vx); bounced = true; }
      else if (u.x > W - m) { u.x = W - m; u.vx = -Math.abs(u.vx); bounced = true; }
      if (u.y < m) { u.y = m; u.vy = Math.abs(u.vy); bounced = true; }
      else if (u.y > H - m) { u.y = H - m; u.vy = -Math.abs(u.vy); bounced = true; }
      if (bounced) {
        if (bounceLimited) u.bounces = bounces + 1;
        resyncPickupSpawn(u);
        emitPickupBounce(room, u);
      }
    }

    let taken = false;
    for (const p of room.players.values()) {
      if (p.bot || p.hp <= 0) continue;
      let got = false;
      for (const cir of playerHitCircles(p)) {
        if (hitCircleCircle(u.x, u.y, u.r, cir.x, cir.y, cir.r, true)) {
          got = true;
          break;
        }
      }
      if (!got) continue;
      applyPickupToPlayer(room, p, u);
      if (u.kind === 'health') {
        emitPickupDead(room, u.id, u.x, u.y, { kind: 'health' });
      } else if (u.kind === 'powerup') {
        emitPickupDead(room, u.id, u.x, u.y, {
          kind: 'powerup',
          powerup: u.powerup
        });
      } else {
        emitPickupDead(room, u.id, u.x, u.y, {
          kind: 'weapon',
          weapon: p.weapon,
          lvl: getWeaponLevel(p, p.weapon)
        });
      }
      pickups.splice(i, 1);
      taken = true;
      break;
    }
    if (taken) continue;
  }
}
