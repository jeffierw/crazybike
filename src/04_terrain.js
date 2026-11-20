// ---------------------------------------------------------------- 04_terrain: streaming 4-biome downhill terrain mesh + PBR-lite procedural shader
const Terrain = (() => {
  const NU = 73, NS = 128, DS = 2.5;
  const STRIDE = 10; // pos(3) + nrm(3) + mat(4)
  const verts = new Float32Array(NU * NS * STRIDE);

  // Non-uniform lateral offsets: dense across track & shortcuts, wide dramatic cliffs outside
  const U_OFF = new Float32Array(NU);
  {
    const mid = (NU - 1) >> 1;
    for (let i = 0; i < NU; i++) {
      const k = (i - mid) / mid; // -1..1
      const ak = Math.abs(k);
      // Cubic blend: crisp ~0.85m detail on track, sweeping out to +-145m cliffs
      const dist = ak * 28.0 + Math.pow(ak, 2.75) * 118.0;
      U_OFF[i] = sign(k) * dist;
    }
  }

  // Static triangle index buffer
  const idxCount = (NU - 1) * (NS - 1) * 6;
  const indices = new Uint32Array(idxCount);
  {
    let p = 0;
    for (let r = 0; r < NS - 1; r++) {
      for (let c = 0; c < NU - 1; c++) {
        const a = r * NU + c;
        const b = a + 1;
        const d = a + NU;
        const e = d + 1;
        // Front-facing CCW when looking from +Y down onto (x right, -z forward)
        indices[p++] = a; indices[p++] = b; indices[p++] = d;
        indices[p++] = b; indices[p++] = e; indices[p++] = d;
      }
    }
  }

  let gfx = null, vb = null, ib = null, pipe = null;
  let baseRow = -999999;

  function fillRow(rowIdx, worldRow) {
    const s = Math.max(0, worldRow * DS);
    const z = -s;
    const sp = Course.at(s);
    const lane = Course.laneAt(s, sp.seg);
    const ramps = Course.rampsNear(s - 2, s + 2);
    let o = rowIdx * NU * STRIDE;

    for (let c = 0; c < NU; c++) {
      const u = U_OFF[c];
      const x = sp.cx + u;
      const y = Course.height(x, z);

      // Compute material masks
      const au = Math.abs(u);
      const mainTrack = 1 - smooth(sp.hw - 1.2, sp.hw + 1.4, au);
      let shortTrack = 0;
      if (lane && lane.blend > 0.05) {
        shortTrack = (1 - smooth(lane.hw - 0.8, lane.hw + 1.4, Math.abs(u - lane.u))) * lane.blend;
      }
      let rampM = 0;
      for (let k = 0; k < ramps.length; k++) {
        const rm = ramps[k];
        if (s >= rm.s - rm.len && s <= rm.s + 0.8 && Math.abs(u - rm.u) <= rm.w * 0.54) {
          const lipProx = smooth(rm.s - rm.len, rm.s, s);
          rampM = Math.max(rampM, 0.35 + 0.65 * lipProx);
        }
      }
      const stairM = sp.stairs * mainTrack;

      verts[o++] = x; verts[o++] = y; verts[o++] = z;
      verts[o++] = 0; verts[o++] = 1; verts[o++] = 0; // filled by computeNormals
      verts[o++] = Math.max(mainTrack, shortTrack);
      verts[o++] = shortTrack;
      verts[o++] = rampM;
      verts[o++] = stairM;
    }
  }

  function computeNormals(rStart, rEnd) {
    const rowF = NU * STRIDE;
    const r0 = Math.max(0, rStart), r1 = Math.min(NS - 1, rEnd);
    for (let r = r0; r <= r1; r++) {
      const rp = Math.max(0, r - 1), rn = Math.min(NS - 1, r + 1);
      for (let c = 0; c < NU; c++) {
        const cp = Math.max(0, c - 1), cn = Math.min(NU - 1, c + 1);
        const oL = r * rowF + cp * STRIDE, oR = r * rowF + cn * STRIDE;
        const oB = rp * rowF + c * STRIDE, oF = rn * rowF + c * STRIDE;
        const dx1 = verts[oR] - verts[oL], dy1 = verts[oR + 1] - verts[oL + 1], dz1 = verts[oR + 2] - verts[oL + 2];
        const dx2 = verts[oF] - verts[oB], dy2 = verts[oF + 1] - verts[oB + 1], dz2 = verts[oF + 2] - verts[oB + 2];
        // cross(forward, right) -> upward normal (since +x right, -z forward)
        let nx = dy1 * dz2 - dz1 * dy2;
        let ny = dz1 * dx2 - dx1 * dz2;
        let nz = dx1 * dy2 - dy1 * dx2;
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
        const o = r * rowF + c * STRIDE;
        verts[o + 3] = nx * inv; verts[o + 4] = ny * inv; verts[o + 5] = nz * inv;
      }
    }
  }

  const T = {
    init(g) {
      gfx = g;
      vb = gfx.buffer(verts, 'vertex', true);
      ib = gfx.buffer(indices, 'index', false);
      pipe = gfx.pipeline({
        name: 'terrain',
        colorFormat: 'rgba8',
        depth: true,
        cull: 'back',
        buffers: [{
          attrs: [
            ['pos', 'vec3f'],
            ['nrm', 'vec3f'],
            ['mat', 'vec4f'],
          ],
        }],
        varyings: {
          wpos: 'vec3f',
          wnrm: 'vec3f',
          mat: 'vec4f',
        },
        uniforms: {
          trackCol: 'vec4f',
          bankCol: 'vec4f',
          rockCol: 'vec4f',
          accentCol: 'vec4f',
        },
        textures: {
          uShadow: 'shadow',
        },
        lib: [SHADER_COMMON, SHADER_SHADOW],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            v.clip = U.viewProj * vec4f(a.pos, 1.0);
            v.wpos = a.pos;
            v.wnrm = a.nrm;
            v.mat = a.mat;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            let n: vec3f = normalize(v.wnrm);
            let wp: vec3f = v.wpos;
            let trackM: f32 = saturate(v.mat.x);
            let shortM: f32 = saturate(v.mat.y);
            let rampM: f32 = saturate(v.mat.z);
            let stairM: f32 = saturate(v.mat.w);
            let biome: f32 = U.groundCol.w;

            // Procedural multi-scale rock/dirt texture
            let g1: f32 = fbm3(wp.xz * 0.14);
            let g2: f32 = vnoise(wp.xz * 0.85);
            let strata: f32 = sin(wp.y * 0.65 + g1 * 3.2) * 0.5 + 0.5;
            let steep: f32 = smoothstep(0.68, 0.90, 1.0 - n.y);

            // Base off-track bank & cliff colors
            var offCol: vec3f = mix(M.bankCol.rgb, M.rockCol.rgb, saturate(steep * 1.15 + g1 * 0.25));
            if (biome < 0.5) {
              // Red Rock Canyon: striated sandstone layers
              offCol = mix(offCol * 0.78, M.accentCol.rgb, strata * 0.38 * (0.4 + 0.6 * steep));
            } else if (biome < 1.5) {
              // Pine Forest: mossy earth & granite outcrops
              offCol = mix(M.bankCol.rgb * (0.75 + 0.45 * g1), M.rockCol.rgb, steep);
            } else if (biome < 2.5) {
              // Volcanic Ridge: charred basalt + glowing lava fissures on cliffs
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb, g1 * 0.6 + steep * 0.5);
            } else {
              // Hillside Town: warm terraced stone & stucco slopes
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb, steep * 0.8 + strata * 0.25);
            }

            // Track bed with packed tire ruts & dusty shoulder border
            let edgeHighlight: f32 = smoothstep(0.15, 0.55, trackM) * (1.0 - smoothstep(0.65, 0.95, trackM));
            let ruts: f32 = sin(wp.x * 1.9 + g1 * 2.2) * 0.5 + 0.5;
            var trkCol: vec3f = M.trackCol.rgb * (0.84 + 0.24 * g2 + 0.12 * ruts);
            trkCol = mix(trkCol, M.trackCol.rgb * 1.24, edgeHighlight * 0.55);

            // Shortcut golden dusty glow hint so players spot risky side lanes
            trkCol = mix(trkCol, mix(trkCol, M.accentCol.rgb, 0.32), shortM * 0.75);

            // Town cobbles & high-contrast painted stair nosings
            if (biome > 2.5) {
              let cob: f32 = vnoise(wp.xz * 2.4);
              trkCol = mix(trkCol * 0.90, trkCol * 1.12, cob);
              if (stairM > 0.05) {
                let stepLine: f32 = smoothstep(0.82, 0.96, fract(-wp.z * 0.28));
                trkCol = mix(trkCol, vec3f(0.95, 0.84, 0.52), stepLine * stairM * 0.75);
              }
            }

            var albedo: vec3f = mix(offCol, trkCol, trackM);

            // High-visibility kicker ramp deck & orange/yellow takeoff stripes!
            if (rampM > 0.05) {
              let woodPlanks: f32 = 0.85 + 0.15 * sin(-wp.z * 4.5);
              let stripe: f32 = smoothstep(0.55, 0.92, rampM) * step(0.45, fract((wp.x + wp.z) * 0.6));
              let deckCol: vec3f = mix(vec3f(0.56, 0.36, 0.18) * woodPlanks, vec3f(1.0, 0.62, 0.08), stripe * 0.85);
              albedo = mix(albedo, deckCol, saturate(rampM * 1.4));
            }

            // Finish line checkered banner stripe painted across track
            let finDist: f32 = abs(-wp.z - M.trackCol.w);
            if (finDist < 2.2 && trackM > 0.3) {
              let chk: f32 = step(0.5, fract(floor(wp.x * 1.2) * 0.5 + floor(-wp.z * 1.2) * 0.5));
              albedo = mix(vec3f(0.08, 0.08, 0.09), vec3f(0.96, 0.96, 0.94), chk);
            }

            let rough: f32 = mix(0.88, 0.72, trackM);
            let sh: f32 = sampleShadow(wp, n);
            var col: vec3f = litSurface(albedo, n, wp, rough, sh);

            // Volcanic glowing magma veins on steep rocky walls
            if (biome > 1.5 && biome < 2.5) {
              let crack: f32 = smoothstep(0.76, 0.90, fbm3(wp.xz * 0.09 + vec2f(2.1, 4.7)));
              let lava: f32 = crack * steep * (1.0 - trackM);
              col = col + vec3f(2.6, 0.55, 0.08) * lava * (0.75 + 0.25 * sin(U.camPos.w * 3.0 + wp.z * 0.15));
            }

            var o: FOut;
            o.color = vec4f(acesTone(col * U.sunCol.w), 1.0);
            return o;
          }
        `,
      });
    },

    reset() {
      baseRow = -999999;
    },

    update(centerS) {
      if (!gfx) return;
      const targetRow = Math.max(0, Math.floor((centerS - 22) / DS));
      if (targetRow === baseRow) return;
      Course.ensureTo((targetRow + NS) * DS + 40);

      const delta = targetRow - baseRow;
      if (delta > 0 && delta < NS - 8) {
        // Shift existing rows back and compute only the new leading rows
        const rowFloats = NU * STRIDE;
        verts.copyWithin(0, delta * rowFloats, NS * rowFloats);
        for (let r = NS - delta; r < NS; r++) {
          fillRow(r, targetRow + r);
        }
        computeNormals(NS - delta - 1, NS - 1);
      } else {
        for (let r = 0; r < NS; r++) {
          fillRow(r, targetRow + r);
        }
        computeNormals(0, NS - 1);
      }
      baseRow = targetRow;
      gfx.updateBuffer(vb, 0, verts);
    },

    draw(shadowTex) {
      if (!pipe) return;
      const m = Course.mountain;
      gfx.draw(pipe, {
        vb: [vb],
        ib,
        count: idxCount,
        u: {
          trackCol: [m.trackCol[0], m.trackCol[1], m.trackCol[2], Course.finishS],
          bankCol: [m.bankCol[0], m.bankCol[1], m.bankCol[2], 0],
          rockCol: [m.rockCol[0], m.rockCol[1], m.rockCol[2], 0],
          accentCol: [m.accentCol[0], m.accentCol[1], m.accentCol[2], 0],
        },
        tex: { uShadow: shadowTex },
      });
    },
  };
  return T;
})();
