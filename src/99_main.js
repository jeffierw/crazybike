// ---------------------------------------------------------------- 99_main: Complete CrazyBike application loop, 3D garage showroom, career/endless flow & window.__bike test hook
const App = (() => {
  let gfx = null, canvas = null, time = 0, raceTime = 0;
  let state = 'title'; // 'title' | 'career' | 'endless' | 'garage' | 'race' | 'pause' | 'result'
  let activeEvent = null;
  let activeEndless = null;
  let player = null, rivals = [], allRiders = [];
  let flyS = 40, garageAngle = 0.65;
  let trackRec = [], trackAcc = 0, koPoints = [];

  let bannerText = '', bannerCol = '#ffc43d', bannerT = 0;
  function showBanner(text, col = '#ffc43d') {
    bannerText = text; bannerCol = col; bannerT = 1.8;
  }

  function createPlayerFromCareer(startS = 12) {
    const c = Career.data;
    const paint = Career.paint;
    const R = Physics.createRider({
      id: 0,
      name: 'YOU',
      isPlayer: true,
      s: startS,
      u: 0,
      initSpeed: 10,
      upgrades: Object.assign({}, c.upgrades),
      frameCol: paint.frame,
      jerseyCol: paint.jersey,
      helmetCol: paint.helmet,
    });
    if (c.cheats && c.cheats.megaBat) {
      R.combatTier = 3;
      R.bottles = 3;
    }
    return R;
  }

  function startRun(mountainId, modeId, seed, diff, eventObj = null) {
    activeEvent = eventObj;
    activeEndless = modeId === 'endless' ? { mountainId, seed, diff } : null;
    Course.init(mountainId, modeId, seed);
    Terrain.reset();
    Camera.reset();
    Particles.clear();
    Combat.reset();
    raceTime = 0;
    trackRec = [];
    trackAcc = 0;
    koPoints = [];
    bannerT = 0;

    player = createPlayerFromCareer(12);
    rivals = AI.spawnPack(diff);
    allRiders = [player, ...rivals];
    state = 'race';
    UI.setScreen('race');
    showBanner(eventObj ? `${Course.mountain.name} · ${Course.mode.name}` : `无尽暴走 · ${Course.mountain.name}`, '#ffc43d');
  }

  function finalizeRun() {
    if (state === 'result') return;
    state = 'result';
    Music.setPlaying(false);
    const summary = {
      endless: Course.mode.endless,
      mountain: Course.mountain,
      modeName: Course.mode.name,
      seed: Course.seed,
      rank: player.rank,
      time: player.finishTime || raceTime,
      dist: Math.max(player.s, 10),
      takedowns: player.takedowns,
      trickScore: player.totalTrickScore,
      crashes: player.crashes,
      maxSpeedKmh: player.maxSpeed * 3.6,
      bestAirDist: player.bestAirDist,
      finished: player.finished,
      track: trackRec.slice(),
      koPoints: koPoints.slice(),
    };
    const payout = Course.mode.endless
      ? Career.recordEndlessRun(summary)
      : Career.recordCareerFinish(activeEvent || Career.EVENTS[0], summary);
    summary.payout = payout;
    summary.totalCash = payout.total;
    UI.setScreen('result', summary);
  }

  function updateRanks() {
    const sorted = allRiders.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.s - a.s;
    });
    for (let i = 0; i < sorted.length; i++) sorted[i].rank = i + 1;
  }

  function applyGlobals(cam, focusPos, t) {
    const m = Course.mountain;
    const sDir = v3.norm(m.sunDir);
    const ivp = m4.invert(cam.vp);

    const sc = focusPos || [0, 0, 0];
    const lEye = v3.mad(sc, sDir, 75);
    const lView = m4.lookAt(lEye, sc, [0, 1, 0]);
    const ext = state === 'garage' ? 8 : 38;
    const lProj = m4.ortho(-ext, ext, -ext, ext, 4, 185);
    const lVP = m4.mul(lProj, lView);

    setGlobalMat('viewProj', cam.vp);
    setGlobalMat('invViewProj', ivp);
    setGlobalMat('lightVP', lVP);
    setGlobalVec('camPos', cam.eye[0], cam.eye[1], cam.eye[2], t);
    setGlobalVec('sunDir', sDir[0], sDir[1], sDir[2], m.sunInt);
    setGlobalVec('sunCol', m.sunCol[0], m.sunCol[1], m.sunCol[2], m.exposure);
    setGlobalVec('skyZen', m.skyZen[0], m.skyZen[1], m.skyZen[2], state === 'garage' ? 0.0005 : m.fogDens);
    setGlobalVec('skyHor', m.skyHor[0], m.skyHor[1], m.skyHor[2], 0.02);
    setGlobalVec('groundCol', m.groundCol[0], m.groundCol[1], m.groundCol[2], m.idx);
    setGlobalVec(
      'feel',
      state === 'race' ? Feel.speedNorm : 0,
      player ? player.adrenaline / 100 : 0,
      state === 'race' ? Feel.hitFlash : 0,
      state === 'race' ? Feel.boostGlow : 0
    );
    gfx.setGlobals(GBUF);
  }

  function stepRace(dt) {
    if (Feel.hitstop > 0) {
      Feel.hitstop = Math.max(0, Feel.hitstop - dt);
      return;
    }
    const simDt = Feel.slowMo > 0 ? dt * 0.45 : dt;
    raceTime += simDt;

    const inp = Input.sample(raceTime);
    if (inp.pause) {
      state = 'pause';
      Music.setPlaying(false);
      UI.setScreen('pause');
      return;
    }
    if (inp.cam) Camera.cycle();
    if (inp.atkL) Combat.tryAttack(player, -1, allRiders, raceTime);
    else if (inp.atkR) Combat.tryAttack(player, 1, allRiders, raceTime);

    // Optional PS2 Low-Gravity Cheat lift while airborne!
    if (Career.data.cheats.lowGrav && player.air) player.vel[1] += 8.2 * simDt;

    Physics.stepRider(player, inp, simDt, raceTime);

    for (let i = 0; i < rivals.length; i++) {
      const R = rivals[i];
      const aiInp = AI.decideInput(R, player, allRiders, simDt, raceTime);
      if (aiInp.atkL) Combat.tryAttack(R, -1, allRiders, raceTime);
      else if (aiInp.atkR) Combat.tryAttack(R, 1, allRiders, raceTime);
      Physics.stepRider(R, aiInp, simDt, raceTime);
    }
    AI.recycleEndless(rivals, player);
    Combat.step(allRiders, simDt, raceTime);
    updateRanks();

    // Telemetry sampling for highlight route card
    trackAcc += simDt;
    if (trackAcc >= 0.22) {
      trackAcc = 0;
      trackRec.push([player.s, player.pos[1], player.speed, player.air ? 1 : 0]);
      if (trackRec.length > 900) trackRec.shift();
    }

    for (const ev of Physics.drainEvents()) {
      if (ev.type === 'jump' && ev.rider.isPlayer) Sound.playJump(ev.power);
      else if (ev.type === 'land') {
        Particles.burstLand(ev.rider.pos, clamp(ev.impact / 10, 0.5, 1.5));
        if (ev.rider.isPlayer) { Feel.land(ev.impact); Sound.playLand(ev.impact); }
      } else if (ev.type === 'crash') {
        Particles.burstImpact(ev.pos, [1.5, 0.45, 0.15], 24);
        if (ev.attacker && ev.attacker !== ev.rider && ev.reason === 'obstacle') {
          Combat.registerTakedown(ev.attacker, ev.rider);
        }
        if (ev.rider.isPlayer) { Feel.jolt(0.55, 0.7, 0.05); Feel.slowMo = 0.65; Sound.playCrash(); }
      } else if (ev.type === 'scrape' && ev.rider.isPlayer) {
        Particles.burstImpact(ev.pos, [1.4, 0.85, 0.3], 10);
        Feel.jolt(0.26, 0.22, 0); Sound.playHit(false);
      } else if (ev.type === 'nearmiss' && ev.rider.isPlayer) {
        if (Feel.nearMiss(ev.side)) { player.adrenaline = Math.min(100, player.adrenaline + 6); Sound.playWhoosh(); }
      } else if (ev.type === 'finish' && ev.rider.isPlayer) {
        Sound.playTakedown();
        finalizeRun();
        return;
      }
    }

    for (const se of Stunts.drainEvents()) {
      if (se.type === 'trick_land') showBanner(`${se.name} ×${se.combo}  +${se.pts}`, '#ffc43d');
      else if (se.type === 'trick_bail') showBanner(`贪招翻车！痛失 ${se.lost} 分`, '#ff3155');
    }
    for (const ce of Combat.drainEvents()) {
      if (ce.type === 'takedown' && ce.attacker.isPlayer) {
        koPoints.push(player.s);
        showBanner(ce.wasNemesis ? `宿敌反杀 ${ce.victim.name}! +$${ce.bounty}` : `击倒 ${ce.victim.name}! +$${ce.bounty}`, '#ff5b1f');
      } else if (ce.type === 'hit' && ce.attacker.isPlayer) {
        showBanner(`重击 ${ce.victim.name}!`, '#38e2ff');
      }
    }

    for (let i = 0; i < allRiders.length; i++) Particles.emitTire(allRiders[i], simDt);
    Particles.step(simDt);
    Sound.update(player, dt, true);
    Music.step(dt, Feel.speedNorm, player.adrenaline / 100, Course.mountain.idx);
    Feel.step(player, dt);
  }

  let hudTimer = 0;
  function renderFrame(dt) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gfx.resize();
    }
    Post.ensureSize(w, h);
    const aspect = w / h;

    time += dt;
    if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);

    if (state === 'race') {
      stepRace(dt);
    } else if (state === 'pause') {
      const inp = Input.sample(raceTime);
      if (inp.pause) { state = 'race'; Music.setPlaying(true); UI.setScreen('race'); }
      Sound.update(player, dt, false);
    } else if (state === 'garage') {
      garageAngle += dt * 0.55;
      if (player) Sound.update(player, dt, false);
    } else {
      // Live scenic mountain flythrough behind Title / Career / Endless / Result screens!
      flyS += dt * 22;
      if (flyS > 1550) flyS = 40;
      if (player) Sound.update(player, dt, false);
    }

    Solid.clear();
    let cam, focusPos, drawWorld = true;

    if (state === 'garage') {
      drawWorld = false;
      cam = Camera.garageView(garageAngle, aspect);
      focusPos = [0, 0.9, 0];
      // Pedestal floor & glowing showroom ring
      Solid.pushTRS('cyl', [0, -0.14, 0], 0, 0, 0, [3.6, 0.28, 3.6], [0.16, 0.18, 0.23], 0.45);
      Solid.pushTRS('cyl', [0, 0.01, 0], 0, 0, 0, [3.75, 0.04, 3.75], [1.0, 0.40, 0.12], -1.0);
      const showBike = createPlayerFromCareer(0);
      showBike.pos = [0, 0, 0]; showBike.yaw = 0; showBike.pitch = 0; showBike.roll = 0;
      showBike.wheelSpin = -time * 1.4;
      showBike.susp = Math.sin(time * 2.4) * 0.04 + 0.04;
      BikeMesh.emitRider(showBike, time);
    } else if (state === 'race' || state === 'pause') {
      Terrain.update(player.s);
      cam = Camera.update(player, dt, aspect, Feel);
      focusPos = [player.pos[0], player.pos[1], player.pos[2] - 14];
      Props.emit(player.s, time);
      for (let i = 0; i < allRiders.length; i++) {
        if (Math.abs(allRiders[i].s - player.s) < 250) BikeMesh.emitRider(allRiders[i], time);
      }
      Combat.emitProjectiles();
    } else {
      Terrain.update(flyS);
      const sp = Course.at(flyS), spA = Course.at(flyS + 32);
      const eye = [sp.cx + Math.sin(time * 0.25) * 4, Course.height(sp.cx, -flyS) + 5.8, -flyS];
      const tgt = [spA.cx, Course.height(spA.cx, -(flyS + 32)) + 1.8, -(flyS + 32)];
      const viewM = m4.lookAt(eye, tgt, [0, 1, 0]);
      const projM = m4.perspective(66 * PI / 180, aspect, 0.35, 900);
      cam = { eye, target: tgt, viewM, projM, vp: m4.mul(projM, viewM) };
      focusPos = tgt;
      Props.emit(flyS, time);
    }

    Solid.upload();
    applyGlobals(cam, focusPos, time);

    gfx.beginFrame();
    gfx.beginPass(Post.shadowTarget, { depth: 1.0 });
    Solid.drawShadow();
    gfx.endPass();

    gfx.beginPass(Post.sceneTarget, { color: [0.08, 0.09, 0.12, 1], depth: 1.0 });
    Sky.draw();
    if (drawWorld) Terrain.draw(Post.shadowTex);
    Solid.drawColor(Post.shadowTex);
    if (state === 'race' || state === 'pause') Particles.draw(cam.viewM);
    gfx.endPass();

    Post.present();
    gfx.endFrame();

    hudTimer += dt;
    if (state === 'race' && hudTimer > 0.05) {
      hudTimer = 0;
      UI.updateHUD(player, allRiders.length, bannerText, bannerCol, bannerT);
    }
  }

  async function boot() {
    canvas = document.getElementById('gl');
    Input.init(canvas);
    Course.init(MOUNTAINS[0].id, 'freeride', 202611);
    gfx = await createGfx(canvas);
    Post.init(gfx);
    Sky.init(gfx);
    Terrain.init(gfx);
    Solid.init(gfx);
    Particles.init(gfx);
    if (gfx.finishPipelineAsync) await new Promise(r => setTimeout(r, 80));

    UI.init({
      onScreen(next) {
        state = next;
        if (next !== 'race') Music.setPlaying(false);
      },
      previewMountain(mId) {
        Course.init(mId, 'freeride', 202611);
        Terrain.reset();
        flyS = 40;
      },
      startEvent(ev) {
        startRun(ev.mountainId, ev.modeId, ev.seed, ev.diff, ev);
      },
      startEndless(mId, seed, diff) {
        startRun(mId, 'endless', seed, diff, null);
      },
      togglePause() {
        if (state === 'race') { state = 'pause'; Music.setPlaying(false); UI.setScreen('pause'); }
        else if (state === 'pause') { state = 'race'; Music.setPlaying(true); UI.setScreen('race'); }
      },
      restartRun() {
        Music.setPlaying(true);
        if (activeEndless) startRun(activeEndless.mountainId, 'endless', activeEndless.seed, activeEndless.diff, null);
        else if (activeEvent) startRun(activeEvent.mountainId, activeEvent.modeId, activeEvent.seed, activeEvent.diff, activeEvent);
        else startRun(MOUNTAINS[0].id, 'freeride', 202611, 0, Career.EVENTS[0]);
      },
      finishEndlessNow() {
        if (state === 'race' && Course.mode.endless) finalizeRun();
      },
    });

    // Support direct share links: #today or #seed-123456
    const hash = (location.hash || '').slice(1);
    if (hash === 'today') {
      const sd = todaySeed();
      startRun(MOUNTAINS[sd % MOUNTAINS.length].id, 'endless', sd, 1.5, null);
    } else if (/^seed-(\d+)$/.test(hash)) {
      const sd = +RegExp.$1;
      startRun(MOUNTAINS[sd % MOUNTAINS.length].id, 'endless', sd, 1.2, null);
    } else {
      UI.setScreen('title');
    }

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      renderFrame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Cold-Smoke-inspired automation & inspection hook
    window.__bike = {
      version: BUILD_HASH,
      ready: true,
      backend: gfx.caps.backend,
      screen: () => state,
      setScreen: s => UI.setScreen(s),
      startEvent: idx => { const ev = Career.EVENTS[idx] || Career.EVENTS[0]; startRun(ev.mountainId, ev.modeId, ev.seed, ev.diff, ev); },
      startEndless: (mId = 'redrock', seed = 202611) => startRun(mId, 'endless', seed, 1.2, null),
      finishNow: () => finalizeRun(),
      career: () => Career.data,
      state: () => player ? ({
        s: +player.s.toFixed(1), u: +player.u.toFixed(1), speedKmh: +(player.speed * 3.6).toFixed(1),
        rank: player.rank, takedowns: player.takedowns, trickScore: player.totalTrickScore,
        crashed: player.crashed, air: player.air, adrenaline: +player.adrenaline.toFixed(0),
        minCamClear: +Camera.minClearance.toFixed(2),
        rivals: rivals.map(r => ({ name: r.name, s: Math.round(r.s), rank: r.rank, nemesis: r.nemesis })),
      }) : null,
      sim(secs, fn, opts = {}) {
        Input.setScript(fn || (() => AI.decideInput(player, rivals[0], allRiders, 1 / 60, raceTime)));
        const n = Math.round(secs * 60);
        for (let i = 0; i < n; i++) {
          if (state !== 'race') break;
          stepRace(1 / 60);
          if (opts.draw) renderFrame(0);
          else Camera.update(player, 1 / 60, 16 / 9, Feel);
        }
        Input.setScript(null);
      },
      renderOnce: () => renderFrame(1 / 60),
    };
  }

  boot().catch(e => {
    console.error(e);
    const ui = document.getElementById('ui');
    if (ui) ui.innerHTML = `<pre style="color:#ff5566;padding:20px;">Boot error: ${e.stack || e.message}</pre>`;
  });

  return {
    backendName: () => (gfx && gfx.caps ? gfx.caps.name : 'WebGL2'),
  };
})();
