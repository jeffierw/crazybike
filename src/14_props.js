// ---------------------------------------------------------------- 14_props: V3 open freeride landmarks, mega cliff drop timber decks, organic biome scatter & finish arches (no narrow roadside fence boxes!)
const Props = (() => {
  const TOWN_PALETTE = [
    [0.86, 0.34, 0.26], // weathered coral stucco
    [0.18, 0.58, 0.68], // coastal teal
    [0.88, 0.70, 0.24], // warm ochre
    [0.80, 0.46, 0.24], // terracotta
    [0.26, 0.44, 0.74], // valparaiso slate blue
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
    // Twin steel truss towers + diagonal cross braces
    Solid.pushLimb([xL, yL - 0.8, z], [xL, topY, z], 0.56, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xR, yR - 0.8, z], [xR, topY, z], 0.56, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xL - 1.0, yL - 0.8, z - 0.8], [xL, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    Solid.pushLimb([xR + 1.0, yR - 0.8, z - 0.8], [xR, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    // Overhead racing banner beam + subtle light bar
    Solid.pushLimb([xL - 0.7, topY - 0.65, z], [xR + 0.7, topY - 0.65, z], 1.25, labelColor, 0.36, 'box', 0.35);
    Solid.pushLimb([xL - 0.5, topY + 0.18, z], [xR + 0.5, topY + 0.18, z], 0.18, isStart ? [0.24, 0.88, 0.42] : [0.98, 0.86, 0.34], -1.0, 'box');
  }

  function emitObstacle(o, time) {
    const sc = o.scale || 1;
    const by = o.y - 0.70;
    if (o.kind === 'pine') {
      // Rich 4-tier alpine conifer tree with varied needle depth & bark taper
      const trunkH = o.h * 0.32;
      Solid.pushTRS('cyl', [o.x, by + trunkH * 0.5, o.z], 0, 0, 0, [0.56 * sc, trunkH + 1.1, 0.56 * sc], [0.28, 0.17, 0.10], 0.88);
      const greens = [[0.06, 0.19, 0.09], [0.09, 0.25, 0.11], [0.12, 0.31, 0.14], [0.16, 0.38, 0.16]];
      for (let t = 0; t < 4; t++) {
        const cy = by + trunkH + t * (o.h * 0.17);
        const rad = (3.2 - t * 0.58) * sc;
        const ch = (3.4 - t * 0.38) * sc;
        Solid.pushTRS('cone', [o.x, cy + ch * 0.36, o.z], o.id + t * 0.7, 0, 0, [rad, ch, rad], greens[t], 0.84);
      }
    } else if (o.kind === 'spire') {
      // Sculpted Moab stratified sandstone hoodoo spire
      const c1 = [0.60, 0.24, 0.12], c2 = [0.72, 0.34, 0.16], c3 = [0.46, 0.18, 0.10];
      Solid.pushTRS('cyl', [o.x, by + o.h * 0.24, o.z], o.id, 0.04, 0, [o.r * 1.95, o.h * 0.52, o.r * 1.72], c1, 0.88);
      Solid.pushTRS('cyl', [o.x + 0.15 * sc, by + o.h * 0.58, o.z - 0.1 * sc], o.id + 1, 0, 0.05, [o.r * 1.38, o.h * 0.34, o.r * 1.32], c3, 0.90);
      Solid.pushTRS('box', [o.x + 0.1 * sc, by + o.h * 0.82, o.z], o.id * 0.5, 0, 0, [o.r * 1.90, o.h * 0.20, o.r * 1.58], c2, 0.86);
    } else if (o.kind === 'boulder') {
      const col = Course.mountain.id === 'redrock' ? [0.56, 0.22, 0.12] : [0.34, 0.36, 0.38];
      Solid.pushTRS('sphere', [o.x, o.y + o.r * 0.24, o.z], o.id * 1.7, 0.2, 0.1, [o.r * 2.25, o.r * 1.38, o.r * 1.92], col, 0.90);
    } else if (o.kind === 'cactus') {
      const col = [0.16, 0.38, 0.14];
      Solid.pushTRS('cyl', [o.x, by + 1.8 * sc, o.z], 0, 0, 0, [0.44 * sc, 4.0 * sc, 0.44 * sc], col, 0.82);
      Solid.pushLimb([o.x, by + 1.9 * sc, o.z], [o.x + 0.82 * sc, by + 2.2 * sc, o.z], 0.25 * sc, col, 0.82);
      Solid.pushLimb([o.x + 0.82 * sc, by + 2.2 * sc, o.z], [o.x + 0.82 * sc, by + 3.1 * sc, o.z], 0.23 * sc, col, 0.82);
      Solid.pushLimb([o.x, by + 1.4 * sc, o.z], [o.x - 0.72 * sc, by + 1.7 * sc, o.z], 0.23 * sc, col, 0.82);
      Solid.pushLimb([o.x - 0.72 * sc, by + 1.7 * sc, o.z], [o.x - 0.72 * sc, by + 2.5 * sc, o.z], 0.21 * sc, col, 0.82);
    } else if (o.kind === 'basalt') {
      Solid.pushTRS('cone', [o.x, by + o.h * 0.62, o.z], o.id * 0.9, 0.04, 0.04, [o.r * 2.1, o.h * 1.55, o.r * 1.9], [0.13, 0.11, 0.12], 0.80);
    } else if (o.kind === 'ember') {
      Solid.pushTRS('cone', [o.x, by + o.h * 0.45, o.z], o.id, 0, 0, [o.r * 2.3, o.h * 1.25, o.r * 2.3], [0.15, 0.10, 0.10], 0.82);
      const pulse = 0.82 + 0.28 * Math.sin(time * 4.5 + o.id);
      Solid.pushTRS('sphere', [o.x, by + o.h * 0.94, o.z], 0, 0, 0, [0.72 * pulse, 0.60 * pulse, 0.72 * pulse], [1.7, 0.40, 0.06], -1.0);
    } else if (o.kind === 'house') {
      const pal = TOWN_PALETTE[o.colorIdx % TOWN_PALETTE.length];
      const yaw = (o.id % 4) * 0.08 - 0.12;
      const w = 4.6 * sc, h = 6.4 * sc, d = 5.0 * sc;
      Solid.pushTRS('box', [o.x, by + h * 0.42, o.z], yaw, 0, 0, [w, h + 1.6, d], pal, 0.76);
      Solid.pushTRS('box', [o.x, by + h * 0.96, o.z], yaw, 0, 0, [w * 1.12, 0.65, d * 1.12], [0.54, 0.21, 0.14], 0.84);
      const faceSide = o.u > 0 ? -1 : 1;
      const wx = o.x + faceSide * (w * 0.51);
      Solid.pushTRS('box', [wx, by + h * 0.56, o.z], yaw, 0, 0, [0.55, 0.22, d * 0.74], [0.34, 0.22, 0.12], 0.82);
      Solid.pushTRS('box', [wx, by + h * 0.74, o.z - d * 0.20], yaw, 0, 0, [0.14, 1.15, 0.95], [0.14, 0.18, 0.24], 0.30);
      Solid.pushTRS('box', [wx, by + h * 0.74, o.z + d * 0.20], yaw, 0, 0, [0.14, 1.15, 0.95], [0.14, 0.18, 0.24], 0.30);
    } else if (o.kind === 'lamp') {
      Solid.pushLimb([o.x, by, o.z], [o.x, by + 5.4, o.z], 0.14, [0.22, 0.24, 0.28], 0.45);
      Solid.pushTRS('sphere', [o.x, by + 5.5, o.z], 0, 0, 0, [0.42, 0.42, 0.42], [1.20, 0.92, 0.52], -1.0);
    } else if (o.kind === 'barrier') {
      Solid.pushTRS('box', [o.x, o.y + 0.45, o.z], 0, 0, 0, [2.1 * sc, 1.15, 0.75], [0.88, 0.22, 0.16], 0.58);
      Solid.pushTRS('box', [o.x, o.y + 0.82, o.z], 0, 0, 0, [2.15 * sc, 0.22, 0.78], [0.94, 0.94, 0.92], 0.58);
    }
  }

  // Organic open-mountainside biome scatter (infinite-X in Endless!) — zero narrow fence boxes!
  function emitBiomeDetails(s0, s1, time, quality, centerX = null) {
    const bi = Course.mountain.idx;
    const isEndless = Course.mode.endless && centerX !== null && centerX !== undefined;
    const step = quality === 'smooth' ? 28 : quality === 'balanced' ? 18 : quality === 'high' ? 11 : 14;
    const i0 = Math.max(2, Math.floor(s0 / step));
    const i1 = Math.floor(s1 / step);

    for (let i = i0; i <= i1; i++) {
      const s = i * step;
      const sp = Course.at(s);
      const z = -s;

      // Festive overhead street banners in Hillside Town (around guide line)
      if (bi === 3 && (i % 5 === 2) && (isEndless || (sp.cliffL < 0.25 && sp.cliffR < 0.25))) {
        const xL = sp.cx - sp.hw - 2.4, xR = sp.cx + sp.hw + 2.4;
        const yTop = Math.max(Course.height(xL, z), Course.height(xR, z)) + 6.8;
        Solid.pushLimb([xL, yTop, z], [xR, yTop, z], 0.05, [0.22, 0.22, 0.24], 0.5);
        for (let b = 1; b <= 5; b++) {
          const bx = lerp(xL, xR, b / 6);
          Solid.pushTRS('box', [bx, yTop - 0.45, z], 0, 0, 0, [0.65, 0.72, 0.08], TOWN_PALETTE[(i + b) % TOWN_PALETTE.length], 0.58);
        }
      }

      // Natural mountainside vegetation & rocky outcrops across wide open slope (or centered on player X in Endless!)
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
      const y = Course.height(x, z);
      const sc = 0.75 + hash1(i * 53.1) * 0.95;

      if (bi === 0) {
        if (hA > 0.35) {
          Solid.pushTRS('sphere', [x, y + 0.45 * sc, z], i, 0, 0, [1.55 * sc, 0.92 * sc, 1.35 * sc], [0.28, 0.34, 0.18], 0.90);
          Solid.pushTRS('sphere', [x + 0.6 * sc, y + 0.32 * sc, z - 0.3 * sc], i + 1, 0, 0, [1.1 * sc, 0.70 * sc, 1.0 * sc], [0.34, 0.38, 0.20], 0.90);
        } else {
          Solid.pushTRS('box', [x, y + 0.7 * sc, z], hB * 3, 0.08, 0.06, [3.2 * sc, 1.5 * sc, 2.4 * sc], [0.58, 0.24, 0.13], 0.88);
        }
      } else if (bi === 1) {
        if (hA > 0.45) {
          Solid.pushTRS('sphere', [x, y + 0.38 * sc, z], i, 0, 0, [1.85 * sc, 0.82 * sc, 1.65 * sc], [0.14, 0.34, 0.12], 0.86);
        } else {
          Solid.pushTRS('cyl', [x, y + 0.32 * sc, z], hB * 3, PI * 0.5, 0.12, [0.55 * sc, 3.8 * sc, 0.55 * sc], [0.28, 0.18, 0.11], 0.90);
        }
      } else if (bi === 2) {
        Solid.pushTRS('cone', [x, y + 1.1 * sc, z], i, 0.1, 0.08, [1.8 * sc, 2.8 * sc, 1.6 * sc], [0.12, 0.10, 0.11], 0.82);
        if (hB > 0.65) {
          const g = 0.85 + 0.2 * Math.sin(time * 3.8 + i);
          Solid.pushTRS('sphere', [x + 0.6, y + 0.25, z], 0, 0, 0, [0.75 * g, 0.35 * g, 0.75 * g], [1.6, 0.38, 0.06], -1.0);
        }
      } else {
        if (hA > 0.4) {
          Solid.pushTRS('cone', [x, y + 2.4 * sc, z], i, 0, 0, [1.15 * sc, 5.2 * sc, 1.15 * sc], [0.12, 0.28, 0.14], 0.84);
        } else {
          Solid.pushTRS('box', [x, y + 0.65 * sc, z], hB * 0.5, 0, 0, [3.4 * sc, 1.4 * sc, 0.75 * sc], [0.74, 0.70, 0.62], 0.86);
        }
      }
    }
  }

  // Animated cascading cliff waterfalls (alpine/canyon whitewater or glowing Volcano lava falls!)
  function emitWaterfalls(s0, s1, time) {
    const drops = Course.dropsNear(s0, s1);
    const bi = Course.mountain.idx;
    const isLava = bi === 2;
    const sheetCol = isLava ? [1.9, 0.42, 0.06] : [0.70, 0.88, 0.96];
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

      // Primary cascading sheet down the cliff face
      Solid.pushLimb([wx, topY + 0.3, topZ], [wx, botY - 0.3, botZ], 0.55, sheetCol, sheetRough, 'box', w * 0.52);

      // Animated falling streaks & whitewater ribbons
      for (let k = 0; k < 5; k++) {
        const ph = fract(time * 1.35 + k * 0.20 + dr.id * 0.17);
        const fx = wx + ((k - 2) / 2.2) * (w * 0.36);
        const fy = lerp(topY + 0.1, botY + 0.4, ph);
        const fz = lerp(topZ, botZ, ph) + 0.45;
        Solid.pushTRS('box', [fx, fy, fz], 0, 0.42, 0, [w * 0.22, 2.8 + dr.dropH * 0.08, 0.45], foamCol, foamRough);
      }

      // Boiling foam plunge pool cushion at cliff bottom
      const pPulse = 0.92 + 0.12 * Math.sin(time * 6.5 + dr.id);
      Solid.pushTRS('sphere', [wx, botY + 0.45, botZ - 0.6], dr.id, 0, 0, [w * 1.55 * pPulse, 1.35, 3.8 * pPulse], foamCol, foamRough);
    }
  }

  // Optional slalom guide poles & wind-fluttering pennants (pure visual freeride aid — zero barriers!)
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

  function emit(centerS, time, quality = 'auto', centerX = null, camEye = null) {
    const farDist = quality === 'smooth' ? 195 : quality === 'high' ? 285 : 245;
    const s0 = Math.max(0, centerS - 28);
    const s1 = centerS + farDist;

    // 1. Obstacles & biome landmarks (2D infinite grid around rider in Endless + camera lens canopy cull!)
    const obs = Course.obstaclesNear(s0, s1, centerX);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (camEye) {
        const lensR = o.kind === 'pine' ? 3.8 * (o.scale || 1) : o.r + 2.2;
        if (camEye[1] < o.y + o.h + 1.8 && Math.hypot(o.x - camEye[0], o.z - camEye[2]) < lensR) continue;
      }
      emitObstacle(o, time);
    }

    // 2. Organic open-mountainside vegetation, rocks & town overhead banners
    emitBiomeDetails(s0, Math.min(s1, centerS + 215), time, quality, centerX);

    // 3. Cascading cliff waterfalls & optional slalom guide poles
    emitWaterfalls(s0, Math.min(s1, centerS + 225), time);
    emitGuideFlags(s0, Math.min(s1, centerS + 205), time);

    // 4. Twin high-visibility flags + rustic wooden supports on every kicker ramp
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

    // 5. Random-Height Cliff Drop-Offs (6m-66m!): rugged North-Shore wooden launch lip + twin tall drop flags!
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

    // 6. Start gate (s=18) & Finish arch (s=finishS)
    if (s0 <= 26 && s1 >= 12) emitArch(18, [0.16, 0.56, 0.82], true);
    if (!Course.mode.endless && s0 <= Course.finishS + 20 && s1 >= Course.finishS - 20) {
      emitArch(Course.finishS, [0.92, 0.30, 0.10], false);
    }
  }

  return { emit };
})();
