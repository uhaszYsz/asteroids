/** @file server/admin.js — loaded into shared server scope (do not require() alone). */
let perfTestTick = 0;

function spawnPerfBot(id, name, room) {
  const p = spawnPlayer(id, name, null, room);
  p.bot = true;
  p.hp = PERF_BOT_HP;
  p.lives = 0;
  p.godLeft = Math.round(0.5 * TPS);
  equipRandomPerfWeapon(p);
  return p;
}

function createPerfTestRoom() {
  const room = createRoom({ deferStart: false });
  room.practice = false;
  room.perfTest = true;
  room.matchLive = true;
  room.readyIds.clear();
  // Live field already has asteroids from createRoom(deferStart:false).
  const a = spawnPerfBot(nextPlayerId++, 'PERF_A', room);
  const b = spawnPerfBot(nextPlayerId++, 'PERF_B', room);
  room.players.set(a.id, a);
  room.players.set(b.id, b);
  initPauseBudgets(room);
  return room;
}

function stopPerformanceTest(silent) {
  let n = 0;
  for (const room of [...rooms.values()]) {
    if (!room.perfTest) continue;
    destroyRoom(room);
    n++;
  }
  const was = perfTestActive;
  perfTestActive = false;
  perfTestTick = 0;
  if (silent) return;
  if (was || n) {
    console.log(`[perf] stopped — removed ${n} rooms (${rooms.size} remain)`);
  } else {
    console.log('[perf] no active performance test');
  }
}

function startPerformanceTest(gameCount) {
  let n = gameCount | 0;
  if (!(n > 0)) {
    console.log('[perf] usage: test performance <gamesCount>');
    return;
  }
  if (n > PERF_TEST_MAX_GAMES) {
    console.log(`[perf] clamping ${n} → ${PERF_TEST_MAX_GAMES}`);
    n = PERF_TEST_MAX_GAMES;
  }
  stopPerformanceTest(true);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) createPerfTestRoom();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  perfTestActive = true;
  perfTestTick = 0;
  console.log(
    `[perf] started ${n} PvP games (${n * PLAYERS_PER_MATCH} bots @ ${PERF_BOT_HP} HP) in ${ms.toFixed(1)}ms — rooms=${rooms.size}`
  );
  console.log(`[perf] printing per-tick sim time (budget ${TICK_MS.toFixed(2)}ms). stop with: test performance stop`);
}

function handleServerConsoleLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return;
  const parts = raw.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  if (cmd === 'test' && (parts[1] || '').toLowerCase() === 'performance') {
    const arg = parts[2];
    if (!arg || /^stop$/i.test(arg)) {
      stopPerformanceTest();
      return;
    }
    startPerformanceTest(parseInt(arg, 10));
    return;
  }
  if (cmd === 'help' || cmd === '?') {
    console.log('Commands: test performance <games> | test performance stop');
  }
}

function setupServerConsole() {
  try {
    if (!process.stdin || typeof process.stdin.on !== 'function') return;
    process.stdin.resume();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    rl.on('line', handleServerConsoleLine);
    console.log('Console ready: test performance <games> | test performance stop');
  } catch (err) {
    console.error('Console setup failed:', err && err.message ? err.message : err);
  }
}

function serverTickLoop() {
  const now = process.hrtime.bigint();
  let steps = 0;
  // Catch up a couple of missed ticks, then resync if the process stalled hard.
  while (now >= nextTickAt && steps < 3) {
    const tickStart = process.hrtime.bigint();
    for (const room of rooms.values()) {
      stepRoom(room);
      roomBroadcastBinary(room, packSnapBinary(room));
    }
    const tickMs = Number(process.hrtime.bigint() - tickStart) / 1e6;
    if (perfTestActive) {
      perfTestTick++;
      const over = tickMs > TICK_MS ? ' OVER' : '';
      console.log(
        `[perf] tick ${perfTestTick} rooms=${rooms.size} ${tickMs.toFixed(2)}ms / ${TICK_MS.toFixed(2)}ms${over}`
      );
    }
    nextTickAt += TICK_NS;
    steps++;
  }
  if (now > nextTickAt + TICK_NS * 10n) nextTickAt = now;
  const delayMs = Number((nextTickAt - process.hrtime.bigint()) / 1000000n);
  setTimeout(serverTickLoop, Math.max(0, Math.min(TICK_MS, delayMs)));
}
