// ---------------------------------------------------------------- 02_shaderlib: shared globals & SSL lighting/fog/noise functions
defineGlobals([
  ['viewProj', 'mat4x4f'],
  ['invViewProj', 'mat4x4f'],
  ['lightVP', 'mat4x4f'],
  ['camPos', 'vec4f'],     // xyz = camera world pos, w = time
  ['sunDir', 'vec4f'],     // xyz = dir TO sun (normalized), w = sun intensity
  ['sunCol', 'vec4f'],     // rgb = sun color, w = exposure
  ['skyZen', 'vec4f'],     // rgb = zenith color, w = fog density
  ['skyHor', 'vec4f'],     // rgb = horizon color, w = fog height scale
  ['groundCol', 'vec4f'],  // rgb = ambient ground bounce, w = biome index (0..3)
  ['feel', 'vec4f'],       // x = speedNorm, y = adrenaline, z = hitFlash, w = boostGlow
]);

const GBUF = new Float32Array(GLOBALS_SIZE);
function setGlobalMat(name, m) { GBUF.set(m, GOFF[name]); }
function setGlobalVec(name, x, y, z, w) {
  const o = GOFF[name];
  GBUF[o] = x; GBUF[o + 1] = y; GBUF[o + 2] = z; GBUF[o + 3] = w;
}

const SHADER_COMMON = `
fn hash21(p: vec2f) -> f32 {
  var q: vec2f = fract(p * vec2f(123.34, 456.21));
  q = q + dot(q, q + 45.32);
  return fract(q.x * q.y);
}
fn vnoise(p: vec2f) -> f32 {
  let i: vec2f = floor(p);
  let f: vec2f = fract(p);
  let u: vec2f = f * f * (3.0 - 2.0 * f);
  let a: f32 = hash21(i);
  let b: f32 = hash21(i + vec2f(1.0, 0.0));
  let c: f32 = hash21(i + vec2f(0.0, 1.0));
  let d: f32 = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn fbm3(p0: vec2f) -> f32 {
  var p: vec2f = p0;
  var s: f32 = 0.0;
  var a: f32 = 0.5;
  s = s + a * vnoise(p); p = p * 2.03 + vec2f(17.1, 31.7); a = a * 0.5;
  s = s + a * vnoise(p); p = p * 2.01 + vec2f(11.3, 47.2); a = a * 0.5;
  s = s + a * vnoise(p);
  return s / 0.875;
}
fn acesTone(x: vec3f) -> vec3f {
  let a: f32 = 2.51;
  let b: f32 = 0.03;
  let c: f32 = 2.43;
  let d: f32 = 0.59;
  let e: f32 = 0.14;
  return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}
fn applyFog(col: vec3f, worldPos: vec3f) -> vec3f {
  let toCam: vec3f = worldPos - U.camPos.xyz;
  let dist: f32 = length(toCam);
  let dir: vec3f = toCam / max(dist, 0.001);
  let dens: f32 = U.skyZen.w;
  let f: f32 = 1.0 - exp(-dist * dens);
  let sunAmt: f32 = max(dot(dir, U.sunDir.xyz), 0.0);
  let fogCol: vec3f = mix(U.skyHor.rgb, U.sunCol.rgb * 1.15, pow(sunAmt, 6.0) * 0.45);
  return mix(col, fogCol, saturate(f * 0.92));
}
fn litSurface(albedo: vec3f, nrm: vec3f, worldPos: vec3f, rough: f32, shadow: f32) -> vec3f {
  let n: vec3f = normalize(nrm);
  let l: vec3f = U.sunDir.xyz;
  let v: vec3f = normalize(U.camPos.xyz - worldPos);
  let ndl: f32 = max(dot(n, l), 0.0);
  let hemi: f32 = n.y * 0.5 + 0.5;
  let amb: vec3f = mix(U.groundCol.rgb, U.skyZen.rgb * 0.72 + U.skyHor.rgb * 0.28, hemi) * 0.62;
  let h: vec3f = normalize(l + v);
  let ndh: f32 = max(dot(n, h), 0.0);
  let specPow: f32 = mix(48.0, 6.0, rough);
  let spec: f32 = pow(ndh, specPow) * (1.0 - rough) * 0.55 * ndl * shadow;
  let rim: f32 = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.18 * (0.3 + 0.7 * max(dot(v, -l), 0.0));
  var c: vec3f = albedo * (amb + U.sunCol.rgb * U.sunDir.w * ndl * shadow) + U.sunCol.rgb * (spec + rim);
  c = applyFog(c, worldPos);
  return c;
}
`;

const SHADER_SHADOW = `
fn sampleShadow(worldPos: vec3f, nrm: vec3f) -> f32 {
  let lp: vec4f = U.lightVP * vec4f(worldPos + nrm * 0.18, 1.0);
  let ndc: vec3f = lp.xyz / lp.w;
  let uv: vec2f = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  if (uv.x < 0.01 || uv.x > 0.99 || uv.y < 0.01 || uv.y > 0.99 || ndc.z < 0.0 || ndc.z > 1.0) {
    return 1.0;
  }
  let refz: f32 = ndc.z - 0.0018;
  let texel: vec2f = vec2f(1.0 / 1024.0, 1.0 / 1024.0);
  var s: f32 = 0.0;
  s = s + texShadow(uShadow, uv + vec2f(-texel.x, -texel.y), refz);
  s = s + texShadow(uShadow, uv + vec2f( texel.x, -texel.y), refz);
  s = s + texShadow(uShadow, uv + vec2f(-texel.x,  texel.y), refz);
  s = s + texShadow(uShadow, uv + vec2f( texel.x,  texel.y), refz);
  return mix(0.28, 1.0, s * 0.25);
}
`;
