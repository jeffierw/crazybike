// ---------------------------------------------------------------- 14_props: 4-biome landmarks, trees, boulders, town houses, ramp beacons & finish arch
const Props = (() => {
  const TOWN_PALETTE = [
    [0.92, 0.36, 0.28], // coral stucco
    [0.18, 0.68, 0.78], // coastal teal
    [0.95, 0.76, 0.24], // warm mustard
    [0.88, 0.52, 0.26], // terracotta
    [0.28, 0.48, 0.84], // valparaiso blue
  ];

  function emitArch(s, labelColor) {
    const sp = Course.at(s);
    const hw = sp.hw + 1.2;
    const z = -s;
    const xL = sp.cx - hw, xR = sp.cx + hw;
    const yL = Course.height(xL, z), yR = Course.height(xR, z);
    const topY = Math.max(yL, yR) + 7.2;
    // Twin steel truss towers
    Solid.pushLimb([xL, yL - 0.5, z], [xL, topY, z], 0.52, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xR, yR - 0.5, z], [xR, topY, z], 0.52, [0.16, 0.17, 0.20], 0.4, 'box');
    // Overhead racing banner beam + glowing accent stripes
    Solid.pushLimb([xL - 0.6, topY - 0.6, z], [xR + 0.6, topY - 0.6, z], 1.15, labelColor, 0.35, 'box');
    Solid.pushLimb([xL - 0.4, topY + 0.2, z], [xR + 0.4, topY + 0.2, z], 0.22, [1.0, 0.92, 0.35], -1.0, 'box');
  }

  function emitObstacle(o, time) {
    const sc = o.scale || 1;
    if (o.kind === 'pine') {
      // Trunk + 3 lush stacked pine foliage tiers
      const trunkH = o.h * 0.32;
      Solid.pushTRS('cyl', [o.x, o.y + trunkH * 0.5, o.z], 0, 0, 0, [0.55 * sc, trunkH, 0.55 * sc], [0.34, 0.20, 0.11], 0.85);
      const greens = [[0.10, 0.28, 0.12], [0.13, 0.34, 0.14], [0.16, 0.40, 0.16]];
      for (let t = 0; t < 3; t++) {
        const cy = o.y + trunkH + t * (o.h * 0.22);
        const rad = (2.8 - t * 0.65) * sc;
        const ch = (3.4 - t * 0.45) * sc;
        Solid.pushTRS('cone', [o.x, cy + ch * 0.35, o.z], o.id, 0, 0, [rad, ch, rad], greens[t], 0.82);
      }
    } else if (o.kind === 'boulder') {
      const col = Course.mountain.id === 'redrock' ? [0.64, 0.25, 0.13] : [0.38, 0.40, 0.41];
      Solid.pushTRS('sphere', [o.x, o.y + o.r * 0.55, o.z], o.id * 1.7, 0.2, 0.1, [o.r * 2.1, o.r * 1.45, o.r * 1.85], col, 0.88);
    } else if (o.kind === 'cactus') {
      const col = [0.20, 0.44, 0.18];
      Solid.pushTRS('cyl', [o.x, o.y + 1.8 * sc, o.z], 0, 0, 0, [0.48 * sc, 3.6 * sc, 0.48 * sc], col, 0.8);
      Solid.pushLimb([o.x, o.y + 1.9 * sc, o.z], [o.x + 0.85 * sc, o.y + 2.2 * sc, o.z], 0.28 * sc, col, 0.8);
      Solid.pushLimb([o.x + 0.85 * sc, o.y + 2.2 * sc, o.z], [o.x + 0.85 * sc, o.y + 3.1 * sc, o.z], 0.26 * sc, col, 0.8);
    } else if (o.kind === 'basalt') {
      Solid.pushTRS('cyl', [o.x, o.y + o.h * 0.5, o.z], o.id * 0.9, 0.08, 0.06, [o.r * 1.7, o.h * 1.35, o.r * 1.6], [0.16, 0.14, 0.15], 0.78);
    } else if (o.kind === 'ember') {
      Solid.pushTRS('cone', [o.x, o.y + o.h * 0.4, o.z], o.id, 0, 0, [o.r * 2.2, o.h * 1.0, o.r * 2.2], [0.18, 0.12, 0.11], 0.8);
      const pulse = 0.8 + 0.3 * Math.sin(time * 4.5 + o.id);
      Solid.pushTRS('sphere', [o.x, o.y + o.h * 0.82, o.z], 0, 0, 0, [0.65 * pulse, 0.55 * pulse, 0.65 * pulse], [1.6, 0.38, 0.06], -1.0);
    } else if (o.kind === 'house') {
      const pal = TOWN_PALETTE[o.colorIdx % TOWN_PALETTE.length];
      const w = 4.4 * sc, h = 5.4 * sc, d = 4.8 * sc;
      Solid.pushTRS('box', [o.x, o.y + h * 0.42, o.z], (o.id % 4) * 0.15, 0, 0, [w, h, d], pal, 0.75);
      // Terracotta roof cap
      Solid.pushTRS('box', [o.x, o.y + h * 0.93, o.z], (o.id % 4) * 0.15, 0, 0, [w * 1.08, 0.65, d * 1.08], [0.58, 0.22, 0.14], 0.82);
    } else if (o.kind === 'lamp') {
      Solid.pushLimb([o.x, o.y, o.z], [o.x, o.y + 4.8, o.z], 0.14, [0.22, 0.24, 0.28], 0.45);
      Solid.pushTRS('sphere', [o.x, o.y + 4.9, o.z], 0, 0, 0, [0.42, 0.42, 0.42], [1.2, 0.95, 0.55], -1.0);
    } else if (o.kind === 'barrier') {
      // Red/white urban downhill jersey barrier
      Solid.pushTRS('box', [o.x, o.y + 0.55, o.z], 0, 0, 0, [2.1 * sc, 1.1, 0.75], [0.92, 0.22, 0.16], 0.55);
      Solid.pushTRS('box', [o.x, o.y + 0.88, o.z], 0, 0, 0, [2.15 * sc, 0.22, 0.78], [0.96, 0.96, 0.94], 0.55);
    }
  }

  function emit(centerS, time) {
    const s0 = Math.max(0, centerS - 28);
    const s1 = centerS + 235;

    // 1. Obstacles & biome props
    const obs = Course.obstaclesNear(s0, s1);
    for (let i = 0; i < obs.length; i++) emitObstacle(obs[i], time);

    // 2. High-visibility twin flags flanking every kicker ramp!
    const ramps = Course.rampsNear(s0, s1);
    for (let i = 0; i < ramps.length; i++) {
      const rm = ramps[i];
      const sp = Course.at(rm.s);
      const z = -rm.s;
      const colFlag = rm.shortcut ? [0.18, 0.92, 1.0] : [1.0, 0.52, 0.08];
      for (const side of [-1, 1]) {
        const fx = sp.cx + rm.u + side * (rm.w * 0.52);
        const fy = Course.height(fx, z);
        Solid.pushLimb([fx, fy - 0.3, z], [fx, fy + 3.0, z], 0.11, [0.92, 0.92, 0.92], 0.4);
        Solid.pushTRS('box', [fx + side * 0.35, fy + 2.55, z], 0, 0, 0, [0.75, 0.55, 0.08], colFlag, -1.0);
      }
    }

    // 3. Start gate (s=18) & Finish arch (s=finishS)
    if (s0 <= 24 && s1 >= 14) emitArch(18, [0.16, 0.62, 0.92]);
    if (!Course.mode.endless && s0 <= Course.finishS + 20 && s1 >= Course.finishS - 20) {
      emitArch(Course.finishS, [1.0, 0.34, 0.08]);
    }
  }

  return { emit };
})();
