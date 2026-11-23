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
    if (typeof Quality !== 'undefined') return Quality.cfg(quality).wildlife;
    if (quality === 'low' || quality === 'smooth') return 1;
    if (quality === 'balanced') return 2;
    if (quality === 'high') return 3;
    return 2;
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
    const flap = Math.sin(c.flapPh) * 0.50;
    // Gliding periods interleaved with strong wingbeats!
    const glide = smooth(0.25, 0.85, Math.sin(c.flapPh * 0.22));
    const wingAng = flap * (1 - glide * 0.72) + 0.08;

    let bodyCol = [0.24, 0.16, 0.10], wingCol = [0.18, 0.12, 0.08], headCol = [0.88, 0.86, 0.82];
    if (c.kind === 'gull') {
      bodyCol = [0.95, 0.96, 0.97]; wingCol = [0.82, 0.86, 0.92]; headCol = [0.96, 0.96, 0.96];
    } else if (c.kind === 'raven') {
      bodyCol = [0.09, 0.09, 0.11]; wingCol = [0.12, 0.11, 0.14]; headCol = [0.10, 0.10, 0.12];
    }

    let m = m4.translate([c.x, c.y, c.z]);
    m = m4.mul(m, m4.rotY(c.yaw));
    m = m4.mul(m, m4.rotZ(c.bank));

    // Sculpted teardrop bird fuselage, neck, oval head, beak & fanned tail
    Solid.push('animalBody', m4.mul(m, m4.scale([0.46 * sc, 0.42 * sc, 1.15 * sc])), bodyCol, 0.74);
    Solid.push('sphere', m4.mul(m, m4.mul(m4.translate([0, 0.14 * sc, -0.64 * sc]), m4.scale([0.24 * sc, 0.22 * sc, 0.34 * sc]))), headCol, 0.72);
    Solid.push('cone', m4.mul(m, m4.mul(m4.translate([0, 0.12 * sc, -0.84 * sc]), m4.mul(m4.rotX(-PI * 0.5), m4.scale([0.08 * sc, 0.20 * sc, 0.08 * sc])))), [0.88, 0.66, 0.18], 0.55);
    Solid.push('wingR', m4.mul(m, m4.mul(m4.translate([0, 0.02 * sc, 0.56 * sc]), m4.mul(m4.rotY(-PI * 0.45), m4.scale([0.52 * sc, 0.45 * sc, 0.55 * sc])))), wingCol, 0.76);
    Solid.push('wingL', m4.mul(m, m4.mul(m4.translate([0, 0.02 * sc, 0.56 * sc]), m4.mul(m4.rotY( PI * 0.45), m4.scale([0.52 * sc, 0.45 * sc, 0.55 * sc])))), wingCol, 0.76);

    // Sculpted cambered swept inner & outer articulating wings!
    for (const side of [-1, 1]) {
      const wMesh = side > 0 ? 'wingR' : 'wingL';
      let wm = m4.mul(m, m4.translate([side * 0.14 * sc, 0.06 * sc, -0.06 * sc]));
      wm = m4.mul(wm, m4.rotZ(side * wingAng));
      Solid.push(wMesh, m4.mul(wm, m4.scale([1.18 * sc, 1.0 * sc, 1.05 * sc])), wingCol, 0.78);
      let tipM = m4.mul(wm, m4.translate([side * 1.12 * sc, 0.01 * sc, 0.14 * sc]));
      tipM = m4.mul(tipM, m4.rotZ(side * wingAng * 0.58));
      tipM = m4.mul(tipM, m4.rotY(-side * 0.18));
      Solid.push(wMesh, m4.mul(tipM, m4.scale([0.92 * sc, 0.85 * sc, 0.72 * sc])), bodyCol, 0.78);
    }
  }

  function emitQuadruped(c) {
    const sc = c.scale;
    const hop = Math.abs(Math.sin(c.gaitPh)) * 0.22 * sc;
    let bodyCol = [0.58, 0.44, 0.30], legCol = [0.36, 0.26, 0.18], bellyCol = [0.82, 0.76, 0.66], tailCol = [0.92, 0.90, 0.86];
    if (c.kind === 'deer') {
      bodyCol = [0.64, 0.40, 0.22]; legCol = [0.46, 0.28, 0.16]; bellyCol = [0.88, 0.84, 0.76]; tailCol = [0.95, 0.94, 0.90];
    } else if (c.kind === 'ibex') {
      bodyCol = [0.28, 0.25, 0.24]; legCol = [0.18, 0.16, 0.16]; bellyCol = [0.52, 0.48, 0.44]; tailCol = [0.45, 0.42, 0.40];
    } else if (c.kind === 'cat') {
      bodyCol = [0.84, 0.48, 0.18]; legCol = [0.92, 0.88, 0.82]; bellyCol = [0.94, 0.90, 0.84]; tailCol = [0.84, 0.48, 0.18];
    }

    let m = m4.translate([c.x, c.y + hop, c.z]);
    m = m4.mul(m, m4.rotY(c.yaw));
    m = m4.mul(m, m4.rotX(Math.cos(c.gaitPh) * 0.13));

    // Sculpted anatomical quadruped torso + lighter underside + chest brisket
    const bodyY = 0.88 * sc;
    Solid.push('animalBody', m4.mul(m, m4.mul(m4.translate([0, bodyY, 0]), m4.scale([0.74 * sc, 0.86 * sc, 1.38 * sc]))), bodyCol, 0.84);
    Solid.push('animalBody', m4.mul(m, m4.mul(m4.translate([0, bodyY - 0.08 * sc, 0.02 * sc]), m4.scale([0.62 * sc, 0.64 * sc, 1.18 * sc]))), bellyCol, 0.84);

    // Tapered organic neck, sculpted skull, muzzle & alert ears!
    const neckH = c.kind === 'deer' ? 0.56 * sc : 0.34 * sc;
    const neckTop = [0, bodyY + neckH, -0.66 * sc];
    Solid.pushLimb(m4.tp(m, [0, bodyY + 0.12 * sc, -0.44 * sc]), m4.tp(m, neckTop), 0.15 * sc, bodyCol, 0.82, 'cyl', 0.18 * sc);
    Solid.push('animalBody', m4.mul(m, m4.mul(m4.translate([0, neckTop[1] + 0.06 * sc, neckTop[2] - 0.18 * sc]), m4.mul(m4.rotX(-0.22), m4.scale([0.36 * sc, 0.36 * sc, 0.52 * sc])))), bodyCol, 0.80);
    for (const side of [-1, 1]) {
      const eB = m4.tp(m, [side * 0.08 * sc, neckTop[1] + 0.14 * sc, neckTop[2] - 0.04 * sc]);
      const eT = m4.tp(m, [side * 0.18 * sc, neckTop[1] + 0.28 * sc, neckTop[2] + 0.04 * sc]);
      Solid.pushLimb(eB, eT, 0.036 * sc, bodyCol, 0.80, 'cone');
    }

    // Branching antlers (deer) or segmented curved spiral horns (bighorn / ibex)
    if (c.kind === 'deer') {
      for (const side of [-1, 1]) {
        const b0 = m4.tp(m, [side * 0.07 * sc, neckTop[1] + 0.16 * sc, neckTop[2] - 0.06 * sc]);
        const b1 = m4.tp(m, [side * 0.22 * sc, neckTop[1] + 0.40 * sc, neckTop[2] + 0.04 * sc]);
        const b2 = m4.tp(m, [side * 0.36 * sc, neckTop[1] + 0.60 * sc, neckTop[2] + 0.10 * sc]);
        Solid.pushLimb(b0, b1, 0.028 * sc, [0.76, 0.68, 0.54], 0.68);
        Solid.pushLimb(b1, b2, 0.020 * sc, [0.80, 0.72, 0.58], 0.68);
        Solid.pushLimb(b1, m4.tp(m, [side * 0.16 * sc, neckTop[1] + 0.56 * sc, neckTop[2] - 0.16 * sc]), 0.018 * sc, [0.80, 0.72, 0.58], 0.68);
      }
    } else if (c.kind === 'bighorn' || c.kind === 'ibex') {
      for (const side of [-1, 1]) {
        const h0 = m4.tp(m, [side * 0.09 * sc, neckTop[1] + 0.16 * sc, neckTop[2] - 0.05 * sc]);
        const h1 = m4.tp(m, [side * 0.24 * sc, neckTop[1] + 0.32 * sc, neckTop[2] + 0.12 * sc]);
        const h2 = m4.tp(m, [side * 0.28 * sc, neckTop[1] + 0.18 * sc, neckTop[2] + 0.26 * sc]);
        Solid.pushLimb(h0, h1, 0.055 * sc, [0.36, 0.30, 0.24], 0.72);
        Solid.pushLimb(h1, h2, 0.040 * sc, [0.32, 0.26, 0.20], 0.72);
      }
    }

    // Tail
    const tEnd = c.kind === 'cat' ? [0, bodyY + 0.58 * sc, 0.88 * sc] : [0, bodyY + 0.16 * sc, 0.78 * sc];
    Solid.pushLimb(m4.tp(m, [0, bodyY + 0.08 * sc, 0.58 * sc]), m4.tp(m, tEnd), 0.068 * sc, tailCol, 0.82);

    // 2-Segment Articulated Galloping Legs (Thigh/Shoulder -> Knee/Hock Joint -> Lower Cannon -> Hoof)
    const phF = c.gaitPh, phB = c.gaitPh + 2.35;
    const legs = [
      [-0.16 * sc, -0.42 * sc, phF,  1],
      [ 0.16 * sc, -0.42 * sc, phF + 0.45, 1],
      [-0.16 * sc,  0.44 * sc, phB, -1],
      [ 0.16 * sc,  0.44 * sc, phB + 0.45, -1],
    ];
    for (let k = 0; k < 4; k++) {
      const [lx, lz, ph, bend] = legs[k];
      const sw = Math.sin(ph) * 0.42 * sc;
      const lift = Math.max(0, Math.cos(ph)) * 0.24 * sc;
      const hip  = m4.tp(m, [lx, bodyY - 0.10 * sc, lz]);
      const mid  = m4.tp(m, [lx, bodyY * 0.52 + lift * 0.65, lz + sw * 0.45 + bend * 0.12 * sc]);
      const hoof = m4.tp(m, [lx, 0.02 + lift, lz + sw]);
      Solid.pushLimb(hip, mid, 0.072 * sc, bodyCol, 0.84);
      Solid.pushLimb(mid, hoof, 0.046 * sc, legCol, 0.82);
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
