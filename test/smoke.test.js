'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startServer, fetchHealth } = require('./helpers/spawn-server');
const { openClient } = require('./helpers/ws-client');

describe('server smoke', () => {
  /** @type {{ port: number, baseUrl: string, wsUrl: string, stop: () => Promise<void> }} */
  let srv;

  before(async () => {
    srv = await startServer();
  });

  after(async () => {
    if (srv) await srv.stop();
  });

  it('GET /health returns ok', async () => {
    const res = await fetchHealth(srv.port);
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.ok, true);
    assert.equal(typeof json.rooms, 'number');
    assert.equal(typeof json.queue, 'number');
  });

  it('serves index.html', async () => {
    const body = await new Promise((resolve, reject) => {
      http.get(`${srv.baseUrl}/`, (res) => {
        assert.equal(res.statusCode, 200);
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    assert.match(body, /<html/i);
  });

  it('WebSocket connects and sends lobby + session', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    const lobby = await c.waitForType('lobby');
    assert.ok(lobby.st);
    await c.waitForType('session');
    c.close();
  });

  it('ignores invalid JSON without crashing', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.ws.send('not-json{{{');
    c.ws.send(JSON.stringify({ noType: true }));
    c.ws.send(JSON.stringify({ t: 'totallyUnknownThing', x: 1 }));
    // Still responsive
    c.send({ t: 'ping', ct: 1, rtt: 10 });
    const pong = await c.waitForType('pong');
    assert.equal(pong.ct, 1);
    const health = await fetchHealth(srv.port);
    assert.equal(health.status, 200);
    c.close();
  });

  it('rejects bad login credentials', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.send({ t: 'login', name: '__nobody_smoke_test__', pin: '0000' });
    const res = await c.waitForType('login');
    assert.equal(res.ok, 0);
    assert.ok(res.err);
    c.close();
  });

  it('rejects steamLogin when Steam auth is not configured', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.send({ t: 'steamLogin', ticket: 'aa'.repeat(32), identity: 'asteroids-game-server' });
    const res = await c.waitForType('steamLogin');
    assert.equal(res.ok, 0);
    assert.equal(res.err, 'disabled');
    c.close();
  });

  it('rejects continue without snapshot', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.send({ t: 'queue', mode: 'continue' });
    const err = await c.waitForType('queueErr');
    assert.equal(err.err, 'nosnap');
    c.close();
  });

  it('starts solo mode and welcomes the player', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.send({ t: 'queue', mode: 'solo', name: 'SmokeBot' });
    const welcome = await c.waitForType('welcome', 10000);
    assert.ok(welcome.id != null);
    assert.equal(welcome.practice, true);
    // Server should still be healthy with an active room
    const health = JSON.parse((await fetchHealth(srv.port)).body);
    assert.ok(health.rooms >= 1);
    c.close();
  });

  it('rejects wrong admin password', async () => {
    const c = openClient(srv.wsUrl);
    await c.ready;
    await c.waitForType('lobby');
    c.send({ t: 'adminLogin', pw: 'not-the-password-xyz' });
    const res = await c.waitForType('admin');
    assert.equal(res.ok, 0);
    c.close();
  });
});
