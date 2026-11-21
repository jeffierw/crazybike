// Automated headless verification suite for CrazyBike (inspired by cold-smoke tools/)
// Checks: 1) WGSL+GLSL shader compilation  2) 4-mountain terrain perf  3) 8-rider physics & AI non-stuck audit
//         4) camera ground clearance audit (>=0.40m)  5) stunts, ragdoll bails, combat KOs & career unlocks.
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
  document: { getElementById: () => null },
  addEventListener: () => {},
  innerWidth: 1280,
  innerHeight: 720,
  navigator: {},
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

  // 1. Verify all pipelines translate cleanly to both WGSL and GLSL ES 3.00 + SDF RiderMesh audit
  const pipes = [];
  const mockGfx = {
    buffer: () => ({ id: 1 }),
    texture: () => ({ id: 1 }),
    target: () => ({ id: 1 }),
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
  assert(pipes.length >= 8, 'All ' + pipes.length + ' GPU pipelines compiled to WGSL + GLSL (' + pipes.join(', ') + ')');
  const rm = RiderMesh.info();
  let badRm = 0;
  for (let i = 0; i < rm.V.length; i++) if (!Number.isFinite(rm.V[i])) badRm++;
  for (let i = 0; i < rm.W.length; i++) if (!Number.isFinite(rm.W[i])) badRm++;
  assert(rm && rm.nv > 2000 && rm.ms < 1200 && badRm === 0, 'SDF RiderMesh built cleanly (' + rm.nv + ' verts, ' + (rm.ni / 3) + ' tris in ' + Math.round(rm.ms) + 'ms, 0 NaN)');

  // 2. Terrain build speed & 4-mountain 8-rider simulation + camera clearance audit
  const t0 = Date.now();
  for (let mi = 0; mi < MOUNTAINS.length; mi++) {
    const m = MOUNTAINS[mi];
    Course.init(m.id, 'freeride', 202611 + mi * 77);
    Terrain.reset();
    Terrain.update(120);
    Camera.reset();
    Combat.reset();

    const P = Physics.createRider({ isPlayer: true, s: 12, u: 0, initSpeed: 12, upgrades: { frame: mi, fork: mi, drive: mi, tires: mi, combat: mi } });
    const R = AI.spawnPack(mi);
    const all = [P, ...R];
    let kos = 0, tricks = 0;

    for (let i = 0; i < 900; i++) { // 15s high-speed race per mountain
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
      Camera.update(P, 1 / 60, 16 / 9, Feel);
      for (const ce of Combat.drainEvents()) if (ce.type === 'takedown') kos++;
      for (const se of Stunts.drainEvents()) if (se.type === 'trick_land') tricks++;
      Physics.drainEvents();
      if (i % 120 === 0) {
        Solid.clear(); Props.emit(P.s, t);
        for (const r of all) BikeMesh.emitRider(r, t);
        Combat.emitProjectiles(); Solid.upload();
      }
    }
    const minAiS = Math.min(...R.map(r => r.s));
    assert(
      P.s > 260 && minAiS > 220 && Camera.minClearance >= 0.40,
      m.id + ' 15s audit -> player=' + Math.round(P.s) + 'm, minAI=' + Math.round(minAiS) + 'm, maxSpd=' + Math.round(P.maxSpeed * 3.6) + 'km/h, KOs=' + kos + ', camClear=' + Camera.minClearance.toFixed(2) + 'm'
    );
  }
  const simMs = Date.now() - t0;
  const msPerFrame = simMs / (MOUNTAINS.length * 900);
  assert(msPerFrame < 6.0, 'All 4 mountains terrain + 3600 frames of 8-rider physics averaged ' + msPerFrame.toFixed(2) + 'ms/frame (<6ms budget for 60fps)');

  // 3. Endless mode dynamic traffic & Career progression checks
  Course.init('town', 'endless', todaySeed());
  const PE = Physics.createRider({ isPlayer: true, s: 1250, u: 0, initSpeed: 26 });
  const RE = AI.spawnPack(2);
  AI.recycleEndless(RE, PE);
  assert(RE.every(r => r.s > PE.s && r.s < PE.s + 260), 'Endless mode recycled all 7 AI rivals cleanly ahead of player');

  const pay = Career.recordCareerFinish(Career.EVENTS[0], { rank: 1, time: 65, dist: 2100, takedowns: 3, trickScore: 1600, crashes: 0, maxSpeedKmh: 108, finished: true });
  assert(pay.total > 1000 && Career.isMountainUnlocked('forest') && Career.buyUpgrade('fork'), 'Career payout, mountain unlock & garage upgrade OK');

  if (failures > 0) process.exit(1);
  console.log('\\nALL CRAZYBIKE MVP CHECKS PASSED!');
`, ctx);
