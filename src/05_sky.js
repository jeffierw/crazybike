// ---------------------------------------------------------------- 05_sky: 360-degree atmospheric sky dome, volumetric clouds & 4-biome panoramic vista horizon
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
          fn frag(v: VOut) -> FOut {
            let ndc: vec4f = vec4f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0, 1.0, 1.0);
            let wp: vec4f = U.invViewProj * ndc;
            let dir: vec3f = normalize(wp.xyz / wp.w - U.camPos.xyz);
            let biome: f32 = U.groundCol.w;
            let az: f32 = atan2(dir.x, -dir.z);
            let t: f32 = U.camPos.w;

            // 1. Rich Rayleigh + golden Mie sky gradient
            let up: f32 = saturate(dir.y * 1.45 + 0.08);
            var col: vec3f = mix(U.skyHor.rgb, U.skyZen.rgb, pow(up, 0.56));

            let sDot: f32 = max(dot(dir, U.sunDir.xyz), 0.0);
            let halo: f32 = pow(sDot, 6.0) * 0.42 + pow(sDot, 64.0) * 0.85;
            let disc: f32 = smoothstep(0.9982, 0.9994, sDot) * 4.5;
            col = col + U.sunCol.rgb * (halo + disc);

            // 2. Multi-layer sunlit clouds drifting overhead
            if (dir.y > 0.01) {
              let cuv1: vec2f = dir.xz / (dir.y + 0.16) * 1.15 + vec2f(t * 0.008, -t * 0.004);
              let cuv2: vec2f = dir.xz / (dir.y + 0.24) * 2.35 + vec2f(-t * 0.005, t * 0.007);
              let cl: f32 = smoothstep(0.44, 0.78, fbm3(cuv1) * 0.72 + fbm3(cuv2) * 0.28);
              let cShade: f32 = 0.52 + 0.48 * smoothstep(0.45, 0.85, fbm3(cuv1 + U.sunDir.xz * 0.12));
              let cLit: vec3f = mix(U.skyHor.rgb * 0.78, U.sunCol.rgb * 1.32, saturate(cShade * (0.35 + 0.65 * pow(sDot, 2.5))));
              col = mix(col, cLit, cl * smoothstep(0.01, 0.20, dir.y) * 0.62);
            }

            // 3. Biome-specific 360-degree panoramic mountain / mesa / caldera / coastal ocean vista!
            if (biome < 0.5) {
              // Red Rock Canyon: iconic flat-topped Moab sandstone mesas & layered buttes!
              let nFar: f32 = fbm3(vec2f(az * 2.4 + 1.1, 2.0));
              let mesaFar: f32 = 0.02 + 0.085 * smoothstep(0.32, 0.44, nFar) + 0.045 * smoothstep(0.58, 0.66, nFar);
              let nMid: f32 = fbm3(vec2f(az * 4.2 + 5.7, 4.1));
              let mesaMid: f32 = -0.025 + 0.065 * smoothstep(0.35, 0.46, nMid) + 0.03 * smoothstep(0.62, 0.70, nMid);
              if (dir.y < mesaFar) {
                let m1: vec3f = mix(U.skyHor.rgb * 0.72, vec3f(0.68, 0.30, 0.17), 0.52);
                col = mix(col, m1, 1.0 - smoothstep(mesaFar - 0.007, mesaFar, dir.y));
              }
              if (dir.y < mesaMid) {
                let strata: f32 = 0.88 + 0.16 * sin(dir.y * 160.0 + nMid * 4.0);
                let m2: vec3f = mix(U.skyHor.rgb * 0.46, vec3f(0.54, 0.21, 0.11) * strata, 0.74);
                col = mix(col, m2, 1.0 - smoothstep(mesaMid - 0.006, mesaMid, dir.y));
              }
            } else if (biome < 1.5) {
              // Pine Forest: towering snow-dusted jagged alpine peaks + misty pine valleys!
              let pk1: f32 = 1.0 - abs(fbm3(vec2f(az * 2.8 + 0.8, 1.5)) * 2.0 - 1.0);
              let rFar: f32 = 0.03 + 0.135 * pk1 * pk1;
              let rMid: f32 = -0.02 + 0.065 * fbm3(vec2f(az * 5.2 + 3.4, 2.9));
              if (dir.y < rFar) {
                let snowCap: f32 = smoothstep(rFar - 0.038, rFar - 0.012, dir.y);
                let rockC: vec3f = mix(U.skyHor.rgb * 0.62, vec3f(0.24, 0.32, 0.42), 0.62);
                let peakC: vec3f = mix(rockC, vec3f(0.95, 0.97, 1.0) * U.sunCol.rgb * 0.9, snowCap * 0.85);
                col = mix(col, peakC, 1.0 - smoothstep(rFar - 0.006, rFar, dir.y));
              }
              if (dir.y < rMid) {
                let pineC: vec3f = mix(U.skyHor.rgb * 0.48, vec3f(0.11, 0.24, 0.16), 0.76);
                col = mix(col, pineC, 1.0 - smoothstep(rMid - 0.006, rMid, dir.y));
              }
            } else if (biome < 2.5) {
              // Volcanic Ridge: massive smoking caldera volcano + glowing magma rim + drifting ash plume!
              let dAz: f32 = abs(az - 0.24);
              let cone: f32 = max(0.0, 0.175 - dAz * 0.32) - smoothstep(0.0, 0.08, 0.08 - dAz) * 0.032;
              let ridge: f32 = 0.01 + 0.068 * fbm3(vec2f(az * 3.6 + 2.2, 1.7)) + cone;
              // Billowing ash plume rising above the caldera
              if (dAz < 0.42 && dir.y > 0.06 && dir.y < 0.46) {
                let plN: f32 = fbm3(vec2f(az * 9.0 + dir.y * 2.5, dir.y * 8.0 - t * 0.08));
                let plMask: f32 = (1.0 - smoothstep(0.05, 0.38, abs(az - 0.24 - (dir.y - 0.12) * 0.45))) * smoothstep(0.36, 0.72, plN);
                let plCol: vec3f = mix(vec3f(0.14, 0.10, 0.11), vec3f(1.25, 0.38, 0.10), exp(-(dir.y - 0.10) * 8.0) * 0.7);
                col = mix(col, plCol, saturate(plMask * 0.72));
              }
              if (dir.y < ridge) {
                let lavaRim: f32 = exp(-abs(az - 0.24) * 14.0) * smoothstep(ridge - 0.025, ridge, dir.y);
                let vCol: vec3f = mix(vec3f(0.16, 0.08, 0.08), vec3f(2.4, 0.55, 0.08), lavaRim * 0.9);
                col = mix(col, vCol, 1.0 - smoothstep(ridge - 0.006, ridge, dir.y));
              }
            } else {
              // Hillside Town: gleaming Mediterranean / Pacific ocean horizon + headland + distant suspension bridge!
              let rCoast: f32 = 0.01 + 0.055 * fbm3(vec2f(az * 3.1 + 4.4, 1.9)) * smoothstep(-0.2, 0.5, -az);
              if (dir.y < rCoast) {
                let hCol: vec3f = mix(U.skyHor.rgb * 0.58, vec3f(0.38, 0.32, 0.36), 0.55);
                col = mix(col, hCol, 1.0 - smoothstep(rCoast - 0.005, rCoast, dir.y));
              }
              if (dir.y < -0.004) {
                // Sparkling ocean surface below horizon!
                let seaDepth: f32 = saturate(-dir.y * 5.0);
                let sunPath: f32 = pow(max(dot(normalize(vec3f(dir.x, 0.0, dir.z)), normalize(vec3f(U.sunDir.x, 0.0, U.sunDir.z))), 0.0), 32.0);
                let shimmer: f32 = 0.75 + 0.25 * sin(az * 80.0 + t * 3.5 + dir.y * 120.0);
                var seaCol: vec3f = mix(U.skyHor.rgb * 0.85, vec3f(0.06, 0.28, 0.48), pow(seaDepth, 0.45));
                seaCol = seaCol + U.sunCol.rgb * sunPath * shimmer * 1.15 * (1.0 - seaDepth * 0.5);
                col = mix(col, seaCol, smoothstep(-0.004, -0.014, dir.y));
              }
            }

            // 4. Soft atmospheric horizon haze band
            let hz: f32 = exp(-abs(dir.y) * 10.5);
            col = mix(col, U.skyHor.rgb * 1.06, hz * 0.30);

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
