#!/usr/bin/env node
/**
 * Build public/asset-manifest.json: path → sha256 for static client assets.
 * Paths are relative to public/ (same as browser URLs). CDN fetch uses public/ prefix.
 * Used by sw.js for forever-cache + GitHub-first loading.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REPO_PUBLIC = 'public';
const PUBLIC = path.join(ROOT, REPO_PUBLIC);
const OUT = path.join(PUBLIC, 'asset-manifest.json');

const INCLUDE_DIRS = [
  'sprites',
  'textures',
  'sounds',
  'music',
  'lib',
  'sim'
];
const INCLUDE_ROOT_FILES = [
  'game.js',
  'music.js',
  'config.js'
];
const INCLUDE_EXTS = new Set([
  '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.wav', '.mp3', '.ogg', '.mod', '.xm'
]);

const SKIP_DIR = /(?:^|[/\\])(?:node_modules|desktop|\.git|tools|test|demos)(?:[/\\]|$)/i;

function sha256buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256file(fp) {
  return sha256buf(fs.readFileSync(fp));
}

/** Hash the git blob (LF) when tracked — avoids Windows CRLF poisoning CDN hashes. */
function sha256rel(rel) {
  try {
    const blob = execSync(`git show HEAD:${REPO_PUBLIC}/${rel}`, {
      cwd: ROOT,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    if (blob && blob.length) return sha256buf(blob);
  } catch (_) { /* untracked or missing */ }
  return sha256file(path.join(PUBLIC, rel));
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const rel = path.relative(PUBLIC, fp).split(path.sep).join('/');
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
for (const d of INCLUDE_DIRS) walk(path.join(PUBLIC, d), files);
for (const f of INCLUDE_ROOT_FILES) {
  if (fs.existsSync(path.join(PUBLIC, f))) files.push(f);
}

files.sort();
const map = {};
for (const rel of files) {
  map[rel] = sha256rel(rel);
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
