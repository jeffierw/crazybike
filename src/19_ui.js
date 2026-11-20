// ---------------------------------------------------------------- 19_ui: Title, Career Tour, Endless Mode, Live 3D Garage, Arcade HUD, Pause, Dev Variants & Results Card
const UI = (() => {
  const isDev = () => /[?&]dev(=|&|$)/.test(location.search) || /\/dev\/?$/.test(location.pathname);
  const root = () => document.getElementById('ui');

  let screen = 'title'; // 'title' | 'career' | 'endless' | 'garage' | 'race' | 'pause' | 'result'
  let selMountainIdx = 0;
  let lastResult = null;
  let actions = null; // callbacks injected by App

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), r = sec - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
  }

  function renderTitle() {
    const c = Career.data;
    const wins = Career.wonCount();
    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:24px 32px;background:linear-gradient(105deg,rgba(10,12,18,.84) 0%,rgba(10,12,18,.42) 48%,rgba(10,12,18,.08) 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="hud-chip" style="font-size:12px;letter-spacing:.12em;color:var(--gold);font-weight:800;">
            PURE-CODE 3D DOWNHILL · ${App.backendName()}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="hud-chip" style="font-size:13px;font-weight:800;color:var(--gold);">💰 $${c.cash} · 🏆 ${wins}/12</div>
            <button id="btn-mute" class="btn">${Sound.isMuted() ? '🔇 静音' : '🔊 音效'}</button>
          </div>
        </div>

        <div style="max-width:520px;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.26em;color:var(--accent);margin-bottom:6px;">DOWNHILL COMBAT RACING</div>
          <div style="font-size:clamp(40px,6vw,72px);font-weight:900;line-height:.95;letter-spacing:-.02em;text-shadow:0 8px 32px rgba(0,0,0,.6);">
            CRAZY<span style="color:var(--accent);">BIKE</span>
          </div>
          <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,.88);margin-top:8px;">暴走山地速降 · 4 大险峰 · 8 人混战</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.55;">
            高速压弯甩尾 · 断崖飞跃空中特技 · 左右飞踹砸水壶 · 人车分离惨烈摔车
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;">
            <button id="btn-quick" class="btn primary" style="padding:14px 28px;font-size:16px;">▶ 立即开冲</button>
            <button id="btn-career" class="btn gold" style="padding:14px 22px;font-size:15px;">🏆 生涯巡回赛</button>
            <button id="btn-endless" class="btn" style="padding:14px 20px;font-size:15px;">♾️ 无尽暴走 / 今日之山</button>
            <button id="btn-garage" class="btn" style="padding:14px 20px;font-size:15px;">🔧 3D 改装车库</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;">
          <div class="hud-chip" style="font-size:12px;color:var(--muted);">
            <b>键盘</b>: WASD/方向键 · Space 跳 · Shift 暴走 · Q/E 或 J/K 打人/砸水壶 · 空中方向键做特技 · V 换机位 &nbsp;|&nbsp; <b>支持 Xbox/PS 手柄 &amp; 触屏</b>
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,.45);">Build ${BUILD_HASH}</div>
        </div>
      </div>`;

    document.getElementById('btn-mute').onclick = () => { Sound.unlock(); Sound.toggleMute(); renderTitle(); };
    document.getElementById('btn-quick').onclick = () => { Sound.unlock(); Music.setPlaying(true); actions.startEvent(Career.EVENTS[0]); };
    document.getElementById('btn-career').onclick = () => { Sound.unlock(); setScreen('career'); };
    document.getElementById('btn-endless').onclick = () => { Sound.unlock(); setScreen('endless'); };
    document.getElementById('btn-garage').onclick = () => { Sound.unlock(); setScreen('garage'); };
  }

  function renderCareer() {
    const c = Career.data;
    const m = MOUNTAINS[selMountainIdx];
    const unlocked = Career.isMountainUnlocked(m.id);
    const evs = Career.EVENTS.filter(e => e.mountainId === m.id);

    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:20px 28px;background:rgba(10,12,18,.80);backdrop-filter:blur(10px);overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="btn-back" class="btn">← 返回</button>
            <div style="font-size:24px;font-weight:900;">🏆 生涯巡回赛 · 4 大主题大山</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <div class="hud-chip" style="font-weight:800;color:var(--gold);">💰 $${c.cash}</div>
            <button id="btn-to-garage" class="btn gold">🔧 车库改装</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-bottom:18px;">
          ${MOUNTAINS.map((mt, i) => {
            const unl = Career.isMountainUnlocked(mt.id);
            const active = i === selMountainIdx;
            const wins = Career.EVENTS.filter(e => e.mountainId === mt.id && c.results[e.id] && c.results[e.id].bestRank <= 3).length;
            return `<button class="btn ${active ? 'primary' : ''}" data-selm="${i}" style="text-align:left;padding:12px 14px;opacity:${unl ? 1 : 0.72};">
              <div style="font-size:15px;font-weight:900;">${unl ? '' : '🔒 '}${mt.name}</div>
              <div style="font-size:11px;opacity:.75;margin-top:3px;">${mt.en} · 奖牌 ${wins}/3</div>
            </button>`;
          }).join('')}
        </div>

        <div class="hud-chip" style="padding:18px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:22px;font-weight:900;color:var(--gold);">${m.name} <span style="font-size:13px;color:var(--muted);font-weight:600;">${m.en}</span></div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px;">${m.tagline} · 坡度 ×${m.slopeMul.toFixed(2)} · 抓地力 ×${m.grip.toFixed(2)}</div>
          </div>
          ${unlocked
            ? `<div style="font-size:12px;color:#5ce08b;font-weight:800;">✔ 已解锁 · 任选赛制出战</div>`
            : `<button id="btn-unlock-m" class="btn gold" ${c.cash < m.unlockCost ? 'style="opacity:.5;"' : ''}>🔓 花费 $${m.unlockCost} 提前解锁（或上站进前三免费解锁）</button>`}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          ${evs.map(ev => {
            const mode = RACE_MODES[ev.modeId];
            const rec = c.results[ev.id];
            return `<div class="hud-chip clickable" style="padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:18px;font-weight:900;">${mode.name}</span>
                  <span style="font-size:12px;color:var(--gold);font-weight:800;">冠军 $${ev.prizes[0]}</span>
                </div>
                <div style="font-size:12px;color:var(--muted);margin-top:4px;">赛道全长 ${mode.len} m · AI 难度 Lv.${Math.round(ev.diff) + 1}</div>
                <div style="font-size:12px;color:var(--cyan);margin-top:8px;">🎯 赞助商任务：${ev.sponsor.text} (+$${ev.sponsor.bonus})</div>
                <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:6px;">
                  ${rec ? `最佳成绩：第 ${rec.bestRank} 名 (${fmtTime(rec.bestTime)})` : '尚未挑战'}
                </div>
              </div>
              <button class="btn ${unlocked ? 'primary' : ''}" data-ev="${ev.id}" ${unlocked ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"'}>
                ${unlocked ? '▶ 开始赛事' : '🔒 未解锁'}
              </button>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    document.getElementById('btn-back').onclick = () => setScreen('title');
    document.getElementById('btn-to-garage').onclick = () => setScreen('garage');
    root().querySelectorAll('[data-selm]').forEach(b => {
      b.onclick = () => { selMountainIdx = +b.dataset.selm; actions.previewMountain(MOUNTAINS[selMountainIdx].id); renderCareer(); };
    });
    const unlBtn = document.getElementById('btn-unlock-m');
    if (unlBtn) unlBtn.onclick = () => { if (Career.unlockMountain(m.id)) renderCareer(); };
    root().querySelectorAll('[data-ev]').forEach(b => {
      b.onclick = () => {
        const ev = Career.EVENTS.find(x => x.id === b.dataset.ev);
        if (ev) { Music.setPlaying(true); actions.startEvent(ev); }
      };
    });
  }

  function renderEndless() {
    const c = Career.data;
    const tSeed = todaySeed();
    const curSeed = Math.floor(Math.random() * 899999 + 100000);
    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:20px 28px;background:rgba(10,12,18,.80);backdrop-filter:blur(10px);overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <button id="btn-back" class="btn">← 返回</button>
            <div style="font-size:24px;font-weight:900;">♾️ 无尽暴走模式 · 带 AI 对手</div>
          </div>
          <div class="hud-chip" style="font-size:13px;color:var(--gold);font-weight:800;">
            最远 ${c.endlessBest.dist}m · 最高单局击倒 ${c.endlessBest.takedowns} K.O.
          </div>
        </div>

        <div class="hud-chip clickable" style="padding:18px 20px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-color:rgba(255,196,61,.4);">
          <div>
            <div style="font-size:19px;font-weight:900;color:var(--gold);">🌄 今日之山 #today (${tSeed})</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px;">全球玩家今天同一座无尽山脉，AI 对手源源不断在前方刷出，一路暴走刷分赚奖金！</div>
          </div>
          <button id="btn-today" class="btn gold" style="padding:12px 22px;">▶ 挑战今日之山</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
          ${MOUNTAINS.map((mt, i) => `
            <div class="hud-chip clickable" style="padding:16px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
              <div>
                <div style="font-size:17px;font-weight:900;">${mt.name}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:4px;">${mt.tagline}</div>
              </div>
              <button class="btn primary" data-endm="${mt.id}">▶ 无尽速降 (随机种子)</button>
            </div>
          `).join('')}
        </div>
      </div>`;

    document.getElementById('btn-back').onclick = () => setScreen('title');
    document.getElementById('btn-today').onclick = () => {
      const mToday = MOUNTAINS[tSeed % MOUNTAINS.length];
      location.hash = 'today';
      Music.setPlaying(true);
      actions.startEndless(mToday.id, tSeed, 1.5);
    };
    root().querySelectorAll('[data-endm]').forEach(b => {
      b.onclick = () => {
        const sd = curSeed + Math.floor(Math.random() * 999);
        location.hash = 'seed-' + sd;
        Music.setPlaying(true);
        actions.startEndless(b.dataset.endm, sd, 1.2);
      };
    });
  }

  function renderGarage() {
    const c = Career.data;
    const wins = Career.wonCount();
    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;justify-content:space-between;padding:20px 28px;pointer-events:none;">
        <div style="display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;">
          <div style="display:flex;align-items:center;gap:10px;">
            <button id="btn-back" class="btn">← 返回</button>
            <div class="hud-chip" style="font-size:18px;font-weight:900;">🔧 3D 地下改装车库</div>
            <div class="hud-chip" style="font-size:16px;font-weight:900;color:var(--gold);">💰 $${c.cash}</div>
          </div>

          <div class="hud-chip clickable" style="max-width:340px;">
            <div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:700;">车身涂装（免费切换）</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${Career.PAINTS.map((p, i) => `
                <button class="btn ${i === c.paintIdx ? 'primary' : ''}" data-paint="${i}" style="padding:6px 10px;font-size:12px;">${p.name}</button>
              `).join('')}
            </div>
            ${wins >= 2 ? `
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;">
                <div style="color:var(--gold);font-weight:800;margin-bottom:6px;">🎮 已解锁 PS2 娱乐作弊码</div>
                <label style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;cursor:pointer;">
                  <input type="checkbox" id="chk-grav" ${c.cheats.lowGrav ? 'checked' : ''}/> 月球低重力
                </label>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="checkbox" id="chk-bat" ${c.cheats.megaBat ? 'checked' : ''}/> 满级球棒开局
                </label>
              </div>
            ` : `<div style="margin-top:10px;font-size:11px;color:var(--muted);">赢下 2 场生涯冠军即可解锁 PS2 经典娱乐作弊码</div>`}
          </div>
        </div>

        <div class="hud-chip clickable" style="width:min(360px,42vw);display:flex;flex-direction:column;gap:10px;align-self:center;max-height:86vh;overflow:auto;">
          <div style="font-size:15px;font-weight:900;color:var(--gold);margin-bottom:2px;">5 大部件改装（3D 外观同步升级）</div>
          ${Career.PARTS.map(p => {
            const lv = c.upgrades[p.key] || 0;
            const maxed = lv >= 4;
            const cost = maxed ? 0 : p.costs[lv];
            const canBuy = !maxed && c.cash >= cost;
            const bars = [0, 1, 2, 3].map(b => `<span style="display:inline-block;width:22px;height:6px;border-radius:3px;margin-right:4px;background:${b < lv ? '#ffc43d' : 'rgba(255,255,255,.16)'};"></span>`).join('');
            return `<div style="padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-size:14px;font-weight:800;">${p.name} <span style="color:var(--gold);font-size:12px;">Lv.${lv}/4</span></div>
                <div style="font-size:11px;color:var(--muted);margin:2px 0 5px;">${p.desc}</div>
                <div>${bars}</div>
              </div>
              <button class="btn ${canBuy ? 'gold' : ''}" data-buy="${p.key}" ${canBuy ? '' : 'disabled style="opacity:.45;cursor:not-allowed;"'} style="white-space:nowrap;padding:8px 12px;font-size:12px;">
                ${maxed ? 'MAX' : '$' + cost}
              </button>
            </div>`;
          }).join('')}
          <button id="btn-go-career" class="btn primary" style="margin-top:4px;width:100%;">▶ 去比赛赚奖金</button>
        </div>
      </div>`;

    document.getElementById('btn-back').onclick = () => setScreen('title');
    document.getElementById('btn-go-career').onclick = () => setScreen('career');
    root().querySelectorAll('[data-paint]').forEach(b => {
      b.onclick = () => { Career.setPaint(+b.dataset.paint); renderGarage(); };
    });
    root().querySelectorAll('[data-buy]').forEach(b => {
      b.onclick = () => {
        if (Career.buyUpgrade(b.dataset.buy)) {
          Sound.playTrick(3);
          renderGarage();
        }
      };
    });
    const gChk = document.getElementById('chk-grav');
    if (gChk) gChk.onchange = () => { Career.data.cheats.lowGrav = gChk.checked; Career.save(); };
    const bChk = document.getElementById('chk-bat');
    if (bChk) bChk.onchange = () => { Career.data.cheats.megaBat = bChk.checked; Career.save(); };
  }

  function renderRaceHUD() {
    const isTouch = matchMedia && matchMedia('(pointer: coarse)').matches;
    root().innerHTML = `
      <div style="position:absolute;top:12px;left:14px;display:flex;gap:8px;align-items:center;">
        <button id="btn-pause" class="btn" style="padding:7px 12px;font-size:13px;">⏸ 菜单</button>
        <div class="hud-chip" style="padding:7px 12px;font-size:13px;font-weight:800;">
          <span style="color:var(--accent);">${Course.mountain.name}</span> · ${Course.mode.name}
        </div>
        ${Course.mode.endless ? `<button id="btn-end-run" class="btn gold" style="padding:7px 12px;font-size:12px;">🏁 结算战报</button>` : ''}
      </div>

      <div id="hud-rank" class="hud-chip" style="position:absolute;top:12px;right:14px;text-align:right;min-width:140px;">
        <div id="hud-pos" style="font-size:32px;font-weight:900;line-height:1;">1<span style="font-size:14px;color:var(--muted);">/8</span></div>
        <div id="hud-ko" style="font-size:12px;color:var(--gold);margin-top:4px;font-weight:700;">K.O. 0 · 推搡</div>
        <div id="hud-prog" style="height:4px;background:rgba(255,255,255,.14);border-radius:2px;margin-top:6px;overflow:hidden;">
          <div id="hud-prog-fill" style="height:100%;width:0%;background:#38e2ff;"></div>
        </div>
      </div>

      <div id="hud-banner" style="position:absolute;top:20%;left:50%;transform:translateX(-50%);font-size:clamp(22px,3.2vw,34px);font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,.85);letter-spacing:.04em;text-align:center;pointer-events:none;white-space:nowrap;"></div>
      <div id="hud-sub" style="position:absolute;top:27%;left:50%;transform:translateX(-50%);font-size:14px;font-weight:800;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.9);pointer-events:none;"></div>

      <div class="hud-chip" style="position:absolute;bottom:14px;right:14px;text-align:right;min-width:178px;">
        <div id="hud-spd" style="font-size:36px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;">0 <span style="font-size:13px;color:var(--muted);">KM/H</span></div>
        <div id="hud-dist" style="font-size:12px;color:var(--muted);margin-top:4px;">0 m · 特技 0</div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gold);margin-top:6px;font-weight:800;">
          <span>肾上腺素 ADRENALINE</span><span id="hud-adr-pct">25%</span>
        </div>
        <div style="height:7px;background:rgba(255,255,255,.16);border-radius:4px;margin-top:3px;overflow:hidden;">
          <div id="hud-adr" style="height:100%;width:25%;background:linear-gradient(90deg,#ffc43d,#ff5b1f);"></div>
        </div>
      </div>

      ${isTouch ? `
        <div style="position:absolute;bottom:18px;left:16px;display:flex;gap:8px;">
          <button id="t-atkl" class="btn primary" style="padding:16px 14px;">👊 左打</button>
          <button id="t-atkr" class="btn primary" style="padding:16px 14px;">👊 右打</button>
          <button id="t-brk" class="btn" style="padding:16px 14px;">甩尾</button>
        </div>
        <div style="position:absolute;bottom:112px;right:16px;display:flex;gap:8px;">
          <button id="t-jump" class="btn gold" style="padding:16px 18px;">跳 / 特技</button>
          <button id="t-boost" class="btn primary" style="padding:16px 14px;">🔥 暴走</button>
        </div>
      ` : `
        <div class="hud-chip" style="position:absolute;bottom:14px;left:14px;font-size:11px;color:var(--muted);line-height:1.5;">
          <b>地面</b> A/D转向 · W踩踏 · S甩尾 · Space跳 · Shift暴走 · Q/E(J/K)打人/砸水壶 &nbsp;|&nbsp; <b>空中</b> 方向键做特技(落地前松手) · V切机位
        </div>
      `}`;

    document.getElementById('btn-pause').onclick = () => actions.togglePause();
    const endBtn = document.getElementById('btn-end-run');
    if (endBtn) endBtn.onclick = () => actions.finishEndlessNow();

    // Wire touch action buttons cleanly
    const holdBtn = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', e => { e.stopPropagation(); Input.touch[key] = true; });
      const off = e => { e.stopPropagation(); Input.touch[key] = false; };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
    };
    holdBtn('t-jump', 'jump'); holdBtn('t-boost', 'boost'); holdBtn('t-brk', 'brake');
    const al = document.getElementById('t-atkl'); if (al) al.addEventListener('pointerdown', e => { e.stopPropagation(); Input.touch.atkL = true; });
    const ar = document.getElementById('t-atkr'); if (ar) ar.addEventListener('pointerdown', e => { e.stopPropagation(); Input.touch.atkR = true; });
  }

  function updateHUD(player, totalRiders, bannerText, bannerCol, bannerT) {
    if (screen !== 'race') return;
    const posEl = document.getElementById('hud-pos');
    const koEl = document.getElementById('hud-ko');
    const progEl = document.getElementById('hud-prog-fill');
    const spdEl = document.getElementById('hud-spd');
    const distEl = document.getElementById('hud-dist');
    const adrEl = document.getElementById('hud-adr');
    const adrPct = document.getElementById('hud-adr-pct');
    const banEl = document.getElementById('hud-banner');
    const subEl = document.getElementById('hud-sub');

    if (posEl) {
      posEl.innerHTML = Course.mode.endless
        ? `${(player.s / 1000).toFixed(2)}<span style="font-size:13px;color:var(--muted);"> KM</span>`
        : `${player.rank}<span style="font-size:14px;color:var(--muted);">/${totalRiders}</span>`;
    }
    if (koEl) koEl.textContent = `K.O. ${player.takedowns} · ${Combat.TIER_NAMES[player.combatTier]} · 🍼×${player.bottles}`;
    if (progEl) {
      const p = Course.mode.endless ? ((player.s % 1000) / 10) : clamp((player.s / Course.finishS) * 100, 0, 100);
      progEl.style.width = `${p.toFixed(1)}%`;
    }
    if (spdEl) spdEl.innerHTML = `${Math.round(player.speed * 3.6)} <span style="font-size:13px;color:var(--muted);">KM/H</span>`;
    if (distEl) distEl.textContent = Course.mode.endless
      ? `特技 ${player.totalTrickScore} · 极速 ${Math.round(player.maxSpeed * 3.6)} km/h`
      : `${Math.round(player.s)} / ${Course.finishS} m · 特技 ${player.totalTrickScore}`;
    if (adrEl) adrEl.style.width = `${Math.round(player.adrenaline)}%`;
    if (adrPct) adrPct.textContent = player.boosting ? 'OVERDRIVE!' : `${Math.round(player.adrenaline)}%`;

    if (banEl) {
      if (player.air && player.trickType && player.trickScore > 20) {
        banEl.style.color = '#38e2ff';
        banEl.textContent = `${Stunts.TRICKS[player.trickType].name} ×${player.trickCombo}  +${Math.round(player.trickScore)}`;
        if (subEl) subEl.textContent = '落地前松开方向键稳稳着陆！';
      } else if (bannerT > 0) {
        banEl.style.color = bannerCol;
        banEl.textContent = bannerText;
        if (subEl) subEl.textContent = '';
      } else {
        banEl.textContent = '';
        if (subEl) subEl.textContent = player.onShortcut ? '⚡ 捷径抄近道中！' : '';
      }
    }
  }

  function renderPause() {
    const devRows = isDev() ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-size:12px;color:var(--cyan);font-weight:800;margin-bottom:8px;">🛠 开发者 Variants 手感对比 (?dev)</div>
        ${Variants.defs.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px;">
            <span style="font-size:12px;color:var(--muted);">${d.label}</span>
            <div style="display:flex;gap:4px;">
              ${d.opts.map(([id, lbl]) => `<button class="btn ${Variants.val[d.name] === id ? 'primary' : ''}" data-vn="${d.name}" data-vi="${id}" style="padding:4px 8px;font-size:11px;">${lbl}</button>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>` : '';

    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.68);backdrop-filter:blur(8px);">
        <div class="hud-chip clickable" style="width:min(380px,90vw);padding:22px 24px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:24px;font-weight:900;text-align:center;margin-bottom:4px;">已暂停 · PAUSED</div>
          <button id="p-resume" class="btn primary">▶ 继续狂飙 (Esc)</button>
          <button id="p-restart" class="btn">↻ 重新开局</button>
          <button id="p-cam" class="btn">🎥 切换机位 (V)</button>
          <button id="p-mute" class="btn">${Sound.isMuted() ? '🔇 开启音效' : '🔊 静音'}</button>
          <button id="p-garage" class="btn gold">🔧 前往车库改装</button>
          <button id="p-title" class="btn">🏠 返回主菜单</button>
          ${devRows}
        </div>
      </div>`;

    document.getElementById('p-resume').onclick = () => actions.togglePause();
    document.getElementById('p-restart').onclick = () => actions.restartRun();
    document.getElementById('p-cam').onclick = () => { Camera.cycle(); actions.togglePause(); };
    document.getElementById('p-mute').onclick = () => { Sound.toggleMute(); renderPause(); };
    document.getElementById('p-garage').onclick = () => setScreen('garage');
    document.getElementById('p-title').onclick = () => setScreen('title');
    root().querySelectorAll('[data-vn]').forEach(b => {
      b.onclick = () => { Variants.set(b.dataset.vn, b.dataset.vi); renderPause(); };
    });
  }

  function renderResult(res) {
    lastResult = res;
    const pay = res.payout;
    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,10,14,.82);backdrop-filter:blur(10px);overflow:auto;">
        <div class="hud-chip clickable" style="width:min(880px,96vw);padding:20px 22px;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:24px;font-weight:900;color:var(--gold);">
                ${res.endless ? `🏁 无尽暴走结算 · ${(res.dist / 1000).toFixed(2)} KM` : `🏁 冲线！第 ${res.rank} 名 · ${fmtTime(res.time)}`}
              </div>
              <div style="font-size:13px;color:var(--muted);margin-top:4px;">
                名次/距离 +$${pay.prize} · 击倒赏金 +$${pay.koPay} · 特技折现 +$${pay.trickPay}
                ${pay.spHit ? ` · <b style="color:#5ce08b;">赞助商达成 +$${pay.spPay}!</b>` : ''}
                &nbsp;→&nbsp; <b style="color:var(--gold);font-size:15px;">合计 +$${pay.total}（当前余额 $${Career.data.cash}）</b>
              </div>
            </div>
            <button id="r-save" class="btn">📸 下载高光战报卡 PNG</button>
          </div>

          <canvas id="rc-canvas" style="width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--border);display:block;"></canvas>

          <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button id="r-retry" class="btn">↻ 再冲一局</button>
            <button id="r-garage" class="btn gold">🔧 去车库升级战车</button>
            <button id="r-next" class="btn primary">🏆 返回赛事列表</button>
          </div>
        </div>
      </div>`;

    const cv = document.getElementById('rc-canvas');
    Postcard.draw(cv, res);
    document.getElementById('r-save').onclick = () => {
      const a = document.createElement('a');
      a.download = `crazybike-${res.mountain.id}-${Date.now()}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    };
    document.getElementById('r-retry').onclick = () => actions.restartRun();
    document.getElementById('r-garage').onclick = () => setScreen('garage');
    document.getElementById('r-next').onclick = () => setScreen(res.endless ? 'endless' : 'career');
  }

  function setScreen(next, payload) {
    screen = next;
    if (actions && actions.onScreen) actions.onScreen(next);
    if (next === 'title') renderTitle();
    else if (next === 'career') renderCareer();
    else if (next === 'endless') renderEndless();
    else if (next === 'garage') renderGarage();
    else if (next === 'race') renderRaceHUD();
    else if (next === 'pause') renderPause();
    else if (next === 'result') renderResult(payload || lastResult);
  }

  return {
    init(cb) { actions = cb; },
    setScreen,
    updateHUD,
    get screen() { return screen; },
  };
})();
