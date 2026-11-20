// ---------------------------------------------------------------- 09_post: fullscreen present pass + speed radial blur, adrenaline glow & hit flash
const Post = (() => {
  let gfx = null, pipe = null;
  let sceneColor = null, sceneDepth = null, sceneTarget = null;
  let shadowTex = null, shadowTarget = null;
  let curW = 0, curH = 0;

  return {
    init(g) {
      gfx = g;
      shadowTex = gfx.texture({ w: 1024, h: 1024, format: 'depth', filter: 'linear', wrap: 'clamp', compare: true });
      shadowTarget = gfx.target({ color: null, depth: shadowTex });
      pipe = gfx.pipeline({
        name: 'post',
        colorFormat: 'canvas',
        depth: false,
        cull: 'none',
        varyings: { uv: 'vec2f' },
        textures: { uScene: '2d' },
        lib: [SHADER_COMMON],
        vs: VS_FULLSCREEN,
        fs: `
          fn frag(v: VOut) -> FOut {
            let uv: vec2f = v.uv;
            let spd: f32 = saturate(U.feel.x);
            let boost: f32 = saturate(U.feel.w);
            let flash: f32 = saturate(U.feel.z);

            let ctr: vec2f = uv - vec2f(0.5, 0.48);
            let dist: f32 = length(ctr);
            let edge: f32 = smoothstep(0.24, 0.72, dist);
            let blurAmt: f32 = (spd * 0.018 + boost * 0.024) * edge;

            var col: vec3f = tex(uScene, uv).rgb;
            if (blurAmt > 0.001) {
              let dir: vec2f = ctr / max(dist, 0.001);
              let c1: vec3f = tex(uScene, uv - dir * blurAmt * 0.45).rgb;
              let c2: vec3f = tex(uScene, uv - dir * blurAmt * 0.95).rgb;
              let c3: vec3f = tex(uScene, uv - dir * blurAmt * 1.45).rgb;
              col = (col + c1 + c2 + c3) * 0.25;
              // Subtle chromatic edge punch at high speed
              let cr: f32 = tex(uScene, uv + dir * blurAmt * 0.32).r;
              let cb: f32 = tex(uScene, uv - dir * blurAmt * 0.32).b;
              col = mix(col, vec3f(cr, col.g, cb), saturate((spd + boost) * 0.45) * edge);
            }

            // Arcade speed vignette + overdrive warm rim + impact hit flash
            let vig: f32 = 1.0 - edge * (0.20 + spd * 0.16);
            col = col * vig;
            col = col + vec3f(1.0, 0.42, 0.08) * boost * edge * 0.36;
            col = mix(col, vec3f(1.0, 0.94, 0.85), flash * 0.38);

            var o: FOut;
            o.color = vec4f(saturate(col), 1.0);
            return o;
          }
        `,
      });
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

    present() {
      gfx.beginPass(null, {});
      gfx.draw(pipe, { count: 3, tex: { uScene: sceneColor } });
      gfx.endPass();
    },
  };
})();
