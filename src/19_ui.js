// ---------------------------------------------------------------- 19_ui: Editorial Cold-Smoke-inspired UI, Start-Gate Title, Translucent 360-Orbit Left Rail, Bilingual ZH/EN, Career, Endless, 3D Garage & HUD
const UI = (() => {
  const isDev = () => /[?&]dev(=|&|$)/.test(location.search || '') || /\/dev\/?$/.test(location.pathname || '');
  const root = () => document.getElementById('ui');
  const bi = (zh, en) => I18N.bi(zh, en);
  const t = zh => I18N.t(zh);

  let screen = 'title'; // 'title' | 'career' | 'endless' | 'garage' | 'race' | 'pause' | 'result'
  let subMenu = 'main'; // 'main' | 'views' | 'settings' | 'controls'
  let selMountainIdx = 0;
  let endlessSolo = true; // V3 default: solo endless freeride (0 AI rivals), toggleable!
  let lastResult = null;
  let actions = null;

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), r = sec - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
  }

  function mName(m) { return I18N.lang === 'en' ? m.en : m.name; }
  function mTag(m)  { return I18N.lang === 'en' ? (m.taglineEn || m.tagline) : m.tagline; }
  function modeName(md) { return I18N.lang === 'en' ? md.en : md.name; }
  function viewName(v)  { return I18N.lang === 'en' ? v.en : v.name; }

  // Top-right crisp minimal corner pills (Language, Mute, Fullscreen)
  function cornerToolsHtml() {
    const muteLabel = Sound.isMuted() ? '🔇' : '🔊';
    return `
      <div style="position:absolute;top:var(--gt);right:var(--gr);display:flex;gap:8px;align-items:center;pointer-events:auto;">
        <button id="top-lang" class="e-btn" style="padding:7px 12px;font-size:12px;">${I18N.lang === 'zh' ? 'EN' : '中文'}</button>
        <button id="top-mute" class="e-btn" style="padding:7px 12px;font-size:13px;" title="${t('声音')}">${muteLabel}</button>
        <button id="top-fs" class="e-btn" style="padding:7px 12px;font-size:13px;" title="${t('全屏')}">⛶</button>
      </div>`;
  }

  function bindCornerTools() {
    const lg = document.getElementById('top-lang');
    if (lg) lg.onclick = () => { I18N.toggle(); };
    const mt = document.getElementById('top-mute');
    if (mt) mt.onclick = () => { Sound.unlock(); Sound.toggleMute(); redraw(); };
    const fs = document.getElementById('top-fs');
    if (fs) fs.onclick = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    };
  }

  // ---- Shared Translucent Left-Rail Sub-Panels (Views / Settings / Controls) usable BOTH on Title AND Pause! ----
  function renderSubRail(context) {
    const isPause = context === 'pause';
    const curView = Camera.currentView();
    const prefs = Sound.getPrefs();
    const curQual = actions.getQuality ? actions.getQuality() : 'auto';
    let body = '';

    if (subMenu === 'views') {
      body = `
        <div class="rail-kicker">VIEW · ${t('视角')}</div>
        <div class="rail-title">${bi('镜头机位', 'Camera Views')}</div>
        <p style="font-size:12px;color:var(--dim);line-height:1.65;margin:0 0 16px;">
          ${bi('选中立即生效，骑行中按 V / Shift+V 或数字键 1–8 随时切换，右键拖动可 360° 环顾。', 'Applies immediately. Press V / Shift+V or 1–8 while riding, or right-drag to look around 360°.')}
        </p>
        <div class="pill-row">
          ${Camera.VIEWS.map((v, i) => `
            <button class="pill ${curView.id === v.id ? 'on' : ''}" data-setview="${v.id}">${i + 1} · ${viewName(v)}</button>
          `).join('')}
        </div>
        ${isPause ? `
          <div class="rail-sec" style="margin-top:22px;">
            <button id="sub-photo" class="e-btn fire" style="width:100%;padding:11px 16px;">📷 ${bi('进入自由定格拍照', 'Enter Freeze-Frame Photo Mode')}</button>
          </div>` : ''}
      `;
    } else if (subMenu === 'settings') {
      const mList = MOUNTAINS;
      const qualOpts = [
        ['auto', bi('自动', 'Auto')],
        ['high', bi('高', 'High')],
        ['balanced', bi('均衡', 'Balanced')],
        ['smooth', bi('流畅', 'Smooth')],
      ];
      body = `
        <div class="rail-kicker">SETTINGS · ${t('设置')}</div>
        <div class="rail-title">${t('设置')}</div>

        <div class="rail-sec">
          <div class="rail-label">${t('语言')} · LANGUAGE</div>
          <div class="pill-row">
            <button class="pill ${I18N.lang === 'zh' ? 'on' : ''}" data-lang="zh">中文</button>
            <button class="pill ${I18N.lang === 'en' ? 'on' : ''}" data-lang="en">English</button>
          </div>
        </div>

        ${!isPause ? `
        <div class="rail-sec">
          <div class="rail-label">${t('山脉场景')} · MOUNTAIN</div>
          <div class="pill-row">
            ${mList.map((mt, idx) => `
              <button class="pill ${Course.mountain.id === mt.id ? 'on' : ''}" data-prevm="${idx}">${mName(mt)}</button>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="rail-sec">
          <div class="rail-label">${t('画质')} · QUALITY (${App.backendName()})</div>
          <div class="pill-row">
            ${qualOpts.map(([id, lbl]) => `
              <button class="pill ${curQual === id ? 'on' : ''}" data-qual="${id}">${lbl}</button>
            `).join('')}
          </div>
        </div>

        <div class="rail-sec">
          <div class="rail-label">${t('声音')} · AUDIO</div>
          <div class="slider-row">
            <span>${t('音效')}</span>
            <input type="range" id="sl-sfx" min="0" max="100" value="${Math.round(prefs.sfxVol * 100)}" />
            <span style="min-width:34px;text-align:right;">${Math.round(prefs.sfxVol * 100)}%</span>
          </div>
          <div class="slider-row">
            <span>${t('音乐')}</span>
            <input type="range" id="sl-mus" min="0" max="100" value="${Math.round(prefs.musicVol * 100)}" />
            <span style="min-width:34px;text-align:right;">${Math.round(prefs.musicVol * 100)}%</span>
          </div>
          <div class="pill-row" style="margin-top:8px;">
            <button id="set-mute" class="pill ${prefs.muted ? '' : 'on'}">${prefs.muted ? bi('静音中', 'Muted') : bi('声音已开启', 'Audio On')}</button>
          </div>
        </div>

        ${Variants.defs.map(d => `
          <div class="rail-sec">
            <div class="rail-label">${t(d.label)}</div>
            <div class="pill-row">
              ${d.opts.map(([id, lbl]) => `
                <button class="pill ${Variants.val[d.name] === id ? 'on' : ''}" data-vn="${d.name}" data-vi="${id}">${t(lbl)}</button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      `;
    } else if (subMenu === 'controls') {
      const rows = I18N.lang === 'en' ? [
        ['A / D  or  ← / →', 'Steer & Carve'],
        ['W  or  ↑', 'Pedal Sprint'],
        ['S  or  ↓', 'Brake & Drift'],
        ['Space', 'Hold Charge → Release Jump'],
        ['Shift', 'Adrenaline Overdrive'],
        ['Q / E  or  J / K', 'Left / Right Punch, Kick & Bottle'],
        ['Mid-Air WASD / Space', 'Random Ink-Brush Trick (Complete & Auto-Land!)'],
        ['Mid-Air S (Big Drop)', '360° Backflip Off Mega Cliffs'],
        ['V / Shift+V / 1–8', 'Switch 8 Camera Views'],
        ['Drag / Right-Drag', '360° Orbit & Look Around'],
        ['Esc / P', 'Pause Menu / Photo Mode'],
      ] : [
        ['A / D 或 ← / →', '左右转向压弯'],
        ['W 或 ↑', '全力蹬车冲刺'],
        ['S 或 ↓', '刹车 / 暴走甩尾漂移'],
        ['Space 空格', '按住蓄力 · 松开飞跃'],
        ['Shift', '肾上腺素暴走加速'],
        ['Q / E 或 J / K', '左右挥拳 / 飞踹 / 砸水壶 / 球棒'],
        ['空中 WASD / 空格', '随机完整喷墨特技（落地自动稳住）'],
        ['悬崖大跳按 S', '极限 360° 后空翻'],
        ['V / Shift+V / 1–8', '切换 8 种镜头机位'],
        ['拖拽 / 右键拖拽', '360° 环视山脉与车手'],
        ['Esc / P', '暂停菜单 / 定格拍照'],
      ];
      body = `
        <div class="rail-kicker">CONTROLS · ${t('操作说明')}</div>
        <div class="rail-title">${t('操作说明')}</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;">
          ${rows.map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid rgba(245,243,238,0.10);">
              <span style="color:var(--sun);font-family:var(--f-lat);white-space:nowrap;">${k}</span>
              <span style="color:var(--dim);text-align:right;">${v}</span>
            </div>
          `).join('')}
        </div>
        <p style="font-size:11px;color:var(--faint);margin-top:14px;line-height:1.6;">
          ${bi('原生支持 Xbox / PlayStation 手柄与移动端触屏操作。', 'Full native support for Xbox / PlayStation controllers & touch screens.')}
        </p>
      `;
    }

    root().innerHTML = `
      <div class="scrim-left"></div>
      ${cornerToolsHtml()}
      <div class="rail">
        <button id="sub-back" class="e-btn" style="align-self:flex-start;margin-bottom:18px;padding:6px 14px;font-size:12px;">← ${t('返回')}</button>
        ${body}
      </div>
      <div class="orbit-hint">${t('拖拽右侧画面 360° 环视环境 · 滚轮缩放')}</div>
    `;
    bindCornerTools();
    document.getElementById('sub-back').onclick = () => { subMenu = 'main'; redraw(); };

    const phBtn = document.getElementById('sub-photo');
    if (phBtn) phBtn.onclick = () => actions.enterPhoto();

    root().querySelectorAll('[data-setview]').forEach(b => {
      b.onclick = () => { Camera.setView(b.dataset.setview); Camera.resetOrbit(); redraw(); };
    });
    root().querySelectorAll('[data-lang]').forEach(b => {
      b.onclick = () => { I18N.setLang(b.dataset.lang); };
    });
    root().querySelectorAll('[data-prevm]').forEach(b => {
      b.onclick = () => {
        selMountainIdx = +b.dataset.prevm;
        actions.previewMountain(MOUNTAINS[selMountainIdx].id);
        redraw();
      };
    });
    root().querySelectorAll('[data-qual]').forEach(b => {
      b.onclick = () => { if (actions.setQuality) actions.setQuality(b.dataset.qual); redraw(); };
    });
    const slSfx = document.getElementById('sl-sfx');
    if (slSfx) slSfx.oninput = () => { Sound.unlock(); Sound.setSfxVol(slSfx.value / 100); slSfx.nextElementSibling.textContent = slSfx.value + '%'; };
    const slMus = document.getElementById('sl-mus');
    if (slMus) slMus.oninput = () => { Sound.unlock(); Sound.setMusicVol(slMus.value / 100); slMus.nextElementSibling.textContent = slMus.value + '%'; };
    const setMute = document.getElementById('set-mute');
    if (setMute) setMute.onclick = () => { Sound.unlock(); Sound.toggleMute(); redraw(); };
    root().querySelectorAll('[data-vn]').forEach(b => {
      b.onclick = () => { Variants.set(b.dataset.vn, b.dataset.vi); redraw(); };
    });
  }

  // ---- 1. Start-Gate Editorial Title Screen ----
  function renderTitle() {
    if (subMenu !== 'main') return renderSubRail('title');
    const c = Career.data;
    const wins = Career.wonCount();
    const curM = Course.mountain;
    root().innerHTML = `
      <div class="scrim-left"></div>
      ${cornerToolsHtml()}
      <div class="rail" style="justify-content:space-between;width:min(410px,88vw);">
        <div>
          <div style="font-family:var(--f-lat);font-size:10px;letter-spacing:0.32em;color:var(--sun);margin-bottom:26px;">
            ${App.backendName()} · ${mName(curM)} · $${c.cash} · 🏆 ${wins}/12
          </div>
          <div class="mark">
            <div class="cn ${I18N.lang === 'en' ? 'en-word' : ''}">${I18N.lang === 'en' ? 'CRAZYBIKE' : '暴走速降'}</div>
            <div class="rule"></div>
            <div class="en">${I18N.lang === 'en' ? 'DOWNHILL DOMINATION · 3D' : 'CRAZYBIKE · DOWNHILL'}</div>
          </div>
          <p style="font-family:var(--f-song);font-weight:300;font-size:14px;letter-spacing:0.18em;color:rgba(245,243,238,0.88);margin:18px 0 28px;line-height:1.7;">
            ${t('悬崖飞跃 · 彩带特技 · 贴身肉搏')}
          </p>

          <button id="btn-go" class="go-btn">${t('出发')}</button>

          <div style="margin-top:16px;">
            <div class="rail-label" style="margin-bottom:7px;">${bi('一键切换山脉', 'QUICK MOUNTAIN')}</div>
            <div class="pill-row">
              ${MOUNTAINS.map((mt, idx) => `
                <button class="pill ${curM.id === mt.id ? 'on' : ''}" data-quickm="${idx}">${mName(mt)}</button>
              `).join('')}
            </div>
          </div>

          <div style="margin-top:18px;">
            <button id="t-career" class="rail-item"><span>${t('生涯巡回')}</span><small>4 ${bi('大山 · 12 赛事', 'MOUNTAINS · 12 RACES')}</small></button>
            <button id="t-endless" class="rail-item"><span>${t('无尽暴走')}</span><small>#TODAY · ${endlessSolo ? 'SOLO' : 'AI'}</small></button>
            <button id="t-garage" class="rail-item"><span>${t('改装车库')}</span><small>$${c.cash}</small></button>
            <button id="t-views" class="rail-item"><span>${t('视角')}</span><small>${viewName(Camera.currentView())}</small></button>
            <button id="t-settings" class="rail-item"><span>${t('设置')}</span><small>${bi(actions.getQuality ? actions.getQuality().toUpperCase() : 'AUTO', actions.getQuality ? actions.getQuality().toUpperCase() : 'AUTO')} · ${I18N.lang.toUpperCase()}</small></button>
            <button id="t-controls" class="rail-item"><span>${t('操作说明')}</span><small>WASD / PAD</small></button>
          </div>
        </div>

        <div style="margin-top:16px;font-size:11px;color:var(--faint);letter-spacing:0.12em;line-height:1.6;">
          ${t('全代码实时生成 · 4座险峰 · 8人速降混战')}<br/>
          <span style="opacity:0.65;">Build ${BUILD_HASH}</span>
        </div>
      </div>
      <div class="orbit-hint">${t('拖拽右侧画面 360° 环视环境 · 滚轮缩放')}</div>
    `;

    bindCornerTools();
    root().querySelectorAll('[data-quickm]').forEach(b => {
      b.onclick = () => {
        Sound.unlock();
        selMountainIdx = +b.dataset.quickm;
        actions.previewMountain(MOUNTAINS[selMountainIdx].id);
        renderTitle();
      };
    });
    document.getElementById('btn-go').onclick = () => {
      Sound.unlock();
      // Launch immediately on currently selected mountain!
      const ev = Career.EVENTS.find(e => e.mountainId === Course.mountain.id) || Career.EVENTS[0];
      actions.startEvent(ev, true);
    };
    document.getElementById('t-career').onclick = () => { Sound.unlock(); setScreen('career'); };
    document.getElementById('t-endless').onclick = () => { Sound.unlock(); setScreen('endless'); };
    document.getElementById('t-garage').onclick = () => { Sound.unlock(); setScreen('garage'); };
    document.getElementById('t-views').onclick = () => { Sound.unlock(); subMenu = 'views'; renderTitle(); };
    document.getElementById('t-settings').onclick = () => { Sound.unlock(); subMenu = 'settings'; renderTitle(); };
    document.getElementById('t-controls').onclick = () => { Sound.unlock(); subMenu = 'controls'; renderTitle(); };
  }

  // ---- 2. Career Tour ----
  function renderCareer() {
    const c = Career.data;
    const m = MOUNTAINS[selMountainIdx];
    const unlocked = Career.isMountainUnlocked(m.id);
    const evs = Career.EVENTS.filter(e => e.mountainId === m.id);

    root().innerHTML = `
      <div class="scrim-modal" style="display:flex;flex-direction:column;padding:24px 32px;overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:14px;">
            <button id="btn-back" class="e-btn">← ${t('返回')}</button>
            <div>
              <div style="font-family:var(--f-lat);font-size:10px;letter-spacing:0.32em;color:var(--sun);">CAREER TOUR · 4 MOUNTAINS</div>
              <div style="font-family:var(--f-song);font-size:24px;letter-spacing:0.20em;">${t('生涯巡回')}</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <div class="e-btn" style="cursor:default;color:var(--sun);">💰 $${c.cash}</div>
            <button id="btn-to-garage" class="e-btn on">🔧 ${t('改装车库')}</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin-bottom:18px;">
          ${MOUNTAINS.map((mt, i) => {
            const unl = Career.isMountainUnlocked(mt.id);
            const active = i === selMountainIdx;
            const wins = Career.EVENTS.filter(e => e.mountainId === mt.id && c.results[e.id] && c.results[e.id].bestRank <= 3).length;
            return `<button class="e-btn ${active ? 'on' : ''}" data-selm="${i}" style="border-radius:12px;text-align:left;padding:12px 16px;opacity:${unl ? 1 : 0.7};">
              <div style="font-family:var(--f-song);font-size:15px;letter-spacing:0.12em;">${unl ? '' : '🔒 '}${mName(mt)}</div>
              <div style="font-size:11px;color:var(--dim);margin-top:4px;">${I18N.lang === 'en' ? mt.name : mt.en} · 🏆 ${wins}/3</div>
            </button>`;
          }).join('')}
        </div>

        <div class="card clickable" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-family:var(--f-song);font-size:22px;color:var(--sun);letter-spacing:0.18em;">${mName(m)}</div>
            <div style="font-size:13px;color:var(--dim);margin-top:5px;">${mTag(m)} · ${bi('坡度', 'Slope')} ×${m.slopeMul.toFixed(2)} · ${bi('抓地', 'Grip')} ×${m.grip.toFixed(2)}</div>
          </div>
          ${unlocked
            ? `<div style="font-size:12px;color:#6ce89a;letter-spacing:0.14em;">✔ ${bi('已解锁 · 任选赛制出战', 'Unlocked · Ready to Race')}</div>`
            : `<button id="btn-unlock-m" class="e-btn on" ${c.cash < m.unlockCost ? 'style="opacity:.45;"' : ''}>🔓 ${bi(`花费 $${m.unlockCost} 提前解锁`, `Unlock Early for $${m.unlockCost}`)}</button>`}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          ${evs.map(ev => {
            const md = RACE_MODES[ev.modeId];
            const rec = c.results[ev.id];
            return `<div class="card clickable" style="display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-family:var(--f-song);font-size:18px;letter-spacing:0.12em;">${modeName(md)}</span>
                  <span style="font-size:12px;color:var(--sun);">${bi('冠军', '1st')} $${ev.prizes[0]}</span>
                </div>
                <div style="font-size:12px;color:var(--dim);margin-top:5px;">${md.len} m · AI Lv.${Math.round(ev.diff) + 1}</div>
                <div style="font-size:12px;color:var(--cyan);margin-top:8px;">🎯 ${bi('赞助商', 'Sponsor')}: ${ev.sponsor.text} (+$${ev.sponsor.bonus})</div>
                <div style="font-size:12px;color:var(--faint);margin-top:6px;">
                  ${rec ? bi(`最佳：第 ${rec.bestRank} 名 (${fmtTime(rec.bestTime)})`, `Best: #${rec.bestRank} (${fmtTime(rec.bestTime)})`) : bi('尚未挑战', 'Not raced yet')}
                </div>
              </div>
              <button class="e-btn ${unlocked ? 'fire' : ''}" data-ev="${ev.id}" ${unlocked ? '' : 'disabled'}>
                ${unlocked ? `▶ ${bi('开始赛事', 'Start Event')}` : `🔒 ${bi('未解锁', 'Locked')}`}
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
        if (ev) actions.startEvent(ev, false);
      };
    });
  }

  // ---- 3. Endless Mode ----
  function renderEndless() {
    const c = Career.data;
    const tSeed = todaySeed();
    const curSeed = Math.floor(Math.random() * 899999 + 100000);
    root().innerHTML = `
      <div class="scrim-modal" style="display:flex;flex-direction:column;padding:24px 32px;overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <button id="btn-back" class="e-btn">← ${t('返回')}</button>
            <div>
              <div style="font-family:var(--f-lat);font-size:10px;letter-spacing:0.32em;color:var(--sun);">ENDLESS DOWNHILL · ${endlessSolo ? 'SOLO FREERIDE' : 'AI RIVALS'}</div>
              <div style="font-family:var(--f-song);font-size:24px;letter-spacing:0.20em;">${t('无尽暴走')}</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <div class="pill-row">
              <button id="end-solo-on" class="pill ${endlessSolo ? 'on' : ''}">🏔 ${bi('单人独享（默认）', 'Solo Freeride')}</button>
              <button id="end-solo-off" class="pill ${!endlessSolo ? 'on' : ''}">⚔ ${bi('加入 AI 对手', 'With AI Rivals')}</button>
            </div>
            <div class="e-btn" style="cursor:default;color:var(--sun);">
              ${bi(`最远 ${c.endlessBest.dist}m · 最高 ${c.endlessBest.takedowns} K.O.`, `Best ${c.endlessBest.dist}m · ${c.endlessBest.takedowns} K.O.`)}
            </div>
          </div>
        </div>

        <div class="card clickable" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-color:rgba(255,208,138,0.45);">
          <div>
            <div style="font-family:var(--f-song);font-size:20px;color:var(--sun);letter-spacing:0.14em;">🌄 ${bi('今日之山', "Today's Mountain")} #today (${tSeed})</div>
            <div style="font-size:13px;color:var(--dim);margin-top:5px;">
              ${endlessSolo
                ? bi('全球同种子纯粹单人无尽下坡，悬崖速降 + 喷墨特技 + 伴随野生动物，随时可结算路线卡！', 'Shared daily seed pure solo endless freeride — mega cliff drops, ink stunts & wildlife, export route card anytime.')
                : bi('全球同种子无限下坡，动态 AI 对手持续在前方刷出，随时可结算高光路线卡！', 'Shared daily seed endless mountain with dynamically recycling AI rivals & route card export.')}
            </div>
          </div>
          <button id="btn-today" class="go-btn" style="height:44px;min-width:168px;font-size:14px;letter-spacing:0.24em;text-indent:0.24em;">${bi('挑战今日', 'Play Today')}</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
          ${MOUNTAINS.map(mt => `
            <div class="card clickable" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-family:var(--f-song);font-size:17px;letter-spacing:0.14em;">${mName(mt)}</div>
                <div style="font-size:12px;color:var(--dim);margin-top:5px;line-height:1.5;">${mTag(mt)}</div>
              </div>
              <button class="e-btn fire" data-endm="${mt.id}">▶ ${bi('无尽速降', 'Endless Shred')}</button>
            </div>
          `).join('')}
        </div>
      </div>`;

    document.getElementById('btn-back').onclick = () => setScreen('title');
    document.getElementById('end-solo-on').onclick = () => { endlessSolo = true; renderEndless(); };
    document.getElementById('end-solo-off').onclick = () => { endlessSolo = false; renderEndless(); };
    document.getElementById('btn-today').onclick = () => {
      const mToday = MOUNTAINS[tSeed % MOUNTAINS.length];
      location.hash = 'today';
      actions.startEndless(mToday.id, tSeed, 1.5, endlessSolo);
    };
    root().querySelectorAll('[data-endm]').forEach(b => {
      b.onclick = () => {
        const sd = curSeed + Math.floor(Math.random() * 999);
        location.hash = 'seed-' + sd;
        actions.startEndless(b.dataset.endm, sd, 1.2, endlessSolo);
      };
    });
  }

  // ---- 4. Live 3D Garage Showroom (orbitable!) ----
  function renderGarage() {
    const c = Career.data;
    const wins = Career.wonCount();
    root().innerHTML = `
      <div style="position:absolute;inset:0;display:flex;justify-content:space-between;padding:var(--gt) var(--gr) var(--gb) var(--gl);pointer-events:none;">
        <div style="display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;">
          <div style="display:flex;align-items:center;gap:10px;pointer-events:auto;">
            <button id="btn-back" class="e-btn">← ${t('返回')}</button>
            <div class="e-btn" style="cursor:default;font-family:var(--f-song);letter-spacing:0.16em;">${t('改装车库')}</div>
            <div class="e-btn on" style="cursor:default;">💰 $${c.cash}</div>
          </div>

          <div class="card clickable" style="max-width:340px;">
            <div class="rail-label">${bi('涂装配色（免费切换）', 'LIVERY PAINT (FREE)')}</div>
            <div class="pill-row">
              ${Career.PAINTS.map((p, i) => `
                <button class="pill ${i === c.paintIdx ? 'on' : ''}" data-paint="${i}">${t(p.name)}</button>
              `).join('')}
            </div>
            ${wins >= 2 ? `
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--hair);font-size:12px;">
                <div style="color:var(--sun);margin-bottom:6px;">🎮 ${bi('PS2 经典作弊码', 'Classic Cheats Unlocked')}</div>
                <label style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;cursor:pointer;">
                  <input type="checkbox" id="chk-grav" ${c.cheats.lowGrav ? 'checked' : ''}/> ${bi('月球低重力', 'Low Gravity')}
                </label>
                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="checkbox" id="chk-bat" ${c.cheats.megaBat ? 'checked' : ''}/> ${bi('满级球棒开局', 'Mega Bat')}
                </label>
              </div>
            ` : `<div style="margin-top:10px;font-size:11px;color:var(--faint);">${bi('赢下 2 场生涯冠军解锁娱乐作弊码 · 拖拽画面 360° 赏车', 'Win 2 career events to unlock cheats · Drag to orbit 360°')}</div>`}
          </div>
        </div>

        <div class="card clickable" style="width:min(365px,44vw);display:flex;flex-direction:column;gap:10px;align-self:center;max-height:86vh;overflow:auto;">
          <div class="rail-kicker" style="margin-bottom:2px;">UPGRADES · ${bi('3D 外观同步升级', 'LIVE 3D UPGRADES')}</div>
          ${Career.PARTS.map(p => {
            const lv = c.upgrades[p.key] || 0;
            const maxed = lv >= 4;
            const cost = maxed ? 0 : p.costs[lv];
            const canBuy = !maxed && c.cash >= cost;
            const bars = [0, 1, 2, 3].map(b => `<span style="display:inline-block;width:22px;height:4px;border-radius:2px;margin-right:4px;background:${b < lv ? 'var(--sun)' : 'rgba(255,255,255,.16)'};"></span>`).join('');
            return `<div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-size:14px;font-weight:500;">${t(p.name)} <span style="color:var(--sun);font-size:11px;">Lv.${lv}/4</span></div>
                <div style="font-size:11px;color:var(--dim);margin:3px 0 6px;">${t(p.desc)}</div>
                <div>${bars}</div>
              </div>
              <button class="e-btn ${canBuy ? 'on' : ''}" data-buy="${p.key}" ${canBuy ? '' : 'disabled'} style="white-space:nowrap;padding:7px 12px;font-size:12px;">
                ${maxed ? 'MAX' : '$' + cost}
              </button>
            </div>`;
          }).join('')}
          <button id="btn-go-career" class="e-btn fire" style="margin-top:4px;width:100%;">▶ ${bi('去比赛赚奖金', 'Race for Cash')}</button>
        </div>
      </div>`;

    document.getElementById('btn-back').onclick = () => setScreen('title');
    document.getElementById('btn-go-career').onclick = () => setScreen('career');
    root().querySelectorAll('[data-paint]').forEach(b => { b.onclick = () => { Career.setPaint(+b.dataset.paint); renderGarage(); }; });
    root().querySelectorAll('[data-buy]').forEach(b => {
      b.onclick = () => { if (Career.buyUpgrade(b.dataset.buy)) { Sound.playTrick(3); renderGarage(); } };
    });
    const gChk = document.getElementById('chk-grav');
    if (gChk) gChk.onchange = () => { Career.data.cheats.lowGrav = gChk.checked; Career.save(); };
    const bChk = document.getElementById('chk-bat');
    if (bChk) bChk.onchange = () => { Career.data.cheats.megaBat = bChk.checked; Career.save(); };
  }

  // ---- 5. Minimal Editorial Racing HUD ----
  function renderRaceHUD() {
    const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    root().innerHTML = `
      <div class="hud-tag">
        <small>${modeName(Course.mode)}</small>
        <b>${mName(Course.mountain)}</b>
        <div style="display:flex;gap:6px;margin-top:8px;pointer-events:auto;">
          <button id="btn-pause" class="e-btn" style="padding:5px 12px;font-size:11px;">⏸ ${t('菜单')}</button>
          <button id="btn-view" class="e-btn" style="padding:5px 11px;font-size:11px;">🎥 <span id="hud-vname">${viewName(Camera.currentView())}</span></button>
          ${Course.mode.endless ? `<button id="btn-end-run" class="e-btn on" style="padding:5px 12px;font-size:11px;">🏁 ${t('结算战报')}</button>` : ''}
        </div>
      </div>

      <div style="position:absolute;top:var(--gt);right:var(--gr);text-align:right;text-shadow:0 1px 4px rgba(0,0,0,0.92), 0 2px 18px rgba(5,8,13,0.85);">
        <div id="hud-pos" style="font-family:var(--f-lat);font-weight:300;font-size:clamp(34px,4.5vw,48px);line-height:0.95;font-variant-numeric:tabular-nums;">1<span style="font-size:16px;color:var(--dim);">/8</span></div>
        <div id="hud-ko" style="font-size:12px;letter-spacing:0.12em;color:var(--sun);margin-top:5px;font-weight:500;">K.O. 0 · ${t('推搡')}</div>
        <div class="hud-bar" style="margin-left:auto;width:142px;"><i id="hud-prog-fill" style="background:var(--cyan);"></i></div>
      </div>

      <div id="hud-banner" style="position:absolute;top:17%;left:50%;transform:translateX(-50%);font-family:var(--f-song);font-weight:700;font-size:clamp(22px,3.2vw,34px);letter-spacing:0.16em;text-shadow:0 4px 22px rgba(0,0,0,.85);text-align:center;pointer-events:none;white-space:nowrap;"></div>
      <div id="hud-sub" style="position:absolute;top:24%;left:50%;transform:translateX(-50%);font-family:var(--f-lat);font-size:12px;letter-spacing:0.22em;color:var(--sun);text-shadow:0 2px 12px rgba(0,0,0,.9);pointer-events:none;"></div>

      <div class="hud-spd">
        <div id="hud-spd" class="num">0</div>
        <div class="unit">KM / H</div>
        <div class="hud-bar" style="width:162px;"><i id="hud-tach"></i></div>
        <div style="display:flex;justify-content:space-between;gap:12px;font-family:var(--f-lat);font-size:9px;letter-spacing:0.20em;color:var(--sun);margin-top:10px;width:162px;">
          <span>ADRENALINE</span><span id="hud-adr-pct">25%</span>
        </div>
        <div class="hud-bar adr" style="width:162px;"><i id="hud-adr" style="width:25%;"></i></div>
      </div>

      <div class="hud-right">
        <div id="hud-dist" class="big">0 m</div>
        <div id="hud-tricks" class="sub">TRICKS 0</div>
      </div>

      ${isTouch ? `
        <div style="position:absolute;bottom:108px;left:var(--gl);display:flex;gap:8px;pointer-events:auto;">
          <button id="t-atkl" class="e-btn fire" style="padding:14px 13px;">👊 L</button>
          <button id="t-atkr" class="e-btn fire" style="padding:14px 13px;">👊 R</button>
          <button id="t-brk" class="e-btn" style="padding:14px 13px;">${bi('甩尾', 'DRIFT')}</button>
        </div>
        <div style="position:absolute;bottom:108px;right:var(--gr);display:flex;gap:8px;pointer-events:auto;">
          <button id="t-jump" class="e-btn on" style="padding:14px 16px;">${bi('跳 / 特技', 'JUMP')}</button>
          <button id="t-boost" class="e-btn fire" style="padding:14px 14px;">🔥 BOOST</button>
        </div>
      ` : ''}
    `;

    document.getElementById('btn-pause').onclick = () => actions.togglePause();
    document.getElementById('btn-view').onclick = () => {
      Camera.cycle(1);
      const vn = document.getElementById('hud-vname');
      if (vn) vn.textContent = viewName(Camera.currentView());
    };
    const endBtn = document.getElementById('btn-end-run');
    if (endBtn) endBtn.onclick = () => actions.finishEndlessNow();

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
    const posEl  = document.getElementById('hud-pos');
    const koEl   = document.getElementById('hud-ko');
    const progEl = document.getElementById('hud-prog-fill');
    const spdEl  = document.getElementById('hud-spd');
    const tachEl = document.getElementById('hud-tach');
    const distEl = document.getElementById('hud-dist');
    const trkEl  = document.getElementById('hud-tricks');
    const adrEl  = document.getElementById('hud-adr');
    const adrPct = document.getElementById('hud-adr-pct');
    const banEl  = document.getElementById('hud-banner');
    const subEl  = document.getElementById('hud-sub');
    const vnEl   = document.getElementById('hud-vname');

    if (vnEl) vnEl.textContent = viewName(Camera.currentView());
    if (posEl) {
      posEl.innerHTML = Course.mode.endless
        ? `${(player.s / 1000).toFixed(2)}<span style="font-size:15px;color:var(--dim);"> KM</span>`
        : `${player.rank}<span style="font-size:16px;color:var(--dim);">/${totalRiders}</span>`;
    }
    if (koEl) {
      koEl.textContent = totalRiders <= 1
        ? bi('SOLO · 单人无尽畅滑', 'SOLO · FREERIDE FLOW')
        : `K.O. ${player.takedowns} · ${t(Combat.TIER_NAMES[player.combatTier])} · 🍼×${player.bottles}`;
    }
    if (progEl) {
      const p = Course.mode.endless ? ((player.s % 1000) / 10) : clamp((player.s / Course.finishS) * 100, 0, 100);
      progEl.style.width = `${p.toFixed(1)}%`;
    }
    const kmh = Math.round(player.speed * 3.6);
    if (spdEl) spdEl.textContent = String(kmh);
    if (tachEl) tachEl.style.width = `${clamp(kmh / 1.4, 0, 100).toFixed(0)}%`;
    if (distEl) distEl.textContent = Course.mode.endless ? `${Math.round(player.s)} m` : `${Math.round(player.s)} / ${Course.finishS} m`;
    if (trkEl) trkEl.textContent = `${bi('特技', 'STUNTS')} ${player.totalTrickScore} · MAX ${Math.round(player.maxSpeed * 3.6)}`;
    if (adrEl) adrEl.style.width = `${Math.round(player.adrenaline)}%`;
    if (adrPct) adrPct.textContent = player.boosting ? 'OVERDRIVE' : `${Math.round(player.adrenaline)}%`;

    if (banEl) {
      if (player.air && player.trickType && player.trickScore > 18) {
        const tr = Stunts.TRICKS[player.trickType];
        const trName = I18N.lang === 'en' ? tr.en : tr.name;
        banEl.style.color = '#ffd08a';
        banEl.textContent = `${trName}  +${Math.round(player.trickScore)}`;
        if (subEl) subEl.textContent = player.trickType === 'backflip'
          ? bi('极限后空翻 · 完成翻腾稳稳着陆', 'BACKFLIP · STOMP THE LANDING')
          : bi('喷墨花式 · 完整动作落地加速', 'INK STYLE · CLEAN STOMP BOOST');
      } else if (bannerT > 0) {
        banEl.style.color = bannerCol;
        banEl.textContent = bannerText;
        if (subEl) subEl.textContent = '';
      } else {
        banEl.textContent = '';
        if (subEl) subEl.textContent = player.onShortcut ? bi('⚡ 捷径抄近道', '⚡ SHORTCUT LINE') : '';
      }
    }
  }

  // ---- 6. Translucent Left-Rail Pause Menu (Right 65% Wide Open for 360-Orbit + 1-Click Mountain & Quality Switch!) ----
  function renderPause() {
    if (subMenu !== 'main') return renderSubRail('pause');
    const curQual = actions.getQuality ? actions.getQuality() : 'auto';
    const qualOpts = [
      ['auto', bi('自动', 'Auto')],
      ['high', bi('高', 'High')],
      ['balanced', bi('均衡', 'Balanced')],
      ['smooth', bi('流畅', 'Smooth')],
    ];
    root().innerHTML = `
      <div class="scrim-left"></div>
      ${cornerToolsHtml()}
      <div class="rail">
        <div class="rail-kicker">PAUSED · ${mName(Course.mountain)}</div>
        <div class="rail-title">${t('已暂停')}</div>
        <button id="p-resume" class="go-btn" style="height:46px;min-width:168px;font-size:15px;letter-spacing:0.32em;text-indent:0.32em;margin-bottom:16px;">${t('继续狂飙')}</button>

        <div style="margin-bottom:14px;">
          <div class="rail-label" style="margin-bottom:6px;">${bi('一键切换山脉', 'SWITCH MOUNTAIN')}</div>
          <div class="pill-row">
            ${MOUNTAINS.map(mt => `
              <button class="pill ${Course.mountain.id === mt.id ? 'on' : ''}" data-swm="${mt.id}">${mName(mt)}</button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div class="rail-label" style="margin-bottom:6px;">${t('画质')} · QUALITY</div>
          <div class="pill-row">
            ${qualOpts.map(([id, lbl]) => `
              <button class="pill ${curQual === id ? 'on' : ''}" data-pqual="${id}">${lbl}</button>
            `).join('')}
          </div>
        </div>

        <button id="p-photo" class="rail-item"><span>📷 ${t('拍照模式')}</span><small>P</small></button>
        <button id="p-views" class="rail-item"><span>🎥 ${t('视角')}</span><small>${viewName(Camera.currentView())}</small></button>
        <button id="p-settings" class="rail-item"><span>⚙ ${t('设置')}</span><small>${I18N.lang.toUpperCase()} · ${t('声音')}</small></button>
        <button id="p-controls" class="rail-item"><span>⌨ ${t('操作说明')}</span><small>KEYS</small></button>
        <button id="p-restart" class="rail-item"><span>↻ ${t('重新开局')}</span><small></small></button>
        <button id="p-garage" class="rail-item"><span>🔧 ${t('改装车库')}</span><small>$${Career.data.cash}</small></button>
        <button id="p-title" class="rail-item"><span>⌂ ${t('返回起点')}</span><small></small></button>
      </div>
      <div class="orbit-hint">${t('拖拽右侧画面 360° 环视环境 · 滚轮缩放')}</div>
    `;

    bindCornerTools();
    root().querySelectorAll('[data-swm]').forEach(b => {
      b.onclick = () => { Sound.unlock(); if (actions.switchMountainNow) actions.switchMountainNow(b.dataset.swm); };
    });
    root().querySelectorAll('[data-pqual]').forEach(b => {
      b.onclick = () => { if (actions.setQuality) actions.setQuality(b.dataset.pqual); renderPause(); };
    });
    document.getElementById('p-resume').onclick = () => actions.togglePause();
    document.getElementById('p-photo').onclick = () => actions.enterPhoto();
    document.getElementById('p-views').onclick = () => { subMenu = 'views'; renderPause(); };
    document.getElementById('p-settings').onclick = () => { subMenu = 'settings'; renderPause(); };
    document.getElementById('p-controls').onclick = () => { subMenu = 'controls'; renderPause(); };
    document.getElementById('p-restart').onclick = () => actions.restartRun();
    document.getElementById('p-garage').onclick = () => setScreen('garage');
    document.getElementById('p-title').onclick = () => setScreen('title');
  }

  // ---- 7. Editorial Results + Bilingual Highlight Route Card ----
  function renderResult(res) {
    lastResult = res;
    const pay = res.payout;
    root().innerHTML = `
      <div class="scrim-modal" style="display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;">
        <div class="card clickable" style="width:min(880px,96vw);display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-family:var(--f-song);font-size:24px;color:var(--sun);letter-spacing:0.14em;">
                ${res.endless
                  ? bi(`🏁 无尽暴走结算 · ${(res.dist / 1000).toFixed(2)} KM`, `🏁 ENDLESS FINISH · ${(res.dist / 1000).toFixed(2)} KM`)
                  : bi(`🏁 冲线！第 ${res.rank} 名 · ${fmtTime(res.time)}`, `🏁 FINISHED #${res.rank} · ${fmtTime(res.time)}`)}
              </div>
              <div style="font-size:13px;color:var(--dim);margin-top:5px;">
                ${bi(`名次 +$${pay.prize} · 击倒 +$${pay.koPay} · 特技 +$${pay.trickPay}`, `Prize +$${pay.prize} · KO +$${pay.koPay} · Stunts +$${pay.trickPay}`)}
                ${pay.spHit ? ` · <b style="color:#6ce89a;">${bi('赞助商达成', 'Sponsor')} +$${pay.spPay}!</b>` : ''}
                &nbsp;→&nbsp; <b style="color:var(--sun);font-size:15px;">+$${pay.total} ($${Career.data.cash})</b>
              </div>
            </div>
            <button id="r-save" class="e-btn on">📸 ${bi('保存战报卡 PNG', 'Save Route PNG')}</button>
          </div>

          <canvas id="rc-canvas" style="width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--hair);display:block;"></canvas>

          <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button id="r-retry" class="e-btn">↻ ${bi('再冲一局', 'Race Again')}</button>
            <button id="r-garage" class="e-btn on">🔧 ${t('改装车库')}</button>
            <button id="r-next" class="e-btn fire">🏆 ${t('返回赛事')}</button>
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

  function redraw() {
    if (!root()) return;
    if (screen === 'title') renderTitle();
    else if (screen === 'career') renderCareer();
    else if (screen === 'endless') renderEndless();
    else if (screen === 'garage') renderGarage();
    else if (screen === 'race') renderRaceHUD();
    else if (screen === 'pause') renderPause();
    else if (screen === 'result') renderResult(lastResult);
  }

  function setScreen(next, payload) {
    screen = next;
    subMenu = 'main';
    if (actions && actions.onScreen) actions.onScreen(next);
    if (next === 'result' && payload) lastResult = payload;
    redraw();
  }

  I18N.onChange(() => redraw());

  return {
    init(cb) { actions = cb; },
    setScreen,
    openSub(sub) { subMenu = sub || 'main'; redraw(); },
    updateHUD,
    redraw,
    get screen() { return screen; },
  };
})();
