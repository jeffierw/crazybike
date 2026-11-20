// ---------------------------------------------------------------- 99_main: Step 2 4-biome terrain & sky renderer bootstrap
const App = (() => {
  let gfx = null, canvas = null, time = 0, flyS = 20;
  let mountainIdx = 0;

  function applyBiomeGlobals(camPos, lookAt, aspect, t) {
    const m = Course.mountain;
    const sDir = v3.norm(m.sunDir);
    const view = m4.lookAt(camPos, lookAt, [0, 1, 0]);
    const proj = m4.perspective(66 * PI / 180, aspect, 0.35, 900);
    const vp = m4.mul(proj, view);
    const ivp = m4.invert(vp);

    // Shadow frustum centered ahead of camera
    const sc = [lookAt[0], lookAt[1], lookAt[2]];
    const lEye = v3.mad(sc, sDir, 90);
    const lView = m4.lookAt(lEye, sc, [0, 1, 0]);
    const lProj = m4.ortho(-45, 45, -45, 45, 5, 220);
    const lVP = m4.mul(lProj, lView);

    setGlobalMat('viewProj', vp);
    setGlobalMat('invViewProj', ivp);
    setGlobalMat('lightVP', lVP);
    setGlobalVec('camPos', camPos[0], camPos[1], camPos[2], t);
    setGlobalVec('sunDir', sDir[0], sDir[1], sDir[2], m.sunInt);
    setGlobalVec('sunCol', m.sunCol[0], m.sunCol[1], m.sunCol[2], m.exposure);
    setGlobalVec('skyZen', m.skyZen[0], m.skyZen[1], m.skyZen[2], m.fogDens);
    setGlobalVec('skyHor', m.skyHor[0], m.skyHor[1], m.skyHor[2], 0.02);
    setGlobalVec('groundCol', m.groundCol[0], m.groundCol[1], m.groundCol[2], m.idx);
    setGlobalVec('feel', 0.25, 0, 0, 0);
    gfx.setGlobals(GBUF);
  }

  function renderFrame(dt) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gfx.resize();
    }
    Post.ensureSize(w, h);

    time += dt;
    flyS += dt * 24;
    if (flyS > 1700) flyS = 20;
    const sp = Course.at(flyS);
    const spAhead = Course.at(flyS + 28);
    const cx = sp.cx, cz = -flyS, cy = Course.height(cx, cz) + 4.8;
    const tx = spAhead.cx, tz = -(flyS + 28), ty = Course.height(tx, tz) + 1.8;

    Terrain.update(flyS);
    applyBiomeGlobals([cx, cy, cz], [tx, ty, tz], w / h, time);

    gfx.beginFrame();
    gfx.beginPass(Post.shadowTarget, { depth: 1.0 });
    gfx.endPass();

    gfx.beginPass(Post.sceneTarget, { color: [0.1, 0.1, 0.12, 1], depth: 1.0 });
    Sky.draw();
    Terrain.draw(Post.shadowTex);
    gfx.endPass();

    Post.present();
    gfx.endFrame();
  }

  function renderStep2UI() {
    const ui = document.getElementById('ui');
    if (!ui) return;
    const m = Course.mountain;
    ui.innerHTML = `<div style="position:absolute;top:14px;left:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <div class="hud-chip" style="font-weight:900;color:#ff5b1f;">CRAZYBIKE · ${m.name} (${gfx.caps.name})</div>
      ${MOUNTAINS.map((mt, i) => `<button class="btn ${i === mountainIdx ? 'primary' : ''}" data-m="${i}">${mt.name}</button>`).join('')}
    </div>`;
    ui.querySelectorAll('button[data-m]').forEach(btn => {
      btn.onclick = () => {
        mountainIdx = +btn.dataset.m;
        Course.init(MOUNTAINS[mountainIdx].id, 'freeride', 202611);
        Terrain.reset();
        flyS = 20;
        renderStep2UI();
      };
    });
  }

  async function boot() {
    canvas = document.getElementById('gl');
    Course.init(MOUNTAINS[0].id, 'freeride', 202611);
    gfx = await createGfx(canvas);
    Post.init(gfx);
    Sky.init(gfx);
    Terrain.init(gfx);
    if (gfx.finishPipelineAsync) {
      // Wait for async WebGPU pipelines on first load
      await new Promise(r => setTimeout(r, 80));
    }
    renderStep2UI();

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      renderFrame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    window.__bike = {
      version: BUILD_HASH,
      ready: true,
      backend: gfx.caps.backend,
      setMountain(id) {
        const idx = MOUNTAINS.findIndex(m => m.id === id);
        if (idx >= 0) {
          mountainIdx = idx;
          Course.init(id, 'freeride', 202611);
          Terrain.reset();
          flyS = 20;
          renderStep2UI();
        }
      },
      step(dt = 1 / 60) { renderFrame(dt); },
    };
  }

  boot().catch(e => {
    console.error(e);
    const ui = document.getElementById('ui');
    if (ui) ui.innerHTML = `<pre style="color:#ff5566;padding:20px;">Boot error: ${e.stack || e.message}</pre>`;
  });
})();
