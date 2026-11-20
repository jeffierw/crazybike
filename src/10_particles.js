// ---------------------------------------------------------------- 10_particles: GPU-instanced billboard dust plumes, gravel spray, boost flames & hit sparks
const Particles = (() => {
  const MAX = 640;
  // Per-particle CPU state
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const age = new Float32Array(MAX), life = new Float32Array(MAX), sz0 = new Float32Array(MAX), sz1 = new Float32Array(MAX);
  const cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX), ca = new Float32Array(MAX);
  const gravK = new Float32Array(MAX);
  let head = 0;

  // Packed GPU instance buffer: posSize(4), colAlpha(4) -> 8 floats/instance
  const gpuData = new Float32Array(MAX * 8);
  let gfx = null, quadVB = null, instVB = null, pipe = null, liveCount = 0;

  const QUAD = new Float32Array([
    -1, -1,  1, -1,  1, 1,
    -1, -1,  1,  1, -1, 1,
  ]);

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
    },

    clear() {
      life.fill(0);
      liveCount = 0;
    },

    spawn,

    // Emit tire rooster-tail dust / skid gravel / boost flame behind a rider
    emitTire(R, dt) {
      if (R.crashed || R.air || R.speed < 6) return;
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
        gpuData[o] = px[i];
        gpuData[o + 1] = py[i];
        gpuData[o + 2] = pz[i];
        gpuData[o + 3] = lerp(sz0[i], sz1[i], t);
        gpuData[o + 4] = cr[i];
        gpuData[o + 5] = cg[i];
        gpuData[o + 6] = cb[i];
        gpuData[o + 7] = ca[i] * (1 - t) * (1 - t);
        n++;
      }
      liveCount = n;
      if (gfx && liveCount > 0) {
        gfx.updateBuffer(instVB, 0, gpuData.subarray(0, liveCount * 8));
      }
    },

    draw(camViewM) {
      if (!pipe || liveCount <= 0) return;
      // Extract camera right & up basis vectors from view matrix rows
      const rgt = [camViewM[0], camViewM[4], camViewM[8], 0];
      const up  = [camViewM[1], camViewM[5], camViewM[9], 0];
      gfx.draw(pipe, {
        vb: [quadVB, instVB],
        count: 6,
        instances: liveCount,
        u: { camRight: rgt, camUp: up },
      });
    },
  };
})();
