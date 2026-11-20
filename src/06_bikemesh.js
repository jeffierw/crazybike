// ---------------------------------------------------------------- 06_bikemesh: instanced procedural 3D solid renderer + downhill MTB & articulated rider
const Solid = (() => {
  const MAX_INST = 2600;
  const shapes = {};
  let gfx = null, pipe = null, shPipe = null, instBuf = null;
  const instCPU = new Float32Array(MAX_INST * 16);

  // Build clean procedural unit geometries (pos3 + nrm3)
  function makeBox() {
    const V = [], I = [];
    const faces = [
      [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
      [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
      [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
      [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    ];
    for (const [n, a, b, c, d] of faces) {
      const base = V.length / 6;
      for (const p of [a, b, c, d]) V.push(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5, n[0], n[1], n[2]);
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeCyl(seg = 10, topR = 0.5, botR = 0.5) {
    const V = [], I = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const ny = (botR - topR);
      const nl = Math.hypot(ca, ny, sa) || 1;
      V.push(ca * botR, -0.5, sa * botR, ca / nl, ny / nl, sa / nl);
      V.push(ca * topR,  0.5, sa * topR, ca / nl, ny / nl, sa / nl);
    }
    for (let k = 0; k < seg; k++) {
      const b = k * 2;
      I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    // End caps
    const cBot = V.length / 6;
    V.push(0, -0.5, 0, 0, -1, 0);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * TAU;
      V.push(Math.cos(a) * botR, -0.5, Math.sin(a) * botR, 0, -1, 0);
    }
    for (let k = 0; k < seg; k++) I.push(cBot, cBot + 1 + ((k + 1) % seg), cBot + 1 + k);

    if (topR > 0.01) {
      const cTop = V.length / 6;
      V.push(0, 0.5, 0, 0, 1, 0);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * TAU;
        V.push(Math.cos(a) * topR, 0.5, Math.sin(a) * topR, 0, 1, 0);
      }
      for (let k = 0; k < seg; k++) I.push(cTop, cTop + 1 + k, cTop + 1 + ((k + 1) % seg));
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeTorus(majSeg = 18, minSeg = 8, R = 0.42, r = 0.11) {
    // Tire lying in YZ plane (axle along X axis) so rotating around X spins the wheel!
    const V = [], I = [];
    for (let i = 0; i <= majSeg; i++) {
      const u = (i / majSeg) * TAU, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= minSeg; j++) {
        const v = (j / minSeg) * TAU, cv = Math.cos(v), sv = Math.sin(v);
        const rr = R + r * cv;
        const x = r * sv, y = rr * cu, z = rr * su;
        const nx = sv, ny = cv * cu, nz = cv * su;
        V.push(x, y, z, nx, ny, nz);
      }
    }
    const stride = minSeg + 1;
    for (let i = 0; i < majSeg; i++) {
      for (let j = 0; j < minSeg; j++) {
        const a = i * stride + j, b = a + stride;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeOctaSphere(lat = 7, lon = 10) {
    const V = [], I = [];
    for (let y = 0; y <= lat; y++) {
      const phi = (y / lat) * PI, sp = Math.sin(phi), cp = Math.cos(phi);
      for (let x = 0; x <= lon; x++) {
        const th = (x / lon) * TAU, ct = Math.cos(th), st = Math.sin(th);
        const nx = sp * ct, ny = cp, nz = sp * st;
        V.push(nx * 0.5, ny * 0.5, nz * 0.5, nx, ny, nz);
      }
    }
    const st = lon + 1;
    for (let y = 0; y < lat; y++) {
      for (let x = 0; x < lon; x++) {
        const a = y * st + x, b = a + st;
        I.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  // Per-shape dynamic draw queue
  const queues = { box: [], cyl: [], cone: [], tire: [], sphere: [] };

  function pushMat(kind, m, col, rough = 0.5) {
    queues[kind].push(
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      col[0], col[1], col[2], rough
    );
  }

  // Build world transform for a cylinder/box oriented from point A to point B with thickness (rx, rz)
  function limbMat(a, b, rx, rz = rx) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return null;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // Choose stable perpendicular basis
    const ax = Math.abs(uy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let sx = ayCross(ax, [ux, uy, uz]);
    sx = v3.norm(sx);
    const sz = v3.cross([ux, uy, uz], sx);
    const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5, mz = (a[2] + b[2]) * 0.5;
    return [
      sx[0] * rx, sx[1] * rx, sx[2] * rx, 0,
      ux * len,   uy * len,   uz * len,   0,
      sz[0] * rz, sz[1] * rz, sz[2] * rz, 0,
      mx,         my,         mz,         1,
    ];
  }
  function ayCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  const S = {
    init(g) {
      gfx = g;
      const defs = {
        box: makeBox(),
        cyl: makeCyl(10, 0.5, 0.5),
        cone: makeCyl(9, 0.02, 0.52),
        tire: makeTorus(16, 7, 0.40, 0.11),
        sphere: makeOctaSphere(6, 10),
      };
      for (const k in defs) {
        shapes[k] = {
          vb: gfx.buffer(defs[k].v, 'vertex', false),
          ib: gfx.buffer(defs[k].i, 'index', false),
          count: defs[k].i.length,
        };
      }
      instBuf = gfx.buffer(instCPU, 'vertex', true);

      const instBuffers = [
        { attrs: [['pos', 'vec3f'], ['nrm', 'vec3f']] },
        { instanced: true, attrs: [['iM0', 'vec4f'], ['iM1', 'vec4f'], ['iM2', 'vec4f'], ['iCol', 'vec4f']] },
      ];

      pipe = gfx.pipeline({
        name: 'solid',
        colorFormat: 'rgba8',
        depth: true,
        cull: 'back',
        buffers: instBuffers,
        varyings: { wpos: 'vec3f', wnrm: 'vec3f', col: 'vec4f' },
        textures: { uShadow: 'shadow' },
        lib: [SHADER_COMMON, SHADER_SHADOW],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let p4: vec4f = vec4f(a.pos, 1.0);
            let wp: vec3f = vec3f(dot(a.iM0, p4), dot(a.iM1, p4), dot(a.iM2, p4));
            let wn: vec3f = normalize(vec3f(dot(a.iM0.xyz, a.nrm), dot(a.iM1.xyz, a.nrm), dot(a.iM2.xyz, a.nrm)));
            v.clip = U.viewProj * vec4f(wp, 1.0);
            v.wpos = wp;
            v.wnrm = wn;
            v.col = a.iCol;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            let sh: f32 = sampleShadow(v.wpos, normalize(v.wnrm));
            var c: vec3f = litSurface(v.col.rgb, v.wnrm, v.wpos, v.col.w, sh);
            // Emissive accent when rough < 0 (used for glowing eyes / boosts / headlights / lava vents)
            if (v.col.w < 0.0) {
              c = v.col.rgb * 2.1;
            }
            var o: FOut;
            o.color = vec4f(acesTone(c * U.sunCol.w), 1.0);
            return o;
          }
        `,
      });

      shPipe = gfx.pipeline({
        name: 'solidShadow',
        colorFormat: null,
        depth: true,
        depthBias: 2,
        depthBiasSlope: 2.5,
        cull: 'back',
        buffers: instBuffers,
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let p4: vec4f = vec4f(a.pos, 1.0);
            let wp: vec3f = vec3f(dot(a.iM0, p4), dot(a.iM1, p4), dot(a.iM2, p4));
            v.clip = U.lightVP * vec4f(wp, 1.0);
            return v;
          }
        `,
      });
    },

    clear() {
      for (const k in queues) queues[k].length = 0;
    },

    push(kind, mat, col, rough = 0.5) {
      pushMat(kind, mat, col, rough);
    },

    pushTRS(kind, pos, rotY, rotX, rotZ, scl, col, rough = 0.5) {
      let m = m4.translate(pos);
      if (rotY) m = m4.mul(m, m4.rotY(rotY));
      if (rotX) m = m4.mul(m, m4.rotX(rotX));
      if (rotZ) m = m4.mul(m, m4.rotZ(rotZ));
      m = m4.mul(m, m4.scale(scl));
      pushMat(kind, m, col, rough);
    },

    pushLimb(a, b, r, col, rough = 0.45, kind = 'cyl') {
      const m = limbMat(a, b, r, r);
      if (m) pushMat(kind, m, col, rough);
    },

    // Pack all queued shapes into instBuf once per frame and record slices
    _slices: [],
    upload() {
      S._slices.length = 0;
      let cursor = 0;
      for (const k in queues) {
        const q = queues[k];
        const n = Math.min(q.length / 16, MAX_INST - cursor);
        if (n <= 0) continue;
        instCPU.set(q.subarray ? q.subarray(0, n * 16) : q.slice(0, n * 16), cursor * 16);
        S._slices.push({ kind: k, base: cursor, count: n });
        cursor += n;
      }
      if (cursor > 0) gfx.updateBuffer(instBuf, 0, instCPU.subarray(0, cursor * 16));
    },

    drawShadow() {
      if (!shPipe) return;
      for (const sl of S._slices) {
        const sh = shapes[sl.kind];
        gfx.draw(shPipe, { vb: [sh.vb, instBuf], ib: sh.ib, count: sh.count, instances: sl.count, base: sl.base });
      }
    },

    drawColor(shadowTex) {
      if (!pipe) return;
      for (const sl of S._slices) {
        const sh = shapes[sl.kind];
        gfx.draw(pipe, {
          vb: [sh.vb, instBuf], ib: sh.ib, count: sh.count, instances: sl.count, base: sl.base,
          tex: { uShadow: shadowTex },
        });
      }
    },
  };
  return S;
})();

// ---------------------------------------------------------------- Procedural Downhill MTB & Articulated Rider Builder
const BikeMesh = (() => {
  // Transform local point p by 4x4 matrix m
  function xform(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  }

  // Emit a full downhill MTB + articulated rider (or detached ragdoll when crashed!)
  function emitRider(R, time) {
    const upg = R.upgrades || { frame: 0, fork: 0, drive: 0, tires: 0, combat: 0 };
    const colFrame = R.frameCol || [0.95, 0.28, 0.08];
    const colJersey = R.jerseyCol || [0.15, 0.72, 0.96];
    const colHelmet = R.helmetCol || [0.98, 0.85, 0.14];
    const colFork = upg.fork >= 2 ? [0.96, 0.74, 0.18] : [0.76, 0.78, 0.82]; // Gold Kashima fork at lv2+!
    const colTire = [0.10, 0.10, 0.11];
    const colMetal = [0.58, 0.60, 0.64];
    const colDark = [0.16, 0.17, 0.20];
    const colSkin = [0.85, 0.66, 0.52];

    const tireScale = 1.0 + upg.tires * 0.07;
    const tubeThick = 0.055 + upg.frame * 0.012;

    // 1. Bike basis matrix (either riding or detached tumbling bike during crash!)
    let bikeM;
    if (R.crashed) {
      bikeM = m4.translate(R.bikeCrashPos);
      bikeM = m4.mul(bikeM, m4.rotY(R.bikeCrashRot[1]));
      bikeM = m4.mul(bikeM, m4.rotX(R.bikeCrashRot[0]));
      bikeM = m4.mul(bikeM, m4.rotZ(R.bikeCrashRot[2]));
    } else {
      bikeM = m4.translate(R.pos);
      bikeM = m4.mul(bikeM, m4.rotY(R.yaw + (R.trickYaw || 0)));
      bikeM = m4.mul(bikeM, m4.rotX(R.pitch + (R.trickPitch || 0)));
      bikeM = m4.mul(bikeM, m4.rotZ(R.roll + (R.trickRoll || 0)));
    }

    // Active suspension travel lowers frame relative to wheel axles
    const comp = clamp(R.susp || 0, -0.08, 0.28);
    const steerAng = clamp(R.steer * 0.45, -0.55, 0.55);
    const wheelR = 0.40 * tireScale;

    // Tailwhip swings bike frame around headtube!
    let frameM = bikeM;
    if (!R.crashed && R.trickType === 'whip' && Math.abs(R.trickPhase) > 0.01) {
      frameM = m4.mul(bikeM, m4.translate([0, 0.85, -0.55]));
      frameM = m4.mul(frameM, m4.rotY(R.trickPhase * 1.45));
      frameM = m4.mul(frameM, m4.translate([0, -0.85, 0.55]));
    }

    // Key bike joints in bike-local coords (forward = -Z, up = +Y, right = +X)
    const rearAxleL  = [0, wheelR, 0.68];
    const frontAxleL = [0, wheelR, -0.72];
    const bbL        = [0, 0.42 - comp * 0.75, 0.10];
    const seatTopL   = [0, 0.90 - comp * 0.85, 0.30];
    const headBotL   = [0, 0.82 - comp * 0.90, -0.44];
    const headTopL   = [0, 1.06 - comp * 0.90, -0.36];

    const rearAxle  = xform(frameM, rearAxleL);
    const frontAxle = xform(bikeM, frontAxleL);
    const bb        = xform(frameM, bbL);
    const seatTop   = xform(frameM, seatTopL);
    const headBot   = xform(bikeM, headBotL);
    const headTop   = xform(bikeM, headTopL);

    // Wheels (torus tire + metallic hub + spinning spokes)
    const wheelSpin = R.wheelSpin || 0;
    const emitWheel = (Mbase, localPos, steerY) => {
      let wm = m4.mul(Mbase, m4.translate(localPos));
      if (steerY) wm = m4.mul(wm, m4.rotY(steerY));
      wm = m4.mul(wm, m4.rotX(wheelSpin));
      Solid.push('tire', m4.mul(wm, m4.scale([tireScale, tireScale, tireScale])), colTire, 0.85);
      // Rim inner ring / hub
      Solid.push('cyl', m4.mul(wm, m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.14, 0.16, 0.14]))), colMetal, 0.3);
      // Two crossed spoke bars so wheel rotation is super crisp visually
      Solid.push('box', m4.mul(wm, m4.scale([0.025, wheelR * 1.65, 0.03])), colMetal, 0.35);
      Solid.push('box', m4.mul(wm, m4.scale([0.025, 0.03, wheelR * 1.65])), colMetal, 0.35);
    };
    emitWheel(frameM, rearAxleL, 0);
    emitWheel(bikeM, frontAxleL, steerAng);

    // Downhill double-triangle frame + rear swingarm
    Solid.pushLimb(bb, headBot, tubeThick * 1.15, colFrame, 0.28);
    Solid.pushLimb(seatTop, headTop, tubeThick * 1.0, colFrame, 0.28);
    Solid.pushLimb(bb, seatTop, tubeThick * 0.95, colFrame, 0.28);
    Solid.pushLimb(headBot, headTop, tubeThick * 1.2, colDark, 0.35);
    // Rear stays & shock
    const rLeft  = xform(frameM, [-0.09, wheelR, 0.68]);
    const rRight = xform(frameM, [ 0.09, wheelR, 0.68]);
    Solid.pushLimb(bb, rLeft, tubeThick * 0.72, colDark, 0.4);
    Solid.pushLimb(bb, rRight, tubeThick * 0.72, colDark, 0.4);
    Solid.pushLimb(seatTop, rLeft, tubeThick * 0.62, colFrame, 0.3);
    Solid.pushLimb(seatTop, rRight, tubeThick * 0.62, colFrame, 0.3);
    // Rear coil shock
    Solid.pushLimb(xform(frameM, [0, 0.60 - comp * 0.8, 0.04]), xform(frameM, [0, 0.78 - comp * 0.85, 0.24]), 0.065, colFork, 0.25);

    // Dual-crown front suspension fork (left & right legs + gold stanchions!)
    const fTopL = xform(bikeM, [-0.11, 1.06 - comp * 0.9, -0.36]);
    const fTopR = xform(bikeM, [ 0.11, 1.06 - comp * 0.9, -0.36]);
    const fAxL  = xform(bikeM, [-0.11, wheelR, -0.72]);
    const fAxR  = xform(bikeM, [ 0.11, wheelR, -0.72]);
    Solid.pushLimb(fTopL, fAxL, 0.052 + upg.fork * 0.008, colFork, 0.22);
    Solid.pushLimb(fTopR, fAxR, 0.052 + upg.fork * 0.008, colFork, 0.22);

    // Handlebars & Grips
    const barCenter = xform(bikeM, [0, 1.13 - comp * 0.9, -0.37]);
    const barDx = Math.cos(steerAng) * 0.44, barDz = Math.sin(steerAng) * 0.44;
    const gripL = xform(bikeM, [-barDx, 1.14 - comp * 0.9, -0.37 + barDz]);
    const gripR = xform(bikeM, [ barDx, 1.14 - comp * 0.9, -0.37 - barDz]);
    Solid.pushLimb(gripL, gripR, 0.042, colDark, 0.4);
    // Saddle
    Solid.push('box', m4.mul(frameM, m4.mul(m4.translate([0, 0.96 - comp * 0.85, 0.33]), m4.scale([0.16, 0.07, 0.30]))), colDark, 0.7);

    // Visible mounted combat gear / upgrade weapon on frame or back
    if (upg.combat >= 1) {
      // Water bottle in cage
      const btA = xform(frameM, [0, 0.56 - comp * 0.8, -0.10]);
      const btB = xform(frameM, [0, 0.74 - comp * 0.8, -0.24]);
      Solid.pushLimb(btA, btB, 0.085, [0.16, 0.82, 0.98], 0.25);
    }

    // Adrenaline overdrive glowing exhaust/tail streaks on rear wheel
    if (!R.crashed && R.boosting) {
      const glowPos = xform(frameM, [0, 0.52, 0.84]);
      Solid.pushTRS('sphere', glowPos, 0, 0, 0, [0.22, 0.22, 0.55], [1.0, 0.45, 0.08], -1.0);
    }

    // 2. Articulated Rider (or tumbling ragdoll rider when crashed!)
    if (R.crashed) {
      let rm = m4.translate(R.ragPos);
      rm = m4.mul(rm, m4.rotY(R.ragRot[1]));
      rm = m4.mul(rm, m4.rotX(R.ragRot[0]));
      rm = m4.mul(rm, m4.rotZ(R.ragRot[2]));
      const hip = xform(rm, [0, 0, 0]);
      const shd = xform(rm, [0, 0.52, -0.05]);
      const hed = xform(rm, [0, 0.76, -0.06]);
      const flail = Math.sin(time * 22 + R.id) * 0.38;
      Solid.pushLimb(hip, shd, 0.28, colJersey, 0.65);
      Solid.pushTRS('sphere', hed, 0, 0, 0, [0.30, 0.32, 0.34], colHelmet, 0.25);
      Solid.pushLimb(shd, xform(rm, [-0.55, 0.65 + flail, -0.15]), 0.10, colJersey, 0.65);
      Solid.pushLimb(shd, xform(rm, [ 0.55, 0.65 - flail,  0.15]), 0.10, colJersey, 0.65);
      Solid.pushLimb(hip, xform(rm, [-0.30, -0.62 - flail, 0.22]), 0.12, colDark, 0.75);
      Solid.pushLimb(hip, xform(rm, [ 0.30, -0.62 + flail,-0.22]), 0.12, colDark, 0.75);
      return;
    }

    // Standing / Attacking / Trick pose in bike space
    const crouch = (R.charge || 0) * 0.22 + comp * 0.65 + (R.boosting ? 0.14 : 0);
    const leanX = clamp(-R.steer * 0.22, -0.26, 0.26);
    const pedal = Math.sin(R.pedalPhase || 0) * 0.14;

    let hipL = [leanX * 0.6, 1.24 - crouch, 0.24];
    let shdL = [leanX, 1.66 - crouch * 1.15, -0.06 - (R.boosting ? 0.12 : 0)];
    let hedL = [leanX * 1.05, 1.92 - crouch * 1.15, -0.16 - (R.boosting ? 0.14 : 0)];
    let footLL = [-0.17, 0.42 - comp * 0.7 + pedal, 0.10 + Math.cos(R.pedalPhase || 0) * 0.12];
    let footRL = [ 0.17, 0.42 - comp * 0.7 - pedal, 0.10 - Math.cos(R.pedalPhase || 0) * 0.12];
    let handLL = [-barDx, 1.14 - comp * 0.9, -0.37 + barDz];
    let handRL = [ barDx, 1.14 - comp * 0.9, -0.37 - barDz];

    // Mid-air Superman trick: legs fly straight back behind saddle!
    if (R.trickType === 'superman' && R.trickPhase > 0.05) {
      const k = sat(R.trickPhase);
      hipL = v3.lerp(hipL, [0, 1.48, 0.62], k);
      shdL = v3.lerp(shdL, [0, 1.42, 0.04], k);
      hedL = v3.lerp(hedL, [0, 1.56, -0.18], k);
      footLL = v3.lerp(footLL, [-0.18, 1.55, 1.38], k);
      footRL = v3.lerp(footRL, [ 0.18, 1.55, 1.38], k);
    }

    // Combat punch / kick / bat swing animation!
    if (R.attackTimer > 0) {
      const swing = Math.sin(sat(1 - R.attackTimer / 0.34) * PI);
      const sd = R.attackSide || 1; // -1 left, +1 right
      if (R.combatTier >= 1 && R.attackKind === 'kick') {
        if (sd < 0) footLL = [-0.88 * swing - 0.18, 0.85, 0.02];
        else footRL = [0.88 * swing + 0.18, 0.85, 0.02];
      } else {
        const reach = (R.combatTier >= 3 ? 0.95 : 0.78) * swing;
        if (sd < 0) handLL = [-0.36 - reach, 1.56, -0.15];
        else handRL = [0.36 + reach, 1.56, -0.15];
      }
    }

    const hip = xform(bikeM, hipL);
    const shd = xform(bikeM, shdL);
    const hed = xform(bikeM, hedL);
    const shdLeft  = xform(bikeM, [shdL[0] - 0.20, shdL[1] - 0.02, shdL[2]]);
    const shdRight = xform(bikeM, [shdL[0] + 0.20, shdL[1] - 0.02, shdL[2]]);
    const hipLeft  = xform(bikeM, [hipL[0] - 0.13, hipL[1] - 0.04, hipL[2]]);
    const hipRight = xform(bikeM, [hipL[0] + 0.13, hipL[1] - 0.04, hipL[2]]);
    const handL = xform(bikeM, handLL);
    const handR = xform(bikeM, handRL);
    const footL = xform(bikeM, footLL);
    const footR = xform(bikeM, footRL);

    // Torso + downhill jersey + cleanly aligned rear hydration pack + neck
    Solid.pushLimb(hip, shd, 0.28, colJersey, 0.65);
    Solid.pushLimb(shd, hed, 0.11, colSkin, 0.65);
    const packBot = xform(bikeM, [hipL[0] * 0.7 + shdL[0] * 0.3, lerp(hipL[1], shdL[1], 0.32), lerp(hipL[2], shdL[2], 0.32) + 0.18]);
    const packTop = xform(bikeM, [hipL[0] * 0.2 + shdL[0] * 0.8, lerp(hipL[1], shdL[1], 0.88), lerp(hipL[2], shdL[2], 0.88) + 0.18]);
    Solid.pushLimb(packBot, packTop, 0.19, colDark, 0.75, 'box');

    // Full-face downhill helmet + dark visor goggles
    Solid.pushTRS('sphere', hed, R.yaw, 0, 0, [0.31, 0.32, 0.36], colHelmet, 0.22);
    Solid.push('box', m4.mul(bikeM, m4.mul(m4.translate([hedL[0], hedL[1] + 0.02, hedL[2] - 0.14]), m4.scale([0.25, 0.09, 0.09]))), [0.07, 0.08, 0.12], 0.15);

    // Nemesis glowing red fury halo above helmet!
    if (R.nemesis) {
      const nmPos = xform(bikeM, [hedL[0], hedL[1] + 0.36, hedL[2]]);
      Solid.pushTRS('cone', nmPos, time * 4, PI, 0, [0.22, 0.28, 0.22], [1.0, 0.14, 0.12], -1.0);
    }

    // Arms with smooth spherical shoulder/elbow joints
    const elbowL = v3.lerp(shdLeft, handL, 0.5); elbowL[1] -= 0.08;
    const elbowR = v3.lerp(shdRight, handR, 0.5); elbowR[1] -= 0.08;
    Solid.pushTRS('sphere', shdLeft, 0, 0, 0, [0.16, 0.16, 0.16], colJersey, 0.65);
    Solid.pushTRS('sphere', shdRight, 0, 0, 0, [0.16, 0.16, 0.16], colJersey, 0.65);
    Solid.pushTRS('sphere', elbowL, 0, 0, 0, [0.11, 0.11, 0.11], colJersey, 0.65);
    Solid.pushTRS('sphere', elbowR, 0, 0, 0, [0.11, 0.11, 0.11], colJersey, 0.65);
    Solid.pushLimb(shdLeft, elbowL, 0.11, colJersey, 0.65);
    Solid.pushLimb(elbowL, handL, 0.09, colSkin, 0.65);
    Solid.pushLimb(shdRight, elbowR, 0.11, colJersey, 0.65);
    Solid.pushLimb(elbowR, handR, 0.09, colSkin, 0.65);

    // Visible swung baseball bat / wrench at combat tier 3+!
    if (R.attackTimer > 0 && R.combatTier >= 3 && R.attackKind !== 'kick') {
      const sd = R.attackSide || 1;
      const grip = sd < 0 ? handL : handR;
      const tip = xform(bikeM, [sd * 1.45, 1.52, -0.30]);
      Solid.pushLimb(grip, tip, 0.07, [0.86, 0.68, 0.32], 0.45);
    }

    // Legs with smooth hip & knee joints
    const kneeL = v3.lerp(hipLeft, footL, 0.5); kneeL[2] -= 0.14;
    const kneeR = v3.lerp(hipRight, footR, 0.5); kneeR[2] -= 0.14;
    Solid.pushTRS('sphere', hipLeft, 0, 0, 0, [0.16, 0.16, 0.16], colDark, 0.72);
    Solid.pushTRS('sphere', hipRight, 0, 0, 0, [0.16, 0.16, 0.16], colDark, 0.72);
    Solid.pushTRS('sphere', kneeL, 0, 0, 0, [0.13, 0.13, 0.13], colDark, 0.72);
    Solid.pushTRS('sphere', kneeR, 0, 0, 0, [0.13, 0.13, 0.13], colDark, 0.72);
    Solid.pushLimb(hipLeft, kneeL, 0.13, colDark, 0.72);
    Solid.pushLimb(kneeL, footL, 0.105, colDark, 0.72);
    Solid.pushLimb(hipRight, kneeR, 0.13, colDark, 0.72);
    Solid.pushLimb(kneeR, footR, 0.105, colDark, 0.72);
  }

  return { emitRider };
})();
