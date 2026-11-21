// ---------------------------------------------------------------- 04_terrain: streaming 4-biome downhill terrain with sheer cliffs, step-downs & rich material shading
const Terrain = (() => {
  const NU = 75, NS = 144, DS = 2.5;
  const STRIDE = 10; // pos(3) + nrm(3) + mat(4)
  const verts = new Float32Array(NU * NS * STRIDE);

  // Non-uniform lateral offsets: crisp track/edge detail, sweeping out to +-165m sheer cliff chasms & mesas
  const U_OFF = new Float32Array(NU);
  {
    const mid = (NU - 1) >> 1;
    for (let i = 0; i < NU; i++) {
      const k = (i - mid) / mid;
      const ak = Math.abs(k);
      const dist = ak * 28.0 + Math.pow(ak, 2.7) * 138.0;
      U_OFF[i] = sign(k) * dist;
    }
  }

  const idxCount = (NU - 1) * (NS - 1) * 6;
  const indices = new Uint32Array(idxCount);
  {
    let p = 0;
    for (let r = 0; r < NS - 1; r++) {
      for (let c = 0; c < NU - 1; c++) {
        const a = r * NU + c, b = a + 1, d = a + NU, e = d + 1;
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
      const y = Course.height(x, z, sp, lane, ramps);

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
      // Pack drop-off lip warning & town stairs into mat.w (dropEdge > 0 marks vertical step-down rock ledge!)
      const cliffW = u < 0 ? sp.cliffL : sp.cliffR;
      const cliffChasm = (au > sp.hw + 4.0) ? cliffW * smooth(sp.hw + 4.0, sp.hw + 28.0, au) : 0;
      const stairOrDrop = mainTrack > 0.2 ? Math.max(sp.stairs * mainTrack, -sp.dropEdge) : cliffChasm;

      verts[o++] = x; verts[o++] = y; verts[o++] = z;
      verts[o++] = 0; verts[o++] = 1; verts[o++] = 0;
      verts[o++] = Math.max(mainTrack, shortTrack);
      verts[o++] = shortTrack;
      verts[o++] = rampM;
      verts[o++] = stairOrDrop;
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
            let extraM: f32 = v.mat.w;
            let stairM: f32 = saturate(extraM) * trackM;
            let dropLip: f32 = saturate(-extraM) * trackM;
            let chasmM: f32 = saturate(extraM) * (1.0 - trackM);
            let biome: f32 = U.groundCol.w;

            let g1: f32 = fbm3(wp.xz * 0.13);
            let g2: f32 = vnoise(wp.xz * 0.85);
            let g3: f32 = vnoise(wp.xz * 2.8);
            let strata: f32 = sin(wp.y * 0.72 + g1 * 3.4) * 0.5 + 0.5;
            let steep: f32 = smoothstep(0.32, 0.72, 1.0 - n.y);

            // Base off-track cliff & mountain colors
            var offCol: vec3f = mix(M.bankCol.rgb, M.rockCol.rgb, saturate(steep * 1.15 + g1 * 0.25));
            if (biome < 0.5) {
              // Red Rock Canyon: sharp horizontal Moab sandstone bands on sheer cliffs
              let band: f32 = smoothstep(0.35, 0.70, strata);
              offCol = mix(offCol * 0.72, M.accentCol.rgb, band * 0.48 * (0.35 + 0.65 * steep));
              offCol = mix(offCol, vec3f(0.42, 0.20, 0.12), chasmM * 0.45);
            } else if (biome < 1.5) {
              // Pine Forest: mossy forest floor + exposed alpine granite cliff strata
              offCol = mix(M.bankCol.rgb * (0.72 + 0.48 * g1), M.rockCol.rgb * (0.85 + 0.30 * strata), steep);
            } else if (biome < 2.5) {
              // Volcanic Ridge: jagged black basalt cliffs + glowing chasm floor
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb, g1 * 0.55 + steep * 0.55);
            } else {
              // Hillside Town: warm terraced stone retaining walls + deep coastal cliff water below!
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb * (0.86 + 0.24 * strata), steep * 0.85);
              let ocean: f32 = smoothstep(0.45, 0.92, chasmM) * (1.0 - steep);
              let wave: f32 = 0.88 + 0.16 * sin(wp.x * 0.4 + U.camPos.w * 2.2 + g1 * 4.0);
              offCol = mix(offCol, vec3f(0.06, 0.34, 0.52) * wave, ocean * 0.92);
            }

            // Track bed with realistic tire ruts, gravel grit & sunlit dusty shoulders
            let edgeHighlight: f32 = smoothstep(0.10, 0.45, trackM) * (1.0 - smoothstep(0.60, 0.92, trackM));
            let ruts: f32 = sin(wp.x * 2.1 + g1 * 2.0) * 0.5 + 0.5;
            var trkCol: vec3f = M.trackCol.rgb * (0.74 + 0.22 * g2 + 0.10 * g3 + 0.14 * ruts);
            trkCol = mix(trkCol, M.accentCol.rgb * 0.95, edgeHighlight * 0.48);

            // Shortcut golden dusty glow hint
            trkCol = mix(trkCol, mix(trkCol, M.accentCol.rgb, 0.46), shortM * 0.88);

            // Vertical step-down rock ledge (断面): exposed stratified rock face + bright hazard takeoff stripe!
            if (dropLip > 0.05) {
              let rockFace: vec3f = mix(M.rockCol.rgb * 0.85, M.accentCol.rgb, strata * 0.45);
              let warnBand: f32 = step(0.5, fract(wp.x * 0.75)) * (1.0 - steep);
              let lipPaint: vec3f = mix(rockFace, vec3f(0.98, 0.72, 0.12), warnBand * 0.55);
              trkCol = mix(trkCol, lipPaint, saturate(dropLip * (0.55 + 0.45 * steep)));
            }

            // Town cobbles & high-contrast stair nosings
            if (biome > 2.5) {
              let cob: f32 = vnoise(wp.xz * 2.6);
              trkCol = mix(trkCol * 0.90, trkCol * 1.12, cob);
              if (stairM > 0.05) {
                let stepLine: f32 = smoothstep(0.80, 0.96, fract(-wp.z * 0.28));
                trkCol = mix(trkCol, vec3f(0.96, 0.85, 0.52), stepLine * stairM * 0.78);
              }
            }

            var albedo: vec3f = mix(offCol, trkCol, trackM);

            // High-visibility wooden North-Shore kicker ramp deck & orange takeoff stripes!
            if (rampM > 0.05) {
              let woodPlanks: f32 = 0.82 + 0.18 * sin(-wp.z * 5.2);
              let stripe: f32 = smoothstep(0.52, 0.90, rampM) * step(0.45, fract((wp.x + wp.z) * 0.65));
              let deckCol: vec3f = mix(vec3f(0.54, 0.34, 0.16) * woodPlanks, vec3f(1.0, 0.62, 0.08), stripe * 0.88);
              albedo = mix(albedo, deckCol, saturate(rampM * 1.45));
            }

            // Finish line checkered banner stripe
            let finDist: f32 = abs(-wp.z - M.trackCol.w);
            if (finDist < 2.2 && trackM > 0.3) {
              let chk: f32 = step(0.5, fract(floor(wp.x * 1.2) * 0.5 + floor(-wp.z * 1.2) * 0.5));
              albedo = mix(vec3f(0.08, 0.08, 0.09), vec3f(0.96, 0.96, 0.94), chk);
            }

            let rough: f32 = mix(0.88, 0.70, trackM);
            let sh: f32 = sampleShadow(wp, n);
            var col: vec3f = litSurface(albedo, n, wp, rough, sh);

            // Volcanic glowing molten lava veins on sheer cliff walls & glowing magma river down inside the chasm!
            if (biome > 1.5 && biome < 2.5) {
              let crack: f32 = smoothstep(0.72, 0.88, fbm3(wp.xz * 0.09 + vec2f(2.1, 4.7)));
              let chasmRiver: f32 = smoothstep(0.42, 0.88, chasmM) * smoothstep(0.46, 0.72, fbm3(wp.xz * 0.05 + vec2f(0.0, U.camPos.w * 0.06)));
              let lava: f32 = saturate(crack * steep * (1.0 - trackM) + chasmRiver * 1.25);
              col = col + vec3f(2.8, 0.58, 0.08) * lava * (0.78 + 0.22 * sin(U.camPos.w * 3.2 + wp.z * 0.14));
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
        const rowFloats = NU * STRIDE;
        verts.copyWithin(0, delta * rowFloats, NS * rowFloats);
        for (let r = NS - delta; r < NS; r++) fillRow(r, targetRow + r);
        computeNormals(NS - delta - 1, NS - 1);
      } else {
        for (let r = 0; r < NS; r++) fillRow(r, targetRow + r);
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
          trackCol:  [m.trackCol[0],  m.trackCol[1],  m.trackCol[2],  Course.finishS],
          bankCol:   [m.bankCol[0],   m.bankCol[1],   m.bankCol[2],   0],
          rockCol:   [m.rockCol[0],   m.rockCol[1],   m.rockCol[2],   0],
          accentCol: [m.accentCol[0], m.accentCol[1], m.accentCol[2], 0],
        },
        tex: { uShadow: shadowTex },
      });
    },
  };
  return T;
})();
