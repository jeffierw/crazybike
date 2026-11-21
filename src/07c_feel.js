// ---------------------------------------------------------------- 07c_feel: unified Keyboard + Gamepad + Touch input & arcade juice/hitstop state
const Input = (() => {
  const keys = {};
  const touch = { steer: 0, dragId: null, dragX0: 0, jump: false, boost: false, brake: false, atkL: false, atkR: false };
  const justPressed = { atkL: false, atkR: false, cam: false, pause: false };
  let scriptFn = null;

  const GAME_CODES = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyJ', 'KeyK', 'KeyV', 'KeyP',
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
  ]);

  function isEditableTarget(el) {
    return !!(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''));
  }

  function init(canvas) {
    addEventListener('keydown', e => {
      if (isEditableTarget(e.target)) return;
      if (GAME_CODES.has(e.code) && !e.metaKey && !e.altKey) {
        e.preventDefault();
      }
      if (typeof Photo !== 'undefined' && Photo.on) return;
      if (!keys[e.code]) {
        if (e.code === 'KeyQ' || e.code === 'KeyJ') justPressed.atkL = true;
        if (e.code === 'KeyE' || e.code === 'KeyK') justPressed.atkR = true;
        if (e.code === 'KeyV') justPressed.cam = true;
        if (e.code === 'Escape') justPressed.pause = true;
      }
      keys[e.code] = true;
    }, { capture: true });
    addEventListener('keypress', e => {
      if (isEditableTarget(e.target)) return;
      if (GAME_CODES.has(e.code) && !e.metaKey && !e.altKey) e.preventDefault();
    }, { capture: true });
    addEventListener('keyup', e => { keys[e.code] = false; }, { capture: true });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; touch.steer = 0; touch.dragId = null; });

    if (canvas) {
      canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        if (touch.dragId === null && e.clientX < innerWidth * 0.55) {
          touch.dragId = e.pointerId;
          touch.dragX0 = e.clientX;
        }
      });
      canvas.addEventListener('pointermove', e => {
        if (e.pointerId === touch.dragId) {
          touch.steer = clamp((e.clientX - touch.dragX0) / 72, -1, 1);
        }
      });
      const end = e => {
        if (e.pointerId === touch.dragId) { touch.dragId = null; touch.steer = 0; }
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    }
  }

  let prevPadBtns = [];
  function readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[0];
    if (!gp) return null;
    const ax0 = Math.abs(gp.axes[0] || 0) > 0.14 ? gp.axes[0] : 0;
    const ax1 = Math.abs(gp.axes[1] || 0) > 0.22 ? gp.axes[1] : 0;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = i => b(i) && !prevPadBtns[i];
    const out = {
      steer: ax0,
      airY: -ax1,
      pedal: b(7) || (gp.buttons[7] && gp.buttons[7].value > 0.2),
      brake: b(6) || (gp.buttons[6] && gp.buttons[6].value > 0.2),
      jump: b(0),
      boost: b(5) || b(3),
      atkL: edge(4) || edge(2),
      atkR: edge(1),
      cam: edge(8),
      pause: edge(9),
    };
    prevPadBtns = gp.buttons.map(x => !!x.pressed);
    return out;
  }

  function sample(time) {
    if (scriptFn) return scriptFn(time);
    const gp = readGamepad();
    const kbSteer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const kbUp = !!(keys.KeyW || keys.ArrowUp);
    const kbDown = !!(keys.KeyS || keys.ArrowDown);

    const steer = clamp(kbSteer + touch.steer + (gp ? gp.steer : 0), -1, 1);
    const out = {
      steer,
      pedal: kbUp || touch.dragId !== null || (gp ? gp.pedal : false), // auto-pedal on mobile drag!
      brake: kbDown || touch.brake || (gp ? gp.brake : false),
      jump: !!(keys.Space || touch.jump || (gp && gp.jump)),
      boost: !!(keys.ShiftLeft || keys.ShiftRight || touch.boost || (gp && gp.boost)),
      trickUp: kbUp || (gp && gp.airY > 0.45),
      trickDown: kbDown || (gp && gp.airY < -0.45),
      trickLeft: !!(keys.KeyA || keys.ArrowLeft || (gp && gp.steer < -0.45) || touch.steer < -0.45),
      trickRight: !!(keys.KeyD || keys.ArrowRight || (gp && gp.steer > 0.45) || touch.steer > 0.45),
      atkL: justPressed.atkL || touch.atkL || (gp && gp.atkL),
      atkR: justPressed.atkR || touch.atkR || (gp && gp.atkR),
      cam: justPressed.cam || (gp && gp.cam),
      pause: justPressed.pause || (gp && gp.pause),
    };
    justPressed.atkL = justPressed.atkR = justPressed.cam = justPressed.pause = false;
    touch.atkL = touch.atkR = false;
    return out;
  }

  return { init, sample, touch, keys, setScript(fn) { scriptFn = fn; } };
})();

const Feel = (() => {
  const F = {
    shake: 0,
    hitFlash: 0,
    hitstop: 0,
    slowMo: 0,
    landDip: 0,
    flinchRoll: 0,
    nearCd: 0,
    speedNorm: 0,
    boostGlow: 0,
  };

  F.jolt = function (shakeAmt = 0.25, flashAmt = 0.35, hitstopSec = 0) {
    F.shake = Math.max(F.shake, shakeAmt);
    F.hitFlash = Math.max(F.hitFlash, flashAmt);
    F.hitstop = Math.max(F.hitstop, hitstopSec);
  };

  F.land = function (impact) {
    F.landDip = clamp(impact * 0.032, 0, 0.42);
    F.shake = Math.max(F.shake, clamp(impact * 0.015, 0, 0.24));
  };

  F.nearMiss = function (side) {
    if (F.nearCd > 0) return false;
    F.nearCd = 0.9;
    F.flinchRoll = -side * 0.075;
    return true;
  };

  F.step = function (R, dt) {
    F.shake = damp(F.shake, 0, 12, dt);
    F.hitFlash = damp(F.hitFlash, 0, 10, dt);
    F.landDip = damp(F.landDip, 0, 9, dt);
    F.flinchRoll = damp(F.flinchRoll, 0, 8, dt);
    if (F.nearCd > 0) F.nearCd = Math.max(0, F.nearCd - dt);
    if (F.slowMo > 0) F.slowMo = Math.max(0, F.slowMo - dt);
    F.speedNorm = damp(F.speedNorm, sat((R.speed - 14) / 22), 6, dt);
    F.boostGlow = damp(F.boostGlow, R.boosting ? 1 : 0, 10, dt);
  };

  return F;
})();
