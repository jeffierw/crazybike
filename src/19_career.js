// ---------------------------------------------------------------- 19_career: Route B single-player career tour, 3D garage upgrades, endless & localStorage save
const Career = (() => {
  const SAVE_KEY = 'crazybike.career.v1';

  const PAINTS = [
    { name: '暴走烈焰橙', frame: [1.00, 0.30, 0.08], jersey: [0.12, 0.78, 0.96], helmet: [1.00, 0.84, 0.14] },
    { name: '毒液荧光绿', frame: [0.42, 0.96, 0.16], jersey: [0.12, 0.14, 0.18], helmet: [0.85, 1.00, 0.22] },
    { name: '闪电冰蓝',   frame: [0.10, 0.80, 0.98], jersey: [0.95, 0.30, 0.16], helmet: [0.96, 0.96, 0.98] },
    { name: '黑金魔王',   frame: [0.16, 0.16, 0.19], jersey: [0.96, 0.74, 0.14], helmet: [0.98, 0.80, 0.18] },
    { name: '猩红狂鲨',   frame: [0.94, 0.12, 0.22], jersey: [0.96, 0.96, 0.96], helmet: [0.94, 0.14, 0.24] },
    { name: '霓虹电紫',   frame: [0.76, 0.22, 0.98], jersey: [0.18, 0.92, 0.84], helmet: [1.00, 0.42, 0.82] },
  ];

  const PARTS = [
    { key: 'frame',  name: '速降车架', desc: '抗撞击韧性 + 车身增粗',       costs: [350, 700, 1200, 1900] },
    { key: 'fork',   name: '避震前叉', desc: '起跳弹力 + 落地减震(Lv2金管)', costs: [350, 700, 1200, 1900] },
    { key: 'drive',  name: '传动套件', desc: '踩踏爆发 + 极速上限提升',      costs: [400, 800, 1350, 2100] },
    { key: 'tires',  name: '越野宽胎', desc: '压弯抓地 + 宽胎视觉进化',      costs: [300, 600, 1050, 1700] },
    { key: 'combat', name: '街头装备', desc: '攻击力度 + 随车水壶 + 球棒',   costs: [350, 750, 1300, 2000] },
  ];

  // 4 Theme Mountains x 3 Classic Race Modes = 12 Career Tour Events!
  const EVENTS = [];
  const MODE_LIST = ['freeride', 'technical', 'mcross'];
  const SPONSORS = [
    { text: '单局击倒 ≥ 2 名对手', bonus: 350, check: st => st.takedowns >= 2 },
    { text: '特技得分 ≥ 1200 分',  bonus: 350, check: st => st.trickScore >= 1200 },
    { text: '零摔车完整冲线',      bonus: 450, check: st => st.crashes === 0 && st.finished },
    { text: '极速突破 95 km/h',    bonus: 300, check: st => st.maxSpeedKmh >= 95 },
    { text: '单局击倒 ≥ 3 名对手', bonus: 500, check: st => st.takedowns >= 3 },
    { text: '特技得分 ≥ 2200 分',  bonus: 500, check: st => st.trickScore >= 2200 },
  ];

  MOUNTAINS.forEach((m, mi) => {
    MODE_LIST.forEach((modeId, k) => {
      const idx = mi * 3 + k;
      const mode = RACE_MODES[modeId];
      const basePrize = 500 + mi * 350 + k * 120;
      EVENTS.push({
        id: `${m.id}_${modeId}`,
        index: idx,
        mountainId: m.id,
        mountainIdx: mi,
        modeId,
        title: `${m.name} · ${mode.name}`,
        diff: clamp(mi + k * 0.25, 0, 3),
        seed: 260000 + mi * 1000 + k * 137,
        prizes: [basePrize, Math.round(basePrize * 0.65), Math.round(basePrize * 0.42), Math.round(basePrize * 0.25)],
        sponsor: SPONSORS[idx % SPONSORS.length],
      });
    });
  });

  function defaultSave() {
    return {
      cash: 400, // Starter cash so player can customize or buy first upgrade quickly!
      upgrades: { frame: 0, fork: 0, drive: 0, tires: 0, combat: 0 },
      paintIdx: 0,
      unlockedMountains: ['redrock'],
      results: {}, // eventId -> { bestRank, bestTime }
      endlessBest: { dist: 0, takedowns: 0, trickScore: 0 },
      totalTakedowns: 0,
      cheats: { lowGrav: false, megaBat: false },
    };
  }

  let data = defaultSave();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(defaultSave(), parsed);
        data.upgrades = Object.assign({ frame: 0, fork: 0, drive: 0, tires: 0, combat: 0 }, parsed.upgrades || {});
        data.endlessBest = Object.assign({ dist: 0, takedowns: 0, trickScore: 0 }, parsed.endlessBest || {});
        data.cheats = Object.assign({ lowGrav: false, megaBat: false }, parsed.cheats || {});
      }
    } catch (e) {}
    return data;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function isMountainUnlocked(mId) {
    return data.unlockedMountains.includes(mId);
  }

  function unlockMountain(mId) {
    if (isMountainUnlocked(mId)) return true;
    const m = MOUNTAINS.find(x => x.id === mId);
    if (!m || data.cash < m.unlockCost) return false;
    data.cash -= m.unlockCost;
    data.unlockedMountains.push(mId);
    save();
    return true;
  }

  function buyUpgrade(partKey) {
    const part = PARTS.find(p => p.key === partKey);
    if (!part) return false;
    const lv = data.upgrades[partKey] || 0;
    if (lv >= 4) return false;
    const cost = part.costs[lv];
    if (data.cash < cost) return false;
    data.cash -= cost;
    data.upgrades[partKey] = lv + 1;
    save();
    return true;
  }

  function setPaint(idx) {
    data.paintIdx = ((idx % PAINTS.length) + PAINTS.length) % PAINTS.length;
    save();
  }

  function recordCareerFinish(event, summary) {
    const r = summary.rank;
    const prize = event.prizes[Math.min(3, Math.max(0, r - 1))] || event.prizes[3];
    const koPay = summary.takedowns * 250;
    const trickPay = Math.round(summary.trickScore * 0.15);
    const spHit = event.sponsor.check(summary);
    const spPay = spHit ? event.sponsor.bonus : 0;
    const total = prize + koPay + trickPay + spPay;

    data.cash += total;
    data.totalTakedowns += summary.takedowns;

    const prev = data.results[event.id];
    if (!prev || r < prev.bestRank || (r === prev.bestRank && summary.time < prev.bestTime)) {
      data.results[event.id] = { bestRank: r, bestTime: +summary.time.toFixed(2) };
    }

    // Auto-unlock next mountain if player podiums (Top 3) on current mountain!
    if (r <= 3 && event.mountainIdx + 1 < MOUNTAINS.length) {
      const nextId = MOUNTAINS[event.mountainIdx + 1].id;
      if (!data.unlockedMountains.includes(nextId)) {
        data.unlockedMountains.push(nextId);
      }
    }

    save();
    return { prize, koPay, trickPay, spPay, spHit, total };
  }

  function recordEndlessRun(summary) {
    const distPay = Math.round(summary.dist * 0.22);
    const koPay = summary.takedowns * 200;
    const trickPay = Math.round(summary.trickScore * 0.12);
    const total = distPay + koPay + trickPay;
    data.cash += total;
    data.totalTakedowns += summary.takedowns;
    if (summary.dist > data.endlessBest.dist) data.endlessBest.dist = Math.round(summary.dist);
    if (summary.takedowns > data.endlessBest.takedowns) data.endlessBest.takedowns = summary.takedowns;
    if (summary.trickScore > data.endlessBest.trickScore) data.endlessBest.trickScore = Math.round(summary.trickScore);
    save();
    return { prize: distPay, koPay, trickPay, spPay: 0, spHit: false, total };
  }

  function wonCount() {
    return Object.values(data.results).filter(r => r.bestRank === 1).length;
  }

  load();

  return {
    PAINTS,
    PARTS,
    EVENTS,
    get data() { return data; },
    get paint() { return PAINTS[data.paintIdx] || PAINTS[0]; },
    load,
    save,
    isMountainUnlocked,
    unlockMountain,
    buyUpgrade,
    setPaint,
    recordCareerFinish,
    recordEndlessRun,
    wonCount,
    resetSave() { data = defaultSave(); save(); },
  };
})();
