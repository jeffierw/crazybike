// ---------------------------------------------------------------- 09_post: V3 quality-tiered shadow resolution, sunlit atmospheric glare/bloom, speed radial blur & hit flash
const Post = (() => {
  let gfx = null, pipe = null;
  let sceneColor = null, sceneDepth = null, sceneTarget = null;
  let shadowTex = null, shadowTarget = null;
  let curW = 0, curH = 0, shadowSize = 1024;
  let bloomAmt = 0.72, sunGlareAmt = 0.75;

  function buildShadow(size) {
    if (!gfx) return;
    if (shadowTarget) gfx.destroyTarget(shadowTarget);
    if (shadowTex) gfx.destroyTexture(shadowTex);
    shadowSize = size;
    shadowTex = gfx.texture({ w: size, h: size, format: 'depth', filter: 'linear', wrap: 'clamp', compare: true });
    shadowTarget = gfx.target({ color: null, depth: shadowTex });
  }

  return {
    init(g) {
      gfx = g;
      buildShadow(1024);
      pipe = gfx.pipeline({
        name: 'post',
        colorFormat: 'canvas',
        depth: false,
        cull: 'none',
        varyings: { uv: 'vec2f' },
        uniforms: { uPost: 'vec4f' }, // x = bloomAmt, y = sunGlareAmt, z = invW, w = invH
        textures: { uScene: '2d' },
        lib: [SHADER_COMMON],
        vs: VS_FULLSCREEN,
        fs: `
          fn frag(v: VOut) -> FOut {
            let uv: vec2f = v.uv;
            let spd: f32 = saturate(U.feel.x);
            let boost: f32 = saturate(U.feel.w);
            let flash: f32 = saturate(U.feel.z);
            let bloomK: f32 = M.uPost.x;
            let glareK: f32 = M.uPost.y;

            let ctr: vec2f = uv - vec2f(0.5, 0.48);
            let dist: f32 = length(ctr);
            let edge: f32 = smoothstep(0.24, 0.72, dist);
            let blurAmt: f32 = (spd * 0.016 + boost * 0.022) * edge;

            var col: vec3f = tex(uScene, uv).rgb;
            if (blurAmt > 0.001) {
              let dir: vec2f = ctr / max(dist, 0.001);
              let c1: vec3f = tex(uScene, uv - dir * blurAmt * 0.45).rgb;
              let c2: vec3f = tex(uScene, uv - dir * blurAmt * 0.95).rgb;
              let c3: vec3f = tex(uScene, uv - dir * blurAmt * 1.45).rgb;
              col = (col + c1 + c2 + c3) * 0.25;
              let cr: f32 = tex(uScene, uv + dir * blurAmt * 0.28).r;
              let cb: f32 = tex(uScene, uv - dir * blurAmt * 0.28).b;
              col = mix(col, vec3f(cr, col.g, cb), saturate((spd + boost) * 0.40) * edge);
            }

            // Quality-tiered soft sunlit highlight bloom (Cold Smoke atmospheric sheen!)
            if (bloomK > 0.05) {
              let px: vec2f = vec2f(M.uPost.z, M.uPost.w) * 4.5;
              let b0: vec3f = tex(uScene, uv + vec2f( px.x,  px.y)).rgb;
              let b1: vec3f = tex(uScene, uv + vec2f(-px.x,  px.y)).rgb;
              let b2: vec3f = tex(uScene, uv + vec2f( px.x, -px.y)).rgb;
              let b3: vec3f = tex(uScene, uv + vec2f(-px.x, -px.y)).rgb;
              let avgB: vec3f = (b0 + b1 + b2 + b3) * 0.25;
              let lum: f32 = dot(avgB, vec3f(0.299, 0.587, 0.114));
              let hi: vec3f = max(avgB - vec3f(0.66), vec3f(0.0)) * smoothstep(0.62, 1.0, lum);
              col = col + hi * (0.48 * bloomK);
            }

            // Directional sunlit atmospheric glare when facing toward the mountain sun!
            if (glareK > 0.05) {
              let ndc: vec2f = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
              let pFar: vec4f = U.invViewProj * vec4f(ndc, 1.0, 1.0);
              let rayD: vec3f = normalize(pFar.xyz / pFar.w - U.camPos.xyz);
              let sDot: f32 = max(dot(rayD, U.sunDir.xyz), 0.0);
              let halo: f32 = pow(sDot, 8.0) * 0.22 + pow(sDot, 42.0) * 0.34;
              col = col + U.sunCol.rgb * halo * glareK;
            }

            // Subtle cinema vignette + grounded warm boost rim + impact hit flash
            let vig: f32 = 1.0 - edge * (0.18 + spd * 0.15);
            col = col * vig;
            col = col + U.sunCol.rgb * boost * edge * 0.24;
            col = mix(col, vec3f(1.0, 0.94, 0.85), flash * 0.35);

            var o: FOut;
            o.color = vec4f(saturate(col), 1.0);
            return o;
          }
        `,
      });
    },

    setQuality(q) {
      const wantShadow = q === 'high' ? 2048 : q === 'smooth' ? 512 : 1024;
      bloomAmt = q === 'high' ? 1.0 : q === 'balanced' ? 0.38 : q === 'smooth' ? 0.0 : 0.72;
      sunGlareAmt = q === 'high' ? 1.0 : q === 'balanced' ? 0.45 : q === 'smooth' ? 0.0 : 0.72;
      if (gfx && wantShadow !== shadowSize) buildShadow(wantShadow);
    },

    ensureSize(w, h) {
      w = Math.max(2, w | 0);
      h = Math.max(2, h | 0);
      if (w === curW && h === curH && sceneTarget) return;
      if (sceneTarget) gfx.destroyTarget(sceneTarget);
      if (sceneColor) gfx.destroyTexture(sceneColor);
      if (sceneDepth) gfx.destroyTexture(sceneDepth);
      curW = w; curH = h;
      sceneColor = gfx.texture({ w, h, format: 'rgba8', filter: 'linear', wrap: 'clamp' });
      sceneDepth = gfx.texture({ w, h, format: 'depth', filter: 'nearest', wrap: 'clamp' });
      sceneTarget = gfx.target({ color: sceneColor, depth: sceneDepth });
    },

    get sceneTarget() { return sceneTarget; },
    get shadowTarget() { return shadowTarget; },
    get shadowTex() { return shadowTex; },
    get shadowSize() { return shadowSize; },

    present() {
      gfx.beginPass(null, {});
      gfx.draw(pipe, {
        count: 3,
        u: { uPost: [bloomAmt, sunGlareAmt, 1 / Math.max(2, curW), 1 / Math.max(2, curH)] },
        tex: { uScene: sceneColor },
      });
      gfx.endPass();
    },
  };
})();
