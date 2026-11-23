// ---------------------------------------------------------------- 14_props: V7 Grounded Sculpted Biomes, Horizon Fade, Prop Sway & Tiered Coastal Villas
const Props = (() => {
  const TOWN_WALLS = [
    [0.92, 0.86, 0.76], // sun-bleached Mediterranean cream limestone
    [0.86, 0.56, 0.38], // warm Tuscan terracotta plaster
    [0.88, 0.75, 0.48], // Amalfi warm ochre stucco
    [0.78, 0.84, 0.85], // weathered coastal sea-salt plaster
    [0.88, 0.68, 0.56], // dusty coral stucco
  ];
  const TOWN_SHUTTERS = [
    [0.16, 0.44, 0.52], // coastal Mediterranean teal shutters
    [0.24, 0.38, 0.26], // olive green shutters
    [0.54, 0.24, 0.16], // dark terracotta timber
    [0.22, 0.34, 0.52], // slate marine shutters
    [0.36, 0.26, 0.18], // warm cedar shutters
  ];

  function hash1(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function emitArch(s, labelColor, isStart = false) {
    const sp = Course.at(s);
    const hw = sp.hw + 2.4;
    const z = -s;
    const xL = sp.cx - hw, xR = sp.cx + hw;
    const yL = Course.height(xL, z), yR = Course.height(xR, z);
    const topY = Math.max(yL, yR) + 7.8;
    Solid.pushLimb([xL, yL - 0.8, z], [xL, topY, z], 0.56, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xR, yR - 0.8, z], [xR, topY, z], 0.56, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xL - 1.0, yL - 0.8, z - 0.8], [xL, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    Solid.pushLimb([xR + 1.0, yR - 0.8, z - 0.8], [xR, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    Solid.pushLimb([xL - 0.7, topY - 0.65, z], [xR + 0.7, topY - 0.65, z], 1.25, labelColor, 0.36, 'box', 0.35);
    Solid.pushLimb([xL - 0.5, topY + 0.18, z], [xR + 0.5, topY + 0.18, z], 0.18, isStart ? [0.24, 0.88, 0.42] : [0.98, 0.86, 0.34], -1.0, 'box');
  }

  const activeHits = new Map();
  let lastEmitTime = 0;

  function onHit(obs, dirX = 0, dirZ = -1, speed = 20) {
    if (!obs) return;
    const len = Math.hypot(dirX, dirZ) || 1;
    const k = clamp(speed / 28, 0.35, 1.35);
    activeHits.set(obs.id, {
      t0: lastEmitTime,
      dx: dirX / len,
      dz: dirZ / len,
      amp: (obs.kind === 'pine' || obs.kind === 'cactus' || obs.kind === 'lamp') ? 0.24 * k : 0.08 * k,
    });
  }

  function emitObstacle(o, time, scaleFade = 1.0) {
    const sc = (o.scale || 1) * scaleFade;
    let swX = 0, swZ = 0, jX = 0, jZ = 0;
    const hit = activeHits.get(o.id);
    if (hit) {
      const age = Math.max(0, time - hit.t0);
      if (age > 1.45) {
        activeHits.delete(o.id);
      } else {
        const s = hit.amp * Math.exp(-3.2 * age) * Math.sin(age * 22.0 + 0.35);
        swX = -hit.dz * s;
        swZ =  hit.dx * s;
        jX = hit.dx * s * 0.45;
        jZ = hit.dz * s * 0.45;
      }
    }

    const ox = o.x + jX, oz = o.z + jZ;
    // Deep slope-aware footprint anchoring so no boulder, tree, basalt cluster, or villa floats on hillsides!
    const span = Math.max(0.85, (o.r || 1.2) * 0.88);
    const yFoot = Math.min(
      o.y,
      Course.height(ox, oz - span),
      Course.height(ox, oz + span),
      Course.height(ox - span, oz),
      Course.height(ox + span, oz)
    );
    const by = yFoot - 0.55;

    let baseM = m4.translate([ox, by, oz]);
    if (swX || swZ) baseM = m4.mul(m4.mul(baseM, m4.rotX(swX)), m4.rotZ(swZ));
    if (scaleFade < 0.999) baseM = m4.mul(baseM, m4.scale([scaleFade, scaleFade, scaleFade]));
    const unScaledSc = o.scale || 1;
    const pushM = (kind, lx, ly, lz, ry, rx, rz, sx, sy, sz, col, rough) => {
      let m = m4.mul(baseM, m4.translate([lx, ly, lz]));
      if (ry) m = m4.mul(m, m4.rotY(ry));
      if (rx) m = m4.mul(m, m4.rotX(rx));
      if (rz) m = m4.mul(m, m4.rotZ(rz));
      m = m4.mul(m, m4.scale([sx, sy, sz]));
      Solid.push(kind, m, col, rough);
    };

    if (o.kind === 'pine') {
      // Rich dark-bark leaning trunk + 7 overlapping full drooping conifer bough whorls + lush bough crown!
      const lean = (hash1(o.id * 7.3) - 0.5) * 0.08;
      const swayWind = Math.sin(time * 1.4 + o.id * 0.9) * 0.014;
      const trunkH = o.h * 0.88;
      pushM('cyl', 0, trunkH * 0.48, 0, o.id, lean + swayWind, lean * 0.7, 0.36 * unScaledSc, trunkH + 1.1, 0.36 * unScaledSc, [0.18, 0.12, 0.08], 0.92);
      const tint = (hash1(o.id * 3.1) - 0.5) * 0.04;
      const baseGreens = [
        [0.05, 0.15, 0.08], [0.06, 0.18, 0.09], [0.08, 0.22, 0.10], [0.09, 0.25, 0.11],
        [0.11, 0.29, 0.12], [0.13, 0.33, 0.14], [0.15, 0.37, 0.16],
      ];
      const tiers = 7;
      for (let t = 0; t < tiers; t++) {
        const u = t / (tiers - 1);
        const cy = o.h * (0.18 + u * 0.76);
        const rad = lerp(3.65, 1.05, Math.pow(u, 0.88)) * unScaledSc;
        const vy = lerp(2.15, 1.05, u) * unScaledSc;
        const g = baseGreens[t];
        pushM('bough', 0, cy, 0, o.id * 1.9 + t * 1.47, lean * u + swayWind * (1 + u), 0, rad, vy, rad,
          [clamp(g[0] + tint * 0.6, 0.03, 0.35), clamp(g[1] + tint, 0.10, 0.52), clamp(g[2] - tint * 0.5, 0.05, 0.32)], 0.86);
      }
      // Natural fluffy top crown leader bough instead of flat cartoon cone
      pushM('bough', lean * 0.4, o.h * 0.96, 0, o.id + 5.1, swayWind * 1.8, 0, 0.68 * unScaledSc, 1.15 * unScaledSc, 0.68 * unScaledSc, baseGreens[6], 0.84);
    } else if (o.kind === 'spire') {
      // Stratified Moab sandstone hoodoo spire + anchoring talus boulders around base
      const c1 = [0.64, 0.27, 0.13], c2 = [0.50, 0.20, 0.10], c3 = [0.72, 0.36, 0.17];
      pushM('hoodoo', 0, -0.25, 0, o.id * 2.1, 0.02, 0, o.r * 2.35, o.h * 1.08, o.r * 2.05, c1, 0.88);
      pushM('rock',  o.r * 0.85, 0.75 * unScaledSc,  o.r * 0.45, o.id + 1, 0.1, 0.2, o.r * 1.45, o.r * 0.95, o.r * 1.30, c2, 0.90);
      pushM('rock', -o.r * 0.72, 0.55 * unScaledSc, -o.r * 0.50, o.id + 2, -0.15, -0.1, o.r * 1.20, o.r * 0.82, o.r * 1.15, c3, 0.90);
    } else if (o.kind === 'boulder') {
      const bi = Course.mountain.idx;
      const col = bi === 0 ? [0.58, 0.24, 0.12] : bi === 1 ? [0.36, 0.38, 0.40] : [0.40, 0.36, 0.34];
      pushM('rock', 0, o.r * 0.42 + 0.35, 0, o.id * 1.7, 0.22, 0.12, o.r * 2.55, o.r * 1.55, o.r * 2.15, col, 0.90);
      pushM('rock', -o.r * 0.65, o.r * 0.22 + 0.35, o.r * 0.35, o.id + 3.1, 0.36, -0.2, o.r * 1.45, o.r * 0.95, o.r * 1.35, [col[0] * 0.82, col[1] * 0.82, col[2] * 0.82], 0.92);
    } else if (o.kind === 'cactus') {
      // Fluted ribbed Saguaro cactus + organic curved elbow joints + sagebrush cluster
      const col = [0.16, 0.37, 0.14];
      const h = 4.3 * unScaledSc;
      pushM('cactBody', 0, h * 0.46 + 0.35, 0, o.id, 0, 0, 0.58 * unScaledSc, h, 0.58 * unScaledSc, col, 0.82);
      pushM('sphere', 0.48 * unScaledSc, h * 0.48 + 0.35, 0, 0, 0, 0, 0.38 * unScaledSc, 0.38 * unScaledSc, 0.38 * unScaledSc, col, 0.82);
      pushM('cactBody', 0.64 * unScaledSc, h * 0.62 + 0.35, 0, 0, 0, -0.28, 0.38 * unScaledSc, 1.65 * unScaledSc, 0.38 * unScaledSc, col, 0.82);
      pushM('sphere', -0.44 * unScaledSc, h * 0.38 + 0.35, 0.06 * unScaledSc, 0, 0, 0, 0.36 * unScaledSc, 0.36 * unScaledSc, 0.36 * unScaledSc, col, 0.82);
      pushM('cactBody', -0.58 * unScaledSc, h * 0.50 + 0.35, 0.08 * unScaledSc, 0, 0, 0.30, 0.36 * unScaledSc, 1.40 * unScaledSc, 0.36 * unScaledSc, col, 0.82);
      pushM('shrub', 0.38 * unScaledSc, 0.55, -0.28 * unScaledSc, o.id + 2, 0, 0, 1.05 * unScaledSc, 0.85 * unScaledSc, 1.05 * unScaledSc, [0.32, 0.36, 0.20], 0.90);
    } else if (o.kind === 'basalt') {
      // Clustered stepped hexagonal basalt organ formations + obsidian scree boulders
      const col = [0.13, 0.11, 0.12];
      pushM('basalt', 0, o.h * 0.48 + 0.35, 0, o.id * 0.9, 0.04, 0.03, o.r * 2.5, o.h * 1.55, o.r * 2.3, col, 0.82);
      pushM('basalt', o.r * 0.68, o.h * 0.28 + 0.35, -o.r * 0.36, o.id * 1.7 + 1.2, -0.06, 0.10, o.r * 1.6, o.h * 1.05, o.r * 1.5, [0.16, 0.13, 0.14], 0.84);
      pushM('rock', -o.r * 0.72, 0.55, o.r * 0.42, o.id + 2.3, 0.2, 0.1, o.r * 1.2, 0.75 * unScaledSc, o.r * 1.1, [0.11, 0.10, 0.11], 0.88);
    } else if (o.kind === 'ember') {
      pushM('basalt', 0, o.h * 0.40 + 0.35, 0, o.id, 0, 0, o.r * 2.4, o.h * 1.25, o.r * 2.4, [0.15, 0.10, 0.10], 0.84);
      const pulse = 0.84 + 0.24 * Math.sin(time * 4.5 + o.id);
      pushM('rock', 0, o.h * 0.88 + 0.35, 0, o.id, 0, 0, 0.88 * pulse, 0.58 * pulse, 0.88 * pulse, [1.8, 0.42, 0.06], -1.0);
    } else if (o.kind === 'house') {
      // Tiered Mediterranean Coastal Villa on warm limestone retaining plinth (plumb, zero blocky faces!)
      const wallCol = TOWN_WALLS[o.colorIdx % TOWN_WALLS.length];
      const wingCol = [wallCol[0] * 0.92, wallCol[1] * 0.90, wallCol[2] * 0.88];
      const shutCol = TOWN_SHUTTERS[o.colorIdx % TOWN_SHUTTERS.length];
      const roofCol = [0.64, 0.26, 0.16];
      const stoneCol = [0.58, 0.53, 0.46];
      const yaw = ((o.id % 5) - 2) * 0.10;
      const w = 4.6 * unScaledSc, h = 5.6 * unScaledSc, d = 5.2 * unScaledSc;
      const faceSide = o.u > 0 ? -1 : 1;

      // 1. Deep limestone retaining terrace plinth embedded below lowest hill corner
      pushM('box', 0, 0.35, 0, yaw, 0, 0, w * 1.18, 3.6 * unScaledSc, d * 1.18, stoneCol, 0.92);
      // 2. Main stucco villa volume + stepped side alcove wing
      pushM('box', 0, h * 0.52 + 0.9, 0, yaw, 0, 0, w, h, d, wallCol, 0.80);
      pushM('box', -faceSide * w * 0.24, h * 0.38 + 0.8, d * 0.42, yaw, 0, 0, w * 0.72, h * 0.72, d * 0.52, wingCol, 0.82);
      // 3. Overhanging flared Mediterranean terracotta tiled roofs
      pushM('roof', 0, h + 0.92, 0, yaw, 0, 0, w * 1.14, 2.05 * unScaledSc, d * 1.12, roofCol, 0.84);
      pushM('roof', -faceSide * w * 0.24, h * 0.74 + 0.82, d * 0.42, yaw, 0, 0, w * 0.82, 1.45 * unScaledSc, d * 0.62, [0.58, 0.23, 0.14], 0.84);
      // 4. Slender tall shuttered French windows overlooking the trail (no square eyes!)
      const winZ = [-d * 0.24, d * 0.18];
      for (const wz of winZ) {
        pushM('box', faceSide * (w * 0.505), h * 0.62 + 0.9, wz, yaw, 0, 0, 0.12, 1.32 * unScaledSc, 0.68 * unScaledSc, [0.12, 0.16, 0.22], 0.24);
        pushM('box', faceSide * (w * 0.508), h * 0.62 + 0.9, wz - 0.50 * unScaledSc, yaw, 0, 0, 0.10, 1.32 * unScaledSc, 0.28 * unScaledSc, shutCol, 0.76);
        pushM('box', faceSide * (w * 0.508), h * 0.62 + 0.9, wz + 0.50 * unScaledSc, yaw, 0, 0, 0.10, 1.32 * unScaledSc, 0.28 * unScaledSc, shutCol, 0.76);
        pushM('box', faceSide * (w * 0.52), h * 0.62 + 0.20, wz, yaw, 0, 0, 0.22, 0.14, 0.92 * unScaledSc, stoneCol, 0.88);
      }
      // 5. Timber pergola overhang + cypress / coastal bougainvillea garden
      pushM('box', faceSide * (w * 0.62), h * 0.36 + 0.9, 0, yaw, 0, 0, 0.95 * unScaledSc, 0.14, d * 0.76, [0.38, 0.24, 0.14], 0.82);
      pushM('bough', faceSide * (w * 0.76), 2.3 * unScaledSc, -d * 0.44, o.id, 0, 0, 0.72 * unScaledSc, 2.8 * unScaledSc, 0.72 * unScaledSc, [0.10, 0.26, 0.12], 0.85);
      pushM('shrub', faceSide * (w * 0.72), 0.95, d * 0.42, o.id + 1, 0, 0, 1.25 * unScaledSc, 1.25 * unScaledSc, 1.25 * unScaledSc, [0.78, 0.22, 0.42], 0.82);
    } else if (o.kind === 'lamp') {
      pushM('cyl', 0, 2.7, 0, 0, 0, 0, 0.22, 5.4, 0.22, [0.20, 0.22, 0.26], 0.42);
      pushM('sphere', 0, 5.45, 0, 0, 0, 0, 0.66, 0.66, 0.66, [1.30, 0.96, 0.54], -1.0);
    } else if (o.kind === 'barrier') {
      pushM('box', 0, 1.12, 0, 0, 0, 0, 2.1 * unScaledSc, 1.05, 0.66, [0.88, 0.22, 0.16], 0.60);
      pushM('box', 0, 1.46, 0, 0, 0, 0, 2.15 * unScaledSc, 0.22, 0.70, [0.94, 0.94, 0.92], 0.60);
    }
    void sc;
  }

  // Organic open-mountainside vegetation, rocks & town overhead banners with smooth horizon scale-fade
  function emitBiomeDetails(s0, s1, time, quality, centerX = null, farDist = 240, camX = 0, camZ = 0) {
    const bi = Course.mountain.idx;
    const isEndless = Course.mode.endless && centerX !== null && centerX !== undefined;
    const step = typeof Quality !== 'undefined' ? Quality.cfg(quality).detailStep
      : ((quality === 'low' || quality === 'smooth') ? 28 : quality === 'balanced' ? 18 : quality === 'high' ? 11 : 14);
    const i0 = Math.max(2, Math.floor(s0 / step));
    const i1 = Math.floor(s1 / step);

    for (let i = i0; i <= i1; i++) {
      const s = i * step;
      const sp = Course.at(s);
      const z = -s;

      if (bi === 3 && (i % 5 === 2) && (isEndless || (sp.cliffL < 0.25 && sp.cliffR < 0.25))) {
        const xL = sp.cx - sp.hw - 2.4, xR = sp.cx + sp.hw + 2.4;
        const yTop = Math.max(Course.height(xL, z), Course.height(xR, z)) + 6.8;
        Solid.pushLimb([xL, yTop, z], [xR, yTop, z], 0.05, [0.22, 0.22, 0.24], 0.5);
        for (let b = 1; b <= 5; b++) {
          const bx = lerp(xL, xR, b / 6);
          Solid.pushTRS('box', [bx, yTop - 0.45, z], 0, 0, 0, [0.65, 0.72, 0.08], TOWN_SHUTTERS[(i + b) % TOWN_SHUTTERS.length], 0.58);
        }
      }

      const hA = hash1(i * 19.3 + bi * 7.1);
      const hB = hash1(i * 37.7 + bi * 13.7);
      let x;
      if (isEndless) {
        const band = Math.floor((centerX - 95) / 28) * 28;
        const colIdx = i % 7;
        x = band + colIdx * 28 + (hash1(i * 41.3 + colIdx) - 0.5) * 24;
        const ck = Course.creekAt(s);
        if (Math.abs(x - sp.cx) < 10 || (ck.active && Math.abs(x - (sp.cx + ck.u)) < ck.hw + 2)) continue;
      } else {
        const side = hA < 0.5 ? -1 : 1;
        const u = side * (16 + hB * 40);
        if ((side < 0 && sp.cliffL > 0.30) || (side > 0 && sp.cliffR > 0.30)) continue;
        x = sp.cx + u;
      }
      const fade = smooth(farDist + 10, farDist - 55, Math.hypot(x - camX, z - camZ));
      if (fade < 0.05) continue;

      const y = Course.height(x, z) - 0.22;
      const sc = (0.75 + hash1(i * 53.1) * 0.95) * fade;

      if (bi === 0) {
        if (hA > 0.35) {
          Solid.pushTRS('shrub', [x, y, z], hB * 6, 0, 0, [1.85 * sc, 1.55 * sc, 1.75 * sc], [0.28, 0.34, 0.18], 0.90);
        } else {
          Solid.pushTRS('rock', [x, y + 0.35 * sc, z], hB * 6, 0.12, 0.08, [3.2 * sc, 1.65 * sc, 2.5 * sc], [0.58, 0.24, 0.13], 0.90);
        }
      } else if (bi === 1) {
        if (hA > 0.42) {
          Solid.pushTRS('shrub', [x, y, z], hB * 6, 0, 0, [2.1 * sc, 1.6 * sc, 1.9 * sc], [0.13, 0.32, 0.12], 0.86);
        } else {
          Solid.pushTRS('cyl', [x, y + 0.22 * sc, z], hB * 3, PI * 0.5, 0.12, [0.46 * sc, 3.8 * sc, 0.46 * sc], [0.24, 0.15, 0.09], 0.90);
        }
      } else if (bi === 2) {
        Solid.pushTRS('basalt', [x, y + 0.8 * sc, z], i, 0.10, 0.08, [1.8 * sc, 2.7 * sc, 1.6 * sc], [0.12, 0.10, 0.11], 0.84);
        if (hB > 0.65) {
          const g = (0.85 + 0.2 * Math.sin(time * 3.8 + i)) * fade;
          Solid.pushTRS('rock', [x + 0.6, y + 0.18, z], 0, 0, 0, [0.75 * g, 0.35 * g, 0.75 * g], [1.6, 0.38, 0.06], -1.0);
        }
      } else {
        if (hA > 0.42) {
          Solid.pushTRS('bough', [x, y + 1.6 * sc, z], i, 0, 0, [1.15 * sc, 2.4 * sc, 1.15 * sc], [0.12, 0.29, 0.14], 0.85);
          Solid.pushTRS('cyl', [x, y + 0.95 * sc, z], 0, 0, 0, [0.22 * sc, 2.2 * sc, 0.22 * sc], [0.26, 0.17, 0.10], 0.88);
        } else {
          Solid.pushTRS('rock', [x, y + 0.3 * sc, z], hB * 4, 0, 0, [3.0 * sc, 1.3 * sc, 2.1 * sc], [0.68, 0.62, 0.54], 0.88);
        }
      }
    }
  }

  // Tapered frothy whitewater & mist-cushioned waterfalls (never boxy!)
  function emitWaterfalls(s0, s1, time) {
    const drops = Course.dropsNear(s0, s1);
    const bi = Course.mountain.idx;
    const isLava = bi === 2;
    const sheetCol = isLava ? [1.9, 0.42, 0.06] : [0.72, 0.90, 0.98];
    const sheetRough = isLava ? -1.0 : 0.14;
    const foamCol = isLava ? [2.2, 0.74, 0.16] : [0.95, 0.98, 1.00];
    const foamRough = isLava ? -1.0 : 0.26;

    for (let i = 0; i < drops.length; i++) {
      const dr = drops[i];
      const ck = Course.creekAt(dr.s);
      if (!dr.hasWaterfall && !ck.active) continue;
      const spTop = Course.at(dr.s);
      const u = ck.active ? ck.u : dr.wfSide * (spTop.hw * 0.62 + 4.5);
      const wx = spTop.cx + u;
      const w = ck.active ? ck.hw * 1.1 : dr.wfWidth;
      const topZ = -(dr.s + 0.4);
      const botZ = -(dr.s + dr.faceLen);
      const topY = Course.height(wx, topZ);
      const botY = Course.height(wx, botZ);
      if (topY - botY < 4.5) continue;

      // Slender curved liquid cylinder sheets + animated foam droplets (organic water ribbons, zero flat slabs)
      for (const frac of [-0.30, 0, 0.30]) {
        const fx = wx + frac * w * 0.65;
        Solid.pushLimb([fx, topY + 0.25, topZ], [fx + frac * 0.5, botY - 0.25, botZ], 0.26 * (1 - Math.abs(frac) * 0.45), sheetCol, sheetRough, 'cyl', w * 0.22);
      }
      for (let k = 0; k < 6; k++) {
        const ph = fract(time * 1.4 + k * 0.166 + dr.id * 0.17);
        const fx = wx + ((k - 2.5) / 2.5) * (w * 0.38);
        const fy = lerp(topY + 0.1, botY + 0.4, ph);
        const fz = lerp(topZ, botZ, ph) + 0.35;
        const spread = 0.65 + ph * 0.85;
        Solid.pushTRS('sphere', [fx, fy, fz], k, 0, 0, [w * 0.24 * spread, 1.45 + ph * 0.8, 0.55 * spread], foamCol, foamRough);
      }
      const pPulse = 0.92 + 0.12 * Math.sin(time * 6.5 + dr.id);
      Solid.pushTRS('sphere', [wx, botY + 0.35, botZ - 0.6], dr.id, 0, 0, [w * 1.65 * pPulse, 1.20, 3.8 * pPulse], foamCol, foamRough);
    }
  }

  function emitGuideFlags(s0, s1, time) {
    const STEP = 52;
    const i0 = Math.max(1, Math.floor(s0 / STEP));
    const i1 = Math.floor(s1 / STEP);
    for (let i = i0; i <= i1; i++) {
      const s = i * STEP;
      if (!Course.mode.endless && Math.abs(s - Course.finishS) < 28) continue;
      if (s < 32) continue;
      const sp = Course.at(s);
      if (sp.dropFace > 0.15 || sp.dropEdge > 0.15) continue;
      const side = (i & 1) ? 1 : -1;
      const gx = sp.cx + side * Math.min(sp.hw * 0.85, 11.5);
      const gz = -s;
      const gy = Course.height(gx, gz);
      const flutter = Math.sin(time * 5.6 + i * 1.3) * 0.18;
      const flagCol = (i % 3 === 0) ? [0.96, 0.68, 0.12] : (i & 1) ? [0.88, 0.24, 0.14] : [0.16, 0.56, 0.82];
      Solid.pushLimb([gx, gy - 0.2, gz], [gx, gy + 3.1, gz], 0.065, [0.86, 0.86, 0.84], 0.42);
      Solid.pushTRS('box', [gx - side * 0.34, gy + 2.75, gz], flutter, 0, 0, [0.76, 0.44, 0.06], flagCol, 0.48);
    }
  }

  function emitPickups(s0, s1, time, centerX = null) {
    if (!Course.pickupsNear) return;
    const pks = Course.pickupsNear(s0, s1, centerX);
    for (let i = 0; i < pks.length; i++) {
      const pk = pks[i];
      const bob = Math.sin(time * 3.8 + i * 1.1) * 0.22;
      const spin = time * 2.4 + i;
      const py = pk.y + bob;
      if (pk.kind === 'nitro') {
        Solid.pushTRS('cyl', [pk.x, py, pk.z], spin, 0.28, 0, [0.34, 0.82, 0.34], [1.4, 0.42, 0.08], -1.0);
        Solid.pushTRS('cyl', [pk.x, py + 0.46, pk.z], spin, 0.28, 0, [0.16, 0.16, 0.16], [1.9, 0.88, 0.20], -1.0);
        Solid.pushTRS('cyl', [pk.x, py - 0.55, pk.z], spin, 0, 0, [0.85, 0.05, 0.85], [1.3, 0.65, 0.14], -1.0);
      } else {
        Solid.pushTRS('cyl', [pk.x, py, pk.z], spin, 0.24, 0, [0.30, 0.72, 0.30], [0.18, 0.85, 1.35], -1.0);
        Solid.pushTRS('cyl', [pk.x, py + 0.42, pk.z], spin, 0.24, 0, [0.15, 0.16, 0.15], [1.5, 1.5, 1.6], -1.0);
        Solid.pushTRS('cyl', [pk.x, py - 0.55, pk.z], spin, 0, 0, [0.85, 0.05, 0.85], [0.22, 0.82, 1.2], -1.0);
      }
    }
  }

  function emit(centerS, time, quality = 'auto', centerX = null, camEye = null) {
    lastEmitTime = time;
    const farDist = typeof Quality !== 'undefined' ? Quality.cfg(quality).farDist
      : ((quality === 'low' || quality === 'smooth') ? 185 : quality === 'high' ? 290 : 235);
    const s0 = Math.max(0, centerS - 32);
    const s1 = centerS + farDist;
    const camX = camEye ? camEye[0] : (centerX !== null && centerX !== undefined ? centerX : Course.at(centerS).cx);
    const camZ = camEye ? camEye[2] : -centerS;

    emitPickups(s0, Math.min(s1, centerS + 165), time, centerX);

    const obs = Course.obstaclesNear(s0, s1, centerX);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (camEye) {
        const lensR = o.kind === 'pine' ? 3.8 * (o.scale || 1) : o.r + 2.2;
        if (camEye[1] < o.y + o.h + 1.8 && Math.hypot(o.x - camEye[0], o.z - camEye[2]) < lensR) continue;
      }
      const dist = Math.hypot(o.x - camX, o.z - camZ);
      const scaleFade = smooth(farDist + 10, farDist - 55, dist);
      if (scaleFade < 0.04) continue;
      emitObstacle(o, time, scaleFade);
    }

    emitBiomeDetails(s0, Math.min(s1, centerS + 235), time, quality, centerX, farDist, camX, camZ);
    emitWaterfalls(s0, Math.min(s1, centerS + 235), time);
    emitGuideFlags(s0, Math.min(s1, centerS + 205), time);

    const ramps = Course.rampsNear(s0, s1);
    for (let i = 0; i < ramps.length; i++) {
      const rm = ramps[i];
      const sp = Course.at(rm.s);
      const z = -rm.s;
      const colFlag = rm.shortcut ? [0.18, 0.76, 0.88] : [0.92, 0.44, 0.10];
      for (const side of [-1, 1]) {
        const fx = sp.cx + rm.u + side * (rm.w * 0.54);
        const fy = Course.height(fx, z);
        Solid.pushLimb([fx, fy - 0.6, z], [fx, fy + 3.2, z], 0.10, [0.82, 0.82, 0.80], 0.45);
        Solid.pushTRS('box', [fx + side * 0.38, fy + 2.7, z], 0, 0, 0, [0.80, 0.52, 0.08], colFlag, 0.42);
        const bfx = fx, bfz = -(rm.s - rm.len);
        const bfy = Course.height(bfx, bfz);
        Solid.pushLimb([bfx, bfy + 0.15, bfz], [fx, fy + 0.18, z], 0.18, [0.44, 0.26, 0.14], 0.82, 'box');
      }
    }

    const drops = Course.dropsNear(s0, s1);
    for (let i = 0; i < drops.length; i++) {
      const dr = drops[i];
      const sp = Course.at(dr.s - 0.6);
      const z = -(dr.s - 0.6);
      const halfSpan = Math.min(sp.hw - 0.6, 8.6);
      const yMid = Course.height(sp.cx, z);
      Solid.pushLimb([sp.cx - halfSpan, yMid + 0.05, z], [sp.cx + halfSpan, yMid + 0.05, z], 0.26, [0.48, 0.30, 0.15], 0.82, 'box', 1.15);
      const poleH = dr.dropH >= 32 ? 5.6 : 4.4;
      for (const side of [-1, 1]) {
        const fx = sp.cx + side * (halfSpan + 0.6);
        const fy = Course.height(fx, z);
        Solid.pushLimb([fx, fy - 0.5, z], [fx, fy + poleH, z], 0.13, [0.20, 0.20, 0.22], 0.45);
        Solid.pushTRS('box', [fx - side * 0.55, fy + poleH - 0.6, z], 0, 0, 0, [1.20, 0.76, 0.10], dr.dropH >= 32 ? [0.96, 0.34, 0.10] : [0.96, 0.58, 0.10], 0.38);
      }
    }

    if (s0 <= 26 && s1 >= 12) emitArch(18, [0.16, 0.56, 0.82], true);
    if (!Course.mode.endless && s0 <= Course.finishS + 20 && s1 >= Course.finishS - 20) {
      emitArch(Course.finishS, [0.92, 0.30, 0.10], false);
    }
  }

  return { emit, onHit, activeHitCount: () => activeHits.size };
})();
