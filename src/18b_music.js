// ---------------------------------------------------------------- 18b_music: adrenaline-reactive procedural punk-electro downhill groove
const Music = (() => {
  let ac = null, out = null, bus = null;
  let playing = false, stepIdx = 0, acc = 0;

  // Driving downhill punk/electro bass riffs (MIDI notes) per biome
  const RIFFS = [
    [40, 40, 43, 40, 45, 45, 43, 42, 40, 40, 47, 45, 43, 43, 42, 38], // Red Rock E minor rock
    [45, 45, 48, 45, 50, 50, 48, 47, 45, 45, 52, 50, 48, 47, 45, 43], // Pine Forest A minor
    [38, 38, 38, 41, 44, 44, 43, 41, 38, 38, 45, 44, 41, 40, 38, 37], // Volcano D Phrygian heavy
    [43, 43, 46, 48, 50, 50, 48, 46, 43, 43, 53, 50, 48, 46, 45, 43], // Town G funky breakbeat
  ];
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  function trigKick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.15);
  }

  function trigSnare(t, energy) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.08);
    g.gain.setValueAtTime(0.16 * energy, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.11);
  }

  function trigBass(t, note, energy) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(note), t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(380 + energy * 950, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.13);
    g.gain.setValueAtTime(0.13 * (0.65 + 0.35 * energy), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.15);
  }

  function trigLead(t, note) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(mtof(note + 24), t);
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.12);
  }

  return {
    init(audioCtx, masterGain) {
      ac = audioCtx;
      out = masterGain;
      bus = ac.createGain();
      bus.gain.value = 0.42;
      bus.connect(out);
    },

    setPlaying(on) { playing = !!on; },

    step(dt, speedNorm, adrenalineNorm, biomeIdx = 0) {
      if (!ac || !playing || Sound.isMuted()) return;
      const energy = sat(0.35 + speedNorm * 0.45 + adrenalineNorm * 0.35);
      const bpm = 136 + speedNorm * 18;
      const stepDur = 60 / bpm / 4; // 16th notes
      acc += dt;
      if (acc >= stepDur) {
        acc -= stepDur;
        const t = ac.currentTime + 0.01;
        const s = stepIdx & 15;
        const riff = RIFFS[biomeIdx % RIFFS.length];
        if (s === 0 || s === 6 || s === 8 || (energy > 0.7 && s === 14)) trigKick(t);
        if (s === 4 || s === 12) trigSnare(t, energy);
        if (s % 2 === 0 || energy > 0.65) trigBass(t, riff[s], energy);
        if (energy > 0.72 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) trigLead(t, riff[s]);
        stepIdx++;
      }
    },
  };
})();
