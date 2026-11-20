// ---------------------------------------------------------------- 99_main: Step 6 8-rider combat racing loop (player + 7 AI + combat + stunts + audio)
const App = (() => {
  let gfx = null, canvas = null, time = 0, raceTime = 0;
  let mountainIdx = 0;
  let player = null, rivals = [], allRiders = [];

  let bannerText = '', bannerCol = '#ffc43d', bannerT = 0;
  function showBanner(text, col = '#ffc43d') {
    bannerText = text; bannerCol = col; bannerT = 1.75;
  }

  function startRide(mIdx = mountainIdx, modeId = 'freeride', diff = mIdx) {
    mountainIdx = mIdx;
    Course.init(MOUNTAINS[mountainIdx].id, modeId, 202611);
    Terrain.reset();
    Camera.reset();
    Particles.clear();
    Combat.reset();
    raceTime = 0;
    player = Physics.createRider({ id: 0, name: 'YOU', isPlayer: true, s: 12, u: 0, initSpeed: 10 });
    rivals = AI.spawnPack(diff);
    allRiders = [player, ...rivals];
    renderHUD(true);
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

  function applyGlobals(cam, aspect, t) {
    const m = Course.mountain;
    const sDir = v3.norm(m.sunDir);
    const ivp = m4.invert(cam.vp);

    const sc = [player.pos[0], player.pos[1], player.pos[2] - 14];
    const lEye = v3.mad(sc, sDir, 85);
    const lView = m4.lookAt(lEye, sc, [0, 1, 0]);
    const lProj = m4.ortho(-38, 38, -38, 38, 5, 195);
    const lVP = m4.mul(lProj, lView);

    setGlobalMat('viewProj', cam.vp);
    setGlobalMat('invViewProj', ivp);
    setGlobalMat('lightVP', lVP);
    setGlobalVec('camPos', cam.eye[0], cam.eye[1], cam.eye[2], t);
    setGlobalVec('sunDir', sDir[0], sDir[1], sDir[2], m.sunInt);
    setGlobalVec('sunCol', m.sunCol[0], m.sunCol[1], m.sunCol[2], m.exposure);
    setGlobalVec('skyZen', m.skyZen[0], m.skyZen[1], m.skyZen[2], m.fogDens);
    setGlobalVec('skyHor', m.skyHor[0], m.skyHor[1], m.skyHor[2], 0.02);
    setGlobalVec('groundCol', m.groundCol[0], m.groundCol[1], m.groundCol[2], m.idx);
    setGlobalVec('feel', Feel.speedNorm, player.adrenaline / 100, Feel.hitFlash, Feel.boostGlow);
    gfx.setGlobals(GBUF);
  }

  function stepSim(dt) {
    if (Feel.hitstop > 0) {
      Feel.hitstop = Math.max(0, Feel.hitstop - dt);
      return;
    }
    const simDt = Feel.slowMo > 0 ? dt * 0.45 : dt;
    raceTime += simDt;

    // 1. Player input & combat
    const inp = Input.sample(raceTime);
    if (inp.cam) Camera.cycle();
    if (inp.atkL) Combat.tryAttack(player, -1, allRiders, raceTime);
    else if (inp.atkR) Combat.tryAttack(player, 1, allRiders, raceTime);
    Physics.stepRider(player, inp, simDt, raceTime);

    // 2. 7 AI rivals (same physics engine!)
    for (let i = 0; i < rivals.length; i++) {
      const R = rivals[i];
      const aiInp = AI.decideInput(R, player, allRiders, simDt, raceTime);
      if (aiInp.atkL) Combat.tryAttack(R, -1, allRiders, raceTime);
      else if (aiInp.atkR) Combat.tryAttack(R, 1, allRiders, raceTime);
      Physics.stepRider(R, aiInp, simDt, raceTime);
    }
    AI.recycleEndless(rivals, player);

    // 3. Projectiles & rider-to-rider collisions
    Combat.step(allRiders, simDt, raceTime);
    updateRanks();

    // 4. Drain physics, stunts & combat events
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
        Feel.jolt(0.28, 0.25, 0);
        Sound.playHit(false);
      } else if (ev.type === 'nearmiss' && ev.rider.isPlayer) {
        if (Feel.nearMiss(ev.side)) { player.adrenaline = Math.min(100, player.adrenaline + 6); Sound.playWhoosh(); }
      }
    }
    for (const se of Stunts.drainEvents()) {
      if (se.type === 'trick_land') showBanner(`${se.name} ×${se.combo}  +${se.pts}`, '#ffc43d');
      else if (se.type === 'trick_bail') showBanner(`贪招翻车！痛失 ${se.lost} 分`, '#ff3155');
    }
    for (const ce of Combat.drainEvents()) {
      if (ce.type === 'takedown' && ce.attacker.isPlayer) {
        showBanner(ce.wasNemesis ? `宿敌反杀 ${ce.victim.name}! +$${ce.bounty}` : `击倒 ${ce.victim.name}! +$${ce.bounty}`, '#ff5b1f');
      } else if (ce.type === 'hit' && ce.attacker.isPlayer) {
        showBanner(`命中 ${ce.victim.name}!`, '#38e2ff');
      }
    }

    for (let i = 0; i < allRiders.length; i++) Particles.emitTire(allRiders[i], simDt);
    Particles.step(simDt);
    Sound.update(player, dt, true);
    Music.step(dt, Feel.speedNorm, player.adrenaline / 100, Course.mountain.idx);
    Feel.step(player, dt);
  }

  let hudTimer = 0;
  function renderHUD(force = false) {
    const ui = document.getElementById('ui');
    if (!ui) return;
    if (force) {
      ui.innerHTML = `
        <div style="position:absolute;top:14px;left:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div class="hud-chip" style="font-weight:900;color:#ff5b1f;">CRAZYBIKE · ${Course.mountain.name}</div>
          ${MOUNTAINS.map((mt, i) => `<button class="btn ${i === mountainIdx ? 'primary' : ''}" data-m="${i}">${mt.name}</button>`).join('')}
        </div>
        <div id="hud-rank" class="hud-chip" style="position:absolute;top:14px;right:16px;text-align:right;">
          <div id="hud-pos" style="font-size:32px;font-weight:900;line-height:1;">1<span style="font-size:14px;color:var(--muted);">/8</span></div>
          <div id="hud-ko" style="font-size:12px;color:#ffc43d;margin-top:4px;">K.O. 0 · 水壶 1</div>
        </div>
        <div id="hud-banner" style="position:absolute;top:22%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:900;text-shadow:0 4px 18px rgba(0,0,0,.75);letter-spacing:.05em;pointer-events:none;white-space:nowrap;"></div>
        <div id="hud-stat" class="hud-chip" style="position:absolute;bottom:16px;right:16px;text-align:right;min-width:175px;">
          <div id="hud-spd" style="font-size:34px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;">0 <span style="font-size:13px;color:var(--muted);">KM/H</span></div>
          <div id="hud-dist" style="font-size:12px;color:var(--muted);margin-top:4px;">0 m</div>
          <div style="height:6px;background:rgba(255,255,255,.15);border-radius:3px;margin-top:8px;overflow:hidden;">
            <div id="hud-adr" style="height:100%;width:25%;background:linear-gradient(90deg,#ffc43d,#ff5b1f);"></div>
          </div>
        </div>
        <div class="hud-chip" style="position:absolute;bottom:16px;left:16px;font-size:12px;color:var(--muted);">
          A/D 转向 · W 踩踏 · S 甩尾 · Space 跳 · Shift 暴走 · Q/E 或 J/K 左右暴打/砸水壶 · 空中方向键做特技
        </div>`;
      ui.querySelectorAll('button[data-m]').forEach(btn => {
        btn.onclick = () => startRide(+btn.dataset.m);
      });
    }
    const posEl = document.getElementById('hud-pos');
    const koEl = document.getElementById('hud-ko');
    const spdEl = document.getElementById('hud-spd');
    const distEl = document.getElementById('hud-dist');
    const adrEl = document.getElementById('hud-adr');
    const banEl = document.getElementById('hud-banner');
    if (posEl) posEl.innerHTML = `${player.rank}<span style="font-size:14px;color:var(--muted);">/${allRiders.length}</span>`;
    if (koEl) koEl.textContent = `K.O. ${player.takedowns} · ${Combat.TIER_NAMES[player.combatTier]} · 水壶 ${player.bottles}`;
    if (spdEl) spdEl.innerHTML = `${Math.round(player.speed * 3.6)} <span style="font-size:13px;color:var(--muted);">KM/H</span>`;
    if (distEl) distEl.textContent = `${Math.round(player.s)} / ${Course.finishS} m · 特技 ${player.totalTrickScore}`;
    if (adrEl) adrEl.style.width = `${Math.round(player.adrenaline)}%`;
    if (banEl) {
      if (player.air && player.trickType && player.trickScore > 20) {
        banEl.style.color = '#38e2ff';
        banEl.textContent = `${Stunts.TRICKS[player.trickType].name} ×${player.trickCombo}  ${Math.round(player.trickScore)}`;
      } else if (bannerT > 0) {
        banEl.style.color = bannerCol;
        banEl.textContent = bannerText;
      } else {
        banEl.textContent = '';
      }
    }
  }

  function frame(dt) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gfx.resize();
    }
    Post.ensureSize(w, h);

    time += dt;
    if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
    stepSim(dt);
    Terrain.update(player.s);
    const cam = Camera.update(player, dt, w / h, Feel);
    applyGlobals(cam, w / h, time);

    Solid.clear();
    Props.emit(player.s, time);
    for (let i = 0; i < allRiders.length; i++) {
      if (Math.abs(allRiders[i].s - player.s) < 260) BikeMesh.emitRider(allRiders[i], time);
    }
    Combat.emitProjectiles();
    Solid.upload();

    gfx.beginFrame();
    gfx.beginPass(Post.shadowTarget, { depth: 1.0 });
    Solid.drawShadow();
    gfx.endPass();

    gfx.beginPass(Post.sceneTarget, { color: [0.1, 0.1, 0.12, 1], depth: 1.0 });
    Sky.draw();
    Terrain.draw(Post.shadowTex);
    Solid.drawColor(Post.shadowTex);
    Particles.draw(cam.viewM);
    gfx.endPass();

    Post.present();
    gfx.endFrame();

    hudTimer += dt;
    if (hudTimer > 0.06) { hudTimer = 0; renderHUD(false); }
  }

  async function boot() {
    canvas = document.getElementById('gl');
    Input.init(canvas);
    gfx = await createGfx(canvas);
    Post.init(gfx);
    Sky.init(gfx);
    Terrain.init(gfx);
    Solid.init(gfx);
    Particles.init(gfx);
    addEventListener('pointerdown', () => { Sound.unlock(); Music.setPlaying(true); }, { once: true });
    addEventListener('keydown', () => { Sound.unlock(); Music.setPlaying(true); }, { once: true });
    if (gfx.finishPipelineAsync) await new Promise(r => setTimeout(r, 80));
    startRide(0);

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    window.__bike = {
      version: BUILD_HASH,
      ready: true,
      backend: gfx.caps.backend,
      state: () => ({
        s: player.s, u: player.u, speed: player.speed, rank: player.rank,
        takedowns: player.takedowns, trickScore: player.totalTrickScore,
        rivals: rivals.map(r => ({ name: r.name, s: Math.round(r.s), rank: r.rank, nemesis: r.nemesis, crashed: r.crashed })),
        minCamClear: Camera.minClearance,
      }),
      setMountain: id => { const i = MOUNTAINS.findIndex(m => m.id === id); if (i >= 0) startRide(i); },
    };
  }

  boot().catch(e => {
    console.error(e);
    const ui = document.getElementById('ui');
    if (ui) ui.innerHTML = `<pre style="color:#ff5566;padding:20px;">Boot error: ${e.stack || e.message}</pre>`;
  });
})();
