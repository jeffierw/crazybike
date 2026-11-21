// ---------------------------------------------------------------- 14_props: 4-biome landmarks, roadside red-white course tape, chevron turn signs, wooden drop-off decks & finish arches
const Props = (() => {
  const TOWN_PALETTE = [
    [0.92, 0.36, 0.28], // coral stucco
    [0.18, 0.68, 0.78], // coastal teal
    [0.95, 0.76, 0.24], // warm mustard
    [0.88, 0.52, 0.26], // terracotta
    [0.28, 0.48, 0.84], // valparaiso blue
  ];

  function emitArch(s, labelColor, isStart = false) {
    const sp = Course.at(s);
    const hw = sp.hw + 1.2;
    const z = -s;
    const xL = sp.cx - hw, xR = sp.cx + hw;
    const yL = Course.height(xL, z), yR = Course.height(xR, z);
    const topY = Math.max(yL, yR) + 7.4;
    // Twin steel truss towers + diagonal cross braces
    Solid.pushLimb([xL, yL - 0.8, z], [xL, topY, z], 0.54, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xR, yR - 0.8, z], [xR, topY, z], 0.54, [0.16, 0.17, 0.20], 0.4, 'box');
    Solid.pushLimb([xL - 0.9, yL - 0.8, z - 0.8], [xL, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    Solid.pushLimb([xR + 0.9, yR - 0.8, z - 0.8], [xR, topY - 1.5, z], 0.22, [0.22, 0.24, 0.28], 0.45, 'box');
    // Overhead racing banner beam + glowing strip
    Solid.pushLimb([xL - 0.7, topY - 0.65, z], [xR + 0.7, topY - 0.65, z], 1.25, labelColor, 0.32, 'box', 0.35);
    Solid.pushLimb([xL - 0.5, topY + 0.18, z], [xR + 0.5, topY + 0.18, z], 0.20, isStart ? [0.24, 0.95, 0.42] : [1.0, 0.92, 0.35], -1.0, 'box');
  }

  function emitObstacle(o, time) {
    const sc = o.scale || 1;
    const by = o.y - 0.70;
    if (o.kind === 'pine') {
      // Rich 4-tier alpine conifer tree with varied needle depth!
      const trunkH = o.h * 0.30;
      Solid.pushTRS('cyl', [o.x, by + trunkH * 0.5, o.z], 0, 0, 0, [0.58 * sc, trunkH + 1.0, 0.58 * sc], [0.32, 0.19, 0.10], 0.86);
      const greens = [[0.07, 0.22, 0.10], [0.10, 0.29, 0.12], [0.13, 0.36, 0.15], [0.17, 0.44, 0.18]];
      for (let t = 0; t < 4; t++) {
        const cy = by + trunkH + t * (o.h * 0.17);
        const rad = (3.1 - t * 0.58) * sc;
        const ch = (3.3 - t * 0.38) * sc;
        Solid.pushTRS('cone', [o.x, cy + ch * 0.36, o.z], o.id + t * 0.7, 0, 0, [rad, ch, rad], greens[t], 0.82);
      }
    } else if (o.kind === 'spire') {
      // Sculpted Moab layered sandstone hoodoo spire!
      const c1 = [0.64, 0.24, 0.12], c2 = [0.76, 0.36, 0.16], c3 = [0.52, 0.19, 0.10];
      Solid.pushTRS('cyl', [o.x, by + o.h * 0.24, o.z], o.id, 0.04, 0, [o.r * 1.9, o.h * 0.52, o.r * 1.7], c1, 0.86);
      Solid.pushTRS('cyl', [o.x + 0.15 * sc, by + o.h * 0.58, o.z - 0.1 * sc], o.id + 1, 0, 0.05, [o.r * 1.35, o.h * 0.34, o.r * 1.3], c3, 0.88);
      Solid.pushTRS('box', [o.x + 0.1 * sc, by + o.h * 0.82, o.z], o.id * 0.5, 0, 0, [o.r * 1.85, o.h * 0.20, o.r * 1.55], c2, 0.84);
    } else if (o.kind === 'boulder') {
      const col = Course.mountain.id === 'redrock' ? [0.60, 0.22, 0.12] : [0.36, 0.38, 0.40];
      Solid.pushTRS('sphere', [o.x, o.y + o.r * 0.26, o.z], o.id * 1.7, 0.2, 0.1, [o.r * 2.15, o.r * 1.42, o.r * 1.88], col, 0.88);
    } else if (o.kind === 'cactus') {
      const col = [0.18, 0.44, 0.16];
      Solid.pushTRS('cyl', [o.x, by + 1.8 * sc, o.z], 0, 0, 0, [0.46 * sc, 4.0 * sc, 0.46 * sc], col, 0.8);
      Solid.pushLimb([o.x, by + 1.9 * sc, o.z], [o.x + 0.82 * sc, by + 2.2 * sc, o.z], 0.26 * sc, col, 0.8);
      Solid.pushLimb([o.x + 0.82 * sc, by + 2.2 * sc, o.z], [o.x + 0.82 * sc, by + 3.1 * sc, o.z], 0.24 * sc, col, 0.8);
      Solid.pushLimb([o.x, by + 1.4 * sc, o.z], [o.x - 0.72 * sc, by + 1.7 * sc, o.z], 0.24 * sc, col, 0.8);
      Solid.pushLimb([o.x - 0.72 * sc, by + 1.7 * sc, o.z], [o.x - 0.72 * sc, by + 2.5 * sc, o.z], 0.22 * sc, col, 0.8);
    } else if (o.kind === 'basalt') {
      Solid.pushTRS('cone', [o.x, by + o.h * 0.62, o.z], o.id * 0.9, 0.04, 0.04, [o.r * 2.1, o.h * 1.55, o.r * 1.9], [0.13, 0.11, 0.12], 0.78);
    } else if (o.kind === 'ember') {
      Solid.pushTRS('cone', [o.x, by + o.h * 0.45, o.z], o.id, 0, 0, [o.r * 2.3, o.h * 1.25, o.r * 2.3], [0.16, 0.10, 0.10], 0.8);
      const pulse = 0.82 + 0.28 * Math.sin(time * 4.5 + o.id);
      Solid.pushTRS('sphere', [o.x, by + o.h * 0.94, o.z], 0, 0, 0, [0.76 * pulse, 0.64 * pulse, 0.76 * pulse], [1.9, 0.42, 0.06], -1.0);
    } else if (o.kind === 'house') {
      // Multi-story colorful Valparaiso hillside house with terracotta roof, wooden balcony & window panels!
      const pal = TOWN_PALETTE[o.colorIdx % TOWN_PALETTE.length];
      const yaw = (o.id % 4) * 0.08 - 0.12;
      const w = 4.6 * sc, h = 6.4 * sc, d = 5.0 * sc;
      Solid.pushTRS('box', [o.x, by + h * 0.42, o.z], yaw, 0, 0, [w, h + 1.6, d], pal, 0.74);
      // Terracotta roof overhang
      Solid.pushTRS('box', [o.x, by + h * 0.96, o.z], yaw, 0, 0, [w * 1.12, 0.65, d * 1.12], [0.58, 0.22, 0.14], 0.82);
      // Wooden balcony ledge & dark recessed windows facing track
      const faceSide = o.u > 0 ? -1 : 1;
      const wx = o.x + faceSide * (w * 0.51);
      Solid.pushTRS('box', [wx, by + h * 0.56, o.z], yaw, 0, 0, [0.55, 0.22, d * 0.74], [0.34, 0.22, 0.12], 0.80);
      Solid.pushTRS('box', [wx, by + h * 0.74, o.z - d * 0.20], yaw, 0, 0, [0.14, 1.15, 0.95], [0.14, 0.18, 0.24], 0.30);
      Solid.pushTRS('box', [wx, by + h * 0.74, o.z + d * 0.20], yaw, 0, 0, [0.14, 1.15, 0.95], [0.14, 0.18, 0.24], 0.30);
    } else if (o.kind === 'lamp') {
      Solid.pushLimb([o.x, by, o.z], [o.x, by + 5.4, o.z], 0.14, [0.22, 0.24, 0.28], 0.45);
      Solid.pushTRS('sphere', [o.x, by + 5.5, o.z], 0, 0, 0, [0.46, 0.46, 0.46], [1.25, 0.95, 0.52], -1.0);
    } else if (o.kind === 'barrier') {
      Solid.pushTRS('box', [o.x, o.y + 0.45, o.z], 0, 0, 0, [2.1 * sc, 1.15, 0.75], [0.92, 0.22, 0.16], 0.55);
      Solid.pushTRS('box', [o.x, o.y + 0.82, o.z], 0, 0, 0, [2.15 * sc, 0.22, 0.78], [0.96, 0.96, 0.94], 0.55);
    }
  }

  // Roadside red-white racing course tape & poles along sheer cliff rims and sharp berms!
  function emitCourseTape(s0, s1, time) {
    const STEP = 10;
    const i0 = Math.max(2, Math.floor(s0 / STEP));
    const i1 = Math.floor(s1 / STEP);
    const colRed = [0.94, 0.18, 0.12];
    const colWht = [0.96, 0.96, 0.95];
    const colPost = [0.24, 0.25, 0.28];

    for (let i = i0; i <= i1; i++) {
      const sA = i * STEP, sB = (i + 1) * STEP;
      const spA = Course.at(sA), spB = Course.at(sB);

      for (const side of [-1, 1]) {
        const isCliff = (side < 0 ? spA.cliffL : spA.cliffR) > 0.22;
        const isOuterBerm = (side * spA.berm) > 1.05;
        const isGateZone = sA < 48;
        if (!isCliff && !isOuterBerm && !isGateZone) continue;

        const uA = side * (spA.hw + 0.85);
        const uB = side * (spB.hw + 0.85);
        const xA = spA.cx + uA, zA = -sA, yA = Course.height(xA, zA);
        const xB = spB.cx + uB, zB = -sB, yB = Course.height(xB, zB);

        // Racing stake pole
        Solid.pushLimb([xA, yA - 0.3, zA], [xA, yA + 1.38, zA], 0.075, isCliff ? colRed : colPost, 0.45);
        // Fluttering taut red/white course tape ribbon connecting adjacent stakes
        const flutter = Math.sin(time * 5.5 + i * 1.3) * 0.08;
        const tapeCol = (i & 1) ? colRed : colWht;
        Solid.pushLimb(
          [xA, yA + 1.14 + flutter, zA],
          [xB, yB + 1.14 - flutter, zB],
          0.032, tapeCol, 0.42, 'box', 0.14
        );
        // Second lower tape line on sheer cliffs for unmistakable edge clarity!
        if (isCliff) {
          Solid.pushLimb(
            [xA, yA + 0.68 - flutter * 0.6, zA],
            [xB, yB + 0.68 + flutter * 0.6, zB],
            0.028, (i & 1) ? colWht : colRed, 0.42, 'box', 0.11
          );
        }

        // Yellow-black directional chevron turn boards on steep berms every 20m!
        if (isOuterBerm && (i % 2 === 0)) {
          Solid.pushLimb([xA + side * 0.6, yA - 0.3, zA], [xA + side * 0.6, yA + 2.3, zA], 0.09, colPost, 0.45);
          Solid.pushTRS('box', [xA + side * 0.6, yA + 2.15, zA], -side * 0.42, 0, 0, [1.35, 0.82, 0.12], [0.98, 0.78, 0.08], 0.45);
          Solid.pushTRS('box', [xA + side * 0.56, yA + 2.15, zA + 0.04], -side * 0.42, 0, 0, [0.46, 0.46, 0.14], [0.10, 0.10, 0.12], 0.45);
        }
      }

      // Festive hanging street banners overhead in Hillside Town!
      if (Course.mountain.id === 'town' && (i % 8 === 3) && spA.cliffL < 0.25 && spA.cliffR < 0.25) {
        const xL = spA.cx - spA.hw - 1.5, xR = spA.cx + spA.hw + 1.5, z = -sA;
        const yTop = Math.max(Course.height(xL, z), Course.height(xR, z)) + 6.4;
        Solid.pushLimb([xL, yTop, z], [xR, yTop, z], 0.06, [0.2, 0.2, 0.22], 0.5);
        for (let b = 1; b <= 5; b++) {
          const bx = lerp(xL, xR, b / 6);
          const colB = TOWN_PALETTE[(i + b) % TOWN_PALETTE.length];
          Solid.pushTRS('box', [bx, yTop - 0.45, z], 0, 0, 0, [0.65, 0.75, 0.08], colB, 0.55);
        }
      }
    }
  }

  function emit(centerS, time) {
    const s0 = Math.max(0, centerS - 28);
    const s1 = centerS + 250;

    // 1. Obstacles & biome landmarks
    const obs = Course.obstaclesNear(s0, s1);
    for (let i = 0; i < obs.length; i++) emitObstacle(obs[i], time);

    // 2. Roadside racing course tape, cliff markers & corner chevrons
    emitCourseTape(s0, Math.min(s1, centerS + 195), time);

    // 3. Twin high-visibility flags + wooden supports on every kicker ramp
    const ramps = Course.rampsNear(s0, s1);
    for (let i = 0; i < ramps.length; i++) {
      const rm = ramps[i];
      const sp = Course.at(rm.s);
      const z = -rm.s;
      const colFlag = rm.shortcut ? [0.18, 0.92, 1.0] : [1.0, 0.52, 0.08];
      for (const side of [-1, 1]) {
        const fx = sp.cx + rm.u + side * (rm.w * 0.52);
        const fy = Course.height(fx, z);
        Solid.pushLimb([fx, fy - 0.6, z], [fx, fy + 3.2, z], 0.11, [0.92, 0.92, 0.92], 0.4);
        Solid.pushTRS('box', [fx + side * 0.38, fy + 2.7, z], 0, 0, 0, [0.82, 0.56, 0.08], colFlag, -1.0);
        // Timber ramp side deck rail
        const bfx = fx, bfz = -(rm.s - rm.len);
        const bfy = Course.height(bfx, bfz);
        Solid.pushLimb([bfx, bfy + 0.15, bfz], [fx, fy + 0.18, z], 0.18, [0.46, 0.28, 0.14], 0.78, 'box');
      }
    }

    // 4. Vertical rock step-down ledges (断面): twin drop warning flags + North-Shore wooden takeoff lip!
    const drops = Course.dropsNear(s0, s1);
    for (let i = 0; i < drops.length; i++) {
      const dr = drops[i];
      const sp = Course.at(dr.s - 0.5);
      const z = -(dr.s - 0.5);
      const halfSpan = Math.min(sp.hw - 0.8, 7.2);
      // Rustic timber takeoff beam lip spanning the rock drop!
      const yMid = Course.height(sp.cx, z);
      Solid.pushLimb([sp.cx - halfSpan, yMid + 0.06, z], [sp.cx + halfSpan, yMid + 0.06, z], 0.22, [0.54, 0.34, 0.16], 0.76, 'box', 0.85);
      for (const side of [-1, 1]) {
        const fx = sp.cx + side * (halfSpan + 0.5);
        const fy = Course.height(fx, z);
        Solid.pushLimb([fx, fy - 0.4, z], [fx, fy + 3.6, z], 0.12, [0.18, 0.19, 0.22], 0.4);
        Solid.pushTRS('box', [fx - side * 0.45, fy + 3.1, z], 0, 0, 0, [0.95, 0.65, 0.10], [1.0, 0.76, 0.10], -1.0);
      }
    }

    // 5. Start gate (s=18) & Finish arch (s=finishS)
    if (s0 <= 26 && s1 >= 12) emitArch(18, [0.16, 0.62, 0.92], true);
    if (!Course.mode.endless && s0 <= Course.finishS + 20 && s1 >= Course.finishS - 20) {
      emitArch(Course.finishS, [1.0, 0.34, 0.08], false);
    }
  }

  return { emit };
})();
