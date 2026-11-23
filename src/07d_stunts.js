// ---------------------------------------------------------------- 07d_stunts: V4 airtime-budgeted sequential random trick chaining (complete one before next, zero crash/bail!)
const Stunts = (() => {
  const TRICKS = {
    superman:  { name: '超人撒手',   en: 'SUPERMAN',       rate: 560, dur: 0.68 },
    nohander:  { name: '张臂飞鹰',   en: 'NO-HANDER',      rate: 600, dur: 0.66 },
    cancan:    { name: '单腿跨杠',   en: 'CAN-CAN',        rate: 540, dur: 0.62 },
    dblcancan: { name: '双腿甩空',   en: 'DOUBLE CAN-CAN', rate: 680, dur: 0.72 },
    nacnac:    { name: '回旋摆腿',   en: 'NAC-NAC',        rate: 580, dur: 0.64 },
    tabletop:  { name: '平躺压车',   en: 'TABLETOP',       rate: 620, dur: 0.68 },
    whip:      { name: '神龙摆尾',   en: 'TAILWHIP',       rate: 640, dur: 0.70 },
    backflip:  { name: '极限后空翻', en: 'BACKFLIP',       rate: 820, dur: 0.84 },
    spin:      { name: '空中360',    en: '360 SPIN',       rate: 680, dur: 0.78 },
  };

  const STD_POOL = ['cancan', 'nacnac', 'nohander', 'superman', 'tabletop', 'whip', 'dblcancan', 'spin'];
  const LAND_BUFFER = 0.28; // clean upright landing margin reserved before touchdown
  const stuntEvents = [];

  function wrapAngle(a) {
    return ((a + PI) % TAU + TAU) % TAU - PI;
  }

  function sstep(a, b, x) {
    const t = sat((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  // Exact 2-step ballistic airtime predictor accounting for steep downhill terrain ahead!
  function estimateAirtime(R) {
    const G = (typeof Career !== 'undefined' && Career.data && Career.data.cheats && Career.data.cheats.lowGrav) ? 13.3 : 21.5;
    const gNow = Course.height(R.pos[0], R.pos[2]);
    const altNow = Math.max(0, R.pos[1] - gNow);
    const vy = R.vel[1];
    const t0 = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * altNow))) / G;
    const tp = clamp(t0, 0.25, 3.8);
    const landY = Course.height(R.pos[0] + R.vel[0] * tp, R.pos[2] + R.vel[2] * tp);
    const effAlt = Math.max(altNow, R.pos[1] - landY);
    return (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * effAlt))) / G;
  }

  // Pick one non-repeating random trick whose full duration fits cleanly inside maxDur!
  function pickFittingTrick(R, maxDur, preferBackflip) {
    if (maxDur < 0.62) return null;
    if (preferBackflip && maxDur >= TRICKS.backflip.dur && R._lastTrick !== 'backflip') {
      R._lastTrick = 'backflip';
      return 'backflip';
    }
    const allowFlip = maxDur >= TRICKS.backflip.dur;
    if (!R._trickBag || R._trickBag.length === 0) {
      R._trickBag = STD_POOL.slice();
      if (allowFlip) R._trickBag.push('backflip');
      for (let i = R._trickBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = R._trickBag[i];
        R._trickBag[i] = R._trickBag[j];
        R._trickBag[j] = tmp;
      }
      if (R._trickBag.length > 1 && R._trickBag[R._trickBag.length - 1] === R._lastTrick) {
        const tmp = R._trickBag[0];
        R._trickBag[0] = R._trickBag[R._trickBag.length - 1];
        R._trickBag[R._trickBag.length - 1] = tmp;
      }
    }
    for (let k = R._trickBag.length - 1; k >= 0; k--) {
      const cand = R._trickBag[k];
      if (cand !== R._lastTrick && TRICKS[cand] && TRICKS[cand].dur <= maxDur) {
        R._trickBag.splice(k, 1);
        R._lastTrick = cand;
        return cand;
      }
    }
    for (const cand of STD_POOL) {
      if (cand !== R._lastTrick && TRICKS[cand].dur <= maxDur) {
        R._lastTrick = cand;
        return cand;
      }
    }
    return null;
  }

  function stepAir(R, inp, dt) {
    // Brief takeoff grace so small ground bumps don't trigger tricks
    if (R.airTime < 0.08) {
      R.trickActive = false;
      R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.042, -0.35, 0.45), 8, dt);
      return;
    }

    const tRemain = estimateAirtime(R);
    const wantsTrigger = !!(inp.jump || inp.trickDown || inp.trickLeft || inp.trickRight || (inp.trickUp && R.airTime > 0.14));

    // Phase 1: Start Trick #1 if we have enough budgeted airtime (dur + LAND_BUFFER)
    if (!R.trickLocked && !R.trickDone && wantsTrigger && tRemain >= 0.62 + LAND_BUFFER) {
      R.trickPlannedMax = Math.max(1, Math.floor((tRemain - LAND_BUFFER) / 0.68));
      const chosen = pickFittingTrick(R, tRemain - LAND_BUFFER, !!inp.trickDown);
      if (chosen) {
        const tr = TRICKS[chosen];
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
          stuntEvents.push({ type: 'trick_start', rider: R, trick: tr, combo: 1 });
        }
      }
    }

    // Phase 2: Complete the CURRENT trick cleanly (ZERO mid-trick switching!) before chaining to next if airtime budget remains!
    if (R.trickLocked && !R.trickDone && R.trickType) {
      const tr = TRICKS[R.trickType] || TRICKS.cancan;
      R._trickTimer = (R._trickTimer || 0) + dt;
      const dur = R._trickDur || tr.dur;
      let p = sat(R._trickTimer / dur);

      // Safety finish if ground approaches faster than predicted
      if (tRemain < 0.16 && p > 0.45) p = 1.0;

      const skillBonus = 1 + (R.upgrades.combat || 0) * 0.12;
      R.trickScore += tr.rate * skillBonus * dt;
      R.adrenaline = Math.min(100, R.adrenaline + 14 * dt);

      if (R.trickType === 'backflip') {
        R.trickPhase = Math.sin(p * PI);
        R.trickPitch = p >= 1.0 ? 0 : p * TAU;
        R.trickYaw = damp(wrapAngle(R.trickYaw), 0, 12, dt);
        R.trickRoll = damp(R.trickRoll, 0, 12, dt);
        R.trickActive = p < 0.96;
      } else if (R.trickType === 'spin') {
        R.trickPhase = Math.sin(p * PI);
        R.trickYaw = p >= 1.0 ? 0 : -p * TAU;
        R.trickPitch = damp(wrapAngle(R.trickPitch), 0.08 * R.trickPhase, 12, dt);
        R.trickRoll = damp(R.trickRoll, 0, 12, dt);
        R.trickActive = p < 0.96;
      } else {
        const env = p < 0.20 ? sstep(0, 0.20, p)
                  : p < 0.78 ? 1.0
                  : 1.0 - sstep(0.78, 1.0, p);
        R.trickPhase = env;
        R.trickActive = env > 0.12;

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
          R.trickPitch = 0.11 * env;
          R.trickRoll = 0;
          R.trickYaw = 0;
        }
      }

      // When current trick completes 100%, check remaining airtime budget for seamless next trick!
      if (p >= 1.0) {
        const budgetAfter = estimateAirtime(R) - LAND_BUFFER;
        if ((wantsTrigger || budgetAfter > 0.85) && budgetAfter >= 0.62) {
          const next = pickFittingTrick(R, budgetAfter, !!inp.trickDown);
          if (next) {
            const ntr = TRICKS[next];
            R.trickType = next;
            R._trickTimer = 0;
            R._trickDur = ntr.dur;
            R.trickCombo = Math.min(8, (R.trickCombo || 1) + 1);
            R.trickActive = true;
            R.trickPitch = 0;
            R.trickYaw = 0;
            R.trickRoll = 0;
            R.trickPhase = 0.22;
            if (R.isPlayer) {
              Sound.playTrick(R.trickCombo);
              stuntEvents.push({ type: 'trick_start', rider: R, trick: ntr, combo: R.trickCombo });
            }
          } else {
            R.trickDone = true;
          }
        } else {
          R.trickDone = true;
        }
      }
    }

    // Phase 3: Clean upright landing stance
    if (R.trickDone || !R.trickLocked) {
      R.trickHeld = false;
      const snap = tRemain < 0.35 ? 26 : 16;
      R.trickPhase = damp(R.trickPhase, 0, snap, dt);
      R.trickPitch = damp(wrapAngle(R.trickPitch), 0, snap, dt);
      R.trickYaw = damp(wrapAngle(R.trickYaw), 0, snap, dt);
      R.trickRoll = damp(R.trickRoll, 0, snap, dt);
      R.trickActive = R.trickPhase > 0.12;
    }

    R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.036, -0.44, 0.40), 6, dt);
    R.roll = damp(R.roll, R.steer * 0.22, 6, dt);
  }

  // Zero bail/crash on trick landing — EVERY air stunt chain lands cleanly and rewards full combo!
  function onLand(R, impactVy, airDist) {
    const combo = Math.max(1, R.trickCombo || 1);
    if (R.trickScore > 35 || airDist > 11) {
      const mult = 1 + (combo - 1) * 0.35;
      const airBonus = airDist > 11 ? Math.round(airDist * 18) : 0;
      const pts = Math.round(R.trickScore * mult) + airBonus;
      R.totalTrickScore += pts;
      const adrGain = clamp(pts / 20, 18, 65);
      R.adrenaline = Math.min(100, R.adrenaline + adrGain);

      if (pts >= 320 && R.combatTier < 3) R.combatTier++;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const kick = clamp(pts / 200, 1.8, 5.6);
      R.vel[0] += fx * kick;
      R.vel[2] += fz * kick;

      if (R.isPlayer) {
        Sound.playTrick(Math.min(4, combo + 1));
        const tr = R.trickType ? TRICKS[R.trickType] : null;
        stuntEvents.push({
          type: 'trick_land',
          rider: R,
          pts,
          combo,
          airDist: Math.round(airDist),
          name: tr ? tr.name : '飞跃着陆',
          en: tr ? tr.en : 'BIG AIR',
        });
      }
    }

    R.trickType = null;
    R.trickHeld = false;
    R.trickActive = false;
    R.trickLocked = false;
    R.trickDone = false;
    R._trickTimer = 0;
    R.trickPlannedMax = 0;
    R.trickPhase = 0;
    R.trickScore = 0;
    R.trickCombo = 0;
    R.trickYaw = R.trickPitch = R.trickRoll = 0;
    return false;
  }

  return {
    TRICKS,
    estimateAirtime,
    stepAir,
    onLand,
    drainEvents() { const out = stuntEvents.slice(); stuntEvents.length = 0; return out; },
  };
})();
