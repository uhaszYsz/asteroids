/**
 * In-browser local game host for offline solo / continue.
 * Loads the same sim modules from /sim/* as the Node server.
 */
(function (global) {
  'use strict';

  const SIM_PARTS = [
    'constants.js',
    'utils.js',
    'net.js',
    'gameplay.js',
    'session.js',
    'rooms.js',
    'ws-handlers.js',
    'tick.js'
  ];

  function stripBanner(code) {
    return String(code || '').replace(/^\/\*\* @file[\s\S]*?\*\/\r?\n/, '');
  }

  /** Minimal Buffer for packSnapBinary. */
  function allocBuffer(size) {
    const ab = new ArrayBuffer(size | 0);
    const dv = new DataView(ab);
    const api = {
      byteLength: ab.byteLength,
      buffer: ab,
      writeUInt8(v, o) { dv.setUint8(o, v & 0xff); },
      writeUInt16LE(v, o) { dv.setUint16(o, v & 0xffff, true); },
      writeUInt32LE(v, o) { dv.setUint32(o, v >>> 0, true); },
      writeFloatLE(v, o) { dv.setFloat32(o, v, true); },
      writeDoubleLE(v, o) { dv.setFloat64(o, v, true); }
    };
    return api;
  }

  function makeAccountsStub() {
    const DEFAULT_PLAYER_COLOR = '#59D9FF';
    const DEFAULT_SHOOT_COLOR = '#59F2FF';
    const users = Object.create(null);
    function normalizeColor(raw) {
      let s = String(raw == null ? '' : raw).trim();
      if (!s) return null;
      if (s[0] !== '#') s = '#' + s;
      if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
        s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
      return s.toUpperCase();
    }
    function normalizePin(pin) {
      const s = String(pin == null ? '' : pin).replace(/\D/g, '').slice(0, 4);
      return s.length === 4 ? s : null;
    }
    return {
      ready: Promise.resolve(),
      DB_PATH: 'local',
      DEFAULT_PLAYER_COLOR,
      DEFAULT_SHOOT_COLOR,
      normalizeColor,
      normalizePin,
      getUser(name) { return name ? users[name] || null : null; },
      createUser() { return { ok: 0, err: 'offline' }; },
      verifyUser() { return { ok: 0, err: 'offline' }; },
      steamAccountKey() { return null; },
      upsertSteamUser() { return { ok: 0, err: 'offline' }; },
      addWin() { return 0; },
      setBestWaves() { return 0; },
      setBestWavesDuo() { return 0; },
      setColors() { return { ok: 0, err: 'offline' }; },
      renameUser() { return { ok: 1 }; },
      listFriends() { return []; },
      addFriend() { return { ok: 0, err: 'offline' }; },
      removeFriend() { return { ok: 0, err: 'offline' }; },
      listLeaderboard() { return []; }
    };
  }

  function makeDemoStub() {
    const noop = function () {};
    return {
      getDemoMode() { return 0; },
      setDemoMode() { return 0; },
      start: noop,
      finish: noop,
      recordPose: noop,
      recordSnap: noop,
      recordInput: noop,
      recordNet: noop,
      recordBulletFire: noop,
      recordAsteroidCreate: noop,
      recordAsteroidDead: noop,
      recordAsteroidWrap: noop,
      recordPause: noop,
      recordResume: noop,
      listSummaries() { return []; }
    };
  }

  function makeSteamStub() {
    return {
      configured() { return false; },
      authenticateTicket() {
        return Promise.resolve({ ok: false, err: 'disabled' });
      }
    };
  }

  function toClientData(data) {
    if (data == null) return data;
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return data;
    if (ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    if (data.buffer instanceof ArrayBuffer) return data.buffer.slice(0);
    return data;
  }

  let bootPromise = null;
  let runtime = null;

  function buildRuntime(partSources) {
    const accountsDb = makeAccountsStub();
    const demoRecorder = makeDemoStub();
    const steamAuth = makeSteamStub();
    const Buffer = { allocUnsafe: allocBuffer };

    const process = {
      env: {},
      exit() {},
      stdin: null,
      hrtime: {
        bigint() {
          return BigInt(Math.floor(performance.now() * 1e6));
        }
      }
    };

    const clients = new Set();
    let onConnection = null;
    const wss = {
      clients,
      on(ev, fn) {
        if (ev === 'connection') onConnection = fn;
      },
      _accept(serverWs) {
        clients.add(serverWs);
        if (typeof onConnection === 'function') onConnection(serverWs);
      },
      _drop(serverWs) {
        clients.delete(serverWs);
      }
    };

    let adminPassword = 'admin1';
    function loadAdminPassword() {}
    function saveAdminPassword(pw) { adminPassword = String(pw || ''); }

    // Unused Node shims referenced only if something slips in.
    const http = {};
    const fs = {};
    const path = { join() { return ''; } };
    const readline = { createInterface() { return { on() {} }; } };
    function WebSocketServer() {}

    const prelude = [
      'const accountsDb = __accountsDb;',
      'const demoRecorder = __demoRecorder;',
      'const steamAuth = __steamAuth;',
      'const Buffer = __Buffer;',
      'const process = __process;',
      'const wss = __wss;',
      'let adminPassword = __adminPassword;',
      'function loadAdminPassword() {}',
      'function saveAdminPassword(pw) { adminPassword = String(pw || ""); }',
      'const http = __http;',
      'const fs = __fs;',
      'const path = __path;',
      'const readline = __readline;',
      'const WebSocketServer = __WebSocketServer;',
      ''
    ].join('\n');

    const body = partSources.map(stripBanner).join('\n');
    const bundled = prelude + body + '\n;return { wss, serverTickLoop, rooms, startSoloMode };\n';

    const runner = new Function(
      '__accountsDb',
      '__demoRecorder',
      '__steamAuth',
      '__Buffer',
      '__process',
      '__wss',
      '__adminPassword',
      '__http',
      '__fs',
      '__path',
      '__readline',
      '__WebSocketServer',
      bundled
    );

    const api = runner(
      accountsDb,
      demoRecorder,
      steamAuth,
      Buffer,
      process,
      wss,
      adminPassword,
      http,
      fs,
      path,
      readline,
      WebSocketServer
    );

    if (typeof api.serverTickLoop === 'function') api.serverTickLoop();
    return api;
  }

  function connectClientSocket() {
    if (!runtime || !runtime.wss) throw new Error('local server not ready');

    const client = {
      readyState: 0,
      binaryType: 'arraybuffer',
      __local: true,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      _deliver(data) {
        if (typeof this.onmessage !== 'function') return;
        const payload = toClientData(data);
        this.onmessage({ data: payload });
      },
      send(data) {
        if (this.readyState !== 1 || !this._server) return;
        let raw = data;
        if (typeof data !== 'string' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
          raw = String(data);
        }
        // Server handlers expect a string for JSON messages.
        if (typeof raw !== 'string' && (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw))) {
          // Binary client→server not used; ignore.
          return;
        }
        this._server._emit('message', raw);
      },
      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        if (this._server) {
          this._server.readyState = 3;
          this._server._emit('close');
          runtime.wss._drop(this._server);
          this._server = null;
        }
        if (typeof this.onclose === 'function') this.onclose({});
      }
    };

    const handlers = { message: [], close: [] };
    const serverWs = {
      readyState: 1,
      __local: true,
      send(data) {
        if (client.readyState === 1) client._deliver(data);
      },
      on(ev, fn) {
        if (handlers[ev]) handlers[ev].push(fn);
      },
      _emit(ev, arg) {
        const list = handlers[ev] || [];
        for (let i = 0; i < list.length; i++) list[i](arg);
      }
    };

    client._server = serverWs;
    // Defer accept so callers can assign onmessage/onopen before lobby/session fire.
    setTimeout(() => {
      if (client.readyState === 3) return;
      client.readyState = 1;
      try {
        runtime.wss._accept(serverWs);
      } catch (err) {
        console.error('local solo accept failed:', err);
        client.readyState = 3;
        if (typeof client.onerror === 'function') client.onerror(err);
        return;
      }
      if (typeof client.onopen === 'function') client.onopen({});
    }, 0);

    return client;
  }

  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const base = (document.currentScript && document.currentScript.src)
        ? document.currentScript.src.replace(/[^/]+$/, '')
        : (location.origin + location.pathname.replace(/[^/]+$/, '') + 'sim/');
      const simBase = /\/sim\/?$/.test(base) ? base : (base + (base.endsWith('/') ? '' : '/') + 'sim/');

      const texts = [];
      for (let i = 0; i < SIM_PARTS.length; i++) {
        const url = simBase + SIM_PARTS[i] + '?v=2';
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error('Failed to load ' + SIM_PARTS[i] + ' (' + res.status + ')');
        texts.push(await res.text());
      }
      runtime = buildRuntime(texts);
      return runtime;
    })().catch((err) => {
      bootPromise = null;
      runtime = null;
      throw err;
    });
    return bootPromise;
  }

  global.AsteroidsLocal = {
    ready: boot(),
    get available() { return !!runtime; },
    connect() {
      if (!runtime) throw new Error('AsteroidsLocal not ready');
      return connectClientSocket();
    },
    async ensure() {
      await this.ready;
      return this;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
