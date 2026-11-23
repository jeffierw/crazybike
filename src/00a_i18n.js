// ---------------------------------------------------------------- 00a_i18n: browser-language auto-detect & live ZH/EN localization
const I18N = (() => {
  const EN = {
    '暴走速降': 'CRAZYBIKE',
    '出发': 'START',
    '继续狂飙': 'Resume',
    '生涯巡回': 'Career Tour',
    '无尽暴走': 'Endless',
    '改装车库': '3D Garage',
    '视角': 'Camera',
    '设置': 'Settings',
    '操作说明': 'Controls',
    '拍照模式': 'Photo Mode',
    '重新开局': 'Restart',
    '返回起点': 'Start Gate',
    '返回': 'Back',
    '返回赛事': 'Events',
    '菜单': 'Menu',
    '结算战报': 'Finish & Card',
    '静音': 'Mute',
    '声音': 'Sound',
    '全屏': 'Fullscreen',
    '画质': 'Quality',
    '自动': 'Auto',
    '高': 'High',
    '高画质': 'High',
    '均衡': 'Balanced',
    '流畅': 'Low',
    '低画质': 'Low',
    '内存': 'RAM',
    '攻击击倒对手': 'Combat Knockdowns',
    '开启 · 击飞倒地': 'On (Ragdoll KO)',
    '关闭 · 仅推挤': 'Off (Shove Only)',
    '仅影响格斗重击/水壶/加速撞击，撞树与特技落地永远不会摔车': 'Applies only to melee/bottle/boost hits — obstacles & tricks never crash',
    '语言': 'Language',
    '音效': 'SFX',
    '音乐': 'Music',
    '山脉场景': 'Mountain',
    '已暂停': 'PAUSED',
    '风燥强度': 'Wind Roar',
    '柔和': 'Soft',
    '标准': 'Standard',
    '强风': 'Strong',
    '漂移手感': 'Drift Feel',
    '稳健抓地': 'Grip',
    '暴走甩尾': 'Arcade Drift',
    '镜头风格': 'Lens Style',
    '贴地激进': 'Low',
    '标准街机': 'Classic',
    '高广角': 'Wide',
    '推搡': 'Shove',
    '飞踹': 'Boot Kick',
    '水壶砸击': 'Bottle Toss',
    '球棒暴击': 'Alloy Bat',
    '碳纤维车架': 'Carbon Frame',
    '速降车架': 'DH Alloy Frame',
    '双肩避震前叉': 'Dual-Crown Fork',
    '避震前叉': 'Dual-Crown Fork',
    '极速传动套件': 'Speed Drivetrain',
    '传动套件': 'DH Drivetrain',
    '宽齿防滑胎': 'DH Knobby Tires',
    '越野宽胎': 'DH Knobby Tires',
    '暴走格斗装备': 'Combat Gear',
    '街头装备': 'Street Gear',
    '抗撞击韧性 + 车身增粗': 'Crash toughness & reinforced frame',
    '起跳弹力 + 落地减震(Lv2金管)': 'Jump pop & damping (Lv2 Kashima Gold)',
    '踩踏爆发 + 极速上限提升': 'Sprint cadence torque & top speed',
    '压弯抓地 + 宽胎视觉进化': 'Cornering grip & wider DH tires',
    '攻击力度 + 随车水壶 + 球棒': 'Melee impact, bottles & alloy bat',
    '碳黑红岩': 'Carbon Crimson',
    '暴走烈焰橙': 'Blaze Orange',
    '冷松橄榄绿': 'Alpine Olive',
    '黑金战神': 'Black & Gold',
    '猩红狂鲨': 'Crimson Shark',
    '岩灰电青': 'Slate Cyan',
    '全代码实时生成 · 4座险峰 · 8人速降混战': 'Pure-code 3D downhill · 4 mountains · Free-line shred',
    '拖拽右侧画面 360° 环视环境 · 滚轮缩放': 'Drag right to orbit 360° · Scroll to zoom',
    '悬崖飞跃 · 彩带特技 · 贴身肉搏': 'Mega cliff drops · Ink-brush stunts · Open freeride',
    '正在雕塑车手模型': 'Sculpting SDF rider',
    '正在构筑山脉与悬崖': 'Carving cliffs & trails',
    '点亮天空与光影': 'Lighting atmosphere',
    '准备出发': 'Ready at start gate',
    '挥拳': 'Punch',
    '水壶': 'Water Bottle',
    '氮气': 'Nitro Boost',
    '当前机位预览': 'ACTIVE VIEW PREVIEW',
  };

  let lang = 'zh';
  function detect() {
    try {
      const m = /[?&]lang=(zh|en)\b/i.exec(location.search || '');
      if (m) return m[1].toLowerCase();
      const saved = localStorage.getItem('crazybike_lang');
      if (saved === 'zh' || saved === 'en') return saved;
      const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'zh';
      return /^zh/i.test(nav) ? 'zh' : 'en';
    } catch (_) {
      return 'zh';
    }
  }
  lang = detect();

  const listeners = [];

  return {
    get lang() { return lang; },
    setLang(next) {
      if (next !== 'zh' && next !== 'en') return;
      lang = next;
      try { localStorage.setItem('crazybike_lang', lang); } catch (_) {}
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
      }
      for (const fn of listeners) { try { fn(lang); } catch (_) {} }
    },
    toggle() {
      this.setLang(lang === 'zh' ? 'en' : 'zh');
      return lang;
    },
    onChange(fn) { listeners.push(fn); },
    // Explicit bilingual helper: I18N.bi('中文', 'English')
    bi(zh, en) { return lang === 'en' ? en : zh; },
    // Dictionary lookup by Chinese key
    t(zh) { return lang === 'en' ? (EN[zh] || zh) : zh; },
  };
})();
