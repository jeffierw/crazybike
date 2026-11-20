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

      // Adrenaline, Tricks & Boost (used heavily in Step 5)
      adrenaline: 25,   // 0..100
      boosting: false,
      trickType: null,  // 'superman' | 'whip' | 'backflip' | 'spin360'
      trickPhase: 0,    // 0..1+ animation depth
      trickHeld: false,
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

  function triggerCrash(R, reason, impulseX = 0, impulseZ = 0, attacker = null) {
    if (R.crashed || R.finished) return;
    R.crashed = true;
    R.crashTimer = R.isPlayer ? 1.35 : 1.75;
    R.crashes++;
    R.boosting = false;
    R.trickType = null;
    R.trickHeld = false;
    R.trickScore = 0;
    R.trickCombo = 0;
    R.trickYaw = R.trickPitch = R.trickRoll = 0;
    R.adrenaline = Math.max(0, R.adrenaline - 35);
    R.wobble = 0;

    // Detach rider and bike into independent tumbling trajectories!
    R.ragPos = [R.pos[0], R.pos[1] + 1.15, R.pos[2]];
    R.ragVel = [R.vel[0] * 0.72 + impulseX + (Math.random() - 0.5) * 3, Math.max(4.5, Math.abs(R.vel[1]) * 0.4 + 5.2), R.vel[2] * 0.72 + impulseZ];
    R.ragRot = [R.pitch, R.yaw, R.roll];
    R.ragAngVel = [6 + Math.random() * 5, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 9];

    R.bikeCrashPos = [R.pos[0], R.pos[1] + 0.45, R.pos[2]];
    R.bikeCrashVel = [R.vel[0] * 0.55 - impulseX * 0.5 + (Math.random() - 0.5) * 4, 4.2 + Math.random() * 2.5, R.vel[2] * 0.55];
    R.bikeCrashRot = [R.pitch, R.yaw, R.roll];
    R.bikeCrashAngVel = [8 + Math.random() * 6, (Math.random() - 0.5) * 10, 7 + Math.random() * 6];

    emit({ type: 'crash', rider: R, reason, attacker: attacker || R.lastHitBy, pos: R.pos.slice() });
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
      const grav = 24.5;
      let ax = nrm[0] * grav * 1.28;
      let az = nrm[2] * grav * 1.28;

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

      // Advance horizontal position & check ground tracking vs ramp launch!
      const prevY = R.pos[1];
      R.pos[0] += R.vel[0] * dt;
      R.pos[2] += R.vel[2] * dt;
      const nextGY = Course.height(R.pos[0], R.pos[2]);
      const slopeVy = (nextGY - prevY) / Math.max(dt, 1e-4);

      if (!R.air) {
        // Detect launching cleanly off a kicker lip or steep cliff drop!
        const dropRate = R.vel[1] - slopeVy;
        if ((R.onRamp && slopeVy < -3.0 && hSpeed > 13) || (dropRate > 7.5 && hSpeed > 14)) {
          R.air = true;
          R.airTime = 0;
          R.airStartY = prevY;
          R.airPeak = prevY;
          R.airStartS = s;
          // Preserve upward ramp launch velocity + natural kicker pop
          R.vel[1] = Math.max(R.vel[1], R.onRamp ? clamp(hSpeed * 0.36, 4.5, 11.5) : 1.5);
          R.pos[1] = prevY + R.vel[1] * dt;
          emit({ type: 'launch', rider: R, speed: hSpeed });
        } else {
          // Stick to terrain & compress suspension over bumps/stairs
          const deltaVy = slopeVy - R.vel[1];
          if (deltaVy > 1.5) R.suspV += deltaVy * 0.045;
          if (surf.stairs > 0.15) R.suspV += 0.25 * surf.stairs * Math.sin(s * 1.8);
          R.pos[1] = nextGY;
          R.vel[1] = clamp(slopeVy, -24, 14);
        }
      }

      // Visual bike pitch & lean roll
      const targetPitch = Math.atan2(nextGY - Course.height(R.pos[0] - fx * 1.4, R.pos[2] - fz * 1.4), 1.4);
      R.pitch = damp(R.pitch, clamp(targetPitch, -0.65, 0.55), 14, dt);
      const targetRoll = clamp(R.steer * 0.52 * smooth(5, 22, hSpeed) + (R.skid > 0 ? R.steer * 0.22 : 0), -0.78, 0.78);
      R.roll = damp(R.roll, targetRoll, 11, dt);

      // Pedaling & wheel spin animation
      R.wheelSpin -= newVFwd / 0.42 * dt;
      if (pedal || R.boosting) R.pedalPhase += dt * (R.boosting ? 15 : 10);

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

        // Check greedy mid-air trick crash OR clean stomp landing!
        let bailCrash = false;
        if (typeof Stunts !== 'undefined' && Stunts.onLand) {
          bailCrash = Stunts.onLand(R, impactVy, airDist);
        }
        if (bailCrash) {
          triggerCrash(R, 'trick_bail', (Math.random() - 0.5) * 4, 0, null);
          return;
        }

        // Suspension absorbs impact!
        R.susp = clamp(R.susp + impactVy * 0.020, 0, 0.28);
        R.suspV = impactVy * 0.05;
        const speedLoss = clamp((impactVy - 11) * 0.024 * (1 - st.shockAbsorb * 0.6), 0, 0.24);
        R.vel[0] *= (1 - speedLoss);
        R.vel[2] *= (1 - speedLoss);
        R.vel[1] = 0;
        emit({ type: 'land', rider: R, impact: impactVy, airDist, airTime: R.airTime });
      }
    }

    // Suspension spring-damper solver
    const springK = 140, springD = 16;
    const suspF = -springK * R.susp - springD * R.suspV;
    R.suspV += suspF * dt;
    R.susp = clamp(R.susp + R.suspV * dt, -0.07, 0.28);

    // Track corridor soft-bank containment so riders never escape the canyon
    R.s = Math.max(0, -R.pos[2]);
    const spNow = Course.at(R.s);
    R.u = R.pos[0] - spNow.cx;
    const maxU = spNow.hw + 24;
    if (Math.abs(R.u) > maxU) {
      const sgn = sign(R.u);
      R.pos[0] = spNow.cx + sgn * maxU;
      R.u = sgn * maxU;
      if (R.vel[0] * sgn > 0) R.vel[0] *= -0.35;
    }

    // Obstacle collisions (trees, boulders, basalt spires, houses, barriers)
    const obs = Course.obstaclesNear(R.s - 6, R.s + 6);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = R.pos[0] - o.x, dz = R.pos[2] - o.z;
      const distSq = dx * dx + dz * dz;
      const minD = o.r + 0.62;
      if (distSq < minD * minD && R.pos[1] < o.y + o.h) {
        const dist = Math.sqrt(distSq) || 0.01;
        const nx = dx / dist, nz = dz / dist;
        // Push out
        R.pos[0] = o.x + nx * minD;
        R.pos[2] = o.z + nz * minD;
        const headOn = -(R.vel[0] * nx + R.vel[2] * nz);
        const crashSpeed = (11.5 + (R.wobble > 0.2 ? -4.5 : 0)) * st.toughness;
        if (headOn > crashSpeed && !R.boosting) {
          const recentAttacker = (raceTime - R.lastHitTime < 3.5) ? R.lastHitBy : null;
          triggerCrash(R, 'obstacle', nx * 5, nz * 5, recentAttacker);
          return;
        } else {
          // Glancing scrape / boost smash!
          R.vel[0] = R.vel[0] * 0.72 + nx * 6.5;
          R.vel[2] = R.vel[2] * 0.72 + nz * 6.5;
          R.wobble = Math.max(R.wobble, 0.45);
          emit({ type: 'scrape', rider: R, obs: o, pos: [o.x, o.y + 1, o.z] });
        }
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
