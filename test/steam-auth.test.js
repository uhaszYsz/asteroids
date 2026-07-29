'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const accounts = require('../accounts-db');
const steamAuth = require('../steam-auth');

describe('steam account helpers', () => {
  it('steamAccountKey formats SteamID64', () => {
    assert.equal(accounts.steamAccountKey('76561198012345678'), 'S76561198012345678');
    assert.equal(accounts.steamAccountKey('abc'), null);
    assert.equal(accounts.steamAccountKey(''), null);
  });

  it('upsertSteamUser creates then reuses', () => {
    const id = '7656119796028793' + String(Date.now()).slice(-4);
    const a = accounts.upsertSteamUser(id, 'TestPilot');
    assert.equal(a.ok, 1);
    assert.equal(a.created, true);
    assert.equal(a.key, 'S' + id.replace(/\D/g, ''));
    assert.equal(a.user.displayName, 'TestPilot');
    const b = accounts.upsertSteamUser(id, 'Renamed');
    assert.equal(b.ok, 1);
    assert.equal(b.created, false);
    assert.equal(b.user.displayName, 'Renamed');
  });

  it('renameUser for steam only changes displayName', () => {
    const id = '7656119796028800' + String(Date.now()).slice(-4);
    const a = accounts.upsertSteamUser(id, 'Alpha');
    const key = a.key;
    const r = accounts.renameUser(key, 'BRAVO');
    assert.equal(r.ok, 1);
    assert.equal(r.displayOnly, true);
    assert.ok(accounts.getUser(key));
    assert.equal(accounts.getUser(key).displayName, 'BRAVO');
  });
});

describe('steam-auth module', () => {
  it('reports disabled without env keys', () => {
    const prevKey = process.env.STEAM_WEB_API_KEY;
    const prevApp = process.env.STEAM_APP_ID;
    delete process.env.STEAM_WEB_API_KEY;
    delete process.env.STEAM_APP_ID;
    assert.equal(steamAuth.configured(), false);
    return steamAuth.authenticateTicket('deadbeefdeadbeefdeadbeefdeadbeef').then((r) => {
      assert.equal(r.ok, false);
      assert.equal(r.err, 'disabled');
      if (prevKey != null) process.env.STEAM_WEB_API_KEY = prevKey;
      if (prevApp != null) process.env.STEAM_APP_ID = prevApp;
    });
  });

  it('rejects malformed tickets when configured', async () => {
    process.env.STEAM_WEB_API_KEY = 'test-key';
    process.env.STEAM_APP_ID = '480';
    assert.equal(steamAuth.configured(), true);
    const r = await steamAuth.authenticateTicket('nope');
    assert.equal(r.ok, false);
    assert.equal(r.err, 'ticket');
  });
});
