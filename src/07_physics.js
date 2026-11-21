// ---------------------------------------------------------------- 07_physics: arcade downhill MTB physics, suspension, jumping, crashing & events
const Physics = (() => {
  Variants.def('feel', '漂移手感', [['a', '稳健抓地'], ['b', '暴走甩尾']], 'b');

  const events = [];
  function emit(ev) { events.push(ev); }

  function createRider(cfg = {}) {
    const startS = cfg.s || 12;
    const sp = Course.at(startS);
    const u = cfg.u || 0;
    const x = sp.cx + u, z = -startS;
    const y = Course.height(x, z);
    return {
      id: cfg.id || 0,
      name: cfg.name || 'PLAYER',
      isPlayer: !!cfg.isPlayer,
      personality: cfg.personality || 'player',
      skill: cfg.skill || { lookAhead: 0.8, shortcutRate: 0.5, trickSkill: 0.5, aggro: 0.5, bikeTier: 0 },
      upgrades: Object.assign({ frame: 0, fork: 0, drive: 0, tires: 0, combat: 0 }, cfg.upgrades || {}),
      frameCol: cfg.frameCol || [1.0, 0.30, 0.08],
      jerseyCol: cfg.jerseyCol || [0.12, 0.78, 0.96],
      helmetCol: cfg.helmetCol || [1.0, 0.84, 0.14],

      pos: [x, y, z],
      vel: [0, 0, -(cfg.initSpeed || 8)],
      yaw: 0,          // rad; forward = (-sin(yaw), 0, -cos(yaw))
      pitch: -0.25,    // nose up positive, downhill negative
      roll: 0,         // left lean positive, right lean negative
      steer: 0,        // smoothed steer input -1 (left) .. +1 (right)
      speed: cfg.initSpeed || 8,
      s: startS,
      u,

      air: false,
      airTime: 0,
      airPeak: 0,
      airStartY: y,
      landGrace: 0,
      prevSlopeVy: 0,
      charge: 0,
      wasJumpHeld: false,
      susp: 0,
      suspV: 0,
      skid: 0,
      wheelSpin: 0,
      pedalPhase: 0,
      onTrack: true,
      onShortcut: false,
      onRamp: false,
      inCreek: false,

      // Adrenaline, Tricks & Boost (used heavily in Step 5)
      adrenaline: 25,   // 0..100
      boosting: false,
      idleMode: false,
      trickType: null,  // 'superman' | 'nohander' | 'cancan' | 'dblcancan' | 'nacnac' | 'tabletop' | 'whip' | 'backflip' | 'spin'
      trickPhase: 0,    // 0..1+ animation depth
      trickHeld: false,
      trickActive: false,
      trickScore: 0,
      trickCombo: 0,
      trickYaw: 0,
      trickPitch: 0,
      trickRoll: 0,
      totalTrickScore: 0,
      bestAirDist: 0,
      airStartS: startS,

      // Combat & Crash state (used in Steps 5 & 6)
      combatTier: Math.min(3, (cfg.upgrades && cfg.upgrades.combat) ? Math.floor(cfg.upgrades.combat / 2) : 0),
      bottles: 1,
      bottleCd: 0,
      attackTimer: 0,
      attackCd: 0,
      attackSide: 1,
      attackKind: 'punch',
      wobble: 0,
      wobbleDir: 0,
      staggerCd: 0,
      nemesis: false,
      nemesisTimer: 0,
      lastHitBy: null,
      lastHitTime: -99,
      takedowns: 0,
      crashes: 0,
      maxSpeed: 0,
      finished: false,
      finishTime: 0,

      // Ragdoll crash state
      crashed: false,
      crashTimer: 0,
      ragPos: [x, y, z],
      ragVel: [0, 0, 0],
      ragRot: [0, 0, 0],
      ragAngVel: [0, 0, 0],
      bikeCrashPos: [x, y, z],
      bikeCrashVel: [0, 0, 0],
      bikeCrashRot: [0, 0, 0],
      bikeCrashAngVel: [0, 0, 0],

      // AI state
      aiTargetU: u,
      aiLaneChoice: 0,
      aiAttackDelay: 0.6,
      aiRole: 'pack',
      rank: 1,
    };
  }

  // V4 Dodge-Only Impact Response across ALL modes (ZERO ragdoll crashes / ZERO bike detachment / ZERO forced respawn!)
  function triggerCrash(R, reason, impulseX = 0, impulseZ = 0, attacker = null) {
    if (R.finished) return;
    const side = sign(impulseX) || (R.wobbleDir ? -R.wobbleDir : (Math.random() < 0.5 ? -1 : 1));
    R.vel[0] += clamp(impulseX || side * 8.0, -11, 11);
    R.vel[2] *= 0.80;
    R.wobble = Math.max(R.wobble, 0.58);
    R.wobbleDir = side;
    R.roll = clamp(R.roll + side * 0.42, -0.85, 0.85);
    R.staggerCd = 0.85;
    if (attacker) {
      R.lastHitBy = attacker;
    }
    emit({ type: 'dodge', rider: R, reason, attacker: attacker || R.lastHitBy, pos: R.pos.slice() });
  }

  function respawnRider(R) {
    R.crashed = false;
    R.crashTimer = 0;
    const s = Math.max(10, R.s - 3);
    const sp = Course.at(s);
    const safeU = clamp(R.u * 0.4, -sp.hw * 0.55, sp.hw * 0.55);
    R.pos[0] = sp.cx + safeU;
    R.pos[2] = -s;
    R.pos[1] = Course.height(R.pos[0], R.pos[2]) + 0.12;
    R.yaw = Math.atan2(-sp.dcx, 1);
    R.pitch = -Math.atan(sp.slope);
    R.roll = 0;
    const spd = 12;
    R.vel[0] = -Math.sin(R.yaw) * spd;
    R.vel[1] = 0;
    R.vel[2] = -Math.cos(R.yaw) * spd;
    R.speed = spd;
    R.air = false;
    R.airTime = 0;
    R.susp = 0.08;
    R.suspV = 0;
    R.wobble = 0;
    emit({ type: 'respawn', rider: R });
  }

  function stepRagdoll(R, dt) {
    const g = 22;
    const stepBody = (pos, vel, rot, ang) => {
      vel[1] -= g * dt;
      pos[0] += vel[0] * dt;
      pos[1] += vel[1] * dt;
      pos[2] += vel[2] * dt;
      rot[0] += ang[0] * dt;
      rot[1] += ang[1] * dt;
      rot[2] += ang[2] * dt;
      const gy = Course.height(pos[0], pos[2]) + 0.30;
      if (pos[1] < gy) {
        pos[1] = gy;
        if (vel[1] < -2.2) {
          vel[1] = -vel[1] * 0.36;
          emit({ type: 'bounce', rider: R, pos: pos.slice(), speed: Math.abs(vel[1]) });
        } else {
          vel[1] = 0;
        }
        vel[0] *= Math.exp(-3.4 * dt);
        vel[2] *= Math.exp(-3.4 * dt);
        ang[0] *= Math.exp(-2.8 * dt);
        ang[1] *= Math.exp(-2.8 * dt);
        ang[2] *= Math.exp(-2.8 * dt);
      }
    };
    stepBody(R.ragPos, R.ragVel, R.ragRot, R.ragAngVel);
    stepBody(R.bikeCrashPos, R.bikeCrashVel, R.bikeCrashRot, R.bikeCrashAngVel);
    R.pos[0] = R.ragPos[0]; R.pos[1] = R.ragPos[1]; R.pos[2] = R.ragPos[2];
    R.s = Math.max(0, -R.pos[2]);
    R.crashTimer -= dt;
    if (R.crashTimer <= 0) respawnRider(R);
  }

  // Upgrade stat multipliers
  function statsOf(R) {
    const u = R.upgrades;
    return {
      topSpeed: 31.5 + u.drive * 2.1,      // ~113 km/h base -> ~144 km/h maxed
      pedalAcc: 8.5 + u.drive * 1.45,
      gripMul: 1.0 + u.tires * 0.11,
      jumpMul: 1.0 + u.fork * 0.085,
      shockAbsorb: 0.55 + u.fork * 0.09,   // higher = less speed lost on heavy landing
      toughness: 1.0 + u.frame * 0.16,
    };
  }

  function stepRider(R, inp, dt, raceTime) {
    if (R.attackTimer > 0) R.attackTimer = Math.max(0, R.attackTimer - dt);
    if (R.attackCd > 0) R.attackCd = Math.max(0, R.attackCd - dt);
    if (R.bottleCd > 0) R.bottleCd = Math.max(0, R.bottleCd - dt);
    if (R.staggerCd > 0) R.staggerCd = Math.max(0, R.staggerCd - dt);
    if (R.nemesisTimer > 0) {
      R.nemesisTimer -= dt;
      if (R.nemesisTimer <= 0) R.nemesis = false;
    }

    if (R.crashed) {
      stepRagdoll(R, dt);
      return;
    }

    const st = statsOf(R);
    const driftStyle = Variants.val.feel === 'b';
    const steerIn = clamp(inp.steer || 0, -1, 1); // -1 left, +1 right
    const pedal = !!inp.pedal;
    const brake = !!inp.brake;
    const jumpHeld = !!inp.jump;
    const wantBoost = !!inp.boost;

    // Adrenaline boost
    if (wantBoost && R.adrenaline > 4 && !R.finished) {
      R.boosting = true;
      R.adrenaline = Math.max(0, R.adrenaline - 26 * dt);
    } else {
      R.boosting = false;
      R.adrenaline = Math.min(100, R.adrenaline + (R.speed > 18 ? 1.8 : 0.6) * dt);
    }

    // Current terrain info
    const s = Math.max(0, -R.pos[2]);
    const sp = Course.at(s);
    const surf = Course.surface(R.pos[0], R.pos[2]);
    const gY = Course.height(R.pos[0], R.pos[2]);
    const nrm = Course.normal(R.pos[0], R.pos[2]);
    R.onTrack = surf.onTrack;
    R.onShortcut = surf.onShortcut;
    R.onRamp = surf.onRamp;
    R.inCreek = !!surf.inCreek;

    // Wobble decay from melee hits
    if (R.wobble > 0) R.wobble = Math.max(0, R.wobble - dt * 1.45);
    const wobSteer = R.wobble > 0 ? Math.sin(raceTime * 28) * 0.45 * R.wobble + R.wobbleDir * 0.55 * R.wobble : 0;

    // Smooth steering
    R.steer = damp(R.steer, clamp(steerIn + wobSteer, -1, 1), R.air ? 5 : 13, dt);

    const hSpeed = Math.hypot(R.vel[0], R.vel[2]);
    const fwdX = -Math.sin(R.yaw), fwdZ = -Math.cos(R.yaw);
    const rgtX = Math.cos(R.yaw), rgtZ = -Math.sin(R.yaw);

    if (!R.air) {
      // ---- GROUNDED PHYSICS ----
      R.skid = (brake && Math.abs(R.steer) > 0.22 && hSpeed > 8) ? (driftStyle ? 1.0 : 0.72) : 0;

      // Turn rate: agile at medium speed, wide sweeping arcs at high speed, tighter when drifting!
      const speedTurn = lerp(2.55, 1.32, smooth(8, 34, hSpeed));
      const driftBonus = R.skid > 0 ? 1.48 : 1.0;
      const turnRate = -R.steer * speedTurn * driftBonus * (0.85 + 0.15 * st.gripMul);
      R.yaw = clamp(R.yaw + turnRate * dt, -1.28, 1.28);

      // Recompute forward after yaw update
      const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
      const rx = Math.cos(R.yaw), rz = -Math.sin(R.yaw);

      // Slope gravity acceleration projected onto horizontal plane (+nrm tilts downhill!)
      const grav = 27.5;
      let ax = nrm[0] * grav * 1.26;
      let az = nrm[2] * grav * 1.26;

      // Pedaling + Adrenaline boost thrust
      const boostMul = R.boosting ? 1.95 : 1.0;
      const pedalThrust = (pedal || R.boosting) ? st.pedalAcc * boostMul * (1 - smooth(st.topSpeed * 0.75, st.topSpeed * (R.boosting ? 1.24 : 1.0), hSpeed)) : 0;
      ax += fx * pedalThrust;
      az += fz * pedalThrust;

      // Braking & aerodynamic / off-track drag
      const dragK = (0.0082 + surf.drag * 0.045) * (R.boosting ? 0.65 : 1.0);
      const brakeDrag = brake ? (R.skid > 0 ? 4.2 : 11.5) : 0;
      const vFwd = R.vel[0] * fx + R.vel[2] * fz;
      const vLat = R.vel[0] * rx + R.vel[2] * rz;

      let newVFwd = vFwd + (ax * fx + az * fz) * dt;
      newVFwd -= newVFwd * Math.abs(newVFwd) * dragK * dt;
      if (brakeDrag > 0 && newVFwd > 3) newVFwd = Math.max(3, newVFwd - brakeDrag * dt);
      newVFwd = clamp(newVFwd, 2.0, st.topSpeed * (R.boosting ? 1.28 : 1.04));

      // Lateral grip: tighter on high-grip tires & berms, looser during drift/volcano sand!
      const latGrip = (R.skid > 0 ? (driftStyle ? 3.2 : 4.8) : 9.8) * surf.grip * st.gripMul;
      const newVLat = vLat * Math.exp(-latGrip * dt) + (ax * rx + az * rz) * dt * 0.35;

      R.vel[0] = fx * newVFwd + rx * newVLat;
      R.vel[2] = fz * newVFwd + rz * newVLat;

      // Jump charging & release (or automatic lip pop!)
      if (jumpHeld) {
        R.charge = Math.min(1, R.charge + dt * 2.4);
      } else if (R.wasJumpHeld && R.charge > 0.06) {
        const pop = (5.4 + 5.6 * R.charge) * st.jumpMul + (R.onRamp ? 3.2 : 0);
        R.vel[1] = Math.max(R.vel[1], 0) + pop;
        R.air = true;
        R.airTime = 0;
        R.airStartY = R.pos[1];
        R.airPeak = R.pos[1];
        R.airStartS = s;
        R.charge = 0;
        R.susp = -0.05;
        emit({ type: 'jump', rider: R, power: pop });
      } else {
        R.charge = damp(R.charge, 0, 10, dt);
      }
      R.wasJumpHeld = jumpHeld;

      // Advance horizontal position & check ground tracking vs real cliff/ramp launches!
      if (R.landGrace > 0) R.landGrace = Math.max(0, R.landGrace - dt);
      const prevY = R.pos[1];
      R.pos[0] += R.vel[0] * dt;
      R.pos[2] += R.vel[2] * dt;
      const nextGY = Course.height(R.pos[0], R.pos[2]);
      const slopeVy = (nextGY - prevY) / Math.max(dt, 1e-4);

      if (!R.air) {
        // ONLY launch off a real kicker ramp, real sheer cliff drop-off (大断崖), or sharp ridge crest (NEVER bounce right after landing!)
        const onDropLedge = surf.dropEdge > 0.35 && slopeVy < -5.8 && hSpeed > 11;
        const suddenCrest = R.landGrace <= 0 && (R.prevSlopeVy - slopeVy) > 10.5 && slopeVy < -6.5 && hSpeed > 16;
        if ((R.onRamp && slopeVy < -2.6 && hSpeed > 12) || onDropLedge || suddenCrest) {
          R.air = true;
          R.airTime = 0;
          R.airStartY = prevY;
          R.airPeak = prevY;
          R.airStartS = s;
          // Preserve upward ramp launch velocity or forward lip pop off sheer cliff drops!
          const popV = R.onRamp ? clamp(hSpeed * 0.42, 5.5, 13.0) : onDropLedge ? clamp(hSpeed * 0.16, 2.5, 5.6) : Math.max(R.prevSlopeVy, 0.5);
          R.vel[1] = Math.max(R.vel[1], popV);
          R.pos[1] = prevY + R.vel[1] * dt;
          emit({ type: 'launch', rider: R, speed: hSpeed });
        } else {
          // Stay firmly planted on terrain, compress suspension over bumps & continue pedaling smoothly!
          const deltaVy = slopeVy - R.vel[1];
          if (deltaVy > 2.2) R.suspV += deltaVy * 0.036;
          if (surf.stairs > 0.15) R.suspV += 0.22 * surf.stairs * Math.sin(s * 1.8);
          R.pos[1] = nextGY;
          R.vel[1] = clamp(slopeVy, -32, 14);
        }
      }
      R.prevSlopeVy = slopeVy;

      // Visual bike pitch & lean roll
      const targetPitch = Math.atan2(nextGY - Course.height(R.pos[0] - fx * 1.4, R.pos[2] - fz * 1.4), 1.4);
      R.pitch = damp(R.pitch, clamp(targetPitch, -0.78, 0.55), 14, dt);
      const targetRoll = clamp(R.steer * 0.52 * smooth(5, 22, hSpeed) + (R.skid > 0 ? R.steer * 0.22 : 0), -0.78, 0.78);
      R.roll = damp(R.roll, targetRoll, 11, dt);

      // Energetic Downhill Domination fast pedaling cadence & wheel spin!
      R.wheelSpin -= newVFwd / 0.40 * dt;
      if (pedal || R.boosting) {
        const rpm = R.boosting ? 29 : lerp(17, 24, sat(newVFwd / 26));
        R.pedalPhase += dt * rpm;
      } else if (newVFwd > 4 && !brake) {
        // Gentle idle cadence coasting on flat/gentle slopes
        R.pedalPhase += dt * 4.5;
      }

    } else {
      // ---- AIRBORNE PHYSICS & MID-AIR TRICKS (Step 5 plugs in seamlessly here) ----
      R.airTime += dt;
      R.skid = 0;
      R.wasJumpHeld = false;
      R.charge = 0;
      R.vel[1] -= 21.5 * dt; // punchy arcade gravity
      // Subtle mid-air steering control so you can line up landings
      R.yaw = clamp(R.yaw - steerIn * 0.55 * dt, -1.28, 1.28);
      R.pos[0] += R.vel[0] * dt;
      R.pos[1] += R.vel[1] * dt;
      R.pos[2] += R.vel[2] * dt;
      if (R.pos[1] > R.airPeak) R.airPeak = R.pos[1];
      R.wheelSpin -= hSpeed / 0.55 * dt;

      // Context-smart Air Tricks (active when airborne > 0.14s)
      if (typeof Stunts !== 'undefined' && Stunts.stepAir) {
        Stunts.stepAir(R, inp, dt);
      } else {
        R.pitch = damp(R.pitch, clamp(R.vel[1] * 0.045, -0.45, 0.45), 6, dt);
        R.roll = damp(R.roll, R.steer * 0.25, 6, dt);
      }

      // Check touchdown
      const nextGY = Course.height(R.pos[0], R.pos[2]);
      if (R.pos[1] <= nextGY) {
        const impactVy = Math.abs(R.vel[1]);
        R.pos[1] = nextGY;
        R.air = false;
        const airDist = Math.max(0, -R.pos[2] - R.airStartS);
        if (airDist > R.bestAirDist) R.bestAirDist = airDist;

        // Complete trick stomp cleanly — NEVER crash on landing!
        if (typeof Stunts !== 'undefined' && Stunts.onLand) {
          Stunts.onLand(R, impactVy, airDist);
        }

        // Suspension absorbs impact & matches downhill terrain slope cleanly (ZERO pogo-bouncing after landing!)
        R.susp = clamp(R.susp + impactVy * 0.018, 0, 0.26);
        R.suspV = impactVy * 0.045;
        const speedLoss = clamp((impactVy - 14) * 0.020 * (1 - st.shockAbsorb * 0.6), 0, 0.20);
        R.vel[0] *= (1 - speedLoss);
        R.vel[2] *= (1 - speedLoss);
        const hSpdL = Math.hypot(R.vel[0], R.vel[2]);
        const fxL = -Math.sin(R.yaw), fzL = -Math.cos(R.yaw);
        const groundSlope = (Course.height(R.pos[0] + fxL * 1.2, R.pos[2] + fzL * 1.2) - nextGY) / 1.2;
        R.vel[1] = clamp(groundSlope * hSpdL, -30, 8);
        R.prevSlopeVy = R.vel[1];
        R.landGrace = 0.36;
        emit({ type: 'land', rider: R, impact: impactVy, airDist, airTime: R.airTime });
      }
    }

    // Suspension spring-damper solver
    const springK = 140, springD = 16;
    const suspF = -springK * R.susp - springD * R.suspV;
    R.suspV += suspF * dt;
    R.susp = clamp(R.susp + R.suspV * dt, -0.07, 0.28);

    // Infinite lateral freedom in Endless Mode; gentle canyon ridge pushback in Career (NEVER crash!)
    R.s = Math.max(0, -R.pos[2]);
    const spNow = Course.at(R.s);
    R.u = R.pos[0] - spNow.cx;
    if (!Course.mode.endless || !R.isPlayer) {
      const cliffSide = R.u < 0 ? spNow.cliffL : spNow.cliffR;
      if (!Course.mode.endless && cliffSide > 0.35 && Math.abs(R.u) > spNow.hw + 20) {
        const sgn = sign(R.u);
        R.vel[0] -= sgn * 18 * dt;
        R.pos[0] = spNow.cx + sgn * Math.min(Math.abs(R.u), spNow.hw + 24);
        R.u = R.pos[0] - spNow.cx;
      }
      const maxU = R.isPlayer ? (spNow.hw + 48) : (spNow.hw + 14);
      if (Math.abs(R.u) > maxU) {
        const sgn = sign(R.u);
        R.pos[0] = spNow.cx + sgn * maxU;
        R.u = sgn * maxU;
        if (R.vel[0] * sgn > 0) R.vel[0] *= -0.25;
      }
    }

    // Obstacle collisions (trees, boulders, basalt spires, houses, barriers): ALWAYS fluid sideways auto-dodge, NEVER pin head-on or crash!
    const obs = Course.obstaclesNear(R.s - 6, R.s + 6, R.pos[0]);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = R.pos[0] - o.x, dz = R.pos[2] - o.z;
      const distSq = dx * dx + dz * dz;
      const minD = o.r + 0.62;
      if (distSq < minD * minD && R.pos[1] < o.y + o.h) {
        const dist = Math.sqrt(distSq) || 0.01;
        // Prefer steering cleanly around the side back toward open valley rather than bouncing backward uphill
        const dodgeSide = Math.abs(dx) > 0.35 ? sign(dx) : (-sign(R.u) || (((R.id + i) & 1) ? 1 : -1));
        const bx = dodgeSide * Math.max(0.84, Math.abs(dx / dist));
        const bz = Math.min(0.15, dz / dist) * 0.35;
        const bLen = Math.hypot(bx, bz) || 1;
        const dnx = bx / bLen, dnz = bz / bLen;
        R.pos[0] = o.x + dnx * (minD + 0.32);
        R.pos[2] = Math.min(R.pos[2], o.z + dnz * (minD + 0.32));
        R.vel[0] = R.vel[0] * 0.35 + dodgeSide * 9.8;
        R.vel[2] = Math.min(R.vel[2] * 0.90, -14.0);
        R.yaw = clamp(R.yaw - dodgeSide * 0.16, -1.05, 1.05);
        R.roll = clamp(R.roll + dodgeSide * 0.36, -0.82, 0.82);
        R.wobble = Math.max(R.wobble, 0.24);
        emit({ type: 'scrape', rider: R, obs: o, pos: [o.x, o.y + 1, o.z] });
        break;
      } else if (R.isPlayer && !R.air && hSpeed > 15 && distSq < (minD + 1.35) * (minD + 1.35) && Math.abs(dz) < 1.2) {
        // Near-miss rush!
        emit({ type: 'nearmiss', rider: R, obs: o, side: sign(o.x - R.pos[0]) || 1 });
      }
    }

    R.speed = Math.hypot(R.vel[0], R.vel[2]);
    if (R.speed > R.maxSpeed) R.maxSpeed = R.speed;

    // Finish line check
    if (!R.finished && !Course.mode.endless && R.s >= Course.finishS) {
      R.finished = true;
      R.finishTime = raceTime;
      emit({ type: 'finish', rider: R, time: raceTime });
    }
  }

  return {
    events,
    createRider,
    stepRider,
    triggerCrash,
    respawnRider,
    statsOf,
    drainEvents() { const copy = events.slice(); events.length = 0; return copy; },
  };
})();
