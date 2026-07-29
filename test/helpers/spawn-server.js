'use strict';

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchHealth(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path: '/health', timeout: 1000 },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('health timeout'));
    });
    req.on('error', reject);
  });
}

async function waitForHealth(port, timeoutMs = 15000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchHealth(port);
      if (res.status === 200) {
        const json = JSON.parse(res.body);
        if (json && json.ok) return json;
      }
    } catch (err) {
      lastErr = err;
    }
    await sleep(100);
  }
  throw new Error(`Server did not become healthy on :${port} (${lastErr && lastErr.message})`);
}

/**
 * Spawn dedicated server on a free localhost port.
 * @returns {Promise<{ port: number, baseUrl: string, wsUrl: string, stop: () => Promise<void> }>}
 */
async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      HOST: '127.0.0.1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exited = false;
  let exitCode = null;
  child.on('exit', (code) => {
    exited = true;
    exitCode = code;
  });

  try {
    await waitForHealth(port);
  } catch (err) {
    if (!exited) child.kill();
    throw new Error(`${err.message}${stderr ? `\nstderr:\n${stderr}` : ''}`);
  }

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}`,
    async stop() {
      if (exited) return;
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          try { child.kill('SIGKILL'); } catch (_) {}
          resolve();
        }, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
        try { child.kill(); } catch (_) { resolve(); }
      });
      // Ignore exit code; SIGTERM/kill on Windows is noisy.
      void exitCode;
    }
  };
}

module.exports = { startServer, fetchHealth, waitForHealth };
