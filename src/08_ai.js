// ---------------------------------------------------------------- 08_ai: 7 physics-driven AI rivals, adaptive skill+upgrade matchmaking & endless traffic
const AI = (() => {
  const ROSTER = [
    { name: '疯狗杰克', en: 'Mad Jack',    personality: 'brawler',   frameCol: [0.88, 0.14, 0.16], jerseyCol: [0.18, 0.18, 0.22], helmetCol: [0.96, 0.25, 0.18], role: 'pack',  band: 'match',  relTier:  0.00, relPace:  0.004 },
    { name: '闪电艾娃', en: 'Bolt Ava',    personality: 'speedster', frameCol: [0.10, 0.84, 0.94], jerseyCol: [0.96, 0.96, 0.98], helmetCol: [0.12, 0.88, 0.96], role: 'lead',  band: 'strong', relTier:  0.35, relPace:  0.025 },
    { name: '飞人里奥', en: 'Sky Leo',     personality: 'showoff',   frameCol: [0.45, 0.95, 0.18], jerseyCol: [0.14, 0.24, 0.16], helmetCol: [0.62, 1.00, 0.22], role: 'pack',  band: 'match',  relTier:  0.00, relPace: -0.006 },
    { name: '铁锤布鲁', en: 'Sledge Bru',  personality: 'brawler',   frameCol: [0.96, 0.56, 0.10], jerseyCol: [0.34, 0.22, 0.12], helmetCol: [0.95, 0.68, 0.14], role: 'chase', band: 'weak',   relTier: -0.55, relPace: -0.045 },
    { name: '幽灵凯',   en: 'Ghost Kai',   personality: 'speedster', frameCol: [0.64, 0.28, 0.96], jerseyCol: [0.16, 0.14, 0.26], helmetCol: [0.82, 0.45, 1.00], role: 'pack',  band: 'match',  relTier:  0.15, relPace:  0.012 },
    { name: '野猫米娅', en: 'Wildcat Mia', personality: 'showoff',   frameCol: [0.96, 0.22, 0.64], jerseyCol: [0.22, 0.14, 0.22], helmetCol: [1.00, 0.42, 0.76], role: 'chase', band: 'weak',   relTier: -0.80, relPace: -0.070 },
    { name: '山大王雷克斯', en: 'King Rex', personality: 'boss',      frameCol: [0.98, 0.78, 0.14], jerseyCol: [0.12, 0.12, 0.14], helmetCol: [1.00, 0.86, 0.22], role: 'lead',  band: 'strong', relTier:  0.55, relPace:  0.045 },
  ];

  // Adaptive skill calculation blending player upgrade average + player skill EMA + course difficulty
  function skillFor(diff, r, avgUpg = 0, playerSkill = 0.42) {
    const baseTier = clamp(avgUpg + (playerSkill - 0.45) * 0.85 + diff * 0.10, 0, 4);
    const tier = clamp(Math.round(baseTier + r.relTier), 0, 4);
    const bandShift = r.band === 'strong' ? 0.12 : r.band === 'weak' ? -0.10 : 0;
    const sNorm = clamp((baseTier / 4) * 0.55 + playerSkill * 0.45 + bandShift, 0.15, 0.96);
    const pers = r.personality;
    const isBoss = pers === 'boss';
    return {
      lookAhead:    lerp(0.55, 1.15, sNorm) + (pers === 'speedster' || isBoss ? 0.12 : 0),
      shortcutRate: lerp(0.18, 0.78, sNorm) + (pers === 'speedster' ? 0.14 : 0),
      trickSkill:   lerp(0.28, 0.90, sNorm) + (pers === 'showoff' || isBoss ? 0.14 : 0),
      aggro:        lerp(0.24, 0.84, sNorm) + (pers === 'brawler' || isBoss ? 0.15 : 0),
      bikeTier:     tier,
    };
  }

  function resolvePlayerCtx(diff, playerCtx) {
    if (playerCtx && typeof playerCtx === 'object') {
      return {
        avgUpg: clamp(+playerCtx.avgUpg || 0, 0, 4),
        playerSkill: clamp(playerCtx.playerSkill !== undefined ? +playerCtx.playerSkill : 0.42, 0.15, 0.95),
      };
    }
    if (typeof Career !== 'undefined' && Career.avgUpgrade && Career.data) {
      return {
        avgUpg: clamp(Career.avgUpgrade(), 0, 4),
        playerSkill: clamp(Career.data.playerSkill ?? 0.42, 0.15, 0.95),
      };
    }
    return { avgUpg: clamp(diff, 0, 3), playerSkill: 0.42 };
  }

  function spawnPack(diff = 0, playerCtx = null) {
    const pCtx = resolvePlayerCtx(diff, playerCtx);
    const rivals = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const r = ROSTER[i];
      const sk = skillFor(diff, r, pCtx.avgUpg, pCtx.playerSkill);
      const t = sk.bikeTier;
      const paceMul = clamp(0.955 + (pCtx.playerSkill - 0.42) * 0.14 + r.relPace + diff * 0.012, 0.84, 1.09);
      const startRow = Math.floor((i + 1) / 2);
      const startCol = ((i % 2) === 0 ? -1 : 1) * (2.6 + (i % 3) * 1.4);
      const startS = Course.mode.endless ? (28 + i * 24) : (14 + startRow * 3.8);
      const rider = Physics.createRider({
        id: i + 1,
        name: r.name,
        isPlayer: false,
        personality: r.personality,
        skill: sk,
        upgrades: { frame: t, fork: t, drive: t, tires: t, combat: t },
        frameCol: r.frameCol,
        jerseyCol: r.jerseyCol,
        helmetCol: r.helmetCol,
        s: startS,
        u: startCol,
        initSpeed: 9.5 + (r.band === 'strong' ? 0.8 : r.band === 'weak' ? -0.6 : 0),
      });
      rider.aiRole = r.role;
      rider.aiBand = r.band;
      rider.aiPaceMul = +paceMul.toFixed(4);
      rider.aiTier = t;
      rider.aiTargetU = startCol;
      rivals.push(rider);
    }
    return rivals;
  }

  // Per-frame virtual gamepad controller for one AI rider
  function decideInput(R, player, allRiders, dt, raceTime) {
    if (R.crashed || R.finished) return { steer: 0, pedal: false };

    const sk = R.skill;
    const lookDist = clamp(R.speed * sk.lookAhead, 10, 36);
    const spNow = Course.at(R.s);
    const spAhead = Course.at(R.s + lookDist);

    // 1. Choose desired lateral offset u (main line vs shortcut vs ramp vs nemesis pursuit!)
    let targetU = Math.sin(R.s * 0.011 + R.id * 2.1) * (spAhead.hw * 0.42);

    // Branching shortcut decision
    const lane = Course.laneAt(R.s + lookDist * 0.7, spAhead.seg);
    if (lane && lane.blend > 0.15) {
      const wantCut = hash2(R.id, spAhead.seg.idx) < sk.shortcutRate;
      if (wantCut) targetU = lane.u;
    }

    // Showoffs & leaders seek kicker ramps!
    if (R.personality === 'showoff' || R.personality === 'boss' || sk.trickSkill > 0.55) {
      const ramps = Course.rampsNear(R.s + 4, R.s + 30);
      if (ramps.length) {
        let best = ramps[0], bestD = Math.abs(ramps[0].u - R.u);
        for (let i = 1; i < ramps.length; i++) {
          const d = Math.abs(ramps[i].u - R.u);
          if (d < bestD) { bestD = d; best = ramps[i]; }
        }
        if (bestD < 7.5) targetU = best.u;
      }
    }

    // Nemesis or aggressive brawler drifts closer to player when in striking zone!
    const dsPlayer = R.s - player.s;
    const duPlayer = player.u - R.u;
    if (!player.crashed && (R.nemesis || R.personality === 'brawler') && Math.abs(dsPlayer) < 16 && Math.abs(duPlayer) < 9) {
      const wantSide = duPlayer >= 0 ? -1.8 : 1.8;
      targetU = lerp(targetU, clamp(player.u + wantSide, -spAhead.hw + 2, spAhead.hw - 2), R.nemesis ? 0.82 : 0.48);
    }

    // 2. Obstacle avoidance repulsive field (trees, boulders, barriers, houses)
    const obs = Course.obstaclesNear(R.s + 1, R.s + lookDist + 6);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dz = R.pos[2] - o.z; // positive when obstacle is ahead (-z)
      if (dz < 0.5 || dz > lookDist + 4) continue;
      const dx = (spAhead.cx + targetU) - o.x;
      const safe = o.r + 2.3;
      if (Math.abs(dx) < safe) {
        const pushDir = (R.pos[0] - o.x) >= 0 ? 1 : -1;
        targetU += pushDir * (safe - Math.abs(dx)) * 1.45;
      }
    }

    targetU = clamp(targetU, -spAhead.hw * 0.92, spAhead.hw * 0.92);
    const targetX = spAhead.cx + targetU;
    const desiredYaw = Math.atan2(-(targetX - R.pos[0]), lookDist);
    let yawErr = desiredYaw - R.yaw;
    while (yawErr > PI) yawErr -= TAU;
    while (yawErr < -PI) yawErr += TAU;

    const steer = clamp(-yawErr * 2.15, -1, 1);
    const sharpTurn = Math.abs(yawErr) > 0.44 && R.speed > 20;

    // 3. Adaptive matched pacing + symmetric pack rubber-banding (keeps intense fair competition!)
    const targetSpd = Physics.statsOf(R).topSpeed * (R.aiPaceMul || 0.96);
    let pedal = R.speed < targetSpd * 1.02, boost = false, brake = sharpTurn;
    if (Course.mode.endless) {
      pedal = R.speed < targetSpd * 0.92;
      boost = R.nemesis && dsPlayer < -6 && R.adrenaline > 25;
    } else {
      const band = R.aiBand || (R.aiRole === 'lead' ? 'strong' : R.aiRole === 'chase' ? 'weak' : 'match');
      const leadWindow = band === 'strong' ? 14 : band === 'match' ? 0 : -16;
      const gap = dsPlayer - leadWindow;
      if (gap > 26) {
        // Ahead of target band window: coast briefly so race stays tense without robotic slowdown
        pedal = false;
        if (gap > 52 && R.speed > 17) brake = true;
      } else if (gap < -24) {
        // Behind target band window: push cadence, and boost if challenger/matcher or Nemesis
        pedal = true;
        if (band !== 'weak' && gap < -36 && R.adrenaline > 38) boost = true;
      }
      if (R.nemesis && dsPlayer < 2 && R.adrenaline > 22) boost = true;
    }

    // 4. Jump off kicker lips & pull mid-air tricks!
    let jump = false;
    if (!R.air && R.onRamp && R.speed > 14) {
      jump = true; // will pop off lip
    }
    let trickUp = false, trickDown = false, trickLeft = false, trickRight = false;
    if (R.air && R.airTime > 0.15 && R.vel[1] > -4.5 && sk.trickSkill > 0.35) {
      // Release early enough to land cleanly based on trickSkill (rookies sometimes get greedy & bail!)
      const releaseVy = lerp(-8.5, -3.2, sk.trickSkill);
      if (R.vel[1] > releaseVy) {
        const pick = (R.id + Math.floor(R.s / 120)) % 4;
        if (pick === 0) trickUp = true;
        else if (pick === 1) trickLeft = true;
        else if (pick === 2) trickRight = true;
        else trickDown = true;
      }
    }

    // 5. Combat attack timing against player or nearby rivals
    let atkL = false, atkR = false;
    R.aiAttackDelay -= dt;
    if (R.aiAttackDelay <= 0 && !R.air && R.attackCd <= 0) {
      const targets = [player];
      // Brawlers also smack other AI riders occasionally
      if (Math.random() < 0.25) {
        for (const other of allRiders) if (other !== R && !other.crashed) targets.push(other);
      }
      for (const T of targets) {
        if (T.crashed || T.finished) continue;
        const dS = T.s - R.s;
        const dX = T.pos[0] - R.pos[0];
        const meleeClose = Math.abs(dS) < 3.0 && Math.abs(dX) < 3.0;
        const bottleRange = dS > 6 && dS < 28 && Math.abs(dX) < 5.5 && R.bottles > 0 && sk.aggro > 0.52;
        if (meleeClose || bottleRange) {
          if (Math.random() < (R.nemesis ? 0.92 : sk.aggro)) {
            if (dX < 0) atkL = true; else atkR = true;
          }
          R.aiAttackDelay = lerp(2.2, 0.55, R.nemesis ? 1 : sk.aggro);
          break;
        }
      }
    }

    return { steer, pedal, brake, jump, boost, trickUp, trickDown, trickLeft, trickRight, atkL, atkR };
  }

  // Endless mode dynamic traffic recycler: never run out of rivals to overtake & fight!
  function recycleEndless(rivals, player) {
    if (!Course.mode.endless) return;
    for (let i = 0; i < rivals.length; i++) {
      const R = rivals[i];
      const ds = R.s - player.s;
      if (ds < -115 || ds > 240) {
        const newS = player.s + 72 + (i * 19 + Math.random() * 45);
        Course.ensureTo(newS + 200);
        const sp = Course.at(newS);
        const u = (Math.random() - 0.5) * sp.hw * 1.3;
        R.pos[0] = sp.cx + u;
        R.pos[2] = -newS;
        R.pos[1] = Course.height(R.pos[0], R.pos[2]) + 0.1;
        R.s = newS; R.u = u;
        R.yaw = Math.atan2(-sp.dcx, 1);
        R.pitch = -Math.atan(sp.slope);
        R.roll = 0;
        const spd = clamp(player.speed * (R.aiPaceMul || 0.95) * 0.92, 14, 34);
        R.vel[0] = -Math.sin(R.yaw) * spd;
        R.vel[1] = 0;
        R.vel[2] = -Math.cos(R.yaw) * spd;
        R.speed = spd;
        R.crashed = false; R.air = false; R.wobble = 0;
        R.nemesis = false; R.nemesisTimer = 0;
        R.bottles = 1;
      }
    }
  }

  return { ROSTER, spawnPack, decideInput, recycleEndless };
})();
