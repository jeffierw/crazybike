// ---------------------------------------------------------------- 03_course: 4-biome downhill mountain generator
// V2 World: single-sided sheer cliffs (悬崖), vertical rock step-down drops (断面), punchier MTB slopes, berms & shortcut lanes.
// Coordinate system: x = right, y = up, -z = downhill (s = -z is downhill distance in metres).
// Lateral coordinate u = x - cx(s). Physics, AI, terrain mesh and props all read this single truth.

const MOUNTAINS = [
  {
    id: 'redrock', idx: 0, name: '红岩大峡谷', en: 'Red Rock Canyon',
    tagline: '莫阿布红砂悬崖、垂直断面与巨型飞跃跳台',
    taglineEn: 'Moab sheer sandstone cliffs, drop-offs & mega kickers',
    slopeMul: 1.04, widthMul: 1.06, grip: 1.0,
    sunDir: [0.58, 0.36, -0.73], sunCol: [1.42, 1.04, 0.68], sunInt: 1.58, exposure: 1.02,
    skyZen: [0.13, 0.34, 0.70], skyHor: [0.96, 0.58, 0.32], groundCol: [0.48, 0.24, 0.14], fogDens: 0.0017,
    trackCol: [0.58, 0.29, 0.15], bankCol: [0.69, 0.27, 0.13], rockCol: [0.50, 0.18, 0.10], accentCol: [0.88, 0.50, 0.20],
    dustCol: [0.84, 0.46, 0.24], propKind: 'canyon',
    unlockCost: 0,
  },
  {
    id: 'forest', idx: 1, name: '苍翠松林道', en: 'Pine Forest',
    tagline: '高山断崖脊线、高速弯墙与木桥连跳',
    taglineEn: 'Alpine ridge drops, banked berms & timber kickers',
    slopeMul: 1.08, widthMul: 0.94, grip: 0.94,
    sunDir: [-0.45, 0.44, -0.77], sunCol: [1.28, 1.20, 0.94], sunInt: 1.48, exposure: 0.99,
    skyZen: [0.15, 0.41, 0.74], skyHor: [0.72, 0.84, 0.80], groundCol: [0.18, 0.28, 0.14], fogDens: 0.0021,
    trackCol: [0.35, 0.23, 0.13], bankCol: [0.16, 0.33, 0.13], rockCol: [0.32, 0.34, 0.34], accentCol: [0.24, 0.46, 0.17],
    dustCol: [0.48, 0.36, 0.24], propKind: 'forest',
    unlockCost: 900,
  },
  {
    id: 'volcano', idx: 2, name: '火山黑砂脊', en: 'Volcanic Ridge',
    tagline: '熔岩深渊悬崖、黑砂陡降断面与极限漂移',
    taglineEn: 'Molten abyss cliffs, obsidian step-downs & high-speed drift',
    slopeMul: 1.18, widthMul: 0.98, grip: 0.82,
    sunDir: [0.32, 0.24, -0.92], sunCol: [1.58, 0.68, 0.34], sunInt: 1.54, exposure: 1.08,
    skyZen: [0.13, 0.08, 0.18], skyHor: [0.88, 0.33, 0.14], groundCol: [0.26, 0.10, 0.06], fogDens: 0.0022,
    trackCol: [0.18, 0.16, 0.17], bankCol: [0.13, 0.11, 0.12], rockCol: [0.22, 0.15, 0.13], accentCol: [1.00, 0.34, 0.06],
    dustCol: [0.28, 0.22, 0.20], propKind: 'volcano',
    unlockCost: 2200,
  },
  {
    id: 'town', idx: 3, name: '悬崖山城', en: 'Hillside Town',
    tagline: '海滨悬崖彩房、石阶连跳与巷道极速冲线',
    taglineEn: 'Coastal cliff terraces, stepped alleys & ocean-view sprint',
    slopeMul: 1.10, widthMul: 0.90, grip: 1.06,
    sunDir: [-0.56, 0.30, -0.77], sunCol: [1.44, 0.94, 0.58], sunInt: 1.54, exposure: 1.01,
    skyZen: [0.16, 0.32, 0.68], skyHor: [0.96, 0.56, 0.42], groundCol: [0.38, 0.28, 0.24], fogDens: 0.0016,
    trackCol: [0.46, 0.43, 0.40], bankCol: [0.64, 0.46, 0.34], rockCol: [0.48, 0.38, 0.32], accentCol: [0.18, 0.68, 0.84],
    dustCol: [0.68, 0.62, 0.54], propKind: 'town',
    unlockCost: 3800,
  },
];

const RACE_MODES = {
  freeride:  { id: 'freeride',  name: '自由速降', en: 'Freeride',       len: 2100, hwMul: 1.12, laneRate: 0.65, rampRate: 1.05, obsMul: 0.82, endless: false },
  technical: { id: 'technical', name: '技术陡坡', en: 'Technical',      len: 1900, hwMul: 0.86, laneRate: 0.38, rampRate: 0.82, obsMul: 1.28, endless: false },
  mcross:    { id: 'mcross',    name: '越野争霸', en: 'Mountain Cross', len: 1700, hwMul: 1.02, laneRate: 0.28, rampRate: 1.48, obsMul: 0.62, endless: false },
  endless:   { id: 'endless',   name: '无尽暴走', en: 'Endless',        len: 1e9,  hwMul: 1.06, laneRate: 0.55, rampRate: 1.20, obsMul: 0.90, endless: true },
};

const Course = (() => {
  // Punchier Downhill Domination segment rhythm (steep chutes, cliff ledges, vertical step-downs, pump rollers)
  const SEG_TEMPLATES = {
    opener:  { slope: 0.30, hw: 12.2, bend: 0.30, berm: 1.0, rollA: 0.15, rollL: 28, stairs: 0, kick: 1, lane: 0, cliffProb: 0.85, drops: 1 },
    cliff:   { slope: 0.40, hw: 10.6, bend: 0.72, berm: 2.6, rollA: 0.35, rollL: 26, stairs: 0, kick: 2, lane: 1, cliffProb: 1.00, drops: 2 },
    fast:    { slope: 0.41, hw: 11.4, bend: 0.58, berm: 2.0, rollA: 0.40, rollL: 34, stairs: 0, kick: 2, lane: 1, cliffProb: 0.55, drops: 1 },
    berms:   { slope: 0.35, hw: 9.8,  bend: 1.18, berm: 3.8, rollA: 0.25, rollL: 24, stairs: 0, kick: 1, lane: 0, cliffProb: 0.65, drops: 1 },
    chute:   { slope: 0.49, hw: 8.8,  bend: 0.48, berm: 1.9, rollA: 0.55, rollL: 20, stairs: 0, kick: 1, lane: 1, cliffProb: 0.70, drops: 2 },
    kickers: { slope: 0.37, hw: 11.4, bend: 0.38, berm: 1.4, rollA: 0.30, rollL: 28, stairs: 0, kick: 3, lane: 0, cliffProb: 0.50, drops: 1 },
    rollers: { slope: 0.34, hw: 10.4, bend: 0.68, berm: 2.2, rollA: 1.45, rollL: 19, stairs: 0, kick: 1, lane: 1, cliffProb: 0.45, drops: 1 },
    stairs:  { slope: 0.39, hw: 9.2,  bend: 0.42, berm: 1.2, rollA: 0.0,  rollL: 28, stairs: 1, kick: 2, lane: 0, cliffProb: 0.80, drops: 2 },
    sprint:  { slope: 0.43, hw: 12.8, bend: 0.22, berm: 0.9, rollA: 0.20, rollL: 34, stairs: 0, kick: 2, lane: 0, cliffProb: 0.60, drops: 1 },
  };

  const C = {
    mountain: MOUNTAINS[0],
    mode: RACE_MODES.freeride,
    seed: 202611,
    finishS: 2100,
    segs: [],
    ramps: [],
    drops: [],       // vertical rock step-down ledges: { s, dropH, lipH, w, id }
    obsBuckets: new Map(),
    plannedS: 0,
    samples: [],     // 2m sampled spine: { s, baseY, cx, dcx, hw, slope, berm, roll, stairs, cliffL, cliffR, dropEdge, segIdx }
    rng: RNG(1),
    key: 0,
  };

  const STEP = 2;
  let spinY = 1400, spinX = 0, spinHeading = 0, spinRollPh = 0;

  function mountainById(id) {
    return MOUNTAINS.find(m => m.id === id) || MOUNTAINS[0];
  }

  function pickSegType(idx, r) {
    if (idx === 0) return 'opener';
    if (!C.mode.endless && C.plannedS + 260 >= C.finishS) return 'sprint';
    if (C.mountain.id === 'town' && idx % 3 === 1) return 'stairs';
    if (idx === 1) return 'cliff'; // Early breathtaking sheer cliff vista right after start!
    if (C.mode.id === 'mcross') {
      const pool = ['berms', 'kickers', 'cliff', 'rollers', 'kickers'];
      return pool[idx % pool.length];
    }
    if (C.mode.id === 'technical') {
      const pool = ['chute', 'cliff', 'berms', 'rollers', 'chute'];
      return pool[Math.floor(r() * pool.length)];
    }
    const pool = ['cliff', 'fast', 'berms', 'kickers', 'chute', 'rollers'];
    return pool[Math.floor(r() * pool.length)];
  }

  function buildRampsForSeg(seg, r) {
    const count = Math.max(0, Math.round(seg.tpl.kick * C.mode.rampRate));
    for (let k = 0; k < count; k++) {
      const frac = (k + 0.52 + (r() - 0.5) * 0.20) / (count + 0.15);
      const rs = seg.s0 + seg.len * clamp(frac, 0.15, 0.85);
      if (rs < 72 || (!C.mode.endless && rs > C.finishS - 85)) continue;
      // Avoid placing a kicker directly on top of a step-down face
      let nearDrop = false;
      for (let j = 0; j < seg.segDrops.length; j++) {
        if (Math.abs(rs - seg.segDrops[j].s) < 22) { nearDrop = true; break; }
      }
      if (nearDrop) continue;
      const sp = C.at(rs);
      const w = 5.6 + r() * 2.4;
      const len = 10.0 + r() * 4.2;
      const h = (seg.type === 'kickers' || C.mode.id === 'mcross') ? (2.5 + r() * 1.2) : (1.8 + r() * 1.0);
      const u = (r() - 0.5) * Math.max(2, sp.hw * 0.68);
      C.ramps.push({ s: rs, u, len, w, h, shortcut: false, id: C.ramps.length });
    }
    // Shortcut exit mega-kicker
    if (seg.lane) {
      const L = seg.lane;
      const rs = L.s1 - 24;
      C.ramps.push({ s: rs, u: L.offset, len: 11, w: 5.0, h: 2.8, shortcut: true, id: C.ramps.length });
    }
  }

  let planning = false;
  function planTo(targetS) {
    if (planning) return;
    planning = true;
    const r = C.rng;
    while (C.plannedS < targetS) {
      const idx = C.segs.length;
      const type = pickSegType(idx, r);
      const tpl = SEG_TEMPLATES[type];
      let len = type === 'opener' ? 190 : (210 + Math.floor(r() * 100));
      if (!C.mode.endless && C.plannedS + len > C.finishS + 260) {
        len = Math.max(160, C.finishS + 260 - C.plannedS);
      }
      const s0 = C.plannedS;
      const s1 = s0 + len;
      const bendSign = (idx % 2 === 0 ? 1 : -1) * (r() < 0.2 ? -1 : 1);
      const bendAmp = tpl.bend * bendSign * (0.65 + r() * 0.55);
      const bendFreq = (1 + (r() < 0.45 ? 1 : 0)) * PI / len;

      // Single-sided sheer cliff drop-off! (0 = valley, -1 = left cliff abyss, +1 = right cliff abyss)
      let cliffSide = 0;
      const cProb = tpl.cliffProb * (C.mountain.id === 'forest' ? 0.62 : 1.0);
      if (r() < cProb) {
        // On opener, put cliff on the RIGHT (+1) so start-gate 3/4 view overlooks a jaw-dropping canyon/ocean abyss!
        cliffSide = idx === 0 ? 1 : ((idx % 2 === 0) ? 1 : -1);
      }

      // Optional branching shortcut lane — always placed on the solid mountain side, NEVER overhanging a sheer cliff!
      let lane = null;
      if (tpl.lane && idx > 0 && r() < C.mode.laneRate && len >= 200 && (C.mode.endless || s1 < C.finishS - 80)) {
        const side = cliffSide !== 0 ? -cliffSide : (r() < 0.5 ? -1 : 1);
        lane = {
          s0: s0 + 28,
          s1: s1 - 28,
          side,
          offset: side * (16 + r() * 4.5),
          hw: 4.6,
          drop: 1.5 + r() * 1.2,
        };
      }

      // Vertical rock step-down ledges (断面) inside this segment!
      const segDrops = [];
      const dropCount = tpl.drops || 0;
      for (let d = 0; d < dropCount; d++) {
        const ds = s0 + len * (dropCount === 1 ? (0.48 + (r() - 0.5) * 0.18) : (0.30 + d * 0.42 + (r() - 0.5) * 0.10));
        if (ds < 58 || (!C.mode.endless && ds > C.finishS - 95)) continue;
        const dropH = (type === 'chute' || type === 'cliff') ? (4.4 + r() * 2.4) : (3.0 + r() * 1.8);
        const dropObj = { s: ds, dropH, lipH: 0.65 + r() * 0.45, id: C.drops.length };
        segDrops.push(dropObj);
        C.drops.push(dropObj);
      }

      const seg = { idx, type, tpl, s0, s1, len, bendAmp, bendFreq, lane, cliffSide, segDrops };
      C.segs.push(seg);

      // Integrate spine samples from s0 to s1 in STEP metre increments
      const startI = Math.floor(s0 / STEP);
      const endI = Math.floor(s1 / STEP);
      for (let i = startI; i <= endI; i++) {
        if (i < C.samples.length) continue;
        const s = i * STEP;
        const t = clamp((s - s0) / len, 0, 1);
        const blend = smooth(0, 0.14, t) * (1 - smooth(0.86, 1, t));

        // Keep start gate (s < 26) calm and poised overlooking the valley
        const gateCalm = idx === 0 ? smooth(16, 36, s) : 1.0;

        const targetCurve = Math.sin(t * len * bendFreq) * bendAmp * 0.0115 * blend * gateCalm;
        spinHeading = clamp(spinHeading + targetCurve * STEP, -0.60, 0.60);
        spinHeading *= Math.exp(-0.004 * STEP);
        spinX += Math.sin(spinHeading) * STEP;

        // Punchy slope with subtle steep-pitch bursts (less uniform ski-hill glide!)
        const pitchWave = 0.88 + 0.24 * Math.sin(s * 0.026 + C.key) + 0.10 * Math.cos(s * 0.055 + C.key * 2.1);
        const baseSlope = tpl.slope * C.mountain.slopeMul * pitchWave * lerp(0.55, 1.0, gateCalm);
        spinY -= baseSlope * STEP;

        // Apply crisp vertical rock step-down ledges (断面) directly to spine elevation!
        let dropEdge = 0;
        let lipBoost = 0;
        for (let k = 0; k < segDrops.length; k++) {
          const dr = segDrops[k];
          const ds = s - dr.s;
          // Small upward kicker lip right before the drop edge so bikes launch dramatically!
          if (ds > -7.5 && ds <= 0.5) {
            const lt = sat((ds + 7.5) / 7.5);
            lipBoost += dr.lipH * lt * lt;
          }
          // Crisp sheer vertical drop over ~4.5m across the rock face!
          if (ds > 0 && ds <= 6.0) {
            const frac = (ds <= 4.0) ? (STEP / 4.0) : 0;
            if (frac > 0) spinY -= dr.dropH * frac;
            dropEdge = Math.max(dropEdge, 1 - smooth(0, 6.0, ds));
          }
          if (Math.abs(ds) < 2.2) dropEdge = 1.0;
        }

        spinRollPh += STEP / tpl.rollL;
        const hw = tpl.hw * C.mountain.widthMul * C.mode.hwMul;
        const berm = -targetCurve * 245 * tpl.berm;
        const roll = tpl.rollA * Math.sin(spinRollPh * TAU) * blend * gateCalm;

        // Broad, natural geological cliff-rim transition (no abrupt knife-edge wall transitions!)
        const cliffFade = smooth(0, 0.28, t) * (1 - smooth(0.72, 1.0, t));
        const cAmt = (idx === 0 ? smooth(14, 42, s) : 1.0) * cliffFade;
        const cliffL = cliffSide === -1 ? cAmt : 0;
        const cliffR = cliffSide ===  1 ? cAmt : 0;

        C.samples.push({
          s, baseY: spinY + lipBoost, cx: spinX, dcx: Math.sin(spinHeading),
          hw, slope: baseSlope, berm: clamp(berm, -4.2, 4.2), roll,
          stairs: tpl.stairs * blend,
          cliffL, cliffR, dropEdge, segIdx: idx,
        });
      }

      C.plannedS = s1;
      buildRampsForSeg(seg, r);
    }
    planning = false;
  }

  C.init = function (mountainId = 'redrock', modeId = 'freeride', seed = 202611) {
    C.mountain = mountainById(mountainId);
    C.mode = RACE_MODES[modeId] || RACE_MODES.freeride;
    C.seed = (Math.floor(+seed) || 202611) >>> 0;
    C.key = (hashU(C.seed ^ (C.mountain.idx * 9187) ^ C.mode.id.charCodeAt(0) * 313) & 0xffff) * 0.001;
    C.finishS = C.mode.endless ? 1e9 : C.mode.len;
    C.segs = [];
    C.ramps = [];
    C.drops = [];
    C.obsBuckets.clear();
    C.samples = [];
    C.plannedS = 0;
    C.rng = RNG(C.seed ^ hashU(C.mountain.idx * 7919 + C.mode.id.length * 131));
    spinY = 1600; spinX = 0; spinHeading = 0; spinRollPh = 0;
    planTo(C.mode.endless ? 1400 : C.finishS + 450);
  };

  C.ensureTo = function (s) {
    if (s + 650 > C.plannedS) planTo(s + 1100);
  };

  C.at = function (s) {
    if (s < 0) s = 0;
    if (s + 400 > C.plannedS) planTo(s + 800);
    const f = s / STEP;
    const i = Math.min(C.samples.length - 2, Math.max(0, Math.floor(f)));
    const t = clamp(f - i, 0, 1);
    const a = C.samples[i], b = C.samples[i + 1] || a;
    const seg = C.segs[a.segIdx] || C.segs[0];
    return {
      s,
      baseY: lerp(a.baseY, b.baseY, t),
      cx: lerp(a.cx, b.cx, t),
      dcx: lerp(a.dcx, b.dcx, t),
      hw: lerp(a.hw, b.hw, t),
      slope: lerp(a.slope, b.slope, t),
      berm: lerp(a.berm, b.berm, t),
      roll: lerp(a.roll, b.roll, t),
      stairs: lerp(a.stairs, b.stairs, t),
      cliffL: lerp(a.cliffL, b.cliffL, t),
      cliffR: lerp(a.cliffR, b.cliffR, t),
      dropEdge: Math.max(a.dropEdge, b.dropEdge),
      seg,
    };
  };

  C.laneAt = function (s, seg) {
    if (!seg || !seg.lane) return null;
    const L = seg.lane;
    if (s < L.s0 || s > L.s1) return null;
    const enter = smooth(L.s0, L.s0 + 36, s);
    const exit = 1 - smooth(L.s1 - 32, L.s1, s);
    const blend = enter * exit;
    return { u: L.offset * blend, hw: L.hw, blend, drop: L.drop * blend, side: L.side };
  };

  // Exact ground height at world (x, z) — supports sheer cliff drop-offs, terraced canyon walls, step-downs & kickers!
  C.height = function (x, z, spOpt, laneOpt, rampsOpt) {
    const s = Math.max(0, -z);
    const sp = spOpt || C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const hw = sp.hw;

    // 1. Track bed + banked berm + subtle dish
    const uNorm = clamp(u / hw, -1.6, 1.6);
    const dish = 0.30 * (uNorm * uNorm);
    const bermH = sp.berm * smooth(0.15, 1.05, Math.abs(uNorm)) * (u * sp.berm > 0 ? 1 : -0.18);
    let y = sp.baseY + dish + Math.max(0, bermH) + sp.roll;

    // Town stepped staircases
    if (sp.stairs > 0.05 && au < hw * 1.05) {
      const stepPhase = fract(s * 0.28);
      y += (0.5 - stepPhase) * 0.45 * sp.stairs;
    }

    // 2. Outer terrain: either sheer cliff abyss drop-off OR sculpted terraced mountain wall!
    let offDist = Math.max(0, au - hw);
    const lane = laneOpt !== undefined ? laneOpt : C.laneAt(s, sp.seg);
    let laneMask = 0;
    if (lane && lane.blend > 0.05) {
      const lu = Math.abs(u - lane.u);
      const lOff = Math.max(0, lu - lane.hw);
      if (lOff < offDist) {
        offDist = lOff;
        laneMask = (1 - smooth(lane.hw * 0.7, lane.hw + 2.5, lu)) * lane.blend;
      }
    }

    if (offDist > 0) {
      const cliffW = u < 0 ? sp.cliffL : sp.cliffR;
      const n1 = fbm2(x * 0.015, z * 0.015, 3, C.seed & 4095);
      const n2 = vnoise2(x * 0.052, z * 0.052, (C.seed + 77) & 4095);

      // Rising terraced mountain flank
      const gentle = Math.min(offDist, 8) * 0.20;
      const outer = Math.max(0, offDist - 8);
      const wallScale = C.mountain.id === 'redrock' ? 0.36 : C.mountain.id === 'town' ? 0.28 : C.mountain.id === 'volcano' ? 0.34 : 0.26;
      const rawRise = gentle + Math.pow(outer, 1.08) * wallScale + (n1 * 0.5 + 0.5) * Math.min(26, outer * 0.42);
      const riseY = C.mountain.id === 'redrock'
        ? Math.floor(rawRise / 4.5) * 2.1 + rawRise * 0.54
        : rawRise;

      if (cliffW > 0.01) {
        // Dramatic single-sided sheer cliff drop-off into open chasm / coastal ocean / lava gorge!
        const shoulder = Math.max(0, offDist - 2.2);
        const dropDepth = C.mountain.id === 'town' ? 58 : C.mountain.id === 'volcano' ? 78 : 72;
        const steepDrop = -dropDepth * smooth(0, 34, shoulder) - Math.min(35, shoulder * 0.25);
        // Subtle terraced rock ledges halfway down the cliff face
        const rockLedge = Math.sin(shoulder * 0.28 + n1 * 2.5) * 1.8 * smooth(2, 18, shoulder) * (1 - smooth(38, 65, shoulder));
        const cliffY = steepDrop + rockLedge;
        y += lerp(riseY, cliffY, cliffW) + n2 * Math.min(2.6, offDist * 0.11);
      } else {
        y += riseY + n2 * Math.min(2.6, offDist * 0.11);
      }
    } else if (laneMask > 0.01) {
      y -= lane.drop * laneMask;
    }

    // Small organic dirt micro-bump on track
    const micro = vnoise2(x * 0.17, z * 0.17, 913) * 0.14;
    y += micro * (C.mountain.id === 'town' ? 0.32 : 1.0);

    // 3. Kicker ramps (smooth upward lip + crisp drop behind)
    const rList = rampsOpt || C.ramps;
    for (let i = 0; i < rList.length; i++) {
      const rm = rList[i];
      if (s < rm.s - rm.len || s > rm.s + 2.2) continue;
      const du = Math.abs(u - rm.u);
      if (du > rm.w * 0.5 + 1.8) continue;
      const sideM = 1 - smooth(rm.w * 0.44, rm.w * 0.5 + 1.6, du);
      let prof = 0;
      if (s <= rm.s) {
        const t = sat((s - (rm.s - rm.len)) / rm.len);
        prof = t * t * (1.28 - 0.28 * t);
      } else {
        prof = 1 - smooth(rm.s, rm.s + 1.8, s);
      }
      y += rm.h * prof * sideM;
    }

    return y;
  };

  C.normal = function (x, z) {
    const e = 0.55;
    const hL = C.height(x - e, z), hR = C.height(x + e, z);
    const hD = C.height(x, z - e), hU = C.height(x, z + e);
    return v3.norm([hL - hR, 2 * e, hD - hU]);
  };

  C.surface = function (x, z) {
    const s = Math.max(0, -z);
    const sp = C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const lane = C.laneAt(s, sp.seg);
    let onShortcut = false;
    let offDist = Math.max(0, au - sp.hw);
    if (lane && lane.blend > 0.1) {
      const lOff = Math.max(0, Math.abs(u - lane.u) - lane.hw);
      if (lOff < offDist) {
        offDist = lOff;
        onShortcut = lOff <= 0.4;
      }
    }
    let onRamp = false;
    for (let i = 0; i < C.ramps.length; i++) {
      const rm = C.ramps[i];
      if (s >= rm.s - rm.len && s <= rm.s + 0.6 && Math.abs(u - rm.u) <= rm.w * 0.52) {
        onRamp = true; break;
      }
    }
    const cliffSide = u < 0 ? sp.cliffL : sp.cliffR;
    const overCliff = cliffSide > 0.35 && offDist > 4.5;
    const onTrack = offDist <= 0.45;
    const grip = C.mountain.grip * (onTrack ? 1.0 : 0.68);
    const drag = onTrack ? 0.0 : clamp(offDist * 0.08, 0.05, 0.55);
    return { onTrack, onShortcut, onRamp, overCliff, offDist, u, hw: sp.hw, grip, drag, stairs: sp.stairs, dropEdge: sp.dropEdge };
  };

  C.rampsNear = function (s0, s1) {
    const out = [];
    for (let i = 0; i < C.ramps.length; i++) {
      const rm = C.ramps[i];
      if (rm.s + 4 >= s0 && rm.s - rm.len <= s1) out.push(rm);
    }
    return out;
  };

  C.dropsNear = function (s0, s1) {
    const out = [];
    for (let i = 0; i < C.drops.length; i++) {
      const dr = C.drops[i];
      if (dr.s + 8 >= s0 && dr.s - 10 <= s1) out.push(dr);
    }
    return out;
  };

  // Deterministic obstacle & scenic landmark generator in 40m buckets
  const BUCKET = 40;
  function buildObsBucket(bi) {
    const list = [];
    if (bi < 1) { C.obsBuckets.set(bi, list); return list; }
    const s0 = bi * BUCKET;
    const rng = RNG(hash2U(bi * 313 + C.mountain.idx * 71, C.seed));
    const kind = C.mountain.propKind;
    const finishClear = !C.mode.endless && Math.abs(s0 + 20 - C.finishS) < 55;

    // 1. Trackside dense landmarks (only on non-cliff solid shoulders so nothing hovers over an abyss!)
    const edgeCount = Math.round((kind === 'forest' ? 20 : kind === 'town' ? 14 : 13) * (0.85 + rng() * 0.3));
    for (let i = 0; i < edgeCount; i++) {
      const s = s0 + rng() * BUCKET;
      const sp = C.at(s);
      const side = rng() < 0.5 ? -1 : 1;
      const sideCliff = side < 0 ? sp.cliffL : sp.cliffR;
      if (sideCliff > 0.25) continue; // Keep sheer cliff drop-off wide open & scenic!

      const distOut = sp.hw + 1.9 + rng() * 18.0;
      const u = side * distOut;
      const lane = C.laneAt(s, sp.seg);
      if (lane && Math.abs(u - lane.u) < lane.hw + 2.6) continue;
      const x = sp.cx + u, z = -s, y = C.height(x, z);
      const n = C.normal(x, z);
      if (n[1] < 0.70) continue;

      const scale = 0.85 + rng() * 0.95;
      const sub = kind === 'forest' ? (rng() < 0.84 ? 'pine' : 'boulder')
        : kind === 'canyon' ? (rng() < 0.42 ? 'spire' : rng() < 0.78 ? 'boulder' : 'cactus')
        : kind === 'volcano' ? (rng() < 0.68 ? 'basalt' : 'ember')
        : (rng() < 0.78 ? 'house' : 'lamp');
      const r = sub === 'house' ? 3.2 * scale : sub === 'spire' ? 2.1 * scale : (sub === 'boulder' || sub === 'basalt') ? 1.55 * scale : 0.78 * scale;
      const h = sub === 'house' ? 6.8 * scale : sub === 'pine' ? 10.5 * scale : sub === 'spire' ? 8.2 * scale : 3.4 * scale;
      list.push({ id: bi * 100 + i, s, u, x, y, z, r, h, scale, kind: sub, onTrack: false, colorIdx: Math.floor(rng() * 5) });
    }

    // 2. On-track risk boulders / barriers (never near ramps or vertical drop-offs)
    if (!finishClear) {
      const hazCount = Math.floor((1.0 + rng() * 1.3) * C.mode.obsMul);
      for (let i = 0; i < hazCount; i++) {
        const s = s0 + 5 + rng() * (BUCKET - 10);
        const sp = C.at(s);
        let skip = false;
        for (let k = 0; k < C.ramps.length; k++) {
          const rm = C.ramps[k];
          if (s > rm.s - rm.len - 10 && s < rm.s + 22) { skip = true; break; }
        }
        for (let k = 0; k < C.drops.length; k++) {
          if (Math.abs(s - C.drops[k].s) < 20) { skip = true; break; }
        }
        if (skip) continue;
        const side = rng() < 0.5 ? -1 : 1;
        const u = side * (2.8 + rng() * Math.max(1.5, sp.hw - 4.4));
        const x = sp.cx + u, z = -s, y = C.height(x, z);
        const sub = kind === 'town' ? 'barrier' : kind === 'volcano' ? 'basalt' : 'boulder';
        const scale = 0.65 + rng() * 0.42;
        list.push({ id: bi * 100 + 60 + i, s, u, x, y, z, r: 1.12 * scale, h: 1.55 * scale, scale, kind: sub, onTrack: true, colorIdx: Math.floor(rng() * 5) });
      }
    }

    C.obsBuckets.set(bi, list);
    return list;
  }

  C.obstaclesNear = function (s0, s1) {
    const b0 = Math.max(0, Math.floor(s0 / BUCKET));
    const b1 = Math.max(b0, Math.floor(s1 / BUCKET));
    const out = [];
    for (let b = b0; b <= b1; b++) {
      let arr = C.obsBuckets.get(b);
      if (!arr) arr = buildObsBucket(b);
      for (let i = 0; i < arr.length; i++) out.push(arr[i]);
    }
    return out;
  };

  return C;
})();
