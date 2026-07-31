const fs = require('fs');
const path = require('path');

const SIM_DIR = path.join(__dirname, 'public', 'sim');
const NODE_DIR = path.join(__dirname, 'server');

/** Shared with the browser local solo host (public/sim). */
const SIM_PARTS = [
  'constants.js',
  'utils.js',
  'net.js',
  'gameplay.js',
  'session.js',
  'rooms.js'
];

/** Node-only (HTTP, real WebSocket, admin console, listen). */
const NODE_PARTS = [
  'http.js',
  'ws.js',
  'admin.js',
  'boot.js'
];

function readPart(dir, name) {
  let code = fs.readFileSync(path.join(dir, name), 'utf8');
  code = code.replace(/^\/\*\* @file[\s\S]*?\*\/\r?\n/, '');
  return '// ##### ' + name + ' #####\n' + code;
}

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
  ].join('\n');

  const chunks = [
    ...SIM_PARTS.map((n) => readPart(SIM_DIR, n)),
    ...NODE_PARTS.map((n) => readPart(NODE_DIR, n))
  ];

  const bundled = prelude + chunks.join('\n');
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
