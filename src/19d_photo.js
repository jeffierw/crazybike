// ---------------------------------------------------------------- 19d_photo: Freeze-Frame Photo Mode (free-fly 360 lens + clean PNG shutter capture)
const Photo = (() => {
  const P = { on: false, shots: 0 };
  const REACH = 55;
  const FOV_MIN = 0.28, FOV_MAX = 1.72;

  let gfx = null, canvas = null, onExitCb = null;
  let cam = null, startSnap = null, anchor = [0, 0, 0];
  let hudEl = null, hideHint = false, flashT = 0, toastT = 0;
  const keys = {};
  let drag = null;

  function fwdOf(c) {
    return [Math.sin(c.yaw) * Math.cos(c.pit), Math.sin(c.pit), -Math.cos(c.yaw) * Math.cos(c.pit)];
  }

  function T(zh, en) {
    return (typeof I18N !== 'undefined' && I18N.lang === 'en') ? en : zh;
  }

  function ensureHud() {
    if (hudEl || typeof document === 'undefined' || !document.createElement) return;
    hudEl = document.createElement('div');
    hudEl.id = 'photoHud';
    hudEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;display:none;flex-direction:column;justify-content:space-between;padding:24px 28px;';
    hudEl.innerHTML = `
      <div id="photoFlash" style="position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity 0.28s;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div id="photoBadge" style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,244,230,0.86);text-shadow:0 1px 12px rgba(0,0,0,0.65);">PHOTO MODE</div>
        <div id="photoToast" style="font-size:13px;color:#ffd08a;opacity:0;transition:opacity 0.25s;text-shadow:0 1px 12px rgba(0,0,0,0.8);"></div>
      </div>
      <div id="photoBar" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;pointer-events:auto;">
        <div id="photoHint" style="font-size:12px;color:rgba(255,246,236,0.78);line-height:1.7;text-shadow:0 1px 10px rgba(0,0,0,0.85);"></div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button id="photoReset" style="padding:8px 14px;border:1px solid rgba(255,245,235,0.28);background:rgba(12,14,18,0.52);color:#fff;border-radius:99px;cursor:pointer;font-size:12px;letter-spacing:0.08em;">重置</button>
          <button id="photoSnap" style="padding:10px 22px;border:1px solid rgba(255,208,138,0.72);background:rgba(255,91,31,0.85);color:#fff;border-radius:99px;cursor:pointer;font-size:13px;font-weight:600;letter-spacing:0.12em;">快门拍照</button>
          <button id="photoExit" style="padding:8px 14px;border:1px solid rgba(255,245,235,0.28);background:rgba(12,14,18,0.52);color:#fff;border-radius:99px;cursor:pointer;font-size:12px;letter-spacing:0.08em;">返回</button>
        </div>
      </div>
    `;
    document.body.appendChild(hudEl);
    hudEl.querySelector('#photoReset').onclick = () => P.reset();
    hudEl.querySelector('#photoSnap').onclick = () => P.capture();
    hudEl.querySelector('#photoExit').onclick = () => P.exit();
  }

  function refreshLabels() {
    if (!hudEl) return;
    hudEl.querySelector('#photoBadge').textContent = T('自由定格摄影', 'FREEZE-FRAME PHOTO MODE');
    hudEl.querySelector('#photoHint').textContent = T(
      '拖拽转向 · WASD 移动 · Q/E 升降 · 滚轮变焦 · Z/C 倾斜 · H 隐藏提示 · Enter 拍照 · Esc 返回',
      'Drag look · WASD move · Q/E down/up · Wheel zoom · Z/C roll · H hide UI · Enter shoot · Esc exit'
    );
    hudEl.querySelector('#photoReset').textContent = T('重置镜头', 'Reset');
    hudEl.querySelector('#photoSnap').textContent = T('拍照保存', 'Capture PNG');
    hudEl.querySelector('#photoExit').textContent = T('返回', 'Exit');
  }

  function showToast(msg) {
    if (!hudEl) return;
    const el = hudEl.querySelector('#photoToast');
    el.textContent = msg;
    el.style.opacity = '1';
    toastT = 2.0;
  }

  function bindEvents() {
    if (P._bound || typeof addEventListener === 'undefined') return;
    P._bound = true;

    addEventListener('keydown', e => {
      if (!P.on) return;
      keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'Escape') { e.preventDefault(); P.exit(); }
      else if (e.code === 'Enter' || e.code === 'KeyP') { e.preventDefault(); P.capture(); }
      else if (e.code === 'KeyR') P.reset();
      else if (e.code === 'KeyH') {
        hideHint = !hideHint;
        if (hudEl) hudEl.querySelector('#photoBar').style.opacity = hideHint ? '0' : '1';
      }
    });
    addEventListener('keyup', e => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; drag = null; });

    if (canvas) {
      canvas.addEventListener('pointerdown', e => {
        if (!P.on) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });
      canvas.addEventListener('pointermove', e => {
        if (!P.on || !drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        const s = 3.2 / Math.max(innerWidth || 1000, 400);
        cam.tYaw -= dx * s;
        cam.tPit = clamp(cam.tPit + dy * s * 0.85, -1.42, 1.42);
      });
      const up = e => { if (drag && e.pointerId === drag.id) drag = null; };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', e => {
        if (!P.on) return;
        e.preventDefault();
        cam.fov = clamp(cam.fov * Math.exp(e.deltaY * 0.0012), FOV_MIN, FOV_MAX);
      }, { passive: false });
    }
  }

  P.init = function (g, cv) {
    gfx = g;
    canvas = cv;
    ensureHud();
    bindEvents();
  };

  P.enter = function (riderPos, currentCam, onExit) {
    if (P.on) return false;
    ensureHud();
    bindEvents();
    onExitCb = onExit || null;
    anchor = riderPos ? riderPos.slice() : [0, 0, 0];
    const src = currentCam || Camera.lastCam;
    const f = src ? v3.norm(v3.sub(src.target, src.eye)) : [0, 0, -1];
    const yaw = Math.atan2(f[0], -f[2]);
    const pit = Math.asin(clamp(f[1], -0.99, 0.99));
    cam = {
      pos: src ? src.eye.slice() : [anchor[0], anchor[1] + 2.5, anchor[2] + 5],
      yaw, pit, tYaw: yaw, tPit: pit, roll: 0,
      fov: src ? clamp(src.fov, FOV_MIN, FOV_MAX) : 1.08,
      vel: [0, 0, 0],
    };
    startSnap = { pos: cam.pos.slice(), yaw: cam.yaw, pit: cam.pit, fov: cam.fov };
    for (const k in keys) keys[k] = false;
    drag = null;
    hideHint = false;
    P.on = true;
    if (typeof RiderMesh !== 'undefined') RiderMesh.fpvRiderId = -1;
    if (hudEl) {
      refreshLabels();
      hudEl.style.display = 'flex';
      hudEl.querySelector('#photoBar').style.opacity = '1';
    }
    return true;
  };

  P.reset = function () {
    if (!cam || !startSnap) return;
    cam.pos = startSnap.pos.slice();
    cam.yaw = cam.tYaw = startSnap.yaw;
    cam.pit = cam.tPit = startSnap.pit;
    cam.fov = startSnap.fov;
    cam.roll = 0;
    cam.vel = [0, 0, 0];
  };

  P.exit = function () {
    if (!P.on) return;
    P.on = false;
    drag = null;
    if (hudEl) hudEl.style.display = 'none';
    if (onExitCb) { const cb = onExitCb; onExitCb = null; cb(); }
  };

  // Step free-fly lens and return full camera matrix object for rendering
  P.step = function (dt, aspect) {
    if (!cam) return null;
    cam.yaw = damp(cam.yaw, cam.tYaw, 18, dt);
    cam.pit = damp(cam.pit, cam.tPit, 18, dt);

    let mf = 0, mr = 0, mu = 0;
    if (keys.KeyW || keys.ArrowUp) mf += 1;
    if (keys.KeyS || keys.ArrowDown) mf -= 1;
    if (keys.KeyD || keys.ArrowRight) mr += 1;
    if (keys.KeyA || keys.ArrowLeft) mr -= 1;
    if (keys.KeyE || keys.Space) mu += 1;
    if (keys.KeyQ) mu -= 1;

    const sp = (keys.ShiftLeft || keys.ShiftRight ? 16 : 6.5) * (0.5 + 0.5 * cam.fov);
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const wx = (sy * mf + cy * mr) * sp;
    const wy = mu * sp * 0.78;
    const wz = (-cy * mf + sy * mr) * sp;
    cam.vel[0] = damp(cam.vel[0], wx, 8, dt);
    cam.vel[1] = damp(cam.vel[1], wy, 8, dt);
    cam.vel[2] = damp(cam.vel[2], wz, 8, dt);
    cam.pos[0] += cam.vel[0] * dt;
    cam.pos[1] += cam.vel[1] * dt;
    cam.pos[2] += cam.vel[2] * dt;

    if (keys.KeyZ) cam.roll = clamp(cam.roll - 0.65 * dt, -0.75, 0.75);
    if (keys.KeyC) cam.roll = clamp(cam.roll + 0.65 * dt, -0.75, 0.75);
    if (keys.Minus || keys.NumpadSubtract) cam.fov = clamp(cam.fov * Math.exp(0.9 * dt), FOV_MIN, FOV_MAX);
    if (keys.Equal || keys.NumpadAdd) cam.fov = clamp(cam.fov * Math.exp(-0.9 * dt), FOV_MIN, FOV_MAX);

    // Keep within REACH metres of rider & safely above terrain
    const dx = cam.pos[0] - anchor[0], dy = cam.pos[1] - anchor[1], dz = cam.pos[2] - anchor[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > REACH) {
      const k = REACH / dist;
      cam.pos[0] = anchor[0] + dx * k;
      cam.pos[1] = anchor[1] + dy * k;
      cam.pos[2] = anchor[2] + dz * k;
    }
    const minY = Course.height(cam.pos[0], cam.pos[2]) + 0.34;
    if (cam.pos[1] < minY) cam.pos[1] = minY;

    if (toastT > 0) {
      toastT = Math.max(0, toastT - dt);
      if (toastT === 0 && hudEl) hudEl.querySelector('#photoToast').style.opacity = '0';
    }
    if (flashT > 0) {
      flashT = Math.max(0, flashT - dt);
      if (flashT === 0 && hudEl) hudEl.querySelector('#photoFlash').style.opacity = '0';
    }

    const f = fwdOf(cam);
    const tgt = v3.add(cam.pos, f);
    const upHint = [Math.sin(cam.roll), Math.cos(cam.roll), 0];
    const right = v3.norm(v3.cross(f, upHint));
    const up = v3.cross(right, f);
    const viewM = m4.lookAt(cam.pos, tgt, up);
    const projM = m4.perspective(cam.fov, aspect, 0.16, 980);
    return { eye: cam.pos, target: tgt, fwd: f, right, up, fov: cam.fov, near: 0.16, viewM, projM, vp: m4.mul(projM, viewM) };
  };

  P.pendingShot = false;
  P.capture = function () {
    if (!canvas) return;
    P.pendingShot = true;
  };
  P.onAfterPresent = function () {
    if (!P.pendingShot || !canvas) return;
    P.pendingShot = false;
    P.shots++;
    if (hudEl) {
      const fl = hudEl.querySelector('#photoFlash');
      fl.style.opacity = '0.72';
      flashT = 0.16;
    }
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `crazybike-${Course.mountain.id}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(T(`已保存截图 #${P.shots}`, `Saved Photo #${P.shots}`));
    } catch (e) {
      showToast(T('截图完成', 'Captured'));
    }
  };

  return P;
})();
