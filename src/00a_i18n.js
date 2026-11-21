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
    '均衡': 'Balanced',
    '流畅': 'Smooth',
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
    '双肩避震前叉': 'Dual-Crown Fork',
    '极速传动套件': 'Speed Drivetrain',
    '宽齿防滑胎': 'DH Knobby Tires',
    '暴走格斗装备': 'Combat Gear',
    '减轻自重并提升冲撞韧性，高阶更稳': 'Lighter chassis & crash toughness',
    '吸收重落冲击、跳跃更高、Lv2解锁黄金前叉': 'Higher jumps, soft landings, Lv2 Gold Fork',
    '显著拉高极速与起步冲刺加速度': 'Higher top speed & sprint torque',
    '增强压弯抓地力与黑砂漂移可控性': 'Stronger cornering grip & sand control',
    '提升武器等级、水壶上限与特技倍率': 'Higher weapon tier, bottles & trick mult',
    '烈焰红岩': 'Blaze Red',
    '霓虹青电': 'Neon Cyan',
    '黄金暴走': 'Gold Rush',
    '暗夜幽灵': 'Midnight',
    '苍翠山王': 'Alpine Mint',
    '全代码实时生成 · 4座险峰 · 8人速降混战': 'Pure-code 3D downhill · 4 mountains · 8-rider combat',
    '拖拽右侧画面 360° 环视环境 · 滚轮缩放': 'Drag right to orbit 360° · Scroll to zoom',
    '悬崖飞跃 · 彩带特技 · 贴身肉搏': 'Sheer cliff drops · Ribbon stunts · Street combat',
    '正在雕塑车手模型': 'Sculpting SDF rider',
    '正在构筑山脉与悬崖': 'Carving cliffs & trails',
    '点亮天空与光影': 'Lighting atmosphere',
    '准备出发': 'Ready at start gate',
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
