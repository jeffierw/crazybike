// ---------------------------------------------------------------- 04_terrain: V3 photorealistic procedural mountain terrain
// Open multi-line natural freeride trails (no artificial painted lane borders!), micro-normal rock/dirt detail,
// sunlit Fresnel sheen, dramatic 14-26m sheer cliff strata & gleaming coastal water/volcanic lava.
const Terrain = (() => {
  const NU = 83, NS = 152, DS = 2.6;
  const STRIDE = 10; // pos(3) + nrm(3) + mat(4)
  const verts = new Float32Array(NU * NS * STRIDE);

  // Sweeping lateral offsets out to +-185m for expansive open freeride mountainsides & deep cliff chasms
  const U_OFF = new Float32Array(NU);
  {
    const mid = (NU - 1) >> 1;
    for (let i = 0; i < NU; i++) {
      const k = (i - mid) / mid;
      const ak = Math.abs(k);
      const dist = ak * 36.0 + Math.pow(ak, 2.65) * 150.0;
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
  let baseRow = -999999, baseColX = 0;

  function fillRow(rowIdx, worldRow, colX = 0) {
    const s = Math.max(0, worldRow * DS);
    const z = -s;
    const sp = Course.at(s);
    const lanes = Course.lanesAt(s, sp.seg);
    const ramps = Course.rampsNear(s - 2, s + 2);
    const ck = Course.creekAt(s);
    const isEndless = Course.mode.endless;
    let o = rowIdx * NU * STRIDE;

    for (let c = 0; c < NU; c++) {
      const x = isEndless ? (colX + U_OFF[c]) : (sp.cx + U_OFF[c]);
      const u = isEndless ? (x - sp.cx) : U_OFF[c];
      const y = Course.height(x, z, sp, lanes, ramps);

      // Soft organic worn-trail mask (no hard painted border!) + braided natural shortcut paths
      const au = Math.abs(u);
      const mainTrack = 1 - smooth(sp.hw * 0.55, sp.hw * 1.35, au);
      let shortTrack = 0;
      for (let k = 0; k < lanes.length; k++) {
        const L = lanes[k];
        const lm = (1 - smooth(L.hw * 0.45, L.hw * 1.45, Math.abs(u - L.u))) * L.blend;
        if (lm > shortTrack) shortTrack = lm;
      }

      const creekM = (ck.active && sp.dropFace < 0.35)
        ? (1 - smooth(ck.hw * 0.45, ck.hw * 1.15, Math.abs(u - ck.u))) * ck.blend * (1 - smooth(0.25, 0.75, sp.dropFace))
        : 0;

      let rampM = 0;
      for (let k = 0; k < ramps.length; k++) {
        const rm = ramps[k];
        if (s >= rm.s - rm.len && s <= rm.s + 0.8 && Math.abs(u - rm.u) <= rm.w * 0.54) {
          const lipProx = smooth(rm.s - rm.len, rm.s, s);
          rampM = Math.max(rampM, 0.35 + 0.65 * lipProx);
        }
      }

      const cliffW = u < 0 ? sp.cliffL : sp.cliffR;
      const cliffChasm = (!isEndless && au > sp.hw + 16.0) ? cliffW * smooth(sp.hw + 16.0, sp.hw + 46.0, au) : 0;
      const stairOrDrop = sp.dropFace > 0.2 ? -sp.dropFace : (mainTrack > 0.2 ? sp.stairs * mainTrack : cliffChasm);

      verts[o++] = x; verts[o++] = y; verts[o++] = z;
      verts[o++] = 0; verts[o++] = 1; verts[o++] = 0;
      verts[o++] = Math.max(mainTrack, shortTrack);
      verts[o++] = creekM > 0.02 ? -creekM : shortTrack;
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
            let n0: vec3f = normalize(v.wnrm);
            let wp: vec3f = v.wpos;
            let rawTrack: f32 = saturate(v.mat.x);
            let shortM: f32 = saturate(v.mat.y);
            let creekM: f32 = saturate(-v.mat.y);
            let rampM: f32 = saturate(v.mat.z);
            let extraM: f32 = v.mat.w;
            let stairM: f32 = saturate(extraM) * rawTrack;
            let dropFace: f32 = saturate(-extraM);
            let chasmM: f32 = saturate(extraM) * (1.0 - rawTrack);
            let biome: f32 = U.groundCol.w;

            // Multi-scale procedural geological & soil detail
            let g1: f32 = fbm3(wp.xz * 0.11);
            let g2: f32 = fbm3(wp.xz * 0.42 + vec2f(4.3, 1.9));
            let grit: f32 = vnoise(wp.xz * 2.6);
            let micro: f32 = vnoise(wp.xz * 7.5);
            let strata: f32 = sin(wp.y * 0.58 + g1 * 3.8 + g2 * 1.4) * 0.5 + 0.5;
            let steep: f32 = smoothstep(0.24, 0.64, 1.0 - n0.y);

            // Analytical procedural micro-normal perturbation (real rough rock faces, gravel grit & stratified ledges!)
            let eps: f32 = 0.25;
            let hC: f32 = fbm3(wp.xz * 0.65) + 0.35 * vnoise(wp.xz * 3.2);
            let hX: f32 = fbm3((wp.xz + vec2f(eps, 0.0)) * 0.65) + 0.35 * vnoise((wp.xz + vec2f(eps, 0.0)) * 3.2);
            let hZ: f32 = fbm3((wp.xz + vec2f(0.0, eps)) * 0.65) + 0.35 * vnoise((wp.xz + vec2f(0.0, eps)) * 3.2);
            let bumpStr: f32 = mix(0.24, 0.68, saturate(steep + dropFace * 0.5));
            let n: vec3f = normalize(n0 + vec3f((hC - hX) * bumpStr, 0.0, (hC - hZ) * bumpStr));

            // Organic noisy breakup on worn freeride trails (never looks like a painted highway!)
            let trackM: f32 = saturate(rawTrack * (0.72 + 0.45 * g2) - 0.08 * (1.0 - rawTrack));

            var offCol: vec3f = mix(M.bankCol.rgb, M.rockCol.rgb, saturate(steep * 1.18 + g1 * 0.28));
            var specHint: f32 = 0.0;

            if (biome < 0.5) {
              // Red Rock Canyon: weathered Moab sandstone strata, desert crust & warm sun-bleached ledges
              let band: f32 = smoothstep(0.28, 0.72, strata);
              let rockVar: f32 = 0.74 + 0.34 * g2 + 0.14 * grit;
              offCol = mix(offCol * 0.70, M.accentCol.rgb * 0.92, band * 0.52 * (0.35 + 0.65 * steep)) * rockVar;
              offCol = mix(offCol, vec3f(0.38, 0.17, 0.10), chasmM * 0.48);
              specHint = 0.12 * (1.0 - steep) * grit;
            } else if (biome < 1.5) {
              // Pine Forest: rich pine-needle duff, moss patches & cracked wet granite cliff faces
              let moss: f32 = smoothstep(0.45, 0.78, g1);
              let floorC: vec3f = mix(M.bankCol.rgb * 0.85, vec3f(0.24, 0.32, 0.14), moss) * (0.76 + 0.36 * grit);
              let granC: vec3f = M.rockCol.rgb * (0.72 + 0.42 * strata) * (0.85 + 0.25 * micro);
              offCol = mix(floorC, granC, saturate(steep * 1.25 + dropFace * 0.65));
              specHint = 0.16 * steep;
            } else if (biome < 2.5) {
              // Volcanic Ridge: faceted obsidian black basalt, scorched ash & glossy glassy reflections
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb * (0.75 + 0.45 * strata), g1 * 0.45 + steep * 0.65) * (0.80 + 0.30 * grit);
              specHint = 0.28 * (0.4 + 0.6 * steep);
            } else {
              // Hillside Town: warm Mediterranean limestone cliffs + sunlit ocean below!
              offCol = mix(M.bankCol.rgb, M.rockCol.rgb * (0.82 + 0.28 * strata), steep * 0.85) * (0.85 + 0.24 * grit);
              let ocean: f32 = smoothstep(0.38, 0.88, chasmM) * (1.0 - steep);
              let wave: f32 = 0.86 + 0.18 * sin(wp.x * 0.35 + U.camPos.w * 2.4 + g1 * 5.0);
              offCol = mix(offCol, vec3f(0.05, 0.32, 0.50) * wave, ocean * 0.94);
              specHint = ocean * 0.85;
            }

            // Natural worn MTB dirt / gravel singletrack & braided shortcuts
            let ruts: f32 = sin(wp.x * 1.85 + g1 * 2.6) * 0.5 + 0.5;
            var trkCol: vec3f = M.trackCol.rgb * (0.74 + 0.24 * grit + 0.12 * micro + 0.12 * ruts);
            trkCol = mix(trkCol, M.trackCol.rgb * 1.15 + vec3f(0.04, 0.03, 0.01), shortM * 0.42);

            // Exposed rocky strata across sheer mega cliff drop-off faces!
            if (dropFace > 0.08) {
              let cliffRock: vec3f = mix(M.rockCol.rgb * 0.72, M.accentCol.rgb * 0.82, strata * 0.42) * (0.82 + 0.28 * grit);
              trkCol = mix(trkCol, cliffRock, saturate(dropFace * (0.45 + 0.55 * steep)));
            }

            // Town worn stone cobbles & stair edges
            if (biome > 2.5) {
              let cob: f32 = vnoise(wp.xz * 2.8);
              trkCol = mix(trkCol * 0.88, trkCol * 1.14, cob);
              if (stairM > 0.05) {
                let stepLine: f32 = smoothstep(0.82, 0.96, fract(-wp.z * 0.28));
                trkCol = mix(trkCol, vec3f(0.92, 0.82, 0.56), stepLine * stairM * 0.65);
              }
            }

            var albedo: vec3f = mix(offCol, trkCol, trackM);

            // Weathered timber kicker ramp planks
            if (rampM > 0.05) {
              let woodPlanks: f32 = 0.80 + 0.20 * sin(-wp.z * 5.4);
              let wear: f32 = 0.86 + 0.20 * grit;
              let lipMark: f32 = smoothstep(0.76, 0.95, rampM) * step(0.48, fract((wp.x + wp.z) * 0.7));
              let deckCol: vec3f = mix(vec3f(0.46, 0.30, 0.16) * woodPlanks * wear, vec3f(0.96, 0.58, 0.10), lipMark * 0.75);
              albedo = mix(albedo, deckCol, saturate(rampM * 1.45));
            }

            // Finish line checkered banner stripe
            let finDist: f32 = abs(-wp.z - M.trackCol.w);
            if (finDist < 2.4 && rawTrack > 0.15) {
              let chk: f32 = step(0.5, fract(floor(wp.x * 1.2) * 0.5 + floor(-wp.z * 1.2) * 0.5));
              albedo = mix(vec3f(0.08, 0.08, 0.09), vec3f(0.95, 0.94, 0.92), chk);
            }

            // Sparkling downhill-flowing mountain creek (or molten magma creek on Volcano!)
            if (creekM > 0.02) {
              let flowN: f32 = fbm3(vec2f(wp.x * 1.25, wp.z * 0.65 - U.camPos.w * 4.8));
              let foamBand: f32 = smoothstep(0.06, 0.28, creekM) * (1.0 - smoothstep(0.32, 0.65, creekM));
              if (biome > 1.5 && biome < 2.5) {
                let magmaC: vec3f = vec3f(2.2, 0.48, 0.06) * (0.75 + 0.35 * flowN);
                albedo = mix(albedo, magmaC, saturate(creekM * 1.25));
              } else {
                let waterC: vec3f = mix(vec3f(0.07, 0.32, 0.40), vec3f(0.24, 0.58, 0.64), flowN);
                let foamC: vec3f = mix(waterC, vec3f(0.86, 0.94, 0.98), saturate(foamBand * 0.72 + max(0.0, flowN - 0.56) * 1.3));
                albedo = mix(albedo, foamC, saturate(creekM * 1.15));
                specHint = max(specHint, creekM * 0.92);
              }
            }

            let rough: f32 = clamp(mix(0.86, 0.66, trackM) - specHint * 0.58, 0.08, 0.94);
            let sh: f32 = sampleShadow(wp, n);
            var col: vec3f = litSurface(albedo, n, wp, rough, sh);

            // Sunlit grazing-angle mineral / dust / ocean reflection shimmer (Cold-Smoke sunlight feel!)
            let viewD: vec3f = normalize(U.camPos.xyz - wp);
            let halfV: vec3f = normalize(U.sunDir.xyz + viewD);
            let sunGlint: f32 = pow(max(dot(n, halfV), 0.0), mix(18.0, 96.0, specHint)) * (0.14 + specHint * 0.95) * sh;
            let dustRim: f32 = pow(1.0 - max(dot(n, viewD), 0.0), 4.0) * max(dot(viewD, -U.sunDir.xyz), 0.0) * 0.16;
            col = col + U.sunCol.rgb * (sunGlint + dustRim);

            // Volcanic glowing molten lava veins on sheer cliff walls & glowing magma chasm floor
            if (biome > 1.5 && biome < 2.5) {
              let crack: f32 = smoothstep(0.71, 0.87, fbm3(wp.xz * 0.09 + vec2f(2.1, 4.7)));
              let chasmRiver: f32 = smoothstep(0.40, 0.86, chasmM) * smoothstep(0.45, 0.72, fbm3(wp.xz * 0.05 + vec2f(0.0, U.camPos.w * 0.06)));
              let lava: f32 = saturate(crack * steep * (1.0 - trackM) + chasmRiver * 1.25);
              col = col + vec3f(2.8, 0.56, 0.08) * lava * (0.78 + 0.22 * sin(U.camPos.w * 3.2 + wp.z * 0.14));
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
      baseColX = 0;
    },

    update(centerS, centerX = null) {
      if (!gfx) return;
      const targetRow = Math.max(0, Math.floor((centerS - 24) / DS));
      const targetColX = (Course.mode.endless && centerX !== null && centerX !== undefined)
        ? Math.round(centerX / 4) * 4
        : 0;
      if (targetRow === baseRow && targetColX === baseColX) return;
      Course.ensureTo((targetRow + NS) * DS + 50);

      const delta = targetRow - baseRow;
      if (targetColX === baseColX && delta > 0 && delta < NS - 8) {
        const rowFloats = NU * STRIDE;
        verts.copyWithin(0, delta * rowFloats, NS * rowFloats);
        for (let r = NS - delta; r < NS; r++) fillRow(r, targetRow + r, targetColX);
        computeNormals(NS - delta - 1, NS - 1);
      } else {
        for (let r = 0; r < NS; r++) fillRow(r, targetRow + r, targetColX);
        computeNormals(0, NS - 1);
      }
      baseRow = targetRow;
      baseColX = targetColX;
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
