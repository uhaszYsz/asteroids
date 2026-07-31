'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const srcPath = path.join(root, 'server.js');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split(/\n/);

function sliceLines(a, b) {
  return lines.slice(a - 1, b).join('\n');
}

function findFnEnd(startLine) {
  let i = startLine - 1;
  let depth = 0;
  let started = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
      }
    }
    if (started && depth === 0) return i + 1;
  }
  throw new Error('unclosed fn at ' + startLine);
}

const UTIL_NAMES = [
  'wrap',
  'clampSpeed',
  'limitPlayerSpeed',
  'torusDistSq',
  'wrapDelta',
  'hitCircleCircle',
  'hitEllipseCircle',
  'hitLineCircle',
  'angleDiff',
  'shortestWrapDelta',
  'leadInterceptAngle',
  'leadInterceptAngleFlat',
  'leadInterceptFromDelta',
  'angleDeltaToward',
  'turnAngleToward'
];

const utilRanges = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^function ([A-Za-z0-9_]+)\b/);
  if (!m || !UTIL_NAMES.includes(m[1])) continue;
  const start = i + 1;
  const end = findFnEnd(start);
  let docStart = start;
  if (start > 1 && /\*\/\s*$/.test(lines[start - 2])) {
    let j = start - 2;
    while (j >= 0 && !/^\s*\/\*\*/.test(lines[j])) j--;
    if (j >= 0) docStart = j + 1;
  }
  utilRanges.push({ name: m[1], start: docStart, end });
}
utilRanges.sort((a, b) => a.start - b.start);
console.log('utils:', utilRanges.map((u) => u.name + '@' + u.start + '-' + u.end).join(', '));

function isInUtils(lineNo) {
  return utilRanges.some((u) => lineNo >= u.start && lineNo <= u.end);
}

function sliceSkippingUtils(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) {
    if (isInUtils(i)) continue;
    out.push(lines[i - 1]);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const utilsBody = utilRanges.map((u) => sliceLines(u.start, u.end)).join('\n\n');

const parts = {
  'constants.js': sliceLines(10, 509),
  'utils.js': utilsBody,
  'net.js': sliceSkippingUtils(511, 989),
  'gameplay.js': [
    sliceSkippingUtils(990, 3118),
    sliceSkippingUtils(3362, 6468)
  ].join('\n\n'),
  'session.js': sliceSkippingUtils(3120, 3360),
  'rooms.js': sliceSkippingUtils(6469, 7836),
  'http.js': sliceLines(7838, 7922),
  'ws.js': sliceLines(7924, 8442),
  'admin.js': sliceLines(8443, 8569),
  'boot.js': sliceLines(8571, lines.length)
};

const outDir = path.join(root, 'server');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, body] of Object.entries(parts)) {
  const header = '/** @file server/' + name + ' — loaded into shared server scope (do not require() alone). */\n';
  fs.writeFileSync(path.join(outDir, name), header + body.replace(/\s+$/, '') + '\n');
  console.log(name, body.split(/\n/).length, 'lines');
}

const entry = `const fs = require('fs');
const path = require('path');

const PARTS = [
  'constants.js',
  'utils.js',
  'net.js',
  'gameplay.js',
  'session.js',
  'rooms.js',
  'http.js',
  'ws.js',
  'admin.js',
  'boot.js'
];

function loadServerParts() {
  const prelude = [
    "const http = require('http');",
    "const fs = require('fs');",
    "const path = require('path');",
    "const readline = require('readline');",
    "const { WebSocketServer } = require('ws');",
    "const accountsDb = require('./accounts-db');",
    "const demoRecorder = require('./demo-recorder');",
    "const steamAuth = require('./steam-auth');",
    ''
  ].join('\\n');

  const chunks = PARTS.map((name) => {
    const fp = path.join(__dirname, 'server', name);
    let code = fs.readFileSync(fp, 'utf8');
    code = code.replace(/^\\/\\*\\* @file[\\s\\S]*?\\*\\/\\r?\\n/, '');
    return '// ##### ' + name + ' #####\\n' + code;
  });

  const bundled = prelude + chunks.join('\\n');
  const runner = new Function(
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    bundled
  );
  runner(require, module, exports, __dirname, __filename);
}

loadServerParts();
`;

fs.writeFileSync(srcPath, entry);
console.log('wrote thin server.js');
