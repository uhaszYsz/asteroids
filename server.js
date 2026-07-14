const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8765;
const W = 420, H = 240;
const TPS = 30;
const TICK_MS = 1000 / TPS;
const SHOOT = { ammo: 5, cooldown: 8, reload: 45, speed: 3.5 };
const THRUST = 0.09;
const MAX_SPEED = 8;
const TURN = 0.18;

let tick = 0;
let nextId = 1;
const players = new Map();
let asteroids = [];
let bullets = [];

function makeAsteroid() {
  const r = 8 + Math.random() * 10;
  const n = 6 + (Math.random() * 3 | 0);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.7 + Math.random() * 0.5);
    pts.push(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d));
  }
  return {
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 2.4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.08,
    r, pts
  };
}

function resetWorld() {
  asteroids = [makeAsteroid(), makeAsteroid(), makeAsteroid()];
  bullets = [];
}

function wrap(o) {
  if (o.x < 0) o.x += W; if (o.x > W) o.x -= W;
  if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
}

function clampSpeed(o) {
  const s = Math.hypot(o.vx, o.vy);
  if (s > MAX_SPEED) {
    o.vx = o.vx / s * MAX_SPEED;
    o.vy = o.vy / s * MAX_SPEED;
  }
}

function spawnPlayer(id) {
  const slot = (id - 1) % 4;
  const spots = [
    [W * 0.25, H * 0.5], [W * 0.75, H * 0.5],
    [W * 0.5, H * 0.25], [W * 0.5, H * 0.75]
  ];
  const [x, y] = spots[slot];
  return {
    id, x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    shootAmmo: SHOOT.ammo, shootCd: 0, reloadLeft: 0, bursting: false,
    inp: { l: 0, r: 0, u: 0, sp: 0 }
  };
}

function applyInput(p) {
  const { l, r, u } = p.inp;
  if (l) p.angle -= TURN;
  if (r) p.angle += TURN;
  if (u) {
    p.vx += Math.cos(p.angle) * THRUST;
    p.vy += Math.sin(p.angle) * THRUST;
  }
  clampSpeed(p);
}

function updateShooting(p) {
  if (p.reloadLeft > 0) {
    p.reloadLeft--;
    if (p.reloadLeft === 0) p.shootAmmo = SHOOT.ammo;
    return;
  }
  if (!p.bursting) return;
  if (p.shootCd > 0) { p.shootCd--; return; }

  bullets.push({
    owner: p.id,
    x: p.x + Math.cos(p.angle) * 10,
    y: p.y + Math.sin(p.angle) * 10,
    vx: Math.cos(p.angle) * SHOOT.speed + p.vx,
    vy: Math.sin(p.angle) * SHOOT.speed + p.vy
  });
  p.shootAmmo--;
  p.shootCd = SHOOT.cooldown;
  if (p.shootAmmo <= 0) {
    p.bursting = false;
    p.reloadLeft = SHOOT.reload;
  }
}

function tryStartBurst(p) {
  if (p.bursting || p.reloadLeft > 0 || p.shootAmmo <= 0) return;
  p.bursting = true;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const a = asteroids[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy < a.r * a.r) {
        bullets.splice(i, 1);
        asteroids.splice(j, 1);
        break;
      }
    }
  }
}

function step() {
  tick++;
  for (const p of players.values()) {
    if (p.inp.sp) tryStartBurst(p);
    applyInput(p);
    updateShooting(p);
    p.x += p.vx;
    p.y += p.vy;
    wrap(p);
    p.inp.sp = 0;
  }
  updateBullets();
  for (const a of asteroids) {
    a.x += a.vx;
    a.y += a.vy;
    a.angle += a.spin;
    wrap(a);
  }
}

function packSnap() {
  const ps = [];
  for (const p of players.values()) {
    ps.push([p.id, p.x, p.y, p.vx, p.vy, p.angle]);
  }
  const as = asteroids.map(a => [a.x, a.y, a.angle, a.vx, a.vy, a.spin, a.r, a.pts]);
  const bs = bullets.map(b => [b.x, b.y, b.vx, b.vy, b.owner]);
  return JSON.stringify({ t: 'snap', tick, players: ps, asteroids: as, bullets: bs });
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  const file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const fp = path.join(__dirname, file);
  if (!fp.startsWith(__dirname) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' });
  fs.createReadStream(fp).pipe(res);
});

const wss = new WebSocketServer({ server });
resetWorld();

wss.on('connection', (ws) => {
  const id = nextId++;
  const p = spawnPlayer(id);
  players.set(id, p);
  ws.playerId = id;
  ws.send(JSON.stringify({ t: 'welcome', id, tick }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const pl = players.get(ws.playerId);
    if (!pl || msg.t !== 'in') return;
    pl.inp.l = msg.l ? 1 : 0;
    pl.inp.r = msg.r ? 1 : 0;
    pl.inp.u = msg.u ? 1 : 0;
    if (msg.sp) pl.inp.sp = 1;
  });

  ws.on('close', () => {
    players.delete(ws.playerId);
    if (players.size === 0) resetWorld();
  });
});

setInterval(() => {
  step();
  const snap = packSnap();
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(snap);
  }
}, TICK_MS);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use — close the other server or kill the process.`);
    console.error(`Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Host running at http://localhost:${PORT}`);
});
