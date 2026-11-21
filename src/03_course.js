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
  // True Downhill Domination vertical scale: steep sustained descents, huge cliff plunges, wide freeride bowls!
  const SEG_TEMPLATES = {
    opener:  { slope: 0.38, hw: 15.0, bend: 0.28, berm: 1.0, rollA: 0.15, rollL: 34, stairs: 0, kick: 1, lane: 1, cliffProb: 0.85, megaDrop: 1 },
    cliff:   { slope: 0.48, hw: 14.5, bend: 0.65, berm: 2.2, rollA: 0.30, rollL: 32, stairs: 0, kick: 1, lane: 1, cliffProb: 1.00, megaDrop: 2 },
    fast:    { slope: 0.49, hw: 15.5, bend: 0.55, berm: 1.8, rollA: 0.35, rollL: 38, stairs: 0, kick: 2, lane: 1, cliffProb: 0.55, megaDrop: 1 },
    berms:   { slope: 0.42, hw: 13.8, bend: 1.10, berm: 3.4, rollA: 0.20, rollL: 30, stairs: 0, kick: 1, lane: 1, cliffProb: 0.60, megaDrop: 1 },
    chute:   { slope: 0.56, hw: 13.0, bend: 0.45, berm: 1.6, rollA: 0.40, rollL: 28, stairs: 0, kick: 1, lane: 1, cliffProb: 0.70, megaDrop: 2 },
    kickers: { slope: 0.44, hw: 15.0, bend: 0.35, berm: 1.2, rollA: 0.25, rollL: 34, stairs: 0, kick: 3, lane: 1, cliffProb: 0.50, megaDrop: 1 },
    rollers: { slope: 0.41, hw: 14.5, bend: 0.62, berm: 1.9, rollA: 1.20, rollL: 24, stairs: 0, kick: 1, lane: 1, cliffProb: 0.45, megaDrop: 1 },
    stairs:  { slope: 0.46, hw: 13.5, bend: 0.40, berm: 1.2, rollA: 0.0,  rollL: 32, stairs: 1, kick: 2, lane: 1, cliffProb: 0.80, megaDrop: 2 },
    sprint:  { slope: 0.50, hw: 16.5, bend: 0.22, berm: 0.9, rollA: 0.15, rollL: 38, stairs: 0, kick: 2, lane: 1, cliffProb: 0.55, megaDrop: 1 },
  };

  const C = {
    mountain: MOUNTAINS[0],
    mode: RACE_MODES.freeride,
    seed: 202611,
    finishS: 2300,
    segs: [],
    ramps: [],
    drops: [],       // TRUE downhill mega cliff drop-offs: { s, dropH (12..26m), faceLen, lipH, id }
    obsBuckets: new Map(),
    plannedS: 0,
    samples: [],
    rng: RNG(1),
    key: 0,
  };

  const STEP = 2;
  let spinY = 2600, spinX = 0, spinHeading = 0, spinRollPh = 0;

  function mountainById(id) {
    return MOUNTAINS.find(m => m.id === id) || MOUNTAINS[0];
  }

  function pickSegType(idx, r) {
    if (idx === 0) return 'opener';
    if (!C.mode.endless && C.plannedS + 280 >= C.finishS) return 'sprint';
    if (C.mountain.id === 'town' && idx % 3 === 1) return 'stairs';
    if (idx === 1) return 'cliff';
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

      // TRUE Downhill Domination Mega Cliff Drop-Offs (12m - 26m vertical plunges!!)
      const segDrops = [];
      const dropCount = tpl.megaDrop || 1;
      for (let d = 0; d < dropCount; d++) {
        // Place the very first breathtaking cliff drop right around s=92m so players hit it within 4 seconds!
        const ds = (idx === 0 && d === 0)
          ? 94
          : s0 + len * (dropCount === 1 ? (0.48 + (r() - 0.5) * 0.14) : (0.28 + d * 0.44 + (r() - 0.5) * 0.08));
        if (ds < 78 || (!C.mode.endless && ds > C.finishS - 110)) continue;
        // Dramatic downhill cliff height: 13m to 25m vertical drop over a sheer 12m rock cliff face!
        const dropH = (type === 'chute' || type === 'cliff') ? (18.0 + r() * 8.0) : (13.0 + r() * 6.5);
        const faceLen = 12.0; // steep ~1.5:1 sheer rock cliff face!
        const dropObj = { s: ds, dropH, faceLen, lipH: 1.15 + r() * 0.55, id: C.drops.length };
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
          // Gently steeper catch-slope right below the cliff face (ds 12..44m) for butter-smooth stomps!
          if (ds > dr.faceLen && ds < dr.faceLen + 32) {
            const catchW = 1 - smooth(dr.faceLen, dr.faceLen + 32, ds);
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
    C.samples = [];
    C.plannedS = 0;
    C.rng = RNG(C.seed ^ hashU(C.mountain.idx * 7919 + C.mode.id.length * 131));
    spinY = 2600; spinX = 0; spinHeading = 0; spinRollPh = 0;
    planTo(C.mode.endless ? 1500 : C.finishS + 480);
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
      dropFace: Math.max(a.dropFace, b.dropFace),
      seg,
    };
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

  // Exact ground height at world (x, z) — wide open freeride mountain bowl + braided trails + sheer cliff overlooks!
  C.height = function (x, z, spOpt, lanesOpt, rampsOpt) {
    const s = Math.max(0, -z);
    const sp = spOpt || C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const hw = sp.hw;

    // 1. Wide natural valley bowl + subtle banked berms (no hard artificial gutters!)
    const uNorm = clamp(u / (hw * 1.15), -1.8, 1.8);
    const dish = 0.42 * (uNorm * uNorm);
    const bermH = sp.berm * smooth(0.20, 1.15, Math.abs(uNorm)) * (u * sp.berm > 0 ? 1 : -0.14);
    let y = sp.baseY + dish + Math.max(0, bermH) + sp.roll;

    if (sp.stairs > 0.05 && au < hw * 1.15) {
      const stepPhase = fract(s * 0.28);
      y += (0.5 - stepPhase) * 0.44 * sp.stairs;
    }

    // 2. Braided alternate trails / natural shortcuts (slightly carved faster chutes!)
    const lanes = lanesOpt !== undefined ? lanesOpt : C.lanesAt(s, sp.seg);
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

    // 3. Wide rideable open freeride mountainside! (gently rolling for 32m outside trails so cutting wide is FUN & rideable!)
    if (offDist > 0) {
      const cliffW = u < 0 ? sp.cliffL : sp.cliffR;
      const n1 = fbm2(x * 0.013, z * 0.013, 3, C.seed & 4095);
      const n2 = vnoise2(x * 0.048, z * 0.048, (C.seed + 77) & 4095);

      // Gentle rideable open flank first 26m, then monumental terraced canyon/mountain ridge far out!
      const openFlank = Math.min(offDist, 26) * 0.14 + (n1 * 0.5 + 0.5) * Math.min(4.5, offDist * 0.18);
      const outer = Math.max(0, offDist - 26);
      const wallScale = C.mountain.id === 'redrock' ? 0.34 : C.mountain.id === 'town' ? 0.26 : C.mountain.id === 'volcano' ? 0.32 : 0.24;
      const outerRise = Math.pow(outer, 1.10) * wallScale + (n1 * 0.5 + 0.5) * Math.min(28, outer * 0.42);
      const riseY = openFlank + (C.mountain.id === 'redrock'
        ? Math.floor(outerRise / 5.0) * 2.2 + outerRise * 0.56
        : outerRise);

      if (cliffW > 0.01) {
        // Rideable cliff shoulder 16m wide, THEN plunging into a breathtaking 85m deep canyon/coastal/lava abyss!
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

  // Open freeride surface query: whole mountainside is fast & rideable (no harsh off-track penalty!)
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
    const cliffSide = u < 0 ? sp.cliffL : sp.cliffR;
    const overCliff = cliffSide > 0.35 && offDist > 20.0;
    const onTrack = offDist <= 3.5;
    // Freeride joy: minimal drag even far off the beaten trail so players can carve shortcuts freely!
    const grip = C.mountain.grip * (offDist <= 20 ? 0.96 : 0.82);
    const drag = offDist <= 18 ? 0.0 : clamp((offDist - 18) * 0.008, 0.0, 0.14);
    return { onTrack, onShortcut, onRamp, overCliff, offDist, u, hw: sp.hw, grip, drag, stairs: sp.stairs, dropEdge: sp.dropEdge, dropFace: sp.dropFace };
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

  // Natural scattered wilderness trees, hoodoo spires, basalt crags & hillside houses across the wide open mountain
  const BUCKET = 40;
  function buildObsBucket(bi) {
    const list = [];
    if (bi < 1) { C.obsBuckets.set(bi, list); return list; }
    const s0 = bi * BUCKET;
    const rng = RNG(hash2U(bi * 313 + C.mountain.idx * 71, C.seed));
    const kind = C.mountain.propKind;
    const finishClear = !C.mode.endless && Math.abs(s0 + 20 - C.finishS) < 55;

    // 1. Open mountainside natural landmarks & trees (well spaced so you can weave between them on shortcuts!)
    const edgeCount = Math.round((kind === 'forest' ? 24 : kind === 'town' ? 15 : 15) * (0.85 + rng() * 0.3));
    for (let i = 0; i < edgeCount; i++) {
      const s = s0 + rng() * BUCKET;
      const sp = C.at(s);
      const side = rng() < 0.5 ? -1 : 1;
      const sideCliff = side < 0 ? sp.cliffL : sp.cliffR;
      const maxOut = sideCliff > 0.25 ? 12.0 : 42.0;
      const distOut = sp.hw * 0.85 + 2.5 + rng() * maxOut;
      const u = side * distOut;

      // Keep main braided shortcut lanes clean!
      const lanes = C.lanesAt(s, sp.seg);
      let blocksLane = false;
      for (let k = 0; k < lanes.length; k++) {
        if (Math.abs(u - lanes[k].u) < lanes[k].hw + 2.6) { blocksLane = true; break; }
      }
      if (blocksLane) continue;
      // Keep mega drop cliff faces clean!
      if (sp.dropFace > 0.2 || sp.dropEdge > 0.2) continue;

      const x = sp.cx + u, z = -s, y = C.height(x, z);
      const n = C.normal(x, z);
      if (n[1] < 0.72) continue;

      const scale = 0.85 + rng() * 1.05;
      const sub = kind === 'forest' ? (rng() < 0.84 ? 'pine' : 'boulder')
        : kind === 'canyon' ? (rng() < 0.38 ? 'spire' : rng() < 0.72 ? 'boulder' : 'cactus')
        : kind === 'volcano' ? (rng() < 0.66 ? 'basalt' : 'ember')
        : (rng() < 0.76 ? 'house' : 'lamp');
      const r = sub === 'house' ? 3.2 * scale : sub === 'spire' ? 2.1 * scale : (sub === 'boulder' || sub === 'basalt') ? 1.50 * scale : 0.78 * scale;
      const h = sub === 'house' ? 6.8 * scale : sub === 'pine' ? 11.2 * scale : sub === 'spire' ? 8.6 * scale : 3.4 * scale;
      list.push({ id: bi * 100 + i, s, u, x, y, z, r, h, scale, kind: sub, onTrack: false, colorIdx: Math.floor(rng() * 5) });
    }

    // 2. Occasional mid-valley boulders / barriers (never blocking mega drops or ramps)
    if (!finishClear) {
      const hazCount = Math.floor((0.9 + rng() * 1.2) * C.mode.obsMul);
      for (let i = 0; i < hazCount; i++) {
        const s = s0 + 5 + rng() * (BUCKET - 10);
        const sp = C.at(s);
        let skip = false;
        for (let k = 0; k < C.ramps.length; k++) {
          const rm = C.ramps[k];
          if (s > rm.s - rm.len - 10 && s < rm.s + 22) { skip = true; break; }
        }
        for (let k = 0; k < C.drops.length; k++) {
          if (s > C.drops[k].s - 22 && s < C.drops[k].s + 42) { skip = true; break; }
        }
        if (skip) continue;
        const side = rng() < 0.5 ? -1 : 1;
        const u = side * (4.0 + rng() * Math.max(2.5, sp.hw - 5.2));
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
