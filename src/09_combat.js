// ---------------------------------------------------------------- 09_combat: human punch/flying-kick, limited pickup bottles (bounded homing), nitro pickups & strict KO rules
const Combat = (() => {
  const TIER_NAMES = ['推搡', '飞踹', '水壶砸击', '球棒暴击'];
  const MAX_BOTTLE_TRACK = 26.0; // max distance (m) a thrown bottle can home
  const projectiles = []; // { x, y, z, vx, vy, vz, owner, target, ttl, spin, kind, traveled, maxHoming }
  const combatEvents = [];

  function reset() {
    projectiles.length = 0;
    combatEvents.length = 0;
  }

  function applyMeleeHit(attacker, victim, side, kind, raceTime) {
    const tier = attacker.combatTier || 0;
    const power = (1.0 + tier * 0.30 + (attacker.upgrades.combat || 0) * 0.14) / (1 + (victim.upgrades.frame || 0) * 0.12);
    const pushX = side * (7.5 + power * 4.5);
    victim.vel[0] += pushX;
    victim.wobble = clamp(victim.wobble + 0.72 * power, 0, 1.45);
    victim.wobbleDir = side;
    victim.lastHitBy = attacker;
    victim.lastHitTime = raceTime;

    Particles.burstImpact(victim.pos, kind === 'kick' ? [1.9, 0.38, 0.12] : [1.8, 0.85, 0.22], kind === 'kick' ? 24 : 14);

    if (kind === 'kick') {
      // Close-range flying kick: knocks target flying into ragdoll + respawn (when knockdowns enabled)!
      const canCount = !victim.crashed && victim.staggerCd <= 0;
      Physics.knockdownRider(victim, 'kick_ko', pushX * 0.95, -3.5, attacker);
      if (canCount) registerTakedown(attacker, victim);
      if (attacker.isPlayer || victim.isPlayer) {
        if (Sound.playKick) Sound.playKick(true);
        else Sound.playHit(true);
        Feel.jolt(attacker.isPlayer ? 0.32 : 0.48, attacker.isPlayer ? 0.30 : 0.50, 0.04);
      }
    } else {
      // Punch: shoves rival sideways cleanly & boosts adrenaline — NEVER knocks rider off bike!
      victim.vel[0] += pushX * 0.85;
      attacker.adrenaline = Math.min(100, attacker.adrenaline + 12);
      combatEvents.push({ type: 'punch_hit', attacker, victim, tier, side });
      if (attacker.isPlayer || victim.isPlayer) {
        if (Sound.playPunch) Sound.playPunch(true);
        else Sound.playHit(false);
        Feel.jolt(attacker.isPlayer ? 0.24 : 0.36, attacker.isPlayer ? 0.20 : 0.38, 0.025);
      }
    }
  }

  function registerTakedown(attacker, victim) {
    if (!attacker || attacker === victim) return;
    attacker.takedowns++;
    attacker.adrenaline = Math.min(100, attacker.adrenaline + 28);
    if (attacker.combatTier < 3) attacker.combatTier++;

    const wasNemesis = !!victim.nemesis;
    const bounty = wasNemesis ? 500 : 250;

    // Victim becomes an enraged red-eyed NEMESIS when they respawn!
    if (attacker.isPlayer && !victim.isPlayer) {
      victim.nemesis = true;
      victim.nemesisTimer = 24;
      Feel.jolt(0.45, 0.48, 0.048);
      Sound.playTakedown();
    } else if (victim.isPlayer) {
      Feel.jolt(0.55, 0.65, 0.05);
      Sound.playCrash();
    }

    combatEvents.push({
      type: 'takedown',
      attacker,
      victim,
      bounty,
      wasNemesis,
    });
  }

  // Context-smart attack: close rival -> random punch/flying-kick; rival in 4..25m ahead with bottle -> throw bottle; else whiff punch/kick
  function tryAttack(R, side, allRiders, raceTime, forceKind = null) {
    if (R.crashed || R.finished || R.attackCd > 0) return;

    // 1. Check close-range melee candidates nearby
    let meleeTarget = null, bestD = 999;
    for (let i = 0; i < allRiders.length; i++) {
      const T = allRiders[i];
      if (T === R || T.crashed || T.finished) continue;
      const ds = Math.abs(T.s - R.s);
      const dx = T.pos[0] - R.pos[0];
      if (ds < 3.6 && Math.abs(dx) < 3.6) {
        const d = Math.hypot(ds, dx);
        if (dx * side >= -0.9 && d < bestD) { bestD = d; meleeTarget = T; }
      }
    }

    if (meleeTarget) {
      const actualSide = sign(meleeTarget.pos[0] - R.pos[0]) || side;
      const kind = forceKind || (Math.random() < 0.5 ? 'kick' : 'punch');
      R.attackSide = actualSide;
      R.attackKind = kind;
      R.attackDur = kind === 'kick' ? 0.42 : 0.36;
      R.attackTimer = R.attackDur;
      R.attackCd = 0.46;
      applyMeleeHit(R, meleeTarget, actualSide, kind, raceTime);
      return;
    }

    // 2. Throw picked-up water bottle at rival within limited 25m tracking range
    if (forceKind !== 'punch' && forceKind !== 'kick' && R.bottles > 0 && R.bottleCd <= 0) {
      let throwTarget = null, bestDist = 25.0;
      for (let i = 0; i < allRiders.length; i++) {
        const T = allRiders[i];
        if (T === R || T.crashed || T.finished) continue;
        const ds = T.s - R.s;
        const du = Math.abs(T.pos[0] - R.pos[0]);
        if (ds > 4.0 && ds < bestDist && du < 7.0) {
          bestDist = ds;
          throwTarget = T;
        }
      }
      if (throwTarget) {
        R.bottles--;
        R.bottleCd = 1.4 - (R.upgrades.combat || 0) * 0.15;
        R.attackSide = side;
        R.attackKind = 'throw';
        R.attackDur = 0.32;
        R.attackTimer = R.attackDur;
        R.attackCd = 0.40;
        const fz = -Math.cos(R.yaw);
        const startPos = [R.pos[0] + side * 0.45, R.pos[1] + 1.55, R.pos[2] + fz * 0.5];
        const leadPos = [throwTarget.pos[0] + throwTarget.vel[0] * 0.32, throwTarget.pos[1] + 1.25, throwTarget.pos[2] + throwTarget.vel[2] * 0.32];
        const dir = v3.norm(v3.sub(leadPos, startPos));
        const spd = Math.max(R.speed + 24, 46);
        projectiles.push({
          x: startPos[0], y: startPos[1], z: startPos[2],
          vx: dir[0] * spd, vy: dir[1] * spd + 2.4, vz: dir[2] * spd,
          owner: R, target: throwTarget, ttl: 1.15, spin: 0,
          traveled: 0, maxHoming: MAX_BOTTLE_TRACK,
          kind: 'bottle',
        });
        if (R.isPlayer) Sound.playWhoosh();
        combatEvents.push({ type: 'throw', attacker: R, target: throwTarget });
        return;
      }
    }

    // 3. Random Punch or Flying Kick whiff animation + distinct athletic SFX
    const kind = forceKind || (Math.random() < 0.5 ? 'kick' : 'punch');
    R.attackSide = side;
    R.attackKind = kind;
    R.attackDur = kind === 'kick' ? 0.42 : 0.36;
    R.attackTimer = R.attackDur;
    R.attackCd = 0.42;
    if (R.isPlayer) {
      if (kind === 'kick' && Sound.playKick) Sound.playKick(false);
      else if (kind === 'punch' && Sound.playPunch) Sound.playPunch(false);
      else Sound.playWhoosh();
    }
  }

  function stepPickups(allRiders) {
    if (typeof Course === 'undefined' || !Course.pickupsNear) return;
    for (let i = 0; i < allRiders.length; i++) {
      const R = allRiders[i];
      if (R.crashed || R.finished) continue;
      const nearby = Course.pickupsNear(R.s - 3.5, R.s + 5.5, R.pos[0]);
      for (let k = 0; k < nearby.length; k++) {
        const pk = nearby[k];
        const dx = R.pos[0] - pk.x, dz = R.pos[2] - pk.z, dy = R.pos[1] + 0.9 - pk.y;
        if (dx * dx + dz * dz < 2.65 * 2.65 && Math.abs(dy) < 3.0) {
          Course.collectPickup(pk.id);
          if (pk.kind === 'nitro') {
            R.adrenaline = Math.min(100, R.adrenaline + 48);
            const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
            R.vel[0] += fx * 2.2;
            R.vel[2] += fz * 2.2;
            Particles.burstImpact([pk.x, pk.y, pk.z], [1.4, 0.78, 0.16], 18);
            if (R.isPlayer && Sound.playPickup) Sound.playPickup('nitro');
            combatEvents.push({ type: 'pickup', kind: 'nitro', rider: R });
          } else {
            R.bottles = Math.min(3, R.bottles + 1);
            Particles.burstImpact([pk.x, pk.y, pk.z], [0.22, 0.88, 1.0], 18);
            if (R.isPlayer && Sound.playPickup) Sound.playPickup('bottle');
            combatEvents.push({ type: 'pickup', kind: 'bottle', rider: R, count: R.bottles });
          }
        }
      }
    }
  }

  // Step road pickups, bounded-homing bottles & paint-trading bumps (bumps NEVER knock riders off bike!)
  function step(allRiders, dt, raceTime) {
    stepPickups(allRiders);

    // 1. Update flying water bottles with strict MAX_BOTTLE_TRACK homing cap
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.ttl -= dt;
      p.spin += dt * 18;
      const homingActive = p.target && !p.target.crashed && p.traveled < (p.maxHoming || MAX_BOTTLE_TRACK);
      if (p.target && !p.target.crashed) {
        const tx = p.target.pos[0], ty = p.target.pos[1] + 1.25, tz = p.target.pos[2];
        const d = v3.sub([tx, ty, tz], [p.x, p.y, p.z]);
        const dist = v3.len(d);
        if (dist < 1.55) {
          // DIRECT BOTTLE HIT KNOCKDOWN!
          Particles.burstImpact([p.x, p.y, p.z], [0.22, 0.92, 1.0], 24);
          p.target.lastHitBy = p.owner;
          p.target.lastHitTime = raceTime;
          const canCount = !p.target.crashed && p.target.staggerCd <= 0;
          Physics.knockdownRider(p.target, 'bottle_ko', (Math.random() - 0.5) * 7, -4, p.owner);
          if (canCount) registerTakedown(p.owner, p.target);
          projectiles.splice(i, 1);
          continue;
        }
        if (homingActive && dist < 24.0 && p.target.s > (-p.z - 1.5)) {
          const dir = v3.mul(d, 1 / Math.max(dist, 0.01));
          const curSpd = Math.hypot(p.vx, p.vy, p.vz);
          p.vx = lerp(p.vx, dir[0] * curSpd, 4.2 * dt);
          p.vy = lerp(p.vy, dir[1] * curSpd, 4.2 * dt);
          p.vz = lerp(p.vz, dir[2] * curSpd, 4.2 * dt);
        } else {
          p.vy -= 16 * dt;
        }
      } else {
        p.vy -= 16 * dt;
      }
      const dx = p.vx * dt, dy = p.vy * dt, dz = p.vz * dt;
      p.x += dx; p.y += dy; p.z += dz;
      p.traveled += Math.hypot(dx, dy, dz);
      if (p.ttl <= 0 || p.y < Course.height(p.x, p.z)) {
        Particles.burstImpact([p.x, p.y, p.z], [0.5, 0.85, 1.0], 8);
        projectiles.splice(i, 1);
      }
    }

    // 2. Rider-vs-rider physical jostling & lateral shove (bike collisions NEVER knock riders down!)
    for (let i = 0; i < allRiders.length; i++) {
      const A = allRiders[i];
      if (A.crashed || A.finished) continue;
      for (let j = i + 1; j < allRiders.length; j++) {
        const B = allRiders[j];
        if (B.crashed || B.finished) continue;
        const dx = B.pos[0] - A.pos[0], dy = B.pos[1] - A.pos[1], dz = B.pos[2] - A.pos[2];
        if (Math.abs(dy) > 1.7) continue;
        const d2 = dx * dx + dz * dz;
        const minD = 1.38;
        if (d2 < minD * minD && d2 > 1e-5) {
          const dist = Math.sqrt(d2);
          const nx = dx / dist, nz = dz / dist;
          const sep = (minD - dist) * 0.52;
          A.pos[0] -= nx * sep; A.pos[2] -= nz * sep;
          B.pos[0] += nx * sep; B.pos[2] += nz * sep;

          // Pure lateral bump / paint trading (zero knockdown!)
          const boostPush = (A.boosting && !B.boosting) ? 5.2 : (B.boosting && !A.boosting) ? -5.2 : 0;
          A.vel[0] -= nx * 3.8 + (boostPush < 0 ? 4.0 : 0);
          B.vel[0] += nx * 3.8 + (boostPush > 0 ? 4.0 : 0);
          if (boostPush > 0) { B.wobble = Math.max(B.wobble, 0.42); B.wobbleDir = sign(nx) || 1; }
          else if (boostPush < 0) { A.wobble = Math.max(A.wobble, 0.42); A.wobbleDir = -sign(nx) || -1; }
          if (A.isPlayer || B.isPlayer) {
            Sound.playHit(false);
            Feel.jolt(0.16, 0.12, 0);
          }
        }
      }
    }
  }

  function emitProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      const col = p.kind === 'wrench' ? [0.95, 0.72, 0.16] : [0.16, 0.88, 1.0];
      Solid.pushTRS('cyl', [p.x, p.y, p.z], p.spin, p.spin * 0.7, 0, [0.22, 0.56, 0.22], col, -1.0);
    }
  }

  return {
    TIER_NAMES,
    MAX_BOTTLE_TRACK,
    projectiles,
    reset,
    tryAttack,
    registerTakedown,
    step,
    emitProjectiles,
    drainEvents() { const out = combatEvents.slice(); combatEvents.length = 0; return out; },
  };
})();
