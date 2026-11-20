// ---------------------------------------------------------------- 99_main: Step 1 boot stub
(() => {
  const ui = document.getElementById('ui');
  if (ui) {
    ui.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
      <div style="font-size:32px;font-weight:900;letter-spacing:.12em;color:#ff5b1f;">CRAZYBIKE</div>
      <div style="font-size:13px;color:rgba(255,255,255,.7);">Build ${BUILD_HASH} — Step 1 pipeline ready</div>
    </div>`;
  }
  window.__bike = { version: BUILD_HASH, ready: true };
})();
