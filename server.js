const fs = require('fs');
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
  ].join('\n');

  const chunks = PARTS.map((name) => {
    const fp = path.join(__dirname, 'server', name);
    let code = fs.readFileSync(fp, 'utf8');
    code = code.replace(/^\/\*\* @file[\s\S]*?\*\/\r?\n/, '');
    return '// ##### ' + name + ' #####\n' + code;
  });

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
