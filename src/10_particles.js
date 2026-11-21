// ---------------------------------------------------------------- 10_particles: GPU billboard dust/sparks + 3D glowing Trick & Boost Ribbon Trails (彩带拖尾)
const Particles = (() => {
  // ---- A. Instanced Billboard Dust, Gravel & Impact Sparks ----
  const MAX = 640;
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const age = new Float32Array(MAX), life = new Float32Array(MAX), sz0 = new Float32Array(MAX), sz1 = new Float32Array(MAX);
  const cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX), ca = new Float32Array(MAX);
  const gravK = new Float32Array(MAX);
  let head = 0;

  const gpuData = new Float32Array(MAX * 8);
  let gfx = null, quadVB = null, instVB = null, pipe = null, liveCount = 0;

  const QUAD = new Float32Array([
    -1, -1,  1, -1,  1, 1,
    -1, -1,  1,  1, -1, 1,
  ]);

  // ---- B. Dynamic 3D Glowing Silk-Light Ribbon Trails (Downhill Domination 彩带拖尾!) ----
  const NUM_RIBBONS = 4; // 0: player left grip, 1: player right grip, 2: player tail/boost, 3: highlight rival
  const RIB_SEGS = 34;   // trail nodes per ribbon
  const RIB_STRIDE = 9;  // pos(3) + uv(2) + col(4)
  const MAX_RIB_VERTS = NUM_RIBBONS * (RIB_SEGS - 1) * 6;
  const ribVerts = new Float32Array(MAX_RIB_VERTS * RIB_STRIDE);
  let ribVB = null, ribPipe = null, ribVertCount = 0, ribTime = 0;

  const ribbons = [];
  for (let i = 0; i < NUM_RIBBONS; i++) {
    ribbons.push({ nodes: [], acc: 0 });
  }

  function pushRibbonNode(ri, pos, side, col, alpha, width) {
    const rb = ribbons[ri];
    rb.nodes.push({ p: pos, s: side, c: col, a: alpha, w: width, age: 0 });
    if (rb.nodes.length > RIB_SEGS) rb.nodes.shift();
  }

  function ribbonColor(combo, boosting, t, phaseOff) {
    if (boosting && combo < 2) return [1.55, 0.56, 0.12];
    if (combo >= 3) {
      // Iconic vivid Downhill Domination rainbow overdrive ribbon!
      const h = t * 5.5 + phaseOff;
      return [
        0.95 + 0.65 * Math.sin(h),
        0.85 + 0.65 * Math.sin(h + 2.094),
        0.95 + 0.65 * Math.sin(h + 4.188),
      ];
    }
    if (combo === 2) return [1.45, 0.88, 0.16]; // blazing Super-Style gold
    return [0.22, 1.15, 1.45];                  // electric cyan-sky trick trail
  }

  function spawn(x, y, z, dx, dy, dz, col, a, s0, s1, ttl, g = 0.2) {
    const i = head;
    head = (head + 1) % MAX;
    px[i] = x; py[i] = y; pz[i] = z;
    vx[i] = dx; vy[i] = dy; vz[i] = dz;
    cr[i] = col[0]; cg[i] = col[1]; cb[i] = col[2]; ca[i] = a;
    sz0[i] = s0; sz1[i] = s1;
    age[i] = 0; life[i] = ttl;
    gravK[i] = g;
  }

  return {
    init(g) {
      gfx = g;
      quadVB = gfx.buffer(QUAD, 'vertex', false);
      instVB = gfx.buffer(gpuData, 'vertex', true);
      pipe = gfx.pipeline({
        name: 'particles',
        colorFormat: 'rgba8',
        depth: true,
        depthTest: true,
        depthWrite: false,
        blend: 'alpha',
        cull: 'none',
        buffers: [
          { attrs: [['q', 'vec2f']] },
          { instanced: true, attrs: [['pSz', 'vec4f'], ['col', 'vec4f']] },
        ],
        varyings: { uv: 'vec2f', col: 'vec4f' },
        uniforms: { camRight: 'vec4f', camUp: 'vec4f' },
        lib: [SHADER_COMMON],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let wp: vec3f = a.pSz.xyz + (M.camRight.xyz * a.q.x + M.camUp.xyz * a.q.y) * a.pSz.w;
            v.clip = U.viewProj * vec4f(wp, 1.0);
            v.uv = a.q;
            v.col = a.col;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            let r2: f32 = dot(v.uv, v.uv);
            let soft: f32 = saturate(1.0 - r2);
            let alpha: f32 = soft * soft * v.col.a;
            var o: FOut;
            o.color = vec4f(acesTone(v.col.rgb * U.sunCol.w), alpha);
            return o;
          }
        `,
      });

      // Additive 3D glowing trick & boost ribbon pipeline
      ribVB = gfx.buffer(ribVerts, 'vertex', true);
      ribPipe = gfx.pipeline({
        name: 'ribbons',
        colorFormat: 'rgba8',
        depth: true,
        depthTest: true,
        depthWrite: false,
        blend: 'add',
        cull: 'none',
        buffers: [{
          attrs: [
            ['pos', 'vec3f'],
            ['uv',  'vec2f'],
            ['col', 'vec4f'],
          ],
        }],
        varyings: { uv: 'vec2f', col: 'vec4f' },
        lib: [SHADER_COMMON],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            v.clip = U.viewProj * vec4f(a.pos, 1.0);
            v.uv = a.uv;
            v.col = a.col;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            // Bright luminous core + silky translucent edges fading along ribbon tail
            let edge: f32 = 1.0 - abs(v.uv.x * 2.0 - 1.0);
            let core: f32 = pow(saturate(edge), 1.45);
            let tail: f32 = saturate(v.uv.y);
            let shimmer: f32 = 0.86 + 0.14 * sin(v.uv.y * 22.0 - U.camPos.w * 14.0);
            let a: f32 = core * tail * tail * v.col.a * shimmer;
            let c: vec3f = mix(v.col.rgb, vec3f(1.5, 1.45, 1.35), core * core * 0.45);
            var o: FOut;
            o.color = vec4f(c * a, a);
            return o;
          }
        `,
      });
    },

    clear() {
      life.fill(0);
      liveCount = 0;
      for (let i = 0; i < NUM_RIBBONS; i++) {
        ribbons[i].nodes.length = 0;
        ribbons[i].acc = 0;
      }
      ribVertCount = 0;
    },

    spawn,

    // Emit tire rooster-tail dust / skid gravel / boost flame + glowing 3D Trick & Boost Ribbons!
    emitTire(R, dt) {
      if (R.crashed) {
        if (R.isPlayer) {
          ribbons[0].nodes.length = 0;
          ribbons[1].nodes.length = 0;
          ribbons[2].nodes.length = 0;
        }
        return;
      }

      // 1. 3D Glowing Silk Ribbons during air tricks, big air, boosting, or extreme >105km/h speed!
      if (R.isPlayer) {
        const showRibbon = R.trickActive || R.boosting || (R.air && R.airTime > 0.16) || R.speed > 29.5;
        if (showRibbon) {
          ribbons[0].acc += dt;
          if (ribbons[0].acc >= 0.016) {
            ribbons[0].acc = 0;
            let m = m4.translate(R.pos);
            m = m4.mul(m, m4.rotY(R.yaw + (R.trickYaw || 0)));
            m = m4.mul(m, m4.rotX(R.pitch + (R.trickPitch || 0)));
            m = m4.mul(m, m4.rotZ(R.roll + (R.trickRoll || 0)));

            // Anchor ribbons to left & right hands/grips (even spreading wide during No-Hander!)
            const spread = (R.trickType === 'nohander' && R.trickPhase > 0.1) ? 0.45 * R.trickPhase : 0;
            const pL = m4.tp(m, [-0.46 - spread, 1.18 + spread * 1.1, -0.35]);
            const pR = m4.tp(m, [ 0.46 + spread, 1.18 + spread * 1.1, -0.35]);
            const upV = v3.norm(m4.td(m, [0, 1, 0]));
            const combo = R.trickCombo || (R.boosting ? 2 : 1);
            const alpha = R.trickActive ? 0.92 : R.boosting ? 0.85 : R.air ? 0.65 : 0.34;
            const width = R.trickActive ? 0.24 : R.boosting ? 0.20 : 0.13;

            pushRibbonNode(0, pL, upV, ribbonColor(combo, R.boosting, ribTime, 0), alpha, width);
            pushRibbonNode(1, pR, upV, ribbonColor(combo, R.boosting, ribTime, 1.6), alpha, width);

            // Center fiery/golden energy streamer behind rear wheel during Adrenaline Boost or Combo >= 2!
            if (R.boosting || combo >= 2) {
              const pT = m4.tp(m, [0, 0.52, 0.72]);
              const sideV = v3.norm(m4.td(m, [1, 0, 0]));
              pushRibbonNode(2, pT, sideV, ribbonColor(combo, true, ribTime, 3.1), 0.78, 0.22);
            }
          }
        }
      }

      // 2. Ground dust / drift gravel / boost sparks
      if (R.air || R.speed < 6) return;
      const m = Course.mountain;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const bx = R.pos[0] - fx * 0.72, by = R.pos[1] + 0.14, bz = R.pos[2] - fz * 0.72;
      const rate = (R.skid > 0 ? 52 : 18) * sat(R.speed / 24);
      if (Math.random() < rate * dt) {
        const spread = R.skid > 0 ? 2.4 : 0.9;
        spawn(
          bx + (Math.random() - 0.5) * 0.25, by, bz + (Math.random() - 0.5) * 0.25,
          -fx * (2 + Math.random() * 2) + (Math.random() - 0.5) * spread,
          1.0 + Math.random() * (R.skid > 0 ? 2.6 : 1.1),
          -fz * (2 + Math.random() * 2) + (Math.random() - 0.5) * spread,
          m.dustCol, R.skid > 0 ? 0.62 : 0.34,
          R.skid > 0 ? 0.28 : 0.18, R.skid > 0 ? 1.55 : 0.95,
          0.42 + Math.random() * 0.32, 0.12
        );
      }
      if (R.boosting && Math.random() < 48 * dt) {
        spawn(
          bx, by + 0.22, bz,
          -fx * 5 + (Math.random() - 0.5) * 1.1,
          0.6 + Math.random() * 1.4,
          -fz * 5 + (Math.random() - 0.5) * 1.1,
          [1.6, 0.65, 0.12], 0.85, 0.24, 0.04, 0.22 + Math.random() * 0.12, -0.15
        );
      }
    },

    burstLand(pos, power = 1) {
      const m = Course.mountain;
      const n = Math.min(22, Math.round(10 + power * 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.3;
        const spd = 2.0 + Math.random() * 3.8 * power;
        spawn(
          pos[0], pos[1] + 0.15, pos[2],
          Math.cos(a) * spd, 1.2 + Math.random() * 2.5, Math.sin(a) * spd,
          m.dustCol, 0.65, 0.28, 1.65, 0.55 + Math.random() * 0.35, 0.25
        );
      }
    },

    burstImpact(pos, col = [1.8, 0.72, 0.18], count = 18) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const spd = 3.5 + Math.random() * 7.0;
        spawn(
          pos[0], pos[1] + 0.8, pos[2],
          Math.cos(a) * spd, 2.5 + Math.random() * 5.0, Math.sin(a) * spd,
          col, 0.95, 0.24, 0.05, 0.32 + Math.random() * 0.26, 0.65
        );
      }
    },

    step(dt) {
      ribTime += dt;
      // 1. Update billboard particles
      let n = 0;
      for (let i = 0; i < MAX; i++) {
        const L = life[i];
        if (L <= 0) continue;
        age[i] += dt;
        if (age[i] >= L) { life[i] = 0; continue; }
        const t = age[i] / L;
        vy[i] -= 16 * gravK[i] * dt;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        pz[i] += vz[i] * dt;
        vx[i] *= Math.exp(-1.8 * dt);
        vz[i] *= Math.exp(-1.8 * dt);

        const o = n * 8;
        gpuData[o] = px[i]; gpuData[o + 1] = py[i]; gpuData[o + 2] = pz[i];
        gpuData[o + 3] = lerp(sz0[i], sz1[i], t);
        gpuData[o + 4] = cr[i]; gpuData[o + 5] = cg[i]; gpuData[o + 6] = cb[i];
        gpuData[o + 7] = ca[i] * (1 - t) * (1 - t);
        n++;
      }
      liveCount = n;
      if (gfx && liveCount > 0) {
        gfx.updateBuffer(instVB, 0, gpuData.subarray(0, liveCount * 8));
      }

      // 2. Age & triangulate 3D silk ribbons
      let rv = 0;
      const emitV = (p, u, v, c, a) => {
        const o = rv * RIB_STRIDE;
        ribVerts[o] = p[0]; ribVerts[o + 1] = p[1]; ribVerts[o + 2] = p[2];
        ribVerts[o + 3] = u; ribVerts[o + 4] = v;
        ribVerts[o + 5] = c[0]; ribVerts[o + 6] = c[1]; ribVerts[o + 7] = c[2]; ribVerts[o + 8] = a;
        rv++;
      };
      for (let r = 0; r < NUM_RIBBONS; r++) {
        const nodes = ribbons[r].nodes;
        for (let i = nodes.length - 1; i >= 0; i--) {
          nodes[i].age += dt;
          if (nodes[i].age > 0.62) nodes.splice(i, 1);
        }
        if (nodes.length < 2) continue;
        for (let i = 0; i < nodes.length - 1; i++) {
          const A = nodes[i], B = nodes[i + 1];
          // Avoid stretching ribbons across respawn teleports
          if (v3.len(v3.sub(B.p, A.p)) > 14) continue;
          const vA = sat(1 - A.age / 0.62), vB = sat(1 - B.age / 0.62);
          const wA = A.w * (0.25 + 0.75 * vA), wB = B.w * (0.25 + 0.75 * vB);
          const a0 = v3.mad(A.p, A.s, -wA), a1 = v3.mad(A.p, A.s, wA);
          const b0 = v3.mad(B.p, B.s, -wB), b1 = v3.mad(B.p, B.s, wB);
          emitV(a0, 0, vA, A.c, A.a); emitV(a1, 1, vA, A.c, A.a); emitV(b1, 1, vB, B.c, B.a);
          emitV(a0, 0, vA, A.c, A.a); emitV(b1, 1, vB, B.c, B.a); emitV(b0, 0, vB, B.c, B.a);
        }
      }
      ribVertCount = rv;
      if (gfx && ribVertCount > 0) {
        gfx.updateBuffer(ribVB, 0, ribVerts.subarray(0, ribVertCount * RIB_STRIDE));
      }
    },

    draw(camViewM) {
      if (pipe && liveCount > 0) {
        const rgt = [camViewM[0], camViewM[4], camViewM[8], 0];
        const up  = [camViewM[1], camViewM[5], camViewM[9], 0];
        gfx.draw(pipe, {
          vb: [quadVB, instVB],
          count: 6,
          instances: liveCount,
          u: { camRight: rgt, camUp: up },
        });
      }
      if (ribPipe && ribVertCount > 0) {
        gfx.draw(ribPipe, {
          vb: [ribVB],
          count: ribVertCount,
        });
      }
    },

    ribbonCount: () => ribVertCount,
  };
})();
