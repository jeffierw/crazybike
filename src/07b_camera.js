// ---------------------------------------------------------------- 07b_camera: dynamic chase / low / FPV cameras with hard near-plane ground clearance guard
const Camera = (() => {
  Variants.def('cam', '镜头风格', [['a', '贴地激进'], ['b', '标准街机'], ['c', '高广角']], 'b');

  const VIEWS = ['chase', 'low', 'fpv'];
  const C = {
    viewIdx: 0,
    pos: [0, 10, 0],
    target: [0, 8, -10],
    fov: 68 * PI / 180,
    roll: 0,
    near: 0.32,
    far: 920,
    init: false,
    minClearance: 99,
  };

  const PRESETS = {
    a: { dist: 4.5, height: 1.95, look: 15, baseFov: 68 },
    b: { dist: 5.4, height: 2.45, look: 17, baseFov: 66 },
    c: { dist: 6.6, height: 3.15, look: 20, baseFov: 70 },
  };

  C.cycle = function () {
    C.viewIdx = (C.viewIdx + 1) % VIEWS.length;
    return VIEWS[C.viewIdx];
  };

  C.reset = function () {
    C.init = false;
    C.minClearance = 99;
  };

  // Enforce ground clearance for camera eye + bottom corners of near plane (inspired by cold-smoke camclear)
  function guardGround(pos, fwd, right, up, fovY, aspect) {
    const gy = Course.height(pos[0], pos[2]);
    let minH = pos[1] - gy;
    const hh = C.near * Math.tan(fovY * 0.5);
    const hw = hh * aspect;
    // Check bottom-left, bottom-center, bottom-right corners of near plane
    for (const sx of [-1, 0, 1]) {
      const px = pos[0] + fwd[0] * C.near + right[0] * hw * sx - up[0] * hh;
      const py = pos[1] + fwd[1] * C.near + right[1] * hw * sx - up[1] * hh;
      const pz = pos[2] + fwd[2] * C.near + right[2] * hw * sx - up[2] * hh;
      const d = py - Course.height(px, pz);
      if (d < minH) minH = d;
    }
    const wantClear = 0.45;
    if (minH < wantClear) {
      pos[1] += (wantClear - minH);
      minH = wantClear;
    }
    C.minClearance = Math.min(C.minClearance, minH);
    return minH;
  }

  C.update = function (R, dt, aspect, feel) {
    const view = VIEWS[C.viewIdx];
    const preset = PRESETS[Variants.val.cam] || PRESETS.b;
    const spdNorm = sat((R.speed - 10) / 26);

    const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
    let wantPos, wantTgt, wantFov, wantRoll = 0;

    if (R.crashed) {
      // Dramatic orbit-chase watching the ragdoll wipeout!
      wantPos = [R.ragPos[0] + 3.8, R.ragPos[1] + 2.8, R.ragPos[2] + 5.8];
      wantTgt = [R.ragPos[0], R.ragPos[1] + 0.5, R.ragPos[2]];
      wantFov = 62 * PI / 180;
    } else if (view === 'fpv') {
      wantPos = [R.pos[0] + fx * 0.25, R.pos[1] + 1.82 - (R.susp || 0) * 0.6, R.pos[2] + fz * 0.25];
      wantTgt = [R.pos[0] + fx * 18, R.pos[1] + 1.4 + Math.sin(R.pitch) * 14, R.pos[2] + fz * 18];
      wantFov = (76 + spdNorm * 14 + (R.boosting ? 7 : 0)) * PI / 180;
      wantRoll = R.roll * 0.35;
    } else {
      const isLow = view === 'low';
      const dist = (isLow ? 4.1 : preset.dist) + spdNorm * 0.9 + (R.boosting ? 0.65 : 0) + (R.air ? 0.8 : 0);
      const height = (isLow ? 1.55 : preset.height) + (R.air ? 0.35 : 0) - (feel.landDip || 0);
      // Keep camera slightly aligned with course spine so steep bends stay readable
      const sp = Course.at(R.s + 14);
      const lookDirX = lerp(fx, clamp((sp.cx - R.pos[0]) * 0.04, -0.5, 0.5), 0.22);
      const lookDirZ = fz;
      const dl = Math.hypot(lookDirX, lookDirZ) || 1;
      const dx = lookDirX / dl, dz = lookDirZ / dl;

      wantPos = [R.pos[0] - dx * dist, R.pos[1] + height, R.pos[2] - dz * dist];
      wantTgt = [R.pos[0] + dx * preset.look, R.pos[1] + 1.15 - (R.air ? 0.3 : 0), R.pos[2] + dz * preset.look];
      wantFov = (preset.baseFov + spdNorm * 14 + (R.boosting ? 8 : 0)) * PI / 180;
      wantRoll = R.roll * 0.14 + (feel.flinchRoll || 0);
    }

    if (!C.init) {
      C.pos = wantPos.slice();
      C.target = wantTgt.slice();
      C.fov = wantFov;
      C.roll = wantRoll;
      C.init = true;
    } else {
      const kPos = view === 'fpv' ? 28 : 11;
      const kTgt = view === 'fpv' ? 28 : 14;
      C.pos[0] = damp(C.pos[0], wantPos[0], kPos, dt);
      C.pos[1] = damp(C.pos[1], wantPos[1], kPos * 0.85, dt);
      C.pos[2] = damp(C.pos[2], wantPos[2], kPos, dt);
      C.target[0] = damp(C.target[0], wantTgt[0], kTgt, dt);
      C.target[1] = damp(C.target[1], wantTgt[1], kTgt, dt);
      C.target[2] = damp(C.target[2], wantTgt[2], kTgt, dt);
      C.fov = damp(C.fov, wantFov, 7, dt);
      C.roll = damp(C.roll, wantRoll, 9, dt);
    }

    // Apply impact shake
    const sh = feel.shake || 0;
    const eye = [
      C.pos[0] + (Math.random() - 0.5) * sh,
      C.pos[1] + (Math.random() - 0.5) * sh,
      C.pos[2] + (Math.random() - 0.5) * sh * 0.5,
    ];

    const fwd = v3.norm(v3.sub(C.target, eye));
    const worldUp = [Math.sin(C.roll), Math.cos(C.roll), 0];
    const right = v3.norm(v3.cross(fwd, worldUp));
    const up = v3.cross(right, fwd);

    guardGround(eye, fwd, right, up, C.fov, aspect);

    const viewM = m4.lookAt(eye, C.target, up);
    const projM = m4.perspective(C.fov, aspect, C.near, C.far);
    return { eye, target: C.target, viewM, projM, vp: m4.mul(projM, viewM) };
  };

  // Garage showroom orbiting camera (framed cleanly left of the upgrade card column)
  C.garageView = function (angle, aspect) {
    const rad = 4.1;
    const tgt = [0.55, 0.92, 0];
    const eye = [tgt[0] + Math.sin(angle) * rad, 1.58, Math.cos(angle) * rad];
    const viewM = m4.lookAt(eye, tgt, [0, 1, 0]);
    const projM = m4.perspective(46 * PI / 180, aspect, 0.2, 200);
    return { eye, target: tgt, viewM, projM, vp: m4.mul(projM, viewM) };
  };

  return C;
})();
