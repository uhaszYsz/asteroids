/** @file server/constants.js — loaded into shared server scope (do not require() alone). */
const PORT = Number(process.env.PORT) || 8765;
const HOST = process.env.HOST || '0.0.0.0';
const RES_SCALE = 2;
// 16:9 world (was 420×240 = 7:4). With RES_SCALE=2 → 960×540.
const W = 480 * RES_SCALE, H = 270 * RES_SCALE;
const TPS = 30;
const TICK_MS = 1000 / TPS;
/** Max WebSocket JSON messages accepted per second (token bucket refill). */
const RATE_MSG_PER_SEC = 100;
const RATE_MSG_BURST = 40;
/** Max input frames accepted per second (~2× TPS). */
const RATE_INPUT_FRAMES_PER_SEC = TPS * 2;
const RATE_INPUT_FRAMES_BURST = TPS;
/**
 * Safety cap only — backlog is burned in-order each tick (Quake/HL style).
 * Must be >= MAX_FRAMES_PER_MSG so one client packet can enqueue fully.
 */
const MAX_INPUT_QUEUE = 24;
/** Soft shed target after enqueue (still above one packet). */
const SOFT_INPUT_QUEUE = 16;
const MAX_FRAMES_PER_MSG = 24;
/** Reject seq that jumps more than this ahead of last applied/queued. */
const MAX_SEQ_JUMP = TPS * 3;
/** Close socket after this many hard rate-limit strikes. */
const RATE_STRIKES_KICK = 12;
const MAX_HP = 100;
/** Solo / practice: one-hit deaths, three lives. */
const SOLO_MAX_HP = 100;
const SOLO_LIVES = 3;
/** Bot HP used by `test performance N` rooms. */
const PERF_BOT_HP = 500;
/** Soft cap so a typo doesn't OOM the process. */
const PERF_TEST_MAX_GAMES = 2000;
const PLAYER_R = 10 * RES_SCALE;
/** Base per-circle hit radius (0.3× old single circle). */
const PLAYER_HIT_R = PLAYER_R * 0.3;
const PLAYER_HIT_R_FRONT = PLAYER_HIT_R * 1.1;
const PLAYER_HIT_R_BACK = PLAYER_HIT_R * 2 * 0.9;
/** Hit circle offsets along facing from ship center. */
const PLAYER_HIT_OFFSET_FRONT = 5 * RES_SCALE;
const PLAYER_HIT_OFFSET_BACK = 3 * RES_SCALE;
const MUZZLE = 10 * RES_SCALE;
const WEAPON_SLOTS = ['default', 'rocket', 'laser', 'shotgun', 'railgun', 'plasma', 'voidcannon', 'asteroidgun'];
/** Max upgrade purchases per weapon (any mix of options). */
const WEAPON_MAX_LEVEL = 3;
const WEAPONS = {
  default: { ammo: 3, cooldown: 2, reload: 32, speed: 13.5 },
  rocket: { ammo: 1, cooldown: 3, reload: 45, speed: 15 },
  laser: { ammo: 45, cooldown: 1, reload: 40, range: Math.hypot(W, H) },
  shotgun: {
    ammo: 1,
    cooldown: 1,
    reload: 40,
    shotgun: 5,
    spread: 30,
    shotgunSpeeds: [7.5 * RES_SCALE * 0.85, 10.5 * RES_SCALE * 0.85],
    relative: false
  },
  /** Charge 0.5s then one raycast; 45-tick cooldown between shots; infinite reloads. */
  railgun: {
    ammo: 1,
    cooldown: 45,
    reload: 1,
    range: Math.hypot(W, H),
    charge: Math.round(0.5 * TPS)
  },
  /** Rapid plasma bolts. */
  plasma: { ammo: 30, cooldown: 2, reload: Math.round(2 * TPS), speed: 9 * RES_SCALE * 1.7 },
  /** Slow void orb — persists through hits, escalating DoT while overlapping. */
  voidcannon: { ammo: 1, cooldown: 1, reload: 60, speed: 2.1504 * RES_SCALE },
  /** Lob a little asteroid that bounces off rocks. */
  asteroidgun: { ammo: 1, cooldown: 3, reload: Math.round(2.5 * TPS), speed: 8 * RES_SCALE }
};
/** Thruster damage ray — same stats as the removed melee weapon. */
const THRUST_RAY_RANGE = 39;
const THRUST_RAY_MUZZLE = 6 * RES_SCALE;
/** Facing must match travel dir (prev→now) within this for thruster ray. */
const THRUST_RAY_ALIGN_RAD = 30 * Math.PI / 180;
/** Ignore travel align when last-tick move is basically zero. */
const THRUST_RAY_MIN_MOVE = 0.2 * RES_SCALE;
const PLAYER_SHOT_ASTEROID_HP = 200;
/** Meteor Gun rock bounce damage vs world rocks (after velocity bounce). */
const PLAYER_SHOT_BOUNCE_DMG = 110;
/** Meteor Gun rock vs player — flat damage (same crash/stun path as world rocks). */
const PLAYER_SHOT_HIT_DMG = 70;
/** Meteor Gun rock vs solo enemies — flat damage, no stun / no knockback. */
const PLAYER_SHOT_ENEMY_DMG = 100;
/** Hitting a player rocket damages hull and randomizes its heading if it survives. */
const ROCKET_DEFLECT_RAD = 10 * Math.PI / 180;
/** Player rocket explosion blast (world px). Falloff maxDmg → 0 by surface distance. */
const ROCKET_BLAST_RADIUS = 32 * RES_SCALE;
/** Enough to one-shot common enemies (95 HP) even on a grazing contact detonation. */
const ROCKET_BLAST_DMG = 125;
/** Default gun: distance-dmg upgrade kicks in after this travel (world px). */
const DEFAULT_DIST_DMG_PX = 150;
/** Shotgun ammo hard cap (base 1 + ammo ranks). */
const SHOTGUN_AMMO_MAX = 3;

/**
 * Independent shop upgrade options per weapon.
 * maxRank: optional hard cap on that option alone (still limited by WEAPON_MAX_LEVEL budget).
 */
const WEAPON_UPGRADE_DEFS = {
  default: [
    { id: 'ammo', label: 'Ammo', desc: '+1 magazine ammo' },
    { id: 'distDmg', label: 'Long shot', desc: '+50% damage after bullet travels 150px' },
    { id: 'reload', label: 'Reload', desc: '−30% reload time' }
  ],
  shotgun: [
    { id: 'pellet', label: 'Pellet', desc: '+1 pellet per shot' },
    { id: 'ammo', label: 'Ammo', desc: '+1 ammo (max 3)', maxRank: 2 },
    { id: 'size', label: 'Size', desc: '+30% pellet hit size' }
  ],
  laser: [
    { id: 'width', label: 'Width', desc: '+32% beam width and +2 raycasts (damage split)' },
    { id: 'ammo', label: 'Ammo', desc: '+15 magazine ammo' }
  ],
  railgun: [
    { id: 'bounce', label: 'Bounce', desc: '+1 edge bounce' },
    { id: 'ammo', label: 'Ammo', desc: '+1 ammo; shot cooldown 1s' },
    { id: 'width', label: 'Width', desc: '3 rays (edges + center); +10% beam width each' },
    { id: 'dmg', label: 'Damage', desc: '+50% damage' }
  ],
  rocket: [
    { id: 'radius', label: 'Radius', desc: '+30% blast radius' },
    { id: 'ammo', label: 'Ammo', desc: '+1 ammo; −30% blast damage' }
  ],
  asteroidgun: [
    { id: 'bounce', label: 'Wrap', desc: '+1 edge teleport' },
    { id: 'size', label: 'Size', desc: '+15% rock size' },
    { id: 'dmg', label: 'Damage', desc: '+20% damage' }
  ],
  plasma: [
    { id: 'ammo', label: 'Ammo', desc: '+10 magazine ammo' },
    { id: 'dmg', label: 'Damage', desc: '+20 damage per bolt' }
  ],
  voidcannon: [
    { id: 'stream', label: 'Stream', desc: '+1 orb at 90° spacing' },
    { id: 'size', label: 'Size', desc: '+20% orb size' },
    { id: 'reload', label: 'Reload', desc: '−30% reload time' }
  ]
};

const BULLET_TYPES = {
  default: { dmg: 35, col: 'circle', size: 2 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  /** Direct dmg unused — rockets only deal ROCKET_BLAST_* circle damage on detonate. */
  rocket: { dmg: 0, col: 'circle', size: 3.5 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  laser: { dmg: 7, col: 'ray', size: 0, scaleY: 1, length: 0, width: 2 * RES_SCALE },
  shotgun: { dmg: 10, col: 'circle', size: 2 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  railgun: { dmg: 80, col: 'ray', size: 0, scaleY: 1, length: 0, width: 3 * RES_SCALE },
  /** Engine exhaust hit — same range/dmg/width as old melee; drawn for now. */
  thrust: { dmg: 25, col: 'ray', size: 0, scaleY: 1, length: 0, width: 3 * RES_SCALE },
  plasma: { dmg: 6, col: 'circle', size: 5 * RES_SCALE, scaleY: 1, length: 5 * RES_SCALE, width: 2.5 * RES_SCALE },
  voidcannon: { dmg: 5, col: 'circle', size: 27 * RES_SCALE, scaleY: 1, length: 0, width: 0 },
  /**
   * NPC glowing shots — circle hit = white core radius (see enemyShotCoreRadius).
   * Visual glow is larger; length/width kept only as size tags for worm scale.
   */
  enemy: { dmg: 18, col: 'circle', size: 0, skipAsteroids: true, length: 15, width: 3 },
  enemySpinner: { dmg: 18, col: 'circle', size: 0, skipAsteroids: true, length: 20, width: 20 },
  /** Worm 360° shotgun pellet — length/width set per bullet (7–30) drive core scale. */
  enemyWorm: { dmg: 18, col: 'circle', size: 0, skipAsteroids: true, length: 15, width: 15 },
  /** UFO micro-rocket — 1px hit radius, skips asteroids. */
  enemyRocket: { dmg: 18, col: 'circle', size: 1, scaleY: 1, length: 0, width: 0, skipAsteroids: true }
};

/** Matches client drawEnemyCommonShot: typeScale × visScale × base core half-radius. */
const ENEMY_SHOT_VIS_SCALE = 2;
const ENEMY_SHOT_CORE_BASE = 2.4 * RES_SCALE;
const ENEMY_SHOT_GLOW_BASE = 4.2 * RES_SCALE;
/**
 * softOval FS: near-full alpha for UV length d < HIT_FRAC, then AA fade to rim.
 * Hit circle uses that opaque white core.
 */
const ENEMY_SHOT_HIT_FRAC = 0.92;

function enemyShotTypeScale(type, length, width) {
  if (type === 'enemySpinner') return 20 / 15;
  if (type === 'enemyWorm') {
    const L = length != null && Number.isFinite(+length) ? +length : 15;
    const Ww = width != null && Number.isFinite(+width) ? +width : 15;
    return Math.max(L, Ww) / 15;
  }
  // Common enemy shots: half base scale.
  return 0.5;
}

/** Collision / cl_hitbox radius = visible solid white core. */
function enemyShotCoreRadius(type, length, width) {
  return ENEMY_SHOT_CORE_BASE * enemyShotTypeScale(type, length, width)
    * ENEMY_SHOT_VIS_SCALE * ENEMY_SHOT_HIT_FRAC;
}

function freshWeaponUpgradeRanks(weaponName) {
  const defs = WEAPON_UPGRADE_DEFS[weaponName];
  const o = {};
  if (!defs) return o;
  for (let i = 0; i < defs.length; i++) o[defs[i].id] = 0;
  return o;
}

function freshWeaponUpgrades() {
  const o = {};
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    o[WEAPON_SLOTS[i]] = freshWeaponUpgradeRanks(WEAPON_SLOTS[i]);
  }
  return o;
}

function ensureWeaponUpgrades(p) {
  if (!p.weaponUpgrades) p.weaponUpgrades = freshWeaponUpgrades();
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    const k = WEAPON_SLOTS[i];
    if (!p.weaponUpgrades[k]) p.weaponUpgrades[k] = freshWeaponUpgradeRanks(k);
  }
  return p.weaponUpgrades;
}

function getUpgradeRank(p, weaponName, optId) {
  const ups = ensureWeaponUpgrades(p);
  const ranks = ups[weaponName] || freshWeaponUpgradeRanks(weaponName);
  return Math.max(0, ranks[optId] | 0);
}

/** Total upgrade purchases for a weapon (0..WEAPON_MAX_LEVEL). */
function weaponUpgradeCount(p, name) {
  const n = name || (p && p.weapon) || 'default';
  const ranks = ensureWeaponUpgrades(p)[n] || freshWeaponUpgradeRanks(n);
  let sum = 0;
  for (const k of Object.keys(ranks)) sum += Math.max(0, ranks[k] | 0);
  return Math.min(WEAPON_MAX_LEVEL, sum);
}

/** Derived HUD level = upgrade buy count (0..3). Kept for net `levels` field. */
function freshWeaponLevels() {
  const o = {};
  for (let i = 0; i < WEAPON_SLOTS.length; i++) o[WEAPON_SLOTS[i]] = 0;
  return o;
}

function syncWeaponLevelsFromUpgrades(p) {
  ensureWeaponUpgrades(p);
  if (!p.weaponLevels) p.weaponLevels = freshWeaponLevels();
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    const k = WEAPON_SLOTS[i];
    p.weaponLevels[k] = weaponUpgradeCount(p, k);
  }
  return p.weaponLevels;
}

function getWeaponLevel(p, name) {
  return weaponUpgradeCount(p, name);
}

function findUpgradeDef(weaponName, optId) {
  const defs = WEAPON_UPGRADE_DEFS[weaponName];
  if (!defs) return null;
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].id === optId) return defs[i];
  }
  return null;
}

/** Max rank for an option given weapon budget + optional per-option maxRank. */
function upgradeOptMaxRank(weaponName, optId, currentBudget, currentRank) {
  const def = findUpgradeDef(weaponName, optId);
  if (!def) return 0;
  const budgetLeft = WEAPON_MAX_LEVEL - (currentBudget | 0);
  if (budgetLeft <= 0) return currentRank | 0;
  let hard = WEAPON_MAX_LEVEL;
  if (def.maxRank != null) hard = Math.min(hard, def.maxRank | 0);
  return Math.min(hard, (currentRank | 0) + budgetLeft);
}

function canBuyWeaponUpgrade(p, weaponName, optId) {
  if (!p || !findUpgradeDef(weaponName, optId)) return false;
  const budget = weaponUpgradeCount(p, weaponName);
  if (budget >= WEAPON_MAX_LEVEL) return false;
  const rank = getUpgradeRank(p, weaponName, optId);
  const maxR = upgradeOptMaxRank(weaponName, optId, budget, rank);
  return rank < maxR;
}

function shopUpgradeCost(p, weaponName) {
  const budget = weaponUpgradeCount(p, weaponName);
  if (budget >= WEAPON_MAX_LEVEL) return -1;
  return 800 + 200 * (budget + 1);
}

/** Stats for a weapon at the player's upgrade ranks. */
function effectiveWeapon(p, name) {
  const n = name || p.weapon;
  const base = WEAPONS[n] || WEAPONS.default;
  const w = Object.assign({}, base);
  if (base.shotgunSpeeds) w.shotgunSpeeds = base.shotgunSpeeds.slice();
  const r = (id) => getUpgradeRank(p, n, id);

  if (n === 'default') {
    w.ammo = (base.ammo | 0) + r('ammo');
    if (r('reload') > 0) {
      w.reload = Math.max(1, Math.round(base.reload * Math.pow(0.7, r('reload'))));
    }
  } else if (n === 'rocket') {
    w.ammo = (base.ammo | 0) + r('ammo');
  } else if (n === 'shotgun') {
    w.ammo = Math.min(SHOTGUN_AMMO_MAX, (base.ammo | 0) + r('ammo'));
    w.shotgun = (base.shotgun | 0) + r('pellet');
    w.pelletSizeMul = Math.pow(1.3, r('size'));
  } else if (n === 'laser') {
    w.widthRank = r('width');
    w.ammo = (base.ammo | 0) + 15 * r('ammo');
  } else if (n === 'plasma') {
    w.ammo = (base.ammo | 0) + 10 * r('ammo');
  } else if (n === 'asteroidgun') {
    w.edgeWrapMax = r('bounce');
    w.sizeMul = Math.pow(1.15, r('size'));
    w.dmgMul = Math.pow(1.2, r('dmg'));
  } else if (n === 'voidcannon') {
    w.streamCount = 1 + r('stream');
    w.sizeMul = Math.pow(1.2, r('size'));
    if (r('reload') > 0) {
      w.reload = Math.max(1, Math.round(base.reload * Math.pow(0.7, r('reload'))));
    }
  } else if (n === 'railgun') {
    w.ammo = (base.ammo | 0) + r('ammo');
    w.bounce = r('bounce');
    w.widthRank = r('width');
    if (r('ammo') > 0) w.cooldown = Math.round(1 * TPS); // 1s between shots when ammo upgraded
  }
  return w;
}

function effectiveBulletDmg(p, typeName) {
  const cfg = BULLET_TYPES[typeName] || BULLET_TYPES.default;
  let dmg = cfg.dmg;
  if (typeName === 'plasma') dmg = cfg.dmg + 20 * getUpgradeRank(p, 'plasma', 'dmg');
  if (typeName === 'railgun') dmg = cfg.dmg * Math.pow(1.5, getUpgradeRank(p, 'railgun', 'dmg'));
  return dmg;
}

function effectiveRocketBlastDmg(p) {
  return ROCKET_BLAST_DMG * Math.pow(0.7, getUpgradeRank(p, 'rocket', 'ammo'));
}

function effectiveRocketBlastRadius(p) {
  return ROCKET_BLAST_RADIUS * Math.pow(1.3, getUpgradeRank(p, 'rocket', 'radius'));
}

/** Magazine reload ticks. */
function effectiveReloadTicks(p, baseReload) {
  return Math.max(1, baseReload | 0);
}

/** Stamp PvP frag credit (last player who damaged this ship). */
function notePlayerAttacker(victim, attackerId) {
  const aid = attackerId | 0;
  if (!victim || aid <= 0 || aid === (victim.id | 0)) return;
  victim.lastHitBy = aid;
}

/**
 * Apply HP damage. Returns true if HP was reduced.
 */
function dealDamageToPlayer(room, p, dmg, attackerId) {
  if (!p || p.hp <= 0 || p.godLeft > 0) return false;
  notePlayerAttacker(p, attackerId);
  p.hp -= dmg;
  if (p.hp <= 0) handlePlayerDeath(room, p);
  return true;
}

const THRUST = 0.09 * RES_SCALE * 1.15 * 1.2 * 1.2 * 0.85;  // prior buffs, then −15%
const MAX_SPEED = 8 * RES_SCALE * 0.8 * 0.75 * 0.75;   // −25%, then −25% again
/** Above MAX_SPEED: shed this much speed per tick (no hard clip). */
const OVERSPEED_DECEL = 0.2;
const STUN_MAX_SPEED = 9;
const ASTEROID_COLLIDE_DMG_MIN = 10;
const TURN_AV_MAX = 8 * Math.PI / 180;            // 8°/tick
const TURN_ACCEL = 0.7 * Math.PI / 180;           // 0.7°/tick² (~11.4 ticks to cap)
/** Precision mode (Shift / Down / S): slower accel + lower av cap (toggle anytime). */
const TURN_AV_MAX_PRECISE = TURN_AV_MAX * 0.3;
const TURN_ACCEL_PRECISE = TURN_ACCEL * 0.3;
const TURN_DECEL_FRAMES = 5;
/** Opposite turn: double deaccel-to-zero rate (half the coast frames). */
const TURN_DECEL_REVERSE_FRAMES = Math.max(1, (TURN_DECEL_FRAMES / 2) | 0);
/** Asteroid collide damage scales with relative impact speed vs MAX_SPEED (1.0 → full HP before scale). */
/** Stun spin on asteroid hit (°/tick); ends when |av| drops under STUN_END_AV. */
const STUN_SPIN = 17 * Math.PI / 180;
const STUN_END_AV = 3 * Math.PI / 180;
/** While stunned, angular speed cannot exceed this (°/tick). */
const STUN_AV_MAX = 17 * Math.PI / 180;
/** While stunned with no steer: coast av toward 0 over this many ticks (~3s). */
const STUN_DECEL_TICKS = Math.round(3 * TPS);
/** Ignore re-collides briefly after a bounce. */
const COLLIDE_IFRAME_TICKS = Math.round(0.35 * TPS);
/** Post-respawn / match-start invuln: max duration; also ends when leaving spawn area. */
const GODMODE_TICKS = Math.round(5 * TPS);
/** Legacy dual-pad offset (unused — all modes share one center zone). */
const SPAWN_CENTER_OFFSET = 250;
/** Small lateral split so two ships don't stack in the shared zone. */
const SHARED_SPAWN_SPREAD = 16;
/** Spawn safe zone radius (asteroid clear + leave-to-end-godmode). Center of arena. */
const GODMODE_SPAWN_CLEAR_R = 75;
/** PvP pre-round 3-2-1 before movement (match start + each round). */
const PRE_ROUND_COUNTDOWN_SEC = 3;
/** Per-player PvP shop open time budget per match (ticks). */
const PVP_SHOP_BUDGET_TICKS = 2 * 60 * TPS;
/** Starting coins so PvP shop is usable at match start. */
const PVP_START_COINS = 2000;
/** Freeze frame while dying player shakes. */
const DEATH_SHAKE_TICKS = Math.round(1 * TPS);
/** After explosion, wait this long before respawn. */
const DEATH_BOOM_TICKS = Math.round(4 * TPS);
const PLAYERS_PER_MATCH = 2;
/** Total pause budget per player per PvP match (manual + disconnect). */
const PAUSE_BUDGET_MS = 60 * 1000;
/** Seconds shown as 3-2-1 before resume. */
const PAUSE_RESUME_COUNTDOWN_SEC = 3;
const MIN_SPLIT_R = 7 * RES_SCALE;
/** How many non-center big asteroids the room maintains (plus 1 center rock). */
const BIG_ASTEROID_COUNT = 2;
/** Cap on non-center medium asteroids; extras are culled when they leave the screen. */
/** Soft cap on mediums in 1v1; solo waves use SOLO_MEDIUM_CAP. */
const MEDIUM_ASTEROID_MAX = 7;
/** Solo wave medium asteroid hard cap. */
const SOLO_MEDIUM_CAP = 8;
/** Mediums spawned once at match start (not respawned). */
const START_MEDIUM_COUNT = 3;
/** Delay before a replacement big asteroid enters after one is destroyed. */
const BIG_SPAWN_DELAY_TICKS = Math.round(1 * TPS);
/** Brief pause after clearing a solo wave before the next spawn. */
const SOLO_WAVE_CLEAR_TICKS = Math.round(1.4 * TPS);
/** Solo enemy line-bullet speed = player default base (15) × 0.7 — not linked to tuned player speed. */
const ENEMY_BULLET_SPEED = 15 * 0.7;
/** UFO micro-rocket: legacy constant-speed value (unused — accel cruise now). */
const ENEMY_UFO_ROCKET_SPEED = ENEMY_BULLET_SPEED * 0.85;
/** UFO rocket launch kick (px/tick) along aim. */
const ENEMY_UFO_ROCKET_KICK = 4;
/** UFO rocket base accel (px/tick); same boost/cruise caps as player rockets. */
const ENEMY_UFO_ROCKET_ACCEL = 0.15;
/** Common enemy spread shots: half that speed, 45 damage. */
const ENEMY_COMMON_BULLET_SPEED = ENEMY_BULLET_SPEED * 0.5;
const ENEMY_COMMON_BULLET_DMG = 45;
const ENEMY_COMMON_RELOAD = Math.round(2.5 * TPS);
/** common1: single shot, ~26.5% faster than common spread pellets (was +15%, then +10%). */
const ENEMY_COMMON1_BULLET_SPEED = ENEMY_COMMON_BULLET_SPEED * 1.15 * 1.1;
/** common1: 40% shorter gap between shots. */
const ENEMY_COMMON1_RELOAD = Math.max(1, Math.round(ENEMY_COMMON_RELOAD * 0.6));
/** common1 post-shot flank: peak heading offset (±deg), half-sine over this fraction of reload. */
const ENEMY_COMMON1_FLANK_DEG = 25;
const ENEMY_COMMON1_FLANK_RELOAD_FRAC = 0.85;
/** Pre-shot telegraph length for commons (client charge spheres). */
const ENEMY_COMMON_CHARGE = TPS;
const ENEMY_UFO_RELOAD = Math.round(3.5 * TPS);
/** UFO pre-shot telegraph (red charge sphere + aim laser). */
const ENEMY_UFO_CHARGE = TPS;
/** After spawn, wait this long before the first shot (all enemy kinds). */
const ENEMY_FIRST_SHOT_MIN_S = 4;
const ENEMY_FIRST_SHOT_MAX_S = 6;
const ENEMY_WANDER_SPEED_MIN = 1 * RES_SCALE;
const ENEMY_WANDER_SPEED_MAX = 2.2 * RES_SCALE;
/** Fallback if an enemy is missing speed (old snaps / demos). */
const ENEMY_WANDER_SPEED = 1.35 * RES_SCALE;
const ENEMY_ARRIVE_R = 10 * RES_SCALE;
/** Max turn toward wander target per sim tick (destinationSmooth). */
const ENEMY_TURN_MAX = (2 * Math.PI) / 180;
/** Retarget wander even if not arrived (orbiting) — random seconds per leg. */
const ENEMY_WANDER_RETARGET_MIN_S = 7;
const ENEMY_WANDER_RETARGET_MAX_S = 20;
const ENEMY_MOVE_DESTINATION = 'destination';
const ENEMY_MOVE_DESTINATION_SMOOTH = 'destinationSmooth';
/** Full enemy pose broadcast interval. */
const ENEMY_SNAP_INTERVAL = Math.round(0.5 * TPS);
const ENEMY_R = {
  common: 6 * RES_SCALE,
  common1: 6 * RES_SCALE,
  commonRail: 6 * RES_SCALE * 0.7,
  commonVoid: 6 * RES_SCALE * 0.7,
  ufo: 9 * RES_SCALE,
  carrier: 12 * RES_SCALE,
  worm: 10 * RES_SCALE,
  spinner: 8 * RES_SCALE,
  railBounce: 8 * RES_SCALE * 0.8,
  laserSpin: 8 * RES_SCALE,
  gunship: 10 * RES_SCALE,
  snake: 6 * RES_SCALE
};
/**
 * UFO (Heavy 370) after 270° CW load: fw=52, fh=84.
 * Hitbox = 2D OBB: full sprite length × one roof-plane width (fw/2), matching drawSpriteShipPlane.
 */
const ENEMY_UFO_HIT_LEN = 84;
const ENEMY_UFO_HIT_WID = 26;
const ENEMY_UFO_HIT_R = Math.hypot(ENEMY_UFO_HIT_LEN * 0.5, ENEMY_UFO_HIT_WID * 0.5);
ENEMY_R.ufo = ENEMY_UFO_HIT_R;
/**
 * Gunship (Craft 378) after 270° CW: fw=57, fh=72. Drawn at ENEMY_GUNSHIP_SPRITE_SCALE.
 * OBB = full length × one roof-plane width (fw/2), then × sprite scale.
 */
const ENEMY_GUNSHIP_SPRITE_SCALE = 1.6;
const ENEMY_GUNSHIP_HIT_LEN = Math.round(72 * ENEMY_GUNSHIP_SPRITE_SCALE);
const ENEMY_GUNSHIP_HIT_WID = Math.round((57 * 0.5) * ENEMY_GUNSHIP_SPRITE_SCALE);
const ENEMY_GUNSHIP_HIT_R = Math.hypot(ENEMY_GUNSHIP_HIT_LEN * 0.5, ENEMY_GUNSHIP_HIT_WID * 0.5);
ENEMY_R.gunship = ENEMY_GUNSHIP_HIT_R;
/**
 * Worm hit OBB (oriented box along facing).
 * Length = 4× legacy circle radius. Width = 70% of both tube roof planes tip-to-tip
 * (sprite 367 fw×scale, tube pitch = half SPRITE_ROOF_PITCH).
 */
const ENEMY_WORM_HIT_R = 8 * RES_SCALE;
const ENEMY_WORM_HIT_LEN = 8 * ENEMY_WORM_HIT_R;
const ENEMY_WORM_SPRITE_FW = 84;
const ENEMY_WORM_SPRITE_SCALE = 1.6;
const ENEMY_WORM_TUBE_PITCH = 0.58 * 0.5;
const ENEMY_WORM_HIT_WID = 0.7 * 0.6 * 2
  * (ENEMY_WORM_SPRITE_FW * 0.5 * ENEMY_WORM_SPRITE_SCALE)
  * Math.cos(ENEMY_WORM_TUBE_PITCH);
ENEMY_R.worm = Math.hypot(ENEMY_WORM_HIT_LEN * 0.5, ENEMY_WORM_HIT_WID * 0.5);
const ENEMY_HP = {
  common: 95,
  common1: 95,
  commonRail: 95,
  commonVoid: 95,
  ufo: 300,
  carrier: 90,
  worm: 1000,
  spinner: 320,
  railBounce: 320,
  laserSpin: 320,
  gunship: 1000,
  snake: 3500
};
/** Snake boss: head path stamps every FOLLOW_DIST px (cap starts at SEGMENTS; grows when head eats rocks). */
const ENEMY_SNAKE_SEGMENTS = 100;
const ENEMY_SNAKE_FOLLOW_DIST = 15;
const ENEMY_SNAKE_GROW_PER_EAT = 7;
/** Body mounts every N segments (0-based indices 19, 39, …). */
const ENEMY_SNAKE_TURRET_EVERY = 20;
const ENEMY_SNAKE_TURRET_HP = 150;
/** Shared fire cadence for all living mounts on a snake. */
const ENEMY_SNAKE_TURRET_FIRE_TICKS = 4 * TPS;
const ENEMY_SNAKE_TURRET_BULLET_SPEED = 4.5;
/** Every this much boss HP lost (head/tail, not turrets) → electro rage dash. */
const ENEMY_SNAKE_RAGE_EVERY = 1000;
/** Rage duration: 2× move speed + big electro charge FX in front of the head (5s; was 2.5s). */
const ENEMY_SNAKE_RAGE_TICKS = Math.round(5 * TPS);
/** Hits on the head circle deal this many times normal damage. */
const ENEMY_SNAKE_HEAD_DMG_MULT = 2;
/** Snake field event: drip smalls / mediums while the boss lives. */
const SNAKE_FIELD_SMALL_INTERVAL = Math.round(2 * TPS);
const SNAKE_FIELD_MEDIUM_INTERVAL = Math.round(5 * TPS);
const SNAKE_FIELD_ASTEROID_CAP = 7;
const SNAKE_FIELD_MEDIUM_CAP = 3;
/** Spinner: 2-way radial burst (180°); shoot angle advances `spin` degrees after each volley. */
const ENEMY_SPINNER = {
  ammo: 25,
  cooldown: 7,
  reload: Math.round(5 * TPS),
  spin: 26,
  speed: ENEMY_COMMON_BULLET_SPEED,
  dmg: 12
};
/** World-2 special: 4 level-0 lasers, full spin every 10s, 7s fire / 12s reload. */
const ENEMY_LASER_SPIN = {
  streams: 4,
  /** Degrees advanced per sim tick (360° / 10s). */
  spinDeg: 360 / (10 * TPS),
  ammo: Math.round(7 * TPS),
  cooldown: 1,
  reload: Math.round(12 * TPS),
  dmg: 7,
  range: Math.hypot(W, H)
};
/** commonRail: chase like common1 at 85% speed; player-style rail every 4s. */
const ENEMY_COMMON_RAIL_SPEED_MUL = 0.85;
const ENEMY_COMMON_RAIL_RELOAD = Math.round(4 * TPS);
const ENEMY_COMMON_RAIL_DMG = 60;
const ENEMY_COMMON_RAIL_CHARGE = Math.round(0.5 * TPS);
/** World-2 special: bouncing fuchsia rail every 8s (6 edge bounces). */
const ENEMY_RAIL_BOUNCE_RELOAD = Math.round(8 * TPS);
const ENEMY_RAIL_BOUNCE_COUNT = 6;
const ENEMY_RAIL_BOUNCE_CHARGE = Math.round(0.5 * TPS);
const ENEMY_RAIL_COL_YELLOW = [1.0, 0.92, 0.15];
const ENEMY_RAIL_COL_FUCHSIA = [1.0, 0.2, 0.85];
const ENEMY_CARRIER_WEAPONS = ['laser', 'plasma', 'rail'];
const ENEMY_LASER_AIM_DELAY = 12; // frames
const ENEMY_RAIL_CHARGE = Math.round(1.5 * TPS);
const ENEMY_RAIL_DMG = 80;
const ENEMY_PLASMA_RANGE = 240 * RES_SCALE;
/** Worm laser aim telegraph before the beam opens. */
const ENEMY_WORM_AIM_TICKS = Math.round(3 * TPS);
/** Max turn toward player while worm is stopped for its laser attack. */
const ENEMY_WORM_AIM_TURN = (1.1 * Math.PI) / 180;
/** Worm vs asteroid crush check interval. */
const ENEMY_WORM_AST_CHECK = Math.round(0.2 * TPS);
/**
 * Worm super-laser. Width is 3× typical player laser draw width
 * (~4×RES_SCALE mid of the 2..6 flicker band).
 * Player laser L2+ uses the same width.
 */
const ENEMY_WORM_LASER = {
  ammo: 230,
  cooldown: 1,
  reload: Math.round(1 * TPS),
  range: Math.hypot(W, H),
  dmg: 3,
  width: 12 * RES_SCALE
};
/**
 * Worm rocket barrage — shotgun-style, full 360° per volley (ammo×shotgun = 6).
 * Speed/accel/homing are literal px/tick (not RES_SCALE).
 * Direct-hit only (no blast radius).
 */
const ENEMY_ROCKET_HP = 20;
const ENEMY_WORM_ROCKET = {
  ammo: 2,
  shotgun: 3,
  spread: 360,
  cooldown: Math.round(0.5 * TPS),
  reload: Math.round(1 * TPS),
  speed: 2.52,
  maxSpeed: 5.88,
  accel: 0.3,
  homing: 2,
  lifeMinS: 6,
  lifeMaxS: 14,
  hp: ENEMY_ROCKET_HP,
  dmg: 30
};
/** Gunship (craft 224) — 3 rotating attacks (spray / voids / magnet). */
const ENEMY_GUNSHIP_SPRAY = {
  ammo: 80,
  cooldown: 1,
  sideCooldown: 4,
  reload: Math.round(1 * TPS),
  kickDeg: 15,
  spdMin: 4,
  spdMax: 7,
  sizeMin: 3,
  sizeMax: 7,
  dmg: 14
};
/** Magnet duration (asteroids + VFX + player lenDir pull). */
const ENEMY_GUNSHIP_MAGNET_TICKS = Math.round(10 * TPS);
/** Player magnet: pullPower grows by this much each tick (lenDir toward gunship). */
const ENEMY_GUNSHIP_MAGNET_PULL_GROW = 0.001;
/** Off-screen small asteroid during magnet. */
const ENEMY_GUNSHIP_MAGNET_AST_EVERY = Math.round(0.5 * TPS);
/** Asteroid magnet: constant accel toward gunship (set once; NTP simulates). */
const ENEMY_GUNSHIP_MAGNET_AST_ACCEL = 0.2;
/** Void attack: 3 stop-and-shoot volleys with a random cruise between them. */
const ENEMY_GUNSHIP_VOID_VOLLEYS = 3;
const ENEMY_GUNSHIP_VOID_CRUISE_MIN = Math.round(1 * TPS);
const ENEMY_GUNSHIP_VOID_CRUISE_MAX = Math.round(4 * TPS);
/** Pause after the last void volley before next attack cycle. */
const ENEMY_GUNSHIP_VOID_RELOAD = Math.round(1.25 * TPS);

/** common1 move speed: worm-rocket maxSpeed −20%, then −10%, then −15% (±10% rolled per ship). */
const ENEMY_COMMON1_SPEED = ENEMY_WORM_ROCKET.maxSpeed * 0.8 * 0.9 * 0.85;
const ENEMY_COMMON1_SPEED_JITTER = 0.1;
/** common1 turn: worm-rocket homing +30% (°/tick). */
const ENEMY_COMMON1_HOMING = ENEMY_WORM_ROCKET.homing * 1.3;
/** Snake: 25% slower than common1, 50% slower turn. */
const ENEMY_SNAKE_SPEED = ENEMY_COMMON1_SPEED * 0.75;
const ENEMY_SNAKE_HOMING = ENEMY_COMMON1_HOMING * 0.5;
/**
 * Worm 3rd attack — 360° line-shotgun. Per pellet: random L/W and speed.
 * Speeds are literal px/tick (same units as worm rockets).
 */
const ENEMY_WORM_SHOTGUN = {
  ammo: 5,
  shotgun: 8,
  spread: 360,
  cooldown: 40,
  reload: Math.round(1 * TPS),
  spdMin: 1.75,
  spdMax: 3.25,
  sizeMin: 3.5,
  sizeMax: 15,
  dmg: 18
};
/** Player rocket: launch at 0, then accel up to WEAPONS.rocket.speed. */
const ROCKET_LAUNCH_SPEED = 0;
/** Player rocket hull HP — depleted by hitscans / bullets before detonate. */
const ROCKET_HP_DEFAULT = 180;
/** Player rocket base accel (px/tick along flight axis) while |speed| < boost threshold. */
const ROCKET_ACCEL_DEFAULT = 0.5;
/** Above this signed speed, player rocket accel is multiplied. */
const ROCKET_ACCEL_BOOST_SPEED = 3;
const ROCKET_ACCEL_BOOST_MULT = 3;
/** Default rocket homing turn (degrees/tick). 0 = disabled. */
const ROCKET_HOMING_DEFAULT = 0;
/** How often accel/homing rockets resync pose to clients. */
const ROCKET_NET_INTERVAL = 5;
/** Carrier laser — keep old dump/dmg (player laser stats may differ). */
const ENEMY_LASER = {
  ammo: 30,
  cooldown: WEAPONS.laser.cooldown,
  reload: 90,
  range: WEAPONS.laser.range || Math.hypot(W, H),
  dmg: 7
};
const ENEMY_PLASMA = {
  ammo: WEAPONS.plasma.ammo,
  cooldown: WEAPONS.plasma.cooldown,
  reload: WEAPONS.plasma.reload,
  speed: WEAPONS.plasma.speed,
  dmg: BULLET_TYPES.plasma.dmg
};
/** Visual / collision radius by tier (+35% on top of prior big/medium bump). */
const ASTEROID_R = {
  big: 26 * RES_SCALE * 1.3 * 1.35,
  medium: 15 * RES_SCALE * 1.3 * 1.35,
  small: 9 * RES_SCALE * 1.35
};
/** Collision shape is this fraction of visual radius / polygon (visual unchanged). */
const ASTEROID_HIT_SCALE = 0.9;
const PICKUP_R = 7 * RES_SCALE;
const PICKUP_DROP_CHANCE = 0.2;
/** Weapon crates bounce this many times, then drift off-screen and despawn.
 *  Health pickups bounce forever. */
const PICKUP_BOUNCE_MAX = 3;
/** Heal amount from health pickups (HP capped at MAX_HP). */
const HEALTH_PICKUP_HEAL = 30;
/** Shop vital: fixing drone — regen while alive; lost on death. */
const FIXING_DRONE_COST = 1200;
const FIXING_DRONE_HEAL_PER_SEC = 2;
/** Pickup type codes in network packs: 1+ weapons by slot, 99 health. */
const PICKUP_CODE_HEALTH = 99;
const ASTEROID_HP = 50;
/** Coins granted to the destroyer when a world asteroid is killed. */
const ASTEROID_COIN_GRANT = 40;
/** Coins granted for destroying UFO / spinner. */
const ENEMY_ELITE_COIN_GRANT = 500;
/** Coins granted for destroying the worm boss. */
const ENEMY_WORM_COIN_GRANT = 1000;
/** Visual 3D ore coins spawned on elite/worm kill (homing to the killer). */
const ENEMY_ELITE_COIN_VISUAL = 150;
const ENEMY_WORM_COIN_VISUAL = 200;
/** Chance a non-start spawn (replacement big / split shard) is a special type. */
const SPECIAL_ASTEROID_CHANCE = 0.1;
const SPECIAL_ASTEROID_KINDS = ['meteor', 'golden'];
/** Golden special rocks — tanky ore; coins drip on each damaging hit. */
const GOLDEN_ASTEROID_HP = 400;
/** Coins per point of HP damage dealt to a golden asteroid. */
const GOLDEN_ASTEROID_COIN_PER_DMG = 0.75;
/** Base random speed spread used by normal asteroids (±half of this per axis). */
const ASTEROID_SPEED_SPREAD = 2.4 * RES_SCALE;
/** Normal speed magnitude band (px/tick). Min matches offscreen inward floor. */
const ASTEROID_SPEED_MIN = 0.45 * RES_SCALE;
const ASTEROID_SPEED_MAX = (ASTEROID_SPEED_SPREAD * 0.5) * Math.SQRT2;
/** Max |v| for big world rocks (meteor specials exempt). px/tick. */
const BIG_ASTEROID_MAX_SPEED = 1;
/** Cull inbound rocks that never reach the playfield (soft-lock guard). */
const ASTEROID_INBOUND_STUCK_MS = 20000;
/** World asteroid lifetime from create moment (replaces edge-teleport counts). */
const ASTEROID_LIFE_MS = 20000;
/** Rail damage vs players/enemies when an asteroid is closer on the beam. */
const RAIL_THROUGH_ASTEROID_MULT = 0.2;
/** Laser / railgun only — enlarge NPC enemy hitboxes for player raycasts. */
const PLAYER_RAY_ENEMY_HIT_SCALE = 1.25;
/** Network special codes: 0 normal, 1 meteor, 2 golden (3 legacy — ignored). */
function specialAsteroidCode(a) {
  if (a.special === 'meteor') return 1;
  if (a.special === 'golden') return 2;
  return 0;
}
function specialAsteroidFromCode(code) {
  if (code === 1) return 'meteor';
  if (code === 2) return 'golden';
  return null;
}
/** Keep this many ticks of poses for lag compensation (~1s). */
const POSE_HISTORY_TICKS = 30;
/** Max rewind for lag comp (ticks). */
const LAGCOMP_MAX_TICKS = 12;
/** Binary snapshot message type byte. */
const BIN_SNAP = 1;
/** First player to this many round wins ends the match. */
const SCORE_TO_WIN = 10;

let nextPlayerId = 1;
let nextRoomId = 1;
let nextAsteroidId = 1;
const rooms = new Map();
/** @type {import('ws').WebSocket[]} */
const matchQueue = [];
const coopQueue = [];
/** Coop campaign matchmaking (separate from wave coop). */
const campaignCoopQueue = [];

/** Campaign star map + hyperspace jump. */
const CAMPAIGN_STAR_COUNT = 64;
const CAMPAIGN_STAR_PATH_COUNT = 10;
const CAMPAIGN_STAR_PATH_STEP = 60 * RES_SCALE;
const CAMPAIGN_STAR_BRANCH_R = 75 * RES_SCALE;
/** Special roll: 5% normal, 9% inside this radius of top-left or bottom-right. */
const CAMPAIGN_STAR_SPECIAL_CORNER_R = 124 * RES_SCALE;
/** Minimum spacing between any two map stars (design px × RES_SCALE). */
const CAMPAIGN_STAR_MIN_DIST = 21 * RES_SCALE;
const CAMPAIGN_JUMP_ACCEL = 0.4 * RES_SCALE;
/** Enter pulse charge time when the stage still has threats. */
const CAMPAIGN_JUMP_CHARGE_TICKS = 5 * TPS;
/** Pick radius on the star map (world units ≈ design px × RES_SCALE). */
const CAMPAIGN_STAR_PICK_R = 70 * RES_SCALE;
/** Expanding zone from world bottom-left after each star jump. */
const CAMPAIGN_ZONE_ORIGIN_X = 0;
const CAMPAIGN_ZONE_ORIGIN_Y = H;
const CAMPAIGN_ZONE_BASE_R = 70 * RES_SCALE;
const CAMPAIGN_ZONE_GROW = 20 * RES_SCALE;
/** Star-map travels available at campaign start. */
const CAMPAIGN_JUMP_FUEL_START = 10;

function campaignZoneRadius(jumpCount) {
  const n = jumpCount | 0;
  if (n < 1) return 0;
  return CAMPAIGN_ZONE_BASE_R + (n - 1) * CAMPAIGN_ZONE_GROW;
}
