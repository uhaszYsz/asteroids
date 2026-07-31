'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.ACCOUNTS_DB_PATH = path.join(
  os.tmpdir(),
  `asteroids-accounts-test-${process.pid}-${Date.now()}.db`
);

const accounts = require('../accounts-db');

describe('accounts-db pure helpers', () => {
  it('normalizePin accepts exactly 4 digits', () => {
    assert.equal(accounts.normalizePin('1234'), '1234');
    assert.equal(accounts.normalizePin(' 98-76 '), '9876');
  });

  it('normalizePin rejects short/non-digit and truncates longer digit strings', () => {
    assert.equal(accounts.normalizePin('12'), null);
    assert.equal(accounts.normalizePin('12345'), '1234'); // digits only, then slice to 4
    assert.equal(accounts.normalizePin('abcd'), null);
    assert.equal(accounts.normalizePin(''), null);
    assert.equal(accounts.normalizePin(null), null);
  });

  it('normalizeColor accepts #RGB and #RRGGBB', () => {
    assert.equal(accounts.normalizeColor('#abc'), '#AABBCC');
    assert.equal(accounts.normalizeColor('#59D9FF'), '#59D9FF');
    assert.equal(accounts.normalizeColor('59d9ff'), '#59D9FF');
  });

  it('normalizeColor rejects invalid colors', () => {
    assert.equal(accounts.normalizeColor('red'), null);
    assert.equal(accounts.normalizeColor('#gg0000'), null);
    assert.equal(accounts.normalizeColor(''), null);
    assert.equal(accounts.normalizeColor(null), null);
  });
});

describe('accounts-db sqlite', () => {
  before(async () => {
    await accounts.ready;
  });

  it('createUser / verifyUser round-trip', () => {
    const name = 'pinuser_' + Date.now();
    const created = accounts.createUser(name, '4242');
    assert.equal(created.ok, 1);
    assert.equal(accounts.verifyUser(name, '4242').ok, 1);
    assert.equal(accounts.verifyUser(name, '0000').ok, 0);
    assert.equal(accounts.getUser(name).matchesWon, 0);
  });

  it('persists wins', async () => {
    const name = 'winuser_' + Date.now();
    assert.equal(accounts.createUser(name, '1111').ok, 1);
    assert.equal(accounts.addWin(name), 1);
    assert.equal(accounts.addWin(name), 2);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(accounts.getUser(name).matchesWon, 2);
  });
});

process.on('exit', () => {
  const p = process.env.ACCOUNTS_DB_PATH;
  if (!p) return;
  for (const f of [p, p + '-wal', p + '-shm']) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
});
