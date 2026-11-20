// ---------------------------------------------------------------- 05_sky: stylized atmospheric sky dome, sun corona, clouds & distant silhouette ridges
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

            let up: f32 = saturate(dir.y * 1.45 + 0.08);
            var col: vec3f = mix(U.skyHor.rgb, U.skyZen.rgb, pow(up, 0.58));

            // Sun disc + wide golden Mie halo
            let sDot: f32 = max(dot(dir, U.sunDir.xyz), 0.0);
            let halo: f32 = pow(sDot, 8.0) * 0.45 + pow(sDot, 96.0) * 0.85;
            let disc: f32 = smoothstep(0.9985, 0.9994, sDot) * 4.0;
            col = col + U.sunCol.rgb * (halo + disc);

            // Stylized sunlit clouds in upper hemisphere
            if (dir.y > 0.02) {
              let cuv: vec2f = dir.xz / (dir.y + 0.16) * 1.15 + vec2f(U.camPos.w * 0.008, -U.camPos.w * 0.004);
              let cl: f32 = smoothstep(0.48, 0.78, fbm3(cuv));
              let cLit: vec3f = mix(U.skyHor.rgb * 0.95, U.sunCol.rgb * 1.25, 0.35 + 0.65 * pow(sDot, 3.0));
              col = mix(col, cLit, cl * smoothstep(0.02, 0.22, dir.y) * 0.55);
            }

            // Distant layered mountain horizon silhouette
            let az: f32 = atan2(dir.x, -dir.z);
            let r1: f32 = 0.03 + 0.055 * fbm3(vec2f(az * 2.6 + U.groundCol.w * 3.1, 1.3));
            let r2: f32 = -0.02 + 0.040 * fbm3(vec2f(az * 4.8 + U.groundCol.w * 7.7, 4.2));
            if (dir.y < r1) {
              let mCol1: vec3f = mix(U.skyHor.rgb * 0.62, U.groundCol.rgb * 0.95, 0.45);
              col = mix(col, mCol1, 1.0 - smoothstep(r1 - 0.012, r1, dir.y));
            }
            if (dir.y < r2) {
              let mCol2: vec3f = mix(U.skyHor.rgb * 0.44, U.groundCol.rgb * 0.78, 0.65);
              col = mix(col, mCol2, 1.0 - smoothstep(r2 - 0.010, r2, dir.y));
            }

            // Subtle horizon haze glow & volcanic ember tint
            let hz: f32 = exp(-abs(dir.y) * 9.0);
            col = mix(col, U.skyHor.rgb * 1.08, hz * 0.35);

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
