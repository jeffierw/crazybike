// ---------------------------------------------------------------- 99_main: CrazyBike V2 application loop, Start-Gate Title preview, Freeze-Frame Photo Mode, Quality Scaler & window.__bike hook
const App = (() => {
  let gfx = null, canvas = null, time = 0, raceTime = 0;
  let state = 'title'; // 'title' | 'career' | 'endless' | 'garage' | 'race' | 'pause' | 'photo' | 'result'
  let activeEvent = null;
  let activeEndless = null;
  let player = null, rivals = [], allRiders = [];
  let titleRider = null, titleRivals = [];
  let garageAngle = 0.65;
  let trackRec = [], trackAcc = 0, koPoints = [];

  let quality = 'auto';
  try {
    const q = localStorage.getItem('crazybike_quality');
    if (q === 'auto' || q === 'high' || q === 'balanced' || q === 'smooth') quality = q;
  } catch (_) {}

  function dprForQuality() {
    const raw = devicePixelRatio || 1;
    if (quality === 'high') return Math.min(raw, 2.0);
    if (quality === 'balanced') return Math.min(raw, 1.25);
    if (quality === 'smooth') return Math.min(raw, 0.85);
    return Math.min(raw, 1.55);
  }

  let bannerText = '', bannerCol = '#ffd08a', bannerT = 0;
  function showBanner(text, col = '#ffd08a') {
    bannerText = text; bannerCol = col; bannerT = 1.85;
  }

  function setLoadProgress(frac, labelZh) {
    const fill = document.getElementById('load-fill');
    const st = document.getElementById('load-stage');
    if (fill) fill.style.transform = `scaleX(${clamp(frac, 0.05, 1)})`;
    if (st) st.textContent = I18N.t(labelZh);
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

  // Build poised Start-Gate scene for Title Screen (player + 7 rivals lined up overlooking the canyon/ocean cliff!)
  function buildTitleScene() {
    titleRider = createPlayerFromCareer(12);
    titleRider.idleMode = true;
    titleRider.speed = 0;
    titleRider.vel = [0, 0, 0];
    const sp = Course.at(12);
    titleRider.pos[1] += 0.06;
    titleRider.yaw = Math.atan2(-sp.dcx, 1);
    titleRider.pitch = -Math.atan(sp.slope) * 0.90;

    titleRivals = AI.spawnPack(1);
    for (let i = 0; i < titleRivals.length; i++) {
      const r = titleRivals[i];
      r.idleMode = true;
      r.speed = 0;
      r.vel = [0, 0, 0];
      const rs = 13.2 + (i % 3) * 1.4;
      const side = (i % 2 === 0 ? 1 : -1) * (2.2 + Math.floor(i / 2) * 1.7);
      const rsp = Course.at(rs);
      r.s = rs; r.u = side;
      r.pos = [rsp.cx + side, Course.height(rsp.cx + side, -rs) + 0.06, -rs];
      r.yaw = Math.atan2(-rsp.dcx, 1);
      r.pitch = -Math.atan(rsp.slope) * 0.90;
    }
    Terrain.reset();
    Terrain.update(12);
    Wildlife.reset();
    Wildlife.step(12, 1 / 60, quality);
  }

  function startRun(mountainId, modeId, seed, diff, eventObj = null, seamlessFromTitle = false, solo = false) {
    activeEvent = eventObj;
    const isSolo = !!solo;
    activeEndless = modeId === 'endless' ? { mountainId, seed, diff, solo: isSolo } : null;
    const sameMount = seamlessFromTitle && Course.mountain.id === mountainId && modeId === 'freeride';
    if (!sameMount) {
      Course.init(mountainId, modeId, seed);
      Terrain.reset();
      Camera.reset();
    } else {
      // Seamless start-gate launch: glide smoothly from Title 3/4 view straight into Chase with zero black cut!
      Camera.resetOrbit();
    }
    Particles.clear();
    Combat.reset();
    Wildlife.reset();
    Wildlife.step(12, 1 / 60, quality);
    raceTime = 0;
    trackRec = [];
    trackAcc = 0;
    koPoints = [];
    bannerT = 0;

    player = createPlayerFromCareer(12);
    player.idleMode = false;
    rivals = isSolo ? [] : AI.spawnPack(diff);
    allRiders = [player, ...rivals];
    state = 'race';
    Music.setMode('race');
    UI.setScreen('race');
    const mn = I18N.lang === 'en' ? Course.mountain.en : Course.mountain.name;
    const md = I18N.lang === 'en' ? Course.mode.en : Course.mode.name;
    showBanner(eventObj ? `${mn} · ${md}` : `${I18N.t('无尽暴走')} · ${mn}`, '#ffd08a');
  }

  function finalizeRun() {
    if (state === 'result') return;
    state = 'result';
    Music.setMode('title');
    const summary = {
      endless: Course.mode.endless,
      mountain: Course.mountain,
      modeName: Course.mode.name,
      modeEn: Course.mode.en,
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

  function enterPhotoMode() {
    if (!player || (state !== 'pause' && state !== 'race')) return;
    state = 'photo';
    const uiEl = document.getElementById('ui');
    if (uiEl) uiEl.classList.add('hidden');
    Photo.enter(player.pos, Camera.lastCam, () => {
      if (uiEl) uiEl.classList.remove('hidden');
      state = 'pause';
      UI.setScreen('pause');
    });
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
      Camera.resetOrbit();
      Music.setMode('pause');
      UI.setScreen('pause');
      return;
    }
    if (inp.cam) Camera.cycle(1);
    if (inp.atkL) Combat.tryAttack(player, -1, allRiders, raceTime);
    else if (inp.atkR) Combat.tryAttack(player, 1, allRiders, raceTime);

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
        if (ev.attacker && ev.attacker !== ev.rider && (ev.reason === 'obstacle' || ev.reason === 'cliff')) {
          Combat.registerTakedown(ev.attacker, ev.rider);
        }
        if (ev.rider.isPlayer) { Feel.jolt(0.55, 0.7, 0.05); Feel.slowMo = 0.60; Sound.playCrash(); }
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
      const lbl = I18N.lang === 'en' ? se.en : se.name;
      if (se.type === 'trick_land') showBanner(`${lbl}  +${se.pts}`, '#ffd08a');
      else if (se.type === 'trick_bail') showBanner(I18N.bi(`后空翻失误！-${se.lost}`, `BACKFLIP BAIL! -${se.lost}`), '#ff3155');
    }
    for (const ce of Combat.drainEvents()) {
      if (ce.type === 'takedown' && ce.attacker.isPlayer) {
        koPoints.push(player.s);
        showBanner(
          ce.wasNemesis
            ? I18N.bi(`宿敌反杀 ${ce.victim.name}! +$${ce.bounty}`, `NEMESIS KO ${ce.victim.name}! +$${ce.bounty}`)
            : I18N.bi(`击倒 ${ce.victim.name}! +$${ce.bounty}`, `TAKEDOWN ${ce.victim.name}! +$${ce.bounty}`),
          '#ff5b1f'
        );
      } else if (ce.type === 'hit' && ce.attacker.isPlayer) {
        showBanner(I18N.bi(`重击 ${ce.victim.name}!`, `SOLID HIT ${ce.victim.name}!`), '#38e2ff');
      }
    }

    for (let i = 0; i < allRiders.length; i++) Particles.emitTire(allRiders[i], simDt, quality);
    Particles.emitAmbient(player.pos, simDt, quality);
    Particles.step(simDt);
    Wildlife.step(player.s, simDt, quality);
    Sound.update(player, dt, 'race');
    Music.step(dt, Feel.speedNorm, player.adrenaline / 100, Course.mountain.idx);
    Feel.step(player, dt);
  }

  let hudTimer = 0;
  function renderFrame(dt) {
    const dpr = dprForQuality();
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gfx.resize();
    }
    Post.ensureSize(w, h);
    const aspect = w / h;

    if (state !== 'photo' && state !== 'pause') time += dt;
    if (bannerT > 0 && state === 'race') bannerT = Math.max(0, bannerT - dt);

    if (state === 'race') {
      stepRace(dt);
    } else if (state === 'pause') {
      const inp = Input.sample(raceTime);
      if (inp.pause) {
        state = 'race';
        Camera.resetOrbit();
        Music.setMode('race');
        UI.setScreen('race');
      } else if (Input.keys.KeyP) {
        Input.keys.KeyP = false;
        enterPhotoMode();
      }
      Sound.update(player, dt, 'pause');
      Music.step(dt, 0, 0, Course.mountain.idx);
    } else if (state === 'photo') {
      Sound.update(player, dt, 'pause');
      Music.step(dt, 0, 0, Course.mountain.idx);
    } else if (state === 'garage') {
      garageAngle += dt * 0.42;
      Sound.update(null, dt, 'title');
      Music.step(dt, 0, 0, Course.mountain.idx);
    } else {
      // Title / Career / Endless / Result: warm ambient Title music & high mountain breeze!
      Sound.update(null, dt, 'title');
      Music.step(dt, 0, 0, Course.mountain.idx);
    }

    Solid.clear();
    let cam, focusPos, drawWorld = true;

    if (state === 'garage') {
      drawWorld = false;
      cam = Camera.garageView(garageAngle, aspect, dt);
      focusPos = [0, 0.9, 0];
      Solid.pushTRS('cyl', [0, -0.14, 0], 0, 0, 0, [3.6, 0.28, 3.6], [0.16, 0.18, 0.23], 0.45);
      Solid.pushTRS('cyl', [0, 0.01, 0], 0, 0, 0, [3.75, 0.04, 3.75], [1.0, 0.45, 0.14], -1.0);
      const showBike = createPlayerFromCareer(0);
      showBike.pos = [0, 0, 0]; showBike.yaw = 0; showBike.pitch = 0; showBike.roll = 0;
      showBike.idleMode = true;
      showBike.wheelSpin = -time * 1.1;
      showBike.susp = Math.sin(time * 2.2) * 0.03 + 0.03;
      BikeMesh.emitRider(showBike, time);
    } else if (state === 'photo') {
      Terrain.update(player.s);
      cam = Photo.step(dt, aspect);
      focusPos = [player.pos[0], player.pos[1], player.pos[2] - 12];
      Props.emit(player.s, time, quality);
      Wildlife.emit();
      for (let i = 0; i < allRiders.length; i++) {
        if (Math.abs(allRiders[i].s - player.s) < 250) BikeMesh.emitRider(allRiders[i], time);
      }
      Combat.emitProjectiles();
    } else if (state === 'race' || state === 'pause') {
      Terrain.update(player.s);
      cam = Camera.update(player, dt, aspect, Feel, state === 'pause');
      focusPos = [player.pos[0], player.pos[1], player.pos[2] - 14];
      Props.emit(player.s, time, quality);
      Wildlife.emit();
      for (let i = 0; i < allRiders.length; i++) {
        if (Math.abs(allRiders[i].s - player.s) < 250) BikeMesh.emitRider(allRiders[i], time);
      }
      Combat.emitProjectiles();
    } else {
      // Poised Start-Gate Title Scene: Player & rivals lined up overlooking the canyon drop, soaring wildlife & sunlit motes!
      if (!titleRider) buildTitleScene();
      const pnt = Career.paint;
      titleRider.frameCol = pnt.frame;
      titleRider.jerseyCol = pnt.jersey;
      titleRider.helmetCol = pnt.helmet;
      titleRider.upgrades = Object.assign({}, Career.data.upgrades);

      Terrain.update(12);
      cam = Camera.titleView(titleRider, dt, aspect, time);
      focusPos = [titleRider.pos[0], titleRider.pos[1], titleRider.pos[2] - 14];
      Wildlife.step(12, dt, quality);
      Particles.emitAmbient(focusPos, dt, quality);
      Particles.step(dt);
      Props.emit(12, time, quality);
      Wildlife.emit();
      BikeMesh.emitRider(titleRider, time);
      for (let i = 0; i < titleRivals.length; i++) BikeMesh.emitRider(titleRivals[i], time);
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
    if (drawWorld) Particles.draw(cam.viewM);
    gfx.endPass();

    Post.present();
    gfx.endFrame();
    if (state === 'photo') Photo.onAfterPresent();

    hudTimer += dt;
    if (state === 'race' && hudTimer > 0.05) {
      hudTimer = 0;
      UI.updateHUD(player, allRiders.length, bannerText, bannerCol, bannerT);
    }
  }

  async function boot() {
    canvas = document.getElementById('gl');
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = I18N.lang === 'en' ? 'en' : 'zh-CN';
    }
    setLoadProgress(0.15, '正在构筑山脉与悬崖');
    Input.init(canvas);
    Camera.bindInput(canvas);
    Sound.bindAutoUnlock();
    Course.init(MOUNTAINS[0].id, 'freeride', 202611);

    await new Promise(r => requestAnimationFrame(r));
    setLoadProgress(0.38, '点亮天空与光影');
    gfx = await createGfx(canvas);
    Post.init(gfx);
    Post.setQuality(quality);
    Sky.init(gfx);
    Terrain.init(gfx);

    await new Promise(r => requestAnimationFrame(r));
    setLoadProgress(0.66, '正在雕塑车手模型');
    await new Promise(r => setTimeout(r, 16));
    Solid.init(gfx);
    Particles.init(gfx);
    Photo.init(gfx, canvas);
    if (gfx.finishPipelineAsync) await new Promise(r => setTimeout(r, 80));

    setLoadProgress(0.92, '准备出发');
    buildTitleScene();

    UI.init({
      onScreen(next) {
        state = next;
        Camera.resetOrbit();
        if (next === 'title') {
          Camera.reset();
          Music.setMode('title');
        } else if (next === 'garage') {
          Camera.resetOrbit();
          Music.setMode('title');
        } else if (next !== 'race' && next !== 'pause') {
          Music.setMode('title');
        }
      },
      previewMountain(mId) {
        Course.init(mId, 'freeride', 202611);
        buildTitleScene();
        Camera.reset();
      },
      startEvent(ev, seamless = false) {
        startRun(ev.mountainId, ev.modeId, ev.seed, ev.diff, ev, seamless, false);
      },
      startEndless(mId, seed, diff, solo = true) {
        startRun(mId, 'endless', seed, diff, null, false, solo);
      },
      switchMountainNow(mId) {
        if (activeEndless) {
          startRun(mId, 'endless', activeEndless.seed, activeEndless.diff, null, false, activeEndless.solo !== false);
        } else {
          const ev = Career.EVENTS.find(e => e.mountainId === mId) || Career.EVENTS[0];
          startRun(ev.mountainId, ev.modeId, ev.seed, ev.diff, ev, false, false);
        }
      },
      togglePause() {
        if (state === 'race') {
          state = 'pause';
          Camera.resetOrbit();
          Music.setMode('pause');
          UI.setScreen('pause');
        } else if (state === 'pause') {
          state = 'race';
          Camera.resetOrbit();
          Music.setMode('race');
          UI.setScreen('race');
        }
      },
      enterPhoto() {
        enterPhotoMode();
      },
      restartRun() {
        if (activeEndless) startRun(activeEndless.mountainId, 'endless', activeEndless.seed, activeEndless.diff, null, false, activeEndless.solo !== false);
        else if (activeEvent) startRun(activeEvent.mountainId, activeEvent.modeId, activeEvent.seed, activeEvent.diff, activeEvent, false, false);
        else startRun(MOUNTAINS[0].id, 'freeride', 202611, 0, Career.EVENTS[0], false, false);
      },
      finishEndlessNow() {
        if (state === 'race' && Course.mode.endless) finalizeRun();
      },
      getQuality: () => quality,
      setQuality(q) {
        quality = q;
        Post.setQuality(q);
        try { localStorage.setItem('crazybike_quality', q); } catch (_) {}
      },
    });

    const hash = (location.hash || '').slice(1);
    if (hash === 'today') {
      const sd = todaySeed();
      startRun(MOUNTAINS[sd % MOUNTAINS.length].id, 'endless', sd, 1.5, null, false, true);
    } else if (/^seed-(\d+)$/.test(hash)) {
      const sd = +RegExp.$1;
      startRun(MOUNTAINS[sd % MOUNTAINS.length].id, 'endless', sd, 1.2, null, false, true);
    } else {
      UI.setScreen('title');
    }

    // Draw first frame behind veil then lift smoothly!
    renderFrame(1 / 60);
    setLoadProgress(1.0, '准备出发');
    const veil = document.getElementById('load');
    if (veil) veil.classList.add('gone');

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      renderFrame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Automation & Inspection Hook
    window.__bike = {
      version: BUILD_HASH,
      ready: true,
      backend: gfx.caps.backend,
      lang: () => I18N.lang,
      setLang: l => I18N.setLang(l),
      views: Camera.VIEWS.map(v => v.id),
      setView: v => { Camera.setView(v); UI.redraw(); },
      enterPhoto: () => enterPhotoMode(),
      exitPhoto: () => Photo.exit(),
      screen: () => state,
      setScreen: s => UI.setScreen(s),
      openSub: sub => UI.openSub(sub),
      riderVerts: () => (RiderMesh.info() ? RiderMesh.info().nv : 0),
      startEvent: idx => { const ev = Career.EVENTS[idx] || Career.EVENTS[0]; startRun(ev.mountainId, ev.modeId, ev.seed, ev.diff, ev, false, false); },
      startEndless: (mId = 'redrock', seed = 202611, solo = true) => startRun(mId, 'endless', seed, 1.2, null, false, solo),
      quality: () => quality,
      setQuality: q => { quality = q; Post.setQuality(q); },
      wildlifeCount: () => Wildlife.count(),
      finishNow: () => finalizeRun(),
      career: () => Career.data,
      state: () => player ? ({
        s: +player.s.toFixed(1), u: +player.u.toFixed(1), speedKmh: +(player.speed * 3.6).toFixed(1),
        rank: player.rank, takedowns: player.takedowns, trickScore: player.totalTrickScore,
        crashed: player.crashed, air: player.air, trick: player.trickType,
        adrenaline: +player.adrenaline.toFixed(0), view: Camera.currentView().id,
        minCamClear: +Camera.minClearance.toFixed(2),
        rivalsCount: rivals.length,
        rivals: rivals.map(r => ({ name: r.name, s: Math.round(r.s), rank: r.rank, nemesis: r.nemesis })),
      }) : null,
      sim(secs, fn, opts = {}) {
        Input.setScript(fn || (() => AI.decideInput(player, rivals[0] || player, allRiders, 1 / 60, raceTime)));
        const n = Math.round(secs * 60);
        for (let i = 0; i < n; i++) {
          if (state !== 'race') break;
          stepRace(1 / 60);
          if (opts.draw) renderFrame(0);
          else Camera.update(player, 1 / 60, 16 / 9, Feel, false);
        }
        Input.setScript(null);
      },
      renderOnce: () => renderFrame(1 / 60),
    };
  }

  boot().catch(e => {
    console.error(e);
    const veil = document.getElementById('load');
    if (veil) veil.classList.add('gone');
    const ui = document.getElementById('ui');
    if (ui) ui.innerHTML = `<pre style="color:#ff5566;padding:24px;pointer-events:auto;">Boot error: ${e.stack || e.message}</pre>`;
  });

  return {
    backendName: () => (gfx && gfx.caps ? gfx.caps.name : 'WebGL2'),
  };
})();
