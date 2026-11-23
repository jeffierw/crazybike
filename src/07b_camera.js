// ---------------------------------------------------------------- 07b_camera: 8-view cinematic camera rig, non-blocking chase angle, 360-orbit drag & start-gate hero framing
const Camera = (() => {
  Variants.def('cam', '镜头风格', [['a', '贴地激进'], ['b', '标准街机'], ['c', '高广角']], 'b');

  const VIEWS = [
    { id: 'chase', name: '追尾',   en: 'Chase',      desc: '后上方俯瞰 · 陡坡与断崖前路全开',     descEn: 'Over-helmet downhill framing · clear road ahead' },
    { id: 'low',   name: '贴地',   en: 'Low',        desc: '紧贴后轮 · 极强贴地速度冲击感',       descEn: 'Low trailing chase · maximum ground speed rush' },
    { id: 'fpv',   name: '头盔',   en: 'Helmet FPV', desc: '车手第一视角 · 自动遮罩头盔零穿模',   descEn: 'Rider goggles POV · head auto-cut' },
    { id: 'fork',  name: '前叉',   en: 'Front Fork', desc: '前叉轮上视角 · 贴地直冲坡道',         descEn: 'Front fork wheel-level cam down the trail' },
    { id: 'high',  name: '俯瞰',   en: 'High',       desc: '高空航拍 · 俯瞰整段峡谷与多线抄近道', descEn: 'Aerial heli cam · full canyon & shortcut view' },
    { id: 'left',  name: '左侧',   en: 'Left',       desc: '左翼近景跟拍 · 清晰呈现蹬踏与踢拳',   descEn: 'Left flank rig · captures cadence & combat' },
    { id: 'right', name: '右侧',   en: 'Right',      desc: '右翼近景跟拍 · 清晰呈现压弯与甩尾',   descEn: 'Right flank rig · captures leans & drifts' },
    { id: 'front', name: '正面',   en: 'Front',      desc: '车前迎面跟拍 · 展示车手神态与特技',   descEn: 'Front hero rig facing rider & stunts' },
  ];

  const PRESETS = {
    a: { dist: 5.05, height: 3.75, look: 28, baseFov: 72, downMix: 0.56 },
    b: { dist: 5.65, height: 4.30, look: 30, baseFov: 70, downMix: 0.58 },
    c: { dist: 6.75, height: 5.10, look: 34, baseFov: 75, downMix: 0.62 },
  };

  const C = {
    VIEWS,
    viewIdx: 0,
    pos: [0, 10, 0],
    target: [0, 8, -10],
    fov: 68 * PI / 180,
    roll: 0,
    near: 0.24,
    far: 1800,
    init: false,
    minClearance: 99,
    lastCam: null,
    // 360-degree orbit / look-around state (active on Title, Pause, and right-drag / IJKL during race)
    orbit: {
      yaw: 0, pit: 0, zoom: 1.0,
      tYaw: 0, tPit: 0, tZoom: 1.0,
      drag: null, idle: 9, keys: {},
      freeMode: false, // true on Title / Pause so left-drag orbits freely & stays put!
    },
  };

  C.currentView = () => VIEWS[C.viewIdx];
  C.setView = function (idOrIdx) {
    const prev = VIEWS[C.viewIdx].id;
    if (typeof idOrIdx === 'number') {
      C.viewIdx = ((idOrIdx % VIEWS.length) + VIEWS.length) % VIEWS.length;
    } else {
      const idx = VIEWS.findIndex(v => v.id === idOrIdx);
      if (idx >= 0) C.viewIdx = idx;
    }
    const next = VIEWS[C.viewIdx].id;
    if (next !== prev && (next === 'fpv' || next === 'fork' || prev === 'fpv' || prev === 'fork')) {
      C.init = false; // clean instant mount cut into/out of helmet & fork cameras (zero mid-torso clipping!)
    }
    return next;
  };
  C.cycle = function (dir = 1) {
    return C.setView(C.viewIdx + dir);
  };
  C.resetOrbit = function () {
    const o = C.orbit;
    o.yaw = o.pit = o.tYaw = o.tPit = 0;
    o.zoom = o.tZoom = 1.0;
    o.idle = 9;
  };
  C.reset = function () {
    C.init = false;
    C.minClearance = 99;
    C.resetOrbit();
  };
  C.snapNext = function () {
    C.init = false;
  };

  // Attach mouse/touch 360-orbit + keyboard camera view hotkeys (1..8, Shift+V, IJKL)
  C.bindInput = function (canvas) {
    if (!canvas || C._bound) return;
    C._bound = true;
    const o = C.orbit;

    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || ''))) return;
      if (typeof Photo !== 'undefined' && Photo.on) return;
      const c = e.code;
      if (e.repeat) return;
      if (c === 'KeyV' && e.shiftKey) { C.cycle(-1); return; }
      const m = /^(?:Digit|Numpad)([1-8])$/.exec(c);
      if (m) C.setView(+m[1] - 1);
    });
    addEventListener('keyup', e => { o.keys[e.code] = false; });
    addEventListener('blur', () => { o.keys = {}; o.drag = null; });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (typeof Photo !== 'undefined' && Photo.on) return;
      // Left-drag orbits when in Title/Pause/Garage; Right-drag orbits anytime!
      const allowLeft = o.freeMode;
      if (e.button === 2 || (allowLeft && e.button === 0)) {
        o.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, btn: e.button };
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!o.drag || e.pointerId !== o.drag.id) return;
      const dx = e.clientX - o.drag.x, dy = e.clientY - o.drag.y;
      o.drag.x = e.clientX; o.drag.y = e.clientY;
      const sens = 4.2 / Math.max(innerWidth || 1000, 400);
      o.tYaw -= dx * sens;
      o.tPit = clamp(o.tPit + dy * sens * 0.72, -0.58, 0.92);
      o.idle = 0;
    });
    const lift = e => { if (o.drag && e.pointerId === o.drag.id) o.drag = null; };
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);

    canvas.addEventListener('wheel', e => {
      if (typeof Photo !== 'undefined' && Photo.on) return;
      if (!o.freeMode) return;
      e.preventDefault();
      o.tZoom = clamp(o.tZoom * Math.exp(e.deltaY * 0.0012), 0.55, 2.25);
    }, { passive: false });
  };

  function stepOrbit(dt, isFree) {
    const o = C.orbit;
    o.freeMode = isFree;
    if (!o.drag) {
      o.idle += dt;
      // During active riding, spring look-around smoothly back behind rider after 0.9s
      if (!isFree && o.idle > 0.9) {
        o.tYaw = damp(o.tYaw, 0, 5.5, dt);
        o.tPit = damp(o.tPit, 0, 5.5, dt);
        o.tZoom = damp(o.tZoom, 1.0, 5.5, dt);
      }
    }
    o.yaw = damp(o.yaw, o.tYaw, 14, dt);
    o.pit = damp(o.pit, o.tPit, 14, dt);
    o.zoom = damp(o.zoom, o.tZoom, 12, dt);
  }

  // Enforce ground clearance for camera eye + bottom corners of near plane
  function guardGround(pos, fwd, right, up, fovY, aspect, minWant = 0.45) {
    const gy = Course.height(pos[0], pos[2]);
    let minH = pos[1] - gy;
    const hh = C.near * Math.tan(fovY * 0.5);
    const hw = hh * aspect;
    for (const sx of [-1, 0, 1]) {
      const px = pos[0] + fwd[0] * C.near + right[0] * hw * sx - up[0] * hh;
      const py = pos[1] + fwd[1] * C.near + right[1] * hw * sx - up[1] * hh;
      const pz = pos[2] + fwd[2] * C.near + right[2] * hw * sx - up[2] * hh;
      const d = py - Course.height(px, pz);
      if (d < minH) minH = d;
    }
    if (minH < minWant) {
      pos[1] += (minWant - minH);
      minH = minWant;
    }
    C.minClearance = Math.min(C.minClearance, minH);
    return minH;
  }

  function makeCam(eye, target, upHint, fov, near, aspect) {
    const fwd = v3.norm(v3.sub(target, eye));
    const right = v3.norm(v3.cross(fwd, upHint));
    const up = v3.cross(right, fwd);
    const viewM = m4.lookAt(eye, target, up);
    const projM = m4.perspective(fov, aspect, near, C.far);
    const cam = { eye, target, fwd, right, up, fov, near, viewM, projM, vp: m4.mul(projM, viewM) };
    C.lastCam = cam;
    return cam;
  }

  // ---- Main Race / Pause / Live-Preview Camera Update ----
  C.update = function (R, dt, aspect, feel, isPaused = false, previewView = false) {
    stepOrbit(dt, isPaused);
    const view = VIEWS[C.viewIdx].id;
    const preset = PRESETS[Variants.val.cam] || PRESETS.b;
    const spdNorm = sat((R.speed - 10) / 26);
    const o = C.orbit;
    const hasOrbit = Math.abs(o.yaw) > 0.02 || Math.abs(o.pit) > 0.02 || Math.abs(o.zoom - 1) > 0.02;

    // Activate FPV lensCut during race OR active live view preview (unless orbiting outside head)
    if (typeof RiderMesh !== 'undefined') {
      RiderMesh.fpvRiderId = (!R.crashed && view === 'fpv' && (!isPaused || (previewView && !hasOrbit))) ? R.id : -1;
    }

    const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
    const rx =  Math.cos(R.yaw), rz = -Math.sin(R.yaw);
    const spHere = Course.at(R.s);
    const slope = spHere.slope || 0.42;
    const gHereY = Course.height(R.pos[0], R.pos[2]);
    const gAhead24 = Course.height(R.pos[0] + fx * 24, R.pos[2] + fz * 24);
    const terrainDropRate = clamp((gHereY - gAhead24) / 24, 0.22, 0.92);
    const slopeEff = clamp(Math.max(slope, terrainDropRate * 0.88), 0.25, 0.88);
    let wantPos, wantTgt, wantFov, wantRoll = 0, wantClear = 0.45, near = 0.24;

    if (R.crashed) {
      const ang = o.yaw + 0.55;
      const dist = 6.2 * o.zoom;
      wantPos = [R.ragPos[0] + Math.sin(ang) * dist, R.ragPos[1] + 2.8 + o.pit * 3.0, R.ragPos[2] + Math.cos(ang) * dist];
      wantTgt = [R.ragPos[0], R.ragPos[1] + 0.55, R.ragPos[2]];
      wantFov = 62 * PI / 180;
    } else if (isPaused && hasOrbit && !(previewView && (view === 'fpv' || view === 'fork'))) {
      // Smooth 360-degree environment inspection orbit while paused!
      const baseDist = 5.4 * o.zoom;
      const yawA = R.yaw + o.yaw;
      const pitA = clamp(0.32 + o.pit, -0.20, 1.15);
      const cp = Math.cos(pitA), sp = Math.sin(pitA);
      // Slight left-bias offset so paused rider sits cleanly to the right of the left menu rail!
      wantTgt = [R.pos[0] - rx * 0.65, R.pos[1] + 1.15, R.pos[2] - rz * 0.65];
      wantPos = [
        wantTgt[0] + Math.sin(yawA) * baseDist * cp,
        wantTgt[1] + baseDist * sp,
        wantTgt[2] + Math.cos(yawA) * baseDist * cp,
      ];
      wantFov = 64 * PI / 180;
    } else if (view === 'fpv') {
      // Helmet Goggles FPV: slope-adaptive downward tilt looking cleanly down steep slopes & cliff plunges!
      const comp = clamp(R.susp || 0, -0.07, 0.26);
      const crouch = (R.charge || 0) * 0.22 + comp * 0.62 + (R.boosting ? 0.12 : 0);
      near = 0.08;
      wantClear = 0.40;
      const eyeH = 1.72 - crouch * 1.00;
      const eyeFwd = 0.25;
      wantPos = [R.pos[0] + fx * eyeFwd, R.pos[1] + eyeH, R.pos[2] + fz * eyeFwd];
      const ly = R.yaw - o.yaw;
      const lfx = -Math.sin(ly), lfz = -Math.cos(ly);
      const pitchLook = clamp(R.pitch * 0.52 - 0.14 - slopeEff * 0.58 + o.pit, -0.96, 0.42);
      wantTgt = [
        wantPos[0] + lfx * 22 * Math.cos(pitchLook),
        wantPos[1] + Math.sin(pitchLook) * 22,
        wantPos[2] + lfz * 22 * Math.cos(pitchLook),
      ];
      wantFov = (86 + spdNorm * 13 + (R.boosting ? 7 : 0)) * PI / 180;
      wantRoll = R.roll * 0.34;
    } else if (view === 'fork') {
      // Front Fork Low Cam: slope-adaptive downward aim directly down the trail over the front wheel!
      near = 0.12;
      wantClear = 0.30;
      const comp = clamp(R.susp || 0, -0.07, 0.26);
      wantPos = [R.pos[0] + fx * 0.30, R.pos[1] + 1.06 - comp * 0.50, R.pos[2] + fz * 0.30];
      const forkAheadY = Math.max(Course.height(R.pos[0] + fx * 20, R.pos[2] + fz * 20), R.pos[1] - 18);
      wantTgt = [R.pos[0] + fx * 20, lerp(R.pos[1] + 0.35, forkAheadY + 1.15, 0.78), R.pos[2] + fz * 20];
      wantFov = (84 + spdNorm * 14 + (R.boosting ? 8 : 0)) * PI / 180;
      wantRoll = R.roll * 0.42;
    } else if (view === 'left' || view === 'right' || view === 'front' || view === 'high') {
      // Multi-angle action rigs — ALL slope-adaptive so steep drops & terrain ahead frame cleanly!
      let azOff = 0, dist = 6.0, h = 2.4, tf = 5.0, th = 0.85, fovDeg = 64;
      if (view === 'high')  { azOff = 0;     dist = 9.2; h = 8.4 + slopeEff * 5.6; tf = 24.0; th = 0.5; fovDeg = 68; }
      if (view === 'left')  { azOff = -1.20; dist = 5.6; h = 2.5 + slopeEff * 3.4; tf = 7.5;  th = 0.8; fovDeg = 62; }
      if (view === 'right') { azOff =  1.20; dist = 5.6; h = 2.5 + slopeEff * 3.4; tf = 7.5;  th = 0.8; fovDeg = 62; }
      if (view === 'front') { azOff =  PI;   dist = 6.0; h = 2.1 + slopeEff * 2.4; tf = -1.2; th = 1.05; fovDeg = 60; }
      const ang = R.yaw + azOff + o.yaw;
      const d = dist * o.zoom;
      const ex = R.pos[0] + Math.sin(ang) * d;
      const ez = R.pos[2] + Math.cos(ang) * d;
      const eyGround = Course.height(ex, ez);
      const ey = Math.max(R.pos[1] + h + o.pit * 3.2 + (R.air ? 0.5 : 0), eyGround + (view === 'high' ? 5.5 : 1.75));
      wantPos = [ex, ey, ez];
      const tx = R.pos[0] + fx * tf, tz = R.pos[2] + fz * tf;
      const tGround = Math.max(Course.height(tx, tz), R.pos[1] - Math.abs(tf) * 0.82);
      const ty = view === 'front'
        ? R.pos[1] + th
        : lerp(R.pos[1] + th, tGround + 1.35, view === 'high' ? 0.78 : 0.62);
      wantTgt = [tx, ty, tz];
      wantFov = (fovDeg + spdNorm * 8) * PI / 180;
      wantRoll = view === 'front' ? -R.roll * 0.12 : R.roll * 0.08;
    } else {
      // Default CHASE & LOW views: optically guaranteed over-the-helmet downhill framing!
      // Camera elevation scales directly with the sampled slope + cliff drop ahead so the road 15..60m ahead
      // ALWAYS sits clearly ABOVE the rider's helmet while the rider anchors the lower third!
      const isLow = view === 'low';
      const dist = ((isLow ? 4.80 : preset.dist) + spdNorm * 0.80 + (R.boosting ? 0.60 : 0) + (R.air ? 1.00 : 0)) * o.zoom;
      const gAhead30 = Course.height(R.pos[0] + fx * 30, R.pos[2] + fz * 30);
      const drop30 = clamp(R.pos[1] - gAhead30, 4, 52);
      // Exact optical clearance height: H > 1.85 + (dist/30)*(drop30 + 3.4) + clearMargin so even 60m plunges frame cleanly above helmet!
      const opticalMinH = 1.95 + (dist / 30) * (drop30 + 3.4) + (isLow ? 0.45 : 1.45);
      const slopeLift = slopeEff * (isLow ? 3.8 : 5.4);
      const baseH = Math.max((isLow ? 2.85 : preset.height) + slopeLift, opticalMinH)
        + (R.air ? 0.65 : 0) - (feel.landDip || 0) + o.pit * 3.4;

      // Subtle track-spine & turn-apex side lead so upcoming curves, ramps & cliff lines read early!
      const spAhead = Course.at(R.s + 24);
      const lookDirX = lerp(fx, clamp((spAhead.cx - R.pos[0]) * 0.035, -0.46, 0.46), 0.22);
      const lookDirZ = fz;
      const dl = Math.hypot(lookDirX, lookDirZ) || 1;
      let dx = lookDirX / dl, dz = lookDirZ / dl;
      if (Math.abs(o.yaw) > 0.002) {
        const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
        const ndx = dx * cy - dz * sy, ndz = dx * sy + dz * cy;
        dx = ndx; dz = ndz;
      }

      const sideLead = clamp(-(R.steer || 0) * 0.55, -0.65, 0.65);
      const ex = R.pos[0] - dx * dist + rx * sideLead;
      const ez = R.pos[2] - dz * dist + rz * sideLead;
      // Ensure camera always floats generously ABOVE the uphill slope directly behind the rider!
      const yBehind = Course.height(ex, ez);
      const ey = Math.max(R.pos[1] + baseH, yBehind + (isLow ? 2.15 : 3.45));
      wantPos = [ex, ey, ez];

      // Aim smoothly down the downhill slope & horizon so rider sits in lower third (-0.38..-0.24)
      // while BOTH the immediate 6-66m drop/road ahead AND the scenic canyon panorama remain wide open!
      const lookDist = preset.look;
      const tx = R.pos[0] + dx * lookDist;
      const tz = R.pos[2] + dz * lookDist;
      const yRoadAhead = Math.max(Course.height(tx, tz), R.pos[1] - lookDist * 1.15);
      const slopeLineY = R.pos[1] - slope * lookDist * 0.62;
      const downMix = isLow ? 0.50 : preset.downMix;
      const ty = lerp(slopeLineY + 2.6, yRoadAhead + 4.4, downMix) - (R.air ? 0.45 : 0);
      wantTgt = [tx, ty, tz];
      wantFov = (preset.baseFov + spdNorm * 13 + (R.boosting ? 8 : 0)) * PI / 180;
      wantRoll = R.roll * 0.14 + (feel.flinchRoll || 0);
    }

    if (!C.init) {
      C.pos = wantPos.slice();
      C.target = wantTgt.slice();
      C.fov = wantFov;
      C.roll = wantRoll;
      C.init = true;
    } else {
      const kPos = (view === 'fpv' || view === 'fork') ? 32 : (previewView || isPaused) ? 22 : 11;
      const kTgt = (view === 'fpv' || view === 'fork') ? 32 : (previewView || isPaused) ? 22 : 14;
      C.pos[0] = damp(C.pos[0], wantPos[0], kPos, dt);
      C.pos[1] = damp(C.pos[1], wantPos[1], kPos * 0.88, dt);
      C.pos[2] = damp(C.pos[2], wantPos[2], kPos, dt);
      C.target[0] = damp(C.target[0], wantTgt[0], kTgt, dt);
      C.target[1] = damp(C.target[1], wantTgt[1], kTgt, dt);
      C.target[2] = damp(C.target[2], wantTgt[2], kTgt, dt);
      C.fov = damp(C.fov, wantFov, 7.5, dt);
      C.roll = damp(C.roll, wantRoll, 9, dt);
    }

    C.near = near;
    const sh = isPaused ? 0 : (feel.shake || 0);
    const eye = [
      C.pos[0] + (Math.random() - 0.5) * sh,
      C.pos[1] + (Math.random() - 0.5) * sh,
      C.pos[2] + (Math.random() - 0.5) * sh * 0.5,
    ];

    const fwd = v3.norm(v3.sub(C.target, eye));
    const worldUp = [Math.sin(C.roll), Math.cos(C.roll), 0];
    const right = v3.norm(v3.cross(fwd, worldUp));
    const up = v3.cross(right, fwd);
    guardGround(eye, fwd, right, up, C.fov, aspect, wantClear);

    return makeCam(eye, C.target, worldUp, C.fov, near, aspect);
  };

  // ---- Start-Gate Poised Title Screen Hero Camera (Cold-Smoke-inspired 3/4 side-rear composition!) ----
  // Rider sits poised on the right third of the screen overlooking the sheer cliff & mountain valley ahead;
  // left third stays open for editorial typography & pre-start settings, and drags smoothly 360 degrees!
  C.titleView = function (R, dt, aspect, time) {
    stepOrbit(dt, true);
    if (typeof RiderMesh !== 'undefined') RiderMesh.fpvRiderId = -1;
    const o = C.orbit;
    const sway = Math.sin(time * 0.28) * 0.05;
    const az = -0.62 + sway + o.yaw; // 3/4 rear-left looking past rider toward cliff & downhill start gate!
    const dist = 4.45 * o.zoom;
    const pit = clamp(0.18 + o.pit, -0.18, 0.95);

    // Offset look target slightly left & downrange so the poised rider frames elegantly in the right half!
    const tgt = [R.pos[0] - 0.85, R.pos[1] + 1.08, R.pos[2] - 2.4];
    const eye = [
      R.pos[0] + Math.sin(az) * dist * Math.cos(pit),
      R.pos[1] + 1.48 + dist * Math.sin(pit),
      R.pos[2] + Math.cos(az) * dist * Math.cos(pit),
    ];

    if (!C.init) {
      C.pos = eye.slice();
      C.target = tgt.slice();
      C.fov = 54 * PI / 180;
      C.roll = 0;
      C.init = true;
    } else {
      C.pos[0] = damp(C.pos[0], eye[0], 10, dt);
      C.pos[1] = damp(C.pos[1], eye[1], 10, dt);
      C.pos[2] = damp(C.pos[2], eye[2], 10, dt);
      C.target[0] = damp(C.target[0], tgt[0], 10, dt);
      C.target[1] = damp(C.target[1], tgt[1], 10, dt);
      C.target[2] = damp(C.target[2], tgt[2], 10, dt);
      C.fov = damp(C.fov, 54 * PI / 180, 8, dt);
    }

    C.near = 0.20;
    const fwd = v3.norm(v3.sub(C.target, C.pos));
    const right = v3.norm(v3.cross(fwd, [0, 1, 0]));
    const up = v3.cross(right, fwd);
    const eCopy = C.pos.slice();
    guardGround(eCopy, fwd, right, up, C.fov, aspect, 0.45);
    return makeCam(eCopy, C.target, [0, 1, 0], C.fov, 0.20, aspect);
  };

  // ---- Garage Showroom Camera (with interactive 360 drag + gentle auto-turn) ----
  C.garageView = function (angle, aspect, dt = 1 / 60) {
    stepOrbit(dt, true);
    if (typeof RiderMesh !== 'undefined') RiderMesh.fpvRiderId = -1;
    const o = C.orbit;
    const rad = 3.85 * o.zoom;
    const a = angle + o.yaw;
    const tgt = [0.55, 0.96, 0];
    const eye = [tgt[0] + Math.sin(a) * rad, clamp(1.56 + o.pit * 2.2, 0.55, 3.6), Math.cos(a) * rad];
    return makeCam(eye, tgt, [0, 1, 0], 45 * PI / 180, 0.20, aspect);
  };

  return C;
})();
