// ---------------------------------------------------------------- 10_particles: V7 Persistent 3D Tire Tracks, Biome Rooster-Tail Spray & Ink-Brush Ribbons
const Particles = (() => {
  // ---- A. Instanced Sunlit Billboard Dust, Gravel Chips & Biome Atmospheric Motes ----
  const MAX = 920;
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const age = new Float32Array(MAX), life = new Float32Array(MAX), sz0 = new Float32Array(MAX), sz1 = new Float32Array(MAX);
  const cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX), ca = new Float32Array(MAX);
  const gravK = new Float32Array(MAX), sunLit = new Float32Array(MAX);
  let head = 0;

  const gpuData = new Float32Array(MAX * 8);
  let gfx = null, quadVB = null, instVB = null, pipe = null, liveCount = 0;

  const QUAD = new Float32Array([
    -1, -1,  1, -1,  1, 1,
    -1, -1,  1,  1, -1, 1,
  ]);

  // ---- B. Painterly Ink-Brush / Spray-Paint Ribbon Trails ----
  const NUM_RIBBONS = 4;
  const RIB_SEGS = 38;
  const RIB_STRIDE = 9;  // pos(3) + uv(2) + col(4)
  const MAX_RIB_VERTS = NUM_RIBBONS * (RIB_SEGS - 1) * 6;
  const ribVerts = new Float32Array(MAX_RIB_VERTS * RIB_STRIDE);
  let ribVB = null, ribPipe = null, ribVertCount = 0, ribTime = 0;

  const ribbons = [];
  for (let i = 0; i < NUM_RIBBONS; i++) ribbons.push({ nodes: [], acc: 0 });

  // ---- C. Persistent Terrain-Hugging 3D Carved Tire Tracks ----
  const MAX_TRACK_RIDERS = 8; // 0 = player (200 nodes), 1..7 = rivals (48 nodes each)
  const PLAYER_TRACK_SEGS = 200;
  const RIVAL_TRACK_SEGS = 48;
  const MAX_TRK_VERTS = (PLAYER_TRACK_SEGS + (MAX_TRACK_RIDERS - 1) * RIVAL_TRACK_SEGS) * 6;
  const trkVerts = new Float32Array(MAX_TRK_VERTS * RIB_STRIDE);
  let trkVB = null, trkPipe = null, trackVertCount = 0;

  const trackSlots = [];
  for (let i = 0; i < MAX_TRACK_RIDERS; i++) trackSlots.push({ nodes: [], wasAir: true });

  const INK_PALETTES = [
    [[0.78, 0.16, 0.08], [0.88, 0.52, 0.10], [0.11, 0.11, 0.13]],
    [[0.12, 0.44, 0.28], [0.86, 0.64, 0.16], [0.10, 0.12, 0.13]],
    [[0.86, 0.22, 0.06], [0.12, 0.10, 0.12], [0.94, 0.48, 0.08]],
    [[0.10, 0.46, 0.68], [0.88, 0.28, 0.18], [0.92, 0.72, 0.22]],
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
            let across: f32 = abs(v.uv.x * 2.0 - 1.0);
            let tail: f32 = saturate(v.uv.y);
            let bristles: f32 = vnoise(vec2f(v.uv.x * 16.0, v.uv.y * 4.5));
            let splatter: f32 = fbm3(vec2f(v.uv.x * 6.5, v.uv.y * 12.0));
            let edgeNoise: f32 = (bristles * 0.55 + splatter * 0.45) * 0.58;

            let widthEnv: f32 = smoothstep(0.0, 0.14, tail) * (1.0 - smoothstep(0.86, 1.0, tail) * 0.35);
            let mask: f32 = 1.0 - smoothstep(widthEnv * 0.42 - edgeNoise * 0.32, widthEnv * 0.96 + 0.08, across + edgeNoise * (1.0 - tail * 0.55));
            let dryCut: f32 = smoothstep(0.18 * (1.0 - tail), 0.55, bristles * 0.6 + tail * 0.72);
            let a: f32 = saturate(mask * dryCut * tail * v.col.a);
            if (a < 0.015) { discard; }

            let pigDark: vec3f = v.col.rgb * (0.58 + 0.42 * splatter);
            let sunTint: vec3f = U.sunCol.rgb * 0.36 + vec3f(0.68);
            let c: vec3f = applyFog(pigDark * sunTint, v.wpos);

            var o: FOut;
            o.color = vec4f(acesTone(c * U.sunCol.w), a);
            return o;
          }
        `,
      });

      // Persistent terrain-conforming MTB tire rut & creek wake pipeline
      trkVB = gfx.buffer(trkVerts, 'vertex', true);
      trkPipe = gfx.pipeline({
        name: 'tracks',
        colorFormat: 'rgba8',
        depth: true,
        depthTest: true,
        depthWrite: false,
        depthBias: -2,
        depthBiasSlope: -1.5,
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
            let uCenter: f32 = abs(v.uv.x * 2.0 - 1.0);
            let fade: f32 = saturate(v.uv.y);
            let n: f32 = vnoise(v.wpos.xz * 2.4);
            let tread: f32 = 0.84 + 0.16 * sin(v.wpos.z * 11.0 + v.uv.x * 4.0);
            let rutMask: f32 = 1.0 - smoothstep(0.30, 0.92, uCenter + (n - 0.5) * 0.22);
            let dRim: f32 = (uCenter - 0.72) / 0.18;
            let rimEdge: f32 = exp(-(dRim * dRim)) * (1.0 - smoothstep(0.88, 1.0, uCenter));
            let alpha: f32 = saturate((rutMask * 0.85 + rimEdge * 0.35) * fade * v.col.a);
            if (alpha < 0.012) { discard; }

            let trenchCol: vec3f = v.col.rgb * tread * (0.78 + 0.34 * n);
            let edgeRimCol: vec3f = mix(trenchCol, v.col.rgb * 1.48 + vec3f(0.10, 0.08, 0.06), rimEdge * 0.55);
            let fogged: vec3f = applyFog(edgeRimCol, v.wpos);

            var o: FOut;
            o.color = vec4f(acesTone(fogged * U.sunCol.w), alpha);
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
      for (let i = 0; i < MAX_TRACK_RIDERS; i++) {
        trackSlots[i].nodes.length = 0;
        trackSlots[i].wasAir = true;
      }
      trackVertCount = 0;
    },

    spawn,

    // Record persistent carved tire tracks + emit biomechanical dust plumes & biome gravel/needle/ember spray
    emitTire(R, dt, quality = 'auto') {
      const slotIdx = R.isPlayer ? 0 : (1 + (Math.abs(R.id || 0) % (MAX_TRACK_RIDERS - 1)));
      const tr = trackSlots[slotIdx];

      if (R.crashed) {
        tr.wasAir = true;
        if (R.isPlayer) {
          ribbons[0].nodes.length = 0;
          ribbons[1].nodes.length = 0;
          ribbons[2].nodes.length = 0;
        }
        return;
      }

      const qMul = typeof Quality !== 'undefined' ? Quality.cfg(quality).particleMul
        : (quality === 'low' || quality === 'smooth') ? 0.42 : quality === 'balanced' ? 0.78 : quality === 'high' ? 1.35 : 1.0;

      // 1. Painterly Ink-Brush Ribbons & Spray-Paint Droplets during committed air tricks or overdrive
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
            const shift = Math.max(0, (R.trickCombo || 1) - 1);
            const spread = (R.trickType === 'nohander' && R.trickPhase > 0.1) ? 0.52 * R.trickPhase : 0;
            const pL = m4.tp(m, [-0.48 - spread, 1.18 + spread * 1.1, -0.35]);
            const pR = m4.tp(m, [ 0.48 + spread, 1.18 + spread * 1.1, -0.35]);
            const sideL = v3.norm(m4.td(m, [0.92, 0.38, 0]));
            const sideR = v3.norm(m4.td(m, [0.92, -0.38, 0]));
            const alpha = R.trickActive ? 0.90 : 0.62;
            const width = R.trickActive ? 0.56 : 0.30;

            pushRibbonNode(0, pL, sideL, pal[shift % 3], alpha, width);
            pushRibbonNode(1, pR, sideR, pal[(shift + 1) % 3], alpha, width);

            if (R.trickActive) {
              const pT = m4.tp(m, [0, 0.48, 0.72]);
              const sideV = v3.norm(m4.td(m, [1, 0, 0]));
              pushRibbonNode(2, pT, sideV, pal[(shift + 2) % 3], 0.80, 0.44);
            }

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

      if (R.air || R.speed < 3.5) {
        tr.wasAir = true;
        return;
      }

      // 2. Persistent Terrain-Hugging 3D Carved Tire Track / Creek Wake Nodes
      const m = Course.mountain;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const bx = R.pos[0] - fx * 0.68, bz = R.pos[2] - fz * 0.68;
      const nodes = tr.nodes;
      const prevN = nodes.length ? nodes[nodes.length - 1] : null;
      if (!prevN || tr.wasAir || Math.hypot(bx - prevN.p[0], bz - prevN.p[2]) >= 0.55) {
        const by = Course.height(bx, bz) + 0.055;
        const nrm = Course.normal(bx, bz);
        let sx = -fz * nrm[1], sy = fz * nrm[0] - fx * nrm[2], sz = fx * nrm[1];
        const sLen = Math.hypot(sx, sy, sz);
        const side = sLen > 0.01 ? [sx / sLen, sy / sLen, sz / sLen] : [Math.cos(R.yaw), 0, -Math.sin(R.yaw)];

        const carve = clamp(Math.abs(R.roll) * 1.15 + (R.skid || 0) * 1.2 + (R.landGrace > 0.16 ? 0.55 : 0) + (R.inCreek ? 0.45 : 0), 0.15, 1.45);
        const halfW = (0.16 + carve * 0.14) * (R.inCreek ? 1.55 : 1.0);
        const alpha = clamp((R.isPlayer ? 0.62 : 0.44) + carve * 0.24, 0.15, 0.92);
        const col = R.inCreek
          ? (m.idx === 2 ? [1.65, 0.44, 0.08] : [0.84, 0.94, 0.98])
          : (m.idx === 0 ? [0.34, 0.14, 0.07]
            : m.idx === 1 ? [0.16, 0.10, 0.06]
            : m.idx === 2 ? ((R.skid || 0) > 0.25 ? [0.68, 0.22, 0.07] : [0.07, 0.06, 0.07])
            : [0.22, 0.19, 0.17]);

        nodes.push({ p: [bx, by, bz], s: side, w: halfW, c: col, a: alpha, age: 0, brk: tr.wasAir });
        const cap = R.isPlayer ? PLAYER_TRACK_SEGS : RIVAL_TRACK_SEGS;
        if (nodes.length > cap) nodes.shift();
        tr.wasAir = false;
      }

      // 3. Directional Carve-Side Rooster-Tail Dust/Mist + Crisp Ballistic Biome Debris Flecks
      if (R.speed < 5) return;
      const by = Course.height(bx, bz) + 0.14;
      const rx = Math.cos(R.yaw), rz = -Math.sin(R.yaw);
      const carveFactor = Math.abs(R.roll) * 1.4 + (R.skid || 0) * 1.6 + (R.landGrace > 0.15 ? 1.2 : 0);
      const carveSide = Math.abs(R.roll) > 0.06 ? -sign(R.roll) : (Math.random() < 0.5 ? -1 : 1);
      const rate = (R.inCreek ? 85 : 26 + carveFactor * 38) * sat(R.speed / 20) * qMul;

      if (Math.random() < rate * dt) {
        if (R.inCreek && m.idx !== 2) {
          for (let k = 0; k < 2; k++) {
            const sgn = k === 0 ? -1 : 1;
            spawn(
              bx + rx * sgn * 0.22, by + 0.06, bz + rz * sgn * 0.22,
              rx * sgn * (2.0 + Math.random() * 2.6) - fx * 1.4,
              2.3 + Math.random() * 2.8,
              rz * sgn * (2.0 + Math.random() * 2.6) - fz * 1.6,
              [0.84, 0.95, 1.0], 0.76, 0.16, 0.72, 0.42 + Math.random() * 0.24, 0.55
            );
          }
        } else {
          const latSpd = carveSide * (1.2 + carveFactor * 3.4) + (Math.random() - 0.5) * 1.6;
          spawn(
            bx + (Math.random() - 0.5) * 0.28, by, bz + (Math.random() - 0.5) * 0.28,
            -fx * (2.4 + Math.random() * 2.6) + rx * latSpd,
            1.1 + Math.random() * (R.skid > 0 ? 3.2 : 1.5),
            -fz * (2.4 + Math.random() * 2.6) + rz * latSpd,
            R.inCreek ? [1.8, 0.55, 0.10] : m.dustCol, R.skid > 0 ? 0.62 : 0.34,
            R.skid > 0 ? 0.34 : 0.24, R.skid > 0 ? 2.2 : 1.45,
            0.52 + Math.random() * 0.38, 0.10
          );

          // Crisp ballistic gravel/needle/ash flecks flying off rear tire knobbies!
          if (Math.random() < (0.45 + carveFactor * 0.35)) {
            const isSpark = m.idx === 2 && (carveFactor > 0.65 || R.inCreek) && Math.random() < 0.42;
            const chipCol = isSpark ? [1.9, 0.52, 0.08]
              : m.idx === 0 ? [0.66, 0.30, 0.14]
              : m.idx === 1 ? [0.18, 0.24, 0.11]
              : m.idx === 2 ? [0.18, 0.14, 0.14]
              : [0.62, 0.56, 0.48];
            const cLat = carveSide * (1.5 + Math.random() * 2.8);
            spawn(
              bx, by + 0.08, bz,
              -fx * (3.0 + Math.random() * 3.0) + rx * cLat,
              2.2 + Math.random() * 2.6,
              -fz * (3.0 + Math.random() * 3.0) + rz * cLat,
              chipCol, isSpark ? 0.95 : 0.88, 0.11 + Math.random() * 0.05, 0.03,
              0.38 + Math.random() * 0.26, 0.85
            );
          }
        }
      }
    },

    emitWaterfalls(centerS, centerX, dt, quality = 'auto') {
      const qCfg = typeof Quality !== 'undefined' ? Quality.cfg(quality) : null;
      if (qCfg ? !qCfg.waterfallMist : (quality === 'low' || quality === 'smooth')) return;
      const drops = Course.dropsNear(Math.max(0, centerS - 18), centerS + 165);
      const bi = Course.mountain.idx;
      const prob = qCfg ? qCfg.waterfallProb : (quality === 'high' ? 1.0 : quality === 'balanced' ? 0.55 : 0.8);
      for (let i = 0; i < drops.length; i++) {
        const dr = drops[i];
        const ck = Course.creekAt(dr.s);
        if (!dr.hasWaterfall && !ck.active) continue;
        if (Math.random() > 22 * dt * prob) continue;
        const spTop = Course.at(dr.s);
        const u = ck.active ? ck.u : dr.wfSide * (spTop.hw * 0.62 + 4.5);
        const wx = spTop.cx + u;
        if (centerX !== null && Math.abs(wx - centerX) > 130) continue;
        const wz = -(dr.s + dr.faceLen);
        const wy = Course.height(wx, wz) + 0.6;
        const mistCol = bi === 2 ? [1.7, 0.52, 0.12] : [0.88, 0.96, 1.0];
        spawn(
          wx + (Math.random() - 0.5) * 4.5, wy, wz + (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 2.2, 2.0 + Math.random() * 2.8, (Math.random() - 0.5) * 2.2,
          mistCol, bi === 2 ? 0.72 : 0.42, 0.65, 2.8, 0.95 + Math.random() * 0.6, -0.04
        );
      }
    },

    emitAmbient(focusPos, dt, quality = 'auto') {
      const qCfg = typeof Quality !== 'undefined' ? Quality.cfg(quality) : null;
      if ((qCfg ? !qCfg.ambientMotes : (quality === 'low' || quality === 'smooth')) || !focusPos) return;
      const rate = qCfg ? qCfg.ambientRate : (quality === 'high' ? 36 : quality === 'balanced' ? 14 : 24);
      if (Math.random() > rate * dt) return;
      const bi = Course.mountain.idx;
      const x = focusPos[0] + (Math.random() - 0.5) * 44;
      const y = focusPos[1] + (Math.random() - 0.2) * 14;
      const z = focusPos[2] - Math.random() * 48 + 8;
      if (bi === 2) {
        spawn(x, y - 3, z, (Math.random() - 0.5) * 1.4, 2.2 + Math.random() * 2.5, (Math.random() - 0.5) * 1.4,
          [1.8, 0.58, 0.10], 0.92, 0.14, 0.03, 1.4 + Math.random() * 1.0, -0.05);
      } else if (bi === 1) {
        spawn(x, y, z, (Math.random() - 0.5) * 1.2, -0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2,
          [0.96, 0.92, 0.74], 0.45, 0.10, 0.06, 1.8 + Math.random() * 1.2, 0.0);
      } else if (bi === 3) {
        spawn(x, y, z, -1.2 + Math.random() * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.0,
          [0.94, 0.96, 1.0], 0.34, 0.24, 0.62, 1.5 + Math.random() * 0.9, 0.0);
      } else {
        spawn(x, y, z, 1.6 + Math.random() * 1.8, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 1.0,
          [0.95, 0.72, 0.46], 0.36, 0.18, 0.55, 1.4 + Math.random() * 1.0, 0.0);
      }
    },

    burstLand(pos, power = 1) {
      const m = Course.mountain;
      const n = Math.min(28, Math.round(12 + power * 8));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.25;
        const spd = 2.4 + Math.random() * 4.5 * power;
        spawn(
          pos[0], pos[1] + 0.15, pos[2],
          Math.cos(a) * spd, 1.0 + Math.random() * 2.2, Math.sin(a) * spd,
          m.dustCol, 0.66, 0.34, 2.1, 0.62 + Math.random() * 0.36, 0.22
        );
        if ((i & 1) === 0) {
          const chipCol = m.idx === 2 ? [1.7, 0.48, 0.10] : m.idx === 1 ? [0.20, 0.26, 0.12] : m.dustCol;
          spawn(
            pos[0], pos[1] + 0.18, pos[2],
            Math.cos(a) * spd * 1.35, 2.6 + Math.random() * 2.8, Math.sin(a) * spd * 1.35,
            chipCol, 0.86, 0.14, 0.04, 0.42 + Math.random() * 0.24, 0.82
          );
        }
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

    burstDebris(kind, pos, dir = [0, -1]) {
      const dx = dir[0] || 0, dz = dir[1] || -1;
      const isFoliage = kind === 'pine' || kind === 'cactus';
      const isEmber = kind === 'ember';
      const isWood = kind === 'house' || kind === 'barrier' || kind === 'lamp';
      const col = isFoliage ? [0.14, 0.38, 0.14]
        : isEmber ? [1.9, 0.48, 0.08]
        : isWood ? [0.82, 0.62, 0.42]
        : (Course.mountain.idx === 0 ? [0.68, 0.30, 0.15] : [0.42, 0.40, 0.38]);
      const count = isFoliage ? 24 : 18;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const spd = 2.0 + Math.random() * 5.8;
        const yOff = isFoliage ? (1.6 + Math.random() * 2.4) : (0.6 + Math.random() * 1.2);
        spawn(
          pos[0] + (Math.random() - 0.5) * 0.8,
          pos[1] + yOff,
          pos[2] + (Math.random() - 0.5) * 0.8,
          dx * 3.5 + Math.cos(a) * spd,
          (isFoliage ? 1.5 : 2.8) + Math.random() * 4.5,
          dz * 3.5 + Math.sin(a) * spd,
          col, isEmber ? 0.96 : 0.86,
          isFoliage ? 0.18 : 0.15, isFoliage ? 0.08 : 0.04,
          (isFoliage ? 0.65 : 0.44) + Math.random() * 0.35,
          isFoliage ? 0.25 : 0.72
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

      // Age & triangulate persistent terrain-hugging 3D carved tire tracks
      let tv = 0;
      const emitTrk = (p, u, v, c, a) => {
        if (tv >= MAX_TRK_VERTS) return;
        const o = tv * RIB_STRIDE;
        trkVerts[o] = p[0]; trkVerts[o + 1] = p[1]; trkVerts[o + 2] = p[2];
        trkVerts[o + 3] = u; trkVerts[o + 4] = v;
        trkVerts[o + 5] = c[0]; trkVerts[o + 6] = c[1]; trkVerts[o + 7] = c[2]; trkVerts[o + 8] = a;
        tv++;
      };
      for (let s = 0; s < MAX_TRACK_RIDERS; s++) {
        const nodes = trackSlots[s].nodes;
        const ttl = s === 0 ? 5.5 : 3.2;
        for (let i = nodes.length - 1; i >= 0; i--) {
          nodes[i].age += dt;
          if (nodes[i].age > ttl) nodes.splice(i, 1);
        }
        if (nodes.length < 2) continue;
        for (let i = 0; i < nodes.length - 1; i++) {
          const A = nodes[i], B = nodes[i + 1];
          if (B.brk) continue;
          const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], dz = B.p[2] - A.p[2];
          if (dx * dx + dy * dy + dz * dz > 20.25) continue;
          const headFadeA = i >= nodes.length - 2 ? 0.55 : 1.0;
          const headFadeB = i >= nodes.length - 2 ? 0.25 : 1.0;
          const vA = sat(1 - A.age / ttl) * headFadeA;
          const vB = sat(1 - B.age / ttl) * headFadeB;
          const a0 = v3.mad(A.p, A.s, -A.w), a1 = v3.mad(A.p, A.s, A.w);
          const b0 = v3.mad(B.p, B.s, -B.w), b1 = v3.mad(B.p, B.s, B.w);
          emitTrk(a0, 0, vA, A.c, A.a); emitTrk(a1, 1, vA, A.c, A.a); emitTrk(b1, 1, vB, B.c, B.a);
          emitTrk(a0, 0, vA, A.c, A.a); emitTrk(b1, 1, vB, B.c, B.a); emitTrk(b0, 0, vB, B.c, B.a);
        }
      }
      trackVertCount = tv;
      if (gfx && trackVertCount > 0) {
        gfx.updateBuffer(trkVB, 0, trkVerts.subarray(0, trackVertCount * RIB_STRIDE));
      }
    },

    drawTracks() {
      if (trkPipe && trackVertCount > 0) {
        gfx.draw(trkPipe, { vb: [trkVB], count: trackVertCount });
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
    trackCount: () => trackVertCount,
  };
})();
