// ---------------------------------------------------------------- 05_sky: 4-biome atmospheric panoramic sky dome, sculpted 2D distant ranges & valley mist / perspective sea
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

          fn vistaSlopeShade(dh: f32, n2d: f32, dir: vec3f) -> f32 {
            let sunAz: f32 = atan2(U.sunDir.x, -U.sunDir.z);
            let lookAz: f32 = atan2(dir.x, -dir.z);
            let dSun: f32 = sin(sunAz - lookAz);
            return clamp(0.56 + dh * dSun * 3.4 + (n2d - 0.5) * 0.42, 0.22, 1.35);
          }

          fn frag(v: VOut) -> FOut {
            let ndc: vec4f = vec4f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0, 1.0, 1.0);
            let wp: vec4f = U.invViewProj * ndc;
            let dir: vec3f = normalize(wp.xyz / wp.w - U.camPos.xyz);
            let biome: f32 = U.groundCol.w;
            let az: f32 = atan2(dir.x, -dir.z);
            let t: f32 = U.camPos.w;

            // 1. Physical Rayleigh + Mie sky scattering + crepuscular sun disc
            let up: f32 = saturate(dir.y * 1.45 + 0.08);
            var col: vec3f = mix(U.skyHor.rgb, U.skyZen.rgb, pow(up, 0.56));

            let sDot: f32 = max(dot(dir, U.sunDir.xyz), 0.0);
            let halo: f32 = pow(sDot, 6.0) * 0.40 + pow(sDot, 64.0) * 0.85;
            let disc: f32 = smoothstep(0.9982, 0.9994, sDot) * 4.5;
            col = col + U.sunCol.rgb * (halo + disc);

            // 2. Layered high-altitude cirrus & sunlit cumulus decks
            if (dir.y > 0.008) {
              let cuv1: vec2f = dir.xz / (dir.y + 0.16) * 1.15 + vec2f(t * 0.008, -t * 0.004);
              let cuv2: vec2f = dir.xz / (dir.y + 0.24) * 2.45 + vec2f(-t * 0.005, t * 0.007);
              let cl: f32 = smoothstep(0.42, 0.78, fbm3(cuv1) * 0.70 + fbm3(cuv2) * 0.30);
              let cShade: f32 = 0.48 + 0.52 * smoothstep(0.42, 0.86, fbm3(cuv1 + U.sunDir.xz * 0.14));
              let cLit: vec3f = mix(U.skyHor.rgb * 0.72, U.sunCol.rgb * 1.32, saturate(cShade * (0.35 + 0.65 * pow(sDot, 2.4))));
              col = mix(col, cLit, cl * smoothstep(0.008, 0.18, dir.y) * 0.65);
            }

            // 3. 4-Biome 2D-Sculpted Distant Mountain Vistas & Valley Atmospheric Haze (Zero vertical stripe walls!)
            if (biome < 0.5) {
              // Red Rock Canyon: distant stepped Monument Valley buttes dissolving into golden desert canyon mist
              let eps: f32 = 0.025;
              for (var lyr: i32 = 0; lyr < 4; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let haze: f32 = mix(0.72, 0.22, fl / 3.0);
                let fq: f32 = 1.85 + fl * 1.10;
                let n0: f32 = fbm3(vec2f(az * fq + fl * 3.7, 1.4 + fl));
                let n1: f32 = fbm3(vec2f((az + eps) * fq + fl * 3.7, 1.4 + fl));
                let butte0: f32 = smoothstep(0.36, 0.52, n0) * 0.068 + smoothstep(0.62, 0.72, n0) * 0.044;
                let butte1: f32 = smoothstep(0.36, 0.52, n1) * 0.068 + smoothstep(0.62, 0.72, n1) * 0.044;
                let h0: f32 = (0.045 - fl * 0.018) + (1.0 - fl * 0.12) * butte0;
                let h1: f32 = (0.045 - fl * 0.018) + (1.0 - fl * 0.12) * butte1;
                let floorY: f32 = 0.005 - fl * 0.018;
                if (dir.y < h0) {
                  let n2d: f32 = fbm3(vec2f(az * fq * 2.4 + dir.y * 8.0, dir.y * 22.0 + fl * 3.1));
                  let sh: f32 = vistaSlopeShade((h1 - h0) / eps, n2d, dir);
                  let strata: f32 = 0.91 + 0.11 * vnoise(vec2f(dir.y * 42.0 + n2d * 2.8, az * 3.2));
                  let rimLit: f32 = smoothstep(h0 - 0.012, h0, dir.y) * 0.22;
                  let baseC: vec3f = vec3f(0.64 - fl * 0.04, 0.27 - fl * 0.02, 0.14) * strata * (0.68 + 0.44 * sh) + U.sunCol.rgb * rimLit;
                  let dustFade: f32 = smoothstep(floorY - 0.075, floorY + 0.025, dir.y);
                  let basinMist: vec3f = mix(U.skyHor.rgb, U.sunCol.rgb * 1.08, pow(sDot, 5.0) * 0.35);
                  let rockMist: vec3f = mix(basinMist, baseC, dustFade);
                  let finalC: vec3f = mix(rockMist, basinMist, haze);
                  col = mix(col, finalC, 1.0 - smoothstep(h0 - 0.005, h0, dir.y));
                }
              }
              if (dir.y < 0.015) {
                let basin: f32 = smoothstep(-0.08, 0.015, dir.y);
                let desertMist: vec3f = mix(U.skyHor.rgb * 0.96, U.sunCol.rgb * 1.12, pow(sDot, 5.0) * 0.42);
                col = mix(desertMist, col, basin * 0.65);
              }
            } else if (biome < 1.5) {
              // Pine Forest: 4 layered jagged snow-capped alpine massifs + glacial faces + billowing valley cloud sea!
              let eps: f32 = 0.022;
              for (var lyr: i32 = 0; lyr < 4; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let fq: f32 = 1.65 + fl * 0.95;
                let r0: f32 = ridgeFbm(az * fq, 2.2 + fl * 4.1);
                let r1: f32 = ridgeFbm((az + eps) * fq, 2.2 + fl * 4.1);
                let h0: f32 = (0.048 - fl * 0.020) + (0.142 - fl * 0.020) * r0;
                let h1: f32 = (0.048 - fl * 0.020) + (0.142 - fl * 0.020) * r1;
                let floorY: f32 = 0.002 - fl * 0.015;
                if (dir.y < h0) {
                  let n2d: f32 = fbm3(vec2f(az * fq * 2.2 + dir.y * 10.0, dir.y * 24.0 + fl * 4.7));
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, n2d, dir);
                  let ridgeH: f32 = h0 - dir.y;
                  let snowMask: f32 = smoothstep(0.065, 0.012, ridgeH) * smoothstep(0.032, 0.095, h0) * saturate(0.55 + (n2d - 0.35) * 1.4);
                  let timberMask: f32 = smoothstep(0.028, 0.095, ridgeH);
                  let graniteC: vec3f = vec3f(0.22, 0.28, 0.36) * (0.55 + 0.62 * slopeL);
                  let pineC: vec3f = vec3f(0.08, 0.20, 0.13) * (0.68 + 0.40 * slopeL);
                  let snowC: vec3f = vec3f(0.95, 0.97, 1.00) * mix(vec3f(0.52, 0.64, 0.84), U.sunCol.rgb * 1.14, saturate(slopeL * 0.78));
                  var rockC: vec3f = mix(graniteC, pineC, timberMask * (0.45 + 0.45 * fl / 3.0));
                  rockC = mix(rockC, snowC, snowMask * (1.0 - fl * 0.18));
                  let baseMist: f32 = smoothstep(floorY - 0.065, floorY + 0.025, dir.y);
                  let mistC: vec3f = mix(U.skyHor.rgb * 1.04, U.sunCol.rgb * 1.05, 0.22 + pow(sDot, 5.0) * 0.30);
                  rockC = mix(mistC, rockC, baseMist);
                  let haze: f32 = mix(0.66, 0.16, fl / 3.0);
                  let finalC: vec3f = mix(rockC, mistC, haze);
                  col = mix(col, finalC, 1.0 - smoothstep(h0 - 0.005, h0, dir.y));
                }
              }
              if (dir.y < 0.025) {
                let seaC: f32 = fbm3(vec2f(az * 5.2 + t * 0.018, dir.y * 20.0));
                let dd: f32 = (dir.y + 0.008) / 0.032;
                let cloudDeck: f32 = smoothstep(0.025, -0.055, dir.y) * saturate(0.55 + 0.45 * seaC);
                let mistBand: f32 = exp(-(dd * dd)) * smoothstep(0.28, 0.76, seaC);
                let cloudC: vec3f = mix(U.skyHor.rgb * 1.04, U.sunCol.rgb * 1.08, 0.26 + 0.35 * seaC);
                col = mix(col, cloudC, saturate(cloudDeck * 0.88 + mistBand * 0.55));
              }
            } else if (biome < 2.5) {
              // Volcanic Ridge: jagged caldera peak + drifting backlit ash plume + lava rim & smoky ember basin haze
              let calderaOffset: f32 = az - 0.22 + (ridgeFbm(az * 2.1, 7.3) - 0.5) * 0.06;
              let dAz: f32 = abs(calderaOffset);
              let cone: f32 = max(0.0, 0.175 - dAz * 0.33) - smoothstep(0.0, 0.072, 0.072 - dAz) * 0.036;
              if (dAz < 0.48 && dir.y > 0.05 && dir.y < 0.48) {
                let plN: f32 = fbm3(vec2f(az * 8.5 + dir.y * 2.4, dir.y * 7.5 - t * 0.08));
                let plMask: f32 = (1.0 - smoothstep(0.04, 0.40, abs(az - 0.22 - (dir.y - 0.12) * 0.42))) * smoothstep(0.32, 0.74, plN);
                let plCol: vec3f = mix(vec3f(0.11, 0.08, 0.09), vec3f(1.55, 0.42, 0.08), exp(-(dir.y - 0.10) * 8.0) * 0.78);
                col = mix(col, plCol, saturate(plMask * 0.78));
              }
              let eps: f32 = 0.024;
              for (var lyr: i32 = 0; lyr < 3; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let fq: f32 = 2.4 + fl * 1.4;
                var isL0: f32 = 0.0;
                if (lyr == 0) { isL0 = 1.0; }
                let r0: f32 = ridgeFbm(az * fq, 3.1 + fl * 5.3);
                let r1: f32 = ridgeFbm((az + eps) * fq, 3.1 + fl * 5.3);
                let h0: f32 = (0.024 - fl * 0.018) + (0.082 - fl * 0.014) * r0 + cone * isL0;
                let h1: f32 = (0.024 - fl * 0.018) + (0.082 - fl * 0.014) * r1 + cone * isL0;
                let floorY: f32 = 0.002 - fl * 0.015;
                if (dir.y < h0) {
                  let n2d: f32 = fbm3(vec2f(az * fq * 2.2 + dir.y * 9.0, dir.y * 22.0 + fl * 2.9));
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, n2d, dir);
                  var lavaRim: f32 = 0.0;
                  if (lyr == 0) {
                    lavaRim = exp(-abs(az - 0.22) * 14.0) * smoothstep(h0 - 0.028, h0, dir.y);
                  }
                  let bCol: vec3f = mix(vec3f(0.13, 0.09, 0.09) * (0.6 + 0.55 * slopeL), vec3f(2.4, 0.58, 0.08), lavaRim * 0.92);
                  let baseFade: f32 = smoothstep(floorY - 0.068, floorY + 0.022, dir.y);
                  let ashMist: vec3f = mix(U.skyHor.rgb * 0.85, vec3f(1.05, 0.36, 0.14), 0.20 + pow(sDot, 5.0) * 0.28);
                  let bodyC: vec3f = mix(ashMist, bCol, baseFade);
                  let finalC: vec3f = mix(bodyC, ashMist, mix(0.46, 0.14, fl / 2.0));
                  col = mix(col, finalC, 1.0 - smoothstep(h0 - 0.005, h0, dir.y));
                }
              }
              if (dir.y < 0.015) {
                let ashHaze: f32 = smoothstep(-0.075, 0.015, dir.y);
                let ashCol: vec3f = mix(U.skyHor.rgb * 0.85, vec3f(1.05, 0.36, 0.14), 0.20 + pow(sDot, 5.0) * 0.28);
                col = mix(ashCol, col, ashHaze * 0.65);
              }
            } else {
              // Hillside Town: hazy Mediterranean coastal headlands + perspective-projected gleaming turquoise ocean!
              let eps: f32 = 0.024;
              for (var lyr: i32 = 0; lyr < 3; lyr = lyr + 1) {
                let fl: f32 = f32(lyr);
                let r0: f32 = fbm3(vec2f(az * (2.2 + fl * 1.4) + fl * 4.2, 1.9));
                let r1: f32 = fbm3(vec2f((az + eps) * (2.2 + fl * 1.4) + fl * 4.2, 1.9));
                let coastMask: f32 = smoothstep(-0.35 + fl * 0.12, 0.45, -az);
                let h0: f32 = (0.006 - fl * 0.012) + (0.065 - fl * 0.012) * r0 * coastMask;
                let h1: f32 = (0.006 - fl * 0.012) + (0.065 - fl * 0.012) * r1 * coastMask;
                if (dir.y < h0) {
                  let n2d: f32 = fbm3(vec2f(az * (2.8 + fl) + dir.y * 8.0, dir.y * 18.0));
                  let slopeL: f32 = vistaSlopeShade((h1 - h0) / eps, n2d, dir);
                  let hCol: vec3f = mix(vec3f(0.32, 0.28, 0.25) * (0.65 + 0.5 * slopeL), U.skyHor.rgb * 0.88, mix(0.68, 0.20, fl / 2.0));
                  col = mix(col, hCol, 1.0 - smoothstep(h0 - 0.004, h0, dir.y));
                }
              }
              if (dir.y < -0.002) {
                let seaElev: f32 = max(-dir.y, 0.018);
                let seaUV: vec2f = dir.xz / seaElev;
                let seaDepth: f32 = saturate(-dir.y * 4.5);
                let sunPath: f32 = pow(max(dot(normalize(vec3f(dir.x, 0.0, dir.z)), normalize(vec3f(U.sunDir.x, 0.0, U.sunDir.z))), 0.0), 32.0);
                let w1: f32 = vnoise(seaUV * vec2f(0.45, 0.90) + vec2f(t * 0.18, -t * 0.28));
                let w2: f32 = vnoise(seaUV * vec2f(1.35, 2.20) + vec2f(-t * 0.24, t * 0.14));
                let swell: f32 = w1 * 0.65 + w2 * 0.35;
                let glintMask: f32 = smoothstep(0.48, 0.86, swell);
                let horSeaMist: vec3f = mix(U.skyHor.rgb * 0.96, vec3f(0.45, 0.68, 0.84), 0.18 + pow(sDot, 5.0) * 0.22);
                var seaCol: vec3f = mix(horSeaMist, vec3f(0.05, 0.30, 0.48) * (0.86 + 0.28 * swell), pow(seaDepth, 0.46));
                seaCol = seaCol + U.sunCol.rgb * sunPath * (0.18 + 1.35 * glintMask) * (1.0 - seaDepth * 0.38);
                col = mix(col, seaCol, smoothstep(-0.002, -0.012, dir.y));
              }
            }

            // 4. Soft atmospheric horizon haze band
            let hz: f32 = exp(-abs(dir.y) * 11.5);
            col = mix(col, U.skyHor.rgb * 1.05, hz * 0.26);

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
