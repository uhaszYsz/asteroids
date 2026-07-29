'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
