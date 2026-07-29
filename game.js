const RES_SCALE = 2;
const W = 420 * RES_SCALE, H = 240 * RES_SCALE;
const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const scoreHudEl = document.getElementById('score-hud');
const scoreMeEl = document.getElementById('score-me');
const scoreFoeEl = document.getElementById('score-foe');
const scoreLimitEl = document.getElementById('score-limit');
/** First-to-N round wins (server authoritative; welcome/over may override). */
let scoreToWin = 10;
/** id -> callsign */
const rosterNames = new Map();
const matchIntroEl = document.getElementById('match-intro');
const scoreBoardEl = document.getElementById('score-board');
const introMeEl = document.getElementById('intro-me');
const introFoeEl = document.getElementById('intro-foe');
const introLuckEl = document.getElementById('intro-luck');
const introSubEl = document.getElementById('intro-sub');
const sbTagEl = document.getElementById('sb-tag');
const sbMeNameEl = document.getElementById('sb-me-name');
const sbFoeNameEl = document.getElementById('sb-foe-name');
const sbMeScoreEl = document.getElementById('sb-me-score');
const sbFoeScoreEl = document.getElementById('sb-foe-score');
const sbMeDeltaEl = document.getElementById('sb-me-delta');
const sbFoeDeltaEl = document.getElementById('sb-foe-delta');
const sbLimitEl = document.getElementById('sb-limit');
const sbHeadlineEl = document.getElementById('sb-headline');
const sbFinalNoteEl = document.getElementById('sb-final-note');
const bcastFxCanvas = document.getElementById('bcast-fx');
const bcastFxCtx = bcastFxCanvas ? bcastFxCanvas.getContext('2d') : null;
let introHideTimer = 0;
let scoreBoardHideTimer = 0;
/** Real match: false until server `go` after both players ready. Practice stays true. */
let matchLive = true;
let matchReadySent = false;

/** Overlay confetti / spark particles for score + win screens. */
const bcastFx = {
  parts: [],
  raf: 0,
  mode: null, // 'score' | 'win' | 'lose'
  spawnAcc: 0,
  burstLeft: 0
};

function resizeBcastFx() {
  if (!bcastFxCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  bcastFxCanvas.width = Math.max(1, (w * dpr) | 0);
  bcastFxCanvas.height = Math.max(1, (h * dpr) | 0);
  bcastFxCanvas.style.width = w + 'px';
  bcastFxCanvas.style.height = h + 'px';
  if (bcastFxCtx) bcastFxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pushBcastPart(p) {
  if (bcastFx.parts.length > 420) bcastFx.parts.shift();
  bcastFx.parts.push(p);
}

function spawnBcastBurst(cx, cy, color, count, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.35 + Math.random()) * power;
    pushBcastPart({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 24,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - power * 0.35,
      life: 0.55 + Math.random() * 0.7,
      age: 0,
      size: 2 + Math.random() * 4,
      color,
      grav: 280 + Math.random() * 120,
      spin: (Math.random() - 0.5) * 10,
      ang: Math.random() * Math.PI * 2,
      kind: Math.random() < 0.35 ? 'star' : 'dot'
    });
  }
}

function spawnBcastConfetti(color, count) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const fromSide = Math.random() < 0.25;
    const x = fromSide
      ? (Math.random() < 0.5 ? -10 : w + 10)
      : Math.random() * w;
    const y = fromSide ? Math.random() * h * 0.6 : -20 - Math.random() * 80;
    pushBcastPart({
      x, y,
      vx: (Math.random() - 0.5) * 180 + (fromSide ? (x < 0 ? 120 : -120) : 0),
      vy: 80 + Math.random() * 220,
      life: 1.8 + Math.random() * 1.6,
      age: 0,
      size: 3 + Math.random() * 6,
      color,
      grav: 40 + Math.random() * 60,
      spin: (Math.random() - 0.5) * 14,
      ang: Math.random() * Math.PI * 2,
      kind: Math.random() < 0.45 ? 'rect' : (Math.random() < 0.5 ? 'star' : 'dot')
    });
  }
}

function spawnBcastFountain(color) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w * 0.5 + (Math.random() - 0.5) * w * 0.35;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const sp = 320 + Math.random() * 420;
    pushBcastPart({
      x: cx + (Math.random() - 0.5) * 30,
      y: h + 8,
      vx: Math.cos(a) * sp * 0.35,
      vy: Math.sin(a) * sp,
      life: 1.2 + Math.random() * 0.9,
      age: 0,
      size: 2.5 + Math.random() * 4,
      color,
      grav: 520,
      spin: (Math.random() - 0.5) * 8,
      ang: Math.random() * Math.PI * 2,
      kind: Math.random() < 0.3 ? 'star' : 'dot'
    });
  }
}

function drawBcastPart(ctx, p, alpha) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.ang);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  const s = p.size;
  if (p.kind === 'rect') {
    ctx.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
  } else if (p.kind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.4;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function tickBcastFx(now) {
  if (!bcastFxCtx || !bcastFxCanvas) {
    bcastFx.raf = 0;
    return;
  }
  if (!bcastFx._last) bcastFx._last = now;
  let dt = (now - bcastFx._last) / 1000;
  bcastFx._last = now;
  if (dt > 0.05) dt = 0.05;

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (bcastFx.mode === 'win') {
    bcastFx.spawnAcc += dt;
    if (bcastFx.spawnAcc > 0.08) {
      bcastFx.spawnAcc = 0;
      const palette = ['#ffe27a', '#6ec8ff', '#ffffff', '#7dffb0', '#ff9a4a'];
      spawnBcastConfetti(palette[(Math.random() * palette.length) | 0], 4);
      if (Math.random() < 0.45) spawnBcastFountain(palette[(Math.random() * palette.length) | 0]);
    }
    bcastFx.burstLeft -= dt;
    if (bcastFx.burstLeft <= 0) {
      bcastFx.burstLeft = 0.55 + Math.random() * 0.45;
      spawnBcastBurst(w * 0.5, h * 0.42, '#ffe27a', 28, 420);
      spawnBcastBurst(w * 0.28, h * 0.55, '#6ec8ff', 18, 320);
      spawnBcastBurst(w * 0.72, h * 0.55, '#7dffb0', 18, 320);
    }
  } else if (bcastFx.mode === 'score') {
    bcastFx.spawnAcc += dt;
    if (bcastFx.spawnAcc > 0.12 && bcastFx.burstLeft > 0) {
      bcastFx.spawnAcc = 0;
      spawnBcastConfetti(bcastFx.color || '#ffe27a', 2);
    }
    bcastFx.burstLeft -= dt;
    if (bcastFx.burstLeft < 0) bcastFx.burstLeft = 0;
  } else if (bcastFx.mode === 'lose') {
    bcastFx.spawnAcc += dt;
    if (bcastFx.spawnAcc > 0.2) {
      bcastFx.spawnAcc = 0;
      pushBcastPart({
        x: Math.random() * w,
        y: -10,
        vx: (Math.random() - 0.5) * 40,
        vy: 40 + Math.random() * 70,
        life: 2 + Math.random(),
        age: 0,
        size: 1.5 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#ff5a6e' : '#6a5058',
        grav: 30,
        spin: (Math.random() - 0.5) * 4,
        ang: 0,
        kind: 'dot'
      });
    }
  }

  bcastFxCtx.clearRect(0, 0, w, h);
  for (let i = bcastFx.parts.length - 1; i >= 0; i--) {
    const p = bcastFx.parts[i];
    p.age += dt;
    if (p.age >= p.life) {
      bcastFx.parts.splice(i, 1);
      continue;
    }
    p.vy += p.grav * dt;
    p.vx *= 0.995;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ang += p.spin * dt;
    const t = p.age / p.life;
    const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    drawBcastPart(bcastFxCtx, p, Math.max(0, alpha));
  }

  if (bcastFx.mode || bcastFx.parts.length) {
    bcastFx.raf = requestAnimationFrame(tickBcastFx);
  } else {
    bcastFx.raf = 0;
    bcastFx._last = 0;
  }
}

function stopBcastFx() {
  bcastFx.mode = null;
  bcastFx.parts.length = 0;
  bcastFx.spawnAcc = 0;
  bcastFx.burstLeft = 0;
  bcastFx._last = 0;
  if (bcastFx.raf) {
    cancelAnimationFrame(bcastFx.raf);
    bcastFx.raf = 0;
  }
  if (bcastFxCtx && bcastFxCanvas) {
    bcastFxCtx.setTransform(1, 0, 0, 1, 0, 0);
    bcastFxCtx.clearRect(0, 0, bcastFxCanvas.width, bcastFxCanvas.height);
  }
  if (scoreBoardEl) scoreBoardEl.classList.remove('epic-win');
}

function startBcastFx(mode, color) {
  stopBcastFx();
  resizeBcastFx();
  bcastFx.mode = mode;
  bcastFx.color = color || '#ffe27a';
  bcastFx.spawnAcc = 0;
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (mode === 'win') {
    if (scoreBoardEl) scoreBoardEl.classList.add('epic-win');
    spawnBcastBurst(w * 0.5, h * 0.4, '#ffe27a', 48, 520);
    spawnBcastBurst(w * 0.5, h * 0.4, '#6ec8ff', 36, 440);
    spawnBcastBurst(w * 0.5, h * 0.4, '#ffffff', 24, 380);
    spawnBcastConfetti('#ffe27a', 40);
    spawnBcastConfetti('#6ec8ff', 30);
    spawnBcastConfetti('#7dffb0', 20);
    bcastFx.burstLeft = 0.35;
  } else if (mode === 'score') {
    const side = color === '#ff5a6e' ? 0.72 : 0.28;
    spawnBcastBurst(w * side, h * 0.72, color, 22, 280);
    spawnBcastBurst(w * side, h * 0.72, '#ffffff', 10, 200);
    spawnBcastConfetti(color, 12);
    bcastFx.burstLeft = 1.6;
  } else if (mode === 'lose') {
    bcastFx.burstLeft = 0;
  }

  if (!bcastFx.raf) bcastFx.raf = requestAnimationFrame(tickBcastFx);
}

const gl = canvas.getContext('webgl', { antialias: false, alpha: false });

/** Internal framebuffer scale vs fixed world size (W×H). Physics unchanged. */
const RENDER_SCALE_KEY = 'asteroids_render_scale';
const RENDER_SCALE_OPTS = [
  { scale: 1, label: '840 × 480' },
  { scale: 2, label: '1680 × 960' },
  { scale: 3, label: '2520 × 1440' }
];
let renderScale = 2;
/** 'auto' | 1 | 2 | 3 — auto picks framebuffer from screen size; CSS stays 2×. */
let renderScaleMode = 'auto';
/** Set true when baked grid texture must be rebuilt (size/color/res). */
let gridBakeDirty = true;
function invalidateGridBake() { gridBakeDirty = true; }

function getRenderScale() {
  return renderScale;
}

/** Largest whole-number upscale that fits the window (used for Auto framebuffer). */
function getFitCssScale() {
  return Math.max(1, Math.floor(Math.min(
    window.innerWidth / W,
    window.innerHeight / H
  )));
}

function pickAutoRenderScale() {
  // Prefer matching the fixed 2× display; bump to 3 on large screens, drop to 1 if tiny.
  const fit = getFitCssScale();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (fit >= 3 || (fit >= 2 && dpr >= 2 && window.innerWidth >= W * 3)) return 3;
  if (fit >= 2) return 2;
  return 1;
}

function applyRenderResolution(scale) {
  if (scale === 0 || scale === 'auto' || scale === '0') {
    renderScaleMode = 'auto';
    renderScale = pickAutoRenderScale();
  } else {
    const s = Math.max(1, Math.min(3, scale | 0));
    renderScaleMode = s;
    renderScale = s;
  }
  canvas.width = W * renderScale;
  canvas.height = H * renderScale;
  try {
    localStorage.setItem(
      RENDER_SCALE_KEY,
      renderScaleMode === 'auto' ? 'auto' : String(renderScale)
    );
  } catch (_) {}
  invalidateGridBake();
  syncSettingsResolutionUi();
}

function loadRenderResolution() {
  let mode = 'auto';
  try {
    const raw = localStorage.getItem(RENDER_SCALE_KEY);
    if (raw === '1' || raw === '2' || raw === '3') mode = raw | 0;
    else if (raw === 'auto' || raw === '0') mode = 'auto';
  } catch (_) {}
  applyRenderResolution(mode);
}

function syncSettingsResolutionUi() {
  const sel = document.getElementById('settings-resolution');
  if (!sel) return;
  const v = renderScaleMode === 'auto' ? '0' : String(renderScaleMode);
  if (document.activeElement !== sel) sel.value = v;
  sel.querySelectorAll('option').forEach((opt) => {
    opt.selected = opt.value === v;
  });
}

/** Fixed 2× on-screen size. Independent of internal render resolution. */
function fitCanvasIntegerScale() {
  const scale = 2;
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
  if (renderScaleMode === 'auto') {
    const next = pickAutoRenderScale();
    if (next !== renderScale) {
      renderScale = next;
      canvas.width = W * renderScale;
      canvas.height = H * renderScale;
      syncSettingsResolutionUi();
    }
  }
}
loadRenderResolution();
fitCanvasIntegerScale();

addEventListener('resize', () => {
  fitCanvasIntegerScale();
  if (bcastFx.mode || bcastFx.parts.length) resizeBcastFx();
});

/* ========== SFX ==========
 * HTMLAudio one-shots must use fixed pools — cloneNode leaks elements and
 * Chrome eventually stops playing new media (random missing shoot/impact).
 *  - Unlock autoplay once with a silent data-URI
 *  - One master Audio per file (lazy load / warm)
 *  - One-shots: fixed round-robin pool per URL (never clone)
 *  - Holds (rail/laser/death): one dedicated element per key
 */
const SFX_DEFAULT_POOL = 8;
const SFX_MAX_POOL = 12;
const SFX = {
  railCharge: 'sounds/railCharge.wav',
  railFire: 'sounds/rail3.wav',
  pickup: 'sounds/pickup.wav',
  money: 'sounds/money.wav',
  pickDefault: 'sounds/pickDefault.ogg',
  pickLaser: 'sounds/pickLaser.ogg',
  pickRailgun: 'sounds/pickRailgun.ogg',
  pickShotgun: 'sounds/pickShotgun.ogg',
  shotgun: 'sounds/shootShootgun1.wav',
  shoot: [
    'sounds/shootEnergy.wav',
    'sounds/shootEnergy1.wav'
  ],
  rocketFire: 'sounds/rocket_fire.wav',
  rocketTravel: 'sounds/rocket_travel.wav',
  scored: 'sounds/scored.ogg',
  hitPlayer: 'sounds/hitPlayer.ogg',
  hitPlayerBullet: 'sounds/hitPlayer2.ogg',
  hitAsteroid: 'sounds/hitAsteroid.ogg',
  hitAsteroidBullet: 'sounds/hitAsteroid1.ogg',
  explosion: 'sounds/explosion.ogg',
  ambientExplosion: [
    'sounds/ambientExplosion.wav',
    'sounds/ambientExplosion1.wav',
    'sounds/ambientExplosion2.wav'
  ],
  collide: [
    'sounds/impact.wav',
    'sounds/impact1.wav',
    'sounds/impact2.wav'
  ],
  meteorCrash: 'sounds/impactsMetalCrash.wav',
  laserImpact: 'sounds/laserImpact.wav',
  laser: 'sounds/laser2.wav',
  death: 'sounds/death2.wav',
  ready: 'sounds/ready.wav',
  noAmmo: 'sounds/noAmmo.wav'
};

const SFX_SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const sfxMasters = new Map(); // url -> Audio
const sfxHolds = new Map();   // key -> Audio
const sfxPools = new Map();   // url -> { list: Audio[], rr: number }
let sfxUnlocked = false;
let sfxThrustOn = false;
let sfxLaserOn = false;
let shotgunSfxAt = new Map();

/**
 * BassoonTracker assigns `var Audio = …` at top level, which overwrites the
 * browser's HTMLAudioElement constructor. Always build media via createElement.
 */
function makeHtmlAudio(src) {
  const a = document.createElement('audio');
  a.preload = 'auto';
  a.playsInline = true;
  if (src) a.src = src;
  return a;
}

function sfxUrl(src) {
  return String(src || '').split('/').map(encodeURIComponent).join('/');
}

function sfxMaster(src) {
  if (!src || typeof src !== 'string') return null;
  let a = sfxMasters.get(src);
  if (a) return a;
  a = makeHtmlAudio(sfxUrl(src));
  sfxMasters.set(src, a);
  try { a.load(); } catch (_) {}
  return a;
}

/** Fixed-size reusable voices — never cloneNode (Chrome media-element limit). */
function sfxPoolVoice(src, size) {
  const n = Math.max(1, Math.min(SFX_MAX_POOL, size | 0));
  let entry = sfxPools.get(src);
  if (!entry) {
    entry = { list: [], rr: 0 };
    sfxPools.set(src, entry);
  }
  while (entry.list.length < n) {
    entry.list.push(makeHtmlAudio(sfxUrl(src)));
  }
  // Prefer an idle voice; otherwise round-robin steal.
  for (let i = 0; i < entry.list.length; i++) {
    const a = entry.list[i];
    if (a.paused || a.ended) return a;
  }
  const a = entry.list[entry.rr % entry.list.length];
  entry.rr++;
  return a;
}

function unlockSfx() {
  if (sfxUnlocked) return;
  sfxUnlocked = true;
  try {
    const gate = makeHtmlAudio(SFX_SILENT);
    gate.volume = 0;
    const p = gate.play();
    if (p && p.then) p.then(() => { try { gate.pause(); } catch (_) {} }).catch(() => {});
    else try { gate.pause(); } catch (_) {}
    // Warm common clips + pools in the background (non-blocking).
    setTimeout(() => {
      try {
        for (const src of Object.values(SFX)) {
          if (Array.isArray(src)) {
            for (const s of src) sfxMaster(s);
          } else {
            sfxMaster(src);
          }
        }
        // Pre-build pools for high-traffic SFX so first shots aren't late.
        const warm = (src, n) => {
          if (Array.isArray(src)) {
            for (const s of src) sfxPoolVoice(s, n);
          } else if (src) {
            sfxPoolVoice(src, n);
          }
        };
        warm(SFX.money, 8);
        warm(SFX.shoot, 8);
        warm(SFX.collide, 6);
        warm(SFX.hitAsteroidBullet, 8);
        warm(SFX.hitPlayerBullet, 8);
        warm(SFX.shotgun, 4);
        warm(SFX.railFire, 4);
      } catch (_) {}
    }, 0);
  } catch (_) {}
  // Same gesture unlocks tracker music (BassoonTracker AudioContext).
  try {
    if (window.Music) {
      if (typeof window.BassoonTracker !== 'undefined' && window.BassoonTracker.ensureAudio) {
        window.BassoonTracker.ensureAudio();
      }
      const pending = window.Music.pendingPlay;
      window.Music.resumeAudioContext().then(() => {
        if (pending && window.Music.pendingPlay === pending) {
          window.Music.pendingPlay = null;
          const { filePath, callback, sequenceIndex } = pending;
          setTimeout(() => window.Music.play(filePath, callback, sequenceIndex), 100);
        }
      });
    }
  } catch (_) {}
}

function playMenuMusic() {
  try {
    if (window.Music && typeof window.Music.playMenu === 'function') window.Music.playMenu();
  } catch (_) {}
}

function playMatchMusic() {
  try {
    if (window.Music && typeof window.Music.playMatch === 'function') window.Music.playMatch();
  } catch (_) {}
}

function sfxTryPlay(a) {
  try {
    // Ignore AbortError from pause()/restart stealing this voice mid-play().
    const gen = (a._sfxGen = (a._sfxGen | 0) + 1);
    const p = a.play();
    if (p && p.catch) {
      p.catch(() => {
        if (a._sfxGen !== gen) return;
        // Tab was backgrounded / autoplay gate — try once more.
        try {
          a.currentTime = 0;
          const p2 = a.play();
          if (p2 && p2.catch) p2.catch(() => {});
        } catch (_) {}
      });
    }
  } catch (_) {}
}

/** One-shot SFX. `src` may be a string or an array (picks one at random). */
function playSfx(src, opts) {
  if (Array.isArray(src)) {
    if (!src.length) return null;
    src = src[(Math.random() * src.length) | 0];
  }
  if (!src) return null;
  opts = opts || {};
  try {
    unlockSfx();
    const vol = opts.vol != null ? opts.vol : 0.7;
    // Always pool — cloneNode eventually exhausts Chrome's media-element budget.
    const poolSize = opts.pool != null ? (opts.pool | 0) : SFX_DEFAULT_POOL;
    const a = sfxPoolVoice(src, poolSize > 0 ? poolSize : SFX_DEFAULT_POOL);
    try { a.pause(); } catch (_) {}
    a.volume = vol;
    try { a.currentTime = 0; } catch (_) {}
    sfxTryPlay(a);
    return a;
  } catch (_) {
    return null;
  }
}

/** Same as playSfx (pools already allow overlap). Kept for call-site compatibility. */
function playSfxOverlap(src, opts) {
  return playSfx(src, opts);
}

/** Random distant boom 0.5s after any explosion (asteroid / death / rocket). */
function playAmbientExplosionEcho(opts) {
  opts = opts || {};
  const delay = opts.delay != null ? opts.delay : 200;
  const vol = opts.vol != null ? opts.vol : 0.55;
  const list = SFX.ambientExplosion;
  if (!list || !list.length) return;
  setTimeout(() => {
    const src = list[(Math.random() * list.length) | 0];
    playSfxOverlap(src, { vol, pool: 4 });
  }, delay);
}

function sfxHold(key, src) {
  let a = sfxHolds.get(key);
  if (a) return a;
  a = makeHtmlAudio(sfxUrl(src));
  sfxHolds.set(key, a);
  try { a.load(); } catch (_) {}
  return a;
}

/** Held / looping clip (rail charge, death, laser). */
function playSfxLoop(key, src, opts) {
  if (!src || key == null) return null;
  opts = opts || {};
  try {
    unlockSfx();
    const a = sfxHold(key, src);
    a.loop = !!opts.loop;
    a.volume = opts.vol != null ? opts.vol : 0.7;
    try { a.pause(); } catch (_) {}
    try { a.currentTime = 0; } catch (_) {}
    const p = a.play();
    if (p && p.catch) {
      p.catch(() => {
        const retry = () => {
          try { a.currentTime = 0; } catch (_) {}
          sfxTryPlay(a);
        };
        a.addEventListener('canplay', retry, { once: true });
      });
    }
    return a;
  } catch (_) {
    return null;
  }
}

function stopSfxLoop(key) {
  const a = sfxHolds.get(key);
  if (!a) return;
  try { a.loop = false; } catch (_) {}
  try { a.pause(); a.currentTime = 0; } catch (_) {}
}

function stopAllRailChargeSfx() {
  for (const key of sfxHolds.keys()) {
    if (String(key).indexOf('railCharge:') === 0) stopSfxLoop(key);
  }
}

function rocketTravelKey(id) {
  return 'rocketTravel:' + id;
}

/** ended handlers — restart travel hum if .loop is ignored by the browser. */
const rocketTravelEnded = new Map();

function stopRocketTravelSfx(id) {
  if (id == null) return;
  const key = rocketTravelKey(id);
  const a = sfxHolds.get(key);
  const onEnded = rocketTravelEnded.get(key);
  if (a && onEnded) {
    try { a.removeEventListener('ended', onEnded); } catch (_) {}
  }
  rocketTravelEnded.delete(key);
  stopSfxLoop(key);
}

function stopAllRocketTravelSfx() {
  for (const key of [...sfxHolds.keys()]) {
    if (String(key).indexOf('rocketTravel:') !== 0) continue;
    const a = sfxHolds.get(key);
    const onEnded = rocketTravelEnded.get(key);
    if (a && onEnded) {
      try { a.removeEventListener('ended', onEnded); } catch (_) {}
    }
    rocketTravelEnded.delete(key);
    stopSfxLoop(key);
  }
}

function startRocketTravelSfx(b) {
  if (!b || b.type !== 'rocket') return;
  const id = b.id;
  const key = rocketTravelKey(id);
  const mine = b.owner === myId;
  const a = playSfxLoop(key, SFX.rocketTravel, {
    vol: mine ? 0.55 : 0.35,
    loop: true
  });
  if (!a) return;
  const prev = rocketTravelEnded.get(key);
  if (prev) {
    try { a.removeEventListener('ended', prev); } catch (_) {}
  }
  const onEnded = () => {
    const still = bullets.get(id);
    if (!still || still.type !== 'rocket') return;
    try {
      a.loop = true;
      a.currentTime = 0;
      sfxTryPlay(a);
    } catch (_) {}
  };
  rocketTravelEnded.set(key, onEnded);
  a.addEventListener('ended', onEnded);
}

function playShotgunFireSfx(ownerId, vol) {
  const now = performance.now();
  const last = shotgunSfxAt.get(ownerId) || 0;
  if (now - last < 280) return;
  shotgunSfxAt.set(ownerId, now);
  playSfx(SFX.shotgun, { vol: vol != null ? vol : 0.7 });
}

function syncThrustSfx(on) {
  sfxThrustOn = !!on;
}

function syncLaserSfx(on) {
  if (!SFX.laser) { sfxLaserOn = !!on; return; }
  if (on === sfxLaserOn) return;
  sfxLaserOn = on;
  try {
    unlockSfx();
    const a = sfxHold('laser', SFX.laser);
    a.loop = true;
    a.volume = 0.55;
    if (on) {
      try { a.currentTime = 0; } catch (_) {}
      const p = a.play();
      if (p && p.catch) {
        p.catch(() => {
          sfxLaserOn = false;
          a.addEventListener('canplay', () => {
            sfxLaserOn = true;
            sfxTryPlay(a);
          }, { once: true });
        });
      }
    } else {
      try { a.pause(); a.currentTime = 0; } catch (_) {}
    }
  } catch (_) {
    sfxLaserOn = false;
  }
}

addEventListener('pointerdown', unlockSfx, { once: true });
addEventListener('keydown', unlockSfx, { once: true });

const TPS = 30;
const TICK_MS = 1000 / TPS;
const TURN_AV_MAX = (Math.PI * 2) / (1.2 * TPS); // 360° in 1.2s ≈ 10°/tick
const TURN_ACCEL = TURN_AV_MAX / 12;               // reach max in 12 ticks
const TURN_AV_MAX_PRECISE = TURN_AV_MAX * 0.3;
const TURN_ACCEL_PRECISE = TURN_ACCEL * 0.3;
const TURN_DECEL_FRAMES = 5;                     // release → 0 in this many ticks
/** Opposite turn: double deaccel-to-zero rate (half the coast frames). */
const TURN_DECEL_REVERSE_FRAMES = Math.max(1, (TURN_DECEL_FRAMES / 2) | 0);
const THRUST = 0.09 * RES_SCALE * 1.15 * 1.2 * 1.2 * 0.85;  // prior buffs, then −15%
const MAX_SPEED = 8 * RES_SCALE * 0.8 * 0.75 * 0.75;   // −25%, then −25% again
const STUN_MAX_SPEED = 9;
const ASTEROID_COLLIDE_DMG_MIN = 10;
/** Collision shape is this fraction of visual radius / polygon (visual unchanged). */
const ASTEROID_HIT_SCALE = 0.9;
const PLAYER_R = 10 * RES_SCALE;
const PLAYER_HIT_R = PLAYER_R * 0.3;
const PLAYER_HIT_R_FRONT = PLAYER_HIT_R * 1.1;
const PLAYER_HIT_R_BACK = PLAYER_HIT_R * 2 * 0.9;
const PLAYER_HIT_OFFSET_FRONT = 5 * RES_SCALE;
const PLAYER_HIT_OFFSET_BACK = 3 * RES_SCALE;
const MUZZLE = 10 * RES_SCALE;
const MAX_HP = 100;
/** Asteroid collide damage scales with relative impact speed vs MAX_SPEED (1.0 → full HP). */
const STUN_SPIN = 20 * Math.PI / 180;
const STUN_END_AV = 5 * Math.PI / 180;
const STUN_DECEL_TICKS = Math.round(3 * TPS);
const COLLIDE_IFRAME_TICKS = Math.round(0.35 * TPS);
const GODMODE_TICKS = Math.round(8 * TPS);
/** Matches server: spawn safe zone (asteroid clear + leave-to-end-godmode). */
const GODMODE_SPAWN_CLEAR_R = 75;
const SPAWN_CENTER_OFFSET = 250;
const BIN_SNAP = 1;
const SOFT_ERR_MAX_POS = 48 * RES_SCALE;
const SOFT_ERR_MAX_ANG = 0.6;
/** If visual/sim drift exceeds this after reconcile, hard teleport (no soft blend). */
const LOCAL_DRIFT_SNAP_PX = 30;
/**
 * If local tick cursor falls this far behind (tab background), skip synthesizing
 * a flood of predict ticks and resync from the last server ghost with a soft blend.
 * Below this, gradual catch-up (cl_catchup/frame) with cleared keys is fine.
 */
const TICK_CATCHUP_SKIP = 36;
/** Allow larger softErr after tab resume so we blend instead of teleport. */
const RESUME_SOFT_ERR_MAX = 220 * RES_SCALE;
const RESUME_BLEND_MS = 400;
/** Cap remote dead-reckon past the last hist sample (ms). */
const REMOTE_EXTRAP_MAX_MS = 140;

/** Source-style client cvars (tweak via ~ console). */
const CVARS = {
  cl_interp: {
    value: 0,
    def: 0,
    help: 'Remote interp override (seconds). 0 = adaptive between cl_interp_min/max.'
  },
  cl_interp_min: {
    value: 100,
    def: 100,
    help: 'Min remote interpolation delay (ms) when cl_interp is 0.'
  },
  cl_interp_max: {
    value: 180,
    def: 180,
    help: 'Max remote interpolation delay (ms) when cl_interp is 0.'
  },
  cl_recon: {
    value: 14,
    def: 14,
    help: 'Soft reconcile decay rate (1/s). 0 = hard snap, no soft visual error.'
  },
  cl_catchup: {
    value: 5,
    def: 5,
    help: 'Max local prediction ticks applied per animation frame.'
  },
  cl_cmddelay: {
    value: 1,
    def: 1,
    help: 'Minimum input delay in ticks (~33ms each at 30Hz).'
  },
  cl_cmddelay_max: {
    value: 3,
    def: 3,
    help: 'Max adaptive input delay in ticks.'
  },
  cl_asteroid_tune: {
    value: 1,
    def: 1,
    help: '1 = lead asteroid draw to local ship predict (one-way ping − cmd delay). 0 = raw NTP.'
  },
  cl_hitbox: {
    value: 0,
    def: 0,
    help: 'Draw collision hitboxes (0/1). Asteroids = filled poly, ships = circles.'
  },
  cl_hitscan: {
    value: 0,
    def: 0,
    help: 'Draw server hitscan rays + impact markers (0/1). Laser/railgun/thrust.'
  },
  sv_send_asteroids: {
    value: 0,
    def: 0,
    help: 'Server asteroid ghost dump every N ticks (0=off). Period clamped to min 10. Admin only.'
  },
  sv_predict_shoot_step: {
    value: 1,
    def: 1,
    help: 'Fixed fire origin lead ticks via vx/vy (0–8). Used when sv_dynamic_prediction is 0. Admin only.'
  },
  sv_predict_shoot_angle: {
    value: 1,
    def: 1,
    help: 'Fixed fire aim lead ticks via av (0–8). Used when sv_dynamic_prediction is 0. Admin only.'
  },
  sv_dynamic_prediction: {
    value: 1,
    def: 1,
    help: 'Scale for ping-based fire lead (global). 0 = fixed sv_predict_shoot_step/angle. 1 = one-way − cmd delay; 2 = 2× that lead. Admin only.'
  },
  sv_portal: {
    value: 1,
    def: 1,
    help: '1 = spawn wrap twin before asteroid leaves screen (seamless edge). Admin only.'
  },
  sv_demo: {
    value: 2,
    def: 2,
    help: 'Server demos: 0=off, 1=PvP only, 2=PvP + matchmaking/coop wave rooms. Admin only. Global.'
  },
  cl_grid: {
    value: 1,
    def: 1,
    help: 'Background grid: 0=off, 1=square, 2=hex, 3=triangle, 4=square centers, 5=hex stars.'
  },
  cl_grid_maxspeed: {
    value: 800,
    def: 800,
    help: 'Max grid node speed (px/s before RES_SCALE).'
  },
  cl_grid_maxdisp: {
    value: 400,
    def: 400,
    help: 'Max node displacement as multiple of cell size.'
  },
  cl_grid_amp: {
    value: 3,
    def: 3,
    help: 'F1 / asteroid blast strength multiplier.'
  },
  cl_grid_width: {
    value: 1,
    def: 1,
    help: 'Grid line stroke width (1 = default; scales with render resolution).'
  },
  cl_grid_ripple: {
    value: 3,
    def: 3,
    help: 'F1 / asteroid ripple power (ring kick strength).'
  },
  cl_grid_ripple_freq: {
    value: 1.75,
    def: 1.75,
    help: 'Per-blast ripple frequency. 0 = ripple off; 1 = default timing; higher = faster rings.'
  },
  cl_grid_implosion: {
    value: 0,
    def: 0,
    help: 'Unused — F1: left click = implosion, right = explosion.'
  },
  cl_grid_size: {
    value: 5,
    def: 5,
    help: 'Line spacing (px). Live mesh when bake=0; with bake=1 only texture line density (warp stays coarse).'
  },
  cl_grid_color_r: {
    value: 0.22,
    def: 0.22,
    help: 'Grid line red (0–1).'
  },
  cl_grid_color_g: {
    value: 0.22,
    def: 0.22,
    help: 'Grid line green (0–1).'
  },
  cl_grid_color_b: {
    value: 0.22,
    def: 0.22,
    help: 'Grid line blue (0–1).'
  },
  cl_bg_color_r: {
    value: 0,
    def: 0,
    help: 'Background clear red (0–1).'
  },
  cl_bg_color_g: {
    value: 0,
    def: 0,
    help: 'Background clear green (0–1).'
  },
  cl_bg_color_b: {
    value: 0,
    def: 0,
    help: 'Background clear blue (0–1).'
  },
  cl_background_bake: {
    value: 1,
    def: 1,
    help: '1 = bake lines to a texture + coarse mesh warp (no per-line physics). 0 = live spring lines.'
  },
  cl_background_bake_quality: {
    value: 8,
    def: 8,
    help: 'Bake warp mesh density 5–14 (higher = more faces / finer distortion). Only used when bake=1.'
  },
  cl_bg_layer: {
    value: 0,
    def: 0,
    help: '1 = draw scrolling nebula under the grid (undistorted, alpha 0.5). Off by default.'
  },
  cl_bg_dir_invert: {
    value: 0,
    def: 0,
    help: '1 = reverse layered underlay nebula scroll only (grid stroke nebula unchanged).'
  },
  cl_grid_alpha: {
    value: 0.5,
    def: 0.5,
    help: 'Grid / bake stroke opacity (0–1).'
  },
  cl_ast_outline_tex: {
    value: 0,
    def: 0,
    help: '1 = texture asteroid silhouette outline with rock albedo.'
  },
  cl_ast_outline_alpha: {
    value: 1,
    def: 1,
    help: 'Asteroid silhouette outline opacity (0–1).'
  },
  cl_ast_face_tex: {
    value: 1,
    def: 1,
    help: '1 = texture asteroid faces with rock albedo.'
  },
  cl_ast_face_alpha: {
    value: 1,
    def: 1,
    help: 'Asteroid face opacity (0–1).'
  },
  cl_ast_face_tint: {
    value: 0.7,
    def: 0.7,
    help: 'Face texture tint strength (0 = albedo only, 1 = full asteroid color).'
  },
  cl_ast_wire_width: {
    value: 2,
    def: 2,
    help: 'Inner 3D mesh wireframe stroke width (px).'
  },
  cl_ast_wire_alpha: {
    value: 0,
    def: 0,
    help: 'Inner 3D mesh wireframe opacity (0 = off).'
  },
  cl_test_grid: {
    value: 0,
    def: 0,
    help: 'Debug: inject a random grid shock every frame for 10s (FPS test)'
  },
  cl_ast_z_min: {
    value: 1.6,
    def: 1.6,
    help: 'Per-asteroid Z stretch lower bound (deterministic random from id).'
  },
  cl_ast_z_max: {
    value: 2,
    def: 2,
    help: 'Per-asteroid Z stretch upper bound (deterministic random from id).'
  },
  cl_ast_emit: {
    value: 0.45,
    def: 0.45,
    help: 'Face emission energy — Godot-style glow from tint × bright texels (0 = off).'
  },
  cl_ast_outline_emit: {
    value: 0,
    def: 0,
    help: 'Outline emission energy (works with or without outline texture; 0 = off).'
  },
  cl_allToDefault: {
    value: 0,
    def: 0,
    help: 'Set to 1 to reset all cl_ cvars to their defaults.'
  }
};

const BAKE_QUALITY_KEY = 'asteroids_bake_quality';
try {
  const _bq = localStorage.getItem(BAKE_QUALITY_KEY);
  if (_bq != null) {
    const q = Math.max(5, Math.min(14, _bq | 0));
    if (Number.isFinite(q)) CVARS.cl_background_bake_quality.value = q;
  }
} catch (_) { /* ignore */ }

function syncSettingsBakeQualityUi() {
  const el = document.getElementById('settings-bake-quality');
  if (!el) return;
  el.value = String(Math.max(5, Math.min(14, cv('cl_background_bake_quality') | 0 || 8)));
}

function cv(name) {
  const c = CVARS[name];
  return c ? c.value : 0;
}

function resetAllClCvars() {
  for (const name of Object.keys(CVARS)) {
    if (!name.startsWith('cl_') || name === 'cl_allToDefault') continue;
    const c = CVARS[name];
    if (c && c.def != null) c.value = c.def;
  }
  CVARS.cl_allToDefault.value = 0;
  try {
    localStorage.setItem(BAKE_QUALITY_KEY, String(CVARS.cl_background_bake_quality.value));
  } catch (_) { /* ignore */ }
  syncSettingsBakeQualityUi();
  invalidateGridBake();
}

function setCvar(name, raw) {
  const c = CVARS[name];
  if (!c) return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (name.startsWith('sv_') && !consoleAdmin) return false;
  if (name === 'cl_allToDefault' && n !== 0) {
    resetAllClCvars();
    syncGetAsteroidsCvar();
    applyGridModeFromCvars();
    syncBgClearFromCvars();
    syncGridPanelFromCvars();
    syncGlowPanelFromCvars();
    return true;
  }
  c.value = n;
  if (name === 'cl_test_grid') {
    // When set to 1, spam one shock per animation frame for 10 seconds.
    // drawSynthGrid() will reset this cvar back to 0 after the window ends.
    if (n !== 0) gridTestUntilMs = performance.now() + 10000;
    return true;
  }
  if (name === 'cl_grid') {
    c.value = Math.max(0, Math.min(5, n | 0));
    applyGridModeFromCvars();
    invalidateGridBake();
  }
  if (name === 'cl_bg_layer' || name === 'cl_bg_dir_invert'
    || name === 'cl_ast_outline_tex' || name === 'cl_ast_face_tex') {
    c.value = (n | 0) !== 0 ? 1 : 0;
  }
  if (name === 'sv_send_asteroids') syncGetAsteroidsCvar();
  if (name === 'sv_predict_shoot_step' || name === 'sv_predict_shoot_angle') {
    syncPredictShootCvars();
  }
  if (name === 'sv_dynamic_prediction') {
    c.value = Math.max(0, n);
    syncDynamicPredictionCvar();
  }
  if (name === 'sv_portal') syncPortalCvar();
  if (name === 'sv_demo') {
    c.value = Math.max(0, Math.min(2, n | 0));
    syncDemoCvar();
  }
  if (name === 'cl_background_bake' || name === 'cl_background_bake_quality') {
    if (name === 'cl_background_bake_quality') {
      c.value = Math.max(5, Math.min(14, n | 0));
      try { localStorage.setItem(BAKE_QUALITY_KEY, String(c.value)); } catch (_) { /* ignore */ }
      syncSettingsBakeQualityUi();
    }
    applyGridModeFromCvars();
  } else if (name === 'cl_grid_size') {
    if ((cv('cl_background_bake') | 0) !== 0) {
      // Bake mode: size = texture line density only (warp mesh stays coarse).
      invalidateGridBake();
    } else {
      rebuildSynthGrid(n);
    }
  }
  if (
    name === 'cl_background_bake'
    || name === 'cl_background_bake_quality'
    || name === 'cl_grid_size'
    || name === 'cl_grid_width'
    || name === 'cl_grid_color_r' || name === 'cl_grid_color_g' || name === 'cl_grid_color_b'
  ) {
    invalidateGridBake();
  }
  if (
    name.indexOf('cl_grid') === 0
    || name.indexOf('cl_bg_') === 0
    || name === 'cl_background_bake'
    || name === 'cl_background_bake_quality'
  ) {
    if (name.indexOf('cl_bg_') === 0) syncBgClearFromCvars();
    syncGridPanelFromCvars();
    syncGlowPanelFromCvars();
  }
  return true;
}

/** Tell server how often to push authoritative asteroid poses for ghost debug. */
function syncGetAsteroidsCvar() {
  const v = cv('sv_send_asteroids') | 0;
  if (v <= 0) asteroidGhosts = [];
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'getAst', every: v }));
}

/** Tell server how many ticks ahead to place this player's shots/hitscan. */
function syncPredictShootCvars() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    t: 'predShoot',
    steps: cv('sv_predict_shoot_step') | 0,
    angle: cv('sv_predict_shoot_angle') | 0
  }));
}

/** Tell server global ping-based fire lead (all rooms). */
function syncDynamicPredictionCvar() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    t: 'svDynamicPrediction',
    v: Math.max(0, Number(cv('sv_dynamic_prediction')) || 0)
  }));
}

/** Client-side mirror of server fire lead (for aim cone / debug). */
function shootPredictLeadTicks() {
  const scale = Number(cv('sv_dynamic_prediction'));
  if (scale > 0) {
    const oneWayTicks = (pingMs * 0.5) / TICK_MS;
    return Math.max(0, Math.min(8, Math.round((oneWayTicks - adaptiveInputDelay()) * scale) | 0));
  }
  return Math.max(0, Math.min(8, cv('sv_predict_shoot_step') | 0));
}

function shootPredictAngleLeadTicks() {
  if (Number(cv('sv_dynamic_prediction')) > 0) {
    return shootPredictLeadTicks();
  }
  return Math.max(0, Math.min(8, cv('sv_predict_shoot_angle') | 0));
}

/** Tell server whether asteroid edge portals are enabled. */
function syncPortalCvar() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'svPortal', v: (cv('sv_portal') | 0) !== 0 ? 1 : 0 }));
}

/** Tell server global demo recording mode (sv_demo 0/1/2). */
function syncDemoCvar() {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'svDemo', v: cv('sv_demo') | 0 }));
}

/** Soft night/dyn lighting for entities — ship radial only (no flashlight cone). */
const SCENE_LIGHT_GLSL = `
  uniform float uFlashNight;
  uniform vec4 uShipLight[8];
  uniform vec2 uLightWrap; // world size for torus light distance

  // Torus shortest delta.
  vec2 lightWrapDelta(vec2 from, vec2 to) {
    vec2 d = to - from;
    vec2 hsz = uLightWrap * 0.5;
    if (d.x > hsz.x) d.x -= uLightWrap.x;
    else if (d.x < -hsz.x) d.x += uLightWrap.x;
    if (d.y > hsz.y) d.y -= uLightWrap.y;
    else if (d.y < -hsz.y) d.y += uLightWrap.y;
    return d;
  }

  // Alpha gradient 1→0 from center to R (smoothstep, no hard rim / no discard cliff).
  float softShipRad(vec2 p, vec2 c, float R) {
    float d = length(lightWrapDelta(c, p));
    float t = 1.0 - smoothstep(0.0, max(1.0, R), d);
    // Ease so the mid-ring is softer than a linear ramp.
    return t * t * (3.0 - 2.0 * t);
  }

  float sceneLit(vec2 p) {
    float lit = 0.0;
    for (int si = 0; si < 8; si++) {
      if (uShipLight[si].w < 0.5) continue;
      lit = max(lit, softShipRad(p, uShipLight[si].xy, uShipLight[si].z));
    }
    return clamp(lit, 0.0, 1.0);
  }

  // Night: soft alpha only (full color × fading alpha). Tiny discard for fillrate.
  vec4 applyNightLit(vec3 rgb, float a, vec2 world) {
    if (uFlashNight < 0.5) return vec4(rgb, a);
    float lit = sceneLit(world);
    if (lit < 0.001) discard;
    return vec4(rgb, a * lit);
  }

  // Premultiplied (particles / additive sprites).
  vec4 applyNightLitPremul(vec3 rgb, float a, vec2 world) {
    if (uFlashNight < 0.5) return vec4(rgb * a, a);
    float lit = sceneLit(world);
    if (lit < 0.001) discard;
    float aa = a * lit;
    return vec4(rgb * aa, aa);
  }
`;

const vs = `
  attribute vec2 a;
  uniform vec2 uRes;
  uniform float uSize;
  varying vec2 vWorld;
  void main() {
    vec2 p = a / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0, 1);
    gl_PointSize = uSize;
    vWorld = a;
  }
`;
const fs = `
  precision mediump float;
  uniform vec3 uCol;
  uniform float uAlpha;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `
  void main() {
    gl_FragColor = applyNightLit(uCol, uAlpha, vWorld);
  }
`;

const COL = {
  self: [0.35, 0.85, 1.0],
  ghost: [1.0, 0.85, 0.35],
  remote: [1.0, 0.28, 0.55],
  asteroid: [1.0, 0.45, 0.2],
  meteor: [0.95, 0.2, 0.35],
  bullet: [0.85, 0.95, 1.0],
  rocket: [1.0, 0.45, 0.2],
  laser: [0.35, 0.95, 1.0],
  laserHit: [1.0, 0.2, 0.45],
  railgun: [1.0, 0.25, 0.95],
  melee: [1.0, 0.9, 0.35],
  plasma: [0.35, 1.0, 0.55],
  voidcannon: [0.55, 0.25, 1.0],
  powerDamage: [1.0, 0.35, 0.55],
  powerTurret: [0.95, 0.85, 0.3],
  powerShield: [0.4, 0.85, 1.0],
  powerHoming: [1.0, 0.55, 0.2],
  powerLead: [0.55, 1.0, 0.75],
  powerEmp: [0.85, 0.95, 1.0],
  powerReload: [0.45, 1.0, 0.4],
  enemy: [1.0, 0.55, 0.25],
  enemyUfo: [0.55, 1.0, 0.65],
  enemyCarrier: [0.85, 0.7, 1.0],
  enemyBullet: [1.0, 0.35, 0.45],
  pickup: [1.0, 0.85, 0.35],
  health: [1.0, 0.35, 0.55],
  debug: [1.0, 0.2, 1.0],
  grid: [0.95, 0.2, 0.85],
  gridCyan: [0.25, 0.9, 1.0],
  horizon: [0.55, 0.1, 0.45],
  cannonHot: [1.0, 0.18, 0.1],
  coin: [1.0, 0.86, 0.25]
};
const COL_WHITE = [1, 1, 1];
const DEFAULT_PLAYER_COLOR_HEX = '#59D9FF';
const DEFAULT_SHOOT_COLOR_HEX = '#59F2FF';

/** @type {Map<number, { player: number[], shoot: number[], playerHex: string, shootHex: string }>} */
const playerColors = new Map();
let myPlayerColorHex = DEFAULT_PLAYER_COLOR_HEX;
let myShootColorHex = DEFAULT_SHOOT_COLOR_HEX;
let myPlayerColorRgb = hexToRgb01(DEFAULT_PLAYER_COLOR_HEX) || COL.self.slice();
let myShootColorRgb = hexToRgb01(DEFAULT_SHOOT_COLOR_HEX) || COL.laser.slice();

function normalizeColorHex(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

function hexToRgb01(hex) {
  const h = normalizeColorHex(hex);
  if (!h) return null;
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255
  ];
}

function rgb01ToHex(rgb) {
  if (!rgb || rgb.length < 3) return DEFAULT_PLAYER_COLOR_HEX;
  const c = (v) => {
    const n = Math.max(0, Math.min(255, Math.round((v || 0) * 255)));
    return n.toString(16).padStart(2, '0').toUpperCase();
  };
  return '#' + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
}

function setMyColors(playerHex, shootHex) {
  const pc = normalizeColorHex(playerHex) || DEFAULT_PLAYER_COLOR_HEX;
  const sc = normalizeColorHex(shootHex) || DEFAULT_SHOOT_COLOR_HEX;
  myPlayerColorHex = pc;
  myShootColorHex = sc;
  myPlayerColorRgb = hexToRgb01(pc) || COL.self.slice();
  myShootColorRgb = hexToRgb01(sc) || COL.laser.slice();
  if (myId != null) {
    playerColors.set(myId, {
      player: myPlayerColorRgb.slice(),
      shoot: myShootColorRgb.slice(),
      playerHex: pc,
      shootHex: sc
    });
  }
  invalidateGridBake();
}

function applyPlayerColors(rows) {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row) continue;
    const id = row[0] | 0;
    const pc = normalizeColorHex(row[1]) || DEFAULT_PLAYER_COLOR_HEX;
    const sc = normalizeColorHex(row[2]) || DEFAULT_SHOOT_COLOR_HEX;
    const pr = hexToRgb01(pc) || COL.self.slice();
    const sr = hexToRgb01(sc) || COL.laser.slice();
    playerColors.set(id, { player: pr, shoot: sr, playerHex: pc, shootHex: sc });
    if (id === myId) {
      myPlayerColorHex = pc;
      myShootColorHex = sc;
      myPlayerColorRgb = pr.slice();
      myShootColorRgb = sr.slice();
      syncAccountColorInputs();
    }
  }
  invalidateGridBake();
}

function ownerPlayerColor(ownerId) {
  if (ownerId === myId) return myPlayerColorRgb || COL.self;
  const c = playerColors.get(ownerId);
  return (c && c.player) || COL.remote;
}

function ownerShootColor(ownerId) {
  if (ownerId === myId) return myShootColorRgb || COL.laser;
  const c = playerColors.get(ownerId);
  return (c && c.shoot) || COL.laser;
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s <= 0) return [l, l, l];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3)
  ];
}

/** HSV → RGB (h in 0–1). Used for asteroid colors: S=1, V=1, random H. */
function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const i = (h * 6) | 0;
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/** Player-color spark with random hue / saturation wobble. */
function varyShipSparkColor(col) {
  const base = col || COL_WHITE;
  const [h, s, l] = rgbToHsl(base[0], base[1], base[2]);
  const hh = (h + (Math.random() - 0.5) * 0.14 + 1) % 1;
  const ss = Math.max(0.05, Math.min(1, s + (Math.random() - 0.5) * 0.55));
  const ll = Math.max(0.15, Math.min(0.92, l + (Math.random() - 0.5) * 0.12));
  return hslToRgb(hh, ss, ll);
}
/** Black void behind the deformable grid. */
const BG_CLEAR = [0, 0, 0];

function syncBgClearFromCvars() {
  BG_CLEAR[0] = Math.max(0, Math.min(1, cv('cl_bg_color_r')));
  BG_CLEAR[1] = Math.max(0, Math.min(1, cv('cl_bg_color_g')));
  BG_CLEAR[2] = Math.max(0, Math.min(1, cv('cl_bg_color_b')));
}
syncBgClearFromCvars();

/* ========== Deformable background grid (stable mass-spring) ==========
 * Explosions punch an outward crater (hole): instant radial open + velocity.
 * Mesh extends GRID_PAD past each world edge so blasts near the rim don't
 * pinch against fixed borders inside the playfield.
 * Cell size is live via cl_grid_size → rebuildSynthGrid().
 */
const GRID_PAD = 100;
const GRID_OX = -GRID_PAD;
const GRID_OY = -GRID_PAD;
const GRID_DAMP = 0.86;
/** Default per-node spring materials (formerly global cl_grid_elasticity / cl_grid_anchor). */
const GRID_ELASTICITY_DEFAULT = 300;
const GRID_ANCHOR_DEFAULT = 5;
const GRID_SLEEP_V2 = 2.5;
const GRID_SLEEP_D2 = 0.8;
const GRID_N_SOFT_CAP = 200000; // refuse tiny sizes that would melt the CPU (allows ~2px cells)
/** Bake warp step from cl_background_bake_quality (5=coarse … 14=fine). */
function bakeWarpStepFromQuality() {
  const q = Math.max(5, Math.min(14, cv('cl_background_bake_quality') | 0 || 8));
  // q=5 → ~26px cells, q=8 → ~15px, q=14 → 6px (floor)
  return Math.max(6, Math.round(44 - q * 3.6));
}
let GRID_STEP = 18;
let GRID_COLS = 0;
let GRID_ROWS = 0;
let GRID_N = 0;
let GRID_SPRING_REST = GRID_STEP;
/** 1=square, 2=hex (2 of 3 tri directions), 3=triangle. */
let GRID_TOPO = 1;
let gridBaseX = new Float32Array(0);
let gridBaseY = new Float32Array(0);
let gridDefX = new Float32Array(0);
let gridDefY = new Float32Array(0);
let gridVelX = new Float32Array(0);
let gridVelY = new Float32Array(0);
let gridFx = new Float32Array(0);
let gridFy = new Float32Array(0);
let gridInvMass = new Float32Array(0);
/** 1 = permanent pin (border / star / spawn) — never cleared by asteroid ironing. */
let gridStaticPin = new Uint8Array(0);
/** Per-node neighbor spring stiffness — stamped by each explosion. */
let gridElasticity = new Float32Array(0);
/** Per-node rest-pose pull — stamped by each explosion. */
let gridAnchor = new Float32Array(0);
let gridLineScratch = new Float32Array(0);
let gridEdgeA = new Int32Array(0);
let gridEdgeB = new Int32Array(0);
let gridEdgeRest = new Float32Array(0);
let GRID_EDGE_N = 0;
/** Queued one-shot impulses: {at, x, y, r, str} — never continuous forces. */
const gridImpulses = [];
let gridBusyUntil = 0;
let gridTestUntilMs = 0;
let gridTestRandState = 0x6D2B79F5;
// Keep this object static so the FPS test doesn't allocate per frame.
const GRID_TEST_SHOCK_OPTS = {
  amp: 16 * RES_SCALE * 3,
  width: 110,
  ripple: 0,
  freq: 0,
  inward: false,
  rot: 0,
  ironWake: false
};
function nextGridTestShockPos() {
  // Tiny LCG keeps the test deterministic-ish and allocation-free.
  gridTestRandState = (Math.imul(gridTestRandState, 1664525) + 1013904223) >>> 0;
  const rx = gridTestRandState / 4294967296;
  gridTestRandState = (Math.imul(gridTestRandState, 1664525) + 1013904223) >>> 0;
  const ry = gridTestRandState / 4294967296;
  const step = Math.max(2, Number(cv('cl_grid_size')) || GRID_STEP || 5);
  const cols = Math.max(1, Math.round(W / step));
  const rows = Math.max(1, Math.round(H / step));
  const col = Math.min(cols - 1, (rx * cols) | 0);
  const row = Math.min(rows - 1, (ry * rows) | 0);
  return {
    x: Math.min(W, (col + 0.5) * step),
    y: Math.min(H, (row + 0.5) * step)
  };
}
let lastGridMs = 0;
/** ms left running grid physics at half rate (30Hz). Reset to 1000 on any fps < 58. */
let gridHalvedRate = 0;
/** Accumulator for 30Hz grid steps while halved. */
let gridHalfAccumMs = 0;
const GRID_HALVED_HOLD_MS = 1000;
const GRID_HALVED_FPS = 30;
const GRID_FULL_FPS_FLOOR = 58;
/** Active material stamp while an impulse runs. */
let _gridStampE = null;
let _gridStampA = null;

function beginGridMaterialStamp(elasticity, anchor) {
  _gridStampE = Math.max(0, elasticity != null ? Number(elasticity) : GRID_ELASTICITY_DEFAULT);
  _gridStampA = Math.max(0, anchor != null ? Number(anchor) : GRID_ANCHOR_DEFAULT);
}

function endGridMaterialStamp() {
  _gridStampE = null;
  _gridStampA = null;
}

function stampGridHitNode(k) {
  if (_gridStampE == null) return;
  gridElasticity[k] = _gridStampE;
  gridAnchor[k] = _gridStampA;
}

function resetGridMaterials() {
  if (!GRID_N) return;
  gridElasticity.fill(GRID_ELASTICITY_DEFAULT);
  gridAnchor.fill(GRID_ANCHOR_DEFAULT);
}

/** Active lattice style from cl_grid (0=off). */
function gridTopoMode() {
  const v = cv('cl_grid') | 0;
  if (v <= 0) return 0;
  if (v >= 5) return 5;
  return v;
}

/** Spring/edge topology for warp mesh (centers/stars reuse square/hex springs). */
function gridPhysicsTopo(topo) {
  const t = topo | 0;
  if (t === 4) return 1; // square centers → square springs
  if (t === 5) return 2; // hex stars → hex springs
  return t;
}

/** Grid stroke width multiplier (1 = previous default thickness). */
function gridLineWidthMul() {
  const w = Number(cv('cl_grid_width'));
  return Math.max(0.05, Number.isFinite(w) ? w : 1);
}

function rebuildSynthGrid(step, opts) {
  opts = opts || {};
  let s = Number(step);
  if (!Number.isFinite(s) || s <= 0) s = 18;
  const topo = gridTopoMode() || 1;
  GRID_TOPO = topo;

  // Always keep a rectangular node lattice so bake warp covers the screen.
  // Topo only changes springs + painted / live edge pattern.
  let cols = Math.ceil((W + 2 * GRID_PAD) / s) + 1;
  let rows = Math.ceil((H + 2 * GRID_PAD) / s) + 1;
  while (cols * rows > GRID_N_SOFT_CAP && s < 200) {
    s += 1;
    cols = Math.ceil((W + 2 * GRID_PAD) / s) + 1;
    rows = Math.ceil((H + 2 * GRID_PAD) / s) + 1;
  }

  GRID_STEP = s;
  GRID_SPRING_REST = s;
  GRID_COLS = cols;
  GRID_ROWS = rows;
  GRID_N = cols * rows;
  gridBaseX = new Float32Array(GRID_N);
  gridBaseY = new Float32Array(GRID_N);
  gridDefX = new Float32Array(GRID_N);
  gridDefY = new Float32Array(GRID_N);
  gridVelX = new Float32Array(GRID_N);
  gridVelY = new Float32Array(GRID_N);
  gridFx = new Float32Array(GRID_N);
  gridFy = new Float32Array(GRID_N);
  gridInvMass = new Float32Array(GRID_N);
  gridStaticPin = new Uint8Array(GRID_N);
  gridElasticity = new Float32Array(GRID_N);
  gridAnchor = new Float32Array(GRID_N);

  for (let j = 0; j < GRID_ROWS; j++) {
    for (let i = 0; i < GRID_COLS; i++) {
      const k = j * GRID_COLS + i;
      const x = GRID_OX + i * GRID_STEP;
      const y = GRID_OY + j * GRID_STEP;
      gridBaseX[k] = x;
      gridBaseY[k] = y;
      gridDefX[k] = x;
      gridDefY[k] = y;
      const border = i === 0 || j === 0 || i === GRID_COLS - 1 || j === GRID_ROWS - 1;
      gridStaticPin[k] = border ? 1 : 0;
      gridInvMass[k] = border ? 0 : 1;
    }
  }
  applyGridStaticPins();

  buildGridEdges(gridPhysicsTopo(topo));
  gridLineScratch = new Float32Array(Math.max(GRID_COLS, GRID_ROWS, GRID_EDGE_N * 2) * 2);
  resetGridMaterials();
  gridImpulses.length = 0;
  gridBusyUntil = 0;
  // Bake mode keeps cl_grid_size as visual line spacing (not warp step).
  if (!opts.keepCvar && CVARS.cl_grid_size) CVARS.cl_grid_size.value = GRID_STEP;
  invalidateGridBake();
}

/** Spawn pad lock radius (world px) — punches leave these nodes flat. */
const GRID_PIN_SPAWN_R = 20;

/** PvP sport marks only — waves / menu / queue leave the mesh free. */
function shouldPinSportGridMarks() {
  // inGame / practiceMode are declared later; typeof still throws in TDZ at boot.
  try {
    return !!(inGame && !practiceMode);
  } catch (_) {
    return false;
  }
}

/** Reset non-border pins, then re-apply sport pins if PvP. */
function refreshGridStaticPins() {
  if (!GRID_N || !GRID_COLS) return;
  for (let k = 0; k < GRID_N; k++) {
    const i = k % GRID_COLS;
    const j = (k / GRID_COLS) | 0;
    const border = i === 0 || j === 0 || i === GRID_COLS - 1 || j === GRID_ROWS - 1;
    gridStaticPin[k] = border ? 1 : 0;
    gridInvMass[k] = border ? 0 : 1;
  }
  applyGridStaticPins();
}

/** Pin midfield star + spawn discs (PvP sport markings only). */
function applyGridStaticPins() {
  if (!GRID_N) return;
  if (!shouldPinSportGridMarks()) return;
  const cx = W * 0.5;
  const cy = H * 0.5;
  const rStar = Math.min(W, H) * 0.14;
  const rStar2 = rStar * rStar;
  const starVerts = buildStarPolyFlat(cx, cy, 5, rStar, rStar * 0.38, 0);
  const pinR2 = GRID_PIN_SPAWN_R * GRID_PIN_SPAWN_R;
  const sx0 = cx - SPAWN_CENTER_OFFSET;
  const sx1 = cx + SPAWN_CENTER_OFFSET;
  for (let k = 0; k < GRID_N; k++) {
    if (gridStaticPin[k]) continue;
    const x = gridBaseX[k];
    const y = gridBaseY[k];
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= rStar2 && pointInPolyFlat(x, y, starVerts)) {
      gridStaticPin[k] = 1;
      gridInvMass[k] = 0;
      continue;
    }
    const d0x = x - sx0;
    const d0y = y - cy;
    if (d0x * d0x + d0y * d0y <= pinR2) {
      gridStaticPin[k] = 1;
      gridInvMass[k] = 0;
      continue;
    }
    const d1x = x - sx1;
    const d1y = y - cy;
    if (d1x * d1x + d1y * d1y <= pinR2) {
      gridStaticPin[k] = 1;
      gridInvMass[k] = 0;
    }
  }
}

/**
 * Asteroids iron the mesh: nodes under a rock pin while covered.
 * Warp is 2D (XY only — bake shader has no Z). Small Y dent for visibility;
 * corridor scars were from shared iron-poly corruption, not this offset.
 */
const GRID_IRON_Y_OFFSET = 3;
const GRID_IRON_SPD_LO = 1;
const GRID_IRON_SPD_HI = 5;
const GRID_IRON_INTERVAL_MAX = 15; // ticks at slow end
const GRID_IRON_INTERVAL_MIN = 2;  // ticks at fast end (speed ≥ 5)
/** Force iron resample if rock jumped farther than this (wrap / portal / spawn). */
const GRID_IRON_TELEPORT_PX = 40;
let gridIronClock = 0;

function asteroidGridIronInterval(spd) {
  const s = Math.max(GRID_IRON_SPD_LO, Math.min(GRID_IRON_SPD_HI, spd));
  const u = (s - GRID_IRON_SPD_LO) / (GRID_IRON_SPD_HI - GRID_IRON_SPD_LO);
  return Math.round(GRID_IRON_INTERVAL_MAX + (GRID_IRON_INTERVAL_MIN - GRID_IRON_INTERVAL_MAX) * u);
}

/** Drop cached iron poly so the next pass rebuilds from the live pose. */
function clearAsteroidGridIron(a) {
  if (!a) return;
  a._ironAt = null;
  a._ironPoly = null;
  a._ironCx = null;
  a._ironCy = null;
}

/** Clear iron resample cooldowns so every asteroid checks on the next iron pass. */
function forceAsteroidGridIronRecheck() {
  if (typeof asteroids === 'undefined' || !asteroids.size) return;
  for (const a of asteroids.values()) clearAsteroidGridIron(a);
}

/** Pinned asteroid-iron pose: X at rest, Y dented slightly down. */
function gridIronPinnedPose(k) {
  gridDefX[k] = gridBaseX[k];
  gridDefY[k] = gridBaseY[k] + GRID_IRON_Y_OFFSET;
  gridVelX[k] = 0;
  gridVelY[k] = 0;
}

/**
 * Own a copy of worldVerts — never store the shared worldVertScratch view.
 * That shared buffer was overwritten by the next rock and could stamp wrong polys.
 */
function cacheAsteroidIronPoly(a, x, y, angle, sil) {
  const src = worldVerts(x, y, angle, sil);
  const n = src.length;
  if (!a._ironPolyBuf || a._ironPolyBuf.length < n) a._ironPolyBuf = new Float32Array(n);
  a._ironPolyBuf.set(src.length === n ? src : src.subarray(0, n), 0);
  a._ironPoly = n === a._ironPolyBuf.length ? a._ironPolyBuf : a._ironPolyBuf.subarray(0, n);
  a._ironCx = x;
  a._ironCy = y;
}

/**
 * Iron nodes whose rest pose lies inside the asteroid silhouette (polygon-perfect).
 * Cost is fine: bbox cells only × ~8–14 outline edges, throttled by iron interval.
 */
function stampAsteroidGridIronPoly(verts) {
  if (!verts || verts.length < 6) return;
  let minX = verts[0], maxX = verts[0], minY = verts[1], maxY = verts[1];
  for (let i = 2; i < verts.length; i += 2) {
    const x = verts[i], y = verts[i + 1];
    if (x < minX) minX = x;
    else if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    else if (y > maxY) maxY = y;
  }
  // Reject absurd bboxes (wrap/corrupt poly spanning the arena → full-field scar).
  if ((maxX - minX) > W * 0.55 || (maxY - minY) > H * 0.55) return;
  const inv = 1 / GRID_STEP;
  const i0 = Math.max(0, ((minX - GRID_OX) * inv) | 0);
  const i1 = Math.min(GRID_COLS - 1, Math.ceil((maxX - GRID_OX) * inv) | 0);
  const j0 = Math.max(0, ((minY - GRID_OY) * inv) | 0);
  const j1 = Math.min(GRID_ROWS - 1, Math.ceil((maxY - GRID_OY) * inv) | 0);
  for (let j = j0; j <= j1; j++) {
    const row = j * GRID_COLS;
    for (let i = i0; i <= i1; i++) {
      const k = row + i;
      if (gridStaticPin[k]) continue;
      if (!pointInPolyFlat(gridBaseX[k], gridBaseY[k], verts)) continue;
      gridInvMass[k] = 0;
      gridIronPinnedPose(k);
    }
  }
}

function applyAsteroidGridIron(dt) {
  if (!GRID_N) return;
  for (let k = 0; k < GRID_N; k++) {
    gridInvMass[k] = gridStaticPin[k] ? 0 : 1;
  }
  if (typeof asteroids === 'undefined' || !asteroids.size) return;
  gridIronClock += (dt > 0 ? dt : 0.016) * TPS;
  const tick = gridIronClock;
  for (const a of asteroids.values()) {
    const pos = asteroidAt(a);
    const spd = Math.hypot(a.vx || 0, a.vy || 0);
    const interval = asteroidGridIronInterval(spd);
    let need = a._ironAt == null || tick >= a._ironAt || !a._ironPoly;
    if (!need && a._ironCx != null && a._ironCy != null) {
      const jx = pos.x - a._ironCx;
      const jy = pos.y - a._ironCy;
      if (jx * jx + jy * jy > GRID_IRON_TELEPORT_PX * GRID_IRON_TELEPORT_PX) need = true;
    }
    if (need) {
      const sil = asteroidCollisionPts(a);
      cacheAsteroidIronPoly(a, pos.x, pos.y, pos.angle, sil);
      a._ironAt = tick + interval;
    }
    if (!a._ironPoly) continue;
    stampAsteroidGridIronPoly(a._ironPoly);
  }
}

/** Build spring/draw edges for the active topology. */
function buildGridEdges(topo) {
  const maxEdges = GRID_COLS * GRID_ROWS * 5;
  const tmpA = new Int32Array(maxEdges);
  const tmpB = new Int32Array(maxEdges);
  const tmpR = new Float32Array(maxEdges);
  let n = 0;
  const add = (a, b) => {
    if (a < 0 || b < 0 || a >= GRID_N || b >= GRID_N || a === b) return;
    const dx = gridBaseX[b] - gridBaseX[a];
    const dy = gridBaseY[b] - gridBaseY[a];
    const rest = Math.sqrt(dx * dx + dy * dy);
    if (!(rest > 1e-4)) return;
    tmpA[n] = a;
    tmpB[n] = b;
    tmpR[n] = rest;
    n++;
  };
  const idx = (i, j) => j * GRID_COLS + i;

  // Horizontal + vertical (square / hex base).
  for (let j = 0; j < GRID_ROWS; j++) {
    for (let i = 0; i < GRID_COLS - 1; i++) add(idx(i, j), idx(i + 1, j));
  }
  for (let j = 0; j < GRID_ROWS - 1; j++) {
    for (let i = 0; i < GRID_COLS; i++) add(idx(i, j), idx(i, j + 1));
  }
  // Triangle: add both diagonals. Hex: add one diagonal set for a zigzag look.
  if (topo === 3) {
    for (let j = 0; j < GRID_ROWS - 1; j++) {
      for (let i = 0; i < GRID_COLS - 1; i++) {
        add(idx(i, j), idx(i + 1, j + 1));
        add(idx(i + 1, j), idx(i, j + 1));
      }
    }
  } else if (topo === 2) {
    for (let j = 0; j < GRID_ROWS - 1; j++) {
      for (let i = 0; i < GRID_COLS - 1; i++) {
        if (((i + j) & 1) === 0) add(idx(i, j), idx(i + 1, j + 1));
        else add(idx(i + 1, j), idx(i, j + 1));
      }
    }
  }

  GRID_EDGE_N = n;
  gridEdgeA = new Int32Array(n);
  gridEdgeB = new Int32Array(n);
  gridEdgeRest = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gridEdgeA[i] = tmpA[i];
    gridEdgeB[i] = tmpB[i];
    gridEdgeRest[i] = tmpR[i];
  }
}

/** Live lines use cl_grid_size as mesh; bake uses quality warp + fine baked lines. */
function applyGridModeFromCvars() {
  if ((cv('cl_background_bake') | 0) !== 0) {
    rebuildSynthGrid(bakeWarpStepFromQuality(), { keepCvar: true });
  } else {
    rebuildSynthGrid(Math.max(2, cv('cl_grid_size') || 5));
  }
}

applyGridModeFromCvars();

function resetSynthGrid() {
  if (!GRID_N) return;
  gridVelX.fill(0);
  gridVelY.fill(0);
  gridFx.fill(0);
  gridFy.fill(0);
  for (let k = 0; k < GRID_N; k++) {
    gridDefX[k] = gridBaseX[k];
    gridDefY[k] = gridBaseY[k];
  }
  resetGridMaterials();
  gridImpulses.length = 0;
  gridBusyUntil = 0;
}

/** Radius from (gx,gy) that covers every synth-grid node (incl. padding). */
function gridFullCoverRadius(gx, gy) {
  if (!GRID_N) return Math.hypot(W, H);
  let best = 0;
  for (let k = 0; k < GRID_N; k++) {
    const d = Math.hypot(gx - gridBaseX[k], gy - gridBaseY[k]);
    if (d > best) best = d;
  }
  return best + GRID_STEP;
}

/**
 * Radial punch. outward = stretch cells open (hole); inward = gather sheet
 * toward the epicenter (compress cells), strongest from the rim.
 */
function impulseGridRadial(gx, gy, distance, strength, inward) {
  if (!(strength > 0) || !(distance > 0)) return;
  const r2 = distance * distance;
  // Implosion needs a harder yank — outward divergence stretches cells easily,
  // inward convergence was visually ~5× weaker with the same open budget.
  const open = Math.min(
    GRID_STEP * (inward ? 7.5 : 3.1),
    strength * (inward ? 0.14 : 0.06)
  );
  const kickMul = inward ? 1.85 : 1;
  const dir = inward ? -1 : 1;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const dx = gridBaseX[k] - gx;
    const dy = gridBaseY[k] - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const u = d / distance; // 0 center → 1 rim
    // Explosion: dig middle. Implosion: outer sheet races inward past neighbors.
    const w = inward
      ? u * (0.2 + 0.8 * u * u) // steep rim ramp → strong compression gradient
      : (1 - u) * (1 - u) * (1 - u);
    const nx = dx / d;
    const ny = dy / d;
    const disp = open * w;
    gridDefX[k] += nx * dir * disp;
    gridDefY[k] += ny * dir * disp;
    const kick = strength * w * kickMul;
    gridVelX[k] += nx * dir * kick;
    gridVelY[k] += ny * dir * kick;
    stampGridHitNode(k);
  }
}

/**
 * Directional wind: every free node inside the radius is shoved along (dirX, dirY).
 * Falloff is radial (stronger at center), but motion is parallel — not radial.
 * inward flips the blow (suck opposite the given direction).
 */
function impulseGridDirectional(gx, gy, distance, strength, inward, dirX, dirY) {
  if (!(strength > 0) || !(distance > 0)) return;
  let dl = Math.hypot(dirX, dirY);
  if (!(dl > 1e-6)) return;
  dirX /= dl;
  dirY /= dl;
  const sign = inward ? -1 : 1;
  const ix = dirX * sign;
  const iy = dirY * sign;
  const r2 = distance * distance;
  const open = Math.min(GRID_STEP * 3.2, strength * 0.08);
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const dx = gridBaseX[k] - gx;
    const dy = gridBaseY[k] - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    const d = Math.sqrt(d2);
    const u = d / distance; // 0 center → 1 rim
    const w = (1 - u) * (1 - u);
    if (w <= 1e-5) continue;
    gridDefX[k] += ix * open * w;
    gridDefY[k] += iy * open * w;
    const kick = strength * w;
    gridVelX[k] += ix * kick;
    gridVelY[k] += iy * kick;
    stampGridHitNode(k);
  }
}

/**
 * Thin annular velocity wave. Outward ripples expand; inward ripples contract.
 * With dirX/dirY: same ring distances, but kick is parallel wind (not radial).
 */
function impulseGridRippleRing(gx, gy, radius, strength, bandWidth, inward, dirX, dirY) {
  if (!(strength > 0) || !(radius > 0)) return;
  const band = Math.max(GRID_STEP * 1.5, bandWidth || GRID_STEP * 2.5);
  const inner = Math.max(0, radius - band);
  const outer = radius + band;
  const inner2 = inner * inner;
  const outer2 = outer * outer;
  const sign = inward ? -1 : 1;
  const ringMul = inward ? 1.7 : 1;
  let useDir = false;
  let dxn = 0;
  let dyn = 0;
  if (dirX != null && dirY != null) {
    const dl = Math.hypot(dirX, dirY);
    if (dl > 1e-6) {
      useDir = true;
      dxn = (dirX / dl) * sign;
      dyn = (dirY / dl) * sign;
    }
  }
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const dx = gridBaseX[k] - gx;
    const dy = gridBaseY[k] - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 < inner2 || d2 > outer2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const u = (d - radius) / band;
    const w = Math.max(0, 1 - u * u);
    if (w <= 0) continue;
    const kick = strength * w * ringMul;
    if (useDir) {
      gridVelX[k] += dxn * kick;
      gridVelY[k] += dyn * kick;
    } else {
      gridVelX[k] += (dx / d) * sign * kick;
      gridVelY[k] += (dy / d) * sign * kick;
    }
    stampGridHitNode(k);
  }
}

/** Closest point on segment A→B to (px,py). */
function closestOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  let t = 0;
  if (ab2 > 1e-8) {
    t = ((px - ax) * abx + (py - ay) * aby) / ab2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { cx, cy, t, dx: px - cx, dy: py - cy };
}

/**
 * Capsule blast along segment A→B. Falloff by distance to the line.
 * Explosion pushes off the axis; implosion pulls toward it.
 */
function impulseGridLine(ax, ay, bx, by, distance, strength, inward) {
  if (!(strength > 0) || !(distance > 0)) return;
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-3) {
    impulseGridRadial(ax, ay, distance, strength, inward);
    return;
  }
  const r2 = distance * distance;
  const open = Math.min(
    GRID_STEP * (inward ? 7.5 : 3.1),
    strength * (inward ? 0.14 : 0.06)
  );
  const kickMul = inward ? 1.85 : 1;
  const sign = inward ? -1 : 1;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const hit = closestOnSegment(gridBaseX[k], gridBaseY[k], ax, ay, bx, by);
    const d2 = hit.dx * hit.dx + hit.dy * hit.dy;
    if (d2 >= r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const u = d / distance;
    const w = inward
      ? u * (0.2 + 0.8 * u * u)
      : (1 - u) * (1 - u) * (1 - u);
    const nx = hit.dx / d;
    const ny = hit.dy / d;
    const disp = open * w;
    gridDefX[k] += nx * sign * disp;
    gridDefY[k] += ny * sign * disp;
    const kick = strength * w * kickMul;
    gridVelX[k] += nx * sign * kick;
    gridVelY[k] += ny * sign * kick;
    stampGridHitNode(k);
  }
}

/** Annular band by distance-to-line (cylindrical ripple along the segment). */
function impulseGridLineRipple(ax, ay, bx, by, radius, strength, bandWidth, inward) {
  if (!(strength > 0) || !(radius > 0)) return;
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-3) {
    impulseGridRippleRing(ax, ay, radius, strength, bandWidth, inward);
    return;
  }
  const band = Math.max(GRID_STEP * 1.5, bandWidth || GRID_STEP * 2.5);
  const inner = Math.max(0, radius - band);
  const outer = radius + band;
  const sign = inward ? -1 : 1;
  const ringMul = inward ? 1.7 : 1;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const hit = closestOnSegment(gridBaseX[k], gridBaseY[k], ax, ay, bx, by);
    const d = Math.hypot(hit.dx, hit.dy);
    if (d < inner || d > outer || d < 1e-6) continue;
    const u = (d - radius) / band;
    const w = Math.max(0, 1 - u * u);
    if (w <= 0) continue;
    const nx = hit.dx / d;
    const ny = hit.dy / d;
    const kick = strength * w * ringMul;
    gridVelX[k] += nx * sign * kick;
    gridVelY[k] += ny * sign * kick;
    stampGridHitNode(k);
  }
}

function pointInPolyFlat(px, py, verts) {
  let inside = false;
  const n = (verts.length / 2) | 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = verts[i * 2];
    const yi = verts[i * 2 + 1];
    const xj = verts[j * 2];
    const yj = verts[j * 2 + 1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function buildRegularPolyFlat(gx, gy, sides, radius, rot) {
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    out.push(gx + Math.cos(a) * radius, gy + Math.sin(a) * radius);
  }
  return out;
}

function buildStarPolyFlat(gx, gy, points, outerR, innerR, rot) {
  const out = [];
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = rot - Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = (i & 1) === 0 ? outerR : innerR;
    out.push(gx + Math.cos(a) * r, gy + Math.sin(a) * r);
  }
  return out;
}

/** Polygon outline for F1 shaped blasts (circumradius = radius). */
function gridShapePolyVerts(shape, gx, gy, radius, rot) {
  if (!(radius > 0)) return null;
  if (shape === 'square') return buildRegularPolyFlat(gx, gy, 4, radius, rot + Math.PI / 4);
  if (shape === 'hexagon') return buildRegularPolyFlat(gx, gy, 6, radius, rot);
  if (shape === 'star') return buildStarPolyFlat(gx, gy, 5, radius, radius * 0.38, rot);
  return null;
}

/** Nine spokes: random angles, length in [0.4R, R]. */
function makeGridRayBurst(radius) {
  const rays = [];
  const rMin = radius * 0.4;
  const span = Math.max(0, radius - rMin);
  for (let i = 0; i < 9; i++) {
    rays.push({
      ang: Math.random() * Math.PI * 2,
      len: rMin + Math.random() * span
    });
  }
  return rays;
}

/**
 * Same radial punch as impulseGridRadial, but only nodes inside `verts`.
 */
function impulseGridPolygon(gx, gy, distance, strength, inward, verts) {
  if (!(strength > 0) || !(distance > 0) || !verts || verts.length < 6) return;
  const r2 = distance * distance;
  const open = Math.min(
    GRID_STEP * (inward ? 7.5 : 3.1),
    strength * (inward ? 0.14 : 0.06)
  );
  const kickMul = inward ? 1.85 : 1;
  const dir = inward ? -1 : 1;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const bx = gridBaseX[k];
    const by = gridBaseY[k];
    if (!pointInPolyFlat(bx, by, verts)) continue;
    const dx = bx - gx;
    const dy = by - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const u = d / distance;
    const w = inward
      ? u * (0.2 + 0.8 * u * u)
      : (1 - u) * (1 - u) * (1 - u);
    const nx = dx / d;
    const ny = dy / d;
    const disp = open * w;
    gridDefX[k] += nx * dir * disp;
    gridDefY[k] += ny * dir * disp;
    const kick = strength * w * kickMul;
    gridVelX[k] += nx * dir * kick;
    gridVelY[k] += ny * dir * kick;
    stampGridHitNode(k);
  }
}

/** Expanding ring clipped to a polygon (verts already sized to ~radius). */
function impulseGridPolygonRipple(gx, gy, radius, strength, bandWidth, inward, verts) {
  if (!(strength > 0) || !(radius > 0) || !verts || verts.length < 6) return;
  const band = Math.max(GRID_STEP * 1.5, bandWidth || GRID_STEP * 2.5);
  const inner = Math.max(0, radius - band);
  const outer = radius + band;
  const inner2 = inner * inner;
  const outer2 = outer * outer;
  const sign = inward ? -1 : 1;
  const ringMul = inward ? 1.7 : 1;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const bx = gridBaseX[k];
    const by = gridBaseY[k];
    if (!pointInPolyFlat(bx, by, verts)) continue;
    const dx = bx - gx;
    const dy = by - gy;
    const d2 = dx * dx + dy * dy;
    if (d2 < inner2 || d2 > outer2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const u = (d - radius) / band;
    const w = Math.max(0, 1 - u * u);
    if (w <= 0) continue;
    const nx = dx / d;
    const ny = dy / d;
    const kick = strength * w * ringMul;
    gridVelX[k] += nx * sign * kick;
    gridVelY[k] += ny * sign * kick;
    stampGridHitNode(k);
  }
}

function impulseGridRays(gx, gy, strength, inward, rays, thick) {
  if (!(strength > 0) || !rays || !rays.length || !(thick > 0)) return;
  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    const len = ray.len;
    if (!(len > 1e-3)) continue;
    const x1 = gx + Math.cos(ray.ang) * len;
    const y1 = gy + Math.sin(ray.ang) * len;
    impulseGridLine(gx, gy, x1, y1, thick, strength, inward);
  }
}

/**
 * Blast params are per-call (opts). Mesh elasticity/anchor are per-node locals
 * stamped by each blast via opts.elasticity / opts.anchor (defaults 300 / 5).
 * opts: amp, width, ripple (power), freq (ripple timing), inward, dirX, dirY,
 *       elasticity, anchor
 * Line: opts.x1, opts.y1 (with x,y as other endpoint) → capsule blast.
 * Shape: opts.shape = square|star|hexagon|rays|full (+ optional rot / rays).
 * full = radial punch covering the entire synth grid (radius slider ignored).
 */
function pushGridShock(x, y, opts) {
  opts = opts || {};
  const amp = opts.amp != null ? opts.amp : 28 * RES_SCALE;
  const width = opts.width != null ? opts.width : 56;
  const rippleMul = opts.ripple != null ? Math.max(0, opts.ripple) : 1;
  // freq <= 0 disables follow-up rings for this blast. >0 scales shell timing (1 = default).
  const rawFreq = opts.freq != null ? Number(opts.freq) : 1;
  const rippleOn = rippleMul > 0 && rawFreq > 0;
  const rippleFreq = rippleOn ? Math.max(0.15, rawFreq) : 0;
  const inward = !!opts.inward;
  const dirX = opts.dirX;
  const dirY = opts.dirY;
  const x1 = opts.x1;
  const y1 = opts.y1;
  const shape = opts.shape || null;
  const isFull = shape === 'full';
  const isPoly = shape === 'square' || shape === 'star' || shape === 'hexagon';
  const isRays = shape === 'rays';
  const rot = opts.rot != null ? opts.rot : Math.random() * Math.PI * 2;
  const isLine = !isFull && !isPoly && !isRays && x1 != null && y1 != null && Math.hypot(x1 - x, y1 - y) > 1e-3;
  const directional = !isFull && !isPoly && !isRays && !isLine && dirX != null && dirY != null && Math.hypot(dirX, dirY) > 1e-6;
  if (!(amp > 0)) return;
  if (!isFull && !(width > 0)) return;
  // width is the blast radius in world px (no hidden floor — F1 radius 0 stays tiny).
  // full ignores width and covers every free node from the epicenter.
  const dist = isFull ? gridFullCoverRadius(x, y) : width;
  if (!(dist > 0)) return;
  const now = performance.now();
  const strength = Math.min(680, amp * 12);
  let rays = opts.rays || null;
  const rayThick = isRays ? Math.max(GRID_STEP * 1.25, dist * 0.1) : 0;
  const matE = opts.elasticity != null ? opts.elasticity : GRID_ELASTICITY_DEFAULT;
  const matA = opts.anchor != null ? opts.anchor : GRID_ANCHOR_DEFAULT;

  beginGridMaterialStamp(matE, matA);
  if (isLine) impulseGridLine(x, y, x1, y1, dist, strength, inward);
  else if (isRays) {
    if (!rays) rays = makeGridRayBurst(dist);
    impulseGridRays(x, y, strength, inward, rays, rayThick);
  } else if (isPoly) {
    const verts = gridShapePolyVerts(shape, x, y, dist, rot);
    impulseGridPolygon(x, y, dist, strength, inward, verts);
  } else if (directional) impulseGridDirectional(x, y, dist, strength, inward, dirX, dirY);
  else impulseGridRadial(x, y, dist, strength, inward);
  endGridMaterialStamp();

  // Bake-space alpha ring (UV lighting) — explosions / ray blasts, not thrust lines.
  if (
    opts.alphaRipple
    || (!isLine && !directional && !isPoly && amp >= 6 * RES_SCALE)
    || (isRays && amp >= 3 * RES_SCALE)
    || (isFull && amp >= 3 * RES_SCALE)
  ) {
    pushGridAlphaRipple(x, y, {
      r0: 0,
      r1: Math.max(dist * 1.55, 200 * RES_SCALE),
      width: GRID_ALPHA_RIPPLE_WIDTH,
      life: 680 + Math.min(400, dist * 0.8),
      amp: opts.alphaAmp != null ? opts.alphaAmp : 1.4
    });
  }

  if (rippleOn) {
    const band = Math.max(GRID_STEP * 2.2, width * 0.28);
    const shells = inward
      ? [
        { delay: 50, scale: 1.3, mul: 0.5 },
        { delay: 110, scale: 0.95, mul: 0.38 },
        { delay: 185, scale: 0.65, mul: 0.26 },
        { delay: 280, scale: 0.35, mul: 0.15 }
      ]
      : [
        { delay: 50, scale: 0.4, mul: 0.5 },
        { delay: 110, scale: 0.65, mul: 0.38 },
        { delay: 185, scale: 0.95, mul: 0.26 },
        { delay: 280, scale: 1.3, mul: 0.15 }
      ];
    let lastAt = now;
    for (let i = 0; i < shells.length; i++) {
      const s = shells[i];
      const at = now + s.delay / rippleFreq;
      lastAt = at;
      const imp = {
        at,
        x, y,
        r: dist * s.scale,
        str: strength * s.mul * rippleMul * 0.55,
        ripple: 1,
        band,
        inward: inward ? 1 : 0,
        elasticity: matE,
        anchor: matA
      };
      if (isLine) {
        imp.line = 1;
        imp.x1 = x1;
        imp.y1 = y1;
      } else if (isRays) {
        imp.rays = rays;
        imp.rayThick = rayThick;
        imp.lenScale = s.scale;
      } else if (isPoly) {
        imp.poly = 1;
        imp.shape = shape;
        imp.rot = rot;
      } else if (directional) {
        imp.dirX = dirX;
        imp.dirY = dirY;
      }
      gridImpulses.push(imp);
    }
    if (gridImpulses.length > 64) gridImpulses.splice(0, gridImpulses.length - 64);
    gridBusyUntil = Math.max(gridBusyUntil, lastAt + 900);
  } else {
    gridBusyUntil = Math.max(gridBusyUntil, now + 1100);
  }
  // Explosions / rail / etc.: all asteroids re-iron on the next grid step after this punch.
  if (opts.ironWake !== false) forceAsteroidGridIronRecheck();
}

/** Blast type 1 — asteroid destroy. F1: rays implosion amp0.4 ripple2.45 freq0.95 r122.
 *  Width 122 = max ray length for a *small* asteroid; larger rocks scale from that. */
const GRID_BLAST_ASTEROID_R_SMALL = 122;
const ASTEROID_R_SMALL = 9 * RES_SCALE * 1.35;

function gridBlastAsteroidOpts(r) {
  const ar = Math.max(1e-3, r != null ? r : ASTEROID_R_SMALL);
  const scale = ar / ASTEROID_R_SMALL;
  return {
    shape: 'rays',
    amp: 16 * RES_SCALE * 0.4,
    width: GRID_BLAST_ASTEROID_R_SMALL * scale,
    ripple: 2.45,
    freq: 0.95,
    inward: true
  };
}

/** Railgun beam — line implosion, no ripple (hardcoded F1 tune). */
function gridBlastRailOpts(x0, y0, x1, y1) {
  return {
    amp: 16 * RES_SCALE * 3,
    width: 8,
    ripple: 0,
    freq: 0,
    inward: true,
    x1, y1
  };
}

/** Laser hitscan — line explosion (amp 0.15, r1, ripple 3 / freq 1.75). */
function gridBlastLaserOpts(x0, y0, x1, y1) {
  return {
    amp: 16 * RES_SCALE * 0.15,
    width: 1,
    ripple: 3,
    freq: 1.75,
    inward: false,
    x1, y1
  };
}

/** Rocket impact — radial explosion, no ripple (hardcoded F1 tune). */
function gridBlastRocketOpts() {
  return {
    amp: 16 * RES_SCALE * 3,
    width: 101,
    ripple: 0,
    freq: 0,
    inward: false
  };
}

/** Normal / shotgun bullet flight — directional wind along velocity. */
function gridBlastBulletTrailOpts(vx, vy) {
  const spd = Math.hypot(vx, vy);
  if (!(spd > 1e-6)) return null;
  return {
    amp: 16 * RES_SCALE * 3 * 5, // amp × dir_power
    width: 5,
    ripple: 0,
    freq: 0,
    inward: false,
    dirX: vx / spd,
    dirY: vy / spd
  };
}

/** Rocket flight — directional implosion along velocity (amp3, r1, dir_power0.25, ripple). */
function gridBlastRocketTrailOpts(vx, vy) {
  const spd = Math.hypot(vx, vy);
  if (!(spd > 1e-6)) return null;
  return {
    amp: 16 * RES_SCALE * 3 * 0.25,
    width: 1,
    ripple: 3,
    freq: 1.75,
    inward: true,
    dirX: vx / spd,
    dirY: vy / spd
  };
}

/** Local thrust — directional implosion. F1: amp0.4 ripple3 freq1.75 r3 dir_power0.1. */
function gridBlastThrustOpts(angle) {
  return {
    amp: 16 * RES_SCALE * 0.4 * 0.1,
    width: 3,
    ripple: 3,
    freq: 1.75,
    inward: true,
    dirX: Math.cos(angle),
    dirY: Math.sin(angle)
  };
}

/** While thrusting: directional implosion at ship every frame. */
function tickThrustGrid(thrusting, x, y, angle) {
  if (!thrusting) return;
  pushGridShock(x, y, Object.assign(gridBlastThrustOpts(angle), { ironWake: false }));
}

function clearGridShocks() {
  resetSynthGrid();
}

function flushGridImpulses(now) {
  let applied = false;
  for (let i = gridImpulses.length - 1; i >= 0; i--) {
    const imp = gridImpulses[i];
    if (now < imp.at) continue;
    beginGridMaterialStamp(imp.elasticity, imp.anchor);
    if (imp.rays) {
      const scale = imp.lenScale != null ? imp.lenScale : 1;
      const scaled = [];
      for (let r = 0; r < imp.rays.length; r++) {
        scaled.push({ ang: imp.rays[r].ang, len: imp.rays[r].len * scale });
      }
      impulseGridRays(imp.x, imp.y, imp.str, !!imp.inward, scaled, imp.rayThick || GRID_STEP);
    } else if (imp.poly && imp.shape) {
      const verts = gridShapePolyVerts(imp.shape, imp.x, imp.y, imp.r, imp.rot || 0);
      if (imp.ripple) impulseGridPolygonRipple(imp.x, imp.y, imp.r, imp.str, imp.band, !!imp.inward, verts);
      else impulseGridPolygon(imp.x, imp.y, imp.r, imp.str, !!imp.inward, verts);
    } else if (imp.line && imp.ripple) {
      impulseGridLineRipple(imp.x, imp.y, imp.x1, imp.y1, imp.r, imp.str, imp.band, !!imp.inward);
    } else if (imp.line) {
      impulseGridLine(imp.x, imp.y, imp.x1, imp.y1, imp.r, imp.str, !!imp.inward);
    } else if (imp.ripple) {
      impulseGridRippleRing(imp.x, imp.y, imp.r, imp.str, imp.band, !!imp.inward, imp.dirX, imp.dirY);
    } else if (imp.dirX != null && imp.dirY != null) {
      impulseGridDirectional(imp.x, imp.y, imp.r, imp.str, !!imp.inward, imp.dirX, imp.dirY);
    } else {
      impulseGridRadial(imp.x, imp.y, imp.r, imp.str, !!imp.inward);
    }
    endGridMaterialStamp();
    gridImpulses.splice(i, 1);
    applied = true;
  }
  if (applied) forceAsteroidGridIronRecheck();
}

function applyGridSprings() {
  const applyEdge = (a, b, rest) => {
    const dx = gridDefX[b] - gridDefX[a];
    const dy = gridDefY[b] - gridDefY[a];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-6) return;
    const stretch = dist - rest;
    const E = (gridElasticity[a] + gridElasticity[b]) * 0.5;
    const mag = (stretch / dist) * E;
    const fx = dx * mag;
    const fy = dy * mag;
    gridFx[a] += fx;
    gridFy[a] += fy;
    gridFx[b] -= fx;
    gridFy[b] -= fy;
  };
  for (let e = 0; e < GRID_EDGE_N; e++) {
    applyEdge(gridEdgeA[e], gridEdgeB[e], gridEdgeRest[e]);
  }
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const A = gridAnchor[k];
    gridFx[k] += (gridBaseX[k] - gridDefX[k]) * A;
    gridFy[k] += (gridBaseY[k] - gridDefY[k]) * A;
  }
}

function stepSynthGrid(dt, now) {
  if (dt <= 0) return;
  flushGridImpulses(now);
  applyAsteroidGridIron(dt);

  const busy = gridImpulses.length > 0 || now < gridBusyUntil;
  // Sleep: fully flat & still once motion dies out.
  if (!busy) {
    let awake = false;
    for (let k = 0; k < GRID_N; k++) {
      if (gridInvMass[k] <= 0) continue;
      const vx = gridVelX[k], vy = gridVelY[k];
      if (vx * vx + vy * vy > GRID_SLEEP_V2) { awake = true; break; }
      const ox = gridDefX[k] - gridBaseX[k];
      const oy = gridDefY[k] - gridBaseY[k];
      if (ox * ox + oy * oy > GRID_SLEEP_D2) { awake = true; break; }
    }
    if (!awake) {
      for (let k = 0; k < GRID_N; k++) {
        if (gridInvMass[k] <= 0 && !gridStaticPin[k]) {
          // Keep asteroid iron dent while covered.
          gridIronPinnedPose(k);
        } else {
          gridDefX[k] = gridBaseX[k];
          gridDefY[k] = gridBaseY[k];
          gridVelX[k] = 0;
          gridVelY[k] = 0;
        }
      }
      resetGridMaterials();
      return;
    }
  }

  const steps = 2;
  const h = dt / steps;
  const damp = Math.pow(GRID_DAMP, h * 60);
  const maxSpd = Math.max(0, cv('cl_grid_maxspeed')) * RES_SCALE;
  const maxSpd2 = maxSpd * maxSpd;
  const maxDisp = GRID_STEP * Math.max(0.05, cv('cl_grid_maxdisp'));
  const maxDisp2 = maxDisp * maxDisp;

  for (let step = 0; step < steps; step++) {
    gridFx.fill(0);
    gridFy.fill(0);
    applyGridSprings();

    for (let k = 0; k < GRID_N; k++) {
      if (gridInvMass[k] <= 0) {
        if (gridStaticPin[k]) {
          gridDefX[k] = gridBaseX[k];
          gridDefY[k] = gridBaseY[k];
          gridVelX[k] = 0;
          gridVelY[k] = 0;
        } else {
          gridIronPinnedPose(k);
        }
        continue;
      }
      gridVelX[k] += gridFx[k] * h;
      gridVelY[k] += gridFy[k] * h;
      gridVelX[k] *= damp;
      gridVelY[k] *= damp;
      const v2 = gridVelX[k] * gridVelX[k] + gridVelY[k] * gridVelY[k];
      if (v2 > maxSpd2) {
        const s = maxSpd / Math.sqrt(v2);
        gridVelX[k] *= s;
        gridVelY[k] *= s;
      }
      gridDefX[k] += gridVelX[k] * h;
      gridDefY[k] += gridVelY[k] * h;
      const ox = gridDefX[k] - gridBaseX[k];
      const oy = gridDefY[k] - gridBaseY[k];
      const d2 = ox * ox + oy * oy;
      if (d2 > maxDisp2) {
        const s = maxDisp / Math.sqrt(d2);
        gridDefX[k] = gridBaseX[k] + ox * s;
        gridDefY[k] = gridBaseY[k] + oy * s;
        gridVelX[k] *= 0.35;
        gridVelY[k] *= 0.35;
      }
    }
  }
}

/** Flat deformable lattice — square / hex / triangle from cl_grid. */
function drawSynthGrid(now) {
  const frameDtMs = lastGridMs ? Math.min(50, now - lastGridMs) : (1000 / 60);
  const dt = frameDtMs / 1000;
  lastGridMs = now;
  // Instant hitch → half-rate grid. Use smoothed HUD fps — raw frameDt often
  // spikes to ~33ms whenever the 60Hz lock skips a rAF beat, which falsely
  // tripped half-rate forever even when the game was solid 60.
  if (typeof fpsSmooth === 'number' && fpsSmooth > 0 && fpsSmooth < GRID_FULL_FPS_FLOOR) {
    gridHalvedRate = GRID_HALVED_HOLD_MS;
  }
  if (gridHalvedRate > 0) gridHalvedRate = Math.max(0, gridHalvedRate - frameDtMs);
  if (gridTestUntilMs > 0 && now >= gridTestUntilMs) {
    gridTestUntilMs = 0;
    // Reset the cvar so console shows "done".
    if (CVARS.cl_test_grid) CVARS.cl_test_grid.value = 0;
  }
  pruneBoomLights(now);
  tickNebulaScroll(dt);
  const night = nightModeActive();
  // Undistorted nebula underlay (same scroll as stroke nebula). Under the warp grid.
  if (!night && (cv('cl_bg_layer') | 0) !== 0) drawNebulaUnderlay();
  if (!gridTopoMode()) {
    if (!night && arenaLightShow) drawArenaLightShow(now);
    return;
  }
  if (gridTestUntilMs > now) {
    // Apply one random grid-aligned shock per frame while enabled.
    const p = nextGridTestShockPos();
    pushGridShock(p.x, p.y, GRID_TEST_SHOCK_OPTS);
  }
  let doGridStep = true;
  let gridStepDt = dt;
  if (gridHalvedRate > 0) {
    gridHalfAccumMs += frameDtMs;
    const interval = 1000 / GRID_HALVED_FPS;
    if (gridHalfAccumMs < interval) {
      doGridStep = false;
    } else {
      gridStepDt = Math.min(0.05, gridHalfAccumMs / 1000);
      gridHalfAccumMs = 0;
    }
  } else {
    gridHalfAccumMs = 0;
  }
  if (doGridStep) stepSynthGrid(gridStepDt, now);
  tickGodmodeSpawnRipples(dt);
  if ((cv('cl_background_bake') | 0) !== 0) {
    drawGridBaked();
    if (!night && arenaLightShow) drawArenaLightShow(now);
    return;
  }
  if (night) return; // Night needs baked flashlight path.
  gl.disable(gl.BLEND);
  try { gl.lineWidth(Math.max(1, getRenderScale() * gridLineWidthMul())); } catch (_) { gl.lineWidth(1); }
  const col = practiceMode
    ? [1, 1, 1]
    : [
      Math.max(0, Math.min(1, cv('cl_grid_color_r'))),
      Math.max(0, Math.min(1, cv('cl_grid_color_g'))),
      Math.max(0, Math.min(1, cv('cl_grid_color_b')))
    ];

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const alpha = Math.max(0, Math.min(1, Number(cv('cl_grid_alpha'))));
  const topoLive = gridTopoMode();
  if (topoLive === 4 || topoLive === 5) {
    drawLatticeMarksLive(col, alpha, topoLive);
  } else {
    const need = GRID_EDGE_N * 4;
    if (gridLineScratch.length < need) gridLineScratch = new Float32Array(need);
    let p = 0;
    for (let e = 0; e < GRID_EDGE_N; e++) {
      const a = gridEdgeA[e];
      const b = gridEdgeB[e];
      gridLineScratch[p++] = gridDefX[a];
      gridLineScratch[p++] = gridDefY[a];
      gridLineScratch[p++] = gridDefX[b];
      gridLineScratch[p++] = gridDefY[b];
    }
    if (p >= 4) {
      uploadVerts(gridLineScratch.subarray(0, p));
      useDraw(col, alpha);
      gl.drawArrays(gl.LINES, 0, p >> 1);
    }
  }
  gl.disable(gl.BLEND);
  if (arenaLightShow) drawArenaLightShow(now);
}

/** Pointy-top hexes centered on triangular-lattice nodes (Voronoi of the mesh). */
function drawLiveHexGrid(col, alpha) {
  // Kept for debug; live topo uses edge list from buildGridEdges.
  const R = GRID_STEP / Math.sqrt(3);
  const need = GRID_N * 6 * 4;
  if (gridLineScratch.length < need) gridLineScratch = new Float32Array(need);
  let p = 0;
  for (let k = 0; k < GRID_N; k++) {
    if (gridInvMass[k] <= 0) continue;
    const cx = gridDefX[k];
    const cy = gridDefY[k];
    let px = cx + R * Math.sin(0);
    let py = cy - R * Math.cos(0);
    for (let s = 1; s <= 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      const qx = cx + R * Math.sin(a);
      const qy = cy - R * Math.cos(a);
      gridLineScratch[p++] = px;
      gridLineScratch[p++] = py;
      gridLineScratch[p++] = qx;
      gridLineScratch[p++] = qy;
      px = qx;
      py = qy;
    }
  }
  if (p >= 4) {
    uploadVerts(gridLineScratch.subarray(0, p));
    useDraw(col, alpha);
    gl.drawArrays(gl.LINES, 0, p >> 1);
  }
}

function shader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}
function linkProgram(p) {
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
  }
  return p;
}
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
linkProgram(prog);

const uRes = gl.getUniformLocation(prog, 'uRes');
const uCol = gl.getUniformLocation(prog, 'uCol');
const uAlpha = gl.getUniformLocation(prog, 'uAlpha');
const uSize = gl.getUniformLocation(prog, 'uSize');
const aLoc = gl.getAttribLocation(prog, 'a');
const mainLightU = {
  night: gl.getUniformLocation(prog, 'uFlashNight'),
  ships: gl.getUniformLocation(prog, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(prog, 'uLightWrap')
};
const buf = gl.createBuffer();
/** GPU byte capacity of `buf` — grow via bufferData, refill via bufferSubData. */
let glMainBufBytes = 0;

/** Reused scratch so thick-line builds don't allocate every frame. */
let scratch = new Float32Array(8192);
/** Pixel-snapped copy for line uploads (avoids new Float32Array every draw). */
let snapScratch = new Float32Array(8192);

function growF32(buf, n) {
  if (buf.length >= n) return buf;
  let cap = buf.length || 256;
  while (cap < n) cap *= 2;
  return new Float32Array(cap);
}

function scratchEnsure(n) {
  scratch = growF32(scratch, n);
}

/** Upload `floatCount` floats from a pooled typed array without reallocating JS heaps. */
function uploadMainBuf(f32, floatCount) {
  const n = floatCount | 0;
  if (n <= 0) return;
  const bytes = n * 4;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  if (bytes > glMainBufBytes) {
    const cap = Math.max(bytes, glMainBufBytes > 0 ? glMainBufBytes * 2 : 32768);
    gl.bufferData(gl.ARRAY_BUFFER, cap, gl.DYNAMIC_DRAW);
    glMainBufBytes = cap;
  }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, n === f32.length ? f32 : f32.subarray(0, n));
}

function uploadVerts(verts, floatCount) {
  const n = floatCount != null ? (floatCount | 0) : verts.length;
  if (n <= 0) return;
  snapScratch = growF32(snapScratch, n);
  for (let i = 0; i < n; i += 2) {
    snapScratch[i] = Math.round(verts[i]);
    snapScratch[i + 1] = Math.round(verts[i + 1]);
  }
  uploadMainBuf(snapScratch, n);
}

function useDraw(color, alpha) {
  gl.useProgram(prog);
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(uRes, W, H);
  gl.uniform3fv(uCol, color || COL_WHITE);
  gl.uniform1f(uAlpha, alpha == null ? 1 : alpha);
  gl.uniform1f(uSize, 1);
  bindSceneLightUniforms(mainLightU);
}

/* ========== Baked grid texture (cl_background_bake) ========== */
const gridBakeVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec2 vWorld;
  void main() {
    vec2 p = aPos / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    // Deformed mesh position — flashlight occlusion must match on-screen rocks.
    vWorld = aPos;
  }
`;
/** Sample bake in UV space (pre-warp), then mesh verts warp — ripples/booms live in bake/world UV. */
const gridBakeFS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform sampler2D uNebula;
  uniform float uNebulaOn;
  uniform vec2 uNebulaScroll;
  uniform float uNebulaScale;
  uniform float uAlpha;
  uniform highp vec2 uRes;
  uniform vec2 uWorldOrigin;
  uniform vec2 uWorldSize;
  uniform float uRippleWidths[8];
  uniform vec4 uRipples[8]; // xy = center (world), z = radius, w = strength (0 = off)
  uniform vec4 uBooms[12]; // xy = center, z = radius, w = alpha (0 = off)
  uniform float uBoomAges[12]; // seconds since birth
  uniform vec2 uBoomSats[12]; // x = core sat, y = rim sat (0.7–1)
  // Flashlight cone on grid strokes only: xy origin, z facing, w max length.
  uniform float uFlashOn;
  uniform vec4 uFlash;
  uniform float uFlashHalf;
  uniform float uFlashBoost;
  uniform float uFlashNight;
  uniform vec3 uFlashCol; // precision cone tint
  uniform float uFlashAmt; // overall cone strength (wiggle)
  uniform float uFlashRadar; // 0..1 radar sweep along cone
  // Flat silhouette edges (WebGL1: index only with loop var).
  // uFlashEdge[e] = vec4(ax, ay, bx, by); uFlashEdgeN = count.
  uniform vec4 uFlashEdge[192];
  uniform float uFlashEdgeN;
  // Per-ship radial lights: xy = pos, z = radius, w = active.
  uniform vec4 uShipLight[8];
  varying vec2 vUV;
  varying vec2 vWorld;

  float angDelta(float from, float to) {
    float d = to - from;
    return mod(d + 3.14159265, 6.2831853) - 3.14159265;
  }

  float cross2(vec2 a, vec2 b) {
    return a.x * b.y - a.y * b.x;
  }

  // Closest hit distance along ray, or -1 if none before maxT.
  float raySegHitT(vec2 o, vec2 dir, float maxT, vec2 a, vec2 b) {
    vec2 v = b - a;
    float den = cross2(dir, v);
    if (abs(den) < 1e-5) return -1.0;
    vec2 ao = a - o;
    float t = cross2(ao, v) / den;
    float s = cross2(ao, dir) / den;
    if (t > 0.15 && t < maxT - 0.15 && s >= 0.0 && s <= 1.0) return t;
    return -1.0;
  }

  bool flashRayBlocked(vec2 o, vec2 dir, float maxT) {
    for (int e = 0; e < 192; e++) {
      if (float(e) >= uFlashEdgeN) break;
      float t = raySegHitT(o, dir, maxT, uFlashEdge[e].xy, uFlashEdge[e].zw);
      if (t > 0.0) return true;
    }
    return false;
  }

  // Soft penumbra: average visibility over a few angled rays (no hard shadow rim).
  float softRayVis(vec2 o, vec2 p) {
    float maxT = length(p - o);
    if (maxT <= 1.0) return 1.0;
    float base = atan(p.y - o.y, p.x - o.x);
    // ~±9° total penumbra (5 taps).
    float pen = 0.045;
    float vis = 0.0;
    for (int k = 0; k < 5; k++) {
      float ang = base + (float(k) - 2.0) * pen;
      vec2 dir = vec2(cos(ang), sin(ang));
      if (!flashRayBlocked(o, dir, maxT)) vis += 1.0;
    }
    // Smooth the discrete tap steps.
    vis *= 0.2;
    return vis * vis * (3.0 - 2.0 * vis);
  }

  void main() {
    vec4 c = texture2D(uTex, vUV);
    if (c.a < 0.04) discard;
    // UV-space world for bake-aligned ripples / nebula / booms.
    vec2 world = uWorldOrigin + vUV * uWorldSize;
    float boost = 0.0;
    for (int i = 0; i < 8; i++) {
      float str = uRipples[i].w;
      if (str > 0.001) {
        float d = distance(world, uRipples[i].xy);
        float halfW = max(0.5, uRippleWidths[i] * 0.5);
        float t = abs(d - uRipples[i].z) / halfW;
        // Tent 0→1→0 across the ring width, then smooth.
        float ring = 1.0 - clamp(t, 0.0, 1.0);
        ring = ring * ring * (3.0 - 2.0 * ring);
        boost += ring * str;
      }
    }
    vec3 rgb = c.rgb;
    if (uNebulaOn > 0.5) {
      // Scrolling nebula fill on grid strokes only (discard already killed background).
      vec2 nuv = (world + uNebulaScroll) * uNebulaScale;
      rgb = texture2D(uNebula, nuv).rgb;
    }
    float boomBoost = 0.0;
    for (int i = 0; i < 12; i++) {
      float str = uBooms[i].w;
      if (str > 0.001) {
        vec2 delta = world - uBooms[i].xy;
        float d = length(delta);
        // Cheap chaotic blast outline: polar harmonics (no noise tex / no extra uniforms).
        float ang = atan(delta.y, delta.x);
        float seed = uBooms[i].x * 0.113 + uBooms[i].y * 0.079 + uBooms[i].z * 0.031;
        float wobble =
          0.24 * sin(ang * 3.0 + seed) +
          0.15 * sin(ang * 5.0 - seed * 1.9) +
          0.10 * sin(ang * 8.0 + seed * 0.55) +
          0.06 * sin(ang * 13.0 - seed * 2.4) +
          0.04 * sin(ang * 21.0 + seed * 3.1);
        float stretch = 1.0 + 0.14 * sin(ang * 2.0 + seed * 0.7);
        float R = max(1.0, uBooms[i].z) * stretch * (1.0 + wobble);
        float t = clamp(d / max(R, 1.0), 0.0, 1.0);
        // Soft blast: full cover inside, fade at jagged rim.
        float cover = 1.0 - smoothstep(0.78, 1.0, t);
        if (cover > 0.001) {
          float age = uBoomAges[i];
          // Core (red): white → red in 0.7s. Rim (yellow): red → yellow in 0.4s.
          vec3 redTarget = vec3(1.0, 0.12, 0.04);
          vec3 yellowTarget = vec3(1.0, 0.92, 0.18);
          vec3 coreCol = mix(vec3(1.0), redTarget, clamp(age / 0.7, 0.0, 1.0));
          vec3 rimCol = mix(redTarget, yellowTarget, clamp(age / 0.4, 0.0, 1.0));
          // Saturation jitter 70–100% on both endpoints.
          float lumC = dot(coreCol, vec3(0.299, 0.587, 0.114));
          float lumR = dot(rimCol, vec3(0.299, 0.587, 0.114));
          coreCol = mix(vec3(lumC), coreCol, clamp(uBoomSats[i].x, 0.7, 1.0));
          rimCol = mix(vec3(lumR), rimCol, clamp(uBoomSats[i].y, 0.7, 1.0));
          vec3 boomCol = mix(coreCol, rimCol, t);
          float amt = clamp(str * cover, 0.0, 1.0);
          // Tint so it reads on white/blue lines, plus additive energy that stacks on overlaps.
          rgb = mix(rgb, boomCol, amt) + boomCol * (amt * 0.55);
          boomBoost += amt * 0.7;
        }
      }
    }

    float shipLit = 0.0;
    float coneLit = 0.0;
    // Precision aim cone (triangle falloff) — radar sweep + alpha wiggle.
    if (uFlashOn > 0.5) {
      float halfA = max(0.02, uFlashHalf);
      float maxLen = max(1.0, uFlash.w);
      vec2 fwd = vec2(cos(uFlash.z), sin(uFlash.z));
      vec2 toP = vWorld - uFlash.xy;
      float along = dot(toP, fwd);
      if (along > 1.0 && along < maxLen) {
        float sideDist = length(toP - fwd * along);
        float halfW = along * tan(halfA);
        if (sideDist < halfW) {
          float side = 1.0 - (sideDist / max(halfW, 0.001));
          float fall = 1.0 - smoothstep(maxLen * 0.45, maxLen, along);
          float base = fall * side;
          // 9 radar bands sweeping muzzle → tip (faster phase from CPU).
          float alongN = along / maxLen;
          float band = 0.0;
          for (int k = 0; k < 9; k++) {
            float radarPos = fract(uFlashRadar + float(k) * (1.0 / 9.0));
            float d = abs(alongN - radarPos);
            float b = 1.0 - smoothstep(0.0, 0.04, d);
            band = max(band, b * b * (3.0 - 2.0 * b));
          }
          float alphaMul = mix(0.45, 1.0, band) * max(0.0, uFlashAmt);
          coneLit = base * alphaMul;
        }
      }
    }
    // Ship radial lights — torus wrap so glow crosses screen edges.
    for (int si = 0; si < 8; si++) {
      if (uShipLight[si].w < 0.5) continue;
      vec2 dlt = vWorld - uShipLight[si].xy;
      vec2 hsz = uRes * 0.5;
      if (dlt.x > hsz.x) dlt.x -= uRes.x;
      else if (dlt.x < -hsz.x) dlt.x += uRes.x;
      if (dlt.y > hsz.y) dlt.y -= uRes.y;
      else if (dlt.y < -hsz.y) dlt.y += uRes.y;
      float d = length(dlt);
      float R = max(1.0, uShipLight[si].z);
      if (d >= R) continue;
      float t = 1.0 - smoothstep(0.0, R, d);
      float rad = t * t * (3.0 - 2.0 * t);
      shipLit = max(shipLit, rad);
    }
    shipLit *= 0.7; // 30% weaker player radial on grid
    float flashLit = max(shipLit, coneLit);

    // Radial first — cone must not cancel it.
    if (shipLit > 0.001) {
      float amt = clamp(shipLit, 0.0, 1.0);
      rgb = min(vec3(1.0), rgb * (1.0 + amt * 0.425) + vec3(0.04, 0.06, 0.08) * amt);
      boomBoost += amt * uFlashBoost;
    }
    // Cone: soft additive tint (no mix-to-red, which blackened soft edges).
    if (coneLit > 0.001) {
      float amt = clamp(coneLit, 0.0, 1.0);
      rgb = min(vec3(1.0), rgb * (1.0 + amt * 0.3) + uFlashCol * (amt * 0.75));
      boomBoost += amt * uFlashBoost;
    }

    // Night: soft alpha with light (no hard discard rim); ripples/booms still keep strokes.
    float nightA = 1.0;
    if (uFlashNight > 0.5) {
      float keep = max(flashLit, max(boost, boomBoost));
      if (keep < 0.001) discard;
      nightA = max(flashLit, max(boost, boomBoost));
    }

    float a = c.a * uAlpha * (1.0 + boost + boomBoost) * nightA;
    gl_FragColor = vec4(rgb, min(1.0, a));
  }
`;
const gridBakeProg = gl.createProgram();
gl.attachShader(gridBakeProg, shader(gl.VERTEX_SHADER, gridBakeVS));
gl.attachShader(gridBakeProg, shader(gl.FRAGMENT_SHADER, gridBakeFS));
linkProgram(gridBakeProg);
const gbURes = gl.getUniformLocation(gridBakeProg, 'uRes');
const gbUTex = gl.getUniformLocation(gridBakeProg, 'uTex');
const gbUNebula = gl.getUniformLocation(gridBakeProg, 'uNebula');
const gbUNebulaOn = gl.getUniformLocation(gridBakeProg, 'uNebulaOn');
const gbUNebulaScroll = gl.getUniformLocation(gridBakeProg, 'uNebulaScroll');
const gbUNebulaScale = gl.getUniformLocation(gridBakeProg, 'uNebulaScale');
const gbUAlpha = gl.getUniformLocation(gridBakeProg, 'uAlpha');
const gbUWorldOrigin = gl.getUniformLocation(gridBakeProg, 'uWorldOrigin');
const gbUWorldSize = gl.getUniformLocation(gridBakeProg, 'uWorldSize');
const gbURippleWidths = gl.getUniformLocation(gridBakeProg, 'uRippleWidths[0]');
const gbURipples = gl.getUniformLocation(gridBakeProg, 'uRipples[0]');
const gbUBooms = gl.getUniformLocation(gridBakeProg, 'uBooms[0]');
const gbUBoomAges = gl.getUniformLocation(gridBakeProg, 'uBoomAges[0]');
const gbUBoomSats = gl.getUniformLocation(gridBakeProg, 'uBoomSats[0]');
const gbUFlashOn = gl.getUniformLocation(gridBakeProg, 'uFlashOn');
const gbUFlash = gl.getUniformLocation(gridBakeProg, 'uFlash');
const gbUFlashHalf = gl.getUniformLocation(gridBakeProg, 'uFlashHalf');
const gbUFlashBoost = gl.getUniformLocation(gridBakeProg, 'uFlashBoost');
const gbUFlashNight = gl.getUniformLocation(gridBakeProg, 'uFlashNight');
const gbUFlashCol = gl.getUniformLocation(gridBakeProg, 'uFlashCol');
const gbUFlashAmt = gl.getUniformLocation(gridBakeProg, 'uFlashAmt');
const gbUFlashRadar = gl.getUniformLocation(gridBakeProg, 'uFlashRadar');
const gbUFlashEdge = gl.getUniformLocation(gridBakeProg, 'uFlashEdge[0]');
const gbUFlashEdgeN = gl.getUniformLocation(gridBakeProg, 'uFlashEdgeN');
const gbUShipLight = gl.getUniformLocation(gridBakeProg, 'uShipLight[0]');
const gbAPos = gl.getAttribLocation(gridBakeProg, 'aPos');
const gbAUV = gl.getAttribLocation(gridBakeProg, 'aUV');
const gridBakeBuf = gl.createBuffer();
let gridBakeTex = null;
let gridBakeKey = '';
let gridBakeVerts = null;
let gridBakeVertCount = 0;
let gridBakeOriginX = 0;
let gridBakeOriginY = 0;
let gridBakeWorldW = 1;
let gridBakeWorldH = 1;

/** Waves/practice: nebula sampled on grid lines only; scrolls slowly in a random direction. */
let gridNebulaImg = null;
let gridNebulaReady = false;
let gridNebulaGL = null;
let gridNebulaScrollX = 0;
let gridNebulaScrollY = 0;
let gridNebulaVelX = 0;
let gridNebulaVelY = 0;
/** World units per nebula tile (larger = bigger pattern). */
const GRID_NEBULA_TILE = 420;
/** Scroll speed (world px / sec). */
const GRID_NEBULA_SPEED = 14;
/** `spaces_strip4.png` — 4 square frames in one row. */
const GRID_NEBULA_STRIP = 'sprites/spaces_strip4.png';
const GRID_NEBULA_FRAMES = 4;

function pickNebulaScrollDir() {
  const a = Math.random() * Math.PI * 2;
  gridNebulaVelX = Math.cos(a) * GRID_NEBULA_SPEED;
  gridNebulaVelY = Math.sin(a) * GRID_NEBULA_SPEED;
}
pickNebulaScrollDir();

/** Slice one strip frame at native pixels (world stretch + GL NEAREST handles scale). */
function sliceNebulaFrame(stripImg, frameIndex) {
  const frames = Math.max(1, GRID_NEBULA_FRAMES | 0);
  const fw = Math.max(1, (stripImg.naturalWidth / frames) | 0);
  const fh = Math.max(1, stripImg.naturalHeight | 0);
  const fi = ((frameIndex | 0) % frames + frames) % frames;
  const c = document.createElement('canvas');
  c.width = fw;
  c.height = fh;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(stripImg, fi * fw, 0, fw, fh, 0, 0, fw, fh);
  return c;
}

function ensureNebulaGLTexture() {
  if (!gridNebulaReady || !gridNebulaImg) return false;
  if (gridNebulaGL) return true;
  gridNebulaGL = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, gridNebulaGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gridNebulaImg);
  return true;
}

function tickNebulaScroll(dt) {
  if (!gridNebulaReady) return;
  // Scroll for practice stroke nebula and/or optional underlay layer.
  if (!practiceMode && !(cv('cl_bg_layer') | 0)) return;
  const d = dt > 0 ? dt : 0.016;
  // Shared scroll drives grid stroke nebula; underlay may flip it at draw time.
  gridNebulaScrollX += gridNebulaVelX * d;
  gridNebulaScrollY += gridNebulaVelY * d;
}

(function loadGridNebula() {
  const img = new Image();
  img.onload = () => {
    const frame = (Math.random() * GRID_NEBULA_FRAMES) | 0;
    // One native frame — world tile (GRID_NEBULA_TILE) + NEAREST stretch/loop.
    gridNebulaImg = sliceNebulaFrame(img, frame);
    gridNebulaReady = true;
    if (gridNebulaGL) {
      gl.bindTexture(gl.TEXTURE_2D, gridNebulaGL);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gridNebulaImg);
    }
    invalidateGridBake();
  };
  img.onerror = () => {
    gridNebulaReady = false;
  };
  img.src = GRID_NEBULA_STRIP;
})();

/* ========== Undistorted nebula underlay (cl_bg_layer) ========== */
const nebulaLayerVS = `
  attribute vec2 aPos;
  uniform vec2 uRes;
  varying vec2 vWorld;
  void main() {
    vWorld = aPos;
    vec2 p = aPos / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  }
`;
const nebulaLayerFS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec2 uScroll;
  uniform float uScale;
  uniform float uAlpha;
  varying vec2 vWorld;
  void main() {
    vec2 uv = (vWorld + uScroll) * uScale;
    vec3 rgb = texture2D(uTex, uv).rgb;
    gl_FragColor = vec4(rgb, uAlpha);
  }
`;
const nebulaLayerProg = gl.createProgram();
gl.attachShader(nebulaLayerProg, shader(gl.VERTEX_SHADER, nebulaLayerVS));
gl.attachShader(nebulaLayerProg, shader(gl.FRAGMENT_SHADER, nebulaLayerFS));
linkProgram(nebulaLayerProg);
const nlAPos = gl.getAttribLocation(nebulaLayerProg, 'aPos');
const nlURes = gl.getUniformLocation(nebulaLayerProg, 'uRes');
const nlUTex = gl.getUniformLocation(nebulaLayerProg, 'uTex');
const nlUScroll = gl.getUniformLocation(nebulaLayerProg, 'uScroll');
const nlUScale = gl.getUniformLocation(nebulaLayerProg, 'uScale');
const nlUAlpha = gl.getUniformLocation(nebulaLayerProg, 'uAlpha');
const nebulaLayerBuf = gl.createBuffer();
const nebulaLayerQuad = new Float32Array(12);

/** Fullscreen scrolling nebula — same UV/scroll as grid stroke fill, no mesh warp. */
function drawNebulaUnderlay() {
  if (!ensureNebulaGLTexture()) return;
  // Two triangles covering the playfield in world space.
  nebulaLayerQuad[0] = 0; nebulaLayerQuad[1] = 0;
  nebulaLayerQuad[2] = W; nebulaLayerQuad[3] = 0;
  nebulaLayerQuad[4] = W; nebulaLayerQuad[5] = H;
  nebulaLayerQuad[6] = 0; nebulaLayerQuad[7] = 0;
  nebulaLayerQuad[8] = W; nebulaLayerQuad[9] = H;
  nebulaLayerQuad[10] = 0; nebulaLayerQuad[11] = H;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(nebulaLayerProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gridNebulaGL);
  gl.uniform1i(nlUTex, 0);
  gl.uniform2f(nlURes, W, H);
  // Invert only the underlay UV scroll — grid stroke nebula keeps the shared scroll.
  const inv = (cv('cl_bg_dir_invert') | 0) !== 0 ? -1 : 1;
  gl.uniform2f(nlUScroll, gridNebulaScrollX * inv, gridNebulaScrollY * inv);
  gl.uniform1f(nlUScale, 1 / GRID_NEBULA_TILE);
  gl.uniform1f(nlUAlpha, 0.5);
  gl.bindBuffer(gl.ARRAY_BUFFER, nebulaLayerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, nebulaLayerQuad, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(nlAPos);
  gl.vertexAttribPointer(nlAPos, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disableVertexAttribArray(nlAPos);
  gl.disable(gl.BLEND);
}

/** Expanding alpha rings on the bake (UV space) — before mesh distortion. */
const GRID_ALPHA_RIPPLE_MAX = 8;
const GRID_ALPHA_RIPPLE_WIDTH = 240;
/** Lingering explosion discs on bake only (core red / rim yellow); warp with mesh. */
const BOOM_LIGHT_LIFE_MS = 2000;
const BOOM_LIGHT_MAX = 48;
const GRID_BOOM_LIGHT_MAX = 12;
const boomLights = [];
const _gridBoomUniform = new Float32Array(GRID_BOOM_LIGHT_MAX * 4);
const _gridBoomAges = new Float32Array(GRID_BOOM_LIGHT_MAX);
const _gridBoomSats = new Float32Array(GRID_BOOM_LIGHT_MAX * 2);
/** Godmode spawn pulse rings. */
const GODMODE_SPAWN_RIPPLE_WIDTH = 70;
const GODMODE_SPAWN_RIPPLE_PERIOD = 0.42;
let godmodeSpawnRippleAcc = 0;
const gridAlphaRipples = [];
const _gridRippleUniform = new Float32Array(GRID_ALPHA_RIPPLE_MAX * 4);
const _gridRippleWidths = new Float32Array(GRID_ALPHA_RIPPLE_MAX);

function pushBoomLight(x, y, radius) {
  const r = Math.max(16 * RES_SCALE, Number(radius) || 40 * RES_SCALE);
  boomLights.push({ x, y, r, born: performance.now() });
  if (boomLights.length > BOOM_LIGHT_MAX) boomLights.splice(0, boomLights.length - BOOM_LIGHT_MAX);
}

/** Linear 1→0 over the whole life (no hold). */
function boomLightAlpha(age) {
  if (age <= 0) return 1;
  if (age >= BOOM_LIGHT_LIFE_MS) return 0;
  return 1 - age / BOOM_LIGHT_LIFE_MS;
}

function pruneBoomLights(now) {
  for (let i = boomLights.length - 1; i >= 0; i--) {
    if (now - boomLights[i].born >= BOOM_LIGHT_LIFE_MS) boomLights.splice(i, 1);
  }
}

function syncGridBoomLightUniforms(now) {
  let n = 0;
  for (let i = boomLights.length - 1; i >= 0 && n < GRID_BOOM_LIGHT_MAX; i--) {
    const L = boomLights[i];
    const ageMs = now - L.born;
    if (ageMs >= BOOM_LIGHT_LIFE_MS) continue;
    const a = boomLightAlpha(ageMs);
    if (a < 0.01) continue;
    const o = n * 4;
    _gridBoomUniform[o] = L.x;
    _gridBoomUniform[o + 1] = L.y;
    _gridBoomUniform[o + 2] = L.r;
    _gridBoomUniform[o + 3] = a;
    _gridBoomAges[n] = ageMs * 0.001;
    // Saturation jitter 70–100% for core + rim across the whole life.
    _gridBoomSats[n * 2] = 0.7 + Math.random() * 0.3;
    _gridBoomSats[n * 2 + 1] = 0.7 + Math.random() * 0.3;
    n++;
  }
  for (let k = n; k < GRID_BOOM_LIGHT_MAX; k++) {
    const o = k * 4;
    _gridBoomUniform[o] = 0;
    _gridBoomUniform[o + 1] = 0;
    _gridBoomUniform[o + 2] = 0;
    _gridBoomUniform[o + 3] = 0;
    _gridBoomAges[k] = 0;
    _gridBoomSats[k * 2] = 1;
    _gridBoomSats[k * 2 + 1] = 1;
  }
  if (gbUBooms) gl.uniform4fv(gbUBooms, _gridBoomUniform);
  if (gbUBoomAges) gl.uniform1fv(gbUBoomAges, _gridBoomAges);
  if (gbUBoomSats) gl.uniform2fv(gbUBoomSats, _gridBoomSats);
  pruneBoomLights(now);
}

/** Player flashlight cone on baked grid (asteroid polygons occlude). */
const GRID_FLASH_POLY_MAX = 16;
const GRID_FLASH_VERTS_PER = 12;
const GRID_FLASH_EDGE_MAX = GRID_FLASH_POLY_MAX * GRID_FLASH_VERTS_PER;
const GRID_FLASH_MAX_LEN = 900;
/** Precision cone half-angle starts at ±12°, shrinks while held. */
const GRID_FLASH_HALF_START = 12 * Math.PI / 180;
const GRID_FLASH_HALF_MIN = 4 * Math.PI / 180;
const GRID_FLASH_SHRINK_DEG = 0.2;
const GRID_FLASH_SHRINK_MS = 33;
/** How many bright pulses travel the cone at once. */
const GRID_FLASH_RADAR_BANDS = 9;
/** Radar phase speed vs bullet-travel baseline (higher = faster ripples). */
const GRID_FLASH_RADAR_FREQ = 3;
/** Fallback bullet speed (px/tick) when weapon is hitscan / unknown. */
const GRID_FLASH_RADAR_FALLBACK_SPD = 8 * RES_SCALE;
/** ~50% of the original cone brightness. */
const GRID_FLASH_BOOST = 0.825;
const GRID_SHIP_LIGHT_MAX = 8;
const GRID_SHIP_LIGHT_R = 400;
/** Asteroid face shading uses a wider ship radial than the grid glow. */
const AST_SHIP_LIGHT_R = 800;
const _gridFlashEdge = new Float32Array(GRID_FLASH_EDGE_MAX * 4);
let _gridFlashEdgeN = 0;
const _gridShipLight = new Float32Array(GRID_SHIP_LIGHT_MAX * 4);
/** CPU mirror of light uniforms — pushed to every lit program each draw. */
let _lightFlashOn = 0;
let _lightFlashNight = 0;
let _lightFlashX = 0;
let _lightFlashY = 0;
let _lightFlashAng = 0;
let _lightFlashLen = 0;
let _lightFlashHalf = 0;
let _lightFlashBoost = 0;
let _lightFlashColR = 1;
let _lightFlashColG = 1;
let _lightFlashColB = 1;
let _lightFlashAmt = 1;
let _lightFlashRadar = 0;
/** Precision hold shrink state. */
let _precisionConeHeld = false;
let _precisionConeHalf = GRID_FLASH_HALF_START;
let _precisionConeLastMs = 0;

/** Radar 0..1 phase: bullet-speed baseline × GRID_FLASH_RADAR_FREQ. */
function precisionAimRadarPhase(nowMs) {
  let spd = null;
  try { spd = currentWeaponBulletSpeed(); } catch (_) { /* WEAPONS may not be ready */ }
  if (!(spd > 0)) spd = GRID_FLASH_RADAR_FALLBACK_SPD;
  const pxPerSec = spd * TPS;
  const periodSec = GRID_FLASH_MAX_LEN / Math.max(1, pxPerSec);
  return ((nowMs * 0.001) * GRID_FLASH_RADAR_FREQ / periodSec) % 1;
}

function bindSceneLightUniforms(u) {
  if (!u) return;
  if (u.night) gl.uniform1f(u.night, _lightFlashNight);
  if (u.ships) gl.uniform4fv(u.ships, _gridShipLight);
  if (u.wrap) gl.uniform2f(u.wrap, W, H);
}
const DYN_LIGHT_KEY = 'asteroids_dyn_light';
const NIGHT_MODE_KEY = 'asteroids_night_mode';
let dynGridLightEnabled = true;
let nightModeLightEnabled = false;
try {
  const _dl = localStorage.getItem(DYN_LIGHT_KEY);
  if (_dl === '0') dynGridLightEnabled = false;
  else if (_dl === '1') dynGridLightEnabled = true;
  const _nm = localStorage.getItem(NIGHT_MODE_KEY);
  if (_nm === '1') nightModeLightEnabled = true;
  else if (_nm === '0') nightModeLightEnabled = false;
} catch (_) { /* ignore */ }

function syncLightingUi() {
  if (settingsDynLightEl) settingsDynLightEl.checked = !!dynGridLightEnabled;
  const gpDyn = document.getElementById('gp-dyn-light');
  const gpNight = document.getElementById('gp-night-mode');
  if (gpDyn) gpDyn.checked = !!dynGridLightEnabled;
  if (gpNight) gpNight.checked = !!nightModeLightEnabled;
}

function setDynGridLightEnabled(on) {
  dynGridLightEnabled = !!on;
  try { localStorage.setItem(DYN_LIGHT_KEY, dynGridLightEnabled ? '1' : '0'); } catch (_) { /* ignore */ }
  if (!dynGridLightEnabled && nightModeLightEnabled) {
    nightModeLightEnabled = false;
    try { localStorage.setItem(NIGHT_MODE_KEY, '0'); } catch (_) { /* ignore */ }
  }
  syncLightingUi();
}

function setNightModeLightEnabled(on) {
  nightModeLightEnabled = !!on;
  if (nightModeLightEnabled && !dynGridLightEnabled) {
    dynGridLightEnabled = true;
    try { localStorage.setItem(DYN_LIGHT_KEY, '1'); } catch (_) { /* ignore */ }
  }
  try { localStorage.setItem(NIGHT_MODE_KEY, nightModeLightEnabled ? '1' : '0'); } catch (_) { /* ignore */ }
  syncLightingUi();
}

function nightModeActive() {
  return !!(nightModeLightEnabled && inGame);
}

const _flashPolyXs = new Float32Array(GRID_FLASH_VERTS_PER);
const _flashPolyYs = new Float32Array(GRID_FLASH_VERTS_PER);

/** Push closed silhouette edges (evenly spaced verts, no duplicate indices). */
function packFlashPolyEdges(outline) {
  const n = (outline.length / 2) | 0;
  if (n < 3) return;
  const use = Math.min(GRID_FLASH_VERTS_PER, n);
  const xs = _flashPolyXs;
  const ys = _flashPolyYs;
  let prev = -1;
  let wrote = 0;
  for (let i = 0; i < use; i++) {
    let src = n > use ? Math.floor((i * n) / use) : i;
    if (src === prev) src = (src + 1) % n;
    prev = src;
    xs[wrote] = outline[src * 2];
    ys[wrote] = outline[src * 2 + 1];
    wrote++;
  }
  if (wrote < 3) return;
  for (let i = 0; i < wrote; i++) {
    if (_gridFlashEdgeN >= GRID_FLASH_EDGE_MAX) return;
    const j = (i + 1) % wrote;
    const dx = xs[j] - xs[i];
    const dy = ys[j] - ys[i];
    if (dx * dx + dy * dy < 0.25) continue; // skip degenerate edges
    const o = _gridFlashEdgeN * 4;
    _gridFlashEdge[o] = xs[i];
    _gridFlashEdge[o + 1] = ys[i];
    _gridFlashEdge[o + 2] = xs[j];
    _gridFlashEdge[o + 3] = ys[j];
    _gridFlashEdgeN++;
  }
}

/** Pack ship-radial + precision flashlight cone for grid bake. */
function updateDynamicLightState() {
  const inMatch = inGame && !soloShopOpen;
  const lightsOn = dynGridLightEnabled && inMatch;
  const nightOn = lightsOn && nightModeLightEnabled;
  const me = localView();
  const alive = !!(player && (player.hp | 0) > 0);
  const precise = !!(inMatch && alive && precisionTurn());
  _lightFlashOn = precise ? 1 : 0;
  _lightFlashNight = nightOn ? 1 : 0;
  if (precise) {
    const now = performance.now();
    if (!_precisionConeHeld) {
      _precisionConeHeld = true;
      _precisionConeHalf = GRID_FLASH_HALF_START;
      _precisionConeLastMs = now;
    } else {
      while (now - _precisionConeLastMs >= GRID_FLASH_SHRINK_MS) {
        _precisionConeLastMs += GRID_FLASH_SHRINK_MS;
        _precisionConeHalf = Math.max(
          GRID_FLASH_HALF_MIN,
          _precisionConeHalf - GRID_FLASH_SHRINK_DEG * Math.PI / 180
        );
      }
    }
    // Cone axis = actual shoot direction (server fire angle), not softErr visual.
    const aLead = shootPredictAngleLeadTicks();
    const shootAng = player.angle + (Number.isFinite(player.av) ? player.av : 0) * aLead;
    const m = shipMuzzle(me.x, me.y, shootAng);
    _lightFlashX = m.x;
    _lightFlashY = m.y;
    _lightFlashAng = shootAng;
    _lightFlashLen = GRID_FLASH_MAX_LEN;
    _lightFlashHalf = _precisionConeHalf;
    _lightFlashColR = 1;
    _lightFlashColG = 1;
    _lightFlashColB = 1;
    // Whole-cone alpha wiggle (~±12%).
    _lightFlashAmt = 0.88 + 0.12 * Math.sin(now * 0.0285);
    // Radar phase: bands travel cone length at current bullet speed (3 visible lights).
    _lightFlashRadar = precisionAimRadarPhase(now);
  } else {
    _precisionConeHeld = false;
    _precisionConeHalf = GRID_FLASH_HALF_START;
    _lightFlashX = _lightFlashY = _lightFlashAng = _lightFlashLen = 0;
    _lightFlashHalf = 0;
    _lightFlashColR = 1;
    _lightFlashColG = 1;
    _lightFlashColB = 1;
    _lightFlashAmt = 1;
    _lightFlashRadar = 0;
  }
  _lightFlashBoost = (lightsOn || precise) ? GRID_FLASH_BOOST : 0;
  // Lights never interact with asteroids (no silhouette edges / shadows).
  _gridFlashEdgeN = 0;
  if (!lightsOn && !precise) {
    _gridShipLight.fill(0);
    return;
  }
  _gridShipLight.fill(0);
  if (lightsOn) {
    let nShip = 0;
    const pushShipLight = (x, y) => {
      if (nShip >= GRID_SHIP_LIGHT_MAX) return;
      const o = nShip * 4;
      _gridShipLight[o] = x;
      _gridShipLight[o + 1] = y;
      _gridShipLight[o + 2] = GRID_SHIP_LIGHT_R;
      _gridShipLight[o + 3] = 1;
      nShip++;
    };
    if (alive) pushShipLight(me.x, me.y);
    for (const r of remotes.values()) {
      if ((r.hp | 0) <= 0) continue;
      const v = remoteView(r);
      pushShipLight(v.x, v.y);
    }
  }
}

/** Upload packed light state to the baked-grid program (must be current). */
function syncGridFlashlightUniforms() {
  updateDynamicLightState();
  if (gbUFlashOn) gl.uniform1f(gbUFlashOn, _lightFlashOn);
  if (gbUFlashNight) gl.uniform1f(gbUFlashNight, _lightFlashNight);
  if (gbUFlash) gl.uniform4f(gbUFlash, _lightFlashX, _lightFlashY, _lightFlashAng, _lightFlashLen);
  if (gbUFlashHalf) gl.uniform1f(gbUFlashHalf, _lightFlashHalf);
  if (gbUFlashBoost) gl.uniform1f(gbUFlashBoost, _lightFlashBoost);
  if (gbUFlashCol) gl.uniform3f(gbUFlashCol, _lightFlashColR, _lightFlashColG, _lightFlashColB);
  if (gbUFlashAmt) gl.uniform1f(gbUFlashAmt, _lightFlashAmt);
  if (gbUFlashRadar) gl.uniform1f(gbUFlashRadar, _lightFlashRadar);
  if (gbUFlashEdge) gl.uniform4fv(gbUFlashEdge, _gridFlashEdge);
  if (gbUFlashEdgeN) gl.uniform1f(gbUFlashEdgeN, _gridFlashEdgeN);
  if (gbUShipLight) gl.uniform4fv(gbUShipLight, _gridShipLight);
}

function pushGridAlphaRipple(x, y, opts) {
  opts = opts || {};
  gridAlphaRipples.push({
    x,
    y,
    born: performance.now(),
    life: opts.life != null ? opts.life : 720,
    r0: opts.r0 != null ? opts.r0 : 0,
    r1: opts.r1 != null ? opts.r1 : 240 * RES_SCALE,
    width: opts.width != null ? opts.width : GRID_ALPHA_RIPPLE_WIDTH,
    amp: opts.amp != null ? opts.amp : 1.35
  });
  if (gridAlphaRipples.length > 24) gridAlphaRipples.splice(0, gridAlphaRipples.length - 24);
}

function syncGridAlphaRippleUniforms(now) {
  // Pack up to 8 live ripples (newest first), each with its own outline width.
  let n = 0;
  for (let i = gridAlphaRipples.length - 1; i >= 0 && n < GRID_ALPHA_RIPPLE_MAX; i--) {
    const R = gridAlphaRipples[i];
    const age = now - R.born;
    if (age >= R.life) continue;
    const u = Math.max(0, Math.min(1, age / R.life));
    const rad = R.r0 + (R.r1 - R.r0) * u;
    // Fade strength near end of life.
    const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    const o = n * 4;
    _gridRippleUniform[o] = R.x;
    _gridRippleUniform[o + 1] = R.y;
    _gridRippleUniform[o + 2] = rad;
    _gridRippleUniform[o + 3] = R.amp * fade;
    _gridRippleWidths[n] = R.width != null ? R.width : GRID_ALPHA_RIPPLE_WIDTH;
    n++;
  }
  for (let k = n; k < GRID_ALPHA_RIPPLE_MAX; k++) {
    const o = k * 4;
    _gridRippleUniform[o] = 0;
    _gridRippleUniform[o + 1] = 0;
    _gridRippleUniform[o + 2] = 0;
    _gridRippleUniform[o + 3] = 0;
    _gridRippleWidths[k] = GRID_ALPHA_RIPPLE_WIDTH;
  }
  if (gbURippleWidths) gl.uniform1fv(gbURippleWidths, _gridRippleWidths);
  if (gbURipples) gl.uniform4fv(gbURipples, _gridRippleUniform);
  // Prune dead.
  for (let i = gridAlphaRipples.length - 1; i >= 0; i--) {
    if (now - gridAlphaRipples[i].born >= gridAlphaRipples[i].life) {
      gridAlphaRipples.splice(i, 1);
    }
  }
}

/** While godmode: pulse light rings on that player's spawn pad (max R = spawn area). */
function tickGodmodeSpawnRipples(dt) {
  const active = [];
  if ((player.godLeft | 0) > 0 && myId != null) active.push(myId);
  for (const r of remotes.values()) {
    if ((r.godLeft | 0) > 0) active.push(r.id);
  }
  if (!active.length) {
    godmodeSpawnRippleAcc = 0;
    return;
  }
  godmodeSpawnRippleAcc += dt || 0.016;
  if (godmodeSpawnRippleAcc < GODMODE_SPAWN_RIPPLE_PERIOD) return;
  godmodeSpawnRippleAcc = 0;
  for (let i = 0; i < active.length; i++) {
    const pose = playerSpawnPoseLocal(active[i]);
    pushGridAlphaRipple(pose.x, pose.y, {
      r0: 0,
      r1: GODMODE_SPAWN_CLEAR_R,
      width: GODMODE_SPAWN_RIPPLE_WIDTH,
      life: 880,
      amp: 3.1
    });
  }
}

/** Player occupying spawn slot 0 (left) or 1 (right), else null. */
function playerIdForSpawnSlot(slot) {
  slot = slot & 1;
  if (myId != null && (((myId - 1) & 1) === slot)) return myId;
  if (typeof remotes !== 'undefined' && remotes) {
    for (const r of remotes.values()) {
      if ((((r.id - 1) & 1) === slot)) return r.id;
    }
  }
  return null;
}

function rgb01ToCssRgba(rgb, a) {
  const r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (a == null ? 1 : a) + ')';
}

/** CSS color for spawn-pad lattice, or null if that pad has no player yet (practice empty side). */
function spawnPadCssColor(slot) {
  const id = playerIdForSpawnSlot(slot);
  if (id == null) {
    // Match lobby: still tint pads with defaults so both sides read as teams.
    if (practiceMode) return null;
    const fallback = slot === 0 ? (COL.self || [0.2, 0.85, 1]) : (COL.remote || [1, 0.35, 0.35]);
    return rgb01ToCssRgba(fallback, 1);
  }
  return rgb01ToCssRgba(ownerPlayerColor(id), 1);
}

function spawnPadColorKey(slot) {
  const css = spawnPadCssColor(slot);
  return css || 'none';
}

function ensureGridBakeTexture() {
  if (!GRID_N || GRID_COLS < 2 || GRID_ROWS < 2) return false;
  const rs = getRenderScale();
  // Visual line density from cvar — independent of coarse warp GRID_STEP.
  const lineStep = Math.max(2, Number(cv('cl_grid_size')) || 5);
  const lineW = gridLineWidthMul();
  const topo = GRID_TOPO || 1;
  const c0 = spawnPadColorKey(0);
  const c1 = spawnPadColorKey(1);
  const key = [
    'arena25', topo, GRID_COLS, GRID_ROWS, GRID_STEP, GRID_OX, GRID_OY, lineStep, lineW, rs,
    practiceMode ? 'p1' : 'p0', c0, c1
  ].join(':');
  if (!gridBakeDirty && gridBakeTex && gridBakeKey === key) return true;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let k = 0; k < GRID_N; k++) {
    const x = gridBaseX[k], y = gridBaseY[k];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  gridBakeOriginX = minX;
  gridBakeOriginY = minY;
  gridBakeWorldW = Math.max(1, maxX - minX);
  gridBakeWorldH = Math.max(1, maxY - minY);
  let tw = Math.round(gridBakeWorldW * rs);
  let th = Math.round(gridBakeWorldH * rs);
  const maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);
  if (tw > maxTex || th > maxTex) {
    const s = Math.min(maxTex / tw, maxTex / th);
    tw = Math.max(2, Math.floor(tw * s));
    th = Math.max(2, Math.floor(th * s));
  }

  const cnv = document.createElement('canvas');
  cnv.width = tw;
  cnv.height = th;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, tw, th);
  paintSportArenaGrid(ctx, tw, th, lineStep, rs, gridBakeOriginX, gridBakeOriginY, gridBakeWorldW, gridBakeWorldH, topo);

  if (!gridBakeTex) gridBakeTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, gridBakeTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);

  gridBakeKey = key;
  gridBakeDirty = false;
  return true;
}

/**
 * Esports / rink playfield markings.
 * Match: blue lattice + player-colored spawn pads + thick sport accents.
 * Practice/solo/waves: nebula (or white) lattice only — no sport paint.
 */
function paintSportArenaGrid(ctx, tw, th, lineStep, rs, ox, oy, worldW, worldH, topo) {
  topo = topo || 1;
  const lw = Math.max(0.5, rs * gridLineWidthMul());
  const cx = tw * 0.5;
  const cy = th * 0.5;
  const toTexX = (wx) => ((wx - ox) / worldW) * tw;
  const toTexY = (wy) => ((wy - oy) / worldH) * th;
  const toTexR = (wr) => wr * (tw / Math.max(1, worldW));

  // Full opacity strokes (same as live grid useDraw(..., 1)); fill stays softer.
  const BLUE = 'rgba(56, 140, 220, 1)';
  const WHITE = 'rgba(255, 255, 255, 1)';
  // Practice bake is white alpha mask; nebula color is sampled in the shader (scrolls).
  const lattice = practiceMode ? WHITE : BLUE;
  // Bake texels per world pixel (≈ rs; lower if max-tex clamp shrinks the atlas).
  const px = tw / Math.max(1, worldW);
  // Framebuffer pixels → bake stroke width. (tw ≈ worldW*rs ⇒ factor 1; shrinks if atlas clamped.)
  const fbToBake = px / Math.max(1, rs);
  const accentLw = 5 * fbToBake;
  const dashLw = 2 * fbToBake;
  const dashGap = 4 * px;
  const dashOn = dashGap * 3; // each dash 3× longer than the gap

  // --- fine lattice ---
  ctx.strokeStyle = lattice;
  ctx.lineWidth = lw;
  paintLatticePattern(ctx, tw, th, lineStep, rs, topo, false);
  // --- every-4th majors (same spacing index as fine — do NOT pass lineStep*4) ---
  ctx.strokeStyle = lattice;
  ctx.lineWidth = lw;
  paintLatticePattern(ctx, tw, th, lineStep, rs, topo, true);

  // Solo/practice: stop here — lattice only (nebula or white).
  if (practiceMode) return;

  // --- spawn pads: recolor lattice to that player's color ---
  const spawnR = toTexR(GODMODE_SPAWN_CLEAR_R);
  const spawnPads = [
    [toTexX(W * 0.5 - SPAWN_CENTER_OFFSET), toTexY(H * 0.5)],
    [toTexX(W * 0.5 + SPAWN_CENTER_OFFSET), toTexY(H * 0.5)]
  ];
  for (let slot = 0; slot < 2; slot++) {
    const col = spawnPadCssColor(slot);
    if (!col) continue;
    const [sx, sy] = spawnPads[slot];
    recolorLatticeInCircle(ctx, sx, sy, spawnR, tw, th, lineStep, rs, topo, lw, col);
  }

  // Stage rect: same inset from atlas edge as the old left/right goal lines
  // (edge margin + former crease depth). No separate L/R goal strokes.
  const edgePad = Math.max(2, accentLw);
  const stageInset = edgePad + tw * 0.12;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = accentLw;
  ctx.strokeRect(stageInset, stageInset, tw - stageInset * 2, th - stageInset * 2);

  // --- midfield axes (stop at center star; do not cross through it) ---
  const rStar = Math.min(tw, th) * 0.14;
  const starInner = rStar * 0.38;
  const starVerts = [];
  const starPts = 5;
  for (let i = 0; i < starPts * 2; i++) {
    const a = -Math.PI / 2 + (i / (starPts * 2)) * Math.PI * 2;
    const rr = (i & 1) === 0 ? rStar : starInner;
    starVerts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  function axisGap(dx, dy) {
    // Nearest star-edge hit along axis from center.
    let best = Infinity;
    const n = starVerts.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = starVerts[i * 2];
      const ay = starVerts[i * 2 + 1];
      const bx = starVerts[((i + 1) % n) * 2];
      const by = starVerts[((i + 1) % n) * 2 + 1];
      const ex = bx - ax;
      const ey = by - ay;
      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-9) continue;
      const fx = ax - cx;
      const fy = ay - cy;
      const t = (fx * ey - fy * ex) / denom;
      const u = (fx * dy - fy * dx) / denom;
      if (t > 1e-5 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best < Infinity ? best : starInner;
  }
  const gapN = axisGap(0, -1);
  const gapS = axisGap(0, 1);
  const gapW = axisGap(-1, 0);
  const gapE = axisGap(1, 0);
  ctx.beginPath();
  ctx.moveTo(cx, stageInset);
  ctx.lineTo(cx, cy - gapN);
  ctx.moveTo(cx, cy + gapS);
  ctx.lineTo(cx, th - stageInset);
  ctx.moveTo(stageInset, cy);
  ctx.lineTo(cx - gapW, cy);
  ctx.moveTo(cx + gapE, cy);
  ctx.lineTo(tw - stageInset, cy);
  ctx.stroke();

  // --- center star (replaces old midfield circle) ---
  ctx.beginPath();
  for (let i = 0; i < starVerts.length; i += 2) {
    if (i === 0) ctx.moveTo(starVerts[i], starVerts[i + 1]);
    else ctx.lineTo(starVerts[i], starVerts[i + 1]);
  }
  ctx.closePath();
  ctx.stroke();

  // --- dashed hash marks along mid vertical ---
  ctx.lineWidth = dashLw;
  ctx.setLineDash([dashOn, dashGap]);
  const hashHalf = tw * 0.08;
  ctx.beginPath();
  for (let k = 1; k < 8; k++) {
    const y = stageInset + ((th - stageInset * 2) * k) / 8;
    if (Math.abs(y - cy) < rStar * 0.85) continue;
    ctx.moveTo(cx - hashHalf, y);
    ctx.lineTo(cx + hashHalf, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // --- corner L-marks ---
  const corner = Math.min(tw, th) * 0.05;
  ctx.lineWidth = accentLw;
  ctx.beginPath();
  ctx.moveTo(stageInset, stageInset + corner); ctx.lineTo(stageInset, stageInset); ctx.lineTo(stageInset + corner, stageInset);
  ctx.moveTo(tw - stageInset - corner, stageInset); ctx.lineTo(tw - stageInset, stageInset); ctx.lineTo(tw - stageInset, stageInset + corner);
  ctx.moveTo(stageInset, th - stageInset - corner); ctx.lineTo(stageInset, th - stageInset); ctx.lineTo(stageInset + corner, th - stageInset);
  ctx.moveTo(tw - stageInset - corner, th - stageInset); ctx.lineTo(tw - stageInset, th - stageInset); ctx.lineTo(tw - stageInset, th - stageInset - corner);
  ctx.stroke();

  // --- spawn sport lines (white rings / cross / ticks; 2px; no disc fill) ---
  const SPAWN_LINE = 'rgba(255, 255, 255, 1)';
  const spawnLineLw = 2 * fbToBake;
  for (const [sx, sy] of spawnPads) {
    paintSpawnPadOnGrid(ctx, sx, sy, spawnR, spawnLineLw, SPAWN_LINE);
  }

  // Flipper-style lamp paints along white sport lines (runtime anim lights these).
  paintArenaFancyLamps(ctx, tw, th, cx, cy, stageInset, rStar, starVerts, spawnPads, spawnR, px, fbToBake);
}

/** Dim lamp ticks / chevrons baked onto sport lines for chase lighting. */
function paintArenaFancyLamps(ctx, tw, th, cx, cy, stageInset, rStar, starVerts, spawnPads, spawnR, px, fbToBake) {
  const tick = Math.max(1.2, 2.2 * fbToBake);
  const gap = Math.max(10, 16 * px);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = Math.max(1, fbToBake);

  function dotsAlong(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.floor(len / gap));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      ctx.fillRect(x - tick * 0.5, y - tick * 0.5, tick, tick);
    }
  }

  // Stage perimeter lamps
  const x0 = stageInset, y0 = stageInset, x1 = tw - stageInset, y1 = th - stageInset;
  dotsAlong(x0, y0, x1, y0);
  dotsAlong(x1, y0, x1, y1);
  dotsAlong(x1, y1, x0, y1);
  dotsAlong(x0, y1, x0, y0);

  // Mid axes chevrons (point toward center)
  const chevron = Math.max(4, 7 * px);
  ctx.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 1; k <= 5; k++) {
      const x = cx + side * (rStar + k * gap * 1.1);
      if (x < x0 + 8 || x > x1 - 8) continue;
      ctx.moveTo(x - side * chevron, cy - chevron * 0.7);
      ctx.lineTo(x, cy);
      ctx.lineTo(x - side * chevron, cy + chevron * 0.7);
    }
    for (let k = 1; k <= 4; k++) {
      const y = cy + side * (rStar + k * gap * 1.1);
      if (y < y0 + 8 || y > y1 - 8) continue;
      ctx.moveTo(cx - chevron * 0.7, y - side * chevron);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + chevron * 0.7, y - side * chevron);
    }
  }
  ctx.stroke();

  // Star vertex gems
  for (let i = 0; i < starVerts.length; i += 2) {
    ctx.beginPath();
    ctx.arc(starVerts[i], starVerts[i + 1], tick * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spawn ring lamp beads
  for (const [sx, sy] of spawnPads) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = sx + Math.cos(a) * spawnR;
      const y = sy + Math.sin(a) * spawnR;
      ctx.fillRect(x - tick * 0.45, y - tick * 0.45, tick * 0.9, tick * 0.9);
    }
  }
}

/** Draw square / hex / triangle / centers / stars lattice into bake texture. */
function paintLatticePattern(ctx, tw, th, lineStep, rs, topo, majorsOnly) {
  const spacing = Math.max(2, lineStep) * rs;
  const topoN = topo | 0;
  // Non-square styles ignore the majors split — one full pass only.
  if (topoN !== 1 && majorsOnly) return;

  if (topoN === 1) {
    ctx.beginPath();
    const nX = Math.max(1, Math.round(tw / spacing));
    const nY = Math.max(1, Math.round(th / spacing));
    for (let j = 0; j <= nY; j++) {
      if (majorsOnly && (j % 4) !== 0) continue;
      if (!majorsOnly && (j % 4) === 0) continue;
      const y = (j / nY) * (th - 1) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(tw, y);
    }
    for (let i = 0; i <= nX; i++) {
      if (majorsOnly && (i % 4) !== 0) continue;
      if (!majorsOnly && (i % 4) === 0) continue;
      const x = (i / nX) * (tw - 1) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, th);
    }
    ctx.stroke();
    return;
  }

  // Square cell centers only (no outlines) — nebula samples these discs.
  if (topoN === 4) {
    const nX = Math.max(1, Math.round(tw / spacing));
    const nY = Math.max(1, Math.round(th / spacing));
    const r = Math.max(1.2, Math.min(spacing * 0.2, rs * gridLineWidthMul() * 1.35));
    const prevFill = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle;
    for (let j = 0; j < nY; j++) {
      for (let i = 0; i < nX; i++) {
        const x = ((i + 0.5) / nX) * (tw - 1) + 0.5;
        const y = ((j + 0.5) / nY) * (th - 1) + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = prevFill;
    return;
  }

  if (topoN === 2 || topoN === 5) {
    // Pointy-top hex cells — stroke outlines (2) or fill center stars (5).
    const R = spacing;
    const dx = R * Math.sqrt(3);
    const dy = R * 1.5;
    const rows = Math.ceil(th / dy) + 3;
    const cols = Math.ceil(tw / dx) + 3;
    if (!(dx > 0) || !(dy > 0) || !Number.isFinite(rows) || !Number.isFinite(cols)) return;

    if (topoN === 5) {
      const outer = Math.max(2, R * 0.32 * Math.min(1.6, 0.5 + 0.5 * gridLineWidthMul()));
      const prevFill = ctx.fillStyle;
      ctx.fillStyle = ctx.strokeStyle;
      for (let j = -1; j < rows; j++) {
        const y = j * dy + R;
        const xOff = (j & 1) ? dx * 0.5 : 0;
        for (let i = -1; i < cols; i++) {
          const x = i * dx + xOff + R;
          fillStarPoly(ctx, x, y, outer);
        }
      }
      ctx.fillStyle = prevFill;
      return;
    }

    ctx.beginPath();
    let segs = 0;
    for (let j = -1; j < rows; j++) {
      const y = j * dy + R;
      const xOff = (j & 1) ? dx * 0.5 : 0;
      for (let i = -1; i < cols; i++) {
        const x = i * dx + xOff + R;
        let px = x;
        let py = y - R;
        for (let s = 1; s <= 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const qx = x + R * Math.sin(a);
          const qy = y - R * Math.cos(a);
          ctx.moveTo(px, py);
          ctx.lineTo(qx, qy);
          px = qx;
          py = qy;
          segs++;
        }
      }
      if (segs > 4000) {
        ctx.stroke();
        ctx.beginPath();
        segs = 0;
      }
    }
    if (segs) ctx.stroke();
    return;
  }

  if (topoN === 3) {
    // Triangle: horizontals + both diagonal families (brick rows).
    const dx = spacing;
    const dy = spacing * Math.sqrt(3) * 0.5;
    const rows = Math.ceil(th / dy) + 3;
    const cols = Math.ceil(tw / dx) + 3;
    if (!(dx > 0) || !(dy > 0) || !Number.isFinite(rows) || !Number.isFinite(cols)) return;
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const y = j * dy + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(tw, y);
    }
    ctx.stroke();
    ctx.beginPath();
    let segs = 0;
    for (let j = -1; j < rows; j++) {
      const y = j * dy + 0.5;
      const xOff = (j & 1) ? dx * 0.5 : 0;
      for (let i = -2; i < cols; i++) {
        const x0 = i * dx + xOff + 0.5;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + dx * 0.5, y + dy);
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 - dx * 0.5, y + dy);
        segs += 2;
      }
      if (segs > 4000) {
        ctx.stroke();
        ctx.beginPath();
        segs = 0;
      }
    }
    if (segs) ctx.stroke();
  }
}

/** Filled 5-point star for bake marks (uses current fillStyle). */
function fillStarPoly(ctx, x, y, outerR) {
  if (!(outerR > 0.5)) return;
  const verts = buildStarPolyFlat(x, y, 5, outerR, outerR * 0.38, 0);
  ctx.beginPath();
  ctx.moveTo(verts[0], verts[1]);
  for (let i = 2; i < verts.length; i += 2) ctx.lineTo(verts[i], verts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

/**
 * Live (non-bake) draw for center/star modes — small crosses or star outlines.
 * Bake mode is preferred; this keeps the lattice readable if bake=0.
 */
function drawLatticeMarksLive(col, alpha, topo) {
  const spacing = Math.max(2, Number(cv('cl_grid_size')) || GRID_STEP || 5);
  const wMul = gridLineWidthMul();
  let p = 0;
  const pushSeg = (x0, y0, x1, y1) => {
    if (gridLineScratch.length < p + 4) {
      const next = new Float32Array(Math.max(gridLineScratch.length * 2, p + 4096));
      next.set(gridLineScratch);
      gridLineScratch = next;
    }
    gridLineScratch[p++] = x0;
    gridLineScratch[p++] = y0;
    gridLineScratch[p++] = x1;
    gridLineScratch[p++] = y1;
  };

  if (topo === 4) {
    const half = Math.max(1.5, spacing * 0.12 * wMul);
    const nX = Math.max(1, Math.round(W / spacing));
    const nY = Math.max(1, Math.round(H / spacing));
    for (let j = 0; j < nY; j++) {
      for (let i = 0; i < nX; i++) {
        const x = ((i + 0.5) / nX) * W;
        const y = ((j + 0.5) / nY) * H;
        pushSeg(x - half, y, x + half, y);
        pushSeg(x, y - half, x, y + half);
      }
    }
  } else if (topo === 5) {
    const R = spacing;
    const dx = R * Math.sqrt(3);
    const dy = R * 1.5;
    const outer = Math.max(3, R * 0.32 * Math.min(1.6, 0.5 + 0.5 * wMul));
    const rows = Math.ceil(H / dy) + 2;
    const cols = Math.ceil(W / dx) + 2;
    for (let j = -1; j < rows; j++) {
      const y = j * dy + R;
      const xOff = (j & 1) ? dx * 0.5 : 0;
      for (let i = -1; i < cols; i++) {
        const x = i * dx + xOff + R;
        if (x < -outer || x > W + outer || y < -outer || y > H + outer) continue;
        const verts = buildStarPolyFlat(x, y, 5, outer, outer * 0.38, 0);
        const n = verts.length / 2;
        for (let s = 0; s < n; s++) {
          const a = s * 2;
          const b = ((s + 1) % n) * 2;
          pushSeg(verts[a], verts[a + 1], verts[b], verts[b + 1]);
        }
      }
    }
  }

  if (p >= 4) {
    uploadVerts(gridLineScratch.subarray(0, p));
    useDraw(col, alpha);
    gl.drawArrays(gl.LINES, 0, p >> 1);
  }
}

/** Clip to circle and redraw lattice in player color — gaps stay transparent. */
function recolorLatticeInCircle(ctx, sx, sy, r, tw, th, lineStep, rs, topo, lw, color) {
  if (!(r > 1)) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  paintLatticePattern(ctx, tw, th, lineStep, rs, topo, false);
  paintLatticePattern(ctx, tw, th, lineStep, rs, topo, true);
  ctx.restore();
}

/** White face-off markings only (rings, cross, hash ticks) — no filled disc. */
function paintSpawnPadOnGrid(ctx, sx, sy, r, lw, stroke) {
  if (!(r > 1)) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(sx - r, sy);
  ctx.lineTo(sx + r, sy);
  ctx.moveTo(sx, sy - r);
  ctx.lineTo(sx, sy + r);
  ctx.stroke();
  // Short hash ticks at 45° (face-off style)
  const tick = r * 0.18;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(sx + c * (r - tick), sy + s * (r - tick));
    ctx.lineTo(sx + c * (r + tick * 0.35), sy + s * (r + tick * 0.35));
    ctx.stroke();
  }
  // Center spot
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(1.5, lw * 0.6), 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
}

/* ========== Flipper-style arena light chase (match start / respawn) ========== */
const ARENA_LAMP_SPACING = 14 * RES_SCALE;
let arenaLightPaths = null; // [{ x:[], y:[], n, len }]
let arenaLightShow = null; // { kind, t0, color, dur }

function arenaPathPush(paths, pts) {
  if (!pts || pts.length < 4) return;
  const x = [];
  const y = [];
  for (let i = 0; i < pts.length; i += 2) {
    x.push(pts[i]);
    y.push(pts[i + 1]);
  }
  // Resample to even lamp spacing.
  let len = 0;
  for (let i = 1; i < x.length; i++) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  if (len < 1) return;
  const n = Math.max(2, Math.round(len / ARENA_LAMP_SPACING) + 1);
  const ox = new Float32Array(n);
  const oy = new Float32Array(n);
  ox[0] = x[0]; oy[0] = y[0];
  let seg = 0;
  let segT = 0;
  let segLen = Math.hypot(x[1] - x[0], y[1] - y[0]) || 1e-6;
  for (let k = 1; k < n; k++) {
    const target = (k / (n - 1)) * len;
    let traveled = 0;
    // Restart walk (small n — fine).
    seg = 0; segT = 0;
    segLen = Math.hypot(x[1] - x[0], y[1] - y[0]) || 1e-6;
    let acc = 0;
    while (seg < x.length - 1) {
      if (acc + segLen >= target) {
        const u = (target - acc) / segLen;
        ox[k] = x[seg] + (x[seg + 1] - x[seg]) * u;
        oy[k] = y[seg] + (y[seg + 1] - y[seg]) * u;
        break;
      }
      acc += segLen;
      seg++;
      if (seg >= x.length - 1) {
        ox[k] = x[x.length - 1];
        oy[k] = y[y.length - 1];
        break;
      }
      segLen = Math.hypot(x[seg + 1] - x[seg], y[seg + 1] - y[seg]) || 1e-6;
    }
  }
  paths.push({ x: ox, y: oy, n, len });
}

function rebuildArenaLightPaths() {
  const paths = [];
  const m = Math.min(W, H) * 0.08;
  const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
  const cx = W * 0.5, cy = H * 0.5;
  // Perimeter chase (CW from top-left): top → right → bottom → left
  arenaPathPush(paths, [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]);
  // Mid axes (split so chase can run outward)
  const rStar = Math.min(W, H) * 0.14;
  arenaPathPush(paths, [cx - rStar, cy, x0, cy]);
  arenaPathPush(paths, [cx + rStar, cy, x1, cy]);
  arenaPathPush(paths, [cx, cy - rStar, cx, y0]);
  arenaPathPush(paths, [cx, cy + rStar, cx, y1]);
  // Center star outline
  const star = [];
  const starInner = rStar * 0.38;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = (i & 1) === 0 ? rStar : starInner;
    star.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  star.push(star[0], star[1]);
  arenaPathPush(paths, star);
  // Spawn rings
  for (const side of [-1, 1]) {
    const sx = cx + side * SPAWN_CENTER_OFFSET;
    const sy = cy;
    const R = GODMODE_SPAWN_CLEAR_R;
    const ring = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ring.push(sx + Math.cos(a) * R, sy + Math.sin(a) * R);
    }
    arenaPathPush(paths, ring);
  }
  // Corner L marks as short paths
  const c = Math.min(W, H) * 0.05;
  arenaPathPush(paths, [x0, y0 + c, x0, y0, x0 + c, y0]);
  arenaPathPush(paths, [x1 - c, y0, x1, y0, x1, y0 + c]);
  arenaPathPush(paths, [x0, y1 - c, x0, y1, x0 + c, y1]);
  arenaPathPush(paths, [x1 - c, y1, x1, y1, x1, y1 - c]);
  arenaLightPaths = paths;
}

function startArenaLightShow(kind, color) {
  // Colored sport field only (PvP match). Waves/solo/practice stay plain.
  if (practiceMode) {
    arenaLightShow = null;
    return;
  }
  if (!arenaLightPaths) rebuildArenaLightPaths();
  const col = color || [0.75, 0.92, 1.0];
  arenaLightShow = {
    kind: kind || 'match',
    t0: performance.now(),
    color: [col[0], col[1], col[2]],
    dur: kind === 'respawn' ? 1800 : 3400
  };
}

function arenaShowProgress(show, now) {
  const u = Math.max(0, Math.min(1, (now - show.t0) / show.dur));
  if (show.kind === 'respawn') {
    // Fast pad → axes → blink → fade
    if (u < 0.45) return { phase: 'chase', fill: u / 0.45, blink: 1, alpha: 1 };
    if (u < 0.7) return { phase: 'blink', fill: 1, blink: ((now / 90) | 0) % 2 ? 1 : 0.15, alpha: 1 };
    return { phase: 'fade', fill: 1, blink: 1, alpha: 1 - (u - 0.7) / 0.3 };
  }
  // Match: perimeter fill → inner paths → all lit blink → fade
  if (u < 0.32) return { phase: 'chase', fill: u / 0.32, pathFrom: 0, pathTo: 1, blink: 1, alpha: 1 };
  if (u < 0.55) return { phase: 'chase', fill: (u - 0.32) / 0.23, pathFrom: 1, pathTo: 5, blink: 1, alpha: 1 };
  if (u < 0.72) return { phase: 'chase', fill: (u - 0.55) / 0.17, pathFrom: 5, pathTo: 99, blink: 1, alpha: 1 };
  if (u < 0.88) return { phase: 'blink', fill: 1, pathFrom: 0, pathTo: 99, blink: ((now / 100) | 0) % 2 ? 1 : 0.12, alpha: 1 };
  return { phase: 'fade', fill: 1, pathFrom: 0, pathTo: 99, blink: 1, alpha: 1 - (u - 0.88) / 0.12 };
}

function drawArenaLightShow(now) {
  if (practiceMode) {
    arenaLightShow = null;
    return;
  }
  const show = arenaLightShow;
  if (!show) return;
  if (!arenaLightPaths) rebuildArenaLightPaths();
  if (now - show.t0 >= show.dur) {
    arenaLightShow = null;
    return;
  }
  const st = arenaShowProgress(show, now);
  if (!(st.alpha > 0.02)) return;

  const paths = arenaLightPaths;
  const col = show.color;
  const wLit = Math.max(2.2, 3.4 * RES_SCALE);
  const wHead = Math.max(3.5, 5.5 * RES_SCALE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  const pathFrom = st.pathFrom != null ? st.pathFrom : 0;
  const pathTo = st.pathTo != null ? st.pathTo : paths.length;
  const respawnFocus = show.kind === 'respawn';

  for (let pi = 0; pi < paths.length; pi++) {
    // Respawn: prioritize spawn rings (paths 5-6) then axes then perimeter
    let localFill = st.fill;
    let active = true;
    if (respawnFocus) {
      const order = [6, 7, 1, 2, 3, 4, 5, 0, 8, 9, 10, 11];
      const rank = order.indexOf(pi);
      const r = rank < 0 ? 1 : rank / Math.max(1, order.length - 1);
      if (st.phase === 'chase') {
        const window = 0.35;
        localFill = Math.max(0, Math.min(1, (st.fill - r * 0.65) / window));
        active = localFill > 0;
      }
    } else {
      if (pi < pathFrom) localFill = 1;
      else if (pi >= pathTo) active = false;
      else if (st.phase === 'chase') {
        // Within current band, paths light in order
        const band = Math.max(1, pathTo - pathFrom);
        const idx = pi - pathFrom;
        const r = idx / band;
        const window = 0.55;
        localFill = Math.max(0, Math.min(1, (st.fill - r * 0.7) / window));
      } else {
        localFill = 1;
      }
    }
    if (!active) continue;

    const P = paths[pi];
    const litN = Math.max(0, Math.min(P.n, Math.ceil(localFill * P.n)));
    if (litN < 1 && st.phase === 'chase') continue;

    const aMul = st.alpha * st.blink;
    const cGlow = [col[0] * aMul, col[1] * aMul, col[2] * aMul];
    const drawUntil = st.phase === 'chase' ? litN : P.n;
    for (let i = 0; i < drawUntil - 1; i++) {
      drawThickSegment(P.x[i], P.y[i], P.x[i + 1], P.y[i + 1], wLit, cGlow);
    }
    // Chase head sparkle
    if (st.phase === 'chase' && litN > 0 && litN <= P.n) {
      const i = Math.min(P.n - 1, litN - 1);
      const j = Math.min(P.n - 1, i + 1);
      const hx = P.x[i], hy = P.y[i];
      const nx = P.x[j], ny = P.y[j];
      drawThickSegment(hx, hy, nx, ny, wHead, [Math.min(1, cGlow[0] + 0.35), Math.min(1, cGlow[1] + 0.35), Math.min(1, cGlow[2] + 0.35)]);
      // Tiny cross
      const s = 4 * RES_SCALE;
      drawThickSegment(hx - s, hy, hx + s, hy, 1.5, COL_WHITE);
      drawThickSegment(hx, hy - s, hx, hy + s, 1.5, COL_WHITE);
    }
  }

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.BLEND);
}

function drawGridBaked() {
  if (!ensureGridBakeTexture()) return;
  const cells = (GRID_COLS - 1) * (GRID_ROWS - 1);
  const floatsNeeded = cells * 6 * 4; // 2 tris * 3 verts * (x,y,u,v)
  if (!gridBakeVerts || gridBakeVerts.length < floatsNeeded) {
    gridBakeVerts = new Float32Array(floatsNeeded);
  }
  let p = 0;
  const ox = gridBakeOriginX;
  const oy = gridBakeOriginY;
  const iw = 1 / gridBakeWorldW;
  const ih = 1 / gridBakeWorldH;
  const push = (k) => {
    const u = (gridBaseX[k] - ox) * iw;
    const v = (gridBaseY[k] - oy) * ih;
    gridBakeVerts[p++] = gridDefX[k];
    gridBakeVerts[p++] = gridDefY[k];
    gridBakeVerts[p++] = u;
    gridBakeVerts[p++] = v;
  };
  for (let j = 0; j < GRID_ROWS - 1; j++) {
    for (let i = 0; i < GRID_COLS - 1; i++) {
      const k00 = j * GRID_COLS + i;
      const k10 = k00 + 1;
      const k01 = k00 + GRID_COLS;
      const k11 = k01 + 1;
      push(k00); push(k10); push(k01);
      push(k10); push(k11); push(k01);
    }
  }
  gridBakeVertCount = (p / 4) | 0;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(gridBakeProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gridBakeTex);
  gl.uniform1i(gbUTex, 0);
  const useNebula = practiceMode && ensureNebulaGLTexture();
  if (gbUNebula) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, useNebula ? gridNebulaGL : gridBakeTex);
    gl.uniform1i(gbUNebula, 1);
    gl.activeTexture(gl.TEXTURE0);
  }
  if (gbUNebulaOn) gl.uniform1f(gbUNebulaOn, useNebula ? 1 : 0);
  if (gbUNebulaScroll) gl.uniform2f(gbUNebulaScroll, gridNebulaScrollX, gridNebulaScrollY);
  if (gbUNebulaScale) gl.uniform1f(gbUNebulaScale, 1 / GRID_NEBULA_TILE);
  gl.uniform1f(gbUAlpha, Math.max(0, Math.min(1, Number(cv('cl_grid_alpha')))));
  gl.uniform2f(gbURes, W, H);
  gl.uniform2f(gbUWorldOrigin, gridBakeOriginX, gridBakeOriginY);
  gl.uniform2f(gbUWorldSize, gridBakeWorldW, gridBakeWorldH);
  const nowBake = performance.now();
  syncGridAlphaRippleUniforms(nowBake);
  syncGridBoomLightUniforms(nowBake);
  syncGridFlashlightUniforms();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBakeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, gridBakeVerts.subarray(0, p), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(gbAPos);
  gl.enableVertexAttribArray(gbAUV);
  gl.vertexAttribPointer(gbAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(gbAUV, 2, gl.FLOAT, false, 16, 8);
  gl.drawArrays(gl.TRIANGLES, 0, gridBakeVertCount);
  gl.disableVertexAttribArray(gbAPos);
  gl.disableVertexAttribArray(gbAUV);
  gl.disable(gl.BLEND);
}

function drawLines(verts, color, mode, alpha, additive, floatCount) {
  const nFloats = floatCount != null ? (floatCount | 0) : verts.length;
  const n = (nFloats / 2) | 0;
  if (n < 2) return;
  uploadVerts(verts, nFloats);
  const nightBlend = _lightFlashNight > 0.5;
  if (nightBlend || (alpha != null && alpha < 1)) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  }
  useDraw(color, alpha);
  gl.drawArrays(mode, 0, n);
  // Keep blend on through night draws so soft alpha works on outlines too.
  if (!nightBlend && alpha != null && alpha < 1) gl.disable(gl.BLEND);
}

/** Filled convex-ish loop via TRIANGLE_FAN from centroid (half-transparent hitbox).
 *  Pass additive=true for emissive glow (SRC_ALPHA, ONE). */
function drawFilledPoly(verts, color, alpha, additive) {
  const n = (verts.length / 2) | 0;
  if (n < 3) return;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += verts[i * 2];
    cy += verts[i * 2 + 1];
  }
  cx /= n;
  cy /= n;
  const need = 2 + verts.length + 2;
  scratchEnsure(need);
  let p = 0;
  scratch[p++] = cx;
  scratch[p++] = cy;
  for (let i = 0; i < verts.length; i++) scratch[p++] = verts[i];
  scratch[p++] = verts[0];
  scratch[p++] = verts[1];
  drawLines(scratch, color, gl.TRIANGLE_FAN, alpha == null ? 0.35 : alpha, !!additive, p);
}

/** Append a solid thick segment as two triangles into scratch; returns new write index. */
function scratchThickQuad(p, x0, y0, x1, y1, hw) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * hw;
  const ny = (dx / len) * hw;
  scratch[p++] = x0 + nx; scratch[p++] = y0 + ny;
  scratch[p++] = x0 - nx; scratch[p++] = y0 - ny;
  scratch[p++] = x1 + nx; scratch[p++] = y1 + ny;
  scratch[p++] = x0 - nx; scratch[p++] = y0 - ny;
  scratch[p++] = x1 - nx; scratch[p++] = y1 - ny;
  scratch[p++] = x1 + nx; scratch[p++] = y1 + ny;
  return p;
}

/** Round joint/cap so thick segments don't leave corner gaps. */
function scratchThickCap(p, cx, cy, hw, segs) {
  const n = segs || 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    scratch[p++] = cx;
    scratch[p++] = cy;
    scratch[p++] = cx + Math.cos(a0) * hw;
    scratch[p++] = cy + Math.sin(a0) * hw;
    scratch[p++] = cx + Math.cos(a1) * hw;
    scratch[p++] = cy + Math.sin(a1) * hw;
  }
  return p;
}

/** Thick segment as a solid filled quad (no parallel-line gaps).
 *  Pass additive=true for emissive glow (SRC_ALPHA, ONE). */
function drawThickSegment(x0, y0, x1, y1, width, color, alpha, additive) {
  const a = alpha == null ? 1 : alpha;
  const add = !!additive;
  const w = Math.max(1, width | 0);
  if (w === 1) {
    scratchEnsure(4);
    scratch[0] = x0; scratch[1] = y0; scratch[2] = x1; scratch[3] = y1;
    drawLines(scratch, color, gl.LINE_STRIP, a, add, 4);
    return;
  }
  const hw = w * 0.5;
  const capSegs = 8;
  scratchEnsure(12 + capSegs * 2 * 6);
  let p = scratchThickQuad(0, x0, y0, x1, y1, hw);
  p = scratchThickCap(p, x0, y0, hw, capSegs);
  p = scratchThickCap(p, x1, y1, hw, capSegs);
  uploadMainBuf(scratch, p);
  const nightBlend = _lightFlashNight > 0.5;
  if (nightBlend || a < 1 || add) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  }
  useDraw(color, a);
  gl.drawArrays(gl.TRIANGLES, 0, p >> 1);
  if (!nightBlend && (a < 1 || add)) gl.disable(gl.BLEND);
}

/** Thick line with color lerp from c0→c1 along the segment (approx via steps). */
const _gradColScratch = [0, 0, 0];
const _tipHotScratch = [0, 0, 0];
function drawThickGradientSegment(x0, y0, x1, y1, width, c0, c1, steps) {
  const n = Math.max(2, steps | 0);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const tm = (t0 + t1) * 0.5;
    _gradColScratch[0] = c0[0] + (c1[0] - c0[0]) * tm;
    _gradColScratch[1] = c0[1] + (c1[1] - c0[1]) * tm;
    _gradColScratch[2] = c0[2] + (c1[2] - c0[2]) * tm;
    drawThickSegment(
      x0 + (x1 - x0) * t0,
      y0 + (y1 - y0) * t0,
      x0 + (x1 - x0) * t1,
      y0 + (y1 - y0) * t1,
      width,
      _gradColScratch
    );
  }
}

function drawAlphaSegment(x0, y0, x1, y1, color, alpha) {
  scratchEnsure(4);
  scratch[0] = x0; scratch[1] = y0; scratch[2] = x1; scratch[3] = y1;
  drawLines(scratch, color, gl.LINE_STRIP, alpha, false, 4);
}

function drawPoints(items, color, alpha) {
  if (!items.length) return;
  const n = items.length;
  scratchEnsure(n * 2);
  let big = false;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    scratch[i * 2] = Math.round(it.x);
    scratch[i * 2 + 1] = Math.round(it.y);
    if (it.big) big = true;
  }
  uploadMainBuf(scratch, n * 2);
  if (_lightFlashNight > 0.5 || (alpha != null && alpha < 1)) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  useDraw(color, alpha == null ? 1 : alpha);
  gl.uniform1f(uSize, (big ? 3 : 2) * RES_SCALE * getRenderScale());
  gl.drawArrays(gl.POINTS, 0, n);
}

/** Closed polyline at integer pixel width — solid filled quads (no hollow gaps). */
function drawThickLoop(verts, color, width) {
  const n = (verts.length / 2) | 0;
  if (n < 2) return;
  const w = Math.max(1, width | 0);
  if (w === 1) {
    drawLines(verts, color, gl.LINE_LOOP);
    return;
  }
  const hw = w * 0.5;
  const capSegs = 8;
  // 6 floats/tri * 2 tris/edge + 6 floats/tri * capSegs tris/vertex
  scratchEnsure(n * (12 + capSegs * 6));
  let p = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = verts[i * 2];
    const y0 = verts[i * 2 + 1];
    const x1 = verts[j * 2];
    const y1 = verts[j * 2 + 1];
    p = scratchThickQuad(p, x0, y0, x1, y1, hw);
    p = scratchThickCap(p, x0, y0, hw, capSegs);
  }
  uploadMainBuf(scratch, p);
  if (_lightFlashNight > 0.5) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  useDraw(color, 1);
  gl.drawArrays(gl.TRIANGLES, 0, p >> 1);
}

/* ========== Particle system: fixed pool, 1 shader, 1 draw ========== */
const PARTICLE_MAX = 4096;
const pX = new Float32Array(PARTICLE_MAX);
const pY = new Float32Array(PARTICLE_MAX);
const pVx = new Float32Array(PARTICLE_MAX);
const pVy = new Float32Array(PARTICLE_MAX);
const pLife = new Float32Array(PARTICLE_MAX);
const pMaxLife = new Float32Array(PARTICLE_MAX);
const pSize = new Float32Array(PARTICLE_MAX);
const pScaleY = new Float32Array(PARTICLE_MAX);
const pWiggle = new Float32Array(PARTICLE_MAX);
const pWiggleSpd = new Float32Array(PARTICLE_MAX);
const pPhase = new Float32Array(PARTICLE_MAX);
const pDrag = new Float32Array(PARTICLE_MAX);
const pR = new Float32Array(PARTICLE_MAX);
const pG = new Float32Array(PARTICLE_MAX);
const pB = new Float32Array(PARTICLE_MAX);
const pAlive = new Uint8Array(PARTICLE_MAX);
/** 0 = no collide, 1 = can collide once, 2 = already resolved. */
const pCollide = new Uint8Array(PARTICLE_MAX);
/** Bounce off map bounds (sparks). */
const pEdgeBounce = new Uint8Array(PARTICLE_MAX);
/** Ship id to ignore (thrust/smoke vs own hull). 0 = collide with all ships. */
const pSkipShip = new Int32Array(PARTICLE_MAX);
/** 1 = alpha = remaining life fraction (linear). 0 = opaque until last 10%. */
const pFadeLife = new Uint8Array(PARTICLE_MAX);
const pFree = new Int32Array(PARTICLE_MAX);
let pFreeTop = 0;
for (let i = PARTICLE_MAX - 1; i >= 0; i--) pFree[pFreeTop++] = i;

/** Scratch colliders for particle↔world (asteroids + ships). Rebuilt each update. */
const PCOL_MAX = 256;
const pColX = new Float32Array(PCOL_MAX);
const pColY = new Float32Array(PCOL_MAX);
const pColR = new Float32Array(PCOL_MAX);
const pColVx = new Float32Array(PCOL_MAX);
const pColVy = new Float32Array(PCOL_MAX);
const pColAng = new Float32Array(PCOL_MAX);
/** 0 = asteroid, >0 = ship id. */
const pColId = new Int32Array(PCOL_MAX);
/** Asteroid object refs for polygon refine (null for ships). */
const pColAst = new Array(PCOL_MAX);
let pColCount = 0;
const PARTICLE_BOUNCE = 0.55;
/** Fast impact / debris sparks (asteroid death, bullet, rocket, rail). */
const SPARK_SPEED = 195 * RES_SCALE;       // was 300 (+30%) → world 390
const SPARK_SPEED_SPREAD = 260 * RES_SCALE; // was 400 (+30%) → world 520
/** lifetime ± half-spread → 0.5 … 1.0 s */
const SPARK_LIFE = 0.75;
const SPARK_LIFE_SPREAD = 0.5;
/** size ± half-spread → 1 … 3 px */
const SPARK_SIZE = 2;
const SPARK_SIZE_SPREAD = 2;
const PARTICLE_EDGE_BOUNCE = 0.7;

/** Mesh: 6 verts/particle × (x,y,u,v,r,g,b,a) */
const PARTICLE_STRIDE = 8;
const particleMesh = new Float32Array(PARTICLE_MAX * 6 * PARTICLE_STRIDE);
const particleBuf = gl.createBuffer();

const particleVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  attribute vec4 aCol;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec4 vCol;
  varying vec2 vWorld;
  void main() {
    vec2 p = floor(aPos + 0.5) / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    vCol = aCol;
    vWorld = aPos;
  }
`;
const particleFS = `
  precision mediump float;
  varying vec2 vUV;
  varying vec4 vCol;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `
  void main() {
    // Hard-edged axis-aligned quad in particle local UV (−1..1).
    if (abs(vUV.x) > 1.0 || abs(vUV.y) > 1.0) discard;
    float a = vCol.a;
    gl_FragColor = applyNightLitPremul(vCol.rgb, a, vWorld);
  }
`;
const particleProg = gl.createProgram();
gl.bindAttribLocation(particleProg, 0, 'aPos');
gl.bindAttribLocation(particleProg, 1, 'aUV');
gl.bindAttribLocation(particleProg, 2, 'aCol');
gl.attachShader(particleProg, shader(gl.VERTEX_SHADER, particleVS));
gl.attachShader(particleProg, shader(gl.FRAGMENT_SHADER, particleFS));
linkProgram(particleProg);
const pURes = gl.getUniformLocation(particleProg, 'uRes');
const pAPos = gl.getAttribLocation(particleProg, 'aPos');
const pAUV = gl.getAttribLocation(particleProg, 'aUV');
const pACol = gl.getAttribLocation(particleProg, 'aCol');
const particleLightU = {
  night: gl.getUniformLocation(particleProg, 'uFlashNight'),
  ships: gl.getUniformLocation(particleProg, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(particleProg, 'uLightWrap')
};

/** Soft elliptical sprite (UV disc falloff) — used by enemy common shots. */
const softOvalVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  attribute vec4 aCol;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec4 vCol;
  varying vec2 vWorld;
  void main() {
    // No floor() — sub-pixel ovals must not collapse to 2×2 squares.
    vec2 p = aPos / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    vCol = aCol;
    vWorld = aPos;
  }
`;
const softOvalFS = `
  precision mediump float;
  varying vec2 vUV;
  varying vec4 vCol;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `
  void main() {
    float d = length(vUV);
    if (d > 1.0) discard;
    // Smooth alpha → transparent at the rim.
    float edge = 1.0 - smoothstep(0.35, 1.0, d);
    float a = vCol.a * edge * edge;
    gl_FragColor = applyNightLitPremul(vCol.rgb, a, vWorld);
  }
`;
const softOvalProg = gl.createProgram();
gl.bindAttribLocation(softOvalProg, 0, 'aPos');
gl.bindAttribLocation(softOvalProg, 1, 'aUV');
gl.bindAttribLocation(softOvalProg, 2, 'aCol');
gl.attachShader(softOvalProg, shader(gl.VERTEX_SHADER, softOvalVS));
gl.attachShader(softOvalProg, shader(gl.FRAGMENT_SHADER, softOvalFS));
linkProgram(softOvalProg);
const soURes = gl.getUniformLocation(softOvalProg, 'uRes');
const soAPos = gl.getAttribLocation(softOvalProg, 'aPos');
const soAUV = gl.getAttribLocation(softOvalProg, 'aUV');
const soACol = gl.getAttribLocation(softOvalProg, 'aCol');
const softOvalLightU = {
  night: gl.getUniformLocation(softOvalProg, 'uFlashNight'),
  ships: gl.getUniformLocation(softOvalProg, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(softOvalProg, 'uLightWrap')
};
const softOvalMesh = new Float32Array(6 * 8); // 2 tris × stride 8

/**
 * Oriented soft oval. halfW = cross-axis half-size, halfL = along-ang half-size.
 * Does not pixel-snap (avoids tiny ovals collapsing to 2×2 squares).
 */
function drawSoftOval(cx, cy, ang, halfW, halfL, color, alpha, additive) {
  const hx = Math.max(0.5, halfW);
  const hy = Math.max(0.5, halfL);
  const c = Math.cos(ang || 0);
  const s = Math.sin(ang || 0);
  const r = color ? color[0] : 1;
  const g = color ? color[1] : 1;
  const b = color ? color[2] : 1;
  const a = alpha == null ? 1 : alpha;
  // Local: X = cross (UV.x), Y = along (UV.y) — matches particle scaleY convention.
  const lx0 = -hx, ly0 = -hy;
  const lx1 = hx, ly1 = -hy;
  const lx2 = hx, ly2 = hy;
  const lx3 = -hx, ly3 = hy;
  const x0 = cx + lx0 * c - ly0 * s;
  const y0 = cy + lx0 * s + ly0 * c;
  const x1 = cx + lx1 * c - ly1 * s;
  const y1 = cy + lx1 * s + ly1 * c;
  const x2 = cx + lx2 * c - ly2 * s;
  const y2 = cy + lx2 * s + ly2 * c;
  const x3 = cx + lx3 * c - ly3 * s;
  const y3 = cy + lx3 * s + ly3 * c;
  const mesh = softOvalMesh;
  let w = 0;
  const push = (px, py, u, v) => {
    mesh[w++] = px; mesh[w++] = py; mesh[w++] = u; mesh[w++] = v;
    mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
  };
  push(x0, y0, -1, -1); push(x1, y1, 1, -1); push(x2, y2, 1, 1);
  push(x0, y0, -1, -1); push(x2, y2, 1, 1); push(x3, y3, -1, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.DYNAMIC_DRAW);
  gl.useProgram(softOvalProg);
  gl.enableVertexAttribArray(soAPos);
  gl.enableVertexAttribArray(soAUV);
  gl.enableVertexAttribArray(soACol);
  const stride = 8 * 4;
  gl.vertexAttribPointer(soAPos, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(soAUV, 2, gl.FLOAT, false, stride, 8);
  gl.vertexAttribPointer(soACol, 4, gl.FLOAT, false, stride, 16);
  gl.uniform2f(soURes, W, H);
  bindSceneLightUniforms(softOvalLightU);
  gl.enable(gl.BLEND);
  gl.blendFunc(additive ? gl.ONE : gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(soAUV);
  gl.disableVertexAttribArray(soACol);
}

/* ========== Pickup 3D boxes (22×22 strip6 + shiny metal shader) ========== */
const PICKUP_STRIP_FRAMES = 6;
/** Sheet order: health, default, laser, railgun, rocket, shotgun. */
const PICKUP_FRAME = {
  health: 0,
  default: 1,
  laser: 2,
  railgun: 3,
  rocket: 4,
  shotgun: 5,
  plasma: 2,
  voidcannon: 3,
  asteroidgun: 4
};
/** Half-extent of the square pickup crate (sheet cells are 22×22). */
const PICKUP_BOX_HALF = 7 * RES_SCALE * 0.6;
/** Screen lift from local Z so tumbling reads as 3D (top-down view). */
const PICKUP_BOX_LIFT = 0.72;
/** Temporary draw scale (shop UI previews bump this). */
let _shopVisScale = 1;
const pickupVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec2 vWorld;
  void main() {
    vec2 p = floor(aPos + 0.5) / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    vWorld = aPos;
  }
`;
const pickupFS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uFrame;
  uniform float uFrames;
  uniform float uShade;
  varying vec2 vUV;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `

  float texLum(vec2 uv) {
    vec4 t = texture2D(uTex, uv);
    return max(t.r, max(t.g, t.b));
  }

  void main() {
    float fw = 1.0 / uFrames;
    float u0 = uFrame * fw;
    float u1 = u0 + fw;
    // vUV: 0..1 within frame, origin top-left (texture is Y-flipped on upload).
    vec2 base = vec2(u0 + vUV.x * fw, 1.0 - vUV.y);
    // ~1 texel in strip space (22px tall cells).
    float tx = fw / 22.0;
    float ty = 1.0 / 22.0;

    vec4 c0 = texture2D(uTex, base);
    float lum0 = max(c0.r, max(c0.g, c0.b));

    // Soft glow outline: empty texels near solid ones emit a faint fringe.
    float nLum = 0.0;
    nLum = max(nLum, texLum(vec2(clamp(base.x + tx, u0, u1), base.y)));
    nLum = max(nLum, texLum(vec2(clamp(base.x - tx, u0, u1), base.y)));
    nLum = max(nLum, texLum(vec2(base.x, clamp(base.y + ty, 0.0, 1.0))));
    nLum = max(nLum, texLum(vec2(base.x, clamp(base.y - ty, 0.0, 1.0))));
    nLum = max(nLum, texLum(vec2(clamp(base.x + tx, u0, u1), clamp(base.y + ty, 0.0, 1.0))));
    nLum = max(nLum, texLum(vec2(clamp(base.x - tx, u0, u1), clamp(base.y - ty, 0.0, 1.0))));

    float glowPulse = 0.62 + 0.38 * sin(uTime * 4.8 + uFrame * 1.3 + vUV.x * 9.0);

    if (lum0 < 0.04) {
      float fringe = smoothstep(0.02, 0.18, nLum);
      if (fringe < 0.03) discard;
      // Sample neighbor color for tinted rim (not a flat white poly).
      vec4 nc = texture2D(uTex, base + vec2(tx, 0.0));
      if (max(nc.r, max(nc.g, nc.b)) < 0.04) nc = texture2D(uTex, base + vec2(-tx, 0.0));
      if (max(nc.r, max(nc.g, nc.b)) < 0.04) nc = texture2D(uTex, base + vec2(0.0, ty));
      vec3 rim = mix(nc.rgb, vec3(1.0), 0.35);
      float a = fringe * 0.55 * glowPulse;
      gl_FragColor = applyNightLitPremul(rim * 1.4, a * uShade, vWorld);
      return;
    }

    float lum = dot(c0.rgb, vec3(0.299, 0.587, 0.114));
    float mx = max(c0.r, max(c0.g, c0.b));
    float mn = min(c0.r, min(c0.g, c0.b));
    float sat = mx - mn;
    float metal = smoothstep(0.42, 0.78, lum) * (1.0 - smoothstep(0.04, 0.28, sat));

    float phase = uTime * 5.5 + (base.x + base.y) * 28.0 + uFrame * 1.7;
    float wig = metal * 0.0045 * sin(phase);
    vec2 suv = vec2(
      clamp(base.x + wig, u0 + 0.0005, u1 - 0.0005),
      clamp(base.y - wig * 0.65, 0.001, 0.999)
    );
    vec4 c = texture2D(uTex, suv);
    if (max(c.r, max(c.g, c.b)) < 0.04) discard;

    // +50% saturation (push away from luminance).
    float L = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb = clamp(mix(vec3(L), c.rgb, 1.5), 0.0, 1.5);

    // Animated emissive glow from texture colors (bloom-like, no extra geometry).
    float emit = smoothstep(0.2, 0.85, L) * glowPulse;
    c.rgb *= 1.0 + emit * 0.65;
    c.rgb += c.rgb * emit * 0.4;
    // Inner rim boost where silhouette meets empty texels.
    float innerRim = (1.0 - smoothstep(0.04, 0.22, nLum)) * smoothstep(0.04, 0.12, lum0);
    c.rgb += c.rgb * innerRim * 0.55 * glowPulse;

    // Same sweeping shine as weapon / FX text labels.
    float band = vUV.x * 0.75 + vUV.y * 0.35;
    float sweep = fract(band - uTime * 1.55);
    float shine = smoothstep(0.0, 0.07, sweep) * (1.0 - smoothstep(0.07, 0.2, sweep));
    float pulse = 0.55 + 0.45 * sin(uTime * 6.5 + vUV.x * 12.0);
    c.rgb = mix(c.rgb, vec3(1.0), shine * 0.75 * pulse);
    c.rgb += vec3(shine * 0.28);
    c.rgb = min(c.rgb, vec3(2.2));

    // uShade doubles as blink alpha (1 ↔ 0.7); keep rgb full.
    gl_FragColor = applyNightLit(c.rgb, uShade, vWorld);
  }
`;
const pickupProg = gl.createProgram();
gl.bindAttribLocation(pickupProg, 0, 'aPos');
gl.bindAttribLocation(pickupProg, 1, 'aUV');
gl.attachShader(pickupProg, shader(gl.VERTEX_SHADER, pickupVS));
gl.attachShader(pickupProg, shader(gl.FRAGMENT_SHADER, pickupFS));
linkProgram(pickupProg);
const pkURes = gl.getUniformLocation(pickupProg, 'uRes');
const pkUTex = gl.getUniformLocation(pickupProg, 'uTex');
const pkUTime = gl.getUniformLocation(pickupProg, 'uTime');
const pkUFrame = gl.getUniformLocation(pickupProg, 'uFrame');
const pkUFrames = gl.getUniformLocation(pickupProg, 'uFrames');
const pkUShade = gl.getUniformLocation(pickupProg, 'uShade');
const pickupLightU = {
  night: gl.getUniformLocation(pickupProg, 'uFlashNight'),
  ships: gl.getUniformLocation(pickupProg, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(pickupProg, 'uLightWrap')
};
const pkAPos = gl.getAttribLocation(pickupProg, 'aPos');
const pkAUV = gl.getAttribLocation(pickupProg, 'aUV');
const pickupBuf = gl.createBuffer();
/** One face: 6 verts × (x,y,u,v) */
const pickupMesh = new Float32Array(6 * 4);

/** Cube corners: ±1 in local space (scaled at draw). Index layout:
 *  0:-x-y-z 1:+x-y-z 2:+x+y-z 3:-x+y-z
 *  4:-x-y+z 5:+x-y+z 6:+x+y+z 7:-x+y+z
 */
const PICKUP_BOX_UNIT = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];
/** Quad faces: [v0,v1,v2,v3] CCW when viewed from outside; UV maps full icon. */
const PICKUP_BOX_FACES = [
  [4, 5, 6, 7], // +Z
  [1, 0, 3, 2], // -Z
  [5, 1, 2, 6], // +X
  [0, 4, 7, 3], // -X
  [7, 6, 2, 3], // +Y
  [0, 1, 5, 4]  // -Y
];
const PICKUP_BOX_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];
const pickupBoxFaceOrder = [
  { i: 0, z: 0 }, { i: 1, z: 0 }, { i: 2, z: 0 },
  { i: 3, z: 0 }, { i: 4, z: 0 }, { i: 5, z: 0 }
];

const pickupTex = gl.createTexture();
let pickupTexReady = false;
(function loadPickupStrip() {
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, pickupTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    pickupTexReady = true;
  };
  img.onerror = () => console.error('Failed to load pickup sprite strip');
  img.src = 'sprites/sprite3_strip6.png';
})();

function pickupFrameIndex(u) {
  if (u.kind === 'health') return PICKUP_FRAME.health;
  const w = u.weapon || 'default';
  return PICKUP_FRAME[w] != null ? PICKUP_FRAME[w] : PICKUP_FRAME.default;
}

/**
 * Project unit cube (±1) → screen with full tumble (yaw/pitch/roll).
 * Local +Z lifts toward screen-up via PICKUP_BOX_LIFT.
 */
function projectPickupBox3D(cx, cy, half, yaw, pitch, roll) {
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const xy = new Float64Array(16);
  const depth = new Float64Array(8);
  for (let i = 0; i < 8; i++) {
    let x = PICKUP_BOX_UNIT[i][0] * half;
    let y = PICKUP_BOX_UNIT[i][1] * half;
    let z = PICKUP_BOX_UNIT[i][2] * half;
    // roll around X
    let y1 = y * cr - z * sr;
    let z1 = y * sr + z * cr;
    // pitch around Y
    let x2 = x * cp + z1 * sp;
    let z2 = -x * sp + z1 * cp;
    // yaw around Z (screen)
    const wx = x2 * cyaw - y1 * syaw;
    const wy = x2 * syaw + y1 * cyaw;
    xy[i * 2] = cx + wx;
    xy[i * 2 + 1] = cy + wy - z2 * PICKUP_BOX_LIFT;
    depth[i] = z2;
  }
  return { xy, depth };
}

function drawPickupFaceTex(xy, face, frame, shade, tSec) {
  // UV: TL, TR, BR, BL matching face verts after CCW order from outside.
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const tris = [0, 1, 2, 0, 2, 3];
  for (let i = 0; i < 6; i++) {
    const vi = face[tris[i]];
    const uv = uvs[tris[i]];
    pickupMesh[i * 4] = xy[vi * 2];
    pickupMesh[i * 4 + 1] = xy[vi * 2 + 1];
    pickupMesh[i * 4 + 2] = uv[0];
    pickupMesh[i * 4 + 3] = uv[1];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, pickupBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pickupMesh, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(pkAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(pkAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform1f(pkUShade, shade);
  gl.uniform1f(pkUFrame, frame | 0);
  gl.uniform1f(pkUTime, tSec);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawPickupBox3D(x, y, angle, frame, id, alpha) {
  if (!pickupTexReady) return;
  const aMul = alpha == null ? 1 : alpha;
  const half = PICKUP_BOX_HALF * _shopVisScale;
  const t = performance.now() * 0.001;
  const seed = (id | 0) * 1.6180339887;
  // Continuous tumble + server spin angle on yaw.
  const yaw = (angle || 0) + t * 1.35 + seed * 0.9;
  const pitch = t * 1.05 + seed * 1.7;
  const roll = t * 0.85 + seed * 0.55;
  const { xy, depth } = projectPickupBox3D(x, y, half, yaw, pitch, roll);

  for (let i = 0; i < 6; i++) {
    const f = PICKUP_BOX_FACES[i];
    pickupBoxFaceOrder[i].i = i;
    pickupBoxFaceOrder[i].z = (depth[f[0]] + depth[f[1]] + depth[f[2]] + depth[f[3]]) * 0.25;
  }
  pickupBoxFaceOrder.sort((a, b) => a.z - b.z);

  const tSec = t;
  const edgeCol = [0.92, 0.94, 1.0];
  const edgeW = Math.max(1.1, half * 0.18);

  // Painter's algorithm: each front face + its edges, far → near.
  for (let o = 0; o < 6; o++) {
    const fi = pickupBoxFaceOrder[o].i;
    const face = PICKUP_BOX_FACES[fi];
    // Back-face cull in screen space (Y grows downward → CW front faces).
    const ax = xy[face[1] * 2] - xy[face[0] * 2];
    const ay = xy[face[1] * 2 + 1] - xy[face[0] * 2 + 1];
    const bx = xy[face[2] * 2] - xy[face[0] * 2];
    const by = xy[face[2] * 2 + 1] - xy[face[0] * 2 + 1];
    if (ax * by - ay * bx >= 0) continue;

    gl.useProgram(pickupProg);
    gl.enableVertexAttribArray(pkAPos);
    gl.enableVertexAttribArray(pkAUV);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pickupTex);
    gl.uniform1i(pkUTex, 0);
    gl.uniform2f(pkURes, W, H);
    gl.uniform1f(pkUFrames, PICKUP_STRIP_FRAMES);
    bindSceneLightUniforms(pickupLightU);
    // Soft texture glow fringe needs alpha blend (solid pixels stay opaque).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawPickupFaceTex(xy, face, frame, aMul, tSec);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(pkAUV);

    for (let e = 0; e < 4; e++) {
      const a = face[e];
      const b = face[(e + 1) & 3];
      drawThickSegment(xy[a * 2], xy[a * 2 + 1], xy[b * 2], xy[b * 2 + 1], edgeW, edgeCol, aMul);
    }
  }
}

/* ========== Floating shiny WebGL pickup labels ========== */
const fxTextVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec2 vWorld;
  void main() {
    vec2 p = floor(aPos + 0.5) / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    vWorld = aPos;
  }
`;
const fxTextFS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uAlpha;
  varying vec2 vUV;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `
  void main() {
    vec4 c = texture2D(uTex, vec2(vUV.x, 1.0 - vUV.y));
    if (c.a < 0.04) discard;
    float band = vUV.x * 0.75 + vUV.y * 0.35;
    float sweep = fract(band - uTime * 1.55);
    float shine = smoothstep(0.0, 0.07, sweep) * (1.0 - smoothstep(0.07, 0.2, sweep));
    float pulse = 0.55 + 0.45 * sin(uTime * 6.5 + vUV.x * 12.0);
    c.rgb = mix(c.rgb, vec3(1.0), shine * 0.9 * pulse);
    c.rgb += vec3(shine * 0.35);
    gl_FragColor = applyNightLit(c.rgb, c.a * uAlpha, vWorld);
  }
`;
const fxTextProg = gl.createProgram();
gl.bindAttribLocation(fxTextProg, 0, 'aPos');
gl.bindAttribLocation(fxTextProg, 1, 'aUV');
gl.attachShader(fxTextProg, shader(gl.VERTEX_SHADER, fxTextVS));
gl.attachShader(fxTextProg, shader(gl.FRAGMENT_SHADER, fxTextFS));
linkProgram(fxTextProg);
const fxTURes = gl.getUniformLocation(fxTextProg, 'uRes');
const fxTUTex = gl.getUniformLocation(fxTextProg, 'uTex');
const fxTUTime = gl.getUniformLocation(fxTextProg, 'uTime');
const fxTUAlpha = gl.getUniformLocation(fxTextProg, 'uAlpha');
const fxTextLightU = {
  night: gl.getUniformLocation(fxTextProg, 'uFlashNight'),
  ships: gl.getUniformLocation(fxTextProg, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(fxTextProg, 'uLightWrap')
};
const fxTAPos = gl.getAttribLocation(fxTextProg, 'aPos');
const fxTAUV = gl.getAttribLocation(fxTextProg, 'aUV');
const fxTextBuf = gl.createBuffer();
const fxTextMesh = new Float32Array(6 * 4);
const fxLabels = [];

function cssRgb(col) {
  return 'rgb(' + ((col[0] * 255) | 0) + ',' + ((col[1] * 255) | 0) + ',' + ((col[2] * 255) | 0) + ')';
}

function bakeFxLabelTexture(text, color) {
  const fontSize = 28;
  const padX = 10;
  const padY = 8;
  const fontFamily = '"Press Start 2P", Consolas, "Courier New", monospace';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = fontSize + 'px ' + fontFamily;
  const w = Math.ceil(ctx.measureText(text).width + padX * 2);
  const h = Math.ceil(fontSize * 1.65 + padY * 2);
  c.width = Math.max(4, w);
  c.height = Math.max(4, h);
  ctx.font = fontSize + 'px ' + fontFamily;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = c.width * 0.5;
  const cy = c.height * 0.52;

  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, cx, cy);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, cx, cy);

  const grd = ctx.createLinearGradient(0, cy - fontSize * 0.65, 0, cy + fontSize * 0.65);
  const r = (color[0] * 255) | 0, g = (color[1] * 255) | 0, b = (color[2] * 255) | 0;
  grd.addColorStop(0, 'rgb(' + Math.min(255, r + 70) + ',' + Math.min(255, g + 70) + ',' + Math.min(255, b + 70) + ')');
  grd.addColorStop(0.45, cssRgb(color));
  grd.addColorStop(1, 'rgb(' + Math.max(0, r - 40) + ',' + Math.max(0, g - 40) + ',' + Math.max(0, b - 40) + ')');
  ctx.fillStyle = grd;
  ctx.fillText(text, cx, cy);

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeText(text, cx, cy);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, tw: c.width, th: c.height };
}

function spawnFxLabel(x, y, text, color, opts) {
  opts = opts || {};
  const baked = bakeFxLabelTexture(String(text || '').toUpperCase(), color || COL_WHITE);
  const life = opts.life != null ? opts.life : 1.35;
  const scale = opts.scale != null ? opts.scale : 1;
  fxLabels.push({
    x, y,
    born: performance.now(),
    life: life * 1000,
    tex: baked.tex,
    tw: baked.tw,
    th: baked.th,
    color: color || COL_WHITE,
    arrow: !!opts.arrow,
    scale,
    pop: opts.pop != null ? opts.pop : 1.15
  });
  if (fxLabels.length > 12) {
    const old = fxLabels.shift();
    if (old && old.tex) gl.deleteTexture(old.tex);
  }
}

function clearFxLabels() {
  for (const L of fxLabels) {
    if (L.tex) gl.deleteTexture(L.tex);
  }
  fxLabels.length = 0;
}

/** Top-of-screen shiny WAVE banner (solo mode). */
let waveBanner = null;
let soloWave = 0;
/** Solo / practice remaining lives (server authoritative). */
let soloLives = 3;

function setSoloLives(n) {
  soloLives = Math.max(0, n | 0);
  syncSoloWaitBanner();
}

function clearWaveBanner() {
  if (!waveBanner) return;
  if (waveBanner.title && waveBanner.title.tex) gl.deleteTexture(waveBanner.title.tex);
  if (waveBanner.sub && waveBanner.sub.tex) gl.deleteTexture(waveBanner.sub.tex);
  waveBanner = null;
}

function startWaveBanner(n) {
  clearWaveBanner();
  const wave = Math.max(1, n | 0);
  soloWave = wave;
  const titleCol = [1.0, 0.92, 0.45];
  const subCol = [0.55, 0.95, 1.0];
  waveBanner = {
    n: wave,
    born: performance.now(),
    life: 3400,
    title: bakeFxLabelTexture('WAVE ' + wave, titleCol),
    sub: bakeFxLabelTexture('CLEAR THE FIELD', subCol)
  };
  syncSoloWaitBanner();
}

function syncSoloWaitBanner() {
  if (!practiceMode || !waitBannerEl) return;
  waitBannerEl.classList.remove('hidden');
  waitBannerEl.style.top = '5px';
  waitBannerEl.style.bottom = 'auto';
  const w = soloWave > 0 ? soloWave : 1;
  if (coopMode) {
    waitBannerEl.textContent = 'Coop waves · Wave ' + w + ' · Lives ' + soloLives;
  } else if (soloOnlyMode) {
    waitBannerEl.textContent = 'Singleplayer · Wave ' + w + ' · Lives ' + soloLives;
  } else {
    waitBannerEl.textContent = 'Solo waves · Wave ' + w + ' · Lives ' + soloLives + ' · matchmaking…';
  }
}

function drawWaveBanner(now) {
  if (!waveBanner) return;
  const age = now - waveBanner.born;
  if (age >= waveBanner.life) {
    clearWaveBanner();
    return;
  }
  const u = age / waveBanner.life;
  let alpha = 1;
  if (u < 0.1) alpha = u / 0.1;
  else if (u > 0.7) alpha = 1 - (u - 0.7) / 0.3;
  alpha = Math.max(0, Math.min(1, alpha));

  let pop = 1;
  if (u < 0.2) {
    const p = u / 0.2;
    pop = 0.45 + 0.7 * (1 - Math.pow(1 - p, 3));
  } else if (u < 0.32) {
    pop = 1.15 - 0.15 * ((u - 0.2) / 0.12);
  }

  const bob = Math.sin(now * 0.006) * 2.5 * RES_SCALE;
  const titleY = 28 * RES_SCALE + bob;
  const subY = titleY + 18 * RES_SCALE;

  function blit(baked, cx, cy, scale, a) {
    if (!baked || !baked.tex) return;
    const worldH = 14 * RES_SCALE * scale;
    const worldW = worldH * (baked.tw / Math.max(1, baked.th));
    const hw = worldW * 0.5;
    const hh = worldH * 0.5;
    const corners = [
      [-hw, -hh, 0, 0],
      [hw, -hh, 1, 0],
      [-hw, hh, 0, 1],
      [hw, hh, 1, 1]
    ];
    const idx = [0, 1, 2, 1, 3, 2];
    for (let v = 0; v < 6; v++) {
      const q = corners[idx[v]];
      fxTextMesh[v * 4] = cx + q[0];
      fxTextMesh[v * 4 + 1] = cy + q[1];
      fxTextMesh[v * 4 + 2] = q[2];
      fxTextMesh[v * 4 + 3] = q[3];
    }
    gl.bindTexture(gl.TEXTURE_2D, baked.tex);
    gl.bufferData(gl.ARRAY_BUFFER, fxTextMesh, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(fxTAPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(fxTAUV, 2, gl.FLOAT, false, 16, 8);
    gl.uniform1f(fxTUAlpha, a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  gl.useProgram(fxTextProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, fxTextBuf);
  gl.enableVertexAttribArray(fxTAPos);
  gl.enableVertexAttribArray(fxTAUV);
  gl.uniform2f(fxTURes, W, H);
  bindSceneLightUniforms(fxTextLightU);
  gl.uniform1f(fxTUTime, now * 0.001);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(fxTUTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  blit(waveBanner.title, W * 0.5, titleY, 1.55 * pop, alpha);
  blit(waveBanner.sub, W * 0.5, subY, 0.72 * pop, alpha * 0.9);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(fxTAUV);
}

/** Persistent bottom-left canvas credits (WebGL shiny text). */
let canvasCredits = null;

function ensureCanvasCredits() {
  if (canvasCredits) return canvasCredits;
  canvasCredits = {
    line1: bakeFxLabelTexture('created by szkodnik', [0.55, 0.9, 1.0]),
    line2: bakeFxLabelTexture('music by NeuroDancer', [1.0, 0.62, 0.88])
  };
  return canvasCredits;
}

function drawCanvasCredits(now) {
  const cr = ensureCanvasCredits();
  if (!cr || !cr.line1 || !cr.line2) return;
  const t = now * 0.001;
  const bob = Math.sin(t * 1.85) * 2.8 * RES_SCALE;
  const pulse = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(t * 2.35));
  const left = 10 * RES_SCALE;
  // 80% bigger than prior (was lineH 7.2).
  const lineH = 12.96 * RES_SCALE;
  const gap = 15.3 * RES_SCALE;
  const y2 = H - 16 * RES_SCALE + bob;
  const y1 = y2 - gap;

  function blitLeft(baked, x0, cy, a) {
    if (!baked || !baked.tex || a <= 0.01) return;
    const worldH = lineH;
    const worldW = worldH * (baked.tw / Math.max(1, baked.th));
    const hw = worldW * 0.5;
    const hh = worldH * 0.5;
    const cx = x0 + hw;
    const corners = [
      [-hw, -hh, 0, 0],
      [hw, -hh, 1, 0],
      [-hw, hh, 0, 1],
      [hw, hh, 1, 1]
    ];
    const idx = [0, 1, 2, 1, 3, 2];
    for (let v = 0; v < 6; v++) {
      const q = corners[idx[v]];
      fxTextMesh[v * 4] = cx + q[0];
      fxTextMesh[v * 4 + 1] = cy + q[1];
      fxTextMesh[v * 4 + 2] = q[2];
      fxTextMesh[v * 4 + 3] = q[3];
    }
    gl.bindTexture(gl.TEXTURE_2D, baked.tex);
    gl.bufferData(gl.ARRAY_BUFFER, fxTextMesh, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(fxTAPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(fxTAUV, 2, gl.FLOAT, false, 16, 8);
    gl.uniform1f(fxTUAlpha, a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  gl.useProgram(fxTextProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, fxTextBuf);
  gl.enableVertexAttribArray(fxTAPos);
  gl.enableVertexAttribArray(fxTAUV);
  gl.uniform2f(fxTURes, W, H);
  bindSceneLightUniforms(fxTextLightU);
  gl.uniform1f(fxTUTime, t);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(fxTUTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  blitLeft(cr.line1, left, y1, pulse);
  blitLeft(cr.line2, left, y2, pulse * 0.92);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(fxTAUV);
}

function drawUpgradeArrow(cx, cy, color, t, alpha) {
  const bob = Math.sin(t * 11) * 5 * RES_SCALE;
  const pulse = 0.85 + 0.15 * Math.sin(t * 14);
  const y = cy + bob;
  const h = 14 * RES_SCALE * pulse;
  const w = 11 * RES_SCALE * pulse;
  const col = color || COL_WHITE;
  // Shaft
  drawThickSegment(cx, y + h * 0.35, cx, y - h * 0.55, 2.4 * RES_SCALE, col);
  // Chevron head
  drawThickSegment(cx, y - h * 0.55, cx - w, y - h * 0.05, 2.4 * RES_SCALE, col);
  drawThickSegment(cx, y - h * 0.55, cx + w, y - h * 0.05, 2.4 * RES_SCALE, col);
  // Soft second chevron for shine
  const y2 = y - 3 * RES_SCALE;
  drawAlphaSegment(cx, y2 - h * 0.35, cx - w * 0.7, y2, col, alpha * 0.55);
  drawAlphaSegment(cx, y2 - h * 0.35, cx + w * 0.7, y2, col, alpha * 0.55);
}

function drawFxLabels(now) {
  if (!fxLabels.length) return;
  const tSec = now * 0.001;
  const arrows = [];

  gl.useProgram(fxTextProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, fxTextBuf);
  gl.enableVertexAttribArray(fxTAPos);
  gl.enableVertexAttribArray(fxTAUV);
  gl.uniform2f(fxTURes, W, H);
  bindSceneLightUniforms(fxTextLightU);
  gl.uniform1f(fxTUTime, tSec);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(fxTUTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  for (let i = fxLabels.length - 1; i >= 0; i--) {
    const L = fxLabels[i];
    const age = now - L.born;
    if (age >= L.life) {
      if (L.tex) gl.deleteTexture(L.tex);
      fxLabels.splice(i, 1);
      continue;
    }
    const u = age / L.life;
    let alpha = 1;
    if (u < 0.12) alpha = u / 0.12;
    else if (u > 0.65) alpha = 1 - (u - 0.65) / 0.35;
    alpha = Math.max(0, Math.min(1, alpha));

    let pop = 1;
    if (u < 0.18) {
      const p = u / 0.18;
      pop = 0.55 + (L.pop - 0.55) * (1 - Math.pow(1 - p, 3));
    } else if (u < 0.28) {
      pop = L.pop - (L.pop - 1) * ((u - 0.18) / 0.1);
    }

    const rise = (18 + 22 * u) * RES_SCALE;
    const cx = L.x;
    const cy = L.y - rise;
    const worldH = 10 * RES_SCALE * L.scale * pop;
    const worldW = worldH * (L.tw / Math.max(1, L.th));
    const hw = worldW * 0.5;
    const hh = worldH * 0.5;
    const arrowGap = L.arrow ? 16 * RES_SCALE * L.scale : 0;
    const textCy = cy + arrowGap * 0.15;

    const corners = [
      [-hw, -hh, 0, 0],
      [hw, -hh, 1, 0],
      [-hw, hh, 0, 1],
      [hw, hh, 1, 1]
    ];
    const idx = [0, 1, 2, 1, 3, 2];
    for (let v = 0; v < 6; v++) {
      const q = corners[idx[v]];
      fxTextMesh[v * 4] = cx + q[0];
      fxTextMesh[v * 4 + 1] = textCy + q[1];
      fxTextMesh[v * 4 + 2] = q[2];
      fxTextMesh[v * 4 + 3] = q[3];
    }
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.bufferData(gl.ARRAY_BUFFER, fxTextMesh, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(fxTAPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(fxTAUV, 2, gl.FLOAT, false, 16, 8);
    gl.uniform1f(fxTUAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (L.arrow) {
      arrows.push({
        x: cx,
        y: textCy - hh - 6 * RES_SCALE,
        color: L.color,
        alpha
      });
    }
  }

  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(fxTAUV);

  for (const a of arrows) {
    drawUpgradeArrow(a.x, a.y, a.color, tSec, a.alpha);
  }
}

/** Persistent world shiny text (powerup pickups). */
const powerupLabelCache = Object.create(null);
function powerupLetter(name) {
  switch (name) {
    case 'damage': return 'D';
    case 'turret': return 'T';
    case 'shield': return 'S';
    case 'homing': return 'H';
    case 'lead': return 'L';
    case 'emp': return 'E';
    case 'reload': return 'R';
    default: return '?';
  }
}

/**
 * Per-powerup text orbit: unique glyph/name, count, mount pattern, and cage shape.
 * Counts are 6 / 8 / 10. Some use full names instead of single letters.
 */
const POWERUP_ORBIT = {
  // Full name on 6 axes (cross + poles) — octa cage
  damage: { text: 'DAMAGE', pattern: 'cube6', orbit: 'octa', textScale: 0.36, orbitR: 1.18 },
  // Classic 6 face letters — sphere cage
  turret: { text: 'T', pattern: 'cube6', orbit: 'sphere', textScale: 0.95, orbitR: 1 },
  // 8 corner mounts — cube cage
  shield: { text: 'S', pattern: 'cube8', orbit: 'cube', textScale: 0.82, orbitR: 1.08 },
  // 8 equatorial ring — flat ring cage
  homing: { text: 'H', pattern: 'ring8', orbit: 'ring', textScale: 0.88, orbitR: 1.12 },
  // Full short name on 6 faces — irregular cage
  lead: { text: 'LEAD', pattern: 'cube6', orbit: 'irregular', textScale: 0.46, orbitR: 1.14 },
  // Full EMP on triangular-prism verts — prism cage
  emp: { text: 'EMP', pattern: 'triPrism6', orbit: 'prism', textScale: 0.5, orbitR: 1.12 },
  // 10 = ring8 + poles — hex cage
  reload: { text: 'R', pattern: 'ring8poles', orbit: 'hex', textScale: 0.8, orbitR: 1.08 }
};

function powerupOrbitStyle(name) {
  return POWERUP_ORBIT[name] || POWERUP_ORBIT.turret;
}

function getPowerupLabelBake(name) {
  const style = powerupOrbitStyle(name);
  const text = style.text || powerupLetter(name);
  const key = name + '::' + text;
  let baked = powerupLabelCache[key];
  if (baked) return baked;
  baked = bakeFxLabelTexture(text, powerupColor(name));
  powerupLabelCache[key] = baked;
  return baked;
}

function norm3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function powerupOrbitDirs(pattern) {
  if (pattern === 'cube8') {
    const o = [];
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) o.push(norm3([x, y, z]));
      }
    }
    return o;
  }
  if (pattern === 'ring8' || pattern === 'ring8poles') {
    const o = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      o.push([Math.cos(a), Math.sin(a), 0]);
    }
    if (pattern === 'ring8poles') o.push([0, 0, 1], [0, 0, -1]);
    return o;
  }
  if (pattern === 'dual5') {
    const o = [];
    for (let ring = 0; ring < 2; ring++) {
      const z = ring === 0 ? 0.42 : -0.42;
      const off = ring * (Math.PI / 5);
      const rr = Math.sqrt(Math.max(0, 1 - z * z));
      for (let i = 0; i < 5; i++) {
        const a = off + (i / 5) * Math.PI * 2;
        o.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
      }
    }
    return o;
  }
  if (pattern === 'triPrism6') {
    const s = Math.sqrt(3) * 0.5;
    return [
      norm3([1, 0, 0.55]), norm3([-0.5, s, 0.55]), norm3([-0.5, -s, 0.55]),
      norm3([1, 0, -0.55]), norm3([-0.5, s, -0.55]), norm3([-0.5, -s, -0.55])
    ];
  }
  // cube6 default — face centers
  return [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];
}

function drawShinyWorldText(x, y, angle, baked, scale) {
  if (!baked || !baked.tex) return;
  const sc = scale != null ? scale : 1;
  const worldH = 14 * RES_SCALE * sc;
  const worldW = worldH * (baked.tw / Math.max(1, baked.th));
  const hw = worldW * 0.5;
  const hh = worldH * 0.5;
  const c = Math.cos(angle || 0);
  const s = Math.sin(angle || 0);
  const corners = [
    [-hw, -hh, 0, 0],
    [hw, -hh, 1, 0],
    [-hw, hh, 0, 1],
    [hw, hh, 1, 1]
  ];
  const idx = [0, 1, 2, 1, 3, 2];
  for (let v = 0; v < 6; v++) {
    const q = corners[idx[v]];
    const lx = q[0], ly = q[1];
    fxTextMesh[v * 4] = x + lx * c - ly * s;
    fxTextMesh[v * 4 + 1] = y + lx * s + ly * c;
    fxTextMesh[v * 4 + 2] = q[2];
    fxTextMesh[v * 4 + 3] = q[3];
  }
  gl.useProgram(fxTextProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, fxTextBuf);
  gl.bufferData(gl.ARRAY_BUFFER, fxTextMesh, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(fxTAPos);
  gl.enableVertexAttribArray(fxTAUV);
  gl.vertexAttribPointer(fxTAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(fxTAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform2f(fxTURes, W, H);
  bindSceneLightUniforms(fxTextLightU);
  gl.uniform1f(fxTUTime, performance.now() * 0.001);
  gl.uniform1f(fxTUAlpha, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, baked.tex);
  gl.uniform1i(fxTUTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(fxTAUV);
}

/** Draw shiny letter from 4 already-projected screen corners (TL,TR,BR,BL). */
function drawShinyWorldQuad(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3, baked, alpha) {
  if (!baked || !baked.tex) return;
  const a = alpha == null ? 1 : alpha;
  if (a <= 0.01) return;
  const idx = [0, 1, 2, 0, 2, 3];
  const xs = [sx0, sx1, sx2, sx3];
  const ys = [sy0, sy1, sy2, sy3];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let v = 0; v < 6; v++) {
    const i = idx[v];
    fxTextMesh[v * 4] = xs[i];
    fxTextMesh[v * 4 + 1] = ys[i];
    fxTextMesh[v * 4 + 2] = uvs[i][0];
    fxTextMesh[v * 4 + 3] = uvs[i][1];
  }
  gl.useProgram(fxTextProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, fxTextBuf);
  gl.bufferData(gl.ARRAY_BUFFER, fxTextMesh, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(fxTAPos);
  gl.enableVertexAttribArray(fxTAUV);
  gl.vertexAttribPointer(fxTAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(fxTAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform2f(fxTURes, W, H);
  bindSceneLightUniforms(fxTextLightU);
  gl.uniform1f(fxTUTime, performance.now() * 0.001);
  gl.uniform1f(fxTUAlpha, a);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, baked.tex);
  gl.uniform1i(fxTUTex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(fxTAUV);
}

/* ========== Powerup LOD sphere + 6 sticking letters ========== */
const POWERUP_VIS_SCALE = (0.5 + 0.7) * 0.3 * 1.5; // whole pickup; was 0.3×, now +50% (1.5×)
const POWERUP_SPHERE_R = 6.2 * RES_SCALE * POWERUP_VIS_SCALE;
/** Invisible letter orbit — 20% smaller than original 9.4, then × VIS_SCALE. */
const POWERUP_LETTER_R = 7.52 * RES_SCALE * POWERUP_VIS_SCALE;
const POWERUP_SPHERE_LIFT = 0.72;
const POWERUP_LETTER_SCALE = 0.95 * POWERUP_VIS_SCALE;

function tumbleRotateLocal(x, y, z, cyaw, syaw, cp, sp, cr, sr) {
  // roll X → pitch Y → yaw Z
  const y1 = y * cr - z * sr;
  const z1 = y * sr + z * cr;
  const x2 = x * cp + z1 * sp;
  const z2 = -x * sp + z1 * cp;
  const wx = x2 * cyaw - y1 * syaw;
  const wy = x2 * syaw + y1 * cyaw;
  return { wx, wy, wz: z2 };
}

function finalizePowerupMesh(rawVerts, faces) {
  let maxR = 1e-6;
  for (let i = 0; i < rawVerts.length; i++) {
    const v = rawVerts[i];
    const r = Math.hypot(v[0], v[1], v[2]);
    if (r > maxR) maxR = r;
  }
  const inv = 1 / maxR;
  const verts = rawVerts.map((v) => [v[0] * inv, v[1] * inv, v[2] * inv]);
  const edgeSet = new Set();
  const edges = [];
  for (let f = 0; f < faces.length; f++) {
    const tri = faces[f];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      const key = a < b ? a + ',' + b : b + ',' + a;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push([a, b]);
    }
  }
  return { verts, faces, edges };
}

function buildIcosphere(subdiv) {
  const t = (1 + Math.sqrt(5)) * 0.5;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const inv = 1 / Math.hypot(v[0], v[1], v[2]);
    verts[i] = [v[0] * inv, v[1] * inv, v[2] * inv];
  }
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  const midCache = new Map();
  function mid(a, b) {
    const i0 = Math.min(a, b), i1 = Math.max(a, b);
    const key = i0 + ',' + i1;
    if (midCache.has(key)) return midCache.get(key);
    const va = verts[a], vb = verts[b];
    let x = va[0] + vb[0], y = va[1] + vb[1], z = va[2] + vb[2];
    const inv = 1 / Math.hypot(x, y, z);
    const idx = verts.length;
    verts.push([x * inv, y * inv, z * inv]);
    midCache.set(key, idx);
    return idx;
  }
  for (let s = 0; s < subdiv; s++) {
    midCache.clear();
    const next = [];
    for (let f = 0; f < faces.length; f++) {
      const a = faces[f][0], b = faces[f][1], c = faces[f][2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return finalizePowerupMesh(verts, faces);
}

/** Diamond / octahedron — damage. */
function buildOctahedronMesh() {
  const verts = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
  ];
  const faces = [
    [4, 0, 2], [4, 2, 1], [4, 1, 3], [4, 3, 0],
    [5, 2, 0], [5, 1, 2], [5, 3, 1], [5, 0, 3]
  ];
  return finalizePowerupMesh(verts, faces);
}

/** Cube — shield. */
function buildCubeMesh() {
  const verts = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3],
    [4, 6, 5], [4, 7, 6],
    [0, 4, 5], [0, 5, 1],
    [2, 6, 7], [2, 7, 3],
    [0, 3, 7], [0, 7, 4],
    [1, 5, 6], [1, 6, 2]
  ];
  return finalizePowerupMesh(verts, faces);
}

/** Tetrahedron — homing. */
function buildTetrahedronMesh() {
  const verts = [
    [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]
  ];
  const faces = [
    [0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]
  ];
  return finalizePowerupMesh(verts, faces);
}

/** Distorted cube (8 verts) — lead. */
function buildIrregular8Mesh() {
  const verts = [
    [-0.95, -0.82, -1.05],
    [1.12, -0.70, -0.88],
    [0.78, 1.18, -0.95],
    [-1.05, 0.90, -0.72],
    [-0.88, -1.10, 0.95],
    [1.05, -0.85, 1.12],
    [0.92, 0.98, 0.78],
    [-0.75, 1.05, 1.15]
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3],
    [4, 6, 5], [4, 7, 6],
    [0, 4, 5], [0, 5, 1],
    [2, 6, 7], [2, 7, 3],
    [0, 3, 7], [0, 7, 4],
    [1, 5, 6], [1, 6, 2]
  ];
  return finalizePowerupMesh(verts, faces);
}

/** Triangular prism — emp. */
function buildTriPrismMesh() {
  const s = Math.sqrt(3) * 0.5;
  const verts = [
    [1, 0, 0.85], [-0.5, s, 0.85], [-0.5, -s, 0.85],
    [1, 0, -0.85], [-0.5, s, -0.85], [-0.5, -s, -0.85]
  ];
  const faces = [
    [0, 1, 2],
    [3, 5, 4],
    [0, 3, 4], [0, 4, 1],
    [1, 4, 5], [1, 5, 2],
    [2, 5, 3], [2, 3, 0]
  ];
  return finalizePowerupMesh(verts, faces);
}

/** Hexagonal bipyramid (8 verts) — reload. */
function buildHexBipyramidMesh() {
  const verts = [[0, 0, 1.15], [0, 0, -1.15]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    verts.push([Math.cos(a), Math.sin(a), 0]);
  }
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const a = 2 + i;
    const b = 2 + ((i + 1) % 6);
    faces.push([0, a, b], [1, b, a]);
  }
  return finalizePowerupMesh(verts, faces);
}

const POWERUP_SPHERE_LODS = [
  buildIcosphere(0), // 20 tris
  buildIcosphere(1), // 80 tris
  buildIcosphere(2)  // 320 tris
];

/** Hardcoded silhouette per powerup (turret keeps LOD sphere). */
const POWERUP_SHAPE_MESH = {
  damage: buildOctahedronMesh(),
  turret: null, // sphere LODs
  shield: buildCubeMesh(),
  homing: buildTetrahedronMesh(),
  lead: buildIrregular8Mesh(),
  emp: buildTriPrismMesh(),
  reload: buildHexBipyramidMesh()
};

/** Flat octagon wire used as "ring" letter cage. */
function buildRingOrbitMesh() {
  const verts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    verts.push([Math.cos(a), Math.sin(a), 0]);
  }
  const faces = [];
  for (let i = 1; i < 7; i++) faces.push([0, i, i + 1]);
  return finalizePowerupMesh(verts, faces);
}
const POWERUP_RING_ORBIT_MESH = buildRingOrbitMesh();

function powerupOrbitShellMesh(orbit) {
  if (orbit === 'cube') return POWERUP_SHAPE_MESH.shield;
  if (orbit === 'octa') return POWERUP_SHAPE_MESH.damage;
  if (orbit === 'prism') return POWERUP_SHAPE_MESH.emp;
  if (orbit === 'hex') return POWERUP_SHAPE_MESH.reload;
  if (orbit === 'irregular') return POWERUP_SHAPE_MESH.lead;
  if (orbit === 'ring') return POWERUP_RING_ORBIT_MESH;
  return POWERUP_SPHERE_LODS[0];
}

function powerupShapeMesh(name, lod) {
  if (name === 'turret' || !POWERUP_SHAPE_MESH[name]) {
    return POWERUP_SPHERE_LODS[lod] || POWERUP_SPHERE_LODS[0];
  }
  return POWERUP_SHAPE_MESH[name];
}

/** @deprecated kept as fallback — prefer powerupOrbitDirs(style.pattern) */
const POWERUP_LETTER_DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

function powerupSphereLod(x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const d2 = dx * dx + dy * dy;
  const near = 110 * RES_SCALE;
  const mid = 220 * RES_SCALE;
  if (d2 < near * near) return 2;
  if (d2 < mid * mid) return 1;
  return 0;
}

function powerupTumbleAngles(angle, id) {
  const t = performance.now() * 0.001;
  const seed = (id | 0) * 1.6180339887;
  return {
    yaw: (angle || 0) + t * 1.15 + seed * 0.7,
    pitch: t * 0.95 + seed * 1.4,
    roll: t * 0.72 + seed * 0.5
  };
}

function projectPowerupMesh(verts, cx, cy, scale, yaw, pitch, roll, outXY, outDepth) {
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const r = tumbleRotateLocal(v[0] * scale, v[1] * scale, v[2] * scale, cyaw, syaw, cp, sp, cr, sr);
    outXY[i * 2] = cx + r.wx;
    outXY[i * 2 + 1] = cy + r.wy - r.wz * POWERUP_SPHERE_LIFT;
    outDepth[i] = r.wz;
  }
}

const _pwrSphXY = new Float64Array(320 * 3 * 2); // enough for lod2 verts (~162)
const _pwrSphDepth = new Float64Array(320 * 3);
const _pwrFaceOrder = [];
const _pwrTriScratch = [0, 0, 0, 0, 0, 0];
const _pwrCol = [0, 0, 0];
const _pwrEdgeCol = [0, 0, 0];

function drawPowerupSphereMesh(cx, cy, color, yaw, pitch, roll, lod, alpha, powerupName) {
  const mesh = powerupShapeMesh(powerupName, lod);
  const xy = _pwrSphXY;
  const depth = _pwrSphDepth;
  const sphR = POWERUP_SPHERE_R * _shopVisScale;
  const aMul = alpha == null ? 1 : alpha;
  projectPowerupMesh(mesh.verts, cx, cy, sphR, yaw, pitch, roll, xy, depth);

  const faces = mesh.faces;
  while (_pwrFaceOrder.length < faces.length) _pwrFaceOrder.push({ i: 0, z: 0 });
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    _pwrFaceOrder[i].i = i;
    _pwrFaceOrder[i].z = z;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const used = _pwrFaceOrder.slice(0, faces.length);
  used.sort((a, b) => a.z - b.z);
  const zSpan = Math.max(1e-4, zMax - zMin);
  const base = color || COL.pickup;
  const t = performance.now() * 0.001;
  const pulse = 0.55 + 0.45 * Math.sin(t * 6.5 + cx * 0.07 + cy * 0.05);

  const dark = [
    base[0] * 0.22,
    base[1] * 0.22,
    base[2] * 0.22
  ];

  _pwrEdgeCol[0] = Math.min(1, base[0] * 0.4 + 0.6);
  _pwrEdgeCol[1] = Math.min(1, base[1] * 0.4 + 0.6);
  _pwrEdgeCol[2] = Math.min(1, base[2] * 0.4 + 0.6);
  // Always show wireframe; slightly thicker on unique low-poly shapes.
  const isSphere = powerupName === 'turret' || !powerupName;
  const ew = (isSphere
    ? (lod === 0 ? 0.75 : 0.5)
    : 1.05) * RES_SCALE * POWERUP_VIS_SCALE * 2 * _shopVisScale;

  // Far → near faces.
  for (let o = 0; o < used.length; o++) {
    const f = faces[used[o].i];
    const ax = xy[f[1] * 2] - xy[f[0] * 2];
    const ay = xy[f[1] * 2 + 1] - xy[f[0] * 2 + 1];
    const bx = xy[f[2] * 2] - xy[f[0] * 2];
    const by = xy[f[2] * 2 + 1] - xy[f[0] * 2 + 1];
    // Screen Y-down: front faces wind clockwise.
    if (ax * by - ay * bx >= 0) continue;
    const shade = 0.28 + 0.72 * ((used[o].z - zMin) / zSpan);
    const shine = Math.max(0, shade - 0.68) * 2.4 * pulse;
    _pwrCol[0] = dark[0] + (base[0] - dark[0]) * shade;
    _pwrCol[1] = dark[1] + (base[1] - dark[1]) * shade;
    _pwrCol[2] = dark[2] + (base[2] - dark[2]) * shade;
    _pwrCol[0] = Math.min(1, _pwrCol[0] + shine * 0.75 + shade * 0.08);
    _pwrCol[1] = Math.min(1, _pwrCol[1] + shine * 0.7 + shade * 0.08);
    _pwrCol[2] = Math.min(1, _pwrCol[2] + shine * 0.65 + shade * 0.08);
    const tri = _pwrTriScratch;
    tri[0] = xy[f[0] * 2]; tri[1] = xy[f[0] * 2 + 1];
    tri[2] = xy[f[1] * 2]; tri[3] = xy[f[1] * 2 + 1];
    tri[4] = xy[f[2] * 2]; tri[5] = xy[f[2] * 2 + 1];
    drawFilledPoly(tri, _pwrCol, aMul);
  }
  // Full wireframe overlay (visible on every powerup shape / LOD).
  const edges = mesh.edges;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    drawThickSegment(
      xy[e[0] * 2], xy[e[0] * 2 + 1],
      xy[e[1] * 2], xy[e[1] * 2 + 1],
      ew, _pwrEdgeCol, aMul
    );
  }
}

function collectPowerupSideLetters(cx, cy, baked, yaw, pitch, roll, powerupName) {
  if (!baked) return [];
  const style = powerupOrbitStyle(powerupName);
  const dirs = powerupOrbitDirs(style.pattern);
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const textScale = (style.textScale != null ? style.textScale : 1) * POWERUP_LETTER_SCALE * _shopVisScale;
  const worldH = 14 * RES_SCALE * textScale;
  const worldW = worldH * (baked.tw / Math.max(1, baked.th));
  const hw = worldW * 0.5;
  const hh = worldH * 0.5;
  const R = POWERUP_LETTER_R * (style.orbitR != null ? style.orbitR : 1) * _shopVisScale;

  const batch = [];
  for (let d = 0; d < dirs.length; d++) {
    const dir = dirs[d];
    let ux = 0, uy = 0, uz = 1;
    let rx = dir[1] * uz - dir[2] * uy;
    let ry = dir[2] * ux - dir[0] * uz;
    let rz = dir[0] * uy - dir[1] * ux;
    let rlen = Math.hypot(rx, ry, rz);
    if (rlen < 1e-4) {
      ux = 1; uy = 0; uz = 0;
      rx = dir[1] * uz - dir[2] * uy;
      ry = dir[2] * ux - dir[0] * uz;
      rz = dir[0] * uy - dir[1] * ux;
      rlen = Math.hypot(rx, ry, rz) || 1;
    }
    rx /= rlen; ry /= rlen; rz /= rlen;
    const upx = dir[1] * rz - dir[2] * ry;
    const upy = dir[2] * rx - dir[0] * rz;
    const upz = dir[0] * ry - dir[1] * rx;

    const corners = [
      [dir[0] * R - rx * hw + upx * hh, dir[1] * R - ry * hw + upy * hh, dir[2] * R - rz * hw + upz * hh],
      [dir[0] * R + rx * hw + upx * hh, dir[1] * R + ry * hw + upy * hh, dir[2] * R + rz * hw + upz * hh],
      [dir[0] * R + rx * hw - upx * hh, dir[1] * R + ry * hw - upy * hh, dir[2] * R + rz * hw - upz * hh],
      [dir[0] * R - rx * hw - upx * hh, dir[1] * R - ry * hw - upy * hh, dir[2] * R - rz * hw - upz * hh]
    ];
    const sx = new Float64Array(4);
    const sy = new Float64Array(4);
    let zSum = 0;
    for (let i = 0; i < 4; i++) {
      const r = tumbleRotateLocal(corners[i][0], corners[i][1], corners[i][2], cyaw, syaw, cp, sp, cr, sr);
      sx[i] = cx + r.wx;
      sy[i] = cy + r.wy - r.wz * POWERUP_SPHERE_LIFT;
      zSum += r.wz;
    }
    const ax = sx[1] - sx[0], ay = sy[1] - sy[0];
    const bx = sx[2] - sx[0], by = sy[2] - sy[0];
    const cross = ax * by - ay * bx;
    // Opaque letters; flip winding when seen from behind so the glyph isn't mirrored.
    if (cross < 0) {
      batch.push({ sx: [sx[0], sx[1], sx[2], sx[3]], sy: [sy[0], sy[1], sy[2], sy[3]], z: zSum * 0.25 });
    } else {
      batch.push({ sx: [sx[1], sx[0], sx[3], sx[2]], sy: [sy[1], sy[0], sy[3], sy[2]], z: zSum * 0.25 });
    }
  }
  batch.sort((a, b) => a.z - b.z);
  return batch;
}

/** Faint wire cage showing this powerup's letter-orbit shape. */
function drawPowerupOrbitCage(cx, cy, color, yaw, pitch, roll, powerupName, alpha) {
  const style = powerupOrbitStyle(powerupName);
  const mesh = powerupOrbitShellMesh(style.orbit);
  if (!mesh || !mesh.edges) return;
  const xy = _pwrSphXY;
  const depth = _pwrSphDepth;
  const R = POWERUP_LETTER_R * (style.orbitR != null ? style.orbitR : 1) * _shopVisScale;
  const aMul = (alpha == null ? 1 : alpha) * 0.35;
  projectPowerupMesh(mesh.verts, cx, cy, R, yaw, pitch, roll, xy, depth);
  const edgeCol = [
    Math.min(1, (color[0] || 1) * 0.5 + 0.45),
    Math.min(1, (color[1] || 1) * 0.5 + 0.45),
    Math.min(1, (color[2] || 1) * 0.5 + 0.45)
  ];
  const ew = 0.7 * RES_SCALE * POWERUP_VIS_SCALE * _shopVisScale;
  for (let i = 0; i < mesh.edges.length; i++) {
    const e = mesh.edges[i];
    drawThickSegment(
      xy[e[0] * 2], xy[e[0] * 2 + 1],
      xy[e[1] * 2], xy[e[1] * 2 + 1],
      ew, edgeCol, aMul
    );
  }
}

function drawPowerupLetterBatch(batch, baked, from, to, alpha) {
  if (!baked || !batch) return;
  const a = alpha == null ? 1 : alpha;
  const end = to == null ? batch.length : to;
  for (let i = from | 0; i < end; i++) {
    const L = batch[i];
    drawShinyWorldQuad(
      L.sx[0], L.sy[0], L.sx[1], L.sy[1], L.sx[2], L.sy[2], L.sx[3], L.sy[3],
      baked, a
    );
  }
}

function drawPowerupPickup(u, x, y, angle, forceLod, alpha) {
  const name = u.powerup;
  const baked = getPowerupLabelBake(name);
  const col = powerupColor(name);
  const tumble = powerupTumbleAngles(angle, u.id);
  const lod = forceLod != null ? forceLod : powerupSphereLod(x, y);
  const a = alpha == null ? 1 : alpha;
  const letters = collectPowerupSideLetters(x, y, baked, tumble.yaw, tumble.pitch, tumble.roll, name);
  // Letters behind the core first, then cage + mesh, then front letters.
  let split = 0;
  while (split < letters.length && letters[split].z < 0) split++;
  drawPowerupLetterBatch(letters, baked, 0, split, a);
  drawPowerupOrbitCage(x, y, col, tumble.yaw, tumble.pitch, tumble.roll, name, a);
  drawPowerupSphereMesh(x, y, col, tumble.yaw, tumble.pitch, tumble.roll, lod, a, name);
  drawPowerupLetterBatch(letters, baked, split, letters.length, a);
}

let particleTime = 0;
let lastParticleMs = 0;

function clearParticles() {
  pAlive.fill(0);
  pCollide.fill(0);
  pEdgeBounce.fill(0);
  pSkipShip.fill(0);
  pFadeLife.fill(0);
  pFreeTop = 0;
  for (let i = PARTICLE_MAX - 1; i >= 0; i--) pFree[pFreeTop++] = i;
}

function allocParticle() {
  if (pFreeTop <= 0) return -1;
  return pFree[--pFreeTop];
}

function freeParticle(i) {
  pAlive[i] = 0;
  pCollide[i] = 0;
  pEdgeBounce[i] = 0;
  pSkipShip[i] = 0;
  pFadeLife[i] = 0;
  pFree[pFreeTop++] = i;
}

/**
 * Burst emit. Opts: x,y, count, speed, speedSpread, direction, spread,
 * size, sizeSpread, scaleY, sizeWiggle, sizeWiggleSpeed, lifetime, lifetimeSpread,
 * color [r,g,b], drag, inheritVx, inheritVy, collide (one-shot vs asteroids/ships),
 * edgeBounce (reflect off world bounds), skipShip (ship id to ignore — thrust/smoke vs own hull),
 * fadeLife (alpha tracks remaining life fraction)
 */
function emitParticles(o) {
  const count = o.count | 0;
  if (count <= 0) return;
  const dir = o.direction || 0;
  const spread = o.spread == null ? 0.6 : o.spread;
  const spd0 = o.speed == null ? 40 : o.speed;
  const spdSpread = o.speedSpread == null ? spd0 * 0.35 : o.speedSpread;
  const size0 = o.size == null ? 3 * RES_SCALE : o.size;
  const sizeSpread = o.sizeSpread == null ? size0 * 0.4 : o.sizeSpread;
  const scaleY = o.scaleY == null ? 1 : o.scaleY;
  const wiggle = o.sizeWiggle == null ? 0 : o.sizeWiggle;
  const wiggleSpd = o.sizeWiggleSpeed == null ? 8 : o.sizeWiggleSpeed;
  const life0 = o.lifetime == null ? 0.35 : o.lifetime;
  const lifeSpread = o.lifetimeSpread == null ? life0 * 0.4 : o.lifetimeSpread;
  const col = o.color || COL_WHITE;
  const drag = o.drag == null ? 1.8 : o.drag;
  const ivx = o.inheritVx || 0;
  const ivy = o.inheritVy || 0;
  const canCollide = o.collide ? 1 : 0;
  const edgeBounce = o.edgeBounce ? 1 : 0;
  const skipShip = (o.skipShip | 0) || 0;
  const fadeLife = o.fadeLife ? 1 : 0;

  for (let n = 0; n < count; n++) {
    const i = allocParticle();
    if (i < 0) break;
    const ang = dir + (Math.random() - 0.5) * spread;
    const spd = spd0 + (Math.random() - 0.5) * spdSpread;
    const life = Math.max(0.05, life0 + (Math.random() - 0.5) * lifeSpread);
    pX[i] = o.x;
    pY[i] = o.y;
    pVx[i] = Math.cos(ang) * spd + ivx;
    pVy[i] = Math.sin(ang) * spd + ivy;
    pLife[i] = life;
    pMaxLife[i] = life;
    pSize[i] = Math.max(0.5, size0 + (Math.random() - 0.5) * sizeSpread);
    pScaleY[i] = scaleY;
    pWiggle[i] = wiggle;
    pWiggleSpd[i] = wiggleSpd;
    pPhase[i] = Math.random() * Math.PI * 2;
    pDrag[i] = drag;
    pR[i] = col[0];
    pG[i] = col[1];
    pB[i] = col[2];
    pCollide[i] = canCollide;
    pEdgeBounce[i] = edgeBounce;
    pSkipShip[i] = skipShip;
    pFadeLife[i] = fadeLife;
    pAlive[i] = 1;
  }
}

/** Collect asteroid + ship colliders once; particles never collide with each other.
 * Asteroids: circle broadphase + polygon refine. Ships: circle only. */
function rebuildParticleColliders() {
  let n = 0;
  for (const a of asteroids.values()) {
    if (n >= PCOL_MAX) break;
    const pos = asteroidAt(a);
    if (asteroidOffScreenAt(a, pos.x, pos.y)) continue;
    pColX[n] = pos.x;
    pColY[n] = pos.y;
    pColR[n] = (a.r || 10 * RES_SCALE) * ASTEROID_HIT_SCALE;
    pColVx[n] = a.vx || 0;
    pColVy[n] = a.vy || 0;
    pColAng[n] = pos.angle || 0;
    pColId[n] = 0;
    pColAst[n] = a;
    n++;
  }
  if (n < PCOL_MAX && player.hp > 0 && !deathSpectating && myId != null) {
    const me = localView();
    pColX[n] = me.x;
    pColY[n] = me.y;
    pColR[n] = PLAYER_R;
    pColVx[n] = me.vx || 0;
    pColVy[n] = me.vy || 0;
    pColAng[n] = me.angle || 0;
    pColId[n] = myId | 0;
    pColAst[n] = null;
    n++;
  }
  for (const r of remotes.values()) {
    if (n >= PCOL_MAX) break;
    if (r.hp <= 0) continue;
    const v = remoteView(r);
    pColX[n] = v.x;
    pColY[n] = v.y;
    pColR[n] = PLAYER_R;
    pColVx[n] = v.vx || 0;
    pColVy[n] = v.vy || 0;
    pColAng[n] = v.angle || 0;
    pColId[n] = r.id | 0;
    pColAst[n] = null;
    n++;
  }
  pColCount = n;
}

/**
 * One-shot bounce vs prebuilt colliders. Only approaching contacts count, so
 * debris spawned on a surface flying outward isn't consumed immediately.
 * skipShip ignores that ship's hull (thrust/smoke vs own ship).
 * Asteroids: circle reject → polygon contact (same silhouette as gameplay).
 */
function collideParticleOnce(i) {
  const px = pX[i];
  const py = pY[i];
  const pr = pSize[i] * 0.35;
  const skip = pSkipShip[i];
  const nCol = pColCount;
  for (let c = 0; c < nCol; c++) {
    if (skip && pColId[c] === skip) continue;

    const dx = shortestWrapDelta(pColX[c], px, W);
    const dy = shortestWrapDelta(pColY[c], py, H);
    const rr = pColR[c] + pr;
    const d2 = dx * dx + dy * dy;
    // Circle broadphase (wrap-aware) — skip poly work when far.
    if (d2 >= rr * rr) continue;

    let nx, ny, overlap;
    const ast = pColAst[c];
    if (ast) {
      // Refine to jagged silhouette (same contact as ship–asteroid).
      const hit = circleVsAsteroidPoly(
        { x: pColX[c] + dx, y: pColY[c] + dy, r: pr },
        {
          x: pColX[c],
          y: pColY[c],
          angle: pColAng[c],
          r: ast.r,
          id: ast.id,
          shapeId: ast.shapeId,
          size: ast.size || (ast.big ? 'big' : 'medium'),
          pts: ast.pts
        }
      );
      if (!hit) continue;
      nx = hit.nx;
      ny = hit.ny;
      overlap = hit.overlap;
    } else {
      let dist = Math.sqrt(d2);
      if (dist < 1e-6) {
        dist = 1e-6;
        nx = 1;
        ny = 0;
      } else {
        nx = dx / dist;
        ny = dy / dist;
      }
      overlap = rr - dist;
    }

    const rvx = pVx[i] - pColVx[c];
    const rvy = pVy[i] - pColVy[c];
    const vn = rvx * nx + rvy * ny;
    // Separating or resting — leave one-shot armed for a later approach.
    if (vn >= 0) continue;
    const bounce = -(1 + PARTICLE_BOUNCE) * vn;
    pVx[i] += bounce * nx;
    pVy[i] += bounce * ny;
    // Carry a bit of the collider's motion so debris rides rocks/ships.
    pVx[i] += pColVx[c] * 0.35;
    pVy[i] += pColVy[c] * 0.35;
    pX[i] = wrapCoord(px + nx * (overlap + 0.5), W);
    pY[i] = wrapCoord(py + ny * (overlap + 0.5), H);
    pDrag[i] = Math.min(6, pDrag[i] + 0.8);
    pCollide[i] = 2;
    return;
  }
}

function bounceParticleWorldEdge(i) {
  const e = PARTICLE_EDGE_BOUNCE;
  if (pX[i] < 0) {
    pX[i] = 0;
    if (pVx[i] < 0) pVx[i] = -pVx[i] * e;
  } else if (pX[i] > W) {
    pX[i] = W;
    if (pVx[i] > 0) pVx[i] = -pVx[i] * e;
  }
  if (pY[i] < 0) {
    pY[i] = 0;
    if (pVy[i] < 0) pVy[i] = -pVy[i] * e;
  } else if (pY[i] > H) {
    pY[i] = H;
    if (pVy[i] > 0) pVy[i] = -pVy[i] * e;
  }
}

function updateParticles(dt) {
  if (dt <= 0) return;
  particleTime += dt;
  let needCollide = false;
  for (let i = 0; i < PARTICLE_MAX; i++) {
    if (pAlive[i] && pCollide[i] === 1) {
      needCollide = true;
      break;
    }
  }
  if (needCollide) rebuildParticleColliders();
  for (let i = 0; i < PARTICLE_MAX; i++) {
    if (!pAlive[i]) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) {
      freeParticle(i);
      continue;
    }
    const damp = Math.exp(-pDrag[i] * dt);
    pVx[i] *= damp;
    pVy[i] *= damp;
    pX[i] += pVx[i] * dt;
    pY[i] += pVy[i] * dt;
    pPhase[i] += pWiggleSpd[i] * dt;
    if (pEdgeBounce[i]) bounceParticleWorldEdge(i);
    if (pCollide[i] === 1 && pColCount > 0) collideParticleOnce(i);
  }
}

function drawParticles() {
  let w = 0;
  const mesh = particleMesh;
  const t = particleTime;
  for (let i = 0; i < PARTICLE_MAX; i++) {
    if (!pAlive[i]) continue;
    const lifeT = pLife[i] / pMaxLife[i];
    // fadeLife: linear alpha from life. Else full opacity until last 10%.
    const fade = pFadeLife[i] ? lifeT : (lifeT >= 0.1 ? 1 : lifeT / 0.1);
    const wig = 1 + Math.sin(pPhase[i] + t * 0.5) * pWiggle[i];
    let hx = pSize[i] * wig * 0.5;
    let hy = hx * pScaleY[i];
    // Orient along velocity for streaky scaleY ≠ 1
    const ang = Math.atan2(pVy[i], pVx[i]);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const cx = pX[i];
    const cy = pY[i];
    const r = pR[i];
    const g = pG[i];
    const b = pB[i];
    const a = fade;

    // Quad corners in local (±1,±1), two tris
    // 0:(-1,-1) 1:(1,-1) 2:(1,1) 3:(-1,1)
    const lx0 = -hx, ly0 = -hy;
    const lx1 = hx, ly1 = -hy;
    const lx2 = hx, ly2 = hy;
    const lx3 = -hx, ly3 = hy;
    const x0 = cx + lx0 * c - ly0 * s;
    const y0 = cy + lx0 * s + ly0 * c;
    const x1 = cx + lx1 * c - ly1 * s;
    const y1 = cy + lx1 * s + ly1 * c;
    const x2 = cx + lx2 * c - ly2 * s;
    const y2 = cy + lx2 * s + ly2 * c;
    const x3 = cx + lx3 * c - ly3 * s;
    const y3 = cy + lx3 * s + ly3 * c;

    // tri 0-1-2
    mesh[w++] = x0; mesh[w++] = y0; mesh[w++] = -1; mesh[w++] = -1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
    mesh[w++] = x1; mesh[w++] = y1; mesh[w++] = 1; mesh[w++] = -1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
    mesh[w++] = x2; mesh[w++] = y2; mesh[w++] = 1; mesh[w++] = 1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
    // tri 0-2-3
    mesh[w++] = x0; mesh[w++] = y0; mesh[w++] = -1; mesh[w++] = -1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
    mesh[w++] = x2; mesh[w++] = y2; mesh[w++] = 1; mesh[w++] = 1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
    mesh[w++] = x3; mesh[w++] = y3; mesh[w++] = -1; mesh[w++] = 1; mesh[w++] = r; mesh[w++] = g; mesh[w++] = b; mesh[w++] = a;
  }
  if (w < PARTICLE_STRIDE * 3) return;
  const vertCount = w / PARTICLE_STRIDE;
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.subarray(0, w), gl.DYNAMIC_DRAW);
  gl.useProgram(particleProg);
  gl.enableVertexAttribArray(pAPos);
  gl.enableVertexAttribArray(pAUV);
  gl.enableVertexAttribArray(pACol);
  const stride = PARTICLE_STRIDE * 4;
  gl.vertexAttribPointer(pAPos, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(pAUV, 2, gl.FLOAT, false, stride, 8);
  gl.vertexAttribPointer(pACol, 4, gl.FLOAT, false, stride, 16);
  gl.uniform2f(pURes, W, H);
  bindSceneLightUniforms(particleLightU);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.drawArrays(gl.TRIANGLES, 0, vertCount);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(pAUV);
  gl.disableVertexAttribArray(pACol);
}

const COL_SMOKE = [0.55, 0.52, 0.48];
/** Hull fire when HP < 35% — orange / yellow flicker under smoke leaks. */
const COL_FIRE = [1.0, 0.42, 0.08];
const COL_FIRE_HOT = [1.0, 0.78, 0.22];

/** Stable hull-leak offsets for damage smoke (reseeds occasionally). */
const shipSmokeLeaks = new Map();

function smokeLeaksFor(id, damageT) {
  const want = Math.min(5, Math.max(0, Math.floor(damageT * 5)));
  let s = shipSmokeLeaks.get(id);
  if (!s || s.leaks.length !== want || performance.now() > s.until) {
    const leaks = [];
    for (let i = 0; i < want; i++) {
      leaks.push({
        ox: (Math.random() - 0.5) * 10 * RES_SCALE,
        oy: (Math.random() - 0.5) * 8 * RES_SCALE
      });
    }
    s = { leaks, until: performance.now() + 700 + Math.random() * 900 };
    shipSmokeLeaks.set(id, s);
  }
  return s.leaks;
}

/**
 * Damage smoke: one main aft stream (bigger with damage) + more hull leaks.
 * Below 35% HP, small fire particles burn under every smoke leak.
 * damageT 0 = full HP, 1 = 0 HP.
 * maxHpOpt: ships use MAX_HP; enemies pass their kind max.
 */
function emitShipDamageSmoke(id, x, y, angle, vx, vy, hp, maxHpOpt) {
  const maxHp = maxHpOpt != null && maxHpOpt > 0 ? maxHpOpt : MAX_HP;
  if (hp >= maxHp) {
    shipSmokeLeaks.delete(id);
    return;
  }
  const t = Math.max(0, Math.min(1, 1 - hp / maxHp));
  if (t < 0.05) return;
  // Rate scales with damage so light chips don't spam.
  if (Math.random() > 0.25 + t * 0.75) return;

  const back = angle + Math.PI;
  const size = 1.2 + t * 1.4; // 1.2 … 2.6
  const skip = id | 0;
  const burning = hp / maxHp < 0.35;
  const smoke = (px, py) => {
    emitParticles({
      x: px,
      y: py,
      count: t > 0.65 ? 2 : 1,
      speed: (10 + t * 28) * RES_SCALE,
      speedSpread: (8 + t * 18) * RES_SCALE,
      direction: back + (Math.random() - 0.5) * (0.25 + t * 0.35),
      spread: 0.3 + t * 0.45,
      size,
      sizeSpread: 0.6,
      scaleY: 1,
      sizeWiggle: 0.2,
      sizeWiggleSpeed: 6,
      lifetime: 0.35 + t * 0.55,
      lifetimeSpread: 0.2,
      color: COL_SMOKE,
      drag: 1.1,
      inheritVx: vx * 0.55,
      inheritVy: vy * 0.55,
      skipShip: skip
    });
  };
  const fire = (px, py) => {
    const hot = Math.random() > 0.45;
    emitParticles({
      x: px,
      y: py,
      count: 1 + (Math.random() > 0.55 ? 1 : 0),
      speed: (18 + Math.random() * 28) * RES_SCALE,
      speedSpread: 14 * RES_SCALE,
      direction: back + (Math.random() - 0.5) * 0.55,
      spread: 0.55,
      size: (0.85 + Math.random() * 0.7) * 2,
      sizeSpread: 0.45 * 2,
      scaleY: 1.35,
      sizeWiggle: 0.4,
      sizeWiggleSpeed: 16,
      lifetime: 0.14 + Math.random() * 0.16,
      lifetimeSpread: 0.06,
      color: hot ? COL_FIRE_HOT : COL_FIRE,
      drag: 2.4,
      inheritVx: vx * 0.35,
      inheritVy: vy * 0.35,
      skipShip: skip
    });
  };

  // Main stream from ship center.
  smoke(x, y);
  if (burning) fire(x, y);

  // Extra hull leaks — same smoke; fire under each when critically damaged.
  const leaks = smokeLeaksFor(id, t);
  for (let i = 0; i < leaks.length; i++) {
    if (Math.random() > 0.45 + t * 0.4) continue;
    const L = leaks[i];
    const lx = x + L.ox;
    const ly = y + L.oy;
    smoke(lx, ly);
    if (burning) fire(lx, ly);
  }
}

/** Match server ENEMY_HP for damage-smoke fraction. */
function enemyMaxHp(kind) {
  if (kind === 'ufo') return 300;
  if (kind === 'carrier') return 90;
  return 95;
}

function enemySmokeLeakId(id) {
  return -(200000 + (id | 0));
}

/** HP-based hull smoke for living enemies (same recipe as players). */
function emitEnemyDamageSmoke() {
  if (deathSpectating || matchPaused || soloShopOpen) return;
  for (const e of enemies.values()) {
    if ((e.hp | 0) <= 0) continue;
    const p = enemyAt(e);
    const kind = p.kind || e.kind;
    emitShipDamageSmoke(
      enemySmokeLeakId(e.id),
      p.x, p.y, p.angle,
      p.vx || 0, p.vy || 0,
      e.hp | 0,
      enemyMaxHp(kind)
    );
  }
}

/** Match server thruster-ray align gates. */
const THRUST_RAY_ALIGN_RAD = 30 * Math.PI / 180;
const THRUST_RAY_MIN_MOVE = 0.2 * RES_SCALE;
/** Linger so net `lf` thrust packets keep exhaust red between ticks. */
const THRUST_MELEE_FX_MS = 90;
const thrustMeleeFxUntil = new Map();
/** Local prev pose for server-matching align (prev→now, not raw vx). */
let thrustAlignPrevX = null;
let thrustAlignPrevY = null;

/** Same gate as server playerThrustRayAligned — nose ≈ travel+180° (brake-thrust). */
function thrustMeleeAligned(angle, mdx, mdy) {
  if (Math.hypot(mdx, mdy) < THRUST_RAY_MIN_MOVE) return false;
  const travelBack = Math.atan2(mdy, mdx) + Math.PI;
  let diff = angle - travelBack;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= THRUST_RAY_ALIGN_RAD;
}

/**
 * Thruster melee FX gate: recent server thrust hit, or local prev→now align
 * (same as server), else vx/vy fallback for remotes.
 */
function thrustMeleeActive(angle, vx, vy, opts) {
  opts = opts || {};
  const id = opts.id;
  const now = performance.now();
  if (id != null && (thrustMeleeFxUntil.get(id) || 0) > now) return true;
  if (opts.x != null && opts.y != null && thrustAlignPrevX != null && id === myId) {
    const mdx = shortestWrapDelta(thrustAlignPrevX, opts.x, W);
    const mdy = shortestWrapDelta(thrustAlignPrevY, opts.y, H);
    return thrustMeleeAligned(angle, mdx, mdy);
  }
  return thrustMeleeAligned(angle, vx || 0, vy || 0);
}

function noteThrustMeleeFx(ownerId) {
  if (ownerId == null) return;
  thrustMeleeFxUntil.set(ownerId | 0, performance.now() + THRUST_MELEE_FX_MS);
}

function emitThrustFx(x, y, angle, vx, vy, skipShip, color, meleeActive) {
  const ox = x - Math.cos(angle) * 6 * RES_SCALE;
  const oy = y - Math.sin(angle) * 6 * RES_SCALE;
  const melee = !!meleeActive;
  const col = color || COL.self;
  // Brake-thrust melee: same color, 2× particle size range (speed stays normal).
  const sizeMul = melee ? 2 : 1;
  for (let n = 0; n < 4; n++) {
    emitParticles({
      x: ox, y: oy,
      count: 1,
      speed: 140 * RES_SCALE,
      speedSpread: 120 * RES_SCALE,
      direction: angle + Math.PI,
      spread: 0.55,
      size: 2 * sizeMul,
      sizeSpread: 2 * sizeMul,
      scaleY: 1,
      lifetime: 0.8,
      lifetimeSpread: 0,
      color: col,
      drag: Math.random() * 2,
      inheritVx: vx * 0.3,
      inheritVy: vy * 0.3,
      collide: true,
      skipShip: skipShip | 0
    });
  }
}

/** Idle engine glow — same recipe as thrust, 30% speed & count; only while not thrusting. */
function emitThrustIdleFx(x, y, angle, vx, vy, skipShip, color) {
  const ox = x - Math.cos(angle) * 6 * RES_SCALE;
  const oy = y - Math.sin(angle) * 6 * RES_SCALE;
  const col = color || COL.self;
  const nEmit = Math.max(1, Math.round(4 * 0.3));
  // Ship vel is px/tick; particle vel is px/s → convert so start = ship + spray.
  const shipVx = (vx || 0) * TPS;
  const shipVy = (vy || 0) * TPS;
  for (let n = 0; n < nEmit; n++) {
    emitParticles({
      x: ox, y: oy,
      count: 1,
      speed: 140 * RES_SCALE * 0.3,
      speedSpread: 120 * RES_SCALE * 0.3,
      direction: angle + Math.PI,
      spread: 0.55,
      size: 2,
      sizeSpread: 2,
      scaleY: 1,
      lifetime: 0.8,
      lifetimeSpread: 0,
      color: col,
      drag: Math.random() * 2,
      inheritVx: shipVx,
      inheritVy: shipVy,
      collide: true,
      skipShip: skipShip | 0
    });
  }
}

function enemyThrustColor(kind) {
  if (kind === 'ufo') return COL.enemyUfo;
  if (kind === 'carrier') return COL.enemyCarrier;
  return COL.enemy;
}

/** Always-on idle-style thruster trail for every living enemy. */
function emitEnemyThrustFx() {
  if (deathSpectating || matchPaused || soloShopOpen) return;
  for (const e of enemies.values()) {
    if ((e.hp | 0) <= 0) continue;
    const p = enemyAt(e);
    emitThrustIdleFx(p.x, p.y, p.angle, p.vx, p.vy, 0, enemyThrustColor(p.kind));
  }
}

/** Resolve ship/enemy px/tick velocity for muzzle particle inherit. */
function resolveMuzzleShipVel(owner) {
  if (owner === myId) return { vx: player.vx || 0, vy: player.vy || 0 };
  const r = remotes.get(owner);
  if (r) return { vx: r.vx || 0, vy: r.vy || 0 };
  if (owner < 0) {
    const e = enemies.get(-owner);
    if (e) return { vx: e.vx || 0, vy: e.vy || 0 };
  }
  return { vx: 0, vy: 0 };
}

/** Blend two RGB triples (t in 0..1). */
function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/**
 * Muzzle flash: circles (scale 1×1), sized like the default gun bullet
 * (random 0%…230%), speed = default bullet speed ±50%.
 * Emits two layers: one inheriting ship/rocket vel, one with base 0 + particle speeds only.
 * `count` scales intensity; optional opts.cone widens the spray (shotgun).
 */
function emitMuzzleFx(x, y, angle, color, count, vx, vy, opts) {
  // Ship vel is px/tick; particle vel is px/s — same base as idle thrust.
  const shipVx = (vx || 0) * TPS;
  const shipVy = (vy || 0) * TPS;
  const n = Math.max(1, count == null ? 8 : count | 0);
  const tint = color || COL.bullet;
  const cone = (opts && opts.cone > 0) ? opts.cone : 1;
  // Default bullet GL points: diameter 2×RES_SCALE in world space.
  const bulletSize = 2 * RES_SCALE;
  // Weapon speed is px/tick → particles use px/s.
  const bulletSpd = (WEAPONS.default.speed || (8 * RES_SCALE)) * TPS;
  const base = {
    x, y,
    count: Math.max(4, n),
    speed: bulletSpd,
    speedSpread: bulletSpd, // ±50%
    direction: angle,
    spread: 0.35 * cone,
    // size0±half spread → uniform 0%…230% of bullet diameter
    size: bulletSize * 1.15,
    sizeSpread: bulletSize * 2.3,
    scaleY: 1,
    lifetime: 0.42,
    lifetimeSpread: 0.24,
    color: tint,
    drag: 2.2,
    fadeLife: true
  };

  emitParticles(Object.assign({}, base, { inheritVx: shipVx, inheritVy: shipVy }));
  // Second layer: no ship vel — only particle random speed range from 0 base.
  emitParticles(Object.assign({}, base, { inheritVx: 0, inheritVy: 0 }));
}

/** Instant local muzzle flash (bullets still come from the server). */
function emitLocalShootFx() {
  const me = localView();
  const m = shipMuzzle(me.x, me.y, me.angle);
  const ang = me.angle;
  const wpn = selectedWeapon;

  if (wpn === 3) {
    // Laser: nose spark; beam is handled separately.
    const ivx = (me.vx || 0) * TPS;
    const ivy = (me.vy || 0) * TPS;
    emitParticles({
      x: m.x, y: m.y,
      count: 5,
      speed: 70 * RES_SCALE,
      speedSpread: 40 * RES_SCALE,
      direction: ang,
      spread: 0.45,
      size: 2.4 * RES_SCALE,
      scaleY: 2.2,
      sizeWiggle: 0.3,
      sizeWiggleSpeed: 16,
      lifetime: 0.1,
      color: ownerShootColor(myId),
      drag: 5,
      inheritVx: ivx,
      inheritVy: ivy
    });
    return;
  }

  if (wpn === 2) {
    playSfx(SFX.rocketFire, { vol: 0.9, pool: 6 });
    emitMuzzleFx(m.x, m.y, ang, COL.rocket, 12, me.vx, me.vy);
    return;
  }

  if (wpn === 4) {
    // Shotgun: SFX is one blast on Space press only (not here / not per pellet).
    emitMuzzleFx(m.x, m.y, ang, COL.bullet, 14, me.vx, me.vy, { cone: 1.45 });
    return;
  }

  if (wpn === 7) {
    if (localShoot.sfxSkipNext) {
      localShoot.sfxSkipNext = false;
    } else {
      playSfx(SFX.shoot, { vol: 0.75, pool: 8 });
    }
    emitMuzzleFx(m.x, m.y, ang, COL.plasma, 9, me.vx, me.vy, { cone: 0.85 });
    return;
  }

  if (wpn === 8) {
    if (localShoot.sfxSkipNext) {
      localShoot.sfxSkipNext = false;
    } else {
      playSfx(SFX.shoot, { vol: 0.85, pool: 8 });
    }
    emitMuzzleFx(m.x, m.y, ang, COL.voidcannon, 11, me.vx, me.vy, { cone: 1.2 });
    return;
  }

  // Default blaster: first shot SFX is on Space press; later burst shots here.
  if (localShoot.sfxSkipNext) {
    localShoot.sfxSkipNext = false;
  } else {
    playSfx(SFX.shoot, { vol: 0.9, pool: 8 });
  }
  emitMuzzleFx(m.x, m.y, ang, ownerShootColor(myId) || COL.bullet, 10, me.vx, me.vy);
}

function emitHitFx(x, y, color) {
  emitParticles({
    x, y,
    count: 10,
    speed: 70 * RES_SCALE,
    speedSpread: 60 * RES_SCALE,
    direction: Math.random() * Math.PI * 2,
    spread: Math.PI * 2,
    size: 3 * RES_SCALE,
    scaleY: 1.2,
    sizeWiggle: 0.4,
    sizeWiggleSpeed: 10,
    lifetime: 0.28,
    color: color || COL_WHITE,
    drag: 2.2,
  });
}

/** Expanding shock / feedback rings (death + pickup + impacts). */
const deathRings = [];

/** Expanding feedback ring (pickup, reload, godmode, impacts). */
function pushFxRing(x, y, color, opts) {
  const o = opts || {};
  const now = performance.now();
  deathRings.push({
    x, y,
    born: now + (o.delay || 0),
    life: o.life != null ? o.life : 420,
    color: color || COL_WHITE,
    r0: o.r0 != null ? o.r0 : 3,
    r1: o.r1 != null ? o.r1 : 28
  });
}

function weaponColor(name) {
  if (name === 'rocket') return COL.rocket;
  if (name === 'laser') return COL.laser;
  if (name === 'shotgun') return COL.bullet;
  if (name === 'railgun') return COL.railgun;
  if (name === 'plasma') return COL.plasma;
  if (name === 'voidcannon') return COL.voidcannon;
  if (name === 'asteroidgun') return COL.meteor;
  if (name === 'health') return COL.health;
  if (name === 'default') return COL.pickup;
  return COL.pickup;
}

/**
 * Shared weapon pickup / upgrade FX — same particle recipe for every weapon.
 * Color from weapon; epicness scales with level (1 little → 2 more → 3 biggest).
 */
function emitWeaponPickupFx(x, y, weaponName, level) {
  const col = weaponColor(weaponName || 'default');
  const lvl = Math.max(1, Math.min(3, (level | 0) || 1));
  const t = (lvl - 1) / 2; // 0, 0.5, 1

  const rings = 1 + lvl; // 2 / 3 / 4
  for (let i = 0; i < rings; i++) {
    const boost = i / Math.max(1, rings - 1);
    pushFxRing(x, y, i === rings - 1 ? COL_WHITE : col, {
      r0: 4 + i * 2,
      r1: (28 + lvl * 14) * (0.7 + boost * 0.55),
      life: 320 + lvl * 90 + i * 40,
      delay: i * (40 + lvl * 10)
    });
  }

  // Core burst — same shape, scales up with level
  emitParticles({
    x, y,
    count: 10 + lvl * 10,           // 20 / 30 / 40
    speed: (70 + lvl * 35) * RES_SCALE,
    speedSpread: (40 + lvl * 25) * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: (2.4 + lvl * 0.7) * RES_SCALE,
    sizeSpread: (1.5 + lvl * 0.5) * RES_SCALE,
    scaleY: 1.4 + t * 0.5,
    sizeWiggle: 0.25 + t * 0.25,
    sizeWiggleSpeed: 12 + lvl * 3,
    lifetime: 0.28 + lvl * 0.08,
    lifetimeSpread: 0.12 + t * 0.08,
    color: col,
    drag: 2.8 - t * 0.4
  });

  // Hot white core sparks
  emitParticles({
    x, y,
    count: 4 + lvl * 4,             // 8 / 12 / 16
    speed: (24 + lvl * 14) * RES_SCALE,
    speedSpread: (12 + lvl * 8) * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: (3.2 + lvl * 0.8) * RES_SCALE,
    lifetime: 0.12 + lvl * 0.05,
    color: COL_WHITE,
    drag: 4.5
  });

  // Level 2+: secondary rising streaks
  if (lvl >= 2) {
    emitParticles({
      x, y,
      count: 6 + (lvl - 1) * 8,      // 14 / 22
      speed: (110 + lvl * 40) * RES_SCALE,
      speedSpread: 50 * RES_SCALE,
      direction: -Math.PI / 2,
      spread: Math.PI * 0.85,
      size: (2 + lvl * 0.4) * RES_SCALE,
      sizeSpread: 1.5 * RES_SCALE,
      scaleY: 2.2,
      lifetime: 0.35 + lvl * 0.06,
      color: col,
      drag: 1.8
    });
  }

  // Level 3: extra outer nova
  if (lvl >= 3) {
    pushFxRing(x, y, col, { r0: 10, r1: 90, life: 700, delay: 60 });
    emitParticles({
      x, y,
      count: 18,
      speed: 160 * RES_SCALE,
      speedSpread: 80 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 2.2 * RES_SCALE,
      sizeSpread: 1.4 * RES_SCALE,
      scaleY: 2.4,
      lifetime: 0.45,
      lifetimeSpread: 0.15,
      color: col,
      drag: 1.5
    });
    emitHitFx(x, y, col);
  }

  // Shiny floating label: weapon name on first pick, LEVEL N + arrow on upgrades.
  if (lvl <= 1) {
    spawnFxLabel(x, y - 8 * RES_SCALE, String(weaponName || 'WEAPON').toUpperCase(), col, {
      life: 1.35,
      scale: 1,
      arrow: false,
      pop: 1.2
    });
  } else {
    spawnFxLabel(x, y - 6 * RES_SCALE, 'LEVEL ' + lvl, col, {
      life: 1.45 + (lvl - 2) * 0.2,
      scale: 1 + (lvl - 2) * 0.12,
      arrow: true,
      pop: 1.25
    });
  }
}

function pickupSfxForWeapon(weapon) {
  switch (weapon) {
    case 'default': return SFX.pickDefault;
    case 'laser': return SFX.pickLaser;
    case 'railgun': return SFX.pickRailgun;
    case 'shotgun': return SFX.pickShotgun;
    case 'plasma': return SFX.pickLaser;
    case 'voidcannon': return SFX.pickRailgun;
    default: return SFX.pickup; // rocket / unknown → generic
  }
}

function playPickupSfx(kind, weapon, level) {
  if (kind === 'health') {
    playSfx(SFX.pickup, { vol: 0.9, pool: 3 });
    return;
  }
  if (kind === 'powerup') {
    playSfx(SFX.pickup, { vol: 1, pool: 3 });
    return;
  }
  playSfx(pickupSfxForWeapon(weapon), { vol: 0.9, pool: 3 });
  // Same-weapon upgrade: weapon sting + generic pickup.
  if ((level | 0) > 1) playSfx(SFX.pickup, { vol: 0.8, pool: 3 });
}

/** Pickup vanishes — health uses heal FX; weapons use shared level-scaled pickup FX. */
function emitPickupCollectFx(x, y, kind, weapon, level, powerupName) {
  playPickupSfx(kind, weapon, level);
  if (kind === 'powerup') {
    const col = powerupColor(powerupName);
    pushFxRing(x, y, col, { r0: 6, r1: 42, life: 420 });
    emitParticles({
      x, y,
      count: 18,
      speed: 100 * RES_SCALE,
      speedSpread: 60 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 3 * RES_SCALE,
      sizeSpread: 1.5 * RES_SCALE,
      lifetime: 0.3,
      color: col,
      drag: 3
    });
    return;
  }
  if (kind === 'health') {
    pushFxRing(x, y, COL.health, { r0: 6, r1: 36, life: 380 });
    pushFxRing(x, y, COL_WHITE, { r0: 2, r1: 22, life: 260, delay: 30 });
    emitParticles({
      x, y,
      count: 22,
      speed: 110 * RES_SCALE,
      speedSpread: 70 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 3.2 * RES_SCALE,
      sizeSpread: 2 * RES_SCALE,
      scaleY: 1.6,
      sizeWiggle: 0.35,
      sizeWiggleSpeed: 14,
      lifetime: 0.32,
      lifetimeSpread: 0.15,
      color: COL.health,
      drag: 3.2
    });
    emitParticles({
      x, y,
      count: 8,
      speed: 40 * RES_SCALE,
      speedSpread: 25 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 4 * RES_SCALE,
      lifetime: 0.18,
      color: COL_WHITE,
      drag: 5
    });
    return;
  }
  emitWeaponPickupFx(x, y, weapon || 'default', level != null ? level : 1);
}

/** Local weapon equip flash when switching slots (not from a pickup). */
function emitWeaponEquipFx(x, y, weaponName, level) {
  emitWeaponPickupFx(x, y, weaponName, level != null ? level : 1);
}

function emitHealthPickupFx(x, y) {
  pushFxRing(x, y, COL.health, { r0: 4, r1: 42, life: 500 });
  emitParticles({
    x, y,
    count: 18,
    speed: 55 * RES_SCALE,
    speedSpread: 40 * RES_SCALE,
    direction: -Math.PI / 2,
    spread: Math.PI * 1.6,
    size: 3.5 * RES_SCALE,
    sizeSpread: 2 * RES_SCALE,
    scaleY: 1.8,
    lifetime: 0.45,
    lifetimeSpread: 0.2,
    color: COL.health,
    drag: 1.4
  });
  emitHitFx(x, y, COL.health);
}

/** Laser impact: asteroid chips vs player sparks vs soft miss tip.
 *  Laser weapon hits use spark-style debris (half count, laser color). */
function emitLaserImpactFx(x, y, hitKind, withSfx, beamDir) {
  // Laser can hit every server tick — overlap pool, never mid-clip restart.
  if (withSfx && (hitKind === 1 || hitKind === 2 || hitKind === 3)) {
    playSfxOverlap(SFX.laserImpact, {
      vol: hitKind === 1 ? 0.75 : 0.55,
      pool: 4
    });
    pushFxRing(x, y, COL.laser, { r0: 3, r1: 24, life: 260 });
    const c = findImpactCenter(x, y, hitKind);
    emitBulletImpactSparks(x, y, c.x, c.y, COL.laser, beamDir, 10);
    return;
  }
  if (hitKind === 1) {
    // Player (melee / non-laser hitscan)
    pushFxRing(x, y, COL.laserHit, { r0: 3, r1: 26, life: 280 });
    emitParticles({
      x, y,
      count: 16,
      speed: 130 * RES_SCALE,
      speedSpread: 90 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 2.8 * RES_SCALE,
      sizeSpread: 1.8 * RES_SCALE,
      scaleY: 2.2,
      lifetime: 0.28,
      color: COL.laserHit,
      drag: 2.4,
    });
    emitHitFx(x, y, COL_WHITE);
    return;
  }
  if (hitKind === 2 || hitKind === 3) {
    // Asteroid / enemy (melee / non-laser hitscan)
    pushFxRing(x, y, COL.laser, { r0: 2, r1: 22, life: 260 });
    emitParticles({
      x, y,
      count: 14,
      speed: 100 * RES_SCALE,
      speedSpread: 70 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 3 * RES_SCALE,
      sizeSpread: 2 * RES_SCALE,
      scaleY: 1.6,
      lifetime: 0.32,
      color: COL.laser,
      drag: 2.2,
    });
    emitParticles({
      x, y,
      count: 8,
      speed: 60 * RES_SCALE,
      speedSpread: 40 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 2.2 * RES_SCALE,
      lifetime: 0.25,
      color: COL.asteroid,
      drag: 1.8,
    });
    return;
  }
  // Miss / edge tip — quieter
  emitParticles({
    x, y,
    count: 4,
    speed: 35 * RES_SCALE,
    speedSpread: 20 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 2 * RES_SCALE,
    lifetime: 0.12,
    color: COL.laser,
    drag: 4
  });
}

/** Outward spark spray from hit surface (asteroid-death spark feel, ±10°).
 *  dirFallback: used when hit ≈ center (common on small ships) — usually bullet travel dir. */
function emitBulletImpactSparks(hx, hy, cx, cy, col, dirFallback, count) {
  const dx = hx - cx;
  const dy = hy - cy;
  // Ships are tiny — hit often lands near center; need a few px for a stable outward dir.
  const dir = (dx * dx + dy * dy) > 16
    ? Math.atan2(dy, dx)
    : (dirFallback != null ? dirFallback : Math.random() * Math.PI * 2);
  emitParticles({
    x: hx, y: hy,
    count: count != null ? count : 20,
    speed: SPARK_SPEED,
    speedSpread: SPARK_SPEED_SPREAD,
    direction: dir,
    spread: (20 * Math.PI) / 180, // ±10°
    size: SPARK_SIZE,
    sizeSpread: SPARK_SIZE_SPREAD,
    scaleY: 1,
    sizeWiggle: 0.35,
    sizeWiggleSpeed: 14,
    lifetime: SPARK_LIFE,
    lifetimeSpread: SPARK_LIFE_SPREAD,
    color: col || COL.asteroid,
    drag: 0.7,
    collide: true,
    edgeBounce: true
  });
}

/** Nearest ship/asteroid center to a hit point (for impact spray direction). */
function findImpactCenter(hx, hy, hitKind) {
  let best = null;
  let bestD = Infinity;
  const consider = (cx, cy) => {
    // Shortest vector from center → hit on the torus.
    const dx = shortestWrapDelta(cx, hx, W);
    const dy = shortestWrapDelta(cy, hy, H);
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      // Unwrapped center so (hx - cx, hy - cy) == (dx, dy).
      best = { x: hx - dx, y: hy - dy };
    }
  };
  if (hitKind === 1) {
    const me = localView();
    consider(me.x, me.y);
    for (const r of remotes.values()) {
      if ((r.hp | 0) <= 0) continue;
      const v = remoteView(r);
      consider(v.x, v.y);
    }
  } else if (hitKind === 3) {
    for (const e of enemies.values()) {
      if ((e.hp | 0) <= 0) continue;
      const p = enemyAt(e);
      consider(p.x, p.y);
    }
  } else if (hitKind === 2) {
    for (const a of asteroids.values()) {
      const p = asteroidAt(a);
      consider(p.x, p.y);
    }
  }
  return best || { x: hx, y: hy };
}

/** Swirling void orb — no solid circle, only particles. */
function emitVoidVortex(x, y, vx, vy) {
  const R = 27 * RES_SCALE;
  const col = COL.voidcannon;
  const dark = [col[0] * 0.45, col[1] * 0.35, col[2] * 0.7];
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = (0.25 + Math.random() * 0.75) * R;
    const tang = a + Math.PI * 0.5 + (Math.random() - 0.5) * 0.35;
    emitParticles({
      x: x + Math.cos(a) * rad,
      y: y + Math.sin(a) * rad,
      count: 1,
      speed: (10 + Math.random() * 28) * RES_SCALE,
      speedSpread: 0,
      direction: tang,
      spread: 0,
      size: (1.8 + Math.random() * 3.5) * RES_SCALE,
      sizeSpread: 0,
      scaleY: 1.4,
      sizeWiggle: 0.25,
      sizeWiggleSpeed: 10,
      lifetime: 0.22 + Math.random() * 0.28,
      lifetimeSpread: 0,
      color: Math.random() < 0.45 ? dark : col,
      drag: 1.6,
      inheritVx: (vx || 0) * 0.55,
      inheritVy: (vy || 0) * 0.55
    });
  }
  // Soft inward suck toward core.
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = (0.55 + Math.random() * 0.45) * R;
    emitParticles({
      x: x + Math.cos(a) * rad,
      y: y + Math.sin(a) * rad,
      count: 1,
      speed: (6 + Math.random() * 14) * RES_SCALE,
      direction: a + Math.PI,
      spread: 0.2,
      size: (2.5 + Math.random() * 3) * RES_SCALE,
      lifetime: 0.3 + Math.random() * 0.25,
      color: dark,
      drag: 2.2,
      inheritVx: (vx || 0) * 0.35,
      inheritVy: (vy || 0) * 0.35
    });
  }
}

/** Big slow void wisps when the orb damages a target. */
function emitVoidDamageParticles(x, y) {
  const col = COL.voidcannon;
  const dark = [col[0] * 0.4, col[1] * 0.3, col[2] * 0.65];
  const scatterR = 25 * RES_SCALE;
  const spawnNear = (n, opts) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * scatterR;
      emitParticles(Object.assign({}, opts, {
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        count: 1
      }));
    }
  };
  spawnNear(10, {
    speed: 14 * RES_SCALE,
    speedSpread: 12 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 8 * RES_SCALE,
    sizeSpread: 6 * RES_SCALE,
    scaleY: 1.2,
    sizeWiggle: 0.2,
    sizeWiggleSpeed: 6,
    lifetime: 0.95,
    lifetimeSpread: 0.45,
    color: col,
    drag: 0.7
  });
  spawnNear(6, {
    speed: 8 * RES_SCALE,
    speedSpread: 8 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 11 * RES_SCALE,
    sizeSpread: 5 * RES_SCALE,
    lifetime: 1.15,
    lifetimeSpread: 0.4,
    color: dark,
    drag: 0.55
  });
}

/** Local visual jitter when void pulses a target (0.4s). */
const VOID_SHAKE_MS = 400;
const VOID_SHAKE_AMP = 3 * RES_SCALE;
const voidShakes = new Map(); // 'p:id' | 'a:id' | 'e:id' -> untilPerf

function beginVoidShake(kind, id) {
  if (!kind || id == null) return;
  voidShakes.set(kind + ':' + (id | 0), performance.now() + VOID_SHAKE_MS);
}

function voidShakeOffset(kind, id) {
  const key = kind + ':' + (id | 0);
  const until = voidShakes.get(key);
  if (until == null) return { x: 0, y: 0 };
  const now = performance.now();
  if (now >= until) {
    voidShakes.delete(key);
    return { x: 0, y: 0 };
  }
  const t = (until - now) / VOID_SHAKE_MS; // 1 → 0
  const amp = VOID_SHAKE_AMP * (0.35 + 0.65 * t);
  return {
    x: (Math.random() * 2 - 1) * amp,
    y: (Math.random() * 2 - 1) * amp
  };
}

/** Bullet impact by hit kind (0 edge, 1 player, 2 asteroid). */
function emitBulletImpactFx(x, y, type, hitKind, bvx, bvy) {
  const col = type === 'rocket' || type === 'enemyRocket' ? (type === 'enemyRocket' ? COL.enemyUfo : COL.rocket)
    : type === 'plasma' ? COL.plasma
    : type === 'voidcannon' ? COL.voidcannon
    : COL.bullet;
  const isRocket = type === 'rocket' || type === 'enemyRocket';
  const travelDir = (bvx != null && bvy != null && (bvx * bvx + bvy * bvy) > 1e-8)
    ? Math.atan2(bvy, bvx)
    : null;
  if (hitKind === 0) {
    emitParticles({
      x, y,
      count: isRocket ? 6 : 3,
      speed: 35 * RES_SCALE,
      speedSpread: 20 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 2 * RES_SCALE,
      lifetime: 0.12,
      color: col,
      drag: 4
    });
    return;
  }
  if (hitKind === 1 || hitKind === 3) {
    // Players + NPC enemies: same flesh/armor hit (hitPlayer2); rockets keep hitPlayer.
    const hitSrc = (hitKind === 1 && isRocket) ? SFX.hitPlayer : SFX.hitPlayerBullet;
    playSfxOverlap(hitSrc, { vol: isRocket && hitKind === 1 ? 0.9 : 0.75, pool: isRocket && hitKind === 1 ? 6 : 8 });
    pushFxRing(x, y, col, { r0: 3, r1: 24, life: 260 });
    if (isRocket && hitKind === 1) {
      emitHitFx(x, y, COL.laserHit);
      emitParticles({
        x, y,
        count: 12,
        speed: 100 * RES_SCALE,
        speedSpread: 70 * RES_SCALE,
        direction: 0,
        spread: Math.PI * 2,
        size: 2.8 * RES_SCALE,
        scaleY: 1.8,
        lifetime: 0.28,
        color: col,
        drag: 2.4
      });
    } else {
      // Same asteroid-death sparks as rock hits (orange, directional ±10°).
      const c = findImpactCenter(x, y, hitKind);
      emitBulletImpactSparks(x, y, c.x, c.y, COL.asteroid, travelDir);
    }
  } else {
    const hitAstSrc = isRocket ? SFX.hitAsteroid : SFX.hitAsteroidBullet;
    playSfxOverlap(hitAstSrc, { vol: isRocket ? 0.85 : 0.65, pool: isRocket ? 6 : 8 });
    if (isRocket) {
      emitHitFx(x, y, col);
      emitParticles({
        x, y,
        count: 10,
        speed: 80 * RES_SCALE,
        speedSpread: 50 * RES_SCALE,
        direction: 0,
        spread: Math.PI * 2,
        size: 2.6 * RES_SCALE,
        lifetime: 0.28,
        color: COL.asteroid,
        drag: 2
      });
    } else {
      const c = findImpactCenter(x, y, 2);
      emitBulletImpactSparks(x, y, c.x, c.y, COL.asteroid, travelDir);
    }
  }
  if (isRocket) {
    pushFxRing(x, y, COL.rocket, { r0: 6, r1: 48, life: 420 });
    pushGridShock(x, y, gridBlastRocketOpts());
    playAmbientExplosionEcho({ vol: 0.6 });
    pushBoomLight(x, y, 52 * RES_SCALE);
    emitParticles({
      x, y,
      count: 18,
      speed: 110 * RES_SCALE,
      speedSpread: 70 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 4.5 * RES_SCALE,
      scaleY: 1.5,
      sizeWiggle: 0.45,
      sizeWiggleSpeed: 11,
      lifetime: 0.4,
      color: COL.rocket,
      drag: 1.8
    });
    // Fast debris sparks (collide ships/asteroids + bounce map edge).
    emitParticles({
      x, y,
      count: 40,
      speed: SPARK_SPEED,
      speedSpread: SPARK_SPEED_SPREAD,
      direction: 0,
      spread: Math.PI * 2,
      size: SPARK_SIZE,
      sizeSpread: SPARK_SIZE_SPREAD,
      scaleY: 1,
      sizeWiggle: 0.35,
      sizeWiggleSpeed: 14,
      lifetime: SPARK_LIFE,
      lifetimeSpread: SPARK_LIFE_SPREAD,
      color: COL.asteroid,
      drag: 0.7,
      collide: true,
      edgeBounce: true
    });
  }
}

/** Brief red sparks when you take damage. */
function emitDamageTakenFx(x, y) {
  pushFxRing(x, y, COL.laserHit, { r0: 4, r1: 30, life: 280 });
  emitParticles({
    x, y,
    count: 14,
    speed: 90 * RES_SCALE,
    speedSpread: 60 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 3 * RES_SCALE,
    sizeSpread: 2 * RES_SCALE,
    scaleY: 1.5,
    lifetime: 0.3,
    color: COL.laserHit,
    drag: 2.5
  });
  softErr.x += (Math.random() - 0.5) * 6 * RES_SCALE;
  softErr.y += (Math.random() - 0.5) * 6 * RES_SCALE;
  clampSoftErr();
  triggerScreenShake(240, 6 * RES_SCALE);
}

/** Mag refilled sparkle. */
function emitReloadReadyFx(x, y, angle) {
  const m = shipMuzzle(x, y, angle);
  pushFxRing(m.x, m.y, COL.bullet, { r0: 2, r1: 16, life: 220 });
  emitParticles({
    x: m.x, y: m.y,
    count: 8,
    speed: 50 * RES_SCALE,
    speedSpread: 30 * RES_SCALE,
    direction: angle,
    spread: 1.2,
    size: 2.2 * RES_SCALE,
    lifetime: 0.2,
    color: COL_WHITE,
    drag: 3.5
  });
}

/** Godmode onset burst at spawn. */
function emitGodmodeStartFx(x, y) {
  pushFxRing(x, y, COL.self, { r0: 8, r1: 55, life: 650 });
  pushFxRing(x, y, COL_WHITE, { r0: 4, r1: 35, life: 400, delay: 40 });
  emitParticles({
    x, y,
    count: 20,
    speed: 70 * RES_SCALE,
    speedSpread: 50 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 3 * RES_SCALE,
    lifetime: 0.45,
    color: COL.self,
    drag: 1.6
  });
  const col = (myId != null) ? ownerPlayerColor(myId) : COL.self;
  startArenaLightShow('respawn', col);
}

/** Kill credit spark for the scoring player. */
function emitScorePopFx(x, y) {
  pushFxRing(x, y, COL.pickup, { r0: 5, r1: 44, life: 500 });
  emitParticles({
    x, y,
    count: 16,
    speed: 85 * RES_SCALE,
    speedSpread: 55 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 3.2 * RES_SCALE,
    lifetime: 0.4,
    color: COL.pickup,
    drag: 2
  });
}

function emitAsteroidBurst(x, y, r, size) {
  const n = Math.max(15, Math.min(30, 8 + ((r / RES_SCALE) | 0)));
  playSfxOverlap(SFX.explosion, { vol: 0.8, pool: 4 });
  playAmbientExplosionEcho();
  let boomR = Math.max(28 * RES_SCALE, (r || 10 * RES_SCALE) * 2.8);
  // Yellow/red grid paint: big 50% smaller, medium 20% smaller.
  if (size === 'big') boomR *= 0.5;
  else if (size === 'medium') boomR *= 0.8;
  pushBoomLight(x, y, boomR);
  // Chunk debris: base speed ± old spread, then widen (min −25, max +50).
  const baseSpd = 50 * RES_SCALE + r * 0.6 * RES_SCALE;
  const oldHalf = 20 * RES_SCALE;
  const minSpd = baseSpd - oldHalf - 25 * RES_SCALE;
  const maxSpd = baseSpd + oldHalf + 50 * RES_SCALE;
  emitParticles({
    x, y,
    count: n,
    speed: (minSpd + maxSpd) * 0.5,
    speedSpread: maxSpd - minSpd,
    direction: 0,
    spread: Math.PI * 2,
    size: 2.5 * RES_SCALE + r * 0.08,
    sizeSpread: 2 * RES_SCALE,
    scaleY: 1.4,
    sizeWiggle: 0.5,
    sizeWiggleSpeed: 9,
    lifetime: 0.8,
    lifetimeSpread: 0.5,
    color: COL.asteroid,
    drag: 1.6,
  });
  // Fast debris sparks
  emitParticles({
    x, y,
    count: 100,
    speed: SPARK_SPEED,
    speedSpread: SPARK_SPEED_SPREAD,
    direction: 0,
    spread: Math.PI * 2,
    size: SPARK_SIZE,
    sizeSpread: SPARK_SIZE_SPREAD,
    scaleY: 1,
    sizeWiggle: 0.35,
    sizeWiggleSpeed: 14,
    lifetime: SPARK_LIFE,
    lifetimeSpread: SPARK_LIFE_SPREAD,
    color: COL.asteroid,
    drag: 0.7,
    collide: true,
    edgeBounce: true
  });
}

function emitPlayerAsteroidHit(x, y) {
  playSfx(SFX.collide, { vol: 0.9 });
  triggerScreenShake(400, 11 * RES_SCALE);
  emitParticles({
    x, y,
    count: 16,
    speed: 90 * RES_SCALE,
    speedSpread: 70 * RES_SCALE,
    direction: Math.random() * Math.PI * 2,
    spread: Math.PI * 2,
    size: 3.5 * RES_SCALE,
    sizeSpread: 2 * RES_SCALE,
    scaleY: 1.3,
    sizeWiggle: 0.45,
    sizeWiggleSpeed: 12,
    lifetime: 0.35,
    lifetimeSpread: 0.2,
    color: COL.asteroid,
    drag: 2,
  });
  emitHitFx(x, y, COL.self);
}

/** Expanding shock rings for death FX. */
/** Active death cinematic: shake → boom → wait for round. */
let deathSeq = null; // { id, x, y, angle, color, shakeUntil, phase }
/** Freeze asteroid dead-reckon clock while the world is paused. */
let deathFreezeAt = 0;
/** Match pause (Esc / disconnect) — freezes local dead-reckon clocks. */
let matchPaused = false;
let pauseFreezeAt = 0;
let pauseState = null; // last `paused` payload
let pendingRejoinOffer = null;

function worldFreezeClock() {
  if (deathSpectating && deathFreezeAt) return deathFreezeAt;
  if (matchPaused && pauseFreezeAt) return pauseFreezeAt;
  return 0;
}

function deathShakeOffset(amplitude) {
  if (!deathSeq || deathSeq.phase !== 'shake') return { x: 0, y: 0 };
  const a = amplitude == null ? 3.5 * RES_SCALE : amplitude;
  const t = performance.now() * 0.06;
  return {
    x: Math.sin(t * 17.1) * a + Math.sin(t * 41.3) * a * 0.45,
    y: Math.cos(t * 19.7) * a + Math.cos(t * 37.9) * a * 0.45
  };
}

/** Full-view hit feedback (bullet / asteroid). Decays over `dur` ms. */
let screenShake = null; // { start, dur, amp }
let screenShakeCssOn = false;

function triggerScreenShake(durMs, amp) {
  const now = performance.now();
  const dur = durMs == null ? 260 : durMs;
  const a = amp == null ? 5 * RES_SCALE : amp;
  if (screenShake) {
    const t = (now - screenShake.start) / screenShake.dur;
    if (t < 1) {
      const cur = screenShake.amp * (1 - t);
      if (a < cur * 0.9 && now + dur <= screenShake.start + screenShake.dur) return;
    }
  }
  screenShake = { start: now, dur, amp: a };
}

function screenShakeOffset(now) {
  if (!screenShake) return { x: 0, y: 0 };
  const t = (now - screenShake.start) / screenShake.dur;
  if (t >= 1) {
    screenShake = null;
    return { x: 0, y: 0 };
  }
  const fade = (1 - t) * (1 - t);
  const a = screenShake.amp * fade;
  const w = now * 0.055;
  return {
    x: (Math.sin(w * 17.1) + Math.sin(w * 41.3) * 0.45) * a,
    y: (Math.cos(w * 19.7) + Math.cos(w * 37.9) * 0.45) * a
  };
}

function applyScreenShakeCss(now) {
  const off = screenShakeOffset(now);
  if (!off.x && !off.y) {
    if (screenShakeCssOn) {
      canvas.style.transform = '';
      screenShakeCssOn = false;
    }
    return;
  }
  const sx = (off.x / W) * canvas.clientWidth;
  const sy = (off.y / H) * canvas.clientHeight;
  canvas.style.transform = 'translate(' + sx.toFixed(2) + 'px,' + sy.toFixed(2) + 'px)';
  screenShakeCssOn = true;
}

function clearScreenShake() {
  screenShake = null;
  if (screenShakeCssOn) {
    canvas.style.transform = '';
    screenShakeCssOn = false;
  }
}

/** Retro invuln blink — hidden half the time while godmode is active. */
function godmodeBlinkVisible(godLeft) {
  if (!(godLeft > 0)) return true;
  return (Math.floor(performance.now() / 90) & 1) === 0;
}

/** F1 death telegrapher — full-grid implosion 100ms before the ship boom. */
function gridBlastDeathPreOpts() {
  return {
    shape: 'full',
    amp: 16 * RES_SCALE * 3,
    width: 5,
    ripple: 2.45,
    freq: 0.95,
    inward: true
  };
}

function emitDeathPreGridFx(x, y) {
  pushGridShock(x, y, gridBlastDeathPreOpts());
}

/** Epic multi-wave ship death blast. */
function emitPlayerDeathFx(x, y, color) {
  const col = color || COL.self;
  // Dedicated held clip — more reliable than pool seek on a long wav.
  playSfxLoop('death', SFX.death, { vol: 0.95, loop: false });
  playAmbientExplosionEcho({ vol: 0.7 });
  syncThrustSfx(false);
  syncLaserSfx(false);
  pushBoomLight(x, y, 96 * RES_SCALE);
  pushGridShock(x, y, { amp: 36 * RES_SCALE, width: 60, ripple: 1, inward: false });
  pushGridShock(x, y, { amp: 18 * RES_SCALE, width: 36, ripple: 1, inward: false });
  // Colored hull debris only (was ~5.5 size / 42 count → ÷3 size, ×2 count).
  emitParticles({
    x, y,
    count: 84,
    speed: 140 * RES_SCALE,
    speedSpread: 110 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: (5.5 * RES_SCALE) / 3,
    sizeSpread: (4 * RES_SCALE) / 3,
    scaleY: 1.7,
    sizeWiggle: 0.6,
    sizeWiggleSpeed: 12,
    lifetime: 1.1,
    lifetimeSpread: 0.5,
    color: col,
    drag: 1.0,
  });
  // Hit/explosion-style sparks ×4, ship-colored with hue/sat swings; collide + edge bounce.
  const sparkN = 40 * 4;
  for (let i = 0; i < sparkN; i++) {
    emitParticles({
      x, y,
      count: 1,
      speed: SPARK_SPEED,
      speedSpread: SPARK_SPEED_SPREAD,
      direction: 0,
      spread: Math.PI * 2,
      size: SPARK_SIZE,
      sizeSpread: SPARK_SIZE_SPREAD,
      scaleY: 1,
      sizeWiggle: 0.35,
      sizeWiggleSpeed: 14,
      lifetime: SPARK_LIFE,
      lifetimeSpread: SPARK_LIFE_SPREAD,
      color: varyShipSparkColor(col),
      drag: 0.7,
      collide: true,
      edgeBounce: true
    });
  }
  // Nested shock rings
  const now = performance.now();
  deathRings.push({ x, y, born: now, life: 900, color: COL_WHITE, r0: 4, r1: 50 });
  deathRings.push({ x, y, born: now + 40, life: 1400, color: col, r0: 6, r1: 110 });
  deathRings.push({ x, y, born: now + 90, life: 2000, color: [1.0, 0.55, 0.15], r0: 10, r1: 160 });
}

function updateDeathRings(now) {
  for (let i = deathRings.length - 1; i >= 0; i--) {
    if (now - deathRings[i].born >= deathRings[i].life) deathRings.splice(i, 1);
  }
}

function drawDeathRings(now) {
  for (const ring of deathRings) {
    const t = Math.min(1, Math.max(0, (now - ring.born) / ring.life));
    const r0 = (ring.r0 != null ? ring.r0 : 8) * RES_SCALE;
    const r1 = (ring.r1 != null ? ring.r1 : 90) * RES_SCALE;
    const r = r0 + (r1 - r0) * t;
    const a = (1 - t) * (1 - t);
    drawLines(circleVerts(ring.x, ring.y, r, 36), ring.color || COL_WHITE, gl.LINE_LOOP, a);
    drawLines(circleVerts(ring.x, ring.y, r * 0.78, 28), COL_WHITE, gl.LINE_LOOP, a * 0.4);
  }
}

function tickDeathSequence(now) {
  if (!deathSeq || deathSeq.phase !== 'shake') return;
  if (!deathSeq.preGridDone && now >= (deathSeq.preGridAt || 0)) {
    deathSeq.preGridDone = true;
    emitDeathPreGridFx(deathSeq.x, deathSeq.y);
  }
  if (now < deathSeq.shakeUntil) return;
  // Local fallback if `boom` packet is late.
  deathSeq.phase = 'boom';
  if (!deathSeq.preGridDone) {
    deathSeq.preGridDone = true;
    emitDeathPreGridFx(deathSeq.x, deathSeq.y);
  }
  emitPlayerDeathFx(deathSeq.x, deathSeq.y, deathSeq.color);
  if (deathSeq.id === myId) player.hp = 0;
  else {
    const r = remotes.get(deathSeq.id);
    if (r) r.hp = 0;
  }
}

function playerSpawnPoseLocal(id) {
  // Solo waves: middle (matches server). Coop / PvP keep face-off pads.
  if (practiceMode && !coopMode) {
    return { x: W * 0.5, y: H * 0.5, angle: -Math.PI / 2 };
  }
  const slot = ((id | 0) - 1) & 1;
  if (slot === 0) {
    return { x: W * 0.5 - SPAWN_CENTER_OFFSET, y: H * 0.5, angle: Math.PI };
  }
  return { x: W * 0.5 + SPAWN_CENTER_OFFSET, y: H * 0.5, angle: 0 };
}

let spawnZoneParticleAcc = 0;

const SPAWN_ZONE_WHITE = [1, 1, 1];

/** Sport pad outline while godmode — lines tinted to that player's color. */
function drawSpawnZones(dt) {
  const zones = [];
  if ((player.godLeft | 0) > 0 && myId != null) {
    zones.push({ id: myId });
  }
  for (const r of remotes.values()) {
    if ((r.godLeft | 0) > 0) zones.push({ id: r.id });
  }
  if (!zones.length) {
    spawnZoneParticleAcc = 0;
    return;
  }
  spawnZoneParticleAcc += dt || 0.016;
  for (const z of zones) {
    const pose = playerSpawnPoseLocal(z.id);
    const R = GODMODE_SPAWN_CLEAR_R;
    const fill = ownerPlayerColor(z.id) || SPAWN_ZONE_WHITE;
    const line = fill;
    // Double pass — brighter pulsating god pad in all modes.
    drawLines(circleVerts(pose.x, pose.y, R, 48), line, gl.LINE_LOOP, 1);
    drawLines(circleVerts(pose.x, pose.y, R, 48), COL_WHITE, gl.LINE_LOOP, 0.55);
    drawLines(circleVerts(pose.x, pose.y, R * 0.55, 32), line, gl.LINE_LOOP, 1);
    drawLines(circleVerts(pose.x, pose.y, R * 0.55, 32), COL_WHITE, gl.LINE_LOOP, 0.4);
    // Cross + hash ticks (sport face-off) — full axes through pad center.
    drawLines(
      [pose.x - R, pose.y, pose.x + R, pose.y, pose.x, pose.y - R, pose.x, pose.y + R],
      line, gl.LINES, 1
    );
    drawLines(
      [pose.x - R, pose.y, pose.x + R, pose.y, pose.x, pose.y - R, pose.x, pose.y + R],
      COL_WHITE, gl.LINES, 0.35
    );
    const tick = R * 0.18;
    const tickVerts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const c = Math.cos(a);
      const s = Math.sin(a);
      tickVerts.push(
        pose.x + c * (R - tick), pose.y + s * (R - tick),
        pose.x + c * (R + tick * 0.35), pose.y + s * (R + tick * 0.35)
      );
    }
    drawLines(tickVerts, line, gl.LINES, 1);
    drawLines(tickVerts, COL_WHITE, gl.LINES, 0.4);
    if (spawnZoneParticleAcc >= 0.05) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * R;
      emitParticles({
        x: pose.x + Math.cos(ang) * rad,
        y: pose.y + Math.sin(ang) * rad,
        count: 2,
        speed: 18 * RES_SCALE,
        speedSpread: 14 * RES_SCALE,
        direction: ang + Math.PI * 0.5,
        spread: 0.8,
        size: 2.2 * RES_SCALE,
        scaleY: 1.2,
        lifetime: 0.55,
        lifetimeSpread: 0.25,
        color: fill,
        drag: 1.4
      });
    }
  }
  if (spawnZoneParticleAcc >= 0.05) spawnZoneParticleAcc = 0;
}


function drawSceneLines(dt) {
  const showHit = cv('cl_hitbox') > 0;
  const shake = deathShakeOffset();
  const dyingId = deathSeq && deathSeq.phase === 'shake' ? deathSeq.id : null;
  const nightBlend = _lightFlashNight > 0.5;
  if (nightBlend) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  // Gold ores sit under ships / asteroids / enemies / bullets.
  drawCoins();

  // Local ship (alive, or shaking corpse before boom)
  const drawMe = (player.hp > 0 || dyingId === myId) &&
    (dyingId === myId || godmodeBlinkVisible(player.godLeft));
  if (drawMe) {
    const me = localView();
    const vs = voidShakeOffset('p', myId);
    const ox = (dyingId === myId ? shake.x : 0) + vs.x;
    const oy = (dyingId === myId ? shake.y : 0) + vs.y;
    drawShip3D(me.x + ox, me.y + oy, me.angle, me.av || 0, ownerPlayerColor(myId), myId, dt);
    drawShipPowerupFx(me.x + ox, me.y + oy, myId, me.angle, dt);
    if (showHit) drawCollisionRing(me.x + ox, me.y + oy, me.angle, COL.debug);
  }

  for (const r of remotes.values()) {
    const isDying = dyingId === r.id;
    if (r.hp <= 0 && !isDying) continue;
    if (!isDying && !godmodeBlinkVisible(r.godLeft)) continue;
    const v = remoteView(r);
    const vs = voidShakeOffset('p', r.id);
    const ox = (isDying ? shake.x : 0) + vs.x;
    const oy = (isDying ? shake.y : 0) + vs.y;
    drawShip3D(v.x + ox, v.y + oy, v.angle, v.av || 0, ownerPlayerColor(r.id), r.id, dt);
    drawShipPowerupFx(v.x + ox, v.y + oy, r.id, v.angle, dt);
    if (showHit) drawCollisionRing(v.x + ox, v.y + oy, v.angle, COL.debug);
  }
  drawLaserBeams();
  drawHitscanDebug();
  for (const a of asteroids.values()) {
    const p = asteroidAt(a);
    const vs = voidShakeOffset('a', a.id);
    const ax = p.x + vs.x;
    const ay = p.y + vs.y;
    const age = asteroidAgeTicks(a);
    if (showHit) {
      const sil = asteroidCollisionPts(a);
      const hitPts = sil.map(v => v * ASTEROID_HIT_SCALE);
      drawFilledPoly(worldVerts(ax, ay, p.angle, hitPts), COL.debug, 0.35);
    }
    const col = asteroidColor(a);
    const size = a.size || (a.big ? 'big' : 'medium');
    const sid = asteroidShapeId(a);
    drawAsteroid2D(ax, ay, p.angle, sid, a.r || 16, col, size);
    if ((a.special === 'meteor' || a.playerShot) && !deathSpectating) {
      const boost = (a._meteorBurnBoostUntil && performance.now() < a._meteorBurnBoostUntil) ? 3 : 1;
      emitMeteorBurnFx(
        asteroidSilhouetteWorldPoly(ax, ay, p.angle, sid, a.r || 16, size),
        ax, ay, a.vx, a.vy, boost
      );
    }
  }
  drawPortalDangerIndicators();
  for (const u of pickups.values()) {
    drawPickup(u);
  }
  drawEnemies(dt);
  drawAsteroidGhosts();
  drawSpawnZones(dt);
  if (nightBlend) gl.disable(gl.BLEND);
}

function asteroidColor(a) {
  if (a && (a.playerShot || a.special === 'meteor')) return COL.meteor;
  // Server hue (0–1) when present — shards inherit parent ±20°.
  if (a && a.hue != null && Number.isFinite(a.hue)) {
    return hsvToRgb(a.hue, 1, 1);
  }
  // Deterministic per shape seed so portal twins match their parent.
  const id = (a && a.shapeId != null) ? (a.shapeId | 0)
    : (a && a.id != null) ? (a.id | 0) : 0;
  const h = asteroidHash01(id ^ 0xc0ffee);
  return hsvToRgb(h, 1, 1);
}

function asteroidClientWrapMax(a) {
  const m = a && a.edgeWrapMax != null ? (a.edgeWrapMax | 0) : 1;
  return m > 0 ? m : 1;
}

function asteroidClientWrapsExhausted(a) {
  return !!(a && (a.edgeWraps | 0) >= asteroidClientWrapMax(a));
}

/**
 * Red edge warning: capsule flush on the screen edge.
 * edge: 0 left, 1 right, 2 top, 3 bottom.
 * Soft inward falloff + rounded, gradient tips (no hard square cut).
 */
function drawPortalDangerBand(edge, along, halfLen, bandW, col) {
  const hw = Math.max(8, halfLen);
  const band = Math.max(4, bandW);
  const tipR = Math.min(hw * 0.85, band * 1.15); // rounded tip radius along edge
  const bodyHalf = Math.max(0, hw - tipR);
  const alongN = 32;
  const inN = 14;
  const baseA = 0.88;

  for (let j = 0; j < alongN; j++) {
    const u0 = -1 + (2 * j) / alongN;
    const u1 = -1 + (2 * (j + 1)) / alongN;
    const uMid = (u0 + u1) * 0.5;
    const s = uMid * hw;
    const tipDist = Math.max(0, Math.abs(s) - bodyHalf);
    // Semicircle tip: inward extent shrinks toward the pointy ends.
    let localBand = band;
    let tipFade = 1;
    if (tipDist > 0) {
      if (tipDist >= tipR) continue;
      const q = tipDist / tipR;
      localBand = band * Math.sqrt(Math.max(0, 1 - q * q));
      // Extra soft alpha so tips dissolve instead of cutting off.
      tipFade = (1 - q) * (1 - q);
    }
    if (localBand < 0.4) continue;

    for (let i = 0; i < inN; i++) {
      const t0 = i / inN;
      const t1 = (i + 1) / inN;
      const d0 = t0 * band;
      const d1 = t1 * band;
      if (d0 >= localBand) break;
      const x0 = d0;
      const x1 = Math.min(d1, localBand);
      if (x1 - x0 < 0.15) continue;
      const tMid = ((x0 + x1) * 0.5) / band;
      // Smooth inward gradient (opaque at rim → gone inside).
      const inFade = (1 - tMid) * (1 - tMid);
      const alpha = baseA * tipFade * inFade;
      if (alpha <= 0.015) continue;

      const a0 = along + u0 * hw;
      const a1 = along + u1 * hw;
      let verts;
      if (edge === 0) {
        verts = [x0, a0, x1, a0, x1, a1, x0, a1];
      } else if (edge === 1) {
        verts = [W - x1, a0, W - x0, a0, W - x0, a1, W - x1, a1];
      } else if (edge === 2) {
        verts = [a0, x0, a1, x0, a1, x1, a0, x1];
      } else {
        verts = [a0, H - x1, a1, H - x1, a1, H - x0, a0, H - x0];
      }
      drawFilledPoly(verts, col, alpha);
    }
  }
}

/** Edge danger for inbound portal twins + opposite-edge warn while a rock is exiting. */
function drawPortalDangerIndicators() {
  const col = [1.0, 0.12, 0.18];
  const bandW = 22;
  const lead = 30;
  for (const a of asteroids.values()) {
    // Meteor-gun shots: classic edge teleport only — no portal danger bands.
    if (a.playerShot) continue;
    // PvP: no danger for smalls. Waves: smalls get one wrap too (skip if spent).
    if (a.size === 'small' && !practiceMode) continue;
    // Already used their one wrap — no portal / no opposite-edge warn (waves only).
    if (practiceMode && asteroidClientWrapsExhausted(a)) continue;
    const p = asteroidAt(a);
    const xOff = p.x < 0 || p.x > W;
    const yOff = p.y < 0 || p.y > H;
    // Per-axis: if that axis's center is already on-world, skip that axis's bands.
    if (!xOff && !yOff) continue;
    const r = Math.max(4, a.r || 10 * RES_SCALE);
    const halfLen = r;
    const vx = a.vx || 0;
    const vy = a.vy || 0;
    const lim = r + lead;

    const bandL = () => { if (xOff) drawPortalDangerBand(0, p.y, halfLen, bandW, col); };
    const bandR = () => { if (xOff) drawPortalDangerBand(1, p.y, halfLen, bandW, col); };
    const bandT = () => { if (yOff) drawPortalDangerBand(2, p.x, halfLen, bandW, col); };
    const bandB = () => { if (yOff) drawPortalDangerBand(3, p.x, halfLen, bandW, col); };

    // Inbound portal twin from server — warn on its entry edge(s).
    if (a.portal) {
      if (Math.abs(vx) >= Math.abs(vy) && vx !== 0) {
        if (vx > 0) bandL();
        else bandR();
      } else if (vy !== 0) {
        if (vy > 0) bandT();
        else bandB();
      } else {
        const dl = p.x, dr = W - p.x, dt = p.y, db = H - p.y;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) bandL();
        else if (m === dr) bandR();
        else if (m === dt) bandT();
        else bandB();
      }
      continue;
    }

    // Parent approaching exit (same lead as server) — warn opposite entry edge
    // so the line shows even before the twin `af` arrives.
    if ((cv('sv_portal') | 0) === 0) continue;
    if (p.x > W - lim && vx > 0) bandL();
    else if (p.x < lim && vx < 0) bandR();
    else if (p.y > H - lim && vy > 0) bandT();
    else if (p.y < lim && vy < 0) bandB();
  }
}

/** Server-truth asteroid outlines (sv_send_asteroids) — faint ghost. */
function asteroidGhostAt(g) {
  const age = Math.max(0, (serverNow() - g.spawnSt) / 1000 * TPS);
  return {
    x: g.spawnX + g.vx * age,
    y: g.spawnY + g.vy * age,
    angle: g.spawnAngle + g.spin * age
  };
}

function drawAsteroidGhosts() {
  if (cv('sv_send_asteroids') <= 0 || !asteroidGhosts.length) return;
  for (const g of asteroidGhosts) {
    const p = asteroidGhostAt(g);
    const local = asteroids.get(g.id);
    const r = (local && local.r) || g.r || 10 * RES_SCALE;
    const size = (local && local.size) || 'medium';
    const sid = (local && local.shapeId != null) ? (local.shapeId | 0) : (g.id | 0);
    // Server pose = collision silhouette only (no filled body — that stacked on the local rock).
    const sil = buildAsteroidSilhouettePts(sid, r, size);
    const hit = [];
    for (let i = 0; i < sil.length; i++) hit.push(sil[i] * ASTEROID_HIT_SCALE);
    drawLines(worldVerts(p.x, p.y, p.angle, hit), COL.debug, gl.LINE_LOOP, 0.85);
  }
}

/** Outline burn embers — max 6 frames @ 60fps. */
const METEOR_BURN_LIFE = 6 / 60;
/** Hot tip — deep orange-red (was near-white). */
const METEOR_BURN_HOT = [1.0, 0.45, 0.12];
/** Ember core — saturated red-orange. */
const METEOR_BURN_CORE = [0.98, 0.28, 0.08];

/** World-space flat silhouette [x,y,...] for area sampling. */
function asteroidSilhouetteWorldPoly(cx, cy, angle, id, radius, size) {
  const sil = buildAsteroidSilhouettePts(id, radius, size || 'medium');
  return worldVerts(cx, cy, angle, sil);
}

/** Uniform random point inside a star-shaped flat polygon (centroid fan). */
function samplePointInPolyFlat(verts) {
  const n = (verts.length / 2) | 0;
  if (n < 3) return null;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += verts[i * 2];
    cy += verts[i * 2 + 1];
  }
  cx /= n;
  cy /= n;
  let total = 0;
  const areas = _meteorPolyAreaScratch;
  areas.length = n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = verts[i * 2] - cx, ay = verts[i * 2 + 1] - cy;
    const bx = verts[j * 2] - cx, by = verts[j * 2 + 1] - cy;
    const a = Math.abs(ax * by - ay * bx) * 0.5;
    areas[i] = a;
    total += a;
  }
  if (!(total > 1e-6)) return { x: cx, y: cy };
  let pick = Math.random() * total;
  let ti = 0;
  for (; ti < n; ti++) {
    pick -= areas[ti];
    if (pick <= 0) break;
  }
  if (ti >= n) ti = n - 1;
  const j = (ti + 1) % n;
  // Uniform in triangle (centroid, vi, vj).
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  const x0 = verts[ti * 2], y0 = verts[ti * 2 + 1];
  const x1 = verts[j * 2], y1 = verts[j * 2 + 1];
  return {
    x: cx + u * (x0 - cx) + v * (x1 - cx),
    y: cy + u * (y0 - cy) + v * (y1 - cy)
  };
}
const _meteorPolyAreaScratch = [];

/**
 * Dense fire across the full 2D silhouette (not rim-only).
 * Lifetime capped at METEOR_BURN_LIFE (6 frames).
 * speedMul: temporary boost (e.g. 3× for 65ms after meteor-gun rock bounce).
 */
function emitMeteorBurnFx(polyFlat, cx, cy, vx, vy, speedMul) {
  if (!polyFlat || polyFlat.length < 6) return;
  const spdMul = speedMul != null && speedMul > 0 ? speedMul : 1;
  const lifeMax = METEOR_BURN_LIFE;
  let budget = 120;
  while (budget-- > 0) {
    const pt = samplePointInPolyFlat(polyFlat);
    if (!pt) return;
    const pi = allocParticle();
    if (pi < 0) return;
    let ox = pt.x - cx, oy = pt.y - cy;
    let ol = Math.hypot(ox, oy);
    if (ol < 1e-6) {
      ox = -(vx || 0);
      oy = -(vy || 0);
      ol = Math.hypot(ox, oy) || 1;
    }
    ox /= ol;
    oy /= ol;
    const jitter = (Math.random() - 0.5) * 0.7 * RES_SCALE;
    const ang = Math.atan2(oy, ox) + (Math.random() - 0.5) * 0.7;
    const spd = (6 + Math.random() * 18) * RES_SCALE * spdMul;
    const life = lifeMax * (0.55 + Math.random() * 0.45);
    const roll = Math.random();
    const col = roll > 0.88 ? METEOR_BURN_HOT
      : roll > 0.45 ? METEOR_BURN_CORE
      : COL.meteor;
    pX[pi] = pt.x + -oy * jitter;
    pY[pi] = pt.y + ox * jitter;
    pVx[pi] = Math.cos(ang) * spd + vx * 0.92;
    pVy[pi] = Math.sin(ang) * spd + vy * 0.92;
    pLife[pi] = life;
    pMaxLife[pi] = life;
    pSize[pi] = (0.55 + Math.random() * 1.15) * RES_SCALE;
    pScaleY[pi] = 1.05 + Math.random() * 0.55;
    pWiggle[pi] = 0.25;
    pWiggleSpd[pi] = 18;
    pPhase[pi] = Math.random() * Math.PI * 2;
    pDrag[pi] = 4.5;
    pR[pi] = col[0];
    pG[pi] = col[1];
    pB[pi] = col[2];
    pCollide[pi] = 0;
    pEdgeBounce[pi] = 0;
    pSkipShip[pi] = 0;
    pFadeLife[pi] = 0;
    pAlive[pi] = 1;
  }
}

/** Meteor-gun rock vs world rock — metal crash + chips; boosts burn trail briefly. */
const METEOR_CRASH_BURN_MS = 65;
function emitMeteorGunCrashFx(x, y, nx, ny, asteroidId) {
  playSfxOverlap(SFX.meteorCrash, { vol: 0.9, pool: 6 });
  const ang = (nx != null && ny != null) ? Math.atan2(ny, nx) : Math.random() * Math.PI * 2;
  pushFxRing(x, y, COL.meteor, { r0: 3, r1: 22, life: 220 });
  emitParticles({
    x, y,
    count: 14,
    speed: 110 * RES_SCALE,
    speedSpread: 80 * RES_SCALE,
    direction: ang,
    spread: 1.1,
    size: 2.4 * RES_SCALE,
    sizeSpread: 1.6 * RES_SCALE,
    scaleY: 1.8,
    lifetime: 0.28,
    lifetimeSpread: 0.12,
    color: COL.meteor,
    drag: 2.2,
    collide: true
  });
  emitParticles({
    x, y,
    count: 10,
    speed: 70 * RES_SCALE,
    speedSpread: 50 * RES_SCALE,
    direction: ang + Math.PI,
    spread: 1.0,
    size: 2 * RES_SCALE,
    sizeSpread: 1.2 * RES_SCALE,
    scaleY: 1.4,
    lifetime: 0.22,
    lifetimeSpread: 0.1,
    color: METEOR_BURN_CORE,
    drag: 2.6,
    collide: true
  });
  emitHitFx(x, y, COL.meteor);
  if (asteroidId != null) {
    const a = asteroids.get(asteroidId);
    if (a) a._meteorBurnBoostUntil = performance.now() + METEOR_CRASH_BURN_MS;
  }
}

let worldVertScratch = new Float32Array(256);

function worldVerts(x, y, angle, local, scale) {
  const s0 = scale == null ? 1 : scale;
  const c = Math.cos(angle), s = Math.sin(angle);
  const n = local.length;
  worldVertScratch = growF32(worldVertScratch, n);
  for (let i = 0; i < n; i += 2) {
    const lx = local[i] * s0, ly = local[i + 1] * s0;
    worldVertScratch[i] = x + lx * c - ly * s;
    worldVertScratch[i + 1] = y + lx * s + ly * c;
  }
  return n === worldVertScratch.length ? worldVertScratch : worldVertScratch.subarray(0, n);
}

/* ========== Vector asteroid: fixed 2D jagged outline ========== */
function asteroidHash01(id) {
  let x = ((id | 0) * 2654435761) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Deterministic LCG stream from asteroid id. */
function asteroidRng(id) {
  let s = ((id | 0) * 2654435761) >>> 0;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function asteroidOutlineCount(id, size) {
  const h = asteroidHash01(id);
  if (size === 'big') return 12 + ((h * 3) | 0);
  if (size === 'medium') return 10 + ((h * 3) | 0);
  return 8 + ((h * 3) | 0);
}

/** Unit outline radii (0.6–1.0) — irregular shape, spins with 2D angle only. */
const _outlineRadCache = new Map();
function getAsteroidOutlineRadii(id, size) {
  const key = 's0|' + id + '|' + (size || 'medium');
  let radii = _outlineRadCache.get(key);
  if (radii) return radii;
  const n = asteroidOutlineCount(id, size);
  const rnd = asteroidRng(id ^ 0x9e3779b9);
  radii = new Float64Array(n);
  for (let i = 0; i < n; i++) radii[i] = 0.6 + rnd() * 0.4;
  if (_outlineRadCache.size >= 120) _outlineRadCache.delete(_outlineRadCache.keys().next().value);
  _outlineRadCache.set(key, radii);
  return radii;
}

function outlineRadiusAt(radii, angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const n = radii.length;
  const index = (a / (Math.PI * 2)) * n;
  const i0 = Math.floor(index) % n;
  const i1 = (i0 + 1) % n;
  const t = index - Math.floor(index);
  return radii[i0] * (1 - t) + radii[i1] * t;
}

/** Collision / draw silhouette in local space (matches server). */
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

function asteroidCollisionPts(a) {
  const id = a.shapeId != null ? a.shapeId : (a.id != null ? a.id : a.aid);
  const size = a.size || (a.big ? 'big' : 'medium');
  if (a._silPts && a._silId === id && a._silR === a.r && a._silSize === size) return a._silPts;
  a._silId = id;
  a._silR = a.r;
  a._silSize = size;
  a._silPts = buildAsteroidSilhouettePts(id, a.r, size);
  return a._silPts;
}

/** Draw jagged asteroid: perspective 3D mesh (fill + wire + equator outline). */
function drawAsteroid2D(cx, cy, angle, id, radius, color, size) {
  drawAsteroid3D(cx, cy, angle, id, radius, color, size || 'medium');
}

/**
 * 3D rock mesh — equator matches the 2D silhouette in local XY;
 * drawn orthographic top-down (camera straight down).
 */
const astTexVS = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  uniform vec2 uRes;
  varying vec2 vUV;
  varying vec2 vWorld;
  void main() {
    vec2 p = floor(aPos + 0.5) / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    vUV = aUV;
    vWorld = aPos;
  }
`;
const astTexFS = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec3 uTint;
  uniform float uTintPow;
  uniform float uEmit;
  uniform float uAlpha;
  varying vec2 vUV;
  varying vec2 vWorld;
` + SCENE_LIGHT_GLSL + `
  void main() {
    vec4 t = texture2D(uTex, vUV);
    vec3 tint = mix(vec3(1.0), uTint, clamp(uTintPow, 0.0, 1.0));
    vec3 albedo = t.rgb * tint;
    // Godot-style emission: tint × bright albedo × energy (single pass, no bloom).
    float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    float emitMask = smoothstep(0.12, 0.72, lum);
    vec3 rgb = albedo + uTint * emitMask * max(0.0, uEmit);
    gl_FragColor = applyNightLit(rgb, uAlpha, vWorld);
  }
`;
const astTexProg = gl.createProgram();
gl.bindAttribLocation(astTexProg, 0, 'aPos');
gl.bindAttribLocation(astTexProg, 1, 'aUV');
gl.attachShader(astTexProg, shader(gl.VERTEX_SHADER, astTexVS));
gl.attachShader(astTexProg, shader(gl.FRAGMENT_SHADER, astTexFS));
linkProgram(astTexProg);
const astTURes = gl.getUniformLocation(astTexProg, 'uRes');
const astTUTex = gl.getUniformLocation(astTexProg, 'uTex');
const astTUTint = gl.getUniformLocation(astTexProg, 'uTint');
const astTUTintPow = gl.getUniformLocation(astTexProg, 'uTintPow');
const astTUEmit = gl.getUniformLocation(astTexProg, 'uEmit');
const astTUAlpha = gl.getUniformLocation(astTexProg, 'uAlpha');
const astTexLightU = {
  night: gl.getUniformLocation(astTexProg, 'uFlashNight'),
  ships: gl.getUniformLocation(astTexProg, 'uShipLight[0]'),
  wrap: gl.getUniformLocation(astTexProg, 'uLightWrap')
};
const astTAPos = gl.getAttribLocation(astTexProg, 'aPos');
const astTAUV = gl.getAttribLocation(astTexProg, 'aUV');
const astTexBuf = gl.createBuffer();
/** Face: 3 verts; edge quad: 6 verts × (x,y,u,v). */
const _astTexMesh = new Float32Array(6 * 4);

const asteroidFaceTex = gl.createTexture();
let asteroidFaceTexReady = false;
(function loadAsteroidFaceTex() {
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, asteroidFaceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    asteroidFaceTexReady = true;
  };
  img.onerror = () => console.error('Failed to load textures/asteroid.png');
  img.src = 'textures/asteroid.png';
})();

const shipHullTex = gl.createTexture();
let shipHullTexReady = false;
(function loadShipHullTex() {
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, shipHullTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    shipHullTexReady = true;
  };
  img.onerror = () => console.error('Failed to load textures/ship.png');
  img.src = 'textures/ship.png';
})();

/** Planar UVs from local mesh XY — works for any hull shape. */
function shipMeshUvScale(verts) {
  let m = 0;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    m = Math.max(m, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]) * 0.55);
  }
  return m > 0.01 ? m : 1;
}

function shipVertUV(vx, vy, uvScale, id) {
  const tile = 2.35;
  const ox = ((id | 0) * 0.173) % 2;
  const oy = ((id | 0) * 0.291) % 2;
  return [(vx / uvScale) * tile * 0.5 + ox, (vy / uvScale) * tile * 0.5 + oy];
}

function beginShipHullTex() {
  if (!shipHullTexReady) return false;
  gl.useProgram(astTexProg);
  gl.enableVertexAttribArray(astTAPos);
  gl.enableVertexAttribArray(astTAUV);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shipHullTex);
  gl.uniform1i(astTUTex, 0);
  gl.uniform2f(astTURes, W, H);
  bindSceneLightUniforms(astTexLightU);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function endShipHullTex() {
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(astTAUV);
}

function drawShipHullFaceTex(xy, mv, f, uvScale, id, tint, alpha, tintPow) {
  const m = _astTexMesh;
  for (let i = 0; i < 3; i++) {
    const vi = f[i];
    const uv = shipVertUV(mv[vi][0], mv[vi][1], uvScale, id);
    const o = i * 4;
    m[o] = xy[vi * 2];
    m[o + 1] = xy[vi * 2 + 1];
    m[o + 2] = uv[0];
    m[o + 3] = uv[1];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, astTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, m.subarray(0, 12), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(astTAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(astTAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform3f(astTUTint, tint[0], tint[1], tint[2]);
  gl.uniform1f(astTUTintPow, tintPow != null ? tintPow : 0.55);
  gl.uniform1f(astTUEmit, 0);
  gl.uniform1f(astTUAlpha, alpha);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Draw mesh faces with ship.png (fallback: flat fill). */
function drawShipMeshFacesTex(xy, depth, mesh, color, id) {
  const faces = mesh.faces || [];
  if (!faces.length) return;
  const mv = mesh.verts;
  const order = faces.map((f, i) => {
    const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    return { i, z };
  });
  order.sort((a, b) => a.z - b.z);
  const texOn = beginShipHullTex();
  const uvScale = shipMeshUvScale(mv);
  const faceA = texOn ? 0.92 : 0.28;
  const tintPow = 0.58;
  for (const o of order) {
    const f = faces[o.i];
    if (texOn) {
      drawShipHullFaceTex(xy, mv, f, uvScale, id, color, faceA, tintPow);
    } else {
      drawFilledPoly([
        xy[f[0] * 2], xy[f[0] * 2 + 1],
        xy[f[1] * 2], xy[f[1] * 2 + 1],
        xy[f[2] * 2], xy[f[2] * 2 + 1]
      ], color, faceA);
    }
  }
  if (texOn) endShipHullTex();
}

/** Planar UVs from local mesh XY (tiled + per-id offset). */
function asteroidVertUV(vx, vy, r, id) {
  const rr = Math.max(1, r);
  const tile = 1.85;
  const ox = asteroidHash01((id | 0) ^ 0x11a) * 3.7;
  const oy = asteroidHash01((id | 0) ^ 0x22b) * 3.7;
  return [(vx / rr) * tile * 0.5 + ox, (vy / rr) * tile * 0.5 + oy];
}

function drawAsteroidFaceTex(xy, mv, f, radius, id, tint, alpha, tintPow, emit) {
  const m = _astTexMesh;
  for (let i = 0; i < 3; i++) {
    const vi = f[i];
    const uv = asteroidVertUV(mv[vi][0], mv[vi][1], radius, id);
    const o = i * 4;
    m[o] = xy[vi * 2];
    m[o + 1] = xy[vi * 2 + 1];
    m[o + 2] = uv[0];
    m[o + 3] = uv[1];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, astTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, m.subarray(0, 12), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(astTAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(astTAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform3f(astTUTint, tint[0], tint[1], tint[2]);
  gl.uniform1f(astTUTintPow, tintPow != null ? tintPow : 0.7);
  gl.uniform1f(astTUEmit, emit != null ? emit : 0);
  gl.uniform1f(astTUAlpha, alpha);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Thick edge as textured quad (outline / wire). */
function drawAsteroidEdgeTex(xy, mv, lo, hi, radius, id, tint, alpha, width, tintPow, emit) {
  const x0 = xy[lo * 2], y0 = xy[lo * 2 + 1];
  const x1 = xy[hi * 2], y1 = xy[hi * 2 + 1];
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const hw = Math.max(0.5, width) * 0.5;
  const nx = (-dy / len) * hw, ny = (dx / len) * hw;
  const uv0 = asteroidVertUV(mv[lo][0], mv[lo][1], radius, id);
  const uv1 = asteroidVertUV(mv[hi][0], mv[hi][1], radius, id);
  const m = _astTexMesh;
  m[0] = x0 + nx; m[1] = y0 + ny; m[2] = uv0[0]; m[3] = uv0[1];
  m[4] = x0 - nx; m[5] = y0 - ny; m[6] = uv0[0]; m[7] = uv0[1];
  m[8] = x1 + nx; m[9] = y1 + ny; m[10] = uv1[0]; m[11] = uv1[1];
  m[12] = x0 - nx; m[13] = y0 - ny; m[14] = uv0[0]; m[15] = uv0[1];
  m[16] = x1 - nx; m[17] = y1 - ny; m[18] = uv1[0]; m[19] = uv1[1];
  m[20] = x1 + nx; m[21] = y1 + ny; m[22] = uv1[0]; m[23] = uv1[1];
  gl.bindBuffer(gl.ARRAY_BUFFER, astTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, m, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(astTAPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(astTAUV, 2, gl.FLOAT, false, 16, 8);
  gl.uniform3f(astTUTint, tint[0], tint[1], tint[2]);
  gl.uniform1f(astTUTintPow, tintPow != null ? tintPow : 1);
  gl.uniform1f(astTUEmit, emit != null ? emit : 0);
  gl.uniform1f(astTUAlpha, alpha);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

const _astWireCache = new Map();
const _astFaceScratch = [];
const _astEdgeSeen = new Set();
const _astTriScratch = [0, 0, 0, 0, 0, 0];
const _astOutlineScratch = [];
/** True top-down camera (no view tilt). Small osc still tips the rock itself. */
const AST3D_VIEW_PITCH = 0;

/** Deterministic per-id Z stretch from cl_ast_z_min / cl_ast_z_max. */
function asteroidZScale(id) {
  let zMin = Number(cv('cl_ast_z_min'));
  let zMax = Number(cv('cl_ast_z_max'));
  if (!Number.isFinite(zMin)) zMin = 0.9;
  if (!Number.isFinite(zMax)) zMax = 1.1;
  if (zMin > zMax) { const swap = zMin; zMin = zMax; zMax = swap; }
  const t = asteroidHash01((id | 0) ^ 0x7a5ca1e);
  return zMin + (zMax - zMin) * t;
}

/** Orthographic top-down projection (yaw spin + local X/Y osc only).
 *  Returns screen xy, depth (= world Z for painter), and world offsets for lighting. */
function projectAsteroidMesh3D(verts, cx, cy, yaw, oscPitch, oscRoll, zScale) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const cOp = Math.cos(oscPitch || 0);
  const sOp = Math.sin(oscPitch || 0);
  const cOr = Math.cos(oscRoll || 0);
  const sOr = Math.sin(oscRoll || 0);
  const zS = (zScale != null && zScale > 0) ? zScale : 1;
  const n = verts.length;
  const xy = new Float64Array(n * 2);
  const depth = new Float64Array(n);
  const wxA = new Float64Array(n);
  const wyA = new Float64Array(n);
  const wzA = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lx = verts[i][0];
    const ly = verts[i][1];
    const lz = verts[i][2] * zS;
    // Local tumble only (±osc) — camera stays straight down.
    const x1 = lx * cOr + lz * sOr;
    const z1 = -lx * sOr + lz * cOr;
    const y2 = ly * cOp - z1 * sOp;
    const z2 = ly * sOp + z1 * cOp;
    const wx = x1 * ca - y2 * sa;
    const wy = x1 * sa + y2 * ca;
    const wz = z2;
    xy[i * 2] = cx + wx;
    xy[i * 2 + 1] = cy + wy;
    depth[i] = wz;
    wxA[i] = wx;
    wyA[i] = wy;
    wzA[i] = wz;
  }
  return { xy, depth, wx: wxA, wy: wyA, wz: wzA };
}

/** Silhouette unit radius at world angle th (0 = +X). */
function asteroidSilUnitAt(radii, th) {
  const n = radii.length;
  const t = ((th / (Math.PI * 2)) * n % n + n) % n;
  const i0 = t | 0;
  const i1 = (i0 + 1) % n;
  const f = t - i0;
  return radii[i0] * (1 - f) + radii[i1] * f;
}

/** Random interior point, biased off-center but always inside the silhouette. */
function sampleAsteroidHub(radii, r, rnd) {
  let hx = 0;
  let hy = 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    const th = rnd() * Math.PI * 2;
    const sil = asteroidSilUnitAt(radii, th) * r;
    const d = sil * (0.15 + rnd() * 0.4);
    hx = Math.cos(th) * d;
    hy = Math.sin(th) * d;
    let ok = true;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const silK = asteroidSilUnitAt(radii, a) * r;
      const reach = hx * Math.cos(a) + hy * Math.sin(a);
      if (silK - reach < sil * 0.22) { ok = false; break; }
    }
    if (ok) return { x: hx, y: hy };
  }
  return { x: hx, y: hy };
}

function astAddTri(faces, layers, a, b, c, layer) {
  faces.push([a, b, c]);
  layers.push(layer | 0);
}
function astAddQuad(faces, layers, a, b, c, d, layer) {
  faces.push([a, b, c], [a, c, d]);
  layers.push(layer | 0, layer | 0);
}
/** Fill a ring of `count` verts starting at `base` with a zigzag strip (no shared hub). */
function astAddPolygonStrip(faces, layers, base, count, layer) {
  if (count < 3) return;
  let i = 0;
  let j = count - 1;
  let flip = false;
  while (i + 1 < j) {
    if (!flip) {
      astAddTri(faces, layers, base + i, base + i + 1, base + j, layer);
      i++;
    } else {
      astAddTri(faces, layers, base + j, base + i, base + j - 1, layer);
      j--;
    }
    flip = !flip;
  }
}

/** 3D mesh uses the full silhouette ring (matches 2D collision outline). */
function getAsteroidMeshRadii(id, size) {
  return getAsteroidOutlineRadii(id, size || 'medium');
}

function getAsteroidWireMesh(id, radius, size) {
  // Full rock (top + bottom), equator matches collision outline.
  // w16: 50% hub fan top, 50% mesa + zigzag strip (no single apex).
  const key = 'w16|' + (id | 0) + '|' + (size || 'medium') + '|' + ((radius * 10) | 0);
  let m = _astWireCache.get(key);
  if (m) return m;
  const radii = getAsteroidMeshRadii(id, size || 'medium');
  const n = radii.length;
  const rnd = asteroidRng((id | 0) ^ 0x51aced);
  const r = radius || 16;
  const insetU = 0.5 + rnd() * 0.14;
  const h = r * (0.28 + rnd() * 0.18);
  const insetL = 0.5 + rnd() * 0.14;
  const hL = h * (0.88 + rnd() * 0.28);
  // Deterministic 50/50 — same id always same top style.
  const useHubTop = asteroidHash01((id | 0) ^ 0xc0debabe) < 0.5;

  const verts = [];
  const faces = [];
  const layers = [];
  // Equator + upper ridge (both styles).
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const d = r * radii[i];
    verts.push([Math.cos(th) * d, Math.sin(th) * d, 0]);
  }
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const d = r * radii[i] * insetU;
    verts.push([Math.cos(th) * d, Math.sin(th) * d, h]);
  }

  if (useHubTop) {
    // Classic: all deck lines meet at one north/south apex.
    const hub = sampleAsteroidHub(radii, r, rnd);
    const north = verts.length;
    verts.push([hub.x, hub.y, h * 1.15]);
    const L = verts.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const d = r * radii[i] * insetL;
      verts.push([Math.cos(th) * d, Math.sin(th) * d, -hL]);
    }
    const south = verts.length;
    verts.push([hub.x, hub.y, -hL * 1.15]);

    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      astAddQuad(faces, layers, i, i1, n + i1, n + i, 2);
      astAddQuad(faces, layers, i1, i, L + i, L + i1, 2);
      astAddTri(faces, layers, n + i, n + i1, north, 3);
      astAddTri(faces, layers, L + i1, L + i, south, 3);
    }
  } else {
    // Mesa: inner ridge ring + zigzag fill — no single shared apex.
    const insetI = insetU * (0.38 + rnd() * 0.22);
    const hI = h * (1.02 + rnd() * 0.28);
    const IU = verts.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const d = r * radii[i] * insetI * (0.9 + rnd() * 0.18);
      verts.push([Math.cos(th) * d, Math.sin(th) * d, hI * (0.88 + rnd() * 0.24)]);
    }
    const L = verts.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const d = r * radii[i] * insetL;
      verts.push([Math.cos(th) * d, Math.sin(th) * d, -hL]);
    }
    const insetIL = insetL * (0.38 + rnd() * 0.22);
    const hIL = hL * (1.02 + rnd() * 0.28);
    const IL = verts.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const d = r * radii[i] * insetIL * (0.9 + rnd() * 0.18);
      verts.push([Math.cos(th) * d, Math.sin(th) * d, -hIL * (0.88 + rnd() * 0.24)]);
    }

    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      astAddQuad(faces, layers, i, i1, n + i1, n + i, 2);
      astAddQuad(faces, layers, i1, i, L + i, L + i1, 2);
      astAddQuad(faces, layers, n + i, n + i1, IU + i1, IU + i, 3);
      astAddQuad(faces, layers, L + i1, L + i, IL + i, IL + i1, 3);
    }
    astAddPolygonStrip(faces, layers, IU, n, 3);
    astAddPolygonStrip(faces, layers, IL, n, 3);
  }

  m = { verts, faces, layers, n };
  if (_astWireCache.size >= 100) _astWireCache.delete(_astWireCache.keys().next().value);
  _astWireCache.set(key, m);
  return m;
}

/** ±20° independent X/Y wobble, phase-shifted per asteroid.
 *  Uses a pause-aware clock so tumble holds still during death/match freeze. */
const AST3D_OSC_AMP = 20 * Math.PI / 180;
let astOscPauseOffset = 0;
let astOscFrozenT = null;
function asteroidOscT() {
  if (worldFreezeClock()) {
    if (astOscFrozenT == null) {
      astOscFrozenT = performance.now() * 0.001 - astOscPauseOffset;
    }
    return astOscFrozenT;
  }
  if (astOscFrozenT != null) {
    astOscPauseOffset = performance.now() * 0.001 - astOscFrozenT;
    astOscFrozenT = null;
  }
  return performance.now() * 0.001 - astOscPauseOffset;
}
function asteroidOscAngles(id) {
  const t = asteroidOscT();
  const ph = (id | 0) * 1.718;
  return {
    pitch: Math.sin(t * 0.9 + ph) * AST3D_OSC_AMP,
    roll: Math.sin(t * 1.15 + ph * 1.37) * AST3D_OSC_AMP
  };
}

/** Screen-space signed area of projected triangle ( >0 = facing camera). */
function astFaceScreenArea(xy, f) {
  const ax = xy[f[0] * 2], ay = xy[f[0] * 2 + 1];
  const bx = xy[f[1] * 2], by = xy[f[1] * 2 + 1];
  const cx = xy[f[2] * 2], cy = xy[f[2] * 2 + 1];
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Lambertian shade: ship radial on the local player (same R as grid light). */
const _astShadeCol = [1, 1, 1];
const AST_LIGHT_Z = 80 * RES_SCALE;
/** Match grid bake / SCENE_LIGHT softShipRad ease. */
function softShipRadAtten(d, R) {
  if (!(R > 0) || d >= R) return 0;
  const u = d / R;
  const s = u * u * (3 - 2 * u);
  const t = 1 - s;
  return t * t * (3 - 2 * t);
}
function asteroidPlayerLight() {
  try {
    const me = localView();
    if (me) return { x: me.x, y: me.y, z: AST_LIGHT_Z };
  } catch (_) { /* ignore */ }
  if (player && player.hp > 0) return { x: player.x, y: player.y, z: AST_LIGHT_Z };
  return { x: W * 0.5, y: H * 0.5, z: AST_LIGHT_Z };
}
function asteroidFaceShade(wx, wy, wz, f, cx, cy, lightX, lightY, lightZ) {
  const i0 = f[0], i1 = f[1], i2 = f[2];
  const ax = wx[i0], ay = wy[i0], az = wz[i0];
  const bx = wx[i1], by = wy[i1], bz = wz[i1];
  const cxw = wx[i2], cyw = wy[i2], cz = wz[i2];
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cxw - ax, e2y = cyw - ay, e2z = cz - az;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= nlen; ny /= nlen; nz /= nlen;
  const mx = cx + (ax + bx + cxw) / 3;
  const my = cy + (ay + by + cyw) / 3;
  const mz = (az + bz + cz) / 3;
  const lz0 = (lightZ != null ? lightZ : AST_LIGHT_Z) - mz;
  const R = AST_SHIP_LIGHT_R;
  // Sum every torus image in range: near an edge, direct + wrap both light
  // the rock (often opposite faces) — one ship, two radial sources.
  let lit = 0;
  for (let ox = -W; ox <= W; ox += W) {
    for (let oy = -H; oy <= H; oy += H) {
      const dx = (lightX + ox) - mx;
      const dy = (lightY + oy) - my;
      const atten = softShipRadAtten(Math.sqrt(dx * dx + dy * dy), R);
      if (atten <= 0) continue;
      let lx = dx, ly = dy, lz = lz0;
      const llen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      lx /= llen; ly /= llen; lz /= llen;
      lit += atten * Math.max(0, nx * lx + ny * ly + nz * lz);
    }
  }
  if (lit > 1) lit = 1;
  return 0.18 + 0.82 * lit;
}

function drawAsteroid3D(cx, cy, angle, id, radius, color, size) {
  const mesh = getAsteroidWireMesh(id, radius, size);
  const osc = asteroidOscAngles(id);
  const { xy, depth, wx, wy, wz } = projectAsteroidMesh3D(
    mesh.verts, cx, cy, angle, osc.pitch, osc.roll, asteroidZScale(id)
  );
  const faces = mesh.faces;
  const mv = mesh.verts;
  const light = asteroidPlayerLight();
  const lightX = light.x;
  const lightY = light.y;
  const lightZ = light.z;

  const faceA = Math.max(0, Math.min(1, Number(cv('cl_ast_face_alpha'))));
  const faceTexOn = (cv('cl_ast_face_tex') | 0) !== 0 && asteroidFaceTexReady;
  const faceTintPow = Math.max(0, Math.min(1, Number(cv('cl_ast_face_tint'))));
  const outlineA = Math.max(0, Math.min(1, Number(cv('cl_ast_outline_alpha'))));
  const outlineTexOn = (cv('cl_ast_outline_tex') | 0) !== 0 && asteroidFaceTexReady;
  const wireA = Math.max(0, Math.min(1, Number(cv('cl_ast_wire_alpha'))));
  const wireW = Math.max(0.5, Number(cv('cl_ast_wire_width')) || 2);
  const needEdges = wireA > 0.001;
  const emitPow = Math.max(0, Number(cv('cl_ast_emit')) || 0);
  const outlineEmitPow = Math.max(0, Number(cv('cl_ast_outline_emit')) || 0);
  const bindTex = (faceTexOn && faceA > 0.001) || (outlineTexOn && outlineA > 0.001);

  // Always draw the mesh's built-in top half (local Z >= 0). Independent of wobble.
  const order = _astFaceScratch;
  order.length = 0;
  const edgeInfo = _astEdgeInfo;
  if (needEdges) edgeInfo.clear();

  for (let i = 0; i < faces.length; i++) {
    const fMesh = faces[i];
    const localZ = (mv[fMesh[0]][2] + mv[fMesh[1]][2] + mv[fMesh[2]][2]) / 3;
    if (localZ < 0) continue; // bottom hemisphere of the constant mesh
    // Screen back-face cull (Y-down → CW front); flip winding if needed.
    let area = astFaceScreenArea(xy, fMesh);
    let f = fMesh;
    if (area < 0) {
      f = [fMesh[0], fMesh[2], fMesh[1]];
      area = -area;
    }
    if (area < 1e-6) continue;
    const zAvg = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    const sVal = asteroidFaceShade(wx, wy, wz, fMesh, cx, cy, lightX, lightY, lightZ);
    order.push({ f, zAvg, sVal });
    if (needEdges) {
      for (let e = 0; e < 3; e++) {
        const a = f[e];
        const b = f[(e + 1) % 3];
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        // Skip equator ring — drawn as silhouette outline.
        if (lo < mesh.n && hi < mesh.n) continue;
        const key = lo * 100000 + hi;
        let info = edgeInfo.get(key);
        if (!info) {
          info = { shade: 0, z: (depth[lo] + depth[hi]) * 0.5 };
          edgeInfo.set(key, info);
        }
        if (sVal > info.shade) info.shade = sVal;
      }
    }
  }
  order.sort((a, b) => a.zAvg - b.zAvg);

  const tri = _astTriScratch;
  const shadeCol = _astShadeCol;
  if (bindTex) {
    gl.useProgram(astTexProg);
    gl.enableVertexAttribArray(astTAPos);
    gl.enableVertexAttribArray(astTAUV);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, asteroidFaceTex);
    gl.uniform1i(astTUTex, 0);
    gl.uniform2f(astTURes, W, H);
    bindSceneLightUniforms(astTexLightU);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  if (faceA > 0.001) {
    for (let o = 0; o < order.length; o++) {
      const f = order[o].f;
      const s = order[o].sVal;
      shadeCol[0] = Math.min(1, color[0] * s);
      shadeCol[1] = Math.min(1, color[1] * s);
      shadeCol[2] = Math.min(1, color[2] * s);
      if (faceTexOn) {
        drawAsteroidFaceTex(xy, mv, f, radius, id, shadeCol, faceA, faceTintPow, emitPow);
      } else {
        tri[0] = xy[f[0] * 2]; tri[1] = xy[f[0] * 2 + 1];
        tri[2] = xy[f[1] * 2]; tri[3] = xy[f[1] * 2 + 1];
        tri[4] = xy[f[2] * 2]; tri[5] = xy[f[2] * 2 + 1];
        drawFilledPoly(tri, shadeCol, faceA);
      }
    }
  }

  const wire = _astWireColScratch;
  if (wireA > 0.001) {
    const keys = _astEdgeKeys;
    keys.length = 0;
    for (const key of edgeInfo.keys()) keys.push(key);
    keys.sort((ka, kb) => edgeInfo.get(ka).z - edgeInfo.get(kb).z);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const info = edgeInfo.get(key);
      const lo = (key / 100000) | 0;
      const hi = key - lo * 100000;
      const s = info.shade;
      wire[0] = Math.min(1, color[0] * s);
      wire[1] = Math.min(1, color[1] * s);
      wire[2] = Math.min(1, color[2] * s);
      drawThickSegment(
        xy[lo * 2], xy[lo * 2 + 1],
        xy[hi * 2], xy[hi * 2 + 1],
        wireW, wire, wireA
      );
    }
  }

  if (outlineA > 0.001) {
    const nEq = mesh.n | 0;
    const outlineW = 2;
    wire[0] = Math.min(1, color[0]);
    wire[1] = Math.min(1, color[1]);
    wire[2] = Math.min(1, color[2]);
    // Untextured solid lines: Godot emission = albedo + tint×energy.
    const emitSolid = !outlineTexOn && outlineEmitPow > 0.001;
    if (emitSolid) {
      const e = outlineEmitPow;
      wire[0] = Math.min(1, color[0] + color[0] * e);
      wire[1] = Math.min(1, color[1] + color[1] * e);
      wire[2] = Math.min(1, color[2] + color[2] * e);
    }
    const emitGlow = _astEmitColScratch;
    if (emitSolid) {
      emitGlow[0] = color[0];
      emitGlow[1] = color[1];
      emitGlow[2] = color[2];
    }
    const glowA = emitSolid ? Math.min(1, outlineA * outlineEmitPow * 0.55) : 0;
    const glowW = outlineW + 2;
    for (let i = 0; i < nEq; i++) {
      const j = (i + 1) % nEq;
      if (outlineTexOn) {
        drawAsteroidEdgeTex(xy, mv, i, j, radius, id, wire, outlineA, outlineW, 1, outlineEmitPow);
      } else {
        drawThickSegment(
          xy[i * 2], xy[i * 2 + 1],
          xy[j * 2], xy[j * 2 + 1],
          outlineW, wire, outlineA
        );
        if (glowA > 0.01) {
          drawThickSegment(
            xy[i * 2], xy[i * 2 + 1],
            xy[j * 2], xy[j * 2 + 1],
            glowW, emitGlow, glowA, true
          );
        }
      }
    }
  }

  if (bindTex) {
    gl.disableVertexAttribArray(astTAUV);
  }
}
const _astWireColScratch = [1, 1, 1];
const _astEmitColScratch = [1, 1, 1];
const _astEdgeInfo = new Map();
const _astEdgeKeys = [];

/** Flat edge list from 2D silhouette — used by meteor burn FX. */
function asteroidOutlineEdges(cx, cy, angle, id, radius, size) {
  const sil = buildAsteroidSilhouettePts(id, radius, size || 'medium');
  const outline = worldVerts(cx, cy, angle, sil);
  const n = (outline.length / 2) | 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push(outline[i * 2], outline[i * 2 + 1], outline[j * 2], outline[j * 2 + 1]);
  }
  return out;
}

function asteroidShapeId(a) {
  if (!a) return 0;
  if (a.shapeId != null) return a.shapeId | 0;
  if (a.id != null) return a.id | 0;
  return a.aid | 0;
}

/* ========== 3D wireframe player ship (selectable Elite / FE2 hulls) ========== */
/** 2D silhouette kept for muzzle / legacy helpers (nose, wings). */
const shipShape = [9 * RES_SCALE, 0, -6 * RES_SCALE, 5 * RES_SCALE, -6 * RES_SCALE, -5 * RES_SCALE];
/** Unit-normalized defs from ship-meshes.js → scaled local meshes. */
const SHIP_MESH_SCALE = 9 * RES_SCALE;
const SHIP_MESH_LS_KEY = 'asteroids_ship_mesh';
function scaleShipMeshDef(def) {
  const s = SHIP_MESH_SCALE;
  return {
    id: def.id,
    name: def.name || def.id,
    source: def.source || 'local',
    nose: Math.max(0, Math.min((def.verts && def.verts.length ? def.verts.length : 1) - 1, def.nose | 0)),
    verts: (def.verts || []).map((v) => [v[0] * s, v[1] * s, v[2] * s]),
    faces: (def.faces || []).map((f) => f.slice()),
    edges: (def.edges || []).map((e) => e.slice())
  };
}
const SHIP_MESHES = (typeof SHIP_MESH_DEFS !== 'undefined' && Array.isArray(SHIP_MESH_DEFS) && SHIP_MESH_DEFS.length
  ? SHIP_MESH_DEFS
  : [{
      id: 'arrow',
      name: 'Arrow',
      source: 'local',
      nose: 0,
      verts: [[1, 0, 0], [-0.6667, 0.6111, 0], [-0.6667, -0.6111, 0], [-0.1667, 0, 0.5778]],
      faces: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [2, 1, 3]],
      edges: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]
    }]
).map(scaleShipMeshDef);

let selectedShipMeshId = 'arrow';
try {
  const saved = localStorage.getItem(SHIP_MESH_LS_KEY);
  if (saved && SHIP_MESHES.some((m) => m.id === saved)) selectedShipMeshId = saved;
} catch (_) { /* ignore */ }

function getShipMeshById(id) {
  return SHIP_MESHES.find((m) => m.id === id) || SHIP_MESHES[0];
}
function getActiveShipMesh() {
  return getShipMeshById(selectedShipMeshId);
}
function setActiveShipMesh(id) {
  const m = getShipMeshById(id);
  if (!m) return;
  selectedShipMeshId = m.id;
  try { localStorage.setItem(SHIP_MESH_LS_KEY, m.id); } catch (_) { /* ignore */ }
  if (typeof syncShipMeshUi === 'function') syncShipMeshUi();
}

/** Default Arrow mesh — rockets / fallback still use this tetrahedron. */
const SHIP3D_VERTS = SHIP_MESHES[0].verts;
const SHIP3D_FACES = SHIP_MESHES[0].faces;
const SHIP3D_EDGES = SHIP_MESHES[0].edges;
/** How much height lifts toward screen-up (0 = pure top-down ortho). */
const SHIP3D_LIFT = 0;
const SHIP_BANK_MAX = 0.72;
const SHIP_BANK_GAIN = 10;
const shipBankSmooth = new Map();

function shipBankTarget(av) {
  const t = -(av || 0) * SHIP_BANK_GAIN;
  if (t > SHIP_BANK_MAX) return SHIP_BANK_MAX;
  if (t < -SHIP_BANK_MAX) return -SHIP_BANK_MAX;
  return t;
}

function shipBankSmoothed(id, av, dt) {
  const target = shipBankTarget(av);
  const key = id != null ? id : -1;
  let cur = shipBankSmooth.get(key);
  if (cur == null || !Number.isFinite(cur)) cur = target;
  const k = 1 - Math.exp(-14 * Math.max(0.001, dt || 0.016));
  cur += (target - cur) * k;
  shipBankSmooth.set(key, cur);
  return cur;
}

/**
 * Project local 3D mesh verts → screen XY.
 * Roll (bank/spin) around forward axis, then yaw to face angle; Z lifts on screen.
 */
function projectMesh3D(verts, cx, cy, yaw, bank) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const cb = Math.cos(bank);
  const sb = Math.sin(bank);
  const n = verts.length;
  const xy = new Float64Array(n * 2);
  const depth = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lx = verts[i][0];
    const ly = verts[i][1];
    const lz = verts[i][2];
    // Roll around +X (nose): banks wings / tips canopy into the turn.
    const y1 = ly * cb - lz * sb;
    const z1 = ly * sb + lz * cb;
    const wx = lx * ca - y1 * sa;
    const wy = lx * sa + y1 * ca;
    xy[i * 2] = cx + wx;
    xy[i * 2 + 1] = cy + wy - z1 * SHIP3D_LIFT;
    depth[i] = z1;
  }
  return { xy, depth };
}

function projectShip3D(cx, cy, yaw, bank) {
  return projectMesh3D(getActiveShipMesh().verts, cx, cy, yaw, bank);
}

function drawShip3D(x, y, angle, av, color, id, dt) {
  const mesh = getActiveShipMesh();
  const bank = shipBankSmoothed(id, av, dt);
  const { xy, depth } = projectMesh3D(mesh.verts, x, y, angle, bank);
  const nose = mesh.nose | 0;
  const edges = mesh.edges || [];

  drawShipMeshFacesTex(xy, depth, mesh, color, id);

  const tipHeat = (id | 0) === (myId | 0) ? shipCannonTipHeat() : 0;
  const edgeW = 1.125 * RES_SCALE; // 2.25 px at RES_SCALE=2
  for (const e of edges) {
    const x0 = xy[e[0] * 2], y0 = xy[e[0] * 2 + 1];
    const x1 = xy[e[1] * 2], y1 = xy[e[1] * 2 + 1];
    // Nose edges: ship color at base → hot red at tip (gun / nose vertex).
    if (tipHeat > 0 && (e[0] === nose || e[1] === nose)) {
      const tipIs0 = e[0] === nose;
      const tipCol = _tipHotScratch;
      tipCol[0] = color[0] + (COL.cannonHot[0] - color[0]) * tipHeat;
      tipCol[1] = color[1] + (COL.cannonHot[1] - color[1]) * tipHeat;
      tipCol[2] = color[2] + (COL.cannonHot[2] - color[2]) * tipHeat;
      drawThickGradientSegment(
        tipIs0 ? x1 : x0, tipIs0 ? y1 : y0,
        tipIs0 ? x0 : x1, tipIs0 ? y0 : y1,
        edgeW, color, tipCol, 8
      );
    } else {
      drawThickSegment(x0, y0, x1, y1, edgeW, color);
    }
  }
}

/** Rocket = 0.7× player 3D tetrahedron, continuous roll spin. */
const ROCKET3D_SCALE = 0.7;
const ROCKET3D_VERTS = SHIP3D_VERTS.map((v) => [v[0] * ROCKET3D_SCALE, v[1] * ROCKET3D_SCALE, v[2] * ROCKET3D_SCALE]);
/** UFO rocket = 1/3 of normal weapon rocket mesh. */
const ENEMY_ROCKET3D_SCALE = ROCKET3D_SCALE / 3;
const ENEMY_ROCKET3D_VERTS = SHIP3D_VERTS.map((v) => [
  v[0] * ENEMY_ROCKET3D_SCALE,
  v[1] * ENEMY_ROCKET3D_SCALE,
  v[2] * ENEMY_ROCKET3D_SCALE
]);
const ROCKET_SPIN_RATE = 9; // rad/s around nose

function rocketSpinAngle(id) {
  return (performance.now() / 1000) * ROCKET_SPIN_RATE + (id | 0) * 1.1;
}

function drawRocket3D(x, y, yaw, color, id, tiny) {
  const verts = tiny ? ENEMY_ROCKET3D_VERTS : ROCKET3D_VERTS;
  const spin = rocketSpinAngle(id);
  const { xy, depth } = projectMesh3D(verts, x, y, yaw, spin);
  const order = SHIP3D_FACES.map((f, i) => {
    const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    return { i, z };
  });
  order.sort((a, b) => a.z - b.z);
  for (const o of order) {
    const f = SHIP3D_FACES[o.i];
    const tri = [
      xy[f[0] * 2], xy[f[0] * 2 + 1],
      xy[f[1] * 2], xy[f[1] * 2 + 1],
      xy[f[2] * 2], xy[f[2] * 2 + 1]
    ];
    drawFilledPoly(tri, color, 0.3);
  }
  const edgeW = (tiny ? 0.7 : 1.4) * RES_SCALE;
  for (const e of SHIP3D_EDGES) {
    drawThickSegment(xy[e[0] * 2], xy[e[0] * 2 + 1], xy[e[1] * 2], xy[e[1] * 2 + 1], edgeW, color);
  }
}

const keys = {};
let spaceLatch = false;
let enterLatch = false;
let shootPulse = false;

function turnLeft() { return keys.ArrowLeft || keys.KeyA; }
function turnRight() { return keys.ArrowRight || keys.KeyD; }
function thrustUp() { return keys.ArrowUp || keys.KeyW; }
function precisionTurn() {
  return keys.ArrowDown || keys.KeyS || keys.ShiftLeft || keys.ShiftRight;
}

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter',
  'ShiftLeft', 'ShiftRight'
]);

const WEAPON_NAMES = ['default', 'rocket', 'laser', 'shotgun', 'railgun', 'plasma', 'voidcannon', 'asteroidgun'];
const WEAPON_MAX_LEVEL = 3;
let selectedWeapon = 1; // 1 default … 8 asteroidgun
/** Mirror of server WEAPONS — used only to gate local muzzle/fake shot FX. */
const WEAPONS = {
  default: { ammo: 3, cooldown: 2, reload: Math.round(1.25 * TPS), speed: 8 * RES_SCALE },
  rocket: { ammo: 1, cooldown: 3, reload: 38, speed: 8 * RES_SCALE },
  laser: { ammo: 30, cooldown: 1, reload: 90, range: Math.hypot(W, H) },
  shotgun: {
    ammo: 2,
    cooldown: 1,
    reload: 40,
    shotgun: 5,
    spread: 30,
    shotgunSpeeds: [4 * RES_SCALE, 9 * RES_SCALE]
  },
  railgun: { ammo: 1, cooldown: 60, reload: 1, charge: Math.round(0.5 * TPS) },
  plasma: { ammo: 50, cooldown: 2, reload: Math.round(2 * TPS), speed: 9 * RES_SCALE },
  voidcannon: { ammo: 1, cooldown: 1, reload: 60, speed: 1.792 * RES_SCALE },
  asteroidgun: { ammo: 1, cooldown: 3, reload: Math.round(2.5 * TPS), speed: 8 * RES_SCALE }
};
let weaponLevels = {
  default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1,
  plasma: 1, voidcannon: 1, asteroidgun: 1
};
/** Solo shop unlocks — default only until bought or picked up. */
let unlockedWeapons = {
  default: true, rocket: false, laser: false, shotgun: false,
  railgun: false, plasma: false, voidcannon: false, asteroidgun: false
};
const localShoot = { shootAmmo: 3, shootCd: 0, reloadLeft: 0, bursting: false, railChargeLeft: 0, sfxSkipNext: false };

function currentWeaponName() {
  return WEAPON_NAMES[selectedWeapon - 1] || 'default';
}

function getLocalWeaponLevel(name) {
  const n = name || currentWeaponName();
  return Math.max(1, Math.min(WEAPON_MAX_LEVEL, weaponLevels[n] | 0 || 1));
}

function effectiveLocalWeapon(name) {
  const n = name || currentWeaponName();
  const base = WEAPONS[n] || WEAPONS.default;
  const lvl = getLocalWeaponLevel(n);
  const w = Object.assign({}, base);
  if (n === 'default') {
    if (lvl >= 2) w.ammo += 1;
    if (lvl >= 3) w.ammo += 1;
  } else if (n === 'rocket') {
    if (lvl >= 2 && w.speed != null) w.speed *= 1.2;
    if (lvl >= 3) w.reload = Math.max(1, Math.round(base.reload * 0.7));
  } else if (n === 'shotgun') {
    if (lvl >= 2) w.ammo += 1;
    if (lvl >= 3) w.shotgun = (base.shotgun | 0) + 2;
  } else if (n === 'laser') {
    if (lvl >= 3) w.ammo = Math.round(base.ammo * 1.25);
  }
  return w;
}

/** Nose heat 0..1: rises per shot in the mag, max when empty; cools over last fade ticks of reload. */
const CANNON_TIP_FADE_TICKS = 8;
function shipCannonTipHeat() {
  const w = effectiveLocalWeapon(currentWeaponName());
  const maxAmmo = Math.max(1, (w.ammo | 0));
  const reloadLeft = localShoot.reloadLeft | 0;
  if (reloadLeft > 0) {
    if (reloadLeft >= CANNON_TIP_FADE_TICKS) return 1;
    return reloadLeft / CANNON_TIP_FADE_TICKS;
  }
  const ammo = Math.max(0, localShoot.shootAmmo | 0);
  return Math.min(1, Math.max(0, (maxAmmo - ammo) / maxAmmo));
}

function resetLocalShoot(weaponName) {
  const w = effectiveLocalWeapon(weaponName || currentWeaponName());
  localShoot.shootAmmo = w.ammo;
  localShoot.shootCd = 0;
  localShoot.reloadLeft = 0;
  localShoot.bursting = false;
  localShoot.railChargeLeft = 0;
  localShoot.sfxSkipNext = false;
}

function tryStartLocalBurst() {
  if (!matchLive) return false;
  // Space while invuln: drop godmode and fire (matches server).
  if ((player.godLeft | 0) > 0) player.godLeft = 0;
  if (localShoot.bursting || localShoot.reloadLeft > 0 || localShoot.shootAmmo <= 0 || (localShoot.shootCd | 0) > 0) {
    return false;
  }
  if (currentWeaponName() === 'railgun' && (localShoot.railChargeLeft | 0) > 0) return false;
  localShoot.bursting = true;
  if (selectedWeapon === 3) {
    const w = effectiveLocalWeapon(currentWeaponName());
    const tickMs = 1000 / TPS;
    // Clip length from weapon type ammo (not current counter) × cooldown ticks.
    const perShotTicks = Math.max(1, w.cooldown | 0);
    const shots = Math.max(1, w.ammo | 0);
    const range = w.range != null ? w.range : LASER_RANGE;
    const col = ownerShootColor(myId);
    startLocalLaserClip(
      Math.round(shots * perShotTicks * tickMs),
      range,
      col,
      true
    );
  }
  if (currentWeaponName() === 'railgun') {
    const w = effectiveLocalWeapon('railgun');
    localShoot.railChargeLeft = w.charge | 0;
    armRailCharge(myId, Math.round((w.charge | 0) * (1000 / TPS)));
  }
  return true;
}

/** Advance local ammo/cd like the server; muzzle FX only when a shot would fire. */
function updateLocalShooting() {
  const name = currentWeaponName();
  const w = effectiveLocalWeapon(name);
  if (localShoot.shootCd > 0) localShoot.shootCd--;

  if ((player.godLeft | 0) > 0) {
    if (localShoot.bursting || (localShoot.railChargeLeft | 0) > 0) {
      player.godLeft = 0;
    } else {
      if (localShoot.reloadLeft > 0) {
        localShoot.reloadLeft--;
        if (localShoot.reloadLeft === 0) {
          localShoot.shootAmmo = w.ammo;
          const me = localView();
          emitReloadReadyFx(me.x, me.y, me.angle);
          playSfx(SFX.ready, { vol: 0.85, pool: 2 });
          updateHud();
        }
      }
      return;
    }
  }

  if (localShoot.reloadLeft > 0) {
    localShoot.reloadLeft--;
    if (localShoot.reloadLeft === 0) {
      localShoot.shootAmmo = w.ammo;
      const me = localView();
      emitReloadReadyFx(me.x, me.y, me.angle);
      playSfx(SFX.ready, { vol: 0.85, pool: 2 });
      updateHud();
    }
    return;
  }
  if (!localShoot.bursting) return;

  if (name === 'railgun') {
    if ((localShoot.railChargeLeft | 0) <= 0) {
      localShoot.bursting = false;
      return;
    }
    localShoot.railChargeLeft--;
    if (localShoot.railChargeLeft > 0) return;
    // Charge complete — server fires the real ray; local chambers next + starts cd.
    localShoot.shootCd = w.cooldown;
    localShoot.bursting = false;
    localShoot.railChargeLeft = 0;
    localShoot.shootAmmo = w.ammo;
    localShoot.reloadLeft = 0;
    // Ring is armed on server `rf` so it lines up with the real shot (local charge
    // finishes a bit early because of input delay).
    return;
  }

  if (localShoot.shootCd > 0) return;
  emitLocalShootFx();
  localShoot.shootAmmo--;
  localShoot.shootCd = w.cooldown;
  if (localShoot.shootAmmo <= 0) {
    localShoot.bursting = false;
    let reload = w.reload;
    if (player.powerups && player.powerups.reload) reload = Math.max(1, Math.round(reload * 0.5));
    localShoot.reloadLeft = reload;
  }
}

// Laser visual: 100% local from ship. Duration = mag dump (ammo × cooldown ticks).
const LASER_CLIP_MS = Math.round(30 * 1 * (1000 / TPS)); // remotes fallback (= base laser ammo×cd)
const LASER_LINGER_MS = 750; // remotes only
const LASER_HIT_MS = Math.round(8 * (1000 / TPS));
const LASER_RANGE = Math.hypot(W, H);
/** Local laser beam end time (performance.now) — set once per burst. */
let localLaserUntil = 0;
/** Range/color locked at burst start from shoot-type stats. */
let localLaserClip = null;
/** Other players' beams: owner -> { len, until, wpn }. */
const remoteLasers = new Map();
/** Server hitscan debug traces (cl_hitscan). */
const hitLasers = [];
/** Railgun charge telegraph: owner -> until (performance.now). */
const railCharges = new Map();
/** Brief railgun fire beams. */
const railBeams = [];
/** Temporary thruster damage rays (ex-melee visuals). */
const thrustBeams = [];
/** Solid charge disc at ship tip while railgun loads. */
const RAIL_CHARGE_DISC_R = 10 * RES_SCALE;

function laserKeyHeld() {
  return !!(keys.Space || keys.Enter);
}

/** Arm local laser for exactly `ms` from now (one press → one clip). */
function startLocalLaserClip(ms, range, color, hum) {
  localLaserUntil = performance.now() + Math.max(0, ms | 0);
  localLaserClip = {
    range: range != null ? range : LASER_RANGE,
    color: color || COL.laser,
    hum: !!hum
  };
  syncLaserSfx(!!hum);
}

function armLocalLaser(extraMs) {
  // Legacy helper for remotes / fallbacks — does not extend an active local clip.
  const now = performance.now();
  const until = now + (extraMs != null ? extraMs : LASER_CLIP_MS);
  if (until > localLaserUntil) localLaserUntil = until;
}

function armRailCharge(ownerId, ms) {
  if (ownerId == null) return;
  const dur = Math.max(50, ms | 0);
  const now = performance.now();
  const prev = railCharges.get(ownerId);
  const alreadyCharging = prev && now < prev.until;
  railCharges.set(ownerId, { start: now, until: now + dur, ms: dur });
  if (alreadyCharging) return;
  const key = 'railCharge:' + ownerId;
  // Local Space may already be playing this held clip — don't restart.
  const a = sfxHolds.get(key);
  if (a && !a.paused && a.currentTime > 0.02) return;
  playSfxLoop(key, SFX.railCharge, { vol: ownerId === myId ? 0.75 : 0.45, loop: false });
}

/** Residue along the rail beam (~4 frames / 120ms). */
function emitRailBeamParticles(x0, y0, x1, y1, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  // ~25% denser along the beam than before.
  const steps = Math.min(100, Math.max(30, Math.round(len / (11.2 * RES_SCALE))));
  const ang = Math.atan2(dy, dx);
  const col = color || COL.railgun;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = x0 + dx * u;
    const y = y0 + dy * u;
    // Skip far off-screen spawns to save the particle pool.
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    emitParticles({
      x, y,
      count: 1,
      speed: 8 * RES_SCALE,
      speedSpread: 12 * RES_SCALE,
      direction: ang + Math.PI * 0.5,
      spread: Math.PI,
      size: 1.2 * RES_SCALE,
      sizeSpread: 0.8 * RES_SCALE,
      scaleY: 1.4,
      sizeWiggle: 0.35,
      sizeWiggleSpeed: 6,
      lifetime: 0.12,
      lifetimeSpread: 0.04,
      color: col,
      drag: 1.1
    });
  }
}

addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
    return;
  }
  if (e.code === 'F1') {
    e.preventDefault();
    toggleGridPanel();
    return;
  }
  if (e.code === 'Backquote') {
    e.preventDefault();
    toggleConsole();
    return;
  }
  if (consoleOpen) {
    if (e.code === 'Escape') {
      e.preventDefault();
      closeConsole();
    }
    return;
  }
  if (consoleAdmin && inGame && !e.repeat) {
    const m = /^Digit([1-8])$/.exec(e.code);
    if (m) {
      e.preventDefault();
      adminGiveWeaponBySlot(m[1] | 0);
      return;
    }
    if (e.code === 'KeyQ') {
      e.preventDefault();
      adminOpenShop();
      return;
    }
  }
  if (settingsPanelEl && settingsPanelEl.classList.contains('open')) {
    if (e.code === 'Escape') {
      e.preventDefault();
      closeSettingsPanel();
    }
    return;
  }
  if (gridPanelOpen) {
    if (e.code === 'Escape') {
      e.preventDefault();
      closeGridPanel();
    }
    return;
  }
  if (matchPaused || (pausePanelEl && pausePanelEl.classList.contains('open'))) {
    if (e.code === 'Escape') {
      e.preventDefault();
      return;
    }
    if (GAME_KEYS.has(e.code) || e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      return;
    }
  }
  keys[e.code] = true;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Space' && !spaceLatch) {
    spaceLatch = true;
    triggerShoot();
  }
  if (e.code === 'Enter' && !enterLatch) {
    enterLatch = true;
    triggerShoot();
  }
});
addEventListener('keyup', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
    return;
  }
  if (consoleOpen && e.code === 'Backquote') return;
  if (gridPanelOpen) return;
  keys[e.code] = false;
  if (e.code === 'Space') spaceLatch = false;
  if (e.code === 'Enter') enterLatch = false;
});

const player = {
  x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, hp: 100, av: 0,
  turnDecelStep: 0, turnDecelLeft: 0, turnDecelRev: 0, stunned: false, collideCd: 0, godLeft: 0,
  powerups: { damage: false, turret: false, shield: false }
};
const serverGhost = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, av: 0, hp: 100, valid: false };
/** performance.now() deadline — skip tight drift-snap so tab-resume can soft-blend. */
let resumeBlendUntil = 0;

const POWERUP_TYPES = ['damage', 'turret', 'shield', 'homing', 'lead', 'emp', 'reload'];
const PICKUP_CODE_POWERUP_BASE = 100;
function freshPowerups() {
  return {
    damage: false,
    turret: false,
    shield: false,
    homing: false,
    lead: false,
    emp: false,
    reload: false
  };
}
function powerupColor(name) {
  if (name === 'damage') return COL.powerDamage;
  if (name === 'turret') return COL.powerTurret;
  if (name === 'shield') return COL.powerShield;
  if (name === 'homing') return COL.powerHoming;
  if (name === 'lead') return COL.powerLead;
  if (name === 'emp') return COL.powerEmp;
  if (name === 'reload') return COL.powerReload;
  return COL.pickup;
}
function applyPowerupsState(id, powerups) {
  const pu = Object.assign(freshPowerups(), powerups || {});
  if (id === myId) player.powerups = pu;
  const r = remotes.get(id);
  if (r) r.powerups = pu;
}
function ownerHasDamagePowerup(ownerId) {
  if (ownerId === myId) return !!(player.powerups && player.powerups.damage);
  const r = remotes.get(ownerId);
  return !!(r && r.powerups && r.powerups.damage);
}
function ownerHasPowerup(ownerId, name) {
  if (ownerId === myId) return !!(player.powerups && player.powerups[name]);
  const r = remotes.get(ownerId);
  return !!(r && r.powerups && r.powerups[name]);
}
let _dmgHue = 0;
let _dmgHueAt = 0;
function damageRainbowColor() {
  const now = performance.now();
  if (now - _dmgHueAt >= 30) {
    _dmgHueAt = now;
    _dmgHue = Math.random();
  }
  return hsvMaxToRgb(_dmgHue);
}
function hsvMaxToRgb(h) {
  const i = (h * 6) | 0;
  const f = h * 6 - i;
  const q = 1 - f;
  const t = f;
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = 1; g = t; b = 0; break;
    case 1: r = q; g = 1; b = 0; break;
    case 2: r = 0; g = 1; b = t; break;
    case 3: r = 0; g = q; b = 1; break;
    case 4: r = t; g = 0; b = 1; break;
    default: r = 1; g = 0; b = q; break;
  }
  return [r, g, b];
}
const DAMAGE_RAINBOW_TYPES = new Set(['default', 'shotgun', 'plasma', 'laser', 'railgun', 'turret']);
function bulletDrawColor(type, ownerId) {
  if (ownerHasDamagePowerup(ownerId) && DAMAGE_RAINBOW_TYPES.has(type || 'default')) {
    return damageRainbowColor();
  }
  if (type === 'rocket') return COL.rocket;
  if (type === 'plasma') return COL.plasma;
  if (type === 'voidcannon') return COL.voidcannon;
  if (type === 'turret') return COL.powerTurret;
  return COL.bullet;
}
function drawShieldFx(x, y) {
  const col = COL.powerShield;
  const rad = 14 * RES_SCALE;
  const pulse = 1 + 0.06 * Math.sin(performance.now() * 0.008);
  drawThickLoop(circleVerts(x, y, rad * pulse, 36), col, 2 * RES_SCALE);
  drawThickLoop(circleVerts(x, y, rad * pulse * 0.72, 28), col, 1.2 * RES_SCALE);
}
/** Match server turret projectile speed for visual lead aim. */
const TURRET_VIS_SPEED = 8 * RES_SCALE;

/**
 * Angle the turret barrel should face (lead-aim like server fire).
 * Players first; solo also tracks AI ships then on-screen asteroids.
 */
function turretAimAngle(ownerId, x, y) {
  let bestD2 = Infinity;
  let bestPx = 0;
  let bestPy = 0;
  let bestVx = 0;
  let bestVy = 0;
  let found = false;
  const consider = (id, px, py, vx, vy) => {
    if (id === ownerId) return;
    const dx = px - x;
    const dy = py - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestPx = px;
      bestPy = py;
      bestVx = vx || 0;
      bestVy = vy || 0;
      found = true;
    }
  };
  if (myId != null && player.hp > 0) {
    const me = localView();
    consider(myId, me.x, me.y, me.vx, me.vy);
  }
  for (const r of remotes.values()) {
    if (r.hp <= 0) continue;
    const v = remoteView(r);
    consider(r.id, v.x, v.y, v.vx, v.vy);
  }
  // Solo / any AI field: prefer enemies, then nearest on-screen asteroid.
  if (!found && (practiceMode || enemies.size > 0)) {
    for (const e of enemies.values()) {
      if ((e.hp | 0) <= 0) continue;
      const p = enemyAt(e);
      consider(-(e.id | 0), p.x, p.y, p.vx, p.vy);
    }
    if (!found && practiceMode) {
      for (const a of asteroids.values()) {
        if (a.offscreen) continue;
        consider(-(100000 + (a.id | 0)), a.x, a.y, a.vx || 0, a.vy || 0);
      }
    }
  }
  if (!found) return null;
  const lead = leadInterceptPoint(x, y, bestPx, bestPy, bestVx, bestVy, TURRET_VIS_SPEED);
  return Math.atan2(lead.y - y, lead.x - x);
}

const turretYawSmooth = new Map();
function turretYawSmoothed(ownerId, targetAng, dt) {
  const key = ownerId != null ? ownerId : -1;
  let cur = turretYawSmooth.get(key);
  if (cur == null || !Number.isFinite(cur)) cur = targetAng;
  const k = 1 - Math.exp(-10 * Math.max(0.001, dt || 0.016));
  cur += shortestAngleDelta(cur, targetAng) * k;
  turretYawSmooth.set(key, cur);
  return cur;
}
/**
 * Low-poly turret cannon (unit space → half ship scale).
 * Base pedestal + breech + tapered barrel + muzzle ring — more cannon than disk gun.
 */
function buildTurretCannonMesh() {
  const s = 0.5 * SHIP_MESH_SCALE; // 2× smaller than ship mesh scale
  const n = 6;
  const verts = [];
  const pushRing = (x, r, z) => {
    const i0 = verts.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      verts.push([x, Math.cos(a) * r, z + Math.sin(a) * r * 0.55]);
    }
    return i0;
  };
  // Flat hexagonal mount (squashed in Z so it reads as a pad).
  const b0 = pushRing(0.02, 0.72, 0);
  const b1 = pushRing(0.02, 0.55, 0.22);
  // Swivel cup / breech (thicker, short).
  const c0 = pushRing(0.08, 0.38, 0.12);
  const c1 = pushRing(0.42, 0.34, 0.10);
  // Reinforcing band mid-barrel.
  const m0 = pushRing(0.78, 0.30, 0.08);
  const m1 = pushRing(0.92, 0.32, 0.09);
  // Tapered barrel → muzzle flare (cannon look).
  const t0 = pushRing(1.35, 0.22, 0.06);
  const t1 = pushRing(1.58, 0.26, 0.07); // flare lip
  const t2 = pushRing(1.72, 0.18, 0.05); // bore tip

  const faces = [];
  const stitch = (a, b, reverse) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = a + i, a1 = a + j, b0i = b + i, b1 = b + j;
      if (reverse) {
        faces.push([a0, b0i, a1], [a1, b0i, b1]);
      } else {
        faces.push([a0, a1, b0i], [a1, b1, b0i]);
      }
    }
  };
  // Cap base bottom (fan from ring).
  for (let i = 1; i < n - 1; i++) faces.push([b0, b0 + i, b0 + i + 1]);
  stitch(b0, b1, false);
  stitch(b1, c0, false);
  stitch(c0, c1, false);
  stitch(c1, m0, false);
  stitch(m0, m1, false);
  stitch(m1, t0, false);
  stitch(t0, t1, false);
  stitch(t1, t2, false);
  // Muzzle hole hint: inward cap (reverse winding).
  for (let i = 1; i < n - 1; i++) faces.push([t2, t2 + i + 1, t2 + i]);

  const edgeKey = new Set();
  const edges = [];
  const addEdge = (u, v) => {
    const a = u < v ? u : v;
    const b = u < v ? v : u;
    const k = a + ',' + b;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push([a, b]);
  };
  for (const f of faces) {
    addEdge(f[0], f[1]);
    addEdge(f[1], f[2]);
    addEdge(f[2], f[0]);
  }

  return {
    verts: verts.map((v) => [v[0] * s, v[1] * s, v[2] * s]),
    faces,
    edges
  };
}

const TURRET_CANNON_MESH = buildTurretCannonMesh();
/** Slight fixed bank so the barrel reads as 3D while yawing toward aim. */
const TURRET_CANNON_BANK = 0.42;

function drawTurret3D(x, y, aimAng, color) {
  const mesh = TURRET_CANNON_MESH;
  const yaw = aimAng != null ? aimAng : 0;
  const { xy, depth } = projectMesh3D(mesh.verts, x, y, yaw, TURRET_CANNON_BANK);
  const faces = mesh.faces;
  if (faces.length) {
    const order = faces.map((f, i) => {
      const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
      return { i, z };
    });
    order.sort((a, b) => a.z - b.z);
    for (const o of order) {
      const f = faces[o.i];
      drawFilledPoly([
        xy[f[0] * 2], xy[f[0] * 2 + 1],
        xy[f[1] * 2], xy[f[1] * 2 + 1],
        xy[f[2] * 2], xy[f[2] * 2 + 1]
      ], color, 0.32);
    }
  }
  const edgeW = 1.0 * RES_SCALE;
  for (const e of mesh.edges) {
    drawThickSegment(
      xy[e[0] * 2], xy[e[0] * 2 + 1],
      xy[e[1] * 2], xy[e[1] * 2 + 1],
      edgeW, color
    );
  }
}
function drawShipPowerupFx(x, y, ownerId, shipAngle, dt) {
  if (ownerHasPowerup(ownerId, 'shield')) drawShieldFx(x, y);
  if (ownerHasPowerup(ownerId, 'turret')) {
    const aim = turretAimAngle(ownerId, x, y);
    const target = aim != null ? aim : shipAngle;
    const yaw = turretYawSmoothed(ownerId, target, dt);
    drawTurret3D(x, y, yaw, COL.powerTurret);
  }
  if (ownerId === myId && ownerHasPowerup(ownerId, 'lead')) {
    drawLeadIndicator(x, y);
  }
}

/** Bullet speed (px/tick) for the weapon currently held — used by lead indicator. */
function currentWeaponBulletSpeed() {
  const n = currentWeaponName();
  const w = effectiveLocalWeapon(n);
  if (n === 'shotgun') {
    const sp = w.shotgunSpeeds || [4 * RES_SCALE, 9 * RES_SCALE];
    return (sp[0] + sp[1]) * 0.5;
  }
  if (w.speed != null && w.speed > 0) return w.speed;
  // Hitscan: treat as “instant” → aim at current enemy pose.
  return null;
}

function leadInterceptPoint(ox, oy, tx, ty, tvx, tvy, speed) {
  // Euclidean only — no torus shortcuts (matches server turrets / homing).
  const dx = tx - ox;
  const dy = ty - oy;
  if (speed == null || !(speed > 0)) {
    return { x: ox + dx, y: oy + dy };
  }
  const a = tvx * tvx + tvy * tvy - speed * speed;
  const b = 2 * (dx * tvx + dy * tvy);
  const c = dx * dx + dy * dy;
  let t = null;
  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) > 1e-8) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a);
      const t2 = (-b + s) / (2 * a);
      if (t1 > 0.05) t = t1;
      if (t2 > 0.05 && (t == null || t2 < t)) t = t2;
    }
  }
  if (t == null || !(t > 0)) return { x: ox + dx, y: oy + dy };
  return { x: ox + dx + tvx * t, y: oy + dy + tvy * t };
}

function drawLeadIndicator(ox, oy) {
  let best = null;
  let bestD2 = Infinity;
  for (const r of remotes.values()) {
    if (r.hp <= 0) continue;
    const v = remoteView(r);
    const dx = v.x - ox;
    const dy = v.y - oy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = v;
    }
  }
  if (!best) return;
  const spd = currentWeaponBulletSpeed();
  const p = leadInterceptPoint(ox, oy, best.x, best.y, best.vx || 0, best.vy || 0, spd);
  const col = COL.powerLead;
  const s = 5 * RES_SCALE;
  drawThickSegment(p.x - s, p.y, p.x + s, p.y, 1.5 * RES_SCALE, col);
  drawThickSegment(p.x, p.y - s, p.x, p.y + s, 1.5 * RES_SCALE, col);
  drawThickLoop(circleVerts(p.x, p.y, 3.5 * RES_SCALE, 16), col, 1.2 * RES_SCALE);
}

let myId = null;
let connected = false; // websocket to dedicated server (lobby)
let inGame = false;    // matched into a room
/** Client demo recorder / playback (`record` / `play` console cmds). */
let demoRec = null;
let demoPlay = null;
/** True between server `die` and `round` — freeze local ship, watch explosion. */
let deathSpectating = false;
let roomId = null;
let ws = null;
const remotes = new Map();
/** id -> kill score */
const scores = new Map();
const asteroids = new Map();
/** Solo-wave AI ships (practice only). */
const enemies = new Map();
/** Seeded coin field (visual fly-to-killer FX on asteroid death). */
const coins = new Map();
let localCoins = 0;
/** Lifetime coins collected this run (never decreases when spending). */
let localScore = 0;
/** Edge pad when spawning coin bursts (visual field). */
const COIN_SPAWN_PAD = 12;
/** Attracted coin snaps / despawns within this distance of the ship. */
const COIN_COLLECT_R = 18;
const COIN_COLLECT_R2 = COIN_COLLECT_R * COIN_COLLECT_R;
/** Homing after a short outward pop (px/s², px/s). */
const COIN_ATTRACT_ACCEL = 1100;
const COIN_ATTRACT_MAX_SPD = 720;
/** Outward spray before suck-in so 3D ore meshes are readable. */
const COIN_BURST_DELAY = 0.28;
/** Authoritative asteroid poses from server (`sv_send_asteroids` ghost dump). */
let asteroidGhosts = [];
const bullets = new Map();
const pickups = new Map();

function applyScores(rows) {
  scores.clear();
  if (!rows) return;
  for (const row of rows) {
    if (!row) continue;
    const id = row[0] | 0;
    scores.set(id, row[1] | 0);
    if (row[2]) rosterNames.set(id, String(row[2]));
  }
}

function applyNames(rows) {
  if (!rows) return;
  for (const row of rows) {
    if (!row) continue;
    rosterNames.set(row[0] | 0, String(row[1] || ''));
  }
}

function callsignFor(id) {
  if (id == null) return 'PILOT';
  return rosterNames.get(id) || ('P' + id);
}

function myCallsign() {
  return callsignFor(myId);
}

function foeCallsign() {
  for (const [id] of scores) {
    if (id !== myId) return callsignFor(id);
  }
  for (const [id] of rosterNames) {
    if (id !== myId) return callsignFor(id);
  }
  return 'FOE';
}

function setScoreToWin(n) {
  const v = n | 0;
  if (v > 0) scoreToWin = v;
}

function myScore() {
  return scores.get(myId) | 0;
}

function foeScore() {
  for (const [id, s] of scores) {
    if (id !== myId) return s | 0;
  }
  return 0;
}

const LUCK_LINES = [
  'GOOD LUCK',
  'FLY CLEAN',
  'NO MERCY',
  'MAKE IT COUNT',
  'LOCK IN',
  'BRING THE HEAT'
];

function clearOverlayTimers() {
  if (introHideTimer) {
    clearTimeout(introHideTimer);
    introHideTimer = 0;
  }
  if (scoreBoardHideTimer) {
    clearTimeout(scoreBoardHideTimer);
    scoreBoardHideTimer = 0;
  }
}

function hideMatchIntro(immediate, opts) {
  if (!matchIntroEl) return;
  const sendReady = !!(opts && opts.sendReady);
  if (introHideTimer) {
    clearTimeout(introHideTimer);
    introHideTimer = 0;
  }
  if (immediate) {
    matchIntroEl.classList.remove('show', 'hide-out');
    matchIntroEl.setAttribute('aria-hidden', 'true');
    if (sendReady) sendMatchReady();
    return;
  }
  matchIntroEl.classList.add('hide-out');
  introHideTimer = setTimeout(() => {
    matchIntroEl.classList.remove('show', 'hide-out');
    matchIntroEl.setAttribute('aria-hidden', 'true');
    introHideTimer = 0;
    if (sendReady) sendMatchReady();
  }, 380);
}

function showMatchIntro() {
  if (!matchIntroEl || practiceMode) return;
  hideScoreBoard(true);
  if (introMeEl) introMeEl.textContent = myCallsign();
  if (introFoeEl) introFoeEl.textContent = foeCallsign();
  if (introLuckEl) introLuckEl.textContent = LUCK_LINES[(Math.random() * LUCK_LINES.length) | 0];
  if (introSubEl) introSubEl.textContent = scoreToWin > 0 ? `FIRST TO ${scoreToWin}` : '1V1 MATCH';
  // Restart CSS animations
  matchIntroEl.classList.remove('show', 'hide-out');
  void matchIntroEl.offsetWidth;
  matchIntroEl.classList.add('show');
  matchIntroEl.setAttribute('aria-hidden', 'false');
  startArenaLightShow('match', [0.85, 0.95, 1.0]);
  if (introHideTimer) clearTimeout(introHideTimer);
  introHideTimer = setTimeout(() => hideMatchIntro(false, { sendReady: true }), 3400);
}

function sendMatchReady() {
  if (!inGame || practiceMode || matchLive || matchReadySent) return;
  if (!ws || ws.readyState !== 1) return;
  matchReadySent = true;
  try {
    ws.send(JSON.stringify({ t: 'ready' }));
  } catch (_) {}
  if (waitBannerEl) {
    waitBannerEl.classList.remove('hidden');
    waitBannerEl.textContent = 'Waiting for opponent...';
  }
}

function applyMatchGo(msg) {
  matchLive = true;
  matchReadySent = false;
  if (waitBannerEl && !practiceMode) {
    waitBannerEl.classList.add('hidden');
    waitBannerEl.textContent = 'Waiting for player...';
  }
  // Short confirm blink on go.
  startArenaLightShow('respawn', [1.0, 0.92, 0.55]);
  if (msg.tick != null && msg.st != null) {
    syncTick = msg.tick | 0;
    syncSt = msg.st;
    resetTickClock();
  }
  if (msg.asteroids) replaceAsteroidsFromRows(msg.asteroids);
  if (msg.scores) applyScores(msg.scores);
  if (msg.names) applyNames(msg.names);
  if (msg.players) {
    clearRemoteHist();
    applyRemotePlayers(msg.players, msg.st != null ? msg.st : serverNow());
  }
  updateHud();
}

function hideScoreBoard(immediate) {
  if (!scoreBoardEl) return;
  if (scoreBoardHideTimer) {
    clearTimeout(scoreBoardHideTimer);
    scoreBoardHideTimer = 0;
  }
  if (immediate) {
    stopBcastFx();
    scoreBoardEl.classList.remove('show', 'hide-out', 'final', 'epic-win');
    scoreBoardEl.setAttribute('aria-hidden', 'true');
    return;
  }
  scoreBoardEl.classList.add('hide-out');
  scoreBoardHideTimer = setTimeout(() => {
    stopBcastFx();
    scoreBoardEl.classList.remove('show', 'hide-out', 'final', 'epic-win');
    scoreBoardEl.setAttribute('aria-hidden', 'true');
    scoreBoardHideTimer = 0;
  }, 380);
}

function animateScoreNum(el, from, to, scored) {
  if (!el) return;
  el.classList.remove('bump', 'scored');
  el.textContent = String(from);
  void el.offsetWidth;
  const bump = () => {
    el.textContent = String(to);
    el.classList.add('bump');
    if (scored) el.classList.add('scored');
  };
  if (from === to) {
    el.textContent = String(to);
    return;
  }
  setTimeout(bump, 420);
}

function showScoreBoard(opts) {
  if (!scoreBoardEl || practiceMode) return;
  hideMatchIntro(true);
  if (scoreBoardHideTimer) {
    clearTimeout(scoreBoardHideTimer);
    scoreBoardHideTimer = 0;
  }
  const {
    oldMe = myScore(),
    oldFoe = foeScore(),
    newMe = myScore(),
    newFoe = foeScore(),
    iScored = false,
    final = false,
    won = false
  } = opts || {};

  if (sbMeNameEl) sbMeNameEl.textContent = myCallsign();
  if (sbFoeNameEl) sbFoeNameEl.textContent = foeCallsign();
  if (sbLimitEl) sbLimitEl.textContent = scoreToWin > 0 ? `FIRST TO ${scoreToWin}` : '';
  const sbMeSide = scoreBoardEl.querySelector('.sb-side.self');
  const sbFoeSide = scoreBoardEl.querySelector('.sb-side.foe');
  if (sbMeSide) sbMeSide.classList.remove('goal');
  if (sbFoeSide) sbFoeSide.classList.remove('goal');
  if (sbMeDeltaEl) {
    sbMeDeltaEl.classList.remove('show', 'neg');
    sbMeDeltaEl.textContent = '';
  }
  if (sbFoeDeltaEl) {
    sbFoeDeltaEl.classList.remove('show', 'neg');
    sbFoeDeltaEl.textContent = '';
  }

  if (final) {
    if (sbTagEl) {
      sbTagEl.textContent = 'FINAL';
      sbTagEl.className = 'bcast-tag' + (won ? ' goal' : ' foe-goal');
    }
    if (sbHeadlineEl) {
      sbHeadlineEl.textContent = won ? 'YOU WIN' : 'YOU LOSE';
      sbHeadlineEl.className = 'sb-headline ' + (won ? 'win' : 'lose');
    }
    if (sbFinalNoteEl) sbFinalNoteEl.textContent = won ? 'MATCH COMPLETE' : 'BETTER LUCK NEXT TIME';
    scoreBoardEl.classList.add('final');
    if (won && sbMeSide) sbMeSide.classList.add('goal');
    if (!won && sbFoeSide) sbFoeSide.classList.add('goal');
    if (sbMeScoreEl) {
      sbMeScoreEl.classList.remove('bump', 'scored');
      sbMeScoreEl.textContent = String(newMe);
      if (won) sbMeScoreEl.classList.add('scored');
    }
    if (sbFoeScoreEl) {
      sbFoeScoreEl.classList.remove('bump', 'scored');
      sbFoeScoreEl.textContent = String(newFoe);
      if (!won) sbFoeScoreEl.classList.add('scored');
    }
  } else {
    scoreBoardEl.classList.remove('final');
    const meGot = newMe > oldMe;
    const foeGot = newFoe > oldFoe;
    const anyoneScored = meGot || foeGot;
    if (sbTagEl) {
      if (!anyoneScored) {
        sbTagEl.textContent = 'NO POINT';
        sbTagEl.className = 'bcast-tag';
      } else {
        sbTagEl.textContent = iScored ? 'YOU SCORE' : 'THEY SCORE';
        sbTagEl.className = 'bcast-tag' + (iScored ? ' goal' : ' foe-goal');
      }
    }
    if (sbHeadlineEl) {
      if (!anyoneScored) {
        sbHeadlineEl.textContent = 'NO FRAG';
        sbHeadlineEl.className = 'sb-headline score';
      } else {
        sbHeadlineEl.textContent = 'POINT FOR: ' + (iScored ? myCallsign() : foeCallsign());
        sbHeadlineEl.className = 'sb-headline score';
      }
    }
    if (sbFinalNoteEl) sbFinalNoteEl.textContent = '';
    if (meGot && sbMeSide) sbMeSide.classList.add('goal');
    if (foeGot && sbFoeSide) sbFoeSide.classList.add('goal');
    animateScoreNum(sbMeScoreEl, oldMe, newMe, meGot);
    animateScoreNum(sbFoeScoreEl, oldFoe, newFoe, foeGot);
    if (meGot && sbMeDeltaEl) {
      sbMeDeltaEl.textContent = `+${newMe - oldMe}`;
      sbMeDeltaEl.classList.add('show');
    }
    if (foeGot && sbFoeDeltaEl) {
      sbFoeDeltaEl.textContent = `+${newFoe - oldFoe}`;
      sbFoeDeltaEl.classList.add('show');
    }
  }

  scoreBoardEl.classList.remove('show', 'hide-out');
  void scoreBoardEl.offsetWidth;
  scoreBoardEl.classList.add('show');
  scoreBoardEl.setAttribute('aria-hidden', 'false');
  playSfx(SFX.scored, { vol: 0.9, pool: 2 });

  if (final) {
    startBcastFx(won ? 'win' : 'lose');
  } else if (newMe > oldMe || newFoe > oldFoe) {
    startBcastFx('score', iScored ? '#6ec8ff' : '#ff5a6e');
  }
}

function drawPickup(u) {
  // Health never blinks / expires; everything else pulses alpha 1 ↔ 0.7 (never vanishes).
  const blinkA = pickupBlinkAlpha(u);
  if (u.kind === 'powerup') {
    const p = pickupAt(u);
    drawPowerupPickup(u, p.x, p.y, p.angle, null, blinkA);
    return;
  }
  const p = pickupAt(u);
  drawPickupBox3D(p.x, p.y, p.angle, pickupFrameIndex(u), u.id, blinkA);
}

/** After bounce N: blink at 1 / 2 / 4 Hz between alpha 1 and 0.7. */
function pickupBlinkAlpha(u) {
  if (u.kind === 'health') return 1;
  const b = u.bounces | 0;
  if (b < 1) return 1;
  const hz = b === 1 ? 1 : b === 2 ? 2 : 4;
  return ((performance.now() * 0.001 * hz) % 1) < 0.5 ? 1 : 0.7;
}

const menuEl = document.getElementById('menu');
const playBtn = document.getElementById('play-btn');
const cancelBtn = document.getElementById('cancel-btn');
const rejoinBtn = document.getElementById('rejoin-btn');
const pausePanelEl = document.getElementById('pause-panel');
const pauseTitleEl = document.getElementById('pause-title');
const pauseMetaEl = document.getElementById('pause-meta');
const pauseCdEl = document.getElementById('pause-cd');
const pauseReadyBtn = document.getElementById('pause-ready-btn');
const pauseLeaveBtn = document.getElementById('pause-leave-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanelEl = document.getElementById('settings-panel');
const settingsResEl = document.getElementById('settings-resolution');
const settingsDynLightEl = document.getElementById('settings-dyn-light');
const settingsBakeQualityEl = document.getElementById('settings-bake-quality');
const accountBtn = document.getElementById('account-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardPanelEl = document.getElementById('leaderboard-panel');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const lbBodyEl = document.getElementById('lb-body');
const lbMetaEl = document.getElementById('lb-meta');
const lbPageEl = document.getElementById('lb-page');
const lbPrevBtn = document.getElementById('lb-prev-btn');
const lbNextBtn = document.getElementById('lb-next-btn');
const lbHistBodyEl = document.getElementById('lb-hist-body');
const lbHistMetaEl = document.getElementById('lb-hist-meta');
const lbHistPageEl = document.getElementById('lb-hist-page');
const lbHistPrevBtn = document.getElementById('lb-hist-prev-btn');
const lbHistNextBtn = document.getElementById('lb-hist-next-btn');
const lbTabRanksBtn = document.getElementById('lb-tab-ranks');
const lbTabHistoryBtn = document.getElementById('lb-tab-history');
const lbPaneRanksEl = document.getElementById('lb-pane-ranks');
const lbPaneHistoryEl = document.getElementById('lb-pane-history');
const LB_PAGE_SIZE = 25;
let lbRows = [];
let lbHistRows = [];
let lbOnlineSet = new Set();
let lbFriendsSet = new Set();
let lbFriendsOnly = false;
let lbSelectedName = null;
let lbSortKey = 'wins';
let lbSortDir = -1; // -1 desc, 1 asc
let lbPage = 0;
let lbHistPage = 0;
let lbTab = 'ranks'; // 'ranks' | 'history'
const lbFriendsOnlyEl = document.getElementById('lb-friends-only');
const lbActionsEl = document.getElementById('lb-actions');
const lbSelNameEl = document.getElementById('lb-sel-name');
const lbAddFriendBtn = document.getElementById('lb-add-friend');
const lbInviteTeamBtn = document.getElementById('lb-invite-team');
const teamBoxEl = document.getElementById('team-box');
const teamMembersEl = document.getElementById('team-members');
const teamLeaveBtn = document.getElementById('team-leave-btn');
const teamInviteModalEl = document.getElementById('team-invite-modal');
const teamInviteTextEl = document.getElementById('team-invite-text');
const teamInviteAcceptBtn = document.getElementById('team-invite-accept');
const teamInviteDeclineBtn = document.getElementById('team-invite-decline');
let teamMembers = [];
let pendingTeamInviteFrom = null;
const accountPanelEl = document.getElementById('account-panel');
const accountNameEl = document.getElementById('account-name');
const accountChangeBtn = document.getElementById('account-change-btn');
const accountRegisterBtn = document.getElementById('account-register-btn');
const accountLoginBtn = document.getElementById('account-login-btn');
const accountCloseBtn = document.getElementById('account-close-btn');
const accountStatusEl = document.getElementById('account-status');
const accountWinsEl = document.getElementById('account-wins');
const accountMsgEl = document.getElementById('account-msg');
const accountPlayerColorEl = document.getElementById('account-player-color');
const accountShootColorEl = document.getElementById('account-shoot-color');
const accountPlayerColorHexEl = document.getElementById('account-player-color-hex');
const accountShootColorHexEl = document.getElementById('account-shoot-color-hex');
const accountColorsBtn = document.getElementById('account-colors-btn');
const pinModalEl = document.getElementById('pin-modal');
const pinModalTitleEl = document.getElementById('pin-modal-title');
const pinModalHintEl = document.getElementById('pin-modal-hint');
const pinInputEl = document.getElementById('pin-input');
const pinConfirmWrapEl = document.getElementById('pin-confirm-wrap');
const pinConfirmInputEl = document.getElementById('pin-confirm-input');
const pinModalMsgEl = document.getElementById('pin-modal-msg');
const pinModalSubmitBtn = document.getElementById('pin-modal-submit-btn');
const pinModalCloseBtn = document.getElementById('pin-modal-close-btn');

let accountSession = {
  name: '', registered: false, matchesWon: 0, bestWaves: 0, bestWavesDuo: 0,
  hasSnapshot: false,
  playerColor: DEFAULT_PLAYER_COLOR_HEX,
  shootColor: DEFAULT_SHOOT_COLOR_HEX,
  friends: []
};
let pinModalMode = 'register';
let soloSnapshot = null;
let selectedPlayMode = null;
let coopMode = false;
let soloOnlyMode = false;

const modePanelEl = document.getElementById('mode-panel');
const modeCloseBtn = document.getElementById('mode-close-btn');
const modePvpBtn = document.getElementById('mode-pvp-btn');
const modeCoopBtn = document.getElementById('mode-coop-btn');
const modeSoloBtn = document.getElementById('mode-solo-btn');
const modeContinueBtn = document.getElementById('mode-continue-btn');
const modeOnlineEl = document.getElementById('mode-online');
const modePvpMetaEl = document.getElementById('mode-pvp-meta');
const modeCoopMetaEl = document.getElementById('mode-coop-meta');
const waitBannerEl = document.getElementById('wait-banner');
const soloOverEl = document.getElementById('solo-over');
const soloOverWaveEl = document.getElementById('solo-over-wave');
const soloOverScoreEl = document.getElementById('solo-over-score');
const soloRestartBtn = document.getElementById('solo-restart-btn');
const soloMenuBtn = document.getElementById('solo-menu-btn');
let practiceMode = false;
let soloOverOpen = false;
let soloShopOpen = false;
let soloShopState = null;
const soloShopEl = document.getElementById('solo-shop');
const ssWaveEl = document.getElementById('ss-wave');
const ssCoinsEl = document.getElementById('ss-coins');
const ssScoreEl = document.getElementById('ss-score');
const ssLivesEl = document.getElementById('ss-lives');
const ssVitalEl = document.getElementById('ss-vital');
const ssEquippedEl = document.getElementById('ss-equipped');
const ssOwnedPowerupsEl = document.getElementById('ss-owned-powerups');
const ssWeaponsEl = document.getElementById('ss-weapons');
const ssPowerupsEl = document.getElementById('ss-powerups');
const ssContinueBtn = document.getElementById('ss-continue-btn');

function shopItemLabel(name) {
  if (!name) return '';
  if (name === 'voidcannon') return 'Void Cannon';
  if (name === 'asteroidgun') return 'Meteor Gun';
  return String(name).replace(/_/g, ' ');
}

/** Price label for shop buttons (UI only — credits). */
function shopCreditPrice(n) {
  return (n | 0) + ' cr';
}

function shopWeaponCostClient(unlocked, levels, name, current) {
  if (!unlocked || !unlocked[name] || current !== name) return 800;
  const lvl = Math.max(1, (levels && levels[name]) | 0 || 1);
  if (lvl >= WEAPON_MAX_LEVEL) return -1;
  return 800 + 200 * (lvl + 1);
}

function applyShopState(st) {
  if (!st) return;
  const keepWave = soloShopState ? (soloShopState.wave | 0) : 0;
  const blankUnlock = {
    default: false, rocket: false, laser: false, shotgun: false,
    railgun: false, plasma: false, voidcannon: false, asteroidgun: false
  };
  const unlocked = Object.assign({}, blankUnlock, st.unlocked || {});
  const cur = (st.weapon || currentWeaponName() || 'default');
  for (const k of Object.keys(unlocked)) unlocked[k] = k === cur;
  unlocked[cur] = true;
  soloShopState = {
    wave: st.wave != null ? (st.wave | 0) : keepWave,
    coins: st.coins | 0,
    score: st.score != null ? (st.score | 0) : localScore,
    lives: st.lives | 0,
    weapon: cur,
    levels: Object.assign({ default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 }, st.levels || {}),
    unlocked,
    powerups: Object.assign(freshPowerups(), st.powerups || {})
  };
  setLocalCoins(soloShopState.coins);
  if (st.score != null) setLocalScore(st.score);
  setSoloLives(soloShopState.lives);
  weaponLevels = Object.assign({}, soloShopState.levels);
  unlockedWeapons = Object.assign({}, blankUnlock, unlocked);
  player.powerups = Object.assign(freshPowerups(), soloShopState.powerups);
  renderSoloShop();
}

function renderSoloShop() {
  const st = soloShopState;
  if (!st) return;
  if (ssWaveEl) ssWaveEl.textContent = String(st.wave);
  if (ssCoinsEl) ssCoinsEl.textContent = String(st.coins);
  if (ssScoreEl) ssScoreEl.textContent = String(st.score != null ? st.score : localScore);
  if (ssLivesEl) ssLivesEl.textContent = String(st.lives);

  const cur = st.weapon || currentWeaponName() || 'default';
  const curLvl = Math.max(1, (st.levels[cur] | 0) || 1);
  const upgradeCost = shopWeaponCostClient(st.unlocked, st.levels, cur, cur);

  if (ssEquippedEl) {
    ssEquippedEl.innerHTML = '';
    const info = document.createElement('div');
    info.className = 'ss-equipped-info';
    info.innerHTML = '<div class="ss-equipped-label">LOADOUT</div>'
      + '<div class="ss-equipped-name">' + shopItemLabel(cur) + '</div>'
      + '<div class="ss-equipped-lvl">LV ' + curLvl
      + (curLvl >= WEAPON_MAX_LEVEL ? ' · MAX' : '') + '</div>';
    ssEquippedEl.appendChild(info);
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    if (upgradeCost < 0) {
      upBtn.textContent = 'MAX';
      upBtn.disabled = true;
    } else {
      upBtn.textContent = 'UP ' + shopCreditPrice(upgradeCost);
      upBtn.disabled = st.coins < upgradeCost;
      upBtn.addEventListener('click', () => sendShopBuy('weapon', cur));
    }
    ssEquippedEl.appendChild(upBtn);
  }

  if (ssOwnedPowerupsEl) {
    ssOwnedPowerupsEl.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'ss-owned-pu-label';
    label.textContent = 'PACK';
    ssOwnedPowerupsEl.appendChild(label);
    let any = false;
    for (let i = 0; i < POWERUP_TYPES.length; i++) {
      const name = POWERUP_TYPES[i];
      if (!(st.powerups && st.powerups[name])) continue;
      any = true;
      const chip = document.createElement('span');
      chip.className = 'ss-owned-chip';
      chip.textContent = shopItemLabel(name);
      ssOwnedPowerupsEl.appendChild(chip);
    }
    if (!any) {
      const empty = document.createElement('span');
      empty.className = 'ss-owned-empty';
      empty.textContent = 'EMPTY';
      ssOwnedPowerupsEl.appendChild(empty);
    }
  }

  if (ssWeaponsEl) {
    ssWeaponsEl.innerHTML = '';
    for (let i = 0; i < WEAPON_NAMES.length; i++) {
      const name = WEAPON_NAMES[i];
      // Equipped gun is upgraded from the loadout row — keep catalog anonymous.
      if (name === cur) continue;
      const cost = 800;
      const row = document.createElement('div');
      row.className = 'ss-row';
      const left = document.createElement('div');
      left.innerHTML = '<div class="ss-name">' + shopItemLabel(name) + '</div>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = shopCreditPrice(cost);
      btn.disabled = st.coins < cost;
      btn.addEventListener('click', () => sendShopBuy('weapon', name));
      row.appendChild(left);
      row.appendChild(btn);
      ssWeaponsEl.appendChild(row);
    }
  }

  if (ssPowerupsEl) {
    ssPowerupsEl.innerHTML = '';
    for (let i = 0; i < POWERUP_TYPES.length; i++) {
      const name = POWERUP_TYPES[i];
      const owned = !!(st.powerups && st.powerups[name]);
      const row = document.createElement('div');
      row.className = 'ss-row' + (owned ? ' ss-owned' : '');
      const left = document.createElement('div');
      left.innerHTML = '<div class="ss-name">' + shopItemLabel(name) + '</div>';
      const btn = document.createElement('button');
      btn.type = 'button';
      if (owned) {
        btn.textContent = 'GOT IT';
        btn.disabled = true;
      } else {
        btn.textContent = shopCreditPrice(1000);
        btn.disabled = st.coins < 1000;
        btn.addEventListener('click', () => sendShopBuy('powerup', name));
      }
      row.appendChild(left);
      row.appendChild(btn);
      ssPowerupsEl.appendChild(row);
    }
  }

  if (ssVitalEl) {
    ssVitalEl.innerHTML = '';

    const hpRow = document.createElement('div');
    hpRow.className = 'ss-row';
    const hpLeft = document.createElement('div');
    const fullHp = (player.hp | 0) >= MAX_HP;
    hpLeft.innerHTML = '<div class="ss-name">FULL HP</div>';
    const hpBtn = document.createElement('button');
    hpBtn.type = 'button';
    if (fullHp) {
      hpBtn.textContent = 'MAX HP';
      hpBtn.disabled = true;
      hpRow.classList.add('ss-owned');
    } else {
      hpBtn.textContent = shopCreditPrice(400);
      hpBtn.disabled = st.coins < 400;
      hpBtn.addEventListener('click', () => sendShopBuy('health', ''));
    }
    hpRow.appendChild(hpLeft);
    hpRow.appendChild(hpBtn);
    ssVitalEl.appendChild(hpRow);

    const lifeRow = document.createElement('div');
    lifeRow.className = 'ss-row';
    const lifeLeft = document.createElement('div');
    lifeLeft.innerHTML = '<div class="ss-name">+1 LIFE</div>';
    const lifeBtn = document.createElement('button');
    lifeBtn.type = 'button';
    lifeBtn.textContent = shopCreditPrice(2400);
    lifeBtn.disabled = st.coins < 2400;
    lifeBtn.addEventListener('click', () => sendShopBuy('life', ''));
    lifeRow.appendChild(lifeLeft);
    lifeRow.appendChild(lifeBtn);
    ssVitalEl.appendChild(lifeRow);
  }
}

function sendShopBuy(item, name) {
  if (!ws || ws.readyState !== 1 || !soloShopOpen) return;
  ws.send(JSON.stringify({ t: 'shopBuy', item, name }));
}

function showSoloShop(st) {
  soloShopOpen = true;
  player.vx = 0;
  player.vy = 0;
  player.av = 0;
  applyShopState(st);
  if (ssContinueBtn) {
    ssContinueBtn.textContent = 'START WAVE';
    ssContinueBtn.disabled = false;
  }
  if (soloShopEl) {
    soloShopEl.classList.add('show');
    soloShopEl.setAttribute('aria-hidden', 'false');
  }
}

function hideSoloShop() {
  soloShopOpen = false;
  soloShopState = null;
  if (ssContinueBtn) {
    ssContinueBtn.textContent = 'START WAVE';
    ssContinueBtn.disabled = false;
  }
  if (soloShopEl) {
    soloShopEl.classList.remove('show');
    soloShopEl.setAttribute('aria-hidden', 'true');
  }
}

function closeSoloShopContinue() {
  if (!soloShopOpen) return;
  if (ssContinueBtn && ssContinueBtn.disabled) return;
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'shopDone' }));
  // Stay open until server starts the wave (all living players must continue first).
  if (ssContinueBtn) {
    ssContinueBtn.textContent = coopMode ? 'WAIT P2…' : 'WAIT…';
    ssContinueBtn.disabled = true;
  }
}

if (ssContinueBtn) {
  ssContinueBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeSoloShopContinue();
  });
}

function showSoloOverScreen(wave, score) {
  soloOverOpen = true;
  if (soloOverWaveEl) soloOverWaveEl.textContent = 'Reached wave ' + Math.max(1, wave | 0);
  if (soloOverScoreEl) {
    const s = score != null ? (score | 0) : localScore;
    soloOverScoreEl.textContent = 'Score ' + s;
  }
  if (soloOverEl) {
    soloOverEl.classList.add('show');
    soloOverEl.setAttribute('aria-hidden', 'false');
  }
  if (menuEl) menuEl.classList.add('hidden');
  if (cancelBtn) cancelBtn.classList.add('visible');
  if (waitBannerEl) {
    waitBannerEl.classList.remove('hidden');
    waitBannerEl.style.top = '';
    waitBannerEl.style.bottom = '';
    waitBannerEl.textContent = 'Still matchmaking…';
  }
}

function hideSoloOverScreen() {
  soloOverOpen = false;
  if (soloOverEl) {
    soloOverEl.classList.remove('show');
    soloOverEl.setAttribute('aria-hidden', 'true');
  }
}

function openSettingsPanel() {
  if (!settingsPanelEl) return;
  closeAccountPanel();
  closePinModal();
  closeModePanel();
  closeLeaderboardPanel();
  settingsPanelEl.classList.add('open');
  settingsPanelEl.setAttribute('aria-hidden', 'false');
  syncSettingsResolutionUi();
  syncLightingUi();
  syncSettingsBakeQualityUi();
}

function closeSettingsPanel() {
  if (!settingsPanelEl) return;
  settingsPanelEl.classList.remove('open');
  settingsPanelEl.setAttribute('aria-hidden', 'true');
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openSettingsPanel();
  });
}
const settingsCloseBtn = document.getElementById('settings-close-btn');
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeSettingsPanel();
  });
}
if (settingsPanelEl) {
  settingsPanelEl.addEventListener('click', (e) => {
    if (e.target === settingsPanelEl) closeSettingsPanel();
  });
}
if (settingsResEl) {
  settingsResEl.addEventListener('change', () => {
    const v = settingsResEl.value | 0;
    applyRenderResolution(v === 0 ? 'auto' : v);
    fitCanvasIntegerScale();
  });
}
if (settingsDynLightEl) {
  settingsDynLightEl.checked = !!dynGridLightEnabled;
  settingsDynLightEl.addEventListener('change', () => {
    setDynGridLightEnabled(!!settingsDynLightEl.checked);
  });
}
if (settingsBakeQualityEl) {
  syncSettingsBakeQualityUi();
  settingsBakeQualityEl.addEventListener('change', () => {
    setCvar('cl_background_bake_quality', settingsBakeQualityEl.value);
  });
}
(function bindF1LightingChecks() {
  const gpDyn = document.getElementById('gp-dyn-light');
  const gpNight = document.getElementById('gp-night-mode');
  if (gpDyn) {
    gpDyn.checked = !!dynGridLightEnabled;
    gpDyn.addEventListener('change', () => setDynGridLightEnabled(!!gpDyn.checked));
  }
  if (gpNight) {
    gpNight.checked = !!nightModeLightEnabled;
    gpNight.addEventListener('change', () => setNightModeLightEnabled(!!gpNight.checked));
  }
})();
syncSettingsResolutionUi();
syncLightingUi();
syncSettingsBakeQualityUi();

function accountErrText(err) {
  switch (String(err || '')) {
    case 'name': return 'Invalid callsign.';
    case 'color': return 'Invalid color.';
    case 'taken': return 'That callsign is taken.';
    case 'pin': return 'PIN must be exactly 4 digits.';
    case 'mismatch': return 'PINs do not match.';
    case 'missing': return 'No account with that name.';
    case 'already': return 'Already registered this session.';
    case 'fail': return 'Could not create account.';
    default: return err ? String(err) : 'Request failed.';
  }
}

function setAccountMsg(text, ok) {
  if (!accountMsgEl) return;
  accountMsgEl.textContent = text || '';
  accountMsgEl.classList.toggle('ok', !!ok);
}

function setPinModalMsg(text, ok) {
  if (!pinModalMsgEl) return;
  pinModalMsgEl.textContent = text || '';
  pinModalMsgEl.classList.toggle('ok', !!ok);
}

function syncAccountColorInputs() {
  const pc = myPlayerColorHex || DEFAULT_PLAYER_COLOR_HEX;
  const sc = myShootColorHex || DEFAULT_SHOOT_COLOR_HEX;
  if (accountPlayerColorEl) accountPlayerColorEl.value = pc.toLowerCase();
  if (accountShootColorEl) accountShootColorEl.value = sc.toLowerCase();
  if (accountPlayerColorHexEl) accountPlayerColorHexEl.textContent = pc;
  if (accountShootColorHexEl) accountShootColorHexEl.textContent = sc;
}

function applyAccountSession(msg) {
  if (!msg) return;
  const friends = Array.isArray(msg.friends) ? msg.friends.map(String) : (accountSession.friends || []);
  accountSession = {
    name: msg.name != null ? String(msg.name) : accountSession.name,
    registered: !!msg.registered,
    matchesWon: msg.matchesWon | 0,
    bestWaves: msg.bestWaves | 0,
    bestWavesDuo: msg.bestWavesDuo | 0,
    hasSnapshot: !!(msg.hasSnapshot || soloSnapshot),
    playerColor: normalizeColorHex(msg.playerColor) || accountSession.playerColor || DEFAULT_PLAYER_COLOR_HEX,
    shootColor: normalizeColorHex(msg.shootColor) || accountSession.shootColor || DEFAULT_SHOOT_COLOR_HEX,
    friends
  };
  lbFriendsSet = new Set(friends);
  setMyColors(accountSession.playerColor, accountSession.shootColor);
  syncAccountColorInputs();
  if (accountNameEl && document.activeElement !== accountNameEl) {
    accountNameEl.value = accountSession.name || '';
  }
  if (accountStatusEl) accountStatusEl.textContent = accountSession.registered ? 'Registered' : 'Guest';
  if (accountWinsEl) {
    accountWinsEl.textContent =
      (accountSession.matchesWon | 0) + ' wins · best ' +
      (accountSession.bestWaves | 0) + ' / duo ' +
      (accountSession.bestWavesDuo | 0);
  }
  if (accountRegisterBtn) accountRegisterBtn.style.display = accountSession.registered ? 'none' : '';
  if (accountLoginBtn) accountLoginBtn.style.display = accountSession.registered ? 'none' : '';
  try {
    if (accountSession.registered && accountSession.name) {
      localStorage.setItem('asteroids_account_name', accountSession.name);
    }
  } catch (_) {}
  syncModeContinueUi();
  if (leaderboardPanelEl && leaderboardPanelEl.classList.contains('open')) {
    syncLbActions();
    renderLeaderboard();
  }
}

function loadSoloSnapshot() {
  try {
    const raw = localStorage.getItem('asteroids_solo_snap');
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== 1) return null;
    return snap;
  } catch (_) {
    return null;
  }
}

function saveSoloSnapshot(snap) {
  soloSnapshot = snap || null;
  try {
    if (snap) localStorage.setItem('asteroids_solo_snap', JSON.stringify(snap));
    else localStorage.removeItem('asteroids_solo_snap');
  } catch (_) {}
  syncModeContinueUi();
}

function syncModeContinueUi() {
  const snap = soloSnapshot || loadSoloSnapshot();
  if (snap && !soloSnapshot) soloSnapshot = snap;
  const ok = !!soloSnapshot;
  if (modeContinueBtn) modeContinueBtn.disabled = !ok;
}

function applyPresence(msg) {
  if (!msg) return;
  const online = msg.online | 0;
  const pvpIn = (msg.pvp && msg.pvp.ingame) | 0;
  const pvpQ = (msg.pvp && msg.pvp.queue) | 0;
  const coopIn = (msg.coop && msg.coop.ingame) | 0;
  const coopQ = (msg.coop && msg.coop.queue) | 0;
  if (modeOnlineEl) modeOnlineEl.textContent = 'Players online: ' + online;
  if (modePvpMetaEl) modePvpMetaEl.textContent = 'ingame: ' + pvpIn + ' · in queue: ' + pvpQ;
  if (modeCoopMetaEl) modeCoopMetaEl.textContent = 'ingame: ' + coopIn + ' · in queue: ' + coopQ;
  if (Array.isArray(msg.onlineNames)) {
    lbOnlineSet = new Set(msg.onlineNames.map(String));
    if (leaderboardPanelEl && leaderboardPanelEl.classList.contains('open')) {
      syncLbActions();
      renderLeaderboard();
    }
  }
}

function requestPresence() {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify({ t: 'presence' })); } catch (_) {}
}

function applyTeamState(msg) {
  teamMembers = Array.isArray(msg && msg.members) ? msg.members.map(String) : [];
  if (teamBoxEl) {
    if (teamMembers.length >= 2) {
      teamBoxEl.classList.remove('hidden');
      if (teamMembersEl) teamMembersEl.textContent = teamMembers.join(' · ');
    } else {
      teamBoxEl.classList.add('hidden');
      if (teamMembersEl) teamMembersEl.textContent = '';
    }
  }
  if (leaderboardPanelEl && leaderboardPanelEl.classList.contains('open')) syncLbActions();
}

function openTeamInviteModal(from) {
  pendingTeamInviteFrom = from;
  if (teamInviteTextEl) teamInviteTextEl.textContent = from + ' invited you to a team.';
  if (teamInviteModalEl) {
    teamInviteModalEl.classList.add('open');
    teamInviteModalEl.setAttribute('aria-hidden', 'false');
  }
}

function closeTeamInviteModal() {
  pendingTeamInviteFrom = null;
  if (teamInviteModalEl) {
    teamInviteModalEl.classList.remove('open');
    teamInviteModalEl.setAttribute('aria-hidden', 'true');
  }
}

function openModePanel() {
  if (!modePanelEl) return;
  closeSettingsPanel();
  closeAccountPanel();
  closePinModal();
  closeLeaderboardPanel();
  syncModeContinueUi();
  requestPresence();
  modePanelEl.classList.add('open');
  modePanelEl.setAttribute('aria-hidden', 'false');
}

function closeModePanel() {
  if (!modePanelEl) return;
  modePanelEl.classList.remove('open');
  modePanelEl.setAttribute('aria-hidden', 'true');
}

function startPlayMode(mode) {
  if (!connected || !ws || ws.readyState !== 1) return;
  closeModePanel();
  selectedPlayMode = mode;
  const name = accountSession.name || '';
  if (mode === 'continue') {
    const snap = soloSnapshot || loadSoloSnapshot();
    if (!snap) return;
    ws.send(JSON.stringify({ t: 'queue', mode: 'continue', name, snap }));
  } else {
    ws.send(JSON.stringify({ t: 'queue', mode, name }));
  }
  showQueue();
}

function openAccountPanel() {
  if (!accountPanelEl) return;
  closeSettingsPanel();
  closePinModal();
  closeModePanel();
  closeLeaderboardPanel();
  setAccountMsg('');
  if (accountNameEl) accountNameEl.value = accountSession.name || '';
  accountPanelEl.classList.add('open');
  accountPanelEl.setAttribute('aria-hidden', 'false');
}

function closeAccountPanel() {
  if (!accountPanelEl) return;
  accountPanelEl.classList.remove('open');
  accountPanelEl.setAttribute('aria-hidden', 'true');
}

function digitsOnlyPin(el) {
  if (!el) return;
  el.value = String(el.value || '').replace(/\D/g, '').slice(0, 4);
}

function openPinModal(mode) {
  pinModalMode = mode === 'login' ? 'login' : 'register';
  if (!pinModalEl) return;
  setPinModalMsg('');
  if (pinInputEl) pinInputEl.value = '';
  if (pinConfirmInputEl) pinConfirmInputEl.value = '';
  if (pinConfirmWrapEl) pinConfirmWrapEl.style.display = pinModalMode === 'register' ? '' : 'none';
  if (pinModalTitleEl) pinModalTitleEl.textContent = pinModalMode === 'login' ? 'Login PIN' : 'Register PIN';
  if (pinModalHintEl) {
    pinModalHintEl.textContent = pinModalMode === 'login'
      ? 'Enter the 4-digit PIN for this callsign.'
      : 'Choose a 4-digit PIN and confirm it.';
  }
  if (pinModalSubmitBtn) pinModalSubmitBtn.textContent = pinModalMode === 'login' ? 'Login' : 'Create account';
  pinModalEl.classList.add('open');
  pinModalEl.setAttribute('aria-hidden', 'false');
  if (pinInputEl) pinInputEl.focus();
}

function closePinModal() {
  if (!pinModalEl) return;
  pinModalEl.classList.remove('open');
  pinModalEl.setAttribute('aria-hidden', 'true');
}

function sendAccountNameChange() {
  if (!ws || ws.readyState !== 1) return;
  const name = accountNameEl ? String(accountNameEl.value || '').trim() : '';
  setAccountMsg('');
  ws.send(JSON.stringify({ t: 'setName', name }));
}

function sendAccountColors() {
  if (!ws || ws.readyState !== 1) return;
  const playerColor = accountPlayerColorEl ? accountPlayerColorEl.value : myPlayerColorHex;
  const shootColor = accountShootColorEl ? accountShootColorEl.value : myShootColorHex;
  setAccountMsg('');
  ws.send(JSON.stringify({ t: 'setColors', playerColor, shootColor }));
}

function submitPinModal() {
  if (!ws || ws.readyState !== 1) return;
  digitsOnlyPin(pinInputEl);
  digitsOnlyPin(pinConfirmInputEl);
  const pin = pinInputEl ? pinInputEl.value : '';
  if (pin.length !== 4) {
    setPinModalMsg('PIN must be exactly 4 digits.');
    return;
  }
  if (pinModalMode === 'register') {
    const pin2 = pinConfirmInputEl ? pinConfirmInputEl.value : '';
    if (pin2.length !== 4) {
      setPinModalMsg('Confirm PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== pin2) {
      setPinModalMsg('PINs do not match.');
      return;
    }
    const name = accountNameEl ? String(accountNameEl.value || '').trim() : '';
    ws.send(JSON.stringify({ t: 'register', name, pin, pin2 }));
  } else {
    const name = accountNameEl ? String(accountNameEl.value || '').trim() : accountSession.name;
    ws.send(JSON.stringify({ t: 'login', name, pin }));
  }
}

if (accountBtn) {
  accountBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openAccountPanel();
  });
}
if (accountCloseBtn) {
  accountCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeAccountPanel();
  });
}
if (accountPanelEl) {
  accountPanelEl.addEventListener('click', (e) => {
    if (e.target === accountPanelEl) closeAccountPanel();
  });
}
if (accountChangeBtn) {
  accountChangeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendAccountNameChange();
  });
}
if (accountColorsBtn) {
  accountColorsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendAccountColors();
  });
}
if (accountPlayerColorEl) {
  accountPlayerColorEl.addEventListener('input', () => {
    const hex = normalizeColorHex(accountPlayerColorEl.value) || DEFAULT_PLAYER_COLOR_HEX;
    if (accountPlayerColorHexEl) accountPlayerColorHexEl.textContent = hex;
  });
}
if (accountShootColorEl) {
  accountShootColorEl.addEventListener('input', () => {
    const hex = normalizeColorHex(accountShootColorEl.value) || DEFAULT_SHOOT_COLOR_HEX;
    if (accountShootColorHexEl) accountShootColorHexEl.textContent = hex;
  });
}
if (accountNameEl) {
  accountNameEl.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      e.preventDefault();
      sendAccountNameChange();
    }
  });
}
if (accountRegisterBtn) {
  accountRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openPinModal('register');
  });
}
if (accountLoginBtn) {
  accountLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openPinModal('login');
  });
}
if (pinModalCloseBtn) {
  pinModalCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closePinModal();
  });
}
if (pinModalEl) {
  pinModalEl.addEventListener('click', (e) => {
    if (e.target === pinModalEl) closePinModal();
  });
}
if (pinModalSubmitBtn) {
  pinModalSubmitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submitPinModal();
  });
}
for (const el of [pinInputEl, pinConfirmInputEl]) {
  if (!el) continue;
  el.addEventListener('input', () => digitsOnlyPin(el));
  el.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      e.preventDefault();
      submitPinModal();
    }
  });
}

if (modeCloseBtn) {
  modeCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeModePanel();
  });
}
if (modePanelEl) {
  modePanelEl.addEventListener('click', (e) => {
    if (e.target === modePanelEl) closeModePanel();
  });
}
if (modePvpBtn) modePvpBtn.addEventListener('click', (e) => { e.preventDefault(); startPlayMode('pvp'); });
if (modeCoopBtn) modeCoopBtn.addEventListener('click', (e) => { e.preventDefault(); startPlayMode('coop'); });
if (modeSoloBtn) modeSoloBtn.addEventListener('click', (e) => { e.preventDefault(); startPlayMode('solo'); });
if (modeContinueBtn) modeContinueBtn.addEventListener('click', (e) => { e.preventDefault(); startPlayMode('continue'); });
soloSnapshot = loadSoloSnapshot();
syncModeContinueUi();

function sortedLeaderboardRows() {
  let rows = lbRows.slice();
  if (lbFriendsOnly) {
    const me = String(accountSession.name || '');
    rows = rows.filter((r) => {
      const n = String(r.name || '');
      return lbFriendsSet.has(n) || n === me;
    });
  }
  const key = lbSortKey;
  const dir = lbSortDir;
  rows.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'name') {
      av = String(av || '');
      bv = String(bv || '');
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    const ao = lbOnlineSet.has(String(a.name || '')) ? 1 : 0;
    const bo = lbOnlineSet.has(String(b.name || '')) ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return ((av | 0) - (bv | 0)) * dir;
  });
  return rows;
}

function syncLbActions() {
  if (!lbActionsEl) return;
  if (!lbSelectedName) {
    lbActionsEl.classList.remove('show');
    return;
  }
  lbActionsEl.classList.add('show');
  if (lbSelNameEl) lbSelNameEl.textContent = lbSelectedName;
  const me = String(accountSession.name || '');
  const isSelf = lbSelectedName === me;
  const isFriend = lbFriendsSet.has(lbSelectedName);
  const isOnline = lbOnlineSet.has(lbSelectedName);
  if (lbAddFriendBtn) {
    lbAddFriendBtn.disabled = !accountSession.registered || isSelf || isFriend;
    lbAddFriendBtn.textContent = isFriend ? 'Friends' : 'Add to friends';
  }
  if (lbInviteTeamBtn) {
    const inTeam = teamMembers.includes(lbSelectedName) && teamMembers.includes(me);
    lbInviteTeamBtn.disabled = !accountSession.registered || isSelf || !isOnline || inTeam;
    lbInviteTeamBtn.textContent = inTeam ? 'In team' : 'Invite to team';
  }
}

function renderLeaderboard() {
  const rows = sortedLeaderboardRows();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / LB_PAGE_SIZE) | 0);
  if (lbPage >= pages) lbPage = pages - 1;
  if (lbPage < 0) lbPage = 0;
  const start = lbPage * LB_PAGE_SIZE;
  const slice = rows.slice(start, start + LB_PAGE_SIZE);

  if (lbMetaEl) {
    const on = lbOnlineSet.size;
    lbMetaEl.textContent = total
      ? (total + ' pilot' + (total === 1 ? '' : 's') + (lbFriendsOnly ? ' (friends)' : '') + ' · ' + on + ' online')
      : (lbFriendsOnly ? 'No friends on the board yet.' : 'No registered pilots yet.');
  }
  if (lbPageEl) lbPageEl.textContent = 'Page ' + (lbPage + 1) + ' / ' + pages;
  if (lbPrevBtn) lbPrevBtn.disabled = lbPage <= 0;
  if (lbNextBtn) lbNextBtn.disabled = lbPage >= pages - 1;

  if (leaderboardPanelEl) {
    const heads = leaderboardPanelEl.querySelectorAll('th[data-sort]');
    for (const th of heads) {
      const k = th.getAttribute('data-sort');
      const on = k === lbSortKey;
      th.classList.toggle('sorted', on);
      let arrow = th.querySelector('.lb-arrow');
      if (!arrow) {
        arrow = document.createElement('span');
        arrow.className = 'lb-arrow';
        th.appendChild(arrow);
      }
      arrow.textContent = on ? (lbSortDir < 0 ? '▼' : '▲') : '';
    }
  }

  if (!lbBodyEl) return;
  lbBodyEl.innerHTML = '';
  for (const row of slice) {
    const name = String(row.name || '');
    const tr = document.createElement('tr');
    if (name && name === lbSelectedName) tr.classList.add('lb-selected');
    const tdName = document.createElement('td');
    tdName.className = 'name';
    const dot = document.createElement('span');
    dot.className = 'lb-online' + (lbOnlineSet.has(name) ? ' on' : '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lb-name';
    btn.textContent = name || '—';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      lbSelectedName = name || null;
      syncLbActions();
      renderLeaderboard();
    });
    tdName.appendChild(dot);
    tdName.appendChild(btn);
    const tdW = document.createElement('td');
    tdW.className = 'num';
    tdW.textContent = String(row.wins | 0);
    const tdB = document.createElement('td');
    tdB.className = 'num';
    tdB.textContent = String(row.bestWaves | 0);
    const tdD = document.createElement('td');
    tdD.className = 'num';
    tdD.textContent = String(row.bestWavesDuo | 0);
    tr.appendChild(tdName);
    tr.appendChild(tdW);
    tr.appendChild(tdB);
    tr.appendChild(tdD);
    lbBodyEl.appendChild(tr);
  }
  syncLbActions();
}

function formatDemoWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
  const pad = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function renderDemoHistory() {
  const rows = lbHistRows;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / LB_PAGE_SIZE) | 0);
  if (lbHistPage >= pages) lbHistPage = pages - 1;
  if (lbHistPage < 0) lbHistPage = 0;
  const start = lbHistPage * LB_PAGE_SIZE;
  const slice = rows.slice(start, start + LB_PAGE_SIZE);

  if (lbHistMetaEl) {
    lbHistMetaEl.textContent = total
      ? (total + ' saved game' + (total === 1 ? '' : 's') + ' on server')
      : 'No server demos yet. (sv_demo records PvP / coop / queue waves)';
  }
  if (lbHistPageEl) lbHistPageEl.textContent = 'Page ' + (lbHistPage + 1) + ' / ' + pages;
  if (lbHistPrevBtn) lbHistPrevBtn.disabled = lbHistPage <= 0;
  if (lbHistNextBtn) lbHistNextBtn.disabled = lbHistPage >= pages - 1;

  if (!lbHistBodyEl) return;
  lbHistBodyEl.innerHTML = '';
  for (const row of slice) {
    const tr = document.createElement('tr');
    const tdWhen = document.createElement('td');
    tdWhen.className = 'when';
    tdWhen.textContent = formatDemoWhen(row.endedAt || row.startedAt);
    const tdMode = document.createElement('td');
    tdMode.className = 'mode';
    tdMode.textContent = row.modeLabel || row.mode || '—';
    const tdPlayers = document.createElement('td');
    tdPlayers.className = 'players';
    const names = Array.isArray(row.players)
      ? row.players.map((p) => p.name || p.accountKey || ('#' + p.id)).filter(Boolean)
      : [];
    tdPlayers.textContent = names.length ? names.join(' · ') : '—';
    const tdScore = document.createElement('td');
    tdScore.className = 'num';
    tdScore.textContent = row.score != null && row.score !== '' ? String(row.score) : '—';
    const tdAct = document.createElement('td');
    tdAct.className = 'demo-act';
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'lb-play-demo';
    playBtn.textContent = 'Play demo';
    const file = row.file ? String(row.file) : '';
    if (!file) {
      playBtn.disabled = true;
      playBtn.title = 'Demo file missing';
    } else {
      playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playServerDemoFile(file, playBtn);
      });
    }
    tdAct.appendChild(playBtn);
    tr.appendChild(tdWhen);
    tr.appendChild(tdMode);
    tr.appendChild(tdPlayers);
    tr.appendChild(tdScore);
    tr.appendChild(tdAct);
    lbHistBodyEl.appendChild(tr);
  }
}

let lbDemoFetchBusy = false;

function safeServerDemoFile(name) {
  const base = String(name || '').split(/[/\\]/).pop();
  if (!base || !/^[A-Za-z0-9._\-]+\.json\.gz$/.test(base)) return null;
  return base;
}

function demoHasPlaybackFrames(data) {
  if (!data || !Array.isArray(data.events)) return false;
  for (const ev of data.events) {
    if (ev && (ev.t === 'snap' || ev.t === 'pose')) return true;
  }
  return false;
}

async function gunzipDemoResponse(res) {
  if (!res.ok) throw new Error('HTTP ' + res.status);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser cannot decompress gzip demos');
  }
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

async function playServerDemoFile(fileName, btnEl) {
  const file = safeServerDemoFile(fileName);
  if (!file) {
    conPrint('invalid demo file', 'err');
    return;
  }
  if (lbDemoFetchBusy) return;
  lbDemoFetchBusy = true;
  const prev = btnEl ? btnEl.textContent : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Loading…';
  }
  try {
    const res = await fetch('demos/' + encodeURIComponent(file), { cache: 'no-store' });
    const data = await gunzipDemoResponse(res);
    if (!demoHasPlaybackFrames(data)) {
      conPrint('demo has no ship poses — only matches recorded after playback support can be watched', 'err');
      if (typeof alert === 'function') {
        alert('This demo cannot be played (recorded before ship poses were saved). Newer matches will work.');
      }
      return;
    }
    const label = file.replace(/\.json\.gz$/i, '').slice(0, 48);
    closeLeaderboardPanel();
    demoBeginPlayData(data, label || 'server');
  } catch (err) {
    const msg = err && err.message ? err.message : 'load failed';
    conPrint('demo load failed: ' + msg, 'err');
    if (typeof alert === 'function') alert('Could not load demo: ' + msg);
  } finally {
    lbDemoFetchBusy = false;
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = prev || 'Play demo';
    }
  }
}

function setLeaderboardTab(tab) {
  lbTab = tab === 'history' ? 'history' : 'ranks';
  if (lbTabRanksBtn) lbTabRanksBtn.classList.toggle('active', lbTab === 'ranks');
  if (lbTabHistoryBtn) lbTabHistoryBtn.classList.toggle('active', lbTab === 'history');
  if (lbPaneRanksEl) lbPaneRanksEl.classList.toggle('show', lbTab === 'ranks');
  if (lbPaneHistoryEl) lbPaneHistoryEl.classList.toggle('show', lbTab === 'history');
  if (lbTab === 'history') {
    if (lbHistMetaEl) lbHistMetaEl.textContent = 'Loading…';
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'demoHistory' }));
    else if (lbHistMetaEl) lbHistMetaEl.textContent = 'Not connected.';
  } else {
    renderLeaderboard();
  }
}

function openLeaderboardPanel() {
  if (!leaderboardPanelEl) return;
  closeSettingsPanel();
  closeAccountPanel();
  closePinModal();
  closeModePanel();
  closeTeamInviteModal();
  lbSelectedName = null;
  syncLbActions();
  leaderboardPanelEl.classList.add('open');
  leaderboardPanelEl.setAttribute('aria-hidden', 'false');
  setLeaderboardTab(lbTab || 'ranks');
  if (lbTab === 'ranks') {
    if (lbMetaEl) lbMetaEl.textContent = 'Loading…';
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'leaderboard' }));
    else if (lbMetaEl) lbMetaEl.textContent = 'Not connected.';
  }
}

function closeLeaderboardPanel() {
  if (!leaderboardPanelEl) return;
  leaderboardPanelEl.classList.remove('open');
  leaderboardPanelEl.setAttribute('aria-hidden', 'true');
}

if (leaderboardBtn) {
  leaderboardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openLeaderboardPanel();
  });
}
if (leaderboardCloseBtn) {
  leaderboardCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeLeaderboardPanel();
  });
}
if (leaderboardPanelEl) {
  leaderboardPanelEl.addEventListener('click', (e) => {
    if (e.target === leaderboardPanelEl) closeLeaderboardPanel();
  });
  const heads = leaderboardPanelEl.querySelectorAll('th[data-sort]');
  for (const th of heads) {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (!key) return;
      if (lbSortKey === key) lbSortDir = -lbSortDir;
      else {
        lbSortKey = key;
        lbSortDir = key === 'name' ? 1 : -1;
      }
      lbPage = 0;
      renderLeaderboard();
    });
  }
}
if (lbTabRanksBtn) {
  lbTabRanksBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setLeaderboardTab('ranks');
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'leaderboard' }));
  });
}
if (lbTabHistoryBtn) {
  lbTabHistoryBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setLeaderboardTab('history');
  });
}
if (lbPrevBtn) {
  lbPrevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (lbPage > 0) {
      lbPage--;
      renderLeaderboard();
    }
  });
}
if (lbNextBtn) {
  lbNextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const pages = Math.max(1, Math.ceil(sortedLeaderboardRows().length / LB_PAGE_SIZE) | 0);
    if (lbPage < pages - 1) {
      lbPage++;
      renderLeaderboard();
    }
  });
}
if (lbHistPrevBtn) {
  lbHistPrevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (lbHistPage > 0) {
      lbHistPage--;
      renderDemoHistory();
    }
  });
}
if (lbHistNextBtn) {
  lbHistNextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const pages = Math.max(1, Math.ceil(lbHistRows.length / LB_PAGE_SIZE) | 0);
    if (lbHistPage < pages - 1) {
      lbHistPage++;
      renderDemoHistory();
    }
  });
}
if (lbFriendsOnlyEl) {
  lbFriendsOnlyEl.addEventListener('change', () => {
    lbFriendsOnly = !!lbFriendsOnlyEl.checked;
    lbPage = 0;
    renderLeaderboard();
  });
}
if (lbAddFriendBtn) {
  lbAddFriendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!ws || ws.readyState !== 1 || !lbSelectedName) return;
    ws.send(JSON.stringify({ t: 'addFriend', name: lbSelectedName }));
  });
}
if (lbInviteTeamBtn) {
  lbInviteTeamBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!ws || ws.readyState !== 1 || !lbSelectedName) return;
    ws.send(JSON.stringify({ t: 'teamInvite', name: lbSelectedName }));
  });
}
if (teamLeaveBtn) {
  teamLeaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ t: 'teamLeave' }));
  });
}
if (teamInviteAcceptBtn) {
  teamInviteAcceptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!ws || ws.readyState !== 1 || !pendingTeamInviteFrom) return;
    ws.send(JSON.stringify({ t: 'teamAccept', from: pendingTeamInviteFrom }));
    closeTeamInviteModal();
  });
}
if (teamInviteDeclineBtn) {
  teamInviteDeclineBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (ws && ws.readyState === 1 && pendingTeamInviteFrom) {
      ws.send(JSON.stringify({ t: 'teamDecline', from: pendingTeamInviteFrom }));
    }
    closeTeamInviteModal();
  });
}
if (teamInviteModalEl) {
  teamInviteModalEl.addEventListener('click', (e) => {
    if (e.target === teamInviteModalEl) {
      if (ws && ws.readyState === 1 && pendingTeamInviteFrom) {
        ws.send(JSON.stringify({ t: 'teamDecline', from: pendingTeamInviteFrom }));
      }
      closeTeamInviteModal();
    }
  });
}

let inputSeq = 0;
let pendingInputs = [];
let frameHistory = [];
let lastAppliedSeq = 0;
/** Highest seq we've put on the wire at least once (not an ack). */
let lastSentSeq = 0;
/** Highest seq the server has applied (from snaps). Resend anything above this. */
let ackedSeq = 0;
let lastInputSendAt = 0;
/** Pure resend interval when no new frames (ms). */
const INPUT_RESEND_MS = 50;
/** Match server MAX_FRAMES_PER_MSG. */
const INPUT_SEND_MAX_FRAMES = 24;
let predReady = false;
/** Last server-aligned tick we've already sampled input for (locked to NTP game time). */
let clientTickCursor = null;
/** Cap clock-offset correction per pong so tick estimate doesn't rewind/jump. */
const CLOCK_OFFSET_MAX_STEP_MS = 8;

let clockOffset = 0;
let pingMs = 0;
let pingJitter = 0;
let syncTick = 0;
let syncSt = 0;
/** Visual soft-correction residual after hard sim reconcile. */
const softErr = { x: 0, y: 0, angle: 0 };
/** Remote pose history for interpolation: id -> [{st,x,y,vx,vy,angle,hp}] */
const remoteHist = new Map();

function applyNtp(ct, st, serverTick) {
  const t3 = Date.now();
  const rtt = Math.max(0, t3 - ct);
  // Ignore one-off delayed pongs for jitter / delay adaptation (tab timers, GC).
  const saneRtt = rtt < (pingMs || 30) * 4 + 80;
  if (saneRtt) {
    const diff = pingMs ? Math.abs(rtt - pingMs) : 0;
    pingJitter = pingJitter ? pingJitter * 0.85 + diff * 0.15 : diff;
    pingMs = pingMs ? pingMs * 0.8 + rtt * 0.2 : rtt;
  }
  const offset = st - (ct + t3) * 0.5;
  if (!clockOffset) {
    clockOffset = offset;
  } else {
    let step = offset - clockOffset;
    if (step > CLOCK_OFFSET_MAX_STEP_MS) step = CLOCK_OFFSET_MAX_STEP_MS;
    if (step < -CLOCK_OFFSET_MAX_STEP_MS) step = -CLOCK_OFFSET_MAX_STEP_MS;
    clockOffset += step * 0.35;
  }
  // While playing, binary snaps own the tick timeline. Pong must not rewrite
  // syncTick/syncSt — that was rewinding estimatedServerTick every ~2s and
  // freezing local prediction for several frames.
  if (!inGame || !syncSt) {
    if (serverTick) syncTick = serverTick;
    syncSt = st;
  }
}

/** Adaptive send-now / act-later delay from one-way latency + jitter. */
function adaptiveInputDelay() {
  const oneWay = pingMs * 0.5;
  let d = Math.max(0, cv('cl_cmddelay') | 0);
  const dMax = Math.max(d, cv('cl_cmddelay_max') | 0);
  if (oneWay > TICK_MS * 1.25 || pingJitter > 20) d = Math.max(d, Math.min(2, dMax));
  if (oneWay > TICK_MS * 2.5 || pingJitter > 45) d = Math.max(d, Math.min(3, dMax));
  return Math.min(dMax, d);
}

/** How far behind realtime to sample remotes (ms). */
function adaptiveInterpMs() {
  const fixed = cv('cl_interp');
  if (fixed > 0) return fixed * 1000;
  const raw = pingMs * 0.5 + pingJitter * 1.25 + 50;
  const lo = cv('cl_interp_min');
  const hi = Math.max(lo, cv('cl_interp_max'));
  return Math.min(hi, Math.max(lo, raw));
}

function shortestAngleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Shortest signed delta on a wrapping axis (torus). */
function shortestWrapDelta(from, to, size) {
  let d = to - from;
  const half = size * 0.5;
  if (d > half) d -= size;
  else if (d < -half) d += size;
  return d;
}

function wrapCoord(v, size) {
  v %= size;
  if (v < 0) v += size;
  return v;
}

function clampSoftErr() {
  const m = Math.hypot(softErr.x, softErr.y);
  if (m > SOFT_ERR_MAX_POS) {
    softErr.x *= SOFT_ERR_MAX_POS / m;
    softErr.y *= SOFT_ERR_MAX_POS / m;
  }
  if (softErr.angle > SOFT_ERR_MAX_ANG) softErr.angle = SOFT_ERR_MAX_ANG;
  if (softErr.angle < -SOFT_ERR_MAX_ANG) softErr.angle = -SOFT_ERR_MAX_ANG;
}

function decaySoftErr(dt) {
  if (dt <= 0) return;
  const rate = cv('cl_recon');
  if (rate <= 0) {
    softErr.x = 0;
    softErr.y = 0;
    softErr.angle = 0;
    return;
  }
  const k = Math.exp(-rate * dt);
  softErr.x *= k;
  softErr.y *= k;
  softErr.angle *= k;
  // Kill sub-pixel residuals so snap-rounding can't flicker ±1..2 px.
  if (Math.abs(softErr.x) < 0.75) softErr.x = 0;
  if (Math.abs(softErr.y) < 0.75) softErr.y = 0;
  if (Math.abs(softErr.angle) < 0.002) softErr.angle = 0;
}

/** Visual pose for local ship (sim + soft error). */
function localView() {
  return {
    x: wrapCoord(player.x + softErr.x, W),
    y: wrapCoord(player.y + softErr.y, H),
    angle: player.angle + softErr.angle,
    vx: player.vx,
    vy: player.vy,
    av: player.av || 0,
    hp: player.hp
  };
}

function clearRemoteHist() {
  remoteHist.clear();
}

function pushRemoteSample(id, row, st) {
  let h = remoteHist.get(id);
  if (!h) {
    h = [];
    remoteHist.set(id, h);
  }
  const av = row[8] != null ? row[8] : 0;
  h.push({
    st,
    x: row[1],
    y: row[2],
    vx: row[3],
    vy: row[4],
    angle: row[5],
    hp: row[6],
    av
  });
  while (h.length > 90) h.shift();
  remotes.set(id, {
    id,
    x: row[1],
    y: row[2],
    vx: row[3],
    vy: row[4],
    angle: row[5],
    hp: row[6],
    av,
    godLeft: row[10] != null ? (row[10] | 0) : 0,
    powerups: (remotes.get(id) && remotes.get(id).powerups) || freshPowerups()
  });
}

function serverNow() {
  if (demoPlay && demoPlay.active) {
    return demoPlay.syncSt + (demoPlay.tick - demoPlay.syncTick) * TICK_MS;
  }
  return Date.now() + clockOffset;
}

function gameTimeSec() {
  return syncTick / TPS + (serverNow() - syncSt) / 1000;
}

/** Continuous server tick estimate from NTP (same timeline the host steps on). */
function estimatedServerTick() {
  if (!syncSt) return 0;
  return syncTick + (serverNow() - syncSt) / TICK_MS;
}

function resetTickClock() {
  clientTickCursor = null;
}

/**
 * After a long rAF pause: snap sim to last known server pose but keep the
 * on-screen ship continuous via softErr so it blends instead of teleports.
 */
function adoptServerGhostVisual() {
  const prevX = player.x + softErr.x;
  const prevY = player.y + softErr.y;
  const prevA = player.angle + softErr.angle;
  if (serverGhost.valid) {
    player.x = serverGhost.x;
    player.y = serverGhost.y;
    player.vx = serverGhost.vx;
    player.vy = serverGhost.vy;
    player.angle = serverGhost.angle;
    player.av = serverGhost.av || 0;
    player.hp = serverGhost.hp;
    player.turnDecelStep = 0;
    player.turnDecelLeft = 0;
    player.turnDecelRev = 0;
    lastAppliedSeq = ackedSeq;
  }
  softErr.x = shortestWrapDelta(player.x, prevX, W);
  softErr.y = shortestWrapDelta(player.y, prevY, H);
  softErr.angle = shortestAngleDelta(player.angle, prevA);
  const m = Math.hypot(softErr.x, softErr.y);
  if (m > RESUME_SOFT_ERR_MAX) {
    softErr.x *= RESUME_SOFT_ERR_MAX / m;
    softErr.y *= RESUME_SOFT_ERR_MAX / m;
  }
  if (softErr.angle > SOFT_ERR_MAX_ANG * 2) softErr.angle = SOFT_ERR_MAX_ANG * 2;
  if (softErr.angle < -SOFT_ERR_MAX_ANG * 2) softErr.angle = -SOFT_ERR_MAX_ANG * 2;
  resumeBlendUntil = performance.now() + RESUME_BLEND_MS;
}

/**
 * Emit inputs on the server tick grid instead of a free-running setInterval.
 * Uses NTP-estimated server time so client and host stay at the same cadence.
 */
function syncSimTicks() {
  if (demoPlay && demoPlay.active) {
    demoPlaybackStep();
    return;
  }
  if (!inGame || !predReady || !syncSt) return;
  const target = Math.floor(estimatedServerTick());
  if (clientTickCursor == null) {
    clientTickCursor = target;
    return;
  }
  // Clock skew / snap reset can put the cursor ahead of estimated time and
  // freeze prediction forever — hard-resync when we fall behind the estimate.
  if (target < clientTickCursor) {
    if (clientTickCursor - target > 2) clientTickCursor = target;
    return;
  }

  const behind = target - clientTickCursor;
  // Tab minimize / unfocus pauses rAF while wall-clock ticks keep advancing.
  // Short gaps: gradual catch-up (keys already cleared). Long gaps: ghost + blend.
  if (behind > TICK_CATCHUP_SKIP) {
    clientTickCursor = target;
    adoptServerGhostVisual();
    return;
  }

  let steps = 0;
  const maxCatchup = Math.max(1, cv('cl_catchup') | 0);
  while (clientTickCursor < target && steps < maxCatchup) {
    clientTickCursor++;
    predictTick(false);
    steps++;
  }
}

/** Clear stuck movement after alt-tab / minimize (browsers often drop keyup). */
function clearStuckInputKeys() {
  for (const k of Object.keys(keys)) keys[k] = false;
  spaceLatch = false;
  enterLatch = false;
  shootPulse = false;
}

function onVisibilityResume() {
  if (!inGame) return;
  clearStuckInputKeys();
  if (!syncSt || !predReady) return;
  const target = Math.floor(estimatedServerTick());
  if (clientTickCursor == null) {
    clientTickCursor = target;
    return;
  }
  const behind = target - clientTickCursor;
  if (behind > TICK_CATCHUP_SKIP) {
    clientTickCursor = target;
    adoptServerGhostVisual();
  }
  // Smaller gaps: leave cursor alone — syncSimTicks catch-up with zeroed keys.
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onVisibilityResume();
  else clearStuckInputKeys();
});
window.addEventListener('focus', () => {
  onVisibilityResume();
});
window.addEventListener('blur', () => {
  clearStuckInputKeys();
});

function fmtServerTime() {
  const d = new Date(serverNow());
  return d.toISOString().slice(11, 23);
}

function fmtGameTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${r.padStart(4, '0')}` : `${r}s`;
}

function updateHud() {
  if (!inGame || !myId) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
    if (scoreHudEl) scoreHudEl.classList.add('hidden');
    return;
  }
  // Keep debug status available but tucked away — sports HUD owns the score moments.
  statusEl.classList.add('hidden');
  statusEl.textContent =
    `room ${roomId || '?'} | p${myId} ${player.hp}hp | ping ${Math.round(pingMs)}ms ±${Math.round(pingJitter)} | dly ${adaptiveInputDelay()} | srv ${fmtServerTime()} | game ${fmtGameTime(gameTimeSec())}${practiceMode ? ' | SOLO WAVE ' + (soloWave || 1) : ''}`;

  // No persistent score strip during play — big board only on death / match end.
  if (scoreHudEl) scoreHudEl.classList.add('hidden');
}

function setPracticeWaiting(on) {
  const next = !!on;
  const changed = practiceMode !== next;
  practiceMode = next;
  if (changed) {
    invalidateGridBake();
    refreshGridStaticPins();
  }
  if (waitBannerEl) {
    waitBannerEl.classList.toggle('hidden', !practiceMode);
    if (practiceMode) {
      syncSoloWaitBanner();
    } else {
      waitBannerEl.style.top = '';
      waitBannerEl.style.bottom = '';
    }
  }
  if (cancelBtn) {
    if (practiceMode) cancelBtn.classList.add('visible');
    else if (inGame) cancelBtn.classList.remove('visible');
  }
}

function showMenu() {
  if (menuEl) menuEl.classList.remove('hidden');
  if (playBtn) playBtn.disabled = !connected;
  if (cancelBtn) cancelBtn.classList.remove('visible');
  syncRejoinButton();
  playMenuMusic();
}

function showQueue() {
  if (menuEl) menuEl.classList.remove('hidden');
  if (playBtn) playBtn.disabled = true;
  if (cancelBtn) cancelBtn.classList.add('visible');
}

function hideMenu() {
  if (menuEl) menuEl.classList.add('hidden');
}

function fmtPauseBudget(ms) {
  const s = Math.max(0, Math.ceil((ms | 0) / 1000));
  const m = (s / 60) | 0;
  const r = s % 60;
  return m > 0 ? (m + ':' + String(r).padStart(2, '0')) : (s + 's');
}

function setRejoinOffer(offer) {
  pendingRejoinOffer = offer && offer.room != null ? offer : null;
  syncRejoinButton();
}

function syncRejoinButton() {
  if (!rejoinBtn) return;
  const show = !!(pendingRejoinOffer && connected && !inGame);
  rejoinBtn.classList.toggle('hidden', !show);
}

function closePausePanel() {
  if (pausePanelEl) {
    pausePanelEl.classList.remove('open');
    pausePanelEl.setAttribute('aria-hidden', 'true');
  }
  if (pauseCdEl) pauseCdEl.textContent = '';
  if (pauseReadyBtn) {
    pauseReadyBtn.disabled = false;
    pauseReadyBtn.textContent = 'Ready';
  }
}

function clearMatchPause() {
  matchPaused = false;
  pauseFreezeAt = 0;
  pauseState = null;
  closePausePanel();
}

function openPausePanel() {
  if (!pausePanelEl) return;
  pausePanelEl.classList.add('open');
  pausePanelEl.setAttribute('aria-hidden', 'false');
  renderPausePanel();
}

function renderPausePanel() {
  if (!pauseState) return;
  const reason = pauseState.reason || 'manual';
  const budgets = pauseState.budgets || {};
  const ready = Array.isArray(pauseState.ready) ? pauseState.ready.map(Number) : [];
  const need = Math.max(1, pauseState.need | 0);
  const burnId = pauseState.burnId;
  const cd = pauseState.countdown | 0;
  const holds = Array.isArray(pauseState.holds) ? pauseState.holds : [];
  const disconnected = holds.some(h => h && h[2]);

  let title = 'Paused';
  if (reason === 'disconnect' || disconnected) title = 'Connection lost';
  else if (reason === 'rejoin') title = 'Rejoined — waiting';
  if (pauseTitleEl) pauseTitleEl.textContent = title;

  const myBudget = budgets[myId] != null ? budgets[myId] : null;
  const burnBudget = burnId != null && budgets[burnId] != null ? budgets[burnId] : null;
  const lines = [];
  if (reason === 'disconnect' || disconnected) {
    lines.push('Opponent disconnected. Match is paused.');
    lines.push('Waiting for them to rejoin…');
  } else if (burnId != null && burnId === myId) {
    lines.push('You paused the match.');
  } else if (burnId != null) {
    lines.push('Opponent paused the match.');
  } else {
    lines.push('Match paused.');
  }
  if (burnId != null && burnBudget != null) {
    const whose = burnId === myId ? 'Your' : 'Their';
    lines.push(whose + ' pause time left: ' + fmtPauseBudget(burnBudget));
  } else if (myBudget != null && !(practiceMode && !coopMode)) {
    lines.push('Your pause budget: ' + fmtPauseBudget(myBudget));
  }
  if (cd > 0) {
    lines.push('Resuming…');
  } else if (practiceMode && !coopMode) {
    lines.push('Press Ready, then 3-2-1 to continue.');
  } else {
    lines.push('Ready: ' + ready.length + '/' + need);
    lines.push('Both players must Ready, then 3-2-1.');
  }
  if (pauseMetaEl) pauseMetaEl.textContent = lines.join('\n');

  if (pauseCdEl) {
    if (cd > 0) {
      const sec = Math.max(1, Math.ceil(cd / ((typeof TPS === 'number' && TPS > 0) ? TPS : 60)));
      pauseCdEl.textContent = String(sec);
    } else {
      pauseCdEl.textContent = '';
    }
  }

  const iAmReady = myId != null && ready.includes(myId | 0);
  if (pauseReadyBtn) {
    const blockReady = !!(cd > 0 || iAmReady || disconnected);
    pauseReadyBtn.disabled = blockReady;
    pauseReadyBtn.textContent = disconnected
      ? 'Waiting…'
      : (cd > 0 ? 'Get ready…' : (iAmReady ? 'Ready ✓' : 'Ready'));
  }
  if (pauseLeaveBtn) {
    pauseLeaveBtn.textContent = (practiceMode && !coopMode) ? 'Quit to menu' : 'Leave match';
  }
}

function applyPausedMsg(msg) {
  if (!inGame) return;
  const wasPaused = matchPaused;
  pauseState = msg;
  if (!wasPaused) {
    matchPaused = true;
    pauseFreezeAt = serverNow();
    rebaseAsteroidsToTime(pauseFreezeAt);
    player.vx = 0;
    player.vy = 0;
    player.av = 0;
    softErr.x = 0; softErr.y = 0; softErr.angle = 0;
    localShoot.bursting = false;
    localShoot.railChargeLeft = 0;
    syncThrustSfx(false);
    syncLaserSfx(false);
    stopAllRailChargeSfx();
  }
  // Refresh countdown field from server (ticks remaining).
  if (msg.countdown != null) pauseState.countdown = msg.countdown | 0;
  openPausePanel();
}

function applyResumeCdMsg(msg) {
  if (!matchPaused) return;
  if (!pauseState) pauseState = { reason: 'manual', budgets: {}, ready: [], need: 1 };
  const n = msg.n != null ? (msg.n | 0) : 3;
  const tps = (typeof TPS === 'number' && TPS > 0) ? TPS : 60;
  pauseState.countdown = Math.max(1, n) * tps;
  if (pauseCdEl) pauseCdEl.textContent = String(Math.max(1, n));
  renderPausePanel();
}

function applyResumedMsg(msg) {
  if (msg.tick != null && msg.st != null) {
    syncTick = msg.tick | 0;
    syncSt = msg.st;
    resetTickClock();
  }
  if (msg.players) {
    for (const row of msg.players) {
      if ((row[0] | 0) === myId) reconcileFromServer(row);
    }
    applyRemotePlayers(msg.players, msg.st != null ? msg.st : serverNow());
  }
  if (msg.asteroids) replaceAsteroidsFromRows(msg.asteroids);
  if (msg.bullets) {
    bullets.clear();
    stopAllRocketTravelSfx();
    for (const row of msg.bullets) addBullet(unpackBullet(row), false);
  }
  if (msg.enemies) {
    enemies.clear();
    enemyCharges.clear();
    for (const row of msg.enemies) addEnemy(unpackEnemy(row));
  }
  clearMatchPause();
  updateHud();
}

function requestMatchPause() {
  if (!inGame || !ws || ws.readyState !== 1) return;
  if (matchPaused) {
    openPausePanel();
    return;
  }
  ws.send(JSON.stringify({ t: 'pause' }));
}

function sendPauseReady() {
  if (!inGame || !matchPaused || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'pauseReady' }));
  if (pauseReadyBtn) {
    pauseReadyBtn.disabled = true;
    pauseReadyBtn.textContent = 'Ready ✓';
  }
}

function leaveFromPause() {
  if (!ws || ws.readyState !== 1) return;
  const solo = practiceMode && !coopMode;
  const label = solo ? 'Quit to the main menu?' : 'Leave match? You will forfeit.';
  if (!confirm(label)) return;
  ws.send(JSON.stringify({ t: solo ? 'cancel' : 'leave' }));
  clearMatchPause();
  if (solo) {
    returnToLobby();
  }
}

function resetMatchState() {
  inGame = false;
  deathSpectating = false;
  deathSeq = null;
  deathFreezeAt = 0;
  clearMatchPause();
  setRejoinOffer(null);
  roomId = null;
  myId = null;
  matchLive = true;
  matchReadySent = false;
  coopMode = false;
  soloOnlyMode = false;
  predReady = false;
  pendingInputs = [];
  frameHistory = [];
  lastAppliedSeq = 0;
  lastSentSeq = 0;
  ackedSeq = 0;
  lastInputSendAt = 0;
  inputSeq = 0;
  resetTickClock();
  syncTick = 0;
  syncSt = 0;
  serverGhost.valid = false;
  remotes.clear();
  clearRemoteHist();
  scores.clear();
  rosterNames.clear();
  clearOverlayTimers();
  hideMatchIntro(true);
  hideScoreBoard(true);
  stopBcastFx();
  asteroids.clear();
  enemies.clear();
  enemyCharges.clear();
  clearCoins();
  localCoins = 0;
  localScore = 0;
  soloLives = 3;
  asteroidGhosts = [];
  stopAllRocketTravelSfx();
  bullets.clear();
  pickups.clear();
  softErr.x = 0; softErr.y = 0; softErr.angle = 0;
  remoteLasers.clear();
  hitLasers.length = 0;
  localLaserUntil = 0;
  localLaserClip = null;
  selectedWeapon = 1;
  weaponLevels = { default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 };
  unlockedWeapons = {
    default: true, rocket: false, laser: false, shotgun: false,
    railgun: false, plasma: false, voidcannon: false, asteroidgun: false
  };
  player.powerups = freshPowerups();
  hideSoloShop();
  resetLocalShoot('default');
  clearParticles();
  clearFxLabels();
  clearWaveBanner();
  soloWave = 0;
  clearScreenShake();
  clearGridShocks();
  stopAllRailChargeSfx();
  syncThrustSfx(false);
  syncLaserSfx(false);
  shipSmokeLeaks.clear();
  setPracticeWaiting(false);
  refreshGridStaticPins();
  stopAllRailChargeSfx();
  railCharges.clear();
  railBeams.length = 0;
  thrustBeams.length = 0;
  thrustMeleeFxUntil.clear();
  thrustAlignPrevX = null;
  thrustAlignPrevY = null;
  deathRings.length = 0;
  shipBankSmooth.clear();
  turretYawSmooth.clear();
  shotgunSfxAt.clear();
  voidShakes.clear();
  enemyAngHist.clear();
  enemyBankSmooth.clear();
  enemyDrawBank.clear();
  resumeBlendUntil = 0;
}


function bulletAgeTicks(b) {
  const freeze = worldFreezeClock();
  const now = freeze || serverNow();
  return Math.max(0, (now - b.spawnSt) / 1000 * TPS);
}

/** Server spawn + NTP age. */
function bulletTrueAt(b) {
  const age = bulletAgeTicks(b);
  return {
    x: b.spawnX + b.vx * age,
    y: b.spawnY + b.vy * age
  };
}

function bulletAt(b) {
  return bulletTrueAt(b);
}

/**
 * Common shot: 2D twin ovals sized like the UFO rocket mesh (ENEMY_ROCKET3D ≈ ship×0.7/3).
 * Soft falloff shrinks the bright core, so half-sizes are padded to match that footprint.
 */
function drawEnemyCommonShot(x, y, ang) {
  const red = COL.enemyBullet || [1.0, 0.18, 0.12];
  // UFO rocket spans ~5×8 px at RES_SCALE=2 — glow a bit larger, white core ≈ body.
  const glowW = 4.2 * RES_SCALE;
  const glowL = 6.0 * RES_SCALE;
  const coreW = 2.4 * RES_SCALE;
  const coreL = 4.8 * RES_SCALE;
  drawSoftOval(x, y, ang, glowW, glowL, red, 0.7, true);
  drawSoftOval(x, y, ang, coreW, coreL, COL_WHITE, 1, false);
}

function drawBulletVisual(type, x, y, ang, vx, vy, defaultTrail, bulletId, ownerId) {
  if (type === 'rocket' || type === 'enemyRocket') {
    const tiny = type === 'enemyRocket';
    const rCol = tiny ? COL.enemyUfo : ownerPlayerColor(ownerId);
    drawRocket3D(x, y, ang, rCol, bulletId, tiny);
    // UFO rocket: half the trail spawn rate; same size / speeds as player rocket.
    const trailOk = tiny
      ? (((performance.now() / 32) | 0) % 2 === 0)
      : true;
    if (trailOk) {
      const back = (tiny ? 2 : 6) * RES_SCALE;
      emitParticles({
        x: x - Math.cos(ang) * back,
        y: y - Math.sin(ang) * back,
        count: 1,
        speed: 40 * RES_SCALE,
        speedSpread: 20 * RES_SCALE,
        direction: ang + Math.PI,
        spread: (30 * Math.PI) / 180, // ±15°
        size: 3 * RES_SCALE,
        scaleY: 2.2,
        sizeWiggle: 0.3,
        sizeWiggleSpeed: 16,
        lifetime: 0.36,
        color: rCol,
        drag: 2.5,
        inheritVx: vx * 0.15,
        inheritVy: vy * 0.15
      });
    }
    if (!tiny) {
      const rg = gridBlastRocketTrailOpts(vx, vy);
      if (rg) pushGridShock(x, y, Object.assign(rg, { ironWake: false }));
    }
    return null;
  }
  if (type === 'plasma') {
    const ringR = 5 * RES_SCALE;
    const lifeFrames = 3 / LOCK_FPS;
    const pCol = bulletDrawColor('plasma', ownerId);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const pxPerFrame = (1 + Math.random()) * RES_SCALE; // 1–2 px/frame
      emitParticles({
        x: x + Math.cos(a) * ringR,
        y: y + Math.sin(a) * ringR,
        count: 1,
        speed: pxPerFrame * LOCK_FPS,
        speedSpread: 0,
        direction: Math.random() * Math.PI * 2,
        spread: 0,
        size: (2 + Math.random() * 2) * RES_SCALE, // 2×2–4×4
        sizeSpread: 0,
        scaleY: 1,
        lifetime: lifeFrames,
        lifetimeSpread: 0,
        color: pCol,
        drag: 0
      });
    }
    const g = gridBlastBulletTrailOpts(vx, vy);
    if (g) pushGridShock(x, y, g);
    return null;
  }
  if (type === 'voidcannon') {
    emitVoidVortex(x, y, vx, vy);
    return null;
  }
  if (type === 'enemy') {
    drawEnemyCommonShot(x, y, ang);
    return null;
  }
  if ((type === 'default' || !type || type === 'shotgun') && defaultTrail) {
    emitParticles({
      x: x - Math.cos(ang) * 2 * RES_SCALE,
      y: y - Math.sin(ang) * 2 * RES_SCALE,
      count: 1,
      speed: 25 * RES_SCALE,
      speedSpread: 12 * RES_SCALE,
      direction: ang + Math.PI,
      spread: 0.35,
      size: 1.4 * RES_SCALE,
      sizeSpread: 0.6 * RES_SCALE,
      scaleY: 1.5,
      sizeWiggle: 0.2,
      sizeWiggleSpeed: 14,
      lifetime: 0.2,
      lifetimeSpread: 0.1,
      color: COL.bullet,
      drag: 3.2,
      inheritVx: vx * 0.1,
      inheritVy: vy * 0.1
    });
  }
  if (type === 'default' || !type || type === 'shotgun') {
    const g = gridBlastBulletTrailOpts(vx, vy);
    if (g) pushGridShock(x, y, g);
  }
  return { x, y };
}

function unpackBullet(row) {
  return {
    id: row[0],
    spawnX: row[1],
    spawnY: row[2],
    vx: row[3],
    vy: row[4],
    owner: row[5],
    spawnSt: row[6],
    type: row[7] || 'default'
  };
}

/** Same LCG as server — pellet aim/speed from muzzle x/y. */
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

/**
 * Shotgun fire is one bf per shell: [baseId,x,y,aim,0,owner,st,'shotgun',pelletCount].
 * Mid-flight welcome bullets stay single packs without pelletCount.
 */
function isShotgunShellFire(row) {
  return row && row[7] === 'shotgun' && (row[8] | 0) > 0;
}

function addShotgunShellFire(row, withMuzzle, liveFire) {
  const owner = row[5] | 0;
  const baseId = row[0] | 0;
  const x = row[1];
  const y = row[2];
  const aim = row[3];
  const spawnSt = row[6];
  const count = Math.max(1, row[8] | 0);
  const w = WEAPONS.shotgun;
  const [spdMin, spdMax] = w.shotgunSpeeds || [4 * RES_SCALE, 9 * RES_SCALE];
  const spreadRad = ((w.spread != null ? w.spread : 30) || 0) * Math.PI / 180;
  const rnd = makeShotgunRng(x, y);
  if (withMuzzle) {
    const sv = resolveMuzzleShipVel(owner);
    emitMuzzleFx(x, y, aim, COL.bullet, 10, sv.vx, sv.vy, { cone: 1.35 });
    playShotgunFireSfx(owner, 0.55);
  }
  for (let i = 0; i < count; i++) {
    const ang = aim + (rnd() - 0.5) * spreadRad;
    const spd = spdMin + rnd() * (spdMax - spdMin);
    addBullet({
      id: baseId + i,
      spawnX: x,
      spawnY: y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      owner,
      spawnSt,
      type: 'shotgun'
    }, false, liveFire);
  }
}

function addBullet(b, withMuzzle, liveFire) {
  bullets.set(b.id, b);
  if (b.type === 'rocket' || b.type === 'enemyRocket') startRocketTravelSfx(b);
  if (withMuzzle) {
    const ang = Math.atan2(b.vy, b.vx);
    const origin = { x: b.spawnX, y: b.spawnY };
    const sv = resolveMuzzleShipVel(b.owner);
    if (b.type === 'rocket') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.rocket, 12, sv.vx, sv.vy);
      // Remote only — local rocket fire plays in emitLocalShootFx.
      if (b.owner !== myId) playSfx(SFX.rocketFire, { vol: 0.55, pool: 6 });
    } else if (b.type === 'enemyRocket') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.enemyUfo, 8, sv.vx, sv.vy);
      playSfx(SFX.rocketFire, { vol: 0.35, pool: 6 });
    } else if (b.type === 'shotgun') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.bullet, 10, sv.vx, sv.vy, { cone: 1.35 });
      // Remote only — local shotgun SFX is Space press. Debounce whole burst.
      playShotgunFireSfx(b.owner, 0.55);
    } else if (b.type === 'default' || !b.type) {
      emitMuzzleFx(origin.x, origin.y, ang, COL.bullet, 9, sv.vx, sv.vy);
      // Remote only — local default shoot plays in emitLocalShootFx.
      playSfx(SFX.shoot, { vol: 0.5, pool: 8 });
    } else if (b.type === 'plasma') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.plasma, 9, sv.vx, sv.vy, { cone: 0.85 });
      if (b.owner !== myId) playSfx(SFX.shoot, { vol: 0.45, pool: 8 });
    } else if (b.type === 'voidcannon') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.voidcannon, 10, sv.vx, sv.vy, { cone: 1.2 });
      if (b.owner !== myId) playSfx(SFX.shoot, { vol: 0.5, pool: 8 });
    } else if (b.type === 'turret') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.powerTurret, 7, sv.vx, sv.vy);
      if (b.owner !== myId) playSfx(SFX.shoot, { vol: 0.35, pool: 8 });
    } else if (b.type === 'enemy') {
      emitMuzzleFx(origin.x, origin.y, ang, COL.enemyBullet, 7, sv.vx, sv.vy);
    }
  }
}

function removeBullet(id, hitKind, hx, hy) {
  const b = bullets.get(id);
  const kind = hitKind != null ? (hitKind | 0) : 2;
  if (b) {
    const p = (hx != null && hy != null) ? { x: hx, y: hy } : bulletAt(b);
    emitBulletImpactFx(p.x, p.y, b.type || 'default', kind, b.vx, b.vy);
    if (b.type === 'rocket' || b.type === 'enemyRocket') stopRocketTravelSfx(b.id);
  } else if (hx != null && hy != null) {
    emitBulletImpactFx(hx, hy, 'default', kind);
  }
  bullets.delete(id);
}

function removeAsteroid(id, silent) {
  const a = asteroids.get(id);
  if (a && !silent) {
    const p = asteroidAt(a);
    emitAsteroidBurst(p.x, p.y, a.r || 10 * RES_SCALE, a.size);
    pushFxRing(p.x, p.y, COL.asteroid, {
      r0: 4,
      r1: Math.min(50, 12 + (a.r || 10) * 0.6),
      life: 360
    });
    pushGridShock(p.x, p.y, gridBlastAsteroidOpts(a.r || 10 * RES_SCALE));
  }
  asteroids.delete(id);
}

function addLaser(row, hitKind, weaponName) {
  const x0 = row[1], y0 = row[2], x1 = row[3], y1 = row[4];
  const owner = row[7] | 0;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const wpn = weaponName || 'laser';
  const kind = hitKind != null ? (hitKind | 0) : 2;
  const beamDir = Math.atan2(y1 - y0, x1 - x0);
  if (wpn === 'thrust') {
    // No beam visual — melee reads as red thruster particles instead.
    noteThrustMeleeFx(owner);
    if (kind > 0) emitLaserImpactFx(x1, y1, kind, false, beamDir);
    pushHitscanDebug(x0, y0, x1, y1, kind, wpn);
    return;
  }
  // Laser impact SFX + spark FX only for laser weapon hits (not miss).
  emitLaserImpactFx(x1, y1, kind, wpn === 'laser', beamDir);
  pushHitscanDebug(x0, y0, x1, y1, kind, wpn);
  if (wpn === 'laser') pushGridShock(x0, y0, gridBlastLaserOpts(x0, y0, x1, y1));
  // Own laser beam is 100% local (ship pose + clip timer). Remotes use server len.
  if (owner && owner !== (myId | 0)) {
    remoteLasers.set(owner, {
      len,
      until: performance.now() + LASER_CLIP_MS + LASER_LINGER_MS,
      wpn
    });
  }
}

function canPlayDefaultShootOnPress() {
  if (!matchLive) return false;
  const n = currentWeaponName();
  if (n !== 'default' && n !== 'plasma') return false;
  if (localShoot.bursting || localShoot.reloadLeft > 0) return false;
  if (localShoot.shootAmmo <= 0 || (localShoot.shootCd | 0) > 0) return false;
  return true;
}

function canPlayRailChargeOnPress() {
  if (!matchLive) return false;
  if (currentWeaponName() !== 'railgun') return false;
  if (localShoot.bursting || localShoot.reloadLeft > 0) return false;
  if (localShoot.shootAmmo <= 0 || (localShoot.shootCd | 0) > 0) return false;
  if ((localShoot.railChargeLeft | 0) > 0) return false;
  return true;
}

function canPlayShotgunOnPress() {
  if (!matchLive) return false;
  if (currentWeaponName() !== 'shotgun') return false;
  if (localShoot.bursting || localShoot.reloadLeft > 0) return false;
  if (localShoot.shootAmmo <= 0 || (localShoot.shootCd | 0) > 0) return false;
  return true;
}

/** Instant default-blaster feedback on keydown (ahead of input-delay muzzle FX). */
function playDefaultShootOnPress() {
  if (!canPlayDefaultShootOnPress()) return;
  playSfx(SFX.shoot, { vol: 0.9 });
  localShoot.sfxSkipNext = true;
}

/** Instant rail charge hum on keydown (same held clip reused forever). */
function playRailChargeOnPress() {
  if (!canPlayRailChargeOnPress() || myId == null) return;
  playSfxLoop('railCharge:' + myId, SFX.railCharge, { vol: 0.75, loop: false });
}

/** One shotgun blast per Space press — never per pellet / per shell in the burst. */
function playShotgunOnPress() {
  if (!canPlayShotgunOnPress()) return;
  playSfx(SFX.shotgun, { vol: 0.9 });
  if (myId != null) shotgunSfxAt.set(myId, performance.now());
}

/** Dry-fire click when mag empty / still reloading. */
function playNoAmmoOnPress() {
  if (!matchLive || deathSpectating || matchPaused) return;
  if (localShoot.reloadLeft > 0 || localShoot.shootAmmo <= 0) {
    playSfx(SFX.noAmmo, { vol: 0.85, pool: 2 });
  }
}

function triggerShoot() {
  if (!inGame || matchPaused || deathSpectating) return;
  // Only pulse input here — muzzle FX fires from updateLocalShooting when ammo/cd allow.
  shootPulse = true;
  playDefaultShootOnPress();
  playRailChargeOnPress();
  playShotgunOnPress();
  playNoAmmoOnPress();
}

function shipMuzzle(x, y, angle) {
  return {
    x: x + Math.cos(angle) * MUZZLE,
    y: y + Math.sin(angle) * MUZZLE,
    c: Math.cos(angle),
    s: Math.sin(angle)
  };
}

function playerHitCirclesAt(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    { x: x + c * PLAYER_HIT_OFFSET_FRONT, y: y + s * PLAYER_HIT_OFFSET_FRONT, r: PLAYER_HIT_R_FRONT },
    { x: x - c * PLAYER_HIT_OFFSET_BACK, y: y - s * PLAYER_HIT_OFFSET_BACK, r: PLAYER_HIT_R_BACK }
  ];
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

function raycastCircleToroidal(ox, oy, dx, dy, cx, cy, cr, maxDist) {
  let best = null;
  for (let oxw = -W; oxw <= W; oxw += W) {
    for (let oyw = -H; oyw <= H; oyw += H) {
      const t = raycastCircle(ox, oy, dx, dy, cx + oxw, cy + oyw, cr);
      if (t == null || t > maxDist) continue;
      if (best == null || t < best) best = t;
    }
  }
  return best;
}

/** Local laser path until first hit. Returns [[x0,y0,x1,y1], ...]. */
function localLaserSegments(ox, oy, dirX, dirY, maxDist) {
  let best = maxDist;
  let hitX = ox + dirX * maxDist;
  let hitY = oy + dirY * maxDist;

  for (const r of remotes.values()) {
    if (r.hp <= 0) continue;
    const v = remoteView(r);
    for (const c of playerHitCirclesAt(v.x, v.y, v.angle)) {
      const t = raycastCircleToroidal(ox, oy, dirX, dirY, c.x, c.y, c.r, best);
      if (t != null && t < best) {
        best = t;
        hitX = ox + dirX * t;
        hitY = oy + dirY * t;
      }
    }
  }
  for (const e of enemies.values()) {
    if ((e.hp | 0) <= 0) continue;
    const p = enemyAt(e);
    const t = raycastCircleToroidal(ox, oy, dirX, dirY, p.x, p.y, enemyHitR(e), best);
    if (t != null && t < best) {
      best = t;
      hitX = ox + dirX * t;
      hitY = oy + dirY * t;
    }
  }
  for (const a of asteroids.values()) {
    const p = asteroidAt(a);
    const t = raycastCircle(ox, oy, dirX, dirY, p.x, p.y, (a.r || 10 * RES_SCALE) * ASTEROID_HIT_SCALE);
    if (t != null && t >= 0 && t < best) {
      best = t;
      hitX = ox + dirX * t;
      hitY = oy + dirY * t;
    }
  }
  return [[ox, oy, hitX, hitY]];
}

function updateLaserState() {
  const now = performance.now();
  // Local clip timer is fixed at burst start — do not extend from key / server lf.
  for (const [owner, rl] of remoteLasers) {
    if (now >= rl.until) remoteLasers.delete(owner);
  }
  for (const [owner, ch] of railCharges) {
    const until = ch && ch.until != null ? ch.until : ch;
    if (now >= until) railCharges.delete(owner);
  }
  for (let i = hitLasers.length - 1; i >= 0; i--) {
    if (now >= hitLasers[i].until) hitLasers.splice(i, 1);
  }
  for (let i = railBeams.length - 1; i >= 0; i--) {
    if (now >= railBeams[i].until) railBeams.splice(i, 1);
  }
  for (let i = thrustBeams.length - 1; i >= 0; i--) {
    if (now >= thrustBeams[i].until) thrustBeams.splice(i, 1);
  }
}

function resolveFxShooterPose(owner) {
  if (owner === myId) {
    const me = localView();
    return { x: me.x, y: me.y, angle: me.angle };
  }
  if (owner < 0) {
    const e = enemies.get(-owner);
    if (!e) return null;
    const p = enemyAt(e);
    return { x: p.x, y: p.y, angle: p.angle };
  }
  const raw = remotes.get(owner);
  if (!raw) return null;
  const r = remoteView(raw);
  return { x: r.x, y: r.y, angle: r.angle };
}

/**
 * Rail charge aim line — same pose lead as server predictedFirePose
 * (pos via vx/vy, aim via av) so telegraph matches the rf beam while spinning.
 */
function resolveRailChargePose(owner) {
  if (owner === myId) {
    const me = localView();
    const lead = shootPredictLeadTicks();
    const aLead = shootPredictAngleLeadTicks();
    const av = Number.isFinite(player.av) ? player.av : 0;
    let x = me.x + (player.vx || 0) * lead;
    let y = me.y + (player.vy || 0) * lead;
    if (x < 0) x += W; else if (x > W) x -= W;
    if (y < 0) y += H; else if (y > H) y -= H;
    // Angle from sim + lead (not softErr nose) — matches server fire / flashlight cone.
    return { x, y, angle: player.angle + av * aLead };
  }
  return resolveFxShooterPose(owner);
}

function drawRailCharges() {
  if (!railCharges.size) return;
  const now = performance.now();
  const range = 3000;
  for (const [owner, ch] of railCharges) {
    const until = ch && ch.until != null ? ch.until : ch;
    const start = ch && ch.start != null ? ch.start : until - 500;
    const ms = ch && ch.ms != null ? ch.ms : Math.max(1, until - start);
    if (now >= until) continue;
    const pose = resolveRailChargePose(owner);
    if (!pose) continue;
    const x = pose.x, y = pose.y, angle = pose.angle;
    const m = shipMuzzle(x, y, angle);
    // Charge 0 → 1; when t hits 1 the server fires the rail.
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    // Width 7 → 0 over the charge; at 0 the shot lands.
    const width = Math.max(0, Math.round(7 * (1 - t)));

    // Aim telegraph: blend toward the owner's shoot color as charge completes.
    const base = ownerShootColor(owner);
    const col = [
      0.45 + (base[0] - 0.45) * t,
      0.85 + (base[1] - 0.85) * t,
      1.0 + (base[2] - 1.0) * t
    ];

    // Solid filled disc on the tip while charging (grows with load).
    const discR = Math.max(2, RAIL_CHARGE_DISC_R * (0.25 + 0.75 * t));
    drawFilledPoly(circleVerts(m.x, m.y, discR, 28), col, 1);

    if (width > 0) {
      const x1 = m.x + m.c * range;
      const y1 = m.y + m.s * range;
      drawThickSegment(m.x, m.y, x1, y1, width, col);
    }
  }
}

function drawRailBeams() {
  for (const b of railBeams) {
    const col = ownerHasDamagePowerup(b.owner) ? damageRainbowColor() : ownerShootColor(b.owner);
    drawThickSegment(b.x0, b.y0, b.x1, b.y1, b.width || 4 * RES_SCALE, col);
  }
}

function drawThrustBeams() {
  // Thruster melee no longer draws a ray (see emitThrustFx melee tint).
}

function drawLaserBeams() {
  // Stable width within a frame.
  const width = (2 + ((performance.now() / 40 | 0) % 5)) * RES_SCALE;
  // Local laser: from local ship; range from shoot-type at burst start.
  const localOn = performance.now() < localLaserUntil && localLaserClip;
  if (localOn) {
    const me = localView();
    const m = shipMuzzle(me.x, me.y, me.angle);
    const segs = localLaserSegments(m.x, m.y, m.c, m.s, localLaserClip.range);
    for (const s of segs) {
      const col = ownerHasDamagePowerup(myId) ? damageRainbowColor() : localLaserClip.color;
      drawThickSegment(s[0], s[1], s[2], s[3], width, col);
    }
    syncLaserSfx(!!localLaserClip.hum);
  } else {
    if (performance.now() >= localLaserUntil) localLaserClip = null;
    syncLaserSfx(false);
  }
  for (const [owner, rl] of remoteLasers) {
    const pose = resolveFxShooterPose(owner);
    if (!pose) continue;
    const m = shipMuzzle(pose.x, pose.y, pose.angle);
    const col = ownerHasDamagePowerup(owner)
      ? damageRainbowColor()
      : ownerShootColor(owner);
    drawThickSegment(
      m.x, m.y,
      m.x + m.c * rl.len,
      m.y + m.s * rl.len,
      width,
      col
    );
  }
  drawRailCharges();
  drawRailBeams();
  drawThrustBeams();
}

function drawHitscanDebug() {
  if (cv('cl_hitscan') <= 0 || !hitLasers.length) return;
  const now = performance.now();
  for (const h of hitLasers) {
    const life = Math.max(0, (h.until - now) / 700);
    const a = 0.35 + life * 0.55;
    const mark = h.hit === 1 ? COL.remote : (h.hit === 2 || h.hit === 3) ? COL.asteroid : COL.ghost;
    drawAlphaSegment(h.x0, h.y0, h.x1, h.y1, COL.debug, a);
    const r = (4 + (h.wpn === 'railgun' ? 3 : 0)) * RES_SCALE;
    drawLines(circleVerts(h.x1, h.y1, r, 14), mark, gl.LINE_LOOP, a);
    drawLines(
      [h.x1 - r * 1.4, h.y1, h.x1 + r * 1.4, h.y1, h.x1, h.y1 - r * 1.4, h.x1, h.y1 + r * 1.4],
      mark,
      gl.LINES,
      a
    );
  }
}

function pushHitscanDebug(x0, y0, x1, y1, hitKind, wpn) {
  hitLasers.push({
    x0, y0, x1, y1,
    hit: hitKind | 0,
    wpn: wpn || 'laser',
    until: performance.now() + 700
  });
  if (hitLasers.length > 48) hitLasers.splice(0, hitLasers.length - 48);
}

function pruneBullets() {
  for (const [id, b] of bullets) {
    const p = bulletTrueAt(b);
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
      if (b.type === 'rocket' || b.type === 'enemyRocket') stopRocketTravelSfx(id);
      bullets.delete(id);
    }
  }
}

function asteroidAgeTicks(a) {
  const freeze = worldFreezeClock();
  const now = freeze || serverNow();
  return Math.max(0, (now - a.spawnSt) / 1000 * TPS);
}

/** Smoothed draw lead (ticks) so rocks sit on the local ship timeline. */
let asteroidTuneLead = 0;
let asteroidTuneLastMs = 0;

/** Target lead ≈ ship predict amount: one-way latency − cmd delay. */
function asteroidTuneTargetLead() {
  if ((cv('cl_asteroid_tune') | 0) === 0) return 0;
  const oneWayTicks = (Math.max(0, pingMs) * 0.5) / TICK_MS;
  return Math.max(0, Math.min(8, oneWayTicks - adaptiveInputDelay()));
}

function tickAsteroidTuneLead(now) {
  const target = asteroidTuneTargetLead();
  if (!(now > 0)) now = performance.now();
  const dt = asteroidTuneLastMs ? Math.min(0.05, (now - asteroidTuneLastMs) / 1000) : 0.016;
  asteroidTuneLastMs = now;
  if ((cv('cl_asteroid_tune') | 0) === 0) {
    asteroidTuneLead = 0;
    return;
  }
  // ~8/s toward target — tracks ping without sliding rocks every sample.
  const k = 1 - Math.exp(-8 * dt);
  asteroidTuneLead += (target - asteroidTuneLead) * k;
  if (Math.abs(asteroidTuneLead - target) < 0.01) asteroidTuneLead = target;
}

/** NTP age + optional predict lead (cl_asteroid_tune). */
function asteroidDrawAgeTicks(a) {
  return asteroidAgeTicks(a) + asteroidTuneLead;
}

/** Bake live poses into spawn clocks at `now` so freeze/unfreeze doesn't jump rocks. */
function rebaseAsteroidsToTime(now) {
  for (const a of asteroids.values()) {
    const age = Math.max(0, (now - a.spawnSt) / 1000 * TPS);
    a.spawnX = a.spawnX + a.vx * age;
    a.spawnY = a.spawnY + a.vy * age;
    a.spawnAngle = a.spawnAngle + a.spin * age;
    a.spawnSt = now;
  }
}

function replaceAsteroidsFromRows(rows) {
  asteroids.clear();
  asteroidGhosts = [];
  if (!rows) return;
  for (const row of rows) addAsteroid(unpackAsteroid(row));
}

function asteroidOffScreenAt(a, x, y) {
  const m = (a.r || 0) + 2;
  return x < -m || x > W + m || y < -m || y > H + m;
}

function oppositeEdgeFromExitLocal(a, x, y) {
  const m = (a.r || 0) + 2;
  if (x < -m) return 1;
  if (x > W + m) return 0;
  if (y < -m) return 3;
  if (y > H + m) return 2;
  return null;
}

const MEDIUM_ASTEROID_MAX = 7;

function countLocalMediumAsteroids() {
  let n = 0;
  for (const a of asteroids.values()) {
    // Match server: center marker rock does not count toward the medium cap.
    if (a.size === 'medium' && !a.centerRock) n++;
  }
  return n;
}

/** Mirror server edge-teleport so rocks don't stay invisible for a full RTT.
 *  World rocks: disabled while sv_portal is on (server twins own the wrap).
 *  Player meteor-gun shots always use classic teleport prediction (no twins). */
function predictAsteroidEdgeTeleports() {
  const portalOn = (cv('sv_portal') | 0) !== 0;
  const now = serverNow();
  let mediumCount = countLocalMediumAsteroids();
  for (const a of asteroids.values()) {
    // With portals on, only predict player-shot meteors (no twins for those).
    if (portalOn && !a.playerShot) continue;
    // PvP smalls never predict-wrap. Waves smalls + player shots share wrap path.
    if (a.size === 'small' && !practiceMode && !a.playerShot) continue;
    if (a.portal) continue;
    const age = asteroidDrawAgeTicks(a);
    let x = a.spawnX + a.vx * age;
    let y = a.spawnY + a.vy * age;
    let angle = a.spawnAngle + a.spin * age;
    const off = asteroidOffScreenAt(a, x, y);

    if (a.entered == null) a.entered = !off;

    if (!a.entered) {
      if (!off) {
        a.entered = true;
        a.spawnX = x;
        a.spawnY = y;
        a.spawnAngle = angle;
        a.spawnSt = now;
      }
      continue;
    }

    if (!off) continue;

    // One edge teleport only — further exits wait for server cull (`ad`).
    // Meteor-gun shots always limited; wave rocks only in practice.
    if ((a.playerShot || practiceMode) && asteroidClientWrapsExhausted(a)) continue;

    // Over the medium cap: do NOT delete locally — wait for server `ad`.
    // Local deletes caused invisible colliders (server still had the rock; ghosts drew a circle).
    if (a.size === 'medium' && !a.centerRock && mediumCount > MEDIUM_ASTEROID_MAX) {
      continue;
    }

    const side = oppositeEdgeFromExitLocal(a, x, y);
    const margin = (a.r || 16) + 8;
    let nx = x, ny = y;
    if (side === 0) nx = -margin;
    else if (side === 1) nx = W + margin;
    else if (side === 2) ny = -margin;
    else if (side === 3) ny = H + margin;
    else {
      if (Math.abs(a.vx) >= Math.abs(a.vy)) nx = a.vx < 0 ? W + margin : -margin;
      else ny = a.vy < 0 ? H + margin : -margin;
    }
    a.spawnX = nx;
    a.spawnY = ny;
    a.spawnAngle = angle;
    a.spawnSt = now;
    a.entered = false;
    clearAsteroidGridIron(a);
    if (a.playerShot || practiceMode) a.edgeWraps = (a.edgeWraps | 0) + 1;
  }
}

function asteroidAt(a) {
  const age = asteroidDrawAgeTicks(a);
  return {
    x: a.spawnX + a.vx * age,
    y: a.spawnY + a.vy * age,
    angle: a.spawnAngle + a.spin * age,
    pts: a.pts,
    big: a.big,
    vx: a.vx,
    vy: a.vy
  };
}

/* ========== Solo enemies ========== */
const ENEMY_WANDER_SPEED = 1.35 * RES_SCALE;
const ENEMY_ARRIVE_R = 10 * RES_SCALE;
const ENEMY_TURN_MAX = (2 * Math.PI) / 180;
const ENEMY_MOVE_DESTINATION = 'destination';
const ENEMY_MOVE_DESTINATION_SMOOTH = 'destinationSmooth';
/** Match server ENEMY_R for laser/hitscan. */
const ENEMY_R = {
  common: 9 * RES_SCALE,
  ufo: 11 * RES_SCALE,
  carrier: 12 * RES_SCALE
};

function enemyHitR(e) {
  if (!e) return ENEMY_R.common;
  return ENEMY_R[e.kind] || ENEMY_R.common;
}

function enemyMoveTypeOf(e) {
  return e && e.move === ENEMY_MOVE_DESTINATION_SMOOTH
    ? ENEMY_MOVE_DESTINATION_SMOOTH
    : ENEMY_MOVE_DESTINATION;
}

function enemyAngleDeltaToward(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function enemyTurnAngleToward(from, to, maxTurn) {
  const d = enemyAngleDeltaToward(from, to);
  if (d > maxTurn) return from + maxTurn;
  if (d < -maxTurn) return from - maxTurn;
  return from + d;
}

function unpackEnemy(row) {
  const kind = row[1] === 'ufo' ? 'ufo' : row[1] === 'carrier' ? 'carrier' : 'common';
  const spawnX = row[2];
  const spawnY = row[3];
  const tx = row[4];
  const ty = row[5];
  const spawnSt = row[6];
  const hp = row[7] | 0;
  const weapon = row[8] === 'laser' || row[8] === 'plasma' || row[8] === 'rail' ? row[8] : '';
  const ang = row[9] != null ? +row[9] : Math.atan2(ty - spawnY, tx - spawnX);
  const move = row[10] === ENEMY_MOVE_DESTINATION ? ENEMY_MOVE_DESTINATION : ENEMY_MOVE_DESTINATION_SMOOTH;
  const vx = row[11] != null ? +row[11] : 0;
  const vy = row[12] != null ? +row[12] : 0;
  const x = row[13] != null ? +row[13] : spawnX;
  const y = row[14] != null ? +row[14] : spawnY;
  const dir = row[15] != null ? +row[15] : ang;
  const dx = tx - spawnX;
  const dy = ty - spawnY;
  const dist = Math.hypot(dx, dy);
  const inv = dist > 1e-6 ? 1 / dist : 0;
  const useSnapVel = move === ENEMY_MOVE_DESTINATION_SMOOTH || (row[11] != null && row[12] != null);
  return {
    id: row[0] | 0,
    kind,
    weapon,
    move,
    spawnX,
    spawnY,
    x,
    y,
    tx,
    ty,
    spawnSt,
    travelDist: dist,
    vx: useSnapVel ? vx : dx * inv * ENEMY_WANDER_SPEED,
    vy: useSnapVel ? vy : dy * inv * ENEMY_WANDER_SPEED,
    angle: ang,
    dir,
    hp,
    enteredPlay: true
  };
}

function addEnemy(e) {
  enemies.set(e.id, e);
}

function applyEnemyUpdate(row) {
  const id = row[0] | 0;
  const e = unpackEnemy(row);
  enemies.set(id, e);
}

function applyEnemySnapList(list, st) {
  if (!list || !list.length) return;
  const snapSt = st || Date.now();
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const id = row[0] | 0;
    seen.add(id);
    const kind = row[1] === 'ufo' ? 'ufo' : row[1] === 'carrier' ? 'carrier' : 'common';
    const move = row[11] === ENEMY_MOVE_DESTINATION ? ENEMY_MOVE_DESTINATION : ENEMY_MOVE_DESTINATION_SMOOTH;
    const weapon = row[10] === 'laser' || row[10] === 'plasma' || row[10] === 'rail' ? row[10] : '';
    const angle = +row[6];
    const dir = row[12] != null ? +row[12] : angle;
    let e = enemies.get(id);
    if (!e) {
      e = { id, kind };
      enemies.set(id, e);
    }
    e.kind = kind;
    e.weapon = weapon;
    e.move = move;
    e.x = +row[2];
    e.y = +row[3];
    e.vx = +row[4];
    e.vy = +row[5];
    e.angle = angle;
    e.dir = dir;
    e.tx = +row[7];
    e.ty = +row[8];
    e.hp = row[9] | 0;
    e.enteredPlay = !!(row[13] | 0);
    e.spawnX = e.x;
    e.spawnY = e.y;
    e.spawnSt = snapSt;
    e.travelDist = Math.hypot(e.tx - e.spawnX, e.ty - e.spawnY);
  }
}

function applyEnemyHp(id, hp) {
  const e = enemies.get(id | 0);
  if (e) e.hp = hp | 0;
}

function removeEnemy(id, x, y, silent) {
  clearEnemyCharge(id);
  clearEnemyBank(id);
  enemyDrawBank.delete(id | 0);
  shipSmokeLeaks.delete(enemySmokeLeakId(id));
  const e = enemies.get(id);
  enemies.delete(id);
  if (!silent && e) {
    const col = e.kind === 'ufo' ? COL.enemyUfo
      : e.kind === 'carrier' ? COL.enemyCarrier
      : COL.enemy;
    const pose = enemyAt(e);
    const px = x != null ? x : pose.x;
    const py = y != null ? y : pose.y;
    pushFxRing(px, py, col, { r0: 4, r1: 28, life: 320 });
    emitParticles({
      x: px, y: py,
      count: 14,
      speed: 90 * RES_SCALE,
      speedSpread: 50 * RES_SCALE,
      direction: 0,
      spread: Math.PI * 2,
      size: 2.5 * RES_SCALE,
      sizeSpread: 1.2 * RES_SCALE,
      lifetime: 0.28,
      color: col,
      drag: 2.5
    });
    playSfx(SFX.explosion, { vol: 0.55, pool: 4 });
  }
}

function enemyAgeTicks(e) {
  const freeze = worldFreezeClock();
  const now = freeze || serverNow();
  return Math.max(0, (now - e.spawnSt) / 1000 * TPS);
}

/** One client tick of destinationSmooth (mirrors server; no random retarget). */
function stepEnemyDestinationSmoothLocal(state) {
  const dx = state.tx - state.x;
  const dy = state.ty - state.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ENEMY_ARRIVE_R) {
    state.x = state.tx;
    state.y = state.ty;
    state.vx = 0;
    state.vy = 0;
    return;
  }
  const desired = Math.atan2(dy, dx);
  state.dir = enemyTurnAngleToward(state.dir, desired, ENEMY_TURN_MAX);
  state.vx = Math.cos(state.dir) * ENEMY_WANDER_SPEED;
  state.vy = Math.sin(state.dir) * ENEMY_WANDER_SPEED;
  state.x += state.vx;
  state.y += state.vy;
  state.angle = state.dir;
  if (state.enteredPlay) {
    if (state.x < 8) state.x = 8;
    if (state.x > W - 8) state.x = W - 8;
    if (state.y < 8) state.y = 8;
    if (state.y > H - 8) state.y = H - 8;
  } else if (state.x >= 8 && state.x <= W - 8 && state.y >= 8 && state.y <= H - 8) {
    state.enteredPlay = true;
  }
}

/** Pose from last ef/eu/es. destinationSmooth simulates ticks; destination dead-reckons. */
function enemyAt(e) {
  if (enemyMoveTypeOf(e) === ENEMY_MOVE_DESTINATION_SMOOTH) {
    const state = {
      x: e.x != null ? e.x : e.spawnX,
      y: e.y != null ? e.y : e.spawnY,
      dir: e.dir != null && Number.isFinite(e.dir) ? e.dir : e.angle,
      angle: e.angle,
      tx: e.tx,
      ty: e.ty,
      vx: e.vx || 0,
      vy: e.vy || 0,
      enteredPlay: e.enteredPlay !== false
    };
    const steps = Math.min(90, Math.floor(enemyAgeTicks(e)));
    for (let i = 0; i < steps; i++) stepEnemyDestinationSmoothLocal(state);
    return {
      x: state.x,
      y: state.y,
      angle: state.angle,
      vx: state.vx,
      vy: state.vy,
      kind: e.kind,
      hp: e.hp
    };
  }
  const age = enemyAgeTicks(e);
  const traveled = ENEMY_WANDER_SPEED * age;
  if (traveled >= (e.travelDist || 0)) {
    return {
      x: e.tx,
      y: e.ty,
      angle: e.angle,
      vx: 0,
      vy: 0,
      kind: e.kind,
      hp: e.hp
    };
  }
  return {
    x: e.spawnX + e.vx * age,
    y: e.spawnY + e.vy * age,
    angle: e.angle,
    vx: e.vx || 0,
    vy: e.vy || 0,
    kind: e.kind,
    hp: e.hp
  };
}

/** Common enemy = Elite Krait hull (slightly smaller than player). */
const ENEMY_KRAIT_SCALE = 0.85;
const ENEMY_COMMON_MESH = (() => {
  const src = getShipMeshById('krait');
  const s = ENEMY_KRAIT_SCALE;
  return {
    verts: (src.verts || []).map((v) => [v[0] * s, v[1] * s, v[2] * s]),
    faces: src.faces || [],
    edges: src.edges || []
  };
})();

/** UFO = Elite Adder hull (a bit larger than commons). */
const ENEMY_ADDER_SCALE = 1.05;
const ENEMY_UFO_MESH = (() => {
  const src = getShipMeshById('adder');
  const s = ENEMY_ADDER_SCALE;
  return {
    verts: (src.verts || []).map((v) => [v[0] * s, v[1] * s, v[2] * s]),
    faces: src.faces || [],
    edges: src.edges || []
  };
})();

function drawEnemyShipMesh(mesh, x, y, angle, color, bank, id) {
  const { xy, depth } = projectMesh3D(mesh.verts, x, y, angle, bank || 0);
  drawShipMeshFacesTex(xy, depth, mesh, color, id != null ? id : 0);
  const edgeW = 1.125 * RES_SCALE;
  for (const e of mesh.edges) {
    drawThickSegment(
      xy[e[0] * 2], xy[e[0] * 2 + 1],
      xy[e[1] * 2], xy[e[1] * 2 + 1],
      edgeW, color
    );
  }
}

/** Bank from heading change rate (enemies have no av). */
const enemyAngHist = new Map(); // id -> { ang, t, rate }
const enemyBankSmooth = new Map();

function enemyBankSmoothed(id, angle, dt) {
  const now = performance.now();
  const key = id | 0;
  let prev = enemyAngHist.get(key);
  let turnRate = 0; // rad/s signed
  if (prev && Number.isFinite(prev.ang)) {
    let d = angle - prev.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const elapsed = Math.max(0.008, (now - prev.t) * 0.001);
    const inst = d / elapsed;
    turnRate = prev.rate != null ? prev.rate * 0.72 + inst * 0.28 : inst;
  }
  enemyAngHist.set(key, { ang: angle, t: now, rate: turnRate });
  // ~1 rad/s turn → strong bank; clamp to ship bank max.
  const target = Math.max(-SHIP_BANK_MAX, Math.min(SHIP_BANK_MAX, -turnRate * 0.7));
  let cur = enemyBankSmooth.get(key);
  if (cur == null || !Number.isFinite(cur)) cur = target;
  const k = 1 - Math.exp(-12 * Math.max(0.001, dt || 0.016));
  cur += (target - cur) * k;
  enemyBankSmooth.set(key, cur);
  return cur;
}

function clearEnemyBank(id) {
  const key = id | 0;
  enemyAngHist.delete(key);
  enemyBankSmooth.delete(key);
}

function drawEnemyCommon(x, y, angle, color, id, dt) {
  const bank = enemyBankSmoothed(id, angle, dt);
  drawEnemyShipMesh(ENEMY_COMMON_MESH, x, y, angle, color, bank, id);
  return bank;
}

/** Low-poly unit sphere for common-enemy muzzle charge orbs. */
function buildChargeSphereMesh(lonSeg, latSeg) {
  const lonN = Math.max(6, lonSeg | 0);
  const latN = Math.max(4, latSeg | 0);
  const verts = [[0, 0, 1], [0, 0, -1]];
  for (let la = 1; la < latN; la++) {
    const v = (la / latN) * Math.PI;
    const z = Math.cos(v);
    const r = Math.sin(v);
    for (let lo = 0; lo < lonN; lo++) {
      const u = (lo / lonN) * Math.PI * 2;
      verts.push([Math.cos(u) * r, Math.sin(u) * r, z]);
    }
  }
  const faces = [];
  const edges = [];
  const edgeKey = new Set();
  const addEdge = (a, b) => {
    const i = a < b ? a : b;
    const j = a < b ? b : a;
    const k = i + ',' + j;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push([i, j]);
  };
  const ring = (la) => 2 + (la - 1) * lonN;
  // Top cap
  for (let lo = 0; lo < lonN; lo++) {
    const a = ring(1) + lo;
    const b = ring(1) + ((lo + 1) % lonN);
    faces.push([0, a, b]);
    addEdge(0, a);
    addEdge(a, b);
  }
  // Bands
  for (let la = 1; la < latN - 1; la++) {
    const r0 = ring(la);
    const r1 = ring(la + 1);
    for (let lo = 0; lo < lonN; lo++) {
      const a = r0 + lo;
      const b = r0 + ((lo + 1) % lonN);
      const c = r1 + lo;
      const d = r1 + ((lo + 1) % lonN);
      faces.push([a, c, b], [b, c, d]);
      addEdge(a, b);
      addEdge(a, c);
      addEdge(b, d);
    }
  }
  // Bottom cap
  const last = ring(latN - 1);
  for (let lo = 0; lo < lonN; lo++) {
    const a = last + lo;
    const b = last + ((lo + 1) % lonN);
    faces.push([1, b, a]);
    addEdge(1, a);
    addEdge(a, b);
  }
  return { verts, faces, edges };
}

const ENEMY_CHARGE_SPHERE = buildChargeSphereMesh(8, 5);
/** Krait forward wing-tip cannons (mesh verts 5/6, already enemy-scaled). */
const ENEMY_COMMON_GUNS = [
  ENEMY_COMMON_MESH.verts[5].slice(),
  ENEMY_COMMON_MESH.verts[6].slice()
];
const COL_CHARGE_RED = [1.0, 0.12, 0.1];
const enemyCharges = new Map(); // id -> { start, until, ms }
/** Last bank used while drawing commons — charge orbs match hull roll. */
const enemyDrawBank = new Map();

function beginEnemyCharge(id, ms) {
  const dur = Math.max(200, ms | 0 || 1000);
  const now = performance.now();
  enemyCharges.set(id | 0, { start: now, until: now + dur, ms: dur });
}

function clearEnemyCharge(id) {
  enemyCharges.delete(id | 0);
}

function localToWorldBanked(lx, ly, lz, cx, cy, yaw, bank) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const cb = Math.cos(bank || 0);
  const sb = Math.sin(bank || 0);
  const y1 = ly * cb - lz * sb;
  const z1 = ly * sb + lz * cb;
  return {
    x: cx + lx * ca - y1 * sa,
    y: cy + lx * sa + y1 * ca - z1 * SHIP3D_LIFT
  };
}

function drawEnemyChargeSphere(cx, cy, radius, yaw, spin, color, alpha) {
  const mesh = ENEMY_CHARGE_SPHERE;
  const s = Math.max(0.4, radius);
  const verts = mesh.verts.map((v) => [v[0] * s, v[1] * s, v[2] * s]);
  const { xy, depth } = projectMesh3D(verts, cx, cy, yaw, spin);
  const faces = mesh.faces;
  const order = faces.map((f, i) => {
    const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    return { i, z };
  });
  order.sort((a, b) => a.z - b.z);
  let zMin = Infinity, zMax = -Infinity;
  for (const o of order) {
    if (o.z < zMin) zMin = o.z;
    if (o.z > zMax) zMax = o.z;
  }
  const zSpan = Math.max(1e-4, zMax - zMin);
  const base = color || COL_CHARGE_RED;
  const fillA = alpha == null ? 0.35 : alpha;
  // Additive emission fill.
  for (const o of order) {
    const f = faces[o.i];
    const ax = xy[f[1] * 2] - xy[f[0] * 2];
    const ay = xy[f[1] * 2 + 1] - xy[f[0] * 2 + 1];
    const bx = xy[f[2] * 2] - xy[f[0] * 2];
    const by = xy[f[2] * 2 + 1] - xy[f[0] * 2 + 1];
    if (ax * by - ay * bx >= 0) continue;
    const shade = 0.4 + 0.6 * ((o.z - zMin) / zSpan);
    const col = [
      Math.min(1, base[0] * shade + 0.15),
      Math.min(1, base[1] * shade),
      Math.min(1, base[2] * shade)
    ];
    drawFilledPoly([
      xy[f[0] * 2], xy[f[0] * 2 + 1],
      xy[f[1] * 2], xy[f[1] * 2 + 1],
      xy[f[2] * 2], xy[f[2] * 2 + 1]
    ], col, fillA, true);
  }
  // Bright red wireframe — 3 px.
  const edgeW = 3;
  const edgeCol = [1, 0.2, 0.15];
  for (const e of mesh.edges) {
    drawThickSegment(
      xy[e[0] * 2], xy[e[0] * 2 + 1],
      xy[e[1] * 2], xy[e[1] * 2 + 1],
      edgeW, edgeCol, Math.min(1, fillA + 0.45)
    );
  }
}

function drawEnemyCommonCharges() {
  if (!enemyCharges.size) return;
  const now = performance.now();
  for (const [id, ch] of enemyCharges) {
    if (!ch || now >= ch.until) {
      enemyCharges.delete(id);
      continue;
    }
    const e = enemies.get(id);
    if (!e || e.kind !== 'common' || (e.hp | 0) <= 0) {
      enemyCharges.delete(id);
      continue;
    }
    const p = enemyAt(e);
    const bank = enemyDrawBank.get(id | 0) || 0;
    const t = Math.min(1, Math.max(0, (now - ch.start) / Math.max(1, ch.ms)));
    // Big → small (ease-in), then hold tiny while shaking.
    const shrink = t * t;
    const rBig = 5.2 * RES_SCALE;
    const rSmall = 1.15 * RES_SCALE;
    let r = rBig + (rSmall - rBig) * shrink;
    let shake = 0;
    if (t > 0.58) {
      const u = (t - 0.58) / 0.42;
      shake = u * u * 2.4 * RES_SCALE;
      r *= 1 - 0.08 * Math.sin(now * 0.09);
    }
    const alpha = 0.22 + 0.55 * t;
    const spin = now * 0.007 + id * 1.7;
    for (let g = 0; g < ENEMY_COMMON_GUNS.length; g++) {
      const gun = ENEMY_COMMON_GUNS[g];
      let w = localToWorldBanked(gun[0], gun[1], gun[2], p.x, p.y, p.angle, bank);
      if (shake > 0) {
        const ph = now * 0.055 + id * 2.1 + g * 1.3;
        w = {
          x: w.x + Math.cos(ph) * shake,
          y: w.y + Math.sin(ph * 1.37) * shake
        };
      }
      drawEnemyChargeSphere(w.x, w.y, r, p.angle, spin + g * 0.9, COL_CHARGE_RED, alpha);
    }
    // Late-phase core flash between the guns.
    if (t > 0.75) {
      const flash = (t - 0.75) / 0.25;
      const g0 = ENEMY_COMMON_GUNS[0];
      const g1 = ENEMY_COMMON_GUNS[1];
      const mid = localToWorldBanked(
        (g0[0] + g1[0]) * 0.5,
        (g0[1] + g1[1]) * 0.5,
        (g0[2] + g1[2]) * 0.5,
        p.x, p.y, p.angle, bank
      );
      drawFilledPoly(
        circleVerts(mid.x, mid.y, (1.2 + flash * 2.2) * RES_SCALE, 16),
        COL_CHARGE_RED,
        0.2 + flash * 0.55,
        true
      );
    }
  }
}

function drawEnemyUfo(x, y, angle, color, id, dt) {
  const bank = enemyBankSmoothed(id, angle, dt);
  drawEnemyShipMesh(ENEMY_UFO_MESH, x, y, angle, color, bank, id);
}

function carrierWeaponColor(weapon) {
  if (weapon === 'laser') return COL.laser;
  if (weapon === 'plasma') return COL.plasma;
  if (weapon === 'rail') return COL.railgun;
  return COL.enemyCarrier;
}

function drawEnemyCarrier(x, y, angle, weapon) {
  const hull = COL.enemyCarrier;
  const accent = carrierWeaponColor(weapon);
  const s = 10 * RES_SCALE;
  const c = Math.cos(angle), sn = Math.sin(angle);
  // Hex hull
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = angle + (i / 6) * Math.PI * 2;
    hex.push(x + Math.cos(a) * s, y + Math.sin(a) * s * 0.72);
  }
  drawFilledPoly(hex, hull, 0.4);
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    drawThickSegment(hex[i * 2], hex[i * 2 + 1], hex[j * 2], hex[j * 2 + 1], 1.3 * RES_SCALE, hull);
  }
  // Weapon pod on nose
  const nx = x + c * s * 0.95;
  const ny = y + sn * s * 0.95;
  drawFilledPoly(circleVerts(nx, ny, 3.2 * RES_SCALE, 10), accent, 0.85);
  drawThickSegment(x, y, nx, ny, 2.2 * RES_SCALE, accent);
}

function drawEnemies(dt) {
  enemyDrawBank.clear();
  for (const e of enemies.values()) {
    const p = enemyAt(e);
    const id = e.id | 0;
    const vs = voidShakeOffset('e', id);
    const x = p.x + vs.x;
    const y = p.y + vs.y;
    if (p.kind === 'ufo') drawEnemyUfo(x, y, p.angle, COL.enemyUfo, id, dt);
    else if (p.kind === 'carrier') drawEnemyCarrier(x, y, p.angle, e.weapon);
    else {
      const bank = drawEnemyCommon(x, y, p.angle, COL.enemy, id, dt);
      enemyDrawBank.set(id, bank);
    }
  }
  drawEnemyCommonCharges();
}

/* ========== Seeded coins (match server buildCoinBurst — death xy only) ========== */
function coinSeedFromXY(x, y) {
  const ix = Math.floor(x * 100) | 0;
  const iy = Math.floor(y * 100) | 0;
  let h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function coinMulberry32(seed) {
  let a = seed >>> 0;
  return function coinRand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCoinId(seed, i) {
  return ((seed >>> 0) ^ Math.imul((i + 1) | 0, 0x9E3779B9)) >>> 0;
}

/** Unique per burst so overlapping deaths still spawn every coin. */
let coinBurstSerial = 0;

function buildCoinBurst(x, y, count, serial) {
  const n = Math.max(0, count | 0);
  const seed = (coinSeedFromXY(x, y) ^ Math.imul(((serial | 0) + 1) | 0, 0x85EBCA6B)) >>> 0;
  const rng = coinMulberry32(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2 + rng() * 0.85;
    const rad = (3 + rng() * 22) * RES_SCALE;
    let cx = x + Math.cos(ang) * rad;
    let cy = y + Math.sin(ang) * rad;
    if (cx < COIN_SPAWN_PAD) cx = COIN_SPAWN_PAD;
    if (cx > W - COIN_SPAWN_PAD) cx = W - COIN_SPAWN_PAD;
    if (cy < COIN_SPAWN_PAD) cy = COIN_SPAWN_PAD;
    if (cy > H - COIN_SPAWN_PAD) cy = H - COIN_SPAWN_PAD;
    // Drift from this coin's spawn pose (must match server).
    const vSeed = (coinSeedFromXY(cx, cy) ^ Math.imul((i + 1) | 0, 0x9E3779B9) ^ seed) >>> 0;
    const vrng = coinMulberry32(vSeed);
    const dir = vrng() * Math.PI * 2;
    const spd = 0.025 + vrng() * (0.125 - 0.025);
    list.push({
      id: makeCoinId(seed, i),
      x: cx,
      y: cy,
      r: COIN_SPAWN_PAD,
      vx: Math.cos(dir) * spd,
      vy: Math.sin(dir) * spd
    });
  }
  return list;
}

/** Burst of visual 3D ore coins: pop outward, then fly to the destroyer. */
function spawnCoinBurstToPlayer(x, y, count, playerId) {
  const pid = playerId | 0;
  const n = Math.max(0, count | 0);
  if (!pid || n <= 0) return;
  const serial = (coinBurstSerial++) >>> 0;
  const burst = buildCoinBurst(x, y, n, serial);
  for (let i = 0; i < burst.length; i++) {
    const c = burst[i];
    if (coins.has(c.id)) continue;
    const ang = Math.atan2(c.y - y, c.x - x) || ((i / Math.max(1, n)) * Math.PI * 2);
    const kick = (140 + (i % 5) * 35) * RES_SCALE;
    c.vx = Math.cos(ang) * kick;
    c.vy = Math.sin(ang) * kick;
    c.attractTo = pid;
    c.attractDelay = COIN_BURST_DELAY * (0.75 + (i % 4) * 0.12);
    c.attractVx = 0;
    c.attractVy = 0;
    coins.set(c.id, c);
  }
}

function clearCoins() {
  coins.clear();
}

function setLocalCoins(n) {
  localCoins = Math.max(0, n | 0);
}

function setLocalScore(n) {
  localScore = Math.max(0, n | 0);
}

function addLocalCoin(n) {
  const g = n == null ? 1 : (n | 0);
  localCoins = (localCoins | 0) + g;
  localScore = (localScore | 0) + g;
}

/* ========== Gold ore coins (small tumbling 3D chunks) ========== */
const COIN_ORE_LIFT = 0.72;
const COIN_ORE_SCALE = 2.2 * RES_SCALE;
const COIN_ORE_ALPHA = 0.5;
const COL_GOLD = [1.0, 0.84, 0.28];
const COL_GOLD_MID = [0.92, 0.62, 0.14];
const COL_GOLD_DARK = [0.45, 0.26, 0.06];
const COL_GOLD_EDGE = [1.0, 0.94, 0.62];
const COL_GOLD_GLOW = [1.0, 0.78, 0.22];

/** Irregular ore-chunk meshes (unit space). */
const COIN_ORE_MESHES = [
  {
    // Squashed octahedron — classic nugget
    verts: [
      [1.1, 0.1, 0.05], [-1.0, -0.15, 0.1], [0.15, 1.05, -0.1], [0.05, -1.0, 0.12],
      [0.2, 0.1, 0.95], [-0.1, -0.05, -1.0]
    ],
    faces: [
      [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
      [0, 5, 2], [2, 5, 1], [1, 5, 3], [3, 5, 0]
    ],
    edges: [
      [0, 2], [2, 1], [1, 3], [3, 0],
      [0, 4], [2, 4], [1, 4], [3, 4],
      [0, 5], [2, 5], [1, 5], [3, 5]
    ]
  },
  {
    // Elongated crystal shard
    verts: [
      [1.35, 0.2, 0], [-0.9, 0.55, 0.25], [-0.85, -0.6, 0.2],
      [0.3, 0.15, 0.7], [0.25, -0.1, -0.75], [-0.2, 0.05, 0.05]
    ],
    faces: [
      [0, 1, 3], [0, 3, 2], [0, 2, 4], [0, 4, 1],
      [5, 1, 4], [5, 4, 2], [5, 2, 3], [5, 3, 1]
    ],
    edges: [
      [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 3], [3, 2], [2, 4], [4, 1],
      [5, 1], [5, 2], [5, 3], [5, 4]
    ]
  },
  {
    // Chunky broken rock
    verts: [
      [0.95, 0.55, 0.4], [-0.7, 0.8, 0.15], [-0.95, -0.35, 0.45], [0.6, -0.85, 0.2],
      [0.35, 0.2, -0.9], [-0.4, -0.25, -0.75], [0.05, 0.95, -0.35]
    ],
    faces: [
      [0, 1, 6], [1, 2, 6], [0, 6, 4], [6, 2, 5], [6, 5, 4],
      [0, 4, 3], [0, 3, 2], [0, 2, 1],
      [3, 4, 5], [3, 5, 2]
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [0, 6], [1, 6], [2, 6], [4, 6], [5, 6],
      [0, 4], [3, 4], [4, 5], [5, 2], [3, 5]
    ]
  }
];

const _oreXY = new Float64Array(16);
const _oreDepth = new Float64Array(8);
const _oreFaceOrder = [];
const _oreCol = [0, 0, 0];

/** Batched coin mesh: same stride as particles (x,y,u,v,r,g,b,a). */
const COIN_MESH_STRIDE = 8;
let coinMesh = new Float32Array(65536);
const coinBuf = gl.createBuffer();

function coinMeshEnsure(floats) {
  if (coinMesh.length >= floats) return;
  let n = coinMesh.length;
  while (n < floats) n *= 2;
  coinMesh = new Float32Array(n);
}

function pushCoinVert(w, x, y, r, g, b, a) {
  const m = coinMesh;
  m[w++] = x; m[w++] = y;
  m[w++] = 0; m[w++] = 0;
  m[w++] = r; m[w++] = g; m[w++] = b; m[w++] = a;
  return w;
}

function pushCoinTri(w, x0, y0, x1, y1, x2, y2, r, g, b, a) {
  w = pushCoinVert(w, x0, y0, r, g, b, a);
  w = pushCoinVert(w, x1, y1, r, g, b, a);
  w = pushCoinVert(w, x2, y2, r, g, b, a);
  return w;
}

function pushCoinThickSeg(w, x0, y0, x1, y1, hw, r, g, b, a) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * hw;
  const ny = (dx / len) * hw;
  const ax = x0 + nx, ay = y0 + ny;
  const bx = x0 - nx, by = y0 - ny;
  const cx = x1 + nx, cy = y1 + ny;
  const dx2 = x1 - nx, dy2 = y1 - ny;
  w = pushCoinTri(w, ax, ay, bx, by, cx, cy, r, g, b, a);
  return pushCoinTri(w, bx, by, dx2, dy2, cx, cy, r, g, b, a);
}

function pushCoinGlowQuad(w, cx, cy, rad, r, g, b, a) {
  const x0 = cx - rad, y0 = cy - rad;
  const x1 = cx + rad, y1 = cy - rad;
  const x2 = cx + rad, y2 = cy + rad;
  const x3 = cx - rad, y3 = cy + rad;
  w = pushCoinTri(w, x0, y0, x1, y1, x2, y2, r, g, b, a);
  return pushCoinTri(w, x0, y0, x2, y2, x3, y3, r, g, b, a);
}

function projectCoinOre(verts, cx, cy, scale, yaw, pitch, roll, outXY, outDepth) {
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const r = tumbleRotateLocal(v[0] * scale, v[1] * scale, v[2] * scale, cyaw, syaw, cp, sp, cr, sr);
    outXY[i * 2] = cx + r.wx;
    outXY[i * 2 + 1] = cy + r.wy - r.wz * COIN_ORE_LIFT;
    outDepth[i] = r.wz;
  }
}

/** Append one coin's shaded faces + edge quads into the solid batch. */
function appendCoinOreSolid(c, t, w) {
  const id = c.id >>> 0;
  const mesh = COIN_ORE_MESHES[id % COIN_ORE_MESHES.length];
  const seed = id * 0.0174533;
  const yaw = t * (1.1 + (id % 7) * 0.17) + seed * 2.1;
  const pitch = t * (0.85 + (id % 5) * 0.21) + seed * 1.4;
  const roll = t * (1.35 + (id % 11) * 0.11) + seed * 0.7;
  const scale = COIN_ORE_SCALE * (0.88 + ((id >>> 3) % 5) * 0.06);

  const xy = _oreXY;
  const depth = _oreDepth;
  projectCoinOre(mesh.verts, c.x, c.y, scale, yaw, pitch, roll, xy, depth);

  const faces = mesh.faces;
  const nFaces = faces.length;
  while (_oreFaceOrder.length < nFaces) _oreFaceOrder.push({ i: 0, z: 0 });
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < nFaces; i++) {
    const f = faces[i];
    const z = (depth[f[0]] + depth[f[1]] + depth[f[2]]) / 3;
    _oreFaceOrder[i].i = i;
    _oreFaceOrder[i].z = z;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  for (let i = 1; i < nFaces; i++) {
    const key = _oreFaceOrder[i];
    let j = i - 1;
    while (j >= 0 && _oreFaceOrder[j].z > key.z) {
      _oreFaceOrder[j + 1] = _oreFaceOrder[j];
      j--;
    }
    _oreFaceOrder[j + 1] = key;
  }
  const zSpan = Math.max(1e-4, zMax - zMin);
  const pulse = 0.55 + 0.45 * Math.sin(t * 6.5 + seed * 9);

  for (let o = 0; o < nFaces; o++) {
    const f = faces[_oreFaceOrder[o].i];
    const ax = xy[f[1] * 2] - xy[f[0] * 2];
    const ay = xy[f[1] * 2 + 1] - xy[f[0] * 2 + 1];
    const bx = xy[f[2] * 2] - xy[f[0] * 2];
    const by = xy[f[2] * 2 + 1] - xy[f[0] * 2 + 1];
    if (ax * by - ay * bx >= 0) continue;
    const shade = 0.35 + 0.65 * ((_oreFaceOrder[o].z - zMin) / zSpan);
    const shine = Math.max(0, shade - 0.72) * 2.2 * pulse;
    _oreCol[0] = COL_GOLD_DARK[0] + (COL_GOLD[0] - COL_GOLD_DARK[0]) * shade;
    _oreCol[1] = COL_GOLD_DARK[1] + (COL_GOLD[1] - COL_GOLD_DARK[1]) * shade;
    _oreCol[2] = COL_GOLD_DARK[2] + (COL_GOLD[2] - COL_GOLD_DARK[2]) * shade;
    _oreCol[0] = Math.min(1, _oreCol[0] + shine * 0.55);
    _oreCol[1] = Math.min(1, _oreCol[1] + shine * 0.45);
    _oreCol[2] = Math.min(1, _oreCol[2] + shine * 0.25);
    _oreCol[0] = _oreCol[0] * 0.75 + COL_GOLD_MID[0] * 0.25 * shade;
    _oreCol[1] = _oreCol[1] * 0.75 + COL_GOLD_MID[1] * 0.25 * shade;
    _oreCol[2] = _oreCol[2] * 0.75 + COL_GOLD_MID[2] * 0.25 * shade;
    w = pushCoinTri(
      w,
      xy[f[0] * 2], xy[f[0] * 2 + 1],
      xy[f[1] * 2], xy[f[1] * 2 + 1],
      xy[f[2] * 2], xy[f[2] * 2 + 1],
      _oreCol[0], _oreCol[1], _oreCol[2], COIN_ORE_ALPHA
    );
  }

  const ew = 0.35 * RES_SCALE;
  const edges = mesh.edges;
  const er = COL_GOLD_EDGE[0], eg = COL_GOLD_EDGE[1], eb = COL_GOLD_EDGE[2];
  for (let e = 0; e < edges.length; e++) {
    const a = edges[e][0], b = edges[e][1];
    w = pushCoinThickSeg(
      w,
      xy[a * 2], xy[a * 2 + 1],
      xy[b * 2], xy[b * 2 + 1],
      ew, er, eg, eb, COIN_ORE_ALPHA
    );
  }
  return w;
}

/** All coins → 2 GPU draws (glow batch + solid batch). */
function drawCoins() {
  const n = coins.size;
  if (!n) return;
  // ~6 glow verts + ~30 face + ~72 edge verts × 8 floats ≈ 900 floats/coin
  coinMeshEnsure(n * 900);
  const t = performance.now() * 0.001;

  let w = 0;
  for (const c of coins.values()) {
    const id = c.id >>> 0;
    const seed = id * 0.0174533;
    const scale = COIN_ORE_SCALE * (0.88 + ((id >>> 3) % 5) * 0.06);
    const pulse = 0.55 + 0.45 * Math.sin(t * 6.5 + seed * 9);
    w = pushCoinGlowQuad(
      w, c.x, c.y, scale * 1.35,
      COL_GOLD_GLOW[0], COL_GOLD_GLOW[1], COL_GOLD_GLOW[2], (0.16 + 0.1 * pulse) * COIN_ORE_ALPHA
    );
  }
  const glowEnd = w;
  for (const c of coins.values()) {
    w = appendCoinOreSolid(c, t, w);
  }

  if (glowEnd > 0) {
    // Temporary: draw glow slice by copying into a view — flush from offset via sub-buffer.
    // Easier: flush glow verts first by swapping into a temp write, then solids.
    flushCoinMeshRange(0, glowEnd, true);
  }
  if (w > glowEnd) flushCoinMeshRange(glowEnd, w, false);
}

function flushCoinMeshRange(startFloat, endFloat, blended) {
  const floats = endFloat - startFloat;
  if (floats < COIN_MESH_STRIDE * 3) return;
  const vertCount = floats / COIN_MESH_STRIDE;
  gl.bindBuffer(gl.ARRAY_BUFFER, coinBuf);
  gl.bufferData(gl.ARRAY_BUFFER, coinMesh.subarray(startFloat, endFloat), gl.DYNAMIC_DRAW);
  gl.useProgram(particleProg);
  gl.enableVertexAttribArray(pAPos);
  gl.enableVertexAttribArray(pAUV);
  gl.enableVertexAttribArray(pACol);
  const stride = COIN_MESH_STRIDE * 4;
  gl.vertexAttribPointer(pAPos, 2, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(pAUV, 2, gl.FLOAT, false, stride, 8);
  gl.vertexAttribPointer(pACol, 4, gl.FLOAT, false, stride, 16);
  gl.uniform2f(pURes, W, H);
  bindSceneLightUniforms(particleLightU);
  gl.enable(gl.BLEND);
  // particleFS outputs premultiplied rgb*a — always ONE, ONE_MINUS_SRC_ALPHA
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, vertCount);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(pAUV);
  gl.disableVertexAttribArray(pACol);
}

function emitCoinCollectFx(x, y) {
  emitParticles({
    x, y,
    count: 3,
    speed: 95 * RES_SCALE,
    speedSpread: 55 * RES_SCALE,
    direction: 0,
    spread: Math.PI * 2,
    size: 2.4 * RES_SCALE,
    sizeSpread: 1.4 * RES_SCALE,
    scaleY: 1.35,
    lifetime: 0.28,
    lifetimeSpread: 0.12,
    color: COL_GOLD,
    drag: 3.2
  });
}

function coinAttractTarget(pid) {
  if (pid === myId) {
    if (player.hp <= 0) return null;
    const me = localView();
    return { x: me.x, y: me.y };
  }
  const r = remotes.get(pid);
  if (!r || r.hp <= 0) return null;
  const v = remoteView(r);
  return { x: v.x, y: v.y };
}

/** Homing visual coins — short outward pop, then suck to ship (never linger).
 *  Euclidean only — no torus / edge-teleport shortcuts. */
function updateAttractedCoins(dt) {
  if (!coins.size) return;
  const step = Math.min(0.05, dt || 0.016);
  const toRemove = [];
  for (const [id, c] of coins) {
    if (c.attractTo == null) {
      toRemove.push(id);
      continue;
    }
    if ((c.attractDelay || 0) > 0) {
      c.attractDelay = Math.max(0, c.attractDelay - step);
      // px/s outward spray (flat plane)
      c.x += (c.vx || 0) * step;
      c.y += (c.vy || 0) * step;
      c.vx *= Math.max(0, 1 - 2.2 * step);
      c.vy *= Math.max(0, 1 - 2.2 * step);
      if (c.attractDelay > 0) continue;
    }
    const tgt = coinAttractTarget(c.attractTo | 0);
    if (!tgt) {
      toRemove.push(id);
      continue;
    }
    const dx = tgt.x - c.x;
    const dy = tgt.y - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= COIN_COLLECT_R2) {
      emitCoinCollectFx(tgt.x, tgt.y);
      if ((c.attractTo | 0) === (myId | 0)) {
        playSfx(SFX.money, { vol: 0.85, pool: 8 });
      }
      toRemove.push(id);
      continue;
    }
    const d = Math.sqrt(d2) || 1;
    let spd = Math.hypot(c.attractVx || 0, c.attractVy || 0) + COIN_ATTRACT_ACCEL * step;
    if (spd > COIN_ATTRACT_MAX_SPD) spd = COIN_ATTRACT_MAX_SPD;
    const vx = (dx / d) * spd;
    const vy = (dy / d) * spd;
    c.attractVx = vx;
    c.attractVy = vy;
    c.x += vx * step;
    c.y += vy * step;
  }
  for (let i = 0; i < toRemove.length; i++) coins.delete(toRemove[i]);
}

function unpackAsteroid(row) {
  const sizeCode = row[9] | 0;
  // 2 = big, 1 = medium, 0 = small (legacy true/1 treated as big).
  const size = sizeCode >= 2 || sizeCode === true ? 'big'
    : sizeCode === 1 ? 'medium'
    : 'small';
  const specialCode = row[11] | 0;
  const special = specialCode === 1 ? 'meteor' : null;
  const shapeId = row[14] != null ? (row[14] | 0)
    : shapeIdFromPos(row[1], row[2]);
  const hueDeg = row[19];
  const hue = hueDeg != null && Number.isFinite(+hueDeg)
    ? ((((+hueDeg) % 360) + 360) % 360) / 360
    : asteroidHash01(shapeId ^ 0xc0ffee);
  return {
    id: row[0],
    spawnX: row[1],
    spawnY: row[2],
    vx: row[3],
    vy: row[4],
    spawnAngle: row[5],
    spin: row[6],
    r: row[7],
    // Network no longer sends pts — rebuild from shapeId (portal twin keeps parent id).
    pts: buildAsteroidSilhouettePts(shapeId, row[7], size),
    size,
    big: size === 'big',
    spawnSt: row[10],
    special,
    centerRock: !!(row[12] | 0),
    portal: !!(row[13] | 0),
    shapeId,
    edgeWraps: row[15] != null ? (row[15] | 0) : 0,
    edgeWrapMax: row[16] != null ? (row[16] | 0) : 1,
    playerShot: !!(row[17] | 0),
    ownerId: row[18] != null ? (row[18] | 0) : 0,
    hue
  };
}

/** Same as server — silhouette seed from spawn pose. */
function shapeIdFromPos(x, y) {
  const s = (
    Math.imul(Math.floor(x * 1024) | 0, 374761393) +
    Math.imul(Math.floor(y * 1024) | 0, 668265263)
  ) >>> 0;
  return s || 1;
}

function addAsteroid(a) {
  const age = Math.max(0, (serverNow() - a.spawnSt) / 1000 * TPS);
  const x = a.spawnX + a.vx * age;
  const y = a.spawnY + a.vy * age;
  a.entered = !asteroidOffScreenAt(a, x, y);
  // Keep server portal bit as-is (inbound twin → danger lines).
  a.portal = !!a.portal;
  clearAsteroidGridIron(a);
  asteroids.set(a.id, a);
}

function applyAsteroidWrap(row) {
  const id = row[0];
  const a = asteroids.get(id);
  if (!a) return;
  a.spawnX = row[1];
  a.spawnY = row[2];
  a.vx = row[3];
  a.vy = row[4];
  a.spawnAngle = row[5];
  a.spin = row[6];
  a.spawnSt = row[7];
  clearAsteroidGridIron(a);
  const age = Math.max(0, (serverNow() - a.spawnSt) / 1000 * TPS);
  const x = a.spawnX + a.vx * age;
  const y = a.spawnY + a.vy * age;
  a.entered = !asteroidOffScreenAt(a, x, y);
  // Portal bit from server (1 while inbound twin linked). Do not clear on enter —
  // that killed danger lines the same frame the twin became visible.
  if (row[8] != null) a.portal = !!(row[8] | 0);
  // Wave rocks + meteor-gun shots both track wrap spend; PvP world rocks ignore.
  if (practiceMode || a.playerShot) {
    if (row[9] != null) a.edgeWraps = row[9] | 0;
    else a.edgeWraps = Math.max(a.edgeWraps | 0, 1);
    if (row[10] != null) a.edgeWrapMax = row[10] | 0;
  }
}

function pruneAsteroids() {
  for (const [id, a] of asteroids) {
    const wrapSpent = (practiceMode || a.playerShot) && asteroidClientWrapsExhausted(a);
    // Meteor-gun: cull only after wrap budget spent.
    // PvP world smalls: cull off-screen. Waves: cull any size after wraps spent.
    const prune =
      (a.playerShot && wrapSpent)
      || (!a.playerShot && a.size === 'small' && (!practiceMode || wrapSpent))
      || (!a.playerShot && a.size !== 'small' && wrapSpent);
    if (!prune) continue;
    const p = asteroidAt(a);
    const m = (a.r || 8) + 24;
    if (p.x < -m || p.x > W + m || p.y < -m || p.y > H + m) {
      asteroids.delete(id);
    }
  }
}

function unpackPickup(row) {
  const code = row[7] | 0;
  let kind = 'weapon';
  let weapon = 'default';
  let powerup = null;
  if (code === 99 || code === 7) kind = 'health';
  else if (code >= PICKUP_CODE_POWERUP_BASE) {
    kind = 'powerup';
    powerup = POWERUP_TYPES[code - PICKUP_CODE_POWERUP_BASE] || 'damage';
  } else {
    weapon = WEAPON_NAMES[code - 1] || 'default';
  }
  return {
    id: row[0],
    spawnX: row[1],
    spawnY: row[2],
    vx: row[3],
    vy: row[4],
    spawnAngle: row[5],
    spin: row[6],
    kind,
    weapon,
    powerup,
    spawnSt: row[8],
    bounces: row[9] | 0
  };
}

function addPickup(u) {
  pickups.set(u.id, u);
}

function removePickup(id) {
  const u = pickups.get(id);
  if (u) {
    const p = pickupAt(u);
    emitPickupCollectFx(p.x, p.y, u.kind, u.weapon, 1, u.powerup);
  }
  pickups.delete(id);
}

function pickupAgeTicks(u) {
  return Math.max(0, (serverNow() - u.spawnSt) / 1000 * TPS);
}

function pickupAt(u) {
  const age = pickupAgeTicks(u);
  return {
    x: u.spawnX + u.vx * age,
    y: u.spawnY + u.vy * age,
    angle: u.spawnAngle + u.spin * age
  };
}

function applyPickupBounce(row) {
  const id = row[0];
  const u = pickups.get(id);
  if (!u) return;
  u.spawnX = row[1];
  u.spawnY = row[2];
  u.vx = row[3];
  u.vy = row[4];
  u.spawnAngle = row[5];
  u.spin = row[6];
  u.spawnSt = row[7];
  if (row[8] != null) u.bounces = row[8] | 0;
  else u.bounces = (u.bounces | 0) + 1;
}

function sendPing() {
  if (!connected || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    t: 'ping',
    ct: Date.now(),
    rtt: Math.round(pingMs),
    dly: adaptiveInputDelay() | 0
  }));
}

function wrapEntity(o) {
  if (o.x < 0) o.x += W; if (o.x > W) o.x -= W;
  if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
}

/**
 * Remotes are sampled from an interpolation buffer ~100–180ms behind realtime
 * (adaptive with ping/jitter). Past the newest sample, dead-reckon briefly
 * so they coast instead of freezing ("ice skating") on buffer underrun.
 */
function remoteView(r) {
  const id = r.id;
  const h = id != null ? remoteHist.get(id) : null;
  if (!h || h.length === 0) {
    return {
      id, x: r.x, y: r.y, vx: r.vx, vy: r.vy, angle: r.angle,
      av: r.av || 0, hp: r.hp
    };
  }
  const renderSt = serverNow() - adaptiveInterpMs();
  if (h.length === 1 || renderSt >= h[h.length - 1].st) {
    const last = h[h.length - 1];
    const dtMs = Math.max(0, renderSt - last.st);
    const eMs = Math.min(dtMs, REMOTE_EXTRAP_MAX_MS);
    const eTicks = eMs / TICK_MS;
    const av = last.av || 0;
    return {
      id,
      x: wrapCoord(last.x + last.vx * eTicks, W),
      y: wrapCoord(last.y + last.vy * eTicks, H),
      vx: last.vx,
      vy: last.vy,
      angle: last.angle + av * eTicks,
      av,
      hp: last.hp
    };
  }
  if (renderSt <= h[0].st) {
    const first = h[0];
    return {
      id, x: first.x, y: first.y, vx: first.vx, vy: first.vy, angle: first.angle,
      av: first.av || 0, hp: first.hp
    };
  }
  let i = 1;
  while (i < h.length && h[i].st < renderSt) i++;
  const a = h[i - 1];
  const b = h[i];
  const span = b.st - a.st;
  const t = span > 0 ? (renderSt - a.st) / span : 0;
  // Toroidal lerp — don't draw across the map when a remote wraps an edge.
  return {
    id,
    x: wrapCoord(a.x + shortestWrapDelta(a.x, b.x, W) * t, W),
    y: wrapCoord(a.y + shortestWrapDelta(a.y, b.y, H) * t, H),
    vx: a.vx + (b.vx - a.vx) * t,
    vy: a.vy + (b.vy - a.vy) * t,
    angle: a.angle + shortestAngleDelta(a.angle, b.angle) * t,
    av: (a.av || 0) + ((b.av || 0) - (a.av || 0)) * t,
    hp: t < 0.5 ? a.hp : b.hp
  };
}

function remoteLeadTicks() {
  return 0;
}

function clampSpeed(o) {
  const cap = o.stunned ? STUN_MAX_SPEED : MAX_SPEED;
  const s = Math.hypot(o.vx, o.vy);
  if (s > cap) {
    o.vx = o.vx / s * cap;
    o.vy = o.vy / s * cap;
  }
}

function applyTurn(o, l, r, sh) {
  const dir = (l && !r) ? -1 : ((r && !l) ? 1 : 0);
  const precise = !!sh;
  const step = precise ? TURN_ACCEL_PRECISE : TURN_ACCEL;
  const avMax = precise ? TURN_AV_MAX_PRECISE : TURN_AV_MAX;
  const stunned = !!o.stunned;

  if (dir !== 0) {
    const opposite = o.av !== 0 && Math.sign(o.av) !== dir;
    if (opposite) {
      if (!(o.turnDecelLeft > 0) || !o.turnDecelRev) {
        o.turnDecelStep = o.av / TURN_DECEL_REVERSE_FRAMES;
        o.turnDecelLeft = TURN_DECEL_REVERSE_FRAMES;
        o.turnDecelRev = 1;
      }
      o.av -= o.turnDecelStep;
      o.turnDecelLeft--;
      if (o.turnDecelLeft <= 0) {
        o.turnDecelStep = 0;
        o.turnDecelLeft = 0;
        o.turnDecelRev = 0;
      }
      o.av += dir * step;
    } else {
      o.turnDecelLeft = 0;
      o.turnDecelStep = 0;
      o.turnDecelRev = 0;
      o.av += dir * step;
    }
    if (!stunned) {
      if (o.av > avMax) o.av = avMax;
      if (o.av < -avMax) o.av = -avMax;
    }
  } else if (o.av !== 0) {
    const frames = stunned ? STUN_DECEL_TICKS : TURN_DECEL_FRAMES;
    if (!(o.turnDecelLeft > 0) || o.turnDecelRev) {
      o.turnDecelStep = o.av / frames;
      o.turnDecelLeft = frames;
      o.turnDecelRev = 0;
    }
    o.av -= o.turnDecelStep;
    o.turnDecelLeft--;
    if (o.turnDecelLeft <= 0) {
      o.av = 0;
      o.turnDecelStep = 0;
      o.turnDecelLeft = 0;
      o.turnDecelRev = 0;
    }
  }
  o.angle += o.av;
  if (Math.abs(o.av) < 1e-5) {
    o.av = 0;
    o.turnDecelStep = 0;
    o.turnDecelLeft = 0;
    o.turnDecelRev = 0;
  }
  if (stunned && Math.abs(o.av) < STUN_END_AV) o.stunned = false;
}

function asteroidCollideDamage(p, a, scale) {
  const s = scale != null ? scale : 1;
  const impact = Math.hypot(p.vx - (a.vx || 0), p.vy - (a.vy || 0));
  const frac = Math.min(1, impact / MAX_SPEED);
  const minDmg = Math.max(1, Math.round(ASTEROID_COLLIDE_DMG_MIN * s));
  return Math.max(minDmg, Math.round(frac * MAX_HP * s));
}

function closestOnSeg(px, py, x0, y0, x1, y1) {
  const ex = x1 - x0, ey = y1 - y0;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 1e-12 ? ((px - x0) * ex + (py - y0) * ey) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return { x: x0 + ex * t, y: y0 + ey * t };
}

/** Circle vs asteroid collision polygon — jagged 2D outline × ASTEROID_HIT_SCALE.
 * Euclidean only: asteroids edge-teleport, not toroidal wrap.
 * Spins with a.angle. */
function circleVsAsteroidPoly(cir, a) {
  const ar = (a.r || 10 * RES_SCALE) * ASTEROID_HIT_SCALE;
  const s = ASTEROID_HIT_SCALE;
  const dx0 = cir.x - a.x;
  const dy0 = cir.y - a.y;
  if (dx0 * dx0 + dy0 * dy0 >= (cir.r + ar) * (cir.r + ar)) return null;

  const pts = (a.id != null || a.aid != null) ? asteroidCollisionPts(a) : a.pts;
  if (!pts || pts.length < 6) {
    let dist = Math.hypot(dx0, dy0);
    if (dist < 1e-6) { dist = 1; }
    const overlap = cir.r + ar - dist;
    if (overlap <= 0) return null;
    return { cir, nx: dx0 / dist, ny: dy0 / dist, overlap };
  }

  const ca = Math.cos(-(a.angle || 0)), sa = Math.sin(-(a.angle || 0));
  const lx = dx0 * ca - dy0 * sa;
  const ly = dx0 * sa + dy0 * ca;

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

  const ang = a.angle || 0;
  const cw = Math.cos(ang), sw = Math.sin(ang);
  return {
    cir,
    nx: lnx * cw - lny * sw,
    ny: lnx * sw + lny * cw,
    overlap,
    inside
  };
}

function hitPlayerAsteroidLocal(p, a, hit, src) {
  if (p.godLeft > 0) return;
  if (!hit) {
    for (const cir of localPlayerHitCircles(p)) {
      hit = circleVsAsteroidPoly(cir, a);
      if (hit) break;
    }
  }
  if (!hit) return;
  const { cir, nx, ny } = hit;
  const dmg = asteroidCollideDamage(p, a, 0.5);
  const cross = nx * p.vy - ny * p.vx;
  const spinDir = cross >= 0 ? 1 : -1;
  const vn = p.vx * nx + p.vy * ny;
  // Half bounce power vs asteroids (restitution 0.5).
  const e = 0.5;
  if (vn < 0) {
    p.vx -= (1 + e) * vn * nx;
    p.vy -= (1 + e) * vn * ny;
  } else {
    p.vx += nx * (1.2 * RES_SCALE * e);
    p.vy += ny * (1.2 * RES_SCALE * e);
  }
  p.stunned = true;
  clampSpeed(p);
  if (hit.overlap > 0) {
    p.x += nx * (hit.overlap + 3);
    p.y += ny * (hit.overlap + 3);
    wrapEntity(p);
  }
  p.hp -= dmg;
  p.av = spinDir * STUN_SPIN;
  p.turnDecelStep = 0;
  p.turnDecelLeft = 0;
  p.turnDecelRev = 0;
  p.collideCd = COLLIDE_IFRAME_TICKS;
  if (p.hp < 0) p.hp = 0;
  emitPlayerAsteroidHit(cir.x, cir.y);
  separateLocalPlayerFromAsteroids(p, 8);
}

function localPlayerHitCircles(p) {
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

/** Dual circles vs remote ship (remote treated like a moving rock for prediction). */
function playerPlayerHitLocal(a, b) {
  const ca = localPlayerHitCircles(a);
  const cb = localPlayerHitCircles(b);
  for (const A of ca) {
    for (const B of cb) {
      const dx = shortestWrapDelta(B.x, A.x, W);
      const dy = shortestWrapDelta(B.y, A.y, H);
      const rr = A.r + B.r;
      if (dx * dx + dy * dy >= rr * rr) continue;
      let dist = Math.hypot(dx, dy);
      if (dist < 1e-6) dist = 1;
      const overlap = rr - dist;
      if (overlap <= 0) continue;
      return { cir: A, nx: dx / dist, ny: dy / dist, overlap };
    }
  }
  return null;
}

function hitPlayerShipLocal(p, other, hit) {
  hit = hit || playerPlayerHitLocal(p, other);
  if (!hit) return;
  const { cir, nx, ny } = hit;
  const dmg = asteroidCollideDamage(p, other);
  const cross = nx * p.vy - ny * p.vx;
  const spinDir = cross >= 0 ? 1 : -1;
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    p.vx -= 2 * vn * nx;
    p.vy -= 2 * vn * ny;
  } else {
    p.vx += nx * (1.2 * RES_SCALE);
    p.vy += ny * (1.2 * RES_SCALE);
  }
  p.stunned = true;
  clampSpeed(p);
  if (hit.overlap > 0) {
    p.x += nx * (hit.overlap + 2);
    p.y += ny * (hit.overlap + 2);
    wrapEntity(p);
  }
  p.hp -= dmg;
  p.av = spinDir * STUN_SPIN;
  p.turnDecelStep = 0;
  p.turnDecelLeft = 0;
  p.turnDecelRev = 0;
  p.collideCd = COLLIDE_IFRAME_TICKS;
  if (p.hp < 0) p.hp = 0;
  emitPlayerAsteroidHit(cir.x, cir.y);
}

/** Local-only asteroid contact FX (shake/sfx). No stun / bounce / HP — server owns those. */
function predictLocalAsteroidHitFx(p) {
  if (!p || p.hp <= 0 || p.godLeft > 0) return;
  if (p.collideCd > 0) return;
  predictAsteroidEdgeTeleports();
  for (const a of asteroids.values()) {
    if (a.playerShot && (a.ownerId | 0) === (myId | 0)) continue;
    const pos = asteroidAt(a);
    if (asteroidOffScreenAt(a, pos.x, pos.y)) continue;
    const ast = {
      x: pos.x,
      y: pos.y,
      angle: pos.angle,
      r: a.r || 10 * RES_SCALE,
      pts: a.pts,
      id: a.id,
      shapeId: a.shapeId,
      size: a.size,
      vx: a.vx,
      vy: a.vy
    };
    for (const cir of localPlayerHitCircles(p)) {
      if (!circleVsAsteroidPoly(cir, ast)) continue;
      // Iframe so we don't re-fire FX every tick; also skips duplicate on astHit.
      p.collideCd = COLLIDE_IFRAME_TICKS;
      emitPlayerAsteroidHit(cir.x, cir.y);
      return;
    }
  }
}

function resolveLocalAsteroidCollisions(p) {
  // Full local bounce/stun/HP prediction disabled — use predictLocalAsteroidHitFx instead.
  return;
}

/** Position-only eject matching server separatePlayerFromAsteroids. */
function separateLocalPlayerFromAsteroids(p, maxIters) {
  const iters = maxIters == null ? 6 : maxIters;
  for (let n = 0; n < iters; n++) {
    let moved = false;
    for (const a of asteroids.values()) {
      const pos = asteroidAt(a);
      if (asteroidOffScreenAt(a, pos.x, pos.y)) continue;
      const ast = {
        x: pos.x,
        y: pos.y,
        angle: pos.angle,
        r: a.r || 10 * RES_SCALE,
        pts: a.pts,
        id: a.id,
        shapeId: a.shapeId,
        size: a.size
      };
      for (const cir of localPlayerHitCircles(p)) {
        const hit = circleVsAsteroidPoly(cir, ast);
        if (!hit) continue;
        const pad = hit.inside ? 4 : 2;
        p.x += hit.nx * (hit.overlap + pad);
        p.y += hit.ny * (hit.overlap + pad);
        wrapEntity(p);
        const vn = p.vx * hit.nx + p.vy * hit.ny;
        if (vn < 0) {
          p.vx -= vn * hit.nx;
          p.vy -= vn * hit.ny;
        }
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
}

function resolveLocalPlayerCollisions(p) {
  return; // ship↔ship collisions disabled for now
  if (!p || p.hp <= 0 || p.collideCd > 0) return;
  for (const r of remotes.values()) {
    const v = remoteView(r);
    const other = {
      x: v.x, y: v.y, angle: v.angle,
      vx: v.vx || 0, vy: v.vy || 0
    };
    const hit = playerPlayerHitLocal(p, other);
    if (hit) {
      hitPlayerShipLocal(p, other, hit);
      return;
    }
  }
}

function applyInputTo(o, inp, opts) {
  if (o.av == null) o.av = 0;
  if (o.collideCd > 0) o.collideCd--;
  // Shoot pulse ends godmode (predict + snap replay stay aligned with server).
  if (o.godLeft > 0 && inp && inp.sp) o.godLeft = 0;
  // Only tick godmode on live predict — snap already has the authoritative remaining.
  if (o.godLeft > 0 && opts && opts.localCollide) o.godLeft--;

  applyTurn(o, inp.l, inp.r, inp.sh);
  if (o.stunned || inp.u) {
    o.vx += Math.cos(o.angle) * THRUST;
    o.vy += Math.sin(o.angle) * THRUST;
  }
  clampSpeed(o);
  o.x += o.vx;
  o.y += o.vy;
  wrapEntity(o);
  // Leave spawn zone → godmode ends immediately (matches server).
  if (o.godLeft > 0 && opts && opts.localCollide && o === player && myId != null) {
    const spawn = playerSpawnPoseLocal(myId);
    const dx = o.x - spawn.x;
    const dy = o.y - spawn.y;
    if (dx * dx + dy * dy > GODMODE_SPAWN_CLEAR_R * GODMODE_SPAWN_CLEAR_R) {
      o.godLeft = 0;
    }
  }
  // Local asteroid contact: shake only (no stun / bounce / HP).
  if (opts && opts.localCollide && o === player) predictLocalAsteroidHitFx(o);
}

function copyShipState(from, to) {
  to.x = from.x;
  to.y = from.y;
  to.vx = from.vx;
  to.vy = from.vy;
  to.angle = from.angle;
  to.hp = from.hp;
  to.av = from.av || 0;
  to.turnDecelStep = from.turnDecelStep || 0;
  to.turnDecelLeft = from.turnDecelLeft || 0;
  to.turnDecelRev = from.turnDecelRev || 0;
  to.stunned = !!from.stunned;
  to.collideCd = from.collideCd || 0;
  to.godLeft = from.godLeft || 0;
}

function getInput() {
  return {
    l: turnLeft() ? 1 : 0,
    r: turnRight() ? 1 : 0,
    u: thrustUp() ? 1 : 0,
    sp: shootPulse ? 1 : 0,
    sh: precisionTurn() ? 1 : 0
  };
}

function noteInputAck(ack) {
  const a = ack | 0;
  if (a > ackedSeq) ackedSeq = a;
  pendingInputs = pendingInputs.filter(f => f.seq > ackedSeq);
}

function sendPendingInputs() {
  if (!inGame || !ws || ws.readyState !== 1) return;
  // Resend anything the server has not applied yet (snap lastSeq = ack).
  const unacked = pendingInputs.filter(f => f.seq > ackedSeq);
  if (!unacked.length) return;
  const hasNew = unacked.some(f => f.seq > lastSentSeq);
  const now = performance.now();
  if (!hasNew && now - lastInputSendAt < INPUT_RESEND_MS) return;
  // Oldest first so gaps fill before newer frames (server MAX_FRAMES_PER_MSG).
  const frames = unacked.length > INPUT_SEND_MAX_FRAMES
    ? unacked.slice(0, INPUT_SEND_MAX_FRAMES)
    : unacked;
  ws.send(JSON.stringify({
    t: 'in',
    frames: frames.map(f => ({
      seq: f.seq, l: f.l, r: f.r, u: f.u, sp: f.sp, sh: f.sh
    }))
  }));
  const sentHi = frames[frames.length - 1].seq;
  if (sentHi > lastSentSeq) lastSentSeq = sentHi;
  lastInputSendAt = now;
}

function rememberFrame(frame) {
  frameHistory.push(frame);
  if (frameHistory.length > 120) frameHistory.shift();
}

function frameBySeq(seq) {
  for (let i = frameHistory.length - 1; i >= 0; i--) {
    if (frameHistory[i].seq === seq) return frameHistory[i];
  }
  return null;
}

/** Highest seq that should already be applied locally (others still sit in the delay buffer). */
function releasedSeq() {
  return inputSeq - adaptiveInputDelay();
}

function predictTick(forceShoot) {
  if (demoPlay && demoPlay.active) return;
  if (!inGame || !predReady) return;
  if (deathSpectating || matchPaused || soloShopOpen || player.hp <= 0) {
    if (soloShopOpen) {
      player.vx = 0;
      player.vy = 0;
      player.av = 0;
    }
    // Keep seq advancing so we don't desync, but don't move/shoot locally.
    const frame = { seq: ++inputSeq, l: 0, r: 0, u: 0, sp: 0, sh: 0 };
    pendingInputs.push(frame);
    if (pendingInputs.length > 90) pendingInputs.shift();
    rememberFrame(frame);
    sendPendingInputs();
    const applyUntil = releasedSeq();
    while (lastAppliedSeq < applyUntil) {
      const ready = frameBySeq(lastAppliedSeq + 1);
      if (!ready) break;
      lastAppliedSeq++;
    }
    if (shootPulse) shootPulse = false;
    return;
  }
  // Held shoot: re-pulse when a new burst can start (railgun after cooldown, post-reload, etc.).
  if ((spaceLatch || enterLatch) && !localShoot.bursting && localShoot.reloadLeft === 0 &&
      localShoot.shootAmmo > 0 && (localShoot.shootCd | 0) <= 0) {
    shootPulse = true;
  }
  const inp = getInput();
  if (forceShoot) inp.sp = 1;
  const frame = { seq: ++inputSeq, l: inp.l, r: inp.r, u: inp.u, sp: inp.sp, sh: inp.sh };
  pendingInputs.push(frame);
  if (pendingInputs.length > 90) pendingInputs.shift();
  rememberFrame(frame);
  sendPendingInputs();

  // Apply inputs that finished INPUT_DELAY — movement and local shoot FX together.
  const applyUntil = releasedSeq();
  while (lastAppliedSeq < applyUntil) {
    const ready = frameBySeq(lastAppliedSeq + 1);
    if (!ready) break;
    applyInputTo(player, ready, { localCollide: true });
    if (ready.sp) tryStartLocalBurst();
    // One local shoot step per released sim tick (matches server cadence).
    updateLocalShooting();
    lastAppliedSeq++;
  }

  if (shootPulse) shootPulse = false;
  if (demoRec) demoRecordAfterTick(frame);
}

function reconcileFromServer(row) {
  serverGhost.x = row[1];
  serverGhost.y = row[2];
  serverGhost.vx = row[3];
  serverGhost.vy = row[4];
  serverGhost.angle = row[5];
  serverGhost.hp = row[6];
  serverGhost.av = row[8] != null ? row[8] : 0;
  serverGhost.valid = true;

  const ack = row[7] | 0;
  noteInputAck(ack);

  const prevX = player.x + softErr.x;
  const prevY = player.y + softErr.y;
  const prevA = player.angle + softErr.angle;

  const srvAv = row[8] != null ? row[8] : 0;
  const srvStunned = !!(row[9] | 0);
  const srvGod = row[10] != null ? (row[10] | 0) : (player.godLeft || 0);
  const prevHp = player.hp | 0;
  const st = {
    x: row[1], y: row[2], vx: row[3], vy: row[4],
    angle: row[5], hp: row[6],
    av: srvAv,
    turnDecelStep: 0,
    turnDecelLeft: 0,
    turnDecelRev: 0,
    stunned: srvStunned,
    collideCd: player.collideCd || 0,
    godLeft: srvGod
  };
  // Only replay unacked inputs that have already exited the delay window.
  const releaseAt = releasedSeq();
  let applied = ack;
  for (const f of pendingInputs) {
    if (f.seq <= releaseAt) {
      applyInputTo(st, f);
      applied = f.seq;
    }
  }
  copyShipState(st, player);
  if (prevHp > 0 && (player.hp | 0) < prevHp && (player.hp | 0) > 0 && !deathSpectating) {
    emitDamageTakenFx(player.x, player.y);
  }
  // Soft visual correction: keep old on-screen pose, bleed error out over time.
  // Use toroidal deltas so edge-wraps don't create a full-map rubber-band.
  // Large drift → hard teleport, unless tab-resume blend window is active.
  if (cv('cl_recon') <= 0) {
    softErr.x = 0;
    softErr.y = 0;
    softErr.angle = 0;
  } else {
    softErr.x = shortestWrapDelta(player.x, prevX, W);
    softErr.y = shortestWrapDelta(player.y, prevY, H);
    softErr.angle = shortestAngleDelta(player.angle, prevA);
    const drift = Math.hypot(softErr.x, softErr.y);
    const blending = performance.now() < resumeBlendUntil;
    const snapPx = blending ? RESUME_SOFT_ERR_MAX : LOCAL_DRIFT_SNAP_PX;
    if (drift > snapPx) {
      softErr.x = 0;
      softErr.y = 0;
      softErr.angle = 0;
    } else if (blending) {
      const m = Math.hypot(softErr.x, softErr.y);
      if (m > RESUME_SOFT_ERR_MAX) {
        softErr.x *= RESUME_SOFT_ERR_MAX / m;
        softErr.y *= RESUME_SOFT_ERR_MAX / m;
      }
    } else {
      clampSoftErr();
    }
  }
  lastAppliedSeq = applied;
  predReady = true;
  if (clientTickCursor == null) clientTickCursor = Math.floor(estimatedServerTick());
}

function applySnapshot(msg) {
  if (msg.st != null) {
    syncTick = msg.tick;
    syncSt = msg.st;
  }

  const seen = new Set();
  const st = msg.st != null ? msg.st : serverNow();
  for (const row of msg.players) {
    const id = row[0];
    seen.add(id);
    if (id === myId) {
      reconcileFromServer(row);
      continue;
    }
    pushRemoteSample(id, row, st);
  }
  for (const id of remotes.keys()) {
    if (!seen.has(id)) {
      remotes.delete(id);
      remoteHist.delete(id);
    }
  }
}

/** Parse binary snap (see server packSnapBinary). */
function applyBinarySnap(buf) {
  const view = new DataView(buf);
  if (view.byteLength < 10) return;
  if (view.getUint8(0) !== BIN_SNAP) return;
  const count = view.getUint8(1);
  const tick = view.getUint32(2, true);
  const st = view.getFloat64(6, true);
  // Small backward ticks are reordering — skip local reconcile/clock only.
  // Large backward jumps are a new room; accept. Always refresh remotes.
  const slightReorder = !!(syncSt && tick < syncTick && (syncTick - tick) < 90);
  if (!slightReorder) {
    // New room / catch-up: if tick jumped backwards a lot, reset prediction clock.
    if (syncSt && tick + 30 < syncTick) resetTickClock();
    syncTick = tick;
    syncSt = st;
  }
  const seen = new Set();
  let o = 14;
  // Prefer new stride (38); fall back if an old server is still up.
  const stride = (view.byteLength >= 14 + count * 38) ? 38 : 36;
  for (let i = 0; i < count; i++) {
    if (o + stride > view.byteLength) break;
    const id = view.getUint16(o, true); o += 2;
    const x = view.getFloat32(o, true); o += 4;
    const y = view.getFloat32(o, true); o += 4;
    const vx = view.getFloat32(o, true); o += 4;
    const vy = view.getFloat32(o, true); o += 4;
    const angle = view.getFloat32(o, true); o += 4;
    const av = view.getFloat32(o, true); o += 4;
    const hp = view.getUint16(o, true); o += 2;
    const lastSeq = view.getUint32(o, true); o += 4;
    const stunned = view.getUint8(o); o += 1;
    const godLeft = view.getUint8(o); o += 1;
    o += 2; // ammo + reloadLeft (unused here)
    if (stride >= 38) o += 2; // legacy pad (was coinPoolPickup)
    const row = [id, x, y, vx, vy, angle, hp, lastSeq, av, stunned, godLeft];
    seen.add(id);
    if (id === myId) {
      if (!slightReorder) reconcileFromServer(row);
    } else {
      pushRemoteSample(id, row, st);
    }
  }
  if (!slightReorder) {
    for (const id of remotes.keys()) {
      if (!seen.has(id)) {
        remotes.delete(id);
        remoteHist.delete(id);
      }
    }
  }
}

let circleVertScratch = new Float32Array(128);
let ellipseVertScratch = new Float32Array(128);

function circleVerts(x, y, r, segments) {
  const n = segments || 28;
  const need = n * 2;
  circleVertScratch = growF32(circleVertScratch, need);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    circleVertScratch[i * 2] = x + Math.cos(a) * r;
    circleVertScratch[i * 2 + 1] = y + Math.sin(a) * r;
  }
  return need === circleVertScratch.length ? circleVertScratch : circleVertScratch.subarray(0, need);
}

/** Oriented ellipse: rx = half-width (cross), ry = half-length (along ang). */
function ellipseVerts(x, y, rx, ry, ang, segments) {
  const n = segments || 20;
  const c = Math.cos(ang || 0);
  const s = Math.sin(ang || 0);
  const need = n * 2;
  ellipseVertScratch = growF32(ellipseVertScratch, need);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const lx = Math.cos(a) * rx;
    const ly = Math.sin(a) * ry;
    ellipseVertScratch[i * 2] = x + lx * c - ly * s;
    ellipseVertScratch[i * 2 + 1] = y + lx * s + ly * c;
  }
  return need === ellipseVertScratch.length ? ellipseVertScratch : ellipseVertScratch.subarray(0, need);
}

/** Server hit volumes: two circles along facing (front + back). */
function drawCollisionRing(x, y, angle, color) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  drawLines(
    circleVerts(
      x + c * PLAYER_HIT_OFFSET_FRONT,
      y + s * PLAYER_HIT_OFFSET_FRONT,
      PLAYER_HIT_R_FRONT,
      16
    ),
    color, gl.LINE_LOOP, 0.55
  );
  drawLines(
    circleVerts(
      x - c * PLAYER_HIT_OFFSET_BACK,
      y - s * PLAYER_HIT_OFFSET_BACK,
      PLAYER_HIT_R_BACK,
      16
    ),
    color, gl.LINE_LOOP, 0.55
  );
}

/** Decorative asteroids for the home / queue screen. */
const menuAsteroids = [];
let lastMenuMs = 0;

function initMenuAsteroids() {
  if (menuAsteroids.length) return;
  const sizes = [26, 15, 9, 22, 12, 18, 9, 15].map(r => r * RES_SCALE * 1.15 * 1.35);
  for (let i = 0; i < sizes.length; i++) {
    const r = sizes[i];
    menuAsteroids.push({
      id: 1000 + i,
      x: Math.random() * W,
      y: Math.random() * H,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.045,
      vx: (Math.random() - 0.5) * 0.7 * RES_SCALE,
      vy: (Math.random() - 0.5) * 0.7 * RES_SCALE,
      r,
      size: r > 22 * RES_SCALE ? 'big' : r > 12 * RES_SCALE ? 'medium' : 'small',
      age: Math.random() * 200
    });
  }
}

function stepMenuAsteroids() {
  initMenuAsteroids();
  const now = performance.now();
  const dt = lastMenuMs ? Math.min(0.05, (now - lastMenuMs) / 1000) : 0.016;
  lastMenuMs = now;
  const s = dt * TPS;
  for (const a of menuAsteroids) {
    a.x += a.vx * s;
    a.y += a.vy * s;
    a.angle += a.spin * s;
    a.age += s;
    if (a.x < -40) a.x += W + 80;
    else if (a.x > W + 40) a.x -= W + 80;
    if (a.y < -40) a.y += H + 80;
    else if (a.y > H + 40) a.y -= H + 80;
  }
}

function renderMenuBackdrop() {
  stepMenuAsteroids();
  for (const a of menuAsteroids) {
    drawAsteroid2D(a.x, a.y, a.angle, a.id, a.r, asteroidColor(a), a.size);
  }
}

function renderBullets() {
  pruneBullets();
  const normal = [];
  const plasmaPts = [];
  const rainbowPts = [];
  const turretPts = [];
  // Default trail runs every other frame so it stays lighter than rockets.
  const defaultTrail = ((performance.now() / 32) | 0) % 2 === 0;
  for (const b of bullets.values()) {
    const ang = Math.atan2(b.vy, b.vx);
    const p = bulletAt(b);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
    const pt = drawBulletVisual(b.type, p.x, p.y, ang, b.vx, b.vy, defaultTrail, b.id, b.owner);
    if (pt) {
      const rainbow = ownerHasDamagePowerup(b.owner) && DAMAGE_RAINBOW_TYPES.has(b.type || 'default');
      if (rainbow) rainbowPts.push(pt);
      else if (b.type === 'plasma') plasmaPts.push(pt);
      else if (b.type === 'turret') turretPts.push(pt);
      else normal.push(pt);
    }
  }
  if (normal.length) drawPoints(normal, COL.bullet);
  if (turretPts.length) drawPoints(turretPts, COL.powerTurret);
  if (plasmaPts.length) drawPoints(plasmaPts, COL.plasma);
  if (rainbowPts.length) drawPoints(rainbowPts, damageRainbowColor());
}

function render() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (nightModeActive()) gl.clearColor(0, 0, 0, 1);
  else gl.clearColor(BG_CLEAR[0], BG_CLEAR[1], BG_CLEAR[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  try { gl.lineWidth(Math.max(1, getRenderScale())); } catch (_) { gl.lineWidth(1); }
  const nowBg = performance.now();
  tickAsteroidTuneLead(nowBg);
  applyScreenShakeCss(nowBg);
  drawSynthGrid(nowBg);
  if (!inGame) {
    syncThrustSfx(false);
    syncLaserSfx(false);
    renderMenuBackdrop();
    drawCanvasCredits(nowBg);
    return;
  }

  const now = nowBg;
  const dt = lastParticleMs ? Math.min(0.05, (now - lastParticleMs) / 1000) : 0.016;
  lastParticleMs = now;

  updateLaserState();
  tickDeathSequence(now);
  if (!deathSpectating && !matchPaused) predictAsteroidEdgeTeleports();
  pruneAsteroids();
  updateAttractedCoins(dt);
  const me = localView();
  if (!deathSpectating && !matchPaused && !soloShopOpen && player.hp > 0 && godmodeBlinkVisible(player.godLeft)) {
    const thrusting = thrustUp();
    syncThrustSfx(thrusting);
    // Melee = brake-thrust (nose opposite travel) — NOT the removed Space emergency brake.
    const meleeOn = thrusting && thrustMeleeActive(me.angle, me.vx, me.vy, {
      id: myId, x: me.x, y: me.y
    });
    if (thrusting) emitThrustFx(me.x, me.y, me.angle, me.vx, me.vy, myId, ownerPlayerColor(myId), meleeOn);
    else emitThrustIdleFx(me.x, me.y, me.angle, me.vx, me.vy, myId, ownerPlayerColor(myId));
    tickThrustGrid(thrusting, me.x, me.y, me.angle);
    thrustAlignPrevX = me.x;
    thrustAlignPrevY = me.y;
    emitShipDamageSmoke(myId || 0, me.x, me.y, me.angle, me.vx, me.vy, me.hp);
  } else {
    syncThrustSfx(false);
    thrustAlignPrevX = null;
    thrustAlignPrevY = null;
  }
  for (const r of remotes.values()) {
    if (r.hp <= 0 || !godmodeBlinkVisible(r.godLeft)) continue;
    const v = remoteView(r);
    // Forward thrust OR brake-thrust melee (exhaust attack faces into travel).
    const forwardThrust = v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle) > 0.4 * RES_SCALE;
    const meleeOn = thrustMeleeActive(v.angle, v.vx, v.vy, { id: r.id });
    const thrusting = !deathSpectating && !matchPaused && (forwardThrust || meleeOn);
    if (!deathSpectating && !matchPaused) {
      if (thrusting) emitThrustFx(v.x, v.y, v.angle, v.vx, v.vy, r.id, ownerPlayerColor(r.id), meleeOn);
      else emitThrustIdleFx(v.x, v.y, v.angle, v.vx, v.vy, r.id, ownerPlayerColor(r.id));
    }
    if (!deathSpectating && !matchPaused) emitShipDamageSmoke(v.id, v.x, v.y, v.angle, v.vx, v.vy, v.hp);
  }
  emitEnemyThrustFx();
  emitEnemyDamageSmoke();
  updateParticles(dt);
  updateDeathRings(now);
  decaySoftErr(dt);
  // Keep entity light uniforms in sync even if baked grid path did not run.
  updateDynamicLightState();
  // Night mode only blacks the backdrop / unlit grid — ships, bullets, FX still draw (lit).
  drawSceneLines(dt);
  renderBullets();
  drawDeathRings(now);
  drawParticles();
  drawFxLabels(now);
  drawWaveBanner(now);
}

function configuredServer() {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q.replace(/\/$/, '');
  } catch (_) {}
  if (typeof window.ASTEROIDS_SERVER === 'string' && window.ASTEROIDS_SERVER.trim()) {
    return window.ASTEROIDS_SERVER.trim().replace(/\/$/, '');
  }
  return '';
}

/** Base URL of this page's folder (supports /asteroids/ subdirectory deploys). */
function pageServerBase() {
  try {
    const u = new URL('.', location.href);
    let path = u.pathname;
    if (!path.endsWith('/')) {
      path = path.replace(/\/[^/]*$/, '/');
    }
    return (u.origin + path).replace(/\/$/, '');
  } catch (_) {
    return location.origin;
  }
}

async function findHost() {
  const bases = [];
  const configured = configuredServer();
  if (configured) bases.push(configured);
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    bases.push(pageServerBase());
    bases.push(location.origin);
  }
  bases.push('http://localhost:8765', 'http://127.0.0.1:8765');
  const seen = new Set();
  for (const base of bases) {
    if (!base || seen.has(base)) continue;
    seen.add(base);
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(800) });
      if (r.ok) return base;
    } catch {}
  }
  return null;
}

function applyRemotePlayers(rows, st) {
  const stamp = st != null ? st : serverNow();
  const seen = new Set();
  if (rows) {
    for (const row of rows) {
      const id = row[0];
      seen.add(id);
      if (id === myId) continue;
      pushRemoteSample(id, row, stamp);
    }
  }
  for (const id of remotes.keys()) {
    if (!seen.has(id)) {
      remotes.delete(id);
      remoteHist.delete(id);
    }
  }
}

function enterGameFromWelcome(msg) {
  myId = msg.id;
  roomId = msg.room != null ? msg.room : null;
  inGame = true;
  deathSpectating = false;
  deathSeq = null;
  deathFreezeAt = 0;
  predReady = false;
  inputSeq = 0;
  lastAppliedSeq = 0;
  lastSentSeq = 0;
  ackedSeq = 0;
  lastInputSendAt = 0;
  pendingInputs = [];
  frameHistory = [];
  resetTickClock();
  // New room timeline — must reset or practice-room syncTick drops all match snaps.
  syncTick = msg.tick | 0;
  syncSt = msg.st != null ? msg.st : Date.now();
  serverGhost.valid = false;
  remotes.clear();
  clearRemoteHist();
  scores.clear();
  asteroids.clear();
  enemies.clear();
  enemyCharges.clear();
  clearCoins();
  localCoins = 0;
  localScore = 0;
  asteroidGhosts = [];
  stopAllRocketTravelSfx();
  bullets.clear();
  pickups.clear();
  softErr.x = 0; softErr.y = 0; softErr.angle = 0;
  remoteLasers.clear();
  hitLasers.length = 0;
  localLaserUntil = 0;
  localLaserClip = null;
  selectedWeapon = 1;
  weaponLevels = { default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 };
  unlockedWeapons = {
    default: true, rocket: false, laser: false, shotgun: false,
    railgun: false, plasma: false, voidcannon: false, asteroidgun: false
  };
  if (!msg.practice) {
    unlockedWeapons = {
      default: true, rocket: true, laser: true, shotgun: true,
      railgun: true, plasma: true, voidcannon: true, asteroidgun: true
    };
  }
  player.powerups = freshPowerups();
  hideSoloShop();
  resetLocalShoot('default');
  clearParticles();
  clearFxLabels();
  clearWaveBanner();
  soloWave = 0;
  clearScreenShake();
  clearGridShocks();
  stopAllRailChargeSfx();
  syncThrustSfx(false);
  syncLaserSfx(false);
  shipSmokeLeaks.clear();
  deathRings.length = 0;
  railCharges.clear();
  railBeams.length = 0;
  thrustBeams.length = 0;
  thrustMeleeFxUntil.clear();
  thrustAlignPrevX = null;
  thrustAlignPrevY = null;
  hideMenu();
  shipBankSmooth.clear();
  turretYawSmooth.clear();
  shotgunSfxAt.clear();
  voidShakes.clear();
  enemyAngHist.clear();
  enemyBankSmooth.clear();
  enemyDrawBank.clear();
  resumeBlendUntil = 0;
  coopMode = !!(msg.coop || msg.mode === 'coop');
  soloOnlyMode = !!(msg.soloOnly || msg.mode === 'solo' || msg.mode === 'continue');
  setPracticeWaiting(!!msg.practice);
  refreshGridStaticPins();
  if (msg.lives != null) setSoloLives(msg.lives);
  else if (msg.practice) setSoloLives(3);
  else setSoloLives(0);
  if (msg.wave != null) {
    soloWave = msg.wave | 0;
    startWaveBanner(soloWave);
  }
  if (msg.coins != null) {
    setLocalCoins(msg.coins);
  }
  if (msg.score != null) {
    setLocalScore(msg.score);
  }
  if (msg.levels) weaponLevels = Object.assign({ default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 }, msg.levels);
  if (msg.unlocked) {
    unlockedWeapons = {
      default: false, rocket: false, laser: false, shotgun: false,
      railgun: false, plasma: false, voidcannon: false, asteroidgun: false
    };
    Object.assign(unlockedWeapons, msg.unlocked);
  }
  syncSoloWaitBanner();
  shipSmokeLeaks.clear();
  lastParticleMs = 0;
  stopAllRailChargeSfx();
  railCharges.clear();
  railBeams.length = 0;
  thrustBeams.length = 0;
  thrustMeleeFxUntil.clear();
  thrustAlignPrevX = null;
  thrustAlignPrevY = null;
  deathRings.length = 0;
  if (msg.bullets) {
    for (const row of msg.bullets) addBullet(unpackBullet(row), false);
  }
  if (msg.asteroids) {
    for (const row of msg.asteroids) addAsteroid(unpackAsteroid(row));
  }
  if (msg.enemies) {
    enemies.clear();
    enemyCharges.clear();
    for (const row of msg.enemies) addEnemy(unpackEnemy(row));
  }
  if (msg.pickups) {
    for (const row of msg.pickups) addPickup(unpackPickup(row));
  }
  applyScores(msg.scores);
  if (msg.names) applyNames(msg.names);
  if (msg.colors) applyPlayerColors(msg.colors);
  if (msg.scoreToWin != null) setScoreToWin(msg.scoreToWin);
  if (msg.svDynamicPrediction != null && CVARS.sv_dynamic_prediction) {
    const s = Number(msg.svDynamicPrediction);
    CVARS.sv_dynamic_prediction.value = Number.isFinite(s) ? Math.max(0, s) : 0;
  }
  applyNtp(Date.now(), msg.st, msg.tick);
  // Re-assert room clock after NTP (inGame is already true so applyNtp won't overwrite).
  syncTick = msg.tick | 0;
  syncSt = msg.st != null ? msg.st : syncSt;
  if (msg.you) reconcileFromServer(msg.you);
  applyRemotePlayers(msg.players, syncSt);
  if (msg.powerupsByPlayer) {
    for (const id of Object.keys(msg.powerupsByPlayer)) {
      applyPowerupsState(id | 0, msg.powerupsByPlayer[id]);
    }
  }
  player.powerups = (msg.powerupsByPlayer && msg.powerupsByPlayer[myId])
    ? Object.assign(freshPowerups(), msg.powerupsByPlayer[myId])
    : freshPowerups();
  if ((player.godLeft | 0) > 0) emitGodmodeStartFx(player.x, player.y);
  hideMenu();
  hideSoloOverScreen();
  setPracticeWaiting(!!msg.practice);
  if (msg.practice) {
    matchLive = true;
  } else if (msg.waitingReady != null) {
    matchLive = !msg.waitingReady;
  } else {
    matchLive = false;
  }
  matchReadySent = false;
  syncGetAsteroidsCvar();
  syncPredictShootCvars();
  syncDynamicPredictionCvar();
  syncPortalCvar();
  if (consoleAdmin) syncDemoCvar();
  updateHud();
  if (!practiceMode && cancelBtn) cancelBtn.classList.remove('visible');
  updateHud();
  setRejoinOffer(null);
  if (msg.pause) {
    applyPausedMsg(msg.pause);
  } else if (msg.paused) {
    applyPausedMsg(typeof msg.paused === 'object' ? msg.paused : { reason: 'manual', budgets: {}, ready: [], need: 1, countdown: 0 });
  }
  if (msg.practice) {
    startWaveBanner(msg.wave != null ? msg.wave : 1);
  } else if (!(msg.paused || msg.pause || msg.rejoin)) {
    clearWaveBanner();
    playMatchMusic();
    // Defer one frame so roster names (if any) can land, then still show with welcome names.
    requestAnimationFrame(() => showMatchIntro());
  } else {
    clearWaveBanner();
    playMatchMusic();
    hideMatchIntro(true);
  }
}

function returnToLobby() {
  if (demoRec) demoStopRecord(true);
  if (demoPlay && demoPlay.active) demoStopPlay(true);
  hideSoloOverScreen();
  hideSoloShop();
  resetMatchState();
  showMenu();
  updateHud();
}

async function connect() {
  showMenu();
  if (playBtn) playBtn.disabled = true;
  const base = await findHost();
  if (!base) {
    showMenu();
    setTimeout(connect, 1500);
    return;
  }

  showMenu();
  // Trailing slash required under nginx (/asteroids exact path 301s; WS cannot follow redirects).
  const wsUrl = base.replace(/^http/, 'ws').replace(/\/?$/, '/');
  ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    connected = true;
    showMenu();
    if (playBtn) playBtn.disabled = false;
    sendPing();
  };
  ws.onclose = () => {
    connected = false;
    consoleAdmin = false;
    resetMatchState();
    showMenu();
    if (playBtn) playBtn.disabled = true;
    if (cancelBtn) cancelBtn.classList.remove('visible');
    setTimeout(connect, 1000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      if (inGame && !(demoPlay && demoPlay.active)) applyBinarySnap(e.data);
      return;
    }
    if (typeof Blob !== 'undefined' && e.data instanceof Blob) {
      e.data.arrayBuffer().then((buf) => {
        if (inGame && !(demoPlay && demoPlay.active)) applyBinarySnap(buf);
      }).catch(() => {});
      return;
    }
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (demoRec) demoOnNetMsg(msg);
    if (demoPlay && demoPlay.active) {
      // Ignore live net while watching a local demo (except admin/session).
      if (msg.t !== 'admin' && msg.t !== 'adminPw' && msg.t !== 'session' && msg.t !== 'presence') return;
    }
    if (msg.t === 'admin') {
      if (msg.loggedOut) {
        consoleAdmin = false;
        conPrint('admin logged out', 'info');
        return;
      }
      if (msg.ok) {
        consoleAdmin = true;
        conPrint('admin login ok', 'info');
        syncPortalCvar();
        syncDemoCvar();
      } else {
        consoleAdmin = false;
        conPrint(msg.err || 'admin login failed', 'err');
      }
      return;
    }
    if (msg.t === 'adminPw') {
      if (msg.ok) conPrint('admin password updated', 'info');
      else conPrint(msg.err || 'password change failed', 'err');
      return;
    }
    if (msg.t === 'adminGive') {
      if (msg.ok) {
        const label = msg.item || 'item';
        if (msg.kind === 'admingun') {
          conPrint('gave admingun (turret buffed: 100 ammo / 1 cooldown / 1s reload / 100 dmg)', 'info');
        } else if (msg.kind === 'weapon' && msg.lvl != null) {
          conPrint('gave ' + label + ' L' + (msg.lvl | 0), 'info');
        } else {
          conPrint('gave ' + label, 'info');
        }
      } else {
        conPrint(msg.err || 'give failed', 'err');
      }
      return;
    }
    if (msg.t === 'adminStatus' || msg.t === 'status') {
      printAdminStatus(msg);
      return;
    }
    if (msg.t === 'lobby') {
      // Solo game-over sends lobby right after soloOver — keep the over screen.
      if (msg.svDynamicPrediction != null && CVARS.sv_dynamic_prediction) {
        const s = Number(msg.svDynamicPrediction);
        CVARS.sv_dynamic_prediction.value = Number.isFinite(s) ? Math.max(0, s) : 0;
      }
      if (soloOverOpen) return;
      returnToLobby();
      return;
    }
    if (msg.t === 'session') {
      applyAccountSession(msg);
      return;
    }
    if (msg.t === 'presence') {
      applyPresence(msg);
      return;
    }
    if (msg.t === 'team') {
      applyTeamState(msg);
      return;
    }
    if (msg.t === 'teamInvite') {
      if (msg.from) openTeamInviteModal(String(msg.from));
      else if (msg.ok === 0) {
        const err = msg.err === 'offline' ? 'Player is offline.'
          : msg.err === 'guest' ? 'Register to use teams.'
          : 'Invite failed.';
        alert(err);
      }
      return;
    }
    if (msg.t === 'teamDecline') {
      if (msg.from) {
        /* optional toast */ 
      }
      return;
    }
    if (msg.t === 'addFriend') {
      if (msg.ok) {
        applyAccountSession(msg);
        syncLbActions();
        renderLeaderboard();
      } else {
        alert(msg.err === 'guest' ? 'Register to add friends.'
          : msg.err === 'missing' ? 'Player not found.'
          : 'Could not add friend.');
      }
      return;
    }
    if (msg.t === 'leaderboard') {
      lbRows = Array.isArray(msg.rows) ? msg.rows : [];
      if (Array.isArray(msg.online)) lbOnlineSet = new Set(msg.online.map(String));
      if (Array.isArray(msg.friends)) {
        lbFriendsSet = new Set(msg.friends.map(String));
        accountSession.friends = msg.friends.map(String);
      }
      lbPage = 0;
      renderLeaderboard();
      return;
    }
    if (msg.t === 'demoHistory') {
      lbHistRows = Array.isArray(msg.rows) ? msg.rows : [];
      if (msg.svDemo != null && CVARS.sv_demo) CVARS.sv_demo.value = msg.svDemo | 0;
      lbHistPage = 0;
      renderDemoHistory();
      return;
    }
    if (msg.t === 'svDemo') {
      if (CVARS.sv_demo) CVARS.sv_demo.value = msg.v | 0;
      return;
    }
    if (msg.t === 'svDynamicPrediction') {
      if (CVARS.sv_dynamic_prediction) {
        const s = Number(msg.v);
        CVARS.sv_dynamic_prediction.value = Number.isFinite(s) ? Math.max(0, s) : 0;
      }
      return;
    }
    if (msg.t === 'soloSnap') {
      if (msg.snap) saveSoloSnapshot(msg.snap);
      return;
    }
    if (msg.t === 'queueErr') {
      if (msg.err === 'nosnap') {
        saveSoloSnapshot(null);
        alert('No saved waiting game to continue.');
      }
      showMenu();
      return;
    }
    if (msg.t === 'setName') {
      applyAccountSession(msg);
      if (msg.ok) setAccountMsg('Callsign updated.', true);
      else setAccountMsg(accountErrText(msg.err), false);
      return;
    }
    if (msg.t === 'setColors') {
      applyAccountSession(msg);
      if (msg.ok) setAccountMsg('Colors saved.', true);
      else setAccountMsg(msg.err === 'color' ? 'Invalid color.' : accountErrText(msg.err), false);
      return;
    }
    if (msg.t === 'colors' && inGame) {
      applyPlayerColors(msg.colors);
      return;
    }
    if (msg.t === 'register') {
      applyAccountSession(msg);
      if (msg.ok) {
        setAccountMsg('Account created.', true);
        setPinModalMsg('Account created.', true);
        closePinModal();
      } else {
        setPinModalMsg(accountErrText(msg.err), false);
        setAccountMsg(accountErrText(msg.err), false);
      }
      return;
    }
    if (msg.t === 'login') {
      applyAccountSession(msg);
      if (msg.ok) {
        setAccountMsg('Logged in.', true);
        setPinModalMsg('Logged in.', true);
        closePinModal();
      } else {
        setPinModalMsg(accountErrText(msg.err), false);
        setAccountMsg(accountErrText(msg.err), false);
      }
      return;
    }
    if (msg.t === 'over') {
      if (demoRec) demoStopRecord(true);
      if (msg.scores) applyScores(msg.scores);
      if (msg.names) applyNames(msg.names);
      if (msg.scoreToWin != null) setScoreToWin(msg.scoreToWin);
      const won = (msg.winner | 0) === myId;
      deathSpectating = false;
      deathSeq = null;
      deathFreezeAt = 0;
      clearMatchPause();
      setRejoinOffer(null);
      inGame = false;
      refreshGridStaticPins();
      updateHud();
      if (waitBannerEl) waitBannerEl.classList.add('hidden');
      if (menuEl) menuEl.classList.add('hidden');
      showScoreBoard({
        oldMe: myScore(),
        oldFoe: foeScore(),
        newMe: myScore(),
        newFoe: foeScore(),
        final: true,
        won
      });
      setTimeout(() => {
        hideScoreBoard(false);
        returnToLobby();
        showMenu();
        if (waitBannerEl) {
          waitBannerEl.classList.add('hidden');
          waitBannerEl.textContent = 'Waiting for player...';
        }
      }, 4200);
      return;
    }
    if (msg.t === 'queued') {
      // Game-over while matchmaking: stay on soloOver (don't open main menu).
      if (soloOverOpen) {
        if (waitBannerEl) {
          waitBannerEl.classList.remove('hidden');
          waitBannerEl.textContent = 'Still matchmaking…';
        }
        if (cancelBtn) cancelBtn.classList.add('visible');
        return;
      }
      // Practice welcome usually follows; keep cancel ready if still on menu.
      if (!inGame) showQueue();
      else if (practiceMode && waitBannerEl) {
        syncSoloWaitBanner();
      }
      return;
    }
    if (msg.t === 'welcome') {
      enterGameFromWelcome(msg);
      return;
    }
    if (msg.t === 'paused' && inGame) {
      applyPausedMsg(msg);
      return;
    }
    if (msg.t === 'resumeCd' && inGame) {
      applyResumeCdMsg(msg);
      return;
    }
    if (msg.t === 'resumed' && inGame) {
      applyResumedMsg(msg);
      return;
    }
    if (msg.t === 'rejoinOffer') {
      setRejoinOffer(msg);
      return;
    }
    if (msg.t === 'pauseErr') {
      const err = msg.err === 'budget' ? 'No pause time left this match.'
        : msg.err === 'noroom' ? 'Not in a match.'
        : 'Could not pause.';
      alert(err);
      return;
    }
    if (msg.t === 'rejoin') {
      if (!msg.ok) {
        setRejoinOffer(null);
        alert(msg.err === 'gone' ? 'That match is gone.'
          : msg.err === 'none' ? 'No match to rejoin.'
          : 'Could not rejoin.');
      }
      return;
    }
    if (msg.t === 'wave' && inGame) {
      hideSoloShop();
      if (ssContinueBtn) {
        ssContinueBtn.textContent = 'START WAVE';
        ssContinueBtn.disabled = false;
      }
      startWaveBanner(msg.n != null ? msg.n : (soloWave + 1));
      // Solo waves: always snap to world center (server does the same).
      if (practiceMode && !coopMode && player.hp > 0 && myId != null) {
        player.x = W * 0.5;
        player.y = H * 0.5;
        player.vx = 0;
        player.vy = 0;
        player.angle = -Math.PI / 2;
        player.av = 0;
        softErr.x = 0; softErr.y = 0; softErr.angle = 0;
        emitGodmodeStartFx(player.x, player.y);
        player.godLeft = GODMODE_TICKS;
      } else if (practiceMode && player.hp > 0) {
        player.godLeft = GODMODE_TICKS;
      }
      updateHud();
      return;
    }
    if (msg.t === 'waveClear' && inGame && practiceMode) {
      // Soft pulse — next WAVE banner arrives with `wave`.
      pushFxRing(player.x, player.y, COL.laser, { r0: 8, r1: 70, life: 500 });
      return;
    }
    if (msg.t === 'shop' && inGame && (practiceMode || consoleAdmin)) {
      showSoloShop(msg);
      return;
    }
    if (msg.t === 'shopBuy' && inGame && (practiceMode || consoleAdmin)) {
      if (msg.ok) {
        applyShopState(msg);
        if (msg.weapon) {
          const slot = WEAPON_NAMES.indexOf(msg.weapon) + 1;
          if (slot > 0) selectedWeapon = slot;
        }
        if (msg.hp != null) player.hp = msg.hp | 0;
        resetLocalShoot(currentWeaponName());
        updateHud();
      }
      return;
    }
    if (msg.t === 'coins' && inGame) {
      setLocalCoins(msg.n | 0);
      if (msg.score != null) setLocalScore(msg.score);
      if (soloShopOpen && soloShopState) {
        soloShopState.coins = localCoins;
        soloShopState.score = localScore;
        renderSoloShop();
      }
      updateHud();
      return;
    }
    if (msg.t === 'lives' && inGame && practiceMode) {
      setSoloLives(msg.n | 0);
      if (soloShopOpen && soloShopState) {
        soloShopState.lives = soloLives;
        renderSoloShop();
      }
      return;
    }
    if (msg.t === 'soloOver') {
      if (demoRec) demoStopRecord(true);
      const w = msg.wave != null ? (msg.wave | 0) : (soloWave | 0);
      const sc = msg.score != null ? (msg.score | 0) : localScore;
      resetMatchState();
      setSoloLives(0);
      showSoloOverScreen(w, sc);
      updateHud();
      return;
    }
    if (msg.t === 'ech' && inGame) {
      beginEnemyCharge(msg.id | 0, msg.ms | 0);
      return;
    }
    if (msg.t === 'ef' && inGame && msg.e) {
      addEnemy(unpackEnemy(msg.e));
      return;
    }
    if (msg.t === 'eu' && inGame && msg.e) {
      applyEnemyUpdate(msg.e);
      return;
    }
    if (msg.t === 'es' && inGame && msg.e) {
      applyEnemySnapList(msg.e, msg.st);
      return;
    }
    if (msg.t === 'eh' && inGame) {
      applyEnemyHp(msg.id, msg.hp);
      return;
    }
    if (msg.t === 'ed' && inGame) {
      removeEnemy(msg.id | 0, msg.x, msg.y, !!msg.silent);
      return;
    }
    if (msg.t === 'go' && inGame) {
      applyMatchGo(msg);
      return;
    }
    if (msg.t === 'readyState' && inGame && !matchLive && matchReadySent) {
      if (waitBannerEl) {
        const n = (msg.ready && msg.ready.length) || 0;
        const need = msg.need != null ? msg.need : 2;
        waitBannerEl.classList.remove('hidden');
        waitBannerEl.textContent = `Waiting for opponent (${n}/${need})...`;
      }
      return;
    }
    if (msg.t === 'roster' && inGame) {
      if (msg.room != null) roomId = msg.room;
      if (msg.scoreToWin != null) setScoreToWin(msg.scoreToWin);
      if (msg.scores) applyScores(msg.scores);
      if (msg.names) applyNames(msg.names);
      if (msg.colors) applyPlayerColors(msg.colors);
      if (msg.tick != null && msg.st != null) {
        syncTick = msg.tick | 0;
        syncSt = msg.st;
        resetTickClock();
      }
      if (msg.players) {
        for (const row of msg.players) {
          if ((row[0] | 0) === myId) reconcileFromServer(row);
        }
        applyRemotePlayers(msg.players, msg.st != null ? msg.st : serverNow());
      }
      updateHud();
      // Refresh intro names if it's still up.
      if (matchIntroEl && matchIntroEl.classList.contains('show')) {
        if (introMeEl) introMeEl.textContent = myCallsign();
        if (introFoeEl) introFoeEl.textContent = foeCallsign();
      }
      return;
    }
    if (msg.t === 'bf' && inGame) {
      const row = msg.b;
      if (isShotgunShellFire(row)) {
        addShotgunShellFire(row, (row[5] | 0) !== myId, true);
        const owner = row[5] | 0;
        if (owner > 0 && owner !== myId && !remotes.has(owner)) {
          pushRemoteSample(owner, [
            owner, row[1], row[2], 0, 0, row[3], 100, 0, 0, 0, 0
          ], serverNow());
        }
        return;
      }
      const b = unpackBullet(row);
      // Own shots already flashed locally; remotes still get muzzle FX here.
      addBullet(b, b.owner !== myId, true);
      // If snaps/roster missed this owner, seed a remote so they aren't invisible.
      if (b.owner > 0 && b.owner !== myId && !remotes.has(b.owner)) {
        const p = bulletTrueAt(b);
        pushRemoteSample(b.owner, [
          b.owner, p.x, p.y, 0, 0, Math.atan2(b.vy, b.vx), 100, 0, 0, 0, 0
        ], serverNow());
      }
      return;
    }
    if (msg.t === 'bu' && inGame && msg.b) {
      const row = msg.b;
      const id = row[0];
      const b = bullets.get(id);
      if (b) {
        b.spawnX = row[1];
        b.spawnY = row[2];
        b.vx = row[3];
        b.vy = row[4];
        b.spawnSt = row[6];
        if (row[7]) b.type = row[7];
      } else {
        addBullet(unpackBullet(row), false, false);
      }
      return;
    }
    if (msg.t === 'vd' && inGame) {
      if (msg.x != null && msg.y != null) emitVoidDamageParticles(msg.x, msg.y);
      if (msg.k && msg.id != null) beginVoidShake(msg.k, msg.id);
      return;
    }
    if (msg.t === 'bd' && inGame) {
      removeBullet(msg.id, msg.hit, msg.x, msg.y);
      return;
    }
    if (msg.t === 'lf' && inGame) {
      addLaser(msg.l, msg.hit, msg.w);
      return;
    }
    if (msg.t === 'rc' && inGame) {
      armRailCharge(msg.id, msg.ms != null ? msg.ms : 500);
      return;
    }
    if (msg.t === 'rf' && inGame && msg.l) {
      const row = msg.l;
      const x0 = row[1], y0 = row[2], x1 = row[3], y1 = row[4];
      const width = row[5] || 4 * RES_SCALE;
      const hitKind = msg.hit != null ? (msg.hit | 0) : 2;
      const ownerId = row[7];
      const ix = msg.ix != null ? msg.ix : x1;
      const iy = msg.iy != null ? msg.iy : y1;
      stopSfxLoop('railCharge:' + ownerId);
      playSfx(SFX.railFire, { vol: ownerId === myId ? 0.85 : 0.55 });
      railCharges.delete(ownerId);
      railBeams.push({
        x0, y0, x1, y1, width,
        owner: ownerId,
        until: performance.now() + 280
      });
      emitRailBeamParticles(x0, y0, x1, y1, ownerShootColor(ownerId));
      pushGridShock(x0, y0, gridBlastRailOpts(x0, y0, x1, y1));
      if (hitKind === 1) playSfxOverlap(SFX.hitPlayer, { vol: 0.9, pool: 6 });
      else if (hitKind === 3) playSfxOverlap(SFX.hitPlayerBullet, { vol: 0.75, pool: 8 });
      else if (hitKind === 2) playSfxOverlap(SFX.hitAsteroid, { vol: 0.75, pool: 6 });
      emitLaserImpactFx(ix, iy, hitKind);
      if (hitKind === 1 || hitKind === 2 || hitKind === 3) {
        const c = findImpactCenter(ix, iy, hitKind);
        const beamDir = Math.atan2(y1 - y0, x1 - x0);
        emitBulletImpactSparks(ix, iy, c.x, c.y, COL.asteroid, beamDir);
      }
      pushFxRing(ix, iy, ownerShootColor(ownerId), { r0: 5, r1: 38, life: 320 });
      pushHitscanDebug(x0, y0, x1, y1, hitKind, 'railgun');
      return;
    }
    if (msg.t === 'wpn' && inGame) {
      if (msg.w) selectedWeapon = msg.w | 0;
      if (msg.levels) {
        weaponLevels = Object.assign({ default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 }, msg.levels);
      } else if (msg.lvl != null && msg.weapon) {
        weaponLevels[msg.weapon] = msg.lvl | 0;
      }
      if (msg.unlocked) {
        unlockedWeapons = {
          default: false, rocket: false, laser: false, shotgun: false,
          railgun: false, plasma: false, voidcannon: false, asteroidgun: false
        };
        Object.assign(unlockedWeapons, msg.unlocked);
      } else if (msg.weapon) {
        unlockedWeapons = {
          default: false, rocket: false, laser: false, shotgun: false,
          railgun: false, plasma: false, voidcannon: false, asteroidgun: false
        };
        unlockedWeapons[msg.weapon] = true;
      }
      resetLocalShoot(currentWeaponName());
      // Pickup FX plays from pd (all clients); only flash on manual switch.
      if (!msg.pickup) {
        const me = localView();
        const wpn = msg.weapon || currentWeaponName();
        emitWeaponEquipFx(me.x, me.y, wpn, msg.lvl != null ? msg.lvl : getLocalWeaponLevel(wpn));
      }
      updateHud();
      return;
    }
    if (msg.t === 'pup' && inGame) {
      if (msg.kind === 'health') {
        if (msg.hp != null) player.hp = msg.hp | 0;
        const me = localView();
        emitHealthPickupFx(me.x, me.y);
      }
      updateHud();
      return;
    }
    if (msg.t === 'die' && inGame) {
      const oldMe = myScore();
      const oldFoe = foeScore();
      if (msg.scores) applyScores(msg.scores);
      if (msg.names) applyNames(msg.names);
      if (msg.scoreToWin != null) setScoreToWin(msg.scoreToWin);
      if (msg.lives != null) setSoloLives(msg.lives);
      const id = msg.id | 0;
      const killerId = msg.by != null ? (msg.by | 0) : 0;
      const iScored = killerId > 0 && killerId === myId;
      const x = msg.x != null ? msg.x : player.x;
      const y = msg.y != null ? msg.y : player.y;
      const shakeMs = msg.shakeMs != null ? msg.shakeMs : 1000;
      deathSpectating = true;
      deathFreezeAt = serverNow();
      // Lock asteroid clocks to the freeze instant (server also pauses rocks).
      rebaseAsteroidsToTime(deathFreezeAt);
      player.vx = 0;
      player.vy = 0;
      player.av = 0;
      softErr.x = 0; softErr.y = 0; softErr.angle = 0;
      localShoot.bursting = false;
      localShoot.railChargeLeft = 0;
      stopAllRocketTravelSfx();
      bullets.clear();

      let angle = player.angle;
      let color = ownerPlayerColor(myId);
      if (id === myId) {
        // Keep drawing through shake; mark dead for gameplay after boom.
        player.hp = 0;
        player.powerups = freshPowerups();
      } else {
        const r = remotes.get(id);
        if (r) {
          r.hp = 0;
          r.powerups = freshPowerups();
          r.vx = 0;
          r.vy = 0;
          angle = r.angle;
        }
        color = ownerPlayerColor(id);
      }
      if (iScored) {
        const me = localView();
        emitScorePopFx(me.x, me.y);
      }
      deathSeq = {
        id,
        x, y,
        angle,
        color,
        shakeUntil: performance.now() + shakeMs,
        preGridAt: performance.now() + Math.max(0, shakeMs - 100),
        preGridDone: false,
        phase: 'shake'
      };
      if (!practiceMode) {
        showScoreBoard({
          oldMe,
          oldFoe,
          newMe: myScore(),
          newFoe: foeScore(),
          iScored,
          final: false
        });
      }
      updateHud();
      return;
    }
    if (msg.t === 'boom' && inGame) {
      if (deathSeq && deathSeq.phase === 'boom') return; // already exploded (local timer)
      const id = msg.id | 0;
      const x = msg.x != null ? msg.x : (deathSeq ? deathSeq.x : player.x);
      const y = msg.y != null ? msg.y : (deathSeq ? deathSeq.y : player.y);
      const color = deathSeq && deathSeq.id === id ? deathSeq.color
        : ownerPlayerColor(id);
      const preDone = deathSeq && deathSeq.id === id && deathSeq.preGridDone;
      deathSeq = {
        id, x, y, color,
        phase: 'boom',
        shakeUntil: 0,
        preGridDone: true,
        angle: deathSeq ? deathSeq.angle : 0
      };
      if (!preDone) emitDeathPreGridFx(x, y);
      emitPlayerDeathFx(x, y, color);
      if (id === myId) player.hp = 0;
      else {
        const r = remotes.get(id);
        if (r) r.hp = 0;
      }
      return;
    }
    if (msg.t === 'astHit' && inGame && msg.you) {
      const y = msg.you;
      const alreadyFelt = player.collideCd > 0 || player.stunned;
      player.x = y[0]; player.y = y[1];
      player.vx = y[2]; player.vy = y[3];
      player.angle = y[4];
      player.av = y[5];
      player.hp = y[6];
      player.stunned = !!y[7];
      player.turnDecelStep = 0;
      player.turnDecelLeft = 0;
      player.turnDecelRev = 0;
      player.collideCd = COLLIDE_IFRAME_TICKS;
      softErr.x = 0; softErr.y = 0; softErr.angle = 0;
      if (!alreadyFelt) emitPlayerAsteroidHit(player.x, player.y);
      updateHud();
      return;
    }
    if (msg.t === 'empHit' && inGame && msg.you) {
      const y = msg.you;
      player.x = y[0]; player.y = y[1];
      player.vx = y[2]; player.vy = y[3];
      player.angle = y[4];
      player.av = y[5];
      if (y[6] != null) player.hp = y[6];
      player.stunned = !!y[7];
      player.turnDecelStep = 0;
      player.turnDecelLeft = 0;
      player.turnDecelRev = 0;
      softErr.x = 0; softErr.y = 0; softErr.angle = 0;
      pushFxRing(player.x, player.y, COL.powerEmp, { r0: 4, r1: 28, life: 280 });
      updateHud();
      return;
    }
    if (msg.t === 'round' && inGame) {
      deathSpectating = false;
      deathSeq = null;
      deathFreezeAt = 0;
      hideScoreBoard(false);
      applyScores(msg.scores);
      if (msg.names) applyNames(msg.names);
      if (msg.lives != null) setSoloLives(msg.lives);
      stopAllRocketTravelSfx();
      bullets.clear();
      // Authoritative asteroid snapshot after death freeze.
      if (msg.asteroids) replaceAsteroidsFromRows(msg.asteroids);
      selectedWeapon = msg.w != null ? (msg.w | 0) : 1;
      if (msg.levels) {
        weaponLevels = Object.assign({ default: 1, rocket: 1, laser: 1, shotgun: 1, railgun: 1, plasma: 1, voidcannon: 1, asteroidgun: 1 }, msg.levels);
      }
      if (msg.ammo != null) {
        resetLocalShoot(currentWeaponName());
        localShoot.shootAmmo = msg.ammo | 0;
      } else {
        resetLocalShoot(currentWeaponName());
      }
      if (msg.you) {
        const y = msg.you;
        player.x = y[1]; player.y = y[2];
        player.vx = y[3]; player.vy = y[4];
        player.angle = y[5];
        player.hp = y[6];
        player.av = y[8] != null ? y[8] : 0;
        player.stunned = !!(y[9] | 0);
        player.godLeft = y[10] != null ? (y[10] | 0) : GODMODE_TICKS;
        player.turnDecelStep = 0;
        player.turnDecelLeft = 0;
        player.turnDecelRev = 0;
        player.collideCd = 0;
        softErr.x = 0; softErr.y = 0; softErr.angle = 0;
        clearScreenShake();
        noteInputAck(y[7] | 0);
        lastAppliedSeq = y[7] | 0;
        if ((player.godLeft | 0) > 0) emitGodmodeStartFx(player.x, player.y);
      }
      // Revive remotes immediately (die left them at hp 0 until the next snap).
      if (msg.players) {
        clearRemoteHist();
        applyRemotePlayers(msg.players, serverNow());
      }
      if (msg.powerups) {
        player.powerups = Object.assign(freshPowerups(), msg.powerups);
      } else {
        player.powerups = freshPowerups();
      }
      if (msg.powerupsByPlayer) {
        for (const id of Object.keys(msg.powerupsByPlayer)) {
          applyPowerupsState(id | 0, msg.powerupsByPlayer[id]);
        }
      }
      updateHud();
      return;
    }
    if (msg.t === 'af' && inGame) {
      if (deathSpectating) return; // round snapshot will resync after freeze
      // Server-authoritative spawn (includes portal twins via portal flag in pack).
      const a = unpackAsteroid(msg.a);
      addAsteroid(a);
      // Shard pop when a split piece appears near the playfield.
      if (!a.portal && (a.size === 'small' || a.size === 'medium')) {
        const p = asteroidAt(a);
        if (!asteroidOffScreenAt(a, p.x, p.y)) {
          emitParticles({
            x: p.x, y: p.y,
            count: 6,
            speed: 45 * RES_SCALE,
            speedSpread: 30 * RES_SCALE,
            direction: 0,
            spread: Math.PI * 2,
            size: 2.2 * RES_SCALE,
            lifetime: 0.2,
            color: COL.asteroid,
            drag: 3
          });
        }
      }
      return;
    }
    if (msg.t === 'ad' && inGame) {
      if (deathSpectating) return;
      const silent = !!msg.silent;
      if (!silent && msg.x != null && msg.y != null) {
        const n = msg.coins != null ? (msg.coins | 0) : 32;
        const by = msg.by != null ? (msg.by | 0) : 0;
        if (n > 0 && by > 0) spawnCoinBurstToPlayer(msg.x, msg.y, n, by);
      }
      removeAsteroid(msg.id, silent);
      return;
    }
    if (msg.t === 'aw' && inGame) {
      if (deathSpectating) return;
      applyAsteroidWrap(msg.a);
      return;
    }
    if (msg.t === 'mc' && inGame) {
      if (deathSpectating) return;
      emitMeteorGunCrashFx(msg.x, msg.y, msg.nx, msg.ny, msg.id);
      return;
    }
    if (msg.t === 'ag' && inGame) {
      // Authoritative asteroid ghost dump for sv_send_asteroids (dead-reckoned locally).
      const rows = msg.a || [];
      const st = msg.st != null ? msg.st : serverNow();
      asteroidGhosts = rows.map(r => ({
        id: r[0],
        spawnX: r[1],
        spawnY: r[2],
        vx: r[3],
        vy: r[4],
        spawnAngle: r[5],
        spin: r[6],
        r: r[7],
        spawnSt: st
      }));
      return;
    }
    if (msg.t === 'pf' && inGame) {
      const u = unpackPickup(msg.u);
      addPickup(u);
      const p = pickupAt(u);
      const col = u.kind === 'health' ? COL.health : COL.pickup;
      pushFxRing(p.x, p.y, col, {
        r0: 2, r1: 20, life: 280
      });
      emitParticles({
        x: p.x, y: p.y,
        count: 8,
        speed: 40 * RES_SCALE,
        speedSpread: 25 * RES_SCALE,
        direction: 0,
        spread: Math.PI * 2,
        size: 2.4 * RES_SCALE,
        lifetime: 0.25,
        color: col,
        drag: 2.8
      });
      return;
    }
    if (msg.t === 'pwr' && inGame) {
      const id = msg.id | 0;
      const hadReload = id === myId && !!(player.powerups && player.powerups.reload);
      applyPowerupsState(id, msg.powerups);
      if (id === myId && !hadReload && player.powerups && player.powerups.reload) {
        if (localShoot.reloadLeft > 0) {
          localShoot.reloadLeft = Math.max(1, Math.round(localShoot.reloadLeft * 0.5));
        }
      }
      updateHud();
      return;
    }
    if (msg.t === 'pd' && inGame) {
      if (msg.silent) {
        pickups.delete(msg.id);
        return;
      }
      if (msg.x != null && msg.y != null) {
        const u = pickups.get(msg.id);
        const kind = msg.kind || (u ? u.kind : 'weapon');
        const weapon = msg.weapon || (u ? u.weapon : 'default');
        const powerup = msg.powerup || (u ? u.powerup : null);
        const lvl = msg.lvl != null ? (msg.lvl | 0) : 1;
        emitPickupCollectFx(msg.x, msg.y, kind, weapon, lvl, powerup);
        pickups.delete(msg.id);
      } else {
        removePickup(msg.id);
      }
      return;
    }
    if (msg.t === 'pb' && inGame) {
      applyPickupBounce(msg.u);
      return;
    }
    if (msg.t === 'pong' && connected) {
      applyNtp(msg.ct, msg.st, msg.tick || 0);
      updateHud();
      return;
    }
    if (msg.t === 'snap' && inGame) applySnapshot(msg);
  };
}

if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (!connected || !ws || ws.readyState !== 1) return;
    openModePanel();
  });
}
if (rejoinBtn) {
  rejoinBtn.addEventListener('click', () => {
    if (!connected || !ws || ws.readyState !== 1) return;
    if (!pendingRejoinOffer) return;
    ws.send(JSON.stringify({ t: 'rejoin' }));
  });
}
if (pauseReadyBtn) {
  pauseReadyBtn.addEventListener('click', () => sendPauseReady());
}
if (pauseLeaveBtn) {
  pauseLeaveBtn.addEventListener('click', () => leaveFromPause());
}
if (pausePanelEl) {
  pausePanelEl.addEventListener('click', (e) => {
    // Don't dismiss by backdrop click — must Ready or Leave.
    e.stopPropagation();
  });
}
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    if (!connected || !ws || ws.readyState !== 1) return;
    if (soloShopOpen) return;
    if (soloOverOpen || (inGame && practiceMode)) {
      if (!confirm(soloOverOpen
        ? 'Quit matchmaking and return to the main menu?'
        : 'Quit solo run and return to the main menu?')) return;
    }
    ws.send(JSON.stringify({ t: 'cancel' }));
    hideSoloOverScreen();
    hideSoloShop();
    setPracticeWaiting(false);
    showMenu();
  });
}

if (soloRestartBtn) {
  soloRestartBtn.addEventListener('click', () => {
    if (!connected || !ws || ws.readyState !== 1) return;
    if (!soloOverOpen) return;
    hideSoloOverScreen();
    ws.send(JSON.stringify({ t: 'soloRestart' }));
  });
}

if (soloMenuBtn) {
  soloMenuBtn.addEventListener('click', () => {
    if (!connected || !ws || ws.readyState !== 1) return;
    if (!confirm('Quit matchmaking and return to the main menu?')) return;
    ws.send(JSON.stringify({ t: 'cancel' }));
    returnToLobby();
  });
}

addEventListener('keydown', e => {
  if (consoleOpen || gridPanelOpen) return;
  if (settingsPanelEl && settingsPanelEl.classList.contains('open')) return;
  const accountPanel = document.getElementById('account-panel');
  if (accountPanel && accountPanel.classList.contains('open')) return;
  const lbPanel = document.getElementById('leaderboard-panel');
  if (lbPanel && lbPanel.classList.contains('open')) return;
  const modePanel = document.getElementById('mode-panel');
  if (modePanel && modePanel.classList.contains('open')) return;
  if (e.code === 'Escape' && demoPlay && demoPlay.active) {
    e.preventDefault();
    demoStopPlay(false);
    return;
  }
  if (e.code === 'Escape' && soloOverOpen && ws && ws.readyState === 1) {
    if (!confirm('Quit matchmaking and return to the main menu?')) return;
    ws.send(JSON.stringify({ t: 'cancel' }));
    returnToLobby();
    return;
  }
  if (e.code === 'Escape' && inGame && ws && ws.readyState === 1) {
    e.preventDefault();
    requestMatchPause();
  }
});

/* ========== Grid tune panel (F1) ========== */
const GRID_PANEL_GLOBALS = [
  { name: 'cl_grid', min: 0, max: 5, step: 1 },
  { name: 'cl_background_bake', min: 0, max: 1, step: 1 },
  { name: 'cl_background_bake_quality', min: 5, max: 14, step: 1 },
  { name: 'cl_grid_maxspeed', min: 0, max: 800, step: 1 },
  { name: 'cl_grid_maxdisp', min: 0.2, max: 2000, step: 1 },
  { name: 'cl_grid_size', min: 2, max: 80, step: 1 },
  { name: 'cl_grid_width', min: 0.25, max: 8, step: 0.25 },
  { name: 'cl_grid_alpha', min: 0, max: 1, step: 0.01 },
  { name: 'cl_bg_layer', min: 0, max: 1, step: 1 },
  { name: 'cl_bg_dir_invert', min: 0, max: 1, step: 1 }
];
const GRID_PANEL_EXPLOSION = [
  { name: 'cl_grid_amp', min: 0, max: 3, step: 0.05 },
  { name: 'cl_grid_ripple', min: 0, max: 3, step: 0.05 },
  { name: 'cl_grid_ripple_freq', min: 0, max: 4, step: 0.05 }
];
const GRID_PANEL_AST = [
  { name: 'cl_ast_outline_tex', min: 0, max: 1, step: 1 },
  { name: 'cl_ast_outline_alpha', min: 0, max: 1, step: 0.01 },
  { name: 'cl_ast_face_tex', min: 0, max: 1, step: 1 },
  { name: 'cl_ast_face_alpha', min: 0, max: 1, step: 0.01 },
  { name: 'cl_ast_face_tint', min: 0, max: 1, step: 0.01 },
  { name: 'cl_ast_wire_width', min: 0.5, max: 8, step: 0.25 },
  { name: 'cl_ast_wire_alpha', min: 0, max: 1, step: 0.01 },
  { name: 'cl_ast_z_min', min: 0.1, max: 3, step: 0.01 },
  { name: 'cl_ast_z_max', min: 0.1, max: 3, step: 0.01 },
  { name: 'cl_ast_emit', min: 0, max: 2, step: 0.01 },
  { name: 'cl_ast_outline_emit', min: 0, max: 2, step: 0.01 }
];
const GRID_PANEL_CVARS = GRID_PANEL_GLOBALS.concat(GRID_PANEL_EXPLOSION).concat(GRID_PANEL_AST);

const GLOW_PANEL_GRID_COLOR = [
  { name: 'cl_grid_color_r', min: 0, max: 1, step: 0.01 },
  { name: 'cl_grid_color_g', min: 0, max: 1, step: 0.01 },
  { name: 'cl_grid_color_b', min: 0, max: 1, step: 0.01 }
];
const GLOW_PANEL_BG_COLOR = [
  { name: 'cl_bg_color_r', min: 0, max: 1, step: 0.01 },
  { name: 'cl_bg_color_g', min: 0, max: 1, step: 0.01 },
  { name: 'cl_bg_color_b', min: 0, max: 1, step: 0.01 }
];
const GLOW_PANEL_CVARS = GLOW_PANEL_GRID_COLOR.concat(GLOW_PANEL_BG_COLOR);

const gridPanelEl = document.getElementById('grid-panel');
const glowPanelEl = document.getElementById('glow-panel');
let gridPanelOpen = false;

/** F1-only preview radius / directional blow power / per-blast materials (not cvars). */
let gridProbeRadius = 36;
let gridProbeDirPower = 1;
let gridProbeElasticity = GRID_ELASTICITY_DEFAULT;
let gridProbeAnchor = GRID_ANCHOR_DEFAULT;
/** F1 blast shape: 'radial' | 'directional' | 'line' | 'square' | 'star' | 'hexagon' | 'rays' | 'full' */
let gridProbeShape = 'radial';
const GRID_PROBE_SHAPES = {
  radial: 1,
  directional: 1,
  line: 1,
  square: 1,
  star: 1,
  hexagon: 1,
  rays: 1,
  full: 1
};

function syncGridProbeRadiusUi() {
  if (!gridPanelEl) return;
  const input = gridPanelEl.querySelector('input[data-probe="radius"]');
  const valEl = gridPanelEl.querySelector('[data-probe-val="radius"]');
  if (input && document.activeElement !== input) input.value = String(gridProbeRadius);
  if (valEl) valEl.textContent = String(Math.round(gridProbeRadius));
  const pInput = gridPanelEl.querySelector('input[data-probe="dir-power"]');
  const pVal = gridPanelEl.querySelector('[data-probe-val="dir-power"]');
  if (pInput && document.activeElement !== pInput) pInput.value = String(gridProbeDirPower);
  if (pVal) pVal.textContent = String(Math.round(Number(gridProbeDirPower) * 100) / 100);
  const eInput = gridPanelEl.querySelector('input[data-probe="elasticity"]');
  const eVal = gridPanelEl.querySelector('[data-probe-val="elasticity"]');
  if (eInput && document.activeElement !== eInput) eInput.value = String(gridProbeElasticity);
  if (eVal) eVal.textContent = String(Math.round(gridProbeElasticity));
  const aInput = gridPanelEl.querySelector('input[data-probe="anchor"]');
  const aVal = gridPanelEl.querySelector('[data-probe-val="anchor"]');
  if (aInput && document.activeElement !== aInput) aInput.value = String(gridProbeAnchor);
  if (aVal) aVal.textContent = String(Math.round(gridProbeAnchor));
}

function syncGridShapeUi() {
  if (!gridPanelEl) return;
  const wrap = gridPanelEl.querySelector('#grid-shapes');
  if (!wrap) return;
  wrap.querySelectorAll('button[data-shape]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-shape') === gridProbeShape);
  });
}

function shipMeshSourceLabel(src) {
  if (src === 'elite') return 'Elite';
  if (src === 'fe2') return 'Frontier / FE2';
  if (src === 'alien') return 'Alien';
  return 'Default';
}

function shipMeshSectionOrder(src) {
  if (src === 'local') return 0;
  if (src === 'elite') return 1;
  if (src === 'fe2') return 2;
  if (src === 'alien') return 3;
  return 9;
}

function shipMeshSectionTitle(src) {
  if (src === 'elite') return 'Elite';
  if (src === 'fe2') return 'Frontier / FE2';
  if (src === 'alien') return 'Alien ships';
  return 'Default';
}

function syncShipMeshUi() {
  if (!gridPanelEl) return;
  const wrap = gridPanelEl.querySelector('#ship-meshes');
  const meta = gridPanelEl.querySelector('#ship-mesh-meta');
  const mesh = getActiveShipMesh();
  if (meta && mesh) {
    meta.textContent = `${mesh.name} · ${shipMeshSourceLabel(mesh.source)} · ${mesh.verts.length}v / ${mesh.edges.length}e`;
  }
  if (!wrap) return;
  wrap.querySelectorAll('button[data-ship]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-ship') === selectedShipMeshId);
  });
}

function buildShipMeshUi() {
  if (!gridPanelEl) return;
  const wrap = gridPanelEl.querySelector('#ship-meshes');
  if (!wrap || wrap.childElementCount) return;

  const groups = new Map();
  for (const m of SHIP_MESHES) {
    const src = m.source || 'local';
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src).push(m);
  }
  const sources = [...groups.keys()].sort((a, b) => shipMeshSectionOrder(a) - shipMeshSectionOrder(b));
  for (const src of sources) {
    const sec = document.createElement('div');
    sec.className = 'gp-ships-section';
    const title = document.createElement('div');
    title.className = 'gp-ships-section-title';
    title.textContent = shipMeshSectionTitle(src);
    sec.appendChild(title);
    const row = document.createElement('div');
    row.className = 'gp-ships-row';
    for (const m of groups.get(src)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-ship', m.id);
      btn.title = `${m.name} (${shipMeshSourceLabel(m.source)})`;
      btn.textContent = m.name;
      btn.addEventListener('click', () => setActiveShipMesh(m.id));
      row.appendChild(btn);
    }
    sec.appendChild(row);
    wrap.appendChild(sec);
  }
  syncShipMeshUi();
}

function setGridProbeShape(shape) {
  if (!GRID_PROBE_SHAPES[shape]) return;
  if (gridProbeShape === shape) return;
  gridProbeShape = shape;
  clearGridLinePick();
  syncGridShapeUi();
}

function formatGridCvarValue(name, v) {
  if (name === 'cl_grid' || name === 'cl_grid_implosion' || name === 'cl_background_bake') {
    return String(v | 0);
  }
  if (name === 'cl_background_bake_quality') return String(Math.max(5, Math.min(14, v | 0)));
  if (
    name === 'cl_grid_maxdisp' || name === 'cl_grid_amp' || name === 'cl_grid_width'
    || name === 'cl_grid_ripple' || name === 'cl_grid_ripple_freq'
    || name === 'cl_grid_alpha'
    || name === 'cl_ast_outline_alpha' || name === 'cl_ast_face_alpha'
    || name === 'cl_ast_face_tint' || name === 'cl_ast_wire_width' || name === 'cl_ast_wire_alpha'
    || name === 'cl_ast_z_min' || name === 'cl_ast_z_max'
    || name === 'cl_ast_emit' || name === 'cl_ast_outline_emit'
    || name === 'cl_grid_color_r' || name === 'cl_grid_color_g' || name === 'cl_grid_color_b'
    || name === 'cl_bg_color_r' || name === 'cl_bg_color_g' || name === 'cl_bg_color_b'
  ) {
    return String(Math.round(Number(v) * 100) / 100);
  }
  return String(Math.round(Number(v)));
}

function syncGridPanelFromCvars() {
  const panel = document.getElementById('grid-panel');
  if (!panel) return;
  for (const row of GRID_PANEL_CVARS) {
    const c = CVARS[row.name];
    if (!c) continue;
    const input = panel.querySelector(`input[data-cvar="${row.name}"]`);
    const valEl = panel.querySelector(`[data-val="${row.name}"]`);
    // Slider stays in its HTML range; label shows the real (possibly uncapped) console value.
    if (input && document.activeElement !== input) {
      const shown = Math.max(row.min, Math.min(row.max, Number(c.value)));
      input.value = String(shown);
    }
    if (valEl) valEl.textContent = formatGridCvarValue(row.name, c.value);
  }
  panel.querySelectorAll('input[data-cvar-check]').forEach((box) => {
    const name = box.getAttribute('data-cvar-check');
    if (!name || !CVARS[name]) return;
    if (document.activeElement !== box) box.checked = (cv(name) | 0) !== 0;
  });
  syncGridProbeRadiusUi();
  syncGridShapeUi();
  syncShipMeshUi();
}

function rgbCvarsToHex(rName, gName, bName) {
  const toByte = (v) => {
    const n = Math.round(Math.max(0, Math.min(1, Number(v))) * 255);
    return (n < 16 ? '0' : '') + n.toString(16);
  };
  return '#' + toByte(cv(rName)) + toByte(cv(gName)) + toByte(cv(bName));
}

function setRgbCvarsFromHex(hex, rName, gName, bName) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return;
  const n = parseInt(m[1], 16);
  if (CVARS[rName]) CVARS[rName].value = ((n >> 16) & 255) / 255;
  if (CVARS[gName]) CVARS[gName].value = ((n >> 8) & 255) / 255;
  if (CVARS[bName]) CVARS[bName].value = (n & 255) / 255;
  if (rName.indexOf('cl_bg_') === 0) syncBgClearFromCvars();
  syncGlowPanelFromCvars();
}

function gridColorToHex() {
  return rgbCvarsToHex('cl_grid_color_r', 'cl_grid_color_g', 'cl_grid_color_b');
}

function setGridColorFromHex(hex) {
  setRgbCvarsFromHex(hex, 'cl_grid_color_r', 'cl_grid_color_g', 'cl_grid_color_b');
}

function bgColorToHex() {
  return rgbCvarsToHex('cl_bg_color_r', 'cl_bg_color_g', 'cl_bg_color_b');
}

function setBgColorFromHex(hex) {
  setRgbCvarsFromHex(hex, 'cl_bg_color_r', 'cl_bg_color_g', 'cl_bg_color_b');
}

function syncGlowPanelFromCvars() {
  const panel = gridPanelEl;
  if (!panel) return;
  for (const row of GLOW_PANEL_CVARS) {
    const c = CVARS[row.name];
    if (!c) continue;
    const input = panel.querySelector(`input[data-cvar="${row.name}"]`);
    const valEl = panel.querySelector(`[data-val="${row.name}"]`);
    if (input && document.activeElement !== input) {
      const shown = Math.max(row.min, Math.min(row.max, Number(c.value)));
      input.value = String(shown);
    }
    if (valEl) valEl.textContent = formatGridCvarValue(row.name, c.value);
  }
  const colorInput = panel.querySelector('input[data-grid-color]');
  if (colorInput && document.activeElement !== colorInput) {
    colorInput.value = gridColorToHex();
  }
  const hexEl = panel.querySelector('[data-grid-color-hex]');
  if (hexEl) hexEl.textContent = gridColorToHex();
  const bgInput = panel.querySelector('input[data-bg-color]');
  if (bgInput && document.activeElement !== bgInput) {
    bgInput.value = bgColorToHex();
  }
  const bgHexEl = panel.querySelector('[data-bg-color-hex]');
  if (bgHexEl) bgHexEl.textContent = bgColorToHex();
}

let gpTab = 'grid'; // 'grid' | 'bg' | 'ship' | 'ast' | 'light'

function setGridPanelTab(tab) {
  gpTab = (tab === 'bg' || tab === 'ship' || tab === 'ast' || tab === 'light') ? tab : 'grid';
  if (!gridPanelEl) return;
  gridPanelEl.querySelectorAll('[data-gp-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-gp-tab') === gpTab);
  });
  gridPanelEl.querySelectorAll('[data-gp-pane]').forEach((pane) => {
    pane.classList.toggle('show', pane.getAttribute('data-gp-pane') === gpTab);
  });
}

function openGridPanel() {
  if (!gridPanelEl) return;
  gridPanelOpen = true;
  gridPanelEl.classList.add('open');
  gridPanelEl.setAttribute('aria-hidden', 'false');
  for (const k of Object.keys(keys)) keys[k] = false;
  spaceLatch = false;
  enterLatch = false;
  setGridPanelTab(gpTab || 'grid');
  syncGridPanelFromCvars();
  syncGlowPanelFromCvars();
  syncLightingUi();
}

function closeGridPanel() {
  if (!gridPanelEl) return;
  gridPanelOpen = false;
  gridPanelEl.classList.remove('open');
  gridPanelEl.setAttribute('aria-hidden', 'true');
  endGridProbe();
  clearGridLinePick();
}

function toggleGridPanel() {
  if (gridPanelOpen) closeGridPanel();
  else openGridPanel();
}

function canvasToWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return { x: W * 0.5, y: H * 0.5 };
  return {
    x: ((clientX - r.left) / r.width) * W,
    y: ((clientY - r.top) / r.height) * H
  };
}

/** F1 probe — panel amp/ripple + preview radius. opts: inward, dirX, dirY, x1, y1, power, quiet, shape */
function testGridBlastAt(x, y, opts) {
  opts = opts || {};
  const ampMul = Math.max(0, cv('cl_grid_amp'));
  const ripple = Math.max(0, cv('cl_grid_ripple'));
  const tickPower = opts.power != null ? Math.max(0, opts.power) : 1;
  const inward = !!opts.inward;
  const radius = Math.max(0, gridProbeRadius);
  const shape = opts.shape || gridProbeShape;
  const isFull = shape === 'full';
  const isLine = opts.x1 != null && opts.y1 != null
    && Math.hypot(opts.x1 - x, opts.y1 - y) > 1e-3;
  const directional = shape === 'directional' && !isLine && opts.dirX != null && opts.dirY != null
    && Math.hypot(opts.dirX, opts.dirY) > 1e-6;
  const isPoly = shape === 'square' || shape === 'star' || shape === 'hexagon';
  const isRays = shape === 'rays';
  // full covers the whole grid — radius slider is unused.
  if (!isFull && !(radius > 0)) return;
  const power = directional
    ? tickPower * Math.max(0, gridProbeDirPower)
    : tickPower;
  if (!(power > 0) && directional) return;
  const shock = {
    amp: 16 * RES_SCALE * Math.max(0.05, ampMul) * Math.max(0.05, power),
    width: isFull ? 1 : radius,
    ripple: (directional || isLine) ? ripple * 0.65 : ripple,
    freq: Math.max(0, cv('cl_grid_ripple_freq')),
    inward,
    elasticity: gridProbeElasticity,
    anchor: gridProbeAnchor
  };
  if (isLine) {
    shock.x1 = opts.x1;
    shock.y1 = opts.y1;
  } else if (isFull || isPoly || isRays) {
    shock.shape = shape;
    if (isPoly) shock.rot = Math.random() * Math.PI * 2;
  } else if (directional) {
    shock.dirX = opts.dirX;
    shock.dirY = opts.dirY;
  }
  pushGridShock(x, y, shock);
  if (!opts.quiet) {
    playSfxOverlap(SFX.explosion, { vol: isLine ? 0.45 : directional ? 0.28 : 0.55, pool: 4 });
  }
}

/** F1 drag probe state: tap = radial on release; drag = directional per tick.
 *  Shift + two taps = line blast between endpoints. */
const GRID_PROBE_TAP_MAX = 10 * RES_SCALE;
const GRID_PROBE_TICK_MIN = 5 * RES_SCALE;
let gridProbe = null;
/** Pending first endpoint for Shift line pick: {x,y,inward} */
let gridLinePick = null;

function endGridProbe() {
  gridProbe = null;
}

function clearGridLinePick() {
  gridLinePick = null;
}

function markGridLinePick(x, y) {
  // Visual marker removed — grid probe stays particle-free.
}

function copyTextToClipboard(text, btn) {
  const done = () => {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 900);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (_) {}
    });
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (_) {}
  }
}

function formatCvarLines(rows) {
  return rows.map((row) => {
    const c = CVARS[row.name];
    const v = c ? c.value : 0;
    return `${row.name} ${formatGridCvarValue(row.name, v)}`;
  });
}

function copyGridGlobals() {
  const btn = document.getElementById('grid-copy-globals');
  copyTextToClipboard(formatCvarLines(GRID_PANEL_GLOBALS).join('\n'), btn);
}

function copyGridExplosion() {
  const btn = document.getElementById('grid-copy-explosion');
  const lines = formatCvarLines(GRID_PANEL_EXPLOSION);
  lines.unshift(`shape ${gridProbeShape}`);
  lines.push(`radius ${Math.round(gridProbeRadius)}`);
  lines.push(`dir_power ${Math.round(Number(gridProbeDirPower) * 100) / 100}`);
  lines.push(`elasticity ${Math.round(gridProbeElasticity)}`);
  lines.push(`anchor ${Math.round(gridProbeAnchor)}`);
  copyTextToClipboard(lines.join('\n'), btn);
}

function copyGlowGridColor() {
  const btn = document.getElementById('glow-copy-grid-color');
  const lines = formatCvarLines(GLOW_PANEL_GRID_COLOR);
  lines.push(`hex ${gridColorToHex()}`);
  copyTextToClipboard(lines.join('\n'), btn);
}

function copyGlowBgColor() {
  const btn = document.getElementById('glow-copy-bg-color');
  const lines = formatCvarLines(GLOW_PANEL_BG_COLOR);
  lines.push(`hex ${bgColorToHex()}`);
  copyTextToClipboard(lines.join('\n'), btn);
}

function copyGridSettings() {
  copyGridGlobals();
}

if (gridPanelEl) {
  buildShipMeshUi();
  for (const row of GRID_PANEL_CVARS) {
    const input = gridPanelEl.querySelector(`input[data-cvar="${row.name}"]`);
    if (!input) continue;
    input.addEventListener('input', () => {
      setCvar(row.name, input.value);
      const valEl = gridPanelEl.querySelector(`[data-val="${row.name}"]`);
      if (valEl) valEl.textContent = formatGridCvarValue(row.name, cv(row.name));
    });
  }
  gridPanelEl.querySelectorAll('input[data-cvar-check]').forEach((box) => {
    box.addEventListener('change', () => {
      const name = box.getAttribute('data-cvar-check');
      if (!name) return;
      setCvar(name, box.checked ? 1 : 0);
    });
  });
  const radiusInput = gridPanelEl.querySelector('input[data-probe="radius"]');
  if (radiusInput) {
    radiusInput.addEventListener('input', () => {
      gridProbeRadius = Math.max(0, Math.min(220, Number(radiusInput.value) || 0));
      const valEl = gridPanelEl.querySelector('[data-probe-val="radius"]');
      if (valEl) valEl.textContent = String(Math.round(gridProbeRadius));
    });
  }
  const dirPowerInput = gridPanelEl.querySelector('input[data-probe="dir-power"]');
  if (dirPowerInput) {
    dirPowerInput.addEventListener('input', () => {
      gridProbeDirPower = Math.max(0, Math.min(5, Number(dirPowerInput.value) || 0));
      const valEl = gridPanelEl.querySelector('[data-probe-val="dir-power"]');
      if (valEl) valEl.textContent = String(Math.round(gridProbeDirPower * 100) / 100);
    });
  }
  const elasticityInput = gridPanelEl.querySelector('input[data-probe="elasticity"]');
  if (elasticityInput) {
    elasticityInput.addEventListener('input', () => {
      gridProbeElasticity = Math.max(0, Math.min(300, Number(elasticityInput.value) || 0));
      const valEl = gridPanelEl.querySelector('[data-probe-val="elasticity"]');
      if (valEl) valEl.textContent = String(Math.round(gridProbeElasticity));
    });
  }
  const anchorInput = gridPanelEl.querySelector('input[data-probe="anchor"]');
  if (anchorInput) {
    anchorInput.addEventListener('input', () => {
      gridProbeAnchor = Math.max(0, Math.min(400, Number(anchorInput.value) || 0));
      const valEl = gridPanelEl.querySelector('[data-probe-val="anchor"]');
      if (valEl) valEl.textContent = String(Math.round(gridProbeAnchor));
    });
  }
  const shapes = gridPanelEl.querySelector('#grid-shapes');
  if (shapes) {
    shapes.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-shape]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      setGridProbeShape(btn.getAttribute('data-shape'));
    });
  }
  gridPanelEl.querySelectorAll('[data-gp-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setGridPanelTab(btn.getAttribute('data-gp-tab'));
    });
  });
  const copyGlobalsBtn = document.getElementById('grid-copy-globals');
  if (copyGlobalsBtn) copyGlobalsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyGridGlobals();
  });
  const copyExplosionBtn = document.getElementById('grid-copy-explosion');
  if (copyExplosionBtn) copyExplosionBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyGridExplosion();
  });
  const closeBtn = document.getElementById('grid-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeGridPanel();
  });
  // Keep panel clicks from reaching the canvas test handler.
  gridPanelEl.addEventListener('pointerdown', (e) => e.stopPropagation());
}

if (gridPanelEl) {
  for (const row of GLOW_PANEL_CVARS) {
    const input = gridPanelEl.querySelector(`input[data-cvar="${row.name}"]`);
    if (!input) continue;
    input.addEventListener('input', () => {
      setCvar(row.name, input.value);
      const valEl = gridPanelEl.querySelector(`[data-val="${row.name}"]`);
      if (valEl) valEl.textContent = formatGridCvarValue(row.name, cv(row.name));
      if (row.name.indexOf('cl_grid_color_') === 0) {
        const colorInput = gridPanelEl.querySelector('input[data-grid-color]');
        if (colorInput && document.activeElement !== colorInput) colorInput.value = gridColorToHex();
        const hexEl = gridPanelEl.querySelector('[data-grid-color-hex]');
        if (hexEl) hexEl.textContent = gridColorToHex();
      }
      if (row.name.indexOf('cl_bg_color_') === 0) {
        const bgInput = gridPanelEl.querySelector('input[data-bg-color]');
        if (bgInput && document.activeElement !== bgInput) bgInput.value = bgColorToHex();
        const bgHexEl = gridPanelEl.querySelector('[data-bg-color-hex]');
        if (bgHexEl) bgHexEl.textContent = bgColorToHex();
      }
    });
  }
  const colorInput = gridPanelEl.querySelector('input[data-grid-color]');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      setGridColorFromHex(colorInput.value);
    });
  }
  const bgInput = gridPanelEl.querySelector('input[data-bg-color]');
  if (bgInput) {
    bgInput.addEventListener('input', () => {
      setBgColorFromHex(bgInput.value);
    });
  }
  const copyColorBtn = document.getElementById('glow-copy-grid-color');
  if (copyColorBtn) copyColorBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyGlowGridColor();
  });
  const copyBgBtn = document.getElementById('glow-copy-bg-color');
  if (copyBgBtn) copyBgBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyGlowBgColor();
  });
}

/** F1 middle-click: spawn random powerup at cursor with random velocity. */
function requestDebugPowerupSpawn(clientX, clientY) {
  if (!gridPanelOpen || !inGame || !ws || ws.readyState !== 1) return;
  const p = canvasToWorld(clientX, clientY);
  const ang = Math.random() * Math.PI * 2;
  const spd = (0.4 + Math.random() * 4.2) * RES_SCALE;
  const powerup = POWERUP_TYPES[Math.random() * POWERUP_TYPES.length | 0];
  ws.send(JSON.stringify({
    t: 'dbgPwr',
    x: p.x,
    y: p.y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    powerup
  }));
}

canvas.addEventListener('pointerdown', (e) => {
  if (!gridPanelOpen) return;
  // Middle mouse: spawn random powerup (F1 debug).
  if (e.button === 1) {
    e.preventDefault();
    requestDebugPowerupSpawn(e.clientX, e.clientY);
    return;
  }
  // Left = implosion, right = explosion.
  if (e.button !== 0 && e.button !== 2) return;
  e.preventDefault();
  const p = canvasToWorld(e.clientX, e.clientY);
  gridProbe = {
    pointerId: e.pointerId,
    button: e.button,
    inward: e.button === 0,
    ox: p.x,
    oy: p.y,
    lx: p.x,
    ly: p.y,
    dragged: false,
    path: 0,
    fired: 0
  };
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});

canvas.addEventListener('pointermove', (e) => {
  if (!gridProbe || e.pointerId !== gridProbe.pointerId) return;
  if (!gridPanelOpen) {
    endGridProbe();
    return;
  }
  const p = canvasToWorld(e.clientX, e.clientY);
  const dx = p.x - gridProbe.lx;
  const dy = p.y - gridProbe.ly;
  const tick = Math.hypot(dx, dy);
  const fromOrigin = Math.hypot(p.x - gridProbe.ox, p.y - gridProbe.oy);
  if (fromOrigin > GRID_PROBE_TAP_MAX) gridProbe.dragged = true;
  gridProbe.path += tick;
  // Directional: epicenter follows mouse; wind dir = last→current tick delta.
  // Strength comes only from dir_power (no drag-speed tick multiplier).
  if (gridProbeShape !== 'directional') return;
  if (tick >= GRID_PROBE_TICK_MIN) {
    testGridBlastAt(p.x, p.y, {
      inward: gridProbe.inward,
      dirX: dx,
      dirY: dy,
      power: 1,
      quiet: true
    });
    gridProbe.lx = p.x;
    gridProbe.ly = p.y;
    gridProbe.dragged = true;
    gridProbe.fired++;
  }
});

function finishGridProbe(e) {
  if (!gridProbe || (e && e.pointerId !== gridProbe.pointerId)) return;
  const probe = gridProbe;
  endGridProbe();
  try {
    if (e) canvas.releasePointerCapture(e.pointerId);
  } catch (_) {}
  if (!gridPanelOpen) return;
  const isTap = !probe.dragged && probe.path < GRID_PROBE_TAP_MAX;
  const shape = gridProbeShape;

  if (shape === 'line') {
    if (!isTap) {
      clearGridLinePick();
      return;
    }
    if (!gridLinePick) {
      gridLinePick = { x: probe.ox, y: probe.oy, inward: probe.inward };
      markGridLinePick(probe.ox, probe.oy);
      return;
    }
    const a = gridLinePick;
    clearGridLinePick();
    testGridBlastAt(a.x, a.y, {
      x1: probe.ox,
      y1: probe.oy,
      inward: probe.inward
    });
    return;
  }

  clearGridLinePick();

  if (
    shape === 'radial'
    || shape === 'square'
    || shape === 'star'
    || shape === 'hexagon'
    || shape === 'rays'
    || shape === 'full'
  ) {
    if (isTap) testGridBlastAt(probe.ox, probe.oy, { inward: probe.inward, shape });
    return;
  }

  // directional — already applied while dragging; no extra release blast
}

canvas.addEventListener('pointerup', finishGridProbe);
canvas.addEventListener('pointercancel', finishGridProbe);
canvas.addEventListener('lostpointercapture', (e) => {
  if (gridProbe && e.pointerId === gridProbe.pointerId) endGridProbe();
});
canvas.addEventListener('contextmenu', (e) => {
  if (!gridPanelOpen) return;
  e.preventDefault();
});
canvas.addEventListener('auxclick', (e) => {
  if (!gridPanelOpen || e.button !== 1) return;
  e.preventDefault();
});

/* ========== Developer console (~) ========== */
const conEl = document.getElementById('con');
const conLogEl = document.getElementById('con-log');
const conInputEl = document.getElementById('con-input');
const conSuggestEl = document.getElementById('con-suggest');
let consoleOpen = false;
const conHistory = [];
let conHistIdx = -1;
let conSuggestList = [];
let conSuggestIdx = -1;

/* ========== Client demo record / playback ========== */
const DEMO_STORE_PREFIX = 'asteroids_demo_';
const DEMO_NET_TYPES = new Set([
  'bf', 'bu', 'bd', 'af', 'ad', 'aw', 'lf', 'rf', 'rc',
  'die', 'boom', 'round', 'go', 'paused', 'resumed',
  'wpn', 'pup', 'eh', 'ed', 'ef', 'eu', 'es', 'vd', 'colors', 'roster'
]);

function demoSanitizeName(name) {
  return String(name || '').trim().replace(/[^\w\-]+/g, '_').slice(0, 48);
}

function demoEstTick() {
  if (syncSt) return Math.floor(estimatedServerTick());
  return 0;
}

function demoClone(msg) {
  try { return JSON.parse(JSON.stringify(msg)); } catch (_) { return null; }
}

function demoCollectShips() {
  const ships = [];
  if (myId != null) {
    const me = localView();
    ships.push([
      myId, me.x, me.y, me.vx, me.vy, me.angle, me.hp | 0, me.av || 0,
      player.godLeft | 0
    ]);
  }
  for (const r of remotes.values()) {
    const v = remoteView(r);
    ships.push([
      r.id, v.x, v.y, v.vx, v.vy, v.angle, v.hp | 0, v.av || 0,
      r.godLeft | 0
    ]);
  }
  return ships;
}

function demoCollectAsteroids() {
  const out = [];
  for (const a of asteroids.values()) {
    out.push([
      a.id, a.spawnX, a.spawnY, a.vx, a.vy, a.spawnAngle, a.spin, a.r,
      0,
      a.size === 'big' || a.big ? 2 : (a.size === 'medium' ? 1 : 0),
      a.spawnSt,
      a.special === 'meteor' ? 1 : 0,
      a.centerRock ? 1 : 0,
      a.portal ? 1 : 0,
      a.shapeId != null ? (a.shapeId | 0) : 0,
      a.edgeWraps | 0,
      a.edgeWrapMax | 0,
      a.playerShot ? 1 : 0,
      a.ownerId != null ? (a.ownerId | 0) : 0,
      a.hue != null ? (((a.hue * 360) | 0) % 360) : null
    ]);
  }
  return out;
}

function demoCollectBullets() {
  const out = [];
  for (const b of bullets.values()) {
    out.push([b.id, b.spawnX, b.spawnY, b.vx, b.vy, b.owner, b.spawnSt, b.type || 'default']);
  }
  return out;
}

function demoPushEvent(ev) {
  if (!demoRec || !ev) return;
  if (demoRec.events.length >= 350000) {
    if (!demoRec.truncated) {
      demoRec.truncated = true;
      conPrint('demo recording hit event cap — call stop', 'err');
    }
    return;
  }
  demoRec.events.push(ev);
}

function demoRecordSnapshot(kind) {
  if (!demoRec) return;
  demoPushEvent({
    t: 'snap',
    k: demoEstTick(),
    kind: kind || 'full',
    ships: demoCollectShips(),
    asteroids: demoCollectAsteroids(),
    bullets: demoCollectBullets(),
    scores: [...scores.entries()],
    names: [...rosterNames.entries()],
    myId,
    practice: !!practiceMode
  });
}

function demoStartRecord(rawName) {
  const name = demoSanitizeName(rawName);
  if (!name) {
    conPrint('usage: record <name>', 'err');
    return;
  }
  if (demoPlay && demoPlay.active) {
    conPrint('stop playback first', 'err');
    return;
  }
  if (!inGame) {
    conPrint('start/join a match first, then record', 'err');
    return;
  }
  if (demoRec) {
    if (demoRec.name === name) {
      conPrint('already recording "' + name + '" — use stop', 'info');
      return;
    }
    demoStopRecord(true);
  }
  demoRec = {
    v: 1,
    kind: 'client',
    name,
    tps: TPS,
    w: W,
    h: H,
    myId,
    practice: !!practiceMode,
    startedAt: new Date().toISOString(),
    startTick: demoEstTick(),
    events: [],
    truncated: false
  };
  demoRecordSnapshot('start');
  conPrint('recording "' + name + '" — type stop to save', 'info');
}

function demoRecordAfterTick(frame) {
  if (!demoRec || !frame) return;
  const k = demoEstTick();
  demoPushEvent({
    t: 'in',
    k,
    id: myId | 0,
    l: frame.l ? 1 : 0,
    r: frame.r ? 1 : 0,
    u: frame.u ? 1 : 0,
    sp: frame.sp ? 1 : 0,
    sh: frame.sh ? 1 : 0
  });
  demoPushEvent({ t: 'pose', k, ships: demoCollectShips() });
}

function demoOnNetMsg(msg) {
  if (!demoRec || !msg || !msg.t) return;
  if (!DEMO_NET_TYPES.has(msg.t)) return;
  const copy = demoClone(msg);
  if (!copy) return;
  copy.k = demoEstTick();
  demoPushEvent(copy);
}

function demoStopRecord(quiet) {
  if (!demoRec) {
    if (!quiet) conPrint('not recording', 'err');
    return false;
  }
  const demo = demoRec;
  demo.endTick = demoEstTick();
  demo.endedAt = new Date().toISOString();
  demoRec = null;
  try {
    const key = DEMO_STORE_PREFIX + demo.name;
    const json = JSON.stringify(demo);
    localStorage.setItem(key, json);
    if (!quiet) {
      conPrint(
        'saved demo "' + demo.name + '" (' + (json.length / 1024).toFixed(1) +
        ' KB, ' + demo.events.length + ' events)',
        'info'
      );
    }
  } catch (err) {
    if (!quiet) conPrint('save failed: ' + (err && err.message ? err.message : 'storage'), 'err');
    return false;
  }
  return true;
}

function demoList() {
  const names = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(DEMO_STORE_PREFIX) === 0) {
        names.push(key.slice(DEMO_STORE_PREFIX.length));
      }
    }
  } catch (_) {}
  names.sort();
  if (!names.length) {
    conPrint('no saved demos', 'info');
    return;
  }
  conPrint('demos: ' + names.join(', '), 'info');
}

function demoApplyShips(ships) {
  if (!Array.isArray(ships)) return;
  const seen = new Set();
  for (const row of ships) {
    const id = row[0] | 0;
    seen.add(id);
    if (id === myId) {
      player.x = row[1];
      player.y = row[2];
      player.vx = row[3];
      player.vy = row[4];
      player.angle = row[5];
      player.hp = row[6] | 0;
      player.av = row[7] || 0;
      if (row[8] != null) player.godLeft = row[8] | 0;
      softErr.x = 0; softErr.y = 0; softErr.angle = 0;
    } else {
      let r = remotes.get(id);
      if (!r) {
        r = {
          id, x: row[1], y: row[2], vx: 0, vy: 0, angle: row[5],
          hp: row[6] | 0, av: 0, godLeft: 0, powerups: freshPowerups()
        };
        remotes.set(id, r);
      }
      r.x = row[1];
      r.y = row[2];
      r.vx = row[3];
      r.vy = row[4];
      r.angle = row[5];
      r.hp = row[6] | 0;
      r.av = row[7] || 0;
      if (row[8] != null) r.godLeft = row[8] | 0;
      pushRemoteSample(id, [id, r.x, r.y, r.vx, r.vy, r.angle, r.hp, 0, r.av], serverNow());
    }
  }
  for (const id of [...remotes.keys()]) {
    if (!seen.has(id)) {
      remotes.delete(id);
      remoteHist.delete(id);
    }
  }
}

function demoApplySnap(ev) {
  if (ev.myId != null) myId = ev.myId | 0;
  if (ev.practice != null) setPracticeWaiting(!!ev.practice);
  if (Array.isArray(ev.scores)) {
    scores.clear();
    for (const pair of ev.scores) scores.set(pair[0] | 0, pair[1] | 0);
  }
  if (Array.isArray(ev.names)) {
    rosterNames.clear();
    for (const pair of ev.names) rosterNames.set(pair[0] | 0, String(pair[1] || ''));
  }
  asteroids.clear();
  asteroidGhosts = [];
  if (ev.asteroids) {
    for (const row of ev.asteroids) {
      const a = unpackAsteroid(row);
      a.spawnSt = serverNow();
      addAsteroid(a);
    }
  }
  bullets.clear();
  stopAllRocketTravelSfx();
  if (ev.bullets) {
    for (const row of ev.bullets) {
      const b = unpackBullet(row);
      b.spawnSt = serverNow();
      addBullet(b, false, false);
    }
  }
  demoApplyShips(ev.ships);
}

function demoReplayEvent(ev) {
  if (!ev || !ev.t) return;
  if (ev.t === 'snap') {
    demoApplySnap(ev);
    return;
  }
  if (ev.t === 'pose') {
    demoApplyShips(ev.ships);
    return;
  }
  if (ev.t === 'in' || ev.t === 'pause' || ev.t === 'resume' || ev.t === 'over') return;
  if (ev.t === 'bf') {
    const row = ev.b;
    if (!row) return;
    if (isShotgunShellFire(row)) {
      const br = row.slice();
      br[6] = serverNow();
      addShotgunShellFire(br, true, true);
    } else {
      const b = unpackBullet(row);
      b.spawnSt = serverNow();
      addBullet(b, true, true);
    }
    return;
  }
  if (ev.t === 'bd') {
    removeBullet(ev.id, ev.hit, ev.x, ev.y);
    return;
  }
  if (ev.t === 'bu' && ev.b) {
    const row = ev.b;
    const b = bullets.get(row[0]);
    if (b) {
      b.spawnX = row[1];
      b.spawnY = row[2];
      b.vx = row[3];
      b.vy = row[4];
      b.spawnSt = serverNow();
    }
    return;
  }
  if (ev.t === 'af' && ev.a) {
    const row = normalizeDemoAsteroidRow(ev.a);
    if (!row) return;
    const a = unpackAsteroid(row);
    a.spawnSt = serverNow();
    addAsteroid(a);
    return;
  }
  if (ev.t === 'ad') {
    removeAsteroid(ev.id, !!(ev.silent || ev.s));
    return;
  }
  if (ev.t === 'aw' && ev.a) {
    const row = Array.isArray(ev.a) ? ev.a.slice() : ev.a;
    if (Array.isArray(row)) row[7] = serverNow();
    applyAsteroidWrap(row);
    return;
  }
  if (ev.t === 'lf' && ev.l) {
    addLaser(ev.l, ev.hit, ev.w);
    return;
  }
  if (ev.t === 'rf' && ev.l) {
    const row = ev.l;
    railBeams.push({
      x0: row[1], y0: row[2], x1: row[3], y1: row[4],
      width: row[5] || 4 * RES_SCALE,
      until: performance.now() + 120,
      owner: row[7] | 0
    });
    return;
  }
  if (ev.t === 'die') {
    deathSpectating = true;
    deathFreezeAt = serverNow();
    rebaseAsteroidsToTime(deathFreezeAt);
    if ((ev.id | 0) === myId) player.hp = 0;
    return;
  }
  if (ev.t === 'round' || ev.t === 'go') {
    deathSpectating = false;
    deathSeq = null;
    deathFreezeAt = 0;
    return;
  }
}

function demoApplyUntil(tick) {
  if (!demoPlay) return;
  const events = demoPlay.events;
  while (demoPlay.idx < events.length) {
    const ev = events[demoPlay.idx];
    const k = ev.k != null ? (ev.k | 0) : demoPlay.tick;
    if (k > tick) break;
    demoReplayEvent(ev);
    demoPlay.idx++;
  }
}

function demoPlaybackStep() {
  if (!demoPlay || !demoPlay.active) return;
  const now = performance.now();
  if (demoPlay.originPerf == null) {
    demoPlay.originPerf = now;
    demoPlay.tick = demoPlay.startTick;
    demoApplyUntil(demoPlay.tick);
    return;
  }
  const target = demoPlay.startTick + Math.floor((now - demoPlay.originPerf) / TICK_MS);
  let steps = 0;
  while (demoPlay.tick < target && steps < 4) {
    demoPlay.tick++;
    demoApplyUntil(demoPlay.tick);
    steps++;
  }
  if (demoPlay.tick >= demoPlay.endTick && demoPlay.idx >= demoPlay.events.length) {
    conPrint('demo finished: "' + demoPlay.name + '"', 'info');
    demoStopPlay(true);
  }
}

function normalizeDemoAsteroidRow(a) {
  if (Array.isArray(a)) return a;
  if (!a || typeof a !== 'object') return null;
  // Legacy server object format (pre-playback packing).
  const size = a.size === 'big' || a.big ? 2 : (a.size === 'medium' ? 1 : 0);
  const special = a.special === 'meteor' ? 1 : 0;
  return [
    a.aid | a.id | 0,
    a.spawnX != null ? a.spawnX : a.x,
    a.spawnY != null ? a.spawnY : a.y,
    a.vx, a.vy,
    a.spawnAngle != null ? a.spawnAngle : a.angle,
    a.spin, a.r, 0, size,
    a.spawnSt || 0,
    special,
    a.center || a.centerRock ? 1 : 0,
    a.portal || a.portalOf ? 1 : 0,
    a.shapeId != null ? (a.shapeId | 0) : 0,
    a.wraps | a.edgeWraps | 0,
    a.wrapMax | a.edgeWrapMax | 0,
    a.playerShot ? 1 : 0,
    a.ownerId != null ? (a.ownerId | 0) : 0,
    a.hue != null ? (((a.hue * 360) | 0) % 360) : null
  ];
}

function demoBeginPlay(rawName) {
  const name = demoSanitizeName(rawName);
  if (!name) {
    conPrint('usage: play <name>', 'err');
    return;
  }
  let raw;
  try { raw = localStorage.getItem(DEMO_STORE_PREFIX + name); } catch (_) { raw = null; }
  if (!raw) {
    conPrint('demo "' + name + '" not found — demos to list', 'err');
    return;
  }
  let data;
  try { data = JSON.parse(raw); } catch (_) {
    conPrint('demo "' + name + '" is corrupt', 'err');
    return;
  }
  demoBeginPlayData(data, name);
}

function demoBeginPlayData(data, displayName) {
  if (!data || typeof data !== 'object') {
    conPrint('invalid demo data', 'err');
    return;
  }
  const name = demoSanitizeName(displayName) || 'demo';
  if (demoRec) demoStopRecord(true);
  if (inGame && ws && ws.readyState === 1 && !(demoPlay && demoPlay.active)) {
    try {
      ws.send(JSON.stringify({ t: practiceMode ? 'cancel' : 'leave' }));
    } catch (_) {}
  }
  resetMatchState();
  clearMatchPause();
  setRejoinOffer(null);

  const events = Array.isArray(data.events) ? data.events : [];
  let endTick = data.endTick | 0;
  if (!endTick && events.length) {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].k != null) { endTick = events[i].k | 0; break; }
    }
  }
  const startTick = data.startTick | 0;
  let viewId = data.myId | 0;
  if (!viewId && Array.isArray(data.players) && data.players[0]) {
    viewId = data.players[0].id | 0;
  }
  const practice = !!(data.practice || data.kind === 'wave' ||
    (data.mode && data.mode !== 'pvp'));

  demoPlay = {
    active: true,
    name,
    data,
    events,
    idx: 0,
    tick: startTick,
    startTick,
    endTick: Math.max(startTick + 1, endTick),
    myId: viewId,
    originPerf: null,
    syncTick: startTick,
    syncSt: Date.now()
  };
  myId = demoPlay.myId;
  inGame = true;
  predReady = true;
  matchLive = true;
  syncTick = demoPlay.syncTick;
  syncSt = demoPlay.syncSt;
  resetTickClock();
  setPracticeWaiting(practice);
  hideMenu();
  hideSoloOverScreen();
  if (waitBannerEl) {
    waitBannerEl.classList.remove('hidden');
    waitBannerEl.textContent = 'DEMO: ' + name + ' (Esc to stop)';
  }
  demoApplyUntil(demoPlay.tick);
  conPrint('playing "' + name + '" — stop / Esc to exit', 'info');
}

function demoStopPlay(quiet) {
  if (!demoPlay || !demoPlay.active) {
    if (!quiet) conPrint('not playing a demo', 'err');
    return;
  }
  demoPlay.active = false;
  demoPlay = null;
  deathSpectating = false;
  deathSeq = null;
  deathFreezeAt = 0;
  resetMatchState();
  showMenu();
  if (waitBannerEl) {
    waitBannerEl.classList.add('hidden');
    waitBannerEl.textContent = 'Waiting for player...';
  }
  if (!quiet) conPrint('demo playback stopped', 'info');
}

function demoStopAll() {
  if (demoRec) {
    demoStopRecord(false);
    return;
  }
  if (demoPlay && demoPlay.active) {
    demoStopPlay(false);
    return;
  }
  conPrint('nothing to stop', 'err');
}

function demoDelete(rawName) {
  const name = demoSanitizeName(rawName);
  if (!name) {
    conPrint('usage: demolish <name>', 'err');
    return;
  }
  try {
    localStorage.removeItem(DEMO_STORE_PREFIX + name);
    conPrint('deleted demo "' + name + '"', 'info');
  } catch (err) {
    conPrint('delete failed', 'err');
  }
}

const CON_COMMANDS = [
  'clear', 'echo', 'help', 'find', 'status', 'cvar', 'login', 'logout', 'password', 'give',
  'record', 'stop', 'play', 'demos', 'demolish'
];
/** True after successful server `login` — required for sv_ cvars and `password`. */
let consoleAdmin = false;

function conRequireAdmin() {
  if (consoleAdmin) return true;
  conPrint('admin only — use: login <password>', 'err');
  return false;
}

/** Admin hotkeys 1–8: same as `give <weapon>` / world pickup (equip or upgrade). */
function adminGiveWeaponBySlot(slot) {
  if (!consoleAdmin || !inGame) return false;
  const name = WEAPON_NAMES[(slot | 0) - 1];
  if (!name) return false;
  if (!ws || ws.readyState !== 1) return false;
  if (player.hp <= 0 || deathSpectating) return false;
  ws.send(JSON.stringify({ t: 'adminGive', item: name }));
  return true;
}

/** Admin Q: force-open the wave shop for UI / buy debugging. */
function adminOpenShop() {
  if (!consoleAdmin || !inGame) return false;
  if (!ws || ws.readyState !== 1) return false;
  if (soloShopOpen || deathSpectating || matchPaused) return false;
  ws.send(JSON.stringify({ t: 'dbgShop' }));
  return true;
}

function printAdminStatus(msg) {
  if (!msg || !msg.ok) {
    conPrint((msg && msg.err) || 'status failed', 'err');
    return;
  }
  conPrint(
    `server ip ${msg.ip || '?'} | listen ${msg.listen || '?'} | rooms ${msg.rooms | 0}` +
    ` | queue pvp ${(msg.queue && msg.queue.pvp) | 0} coop ${(msg.queue && msg.queue.coop) | 0}`,
    'info'
  );
  if (!msg.inRoom || !msg.room) {
    conPrint(msg.err || 'not in a room', 'info');
    return;
  }
  const r = msg.room;
  const mode = r.practice
    ? (r.soloOnly ? 'solo' : (r.coop ? 'coop' : 'wave-wait'))
    : 'pvp';
  conPrint(
    `room ${r.id} | mode ${mode} | tick ${r.tick | 0} | live ${r.matchLive ? 1 : 0} | paused ${r.paused ? 1 : 0}`,
    'info'
  );
  conPrint(
    `wave ${r.wave | 0} | shop ${r.shopOpen ? ('open→' + (r.shopWave | 0)) : 'closed'}` +
    ` | clearLeft ${r.waveClearLeft | 0} | pendingBig ${r.pendingBigSpawns | 0}` +
    ` | death shake ${r.deathShakeLeft | 0} boom ${r.deathBoomLeft | 0} boomed ${r.deathBoomed ? 1 : 0}`,
    'info'
  );
  conPrint(`bullets ${r.bullets | 0} | pickups ${r.pickups | 0}`, 'info');

  const players = msg.players || [];
  if (!players.length) conPrint('players: (none)', 'info');
  else {
    conPrint(`players (${players.length}):`, 'info');
    for (const p of players) {
      conPrint(
        `  p${p.id} ${p.name || '?'} | ping ${p.ping | 0}ms | hp ${p.hp | 0}` +
        ` | lives ${p.lives | 0} | score ${p.score | 0} | credits ${p.coins | 0}` +
        ` | ${p.weapon || 'default'} | conn ${p.connected ? 1 : 0} | god ${p.god | 0}`,
        'info'
      );
    }
  }

  const a = msg.asteroids || {};
  const bs = a.bySize || {};
  conPrint(
    `asteroids total ${a.total | 0} | blocking ${a.blocking | 0} | portalGhosts ${a.portalGhosts | 0}` +
    ` | offEntered ${a.offscreenEntered | 0} | inbound ${a.inbound | 0}` +
    ` | offscreen ${a.offscreen | 0} | big ${bs.big | 0} med ${bs.medium | 0} sm ${bs.small | 0}`,
    'info'
  );
  const blockers = a.blockers || [];
  for (const b of blockers) {
    conPrint(
      `  rock #${b.aid} ${b.size} off=${b.off | 0} entered=${b.entered | 0} portalTwin=${b.portalTwin | 0}` +
      ` wraps ${b.wraps | 0}/${b.wrapMax | 0} @ ${b.x},${b.y}`,
      'info'
    );
  }

  const e = msg.enemies || {};
  conPrint(
    `enemies total ${e.total | 0} | spawned ${e.spawned | 0} | queued ${e.queued | 0} | appearing ${e.appearing | 0}`,
    'info'
  );
  for (const row of (e.list || [])) {
    conPrint(
      `  e${row.id} ${row.kind} hp=${row.hp | 0} spawned=${row.spawned | 0}` +
      ` queued=${row.queued | 0} appearLeft=${row.appearLeft | 0} ${row.weapon || ''}`,
      'info'
    );
  }

  const wp = msg.waveProgress || {};
  conPrint(
    `wave progress: blocked=${wp.blocked ? 1 : 0} | next shop @ ${wp.nextShopAt | 0}`,
    wp.blocked ? 'err' : 'info'
  );
  for (const reason of (wp.reasons || [])) {
    conPrint('  → ' + reason, wp.blocked ? 'err' : 'info');
  }
}

function conAllNames() {
  return CON_COMMANDS.concat(Object.keys(CVARS)).sort();
}

function conPrint(text, cls) {
  if (!conLogEl) return;
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = text;
  conLogEl.appendChild(line);
  conLogEl.scrollTop = conLogEl.scrollHeight;
}

function openConsole() {
  if (!conEl || !conInputEl) return;
  consoleOpen = true;
  conEl.classList.add('open');
  // Clear stuck movement keys while typing.
  for (const k of Object.keys(keys)) keys[k] = false;
  spaceLatch = false;
  enterLatch = false;
  conInputEl.focus();
  conInputEl.select();
  conUpdateSuggest();
}

function closeConsole() {
  if (!conEl) return;
  consoleOpen = false;
  conEl.classList.remove('open');
  conInputEl.blur();
  conClearSuggest();
}

function toggleConsole() {
  if (consoleOpen) closeConsole();
  else openConsole();
}

function conClearSuggest() {
  conSuggestList = [];
  conSuggestIdx = -1;
  if (conSuggestEl) {
    conSuggestEl.innerHTML = '';
    conSuggestEl.classList.remove('has-items');
  }
}

function conCommonPrefix(arr) {
  if (!arr.length) return '';
  let p = arr[0];
  for (let i = 1; i < arr.length; i++) {
    const s = arr[i];
    while (p && !s.startsWith(p)) p = p.slice(0, -1);
  }
  return p;
}

/** Source-style live suggestions from the first token (only while typing a prefix). */
function conUpdateSuggest() {
  if (!conSuggestEl || !conInputEl) return;
  const raw = conInputEl.value;
  // Only suggest while typing the command/cvar name.
  if (/\s/.test(raw)) {
    conClearSuggest();
    return;
  }
  const token = raw.toLowerCase();
  // Empty input → no suggestions (must type a prefix).
  if (!token) {
    conClearSuggest();
    return;
  }
  const all = conAllNames();
  conSuggestList = all.filter(n => n.startsWith(token));
  if (!conSuggestList.length) {
    conClearSuggest();
    return;
  }
  if (conSuggestIdx < 0 || conSuggestIdx >= conSuggestList.length) conSuggestIdx = 0;
  conRenderSuggest();
}

function conRenderSuggest() {
  if (!conSuggestEl) return;
  const maxShow = 12;
  const shown = conSuggestList.slice(0, maxShow);
  conSuggestEl.innerHTML = shown.map((n, i) => {
    const cls = i === conSuggestIdx ? 'sel hit' : 'hit';
    const help = CVARS[n] ? `  // ${CVARS[n].help}` : '';
    return `<div class="${cls}">${n}${help}</div>`;
  }).join('') + (conSuggestList.length > maxShow
    ? `<div>… ${conSuggestList.length - maxShow} more</div>` : '');
  conSuggestEl.classList.add('has-items');
}

function conMoveSuggest(dir) {
  if (!conSuggestList.length) return false;
  const n = conSuggestList.length;
  conSuggestIdx = (conSuggestIdx + dir + n) % n;
  conInputEl.value = conSuggestList[conSuggestIdx];
  const len = conInputEl.value.length;
  conInputEl.setSelectionRange(len, len);
  conRenderSuggest();
  return true;
}

function conApplySuggest(name) {
  if (!conInputEl || !name) return;
  const raw = conInputEl.value;
  const sp = raw.indexOf(' ');
  // Replace first token; keep any args.
  const rest = sp >= 0 ? raw.slice(sp) : ' ';
  conInputEl.value = name + (rest.startsWith(' ') ? rest : ' ' + rest);
  if (!rest.trim()) {
    conInputEl.value = name + ' ';
  }
  const len = conInputEl.value.length;
  conInputEl.setSelectionRange(len, len);
  conUpdateSuggest();
}

function conTabComplete() {
  if (!conSuggestList.length) {
    conUpdateSuggest();
    if (!conSuggestList.length) return;
  }
  if (conSuggestList.length === 1) {
    conApplySuggest(conSuggestList[0]);
    return;
  }
  const token = (conInputEl.value.split(/\s+/)[0] || '').toLowerCase();
  const prefix = conCommonPrefix(conSuggestList);
  if (prefix && prefix.length > token.length) {
    conInputEl.value = prefix;
    conInputEl.setSelectionRange(prefix.length, prefix.length);
    conUpdateSuggest();
    return;
  }
  // Cycle matches like Source.
  conSuggestIdx = (conSuggestIdx + 1) % conSuggestList.length;
  conApplySuggest(conSuggestList[conSuggestIdx]);
}

function conListCvars(filter) {
  const f = (filter || '').toLowerCase();
  const names = Object.keys(CVARS).sort();
  for (const name of names) {
    if (f && name.indexOf(f) < 0 && CVARS[name].help.toLowerCase().indexOf(f) < 0) continue;
    conPrint(`${name} = ${CVARS[name].value}  // ${CVARS[name].help}`, 'info');
  }
}

function runConsole(line) {
  const raw = String(line || '').trim();
  if (!raw) return;
  const partsPeek = raw.split(/\s+/);
  const cmdPeek = (partsPeek[0] || '').toLowerCase();
  // Don't echo secrets into the console log.
  if (cmdPeek === 'login' || cmdPeek === 'password') {
    conPrint(`] ${cmdPeek} ****`, 'cmd');
  } else {
    conPrint(`] ${raw}`, 'cmd');
  }
  conHistory.push(raw);
  if (conHistory.length > 64) conHistory.shift();
  conHistIdx = conHistory.length;
  conClearSuggest();

  // Accept "name value", "name = value", and "name=value" (no panel max clamp).
  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  let args = parts.slice(1);
  if (args[0] === '=' && args.length >= 2) args = args.slice(1);
  else if (args[0] && args[0].charAt(0) === '=') {
    args = [args[0].slice(1)].concat(args.slice(1)).filter((a) => a !== '');
  }
  // Also: "cl_foo=10" glued to the command token.
  let cmdName = cmd;
  let gluedVal = null;
  const eq = cmd.indexOf('=');
  if (eq > 0) {
    cmdName = cmd.slice(0, eq);
    gluedVal = cmd.slice(eq + 1);
    if (gluedVal !== '') args = [gluedVal].concat(args);
  }

  if (cmdName === 'clear' || cmd === 'clear') {
    if (conLogEl) conLogEl.innerHTML = '';
    return;
  }
  if (cmdName === 'echo') {
    conPrint(args.join(' '));
    return;
  }
  if (cmdName === 'login') {
    if (!args.length) {
      conPrint('usage: login <password>', 'err');
      return;
    }
    if (!ws || ws.readyState !== 1) {
      conPrint('not connected', 'err');
      return;
    }
    ws.send(JSON.stringify({ t: 'adminLogin', pw: args.join(' ') }));
    return;
  }
  if (cmdName === 'logout') {
    consoleAdmin = false;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'adminLogout' }));
    else conPrint('admin logged out', 'info');
    return;
  }
  if (cmdName === 'password') {
    if (!conRequireAdmin()) return;
    if (args.length < 2) {
      conPrint('usage: password <new> <repeat>', 'err');
      return;
    }
    if (!ws || ws.readyState !== 1) {
      conPrint('not connected', 'err');
      return;
    }
    const next = args[0];
    const repeat = args[1];
    if (next !== repeat) {
      conPrint('passwords do not match', 'err');
      return;
    }
    ws.send(JSON.stringify({ t: 'adminPassword', pw: next, repeat }));
    return;
  }
  if (cmdName === 'give') {
    if (!conRequireAdmin()) return;
    if (!args.length) {
      conPrint('usage: give <item>  (or admin keys 1–8 in-game)', 'err');
      conPrint('weapons: default rocket laser shotgun rail plasma void meteor', 'info');
      conPrint('keys: 1 default 2 rocket 3 laser 4 shotgun 5 rail 6 plasma 7 void 8 meteor', 'info');
      conPrint('powerups: damage turret shield homing lead emp reload', 'info');
      conPrint('admingun — turret + buff (100 ammo, 1 cooldown, 1s reload, 100 dmg)', 'info');
      return;
    }
    if (!ws || ws.readyState !== 1) {
      conPrint('not connected', 'err');
      return;
    }
    if (!inGame) {
      conPrint('not in game', 'err');
      return;
    }
    ws.send(JSON.stringify({ t: 'adminGive', item: args[0] }));
    return;
  }
  if (cmdName === 'help' || cmdName === 'find') {
    conPrint('Commands: help, find, clear, echo, status, cvar, login, logout, password, give', 'info');
    conPrint('record <name> | stop | play <name> | demos | demolish <name>', 'info');
    conPrint('login <password>  — admin auth (shared server password)', 'info');
    conPrint('password <new> <repeat>  — change admin password (admin only)', 'info');
    conPrint('give <weapon|powerup|admingun>  — grant loadout (admin, in-game)', 'info');
    conPrint('admin keys 1–8 in-game — pickup/upgrade: 1 default 2 rocket 3 laser 4 shotgun 5 rail 6 plasma 7 void 8 meteor', 'info');
    conPrint('status  — local ping + server/room/wave field dump', 'info');
    conPrint('cl_allToDefault 1  — reset all cl_ cvars to defaults', 'info');
    conPrint(`admin: ${consoleAdmin ? 'yes' : 'no'}`, 'info');
    conListCvars(args[0] || (cmdName === 'find' ? '' : 'cl_'));
    return;
  }
  if (cmdName === 'record') {
    demoStartRecord(args[0] || '');
    return;
  }
  if (cmdName === 'stop') {
    demoStopAll();
    return;
  }
  if (cmdName === 'play') {
    demoBeginPlay(args[0] || '');
    return;
  }
  if (cmdName === 'demos') {
    demoList();
    return;
  }
  if (cmdName === 'demolish') {
    demoDelete(args[0] || '');
    return;
  }
  if (cmdName === 'status') {
    conPrint(
      `local: ping ${Math.round(pingMs)}ms ±${Math.round(pingJitter)} | dly ${adaptiveInputDelay()} | ` +
      `interp ${adaptiveInterpMs().toFixed(0)}ms | admin ${consoleAdmin ? 1 : 0}`,
      'info'
    );
    if (!ws || ws.readyState !== 1) {
      conPrint('not connected', 'err');
      return;
    }
    ws.send(JSON.stringify({ t: 'status' }));
    return;
  }
  if (cmdName === 'cvar') {
    if (!args.length) {
      conListCvars('');
      return;
    }
    let name = args[0].toLowerCase();
    let valArgs = args.slice(1);
    if (valArgs[0] === '=' && valArgs.length >= 2) valArgs = valArgs.slice(1);
    const nameEq = name.indexOf('=');
    if (nameEq > 0) {
      valArgs = [name.slice(nameEq + 1)].concat(valArgs).filter((a) => a !== '');
      name = name.slice(0, nameEq);
    }
    if (!CVARS[name]) {
      conPrint(`Unknown cvar "${name}"`, 'err');
      return;
    }
    if (valArgs.length >= 1) {
      if (name.startsWith('sv_') && !conRequireAdmin()) return;
      if (!setCvar(name, valArgs[0])) {
        conPrint(
          name.startsWith('sv_') && !consoleAdmin
            ? 'admin only — use: login <password>'
            : `Bad value for ${name} (need a number)`,
          'err'
        );
        return;
      }
      if (name === 'cl_allToDefault' && Number(valArgs[0]) !== 0) {
        conPrint('All cl_ cvars reset to defaults', 'info');
      }
    }
    conPrint(`${name} = ${CVARS[name].value}`);
    return;
  }

  // Bare "cl_foo" / "cl_foo 1.2" / "cl_foo = 1.2" — no slider max clamp.
  if (CVARS[cmdName]) {
    if (args.length >= 1) {
      if (cmdName.startsWith('sv_') && !conRequireAdmin()) return;
      if (!setCvar(cmdName, args[0])) {
        conPrint(
          cmdName.startsWith('sv_') && !consoleAdmin
            ? 'admin only — use: login <password>'
            : `Bad value for ${cmdName} (need a number)`,
          'err'
        );
        return;
      }
      if (cmdName === 'cl_allToDefault' && Number(args[0]) !== 0) {
        conPrint('All cl_ cvars reset to defaults', 'info');
      }
    }
    conPrint(`${cmdName} = ${CVARS[cmdName].value}`);
    return;
  }

  conPrint(`Unknown command "${cmdName}"`, 'err');
}

if (conInputEl) {
  conInputEl.addEventListener('input', () => {
    if (consoleOpen) conUpdateSuggest();
  });
  conInputEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') {
      e.preventDefault();
      const v = conInputEl.value;
      conInputEl.value = '';
      runConsole(v);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      closeConsole();
      return;
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      if (conSuggestList.length) {
        conMoveSuggest(-1);
        return;
      }
      if (!conHistory.length) return;
      conHistIdx = Math.max(0, conHistIdx - 1);
      conInputEl.value = conHistory[conHistIdx] || '';
      conInputEl.setSelectionRange(conInputEl.value.length, conInputEl.value.length);
      conUpdateSuggest();
      return;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (conSuggestList.length) {
        conMoveSuggest(1);
        return;
      }
      if (!conHistory.length) return;
      conHistIdx = Math.min(conHistory.length, conHistIdx + 1);
      conInputEl.value = conHistIdx >= conHistory.length ? '' : (conHistory[conHistIdx] || '');
      conInputEl.setSelectionRange(conInputEl.value.length, conInputEl.value.length);
      conUpdateSuggest();
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      conTabComplete();
    }
  });
  conPrint('developer console — ` or ~ to toggle, help for cvars', 'info');
}

setInterval(sendPing, 500);

const fpsHudEl = document.getElementById('fps-hud');
const LOCK_FPS = 60;
const LOCK_FRAME_MS = 1000 / LOCK_FPS;
let fpsPrevMs = 0;
let fpsAccumMs = 0;
let fpsFrameCount = 0;
let fpsLastSample = performance.now();
let fpsSmooth = 60;

function updateFpsHud(now) {
  if (!fpsHudEl) return;
  fpsFrameCount++;
  const elapsed = now - fpsLastSample;
  if (elapsed < 250) return;
  const inst = (fpsFrameCount * 1000) / elapsed;
  fpsSmooth = fpsSmooth * 0.65 + inst * 0.35;
  fpsFrameCount = 0;
  fpsLastSample = now;
  const n = Math.round(fpsSmooth);
  const ping = Math.round(pingMs || 0);
  fpsHudEl.textContent = n + '/' + ping;
  fpsHudEl.classList.toggle('low', n < 55);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (now == null) now = performance.now();
  if (!fpsPrevMs) fpsPrevMs = now;
  fpsAccumMs += now - fpsPrevMs;
  fpsPrevMs = now;
  // Don't spiral if a tab was backgrounded.
  if (fpsAccumMs > LOCK_FRAME_MS * 2) fpsAccumMs = LOCK_FRAME_MS;
  if (fpsAccumMs < LOCK_FRAME_MS) return;
  fpsAccumMs -= LOCK_FRAME_MS;

  updateFpsHud(now);
  if (inGame) {
    syncSimTicks();
    updateHud();
    render();
  } else {
    updateHud();
    render();
  }
}

connect();
requestAnimationFrame(frame);
