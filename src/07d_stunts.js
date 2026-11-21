// ---------------------------------------------------------------- 07d_stunts: 8 Downhill Domination air tricks, effortless auto-variety, Super-Style & forgiving auto-landing
const Stunts = (() => {
  const TRICKS = {
    superman:  { name: '超人撒手',   en: 'SUPERMAN',       rate: 520 },
    nohander:  { name: '张臂飞鹰',   en: 'NO-HANDER',      rate: 560 },
    cancan:    { name: '单腿跨杠',   en: 'CAN-CAN',        rate: 500 },
    dblcancan: { name: '双腿甩空',   en: 'DOUBLE CAN-CAN', rate: 680 },
    nacnac:    { name: '回旋摆腿',   en: 'NAC-NAC',        rate: 540 },
    tabletop:  { name: '平躺压车',   en: 'TABLETOP',       rate: 580 },
    whip:      { name: '神龙摆尾',   en: 'TAILWHIP',       rate: 600 },
    backflip:  { name: '极限后空翻', en: 'BACKFLIP',       rate: 760 },
    spin:      { name: '空中360',    en: '360 SPIN',       rate: 640 },
  };

  // Effortless variety pools per directional input (no multi-key memorization needed!)
  const POOLS = {
    up:    ['superman', 'nohander', 'tabletop'],
    left:  ['cancan', 'tabletop', 'whip'],
    right: ['nacnac', 'whip', 'spin'],
    flow:  ['superman', 'cancan', 'nohander', 'whip', 'nacnac', 'tabletop', 'dblcancan', 'spin'],
  };

  // Super-Style escalation after holding any trick smoothly in big air (>0.48s)
  const SUPER_UPGRADE = {
    superman: 'nohander',
    cancan:   'dblcancan',
    nacnac:   'whip',
    tabletop: 'whip',
  };

  const stuntEvents = [];

  function wrapAngle(a) {
    return ((a + PI) % TAU + TAU) % TAU - PI;
  }

  function pickTrick(R, dirKey) {
    const pool = POOLS[dirKey];
    R._trickCycle = ((R._trickCycle || 0) + 1) % 997;
    const base = pool[R._trickCycle % pool.length];
    return base === R.trickType ? pool[(R._trickCycle + 1) % pool.length] : base;
  }

  function stepAir(R, inp, dt) {
    // Allow brief 0.08s takeoff grace before tricks engage
    if (R.airTime < 0.08) {
      R.trickActive = false;
      R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.042, -0.35, 0.45), 8, dt);
      return;
    }

    // Measure live altitude above terrain for forgiving auto-level landing recovery!
    const gY = Course.height(R.pos[0], R.pos[2]);
    const alt = R.pos[1] - gY;
    const nearGround = alt < 2.15 && R.vel[1] < -1.0;

    // Context-smart direction / Space trigger (zero special keys required!)
    let dirKey = null;
    if (inp.trickDown) dirKey = 'down';
    else if (inp.jump && R.airTime > 0.14) dirKey = 'flow';
    else if (inp.trickLeft) dirKey = 'left';
    else if (inp.trickRight) dirKey = 'right';
    else if (inp.trickUp && (alt > 1.35 || R.airTime > 0.18)) dirKey = 'up';

    // Forgiving landing cushion: if close to ground and NOT mid-backflip rotation, auto-level cleanly!
    const backflipMid = R.trickType === 'backflip' && Math.abs(wrapAngle(R.trickPitch || 0)) > 1.05;
    if (nearGround && !backflipMid) {
      dirKey = null;
    }

    if (dirKey) {
      let want = R.trickType;
      const switchedDir = R._trickDir !== dirKey;
      if (!want || switchedDir) {
        R._trickDir = dirKey;
        R._trickHoldT = 0;
        want = dirKey === 'down' ? 'backflip' : pickTrick(R, dirKey);
      } else {
        R._trickHoldT = (R._trickHoldT || 0) + dt;
        // Super-Style automatic escalation when holding cleanly in big air (>0.50s)!
        if (R._trickHoldT > 0.50 && alt > 2.6 && SUPER_UPGRADE[want]) {
          want = SUPER_UPGRADE[want];
          R._trickHoldT = -0.75; // avoid immediate re-trigger
        } else if (dirKey === 'flow' && R._trickHoldT > 0.62 && alt > 2.4) {
          // Holding Space chains fresh tricks automatically!
          want = pickTrick(R, 'flow');
          R._trickHoldT = 0;
        }
      }

      if (R.trickType !== want) {
        R.trickType = want;
        R.trickCombo = Math.min(6, (R.trickCombo || 0) + 1);
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
      R.trickActive = true;
      const tr = TRICKS[want] || TRICKS.superman;
      const skillBonus = 1 + (R.upgrades.combat || 0) * 0.12;
      R.trickScore += tr.rate * skillBonus * dt;
      // Live tricking smoothly builds adrenaline in mid-air!
      R.adrenaline = Math.min(100, R.adrenaline + 12 * dt);

      if (want === 'backflip') {
        R.trickPhase = damp(R.trickPhase, 1.0, 10, dt);
        R.trickPitch += 6.2 * dt; // fast crisp 360 backflip (~1.0s full loop)
        R.trickYaw = damp(wrapAngle(R.trickYaw), 0, 8, dt);
        R.trickRoll = damp(R.trickRoll, 0, 8, dt);
      } else if (want === 'spin') {
        R.trickPhase = damp(R.trickPhase, 1.0, 10, dt);
        R.trickYaw -= 6.8 * dt;
        R.trickPitch = damp(wrapAngle(R.trickPitch), 0.08, 8, dt);
      } else if (want === 'tabletop') {
        R.trickPhase = damp(R.trickPhase, 1.0, 11, dt);
        R.trickRoll = damp(R.trickRoll, 1.08, 9.5, dt); // dramatic flat sideways tabletop!
        R.trickPitch = damp(wrapAngle(R.trickPitch), 0.14, 8, dt);
        R.trickYaw = damp(wrapAngle(R.trickYaw), 0.25, 8, dt);
      } else if (want === 'whip') {
        R.trickPhase = damp(R.trickPhase, 1.0, 11, dt);
        R.trickRoll = damp(R.trickRoll, 0.36, 9, dt);
        R.trickPitch = damp(wrapAngle(R.trickPitch), 0.12, 8, dt);
      } else {
        // Superman, No-Hander, Can-Can, Double Can-Can, Nac-Nac
        R.trickPhase = damp(R.trickPhase, 1.0, 11, dt);
        R.trickPitch = damp(wrapAngle(R.trickPitch), want === 'nohander' ? 0.18 : 0.10, 9, dt);
        R.trickYaw = damp(wrapAngle(R.trickYaw), 0, 9, dt);
        R.trickRoll = damp(R.trickRoll, want === 'dblcancan' ? -0.24 : want === 'cancan' ? -0.14 : 0, 9, dt);
      }
    } else {
      // Released OR auto-recovery cushion engaged! Snap cleanly back to landing posture
      R.trickHeld = false;
      R._trickDir = null;
      const snap = nearGround ? 22 : 14;
      R.trickPhase = damp(R.trickPhase, 0, snap, dt);
      R.trickPitch = damp(wrapAngle(R.trickPitch), 0, snap, dt);
      R.trickYaw = damp(wrapAngle(R.trickYaw), 0, snap, dt);
      R.trickRoll = damp(wrapAngle(R.trickRoll), 0, snap, dt);
      R.trickActive = R.trickPhase > 0.12;
    }

    R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.036, -0.42, 0.42), 6, dt);
    R.roll = damp(R.roll, R.steer * 0.22, 6, dt);
  }

  // Forgiving Downhill Domination landing rules:
  // ONLY bail if the rider genuinely lands upside-down on their helmet mid-Backflip (|pitch| > 112 deg)!
  function onLand(R, impactVy, airDist) {
    const pitchOff = Math.abs(wrapAngle(R.trickPitch || 0));
    const upsideDown = R.trickType === 'backflip' && pitchOff > 1.95;

    if (upsideDown && R.trickScore > 80) {
      if (R.isPlayer) {
        stuntEvents.push({ type: 'trick_bail', rider: R, lost: Math.round(R.trickScore) });
      }
      R.trickType = null;
      R.trickHeld = false;
      R.trickActive = false;
      R._trickDir = null;
      R.trickPhase = 0;
      R.trickScore = 0;
      R.trickCombo = 0;
      R.trickYaw = R.trickPitch = R.trickRoll = 0;
      return true;
    }

    // Clean stomp landing!
    if (R.trickScore > 35 || airDist > 11) {
      const mult = Math.max(1, R.trickCombo || 1);
      const airBonus = airDist > 11 ? Math.round(airDist * 16) : 0;
      const pts = Math.round(R.trickScore * mult) + airBonus;
      R.totalTrickScore += pts;
      const adrGain = clamp(pts / 22, 16, 58);
      R.adrenaline = Math.min(100, R.adrenaline + adrGain);

      // Clean stomp levels up combat weapon tier, refills bottles & blasts a landing speed kick!
      if (pts >= 340 && R.combatTier < 3) R.combatTier++;
      if (pts >= 200 && R.bottles < 3) R.bottles++;
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const kick = clamp(pts / 210, 1.8, 5.4);
      R.vel[0] += fx * kick;
      R.vel[2] += fz * kick;

      if (R.isPlayer) {
        Sound.playTrick(mult + 1);
        const tr = R.trickType ? TRICKS[R.trickType] : null;
        stuntEvents.push({
          type: 'trick_land',
          rider: R,
          pts,
          combo: mult,
          airDist: Math.round(airDist),
          name: tr ? tr.name : '飞跃着陆',
          en: tr ? tr.en : 'BIG AIR',
        });
      }
    }

    R.trickType = null;
    R.trickHeld = false;
    R.trickActive = false;
    R._trickDir = null;
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
