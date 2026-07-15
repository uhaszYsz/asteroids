const W = 420, H = 240;
const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
canvas.width = W;
canvas.height = H;

const TPS = 30;
const TICK_MS = 1000 / TPS;
const TURN = 0.18;
const TURN_RATE = TURN * TPS;

const vs = `
  attribute vec2 a;
  uniform vec2 uRes;
  void main() {
    vec2 p = a / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0, 1);
    gl_PointSize = 1.0;
  }
`;
const fs = `precision mediump float; void main() { gl_FragColor = vec4(1, 1, 1, 1); }`;

const glowFs = `
  precision mediump float;
  uniform vec3 uCol;
  uniform float uAlpha;
  void main() { gl_FragColor = vec4(uCol * uAlpha, uAlpha); }
`;

const pGlowVs = `
  attribute vec2 a;
  uniform vec2 uRes;
  uniform float uSize;
  void main() {
    vec2 p = a / uRes * 2.0 - 1.0;
    gl_Position = vec4(p.x, -p.y, 0, 1);
    gl_PointSize = uSize;
  }
`;
const pGlowFs = `
  precision mediump float;
  uniform vec3 uCol;
  uniform float uStrength;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float dist = length(d);
    if (dist > 0.5) discard;
    float a = pow(1.0 - dist * 2.0, 1.2) * uStrength;
    gl_FragColor = vec4(uCol * a, a);
  }
`;

const lineGlowFs = `
  precision mediump float;
  uniform vec3 uCol;
  uniform float uStrength;
  void main() { gl_FragColor = vec4(uCol * uStrength, uStrength); }
`;

const COL = {
  self: [0.35, 0.75, 1.0],
  remote: [1.0, 0.25, 0.35],
  asteroid: [0.25, 1.0, 0.45],
  bullet: [0.9, 0.95, 1.0]
};
const GLOW_OFF = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [3, 0], [-3, 0], [0, 3], [0, -3],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 2], [-2, 2], [2, -2], [-2, -2]
];

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

const glowProg = gl.createProgram();
gl.attachShader(glowProg, shader(gl.VERTEX_SHADER, vs));
gl.attachShader(glowProg, shader(gl.FRAGMENT_SHADER, lineGlowFs));
linkProgram(glowProg);

const pGlowProg = gl.createProgram();
gl.attachShader(pGlowProg, shader(gl.VERTEX_SHADER, pGlowVs));
gl.attachShader(pGlowProg, shader(gl.FRAGMENT_SHADER, pGlowFs));
linkProgram(pGlowProg);

const uRes = gl.getUniformLocation(prog, 'uRes');
const aLoc = gl.getAttribLocation(prog, 'a');
const gURes = gl.getUniformLocation(glowProg, 'uRes');
const gLoc = gl.getAttribLocation(glowProg, 'a');
const gCol = gl.getUniformLocation(glowProg, 'uCol');
const gStr = gl.getUniformLocation(glowProg, 'uStrength');
const pgURes = gl.getUniformLocation(pGlowProg, 'uRes');
const pgLoc = gl.getAttribLocation(pGlowProg, 'a');
const pgCol = gl.getUniformLocation(pGlowProg, 'uCol');
const pgStr = gl.getUniformLocation(pGlowProg, 'uStrength');
const pgSize = gl.getUniformLocation(pGlowProg, 'uSize');
const buf = gl.createBuffer();

function uploadVerts(verts) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, snapVerts(verts), gl.STATIC_DRAW);
}

function snapVerts(verts) {
  const out = new Float32Array(verts.length);
  for (let i = 0; i < verts.length; i += 2) {
    out[i] = Math.round(verts[i]);
    out[i + 1] = Math.round(verts[i + 1]);
  }
  return out;
}

function drawGlowPoints(verts, color, size, strength) {
  const snapped = snapVerts(verts);
  const n = snapped.length / 2;
  if (!n) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, snapped, gl.STATIC_DRAW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(pGlowProg);
  gl.enableVertexAttribArray(pgLoc);
  gl.vertexAttribPointer(pgLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(pgURes, W, H);
  gl.uniform3fv(pgCol, color);
  gl.uniform1f(pgSize, size);
  gl.uniform1f(pgStr, strength);
  gl.drawArrays(gl.POINTS, 0, n);
  gl.disable(gl.BLEND);
}

function drawGlowLines(verts, color) {
  const base = snapVerts(verts);
  const n = base.length / 2;
  if (!n) return;
  const off = new Float32Array(base.length);

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(glowProg);
  gl.uniform3fv(gCol, color);
  gl.enableVertexAttribArray(gLoc);
  gl.vertexAttribPointer(gLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gURes, W, H);

  for (const [ox, oy] of GLOW_OFF) {
    for (let i = 0; i < n; i++) {
      off[i * 2] = base[i * 2] + ox;
      off[i * 2 + 1] = base[i * 2 + 1] + oy;
    }
    gl.bufferData(gl.ARRAY_BUFFER, off, gl.STREAM_DRAW);
    const dist = Math.abs(ox) + Math.abs(oy);
    gl.uniform1f(gStr, dist === 0 ? 0.55 : dist <= 2 ? 0.28 : 0.14);
    gl.drawArrays(gl.LINE_LOOP, 0, n);
  }

  gl.disable(gl.BLEND);
}

function drawCoreLines(verts) {
  gl.useProgram(prog);
  uploadVerts(verts);
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(uRes, W, H);
  gl.drawArrays(gl.LINE_LOOP, 0, verts.length / 2);
}

function drawNeonLines(verts, color) {
  drawGlowPoints(verts, color, 14, 0.75);
  drawGlowPoints(verts, color, 8, 0.45);
  drawGlowLines(verts, color);
  drawCoreLines(verts);
}

function drawNeonPoints(items, color) {
  if (!items.length) return;
  const flat = [];
  for (const it of items) {
    flat.push(Math.round(it.x), Math.round(it.y));
  }
  drawGlowPoints(flat, color, 12, 0.8);
  drawGlowPoints(flat, color, 6, 0.5);

  const verts = new Float32Array(flat);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(uRes, W, H);
  gl.drawArrays(gl.POINTS, 0, items.length);
}

function worldVerts(x, y, angle, local) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = [];
  for (let i = 0; i < local.length; i += 2) {
    const lx = local[i], ly = local[i + 1];
    out.push(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  return out;
}

const shipShape = [9, 0, -6, 5, -6, -5];

const keys = {};
let spaceLatch = false;
let enterLatch = false;
let shootPulse = false;

function turnLeft() { return keys.ArrowLeft || keys.KeyA; }
function turnRight() { return keys.ArrowRight || keys.KeyD; }
function thrustUp() { return keys.ArrowUp || keys.KeyW; }

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter'
]);

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Space' && !spaceLatch) {
    spaceLatch = true;
    shootPulse = true;
  }
  if (e.code === 'Enter' && !enterLatch) {
    enterLatch = true;
    shootPulse = true;
  }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space') spaceLatch = false;
  if (e.code === 'Enter') enterLatch = false;
});

const player = { x: W / 2, y: H / 2, vx: 0, vy: 0, hp: 100 };
let viewAngle = -Math.PI / 2;
let serverAngle = -Math.PI / 2;

let myId = null;
let connected = false;
let ws = null;
const remotes = new Map();
let asteroids = [];
let bullets = [];

let clockOffset = 0;
let pingMs = 0;
let syncTick = 0;
let syncSt = 0;

function applyNtp(ct, st, serverTick) {
  const t3 = Date.now();
  const rtt = t3 - ct;
  pingMs = pingMs ? pingMs * 0.75 + rtt * 0.25 : rtt;
  const offset = st - (ct + t3) * 0.5;
  clockOffset = clockOffset ? clockOffset * 0.75 + offset * 0.25 : offset;
  syncTick = serverTick;
  syncSt = st;
}

function serverNow() { return Date.now() + clockOffset; }

function gameTimeSec() {
  return syncTick / TPS + (serverNow() - syncSt) / 1000;
}

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
  if (!connected || !myId) return;
  statusEl.textContent =
    `p${myId} ${player.hp}hp | ping ${Math.round(pingMs)}ms | srv ${fmtServerTime()} | game ${fmtGameTime(gameTimeSec())}`;
}

function sendPing() {
  if (!connected || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ t: 'ping', ct: Date.now() }));
}

function sendInput() {
  if (!connected || ws.readyState !== 1) return;
  const inp = getInput();
  ws.send(JSON.stringify({ t: 'in', ...inp }));
  if (shootPulse) shootPulse = false;
}

function getInput() {
  return {
    l: turnLeft() ? 1 : 0,
    r: turnRight() ? 1 : 0,
    u: thrustUp() ? 1 : 0,
    sp: shootPulse ? 1 : 0
  };
}

function reconcileRotation() {
  if (!turnLeft() && !turnRight()) {
    viewAngle = serverAngle;
    return;
  }
  let d = serverAngle - viewAngle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  viewAngle += d * 0.2;
}

function updateLocalRotation(dt) {
  if (turnLeft()) viewAngle -= TURN_RATE * dt;
  if (turnRight()) viewAngle += TURN_RATE * dt;
}

function applySnapshot(msg) {
  if (msg.st != null) {
    syncTick = msg.tick;
    syncSt = msg.st;
  }
  asteroids = msg.asteroids.map(a => ({
    x: a[0], y: a[1], angle: a[2], pts: a[7]
  }));
  bullets = msg.bullets.map(b => ({ x: b[0], y: b[1] }));

  const seen = new Set();
  for (const row of msg.players) {
    const id = row[0];
    seen.add(id);
    if (id === myId) {
      player.x = row[1];
      player.y = row[2];
      player.vx = row[3];
      player.vy = row[4];
      serverAngle = row[5];
      player.hp = row[6];
      reconcileRotation();
      continue;
    }
    remotes.set(id, {
      x: row[1], y: row[2], vx: row[3], vy: row[4], angle: row[5], hp: row[6]
    });
  }
  for (const id of remotes.keys()) {
    if (!seen.has(id)) remotes.delete(id);
  }
}

function render() {
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.lineWidth(1);
  if (!connected) return;

  drawNeonLines(worldVerts(player.x, player.y, viewAngle, shipShape), COL.self);
  for (const r of remotes.values()) {
    drawNeonLines(worldVerts(r.x, r.y, r.angle, shipShape), COL.remote);
  }
  drawNeonPoints(bullets, COL.bullet);
  for (const a of asteroids) {
    drawNeonLines(worldVerts(a.x, a.y, a.angle, a.pts), COL.asteroid);
  }
}

async function findHost() {
  const bases = [];
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    bases.push(location.origin);
  }
  bases.push('http://localhost:8765', 'http://127.0.0.1:8765');
  for (const base of bases) {
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(400) });
      if (r.ok) return base;
    } catch {}
  }
  return null;
}

async function connect() {
  statusEl.textContent = 'looking for host...';
  const base = await findHost();
  if (!base) {
    statusEl.textContent = 'no host — run: npm start';
    setTimeout(connect, 1500);
    return;
  }

  statusEl.textContent = 'joining...';
  ws = new WebSocket(base.replace(/^http/, 'ws'));
  ws.onopen = () => {
    statusEl.textContent = 'connected';
    sendPing();
  };
  ws.onclose = () => {
    connected = false;
    statusEl.textContent = 'disconnected — reconnecting...';
    setTimeout(connect, 1000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.t === 'welcome') {
      myId = msg.id;
      connected = true;
      viewAngle = serverAngle = -Math.PI / 2;
      applyNtp(Date.now(), msg.st, msg.tick);
      updateHud();
      return;
    }
    if (msg.t === 'pong' && connected) {
      applyNtp(msg.ct, msg.st, msg.tick);
      updateHud();
      return;
    }
    if (msg.t === 'snap' && connected) applySnapshot(msg);
  };
}

setInterval(sendInput, TICK_MS);
setInterval(sendPing, 2000);
let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (connected) {
    updateLocalRotation(dt);
    updateHud();
    render();
  }
  requestAnimationFrame(frame);
}

connect();
requestAnimationFrame(frame);
