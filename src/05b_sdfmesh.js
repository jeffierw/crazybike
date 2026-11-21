// ---------------------------------------------------------------- 06_sdfmesh: fast narrow-band Surface Nets SDF mesher
// Adapted from Cold Smoke (MIT) for pure-code procedural character & prop sculpting at boot.
const sd = {
  smin(a, b, k) {
    const d = a - b, ad = d < 0 ? -d : d, h = k - ad;
    const m = a < b ? a : b;
    if (!(h > 0)) return m;
    const q = h / k;
    return m - q * q * k * 0.25;
  },
  smax(a, b, k) {
    const d = a - b, ad = d < 0 ? -d : d, h = k - ad;
    const m = a > b ? a : b;
    if (!(h > 0)) return m;
    const q = h / k;
    return m + q * q * k * 0.25;
  },
  sphere(x, y, z, cx, cy, cz, r) {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
  },
  ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
    const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const ax = px / rx, ay = py / ry, az = pz / rz;
    const k1 = Math.sqrt(ax * ax + ay * ay + az * az);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  },
  capsule(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
    const pax = x - ax, pay = y - ay, paz = z - az;
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    const bb = bax * bax + bay * bay + baz * baz;
    let h = bb > 1e-12 ? (pax * bax + pay * bay + paz * baz) / bb : 0;
    if (h < 0) h = 0; else if (h > 1) h = 1;
    const ex = pax - bax * h, ey = pay - bay * h, ez = paz - baz * h;
    return Math.sqrt(ex * ex + ey * ey + ez * ez) - (ra + (rb - ra) * h);
  },
  rbox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const qx = (dx < 0 ? -dx : dx) - hx + r;
    const qy = (dy < 0 ? -dy : dy) - hy + r;
    const qz = (dz < 0 ? -dz : dz) - hz + r;
    const ax = qx > 0 ? qx : 0, ay = qy > 0 ? qy : 0, az = qz > 0 ? qz : 0;
    const m = qx > qy ? (qx > qz ? qx : qz) : (qy > qz ? qy : qz);
    return Math.sqrt(ax * ax + ay * ay + az * az) + (m < 0 ? m : 0) - r;
  },
};

// Surface Nets mesher on a narrow band around SDF f(x,y,z) = 0.
// Returns { verts: Float32Array (px,py,pz,nx,ny,nz,a0,a1,a2,a3)*, idx: Uint32Array, nv, ni }
function meshSDF(f, bmin, bmax, cell, opt = {}) {
  const S = opt.stride || 4, band = opt.band || 0;
  const cnt = d => Math.ceil((bmax[d] - bmin[d]) / cell / S) * S + 1;
  const nx = cnt(0), ny = cnt(1), nz = cnt(2), nxy = nx * ny, total = nxy * nz;
  const vals = new Float32Array(total);
  vals.fill(NaN);
  const X = i => bmin[0] + i * cell;
  const Y = j => bmin[1] + j * cell;
  const Z = k => bmin[2] + k * cell;

  // 1. Coarse pass
  for (let k = 0; k < nz; k += S) {
    const zk = Z(k);
    for (let j = 0; j < ny; j += S) {
      const yj = Y(j);
      for (let i = 0; i < nx; i += S) {
        vals[i + j * nx + k * nxy] = f(X(i), yj, zk);
      }
    }
  }

  // 2. Refine coarse cells near surface
  const thr = S * cell * 1.75 + band;
  for (let k = 0; k < nz - 1; k += S) {
    for (let j = 0; j < ny - 1; j += S) {
      for (let i = 0; i < nx - 1; i += S) {
        let m = 1e9, anyNeg = false, anyPos = false;
        for (let c = 0; c < 8; c++) {
          const v = vals[(i + (c & 1) * S) + (j + ((c >> 1) & 1) * S) * nx + (k + (c >> 2) * S) * nxy];
          const av = v < 0 ? -v : v;
          if (av < m) m = av;
          if (v < 0) anyNeg = true; else anyPos = true;
        }
        if (m > thr && !(anyNeg && anyPos)) continue;
        for (let c = k; c <= k + S; c++) {
          const zc = Z(c);
          for (let b = j; b <= j + S; b++) {
            const yb = Y(b);
            let o = i + b * nx + c * nxy;
            for (let a = i; a <= i + S; a++, o++) {
              if (vals[o] !== vals[o]) vals[o] = f(X(a), yb, zc);
            }
          }
        }
      }
    }
  }

  // 3. Emit one vertex per sign-changing cell
  const cellV = new Int32Array(total).fill(-1);
  let verts = new Float32Array(1 << 16), nv = 0;
  const corner = new Float32Array(8);
  const EA = [[0, 1], [1, 3], [2, 3], [0, 2], [4, 5], [5, 7], [6, 7], [4, 6], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const o = i + j * nx + k * nxy;
        let mask = 0, ok = true;
        for (let c = 0; c < 8; c++) {
          const v = vals[o + (c & 1) + ((c >> 1) & 1) * nx + (c >> 2) * nxy];
          if (v !== v) { ok = false; break; }
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (!ok || mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let e = 0; e < 12; e++) {
          const a = EA[e][0], b = EA[e][1], va = corner[a], vb = corner[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
          n++;
        }
        if (nv * 10 + 10 > verts.length) {
          const nvb = new Float32Array(verts.length * 2);
          nvb.set(verts);
          verts = nvb;
        }
        verts[nv * 10]     = X(i + sx / n);
        verts[nv * 10 + 1] = Y(j + sy / n);
        verts[nv * 10 + 2] = Z(k + sz / n);
        cellV[o] = nv++;
      }
    }
  }

  // 4. Tetrahedral gradient normals + one Newton snap to zero-isosurface
  const e = cell * 0.5, at = [0, 0, 0, 0], conf = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = verts[v * 10], y = verts[v * 10 + 1], z = verts[v * 10 + 2];
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e);
    const c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    let gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
    const l = Math.hypot(gx, gy, gz) || 1;
    gx /= l; gy /= l; gz /= l;
    verts[v * 10 + 3] = gx; verts[v * 10 + 4] = gy; verts[v * 10 + 5] = gz;
    const q = conf[v] = Math.min(1, Math.max(0, (l / (4 * e) - 0.45) / 0.35));
    const d0 = Math.max(-e, Math.min(e, (a + b + c + d) * 0.25)) * 0.78 * q;
    verts[v * 10] -= gx * d0; verts[v * 10 + 1] -= gy * d0; verts[v * 10 + 2] -= gz * d0;
  }

  // 5. Emit quads across every sign-changing grid edge
  let idx = new Uint32Array(1 << 17), ni = 0;
  const _n1 = [0, 0, 0], _n2 = [0, 0, 0];
  const tn = (a, b, c, o) => {
    a *= 10; b *= 10; c *= 10;
    const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
    const wx = verts[c] - verts[a], wy = verts[c + 1] - verts[a + 1], wz = verts[c + 2] - verts[a + 2];
    o[0] = uy * wz - uz * wy; o[1] = uz * wx - ux * wz; o[2] = ux * wy - uy * wx;
    const l = Math.hypot(o[0], o[1], o[2]) || 1;
    o[0] /= l; o[1] /= l; o[2] /= l;
  };
  const bend = (a, b, c, d, e2, g) => { tn(a, b, c, _n1); tn(d, e2, g, _n2); return _n1[0] * _n2[0] + _n1[1] * _n2[1] + _n1[2] * _n2[2]; };
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (ni + 6 > idx.length) {
      const n2 = new Uint32Array(idx.length * 2);
      n2.set(idx);
      idx = n2;
    }
    if (bend(a, b, c, a, c, d) < bend(b, c, d, b, d, a)) { const t = a; a = b; b = c; c = d; d = t; }
    if (flip) { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
    else      { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const o = i + j * nx + k * nxy, v0 = vals[o];
        if (v0 !== v0) continue;
        const s0 = v0 < 0;
        let v1 = vals[o + 1];
        if (v1 === v1 && (v1 < 0) !== s0) quad(cellV[o - nx - nxy], cellV[o - nxy], cellV[o], cellV[o - nx], !s0);
        v1 = vals[o + nx];
        if (v1 === v1 && (v1 < 0) !== s0) quad(cellV[o - 1 - nxy], cellV[o - 1], cellV[o], cellV[o - nxy], !s0);
        v1 = vals[o + nxy];
        if (v1 === v1 && (v1 < 0) !== s0) quad(cellV[o - 1 - nx], cellV[o - nx], cellV[o], cellV[o - 1], !s0);
      }
    }
  }

  // 6. Reconcile gradient normals with smooth mesh face normals & populate attributes
  const fn = new Float32Array(nv * 3);
  const unsure = new Uint8Array(nv);
  const faceNormals = () => {
    fn.fill(0);
    for (let i = 0; i < ni; i += 3) {
      const a = idx[i] * 10, b = idx[i + 1] * 10, c = idx[i + 2] * 10;
      const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
      const wx = verts[c] - verts[a], wy = verts[c + 1] - verts[a + 1], wz = verts[c + 2] - verts[a + 2];
      const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
      for (const q of [a, b, c]) { const o = (q / 10) * 3; fn[o] += cx; fn[o + 1] += cy; fn[o + 2] += cz; }
    }
  };
  faceNormals();
  for (let v = 0; v < nv; v++) {
    const mx = fn[v * 3], my = fn[v * 3 + 1], mz = fn[v * 3 + 2], ml = Math.hypot(mx, my, mz);
    if (conf[v] < 0.5 || ml < 1e-12 || (verts[v * 10 + 3] * mx + verts[v * 10 + 4] * my + verts[v * 10 + 5] * mz) / ml < 0.45) {
      unsure[v] = 1;
    }
  }
  if (opt.repair) {
    const acc = new Float32Array(nv * 4);
    for (let pass = 0; pass < 2; pass++) {
      acc.fill(0);
      for (let i = 0; i < ni; i += 3) {
        for (let q = 0; q < 3; q++) {
          const a = idx[i + q];
          if (!unsure[a]) continue;
          for (let r = 1; r < 3; r++) {
            const b = idx[i + (q + r) % 3] * 10;
            acc[a * 4] += verts[b]; acc[a * 4 + 1] += verts[b + 1]; acc[a * 4 + 2] += verts[b + 2]; acc[a * 4 + 3]++;
          }
        }
      }
      for (let v = 0; v < nv; v++) {
        if (unsure[v] && acc[v * 4 + 3] > 0) {
          const k = 1 / acc[v * 4 + 3];
          verts[v * 10] = acc[v * 4] * k; verts[v * 10 + 1] = acc[v * 4 + 1] * k; verts[v * 10 + 2] = acc[v * 4 + 2] * k;
        }
      }
    }
    faceNormals();
  }
  for (let v = 0; v < nv; v++) {
    let mx = fn[v * 3], my = fn[v * 3 + 1], mz = fn[v * 3 + 2];
    const ml = Math.hypot(mx, my, mz);
    let gx = verts[v * 10 + 3], gy = verts[v * 10 + 4], gz = verts[v * 10 + 5];
    if (ml > 1e-12) {
      mx /= ml; my /= ml; mz /= ml;
      const agree = gx * mx + gy * my + gz * mz;
      const w = unsure[v] ? 0 : conf[v] * Math.min(1, Math.max(0, (agree - 0.2) / 0.5));
      gx = mx + (gx - mx) * w; gy = my + (gy - my) * w; gz = mz + (gz - mz) * w;
      const l = Math.hypot(gx, gy, gz) || 1;
      verts[v * 10 + 3] = gx /= l; verts[v * 10 + 4] = gy /= l; verts[v * 10 + 5] = gz /= l;
    }
    if (opt.attr) {
      at[0] = at[1] = at[2] = at[3] = 0;
      opt.attr(verts[v * 10], verts[v * 10 + 1], verts[v * 10 + 2], gx, gy, gz, at);
      verts[v * 10 + 6] = at[0]; verts[v * 10 + 7] = at[1]; verts[v * 10 + 8] = at[2]; verts[v * 10 + 9] = at[3];
    }
  }
  return { verts: verts.subarray(0, nv * 10), idx: idx.subarray(0, ni), nv, ni };
}
