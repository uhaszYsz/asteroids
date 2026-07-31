/** @file server/ws.js — loaded into shared server scope (do not require() alone). */
wss.on('connection', (ws) => {
  ws.state = 'lobby';
  ws.room = null;
  ws.playerId = null;
  ws.rttMs = 0;
  ws.cmdDelayTicks = 1;
  ws.getAsteroidsEvery = 0;
  ws.isAdmin = false;
  initClientLimits(ws);
  initGuestSession(ws);
  send(ws, { t: 'lobby', st: Date.now(), svDynamicPrediction: svDynamicPrediction });
  sendSession(ws);
  send(ws, packPresence());
  sendTeamState(ws);
  sendRejoinOfferIfAny(ws);
  broadcastPresence();

  ws.on('message', (raw) => {
    // Hard cap raw flood before JSON parse cost gets bad — still parse small drops.
    if (typeof raw === 'string' && raw.length > 200000) {
      rlStrike(ws);
      return;
    }
    if (!allowSocketMessage(ws)) return;

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object' || msg.t == null) return;

    if (msg.t === 'adminLogin') {
      const pw = String(msg.pw == null ? '' : msg.pw);
      if (pw && pw === adminPassword) {
        ws.isAdmin = true;
        send(ws, { t: 'admin', ok: 1, auto: msg.auto ? 1 : 0 });
      } else {
        ws.isAdmin = false;
        send(ws, { t: 'admin', ok: 0, err: 'bad password', auto: msg.auto ? 1 : 0 });
      }
      return;
    }

    if (msg.t === 'adminLogout') {
      ws.isAdmin = false;
      send(ws, { t: 'admin', ok: 0, loggedOut: 1 });
      return;
    }

    if (msg.t === 'adminPassword') {
      if (!ws.isAdmin) {
        send(ws, { t: 'adminPw', ok: 0, err: 'not admin' });
        return;
      }
      const next = String(msg.pw == null ? '' : msg.pw);
      const repeat = String(msg.repeat == null ? '' : msg.repeat);
      if (!next || next.length < 1) {
        send(ws, { t: 'adminPw', ok: 0, err: 'empty password' });
        return;
      }
      if (next !== repeat) {
        send(ws, { t: 'adminPw', ok: 0, err: 'passwords do not match' });
        return;
      }
      saveAdminPassword(next);
      send(ws, { t: 'adminPw', ok: 1 });
      return;
    }

    if (msg.t === 'adminGive') {
      if (!ws.isAdmin) {
        send(ws, { t: 'adminGive', ok: 0, err: 'not admin' });
        return;
      }
      if (!allowAction(ws, 'adminGive', 80)) return;
      const result = handleAdminGive(ws, msg.item != null ? msg.item : msg.name);
      send(ws, Object.assign({ t: 'adminGive' }, result));
      return;
    }

    if (msg.t === 'adminSpawn') {
      if (!ws.isAdmin) {
        send(ws, { t: 'adminSpawn', ok: 0, err: 'not admin' });
        return;
      }
      if (!allowAction(ws, 'adminSpawn', 80)) return;
      const result = handleAdminSpawn(ws, msg.kind != null ? msg.kind : msg.name);
      send(ws, Object.assign({ t: 'adminSpawn' }, result));
      return;
    }

    if (msg.t === 'adminStatus' || msg.t === 'status') {
      if (!allowAction(ws, 'status', 200)) return;
      send(ws, packAdminStatus(ws));
      return;
    }

    if (msg.t === 'ping') {
      // Pings are cheap; don't burn action cooldowns. Clamp fake RTT.
      const room = ws.room;
      if (msg.rtt != null) {
        const rtt = Number(msg.rtt);
        ws.rttMs = Number.isFinite(rtt) ? Math.max(0, Math.min(2000, rtt)) : 0;
      }
      if (msg.dly != null) {
        const dly = msg.dly | 0;
        ws.cmdDelayTicks = dly < 0 ? 0 : (dly > 8 ? 8 : dly);
      }
      send(ws, {
        t: 'pong',
        ct: msg.ct,
        st: Date.now(),
        tick: room ? room.tick : 0
      });
      return;
    }

    if (msg.t === 'getAst') {
      if (!ws.isAdmin) {
        ws.getAsteroidsEvery = 0;
        return;
      }
      const every = msg.every | 0;
      ws.getAsteroidsEvery = every > 0 ? every : 0;
      return;
    }

    if (msg.t === 'predShoot') {
      if (!ws.isAdmin) return;
      const room = ws.room;
      if (!room || (ws.state !== 'playing' && ws.state !== 'practice')) return;
      const pl = room.players.get(ws.playerId);
      if (!pl || pl.bot) return;
      let steps = msg.steps != null ? (msg.steps | 0) : (pl.predictShootStep | 0);
      let angle = msg.angle != null ? (msg.angle | 0) : (pl.predictShootAngle | 0);
      if (steps < 0) steps = 0;
      if (steps > 8) steps = 8;
      if (angle < 0) angle = 0;
      if (angle > 8) angle = 8;
      pl.predictShootStep = steps;
      pl.predictShootAngle = angle;
      return;
    }

    if (msg.t === 'svPortal') {
      if (!ws.isAdmin) return;
      svPortal = (msg.v | 0) !== 0 ? 1 : 0;
      return;
    }

    if (msg.t === 'svDynamicPrediction') {
      if (!ws.isAdmin) return;
      svDynamicPrediction = clampDynamicPredictionScale(msg.v);
      broadcastSvDynamicPrediction();
      console.log(`[predict] sv_dynamic_prediction = ${svDynamicPrediction}`);
      return;
    }

    if (msg.t === 'svDemo') {
      if (!ws.isAdmin) return;
      svDemo = demoRecorder.setDemoMode(msg.v);
      send(ws, { t: 'svDemo', v: svDemo });
      console.log(`[demo] sv_demo = ${svDemo}`);
      return;
    }

    if (msg.t === 'queue') {
      if (!allowAction(ws, 'queue', 400)) return;
      if (msg.name != null && String(msg.name).trim()) {
        handleSetName(ws, msg.name);
      }
      const mode = String(msg.mode || 'pvp').toLowerCase();
      if (mode === 'solo') {
        startSoloMode(ws, null);
        return;
      }
      if (mode === 'continue') {
        const snap = msg.snap || ws.soloSnapshot;
        if (!snap) {
          send(ws, { t: 'queueErr', err: 'nosnap' });
          sendSession(ws);
          return;
        }
        ws.soloSnapshot = snap;
        startSoloMode(ws, snap);
        return;
      }
      if (mode === 'coop') {
        enqueue(ws, 'coop');
        return;
      }
      enqueue(ws, 'pvp');
      return;
    }

    if (msg.t === 'setName') {
      const result = handleSetName(ws, msg.name);
      send(ws, Object.assign({ t: 'setName' }, result, sessionFields(ws)));
      return;
    }

    if (msg.t === 'register') {
      if (!allowAction(ws, 'register', 800)) return;
      const result = handleRegister(
        ws,
        msg.pin,
        msg.pin2 != null ? msg.pin2 : msg.pinConfirm,
        msg.name
      );
      send(ws, Object.assign({ t: 'register' }, result, sessionFields(ws)));
      if (result.ok) {
        broadcastPresence();
        sendRejoinOfferIfAny(ws);
      }
      return;
    }

    if (msg.t === 'login') {
      if (!allowAction(ws, 'login', 400)) return;
      const result = handleLogin(ws, msg.name, msg.pin);
      send(ws, Object.assign({ t: 'login' }, result, sessionFields(ws)));
      if (result.ok) {
        sendTeamState(ws);
        broadcastPresence();
        sendRejoinOfferIfAny(ws);
      }
      return;
    }

    if (msg.t === 'steamLogin') {
      if (!allowAction(ws, 'steamLogin', 1000)) return;
      Promise.resolve()
        .then(() => handleSteamLogin(ws, msg.ticket, msg.identity, msg.personaName))
        .then((result) => {
          send(ws, Object.assign({ t: 'steamLogin' }, result, sessionFields(ws)));
          if (result.ok) {
            sendTeamState(ws);
            broadcastPresence();
            sendRejoinOfferIfAny(ws);
          }
        })
        .catch(() => {
          send(ws, Object.assign({ t: 'steamLogin', ok: 0, err: 'fail' }, sessionFields(ws)));
        });
      return;
    }

    if (msg.t === 'setColors') {
      const result = handleSetColors(ws, msg.playerColor, msg.shootColor);
      send(ws, Object.assign({ t: 'setColors' }, result, sessionFields(ws)));
      return;
    }

    if (msg.t === 'session') {
      sendSession(ws);
      return;
    }

    if (msg.t === 'leaderboard') {
      if (!allowAction(ws, 'leaderboard', 400)) return;
      send(ws, {
        t: 'leaderboard',
        rows: accountsDb.listLeaderboard(),
        online: packOnlineNames(),
        friends: (ws.registered && ws.accountKey) ? accountsDb.listFriends(ws.accountKey) : []
      });
      return;
    }

    if (msg.t === 'demoHistory') {
      if (!allowAction(ws, 'demoHistory', 400)) return;
      send(ws, {
        t: 'demoHistory',
        rows: demoRecorder.listSummaries(200),
        svDemo: demoRecorder.getDemoMode()
      });
      return;
    }

    if (msg.t === 'addFriend') {
      if (!ws.registered || !ws.accountKey) {
        send(ws, { t: 'addFriend', ok: 0, err: 'guest' });
        return;
      }
      const name = resolveAccountKey(msg.name);
      if (!name || name === ws.accountKey) {
        send(ws, { t: 'addFriend', ok: 0, err: 'name' });
        return;
      }
      const result = accountsDb.addFriend(ws.accountKey, name);
      send(ws, Object.assign({ t: 'addFriend', name }, result, sessionFields(ws)));
      const other = findOnlineByAccount(name);
      if (result.ok && other) sendSession(other);
      return;
    }

    if (msg.t === 'teamInvite') {
      if (!ws.registered || !ws.accountKey) {
        send(ws, { t: 'teamInvite', ok: 0, err: 'guest' });
        return;
      }
      const name = resolveAccountKey(msg.name);
      const target = findOnlineByAccount(name);
      if (!target || target === ws) {
        send(ws, { t: 'teamInvite', ok: 0, err: 'offline' });
        return;
      }
      if (ws.teamMate === target) {
        send(ws, { t: 'teamInvite', ok: 1, already: 1 });
        return;
      }
      target.pendingTeamFrom = ws.accountKey;
      send(target, { t: 'teamInvite', from: ws.accountKey });
      send(ws, { t: 'teamInvite', ok: 1, name: target.accountKey });
      return;
    }

    if (msg.t === 'teamAccept') {
      if (!ws.registered || !ws.accountKey) {
        send(ws, { t: 'teamAccept', ok: 0, err: 'guest' });
        return;
      }
      const from = sanitizeName(msg.from);
      const other = findOnlineByAccount(from);
      if (!other || ws.pendingTeamFrom !== from) {
        send(ws, { t: 'teamAccept', ok: 0, err: 'invite' });
        return;
      }
      const result = formTeam(ws, other);
      send(ws, Object.assign({ t: 'teamAccept' }, result));
      return;
    }

    if (msg.t === 'teamDecline') {
      const from = sanitizeName(msg.from);
      if (ws.pendingTeamFrom === from) ws.pendingTeamFrom = null;
      const other = findOnlineByAccount(from);
      if (other) send(other, { t: 'teamDecline', from: ws.accountKey || ws.displayName });
      send(ws, { t: 'teamDecline', ok: 1 });
      return;
    }

    if (msg.t === 'teamLeave') {
      dissolveTeam(ws, 'left');
      return;
    }

    if (msg.t === 'cancel') {
      removeFromQueue(ws);
      leaveRoom(ws);
      send(ws, { t: 'lobby', st: Date.now() });
      send(ws, packPresence());
      return;
    }

    if (msg.t === 'soloRestart') {
      if (ws.state === 'playing') return;
      const mode = ws.queueMode || 'pvp';
      if (mode === 'coop') {
        if (!coopQueue.includes(ws)) coopQueue.push(ws);
        ws.state = 'queued';
        ws.queueMode = 'coop';
        notifyQueueKind('coop');
        tryMatchmakeCoop();
        if (coopQueue.includes(ws) && (!ws.room || !ws.room.practice)) startPractice(ws, 'coop');
      } else if (ws.soloSnapshot && msg.continue) {
        startSoloMode(ws, ws.soloSnapshot);
      } else if (mode === 'pvp') {
        // Game-over while matchmaking leaves the client queued without a room —
        // Restart must start a fresh wait-practice, not dedicated solo.
        if (!matchQueue.includes(ws)) matchQueue.push(ws);
        ws.state = 'queued';
        ws.queueMode = 'pvp';
        notifyQueueKind('pvp');
        tryMatchmake();
        if (matchQueue.includes(ws) && (!ws.room || !ws.room.practice)) startPractice(ws, 'pvp');
      } else {
        startSoloMode(ws, null);
      }
      return;
    }

    if (msg.t === 'shopBuy') {
      if (!allowAction(ws, 'shopBuy', 80)) return;
      const room = ws.room;
      if (!room || !room.practice || !room.shopOpen) return;
      const p = room.players.get(ws.playerId);
      if (!p) return;
      const item = String(msg.item || '');
      const name = msg.name != null ? String(msg.name) : '';
      const result = handleShopBuy(room, p, item, name);
      send(ws, Object.assign({ t: 'shopBuy' }, result, {
        item,
        name,
        wave: room.shopWave | 0,
        coins: p.coins | 0,
        score: p.coinsCollected | 0,
        lives: p.lives | 0,
        hp: p.hp | 0,
        weapon: p.weapon || 'default',
        levels: Object.assign({}, p.weaponLevels || freshWeaponLevels()),
        unlocked: Object.assign({}, ensureUnlockedWeapons(p)),
        powerups: Object.assign({}, p.powerups || freshPowerups())
      }));
      return;
    }

    if (msg.t === 'shopDone') {
      const room = ws.room;
      if (!room || !room.practice || !room.shopOpen) return;
      markShopDone(room, ws.playerId);
      return;
    }

    if (msg.t === 'pause') {
      if (!allowAction(ws, 'pause', 400)) return;
      const result = requestMatchPause(ws);
      if (!result.ok && ws.readyState === 1) {
        send(ws, { t: 'pauseErr', err: result.err || 'fail' });
      }
      return;
    }

    if (msg.t === 'pauseReady') {
      const room = ws.room;
      if (!room || ws.playerId == null) return;
      markPauseReady(room, ws.playerId);
      return;
    }

    if (msg.t === 'rejoin') {
      if (!allowAction(ws, 'rejoin', 1000)) return;
      const result = tryRejoin(ws);
      if (!result.ok && ws.readyState === 1) {
        send(ws, { t: 'rejoin', ok: 0, err: result.err || 'fail' });
      }
      return;
    }

    if (msg.t === 'leave') {
      removeFromQueue(ws);
      const room = ws.room;
      const pid = ws.playerId;
      const competitive = !!(room && (!room.practice || room.coop));
      const midMatch = !!(room && (room.matchLive || room.paused));
      if (room && pid != null) room.pauseHold.delete(pid);
      const dissolve = competitive;
      leaveRoom(ws);
      if (dissolve) dissolveTeam(ws, 'left');
      if (competitive && midMatch && room && rooms.has(room.id) && humanPlayers(room).length >= 1) {
        forfeitPausedPlayer(room, pid);
      }
      send(ws, { t: 'lobby', st: Date.now() });
      send(ws, packPresence());
      sendTeamState(ws);
      return;
    }

    if (msg.t === 'presence' || msg.t === 'getPresence') {
      send(ws, packPresence());
      return;
    }

    if (msg.t === 'ready') {
      const room = ws.room;
      if (!room || ws.state !== 'playing') return;
      markPlayerReady(room, ws.playerId);
      return;
    }

    if (msg.t === 'dbgPwr') {
      if (!ws.isAdmin) return;
      if (!allowAction(ws, 'dbgPwr', 50)) return;
      const room = ws.room;
      if (!room || (ws.state !== 'playing' && ws.state !== 'practice')) return;
      spawnDebugPowerup(room, msg.x, msg.y, msg.vx, msg.vy, msg.powerup);
      return;
    }

    if (msg.t === 'dbgShop') {
      if (!ws.isAdmin) return;
      if (!allowAction(ws, 'dbgShop', 200)) return;
      const room = ws.room;
      if (!room || (ws.state !== 'playing' && ws.state !== 'practice')) return;
      const p = room.players.get(ws.playerId);
      if (!p || (p.hp | 0) <= 0) return;
      if (room.shopOpen) {
        send(ws, packShopState(room, p));
        return;
      }
      // Upcoming wave label (same as natural shop); Continue starts it in wave rooms.
      const next = Math.max(1, (room.wave | 0) + 1);
      openSoloShop(room, next);
      return;
    }

    if (msg.t !== 'in') return;
    const room = ws.room;
    if (!room || (ws.state !== 'playing' && ws.state !== 'practice')) return;
    const pl = room.players.get(ws.playerId);
    if (!pl) return;
    const frames = Array.isArray(msg.frames) ? msg.frames : [msg];
    enqueuePlayerInputs(ws, pl, frames);
  });

  ws.on('close', () => {
    removeFromQueue(ws);
    const held = handleDisconnectHold(ws);
    if (!held) {
      dissolveTeam(ws, 'disconnect');
      leaveRoom(ws);
    }
    broadcastPresence();
  });
});

let nextTickAt = process.hrtime.bigint();
const TICK_NS = BigInt(Math.round(TICK_MS * 1e6));

/** @type {boolean} */
let perfTestActive = false;
