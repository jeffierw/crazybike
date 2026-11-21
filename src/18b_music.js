// ---------------------------------------------------------------- 18b_music: title-to-race seamless adaptive downhill score
// Plays an atmospheric filtered start-gate pulse on the Title Screen, then sweeps wide open into full punk-electro downhill drive on launch!
const Music = (() => {
  let ac = null, bus = null, busFilter = null, noiseBuf = null;
  let mode = 'title'; // 'title' | 'race' | 'pause' | 'off'
  let stepIdx = 0, acc = 0;

  // Driving downhill punk/electro riffs (MIDI notes) per mountain biome
  const RIFFS = [
    [40, 40, 43, 40, 45, 45, 43, 42, 40, 40, 47, 45, 43, 43, 42, 38], // Red Rock E minor rock
    [45, 45, 48, 45, 50, 50, 48, 47, 45, 45, 52, 50, 48, 47, 45, 43], // Pine Forest A minor
    [38, 38, 38, 41, 44, 44, 43, 41, 38, 38, 45, 44, 41, 40, 38, 37], // Volcano D Phrygian heavy
    [43, 43, 46, 48, 50, 50, 48, 46, 43, 43, 53, 50, 48, 46, 45, 43], // Town G coastal breakbeat
  ];
  // Warm pad chords for start-gate Title & Pause atmosphere
  const PADS = [
    [52, 59, 64, 67], // Em7 (Red Rock golden sunset)
    [57, 64, 69, 72], // Am7 (Alpine forest air)
    [50, 57, 62, 65], // Dm7 (Volcanic tension)
    [55, 62, 67, 71], // Gmaj7 (Coastal town warmth)
  ];
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  function trigKick(t, gainAmt = 0.34) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(145, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + 0.16);
  }

  function trigSnare(t, energy) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(215, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.08);
    g.gain.setValueAtTime(0.15 * energy, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    o.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + 0.11);

    if (noiseBuf) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.14 * energy, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      s.connect(f); f.connect(ng); ng.connect(busFilter);
      s.start(t, Math.random(), 0.11);
    }
  }

  function trigHat(t, amp) {
    if (!noiseBuf) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = ac.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    s.connect(f); f.connect(g); g.connect(busFilter);
    s.start(t, Math.random(), 0.045);
  }

  function trigBass(t, note, energy, dur = 0.14) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(note), t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(360 + energy * 1050, t);
    f.frequency.exponentialRampToValueAtTime(210, t + dur);
    g.gain.setValueAtTime(0.14 * (0.55 + 0.45 * energy), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.01);
    o.connect(f); f.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function trigPad(t, chord, dur = 1.8) {
    for (let i = 0; i < chord.length; i++) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = i % 2 === 0 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(mtof(chord[i]), t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.042, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(busFilter);
      o.start(t); o.stop(t + dur + 0.04);
    }
  }

  function trigLead(t, note) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(mtof(note + 24), t);
    g.gain.setValueAtTime(0.042, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + 0.13);
  }

  function applyModeFilter() {
    if (!ac || !busFilter || !bus) return;
    const now = ac.currentTime;
    if (mode === 'race') {
      busFilter.frequency.setTargetAtTime(14000, now, 0.18);
      bus.gain.setTargetAtTime(0.46, now, 0.16);
    } else if (mode === 'title') {
      busFilter.frequency.setTargetAtTime(860, now, 0.25);
      bus.gain.setTargetAtTime(0.36, now, 0.25);
    } else if (mode === 'pause') {
      busFilter.frequency.setTargetAtTime(520, now, 0.20);
      bus.gain.setTargetAtTime(0.24, now, 0.20);
    } else {
      bus.gain.setTargetAtTime(0.0, now, 0.18);
    }
  }

  return {
    init(audioCtx, outBus, mat) {
      ac = audioCtx;
      noiseBuf = mat ? mat.white : null;
      busFilter = ac.createBiquadFilter();
      busFilter.type = 'lowpass';
      busFilter.frequency.value = 900;
      busFilter.Q.value = 0.8;
      bus = ac.createGain();
      bus.gain.value = 0.36;
      busFilter.connect(bus);
      bus.connect(outBus);
      applyModeFilter();
    },

    setMode(next) {
      if (mode === next) return;
      mode = next;
      applyModeFilter();
    },

    // Backwards-compatible helper
    setPlaying(on) {
      Music.setMode(on ? 'race' : 'pause');
    },

    getMode: () => mode,

    step(dt, speedNorm = 0, adrenalineNorm = 0, biomeIdx = 0) {
      if (!ac || !busFilter || mode === 'off' || Sound.isMuted()) return;
      if (ac.state !== 'running') return;

      const isRace = mode === 'race';
      const energy = isRace ? sat(0.42 + speedNorm * 0.42 + adrenalineNorm * 0.34) : 0.25;
      const bpm = isRace ? (136 + speedNorm * 18) : 104;
      const stepDur = 60 / bpm / 4; // 16th note

      acc += dt;
      if (acc >= stepDur) {
        acc -= stepDur;
        if (acc > stepDur * 2) acc = 0;
        const t = ac.currentTime + 0.012;
        const s = stepIdx & 15;
        const bi = Math.abs(biomeIdx | 0) % RIFFS.length;
        const riff = RIFFS[bi];

        if (isRace) {
          if (s === 0 || s === 6 || s === 8 || (energy > 0.68 && s === 14)) trigKick(t, 0.34);
          if (s === 4 || s === 12) trigSnare(t, energy);
          if (s % 2 === 1) trigHat(t, 0.032 + energy * 0.025);
          if (s % 2 === 0 || energy > 0.62) trigBass(t, riff[s], energy, 0.14);
          if (s === 0) trigPad(t, PADS[bi], stepDur * 14);
          if (energy > 0.70 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) trigLead(t, riff[s]);
        } else {
          // Atmospheric Title / Pause start-gate groove: warm chord pad + deep subtle heartbeat pulse!
          if (s === 0) trigPad(t, PADS[bi], stepDur * 15);
          if (s === 0 || s === 8) trigKick(t, 0.18);
          if (s % 4 === 0 || s === 14) trigBass(t, riff[s], 0.22, 0.22);
          if (s % 4 === 2) trigHat(t, 0.024);
        }
        stepIdx++;
      }
    },
  };
})();
