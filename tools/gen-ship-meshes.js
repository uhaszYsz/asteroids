/**
 * Parse BBC Elite blueprint dump → ship-meshes.js (+ FE2 stylized hulls).
 * Usage: node tools/gen-ship-meshes.js [path-to-elite-dump.txt]
 * Alien hulls live in alien-ship-meshes.js (node tools/gen-alien-ships.js).
 */
const fs = require('fs');
const path = require('path');

const dumpPath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-tengo-Desktop-asteroids-multiplayer/agent-tools/e9b58127-a0c9-451d-a77c-630983e3cbfb.txt'
);
const outPath = path.join(__dirname, '..', 'ship-meshes.js');

const SKIP = new Set([
  'MISSILE', 'CORIOLIS', 'ESCAPE_POD', 'PLATE', 'CANISTER', 'BOULDER',
  'ASTEROID', 'SPLINTER', 'ROCK_HERMIT', 'THARGON', 'LOGO', 'DODO',
  'COBRA_MK_3_P', 'PYTHON_P'
]);

const NAMES = {
  SHUTTLE: 'Shuttle',
  TRANSPORTER: 'Transporter',
  COBRA_MK_3: 'Cobra Mk III',
  PYTHON: 'Python',
  BOA: 'Boa',
  ANACONDA: 'Anaconda',
  VIPER: 'Viper',
  SIDEWINDER: 'Sidewinder',
  MAMBA: 'Mamba',
  KRAIT: 'Krait',
  ADDER: 'Adder',
  GECKO: 'Gecko',
  COBRA_MK_1: 'Cobra Mk I',
  WORM: 'Worm',
  ASP_MK_2: 'Asp Mk II',
  FER_DE_LANCE: 'Fer-de-Lance',
  MORAY: 'Moray',
  THARGOID: 'Thargoid',
  CONSTRICTOR: 'Constrictor',
  COUGAR: 'Cougar'
};

function stripComment(line) {
  const i = line.indexOf('\\');
  return (i >= 0 ? line.slice(0, i) : line).trim();
}

function parseNums(line) {
  return stripComment(line)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

function normalize(verts, target = 1) {
  let m = 0;
  for (const v of verts) {
    m = Math.max(m, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  }
  const s = m > 0 ? target / m : 1;
  return verts.map((v) => [+(v[0] * s).toFixed(5), +(v[1] * s).toFixed(5), +(v[2] * s).toFixed(5)]);
}

/** Rebuild triangular faces from Elite edge↔face associations. */
function buildFaces(edgeList) {
  const byFace = new Map();
  for (const e of edgeList) {
    const [a, b, f1, f2] = e;
    if (f1 >= 0) {
      if (!byFace.has(f1)) byFace.set(f1, []);
      byFace.get(f1).push([a, b]);
    }
    if (f2 >= 0 && f2 !== f1) {
      if (!byFace.has(f2)) byFace.set(f2, []);
      byFace.get(f2).push([a, b]);
    }
  }
  const faces = [];
  for (const eds of byFace.values()) {
    if (eds.length < 3) continue;
    const adj = new Map();
    for (const [a, b] of eds) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
    const start = adj.keys().next().value;
    const ring = [start];
    let prev = -1;
    let cur = start;
    for (let guard = 0; guard < 64; guard++) {
      const nbrs = adj.get(cur) || [];
      const next = nbrs.find((n) => n !== prev);
      if (next == null || next === start) break;
      ring.push(next);
      prev = cur;
      cur = next;
    }
    if (ring.length < 3) continue;
    for (let i = 1; i < ring.length - 1; i++) {
      faces.push([ring[0], ring[i], ring[i + 1]]);
    }
  }
  return faces;
}

function addFe(ships, id, name, verts, edges, faces, nose) {
  ships.push({
    id,
    name,
    source: 'fe2',
    nose: nose || 0,
    verts: normalize(verts, 1),
    edges,
    faces: faces || []
  });
}

const text = fs.readFileSync(dumpPath, 'utf8');
const ships = [];
const re = /\.SHIP_([A-Z0-9_]+)_VERTICES\s*\n([\s\S]*?)\n\.SHIP_\1_EDGES\s*\n([\s\S]*?)(?=\n\.SHIP_\1_FACES|\n\s+Name:|\n\.SHIP_)/g;
let m;
while ((m = re.exec(text))) {
  const id = m[1];
  if (SKIP.has(id)) continue;

  const eliteVerts = [];
  for (const line of m[2].split('\n')) {
    const nums = parseNums(line);
    if (nums.length >= 3) eliteVerts.push([nums[0], nums[1], nums[2]]);
  }

  const edgeRaw = [];
  for (const line of m[3].split('\n')) {
    const nums = parseNums(line);
    if (nums.length >= 5) edgeRaw.push([nums[0], nums[1], nums[2], nums[3], nums[4]]);
  }

  // Drop tiny decoration edges (engine glow / window detail LOD).
  const edgesKeep = edgeRaw.filter((e) => e[4] >= 12);

  const hdr = text.lastIndexOf('.SHIP_' + id + '\n', m.index);
  let nose = 0;
  let gunSet = false;
  if (hdr >= 0) {
    const chunk = text.slice(hdr, m.index);
    const gm = chunk.match(/Gun vertex\s*=\s*(\d+)(?:\s*\/\s*4\s*=\s*(\d+))?/);
    if (gm) {
      nose = gm[2] ? parseInt(gm[2], 10) : ((parseInt(gm[1], 10) / 4) | 0);
      gunSet = true;
    }
  }
  let maxZ = -1e9;
  let maxZi = 0;
  for (let i = 0; i < eliteVerts.length; i++) {
    if (eliteVerts[i][2] > maxZ) {
      maxZ = eliteVerts[i][2];
      maxZi = i;
    }
  }
  if (!gunSet || nose >= eliteVerts.length) nose = maxZi;

  // Elite → local: +x nose, +y starboard, +z up
  const verts = normalize(eliteVerts.map(([x, y, z]) => [z, x, y]), 1);
  const edges = edgesKeep.map((e) => [e[0], e[1]]);
  const faces = buildFaces(edgesKeep);

  ships.push({
    id: id.toLowerCase(),
    name: NAMES[id] || id,
    source: 'elite',
    nose,
    verts,
    edges,
    faces
  });
}

/* Frontier / FE2 ships not in classic Elite (stylized wireframe hulls). */
addFe(ships, 'eagle_mk1', 'Eagle Mk I',
  [[10, 0, 0], [-4, 5, 0], [-4, -5, 0], [-2, 0, 2.5], [-6, 0, 0]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4]],
  [[0, 1, 3], [0, 3, 2], [1, 2, 4], [1, 4, 3], [2, 3, 4]], 0);

addFe(ships, 'eagle_mk2', 'Eagle Mk II',
  [[11, 0, 0], [-3, 7, 0], [-3, -7, 0], [-1, 0, 2.2], [-7, 2, 0], [-7, -2, 0], [-5, 0, 1]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 5], [4, 5], [4, 6], [5, 6], [3, 6]],
  [[0, 1, 3], [0, 3, 2], [1, 2, 3]], 0);

addFe(ships, 'eagle_mk3', 'Eagle Mk III',
  [[12, 0, 0.5], [-2, 6, 0], [-2, -6, 0], [-6, 3, 0], [-6, -3, 0], [-8, 0, 0], [0, 0, 2.8], [-4, 0, 2]],
  [[0, 1], [0, 2], [1, 6], [2, 6], [1, 3], [2, 4], [3, 5], [4, 5], [3, 7], [4, 7], [6, 7], [0, 6]],
  [[0, 1, 6], [0, 6, 2], [1, 3, 7], [1, 7, 6], [2, 6, 7], [2, 7, 4], [3, 5, 7], [4, 7, 5]], 0);

addFe(ships, 'falcon', 'Falcon',
  [[8, 0, 0], [2, 2, 1.5], [2, -2, 1.5], [-6, 4, 0], [-6, -4, 0], [-8, 4, 0.5], [-8, -4, 0.5], [-2, 0, 0], [-6, 0, 1]],
  [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 8], [6, 8], [3, 8], [4, 8], [1, 7], [2, 7], [7, 8]],
  [[0, 1, 2], [1, 3, 8], [2, 8, 4]], 0);

addFe(ships, 'hawk', 'Hawk',
  [[10, 0, 0], [-5, 6, 0], [-5, -6, 0], [0, 0, 2], [-8, 0, 0], [-3, 3, 1], [-3, -3, 1]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 6], [5, 3], [6, 3]],
  [[0, 1, 3], [0, 3, 2], [1, 2, 4]], 0);

addFe(ships, 'kestrel', 'Kestrel',
  [[9, 0, 0], [-4, 5.5, 0], [-4, -5.5, 0], [-7, 0, 0], [1, 0, 2.4], [-2, 2.5, 1.2], [-2, -2.5, 1.2]],
  [[0, 1], [0, 2], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [1, 5], [2, 6], [4, 5], [4, 6], [5, 3], [6, 3]],
  [[0, 1, 4], [0, 4, 2]], 0);

addFe(ships, 'osprey', 'Osprey',
  [[11, 0, 0], [-6, 4, 0], [-6, -4, 0], [-2, 0, 3], [-9, 0, 0], [0, 3, 1], [0, -3, 1]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [0, 5], [0, 6], [5, 1], [6, 2]],
  [[0, 1, 3], [0, 3, 2]], 0);

addFe(ships, 'imperial_courier', 'Imperial Courier',
  [[14, 0, 0], [-10, 10, 0], [-10, -10, 0], [-4, 0, 4], [-12, 0, 0], [-10, 4, 2], [-10, -4, 2], [2, 4, 0], [2, -4, 0]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 6], [5, 3], [6, 3], [0, 7], [0, 8], [7, 1], [8, 2]],
  [[0, 1, 3], [0, 3, 2], [1, 2, 4]], 0);

addFe(ships, 'imperial_explorer', 'Imperial Explorer',
  [[16, 0, 0], [-12, 8, 0], [-12, -8, 0], [-6, 0, 5], [-14, 0, 0], [-8, 4, 2.5], [-8, -4, 2.5], [4, 3, 0], [4, -3, 0], [-12, 0, 2]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 6], [5, 9], [6, 9], [3, 9], [0, 7], [0, 8], [7, 1], [8, 2]],
  [[0, 1, 3], [0, 3, 2]], 0);

addFe(ships, 'imperial_trader', 'Imperial Trader',
  [[12, 0, 0], [-10, 12, 0], [-10, -12, 0], [-2, 0, 4], [-14, 0, 0], [-10, 0, 3], [4, 5, 0], [4, -5, 0], [-6, 6, 1], [-6, -6, 1]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [3, 5], [4, 5], [0, 6], [0, 7], [6, 1], [7, 2], [1, 8], [2, 9], [8, 3], [9, 3]],
  [[0, 1, 3], [0, 3, 2]], 0);

addFe(ships, 'lifter', 'Lifter',
  [[6, 3, 2], [6, -3, 2], [6, 3, -1], [6, -3, -1], [-6, 4, 2], [-6, -4, 2], [-6, 4, -1], [-6, -4, -1], [8, 0, 0.5]],
  [[8, 0], [8, 1], [0, 1], [0, 2], [1, 3], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [6, 7], [4, 6], [5, 7]],
  [[0, 1, 3], [0, 3, 2], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3], [4, 6, 7], [4, 7, 5]], 8);

addFe(ships, 'panther', 'Panther Clipper',
  [[18, 0, 0], [-14, 14, 0], [-14, -14, 0], [-4, 0, 6], [-16, 0, 0], [-10, 6, 3], [-10, -6, 3], [6, 6, 0], [6, -6, 0]],
  [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 6], [5, 3], [6, 3], [0, 7], [0, 8], [7, 1], [8, 2]],
  [[0, 1, 3], [0, 3, 2]], 0);

const defaultMesh = {
  id: 'arrow',
  name: 'Arrow',
  source: 'local',
  nose: 0,
  verts: [[1, 0, 0], [-0.6667, 0.6111, 0], [-0.6667, -0.6111, 0], [-0.1667, 0, 0.5778]],
  faces: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [2, 1, 3]],
  edges: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]
};

const all = [defaultMesh, ...ships];
const body = `/* Auto-generated Elite + Frontier/FE2 ship hulls (unit-normalized).
 * Scale verts by 9*RES_SCALE at runtime.
 * Elite coords converted: ship.x=elite.z (nose), ship.y=elite.x, ship.z=elite.y (up).
 * Regenerated by: node tools/gen-ship-meshes.js
 */
(function (root) {
  const SHIP_MESH_DEFS = ${JSON.stringify(all, null, 2)};
  root.SHIP_MESH_DEFS = SHIP_MESH_DEFS;
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(outPath, body);
console.log('Wrote', all.length, 'meshes →', outPath);
console.log(all.map((s) => s.id).join(', '));
