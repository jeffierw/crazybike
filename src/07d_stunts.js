// ---------------------------------------------------------------- 07d_stunts: V3 single committed random trick per jump (zero mid-air switching) + forgiving landing
const Stunts = (() => {
  const TRICKS = {
    superman:  { name: '超人撒手',   en: 'SUPERMAN',       rate: 560, dur: 0.84 },
    nohander:  { name: '张臂飞鹰',   en: 'NO-HANDER',      rate: 600, dur: 0.82 },
    cancan:    { name: '单腿跨杠',   en: 'CAN-CAN',        rate: 540, dur: 0.78 },
    dblcancan: { name: '双腿甩空',   en: 'DOUBLE CAN-CAN', rate: 680, dur: 0.88 },
    nacnac:    { name: '回旋摆腿',   en: 'NAC-NAC',        rate: 580, dur: 0.80 },
    tabletop:  { name: '平躺压车',   en: 'TABLETOP',       rate: 620, dur: 0.84 },
    whip:      { name: '神龙摆尾',   en: 'TAILWHIP',       rate: 640, dur: 0.86 },
    backflip:  { name: '极限后空翻', en: 'BACKFLIP',       rate: 820, dur: 0.94 },
    spin:      { name: '空中360',    en: '360 SPIN',       rate: 680, dur: 0.90 },
  };

  // Standard random trick pool (every jump commits to ONE complete random trick, never repeats back-to-back!)
  const STD_POOL = ['superman', 'nohander', 'cancan', 'dblcancan', 'nacnac', 'tabletop', 'whip', 'spin'];
  const stuntEvents = [];

  function wrapAngle(a) {
    return ((a + PI) % TAU + TAU) % TAU - PI;
  }

  function sstep(a, b, x) {
    const t = sat((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  // Shuffle-bag random picker: genuinely random per jump, guaranteed non-repeating consecutive tricks
  function pickRandomTrick(R, allowBackflip, preferBackflip) {
    if (preferBackflip && allowBackflip) {
      R._lastTrick = 'backflip';
      return 'backflip';
    }
    if (!R._trickBag || R._trickBag.length === 0) {
      R._trickBag = STD_POOL.slice();
      if (allowBackflip) R._trickBag.push('backflip');
      // Fisher-Yates shuffle
      for (let i = R._trickBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = R._trickBag[i];
        R._trickBag[i] = R._trickBag[j];
        R._trickBag[j] = t;
      }
      // Never repeat last jump's trick immediately after reshuffle
      if (R._trickBag.length > 1 && R._trickBag[R._trickBag.length - 1] === R._lastTrick) {
        const tmp = R._trickBag[0];
        R._trickBag[0] = R._trickBag[R._trickBag.length - 1];
        R._trickBag[R._trickBag.length - 1] = tmp;
      }
    }
    let chosen = R._trickBag.pop();
    if (chosen === 'backflip' && !allowBackflip) {
      chosen = R._trickBag.length > 0 ? R._trickBag.pop() : 'superman';
    }
    R._lastTrick = chosen;
    return chosen;
  }

  function stepAir(R, inp, dt) {
    // Brief takeoff grace so normal small bumps don't trigger tricks
    if (R.airTime < 0.09) {
      R.trickActive = false;
      R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.042, -0.35, 0.45), 8, dt);
      return;
    }

    const gY = Course.height(R.pos[0], R.pos[2]);
    const alt = R.pos[1] - gY;
    const nearGround = alt < 2.25 && R.vel[1] < -1.2;

    // Any directional / jump key triggers ONE committed random trick (no switching mid-air!)
    const wantsTrigger = !!(inp.jump || inp.trickDown || inp.trickLeft || inp.trickRight || (inp.trickUp && (alt > 1.5 || R.airTime > 0.20)));

    // 1. If we haven't committed a trick yet on this jump and player asks for one (with real clearance)
    if (!R.trickLocked && !R.trickDone && wantsTrigger && !nearGround && (alt > 1.15 || R.airTime > 0.14)) {
      const allowFlip = alt > 3.8 || R.vel[1] > 4.2;
      const chosen = pickRandomTrick(R, allowFlip, !!inp.trickDown && allowFlip);
      const tr = TRICKS[chosen] || TRICKS.superman;
      R.trickLocked = true;
      R.trickDone = false;
      R.trickType = chosen;
      R._trickTimer = 0;
      R._trickDur = tr.dur;
      R.trickCombo = 1;
      R.trickActive = true;
      R.trickHeld = true;

      if (R.isPlayer) {
        Sound.playTrick(1);
        stuntEvents.push({
          type: 'trick_start',
          rider: R,
          trick: tr,
          combo: 1,
        });
      }
    }

    // 2. Execute the ONE committed trick smoothly from start to completion — NEVER switches mid-air!
    if (R.trickLocked && !R.trickDone && R.trickType) {
      const tr = TRICKS[R.trickType] || TRICKS.superman;
      R._trickTimer = (R._trickTimer || 0) + dt;
      const dur = R._trickDur || tr.dur;
      const p = sat(R._trickTimer / dur);

      // Score & adrenaline accumulate smoothly over the committed trick execution
      const skillBonus = 1 + (R.upgrades.combat || 0) * 0.12;
      R.trickScore += tr.rate * skillBonus * dt;
      R.adrenaline = Math.min(100, R.adrenaline + 14 * dt);

      // Smooth attack -> showcase hold -> clean tuck recovery envelope
      const backflipMid = R.trickType === 'backflip' && p < 0.88;
      if (nearGround && !backflipMid && p > 0.35) {
        // Auto-finish cleanly just before touchdown so landing feels awesome and planted!
        R.trickDone = true;
      } else if (R.trickType === 'backflip') {
        R.trickPhase = Math.sin(p * PI);
        R.trickPitch = p * TAU; // exact full 360 loop cleanly back to 0!
        R.trickYaw = damp(wrapAngle(R.trickYaw), 0, 10, dt);
        R.trickRoll = damp(R.trickRoll, 0, 10, dt);
        R.trickActive = p < 0.94;
        if (p >= 1.0) {
          R.trickPitch = 0;
          R.trickDone = true;
        }
      } else if (R.trickType === 'spin') {
        R.trickPhase = Math.sin(p * PI);
        R.trickYaw = -p * TAU; // exact crisp 360 spin back to straight!
        R.trickPitch = damp(wrapAngle(R.trickPitch), 0.08 * R.trickPhase, 10, dt);
        R.trickRoll = damp(R.trickRoll, 0, 10, dt);
        R.trickActive = p < 0.94;
        if (p >= 1.0) {
          R.trickYaw = 0;
          R.trickDone = true;
        }
      } else {
        // Expressive pose tricks: attack (0..0.22), hold apex (0.22..0.74), smooth return (0.74..1.0)
        // If still very high off a mega cliff drop and player keeps holding, stretch the apex smoothly without changing tricks!
        if (p > 0.45 && p < 0.72 && wantsTrigger && alt > 4.2 && R._trickDur < 1.55) {
          R._trickDur += dt * 0.65;
        }
        const p2 = sat(R._trickTimer / R._trickDur);
        const env = p2 < 0.22 ? sstep(0, 0.22, p2)
                  : p2 < 0.76 ? 1.0
                  : 1.0 - sstep(0.76, 1.0, p2);
        R.trickPhase = env;
        R.trickActive = env > 0.14;

        if (R.trickType === 'tabletop') {
          R.trickRoll = 1.12 * env;
          R.trickPitch = 0.14 * env;
          R.trickYaw = 0.24 * env;
        } else if (R.trickType === 'whip') {
          R.trickRoll = 0.38 * env;
          R.trickPitch = 0.12 * env;
          R.trickYaw = 0;
        } else if (R.trickType === 'nohander') {
          R.trickPitch = 0.20 * env;
          R.trickRoll = 0;
          R.trickYaw = 0;
        } else if (R.trickType === 'dblcancan' || R.trickType === 'cancan') {
          R.trickPitch = 0.10 * env;
          R.trickRoll = (R.trickType === 'dblcancan' ? -0.26 : -0.14) * env;
          R.trickYaw = 0;
        } else {
          // Superman / Nac-Nac
          R.trickPitch = 0.11 * env;
          R.trickRoll = 0;
          R.trickYaw = 0;
        }

        if (p2 >= 1.0) R.trickDone = true;
      }
    }

    // 3. Once the single committed trick finishes (or if no trick triggered), hold crisp landing stance!
    if (R.trickDone || !R.trickLocked) {
      R.trickHeld = false;
      const snap = nearGround ? 24 : 15;
      R.trickPhase = damp(R.trickPhase, 0, snap, dt);
      R.trickPitch = damp(wrapAngle(R.trickPitch), 0, snap, dt);
      R.trickYaw = damp(wrapAngle(R.trickYaw), 0, snap, dt);
      R.trickRoll = damp(R.trickRoll, 0, snap, dt);
      R.trickActive = R.trickPhase > 0.12;
    }

    R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.036, -0.44, 0.40), 6, dt);
    R.roll = damp(R.roll, R.steer * 0.22, 6, dt);
  }

  // Forgiving Downhill Domination landing:
  // ONLY bail if the rider literally lands upside-down on their head mid-Backflip (|pitch| > 118 deg)!
  function onLand(R, impactVy, airDist) {
    const pitchOff = Math.abs(wrapAngle(R.trickPitch || 0));
    const upsideDown = R.trickType === 'backflip' && !R.trickDone && pitchOff > 2.05;

    const resetTrick = () => {
      R.trickType = null;
      R.trickHeld = false;
      R.trickActive = false;
      R.trickLocked = false;
      R.trickDone = false;
      R._trickTimer = 0;
      R.trickPhase = 0;
      R.trickScore = 0;
      R.trickCombo = 0;
      R.trickYaw = R.trickPitch = R.trickRoll = 0;
    };

    if (upsideDown && R.trickScore > 80) {
      if (R.isPlayer) {
        stuntEvents.push({ type: 'trick_bail', rider: R, lost: Math.round(R.trickScore) });
      }
      resetTrick();
      return true;
    }

    // Clean stomp landing!
    if (R.trickScore > 35 || airDist > 11) {
      const airBonus = airDist > 11 ? Math.round(airDist * 18) : 0;
      const pts = Math.round(R.trickScore * 1.15) + airBonus;
      R.totalTrickScore += pts;
      const adrGain = clamp(pts / 20, 18, 60);
      R.adrenaline = Math.min(100, R.adrenaline + adrGain);

      if (pts >= 320 && R.combatTier < 3) R.combatTier++;
      if (pts >= 180 && R.bottles < 3) R.bottles++;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const kick = clamp(pts / 210, 1.8, 5.2);
      R.vel[0] += fx * kick;
      R.vel[2] += fz * kick;

      if (R.isPlayer) {
        Sound.playTrick(2);
        const tr = R.trickType ? TRICKS[R.trickType] : null;
        stuntEvents.push({
          type: 'trick_land',
          rider: R,
          pts,
          combo: 1,
          airDist: Math.round(airDist),
          name: tr ? tr.name : '飞跃着陆',
          en: tr ? tr.en : 'BIG AIR',
        });
      }
    }

    resetTrick();
    return false;
  }

  return {
    TRICKS,
    stepAir,
    onLand,
    drainEvents() { const out = stuntEvents.slice(); stuntEvents.length = 0; return out; },
  };
})();
