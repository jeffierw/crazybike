// ---------------------------------------------------------------- 18b_music: V3 immersive warm Lo-Fi downhill score (Rhodes 9th chords, swung brushed boom-bap drums, warm sub-bass & vinyl warmth)
const Music = (() => {
  let ac = null, bus = null, busFilter = null, noiseBuf = null, pinkBuf = null;
  let mode = 'title'; // 'title' | 'race' | 'pause' | 'off'
  let stepIdx = 0, acc = 0;

  // 4-bar warm jazz/lo-fi chord progressions (MIDI notes) unique per biome!
  const PROGS = [
    // 0: Red Rock Canyon (golden sunset Em9 -> Cmaj9 -> Am9 -> Bm7)
    [[52, 55, 59, 62, 66], [48, 52, 55, 59, 62], [45, 48, 52, 55, 59], [47, 50, 54, 57, 61]],
    // 1: Pine Forest (misty alpine Am9 -> Fmaj9 -> Dm9 -> Em7)
    [[45, 48, 52, 55, 59], [53, 57, 60, 64, 67], [50, 53, 57, 60, 64], [52, 55, 59, 62, 67]],
    // 2: Volcanic Ridge (deep moody Dm9 -> Bbmaj7 -> Gm9 -> A7sus4)
    [[50, 53, 57, 60, 64], [46, 50, 53, 57, 60], [43, 46, 50, 53, 57], [45, 50, 52, 55, 62]],
    // 3: Hillside Town (breezy coastal Gmaj9 -> Em9 -> Cmaj9 -> D9sus4)
    [[55, 59, 62, 66, 69], [52, 55, 59, 62, 66], [48, 52, 55, 59, 62], [50, 55, 57, 60, 64]],
  ];

  // Subtle Rhodes top-line melodic intervals (index into active chord + octave)
  const PLUCK_PAT = [4, -1, -1, 3, -1, -1, 2, -1, -1, 4, -1, 2, -1, 3, -1, -1];
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  function trigKick(t, gainAmt = 0.28) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(106, t);
    o.frequency.exponentialRampToValueAtTime(41, t + 0.13);
    f.type = 'lowpass';
    f.frequency.value = 230;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gainAmt, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(f); f.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + 0.24);
  }

  // Dusty lo-fi brushed snare & woody rim click
  function trigBrushSnare(t, vel = 0.12) {
    const rim = ac.createOscillator(), rg = ac.createGain();
    rim.type = 'triangle';
    rim.frequency.setValueAtTime(340 + (Math.random() - 0.5) * 18, t);
    rim.frequency.exponentialRampToValueAtTime(155, t + 0.045);
    rg.gain.setValueAtTime(vel * 0.52, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    rim.connect(rg); rg.connect(busFilter);
    rim.start(t); rim.stop(t + 0.07);

    if (pinkBuf || noiseBuf) {
      const s = ac.createBufferSource(); s.buffer = pinkBuf || noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1650; f.Q.value = 0.9;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(vel, t + 0.006);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      s.connect(f); f.connect(ng); ng.connect(busFilter);
      s.start(t, Math.random(), 0.15);
    }
  }

  // Feathery swung shaker / brushed closed hi-hat
  function trigShaker(t, amp = 0.024) {
    if (!pinkBuf && !noiseBuf) return;
    const s = ac.createBufferSource(); s.buffer = pinkBuf || noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4600; f.Q.value = 1.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.048);
    s.connect(f); f.connect(g); g.connect(busFilter);
    s.start(t, Math.random(), 0.055);
  }

  // Subtle organic vinyl crackle pop
  function trigVinylDust(t) {
    if (!noiseBuf || Math.random() > 0.28) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2800 + Math.random() * 2400; f.Q.value = 2.4;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.010 + Math.random() * 0.010, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.012);
    s.connect(f); f.connect(g); g.connect(busFilter);
    s.start(t, Math.random(), 0.018);
  }

  // Round warm upright / sub bass (pure low-passed sine + gentle triangle warmth)
  function trigSubBass(t, note, dur = 0.55, amp = 0.14) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(mtof(note - 12), t);
    f.type = 'lowpass';
    f.frequency.value = 260;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.022);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // Vintage warm Rhodes electric-piano chord (gently rolled notes + tiny tape detune warmth!)
  function trigRhodes(t, chord, dur = 2.2, amp = 0.055) {
    for (let i = 0; i < chord.length; i++) {
      const st = t + i * 0.022; // soft human chord roll
      const drift = 1 + (Math.random() - 0.5) * 0.005; // analog tape warble warmth
      const freq = mtof(chord[i]) * drift;
      const o1 = ac.createOscillator(), o2 = ac.createOscillator();
      const lp = ac.createBiquadFilter(), g = ac.createGain(), g2 = ac.createGain();
      o1.type = 'sine'; o1.frequency.setValueAtTime(freq, st);
      o2.type = 'triangle'; o2.frequency.setValueAtTime(freq * 2.0, st); // soft Rhodes tine overtone
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1650, st);
      lp.frequency.exponentialRampToValueAtTime(620, st + dur * 0.85);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(amp, st + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);
      g2.gain.setValueAtTime(amp * 0.16, st);
      g2.gain.exponentialRampToValueAtTime(0.0005, st + 0.24);
      o1.connect(lp); o2.connect(g2); g2.connect(lp);
      lp.connect(g); g.connect(busFilter);
      o1.start(st); o1.stop(st + dur + 0.05);
      o2.start(st); o2.stop(st + 0.28);
    }
  }

  // Gentle muted Rhodes / warm electric guitar top-note accent
  function trigPluck(t, note, amp = 0.034) {
    const freq = mtof(note + 12) * (1 + (Math.random() - 0.5) * 0.004);
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
    o.connect(lp); lp.connect(g); g.connect(busFilter);
    o.start(t); o.stop(t + 0.55);
  }

  function applyModeFilter() {
    if (!ac || !busFilter || !bus) return;
    const now = ac.currentTime;
    if (mode === 'race') {
      busFilter.frequency.setTargetAtTime(2750, now, 0.24);
      bus.gain.setTargetAtTime(0.68, now, 0.22);
    } else if (mode === 'title') {
      busFilter.frequency.setTargetAtTime(1480, now, 0.30);
      bus.gain.setTargetAtTime(0.56, now, 0.28);
    } else if (mode === 'pause') {
      busFilter.frequency.setTargetAtTime(820, now, 0.22);
      bus.gain.setTargetAtTime(0.36, now, 0.22);
    } else {
      bus.gain.setTargetAtTime(0.0, now, 0.18);
    }
  }

  return {
    init(audioCtx, outBus, mat) {
      ac = audioCtx;
      noiseBuf = mat ? mat.white : null;
      pinkBuf = mat ? mat.pink : null;
      busFilter = ac.createBiquadFilter();
      busFilter.type = 'lowpass';
      busFilter.frequency.value = 1480;
      busFilter.Q.value = 0.65;
      bus = ac.createGain();
      bus.gain.value = 0.56;
      busFilter.connect(bus);
      bus.connect(outBus);
      applyModeFilter();
    },

    setMode(next) {
      if (mode === next) return;
      mode = next;
      applyModeFilter();
    },

    setPlaying(on) {
      Music.setMode(on ? 'race' : 'pause');
    },

    getMode: () => mode,

    step(dt, speedNorm = 0, adrenalineNorm = 0, biomeIdx = 0) {
      if (!ac || !busFilter || mode === 'off' || Sound.isMuted()) return;
      if (ac.state !== 'running') return;

      const isRace = mode === 'race';
      // Relaxed, immersive Lo-Fi tempo (84 BPM on Title/Pause, gently flowing 92..98 BPM while shredding downhill!)
      const bpm = isRace ? (91 + speedNorm * 7) : 84;
      const baseStep = 60 / bpm / 4; // 16th note
      // Subtle classic hip-hop swing on odd 16ths!
      const sNow = stepIdx & 15;
      const stepDur = baseStep * ((sNow & 1) ? 1.16 : 0.84);

      acc += dt;
      if (acc >= stepDur) {
        acc -= stepDur;
        if (acc > stepDur * 2) acc = 0;
        const t = ac.currentTime + 0.015;
        const s = stepIdx & 15;
        const bar = (stepIdx >> 4) & 3;
        const bi = Math.abs(biomeIdx | 0) % PROGS.length;
        const chord = PROGS[bi][bar];

        trigVinylDust(t);

        // Lush Rhodes 9th chord every bar (plus gentle syncopated re-voicing on beat 3.5)
        if (s === 0) trigRhodes(t, chord, baseStep * 15, isRace ? 0.068 : 0.060);
        else if (s === 10 && isRace) trigRhodes(t, chord.slice(1), baseStep * 6, 0.038);

        // Warm round upright/sub bass on root & fifth
        if (s === 0) trigSubBass(t, chord[0], baseStep * 7.5, isRace ? 0.19 : 0.14);
        else if (s === 7 && isRace) trigSubBass(t, chord[0], baseStep * 3.5, 0.125);
        else if (s === 10) trigSubBass(t, chord[2] - 12, baseStep * 5.0, isRace ? 0.135 : 0.10);

        if (isRace) {
          // Laid-back boom-bap lo-fi drums: cozy head-nodding groove that never gets harsh!
          if (s === 0 || s === 7 || s === 10) trigKick(t, s === 0 ? 0.30 : 0.22);
          if (s === 4 || s === 12) trigBrushSnare(t, 0.125 + speedNorm * 0.03);
          if (s === 15 && speedNorm > 0.35) trigBrushSnare(t, 0.052); // soft ghost brush
          if (s % 2 === 0) trigShaker(t, (s % 4 === 2) ? 0.028 : 0.018);
          else if (speedNorm > 0.45 && (s === 3 || s === 11)) trigShaker(t, 0.014);

          // Gentle warm Rhodes melodic top-line sprinkles during flow
          const pi = PLUCK_PAT[s];
          if (pi >= 0 && (speedNorm > 0.25 || adrenalineNorm > 0.2)) {
            trigPluck(t, chord[pi % chord.length], 0.028 + adrenalineNorm * 0.016);
          }
        } else {
          // Dreamy Start-Gate / Pause lo-fi chill loop (velvet chords + soft heartbeat kick + brush shaker)
          if (s === 0 || s === 10) trigKick(t, 0.16);
          if (s === 4 || s === 12) trigBrushSnare(t, 0.068);
          if (s % 4 === 2) trigShaker(t, 0.016);
        }
        stepIdx++;
      }
    },
  };
})();
