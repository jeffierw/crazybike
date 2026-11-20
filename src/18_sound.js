// ---------------------------------------------------------------- 18_sound: 100% Web Audio synthesized downhill MTB SFX
const Sound = (() => {
  let ctx = null, master = null, muted = false;
  let windGain = null, windFilter = null;
  let tireGain = null, tireFilter = null;
  let boostGain = null, boostOsc = null;
  let noiseBuf = null;
  let ratchetAccum = 0;

  function makeNoiseBuffer(ac) {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.65;
      master.connect(ctx.destination);
      noiseBuf = makeNoiseBuffer(ctx);

      // Continuous wind rush loop
      const wSrc = ctx.createBufferSource();
      wSrc.buffer = noiseBuf; wSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass'; windFilter.frequency.value = 320; windFilter.Q.value = 0.85;
      windGain = ctx.createGain(); windGain.gain.value = 0.0;
      wSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
      wSrc.start();

      // Continuous tire-on-dirt / drift gravel noise
      const tSrc = ctx.createBufferSource();
      tSrc.buffer = noiseBuf; tSrc.loop = true;
      tireFilter = ctx.createBiquadFilter();
      tireFilter.type = 'bandpass'; tireFilter.frequency.value = 900; tireFilter.Q.value = 1.4;
      tireGain = ctx.createGain(); tireGain.gain.value = 0.0;
      tSrc.connect(tireFilter); tireFilter.connect(tireGain); tireGain.connect(master);
      tSrc.start();

      // Adrenaline overdrive sub-hum
      boostOsc = ctx.createOscillator();
      boostOsc.type = 'sawtooth'; boostOsc.frequency.value = 92;
      const bFlt = ctx.createBiquadFilter(); bFlt.type = 'lowpass'; bFlt.frequency.value = 260;
      boostGain = ctx.createGain(); boostGain.gain.value = 0.0;
      boostOsc.connect(bFlt); bFlt.connect(boostGain); boostGain.connect(master);
      boostOsc.start();

      if (typeof Music !== 'undefined' && Music.init) Music.init(ctx, master);
      return true;
    } catch (e) { return false; }
  }

  function clickRatchet(speedNorm) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1750 + speedNorm * 650, now);
    o.frequency.exponentialRampToValueAtTime(520, now + 0.014);
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + 0.018);
  }

  function playJump(power = 8) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(340 + power * 12, now + 0.14);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + 0.18);
  }

  function playLand(impact = 8) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const k = clamp(impact / 16, 0.25, 1.2);
    // Suspension low thud
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, now);
    o.frequency.exponentialRampToValueAtTime(36, now + 0.16);
    g.gain.setValueAtTime(0.32 * k, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + 0.2);

    // Dirt crunch burst
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 620;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * k, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    s.connect(f); f.connect(ng); ng.connect(master);
    s.start(now, Math.random(), 0.16);
  }

  function playHit(heavy = false) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = heavy ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(heavy ? 180 : 240, now);
    o.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.22 : 0.12));
    g.gain.setValueAtTime(heavy ? 0.36 : 0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.24 : 0.14));
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + 0.25);

    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = heavy ? 1600 : 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(heavy ? 0.30 : 0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    s.connect(f); f.connect(ng); ng.connect(master);
    s.start(now, Math.random(), 0.16);
  }

  function playTrick(combo = 1) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const base = 440 * Math.pow(1.12246, Math.min(10, combo * 2));
    [1, 1.25, 1.5].forEach((mul, idx) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(base * mul, now + idx * 0.045);
      g.gain.setValueAtTime(0.16, now + idx * 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.22);
      o.connect(g); g.connect(master);
      o.start(now + idx * 0.045); o.stop(now + idx * 0.045 + 0.24);
    });
  }

  function playTakedown() {
    if (!ctx || muted) return;
    playHit(true);
    const now = ctx.currentTime;
    // Punchy arcade brass/power chord stab!
    [220, 277.18, 329.63, 440].forEach(freq => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, now + 0.03);
      g.gain.setValueAtTime(0.09, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      o.connect(g); g.connect(master);
      o.start(now + 0.03); o.stop(now + 0.38);
    });
  }

  function playCrash() {
    if (!ctx || muted) return;
    playHit(true);
    const now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, now); f.frequency.exponentialRampToValueAtTime(220, now + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.36, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(now, Math.random(), 0.6);
  }

  function playWhoosh() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(900, now); f.frequency.exponentialRampToValueAtTime(280, now + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(now, Math.random(), 0.2);
  }

  function update(R, dt, active = true) {
    if (!ctx || !windGain) return;
    const now = ctx.currentTime;
    if (!active || muted || R.crashed) {
      windGain.gain.setTargetAtTime(0, now, 0.08);
      tireGain.gain.setTargetAtTime(0, now, 0.08);
      boostGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const spdN = sat(R.speed / 34);
    windFilter.frequency.setTargetAtTime(240 + spdN * 980 + (R.air ? 260 : 0), now, 0.06);
    windGain.gain.setTargetAtTime(0.02 + spdN * spdN * 0.22, now, 0.06);

    const onG = R.air ? 0 : 1;
    tireFilter.frequency.setTargetAtTime(R.skid > 0 ? 1850 : (550 + spdN * 750), now, 0.05);
    tireGain.gain.setTargetAtTime(onG * (R.skid > 0 ? 0.24 : 0.07 * spdN), now, 0.05);

    boostOsc.frequency.setTargetAtTime(86 + spdN * 58, now, 0.06);
    boostGain.gain.setTargetAtTime(R.boosting ? 0.14 : 0.0, now, 0.06);

    // Iconic downhill MTB freewheel hub ratchet clicking when rolling fast!
    if (!R.air && R.speed > 7) {
      ratchetAccum += dt * (10 + spdN * 26);
      if (ratchetAccum >= 1) {
        ratchetAccum -= Math.floor(ratchetAccum);
        clickRatchet(spdN);
      }
    }
  }

  return {
    unlock,
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
      if (master) master.gain.value = muted ? 0 : 0.65;
      return muted;
    },
    isMuted: () => muted,
  };
})();
