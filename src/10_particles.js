// ---------------------------------------------------------------- 10_particles: V3 sunlit backlit dust, atmospheric motes & Painterly Ink-Brush Spray Ribbons (喷墨彩带)
const Particles = (() => {
  // ---- A. Instanced Sunlit Billboard Dust, Ink Droplets & Biome Atmospheric Motes ----
  const MAX = 820;
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const age = new Float32Array(MAX), life = new Float32Array(MAX), sz0 = new Float32Array(MAX), sz1 = new Float32Array(MAX);
  const cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX), ca = new Float32Array(MAX);
  const gravK = new Float32Array(MAX), sunLit = new Float32Array(MAX);
  let head = 0;

  // Packed GPU instance buffer: posSize(4), colAlpha(4) -> 8 floats/instance
  const gpuData = new Float32Array(MAX * 8);
  let gfx = null, quadVB = null, instVB = null, pipe = null, liveCount = 0;

  const QUAD = new Float32Array([
    -1, -1,  1, -1,  1, 1,
    -1, -1,  1,  1, -1, 1,
  ]);

  // ---- B. Painterly Ink-Brush / Spray-Paint Ribbon Trails (Alpha-blended pigment + dry-brush bristles!) ----
  const NUM_RIBBONS = 4; // 0: left hand ink stroke, 1: right hand ink stroke, 2: tire chalk/ink streamer, 3: reserve
  const RIB_SEGS = 38;
  const RIB_STRIDE = 9;  // pos(3) + uv(2) + col(4)
  const MAX_RIB_VERTS = NUM_RIBBONS * (RIB_SEGS - 1) * 6;
  const ribVerts = new Float32Array(MAX_RIB_VERTS * RIB_STRIDE);
  let ribVB = null, ribPipe = null, ribVertCount = 0, ribTime = 0;

  const ribbons = [];
  for (let i = 0; i < NUM_RIBBONS; i++) ribbons.push({ nodes: [], acc: 0 });

  // Physical ink-pigment palettes per biome / trick (deep organic inks, NEVER sci-fi neon lasers!)
  const INK_PALETTES = [
    [[0.78, 0.16, 0.08], [0.88, 0.52, 0.10], [0.11, 0.11, 0.13]], // Red Rock: vermilion ink, ochre gold, sumi charcoal
    [[0.12, 0.44, 0.28], [0.86, 0.64, 0.16], [0.10, 0.12, 0.13]], // Pine Forest: pine mineral green, sunlit amber, sumi
    [[0.86, 0.22, 0.06], [0.12, 0.10, 0.12], [0.94, 0.48, 0.08]], // Volcano: lava vermilion, soot black, ember gold
    [[0.10, 0.46, 0.68], [0.88, 0.28, 0.18], [0.92, 0.72, 0.22]], // Hillside Town: coastal cobalt, coral terracotta, ochre
  ];

  function pushRibbonNode(ri, pos, side, col, alpha, width) {
    const rb = ribbons[ri];
    rb.nodes.push({ p: pos, s: side, c: col, a: alpha, w: width, age: 0 });
    if (rb.nodes.length > RIB_SEGS) rb.nodes.shift();
  }

  function spawn(x, y, z, dx, dy, dz, col, a, s0, s1, ttl, g = 0.2, backlit = 1.0) {
    const i = head;
    head = (head + 1) % MAX;
    px[i] = x; py[i] = y; pz[i] = z;
    vx[i] = dx; vy[i] = dy; vz[i] = dz;
    cr[i] = col[0]; cg[i] = col[1]; cb[i] = col[2]; ca[i] = a;
    sz0[i] = s0; sz1[i] = s1;
    age[i] = 0; life[i] = ttl;
    gravK[i] = g;
    sunLit[i] = backlit;
  }

  return {
    init(g) {
      gfx = g;
      quadVB = gfx.buffer(QUAD, 'vertex', false);
      instVB = gfx.buffer(gpuData, 'vertex', true);

      // Sunlit dust / spray / droplet billboard shader with realistic directional sunlight forward-scattering!
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
        varyings: { uv: 'vec2f', col: 'vec4f', wpos: 'vec3f' },
        uniforms: { camRight: 'vec4f', camUp: 'vec4f' },
        lib: [SHADER_COMMON],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let wp: vec3f = a.pSz.xyz + (M.camRight.xyz * a.q.x + M.camUp.xyz * a.q.y) * a.pSz.w;
            v.clip = U.viewProj * vec4f(wp, 1.0);
            v.uv = a.q;
            v.col = a.col;
            v.wpos = wp;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            let r2: f32 = dot(v.uv, v.uv);
            let n: f32 = vnoise(v.uv * 2.8 + v.wpos.xz * 0.45);
            let soft: f32 = saturate(1.0 - r2 * (0.85 + 0.30 * n));
            let alpha: f32 = soft * soft * v.col.a;
            if (alpha < 0.004) { discard; }

            // Directional sunlight forward-scattering glow through kicked-up dust clouds!
            let viewD: vec3f = normalize(v.wpos - U.camPos.xyz);
            let sunFwd: f32 = pow(max(dot(viewD, U.sunDir.xyz), 0.0), 3.0);
            let rim: f32 = (1.0 - soft) * sunFwd * 0.65 + sunFwd * 0.35;
            let litCol: vec3f = v.col.rgb * (0.68 + 0.45 * U.sunCol.rgb) + U.sunCol.rgb * rim * 0.55;
            let fogged: vec3f = applyFog(litCol, v.wpos);

            var o: FOut;
            o.color = vec4f(acesTone(fogged * U.sunCol.w), alpha);
            return o;
          }
        `,
      });

      // Painterly Ink-Brush / Spray-Paint Ribbon Pipeline (Alpha-blended physical pigment with fibrous bristle breakup!)
      ribVB = gfx.buffer(ribVerts, 'vertex', true);
      ribPipe = gfx.pipeline({
        name: 'ribbons',
        colorFormat: 'rgba8',
        depth: true,
        depthTest: true,
        depthWrite: false,
        blend: 'alpha',
        cull: 'none',
        buffers: [{
          attrs: [
            ['pos', 'vec3f'],
            ['uv',  'vec2f'],
            ['col', 'vec4f'],
          ],
        }],
        varyings: { uv: 'vec2f', col: 'vec4f', wpos: 'vec3f' },
        lib: [SHADER_COMMON],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            v.clip = U.viewProj * vec4f(a.pos, 1.0);
            v.uv = a.uv;
            v.col = a.col;
            v.wpos = a.pos;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            // Organic sumi-ink & spray-paint brush profile: dense brushstroke body + dry-brush fibrous bristles & spatter edges!
            let across: f32 = abs(v.uv.x * 2.0 - 1.0);
            let tail: f32 = saturate(v.uv.y);
            let bristles: f32 = vnoise(vec2f(v.uv.x * 16.0, v.uv.y * 4.5));
            let splatter: f32 = fbm3(vec2f(v.uv.x * 6.5, v.uv.y * 12.0));
            let edgeNoise: f32 = (bristles * 0.55 + splatter * 0.45) * 0.58;

            // Pinch head & dry-brush feather out tail organically
            let widthEnv: f32 = smoothstep(0.0, 0.14, tail) * (1.0 - smoothstep(0.86, 1.0, tail) * 0.35);
            let mask: f32 = 1.0 - smoothstep(widthEnv * 0.42 - edgeNoise * 0.32, widthEnv * 0.96 + 0.08, across + edgeNoise * (1.0 - tail * 0.55));
            let dryCut: f32 = smoothstep(0.18 * (1.0 - tail), 0.55, bristles * 0.6 + tail * 0.72);
            let a: f32 = saturate(mask * dryCut * tail * v.col.a);
            if (a < 0.015) { discard; }

            // Natural sunlit pigment shading (rich matte paint/ink with subtle dusty sunlit highlight — zero electronic neon!)
            let pigDark: vec3f = v.col.rgb * (0.58 + 0.42 * splatter);
            let sunTint: vec3f = U.sunCol.rgb * 0.36 + vec3f(0.68);
            let c: vec3f = applyFog(pigDark * sunTint, v.wpos);

            var o: FOut;
            o.color = vec4f(acesTone(c * U.sunCol.w), a);
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

    // Emit realistic sunlit dust plumes, gravel spray & Painterly Ink-Brush trick ribbons + paint droplets!
    emitTire(R, dt, quality = 'auto') {
      if (R.crashed) {
        if (R.isPlayer) {
          ribbons[0].nodes.length = 0;
          ribbons[1].nodes.length = 0;
          ribbons[2].nodes.length = 0;
        }
        return;
      }

      const qMul = quality === 'smooth' ? 0.45 : quality === 'balanced' ? 0.78 : quality === 'high' ? 1.35 : 1.0;

      // 1. Expressive Painterly Ink-Brush Ribbons & Spray-Paint Droplets during committed air tricks or overdrive!
      if (R.isPlayer) {
        const showRibbon = R.trickActive || (R.boosting && R.speed > 26);
        if (showRibbon) {
          ribbons[0].acc += dt;
          if (ribbons[0].acc >= 0.015) {
            ribbons[0].acc = 0;
            let m = m4.translate(R.pos);
            m = m4.mul(m, m4.rotY(R.yaw + (R.trickYaw || 0)));
            m = m4.mul(m, m4.rotX(R.pitch + (R.trickPitch || 0)));
            m = m4.mul(m, m4.rotZ(R.roll + (R.trickRoll || 0)));

            const pal = INK_PALETTES[Course.mountain.idx % INK_PALETTES.length];
            const spread = (R.trickType === 'nohander' && R.trickPhase > 0.1) ? 0.48 * R.trickPhase : 0;
            const pL = m4.tp(m, [-0.46 - spread, 1.18 + spread * 1.1, -0.35]);
            const pR = m4.tp(m, [ 0.46 + spread, 1.18 + spread * 1.1, -0.35]);
            const upV = v3.norm(m4.td(m, [0, 1, 0]));
            const alpha = R.trickActive ? 0.88 : 0.62;
            const width = R.trickActive ? 0.34 : 0.22;

            pushRibbonNode(0, pL, upV, pal[0], alpha, width);
            pushRibbonNode(1, pR, upV, pal[1], alpha, width);

            // Bold dark sumi-ink accent brush stroke trailing off rear tire during tricks!
            if (R.trickActive) {
              const pT = m4.tp(m, [0, 0.45, 0.72]);
              const sideV = v3.norm(m4.td(m, [1, 0, 0]));
              pushRibbonNode(2, pT, sideV, pal[2], 0.76, 0.28);
            }

            // Physical spray-paint / ink droplets breaking away from the brush strokes!
            if (Math.random() < 0.75 * qMul) {
              const pDrop = Math.random() < 0.5 ? pL : pR;
              const colDrop = Math.random() < 0.5 ? pal[0] : (Math.random() < 0.5 ? pal[1] : pal[2]);
              spawn(
                pDrop[0] + (Math.random() - 0.5) * 0.25,
                pDrop[1] + (Math.random() - 0.5) * 0.25,
                pDrop[2] + (Math.random() - 0.5) * 0.25,
                (Math.random() - 0.5) * 3.8, 0.8 + Math.random() * 2.2, (Math.random() - 0.5) * 3.8,
                colDrop, 0.82, 0.14 + Math.random() * 0.12, 0.04,
                0.38 + Math.random() * 0.28, 0.35
              );
            }
          }
        }
      }

      // 2. Realistic sunlit rooster-tail dust plumes & drift gravel spray!
      if (R.air || R.speed < 5) return;
      const m = Course.mountain;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const bx = R.pos[0] - fx * 0.72, by = R.pos[1] + 0.14, bz = R.pos[2] - fz * 0.72;
      const rate = (R.skid > 0 ? 64 : 24) * sat(R.speed / 22) * qMul;
      if (Math.random() < rate * dt) {
        const spread = R.skid > 0 ? 2.8 : 1.1;
        spawn(
          bx + (Math.random() - 0.5) * 0.30, by, bz + (Math.random() - 0.5) * 0.30,
          -fx * (2.2 + Math.random() * 2.4) + (Math.random() - 0.5) * spread,
          1.1 + Math.random() * (R.skid > 0 ? 3.0 : 1.4),
          -fz * (2.2 + Math.random() * 2.4) + (Math.random() - 0.5) * spread,
          m.dustCol, R.skid > 0 ? 0.58 : 0.32,
          R.skid > 0 ? 0.34 : 0.22, R.skid > 0 ? 2.1 : 1.35,
          0.52 + Math.random() * 0.38, 0.09
        );
      }
    },

    // Biome atmospheric sunlit motes floating through the air (desert dust, pine pollen, lava embers, sea mist!)
    emitAmbient(focusPos, dt, quality = 'auto') {
      if (quality === 'smooth' || !focusPos) return;
      const rate = quality === 'high' ? 36 : quality === 'balanced' ? 14 : 24;
      if (Math.random() > rate * dt) return;
      const bi = Course.mountain.idx;
      const x = focusPos[0] + (Math.random() - 0.5) * 44;
      const y = focusPos[1] + (Math.random() - 0.2) * 14;
      const z = focusPos[2] - Math.random() * 48 + 8;
      if (bi === 2) {
        // Rising glowing volcanic embers!
        spawn(x, y - 3, z, (Math.random() - 0.5) * 1.4, 2.2 + Math.random() * 2.5, (Math.random() - 0.5) * 1.4,
          [1.8, 0.58, 0.10], 0.92, 0.14, 0.03, 1.4 + Math.random() * 1.0, -0.05);
      } else if (bi === 1) {
        // Sunlit forest pollen / floating pine needles
        spawn(x, y, z, (Math.random() - 0.5) * 1.2, -0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2,
          [0.96, 0.92, 0.74], 0.45, 0.10, 0.06, 1.8 + Math.random() * 1.2, 0.0);
      } else if (bi === 3) {
        // Coastal sunlit sea-spray mist motes
        spawn(x, y, z, -1.2 + Math.random() * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.0,
          [0.94, 0.96, 1.0], 0.34, 0.24, 0.62, 1.5 + Math.random() * 0.9, 0.0);
      } else {
        // Red Rock Canyon warm golden wind-blown dust motes
        spawn(x, y, z, 1.6 + Math.random() * 1.8, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 1.0,
          [0.95, 0.72, 0.46], 0.36, 0.18, 0.55, 1.4 + Math.random() * 1.0, 0.0);
      }
    },

    burstLand(pos, power = 1) {
      const m = Course.mountain;
      const n = Math.min(26, Math.round(12 + power * 7));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.3;
        const spd = 2.2 + Math.random() * 4.2 * power;
        spawn(
          pos[0], pos[1] + 0.15, pos[2],
          Math.cos(a) * spd, 1.3 + Math.random() * 2.8, Math.sin(a) * spd,
          m.dustCol, 0.62, 0.32, 2.0, 0.62 + Math.random() * 0.38, 0.22
        );
      }
    },

    burstImpact(pos, col = [1.4, 0.62, 0.22], count = 18) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const spd = 3.5 + Math.random() * 7.0;
        spawn(
          pos[0], pos[1] + 0.8, pos[2],
          Math.cos(a) * spd, 2.5 + Math.random() * 5.0, Math.sin(a) * spd,
          col, 0.92, 0.22, 0.05, 0.34 + Math.random() * 0.26, 0.65
        );
      }
    },

    step(dt) {
      ribTime += dt;
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
        vx[i] *= Math.exp(-1.7 * dt);
        vz[i] *= Math.exp(-1.7 * dt);

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

      // Age & triangulate painterly ink-brush ribbons
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
          if (nodes[i].age > 0.72) nodes.splice(i, 1);
        }
        if (nodes.length < 2) continue;
        for (let i = 0; i < nodes.length - 1; i++) {
          const A = nodes[i], B = nodes[i + 1];
          if (v3.len(v3.sub(B.p, A.p)) > 14) continue;
          const vA = sat(1 - A.age / 0.72), vB = sat(1 - B.age / 0.72);
          // Organic calligraphic brush-width swell!
          const wA = A.w * (0.20 + 0.95 * Math.sin(vA * PI * 0.85));
          const wB = B.w * (0.20 + 0.95 * Math.sin(vB * PI * 0.85));
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
      if (ribPipe && ribVertCount > 0) {
        gfx.draw(ribPipe, { vb: [ribVB], count: ribVertCount });
      }
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
    },

    ribbonCount: () => ribVertCount,
  };
})();
