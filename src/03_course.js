// ---------------------------------------------------------------- 03_course: 4-biome downhill mountain generator
// Coordinate system: x = right, y = up, -z = downhill (s = -z is downhill distance in metres).
// Lateral coordinate u = x - cx(s). Both physics, AI, terrain mesh and props read this single truth.

const MOUNTAINS = [
  {
    id: 'redrock', idx: 0, name: '红岩大峡谷', en: 'Red Rock Canyon',
    tagline: '莫阿布红砂断崖与巨型飞跃跳台',
    slopeMul: 1.0, widthMul: 1.08, grip: 1.0,
    sunDir: [0.58, 0.36, -0.73], sunCol: [1.38, 1.02, 0.68], sunInt: 1.55, exposure: 1.02,
    skyZen: [0.14, 0.34, 0.68], skyHor: [0.95, 0.58, 0.32], groundCol: [0.46, 0.24, 0.14], fogDens: 0.0020,
    trackCol: [0.58, 0.30, 0.16], bankCol: [0.68, 0.26, 0.13], rockCol: [0.52, 0.19, 0.11], accentCol: [0.85, 0.48, 0.20],
    dustCol: [0.82, 0.45, 0.24], propKind: 'canyon',
    unlockCost: 0,
  },
  {
    id: 'forest', idx: 1, name: '苍翠松林道', en: 'Pine Forest',
    tagline: '高速弯墙、林间窄道与独木跳台',
    slopeMul: 1.04, widthMul: 0.94, grip: 0.94,
    sunDir: [-0.45, 0.46, -0.76], sunCol: [1.24, 1.18, 0.92], sunInt: 1.45, exposure: 0.98,
    skyZen: [0.16, 0.42, 0.72], skyHor: [0.72, 0.84, 0.78], groundCol: [0.18, 0.28, 0.14], fogDens: 0.0025,
    trackCol: [0.36, 0.24, 0.14], bankCol: [0.17, 0.34, 0.14], rockCol: [0.32, 0.34, 0.33], accentCol: [0.24, 0.44, 0.16],
    dustCol: [0.48, 0.36, 0.24], propKind: 'forest',
    unlockCost: 900,
  },
  {
    id: 'volcano', idx: 2, name: '火山黑砂脊', en: 'Volcanic Ridge',
    tagline: '极速黑砂陡坡、熔岩裂谷与漂移飞跃',
    slopeMul: 1.16, widthMul: 0.98, grip: 0.80,
    sunDir: [0.32, 0.24, -0.92], sunCol: [1.55, 0.68, 0.34], sunInt: 1.50, exposure: 1.08,
    skyZen: [0.14, 0.09, 0.18], skyHor: [0.86, 0.32, 0.14], groundCol: [0.26, 0.10, 0.06], fogDens: 0.0026,
    trackCol: [0.18, 0.16, 0.17], bankCol: [0.13, 0.11, 0.12], rockCol: [0.22, 0.15, 0.13], accentCol: [1.00, 0.34, 0.06],
    dustCol: [0.28, 0.22, 0.20], propKind: 'volcano',
    unlockCost: 2200,
  },
  {
    id: 'town', idx: 3, name: '悬崖山城', en: 'Hillside Town',
    tagline: '石阶连跳、彩墙巷道与海滨狂飙冲线',
    slopeMul: 1.08, widthMul: 0.88, grip: 1.06,
    sunDir: [-0.56, 0.30, -0.77], sunCol: [1.42, 0.92, 0.56], sunInt: 1.52, exposure: 1.00,
    skyZen: [0.18, 0.30, 0.64], skyHor: [0.96, 0.54, 0.42], groundCol: [0.38, 0.28, 0.24], fogDens: 0.0019,
    trackCol: [0.46, 0.43, 0.40], bankCol: [0.64, 0.46, 0.34], rockCol: [0.48, 0.38, 0.32], accentCol: [0.18, 0.68, 0.82],
    dustCol: [0.68, 0.62, 0.54], propKind: 'town',
    unlockCost: 3800,
  },
];

const RACE_MODES = {
  freeride:  { id: 'freeride',  name: '自由速降', en: 'Freeride',       len: 2100, hwMul: 1.12, laneRate: 0.65, rampRate: 1.0, obsMul: 0.85, endless: false },
  technical: { id: 'technical', name: '技术陡坡', en: 'Technical',      len: 1900, hwMul: 0.84, laneRate: 0.35, rampRate: 0.75, obsMul: 1.35, endless: false },
  mcross:    { id: 'mcross',    name: '越野争霸', en: 'Mountain Cross', len: 1700, hwMul: 1.02, laneRate: 0.25, rampRate: 1.45, obsMul: 0.65, endless: false },
  endless:   { id: 'endless',   name: '无尽暴走', en: 'Endless',        len: 1e9,  hwMul: 1.05, laneRate: 0.55, rampRate: 1.15, obsMul: 0.95, endless: true },
};

const Course = (() => {
  const SEG_TEMPLATES = {
    opener:  { slope: 0.26, hw: 12.5, bend: 0.25, berm: 0.8, rollA: 0.0, rollL: 34, stairs: 0, kick: 1, lane: 0 },
    fast:    { slope: 0.36, hw: 11.5, bend: 0.55, berm: 1.8, rollA: 0.3, rollL: 42, stairs: 0, kick: 1, lane: 1 },
    berms:   { slope: 0.31, hw: 10.0, bend: 1.10, berm: 3.4, rollA: 0.2, rollL: 30, stairs: 0, kick: 1, lane: 0 },
    chute:   { slope: 0.44, hw: 8.6,  bend: 0.45, berm: 1.6, rollA: 0.5, rollL: 24, stairs: 0, kick: 1, lane: 1 },
    kickers: { slope: 0.32, hw: 11.5, bend: 0.35, berm: 1.2, rollA: 0.2, rollL: 36, stairs: 0, kick: 3, lane: 0 },
    rollers: { slope: 0.29, hw: 10.5, bend: 0.65, berm: 2.0, rollA: 1.25, rollL: 22, stairs: 0, kick: 1, lane: 1 },
    stairs:  { slope: 0.34, hw: 9.0,  bend: 0.40, berm: 1.0, rollA: 0.0, rollL: 30, stairs: 1, kick: 2, lane: 0 },
    sprint:  { slope: 0.38, hw: 13.0, bend: 0.20, berm: 0.8, rollA: 0.0, rollL: 40, stairs: 0, kick: 2, lane: 0 },
  };

  const C = {
    mountain: MOUNTAINS[0],
    mode: RACE_MODES.freeride,
    seed: 202611,
    finishS: 2100,
    segs: [],
    ramps: [],
    obsBuckets: new Map(),
    plannedS: 0,
    samples: [],   // 1m sampled spine: [baseY, cx, hw, berm, roll, stair, segIdx]
    rng: RNG(1),
    key: 0,
  };

  const STEP = 2; // metres per cached spine sample
  let spinY = 1200, spinX = 0, spinHeading = 0, spinRollPh = 0;

  function mountainById(id) {
    return MOUNTAINS.find(m => m.id === id) || MOUNTAINS[0];
  }

  function pickSegType(idx, r) {
    if (idx === 0) return 'opener';
    if (!C.mode.endless && C.plannedS + 260 >= C.finishS) return 'sprint';
    if (C.mountain.id === 'town' && idx % 3 === 1) return 'stairs';
    if (C.mode.id === 'mcross') {
      const pool = ['berms', 'kickers', 'rollers', 'berms', 'kickers'];
      return pool[idx % pool.length];
    }
    if (C.mode.id === 'technical') {
      const pool = ['chute', 'berms', 'rollers', 'chute', 'fast'];
      return pool[Math.floor(r() * pool.length)];
    }
    const pool = ['fast', 'berms', 'kickers', 'chute', 'rollers', 'fast'];
    return pool[Math.floor(r() * pool.length)];
  }

  function buildRampsForSeg(seg, r) {
    const count = Math.max(0, Math.round(seg.tpl.kick * C.mode.rampRate));
    for (let k = 0; k < count; k++) {
      const frac = (k + 0.55 + (r() - 0.5) * 0.22) / (count + 0.2);
      const rs = seg.s0 + seg.len * clamp(frac, 0.14, 0.86);
      if (rs < 85 || (!C.mode.endless && rs > C.finishS - 90)) continue;
      const sp = C.at(rs);
      const w = 5.4 + r() * 2.2;
      const len = 10.5 + r() * 4.5;
      const h = (seg.type === 'kickers' || C.mode.id === 'mcross') ? (2.3 + r() * 1.1) : (1.6 + r() * 0.9);
      const u = (r() - 0.5) * Math.max(2, sp.hw * 0.72);
      C.ramps.push({ s: rs, u, len, w, h, shortcut: false, id: C.ramps.length });
    }
    // Shortcut exit kicker
    if (seg.lane) {
      const L = seg.lane;
      const rs = L.s1 - 24;
      C.ramps.push({ s: rs, u: L.offset, len: 11, w: 4.8, h: 2.5, shortcut: true, id: C.ramps.length });
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
      let len = type === 'opener' ? 180 : (220 + Math.floor(r() * 110));
      if (!C.mode.endless && C.plannedS + len > C.finishS + 260) {
        len = Math.max(160, C.finishS + 260 - C.plannedS);
      }
      const s0 = C.plannedS;
      const s1 = s0 + len;
      const bendSign = (idx % 2 === 0 ? 1 : -1) * (r() < 0.2 ? -1 : 1);
      const bendAmp = tpl.bend * bendSign * (0.65 + r() * 0.55);
      const bendFreq = (1 + (r() < 0.45 ? 1 : 0)) * PI / len;

      // Optional branching shortcut lane (splits off main track and rejoins with a jump)
      let lane = null;
      if (tpl.lane && idx > 0 && r() < C.mode.laneRate && len >= 210 && (C.mode.endless || s1 < C.finishS - 80)) {
        const side = r() < 0.5 ? -1 : 1;
        lane = {
          s0: s0 + 28,
          s1: s1 - 28,
          side,
          offset: side * (16 + r() * 5),
          hw: 4.4,
          drop: 1.4 + r() * 1.2, // slightly lower/faster chute
        };
      }

      const seg = { idx, type, tpl, s0, s1, len, bendAmp, bendFreq, lane };
      C.segs.push(seg);

      // Integrate spine samples from s0 to s1 in STEP metre increments
      const startI = Math.floor(s0 / STEP);
      const endI = Math.floor(s1 / STEP);
      for (let i = startI; i <= endI; i++) {
        if (i < C.samples.length) continue;
        const s = i * STEP;
        const t = clamp((s - s0) / len, 0, 1);
        const blend = smooth(0, 0.14, t) * (1 - smooth(0.86, 1, t));
        const targetCurve = Math.sin(t * len * bendFreq) * bendAmp * 0.011 * blend;
        spinHeading = clamp(spinHeading + targetCurve * STEP, -0.58, 0.58);
        spinHeading *= Math.exp(-0.004 * STEP);
        spinX += Math.sin(spinHeading) * STEP;

        const slope = tpl.slope * C.mountain.slopeMul * (0.92 + 0.16 * Math.sin(s * 0.017 + C.key));
        spinY -= slope * STEP;
        spinRollPh += STEP / tpl.rollL;

        const hw = tpl.hw * C.mountain.widthMul * C.mode.hwMul;
        const berm = -targetCurve * 240 * tpl.berm; // bank outside of turn UP
        const roll = tpl.rollA * Math.sin(spinRollPh * TAU) * blend;
        C.samples.push({
          s, baseY: spinY, cx: spinX, dcx: Math.sin(spinHeading),
          hw, slope, berm: clamp(berm, -3.8, 3.8), roll,
          stairs: tpl.stairs * blend, segIdx: idx,
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
    C.obsBuckets.clear();
    C.samples = [];
    C.plannedS = 0;
    C.rng = RNG(C.seed ^ hashU(C.mountain.idx * 7919 + C.mode.id.length * 131));
    spinY = 1400; spinX = 0; spinHeading = 0; spinRollPh = 0;
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
      seg,
    };
  };

  // Evaluate shortcut lateral center & blend factor [0..1] at distance s
  C.laneAt = function (s, seg) {
    if (!seg || !seg.lane) return null;
    const L = seg.lane;
    if (s < L.s0 || s > L.s1) return null;
    const enter = smooth(L.s0, L.s0 + 38, s);
    const exit = 1 - smooth(L.s1 - 34, L.s1, s);
    const blend = enter * exit;
    return { u: L.offset * blend, hw: L.hw, blend, drop: L.drop * blend, side: L.side };
  };

  // Exact ground height at world (x, z) — used identically by physics, AI, terrain & props
  // Optional precomputed (sp, lane, ramps) for 30x faster terrain row streaming!
  C.height = function (x, z, spOpt, laneOpt, rampsOpt) {
    const s = Math.max(0, -z);
    const sp = spOpt || C.at(s);
    const u = x - sp.cx;
    const au = Math.abs(u);
    const hw = sp.hw;

    // 1. Track bed + banked berm + subtle dish
    const uNorm = clamp(u / hw, -1.6, 1.6);
    const dish = 0.35 * (uNorm * uNorm);
    const bermH = sp.berm * smooth(0.15, 1.05, Math.abs(uNorm)) * (u * sp.berm > 0 ? 1 : -0.18);
    let y = sp.baseY + dish + Math.max(0, bermH) + sp.roll;

    // Town stepped staircases (rideable rhythmic drops!)
    if (sp.stairs > 0.05 && au < hw * 1.05) {
      const stepPhase = fract(s * 0.28);
      y += (0.5 - stepPhase) * 0.42 * sp.stairs;
    }

    // 2. Outer canyon / mountain walls rising steeply outside the track
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
      const wallScale = C.mountain.id === 'redrock' ? 0.62 : C.mountain.id === 'town' ? 0.54 : C.mountain.id === 'volcano' ? 0.58 : 0.46;
      const rise = Math.pow(offDist, 1.32) * wallScale;
      const n1 = fbm2(x * 0.018, z * 0.018, 3, C.seed & 4095);
      const n2 = vnoise2(x * 0.055, z * 0.055, (C.seed + 77) & 4095);
      const terrace = C.mountain.id === 'redrock'
        ? Math.floor((rise + n1 * 12) / 5.5) * 2.2 + (rise + n1 * 12) * 0.55
        : rise + n1 * Math.min(26, offDist * 0.45);
      y += terrace + n2 * Math.min(3.5, offDist * 0.14);
    } else if (laneMask > 0.01) {
      y -= lane.drop * laneMask;
    }

    // Small organic dirt micro-bump on track
    const micro = vnoise2(x * 0.16, z * 0.16, 913) * 0.14;
    y += micro * (C.mountain.id === 'town' ? 0.35 : 1.0);

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
        prof = t * t * (1.25 - 0.25 * t);
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

  // Material & surface query for shading + tire physics
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
    const onTrack = offDist <= 0.35;
    const grip = C.mountain.grip * (onTrack ? 1.0 : 0.68);
    const drag = onTrack ? 0.0 : clamp(offDist * 0.08, 0.05, 0.55);
    return { onTrack, onShortcut, onRamp, offDist, u, hw: sp.hw, grip, drag, stairs: sp.stairs };
  };

  C.rampsNear = function (s0, s1) {
    const out = [];
    for (let i = 0; i < C.ramps.length; i++) {
      const rm = C.ramps[i];
      if (rm.s + 4 >= s0 && rm.s - rm.len <= s1) out.push(rm);
    }
    return out;
  };

  // Deterministic obstacle generator in 40m buckets along s
  const BUCKET = 40;
  function buildObsBucket(bi) {
    const list = [];
    if (bi < 1) { C.obsBuckets.set(bi, list); return list; } // clean launch pad first 40m
    const s0 = bi * BUCKET;
    const rng = RNG(hash2U(bi * 313 + C.mountain.idx * 71, C.seed));
    const spMid = C.at(s0 + BUCKET * 0.5);
    const kind = C.mountain.propKind;
    const finishClear = !C.mode.endless && Math.abs(s0 + 20 - C.finishS) < 55;

    // 1. Trackside trees / rocks / pillars / houses framing the chute
    const edgeCount = Math.round((kind === 'forest' ? 14 : kind === 'town' ? 10 : 9) * (0.85 + rng() * 0.3));
    for (let i = 0; i < edgeCount; i++) {
      const s = s0 + rng() * BUCKET;
      const sp = C.at(s);
      const side = rng() < 0.5 ? -1 : 1;
      const distOut = sp.hw + 1.8 + rng() * 24;
      const u = side * distOut;
      // Don't block active shortcut lane
      const lane = C.laneAt(s, sp.seg);
      if (lane && Math.abs(u - lane.u) < lane.hw + 2.4) continue;
      const x = sp.cx + u, z = -s, y = C.height(x, z);
      const scale = 0.75 + rng() * 0.85;
      const sub = kind === 'forest' ? (rng() < 0.82 ? 'pine' : 'boulder')
        : kind === 'canyon' ? (rng() < 0.72 ? 'boulder' : 'cactus')
        : kind === 'volcano' ? (rng() < 0.7 ? 'basalt' : 'ember')
        : (rng() < 0.78 ? 'house' : 'lamp');
      const r = sub === 'house' ? 3.2 * scale : sub === 'boulder' || sub === 'basalt' ? 1.55 * scale : 0.75 * scale;
      const h = sub === 'house' ? 6.5 * scale : sub === 'pine' ? 9.5 * scale : 3.2 * scale;
      list.push({ id: bi * 100 + i, s, u, x, y, z, r, h, scale, kind: sub, onTrack: false, colorIdx: Math.floor(rng() * 5) });
    }

    // 2. On-track risk boulders / barriers (never blocking full width, never on ramps/finish)
    if (!finishClear) {
      const hazCount = Math.floor((1.1 + rng() * 1.4) * C.mode.obsMul);
      for (let i = 0; i < hazCount; i++) {
        const s = s0 + 4 + rng() * (BUCKET - 8);
        const sp = C.at(s);
        // Keep away from ramps
        let nearRamp = false;
        for (let k = 0; k < C.ramps.length; k++) {
          const rm = C.ramps[k];
          if (s > rm.s - rm.len - 10 && s < rm.s + 22) { nearRamp = true; break; }
        }
        if (nearRamp) continue;
        // Place off-center so there is always a clean racing line
        const side = rng() < 0.5 ? -1 : 1;
        const u = side * (2.6 + rng() * Math.max(1.5, sp.hw - 4.2));
        const x = sp.cx + u, z = -s, y = C.height(x, z);
        const sub = kind === 'town' ? 'barrier' : kind === 'volcano' ? 'basalt' : 'boulder';
        const scale = 0.65 + rng() * 0.45;
        list.push({ id: bi * 100 + 60 + i, s, u, x, y, z, r: 1.15 * scale, h: 1.6 * scale, scale, kind: sub, onTrack: true, colorIdx: Math.floor(rng() * 5) });
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
