// ---------------------------------------------------------------- 07d_stunts: context-smart mid-air tricks, adrenaline & bail risk-reward
const Stunts = (() => {
  const TRICKS = {
    superman: { name: '超人撒手', en: 'SUPERMAN', rate: 480 },
    backflip: { name: '后空翻',   en: 'BACKFLIP', rate: 640 },
    whip:     { name: '神龙摆尾', en: 'TAILWHIP', rate: 520 },
    spin360:  { name: '空中360',  en: '360 SPIN', rate: 580 },
  };

  const stuntEvents = [];

  function wrapAngle(a) {
    a = ((a + PI) % TAU + TAU) % TAU - PI;
    return a;
  }

  function stepAir(R, inp, dt) {
    // Allow brief takeoff grace before tricks engage
    if (R.airTime < 0.11) {
      R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.045, -0.35, 0.45), 8, dt);
      return;
    }

    // Pick trick from directional input (context-smart: 1 button in mid-air!)
    let want = null;
    if (inp.trickDown) want = 'backflip';
    else if (inp.trickUp) want = 'superman';
    else if (inp.trickLeft) want = 'whip';
    else if (inp.trickRight) want = 'spin360';

    if (want) {
      if (R.trickType !== want) {
        R.trickType = want;
        R.trickCombo = Math.min(5, (R.trickCombo || 0) + 1);
        if (R.isPlayer) {
          Sound.playTrick(R.trickCombo);
          stuntEvents.push({
            type: 'trick_start',
            rider: R,
            trick: TRICKS[want],
            combo: R.trickCombo,
          });
        }
      }
      R.trickHeld = true;
      const tr = TRICKS[want];
      const skillBonus = 1 + (R.upgrades.combat || 0) * 0.12;
      R.trickScore += tr.rate * skillBonus * dt;

      if (want === 'superman') {
        R.trickPhase = damp(R.trickPhase, 1.0, 9.5, dt);
        R.trickPitch = damp(R.trickPitch, 0.12, 8, dt);
        R.trickYaw = damp(R.trickYaw, 0, 8, dt);
      } else if (want === 'whip') {
        R.trickPhase = damp(R.trickPhase, 1.0, 10, dt);
        R.trickRoll = damp(R.trickRoll, 0.35, 8, dt);
      } else if (want === 'backflip') {
        R.trickPhase = Math.min(2.5, R.trickPhase + dt * 2.2);
        R.trickPitch += 5.9 * dt; // continuous exhilarating backflip rotation!
      } else if (want === 'spin360') {
        R.trickPhase = Math.min(2.5, R.trickPhase + dt * 2.2);
        R.trickYaw -= 6.4 * dt;
      }
    } else {
      // Released! Rapidly snap bike & rider back to clean landing posture
      R.trickHeld = false;
      R.trickPhase = damp(R.trickPhase, 0, 12, dt);
      R.trickPitch = damp(wrapAngle(R.trickPitch), 0, 13, dt);
      R.trickYaw = damp(wrapAngle(R.trickYaw), 0, 13, dt);
      R.trickRoll = damp(wrapAngle(R.trickRoll), 0, 13, dt);
    }

    R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.04, -0.45, 0.42), 6, dt);
    R.roll = damp(R.roll, R.steer * 0.22, 6, dt);
  }

  // Returns true if rider greedily bailed into a ragdoll crash!
  function onLand(R, impactVy, airDist) {
    const pitchOff = Math.abs(wrapAngle(R.trickPitch || 0));
    const yawOff = Math.abs(wrapAngle(R.trickYaw || 0));
    const greedyHold = R.trickHeld && R.trickPhase > 0.45;
    const upsideDown = pitchOff > 0.92 || yawOff > 1.05;

    if ((greedyHold || upsideDown) && R.trickScore > 60) {
      if (R.isPlayer) {
        stuntEvents.push({ type: 'trick_bail', rider: R, lost: Math.round(R.trickScore) });
      }
      R.trickType = null;
      R.trickHeld = false;
      R.trickPhase = 0;
      R.trickScore = 0;
      R.trickCombo = 0;
      R.trickYaw = R.trickPitch = R.trickRoll = 0;
      return true;
    }

    // Clean stomp landing!
    if (R.trickScore > 45 || airDist > 12) {
      const mult = Math.max(1, R.trickCombo || 1);
      const airBonus = airDist > 12 ? Math.round(airDist * 14) : 0;
      const pts = Math.round(R.trickScore * mult) + airBonus;
      R.totalTrickScore += pts;
      const adrGain = clamp(pts / 26, 12, 52);
      R.adrenaline = Math.min(100, R.adrenaline + adrGain);

      // Clean big trick also boosts combat weapon tier & gives landing sprint kick!
      if (pts >= 380 && R.combatTier < 3) R.combatTier++;
      if (pts >= 220 && R.bottles < 3) R.bottles++;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const kick = clamp(pts / 240, 1.5, 4.8);
      R.vel[0] += fx * kick;
      R.vel[2] += fz * kick;

      if (R.isPlayer) {
        Sound.playTrick(mult + 1);
        stuntEvents.push({
          type: 'trick_land',
          rider: R,
          pts,
          combo: mult,
          airDist: Math.round(airDist),
          name: R.trickType ? TRICKS[R.trickType].name : '飞跃着陆',
          en: R.trickType ? TRICKS[R.trickType].en : 'BIG AIR',
        });
      }
    }

    R.trickType = null;
    R.trickHeld = false;
    R.trickPhase = 0;
    R.trickScore = 0;
    R.trickCombo = 0;
    R.trickYaw = R.trickPitch = R.trickRoll = 0;
    return false;
  }

  return {
    TRICKS,
    stepAir,
    onLand,
    drainEvents() { const out = stuntEvents.slice(); stuntEvents.length = 0; return out; },
  };
})();
