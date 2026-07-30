/**
 * Convert ships/ships/*.fbx → ships-fbx-meshes.js (+ uses Texture/*.png).
 * Usage: node tools/gen-fbx-ships.js
 */
const fs = require('fs');
const path = require('path');
const { parseBinary } = require('./tmp-fbx/node_modules/fbx-parser');

const root = path.join(__dirname, '..');
const shipsDir = path.join(root, 'ships', 'ships');
const texDir = path.join(shipsDir, 'Texture');
const outPath = path.join(root, 'ships-fbx-meshes.js');

function normalize(verts, target = 1) {
  let m = 0;
  for (const v of verts) {
    m = Math.max(m, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  }
  const s = m > 0 ? target / m : 1;
  return verts.map((v) => [+(v[0] * s).toFixed(5), +(v[1] * s).toFixed(5), +(v[2] * s).toFixed(5)]);
}

function edgesFromFaces(faces) {
  const seen = new Set();
  const edges = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const k = lo + ',' + hi;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push([lo, hi]);
    }
  }
  return edges;
}

function child(node, name) {
  return (node.nodes || []).find((n) => n.name === name) || null;
}

function prop0(node) {
  if (!node || !node.props || !node.props.length) return null;
  return node.props[0];
}

function basenameTex(p) {
  if (!p) return null;
  const s = String(p).replace(/\\/g, '/');
  const base = s.split('/').pop();
  return base || null;
}

function parseFbxMesh(filePath) {
  const buf = fs.readFileSync(filePath);
  const nodes = parseBinary(buf);
  const objects = nodes.find((n) => n.name === 'Objects');
  if (!objects) throw new Error('no Objects in ' + filePath);
  const geo = (objects.nodes || []).find((n) => n.name === 'Geometry');
  if (!geo) throw new Error('no Geometry in ' + filePath);

  const vertFlat = prop0(child(geo, 'Vertices'));
  const polyIdx = prop0(child(geo, 'PolygonVertexIndex'));
  if (!vertFlat || !polyIdx) throw new Error('missing verts/polys in ' + filePath);

  const positions = [];
  for (let i = 0; i + 2 < vertFlat.length; i += 3) {
    // FBX long-Z / Y-up → game +X nose, +Y starboard, +Z up
    positions.push([vertFlat[i + 2], vertFlat[i], vertFlat[i + 1]]);
  }

  let uvFlat = null;
  let uvIndex = null;
  const uvLayer = child(geo, 'LayerElementUV');
  if (uvLayer) {
    uvFlat = prop0(child(uvLayer, 'UV'));
    uvIndex = prop0(child(uvLayer, 'UVIndex'));
  }

  let texName = null;
  const video = (objects.nodes || []).find((n) => n.name === 'Video');
  if (video) {
    texName = basenameTex(prop0(child(video, 'RelativeFilename')) || prop0(child(video, 'Filename')) || video.props?.[1]);
  }
  if (!texName) {
    const tex = (objects.nodes || []).find((n) => n.name === 'Texture');
    if (tex) texName = basenameTex(prop0(child(tex, 'Media')) || prop0(child(tex, 'RelativeFilename')));
  }
  if (texName && texName.startsWith('Video::')) texName = texName.slice(7);

  const outVerts = [];
  const outUvs = [];
  const faces = [];
  let corner = 0;
  let poly = [];

  const pushCorner = (posIdx) => {
    const p = positions[posIdx];
    if (!p) return;
    let u = 0;
    let v = 0;
    if (uvFlat && uvIndex && corner < uvIndex.length) {
      const ui = uvIndex[corner] | 0;
      u = uvFlat[ui * 2] || 0;
      v = uvFlat[ui * 2 + 1] || 0;
    } else if (uvFlat && corner * 2 + 1 < uvFlat.length) {
      u = uvFlat[corner * 2] || 0;
      v = uvFlat[corner * 2 + 1] || 0;
    }
    outVerts.push(p.slice());
    outUvs.push([+u.toFixed(5), +v.toFixed(5)]);
    poly.push(outVerts.length - 1);
    corner++;
  };

  for (let i = 0; i < polyIdx.length; i++) {
    let idx = polyIdx[i] | 0;
    const end = idx < 0;
    if (end) idx = ~idx;
    pushCorner(idx);
    if (end) {
      if (poly.length >= 3) {
        for (let t = 1; t + 1 < poly.length; t++) {
          faces.push([poly[0], poly[t], poly[t + 1]]);
        }
      }
      poly = [];
    }
  }

  const nv = normalize(outVerts, 1);
  // Keep UVs aligned 1:1 with verts (already expanded).
  let nose = 0;
  let best = -1e9;
  for (let i = 0; i < nv.length; i++) {
    if (nv[i][0] > best) {
      best = nv[i][0];
      nose = i;
    }
  }

  let texture = null;
  if (texName) {
    const local = path.join(texDir, texName);
    if (fs.existsSync(local)) texture = 'ships/ships/Texture/' + texName;
  }
  if (!texture) {
    const fallback = fs.existsSync(path.join(texDir, 'T_Spase_64.png'))
      ? 'ships/ships/Texture/T_Spase_64.png'
      : 'ships/ships/Texture/T_Spase_blue.png';
    texture = fallback;
  }

  // No edges export — silhouette is derived from faces at draw time; edges balloon the JS size.
  return {
    verts: nv,
    uvs: outUvs,
    faces,
    edges: [],
    nose,
    texture
  };
}

function titleFromId(id) {
  return String(id)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d+)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = fs.readdirSync(shipsDir)
  .filter((f) => /\.fbx$/i.test(f))
  .sort((a, b) => a.localeCompare(b));

const ships = [];
for (const file of files) {
  const base = path.basename(file, '.fbx');
  const full = path.join(shipsDir, file);
  try {
    const mesh = parseFbxMesh(full);
    ships.push({
      id: 'fbx_' + base.replace(/[^a-z0-9_]+/gi, '_').toLowerCase(),
      name: titleFromId(base),
      source: 'ships',
      kind: 'textured',
      texture: mesh.texture,
      nose: mesh.nose,
      verts: mesh.verts,
      uvs: mesh.uvs,
      faces: mesh.faces,
      edges: mesh.edges
    });
    console.log('OK', base, mesh.verts.length + 'v', mesh.faces.length + 'f', mesh.texture);
  } catch (e) {
    console.error('FAIL', base, e.message);
  }
}

const body = `/* Auto-generated from ships/ships/*.fbx — do not edit by hand.
 * Regenerated by: node tools/gen-fbx-ships.js
 */
(function (root) {
  const FBX_SHIP_MESH_DEFS = ${JSON.stringify(ships)};
  root.FBX_SHIP_MESH_DEFS = FBX_SHIP_MESH_DEFS;
  root.SHIP_MESH_DEFS = (root.SHIP_MESH_DEFS || []).concat(FBX_SHIP_MESH_DEFS);
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(outPath, body);
console.log('Wrote', ships.length, 'ships →', path.relative(root, outPath), '(' + (fs.statSync(outPath).size / 1024).toFixed(0) + ' KB)');
