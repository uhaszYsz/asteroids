const fs = require('fs');
const p = require('path').join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('    #solo-shop {');
const end = s.indexOf('    #con {');
if (start < 0 || end < 0) throw new Error('CSS markers missing');

const css = `    #solo-shop {
      position: fixed; inset: 0; z-index: 9;
      display: flex; align-items: center; justify-content: center;
      background: rgba(5, 8, 12, 0.92);
      opacity: 0; visibility: hidden;
      pointer-events: none;
      transition: opacity 0.25s ease, visibility 0.25s;
    }
    #solo-shop.show {
      opacity: 1; visibility: visible;
      pointer-events: auto;
    }
    #solo-shop .ss-card {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #d8ece8;
      width: min(920px, 96vw);
      max-height: min(90vh, 860px);
      overflow: auto;
      padding: 22px 24px 20px;
      border: 1px solid #2a4a58;
      background: #0c141c;
    }
    #solo-shop .ss-tag {
      font-size: 11px; letter-spacing: 0.28em; color: #7ee8ff;
      margin-bottom: 6px; font-weight: 600;
    }
    #solo-shop .ss-title {
      font-size: clamp(28px, 5vw, 40px); font-weight: 800;
      letter-spacing: 0.06em; color: #ffe08a;
      margin: 0 0 4px;
    }
    #solo-shop .ss-meta {
      display: flex; gap: 18px; flex-wrap: wrap;
      font-size: 14px; color: #8fb0a8; margin-bottom: 14px;
    }
    #solo-shop .ss-meta b { color: #e8f6ff; font-weight: 700; }
    #solo-shop .ss-loadout {
      display: flex; flex-direction: column; gap: 10px;
      margin-bottom: 16px;
      padding: 12px 14px;
      border: 1px solid #2e4e5e;
      background: #0e1a24;
    }
    #solo-shop .ss-equipped {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    #solo-shop .ss-equipped .ss-preview {
      width: 72px; height: 72px; flex: 0 0 auto;
      background: #0a1218;
    }
    #solo-shop .ss-equipped-info { flex: 1 1 140px; min-width: 0; }
    #solo-shop .ss-equipped-label {
      font-size: 11px; letter-spacing: 0.16em; color: #7ee8ff; font-weight: 700;
      margin-bottom: 4px;
    }
    #solo-shop .ss-equipped-name {
      font-size: 18px; font-weight: 800; letter-spacing: 0.04em;
      text-transform: uppercase; color: #e8f6ff;
    }
    #solo-shop .ss-equipped-lvl {
      font-size: 13px; color: #8fb0a8; margin-top: 2px;
    }
    #solo-shop .ss-equipped button {
      appearance: none; border: 1px solid #3a6a88;
      background: #122030; color: #e8f6ff;
      font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
      padding: 10px 14px; cursor: pointer; white-space: nowrap;
      text-transform: uppercase;
    }
    #solo-shop .ss-equipped button:hover:not(:disabled) { background: #1a3848; border-color: #7ee8ff; }
    #solo-shop .ss-equipped button:disabled {
      opacity: 0.45; cursor: default; border-color: #2a3a44; color: #6a8088;
    }
    #solo-shop .ss-owned-pu {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding-top: 8px; border-top: 1px solid #1e303c;
    }
    #solo-shop .ss-owned-pu-label {
      font-size: 11px; letter-spacing: 0.14em; color: #7ee8ff; font-weight: 700;
      margin-right: 4px;
    }
    #solo-shop .ss-owned-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 8px 4px 4px;
      border: 1px solid #2a4454;
      background: #121e28;
      font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
      color: #c8e0d8;
    }
    #solo-shop .ss-owned-chip canvas {
      width: 28px; height: 28px; display: block; background: #0a1218;
    }
    #solo-shop .ss-owned-empty {
      font-size: 12px; color: #5a7080; font-style: italic;
    }
    #solo-shop .ss-tabs {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
    }
    #solo-shop .ss-tabs button {
      appearance: none; border: 1px solid #2a4454;
      background: #101c28; color: #8fb0a8;
      font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
      padding: 8px 14px; cursor: pointer; text-transform: uppercase;
    }
    #solo-shop .ss-tabs button.active {
      color: #e8f6ff; border-color: #7ee8ff; background: #1a3040;
    }
    #solo-shop .ss-tabs button:hover:not(.active) { border-color: #3a6a88; color: #c8e0d8; }
    #solo-shop .ss-panel { display: none; }
    #solo-shop .ss-panel.active { display: block; }
    #solo-shop .ss-list {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 720px) {
      #solo-shop .ss-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    #solo-shop .ss-row {
      display: flex; flex-direction: column; align-items: stretch; justify-content: space-between;
      gap: 8px; min-height: 132px;
      padding: 10px; border: 1px solid #243848; background: #101c28;
    }
    #solo-shop .ss-row.ss-owned {
      opacity: 0.42;
      filter: grayscale(0.85);
      border-color: #1a2834;
      background: #0c141c;
      pointer-events: none;
    }
    #solo-shop .ss-preview {
      width: 100%; height: 72px; display: block;
      background: #0a1218;
      image-rendering: auto;
      pointer-events: none;
    }
    #solo-shop .ss-row .ss-name {
      font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: #d8ece8;
    }
    #solo-shop .ss-row button {
      appearance: none; border: 1px solid #3a6a88;
      background: #122030; color: #e8f6ff;
      font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
      padding: 8px 10px; cursor: pointer; white-space: nowrap;
      text-transform: uppercase; width: 100%;
    }
    #solo-shop .ss-row button:hover:not(:disabled) { background: #1a3848; border-color: #7ee8ff; }
    #solo-shop .ss-row button:disabled {
      opacity: 0.45; cursor: default; border-color: #2a3a44; color: #6a8088;
    }
    #solo-shop .ss-continue {
      width: 100%; margin-top: 18px;
      appearance: none; border: 1px solid #6a9a44;
      background: #1a3020; color: #d8ffe0;
      font-size: 15px; font-weight: 700; letter-spacing: 0.1em;
      padding: 12px 18px; cursor: pointer; text-transform: uppercase;
    }
    #solo-shop .ss-continue:hover { background: #244030; border-color: #a0ff88; }
`;

s = s.slice(0, start) + css + s.slice(end);

const oldHtml = `<div id="solo-shop" aria-hidden="true">
  <div class="ss-card">
    <div class="ss-tag">SOLO WAVES</div>
    <div class="ss-title">WAVE SHOP</div>
    <div class="ss-meta">
      <span>Next <b id="ss-wave">5</b></span>
      <span>Coins <b id="ss-coins">0</b></span>
      <span>Score <b id="ss-score">0</b></span>
      <span>Lives <b id="ss-lives">3</b></span>
    </div>
    <div class="ss-sec">WEAPONS</div>
    <div class="ss-list" id="ss-weapons"></div>
    <div class="ss-sec">POWERUPS</div>
    <div class="ss-list" id="ss-powerups"></div>
    <div class="ss-sec">EXTRA</div>
    <div class="ss-list" id="ss-extra"></div>
    <button type="button" class="ss-continue" id="ss-continue-btn">Continue to wave</button>
  </div>
</div>`;

const newHtml = `<div id="solo-shop" aria-hidden="true">
  <div class="ss-card">
    <div class="ss-tag">SOLO WAVES</div>
    <div class="ss-title">WAVE SHOP</div>
    <div class="ss-meta">
      <span>Next <b id="ss-wave">5</b></span>
      <span>Coins <b id="ss-coins">0</b></span>
      <span>Score <b id="ss-score">0</b></span>
      <span>Lives <b id="ss-lives">3</b></span>
    </div>
    <div class="ss-loadout">
      <div class="ss-equipped" id="ss-equipped"></div>
      <div class="ss-owned-pu" id="ss-owned-powerups"></div>
    </div>
    <div class="ss-tabs" id="ss-tabs">
      <button type="button" data-ss-tab="weapons" class="active">Weapons</button>
      <button type="button" data-ss-tab="powerups">Powerups</button>
      <button type="button" data-ss-tab="other">Other</button>
    </div>
    <div class="ss-panel active" data-ss-panel="weapons">
      <div class="ss-list" id="ss-weapons"></div>
    </div>
    <div class="ss-panel" data-ss-panel="powerups">
      <div class="ss-list" id="ss-powerups"></div>
    </div>
    <div class="ss-panel" data-ss-panel="other">
      <div class="ss-list" id="ss-extra"></div>
    </div>
    <button type="button" class="ss-continue" id="ss-continue-btn">Continue to wave</button>
  </div>
</div>`;

if (!s.includes(oldHtml)) throw new Error('HTML block missing');
s = s.replace(oldHtml, newHtml);
s = s.replace(/game\.js\?v=\d+/, 'game.js?v=357');
fs.writeFileSync(p, s);
console.log('patched', p);
