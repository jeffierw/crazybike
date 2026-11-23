// ---------------------------------------------------------------- 00c_quality: memory-aware adaptive quality detector & visual feature scaler
const Quality = (() => {
  const STORE_KEY = 'crazybike_quality';

  const TIERS = {
    low: {
      id: 'low', zh: '低画质', en: 'Low',
      dprCap: 0.90, shadowSize: 512, bloom: 0.0, sunGlare: 0.0,
      particleMul: 0.42, ambientMotes: false, ambientRate: 0,
      waterfallMist: false, waterfallProb: 0, farDist: 185, detailStep: 28, wildlife: 1,
    },
    balanced: {
      id: 'balanced', zh: '均衡', en: 'Balanced',
      dprCap: 1.25, shadowSize: 1024, bloom: 0.42, sunGlare: 0.48,
      particleMul: 0.78, ambientMotes: true, ambientRate: 14,
      waterfallMist: true, waterfallProb: 0.55, farDist: 235, detailStep: 18, wildlife: 2,
    },
    high: {
      id: 'high', zh: '高画质', en: 'High',
      dprCap: 2.0, shadowSize: 2048, bloom: 1.0, sunGlare: 1.0,
      particleMul: 1.35, ambientMotes: true, ambientRate: 36,
      waterfallMist: true, waterfallProb: 1.0, farDist: 290, detailStep: 11, wildlife: 3,
    },
  };

  let cachedGpu = null;
  function detectGpu() {
    if (cachedGpu !== null) return cachedGpu;
    cachedGpu = '';
    try {
      if (typeof document === 'undefined' || !document.createElement) return cachedGpu;
      const cv = document.createElement('canvas');
      if (!cv || !cv.getContext) return cachedGpu;
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      if (!gl) return cachedGpu;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      if (raw) cachedGpu = String(raw);
    } catch (_) {}
    return cachedGpu;
  }

  function probeHardware(override = null) {
    let memGB = 0, cores = 0, isMobile = false;
    try {
      if (typeof navigator !== 'undefined') {
        if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0) memGB = navigator.deviceMemory;
        if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0) cores = navigator.hardwareConcurrency;
        if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '')) isMobile = true;
      }
      if (!isMobile && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
        const w = typeof innerWidth === 'number' ? innerWidth : 1280;
        const h = typeof innerHeight === 'number' ? innerHeight : 720;
        if (Math.min(w, h) < 768) isMobile = true;
      }
    } catch (_) {}

    const base = { memGB, cores, isMobile, gpu: detectGpu() };
    if (override && typeof override === 'object') {
      if (override.memGB !== undefined) base.memGB = +override.memGB || 0;
      if (override.cores !== undefined) base.cores = +override.cores || 0;
      if (override.isMobile !== undefined) base.isMobile = !!override.isMobile;
      if (override.gpu !== undefined) base.gpu = String(override.gpu || '');
    }
    return base;
  }

  function resolveAuto(hw) {
    if (/swiftshader|llvmpipe|software|mali-4|adreno.*(3\d\d|4\d\d|50\d)/i.test(hw.gpu || '')) return 'low';
    if (hw.memGB > 0 && hw.memGB <= 2) return 'low';
    if (hw.memGB > 0 && hw.memGB <= 4) return 'balanced';
    if (hw.isMobile && !(hw.memGB >= 8)) return 'balanced';
    if (hw.memGB === 0) return (hw.cores >= 6 && !hw.isMobile) ? 'high' : 'balanced';
    return 'high';
  }

  function normalizePick(q) {
    if (q === 'smooth' || q === '2' || q === 2) return 'low';
    if (q === 'balanced' || q === '1' || q === 1) return 'balanced';
    if (q === 'high' || q === '0' || q === 0) return 'high';
    if (q === 'low') return 'low';
    if (q === 'auto') return 'auto';
    return null;
  }

  let pick = 'auto';
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    const norm = normalizePick(raw);
    if (norm) pick = norm;
  } catch (_) {}
  try {
    const m = typeof location !== 'undefined' ? /[?&]quality=([a-z0-9]+)/i.exec(location.search || '') : null;
    if (m) {
      const norm = normalizePick(m[1].toLowerCase());
      if (norm) pick = norm;
    }
  } catch (_) {}

  let hw = probeHardware();
  let tier = pick === 'auto' ? resolveAuto(hw) : pick;
  const listeners = [];

  function resolveTier(override) {
    if (!override || override === 'auto') return pick === 'auto' ? resolveAuto(hw) : (override === 'auto' ? resolveAuto(hw) : tier);
    const norm = normalizePick(override);
    return (!norm || norm === 'auto') ? resolveAuto(hw) : norm;
  }

  function cfg(override) {
    const id = override ? resolveTier(override) : tier;
    return TIERS[id] || TIERS.high;
  }

  function select(next) {
    const norm = normalizePick(next);
    if (!norm) return tier;
    pick = norm;
    hw = probeHardware();
    tier = pick === 'auto' ? resolveAuto(hw) : pick;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORE_KEY, pick); } catch (_) {}
    for (const fn of listeners) { try { fn(tier, pick, cfg()); } catch (_) {} }
    return tier;
  }

  function detect(overrideHw = null) {
    if (overrideHw) return resolveAuto(probeHardware(overrideHw));
    hw = probeHardware();
    if (pick === 'auto') tier = resolveAuto(hw);
    return tier;
  }

  function describe(lang = 'zh', overrideHw = null) {
    const curHw = overrideHw ? probeHardware(overrideHw) : hw;
    const curTier = overrideHw ? resolveAuto(curHw) : tier;
    const c = TIERS[curTier] || TIERS.high;
    const isEn = lang === 'en';
    const memPart = curHw.memGB > 0
      ? (isEn ? `RAM ${curHw.memGB} GB` : `内存 ${curHw.memGB} GB`)
      : (curHw.cores > 0 ? (isEn ? `${curHw.cores} Cores` : `${curHw.cores}核设备`) : (isEn ? 'Auto Spec' : '标准设备'));
    const modePart = (pick === 'auto' || overrideHw)
      ? (isEn ? `Auto→${c.en}` : `自动→${c.zh}`)
      : (isEn ? c.en : c.zh);
    if (isEn) {
      return `${memPart} · ${modePart} · ${c.shadowSize}px Shadow · ${c.bloom > 0 ? 'Bloom' : 'No Bloom'} · ${c.waterfallMist ? 'Mist+Motes' : 'Lite FX'} · ${c.farDist}m Draw · ${c.wildlife} Wildlife`;
    }
    return `${memPart} · ${modePart} · ${c.shadowSize}px阴影 · ${c.bloom > 0 ? '日光辉光' : '关闭辉光'} · ${c.waterfallMist ? '瀑布水雾' : '精简粒子'} · ${c.farDist}m视距 · ${c.wildlife}只动物`;
  }

  return {
    TIERS,
    get pick() { return pick; },
    get tier() { return tier; },
    get hw() { return hw; },
    get memGB() { return hw.memGB; },
    normalizePick,
    cfg,
    select,
    detect,
    describe,
    onChange(fn) { listeners.push(fn); },
    info: () => ({ pick, tier, memGB: hw.memGB, cores: hw.cores, gpu: hw.gpu, isMobile: hw.isMobile, cfg: cfg() }),
  };
})();
