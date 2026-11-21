// Automated headless verification suite for CrazyBike V2
// Checks: 1) All 9 WGSL+GLSL GPU pipelines  2) SDF RiderMesh build speed, material split & 0 NaN
//         3) 4-mountain cliffs/step-downs + 3600-frame 8-rider physics & perf (<6ms/frame)
//         4) All 8 camera views ground clearance + non-blocking chase framing + FPV lensCut + Photo Mode
//         5) 8 air tricks, forgiving auto-landing, glowing 3D ribbons, Endless recycler, Career & I18N.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js') && f !== '99_main.js').sort();

const store = {};
const ctx = vm.createContext({
  location: { search: '', hash: '', pathname: '/' },
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { getElementById: () => null, documentElement: {} },
  addEventListener: () => {},
  innerWidth: 1280,
  innerHeight: 720,
  navigator: { languages: ['zh-CN'], language: 'zh-CN' },
  devicePixelRatio: 1,
  performance: { now: () => Date.now() },
  console,
  process,
});
ctx.window = ctx;
ctx.self = ctx;

for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(srcDir, f), 'utf8'), ctx, { filename: f });
}

vm.runInContext(`
  let failures = 0;
  function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); failures++; }
    else console.log('PASS:', msg);
  }

  // 1. Verify all 9 GPU pipelines translate cleanly to both WGSL and GLSL ES 3.00 + SDF RiderMesh audit
  const pipes = [];
  const mockGfx = {
    buffer: () => ({ id: 1 }),
    texture: () => ({ id: 1 }),
    target: () => ({ id: 1 }),
    destroyTarget: () => {},
    destroyTexture: () => {},
    updateBuffer: () => {},
    updateTexture: () => {},
    pipeline: (desc) => {
      const w = buildShader(desc, 'wgsl');
      const g = buildShader(desc, 'glsl');
      if (!w.code || !g.vs || !g.fs) throw new Error('Empty shader output: ' + desc.name);
      pipes.push(desc.name);
      return { id: pipes.length, desc };
    },
  };
  Post.init(mockGfx); Sky.init(mockGfx); Terrain.init(mockGfx); Solid.init(mockGfx); Particles.init(mockGfx);
  assert(pipes.length >= 9, 'All ' + pipes.length + ' GPU pipelines compiled to WGSL + GLSL (' + pipes.join(', ') + ')');

  const rm = RiderMesh.info();
  let badRm = 0;
  const matIds = new Set();
  for (let i = 0; i < rm.V.length; i++) if (!Number.isFinite(rm.V[i])) badRm++;
  for (let i = 0; i < rm.W.length; i++) if (!Number.isFinite(rm.W[i])) badRm++;
  for (let i = 0; i < rm.nv; i++) matIds.add(Math.round(rm.V[i * 10 + 6]));
  assert(rm && rm.nv > 3000 && rm.ms < 4000 && badRm === 0 && matIds.size >= 8,
    'SDF RiderMesh valid (' + rm.nv + ' verts, ' + (rm.ni / 3) + ' tris, ' + matIds.size + ' gear materials in ' + Math.round(rm.ms) + 'ms)');

  // 2. 4-mountain cliffs, vertical step-downs, terrain streaming & 8-rider simulation audit
  const t0 = Date.now();
  for (let mi = 0; mi < MOUNTAINS.length; mi++) {
    const m = MOUNTAINS[mi];
    Course.init(m.id, 'freeride', 202611 + mi * 77);
    Terrain.reset();
    Terrain.update(120);
    Camera.reset();
    Combat.reset();

    const cliffSegs = Course.segs.filter(s => s.cliffSide !== 0).length;
    const dropsN = Course.drops.length;

    const P = Physics.createRider({ isPlayer: true, s: 12, u: 0, initSpeed: 12, upgrades: { frame: mi, fork: mi, drive: mi, tires: mi, combat: mi } });
    const R = AI.spawnPack(mi);
    const all = [P, ...R];
    let kos = 0;

    for (let i = 0; i < 900; i++) {
      const t = i / 60;
      const pInp = AI.decideInput(P, R[0], all, 1 / 60, t);
      if (i % 35 === 0) Combat.tryAttack(P, (i % 70 === 0) ? -1 : 1, all, t);
      Physics.stepRider(P, pInp, 1 / 60, t);
      for (const ai of R) {
        const aInp = AI.decideInput(ai, P, all, 1 / 60, t);
        if (aInp.atkL) Combat.tryAttack(ai, -1, all, t);
        else if (aInp.atkR) Combat.tryAttack(ai, 1, all, t);
        Physics.stepRider(ai, aInp, 1 / 60, t);
      }
      Combat.step(all, 1 / 60, t);
      Camera.update(P, 1 / 60, 16 / 9, Feel, false);
      for (const ce of Combat.drainEvents()) if (ce.type === 'takedown') kos++;
      Stunts.drainEvents();
      Physics.drainEvents();
      if (i % 120 === 0) {
        Solid.clear(); Props.emit(P.s, t);
        for (const r of all) BikeMesh.emitRider(r, t);
        Combat.emitProjectiles(); Solid.upload();
      }
    }
    const minAiS = Math.min(...R.map(r => r.s));
    assert(
      P.s > 260 && minAiS > 220 && Camera.minClearance >= 0.40 && cliffSegs >= 1 && dropsN >= 4,
      m.id + ' audit -> player=' + Math.round(P.s) + 'm, minAI=' + Math.round(minAiS) + 'm, maxSpd=' + Math.round(P.maxSpeed * 3.6) + 'km/h, cliffs=' + cliffSegs + ', drops=' + dropsN + ', KOs=' + kos
    );
  }
  const simMs = Date.now() - t0;
  const msPerFrame = simMs / (MOUNTAINS.length * 900);
  assert(msPerFrame < 6.0, 'All 4 mountains terrain + 3600 frames of 8-rider physics averaged ' + msPerFrame.toFixed(2) + 'ms/frame (<6ms budget)');

  // 3. All 8 slope-adaptive camera views, high-pitch chase framing revealing road 30m ahead, FPV lensCut & Photo Mode
  Course.init('redrock', 'freeride', 202611);
  const PC = Physics.createRider({ isPlayer: true, s: 75, u: 0, initSpeed: 28 });
  let camOk = true, fpvCutOk = false, headNdcY = 1, road30NdcY = -2;
  for (const v of Camera.VIEWS) {
    Camera.reset(); Camera.setView(v.id);
    const c = Camera.update(PC, 1 / 60, 16 / 9, Feel, false);
    if (c.vp.some(x => !Number.isFinite(x)) || Camera.minClearance < 0.25) camOk = false;
    if (v.id === 'fpv') fpvCutOk = (RiderMesh.fpvRiderId === PC.id);
    if (v.id === 'chase') {
      const m = c.vp, hy = PC.pos[1] + 1.85;
      headNdcY = (m[1] * PC.pos[0] + m[5] * hy + m[9] * PC.pos[2] + m[13]) / (m[3] * PC.pos[0] + m[7] * hy + m[11] * PC.pos[2] + m[15]);
      const sp30 = Course.at(PC.s + 30), rz30 = -sp30.s, ry30 = Course.height(sp30.cx, rz30);
      road30NdcY = (m[1] * sp30.cx + m[5] * ry30 + m[9] * rz30 + m[13]) / (m[3] * sp30.cx + m[7] * ry30 + m[11] * rz30 + m[15]);
    }
  }
  Photo.enter(PC.pos, Camera.lastCam);
  const pCam = Photo.step(1 / 60, 16 / 9);
  Photo.exit();
  assert(camOk && fpvCutOk && headNdcY < -0.25 && road30NdcY > headNdcY + 0.08 && road30NdcY < 0.70 && pCam && !pCam.vp.some(x => !Number.isFinite(x)),
    'All 8 slope-adaptive cams valid, chase headNdcY=' + headNdcY.toFixed(3) + ' (lower third), cliffDrop30mNdcY=' + road30NdcY.toFixed(3) + ' (clearly above helmet), FPV lensCut=ON');

  // 4. V4 Airtime-budgeted sequential random trick chaining (complete one before next, zero crash) + ink ribbons + zero post-land bounce
  Particles.clear();
  const RS = Physics.createRider({ isPlayer: true, s: 60, u: 0, initSpeed: 28 });
  RS.air = true; RS.pos[1] += 56.0; RS.vel[1] = 4.5;
  const chain = [];
  let maxRibVerts = 0, landedAt = -1, reboundAfterLand = 0, prematureSwitch = false;
  for (let i = 0; i < 360; i++) {
    const prevType = RS.trickType;
    const prevTimer = RS._trickTimer || 0;
    const prevDur = RS._trickDur || 0.7;
    const inp = i < 220
      ? { jump: true, trickLeft: (i % 40) < 20, trickRight: (i % 40) >= 20, pedal: true }
      : { pedal: true };
    Physics.stepRider(RS, inp, 1 / 60, i / 60);
    if (RS.air && RS.trickType) {
      if (chain.length === 0 || chain[chain.length - 1] !== RS.trickType) chain.push(RS.trickType);
      if (prevType && prevType !== RS.trickType && prevTimer + 0.02 < prevDur) prematureSwitch = true;
    }
    Particles.emitTire(RS, 1 / 60); Particles.step(1 / 60);
    maxRibVerts = Math.max(maxRibVerts, Particles.ribbonCount());
    if (landedAt < 0 && !RS.air && i > 10) landedAt = i;
    else if (landedAt >= 0 && i < landedAt + 25 && RS.air) reboundAfterLand++;
  }
  const Rbf = Physics.createRider({ isPlayer: true, s: 60, u: 0, initSpeed: 24 });
  Rbf.trickType = 'backflip'; Rbf.trickDone = false; Rbf.trickPitch = 3.0; Rbf.trickScore = 400;
  const bfBail = Stunts.onLand(Rbf, 12, 18);
  assert(!RS.crashed && !prematureSwitch && chain.length >= 2 && reboundAfterLand === 0 && maxRibVerts > 24 && bfBail === false,
    'V4 Stunts complete-then-chain (' + chain.join(' -> ') + '), zero premature switch, zero post-land bounce, inkRibbons=' + maxRibVerts + ', zeroCrash=OK');

  // 5. Endless recycler, Career progression & I18N ZH/EN switch
  Course.init('town', 'endless', todaySeed());
  const PE = Physics.createRider({ isPlayer: true, s: 1250, u: 0, initSpeed: 26 });
  const RE = AI.spawnPack(2);
  AI.recycleEndless(RE, PE);
  assert(RE.every(r => r.s > PE.s && r.s < PE.s + 260), 'Endless mode recycled all 7 AI rivals cleanly ahead of player');

  const pay = Career.recordCareerFinish(Career.EVENTS[0], { rank: 1, time: 65, dist: 2100, takedowns: 3, trickScore: 1600, crashes: 0, maxSpeedKmh: 108, finished: true });
  assert(pay.total > 1000 && Career.isMountainUnlocked('forest') && Career.buyUpgrade('fork'), 'Career payout, mountain unlock & garage upgrade OK');

  I18N.setLang('en');
  const enOk = I18N.t('出发') === 'START' && I18N.t('拍照模式') === 'Photo Mode';
  I18N.setLang('zh');
  assert(enOk && I18N.t('出发') === '出发', 'I18N bilingual ZH/EN switch OK');

  // 6. V3 Wildlife 4-biome spawning + Quality-tier shadow scaling (512 / 1024 / 2048)
  let wildOk = true;
  for (const m of MOUNTAINS) {
    Course.init(m.id, 'freeride', 202611);
    Wildlife.reset();
    Wildlife.step(60, 0.2, 'high');
    const cHi = Wildlife.count();
    Wildlife.step(60, 0.2, 'smooth');
    const cLo = Wildlife.count();
    Solid.clear(); Wildlife.emit(); Solid.upload();
    if (cHi !== 16 || cLo !== 4) wildOk = false;
  }
  Post.setQuality('high'); const shHi = Post.shadowSize;
  Post.setQuality('smooth'); const shLo = Post.shadowSize;
  Post.setQuality('auto'); const shAu = Post.shadowSize;
  assert(wildOk && shHi === 2048 && shAu === 1024 && shLo === 512,
    'V3 4-biome Wildlife (high=16, smooth=4) & Quality Shadow Maps (2048/1024/512) OK');

  if (failures > 0) process.exit(1);
  console.log('\\nALL CRAZYBIKE V3 CHECKS PASSED!');
`, ctx);
