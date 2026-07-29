'use strict';

const WebSocket = require('ws');

/**
 * Open a WS, collect JSON messages, ignore binary snapshots.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 */
function openClient(url, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 8000;
  const messages = [];
  const waiters = [];

  const ws = new WebSocket(url);

  function flushWaiters() {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      const hit = messages.find(w.pred);
      if (hit) {
        waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(hit);
      }
    }
  }

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS open timeout')), timeoutMs);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  ws.on('message', (data, isBinary) => {
    // Text frames often arrive as Buffer; only skip real binary snapshots.
    if (isBinary) return;
    const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    if (!text || (text[0] !== '{' && text[0] !== '[')) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (_) {
      return;
    }
    messages.push(msg);
    flushWaiters();
  });

  function waitFor(pred, label, ms) {
    const existing = messages.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = waiters.indexOf(entry);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error(`timeout waiting for ${label || 'message'}`));
      }, ms || timeoutMs);
      const entry = { pred, resolve, timer };
      waiters.push(entry);
    });
  }

  function send(obj) {
    ws.send(JSON.stringify(obj));
  }

  function close() {
    try { ws.close(); } catch (_) {}
  }

  return {
    ws,
    messages,
    ready,
    waitFor,
    waitForType(t, ms) {
      return waitFor((m) => m && m.t === t, `t=${t}`, ms);
    },
    send,
    close
  };
}

module.exports = { openClient };
