// ---------------------------------------------------------------- 18_sound: Web Audio synthesized downhill MTB acoustics
// Features Kellet stereo pink-noise binaural wind roar, mountain breeze, high-speed whistle, granular gravel tires & hub ratchet.
const Sound = (() => {
  if (typeof Variants !== 'undefined') {
    Variants.def('wind', '风燥强度', [['a', '柔和'], ['b', '标准'], ['c', '强风']], 'b');
  }

  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let muted = false, sfxVol = 0.78, musicVol = 0.62;
  let M = null;
  let rig = null;
  let ratchetAccum = 0;

  try {
    const saved = JSON.parse(localStorage.getItem('crazybike_audio_v2') || 'null');
    if (saved) {
      if (typeof saved.muted === 'boolean') muted = saved.muted;
      if (typeof saved.sfxVol === 'number') sfxVol = clamp(saved.sfxVol, 0, 1);
      if (typeof saved.musicVol === 'number') musicVol = clamp(saved.musicVol, 0, 1);
    }
  } catch (_) {}

  function savePrefs() {
    try { localStorage.setItem('crazybike_audio_v2', JSON.stringify({ muted, sfxVol, musicVol })); } catch (_) {}
  }

  function applyVolumes() {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : 0.72, now, 0.04);
    if (sfxBus) sfxBus.gain.setTargetAtTime(sfxVol, now, 0.04);
    if (musicBus) musicBus.gain.setTargetAtTime(musicVol, now, 0.04);
  }

  // Synthesize seamless stereo noise buffers once (Kellet pink noise, granular gravel sand, Gaussian white, gust LFO)
  function buildMaterial(ac) {
    const sr = ac.sampleRate, rnd = RNG(90210), out = {};
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
    const N3 = Math.round(sr * 3);

    // 1. Stereo white noise
    {
      const b = ac.createBuffer(2, N3, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < N3; i++) d[i] = gauss() * 0.24;
      }
      out.white = b;
    }

    // 2. Seamless 4s Stereo Kellet Pink Noise (warm natural wind!)
    {
      const n = Math.round(sr * 4), fade = Math.round(sr * 0.05);
      const b = ac.createBuffer(2, n, sr), x = new Float32Array(n + fade);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = -3000; i < n + fade; i++) {
          const w = gauss();
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          if (i >= 0) x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.058;
          b6 = w * 0.115926;
        }
        for (let i = 0; i < n; i++) {
          if (i < fade) {
            const k = (i / fade) * (PI * 0.5);
            d[i] = x[i] * Math.sin(k) + x[n + i] * Math.cos(k);
          } else d[i] = x[i];
        }
      }
      out.pink = b;
    }

    // 3. Granular gravel / dirt tire texture (pink noise modulated by uneven dirt bumps)
    {
      const b = ac.createBuffer(2, N3, sr), K = 210, nodes = new Float32Array(K + 1);
      for (let c = 0; c < 2; c++) {
        for (let k = 0; k < K; k++) nodes[k] = clamp(gauss(), -2, 2);
        nodes[K] = nodes[0];
        const d = b.getChannelData(c), src = out.pink.getChannelData(c), off = c ? 7919 : 9973;
        for (let i = 0; i < N3; i++) {
          const x = (i / N3) * K, k = Math.floor(x), f = x - k, u = f * f * (3 - 2 * f);
          d[i] = src[(i + off) % src.length] * 1.45 * Math.exp(0.28 * lerp(nodes[k], nodes[k + 1], u));
        }
      }
      out.sand = b;
    }

    // 4. Multi-octave stereo gust LFO buffer (independent ear buffeting!)
    {
      const n = 4096, b = ac.createBuffer(2, n, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        let amp = 1, tot = 0;
        for (let per = 128; per >= 4; per >>= 1) {
          const K = n / per, nodes = new Float32Array(K + 1);
          for (let k = 0; k < K; k++) nodes[k] = rnd() * 2 - 1;
          nodes[K] = nodes[0];
          for (let i = 0; i < n; i++) {
            const x = i / per, k = Math.floor(x), f = x - k, u = f * f * (3 - 2 * f);
            d[i] += amp * lerp(nodes[k], nodes[k + 1], u);
          }
          tot += amp * amp; amp *= 0.8;
        }
        const s = 1 / Math.sqrt(tot / 3);
        for (let i = 0; i < n; i++) d[i] *= s;
      }
      out.lfo = b;
    }

    return out;
  }

  function buildRig(ac) {
    const sr = ac.sampleRate;
    const gain = (v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };
    const biq = (type, f, Q = 0.707, dB = 0) => {
      const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.gain.value = dB; return b;
    };
    const loop = (buf, rate = 1, off = 0) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, off); return s;
    };
    const pan = () => ac.createStereoPanner ? ac.createStereoPanner() : gain(1);
    const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };

    // Master dynamics compressor + soft analog-style ceiling shaper
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.16;
    const ceil = ac.createWaveShaper();
    const cv = new Float32Array(1025);
    for (let i = 0; i < 1025; i++) {
      const x = ((i - 512) / 512) * 1.5, a = Math.abs(x);
      cv[i] = sign(x) * (a < 0.7 ? a : 0.7 + 0.29 * Math.tanh((a - 0.7) / 0.29));
    }
    ceil.curve = cv;
    master = gain(muted ? 0 : 0.72);
    sfxBus = gain(sfxVol);
    musicBus = gain(musicVol);
    sfxBus.connect(comp);
    musicBus.connect(comp);
    chain(comp, master, ceil, ac.destination);

    // ---- 1. Binaural Helmet Wind Roar Rig (Kellet pink noise + independent L/R ear buffeting!) ----
    const pink = loop(M.pink, 1, 0.2);
    const white = loop(M.white, 1, 0.4);
    const wHP = biq('highpass', 42, 0.7);
    const wSh = biq('highshelf', 230, 0.7, -7);
    const wL1 = biq('lowpass', 260, 0.65);
    const wL2 = biq('lowpass', 320, 0.95);
    const wSp = ac.createChannelSplitter(2), wMg = ac.createChannelMerger(2);
    const wEar = [gain(1), gain(1)];
    const wLfo = loop(M.lfo, 150 / sr);
    const wLs = ac.createChannelSplitter(2);
    const wDep = [gain(0.28), gain(0.28)];
    const wG = gain(0), wBal = pan();
    chain(pink, wHP, wSh, wL1, wL2, wSp);
    wLfo.connect(wLs);
    for (let c = 0; c < 2; c++) {
      wSp.connect(wEar[c], c);
      wLs.connect(wDep[c], c);
      wDep[c].connect(wEar[c].gain);
      wEar[c].connect(wMg, 0, c);
    }
    chain(wMg, wG, wBal, sfxBus);

    // Slow gust modulation on overall wind level
    const wGust = loop(M.lfo, 12 / sr, 1200), wGd = gain(0.08);
    chain(wGust, wGd); wGd.connect(wG.gain);

    // Mountain ridge ambient breeze (heard gently even while poised at the start gate!)
    const mBP = biq('bandpass', 580, 0.55), mLP = biq('lowpass', 2200, 0.6), mG = gain(0.03), mMod = gain(1);
    const mLfo = loop(M.lfo, 7 / sr, 2400), mD = gain(0.38);
    chain(pink, mBP, mLP, mMod, mG, sfxBus);
    chain(mLfo, mD); mD.connect(mMod.gain);

    // High-speed aerodynamic helmet/spoke whistle (Q=18 bandpass singing above 75 km/h & in big air!)
    const hBP = biq('bandpass', 920, 18), hG = gain(0);
    const hLfo = loop(M.lfo, 5 / sr, 700), hD = gain(65);
    chain(white, hBP, hG, sfxBus);
    chain(hLfo, hD); hD.connect(hBP.frequency);

    // ---- 2. Granular Gravel/Dirt Tire Roll + Stereo Skid Screech ----
    const sand = loop(M.sand, 1, 0.1);
    const tBP = biq('bandpass', 520, 0.85), tLP = biq('lowpass', 3200, 0.7), tG = gain(0);
    chain(sand, tBP, tLP, tG, sfxBus);

    const skBP = biq('bandpass', 1650, 1.3), skPk = biq('peaking', 2600, 1.6, 5), skG = gain(0), skPan = pan();
    chain(sand, skBP, skPk, skG, skPan, sfxBus);

    // ---- 3. Adrenaline Overdrive Turbine Hum ----
    const bOsc = ac.createOscillator();
    bOsc.type = 'sawtooth'; bOsc.frequency.value = 92;
    const bLP = biq('lowpass', 280, 1.1), bG = gain(0);
    chain(bOsc, bLP, bG, sfxBus);
    bOsc.start();

    return {
      wSh, wL1, wL2, wG, wGd, wBal, wDep, wLfo,
      mG, hBP, hG,
      tBP, tLP, tG, skBP, skG, skPan,
      bOsc, bG, sr,
    };
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try {
      ctx = new AC();
      M = buildMaterial(ctx);
      rig = buildRig(ctx);
      if (typeof Music !== 'undefined' && Music.init) Music.init(ctx, musicBus, M);
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // Register passive first-gesture unlock so Title Screen music & mountain breeze start on first interaction!
  function bindAutoUnlock() {
    if (typeof window === 'undefined' || Sound._bound) return;
    Sound._bound = true;
    const wake = () => {
      unlock();
      if (ctx && ctx.state === 'running') {
        window.removeEventListener('pointerdown', wake, true);
        window.removeEventListener('keydown', wake, true);
      }
    };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    // Also attempt immediate unlock (succeeds automatically if user navigated with media engagement)
    unlock();
  }

  function clickRatchet(speedNorm) {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1850 + speedNorm * 720, now);
    o.frequency.exponentialRampToValueAtTime(520, now + 0.013);
    g.gain.setValueAtTime(0.048, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    o.connect(g); g.connect(sfxBus);
    o.start(now); o.stop(now + 0.017);
  }

  function playJump(power = 8) {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(135, now);
    o.frequency.exponentialRampToValueAtTime(340 + power * 13, now + 0.14);
    g.gain.setValueAtTime(0.20, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g); g.connect(sfxBus);
    o.start(now); o.stop(now + 0.18);
  }

  function playLand(impact = 8) {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    const k = clamp(impact / 15, 0.28, 1.25);
    // Hydraulic suspension thud
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(125, now);
    o.frequency.exponentialRampToValueAtTime(36, now + 0.17);
    g.gain.setValueAtTime(0.36 * k, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    o.connect(g); g.connect(sfxBus);
    o.start(now); o.stop(now + 0.21);

    // Gravel crunch spray
    const s = ctx.createBufferSource(); s.buffer = M.sand;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 780;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.26 * k, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    s.connect(f); f.connect(ng); ng.connect(sfxBus);
    s.start(now, Math.random(), 0.20);
  }

  function playHit(heavy = false) {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = heavy ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(heavy ? 185 : 245, now);
    o.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.22 : 0.12));
    g.gain.setValueAtTime(heavy ? 0.36 : 0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.24 : 0.14));
    o.connect(g); g.connect(sfxBus);
    o.start(now); o.stop(now + 0.25);

    const s = ctx.createBufferSource(); s.buffer = M.white;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = heavy ? 1700 : 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(heavy ? 0.32 : 0.20, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    s.connect(f); f.connect(ng); ng.connect(sfxBus);
    s.start(now, Math.random(), 0.16);
  }

  function playTrick(stage = 1) {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    // 1. Organic wet ink-brush / airy whip whoosh (zero retro electronic arpeggio beeps!)
    if (M && M.pink) {
      const s = ctx.createBufferSource(); s.buffer = M.pink;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(stage > 1 ? 520 : 380, now);
      f.frequency.exponentialRampToValueAtTime(stage > 1 ? 1480 : 1120, now + 0.11);
      f.frequency.exponentialRampToValueAtTime(420, now + 0.28);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(stage > 1 ? 0.24 : 0.20, now + 0.03);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      s.connect(f); f.connect(ng); ng.connect(sfxBus);
      s.start(now, Math.random(), 0.32);
    }
    // 2. Subtle warm muted Rhodes harmonic swell matching the lo-fi vibe!
    const notes = stage > 1 ? [329.63, 440.0, 493.88] : [293.66, 369.99];
    notes.forEach((freq, idx) => {
      const st = now + idx * 0.025;
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, st);
      lp.type = 'lowpass'; lp.frequency.value = 1100;
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(stage > 1 ? 0.075 : 0.055, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.42);
      o.connect(lp); lp.connect(g); g.connect(sfxBus);
      o.start(st); o.stop(st + 0.45);
    });
  }

  function playTakedown() {
    if (!ctx || !sfxBus || muted) return;
    playHit(true);
    const now = ctx.currentTime;
    [220, 277.18, 329.63, 440].forEach(freq => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, now + 0.03);
      g.gain.setValueAtTime(0.09, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      o.connect(g); g.connect(sfxBus);
      o.start(now + 0.03); o.stop(now + 0.38);
    });
  }

  function playCrash() {
    if (!ctx || !sfxBus || muted) return;
    playHit(true);
    const now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = M.sand;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1600, now); f.frequency.exponentialRampToValueAtTime(200, now + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(now, Math.random(), 0.62);
  }

  function playWhoosh() {
    if (!ctx || !sfxBus || muted) return;
    const now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = M.pink;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, now); f.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(now, Math.random(), 0.22);
  }

  // Update continuous binaural wind, mountain breeze, gravel tires, boost & freewheel ratchet!
  // mode: 'race' | 'title' | 'pause' | 'off'
  function update(R, dt, mode = 'race') {
    if (!ctx || !rig) return;
    const now = ctx.currentTime;
    const active = mode === true || mode === 'race';
    const ambientOnly = mode === 'title' || mode === 'pause';

    if (muted || (!active && !ambientOnly)) {
      rig.wG.gain.setTargetAtTime(0, now, 0.08);
      rig.mG.gain.setTargetAtTime(0, now, 0.08);
      rig.hG.gain.setTargetAtTime(0, now, 0.08);
      rig.tG.gain.setTargetAtTime(0, now, 0.08);
      rig.skG.gain.setTargetAtTime(0, now, 0.08);
      rig.bG.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const windPreset = (typeof Variants !== 'undefined' && Variants.val.wind === 'a') ? 0.65
      : (typeof Variants !== 'undefined' && Variants.val.wind === 'c') ? 1.45 : 1.05;

    // Gentle high-mountain ridge air audible on Title Start Gate & Pause!
    rig.mG.gain.setTargetAtTime((ambientOnly ? 0.055 : 0.032) * windPreset, now, 0.12);

    if (!active || !R || R.crashed) {
      rig.wG.gain.setTargetAtTime(0, now, 0.08);
      rig.hG.gain.setTargetAtTime(0, now, 0.08);
      rig.tG.gain.setTargetAtTime(0, now, 0.08);
      rig.skG.gain.setTargetAtTime(0, now, 0.08);
      rig.bG.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const spd = R.speed || 0;
    const spdN = sat(spd / 35);
    const airBoost = R.air ? 0.28 : 0;
    const boostAdd = R.boosting ? 0.22 : 0;
    const wLevel = sat(spdN * 0.92 + airBoost + boostAdd);

    // 1. Binaural Pink-Noise Wind Roar (deep rumble + opening high shelf + faster ear buffeting at 120km/h!)
    rig.wL1.frequency.setTargetAtTime(190 + wLevel * 1250, now, 0.05);
    rig.wL2.frequency.setTargetAtTime(240 + wLevel * 1680, now, 0.05);
    rig.wSh.gain.setTargetAtTime(lerp(-9, 3.5, wLevel), now, 0.06);
    rig.wG.gain.setTargetAtTime((0.02 + Math.pow(wLevel, 1.55) * 0.58) * windPreset, now, 0.05);
    rig.wGd.gain.setTargetAtTime((0.03 + wLevel * 0.14) * windPreset, now, 0.08);
    rig.wLfo.playbackRate.setTargetAtTime((110 + spd * 7.5) / rig.sr, now, 0.08);
    const earDepth = 0.22 + wLevel * 0.28;
    rig.wDep[0].gain.setTargetAtTime(earDepth, now, 0.08);
    rig.wDep[1].gain.setTargetAtTime(earDepth, now, 0.08);
    if (rig.wBal.pan) rig.wBal.pan.setTargetAtTime(clamp(-(R.steer || 0) * 0.25, -0.35, 0.35), now, 0.08);

    // 2. Aerodynamic helmet/spoke wind whistle (>70 km/h or big air!)
    const wh = smooth(0.46, 1.0, spdN + (R.air ? 0.22 : 0));
    rig.hBP.frequency.setTargetAtTime(760 + spdN * 1150 + (R.air ? 280 : 0), now, 0.06);
    rig.hG.gain.setTargetAtTime(wh * wh * 0.055 * windPreset, now, 0.06);

    // 3. Granular tire-on-dirt roll & stereo gravel skid screech
    const onG = R.air ? 0 : 1;
    rig.tBP.frequency.setTargetAtTime(340 + spdN * 880, now, 0.05);
    rig.tLP.frequency.setTargetAtTime(1600 + spdN * 3600, now, 0.05);
    rig.tG.gain.setTargetAtTime(onG * (0.04 + spdN * 0.18), now, 0.04);

    const sk = onG * (R.skid || 0);
    rig.skBP.frequency.setTargetAtTime(1400 + spdN * 950, now, 0.04);
    rig.skG.gain.setTargetAtTime(sk * 0.28, now, 0.04);
    if (rig.skPan.pan) rig.skPan.pan.setTargetAtTime(clamp((R.steer || 0) * 0.55, -0.6, 0.6), now, 0.05);

    // 4. Adrenaline boost turbine sub-hum
    rig.bOsc.frequency.setTargetAtTime(84 + spdN * 64, now, 0.05);
    rig.bG.gain.setTargetAtTime(R.boosting ? 0.12 : 0.0, now, 0.05);

    // 5. Freewheel hub ratchet clicking
    if (!R.air && spd > 6) {
      ratchetAccum += dt * (9 + spdN * 28);
      if (ratchetAccum >= 1) {
        ratchetAccum -= Math.floor(ratchetAccum);
        clickRatchet(spdN);
      }
    }
  }

  return {
    unlock,
    bindAutoUnlock,
    update,
    playJump,
    playLand,
    playHit,
    playTrick,
    playTakedown,
    playCrash,
    playWhoosh,
    toggleMute() {
      muted = !muted;
      applyVolumes();
      savePrefs();
      return muted;
    },
    setSfxVol(v) { sfxVol = clamp(+v, 0, 1); applyVolumes(); savePrefs(); },
    setMusicVol(v) { musicVol = clamp(+v, 0, 1); applyVolumes(); savePrefs(); },
    getPrefs: () => ({ muted, sfxVol, musicVol }),
    isMuted: () => muted,
  };
})();
