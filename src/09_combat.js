// ---------------------------------------------------------------- 09_combat: melee shove/kick/bat, thrown water bottles, body checks & Nemesis revenge
const Combat = (() => {
  const TIER_NAMES = ['推搡', '飞踹', '水壶砸击', '球棒暴击'];
  const projectiles = []; // { x, y, z, vx, vy, vz, owner, target, ttl, spin, kind }
  const combatEvents = [];

  function reset() {
    projectiles.length = 0;
    combatEvents.length = 0;
  }

  function applyMeleeHit(attacker, victim, side, raceTime) {
    const tier = attacker.combatTier || 0;
    const power = (1.0 + tier * 0.34 + (attacker.upgrades.combat || 0) * 0.14) / (1 + (victim.upgrades.frame || 0) * 0.12);
    const pushX = side * (7.5 + power * 4.5);
    victim.vel[0] += pushX;
    victim.wobble = clamp(victim.wobble + 0.72 * power, 0, 1.5);
    victim.wobbleDir = side;
    victim.lastHitBy = attacker;
    victim.lastHitTime = raceTime;

    Particles.burstImpact(victim.pos, tier >= 3 ? [1.9, 0.38, 0.12] : [1.8, 0.85, 0.22], tier >= 3 ? 24 : 14);

    // Direct stagger / dodge-aside knockback (zero ragdoll crash!)
    const instantKO = tier >= 3 || attacker.boosting || victim.wobble > 1.05 || (tier >= 1 && Math.random() < 0.34);
    if (instantKO) {
      const canCount = victim.staggerCd <= 0;
      Physics.triggerCrash(victim, 'melee_ko', pushX * 0.85, -3, attacker);
      if (canCount) registerTakedown(attacker, victim);
    } else {
      combatEvents.push({ type: 'hit', attacker, victim, tier, side });
      if (attacker.isPlayer || victim.isPlayer) {
        Sound.playHit(tier >= 2);
        Feel.jolt(attacker.isPlayer ? 0.24 : 0.38, attacker.isPlayer ? 0.22 : 0.42, attacker.isPlayer ? 0.035 : 0.02);
      }
    }
  }

  function registerTakedown(attacker, victim) {
    if (!attacker || attacker === victim) return;
    attacker.takedowns++;
    attacker.adrenaline = Math.min(100, attacker.adrenaline + 28);
    if (attacker.combatTier < 3) attacker.combatTier++;
    if (attacker.bottles < 3) attacker.bottles++;

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

  // Context-smart attack: close rival -> melee strike; rival ahead -> hurl water bottle/wrench!
  function tryAttack(R, side, allRiders, raceTime) {
    if (R.crashed || R.finished || R.attackCd > 0) return;

    // 1. Check melee candidates nearby
    let meleeTarget = null, bestD = 999;
    for (let i = 0; i < allRiders.length; i++) {
      const T = allRiders[i];
      if (T === R || T.crashed || T.finished) continue;
      const ds = Math.abs(T.s - R.s);
      const dx = T.pos[0] - R.pos[0];
      if (ds < 3.4 && Math.abs(dx) < 3.5) {
        const d = Math.hypot(ds, dx);
        // Prefer rival on the pressed side, but smart-snap if super close
        if (dx * side >= -0.8 && d < bestD) { bestD = d; meleeTarget = T; }
      }
    }

    if (meleeTarget) {
      const actualSide = sign(meleeTarget.pos[0] - R.pos[0]) || side;
      R.attackSide = actualSide;
      R.attackTimer = 0.34;
      R.attackCd = 0.42;
      R.attackKind = R.combatTier === 1 ? 'kick' : R.combatTier >= 3 ? 'bat' : 'punch';
      applyMeleeHit(R, meleeTarget, actualSide, raceTime);
      return;
    }

    // 2. No melee target -> check forward cone for Bottle / Wrench throw!
    if (R.bottles > 0 && R.bottleCd <= 0) {
      let throwTarget = null, bestDist = 42;
      for (let i = 0; i < allRiders.length; i++) {
        const T = allRiders[i];
        if (T === R || T.crashed || T.finished) continue;
        const ds = T.s - R.s;
        const du = Math.abs(T.pos[0] - R.pos[0]);
        if (ds > 3.5 && ds < bestDist && du < 9.5) {
          bestDist = ds;
          throwTarget = T;
        }
      }
      if (throwTarget) {
        R.bottles--;
        R.bottleCd = 1.6 - (R.upgrades.combat || 0) * 0.2;
        R.attackSide = side;
        R.attackTimer = 0.28;
        R.attackCd = 0.35;
        R.attackKind = 'throw';
        const fx = -Math.sin(R.yaw), fz = -Math.cos(R.yaw);
        const startPos = [R.pos[0] + side * 0.45, R.pos[1] + 1.55, R.pos[2] + fz * 0.5];
        const leadPos = [throwTarget.pos[0] + throwTarget.vel[0] * 0.35, throwTarget.pos[1] + 1.25, throwTarget.pos[2] + throwTarget.vel[2] * 0.35];
        const dir = v3.norm(v3.sub(leadPos, startPos));
        const spd = Math.max(R.speed + 24, 46);
        projectiles.push({
          x: startPos[0], y: startPos[1], z: startPos[2],
          vx: dir[0] * spd, vy: dir[1] * spd + 2.8, vz: dir[2] * spd,
          owner: R, target: throwTarget, ttl: 1.4, spin: 0,
          kind: R.combatTier >= 3 ? 'wrench' : 'bottle',
        });
        if (R.isPlayer) Sound.playWhoosh();
        combatEvents.push({ type: 'throw', attacker: R, target: throwTarget });
        return;
      }
    }

    // 3. Whiff swing animation (still feels responsive!)
    R.attackSide = side;
    R.attackTimer = 0.28;
    R.attackCd = 0.36;
    R.attackKind = R.combatTier === 1 ? 'kick' : R.combatTier >= 3 ? 'bat' : 'punch';
    if (R.isPlayer) Sound.playWhoosh();
  }

  // Step projectiles, rider-vs-rider collisions & indirect takedowns
  function step(allRiders, dt, raceTime) {
    // Passive bottle refill so players always get to throw toys
    for (let i = 0; i < allRiders.length; i++) {
      const R = allRiders[i];
      if (R.bottles < 1 && R.bottleCd <= 0) {
        R.bottles = 1;
        R.bottleCd = 6.5 - (R.upgrades.combat || 0) * 0.8;
      }
    }

    // 1. Update flying bottles / wrenches with subtle homing assist
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.ttl -= dt;
      p.spin += dt * 18;
      if (p.target && !p.target.crashed) {
        const tx = p.target.pos[0], ty = p.target.pos[1] + 1.25, tz = p.target.pos[2];
        const d = v3.sub([tx, ty, tz], [p.x, p.y, p.z]);
        const dist = v3.len(d);
        if (dist < 1.55) {
          // DIRECT HEADSHOT STAGGER!
          Particles.burstImpact([p.x, p.y, p.z], [0.22, 0.92, 1.0], 22);
          p.target.lastHitBy = p.owner;
          p.target.lastHitTime = raceTime;
          const canCount = p.target.staggerCd <= 0;
          Physics.triggerCrash(p.target, 'bottle_ko', (Math.random() - 0.5) * 6, -4, p.owner);
          if (canCount) registerTakedown(p.owner, p.target);
          projectiles.splice(i, 1);
          continue;
        }
        // Subtle homing curve so arcade throws feel awesome at 90 km/h
        const dir = v3.mul(d, 1 / Math.max(dist, 0.01));
        const curSpd = Math.hypot(p.vx, p.vy, p.vz);
        p.vx = lerp(p.vx, dir[0] * curSpd, 4.5 * dt);
        p.vy = lerp(p.vy, dir[1] * curSpd, 4.5 * dt);
        p.vz = lerp(p.vz, dir[2] * curSpd, 4.5 * dt);
      } else {
        p.vy -= 14 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.ttl <= 0 || p.y < Course.height(p.x, p.z)) {
        Particles.burstImpact([p.x, p.y, p.z], [0.5, 0.85, 1.0], 8);
        projectiles.splice(i, 1);
      }
    }

    // 2. Rider-vs-rider physical jostling & Boost-Ram takedowns
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

          // Adrenaline Overdrive Dodge-Shove!
          if (A.boosting && !B.boosting) {
            const canCount = B.staggerCd <= 0;
            Physics.triggerCrash(B, 'boost_ram', nx * 9, nz * 5, A);
            if (canCount) registerTakedown(A, B);
          } else if (B.boosting && !A.boosting) {
            const canCount = A.staggerCd <= 0;
            Physics.triggerCrash(A, 'boost_ram', -nx * 9, -nz * 5, B);
            if (canCount) registerTakedown(B, A);
          } else {
            // Side-by-side paint trading!
            A.vel[0] -= nx * 2.8; B.vel[0] += nx * 2.8;
            if (A.isPlayer || B.isPlayer) {
              Sound.playHit(false);
              Feel.jolt(0.14, 0.10, 0);
            }
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
    projectiles,
    reset,
    tryAttack,
    registerTakedown,
    step,
    emitProjectiles,
    drainEvents() { const out = combatEvents.slice(); combatEvents.length = 0; return out; },
  };
})();
