// ---------------------------------------------------------------- 15_wildlife: 4-biome animated wildlife (canyon eagles/bighorn, forest deer, volcanic ravens, coastal seagulls/alley cats)
const Wildlife = (() => {
  const critters = [];
  let rngState = 1337;
  let curBiome = -1;

  function rnd() {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  function targetCount(quality) {
    if (quality === 'smooth') return 1;
    if (quality === 'balanced') return 2;
    if (quality === 'high') return 3;
    return 2; // auto: sparse occasional 1-2 creatures so world feels natural & uncrowded
  }

  function spawnOne(centerS, idx, centerX = null) {
    const bi = Course.mountain ? Course.mountain.idx : 0;
    const s = Math.max(36, centerS + 55 + idx * 95 + rnd() * 55);
    const sp = Course.at(s);
    const side = rnd() < 0.5 ? -1 : 1;
    const anchorX = (centerX !== null && centerX !== undefined) ? centerX : sp.cx;

    // Biome-authentic species matching (Volcano has solitary ravens only — zero mammals on hot lava!)
    let kind, isBird;
    if (bi === 2) {
      kind = 'raven'; isBird = true;
    } else if (bi === 1) {
      if (idx === 1) { kind = 'eagle'; isBird = true; }
      else { kind = 'deer'; isBird = false; }
    } else if (bi === 3) {
      if (idx === 1) { kind = 'cat'; isBird = false; }
      else { kind = 'gull'; isBird = true; }
    } else {
      if (idx === 1) { kind = 'bighorn'; isBird = false; }
      else { kind = 'eagle'; isBird = true; }
    }

    if (isBird) {
      const orbitR = 20 + rnd() * 26;
      const alt = kind === 'gull' ? (14 + rnd() * 12) : (22 + rnd() * 16);
      const cx = anchorX + side * (16 + rnd() * 34);
      return {
        kind,
        isBird: true,
        s,
        cx,
        cz: -s,
        orbitR,
        alt,
        ang: rnd() * TAU,
        angSpd: (rnd() < 0.5 ? 1 : -1) * (0.28 + rnd() * 0.22),
        flapPh: rnd() * TAU,
        flapSpd: kind === 'gull' ? 7.0 : 4.8,
        scale: (kind === 'gull' ? 0.85 : 1.15) + rnd() * 0.30,
        x: cx, y: sp.baseY + alt, z: -s, yaw: 0, bank: 0,
      };
    } else {
      const uStart = side * (16 + rnd() * 24);
      const dir = -side;
      const spd = kind === 'deer' ? 9.5 + rnd() * 4.5
                : kind === 'cat'  ? 5.8 + rnd() * 2.8
                : 7.2 + rnd() * 3.2;
      const x = anchorX + uStart;
      const z = -s;
      const y = Course.height(x, z);
      return {
        kind,
        isBird: false,
        s,
        u: uStart,
        worldX: x,
        dir,
        spd,
        driftS: (rnd() - 0.35) * 4.0,
        gaitPh: rnd() * TAU,
        scale: (kind === 'cat' ? 0.55 : kind === 'deer' ? 1.10 : 0.94) + rnd() * 0.16,
        x, y, z,
        yaw: dir > 0 ? -PI * 0.5 : PI * 0.5,
      };
    }
  }

  function reset() {
    critters.length = 0;
    rngState = ((Course.seed || 2026) ^ 0x5f3759df) >>> 0;
    curBiome = Course.mountain ? Course.mountain.idx : 0;
  }

  function step(centerS, dt, quality = 'auto', centerX = null) {
    const bi = Course.mountain ? Course.mountain.idx : 0;
    if (bi !== curBiome) reset();
    const want = targetCount(quality);

    while (critters.length < want) {
      critters.push(spawnOne(centerS, critters.length, centerX));
    }
    if (critters.length > want) critters.length = want;

    const endlessX = Course.mode.endless && centerX !== null && centerX !== undefined;

    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      if (c.s < centerS - 24 || c.s > centerS + 340) {
        critters[i] = spawnOne(centerS, i, centerX);
        continue;
      }

      if (c.isBird) {
        c.ang += c.angSpd * dt;
        c.flapPh += c.flapSpd * dt;
        const nx = c.cx + Math.cos(c.ang) * c.orbitR;
        const nz = c.cz + Math.sin(c.ang) * c.orbitR * 0.85;
        const dx = nx - c.x, dz = nz - c.z;
        c.x = nx; c.z = nz;
        const gy = Course.height(c.x, c.z);
        c.y = gy + c.alt + Math.sin(c.flapPh * 0.45) * 1.4;
        c.s = -c.z;
        if (Math.hypot(dx, dz) > 0.001) c.yaw = Math.atan2(-dx, -dz);
        c.bank = clamp(-c.angSpd * 0.85, -0.55, 0.55);
      } else {
        const distAhead = c.s - centerS;
        const alertMul = distAhead < 110 ? 1.0 : 0.35;
        c.s += c.driftS * alertMul * dt;
        let nx;
        if (endlessX) {
          c.worldX += c.dir * c.spd * alertMul * dt;
          if (Math.abs(c.worldX - centerX) > 48) c.dir = -c.dir;
          nx = c.worldX;
        } else {
          c.u += c.dir * c.spd * alertMul * dt;
          if (Math.abs(c.u) > 36) c.dir = -c.dir;
          const sp = Course.at(Math.max(10, c.s));
          nx = sp.cx + c.u;
        }
        const nz = -c.s;
        const dx = nx - c.x, dz = nz - c.z;
        c.x = nx; c.z = nz;
        c.y = Course.height(c.x, c.z);
        c.gaitPh += c.spd * alertMul * 1.65 * dt;
        if (Math.hypot(dx, dz) > 0.001) c.yaw = Math.atan2(-dx, -dz);
      }
    }
  }

  function emitBird(c) {
    const sc = c.scale;
    const flap = Math.sin(c.flapPh) * 0.48;
    // Gliding periods interleaved with strong wingbeats!
    const glide = smooth(0.25, 0.85, Math.sin(c.flapPh * 0.22));
    const wingAng = flap * (1 - glide * 0.72) + 0.08;

    let bodyCol = [0.24, 0.16, 0.10], wingCol = [0.18, 0.12, 0.08], headCol = [0.88, 0.86, 0.82];
    if (c.kind === 'gull') {
      bodyCol = [0.95, 0.96, 0.97]; wingCol = [0.86, 0.89, 0.93]; headCol = [0.96, 0.96, 0.96];
    } else if (c.kind === 'raven') {
      bodyCol = [0.09, 0.09, 0.11]; wingCol = [0.12, 0.11, 0.14]; headCol = [0.10, 0.10, 0.12];
    }

    let m = m4.translate([c.x, c.y, c.z]);
    m = m4.mul(m, m4.rotY(c.yaw));
    m = m4.mul(m, m4.rotZ(c.bank));

    // Streamlined body + white/dark head + fanned tail
    Solid.push('box', m4.mul(m, m4.scale([0.32 * sc, 0.22 * sc, 1.12 * sc])), bodyCol, 0.72);
    Solid.push('sphere', m4.mul(m, m4.mul(m4.translate([0, 0.05 * sc, -0.66 * sc]), m4.scale([0.26 * sc, 0.24 * sc, 0.34 * sc]))), headCol, 0.68);
    Solid.push('box', m4.mul(m, m4.mul(m4.translate([0, 0.02 * sc, 0.74 * sc]), m4.scale([0.52 * sc, 0.06 * sc, 0.48 * sc]))), wingCol, 0.75);

    // Articulated left & right flapping swept wings (inner + outer tip!)
    for (const side of [-1, 1]) {
      let wm = m4.mul(m, m4.translate([side * 0.16 * sc, 0.04 * sc, -0.05 * sc]));
      wm = m4.mul(wm, m4.rotZ(side * wingAng));
      Solid.push('box', m4.mul(wm, m4.mul(m4.translate([side * 0.65 * sc, 0, 0.04 * sc]), m4.scale([1.32 * sc, 0.07 * sc, 0.56 * sc]))), wingCol, 0.76);
      let tipM = m4.mul(wm, m4.translate([side * 1.28 * sc, 0, 0.08 * sc]));
      tipM = m4.mul(tipM, m4.rotZ(side * wingAng * 0.55));
      Solid.push('box', m4.mul(tipM, m4.mul(m4.translate([side * 0.45 * sc, 0, 0.10 * sc]), m4.scale([0.92 * sc, 0.05 * sc, 0.34 * sc]))), bodyCol, 0.76);
    }
  }

  function emitQuadruped(c) {
    const sc = c.scale;
    const hop = Math.abs(Math.sin(c.gaitPh)) * 0.22 * sc;
    let bodyCol = [0.58, 0.44, 0.30], legCol = [0.32, 0.24, 0.16], tailCol = [0.92, 0.90, 0.86];
    if (c.kind === 'deer') {
      bodyCol = [0.62, 0.38, 0.20]; legCol = [0.42, 0.26, 0.14]; tailCol = [0.95, 0.94, 0.90];
    } else if (c.kind === 'ibex') {
      bodyCol = [0.28, 0.25, 0.24]; legCol = [0.16, 0.15, 0.15]; tailCol = [0.45, 0.42, 0.40];
    } else if (c.kind === 'cat') {
      bodyCol = [0.84, 0.48, 0.18]; legCol = [0.92, 0.88, 0.82]; tailCol = [0.84, 0.48, 0.18];
    }

    let m = m4.translate([c.x, c.y + hop, c.z]);
    m = m4.mul(m, m4.rotY(c.yaw));
    m = m4.mul(m, m4.rotX(Math.cos(c.gaitPh) * 0.12));

    // Torso
    const bodyY = 0.88 * sc;
    Solid.push('box', m4.mul(m, m4.mul(m4.translate([0, bodyY, 0]), m4.scale([0.44 * sc, 0.42 * sc, 1.24 * sc]))), bodyCol, 0.82);

    // Raised neck & head
    const neckH = c.kind === 'deer' ? 0.55 * sc : 0.32 * sc;
    const neckTop = [0, bodyY + neckH, -0.68 * sc];
    Solid.pushLimb(m4.tp(m, [0, bodyY + 0.12 * sc, -0.46 * sc]), m4.tp(m, neckTop), 0.16 * sc, bodyCol, 0.80);
    Solid.push('box', m4.mul(m, m4.mul(m4.translate([0, neckTop[1] + 0.08 * sc, neckTop[2] - 0.18 * sc]), m4.scale([0.24 * sc, 0.22 * sc, 0.42 * sc]))), bodyCol, 0.78);

    // Antlers (deer) or curved horns (bighorn / ibex) or upright tail (cat)
    if (c.kind === 'deer') {
      for (const side of [-1, 1]) {
        const base = m4.tp(m, [side * 0.09 * sc, neckTop[1] + 0.18 * sc, neckTop[2] - 0.06 * sc]);
        const tip  = m4.tp(m, [side * 0.34 * sc, neckTop[1] + 0.56 * sc, neckTop[2] + 0.08 * sc]);
        Solid.pushLimb(base, tip, 0.032 * sc, [0.76, 0.68, 0.54], 0.65);
        Solid.pushLimb(v3.lerp(base, tip, 0.55), m4.tp(m, [side * 0.24 * sc, neckTop[1] + 0.52 * sc, neckTop[2] - 0.14 * sc]), 0.024 * sc, [0.76, 0.68, 0.54], 0.65);
      }
    } else if (c.kind === 'bighorn' || c.kind === 'ibex') {
      for (const side of [-1, 1]) {
        const base = m4.tp(m, [side * 0.10 * sc, neckTop[1] + 0.16 * sc, neckTop[2] - 0.06 * sc]);
        const tip  = m4.tp(m, [side * 0.26 * sc, neckTop[1] + 0.34 * sc, neckTop[2] + 0.24 * sc]);
        Solid.pushLimb(base, tip, 0.055 * sc, [0.36, 0.30, 0.24], 0.68);
      }
    }

    // Tail
    const tEnd = c.kind === 'cat' ? [0, bodyY + 0.58 * sc, 0.88 * sc] : [0, bodyY + 0.16 * sc, 0.78 * sc];
    Solid.pushLimb(m4.tp(m, [0, bodyY + 0.08 * sc, 0.58 * sc]), m4.tp(m, tEnd), 0.075 * sc, tailCol, 0.82);

    // 4 galloping articulated legs
    const swingF = Math.sin(c.gaitPh) * 0.42 * sc;
    const swingB = Math.sin(c.gaitPh + 2.4) * 0.42 * sc;
    const legs = [
      [-0.17 * sc, -0.44 * sc,  swingF],
      [ 0.17 * sc, -0.44 * sc, -swingF * 0.85],
      [-0.17 * sc,  0.46 * sc,  swingB],
      [ 0.17 * sc,  0.46 * sc, -swingB * 0.85],
    ];
    for (let k = 0; k < 4; k++) {
      const [lx, lz, sw] = legs[k];
      const hip  = m4.tp(m, [lx, bodyY - 0.10 * sc, lz]);
      const hoof = m4.tp(m, [lx, 0.02, lz + sw]);
      Solid.pushLimb(hip, hoof, 0.065 * sc, legCol, 0.82);
    }
  }

  function emit() {
    for (let i = 0; i < critters.length; i++) {
      const c = critters[i];
      if (c.isBird) emitBird(c);
      else emitQuadruped(c);
    }
  }

  return {
    reset,
    step,
    emit,
    list: () => critters,
    count: () => critters.length,
  };
})();
