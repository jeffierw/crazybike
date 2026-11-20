// ---------------------------------------------------------------- 19b_postcard: Strava-meets-Arcade highlight route poster card (PNG export)
const Postcard = (() => {
  function streetTitle(sum) {
    if (sum.rank === 1 && sum.crashes === 0 && !sum.endless) return ['暴走车神', 'DOWNHILL LEGEND'];
    if (sum.takedowns >= 4) return ['下山路霸', 'ROAD RAGE KING'];
    if (sum.trickScore >= 2200) return ['空中飞人', 'SKY DEMON'];
    if (sum.maxSpeedKmh >= 105) return ['极速狂魔', 'MACH DOWNHILL'];
    if (sum.crashes >= 4) return ['荣誉护林员', 'TREE HUGGER'];
    if (sum.endless && sum.dist >= 2500) return ['永动机骑士', 'ENDLESS SHREDDER'];
    if (sum.rank <= 3 && !sum.endless) return ['领奖台恶客', 'PODIUM BANDIT'];
    return ['山道野骑手', 'TRAIL OUTLAW'];
  }

  function runCode(sum) {
    let h = hashU(Math.round(sum.dist * 10) ^ (sum.takedowns * 997) ^ Math.round(sum.trickScore) ^ (sum.seed || 1));
    const A = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 8; i++) { s += A[(h >>> ((i * 4) % 28)) % A.length]; h = hashU(h + i * 31); }
    return s.slice(0, 4) + '·' + s.slice(4);
  }

  function draw(canvas, sum) {
    const W = canvas.width = 1280, H = canvas.height = 720;
    const g = canvas.getContext('2d');
    const m = sum.mountain || MOUNTAINS[0];

    // 1. Atmospheric biome gradient background
    const bg = g.createLinearGradient(0, 0, 0, H);
    const toCss = (c, mul = 255) => `rgb(${clamp(c[0] * mul, 0, 255) | 0},${clamp(c[1] * mul, 0, 255) | 0},${clamp(c[2] * mul, 0, 255) | 0})`;
    bg.addColorStop(0, '#0d1018');
    bg.addColorStop(0.55, toCss(m.skyZen, 110));
    bg.addColorStop(1, toCss(m.groundCol, 140));
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Subtle topographic grid lines
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    for (let y = 80; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 80; x < W; x += 96) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }

    // 2. Real elevation profile + speed-lit trajectory curve from recorded samples
    const tr = (sum.track && sum.track.length > 2)
      ? sum.track
      : [[0, 1400, 12, 0], [500, 1250, 26, 0], [1000, 1080, 30, 1], [1500, 910, 28, 0]];
    const sMin = tr[0][0], sMax = Math.max(sMin + 50, tr[tr.length - 1][0]);
    let yMin = 1e9, yMax = -1e9;
    for (const p of tr) { if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1]; }
    if (yMax - yMin < 10) { yMax += 10; yMin -= 10; }

    const px = s => 84 + ((s - sMin) / (sMax - sMin)) * (W - 168);
    const py = y => H - 185 - ((y - yMin) / (yMax - yMin)) * 270;

    // Filled mountain silhouette under route
    g.beginPath();
    g.moveTo(px(tr[0][0]), H - 150);
    for (const p of tr) g.lineTo(px(p[0]), py(p[1]));
    g.lineTo(px(tr[tr.length - 1][0]), H - 150);
    g.closePath();
    const mGrad = g.createLinearGradient(0, 220, 0, H - 150);
    mGrad.addColorStop(0, 'rgba(255, 110, 48, 0.32)');
    mGrad.addColorStop(1, 'rgba(12, 15, 22, 0.05)');
    g.fillStyle = mGrad;
    g.fill();

    // Speed-colored glowing trace
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const spdN = sat((b[2] - 12) / 22);
      const col = b[3] ? '#38e2ff' : spdN > 0.72 ? '#ff5b1f' : spdN > 0.35 ? '#ffc43d' : '#f4f7fb';
      g.strokeStyle = col;
      g.lineWidth = b[3] ? 4 : 6;
      g.beginPath();
      g.moveTo(px(a[0]), py(a[1]));
      g.lineTo(px(b[0]), py(b[1]));
      g.stroke();
    }

    // Takedown markers along profile
    for (const ks of (sum.koPoints || [])) {
      const idx = tr.findIndex(p => p[0] >= ks);
      const pt = tr[idx >= 0 ? idx : tr.length - 1];
      const x = px(pt[0]), y = py(pt[1]);
      g.fillStyle = '#ff3155';
      g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke();
    }

    // 3. Border frame & header
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 2;
    g.strokeRect(28, 28, W - 56, H - 56);

    const [zhTitle, enTitle] = streetTitle(sum);
    g.fillStyle = '#ff5b1f';
    g.font = '900 22px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    g.fillText(`CRAZYBIKE · ${m.name}  [${sum.modeName}]`, 64, 86);

    g.fillStyle = '#ffffff';
    g.font = '900 58px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    const headline = sum.endless ? `${(sum.dist / 1000).toFixed(2)} KM 暴走速降` : `第 ${sum.rank} 名 · ${zhTitle}`;
    g.fillText(headline, 64, 158);

    g.fillStyle = 'rgba(255, 196, 61, 0.92)';
    g.font = '700 20px -apple-system, sans-serif';
    g.fillText(`${enTitle}   ·   RUN #${runCode(sum)}`, 64, 194);

    // Top-right cash badge
    g.textAlign = 'right';
    g.fillStyle = '#ffc43d';
    g.font = '900 44px -apple-system, sans-serif';
    g.fillText(`+$${sum.totalCash || 0}`, W - 64, 118);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '600 16px -apple-system, sans-serif';
    g.fillText(`SEED #${sum.seed || 202611}`, W - 64, 150);
    g.textAlign = 'left';

    // 4. Bottom telemetry bar
    const stats = [
      ['最高时速', `${Math.round(sum.maxSpeedKmh)} KM/H`],
      ['击倒对手', `${sum.takedowns} K.O.`],
      ['特技总分', `${Math.round(sum.trickScore)}`],
      ['落差 / 距离', `${Math.round(yMax - yMin)}m / ${(sum.dist / 1000).toFixed(2)}km`],
      ['最远飞跃', `${Math.round(sum.bestAirDist || 0)} m`],
    ];
    let sx = 64;
    for (const [label, val] of stats) {
      g.fillStyle = 'rgba(255,255,255,0.52)';
      g.font = '600 15px -apple-system, "PingFang SC", sans-serif';
      g.fillText(label, sx, H - 102);
      g.fillStyle = '#ffffff';
      g.font = '900 30px -apple-system, sans-serif';
      g.fillText(val, sx, H - 64);
      sx += 232;
    }

    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = '700 14px -apple-system, sans-serif';
    g.fillText('crazybike.yepw.dev', W - 64, H - 64);
    g.textAlign = 'left';
  }

  return { draw, streetTitle };
})();
