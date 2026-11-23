// ---------------------------------------------------------------- 05_sky: 4-layer lit ridged-multifractal alpine/canyon/volcano/coastal distant vistas, cloud sea & volumetric sky dome
const Sky = (() => {
  let gfx = null, pipe = null;

  return {
    init(g) {
      gfx = g;
      pipe = gfx.pipeline({
        name: 'sky',
        colorFormat: 'rgba8',
        depth: true,
        depthTest: false,
        depthWrite: false,
        cull: 'none',
        varyings: { uv: 'vec2f' },
        lib: [SHADER_COMMON],
        vs: VS_FULLSCREEN,
        fs: `
          fn ridgeFbm(x: f32, seed: f32) -> f32 {
            let n1: f32 = 1.0 - abs(vnoise(vec2f(x * 1.0 + seed, seed * 0.7)) * 2.0 - 1.0);
            let n2: f32 = 1.0 - abs(vnoise(vec2f(x * 2.15 + seed * 1.7, 3.1)) * 2.0 - 1.0);
            let n3: f32 = 1.0 - abs(vnoise(vec2f(x * 4.6 + seed * 2.3, 6.4)) * 2.0 - 1.0);
            return n1 * n1 * 0.58 + n2 * n2 * 0.28 + n3 * n3 * 0.14;
          }

          fn vistaSlopeShade(dh: f32, dir: vec3f) -> f32 {
            let sunAz: f32 = atan2(U.sunDir.x, -U.sunDir.z);
            let lookAz: f32 = atan2(dir.x, -dir.z);
            let dSun: f32 = sin(sunAz - lookAz);
            return clamp(0.55 + dh * dSun * 3.8, 0.20, 1.35);
          }

          fn frag(v: VOut) -> FOut {
            let ndc: vec4f = vec4f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0, 1.0, 1.0);
            let wp: vec4f = U.invViewProj * ndc;
            let dir: vec3f = normalize(wp.xyz / wp.w - U.camPos.xyz);
            let biome: f32 = U.groundCol.w;
            let az: f32 = atan2(dir.x, -dir.z);
            let t: f32 = U.camPos.w;

            // 1. Physical Rayleigh + Mie sky scattering + subtle crepuscular sun glow
            let up: f32 = saturate(dir.y * 1.45 + 0.08);
            var col: vec3f = mix(U.skyHor.rgb, U.skyZen.rgb, pow(up, 0.56));

            let sDot: f32 = max(dot(dir, U.sunDir.xyz), 0.0);
            let halo: f32 = pow(sDot, 6.0) * 0.40 + pow(sDot, 64.0) * 0.85;
            let disc: f32 = smoothstep(0.9982, 0.9994, sDot) * 4.5;
            col = col + U.sunCol.rgb * (halo + disc);

            // 2. Layered high altitude cirrus & sunlit cumulus decks
            if (dir.y > 0.008) {
              let cuv1: vec2f = dir.xz / (dir.y + 0.16) * 1.15 + vec2f(t * 0.008, -t * 0.004);
              let cuv2: vec2f = dir.xz / (dir.y + 0.24) * 2.45 + vec2f(-t * 0.005, t * 0.007);
              let cl: f32 = smoothstep(0.42, 0.78, fbm3(cuv1) * 0.70 + fbm3(cuv2) * 0.30);
              let cShade: f32 = 0.48 + 0.52 * smoothstep(0.42, 0.86, fbm3(cuv1 + U.sunDir.xz * 0.14));
              let cLit: vec3f = mix(U.skyHor.rgb * 0.72, U.sunCol.rgb * 1.32, saturate(cShade * (0.35 + 0.65 * pow(sDot, 2.4))));
              col = mix(col, cLit, cl * smoothstep(0.008, 0.18, dir.y) * 0.65);
            }

            // 3. 4-Layer Sun-Lit Ridged-Multifractal Distant Vistas (Cold Smoke aerial perspective!)
            if (biome < 0.5) {
              // Red Rock Canyon: 4 stepped Moab sandstone mesas, towers & canyon walls with sunlit ochre rims!
              let eps: f32 = 0.025;
              for (var lyr: i32 = 0; lyr < 4; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let haze: f32 = mix(0.68, 0.08, fl / 3.0);
                let fq: f32 = 1.9 + fl * 1.15;
                let n0: f32 = fbm3(vec2f(az * fq + fl * 3.7, 1.4 + fl));
                let n1: f32 = fbm3(vec2f((az + eps) * fq + fl * 3.7, 1.4 + fl));
                let mesa0: f32 = (0.045 - fl * 0.024) + (0.095 - fl * 0.014) * smoothstep(0.32, 0.41, n0) + 0.042 * smoothstep(0.60, 0.68, n0);
                let mesa1: f32 = (0.045 - fl * 0.024) + (0.095 - fl * 0.014) * smoothstep(0.32, 0.41, n1) + 0.042 * smoothstep(0.60, 0.68, n1);
                if (dir.y < mesa0) {
                  let sh: f32 = vistaSlopeShade((mesa1 - mesa0) / eps, dir);
                  let strata: f32 = 0.86 + 0.18 * sin(dir.y * (140.0 + fl * 45.0) + n0 * 4.5);
                  let rimLit: f32 = smoothstep(mesa0 - 0.014, mesa0, dir.y) * 0.25;
                  let baseC: vec3f = vec3f(0.64 - fl * 0.04, 0.25 - fl * 0.02, 0.13) * strata * (0.68 + 0.45 * sh) + U.sunCol.rgb * rimLit;
                  let finalC: vec3f = mix(baseC, U.skyHor.rgb * (0.90 + 0.14 * fl / 3.0), haze);
                  col = mix(col, finalC, 1.0 - smoothstep(mesa0 - 0.005, mesa0, dir.y));
                }
              }
            } else if (biome < 1.5) {
              // Pine Forest: 4 jagged snow-capped alpine massifs + lit glacial faces + luminous valley cloud sea!
              let eps: f32 = 0.022;
              for (var lyr: i32 = 0; lyr < 4; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let fq: f32 = 1.65 + fl * 0.95;
                let r0: f32 = ridgeFbm(az * fq, 2.2 + fl * 4.1);
                let r1: f32 = ridgeFbm((az + eps) * fq, 2.2 + fl * 4.1);
                let h0: f32 = (0.040 - fl * 0.026) + (0.145 - fl * 0.022) * r0;
                let h1: f32 = (0.040 - fl * 0.026) + (0.145 - fl * 0.022) * r1;
                if (dir.y < h0) {
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, dir);
                  let snowMask: f32 = smoothstep(0.045, 0.115, h0 - (h0 - dir.y) * 0.7) * smoothstep(h0 - 0.055, h0 - 0.012, dir.y);
                  let timberMask: f32 = 1.0 - smoothstep(h0 - 0.09, h0 - 0.03, dir.y);
                  let graniteC: vec3f = vec3f(0.22, 0.28, 0.36) * (0.55 + 0.65 * slopeL);
                  let pineC: vec3f = vec3f(0.08, 0.21, 0.13) * (0.65 + 0.45 * slopeL);
                  let snowC: vec3f = vec3f(0.95, 0.97, 1.00) * mix(vec3f(0.52, 0.64, 0.84), U.sunCol.rgb * 1.15, saturate(slopeL * 0.78));
                  var rockC: vec3f = mix(graniteC, pineC, timberMask * (0.45 + 0.45 * fl / 3.0));
                  rockC = mix(rockC, snowC, snowMask * (1.0 - fl * 0.22));
                  let haze: f32 = mix(0.62, 0.10, fl / 3.0);
                  let finalC: vec3f = mix(rockC, U.skyHor.rgb * 0.95, haze);
                  col = mix(col, finalC, 1.0 - smoothstep(h0 - 0.005, h0, dir.y));
                }
                // Valley cloud sea hugging the pine foothills!
                if (lyr == 1 && dir.y < 0.005 && dir.y > -0.06) {
                  let seaC: f32 = fbm3(vec2f(az * 6.0 + t * 0.02, dir.y * 28.0));
                  let band: f32 = exp(-pow((dir.y + 0.018) / 0.022, 2.0)) * smoothstep(0.32, 0.72, seaC);
                  col = mix(col, mix(U.skyHor.rgb, U.sunCol.rgb * 1.1, 0.35), band * 0.65);
                }
              }
            } else if (biome < 2.5) {
              // Volcanic Ridge: twin jagged basalt ranges + smoking caldera + under-lit ash clouds & lava rim
              let dAz: f32 = abs(az - 0.22);
              let cone: f32 = max(0.0, 0.18 - dAz * 0.34) - smoothstep(0.0, 0.075, 0.075 - dAz) * 0.036;
              if (dAz < 0.45 && dir.y > 0.05 && dir.y < 0.48) {
                let plN: f32 = fbm3(vec2f(az * 8.5 + dir.y * 2.4, dir.y * 7.5 - t * 0.08));
                let plMask: f32 = (1.0 - smoothstep(0.04, 0.38, abs(az - 0.22 - (dir.y - 0.12) * 0.40))) * smoothstep(0.34, 0.74, plN);
                let plCol: vec3f = mix(vec3f(0.11, 0.08, 0.09), vec3f(1.55, 0.42, 0.08), exp(-(dir.y - 0.10) * 8.0) * 0.78);
                col = mix(col, plCol, saturate(plMask * 0.78));
              }
              let eps: f32 = 0.024;
              for (var lyr: i32 = 0; lyr < 3; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let fq: f32 = 2.4 + fl * 1.4;
                let r0: f32 = ridgeFbm(az * fq, 3.1 + fl * 5.3);
                let r1: f32 = ridgeFbm((az + eps) * fq, 3.1 + fl * 5.3);
                let h0: f32 = (0.015 - fl * 0.022) + (0.085 - fl * 0.015) * r0 + (lyr == 0 ? cone : 0.0);
                let h1: f32 = (0.015 - fl * 0.022) + (0.085 - fl * 0.015) * r1 + (lyr == 0 ? cone : 0.0);
                if (dir.y < h0) {
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, dir);
                  let lavaRim: f32 = lyr == 0 ? exp(-abs(az - 0.22) * 14.0) * smoothstep(h0 - 0.028, h0, dir.y) : 0.0;
                  let bCol: vec3f = mix(vec3f(0.13, 0.09, 0.09) * (0.6 + 0.55 * slopeL), vec3f(2.4, 0.58, 0.08), lavaRim * 0.92);
                  let finalC: vec3f = mix(bCol, U.skyHor.rgb * 0.75, mix(0.42, 0.08, fl / 2.0));
                  col = mix(col, finalC, 1.0 - smoothstep(h0 - 0.005, h0, dir.y));
                }
              }
            } else {
              // Hillside Town: layered Mediterranean headlands + gleaming turquoise sea & sunlit ocean islands!
              let eps: f32 = 0.024;
              for (var lyr: i32 = 0; lyr < 3; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let r0: f32 = fbm3(vec2f(az * (2.2 + fl * 1.4) + fl * 4.2, 1.9));
                let r1: f32 = fbm3(vec2f((az + eps) * (2.2 + fl * 1.4) + fl * 4.2, 1.9));
                let coastMask: f32 = smoothstep(-0.35 + fl * 0.12, 0.45, -az);
                let h0: f32 = (0.005 - fl * 0.016) + (0.068 - fl * 0.012) * r0 * coastMask;
                let h1: f32 = (0.005 - fl * 0.016) + (0.068 - fl * 0.012) * r1 * coastMask;
                if (dir.y < h0) {
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, dir);
                  let hCol: vec3f = mix(vec3f(0.32, 0.28, 0.25) * (0.65 + 0.5 * slopeL), U.skyHor.rgb * 0.85, mix(0.65, 0.12, fl / 2.0));
                  col = mix(col, hCol, 1.0 - smoothstep(h0 - 0.004, h0, dir.y));
                }
              }
              if (dir.y < -0.004) {
                let seaDepth: f32 = saturate(-dir.y * 5.0);
                let sunPath: f32 = pow(max(dot(normalize(vec3f(dir.x, 0.0, dir.z)), normalize(vec3f(U.sunDir.x, 0.0, U.sunDir.z))), 0.0), 34.0);
                let wave1: f32 = sin(az * 72.0 + t * 3.1 + dir.y * 140.0);
                let wave2: f32 = cos(az * 115.0 - t * 2.4 + dir.y * 95.0);
                let shimmer: f32 = 0.65 + 0.35 * (wave1 * 0.6 + wave2 * 0.4);
                var seaCol: vec3f = mix(U.skyHor.rgb * 0.88, vec3f(0.05, 0.30, 0.48), pow(seaDepth, 0.44));
                seaCol = seaCol + U.sunCol.rgb * sunPath * max(shimmer, 0.0) * 1.25 * (1.0 - seaDepth * 0.45);
                col = mix(col, seaCol, smoothstep(-0.004, -0.014, dir.y));
              }
            }

            // 4. Soft atmospheric horizon haze band
            let hz: f32 = exp(-abs(dir.y) * 11.5);
            col = mix(col, U.skyHor.rgb * 1.05, hz * 0.28);

            var o: FOut;
            o.color = vec4f(acesTone(col * U.sunCol.w), 1.0);
            return o;
          }
        `,
      });
    },

    draw() {
      if (!pipe) return;
      gfx.draw(pipe, { count: 3 });
    },
  };
})();
