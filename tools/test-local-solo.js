'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  ArrayBuffer,
  DataView,
  Uint8Array,
  BigInt,
  Math,
  JSON,
  Date,
  Promise,
  Map,
  Set,
  Object,
  String,
  Number,
  Error,
  TypeError,
  parseInt,
  isNaN,
  Infinity,
  performance: { now: () => Date.now() },
  location: { origin: 'http://127.0.0.1', pathname: '/' },
  document: { currentScript: { src: 'http://127.0.0.1/sim/local-server.js' } },
  fetch: async (url) => {
    const name = String(url).split('/').pop().split('?')[0];
    return {
      ok: true,
      text: async () => fs.readFileSync(path.join(__dirname, '..', 'public', 'sim', name), 'utf8')
    };
  }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'sim', 'local-server.js'), 'utf8'), sandbox);

const AL = sandbox.AsteroidsLocal;
AL.ensure()
  .then(async () => {
    const sock = AL.connect();
    const msgs = [];
    sock.onmessage = (e) => {
      if (typeof e.data !== 'string') {
        msgs.push('bin');
        return;
      }
      msgs.push(JSON.parse(e.data).t);
    };
    await new Promise((r) => { sock.onopen = () => r(); });
    await new Promise((r) => setTimeout(r, 20));
    console.log('after open', msgs.join(','));
    sock.send(JSON.stringify({ t: 'queue', mode: 'solo', name: 'OFFLINE' }));
    await new Promise((r) => setTimeout(r, 80));
    console.log('after queue', msgs.join(','));
    if (!msgs.includes('lobby') || !msgs.includes('session') || !msgs.includes('welcome')) {
      throw new Error('missing expected messages: ' + msgs.join(','));
    }
    console.log('LOCAL_SOLO_OK');
    process.exit(0);
  })
  .catch((e) => {
    console.error('FAIL', e);
    process.exit(1);
  });
