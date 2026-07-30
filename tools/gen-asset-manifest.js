#!/usr/bin/env node
/**
 * Build asset-manifest.json: path → sha256 for static client assets.
 * Used by sw.js for forever-cache + GitHub-first loading.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'asset-manifest.json');

const INCLUDE_DIRS = [
  'sprites',
  'textures',
  'sounds',
  'music',
  'lib'
];
const INCLUDE_ROOT_FILES = [
  'game.js',
  'music.js',
  'config.js',
  'demo-recorder.js'
];
const INCLUDE_EXTS = new Set([
  '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.wav', '.mp3', '.ogg', '.mod', '.xm'
]);

const SKIP_DIR = /(?:^|[/\\])(?:node_modules|desktop|\.git|tools|test|demos)(?:[/\\]|$)/i;

function sha256file(fp) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(fp));
  return h.digest('hex');
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const rel = path.relative(ROOT, fp).split(path.sep).join('/');
    if (SKIP_DIR.test(rel)) continue;
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, out);
    else if (INCLUDE_EXTS.has(path.extname(name).toLowerCase())) out.push(rel);
  }
}

function gitRef() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (_) {
    return 'main';
  }
}

function gitRemoteRepo() {
  try {
    const url = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
    // https://github.com/uhaszYsz/asteroids.git or git@github.com:uhaszYsz/asteroids.git
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/i);
    if (m) return m[1].replace(/\.git$/i, '');
  } catch (_) { /* ignore */ }
  return 'uhaszYsz/asteroids';
}

const files = [];
for (const d of INCLUDE_DIRS) walk(path.join(ROOT, d), files);
for (const f of INCLUDE_ROOT_FILES) {
  if (fs.existsSync(path.join(ROOT, f))) files.push(f);
}

files.sort();
const map = {};
for (const rel of files) {
  map[rel] = sha256file(path.join(ROOT, rel));
}

const manifest = {
  version: 1,
  repo: gitRemoteRepo(),
  // CDN branch tip (jsDelivr). Origin fallback covers CDN lag after deploys.
  ref: 'main',
  commit: gitRef(),
  generatedAt: new Date().toISOString(),
  files: map
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${OUT} (${Object.keys(map).length} files, commit ${manifest.commit.slice(0, 7)})`);
