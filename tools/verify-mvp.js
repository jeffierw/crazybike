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
const listeners = { keydown: [], keypress: [], keyup: [] };
const ctx = vm.createContext({
  location: { search: '', hash: '', pathname: '/' },
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { getElementById: () => null, documentElement: {} },
  addEventListener: (ev, fn) => { if (!listeners[ev]) listeners[ev] = []; listeners[ev].push(fn); },
  dispatchMockKey: (evType, props) => {
    const e = Object.assign({ defaultPrevented: false, target: {}, preventDefault() { this.defaultPrevented = true; } }, props);
    for (const fn of (listeners[evType] || [])) fn(e);
    return e;
  },
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
  assert(pipes.length >= 10, 'All ' + pipes.length + ' GPU pipelines compiled to WGSL + GLSL (' + pipes.join(', ') + ')');

  const rm = RiderMesh.info();
  let badRm = 0;
  const matIds = new Set();
  for (let i = 0; i < rm.V.length; i++) if (!Number.isFinite(rm.V[i])) badRm++;
  for (let i = 0; i < rm.W.length; i++) if (!Number.isFinite(rm.W[i])) badRm++;
  for (let i = 0; i < rm.nv; i++) matIds.add(Math.round(rm.V[i * 10 + 6]));
  assert(rm && rm.nv > 3000 && rm.ms < 4000 && badRm === 0 && matIds.size >= 8,
    'SDF RiderMesh valid (' + rm.nv + ' verts, ' + (rm.ni / 3) + ' tris, ' + matIds.size + ' gear materials in ' + Math.round(rm.ms) + 'ms)');

  // 2. 4-mountain cliffs (random 6..66m), halfpipes, creeks, waterfalls, dodge-only zero-crash 8-rider simulation audit
  const t0 = Date.now();
  let minDropH = 999, maxDropH = 0, totalCrashes = 0, halfpipeSegs = 0, waterfallDrops = 0, activeCreeks = 0;
  for (let mi = 0; mi < MOUNTAINS.length; mi++) {
    const m = MOUNTAINS[mi];
    Course.init(m.id, 'freeride', 202611 + mi * 77);
    Terrain.reset();
    Terrain.update(120);
    Camera.reset();
    Combat.reset();

    const cliffSegs = Course.segs.filter(s => s.cliffSide !== 0).length;
    halfpipeSegs += Course.segs.filter(s => s.type === 'halfpipe').length;
    waterfallDrops += Course.drops.filter(d => d.hasWaterfall).length;
    if (Course.creekAt(90).active) activeCreeks++;
    for (const dr of Course.drops) { minDropH = Math.min(minDropH, dr.dropH); maxDropH = Math.max(maxDropH, dr.dropH); }
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
      for (const pe of Physics.drainEvents()) {
        if (pe.type === 'crash') totalCrashes++;
      }
      if (i % 120 === 0) {
        Solid.clear(); Props.emit(P.s, t, 'auto', P.pos[0]);
        for (const r of all) BikeMesh.emitRider(r, t);
        Combat.emitProjectiles(); Solid.upload();
      }
    }
    const minAiS = Math.min(...R.map(r => r.s));
    assert(
      P.s > 260 && minAiS > 200 && Camera.minClearance >= 0.40 && cliffSegs >= 1 && dropsN >= 4,
      m.id + ' audit -> player=' + Math.round(P.s) + 'm, minAI=' + Math.round(minAiS) + 'm, maxSpd=' + Math.round(P.maxSpeed * 3.6) + 'km/h, cliffs=' + cliffSegs + ', drops=' + dropsN + ', KOs=' + kos
    );
  }
  const simMs = Date.now() - t0;
  const msPerFrame = simMs / (MOUNTAINS.length * 900);
  assert(
    msPerFrame < 6.0 && totalCrashes === 0 && minDropH <= 15 && maxDropH >= 34 && halfpipeSegs >= 4 && waterfallDrops >= 4 && activeCreeks >= 2,
    'V5 World & Dodge audit: obstacleCrashes=' + totalCrashes + ', cliffRange=' + minDropH.toFixed(1) + '..' + maxDropH.toFixed(1) + 'm, halfpipes=' + halfpipeSegs + ', waterfalls=' + waterfallDrops + ', perf=' + msPerFrame.toFixed(2) + 'ms/frame'
  );

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

  // 5. V4 Infinite boundary-free Endless slope + dodge-only head-on test + Career + I18N
  Course.init('forest', 'endless', todaySeed());
  Terrain.reset();
  const PInf = Physics.createRider({ isPlayer: true, s: 40, u: 0, initSpeed: 28 });
  for (let i = 0; i < 420; i++) Physics.stepRider(PInf, { steer: 1, pedal: true }, 1 / 60, i / 60);
  Terrain.update(PInf.s, PInf.pos[0]);
  const infTrees = Course.obstaclesNear(PInf.s - 20, PInf.s + 140, PInf.pos[0]);
  // Aim dead-on at an obstacle to verify smooth dodge with zero ragdoll crash
  const targetObs = infTrees[0];
  const RDodge = Physics.createRider({ isPlayer: true, s: Math.max(20, targetObs.s - 6), u: targetObs.x - Course.at(targetObs.s - 6).cx, initSpeed: 28 });
  RDodge.pos[0] = targetObs.x; RDodge.pos[2] = targetObs.z + 4; RDodge.vel = [0, 0, -28]; RDodge.yaw = 0;
  for (let i = 0; i < 60; i++) Physics.stepRider(RDodge, { pedal: true }, 1 / 60, i / 60);
  assert(Math.abs(PInf.u) > 105 && !PInf.crashed && infTrees.length >= 10 && !RDodge.crashed && RDodge.speed > 5,
    'V4 Endless boundary-free (u=' + Math.round(PInf.u) + 'm, trees=' + infTrees.length + ') & Head-on Dodge-only (speed=' + Math.round(RDodge.speed) + ', crashed=false) OK');

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

  // 7. V4 Browser shortcut guard on J/K & no Camera orbit conflict
  Input.init(null); Camera.bindInput({ addEventListener() {} });
  const evJ = dispatchMockKey('keydown', { code: 'KeyJ' });
  const evK = dispatchMockKey('keydown', { code: 'KeyK' });
  const evCtrlK = dispatchMockKey('keydown', { code: 'KeyK', ctrlKey: true });
  assert(evJ.defaultPrevented && evK.defaultPrevented && evCtrlK.defaultPrevented && !Camera.orbit.keys.KeyJ && !Camera.orbit.keys.KeyK,
    'V4 J/K & Ctrl+K browser shortcut prevention + zero camera orbit hijack OK');

  // 6. V5 Sparse Wildlife, Memory-Aware Quality, Cold-Smoke Audio Mix, Adaptive AI Pack & Configurable Combat Knockdowns
  let wildOk = true;
  for (const m of MOUNTAINS) {
    Course.init(m.id, 'freeride', 202611);
    Wildlife.reset();
    Wildlife.step(60, 0.2, 'high');
    const cHi = Wildlife.count();
    if (m.id === 'volcano' && !Wildlife.list().every(c => c.isBird)) wildOk = false;
    Wildlife.step(60, 0.2, 'low');
    const cLo = Wildlife.count();
    Solid.clear(); Wildlife.emit(); Solid.upload();
    if (cHi !== 3 || cLo !== 1) wildOk = false;
  }
  Post.setQuality('high'); const shHi = Post.shadowSize;
  Post.setQuality('low');  const shLo = Post.shadowSize;
  Post.setQuality('balanced'); const shBa = Post.shadowSize;
  const q2 = Quality.detect({ memGB: 2 });
  const q4 = Quality.detect({ memGB: 4 });
  const q8 = Quality.detect({ memGB: 8, isMobile: false });
  const qDesc = Quality.describe('zh', { memGB: 8, isMobile: false });
  assert(wildOk && shHi === 2048 && shBa === 1024 && shLo === 512 &&
    q2 === 'low' && q4 === 'balanced' && q8 === 'high' &&
    Quality.normalizePick('smooth') === 'low' &&
    qDesc.includes('8 GB') && qDesc.includes('2048px'),
    'V5 Memory-Aware Quality (2GB->' + q2 + ', 4GB->' + q4 + ', 8GB->' + q8 + ', shadows 2048/1024/512) & Wildlife OK');

  const mix = Sound.getMixProfile();
  assert(mix.musicVol >= 0.80 && mix.windMaxGain <= 0.25 && mix.windShelfMaxDb < 0,
    'V5 Cold-Smoke Audio Mix calibrated (musicVol=' + mix.musicVol + ', windMaxGain=' + mix.windMaxGain.toFixed(3) + ', shelfMax=' + mix.windShelfMaxDb + 'dB)');

  // Adaptive AI Pack: matches upgrades (Lv0 vs Lv4) & distributes strong / match / weak rivals around player
  const lowPack = AI.spawnPack(0, { avgUpg: 0, playerSkill: 0.42 });
  const hiPack  = AI.spawnPack(0, { avgUpg: 4, playerSkill: 0.72 });
  const avgTier = arr => arr.reduce((a, r) => a + r.aiTier, 0) / arr.length;
  const lowAvg = avgTier(lowPack), hiAvg = avgTier(hiPack);
  const strongP = hiPack.filter(r => r.aiBand === 'strong').map(r => r.aiPaceMul);
  const matchP  = hiPack.filter(r => r.aiBand === 'match').map(r => r.aiPaceMul);
  const weakP   = hiPack.filter(r => r.aiBand === 'weak').map(r => r.aiPaceMul);
  const sBefore = Career.data.playerSkill;
  Career.recordCareerFinish(Career.EVENTS[0], { rank: 1, time: 62, dist: 2100, takedowns: 2, trickScore: 1200, crashes: 0, maxSpeedKmh: 112, finished: true });
  const sAfterWin = Career.data.playerSkill;
  Career.recordCareerFinish(Career.EVENTS[0], { rank: 8, time: 95, dist: 2100, takedowns: 0, trickScore: 100, crashes: 2, maxSpeedKmh: 82, finished: true });
  const sAfterLoss = Career.data.playerSkill;
  assert(lowAvg <= 0.6 && hiAvg >= 3.4 && strongP.length === 2 && matchP.length === 3 && weakP.length === 2 &&
    Math.min(...strongP) > Math.max(...matchP) && Math.min(...matchP) > Math.max(...weakP) &&
    sAfterWin > sBefore && sAfterLoss < sAfterWin,
    'V5 Adaptive AI Pack (Lv0 avg=' + lowAvg.toFixed(2) + ' -> Lv4 avg=' + hiAvg.toFixed(2) + ', strong/match/weak ordered, skill EMA ' + sBefore + '->' + sAfterWin + '->' + sAfterLoss + ') OK');

  // Configurable Combat Knockdown Toggle (ON -> ragdoll KO & respawn; OFF -> dodge shove only)
  Course.init('redrock', 'freeride', 202611);
  Physics.setKnockdown(true);
  const VKo = Physics.createRider({ isPlayer: false, s: 80, u: 0, initSpeed: 24 });
  Physics.knockdownRider(VKo, 'melee_ko', 9, -3);
  const koCrashed = VKo.crashed === true;
  for (let i = 0; i < 90; i++) Physics.stepRider(VKo, { pedal: true }, 1 / 60, i / 60);
  const koRespawned = VKo.crashed === false;

  Physics.setKnockdown(false);
  const VShove = Physics.createRider({ isPlayer: false, s: 80, u: 0, initSpeed: 24 });
  Physics.knockdownRider(VShove, 'melee_ko', 9, -3);
  const shoveNotCrashed = VShove.crashed === false && VShove.wobble > 0.2;
  Physics.setKnockdown(true);
  assert(koCrashed && koRespawned && shoveNotCrashed,
    'V5 Combat Knockdown Toggle OK (ON: ragdoll->respawn, OFF: shove-only, obstacles remain zero-crash)');

  // 7. V6 Live Camera Preview, Upright Mid-Trick Respawn, Pickups, Punch vs Flying-Kick Knockdown, Scenery & Prop Collision FX
  Course.init('redrock', 'freeride', 202611);
  Camera.reset(); Camera.setView('fpv'); Camera.resetOrbit(); Camera.snapNext();
  const prevFpvCam = Camera.update(Physics.createRider({ isPlayer: true, s: 12, u: 0, initSpeed: 0 }), 1 / 60, 16 / 9, Feel, true, true);
  const fpvPreviewOk = RiderMesh.fpvRiderId === 0 && !prevFpvCam.vp.some(x => !Number.isFinite(x));
  Camera.setView('chase');

  // Mid-trick knockdown respawn must completely clear trickYaw / trickPitch / trickRoll / steer / roll!
  const RK = Physics.createRider({ isPlayer: true, s: 70, u: 2, initSpeed: 28 });
  RK.trickType = 'tabletop'; RK.trickRoll = 1.05; RK.trickYaw = 0.92; RK.trickPitch = -0.6; RK.steer = 0.78; RK.roll = -0.55;
  Physics.knockdownRider(RK, 'kick_ko', 8, -3);
  for (let i = 0; i < 85; i++) Physics.stepRider(RK, { pedal: true }, 1 / 60, i / 60);
  const uprightOk = !RK.crashed && RK.trickYaw === 0 && RK.trickRoll === 0 && RK.trickPitch === 0 && Math.abs(RK.roll) < 0.05;

  // Pickups: initial bottles === 0 (no free passive refill), pickup nitro/bottle along course works, bottle tracking bounded <= 26m, bump/punch NO crash vs kick KO!
  const PP = Physics.createRider({ isPlayer: true, s: 12, u: 0, initSpeed: 24 });
  const initZeroBottles = PP.bottles === 0;
  const pks = Course.pickupsNear(20, 220);
  const nitroPk = pks.find(p => p.kind === 'nitro') || pks[0];
  const bottlePk = pks.find(p => p.kind === 'bottle') || pks[0];
  Combat.reset();
  if (nitroPk) { PP.pos = [nitroPk.x, nitroPk.y - 0.8, nitroPk.z]; PP.s = nitroPk.s; Combat.step([PP], 1 / 60, 1); }
  const nitroGained = PP.adrenaline > 25;
  if (bottlePk) { PP.pos = [bottlePk.x, bottlePk.y - 0.8, bottlePk.z]; PP.s = bottlePk.s; Combat.step([PP], 1 / 60, 1.1); }
  const bottleGained = PP.bottles >= 1;

  // Punch NEVER knocks down; boost bump NEVER knocks down; Flying Kick DOES knock down!
  const RAtt = Physics.createRider({ isPlayer: true, s: 100, u: 0, initSpeed: 28 });
  const RVic = Physics.createRider({ isPlayer: false, s: 100.8, u: 1.4, initSpeed: 26 });
  RAtt.boosting = true;
  Combat.step([RAtt, RVic], 1 / 60, 2.0);
  const bumpNoKo = !RVic.crashed;
  Combat.tryAttack(RAtt, 1, [RAtt, RVic], 2.1, 'punch');
  const punchNoKo = !RVic.crashed && RAtt.attackKind === 'punch';
  RAtt.attackCd = 0;
  Combat.tryAttack(RAtt, 1, [RAtt, RVic], 2.6, 'kick');
  const kickDoesKo = RVic.crashed === true && RAtt.attackKind === 'kick';

  // Prop collision sway & debris emitter across all 4 biomes
  Solid.clear();
  for (let bi = 0; bi < MOUNTAINS.length; bi++) {
    Course.init(MOUNTAINS[bi].id, 'freeride', 202611 + bi);
    const obs0 = Course.obstaclesNear(40, 140)[0];
    if (obs0) {
      Props.onHit(obs0, 0.8, -0.6, 26);
      Particles.burstDebris(obs0.kind, [obs0.x, obs0.y + 1, obs0.z], [0.8, -0.6]);
    }
    Props.emit(80, 1.5, 'high');
    Wildlife.step(80, 0.2, 'high'); Wildlife.emit();
  }
  Solid.upload();

  assert(fpvPreviewOk && uprightOk && initZeroBottles && pks.length >= 2 && nitroGained && bottleGained &&
    bumpNoKo && punchNoKo && kickDoesKo && Combat.MAX_BOTTLE_TRACK <= 26 && Props.activeHitCount() >= 1,
    'V6 CamPreview, UprightRespawn, Pickups (' + pks.length + ' items), StrictKO (bump=' + (!bumpNoKo) + ', punch=' + (!punchNoKo) + ', kick=' + kickDoesKo + '), Flora/PropHit OK');

  // 8. V7 Horizon-stretched terrain bounds, realistic flat-ground hops vs kicker big air, and 3D persistent tire tracks
  Course.init('redrock', 'freeride', 202611);
  Terrain.reset(); Terrain.update(60);
  const tb = Terrain.bounds();

  const measureHop = (holdFrames) => {
    const RH = Physics.createRider({ isPlayer: true, s: 25, u: 0, initSpeed: 22 });
    let peakRel = 0;
    for (let i = 0; i < holdFrames; i++) Physics.stepRider(RH, { pedal: true, jump: true }, 1 / 60, i / 60);
    for (let i = 0; i < 65; i++) {
      Physics.stepRider(RH, { pedal: true, jump: false }, 1 / 60, (holdFrames + i) / 60);
      const gy = Course.height(RH.pos[0], RH.pos[2]);
      peakRel = Math.max(peakRel, RH.pos[1] - gy);
    }
    return peakRel;
  };
  const tapPeak = measureHop(3);
  const fullPeak = measureHop(24);

  const rm0 = Course.ramps[0];
  const spRm = Course.at(Math.max(20, rm0.s - rm0.len * 0.65));
  const RRm = Physics.createRider({ isPlayer: true, s: spRm.s, u: rm0.u, initSpeed: 26 });
  RRm.vel = [0, -10, -26]; RRm.yaw = 0;
  let rampPeak = 0;
  for (let i = 0; i < 120; i++) {
    const distToLip = rm0.s - RRm.s;
    const hold = distToLip > 0.8 && distToLip < rm0.len * 0.65;
    Physics.stepRider(RRm, { pedal: true, jump: hold }, 1 / 60, i / 60);
    rampPeak = Math.max(rampPeak, RRm.pos[1] - Course.height(RRm.pos[0], RRm.pos[2]));
  }

  let tracksAllOk = true;
  let totalTrk = 0;
  for (let bi = 0; bi < MOUNTAINS.length; bi++) {
    Course.init(MOUNTAINS[bi].id, 'freeride', 202611 + bi);
    Particles.clear();
    const RT = Physics.createRider({ isPlayer: true, s: 30, u: 0, initSpeed: 22 });
    for (let i = 0; i < 36; i++) {
      Physics.stepRider(RT, { pedal: true, brake: i > 20, steer: i > 10 ? 0.6 : -0.4 }, 1 / 60, i / 60);
      Particles.emitTire(RT, 1 / 60, 'high');
    }
    Particles.step(1 / 60);
    const groundCnt = Particles.trackCount();
    if (groundCnt < 36) tracksAllOk = false;
    totalTrk += groundCnt;
    // Jump mid-run and ensure airborne frames do NOT append track vertices
    RT.air = true; RT.pos[1] += 2.0; RT.vel[1] = 5;
    Physics.stepRider(RT, { pedal: true }, 1 / 60, 1.0);
    Particles.emitTire(RT, 1 / 60, 'high');
    Particles.step(1 / 60);
    if (Particles.trackCount() > groundCnt) tracksAllOk = false;
  }

  assert(
    tb.ahead >= 750 && tb.back >= 50 && tb.halfWidth >= 500 &&
    tapPeak >= 0.18 && tapPeak <= 0.70 && fullPeak >= 0.50 && fullPeak <= 1.25 && rampPeak >= 2.2 &&
    tracksAllOk,
    'V7 Horizon(' + Math.round(tb.back) + 'm..' + Math.round(tb.ahead) + 'm, +-'+ Math.round(tb.halfWidth) + 'm), Hops(tap=' + tapPeak.toFixed(2) + 'm, full=' + fullPeak.toFixed(2) + 'm, ramp=' + rampPeak.toFixed(2) + 'm), Tracks(' + totalTrk + ' verts) OK'
  );

  if (failures > 0) process.exit(1);
  console.log('\\nALL CRAZYBIKE V7 CHECKS PASSED!');
`, ctx);
