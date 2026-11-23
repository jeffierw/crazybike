// ---------------------------------------------------------------- 03_course: V3 Open-Mountain Downhill Generator
// Features: 14m-26m true downhill mega cliff drop-offs (大断崖), wide open rideable freeride faces,
// braided multi-line organic shortcuts (no single-lane prison!), and dramatic 4-biome topography.
// Coordinate system: x = right, y = up, -z = downhill (s = -z is downhill distance in metres).

const MOUNTAINS = [
  {
    id: 'redrock', idx: 0, name: '红岩大峡谷', en: 'Red Rock Canyon',
    tagline: '莫阿布红砂巨型断崖、开放岩台抄近道与峡谷飞跃',
    taglineEn: 'Moab giant sandstone cliff drops, open rock slabs & shortcuts',
    slopeMul: 1.12, widthMul: 1.15, grip: 1.02,
    sunDir: [0.56, 0.34, -0.75], sunCol: [1.46, 1.06, 0.70], sunInt: 1.62, exposure: 1.02,
    skyZen: [0.12, 0.33, 0.68], skyHor: [0.95, 0.57, 0.31], groundCol: [0.46, 0.23, 0.13], fogDens: 0.00145,
    trackCol: [0.54, 0.27, 0.14], bankCol: [0.64, 0.25, 0.12], rockCol: [0.44, 0.16, 0.09], accentCol: [0.84, 0.45, 0.19],
    dustCol: [0.85, 0.48, 0.25], propKind: 'canyon',
    unlockCost: 0,
  },
  {
    id: 'forest', idx: 1, name: '苍翠松林道', en: 'Pine Forest',
    tagline: '高山林间巨幅跌落、多线林道抄近道与林鹿惊飞',
    taglineEn: 'Alpine forest mega-drops, braided singletrack & woodland wildlife',
    slopeMul: 1.14, widthMul: 1.08, grip: 0.96,
    sunDir: [-0.44, 0.42, -0.79], sunCol: [1.30, 1.22, 0.94], sunInt: 1.52, exposure: 1.00,
    skyZen: [0.14, 0.40, 0.72], skyHor: [0.74, 0.85, 0.80], groundCol: [0.16, 0.26, 0.13], fogDens: 0.00175,
    trackCol: [0.32, 0.21, 0.12], bankCol: [0.15, 0.31, 0.12], rockCol: [0.28, 0.31, 0.32], accentCol: [0.24, 0.42, 0.16],
    dustCol: [0.52, 0.38, 0.24], propKind: 'forest',
    unlockCost: 900,
  },
  {
    id: 'volcano', idx: 2, name: '火山黑砂脊', en: 'Volcanic Ridge',
    tagline: '黑曜石熔岩绝壁断崖、漫天火星与极速冲降',
    taglineEn: 'Obsidian lava cliff drops, rising embers & scree-line speed',
    slopeMul: 1.22, widthMul: 1.12, grip: 0.86,
    sunDir: [0.32, 0.24, -0.92], sunCol: [1.62, 0.70, 0.34], sunInt: 1.58, exposure: 1.08,
    skyZen: [0.12, 0.08, 0.17], skyHor: [0.88, 0.32, 0.14], groundCol: [0.24, 0.09, 0.06], fogDens: 0.0019,
    trackCol: [0.16, 0.14, 0.15], bankCol: [0.11, 0.10, 0.11], rockCol: [0.20, 0.14, 0.12], accentCol: [0.98, 0.34, 0.06],
    dustCol: [0.30, 0.24, 0.22], propKind: 'volcano',
    unlockCost: 2200,
  },
  {
    id: 'town', idx: 3, name: '悬崖山城', en: 'Hillside Town',
    tagline: '海滨悬崖彩房、多阶跳台巷道与海鸥伴飞冲线',
    taglineEn: 'Coastal cliff terraces, rooftop drops, alleys & ocean horizon',
    slopeMul: 1.16, widthMul: 1.04, grip: 1.06,
    sunDir: [-0.55, 0.30, -0.78], sunCol: [1.46, 0.96, 0.60], sunInt: 1.56, exposure: 1.01,
    skyZen: [0.15, 0.32, 0.68], skyHor: [0.95, 0.56, 0.42], groundCol: [0.36, 0.27, 0.23], fogDens: 0.0014,
    trackCol: [0.43, 0.40, 0.37], bankCol: [0.58, 0.42, 0.31], rockCol: [0.42, 0.34, 0.29], accentCol: [0.16, 0.66, 0.82],
    dustCol: [0.70, 0.64, 0.56], propKind: 'town',
    unlockCost: 3800,
  },
];

const RACE_MODES = {
  freeride:  { id: 'freeride',  name: '自由速降', en: 'Freeride',       len: 2300, hwMul: 1.18, laneRate: 0.85, rampRate: 1.05, obsMul: 0.78, endless: false },
  technical: { id: 'technical', name: '技术陡坡', en: 'Technical',      len: 2100, hwMul: 0.96, laneRate: 0.70, rampRate: 0.90, obsMul: 1.18, endless: false },
  mcross:    { id: 'mcross',    name: '越野争霸', en: 'Mountain Cross', len: 1900, hwMul: 1.12, laneRate: 0.65, rampRate: 1.40, obsMul: 0.62, endless: false },
  endless:   { id: 'endless',   name: '无尽暴走', en: 'Endless',        len: 1e9,  hwMul: 1.22, laneRate: 0.85, rampRate: 1.15, obsMul: 0.82, endless: true },
};

const Course = (() => {
  // True Downhill Domination vertical scale: steep sustained descents, 6m-66m random cliffs, U-halfpipes, creeks & waterfalls!
  const SEG_TEMPLATES = {
    opener:   { slope: 0.38, hw: 15.0, bend: 0.28, berm: 1.0, rollA: 0.15, rollL: 34, stairs: 0, kick: 1, lane: 1, cliffProb: 0.85, megaDrop: 1, uPipe: 0 },
    cliff:    { slope: 0.48, hw: 14.5, bend: 0.65, berm: 2.2, rollA: 0.30, rollL: 32, stairs: 0, kick: 1, lane: 1, cliffProb: 1.00, megaDrop: 2, uPipe: 0 },
    fast:     { slope: 0.49, hw: 15.5, bend: 0.55, berm: 1.8, rollA: 0.35, rollL: 38, stairs: 0, kick: 2, lane: 1, cliffProb: 0.55, megaDrop: 1, uPipe: 0 },
    berms:    { slope: 0.42, hw: 13.8, bend: 1.10, berm: 3.4, rollA: 0.20, rollL: 30, stairs: 0, kick: 1, lane: 1, cliffProb: 0.60, megaDrop: 1, uPipe: 0 },
    chute:    { slope: 0.56, hw: 13.0, bend: 0.45, berm: 1.6, rollA: 0.40, rollL: 28, stairs: 0, kick: 1, lane: 1, cliffProb: 0.70, megaDrop: 2, uPipe: 0 },
    kickers:  { slope: 0.44, hw: 15.0, bend: 0.35, berm: 1.2, rollA: 0.25, rollL: 34, stairs: 0, kick: 3, lane: 1, cliffProb: 0.50, megaDrop: 1, uPipe: 0 },
    rollers:  { slope: 0.41, hw: 14.5, bend: 0.62, berm: 1.9, rollA: 1.20, rollL: 24, stairs: 0, kick: 1, lane: 1, cliffProb: 0.45, megaDrop: 1, uPipe: 0 },
    stairs:   { slope: 0.46, hw: 13.5, bend: 0.40, berm: 1.2, rollA: 0.0,  rollL: 32, stairs: 1, kick: 2, lane: 1, cliffProb: 0.80, megaDrop: 2, uPipe: 0 },
    halfpipe: { slope: 0.44, hw: 17.5, bend: 0.32, berm: 0.5, rollA: 0.15, rollL: 34, stairs: 0, kick: 1, lane: 0, cliffProb: 0.25, megaDrop: 1, uPipe: 1.0 },
    sprint:   { slope: 0.50, hw: 16.5, bend: 0.22, berm: 0.9, rollA: 0.15, rollL: 38, stairs: 0, kick: 2, lane: 1, cliffProb: 0.55, megaDrop: 1, uPipe: 0 },
  };

  const C = {
    mountain: MOUNTAINS[0],
    mode: RACE_MODES.freeride,
    seed: 202611,
    finishS: 2300,
    segs: [],
    ramps: [],
    drops: [],       // Random 6m-66m downhill cliff drop-offs (+ waterfalls!): { s, dropH, faceLen, lipH, hasWaterfall, wfSide, wfWidth, id }
    obsBuckets: new Map(),
    pickupBuckets: new Map(),
    collectedPickups: new Set(),
    plannedS: 0,
    samples: [],
    rng: RNG(1),
    key: 0,
  };

  const STEP = 2;
  let spinY = 4800, spinX = 0, spinHeading = 0, spinRollPh = 0;

  function mountainById(id) {
    return MOUNTAINS.find(m => m.id === id) || MOUNTAINS[0];
  }

  function pickSegType(idx, r) {
    if (idx === 0) return 'opener';
    if (!C.mode.endless && C.plannedS + 280 >= C.finishS) return 'sprint';
    if (idx === 2) return 'halfpipe';
    if (C.mountain.id === 'town' && idx % 3 === 1) return 'stairs';
    if (idx === 1) return 'cliff';
    if (C.mode.id === 'mcross') {
      const pool = ['berms', 'kickers', 'cliff', 'rollers', 'halfpipe'];
      return pool[idx % pool.length];
    }
    if (C.mode.id === 'technical') {
      const pool = ['chute', 'cliff', 'berms', 'rollers', 'halfpipe', 'chute'];
      return pool[Math.floor(r() * pool.length)];
    }
    const pool = ['cliff', 'fast', 'berms', 'kickers', 'chute', 'rollers', 'halfpipe'];
    return pool[Math.floor(r() * pool.length)];
  }

  function buildRampsForSeg(seg, r) {
    const count = Math.max(0, Math.round(seg.tpl.kick * C.mode.rampRate));
    for (let k = 0; k < count; k++) {
      const frac = (k + 0.52 + (r() - 0.5) * 0.22) / (count + 0.18);
      const rs = seg.s0 + seg.len * clamp(frac, 0.16, 0.85);
      if (rs < 72 || (!C.mode.endless && rs > C.finishS - 95)) continue;
      let nearDrop = false;
      for (let j = 0; j < seg.segDrops.length; j++) {
        if (Math.abs(rs - seg.segDrops[j].s) < 38) { nearDrop = true; break; }
      }
      if (nearDrop) continue;
      const sp = C.at(rs);
      const w = 6.2 + r() * 2.8;
      const len = 11.0 + r() * 4.5;
      const h = (seg.type === 'kickers' || C.mode.id === 'mcross') ? (2.8 + r() * 1.4) : (2.1 + r() * 1.1);
      const u = (r() - 0.5) * Math.max(4, sp.hw * 0.9);
      C.ramps.push({ s: rs, u, len, w, h, shortcut: false, id: C.ramps.length });
    }
    // Braided shortcut exit kicker
    for (let li = 0; li < seg.lanes.length; li++) {
      const L = seg.lanes[li];
      const rs = L.s1 - 26;
      C.ramps.push({ s: rs, u: L.offset, len: 11.5, w: 5.8, h: 3.1, shortcut: true, id: C.ramps.length });
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
      let len = type === 'opener' ? 210 : (240 + Math.floor(r() * 110));
      if (!C.mode.endless && C.plannedS + len > C.finishS + 280) {
        len = Math.max(180, C.finishS + 280 - C.plannedS);
      }
      const s0 = C.plannedS;
      const s1 = s0 + len;
      const bendSign = (idx % 2 === 0 ? 1 : -1) * (r() < 0.2 ? -1 : 1);
      const bendAmp = tpl.bend * bendSign * (0.65 + r() * 0.55);
      const bendFreq = (1 + (r() < 0.45 ? 1 : 0)) * PI / len;

      // Single-sided open abyss vista (far out past open freeride face so you can still shred wide!)
      let cliffSide = 0;
      const cProb = tpl.cliffProb * (C.mountain.id === 'forest' ? 0.65 : 1.0);
      if (r() < cProb) {
        cliffSide = idx === 0 ? 1 : ((idx % 2 === 0) ? 1 : -1);
      }

      // Braided multi-line shortcuts (1-2 organic alternate lines per segment splitting left/right & rejoining!)
      const lanes = [];
      if (tpl.lane && len >= 190 && (C.mode.endless || s1 < C.finishS - 85)) {
        const wantCount = (idx > 0 && r() < C.mode.laneRate) ? (r() < 0.48 ? 2 : 1) : (idx === 0 ? 1 : 0);
        for (let k = 0; k < wantCount; k++) {
          const side = wantCount === 2 ? (k === 0 ? -1 : 1) : (cliffSide !== 0 ? -cliffSide : (r() < 0.5 ? -1 : 1));
          const offDist = side === cliffSide ? (18 + r() * 5) : (21 + r() * 9);
          lanes.push({
            s0: s0 + 22 + k * 14,
            s1: s1 - 22,
            side,
            offset: side * offDist,
            hw: 6.0,
            drop: 1.8 + r() * 1.6,
          });
        }
      }

      // Wide random cliff drop heights across ALL modes (6m gentle step-downs up to 66m skyscrapers!)
      const segDrops = [];
      const dropCount = tpl.megaDrop || 1;
      for (let d = 0; d < dropCount; d++) {
        // Place the very first cliff drop right around s=94m so players hit it within seconds!
        const ds = (idx === 0 && d === 0)
          ? 94
          : s0 + len * (dropCount === 1 ? (0.48 + (r() - 0.5) * 0.14) : (0.28 + d * 0.44 + (r() - 0.5) * 0.08));
        if (ds < 78 || (!C.mode.endless && ds > C.finishS - 125)) continue;
        let dropH, faceLen;
        if (idx === 0 && d === 0) {
          dropH = 14.0 + r() * 38.0; // Dramatic 14m-52m random opening cliff!
          faceLen = 9.5 + dropH * 0.24;
        } else {
          const tierRoll = r();
          if (tierRoll < 0.30) {
            dropH = 6.0 + r() * 8.0;   // Low quick step-down (6..14m)
            faceLen = 7.5 + dropH * 0.24;
          } else if (tierRoll < 0.70) {
            dropH = 16.0 + r() * 14.0; // Mid downhill drop (16..30m)
            faceLen = 10.0 + dropH * 0.26;
          } else {
            dropH = 36.0 + r() * 30.0; // Massive freeride mega-cliff (36..66m!)
            faceLen = 13.0 + dropH * 0.22;
          }
        }
        const hasWaterfall = dropH >= 15.0 && r() < 0.65;
        const wfSide = r() < 0.5 ? -1 : 1;
        const wfWidth = 3.5 + r() * 3.5;
        const dropObj = { s: ds, dropH, faceLen, lipH: 1.15 + r() * 0.65, hasWaterfall, wfSide, wfWidth, id: C.drops.length };
        segDrops.push(dropObj);
        C.drops.push(dropObj);
      }

      const seg = { idx, type, tpl, s0, s1, len, bendAmp, bendFreq, lanes, lane: lanes[0] || null, cliffSide, segDrops };
      C.segs.push(seg);

      const startI = Math.floor(s0 / STEP);
      const endI = Math.floor(s1 / STEP);
      for (let i = startI; i <= endI; i++) {
        if (i < C.samples.length) continue;
        const s = i * STEP;
        const t = clamp((s - s0) / len, 0, 1);
        const blend = smooth(0, 0.14, t) * (1 - smooth(0.86, 1, t));
        const gateCalm = idx === 0 ? smooth(16, 36, s) : 1.0;

        const targetCurve = Math.sin(t * len * bendFreq) * bendAmp * 0.0115 * blend * gateCalm;
        spinHeading = clamp(spinHeading + targetCurve * STEP, -0.60, 0.60);
        spinHeading *= Math.exp(-0.004 * STEP);
        spinX += Math.sin(spinHeading) * STEP;

        const pitchWave = 0.88 + 0.24 * Math.sin(s * 0.024 + C.key) + 0.10 * Math.cos(s * 0.052 + C.key * 1.9);
        const baseSlope = tpl.slope * C.mountain.slopeMul * pitchWave * lerp(0.55, 1.0, gateCalm);
        spinY -= baseSlope * STEP;

        // Carve genuine sheer Mega Cliff Drop-Offs directly into mountain elevation!
        let dropEdge = 0;
        let dropFace = 0;
        let lipBoost = 0;
        for (let k = 0; k < segDrops.length; k++) {
          const dr = segDrops[k];
          const ds = s - dr.s;
          // 10m sculpted takeoff runway rising slightly before the sheer cliff lip
          if (ds > -11.0 && ds <= 1.0) {
            const lt = sat((ds + 11.0) / 11.0);
            lipBoost += dr.lipH * lt * lt;
          }
          // Sheer 13m-26m vertical cliff plunge across faceLen metres!
          if (ds > 0 && ds <= dr.faceLen) {
            // Smooth S-curve sheer rock wall (steepest in the middle, catching smoothly into landing chute!)
            const u0 = (ds - STEP) / dr.faceLen, u1 = ds / dr.faceLen;
            const s0c = u0 * u0 * (3 - 2 * u0), s1c = u1 * u1 * (3 - 2 * u1);
            spinY -= dr.dropH * Math.max(0, s1c - s0c);
            dropFace = 1.0;
          }
          // Mark takeoff lip zone so physics launches cleanly into huge hangtime!
          if (ds >= -2.5 && ds <= 4.5) dropEdge = 1.0;
          // Long butter-smooth catch-slope scaled to cliff height so even 65m plunges catch cleanly!
          const catchLen = 28 + dr.dropH * 0.85;
          if (ds > dr.faceLen && ds < dr.faceLen + catchLen) {
            const catchW = 1 - smooth(dr.faceLen, dr.faceLen + catchLen, ds);
            spinY -= 0.16 * catchW * STEP;
          }
        }

        spinRollPh += STEP / tpl.rollL;
        const hw = tpl.hw * C.mountain.widthMul * C.mode.hwMul;
        const berm = -targetCurve * 220 * tpl.berm;
        const roll = tpl.rollA * Math.sin(spinRollPh * TAU) * blend * gateCalm;

        const cliffFade = smooth(0, 0.28, t) * (1 - smooth(0.72, 1.0, t));
        const cAmt = (idx === 0 ? smooth(16, 46, s) : 1.0) * cliffFade;
        const cliffL = cliffSide === -1 ? cAmt : 0;
        const cliffR = cliffSide ===  1 ? cAmt : 0;

        C.samples.push({
          s, baseY: spinY + lipBoost, cx: spinX, dcx: Math.sin(spinHeading),
          hw, slope: baseSlope + dropFace * 0.55, berm: clamp(berm, -3.6, 3.6), roll,
          stairs: tpl.stairs * blend,
          uPipe: (tpl.uPipe || 0) * blend,
          cliffL, cliffR, dropEdge, dropFace, segIdx: idx,
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
    C.pickupBuckets.clear();
    C.collectedPickups.clear();
    C.samples = [];
    C.plannedS = 0;
    C.rng = RNG(C.seed ^ hashU(C.mountain.idx * 7919 + C.mode.id.length * 131));
    spinY = 4800; spinX = 0; spinHeading = 0; spinRollPh = 0;
    planTo(C.mode.endless ? 1700 : C.finishS + 960);
  };

  C.ensureTo = function (s) {
    if (s + 950 > C.plannedS) planTo(s + 1400);
  };

  C.at = function (s) {
    if (s < 0) s = 0;
    if (s + 880 > C.plannedS) planTo(s + 1250);
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
      uPipe: lerp(a.uPipe || 0, b.uPipe || 0, t),
      cliffL: lerp(a.cliffL, b.cliffL, t),
      cliffR: lerp(a.cliffR, b.cliffR, t),
      dropEdge: Math.max(a.dropEdge, b.dropEdge),
      dropFace: Math.max(a.dropFace, b.dropFace),
      seg,
    };
  };

  // Meandering downhill mountain creek / shallow alpine stream (or magma stream on Volcano!)
  C.creekAt = function (s) {
    const wave = smooth(0.15, 0.45, Math.sin(s * 0.0055 + C.key) * 0.5 + 0.5);
    const early = (C.mountain.idx <= 1 && s >= 36 && s <= 310)
      ? smooth(36, 56, s) * (1 - smooth(270, 310, s))
      : 0;
    const blend = Math.max(wave, early);
    const u = Math.sin(s * 0.014 + C.key * 1.7) * 15.0 + Math.sin(s * 0.037 + C.key * 3.1) * 5.5;
    const mid = C.mountain.id;
    const hw = mid === 'forest' ? 4.2 : mid === 'redrock' ? 3.4 : mid === 'town' ? 3.2 : 2.6;
    return { active: blend > 0.03, blend, u, hw };
  };

  // Evaluate ALL active braided shortcut lines at distance s
  C.lanesAt = function (s, seg) {
    if (!seg || !seg.lanes || !seg.lanes.length) return [];
    const out = [];
    for (let i = 0; i < seg.lanes.length; i++) {
      const L = seg.lanes[i];
      if (s < L.s0 || s > L.s1) continue;
      const enter = smooth(L.s0, L.s0 + 36, s);
      const exit = 1 - smooth(L.s1 - 34, L.s1, s);
      const blend = enter * exit;
      if (blend > 0.02) out.push({ u: L.offset * blend, hw: L.hw, blend, drop: L.drop * blend, side: L.side });
    }
    return out;
  };
  C.laneAt = function (s, seg) {
    const arr = C.lanesAt(s, seg);
    return arr.length ? arr[0] : null;
  };

  // Exact ground height at world (x, z) — infinite boundary-free endless slope OR dramatic career canyon + U-halfpipes + creeks!
  C.height = function (x, z, spOpt, lanesOpt, rampsOpt) {
    const s = Math.max(0, -z);
    const sp = spOpt || C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const hw = sp.hw;
    const lanes = lanesOpt !== undefined ? lanesOpt : C.lanesAt(s, sp.seg);
    const ck = C.creekAt(s);
    const creekM = ck.active ? (1 - smooth(ck.hw * 0.45, ck.hw * 1.15, Math.abs(u - ck.u))) * ck.blend : 0;

    let y;
    if (C.mode.endless) {
      // Truly infinite lateral (-inf..+inf) continuously descending mountain slope (like Cold Smoke — ZERO side walls!)
      const uNorm = clamp(u / (hw * 1.15), -1.0, 1.0);
      const dish = 0.28 * (uNorm * uNorm) * (1 - smooth(hw * 0.9, hw * 1.9, au));
      y = sp.baseY + dish + sp.roll;

      // Sculpted U-shaped freeride halfpipe chute when active
      if (sp.uPipe > 0.02 && au < 34) {
        const pipeEnv = sp.uPipe * (1 - smooth(24, 34, au));
        y += 6.5 * Math.pow(smooth(5.0, 20.0, au), 1.8) * pipeEnv;
      }

      // Optional braided chute grooves near center
      for (let i = 0; i < lanes.length; i++) {
        const L = lanes[i];
        const lm = (1 - smooth(L.hw * 0.72, L.hw + 4.0, Math.abs(u - L.u))) * L.blend;
        if (lm > 0.01) y -= L.drop * 0.8 * lm;
      }

      // Lush organic rolling alpine slopes & undulations infinitely left & right!
      const flankBlend = smooth(10, 34, au);
      const hill = fbm2(x * 0.0075, z * 0.0075, 3, C.seed & 4095) * 14.5
                 + fbm2(x * 0.024, z * 0.024, 2, (C.seed + 77) & 4095) * 3.8;
      y += hill * flankBlend;
    } else {
      // Career modes: sculpted mountain valley bowl + U-halfpipes + panoramic side canyons
      const uNorm = clamp(u / (hw * 1.15), -1.8, 1.8);
      const dish = 0.42 * (uNorm * uNorm);
      const bermH = sp.berm * smooth(0.20, 1.15, Math.abs(uNorm)) * (u * sp.berm > 0 ? 1 : -0.14);
      y = sp.baseY + dish + Math.max(0, bermH) + sp.roll;

      if (sp.uPipe > 0.02) {
        y += 6.5 * Math.pow(smooth(5.0, 20.0, au), 1.8) * sp.uPipe;
      }

      if (sp.stairs > 0.05 && au < hw * 1.15) {
        const stepPhase = fract(s * 0.28);
        y += (0.5 - stepPhase) * 0.44 * sp.stairs;
      }

      let offDist = Math.max(0, au - hw);
      let laneDrop = 0;
      for (let i = 0; i < lanes.length; i++) {
        const L = lanes[i];
        const lu = Math.abs(u - L.u);
        const lOff = Math.max(0, lu - L.hw);
        if (lOff < offDist) offDist = lOff;
        const lm = (1 - smooth(L.hw * 0.72, L.hw + 4.0, lu)) * L.blend;
        if (lm > 0.01) laneDrop = Math.max(laneDrop, L.drop * lm);
      }
      y -= laneDrop;

      if (offDist > 0) {
        const cliffW = u < 0 ? sp.cliffL : sp.cliffR;
        const n1 = fbm2(x * 0.013, z * 0.013, 3, C.seed & 4095);
        const n2 = vnoise2(x * 0.048, z * 0.048, (C.seed + 77) & 4095);

        const openFlank = Math.min(offDist, 26) * 0.14 + (n1 * 0.5 + 0.5) * Math.min(4.5, offDist * 0.18);
        const outer = Math.max(0, offDist - 26);
        const wallScale = C.mountain.id === 'redrock' ? 0.34 : C.mountain.id === 'town' ? 0.26 : C.mountain.id === 'volcano' ? 0.32 : 0.24;
        const outerRise = Math.pow(outer, 1.10) * wallScale + (n1 * 0.5 + 0.5) * Math.min(28, outer * 0.42);
        const riseY = openFlank + (C.mountain.id === 'redrock'
          ? outerRise + Math.sin(outerRise * 0.44 + n1 * 2.2) * 1.25
          : outerRise);

        if (cliffW > 0.01) {
          const shoulder = Math.max(0, offDist - 16.0);
          const dropDepth = C.mountain.id === 'town' ? 68 : C.mountain.id === 'volcano' ? 92 : 85;
          const steepDrop = -dropDepth * smooth(0, 38, shoulder) - Math.min(40, shoulder * 0.28);
          const ledge = Math.sin(shoulder * 0.24 + n1 * 2.4) * 2.2 * smooth(4, 22, shoulder) * (1 - smooth(42, 70, shoulder));
          const cliffY = Math.min(offDist, 16.0) * 0.06 + steepDrop + ledge;
          y += lerp(riseY, cliffY, cliffW) + n2 * Math.min(2.4, offDist * 0.09);
        } else {
          y += riseY + n2 * Math.min(2.4, offDist * 0.09);
        }
      }
    }

    // Shallow meandering mountain creek trough!
    if (creekM > 0.01 && sp.dropFace < 0.35) {
      y -= 0.38 * creekM * (1 - smooth(0.35, 0.85, sp.dropFace));
    }

    // Natural organic earth micro-undulation
    const micro = vnoise2(x * 0.16, z * 0.16, 913) * 0.12;
    y += micro * (C.mountain.id === 'town' ? 0.3 : 1.0);

    // 4. Kicker ramps
    const rList = rampsOpt || C.ramps;
    for (let i = 0; i < rList.length; i++) {
      const rm = rList[i];
      if (s < rm.s - rm.len || s > rm.s + 2.4) continue;
      const du = Math.abs(u - rm.u);
      if (du > rm.w * 0.5 + 2.0) continue;
      const sideM = 1 - smooth(rm.w * 0.44, rm.w * 0.5 + 1.8, du);
      let prof = 0;
      if (s <= rm.s) {
        const t = sat((s - (rm.s - rm.len)) / rm.len);
        prof = t * t * (1.28 - 0.28 * t);
      } else {
        prof = 1 - smooth(rm.s, rm.s + 2.0, s);
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

  // Open freeride surface query: whole mountainside is fast & rideable (infinite in Endless!)
  C.surface = function (x, z) {
    const s = Math.max(0, -z);
    const sp = C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const lanes = C.lanesAt(s, sp.seg);
    let onShortcut = false;
    let offDist = Math.max(0, au - sp.hw);
    for (let i = 0; i < lanes.length; i++) {
      const L = lanes[i];
      const lOff = Math.max(0, Math.abs(u - L.u) - L.hw);
      if (lOff < offDist) {
        offDist = lOff;
        if (lOff <= 1.2) onShortcut = true;
      }
    }
    let onRamp = false;
    for (let i = 0; i < C.ramps.length; i++) {
      const rm = C.ramps[i];
      if (s >= rm.s - rm.len && s <= rm.s + 0.7 && Math.abs(u - rm.u) <= rm.w * 0.54) {
        onRamp = true; break;
      }
    }
    const ck = C.creekAt(s);
    const inCreek = ck.active && ck.blend > 0.25 && Math.abs(u - ck.u) <= ck.hw * 0.92 && sp.dropFace < 0.35;
    if (C.mode.endless) {
      return {
        onTrack: true, onShortcut, onRamp, overCliff: false, inCreek, uPipe: sp.uPipe,
        offDist, u, hw: sp.hw, grip: C.mountain.grip * 0.96, drag: 0.0,
        stairs: 0, dropEdge: sp.dropEdge, dropFace: sp.dropFace,
      };
    }
    const cliffSide = u < 0 ? sp.cliffL : sp.cliffR;
    const overCliff = cliffSide > 0.35 && offDist > 20.0;
    const onTrack = offDist <= 3.5;
    const grip = C.mountain.grip * (offDist <= 20 ? 0.96 : 0.82);
    const drag = offDist <= 18 ? 0.0 : clamp((offDist - 18) * 0.008, 0.0, 0.14);
    return { onTrack, onShortcut, onRamp, overCliff, inCreek, uPipe: sp.uPipe, offDist, u, hw: sp.hw, grip, drag, stairs: sp.stairs, dropEdge: sp.dropEdge, dropFace: sp.dropFace };
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
      if (dr.s + 16 >= s0 && dr.s - 12 <= s1) out.push(dr);
    }
    return out;
  };

  // Infinite 2D spatial-hash wilderness trees/props for Endless mode + 1D bucket props for Career mode
  const BUCKET = 40;
  function buildObsBucket2D(bx, bs) {
    const key = bx + ',' + bs;
    if (C.obsBuckets.size > 260) {
      const firstKey = C.obsBuckets.keys().next().value;
      if (firstKey !== undefined) C.obsBuckets.delete(firstKey);
    }
    const list = [];
    const s0 = bs * BUCKET, x0 = bx * BUCKET;
    const rng = RNG(hash3U(bx * 193 ^ C.mountain.idx * 71, bs * 313, C.seed));
    const kind = C.mountain.propKind;
    const count = Math.round((kind === 'forest' ? 11 : kind === 'town' ? 7 : 6) * (0.85 + rng() * 0.3));

    for (let i = 0; i < count; i++) {
      const s = s0 + rng() * BUCKET;
      const x = x0 + rng() * BUCKET;
      const sp = C.at(s);
      const u = x - sp.cx;

      // Leave optional main starting chute & start gate clear, plus U-pipe trough, creeks, ramps & cliff drop faces
      if (s < 32 && Math.abs(u) < 16) continue;
      if (Math.abs(u) < 9.5) continue;
      if (sp.uPipe > 0.25 && Math.abs(u) < 21) continue;
      const ck = C.creekAt(s);
      if (ck.active && Math.abs(u - ck.u) < ck.hw + 2.4) continue;
      if (sp.dropFace > 0.15 || sp.dropEdge > 0.15) continue;

      let nearRamp = false;
      for (let k = 0; k < C.ramps.length; k++) {
        const rm = C.ramps[k];
        if (s > rm.s - rm.len - 6 && s < rm.s + 14 && Math.abs(u - rm.u) < rm.w + 3) { nearRamp = true; break; }
      }
      if (nearRamp) continue;

      const z = -s, y = C.height(x, z);
      const n = C.normal(x, z);
      if (n[1] < 0.70) continue;

      const scale = 0.85 + rng() * 1.10;
      const sub = kind === 'forest' ? (rng() < 0.86 ? 'pine' : 'boulder')
        : kind === 'canyon' ? (rng() < 0.38 ? 'spire' : rng() < 0.74 ? 'boulder' : 'cactus')
        : kind === 'volcano' ? (rng() < 0.68 ? 'basalt' : 'ember')
        : (rng() < 0.76 ? 'house' : 'lamp');
      if (sub === 'house' && n[1] < 0.80) continue;
      if (sub === 'spire' && n[1] < 0.76) continue;
      const r = sub === 'house' ? 3.2 * scale : sub === 'spire' ? 2.1 * scale : (sub === 'boulder' || sub === 'basalt') ? 1.48 * scale : 0.78 * scale;
      const h = sub === 'house' ? 6.8 * scale : sub === 'pine' ? 11.4 * scale : sub === 'spire' ? 8.6 * scale : 3.4 * scale;
      let tooClose = false;
      for (let j = 0; j < list.length; j++) {
        if (Math.hypot(list[j].x - x, list[j].z - z) < list[j].r + r + 3.2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      list.push({ id: ((bx & 1023) << 12) + bs * 40 + i, s, u, x, y, z, r, h, scale, kind: sub, onTrack: false, colorIdx: Math.floor(rng() * 5) });
    }
    C.obsBuckets.set(key, list);
    return list;
  }

  function buildObsBucket(bi) {
    const list = [];
    if (bi < 1) { C.obsBuckets.set(bi, list); return list; }
    const s0 = bi * BUCKET;
    const rng = RNG(hash2U(bi * 313 + C.mountain.idx * 71, C.seed));
    const kind = C.mountain.propKind;
    const finishClear = !C.mode.endless && Math.abs(s0 + 20 - C.finishS) < 55;

    // 1. Open mountainside natural landmarks & trees
    const edgeCount = Math.round((kind === 'forest' ? 24 : kind === 'town' ? 15 : 15) * (0.85 + rng() * 0.3));
    for (let i = 0; i < edgeCount; i++) {
      const s = s0 + rng() * BUCKET;
      const sp = C.at(s);
      const side = rng() < 0.5 ? -1 : 1;
      const sideCliff = side < 0 ? sp.cliffL : sp.cliffR;
      const maxOut = sideCliff > 0.25 ? 12.0 : 42.0;
      const distOut = sp.hw * 0.85 + 2.5 + rng() * maxOut;
      const u = side * distOut;

      const lanes = C.lanesAt(s, sp.seg);
      let blocksLane = false;
      for (let k = 0; k < lanes.length; k++) {
        if (Math.abs(u - lanes[k].u) < lanes[k].hw + 2.6) { blocksLane = true; break; }
      }
      if (blocksLane) continue;
      if (sp.uPipe > 0.25 && Math.abs(u) < 21) continue;
      const ck = C.creekAt(s);
      if (ck.active && Math.abs(u - ck.u) < ck.hw + 2.4) continue;
      if (sp.dropFace > 0.2 || sp.dropEdge > 0.2) continue;

      const x = sp.cx + u, z = -s, y = C.height(x, z);
      const n = C.normal(x, z);
      if (n[1] < 0.72) continue;

      const scale = 0.85 + rng() * 1.05;
      const sub = kind === 'forest' ? (rng() < 0.84 ? 'pine' : 'boulder')
        : kind === 'canyon' ? (rng() < 0.38 ? 'spire' : rng() < 0.72 ? 'boulder' : 'cactus')
        : kind === 'volcano' ? (rng() < 0.66 ? 'basalt' : 'ember')
        : (rng() < 0.76 ? 'house' : 'lamp');
      if (sub === 'house' && n[1] < 0.80) continue;
      if (sub === 'spire' && n[1] < 0.76) continue;
      const r = sub === 'house' ? 3.2 * scale : sub === 'spire' ? 2.1 * scale : (sub === 'boulder' || sub === 'basalt') ? 1.50 * scale : 0.78 * scale;
      const h = sub === 'house' ? 6.8 * scale : sub === 'pine' ? 11.2 * scale : sub === 'spire' ? 8.6 * scale : 3.4 * scale;
      let tooClose = false;
      for (let j = 0; j < list.length; j++) {
        if (Math.hypot(list[j].x - x, list[j].z - z) < list[j].r + r + 3.4) { tooClose = true; break; }
      }
      if (tooClose) continue;
      list.push({ id: bi * 100 + i, s, u, x, y, z, r, h, scale, kind: sub, onTrack: false, colorIdx: Math.floor(rng() * 5) });
    }

    // 2. Occasional mid-valley boulders / barriers (never blocking mega drops, creeks, or ramps)
    if (!finishClear) {
      const hazCount = Math.floor((0.9 + rng() * 1.2) * C.mode.obsMul);
      for (let i = 0; i < hazCount; i++) {
        const s = s0 + 5 + rng() * (BUCKET - 10);
        const sp = C.at(s);
        let skip = sp.dropFace > 0.1 || sp.dropEdge > 0.1;
        for (let k = 0; !skip && k < C.ramps.length; k++) {
          const rm = C.ramps[k];
          if (s > rm.s - rm.len - 10 && s < rm.s + 22) skip = true;
        }
        for (let k = 0; !skip && k < C.drops.length; k++) {
          if (s > C.drops[k].s - 22 && s < C.drops[k].s + 42) skip = true;
        }
        if (skip) continue;
        const side = rng() < 0.5 ? -1 : 1;
        const u = side * (4.0 + rng() * Math.max(2.5, sp.hw - 5.2));
        const ck = C.creekAt(s);
        if (ck.active && Math.abs(u - ck.u) < ck.hw + 2.0) continue;
        const x = sp.cx + u, z = -s, y = C.height(x, z);
        const sub = kind === 'town' ? 'barrier' : kind === 'volcano' ? 'basalt' : 'boulder';
        const scale = 0.65 + rng() * 0.42;
        list.push({ id: bi * 100 + 60 + i, s, u, x, y, z, r: 1.12 * scale, h: 1.55 * scale, scale, kind: sub, onTrack: true, colorIdx: Math.floor(rng() * 5) });
      }
    }

    C.obsBuckets.set(bi, list);
    return list;
  }

  C.obstaclesNear = function (s0, s1, centerX = null) {
    const cs0 = Math.max(0, Math.floor(s0 / BUCKET));
    const cs1 = Math.max(cs0, Math.floor(s1 / BUCKET));
    const out = [];
    if (C.mode.endless) {
      const cxVal = (centerX !== null && centerX !== undefined) ? centerX : C.at((s0 + s1) * 0.5).cx;
      const cx0 = Math.floor((cxVal - 150) / BUCKET);
      const cx1 = Math.floor((cxVal + 150) / BUCKET);
      for (let bs = cs0; bs <= cs1; bs++) {
        for (let bx = cx0; bx <= cx1; bx++) {
          const key = bx + ',' + bs;
          let arr = C.obsBuckets.get(key);
          if (!arr) arr = buildObsBucket2D(bx, bs);
          for (let i = 0; i < arr.length; i++) out.push(arr[i]);
        }
      }
      return out;
    }
    for (let b = cs0; b <= cs1; b++) {
      let arr = C.obsBuckets.get(b);
      if (!arr) arr = buildObsBucket(b);
      for (let i = 0; i < arr.length; i++) out.push(arr[i]);
    }
    return out;
  };

  function buildPickupBucket(bi, bx = 0) {
    const key = C.mode.endless ? (bx + ',' + bi) : bi;
    if (C.pickupBuckets.has(key)) return C.pickupBuckets.get(key);
    if (C.pickupBuckets.size > 260) {
      const firstKey = C.pickupBuckets.keys().next().value;
      if (firstKey !== undefined) C.pickupBuckets.delete(firstKey);
    }
    const list = [];
    if (bi < 1) { C.pickupBuckets.set(key, list); return list; }
    const s0 = bi * BUCKET, s1 = s0 + BUCKET;
    const rng = RNG(hash3U(bx * 211 + bi * 409, C.mountain.idx * 97 + 19, C.seed));

    const addItem = (s, x, yOff = 1.25, forcedKind = null) => {
      const sp = C.at(s);
      if (!C.mode.endless && Math.abs(s - C.finishS) < 35) return;
      const ck = C.creekAt(s);
      if (ck.active && Math.abs((x - sp.cx) - ck.u) < ck.hw * 0.7) x += (x >= sp.cx + ck.u ? 3.5 : -3.5);
      const z = -s;
      const y = C.height(x, z) + yOff;
      const kind = forcedKind || (rng() < 0.5 ? 'nitro' : 'bottle');
      const id = `${key}:${list.length}:${kind[0]}`;
      list.push({ id, kind, s, x, y, z });
    };

    // 1. Place pickups at ramps / jump approaches (only in primary band bx===0 or career)
    if (bx === 0) {
      for (let k = 0; k < C.ramps.length; k++) {
        const rm = C.ramps[k];
        if (rm.s >= s0 && rm.s < s1 && rng() < 0.85) {
          const sp = C.at(rm.s - 1.5);
          addItem(rm.s - 1.5, sp.cx + rm.u, 1.45);
        }
      }
      for (let k = 0; k < C.drops.length; k++) {
        const dr = C.drops[k];
        if (dr.s >= s0 && dr.s < s1 && rng() < 0.85) {
          const sp = C.at(dr.s - 2.4);
          addItem(dr.s - 2.4, sp.cx + (rng() - 0.5) * Math.min(sp.hw, 11), 1.35);
        }
      }
    }

    // 2. Random trail pickups along the open slope
    const extra = rng() < 0.72 ? 1 : 0;
    for (let i = 0; i < extra && list.length < 2; i++) {
      const s = s0 + 6 + rng() * (BUCKET - 12);
      const sp = C.at(s);
      if (sp.dropFace > 0.2) continue;
      const x = C.mode.endless
        ? (bx * BUCKET + 6 + rng() * (BUCKET - 12))
        : (sp.cx + (rng() - 0.5) * sp.hw * 1.15);
      addItem(s, x, 1.20);
    }

    C.pickupBuckets.set(key, list);
    return list;
  }

  C.pickupsNear = function (s0, s1, centerX = null) {
    const cs0 = Math.max(0, Math.floor(s0 / BUCKET));
    const cs1 = Math.max(cs0, Math.floor(s1 / BUCKET));
    const out = [];
    if (C.mode.endless) {
      const cxVal = (centerX !== null && centerX !== undefined) ? centerX : C.at((s0 + s1) * 0.5).cx;
      const cx0 = Math.floor((cxVal - 130) / BUCKET);
      const cx1 = Math.floor((cxVal + 130) / BUCKET);
      for (let bs = cs0; bs <= cs1; bs++) {
        for (let bx = cx0; bx <= cx1; bx++) {
          const arr = buildPickupBucket(bs, bx);
          for (let i = 0; i < arr.length; i++) {
            if (!C.collectedPickups.has(arr[i].id)) out.push(arr[i]);
          }
        }
      }
      return out;
    }
    for (let b = cs0; b <= cs1; b++) {
      const arr = buildPickupBucket(b, 0);
      for (let i = 0; i < arr.length; i++) {
        if (!C.collectedPickups.has(arr[i].id)) out.push(arr[i]);
      }
    }
    return out;
  };

  C.collectPickup = function (id) {
    if (id) C.collectedPickups.add(id);
  };

  return C;
})();
