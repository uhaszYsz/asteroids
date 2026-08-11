/** @file server/rooms.js — loaded into shared server scope (do not require() alone). */
function takePlayerInput(p) {
  if (p.inputQueue.length) {
    const next = p.inputQueue.shift();
    p.inp.l = next.l;
    p.inp.r = next.r;
    p.inp.u = next.u;
    p.inp.sp = next.sp;
    p.inp.sh = next.sh ? 1 : 0;
    p.inp.j = next.j ? 1 : 0;
    p.lastSeq = next.seq;
  } else {
    // Hold last movement/turn under jitter — never invent shoot pulses.
    p.inp.sp = 0;
    p.inp.j = 0;
  }
}

/** Drain queued cmds for ack/seq only (pause / death / frozen) — no movement. */
function drainPlayerInputQueue(p) {
  while (p.inputQueue.length) {
    takePlayerInput(p);
    p.inp.sp = 0;
  }
  p.inp.sp = 0;
}

/**
 * Exactly one ship step per room tick.
 * Take at most one queued cmd (leave the rest for later ticks) so a jitter
 * burst cannot stack N× thrust/turn. Empty queue → one held step.
 * Seq advances 1:1 with physics so client prediction stays aligned.
 */
function stepPlayerInputs(room, p) {
  const frozen = !!(room.shopOpen || room.campaignMapOpen || roomPreRoundFrozen(room) || (!room.matchLive && !room.practice));
  const live = !!(room.matchLive && !roomPreRoundFrozen(room) && !room.campaignMapOpen);

  if (frozen) {
    drainPlayerInputQueue(p);
    p.vx = 0;
    p.vy = 0;
    p.av = 0;
    p.inp.u = 0;
    p.inp.l = 0;
    p.inp.r = 0;
    p.inp.sp = 0;
    p.inp.j = 0;
    p.bursting = false;
    p.railChargeLeft = 0;
    p.prevX = p.x;
    p.prevY = p.y;
    return;
  }

  takePlayerInput(p);
  demoRecorder.recordInput(room, p);
  if (live && p.inp.sp) tryStartBurst(p);
  applyInput(room, p);
  if (live && p.hp > 0 && p.inp.u) fireThrustRay(room, p);
  if (live) updateShooting(room, p);
  p.prevX = p.x;
  p.prevY = p.y;
  p.x += p.vx;
  p.y += p.vy;
  if (room.campaign && p.jumping) {
    if (playerOffPlayfield(p)) openCampaignMap(room);
  } else {
    wrap(p);
  }
  clearGodmodeIfLeftSpawn(room, p);
  p.inp.sp = 0;
  p.inp.j = 0;
}

function createInitialAsteroids() {
  return [
    ...Array.from({ length: BIG_ASTEROID_COUNT }, () =>
      makeAsteroid({ size: 'big', offscreen: true })
    ),
    makeCenterAsteroid(),
    ...Array.from({ length: START_MEDIUM_COUNT }, () =>
      makeAsteroid({ size: 'medium', allowSpecial: false })
    )
  ];
}

function createRoom(opts) {
  opts = opts || {};
  const deferStart = !!opts.deferStart;
  const room = {
    id: nextRoomId++,
    tick: 0,
    nextBulletId: 1,
    nextPickupId: 1,
    players: new Map(),
    clients: new Set(),
    /** False until both humans finish welcome intro and send ready. */
    matchLive: !deferStart,
    readyIds: new Set(),
    asteroids: deferStart ? [] : createInitialAsteroids(),
    /** O(1) aid → asteroid; kept in sync by pushAsteroid / removeAsteroid / spliceAsteroidAt. */
    asteroidByAid: new Map(),
    asteroidRev: 0,
    mediumCountRev: -1,
    mediumCount: 0,
    bullets: [],
    pickups: [],
    poseHistory: [],
    roundResetting: false,
    deathShakeLeft: 0,
    deathBoomLeft: 0,
    deathBoomed: false,
    deathVictimId: null,
    deathX: 0,
    deathY: 0,
    pendingBigSpawns: [],
    /** Deferred L2+ rail bounce segments: { tick, ownerId, ox, oy, dx, dy, range }. */
    pendingRailBounces: [],
    wave: 0,
    waveClearLeft: 0,
    /** Solo/coop boss roster for waves 10/20/30 — rolled once at match start. */
    bossPlan: null,
    /** Campaign mode: star map + hyperspace jump between stages. */
    campaign: false,
    campaignStars: null,
    campaignStarId: 0,
    campaignMapOpen: false,
    enemies: [],
    nextEnemyId: 1,
    enemySnapLeft: ENEMY_SNAP_INTERVAL,
    shopOpen: false,
    shopWave: 0,
    /** PvP: player ids with personal shop open during pre-round. */
    pvpShopOpen: new Set(),
    /** PvP: seconds left on 3-2-1 (0 = inactive). */
    preRoundCd: 0,
    preRoundAcc: 0,
    /** Match pause (PvP primarily; also solo for Esc menu). */
    paused: false,
    pauseReason: null,
    pauseReady: new Set(),
    pauseBudget: new Map(),
    pauseBurnId: null,
    pauseCountdown: 0,
    /** playerId -> { accountKey, name } while disconnected mid-match. */
    pauseHold: new Map(),
    /** Admin sv_ping: simulated RTT (ms) for this room only. 0 = off. */
    simPingMs: 0
  };
  syncAsteroidByAid(room);
  rooms.set(room.id, room);
  return room;
}

function destroyRoom(room) {
  if (!room) return;
  if (room.demo) demoRecorder.finish(room, { reason: 'destroy' });
  rooms.delete(room.id);
}

function initPauseBudgets(room) {
  room.pauseBudget = new Map();
  for (const p of humanPlayers(room)) {
    room.pauseBudget.set(p.id, PAUSE_BUDGET_MS);
  }
}

function packPauseBudgets(room) {
  const out = {};
  for (const [id, ms] of room.pauseBudget || []) {
    out[id] = Math.max(0, ms | 0);
  }
  return out;
}

function packPauseState(room, extra) {
  return Object.assign({
    t: 'paused',
    reason: room.pauseReason || 'manual',
    budgets: packPauseBudgets(room),
    burnId: room.pauseBurnId,
    ready: [...(room.pauseReady || [])],
    need: humanPlayers(room).length,
    countdown: room.pauseCountdown | 0,
    holds: [...(room.pauseHold || [])].map(([id, h]) => [id, h.name || '', !!h.disconnected])
  }, extra || {});
}

function broadcastPauseState(room) {
  if (!room) return;
  roomBroadcast(room, packPauseState(room));
}

function remainingPauseBudget(room, playerId) {
  if (!room || !room.pauseBudget) return 0;
  return Math.max(0, room.pauseBudget.get(playerId) | 0);
}

function beginPause(room, burnId, reason) {
  if (!room) return false;
  if (room.paused) {
    // Already paused — optionally switch burn target on disconnect.
    if (reason === 'disconnect' && burnId != null) {
      room.pauseBurnId = burnId;
      room.pauseReason = 'disconnect';
      room.pauseReady.clear();
      room.pauseCountdown = 0;
      broadcastPauseState(room);
    }
    return true;
  }
  if (burnId != null && remainingPauseBudget(room, burnId) <= 0) return false;
  room.paused = true;
  room.pauseReason = reason || 'manual';
  room.pauseReady = new Set();
  room.pauseBurnId = burnId;
  room.pauseCountdown = 0;
  // Stop in-progress shots and lock dead-reckon clocks to current poses.
  for (const p of room.players.values()) {
    p.bursting = false;
    p.railChargeLeft = 0;
    p.inp.sp = 0;
    p.vx = 0;
    p.vy = 0;
    p.av = 0;
  }
  resyncAllAsteroids(room);
  resyncAllBullets(room);
  resyncAllEnemies(room);
  demoRecorder.recordPause(room, room.pauseReason);
  broadcastPauseState(room);
  return true;
}

function burnPauseBudget(room) {
  if (!room || !room.paused || room.pauseCountdown > 0) return;
  const id = room.pauseBurnId;
  if (id == null) return;
  const left = remainingPauseBudget(room, id) - TICK_MS;
  room.pauseBudget.set(id, Math.max(0, left));
  if (left > 0) return;
  // Budget exhausted: if burner disconnected → forfeit; else force resume countdown.
  const hold = room.pauseHold && room.pauseHold.get(id);
  if (hold && hold.disconnected) {
    forfeitPausedPlayer(room, id);
  } else {
    startPauseResumeCountdown(room);
  }
}

function startPauseResumeCountdown(room) {
  if (!room || !room.paused) return;
  room.pauseBurnId = null;
  room.pauseCountdown = PAUSE_RESUME_COUNTDOWN_SEC * TPS;
  room.pauseReady = new Set(humanPlayers(room).filter(p => {
    const h = room.pauseHold.get(p.id);
    return !(h && h.disconnected);
  }).map(p => p.id));
  roomBroadcast(room, {
    t: 'resumeCd',
    n: PAUSE_RESUME_COUNTDOWN_SEC,
    tick: room.tick,
    st: Date.now()
  });
  broadcastPauseState(room);
}

function tickPauseCountdown(room) {
  if (!room || !room.paused || !(room.pauseCountdown > 0)) return;
  room.pauseCountdown--;
  if (room.pauseCountdown > 0 && room.pauseCountdown % TPS === 0) {
    const sec = Math.ceil(room.pauseCountdown / TPS);
    roomBroadcast(room, {
      t: 'resumeCd',
      n: sec,
      tick: room.tick,
      st: Date.now()
    });
  }
  if (room.pauseCountdown <= 0) {
    endPause(room);
  }
}

function endPause(room) {
  if (!room) return;
  room.paused = false;
  room.pauseReason = null;
  room.pauseReady = new Set();
  room.pauseBurnId = null;
  room.pauseCountdown = 0;
  resyncAllAsteroids(room);
  resyncAllBullets(room);
  resyncAllEnemies(room);
  demoRecorder.recordResume(room);
  roomBroadcast(room, {
    t: 'resumed',
    tick: room.tick,
    st: Date.now(),
    players: packSnap(room).players,
    asteroids: room.asteroids.map(packAsteroid),
    bullets: room.bullets.map(packBullet),
    enemies: (room.enemies || []).filter(enemyIsSpawned).map(packEnemy),
    budgets: packPauseBudgets(room)
  });
}

function markPauseReady(room, playerId) {
  if (!room || !room.paused || room.pauseCountdown > 0) return;
  if (playerId == null || !room.players.has(playerId)) return;
  const hold = room.pauseHold.get(playerId);
  if (hold && hold.disconnected) return;
  // Solo / wait-waves: Ready resumes immediately (no shared countdown).
  if (room.practice && !room.coop) {
    endPause(room);
    return;
  }
  // Cannot resume while a teammate/opponent is still disconnected.
  for (const h of room.pauseHold.values()) {
    if (h && h.disconnected) {
      room.pauseReady.add(playerId);
      broadcastPauseState(room);
      return;
    }
  }
  room.pauseReady.add(playerId);
  broadcastPauseState(room);
  const need = humanPlayers(room).filter(p => {
    const h = room.pauseHold.get(p.id);
    return !(h && h.disconnected);
  });
  if (need.length > 0 && need.every(p => room.pauseReady.has(p.id))) {
    startPauseResumeCountdown(room);
  }
}

function requestMatchPause(ws) {
  const room = ws.room;
  if (!room || ws.playerId == null) return { ok: 0, err: 'noroom' };
  // Solo / practice / matchmaking wait-waves: Esc toggles pause with no 3-2-1.
  if (room.practice && !room.coop) {
    if (room.paused) {
      endPause(room);
      return { ok: 1, resumed: 1 };
    }
    beginPause(room, null, 'manual');
    return { ok: 1 };
  }
  // PvP / coop: need live match (or already mid-match after go).
  if (!room.matchLive && !room.practice) {
    // Pre-go intro: still allow pause between ready.
  }
  if (room.coop || !room.practice) {
    if (remainingPauseBudget(room, ws.playerId) <= 0) return { ok: 0, err: 'budget' };
    beginPause(room, ws.playerId, 'manual');
    return { ok: 1 };
  }
  beginPause(room, ws.playerId, 'manual');
  return { ok: 1 };
}

function forfeitPausedPlayer(room, loserId) {
  if (!room) return;
  room.pauseHold.clear();
  room.paused = false;
  room.pauseCountdown = 0;
  room.pauseBurnId = null;

  if (room.practice && !room.coop) {
    for (const ws of [...room.clients]) {
      leaveRoom(ws);
      if (ws.readyState === 1) send(ws, { t: 'lobby', st: Date.now() });
    }
    if (rooms.has(room.id)) destroyRoom(room);
    return;
  }

  if (!room.practice) {
    const winner = humanPlayers(room).find(p => p.id !== loserId);
    if (winner) {
      winner.score = Math.max(winner.score | 0, SCORE_TO_WIN);
      endMatch(room, winner);
      return;
    }
  }

  for (const ws of [...room.clients]) {
    leaveRoom(ws);
    if (ws.readyState === 1) send(ws, { t: 'lobby', st: Date.now() });
  }
  if (rooms.has(room.id)) destroyRoom(room);
}

function handleDisconnectHold(ws) {
  const room = ws.room;
  if (!room || ws.playerId == null) return false;
  // Only hold PvP (or coop) matches that have started or are in progress.
  const competitive = !room.practice || room.coop;
  if (!competitive) return false;
  if (!room.matchLive && !room.paused && room.readyIds && room.readyIds.size === 0 && !room.practice) {
    // Still in intro before anyone ready — still hold if both were welcomed.
  }
  const pid = ws.playerId;
  const p = room.players.get(pid);
  if (!p) return false;

  room.pauseHold.set(pid, {
    accountKey: ws.accountKey || null,
    name: ws.displayName || p.name || 'PILOT',
    disconnected: true
  });
  // Attach account key on player for rejoin matching.
  p.accountKey = ws.accountKey || p.accountKey || null;

  room.clients.delete(ws);
  ws.room = null;
  ws.playerId = null;
  if (ws.state === 'playing' || ws.state === 'practice') ws.state = 'lobby';

  if (!room.pauseBudget.has(pid)) room.pauseBudget.set(pid, PAUSE_BUDGET_MS);
  beginPause(room, pid, 'disconnect');
  broadcastPresence();
  return true;
}

function findRejoinSlot(accountKey, displayName) {
  if (!accountKey && !displayName) return null;
  for (const room of rooms.values()) {
    if (!room.paused && !(room.pauseHold && room.pauseHold.size)) continue;
    const competitive = !room.practice || room.coop;
    if (!competitive) continue;
    for (const [pid, hold] of room.pauseHold || []) {
      if (!hold.disconnected) continue;
      if (accountKey && hold.accountKey && hold.accountKey === accountKey) {
        return { room, playerId: pid };
      }
      if (!hold.accountKey && displayName && hold.name === displayName) {
        return { room, playerId: pid };
      }
    }
    // Also match players still in room with accountKey but no ws.
    for (const p of room.players.values()) {
      if (p.bot) continue;
      let connected = false;
      for (const c of room.clients) {
        if (c.playerId === p.id) { connected = true; break; }
      }
      if (connected) continue;
      if (accountKey && p.accountKey === accountKey) {
        return { room, playerId: p.id };
      }
    }
  }
  return null;
}

function packRejoinOffer(slot) {
  if (!slot) return null;
  const { room, playerId } = slot;
  return {
    t: 'rejoinOffer',
    room: room.id,
    playerId,
    budgets: packPauseBudgets(room),
    reason: room.pauseReason || 'disconnect',
    names: packRosterNames(room)
  };
}

function tryRejoin(ws) {
  const slot = findRejoinSlot(ws.accountKey, ws.displayName);
  if (!slot) return { ok: 0, err: 'none' };
  const { room, playerId } = slot;
  const p = room.players.get(playerId);
  if (!p) return { ok: 0, err: 'gone' };

  // Leave any other room/queue first.
  removeFromQueue(ws);
  if (ws.room) leaveRoom(ws);

  room.clients.add(ws);
  ws.room = room;
  ws.playerId = playerId;
  ws.state = room.practice ? 'practice' : 'playing';
  p.accountKey = ws.accountKey || p.accountKey || null;
  p.name = ws.displayName || p.name;
  const hold = room.pauseHold.get(playerId);
  if (hold) {
    hold.disconnected = false;
    hold.accountKey = ws.accountKey || hold.accountKey;
    hold.name = ws.displayName || hold.name;
  } else {
    room.pauseHold.set(playerId, {
      accountKey: ws.accountKey || null,
      name: ws.displayName || p.name,
      disconnected: false
    });
  }

  if (!room.paused) beginPause(room, null, 'rejoin');
  room.pauseReady.delete(playerId);
  room.pauseCountdown = 0;
  // If burn was this player from disconnect, keep burning until both ready.
  if (room.pauseBurnId == null) room.pauseBurnId = playerId;

  sendWelcome(ws, room, p, {
    waitingReady: !room.matchLive,
    paused: 1,
    pause: packPauseState(room),
    rejoin: 1
  });
  broadcastPauseState(room);
  roomBroadcast(room, {
    t: 'roster',
    room: room.id,
    tick: room.tick,
    st: Date.now(),
    players: packSnap(room).players,
    scores: packScoreboard(room),
    names: packRosterNames(room),
    colors: packPlayerColors(room),
    scoreToWin: SCORE_TO_WIN
  });
  broadcastPresence();
  return { ok: 1 };
}

function sendRejoinOfferIfAny(ws) {
  const slot = findRejoinSlot(ws.accountKey, ws.displayName);
  if (slot && ws.readyState === 1) send(ws, packRejoinOffer(slot));
}

function stepRoom(room) {
  room.tick++;

  // Match pause: full freeze + budget burn / resume countdown.
  if (room.paused) {
    for (const p of room.players.values()) {
      if (!p.bot) {
        drainPlayerInputQueue(p);
        demoRecorder.recordInput(room, p);
      }
      p.vx = 0;
      p.vy = 0;
      p.av = 0;
      p.bursting = false;
      p.railChargeLeft = 0;
      p.inp.sp = 0;
    }
    if (room.pauseCountdown > 0) tickPauseCountdown(room);
    else burnPauseBudget(room);
    // Periodic budget refresh for clients (~4 Hz).
    if ((room.tick % Math.max(1, (TPS / 4) | 0)) === 0) broadcastPauseState(room);
    pushPoseHistory(room);
    sendAsteroidGhostDumps(room);
    return;
  }

  // Death cam: full freeze. Shake beat → boom event → wait → respawn.
  if ((room.deathShakeLeft | 0) > 0 || (room.deathBoomLeft | 0) > 0 || room.deathBoomed) {
    for (const p of room.players.values()) {
      if (!p.bot) drainPlayerInputQueue(p);
      p.vx = 0;
      p.vy = 0;
      p.av = 0;
      p.bursting = false;
      p.railChargeLeft = 0;
      p.inp.sp = 0;
    }
    // Freeze the world — no asteroid / bullet / pickup / big-spawn updates.

    if ((room.deathShakeLeft | 0) > 0) {
      room.deathShakeLeft--;
      if (room.deathShakeLeft <= 0 && !room.deathBoomed) {
        room.deathBoomed = true;
        roomBroadcast(room, {
          t: 'boom',
          id: room.deathVictimId,
          x: room.deathX,
          y: room.deathY
        });
      }
    } else if (room.deathBoomed) {
      room.deathBoomLeft = Math.max(0, (room.deathBoomLeft | 0) - 1);
      if (room.deathBoomLeft <= 0) finishDeathRound(room);
    }

    pushPoseHistory(room);
    sendAsteroidGhostDumps(room);
    return;
  }

  tickPendingBigSpawns(room);
  tickPvpShopTimers(room);
  tickPreRoundCountdown(room);

  for (const p of room.players.values()) {
    if (p.bot) {
      if (room.perfTest) updatePerfBotInput(room, p);
      else updateBotInput(p);
      if (room.matchLive && !roomPreRoundFrozen(room) && p.inp.sp) tryStartBurst(p);
      if (room.shopOpen || roomPreRoundFrozen(room) || (!room.matchLive && !room.practice)) {
        p.vx = 0;
        p.vy = 0;
        p.av = 0;
        p.inp.u = 0;
        p.inp.l = 0;
        p.inp.r = 0;
        p.inp.sp = 0;
        p.bursting = false;
        p.railChargeLeft = 0;
        p.prevX = p.x;
        p.prevY = p.y;
        p.inp.sp = 0;
        continue;
      }
      applyInput(room, p);
      if (room.matchLive && room.perfTest && p.hp > 0 && p.inp.u) {
        fireThrustRay(room, p);
      }
      if (room.matchLive && room.perfTest) updateShooting(room, p);
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      wrap(p);
      clearGodmodeIfLeftSpawn(room, p);
      p.inp.sp = 0;
      continue;
    }
    // Humans: one cmd/step per tick (backlog drains over time — no thrust stack).
    stepPlayerInputs(room, p);
    if (room.matchLive && !room.campaignMapOpen) tickPlayerShield(room, p);
  }
  if (room.matchLive && !roomPreRoundFrozen(room)) processPendingRailBounces(room);
  // Move asteroids first, rebuild spatial hash once, then bullets + collisions
  // (avoids a second rebuild inside updateBullets).
  // Pre-round 3-2-1 / PvP shop / campaign map: freeze the field in place.
  if (roomPreRoundFrozen(room) || (room.campaign && room.campaignMapOpen)) {
    clearGodmodeSpawnZones(room);
    rebuildAsteroidSpatialHash(room);
    pushPoseHistory(room);
    sendAsteroidGhostDumps(room);
    return;
  }
  for (let i = room.asteroids.length - 1; i >= 0; i--) {
    const a = room.asteroids[i];
    // Lifetime elapsed: cancel pending wraps, but keep the rock while on-screen.
    // Off-screen cull happens below via !asteroidWouldWrap (no teleport).
    if (asteroidLifeExpired(a) && a.portalTwinAid != null) {
      removePortalTwin(room, a);
    }
    tickAsteroidMagnetAccel(a);
    a.x += a.vx;
    a.y += a.vy;
    a.angle += a.spin;
    if ((a.portalGrace | 0) > 0) a.portalGrace--;

    // Broken links.
    if (a.portalTwinAid != null && !findAsteroidByAid(room, a.portalTwinAid)) {
      a.portalTwinAid = null;
    }
    if (a.portalOfAid != null && !findAsteroidByAid(room, a.portalOfAid)) {
      destroyPortalInbound(room, a);
      continue;
    }

    if (!a.entered) {
      if (!isOffScreen(a)) {
        a.entered = true;
        if (!a.portalOfAid) {
          a.noCollide = false;
          a.portalArmed = true;
          a.portalGrace = 0;
        } else {
          a.portalArmed = false;
        }
        resyncAsteroidSpawn(a);
        emitAsteroidWrap(room, a);
      } else {
        // Never reached the field — cull so wave clear can't soft-lock forever.
        const age = Date.now() - (a.spawnSt || 0);
        if (age > ASTEROID_INBOUND_STUCK_MS) {
          if (a.portalOfAid != null) {
            const parent = findAsteroidByAid(room, a.portalOfAid);
            if (parent && parent.portalTwinAid === a.aid) parent.portalTwinAid = null;
          }
          removePortalTwin(room, a);
          emitAsteroidDead(room, a.aid, true);
          spliceAsteroidAt(room, i);
          continue;
        }
      }
      // Portal twin: collide as soon as any part is on-screen (don't wait for handoff).
      if (a.portalOfAid != null && a.noCollide && asteroidOverlapsPlayfield(a)) {
        a.noCollide = false;
      }
      continue;
    }

    // Portal twin that already entered: keep collide on while overlapping.
    if (a.portalOfAid != null && a.noCollide && asteroidOverlapsPlayfield(a)) {
      a.noCollide = false;
    }

    // Parent left the approach zone — cancel pending twin.
    if (a.portalTwinAid != null && asteroidClearOfPortalZone(a)) {
      removePortalTwin(room, a);
    }

    // Re-arm whenever we're not actively exiting. Do NOT require clearOfPortalZone:
    // edge-huggers never get clear of every side, stayed unarmed, and only got a
    // twin on last-chance (~1–2s after they should have) — felt like lag.
    if (
      !a.portalOfAid
      && a.portalTwinAid == null
      && !(a.portalGrace > 0)
      && !asteroidExitingScreen(a)
    ) {
      a.portalArmed = true;
    }

    // Spawn as soon as the lead zone is entered (armed + exiting).
    if (
      svPortal
      && !a.playerShot
      && !(a.portalGrace > 0)
      && a.portalTwinAid == null
      && a.portalOfAid == null
      && asteroidExitingScreen(a)
      && asteroidWouldWrap(room, a)
    ) {
      a.portalArmed = true;
      spawnAsteroidPortalTwin(room, a);
    }

    if (!isOffScreen(a)) continue;

    // PvP smalls never wrap — always cull quietly (no coins).
    // Waves smalls use the shared one-wrap path below.
    // Player meteor-gun shots wrap via classic edge teleport (no twins).
    if (a.size === 'small' && !room.practice && !a.playerShot) {
      if (a.portalOfAid != null) {
        const parent = findAsteroidByAid(room, a.portalOfAid);
        if (parent && parent.portalTwinAid === a.aid) parent.portalTwinAid = null;
        a.portalOfAid = null;
      }
      removePortalTwin(room, a);
      emitAsteroidDead(room, a.aid, true);
      spliceAsteroidAt(room, i);
      continue;
    }

    // Inbound twin: never normal-wrap; parent handoff owns the promotion.
    // Safety: if the twin is fully off-screen while the parent is back in play
    // (not exiting), the cancel path missed it — drop the ghost or the wave soft-locks.
    if (a.portalOfAid != null) {
      const parent = findAsteroidByAid(room, a.portalOfAid);
      if (!parent) {
        destroyPortalInbound(room, a);
        continue;
      }
      if (isOffScreen(a) && !isOffScreen(parent) && !asteroidExitingScreen(parent)) {
        destroyPortalInbound(room, a);
        continue;
      }
      continue;
    }

    if (a.size === 'medium' && !a.centerRock && countMediumAsteroids(room) > mediumAsteroidCap(room)) {
      removePortalTwin(room, a);
      emitAsteroidDead(room, a.aid, true);
      spliceAsteroidAt(room, i);
      continue;
    }

    // Lifetime over / wrap-ineligible — cull quietly once fully off-screen (no teleport).
    if (!asteroidWouldWrap(room, a)) {
      removePortalTwin(room, a);
      emitAsteroidDead(room, a.aid, true);
      spliceAsteroidAt(room, i);
      continue;
    }

    // Player shots / portal-off: wait until fully off-screen, then teleport to opposite edge.
    // Never spawn portal twins for meteor-gun rocks.
    if (svPortal && !a.playerShot) {
      if (a.portalTwinAid == null) {
        a.portalArmed = true;
        spawnAsteroidPortalTwin(room, a);
      }
      if (handoffPortalTwin(room, a)) continue;
      // Handoff failed — never teleport the parent while leaving a twin ghost behind.
      removePortalTwin(room, a);
    }

    a.portalArmed = false;
    // Count wraps for meteor-gun shots only (gun = 1 then cull).
    if (a.playerShot) a.edgeWraps = (a.edgeWraps | 0) + 1;
    teleportAsteroidToEdge(room, a, oppositeEdgeFromExit(a));
  }
  clearGodmodeSpawnZones(room);
  rebuildAsteroidSpatialHash(room);
  if (room.matchLive) {
    updateBullets(room);
    updateFixDrones(room);
    updatePickups(room);
    if (room.practice && !room.shopOpen) updateEnemies(room);
    tickWorldPoseSnap(room);
  } else if (room.bullets.length) {
    // Pre-start: fly around only — clear any stray shots.
    for (const b of room.bullets) {
      roomBroadcast(room, { t: 'bd', id: b.id });
    }
    room.bullets.length = 0;
  }
  resolvePlayerShotAsteroidBounces(room);
  resolvePlayerShotEnemyHits(room);
  resolvePlayerAsteroidCollisions(room);
  resolvePlayerGunshipCollisions(room);
  resolvePlayerPlayerCollisions(room);
  tickSoloWaves(room);
  pushPoseHistory(room);
  sendAsteroidGhostDumps(room);
}

/** Per-client authoritative asteroid poses for sv_send_asteroids ghosts. */
function sendAsteroidGhostDumps(room) {
  for (const ws of room.clients) {
    const every = ws.getAsteroidsEvery | 0;
    if (every <= 0 || ws.readyState !== 1) continue;
    const period = Math.max(10, every);
    if (room.tick % period !== 0) continue;
    const st = Date.now();
    const a = room.asteroids.map(ast => [
      ast.aid, ast.x, ast.y, ast.vx, ast.vy, ast.angle, ast.spin, ast.r
    ]);
    send(ws, { t: 'ag', tick: room.tick, st, a });
  }
}

function packSnap(room) {
  const ps = [];
  for (const p of room.players.values()) {
    ps.push([
      p.id, p.x, p.y, p.vx, p.vy, p.angle, p.hp, p.lastSeq,
      p.av || 0, p.stunned ? 1 : 0, p.godLeft > 0 ? (p.godLeft | 0) : 0
    ]);
  }
  return { t: 'snap', tick: room.tick, st: Date.now(), players: ps };
}

/**
 * Compact binary snapshot (hot path). Layout:
 * u8 type=1 | u8 count | u32 tick | f64 st |
 * per player: u16 id | f32 x y vx vy angle av | u16 hp | u32 lastSeq |
 *   u8 stunned | u8 godLeft | u8 ammo | u8 reloadLeft | u16 pad (was coinPoolPickup)
 */
function packSnapBinary(room) {
  const players = [...room.players.values()];
  const stride = 38;
  const buf = Buffer.allocUnsafe(14 + players.length * stride);
  let o = 0;
  buf.writeUInt8(BIN_SNAP, o); o += 1;
  buf.writeUInt8(players.length, o); o += 1;
  buf.writeUInt32LE(room.tick >>> 0, o); o += 4;
  buf.writeDoubleLE(Date.now(), o); o += 8;
  for (const p of players) {
    buf.writeUInt16LE(p.id & 0xffff, o); o += 2;
    buf.writeFloatLE(p.x, o); o += 4;
    buf.writeFloatLE(p.y, o); o += 4;
    buf.writeFloatLE(p.vx, o); o += 4;
    buf.writeFloatLE(p.vy, o); o += 4;
    buf.writeFloatLE(p.angle, o); o += 4;
    buf.writeFloatLE(p.av || 0, o); o += 4;
    buf.writeUInt16LE(Math.max(0, Math.min(65535, p.hp | 0)), o); o += 2;
    buf.writeUInt32LE((p.lastSeq >>> 0), o); o += 4;
    buf.writeUInt8(p.stunned ? 1 : 0, o); o += 1;
    buf.writeUInt8(Math.max(0, Math.min(255, p.godLeft | 0)), o); o += 1;
    buf.writeUInt8(Math.max(0, Math.min(255, p.shootAmmo | 0)), o); o += 1;
    buf.writeUInt8(Math.max(0, Math.min(255, p.reloadLeft | 0)), o); o += 1;
    buf.writeUInt16LE(Math.max(0, Math.min(65535, p.coinPoolPickup | 0)), o); o += 2;
  }
  return buf;
}

function queueStatusFor(kind) {
  if (kind === 'coop') {
    return { t: 'queued', mode: 'coop', waiting: coopQueue.length, need: PLAYERS_PER_MATCH };
  }
  if (kind === 'campaignCoop') {
    return {
      t: 'queued',
      mode: 'campaignCoop',
      waiting: campaignCoopQueue.length,
      need: PLAYERS_PER_MATCH
    };
  }
  return { t: 'queued', mode: 'pvp', waiting: matchQueue.length, need: PLAYERS_PER_MATCH };
}

function queueStatus() {
  return queueStatusFor('pvp');
}

function notifyQueueKind(kind) {
  const q = kind === 'coop' ? coopQueue
    : kind === 'campaignCoop' ? campaignCoopQueue
    : matchQueue;
  const msg = queueStatusFor(kind === 'campaignCoop' ? 'campaignCoop' : kind === 'coop' ? 'coop' : 'pvp');
  for (const ws of q) send(ws, msg);
  broadcastPresence();
}

function notifyQueue() {
  notifyQueueKind('pvp');
}

function removeFromQueue(ws) {
  let changed = false;
  const i = matchQueue.indexOf(ws);
  if (i >= 0) {
    matchQueue.splice(i, 1);
    changed = true;
    notifyQueueKind('pvp');
  }
  const j = coopQueue.indexOf(ws);
  if (j >= 0) {
    coopQueue.splice(j, 1);
    changed = true;
    notifyQueueKind('coop');
  }
  const k = campaignCoopQueue.indexOf(ws);
  if (k >= 0) {
    campaignCoopQueue.splice(k, 1);
    changed = true;
    notifyQueueKind('campaignCoop');
  }
  if (ws.state === 'queued' || ws.state === 'practice') ws.state = 'lobby';
  if (changed) ws.queueMode = null;
  return changed;
}

function captureWaitingSnapshot(ws) {
  const room = ws.room;
  if (!room || !room.practice || room.coop || room.soloOnly) return null;
  const p = room.players.get(ws.playerId);
  if (!p) return null;
  ensureSoloBossPlan(room);
  const snap = {
    v: 1,
    wave: room.wave | 0,
    waveClearLeft: room.waveClearLeft | 0,
    shopOpen: !!room.shopOpen,
    shopWave: room.shopWave | 0,
    bossPlan: room.bossPlan || null,
    player: {
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, angle: p.angle, av: p.av || 0,
      hp: p.hp, lives: p.lives | 0, coins: p.coins | 0,
      coinsCollected: p.coinsCollected | 0,
      weapon: p.weapon || 'default',
      weaponLevels: Object.assign({}, p.weaponLevels || freshWeaponLevels()),
      unlockedWeapons: Object.assign({}, ensureUnlockedWeapons(p)),
      powerups: Object.assign({}, p.powerups || freshPowerups()),
      shieldHp: playerHasPowerup(p, 'shield') ? Math.max(0, +(p.shieldHp != null ? p.shieldHp : SHIELD_MAX_HP)) : 0,
      shootAmmo: p.shootAmmo | 0,
      shootCd: p.shootCd | 0,
      reloadLeft: p.reloadLeft | 0
    },
    asteroids: room.asteroids.map((a) => ({
      aid: a.aid,
      size: a.size || (a.big ? 'big' : 'small'),
      x: a.x, y: a.y, vx: a.vx, vy: a.vy,
      angle: a.angle || 0, spin: a.spin || 0,
      r: a.r, hp: a.hp, maxHp: a.maxHp,
      shapeId: a.shapeId,
      special: a.special || null,
      centerRock: !!a.centerRock,
      ghost: !!a.ghost,
      edgeWraps: a.edgeWraps | 0,
      edgeWrapMax: asteroidEdgeWrapMax(a),
      bornAt: asteroidBornAt(a),
      playerShot: !!a.playerShot,
      ownerId: a.ownerId | 0
    })),
    enemies: (room.enemies || []).map((e) => ({
      id: e.id, kind: e.kind, weapon: e.weapon || '',
      move: enemyMoveType(e),
      x: e.x, y: e.y, vx: e.vx, vy: e.vy, angle: e.angle,
      dir: e.dir != null ? e.dir : e.angle,
      spawnX: e.spawnX != null ? e.spawnX : e.x,
      spawnY: e.spawnY != null ? e.spawnY : e.y,
      spawnSt: e.spawnSt || Date.now(),
      hp: e.hp, r: e.r, tx: e.tx, ty: e.ty,
      enteredPlay: !!e.enteredPlay,
      queued: !!e.queued, appearLeft: e.appearLeft | 0,
      fireCd: e.fireCd | 0, shootAmmo: e.shootAmmo | 0,
      shootCd: e.shootCd | 0, reloadLeft: e.reloadLeft | 0,
      bursting: !!e.bursting, railChargeLeft: e.railChargeLeft | 0,
      wormPhase: e.wormPhase | 0, wormAimLeft: e.wormAimLeft | 0,
      wormAtk: e.wormAtk | 0,
      spinAng: e.spinAng || 0,
      speed: enemySpeed(e)
    })),
    pickups: room.pickups.map((u) => ({
      id: u.id, x: u.x, y: u.y, vx: u.vx, vy: u.vy, r: u.r,
      weapon: u.weapon || null, powerup: u.powerup || null, kind: u.kind || null,
      bounces: u.bounces | 0,
      angle: u.angle || 0, spin: u.spin || 0
    })),
    nextBulletId: room.nextBulletId | 0,
    nextPickupId: room.nextPickupId | 0,
    nextEnemyId: room.nextEnemyId | 0
  };
  ws.soloSnapshot = snap;
  if (ws.readyState === 1) send(ws, { t: 'soloSnap', snap });
  return snap;
}

function applySnapshotToRoom(room, p, snap) {
  if (!snap || !snap.player) return;
  const sp = snap.player;
  p.x = sp.x; p.y = sp.y; p.vx = sp.vx || 0; p.vy = sp.vy || 0;
  p.angle = sp.angle || 0; p.av = sp.av || 0;
  p.hp = sp.hp != null ? sp.hp : SOLO_MAX_HP;
  p.lives = sp.lives != null ? sp.lives : SOLO_LIVES;
  p.coins = sp.coins | 0;
  p.coinsCollected = sp.coinsCollected | 0;
  p.weapon = sp.weapon || 'default';
  if (WEAPON_SLOTS.indexOf(p.weapon) < 0) p.weapon = 'default';
  p.weaponLevels = Object.assign(freshWeaponLevels(), sp.weaponLevels || {});
  p.unlockedWeapons = Object.assign(freshUnlockedWeapons(), sp.unlockedWeapons || {});
  if (!p.weapon) p.weapon = 'default';
  ownOnlyWeapon(p, p.weapon, getWeaponLevel(p, p.weapon));
  p.powerups = Object.assign(freshPowerups(), sp.powerups || {});
  delete p.powerups.shieldHp;
  if (p.powerups.shield) {
    p.shieldHp = sp.shieldHp != null ? Math.max(0, Math.min(SHIELD_MAX_HP, +sp.shieldHp)) : SHIELD_MAX_HP;
  } else {
    p.shieldHp = 0;
  }
  p.shootAmmo = sp.shootAmmo | 0;
  p.shootCd = sp.shootCd | 0;
  p.reloadLeft = sp.reloadLeft | 0;
  p.bursting = false;
  p.railChargeLeft = 0;
  p.godLeft = GODMODE_TICKS;

  room.wave = Math.max(1, snap.wave | 0);
  room.waveClearLeft = snap.waveClearLeft | 0;
  room.shopOpen = false;
  room.shopWave = 0;
  room.shopDoneIds = new Set();
  if (snap.bossPlan && typeof snap.bossPlan === 'object') {
    room.bossPlan = snap.bossPlan;
  } else {
    ensureSoloBossPlan(room);
  }
  room.nextBulletId = Math.max(1, snap.nextBulletId | 0);
  room.nextPickupId = Math.max(1, snap.nextPickupId | 0);
  room.nextEnemyId = Math.max(1, snap.nextEnemyId | 0);
  room.bullets = [];
  room.pendingBigSpawns = [];

  clearAsteroidsList(room);
  for (const row of snap.asteroids || []) {
    const a = makeAsteroid({
      size: row.size || 'small',
      x: row.x, y: row.y, vx: row.vx, vy: row.vy,
      allowSpecial: false
    });
    if (row.aid != null) a.aid = row.aid;
    if (row.angle != null) a.angle = row.angle;
    if (row.spin != null) a.spin = row.spin;
    if (row.r != null) a.r = row.r;
    if (row.hp != null) a.hp = row.hp;
    if (row.maxHp != null) a.maxHp = row.maxHp;
    if (row.shapeId != null) a.shapeId = row.shapeId | 0;
    else a.shapeId = shapeIdFromPos(a.x, a.y);
    if (row.special) a.special = row.special;
    if (row.centerRock) a.centerRock = true;
    if (row.ghost) a.ghost = true;
    a.edgeWraps = row.edgeWraps | 0;
    a.edgeWrapMax = row.edgeWrapMax != null ? Math.max(0, row.edgeWrapMax | 0) : 1;
    a.bornAt = row.bornAt != null ? row.bornAt : Date.now();
    a.playerShot = !!row.playerShot;
    a.ownerId = row.ownerId | 0;
    refreshAsteroidCollisionPts(a);
    resyncAsteroidSpawn(a);
    // Keep create-time across snapshot resync (spawnSt is for net dead-reckon).
    a.bornAt = row.bornAt != null ? row.bornAt : a.bornAt;
    pushAsteroid(room, a);
  }

  room.enemies = [];
  for (const row of snap.enemies || []) {
    const e = makeEnemy(row.kind || 'common', room.wave, row.weapon || '');
    e.id = row.id | 0;
    e.x = row.x; e.y = row.y; e.vx = row.vx || 0; e.vy = row.vy || 0;
    e.angle = row.angle || 0;
    e.spawnX = row.spawnX != null ? row.spawnX : row.x;
    e.spawnY = row.spawnY != null ? row.spawnY : row.y;
    e.spawnSt = row.spawnSt || Date.now();
    e.hp = row.hp != null ? row.hp : e.hp;
    e.tx = row.tx; e.ty = row.ty;
    e.move = row.move === ENEMY_MOVE_DESTINATION ? ENEMY_MOVE_DESTINATION : ENEMY_MOVE_DESTINATION_SMOOTH;
    e.dir = row.dir != null ? +row.dir : e.angle;
    e.enteredPlay = row.enteredPlay != null ? !!row.enteredPlay : true;
    if (row.speed != null && Number(row.speed) > 0) e.speed = +row.speed;
    e.queued = !!row.queued;
    e.appearLeft = row.appearLeft | 0;
    e.fireCd = row.fireCd | 0;
    e.shootAmmo = row.shootAmmo | 0;
    e.shootCd = row.shootCd | 0;
    e.reloadLeft = row.reloadLeft | 0;
    e.bursting = !!row.bursting;
    e.railChargeLeft = row.railChargeLeft | 0;
    e.wormPhase = row.wormPhase | 0;
    e.wormAimLeft = row.wormAimLeft | 0;
    e.wormAtk = row.wormAtk | 0;
    e.spinAng = row.spinAng != null ? +row.spinAng : 0;
    room.enemies.push(e);
  }

  room.pickups = [];
  // Pickups restored loosely — skip complex kinds if make fails.
  for (const row of snap.pickups || []) {
    try {
      const u = {
        id: row.id | 0,
        x: row.x, y: row.y, vx: row.vx || 0, vy: row.vy || 0,
        r: row.r || 10,
        weapon: row.weapon || null,
        powerup: row.powerup || null,
        kind: row.kind || null,
        angle: row.angle || 0,
        spin: row.spin || 0,
        bounces: row.bounces | 0,
        spawnX: row.x, spawnY: row.y, spawnAngle: row.angle || 0, spawnSt: Date.now()
      };
      room.pickups.push(u);
    } catch (_) {}
  }
}

function leaveRoomSavingSnapshot(ws) {
  if (ws.room && ws.room.practice && !ws.room.coop && !ws.room.soloOnly) {
    captureWaitingSnapshot(ws);
  }
  leaveRoom(ws);
}

function startMatch(members) {
  for (const ws of members) {
    leaveRoomSavingSnapshot(ws);
  }
  const room = createRoom({ deferStart: true });
  room.practice = false;
  for (const ws of members) {
    const id = nextPlayerId++;
    const p = spawnPlayer(id, ws.displayName, {
      playerColor: ws.playerColor,
      shootColor: ws.shootColor,
      thrustColor: ws.thrustColor,
      shipId: ws.shipId
    }, room);
    p.accountKey = ws.accountKey || null;
    p.coins = PVP_START_COINS;
    p.shopTimeLeft = PVP_SHOP_BUDGET_TICKS;
    room.players.set(id, p);
    room.clients.add(ws);
    ws.room = room;
    ws.playerId = id;
    ws.state = 'playing';
    ws.queueMode = null;
  }
  initPauseBudgets(room);
  for (const ws of members) {
    const p = room.players.get(ws.playerId);
    if (p) sendWelcome(ws, room, p, { waitingReady: true });
  }
  roomBroadcast(room, {
    t: 'roster',
    room: room.id,
    tick: room.tick,
    st: Date.now(),
    players: packSnap(room).players,
    scores: packScoreboard(room),
    names: packRosterNames(room),
    colors: packPlayerColors(room),
    scoreToWin: SCORE_TO_WIN
  });
  console.log(`Room ${room.id} started with ${members.length} players — waiting ready (${rooms.size} active)`);
  broadcastPresence();
}

/** Solo queue wait OR dedicated solo / continue. */
function startPractice(ws, queueKind, opts) {
  opts = opts || {};
  if (ws.room) leaveRoom(ws);
  const room = createRoom({ deferStart: true });
  room.practice = true;
  room.matchLive = true;
  room.coop = false;
  room.soloOnly = !!opts.soloOnly;
  room.queueKind = queueKind || null;
  room.waveClearLeft = 0;
  room.pendingBigSpawns = [];
  room.enemies = [];
  room.nextEnemyId = 1;
  room.shopDoneIds = new Set();
  // Boss roster for waves 10/20/30 — fixed for the whole match (snap may override).
  if (!opts.snap) room.bossPlan = rollSoloBossPlan();

  const id = nextPlayerId++;
  const p = spawnPlayer(id, ws.displayName, {
    playerColor: ws.playerColor,
    shootColor: ws.shootColor,
    thrustColor: ws.thrustColor,
    shipId: ws.shipId
  }, room);
  p.lives = SOLO_LIVES;
  p.hp = SOLO_MAX_HP;
  p.unlockedWeapons = freshUnlockedWeapons();
  room.players.set(id, p);
  room.clients.add(ws);
  ws.room = room;
  ws.playerId = id;
  ws.state = 'practice';

  if (opts.snap) {
    applySnapshotToRoom(room, p, opts.snap);
    if (room.shopOpen) {
      // Don't resume mid-shop — close and keep wave field.
      room.shopOpen = false;
      room.shopWave = 0;
    }
  } else {
    room.wave = 1;
    setAsteroidsList(room, createSoloWaveAsteroids(1));
    spawnSoloWaveEnemies(room, 1);
  }

  initPauseBudgets(room);

  const waiting = queueKind === 'coop' ? coopQueue.length
    : queueKind === 'pvp' ? matchQueue.length : 0;
  sendWelcome(ws, room, p, {
    waiting,
    need: queueKind ? PLAYERS_PER_MATCH : 1,
    wave: room.wave,
    waveCounts: soloWaveCounts(room.wave),
    lives: p.lives,
    soloOnly: room.soloOnly ? 1 : 0,
    // Never send mode:'coop'/'pvp' here — that flags a real online room on the client.
    // Wait-waves are solo practice while matchmaking; real coop sets coop:1 in startCoop.
    mode: room.soloOnly ? 'solo' : (queueKind ? 'wait' : 'solo'),
    waitFor: queueKind || null,
    coins: p.coins | 0,
    score: p.coinsCollected | 0,
    levels: p.weaponLevels,
    unlocked: p.unlockedWeapons
  });
  notifyPlayerCoins(room, p);
  notifyPlayerWeapon(room, p, false);
  notifyPowerups(room, p);
  // sv_demo 2: record coop-queue / pvp-queue wait waves (not dedicated solo).
  if ((svDemo | 0) >= 2) {
    demoRecorder.start(room, { tps: TPS, w: W, h: H });
    seedDemoRecording(room);
  }
  console.log(
    `Wave room ${room.id} for p${id} wave ${room.wave} mode=${room.soloOnly ? 'solo' : (queueKind || 'wait')} (${rooms.size} active)`
  );
  broadcastPresence();
}

function startCoop(members) {
  for (const ws of members) {
    leaveRoomSavingSnapshot(ws);
  }
  const room = createRoom({ deferStart: true });
  room.practice = true;
  room.coop = true;
  room.soloOnly = false;
  room.queueKind = null;
  room.matchLive = true;
  room.wave = 1;
  room.waveClearLeft = 0;
  room.pendingBigSpawns = [];
  room.bossPlan = rollSoloBossPlan();
  setAsteroidsList(room, createSoloWaveAsteroids(1));
  room.enemies = [];
  room.nextEnemyId = 1;
  room.shopDoneIds = new Set();
  spawnSoloWaveEnemies(room, 1);

  for (let i = 0; i < members.length; i++) {
    const ws = members[i];
    const id = nextPlayerId++;
    const p = spawnPlayer(id, ws.displayName, {
      playerColor: ws.playerColor,
      shootColor: ws.shootColor,
      thrustColor: ws.thrustColor,
      shipId: ws.shipId
    }, room);
    p.lives = SOLO_LIVES;
    p.hp = SOLO_MAX_HP;
    p.unlockedWeapons = freshUnlockedWeapons();
    // Shared center zone (slight split from spawn pose).
    const pose = playerSpawnPose(id, room);
    p.x = pose.x;
    p.y = pose.y;
    p.angle = pose.angle;
    p.accountKey = ws.accountKey || null;
    room.players.set(id, p);
    room.clients.add(ws);
    ws.room = room;
    ws.playerId = id;
    ws.state = 'practice';
    ws.queueMode = null;
  }
  initPauseBudgets(room);
  for (const ws of members) {
    const p = room.players.get(ws.playerId);
    if (!p) continue;
    sendWelcome(ws, room, p, {
      waiting: 0,
      need: 2,
      wave: room.wave,
      waveCounts: soloWaveCounts(room.wave),
      lives: p.lives,
      coop: 1,
      mode: 'coop'
    });
  }
  broadcastSoloWave(room);
  roomBroadcast(room, {
    t: 'roster',
    room: room.id,
    tick: room.tick,
    st: Date.now(),
    players: packSnap(room).players,
    scores: packScoreboard(room),
    names: packRosterNames(room),
    colors: packPlayerColors(room),
    scoreToWin: SCORE_TO_WIN
  });
  if ((svDemo | 0) >= 2) {
    demoRecorder.start(room, { tps: TPS, w: W, h: H });
    seedDemoRecording(room);
  }
  console.log(`Coop wave room ${room.id} with ${members.length} players wave ${room.wave}`);
  broadcastPresence();
}

function tryMatchmake() {
  while (matchQueue.length >= PLAYERS_PER_MATCH) {
    const members = matchQueue.splice(0, PLAYERS_PER_MATCH);
    notifyQueueKind('pvp');
    startMatch(members);
  }
}

function tryMatchmakeCoop() {
  while (coopQueue.length >= PLAYERS_PER_MATCH) {
    const members = coopQueue.splice(0, PLAYERS_PER_MATCH);
    notifyQueueKind('coop');
    startCoop(members);
  }
}

function tryMatchmakeCampaignCoop() {
  while (campaignCoopQueue.length >= PLAYERS_PER_MATCH) {
    const members = campaignCoopQueue.splice(0, PLAYERS_PER_MATCH);
    notifyQueueKind('campaignCoop');
    startCampaignCoop(members);
  }
}

function enqueue(ws, mode) {
  if (mode === 'campaignCoop') {
    if (ws.state === 'playing') return;
    removeFromQueue(ws);
    if (ws.room) leaveRoom(ws);
    ws.queueMode = 'campaignCoop';
    ws.state = 'queued';
    campaignCoopQueue.push(ws);
    send(ws, queueStatusFor('campaignCoop'));
    notifyQueueKind('campaignCoop');
    tryMatchmakeCampaignCoop();
    return;
  }
  const m = mode === 'coop' ? 'coop' : 'pvp';
  if (ws.state === 'playing') return;
  if (tryStartWithTeam(ws, m)) return;
  removeFromQueue(ws);
  if (ws.room) leaveRoom(ws);
  ws.queueMode = m;
  ws.state = 'queued';
  if (m === 'coop') {
    coopQueue.push(ws);
    send(ws, queueStatusFor('coop'));
    notifyQueueKind('coop');
    tryMatchmakeCoop();
    // Wait-waves run on the client's local host; server only matchmakes.
  } else {
    matchQueue.push(ws);
    send(ws, queueStatusFor('pvp'));
    notifyQueueKind('pvp');
    tryMatchmake();
    // Wait-waves run on the client's local host; server only matchmakes.
  }
}

/** If both teammates are free, start PvP/coop together (skip queue). */
function tryStartWithTeam(ws, mode) {
  const mate = ws.teamMate;
  if (!mate || mate.readyState !== 1) return false;
  if (!ws.registered || !mate.registered) return false;
  if (mate.state === 'playing' && mate.room && !mate.room.practice) return false;
  if (mate.state === 'practice' && mate.room && mate.room.coop) return false;
  removeFromQueue(ws);
  removeFromQueue(mate);
  if (ws.room) leaveRoom(ws);
  if (mate.room) leaveRoom(mate);
  if (mode === 'coop') startCoop([ws, mate]);
  else startMatch([ws, mate]);
  return true;
}

function startSoloMode(ws, snap) {
  removeFromQueue(ws);
  if (ws.room) leaveRoom(ws);
  ws.queueMode = null;
  ws.waitKind = null;
  startPractice(ws, null, { soloOnly: true, snap: snap || null });
}

function startCampaignSolo(ws) {
  removeFromQueue(ws);
  if (ws.room) leaveRoom(ws);
  ws.queueMode = null;
  ws.waitKind = null;
  const room = createRoom({ deferStart: true });
  room.practice = true;
  room.matchLive = true;
  room.coop = false;
  room.soloOnly = true;
  room.campaign = true;
  room.queueKind = null;
  room.wave = 1;
  room.waveClearLeft = 0;
  room.pendingBigSpawns = [];
  room.enemies = [];
  room.nextEnemyId = 1;
  room.shopDoneIds = new Set();
  room.campaignStars = rollCampaignStars();
  room.campaignStarId = 0;
  room.campaignMapOpen = false;

  const id = nextPlayerId++;
  const p = spawnPlayer(id, ws.displayName, {
    playerColor: ws.playerColor,
    shootColor: ws.shootColor,
    thrustColor: ws.thrustColor,
    shipId: ws.shipId
  }, room);
  p.lives = SOLO_LIVES;
  p.hp = SOLO_MAX_HP;
  p.unlockedWeapons = freshUnlockedWeapons();
  p.accountKey = ws.accountKey || null;
  room.players.set(id, p);
  room.clients.add(ws);
  ws.room = room;
  ws.playerId = id;
  ws.state = 'practice';

  beginCampaignStage(room);
  initPauseBudgets(room);
  sendWelcome(ws, room, p, {
    waiting: 0,
    need: 1,
    wave: room.wave,
    lives: p.lives,
    soloOnly: 1,
    campaign: 1,
    mode: 'campaign',
    at: room.campaignStarId | 0
  });
  broadcastPresence();
  console.log(`Campaign solo room ${room.id}`);
}

function startCampaignCoop(members) {
  for (const ws of members) {
    leaveRoomSavingSnapshot(ws);
  }
  const room = createRoom({ deferStart: true });
  room.practice = true;
  room.coop = true;
  room.soloOnly = false;
  room.campaign = true;
  room.queueKind = null;
  room.matchLive = true;
  room.wave = 1;
  room.waveClearLeft = 0;
  room.pendingBigSpawns = [];
  room.enemies = [];
  room.nextEnemyId = 1;
  room.shopDoneIds = new Set();
  room.campaignStars = rollCampaignStars();
  room.campaignStarId = 0;
  room.campaignMapOpen = false;

  for (let i = 0; i < members.length; i++) {
    const ws = members[i];
    const id = nextPlayerId++;
    const p = spawnPlayer(id, ws.displayName, {
      playerColor: ws.playerColor,
      shootColor: ws.shootColor,
      thrustColor: ws.thrustColor,
      shipId: ws.shipId
    }, room);
    p.lives = SOLO_LIVES;
    p.hp = SOLO_MAX_HP;
    p.unlockedWeapons = freshUnlockedWeapons();
    const pose = playerSpawnPose(id, room);
    p.x = pose.x;
    p.y = pose.y;
    p.angle = pose.angle;
    p.accountKey = ws.accountKey || null;
    room.players.set(id, p);
    room.clients.add(ws);
    ws.room = room;
    ws.playerId = id;
    ws.state = 'practice';
    ws.queueMode = null;
  }
  beginCampaignStage(room);
  initPauseBudgets(room);
  for (const ws of members) {
    const p = room.players.get(ws.playerId);
    if (!p) continue;
    sendWelcome(ws, room, p, {
      waiting: 0,
      need: 2,
      wave: room.wave,
      lives: p.lives,
      coop: 1,
      campaign: 1,
      mode: 'campaign',
      at: room.campaignStarId | 0
    });
  }
  roomBroadcast(room, {
    t: 'roster',
    room: room.id,
    tick: room.tick,
    st: Date.now(),
    players: packSnap(room).players,
    scores: packScoreboard(room),
    names: packRosterNames(room),
    colors: packPlayerColors(room),
    scoreToWin: SCORE_TO_WIN
  });
  console.log(`Campaign coop room ${room.id} with ${members.length} players`);
  broadcastPresence();
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  // Keep player entity if held for disconnect rejoin.
  const hold = ws.playerId != null ? room.pauseHold.get(ws.playerId) : null;
  if (!(hold && hold.disconnected) && ws.playerId != null) {
    room.players.delete(ws.playerId);
    room.pauseHold.delete(ws.playerId);
    room.pauseBudget.delete(ws.playerId);
    room.pauseReady.delete(ws.playerId);
  }
  ws.room = null;
  ws.playerId = null;
  if (ws.state === 'playing' || ws.state === 'practice') ws.state = 'lobby';
  const livingClients = room.clients.size;
  const held = [...room.pauseHold.values()].some(h => h.disconnected);
  if (livingClients === 0 && !held) destroyRoom(room);
  else if (livingClients === 0 && held) {
    // Keep room alive for rejoin until budget expires.
  } else if (room.shopOpen) {
    // Partner left mid-shop — start wave once remaining humans have continued.
    tryFinishSoloShop(room);
  }
  broadcastPresence();
}

function sendWelcome(ws, room, p, extra) {
  send(ws, Object.assign({
    t: 'welcome',
    id: p.id,
    room: room.id,
    tick: room.tick,
    st: Date.now(),
    practice: !!room.practice,
    coins: p.coins | 0,
    shopTimeLeft: p.shopTimeLeft | 0,
    you: [p.id, p.x, p.y, p.vx, p.vy, p.angle, p.hp, p.lastSeq, p.av || 0, p.stunned ? 1 : 0, p.godLeft > 0 ? (p.godLeft | 0) : 0],
    scores: packScoreboard(room),
    names: packRosterNames(room),
    colors: packPlayerColors(room),
    scoreToWin: SCORE_TO_WIN,
    svDynamicPrediction: svDynamicPrediction,
    players: packSnap(room).players,
    bullets: room.bullets.map(packBullet),
    asteroids: room.asteroids.map(packAsteroid),
    pickups: room.pickups.map(packPickup),
    enemies: (room.enemies || []).filter(enemyIsSpawned).map(packEnemy),
    powerupsByPlayer: (() => {
      const m = {};
      for (const pl of room.players.values()) {
        m[pl.id] = packPowerupsNet(pl);
      }
      return m;
    })()
  }, extra || {}));
}

function humanPlayers(room) {
  return [...room.players.values()].filter(p => !p.bot);
}

function packPvpShopBudgets(room) {
  const out = {};
  for (const p of room.players.values()) {
    if (p.bot) continue;
    out[p.id] = Math.max(0, p.shopTimeLeft | 0);
  }
  return out;
}

function roomPreRoundFrozen(room) {
  if (!room || room.practice) return false;
  if ((room.preRoundCd | 0) > 0) return true;
  return !!(room.pvpShopOpen && room.pvpShopOpen.size > 0);
}

function broadcastPreRound(room) {
  if (!room) return;
  roomBroadcast(room, {
    t: 'preRoundCd',
    n: room.preRoundCd | 0,
    shop: (room.preRoundCd | 0) > 0 || (room.pvpShopOpen && room.pvpShopOpen.size > 0) ? 1 : 0,
    open: room.pvpShopOpen ? [...room.pvpShopOpen] : [],
    budgets: packPvpShopBudgets(room)
  });
}

/** Start / restart 3-2-1 (paused while any PvP shop is open). */
function startPreRoundCountdown(room) {
  if (!room || room.practice) return;
  room.preRoundCd = PRE_ROUND_COUNTDOWN_SEC;
  room.preRoundAcc = 0;
  broadcastPreRound(room);
}

function finishPreRoundCountdown(room) {
  if (!room) return;
  room.preRoundCd = 0;
  room.preRoundAcc = 0;
  if (room.pvpShopOpen && room.pvpShopOpen.size) {
    for (const id of [...room.pvpShopOpen]) closePvpShop(room, id, true);
  }
  broadcastPreRound(room);
  if (!room.matchLive) beginMatchLive(room);
}

function tickPreRoundCountdown(room) {
  if (!room || room.practice) return;
  if ((room.preRoundCd | 0) <= 0) return;
  if (room.pvpShopOpen && room.pvpShopOpen.size > 0) return; // paused while shopping
  room.preRoundAcc = (room.preRoundAcc | 0) + 1;
  if (room.preRoundAcc < TPS) return;
  room.preRoundAcc = 0;
  room.preRoundCd = Math.max(0, (room.preRoundCd | 0) - 1);
  broadcastPreRound(room);
  if ((room.preRoundCd | 0) <= 0) finishPreRoundCountdown(room);
}

function tickPvpShopTimers(room) {
  if (!room || room.practice || !room.pvpShopOpen || !room.pvpShopOpen.size) return;
  for (const id of [...room.pvpShopOpen]) {
    const p = room.players.get(id);
    if (!p) {
      room.pvpShopOpen.delete(id);
      continue;
    }
    p.shopTimeLeft = Math.max(0, (p.shopTimeLeft | 0) - 1);
    if ((p.shopTimeLeft | 0) <= 0) closePvpShop(room, id, true);
  }
  // ~4 Hz budget sync while shops open.
  if ((room.tick % Math.max(1, (TPS / 4) | 0)) === 0) broadcastPreRound(room);
}

function openPvpShop(room, playerId) {
  if (!room || room.practice) return { ok: 0, err: 'mode' };
  if ((room.preRoundCd | 0) <= 0 && !(room.pvpShopOpen && room.pvpShopOpen.size)) {
    return { ok: 0, err: 'closed' };
  }
  const p = room.players.get(playerId);
  if (!p || p.bot || (p.hp | 0) <= 0) return { ok: 0, err: 'player' };
  if ((p.shopTimeLeft | 0) <= 0) return { ok: 0, err: 'time' };
  if (!room.pvpShopOpen) room.pvpShopOpen = new Set();
  if (room.pvpShopOpen.has(playerId)) return { ok: 1 };
  room.pvpShopOpen.add(playerId);
  // Pause + reset countdown until everyone closes.
  room.preRoundCd = PRE_ROUND_COUNTDOWN_SEC;
  room.preRoundAcc = 0;
  if (p.weapon) ownOnlyWeapon(p, p.weapon, getWeaponLevel(p, p.weapon));
  for (const ws of room.clients) {
    if (ws.playerId === p.id && ws.readyState === 1) {
      send(ws, Object.assign(packShopState(room, p), {
        pvp: 1,
        shopTimeLeft: p.shopTimeLeft | 0
      }));
    }
  }
  broadcastPreRound(room);
  return { ok: 1 };
}

function closePvpShop(room, playerId, forced) {
  if (!room || !room.pvpShopOpen) return;
  if (!room.pvpShopOpen.has(playerId)) return;
  room.pvpShopOpen.delete(playerId);
  for (const ws of room.clients) {
    if (ws.playerId === playerId && ws.readyState === 1) {
      send(ws, { t: 'shopClose', forced: forced ? 1 : 0 });
    }
  }
  if (room.pvpShopOpen.size === 0 && (room.preRoundCd | 0) > 0) {
    // All closed → restart full 3-2-1.
    room.preRoundCd = PRE_ROUND_COUNTDOWN_SEC;
    room.preRoundAcc = 0;
  }
  broadcastPreRound(room);
}

function beginMatchLive(room) {
  if (!room || room.matchLive || room.practice) return;
  room.matchLive = true;
  room.readyIds.clear();
  setAsteroidsList(room, createInitialAsteroids());
  if ((svDemo | 0) >= 1) {
    demoRecorder.start(room, { tps: TPS, w: W, h: H });
    seedDemoRecording(room);
  }
  roomBroadcast(room, {
    t: 'go',
    tick: room.tick,
    st: Date.now(),
    asteroids: room.asteroids.map(packAsteroid),
    players: packSnap(room).players,
    scores: packScoreboard(room),
    names: packRosterNames(room)
  });
  console.log(`Room ${room.id} match live (${room.asteroids.length} asteroids)`);
}

function markPlayerReady(room, playerId) {
  if (!room || room.matchLive || room.practice) return;
  if ((room.preRoundCd | 0) > 0) return;
  if (playerId == null || !room.players.has(playerId)) return;
  const p = room.players.get(playerId);
  if (!p || p.bot) return;
  room.readyIds.add(playerId);
  roomBroadcast(room, {
    t: 'readyState',
    ready: [...room.readyIds],
    need: humanPlayers(room).length
  });
  const humans = humanPlayers(room);
  if (humans.length > 0 && humans.every(h => room.readyIds.has(h.id))) {
    startPreRoundCountdown(room);
  }
}
