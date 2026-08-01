/** @file server/constants.js — loaded into shared server scope (do not require() alone). */
const PORT = Number(process.env.PORT) || 8765;
const HOST = process.env.HOST || '0.0.0.0';
const RES_SCALE = 2;
const W = 420 * RES_SCALE, H = 240 * RES_SCALE;
const TPS = 30;
const TICK_MS = 1000 / TPS;
/** Max WebSocket JSON messages accepted per second (token bucket refill). */
const RATE_MSG_PER_SEC = 100;
const RATE_MSG_BURST = 40;
/** Max input frames accepted per second (~2× TPS). */
const RATE_INPUT_FRAMES_PER_SEC = TPS * 2;
const RATE_INPUT_FRAMES_BURST = TPS;
/**
 * Hard cap on per-player input backlog. Server applies 1 frame/tick; a deep
 * queue is sticky shoot/move lag until refresh. Keep this small so overflow
 * self-heals by dropping oldest frames (prefer fresh input over delayed shots).
 */
const MAX_INPUT_QUEUE = 8;
/** Shed mild overproduce before hitting the hard cap (~200ms at 30Hz). */
const SOFT_INPUT_QUEUE = 6;
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
const WEAPON_MAX_LEVEL = 3;
const WEAPONS = {
  default: { ammo: 3, cooldown: 2, reload: 32, speed: 13.5 },
  rocket: { ammo: 1, cooldown: 3, reload: 45, speed: 15 },
  laser: { ammo: 45, cooldown: 1, reload: 40, range: Math.hypot(W, H) },
  shotgun: {
    ammo: 2,
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
const PLAYER_SHOT_BOUNCE_DMG = 30;
/** Meteor Gun L3: bounce damage vs world rocks (applied after velocity bounce). */
const PLAYER_SHOT_BOUNCE_DMG_L3 = PLAYER_SHOT_BOUNCE_DMG * 2;
/** Meteor Gun rock vs player — flat damage (same crash/stun path as world rocks). */
const PLAYER_SHOT_HIT_DMG = 70;
/** Meteor Gun L3: damage vs players. */
const PLAYER_SHOT_HIT_DMG_L3 = PLAYER_SHOT_HIT_DMG * 2;
/** Meteor Gun rock vs solo enemies — flat damage, no stun / no knockback. */
const PLAYER_SHOT_ENEMY_DMG = 100;
/** Hitting a player rocket damages hull and randomizes its heading if it survives. */
const ROCKET_DEFLECT_RAD = 10 * Math.PI / 180;
/** Player rocket explosion blast (world px). Falloff maxDmg → 0 by surface distance. */
const ROCKET_BLAST_RADIUS = 32 * RES_SCALE;
/** Enough to one-shot common enemies (95 HP) even on a grazing contact detonation. */
const ROCKET_BLAST_DMG = 125;
const BULLET_TYPES = {
  default: { dmg: 35, col: 'circle', size: 2 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  /** Direct dmg unused — rockets only deal ROCKET_BLAST_* circle damage on detonate. */
  rocket: { dmg: 0, col: 'circle', size: 7 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  laser: { dmg: 2.5, col: 'ray', size: 0, scaleY: 1, length: 0, width: 2 * RES_SCALE },
  shotgun: { dmg: 10, col: 'circle', size: 2 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
  railgun: { dmg: 80, col: 'ray', size: 0, scaleY: 1, length: 0, width: 3 * RES_SCALE },
  /** Engine exhaust hit — fired while thrusting (ex-melee). */
  thrust: { dmg: 25, col: 'ray', size: 0, scaleY: 1, length: 0, width: 3 * RES_SCALE },
  plasma: { dmg: 6, col: 'circle', size: 5 * RES_SCALE, scaleY: 1, length: 5 * RES_SCALE, width: 2.5 * RES_SCALE },
  voidcannon: { dmg: 5, col: 'circle', size: 27 * RES_SCALE, scaleY: 1, length: 0, width: 0 },
  turret: { dmg: 10, col: 'circle', size: 2 * RES_SCALE, scaleY: 1, length: 4 * RES_SCALE, width: 2 * RES_SCALE },
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

function freshWeaponLevels() {
  return {
    default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1,
    plasma: 1, voidcannon: 1, asteroidgun: 1
  };
}

function getWeaponLevel(p, name) {
  const n = name || p.weapon;
  const levels = p.weaponLevels || freshWeaponLevels();
  return Math.max(1, Math.min(WEAPON_MAX_LEVEL, levels[n] | 0 || 1));
}

/** Stats for a weapon at the player's upgrade level. */
function effectiveWeapon(p, name) {
  const n = name || p.weapon;
  const base = WEAPONS[n] || WEAPONS.default;
  const lvl = getWeaponLevel(p, n);
  const w = Object.assign({}, base);
  if (base.shotgunSpeeds) w.shotgunSpeeds = base.shotgunSpeeds.slice();
  if (n === 'default') {
    // L2 = 2× bullet hit/visual size (set on fire). L3 = +1 ammo.
    if (lvl >= 3) w.ammo += 1;
  } else if (n === 'rocket') {
    // L2 = faster reload. L3 = launch speed 10 (see fireProjectile).
    if (lvl >= 2) w.reload = Math.max(1, Math.round(base.reload * 0.7));
    if (lvl >= 3) w.launchSpeed = 10;
  } else if (n === 'shotgun') {
    if (lvl >= 2) w.ammo += 1;
    if (lvl >= 3) w.shotgun = (base.shotgun | 0) + 2;
  } else if (n === 'laser') {
    if (lvl >= 3) w.ammo = Math.round(base.ammo * 1.25);
  } else if (n === 'plasma') {
    // L2 = 7.5 dmg (effectiveBulletDmg). L3 = 60 ammo.
    if (lvl >= 3) w.ammo = 60;
  } else if (n === 'asteroidgun') {
    // L2 = 10% faster reload. L3 = 2× hit/bounce dmg (set on fire).
    if (lvl >= 2) w.reload = Math.max(1, Math.round(base.reload * 0.9));
  } else if (n === 'voidcannon') {
    // L2 = 10% faster reload. L3 = 30% bigger orb (set on fire + client tint).
    if (lvl >= 2) w.reload = Math.max(1, Math.round(base.reload * 0.9));
  } else if (n === 'railgun') {
    // L2 = edge bounce (handled in fireRailgun). L3 = 30% faster shot cooldown.
    if (lvl >= 3) w.cooldown = Math.max(1, Math.round(base.cooldown * 0.7));
  }
  return w;
}

function effectiveBulletDmg(p, typeName) {
  if (typeName === 'turret' && p && p.admingun) return ADMINGUN_TURRET_DMG;
  const cfg = BULLET_TYPES[typeName] || BULLET_TYPES.default;
  let dmg = cfg.dmg;
  if (typeName === 'laser' && getWeaponLevel(p, 'laser') >= 2) dmg *= 1.2;
  if (typeName === 'plasma' && getWeaponLevel(p, 'plasma') >= 2) dmg = 7.5;
  if (p && p.powerups && p.powerups.damage) dmg *= DAMAGE_POWERUP_MULT;
  return dmg;
}

function freshPowerups() {
  return {
    damage: false,
    turret: false,
    shield: false,
    homing: false,
    reload: false
  };
}

/** Magazine / turret reload ticks; reload powerup = 50% shorter. */
function effectiveReloadTicks(p, baseReload) {
  let r = Math.max(1, baseReload | 0);
  if (playerHasPowerup(p, 'reload')) r = Math.max(1, Math.round(r * 0.5));
  return r;
}

function playerHasPowerup(p, name) {
  return !!(p && p.powerups && p.powerups[name]);
}

function turretMaxAmmo(p) {
  return (p && p.admingun) ? ADMINGUN_TURRET_AMMO : TURRET_AMMO;
}

function turretCooldownFor(p) {
  return (p && p.admingun) ? ADMINGUN_TURRET_COOLDOWN : TURRET_COOLDOWN;
}

function turretReloadTicksFor(p) {
  if (p && p.admingun) return ADMINGUN_TURRET_RELOAD;
  return effectiveReloadTicks(p, TURRET_RELOAD);
}

function notifyPowerups(room, p) {
  roomBroadcast(room, {
    t: 'pwr',
    id: p.id,
    powerups: Object.assign({}, p.powerups || freshPowerups())
  });
}

/** Absorb one hit if shield powerup is active. Returns true if damage was blocked. */
function consumeShield(room, p) {
  if (!playerHasPowerup(p, 'shield')) return false;
  p.powerups.shield = false;
  notifyPowerups(room, p);
  return true;
}

/** Stamp PvP frag credit (last player who damaged this ship). */
function notePlayerAttacker(victim, attackerId) {
  const aid = attackerId | 0;
  if (!victim || aid <= 0 || aid === (victim.id | 0)) return;
  victim.lastHitBy = aid;
}

/** Apply HP damage; shield consumes instead. Returns true if HP was reduced.
 *  `attackerId` (optional) — player who dealt this hit; credited if it kills. */
function dealDamageToPlayer(room, p, dmg, attackerId) {
  if (!p || p.hp <= 0 || p.godLeft > 0) return false;
  if (consumeShield(room, p)) return false;
  notePlayerAttacker(p, attackerId);
  p.hp -= dmg;
  if (p.hp <= 0) handlePlayerDeath(room, p);
  return true;
}

function resetTurretState(p) {
  p.turretAmmo = turretMaxAmmo(p);
  p.turretCd = 0;
  p.turretReload = 0;
  p.turretRetry = 0;
}

const THRUST = 0.09 * RES_SCALE * 1.15 * 1.2 * 1.2 * 0.85;  // prior buffs, then −15%
const MAX_SPEED = 8 * RES_SCALE * 0.8 * 0.75 * 0.75;   // −25%, then −25% again
/** Above MAX_SPEED: shed this much speed per second (no hard clip). */
const OVERSPEED_DECEL = 4;
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
const BIG_SPAWN_DELAY_TICKS = Math.round(7 * TPS);
/** Brief pause after clearing a solo wave before the next spawn. */
const SOLO_WAVE_CLEAR_TICKS = Math.round(1.4 * TPS);
/** Solo enemy line-bullet speed = player default base (15) × 0.7 — not linked to tuned player speed. */
const ENEMY_BULLET_SPEED = 15 * 0.7;
/** UFO micro-rocket: 15% slower than common enemy bullet speed. */
const ENEMY_UFO_ROCKET_SPEED = ENEMY_BULLET_SPEED * 0.85;
/** Common enemy spread shots: half that speed, 45 damage. */
const ENEMY_COMMON_BULLET_SPEED = ENEMY_BULLET_SPEED * 0.5;
const ENEMY_COMMON_BULLET_DMG = 45;
const ENEMY_COMMON_RELOAD = Math.round(2.5 * TPS);
/** Pre-shot telegraph length for commons (client charge spheres). */
const ENEMY_COMMON_CHARGE = TPS;
const ENEMY_UFO_RELOAD = Math.round(3.5 * TPS);
/** UFO turret pre-shot telegraph (red charge sphere). */
const ENEMY_UFO_CHARGE = Math.round(0.5 * TPS);
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
  ufo: 9 * RES_SCALE,
  carrier: 12 * RES_SCALE,
  worm: 10 * RES_SCALE,
  spinner: 8 * RES_SCALE
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
  ufo: 300,
  carrier: 90,
  worm: 1000,
  spinner: 320
};
/** Spinner: 2-way radial burst (180°); shoot angle advances `spin` degrees after each volley. */
const ENEMY_SPINNER = {
  ammo: 25,
  cooldown: 7,
  reload: Math.round(5 * TPS),
  spin: 26,
  speed: ENEMY_COMMON_BULLET_SPEED,
  dmg: 12
};
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
/** Huge specials are 2× big. */
ASTEROID_R.huge = ASTEROID_R.big * 2;
/** Collision shape is this fraction of visual radius / polygon (visual unchanged). */
const ASTEROID_HIT_SCALE = 0.9;
const PICKUP_R = 7 * RES_SCALE;
const PICKUP_DROP_CHANCE = 0.2;
/** Powerup crates bounce this many times, then drift off-screen and despawn.
 *  Applies to weapons / powerups — health pickups bounce forever. */
const PICKUP_BOUNCE_MAX = 3;
/** Heal amount from health pickups (HP capped at MAX_HP). */
const HEALTH_PICKUP_HEAL = 30;
/** Pickup type codes in network packs: 1+ weapons by slot, 99 health, 100+ powerups.
 *  Pickups = collectible items (weapon or health). Powerups are slotted buffs (one each). */
const PICKUP_CODE_HEALTH = 99;
const POWERUP_TYPES = ['damage', 'turret', 'shield', 'homing', 'reload'];
const PICKUP_CODE_POWERUP_BASE = 100;
/** Turret auto-gun (mounted powerup). */
const TURRET_AMMO = 3;
const TURRET_COOLDOWN = 2;
const TURRET_RELOAD = 60;
const TURRET_RETRY = 10;
const TURRET_SPEED = 8 * RES_SCALE;
const TURRET_MUZZLE = 12 * RES_SCALE;
/** Admin `give admingun` — buffed turret (100 ammo, 1 tick cooldown, 1s reload, 100 dmg). */
const ADMINGUN_TURRET_AMMO = 100;
const ADMINGUN_TURRET_COOLDOWN = 1;
const ADMINGUN_TURRET_RELOAD = TPS;
const ADMINGUN_TURRET_DMG = 100;
const DAMAGE_POWERUP_MULT = 1.25;
/** Homing powerup: max turn toward target per sim tick (0.2°). */
const HOMING_TURN_RAD = (0.2 * Math.PI) / 180;
const HOMING_BULLET_TYPES = new Set(['default', 'shotgun', 'plasma', 'rocket', 'voidcannon', 'turret']);
const ASTEROID_HP = 50;
/** Coins granted to the destroyer when a world asteroid is killed. */
const ASTEROID_COIN_GRANT = 32;
/** Chance a non-start spawn (replacement big / split shard) is a special type. */
const SPECIAL_ASTEROID_CHANCE = 0.1;
const SPECIAL_ASTEROID_KINDS = ['meteor', 'golden'];
/** Extra specials only for wave / match-start rocks (not replacement bigs or shards). */
const SPECIAL_ASTEROID_KINDS_START = ['meteor', 'golden', 'huge'];
/** Golden special rocks — tanky ore; coins drip on each damaging hit. */
const GOLDEN_ASTEROID_HP = 400;
/** Coins per point of HP damage dealt to a golden asteroid. */
const GOLDEN_ASTEROID_COIN_PER_DMG = 0.4;
/** Huge special rocks — slow, massive, split into many mediums. */
const HUGE_ASTEROID_HP = 600;
/** Base random speed spread used by normal asteroids (±half of this per axis). */
const ASTEROID_SPEED_SPREAD = 2.4 * RES_SCALE;
/** Normal speed magnitude band (px/tick). Min matches offscreen inward floor. */
const ASTEROID_SPEED_MIN = 0.45 * RES_SCALE;
const ASTEROID_SPEED_MAX = (ASTEROID_SPEED_SPREAD * 0.5) * Math.SQRT2;
/** Cull inbound rocks that never reach the playfield (soft-lock guard). */
const ASTEROID_INBOUND_STUCK_MS = 20000;
/** World asteroid lifetime from create moment (replaces edge-teleport counts). */
const ASTEROID_LIFE_MS = 20000;
/** Rail damage vs players/enemies when an asteroid is closer on the beam. */
const RAIL_THROUGH_ASTEROID_MULT = 0.2;
/** Network special codes: 0 normal, 1 meteor, 2 golden, 3 huge. */
function specialAsteroidCode(a) {
  if (a.special === 'meteor') return 1;
  if (a.special === 'golden') return 2;
  if (a.special === 'huge') return 3;
  return 0;
}
function specialAsteroidFromCode(code) {
  if (code === 1) return 'meteor';
  if (code === 2) return 'golden';
  if (code === 3) return 'huge';
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
