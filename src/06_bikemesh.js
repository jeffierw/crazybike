// ---------------------------------------------------------------- 06_bikemesh: instanced 3D solids + SDF-skinned MTB rider + dual-suspension downhill bike

// ================================================================ 1. SDF-Skinned Downhill MTB Rider (23 bones, GPU vertex skinning)
const RiderMesh = (() => {
  const NB = 23;
  const SLOT_STRIDE = 24;
  const MAX_SLOTS = 10; // up to 10 riders simultaneously in 4x256 rgba32f boneTex
  const B = {
    pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4,
    shL: 5, uarmL: 6, elbowL: 7, farmL: 8, handL: 9,
    shR: 10, uarmR: 11, elbowR: 12, farmR: 13, handR: 14,
    thighL: 15, kneeL: 16, shinL: 17, footL: 18,
    thighR: 19, kneeR: 20, shinR: 21, footR: 22,
  };

  const LEN = {
    thigh: 0.43, shin: 0.41, uarm: 0.30, farm: 0.27,
    hipW: 0.115, shW: 0.215,
  };

  let gfx = null, vb = null, vbW = null, ib = null, indexCount = 0;
  let pipe = null, shPipe = null, boneTex = null;
  let bind = null, invBind = null, meshInfo = null;
  const boneData = new Float32Array(4 * 256 * 4);
  const drawList = [];

  // Orthonormal frame: Y along ydir, X aligned as closely as possible to xhint
  function frameXY(o, ydir, xhint) {
    const y = v3.norm(ydir);
    let x = v3.sub(xhint, v3.mul(y, v3.dot(xhint, y)));
    if (v3.len(x) < 1e-4) x = v3.cross(y, [0, 0, 1]);
    x = v3.norm(x);
    const z = v3.cross(x, y);
    return m4.fromBasis(x, y, z, o);
  }

  // Exact 2-bone analytic IK in 3D with pole hint
  function ik2(a, c, l1, l2, pole) {
    const d = v3.sub(c, a);
    const L = v3.len(d) || 1e-6;
    const Lc = clamp(L, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.008);
    const dn = v3.mul(d, 1 / L);
    const x = (l1 * l1 - l2 * l2 + Lc * Lc) / (2 * Lc);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let p = v3.sub(pole, v3.mul(dn, v3.dot(pole, dn)));
    if (v3.len(p) < 1e-4) p = [0, 0, -1];
    p = v3.norm(p);
    return v3.add(v3.mad(a, dn, x), v3.mul(p, h));
  }

  // Solve 23 local bone frames from a high-level MTB rider pose descriptor
  // Local space: bike space (+X right, +Y up, -Z forward)
  function solvePose(P) {
    const J = {};
    const F = new Array(NB);
    const rx = P.right || [1, 0, 0];

    const pel = P.pelvis;
    const chs = P.chest;
    const nck = P.neck;
    const hed = P.head;
    const shTwist = P.torsoYaw || 0;
    const trRoll = P.torsoRoll || 0;
    const ct = Math.cos(shTwist), st = Math.sin(shTwist);
    const cr = Math.cos(trRoll), sr = Math.sin(trRoll);
    const rotTR = v => {
      const x1 = v[0] * cr - v[1] * sr, y1 = v[0] * sr + v[1] * cr, z1 = v[2];
      return [x1 * ct + z1 * st, y1, -x1 * st + z1 * ct];
    };
    const torsoX = rotTR(rx);
    const pelX = rotTR([rx[0] * 0.8 + 0.2, rx[1], rx[2]]);

    // Torso & Head frames
    const spineDir = v3.norm(v3.sub(chs, pel));
    const chestDir = v3.norm(v3.sub(nck, chs));
    const neckDir = v3.norm(v3.sub(hed, nck));

    F[B.pelvis] = frameXY(pel, spineDir, pelX);
    F[B.spine]  = frameXY(v3.lerp(pel, chs, 0.45), v3.norm(v3.add(spineDir, chestDir)), torsoX);
    F[B.chest]  = frameXY(chs, chestDir, torsoX);
    F[B.neck]   = frameXY(nck, neckDir, torsoX);

    // Head frame: looking forward/downhill with optional yaw/pitch
    const hy = P.headYaw || 0, hp = P.headPitch || 0;
    const chy = Math.cos(hy), shy = Math.sin(hy);
    const chp = Math.cos(hp), shp = Math.sin(hp);
    const hY = [0, chp, shp];
    const hX = [chy, 0, -shy];
    F[B.head] = frameXY(hed, hY, hX);

    J.pelvis = pel; J.chest = chs; J.neck = nck; J.head = hed;

    // Shoulders & Hips
    const chX = [F[B.chest][0], F[B.chest][1], F[B.chest][2]];
    const chY = [F[B.chest][4], F[B.chest][5], F[B.chest][6]];
    const chZ = [F[B.chest][8], F[B.chest][9], F[B.chest][10]];
    J.shL = v3.add(v3.mad(nck, chX, -LEN.shW), v3.mad(v3.mul(chY, -0.055), chZ, 0.01));
    J.shR = v3.add(v3.mad(nck, chX,  LEN.shW), v3.mad(v3.mul(chY, -0.055), chZ, 0.01));

    const pX = [F[B.pelvis][0], F[B.pelvis][1], F[B.pelvis][2]];
    const pY = [F[B.pelvis][4], F[B.pelvis][5], F[B.pelvis][6]];
    J.hipL = v3.add(v3.mad(pel, pX, -LEN.hipW), v3.mul(pY, -0.05));
    J.hipR = v3.add(v3.mad(pel, pX,  LEN.hipW), v3.mul(pY, -0.05));

    // Arms (IK from shoulder -> hand)
    J.handL = P.handL; J.handR = P.handR;
    const ePoleL = P.elbowPoleL || [-0.85, -0.20, 0.55];
    const ePoleR = P.elbowPoleR || [ 0.85, -0.20, 0.55];
    J.elbowL = ik2(J.shL, J.handL, LEN.uarm, LEN.farm, ePoleL);
    J.elbowR = ik2(J.shR, J.handR, LEN.uarm, LEN.farm, ePoleR);

    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1;
      const sh = s ? J.shR : J.shL, el = s ? J.elbowR : J.elbowL, hd = s ? J.handR : J.handL;
      const uDir = v3.norm(v3.sub(el, sh));
      const fDir = v3.norm(v3.sub(hd, el));
      const armHint = v3.norm(v3.add(v3.mul(chX, side), [0, 0.25, 0.25]));
      const shIdx = s ? B.shR : B.shL;
      F[shIdx]     = frameXY(sh, v3.norm(v3.add(v3.mul(chY, 0.65), v3.mul(uDir, 0.35))), armHint);
      F[shIdx + 1] = frameXY(sh, uDir, armHint);
      F[shIdx + 2] = frameXY(el, v3.norm(v3.add(uDir, fDir)), armHint);
      F[shIdx + 3] = frameXY(el, fDir, armHint);
      F[shIdx + 4] = frameXY(hd, fDir, [side, 0, 0]);
    }

    // Legs (IK from hip -> foot/ankle)
    J.footL = P.footL; J.footR = P.footR;
    J.ankleL = [P.footL[0], P.footL[1] + 0.08, P.footL[2] + 0.02];
    J.ankleR = [P.footR[0], P.footR[1] + 0.08, P.footR[2] + 0.02];
    const kPoleL = P.kneePoleL || [-0.24, 0.16, -1.0];
    const kPoleR = P.kneePoleR || [ 0.24, 0.16, -1.0];
    J.kneeL = ik2(J.hipL, J.ankleL, LEN.thigh, LEN.shin, kPoleL);
    J.kneeR = ik2(J.hipR, J.ankleR, LEN.thigh, LEN.shin, kPoleR);

    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1;
      const hip = s ? J.hipR : J.hipL, kn = s ? J.kneeR : J.kneeL, an = s ? J.ankleR : J.ankleL, ft = s ? J.footR : J.footL;
      const tDir = v3.norm(v3.sub(kn, hip));
      const sDir = v3.norm(v3.sub(an, kn));
      const legHint = v3.norm(v3.add(pX, [0, 0, side * 0.08]));
      const base = s ? B.thighR : B.thighL;
      F[base]     = frameXY(hip, tDir, legHint);
      F[base + 1] = frameXY(kn, v3.norm(v3.add(tDir, sDir)), legHint);
      F[base + 2] = frameXY(kn, sDir, legHint);
      // Foot sits flat along bike forward (-Z), tilted slightly by footPitch
      const fPit = (s ? P.footPitchR : P.footPitchL) || 0;
      F[base + 3] = frameXY(ft, [0, Math.cos(fPit), Math.sin(fPit)], pX);
    }

    return { J, F };
  }

  // Standard athletic MTB bind pose (knees flexed, elbows wide, holding bars)
  const BIND_DESC = {
    pelvis: [0, 1.16, 0.22],
    chest:  [0, 1.43, 0.07],
    neck:   [0, 1.65, -0.04],
    head:   [0, 1.78, -0.09],
    handL:  [-0.43, 1.13, -0.37],
    handR:  [ 0.43, 1.13, -0.37],
    footL:  [-0.18, 0.40, 0.10],
    footR:  [ 0.18, 0.40, 0.10],
    headYaw: 0, headPitch: 0.10, torsoYaw: 0, torsoRoll: 0,
  };

  // Sculpt the full Downhill Domination MTB Rider SDF in bind pose!
  function buildRiderSDF(bd) {
    const J = bd.J, F = bd.F;
    const invF = F.map(m => m4.invert(m));
    const smin = sd.smin, smax = sd.smax, E = sd.ellipsoid, rbx = sd.rbox, cap = sd.capsule, sph = sd.sphere;

    const toLoc = (mi, x, y, z, out) => {
      const m = invF[mi];
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    };
    const q = [0, 0, 0];

    // Precomputed limb segment endpoints for ultra-fast SDF queries
    const shL = J.shL, elL = J.elbowL, hdL = J.handL;
    const shR = J.shR, elR = J.elbowR, hdR = J.handR;
    const hipL = J.hipL, knL = J.kneeL, anL = J.ankleL, ftL = J.footL;
    const hipR = J.hipR, knR = J.kneeR, anR = J.ankleR, ftR = J.footR;
    const nck = J.neck, hed = J.head, pel = J.pelvis, chs = J.chest;

    // Region 0: Torso + Downhill Armor Jersey + Shoulder Roost Guard
    function rTorso(x, y, z) {
      // Lower torso/waist
      toLoc(B.spine, x, y, z, q);
      let d = E(q[0], q[1], q[2], 0, 0.0, 0.01, 0.168, 0.175, 0.125);
      // Broad athletic chest + roost-guard breastplate
      toLoc(B.chest, x, y, z, q);
      const rib = E(q[0], q[1], q[2], 0, 0.09, 0.005, 0.215, 0.175, 0.138);
      const armor = rbx(q[0], q[1], q[2], 0, 0.10, -0.045, 0.165, 0.125, 0.088, 0.045);
      const shCap = E(Math.abs(q[0]), q[1], q[2], 0.205, 0.155, 0.00, 0.088, 0.072, 0.086);
      const collar = E(q[0], q[1], q[2], 0, 0.215, 0.008, 0.105, 0.042, 0.095);
      d = smin(d, rib, 0.065);
      d = smin(d, armor, 0.035);
      d = smin(d, shCap, 0.045);
      d = smin(d, collar, 0.028);
      // Jersey hem skirt softly overlapping waist
      toLoc(B.pelvis, x, y, z, q);
      const hem = E(q[0], q[1], q[2], 0, -0.02, 0.01, 0.180, 0.115, 0.132);
      d = smin(d, hem, 0.045);
      return d;
    }

    // Region 1: Compact Hydration Pack on Upper Back
    function rPack(x, y, z) {
      toLoc(B.chest, x, y, z, q);
      const main = rbx(q[0], q[1], q[2], 0, 0.06, 0.165, 0.115, 0.178, 0.056, 0.034);
      const top = E(q[0], q[1], q[2], 0, 0.18, 0.150, 0.098, 0.072, 0.055);
      return smin(main, top, 0.025);
    }

    // Region 2/3: Left & Right Arms (Jersey sleeves + Elbow Armor + Armored Gloves)
    let armJ = 1e9, armE = 1e9, armG = 1e9;
    function rArm(s, x, y, z) {
      const sh = s ? shR : shL, el = s ? elR : elL, hd = s ? hdR : hdL;
      const handB = s ? B.handR : B.handL;
      const ua = cap(x, y, z, sh[0], sh[1], sh[2], el[0], el[1], el[2], 0.072, 0.056);
      const fa = cap(x, y, z, el[0], el[1], el[2], hd[0], hd[1], hd[2], 0.053, 0.043);
      const jersey = smin(ua, fa, 0.022);
      // Sculpted elbow guard cup
      const elb = sph(x, y, z, el[0] + (s ? 0.015 : -0.015), el[1] - 0.01, el[2] + 0.018, 0.058);
      // Squared armored motocross glove closed around grip
      toLoc(handB, x, y, z, q);
      const fist = rbx(q[0], q[1], q[2], 0, 0.012, 0.005, 0.046, 0.055, 0.048, 0.026);
      const cuff = cap(q[0], q[1], q[2], 0, -0.065, 0, 0, 0.01, 0, 0.049, 0.046);
      const glove = smin(fist, cuff, 0.014);
      armJ = jersey; armE = elb; armG = glove;
      return smin(smin(jersey, elb, 0.012), glove, 0.012);
    }

    // Region 4: Pelvis & Baggy Downhill Shorts
    function rPelvis(x, y, z) {
      toLoc(B.pelvis, x, y, z, q);
      const seat = E(q[0], q[1], q[2], 0, -0.055, 0.025, 0.185, 0.130, 0.145);
      const hip = E(Math.abs(q[0]), q[1], q[2], 0.095, -0.09, 0.015, 0.105, 0.105, 0.105);
      return smin(seat, hip, 0.055);
    }

    // Region 5/6: Legs (Baggy Shorts Thigh -> Hard Knee/Shin Guard -> Calf -> MTB Shoe)
    let legShort = 1e9, legGuard = 1e9, legShoe = 1e9;
    function rLeg(s, x, y, z) {
      const hip = s ? hipR : hipL, kn = s ? knR : knL, an = s ? anR : anL;
      const footB = s ? B.footR : B.footL;
      // Baggy MTB shorts down to just above knee
      const shEnd = v3.lerp(hip, kn, 0.86);
      const shorts = cap(x, y, z, hip[0], hip[1], hip[2], shEnd[0], shEnd[1], shEnd[2], 0.114, 0.092);
      // Iconic downhill hard-shell knee cup + tapered shin armor
      const kneeCup = E(x, y, z, kn[0], kn[1], kn[2] - 0.022, 0.068, 0.078, 0.072);
      const shinCap = cap(x, y, z, kn[0], kn[1], kn[2] - 0.012, an[0], an[1], an[2] - 0.005, 0.068, 0.052);
      const calf = cap(x, y, z, kn[0], kn[1], kn[2] + 0.015, an[0], an[1], an[2] + 0.010, 0.064, 0.048);
      const guard = smin(smin(kneeCup, shinCap, 0.022), calf, 0.020);
      // Chunky flat-pedal freeride MTB sneaker
      toLoc(footB, x, y, z, q);
      const sole = rbx(q[0], q[1], q[2], 0, 0.025, -0.025, 0.056, 0.036, 0.145, 0.022);
      const upper = E(q[0], q[1], q[2], 0, 0.065, 0.008, 0.054, 0.055, 0.092);
      const shoe = smin(sole, upper, 0.018);
      legShort = shorts; legGuard = guard; legShoe = shoe;
      return smin(smin(shorts, guard, 0.022), shoe, 0.014);
    }

    // Region 7: Full-Face Motocross Downhill Helmet + Extended Sun Visor Peak + Chin Bar + Mirrored Goggles + Neck
    let hdHelm = 1e9, hdGog = 1e9, hdNeck = 1e9;
    function rHead(x, y, z) {
      const neck = cap(x, y, z, nck[0], nck[1] - 0.02, nck[2], hed[0], hed[1] - 0.04, hed[2] + 0.01, 0.064, 0.058);
      toLoc(B.head, x, y, z, q);
      const a = q[0], b = q[1], d = q[2];
      // Main aero helmet shell
      let helm = E(a, b, d, 0, 0.038, 0.010, 0.122, 0.126, 0.144);
      // Cheek wings / jaw armor
      helm = smin(helm, E(Math.abs(a), b, d, 0.088, -0.042, -0.035, 0.044, 0.058, 0.092), 0.022);
      // Protruding motocross chin bar / mouth vent
      const chin = rbx(a, b, d, 0, -0.066, -0.132, 0.066, 0.034, 0.058, 0.020);
      helm = smin(helm, chin, 0.024);
      // Aggressive long MX sun visor peak jutting forward from brow
      const py = b - (0.118 + (d + 0.14) * 0.24);
      const peak = rbx(a, py, d, 0, 0, -0.148, 0.096, 0.013, 0.082, 0.008);
      helm = smin(helm, peak, 0.012);
      // Rear aero ridge / spoiler
      const ridge = rbx(a, b, d, 0, 0.042, 0.136, 0.064, 0.026, 0.028, 0.014);
      helm = smin(helm, ridge, 0.015);
      // Recessed curved motocross goggles (front visor only; wrap-around strap is shaded razor-smooth per-pixel!)
      const gog = rbx(a, b, d, 0, 0.010, -0.118, 0.094, 0.042, 0.036, 0.022);

      hdHelm = helm; hdGog = gog; hdNeck = neck;
      return smin(smin(helm, gog, 0.006), neck, 0.016);
    }

    // Coarse region bounding hulls so empty space evaluates in nanoseconds
    const bnd = new Float64Array(8);
    const val = new Float64Array(8);
    const Rfn = (i, x, y, z) => (
      i === 0 ? rTorso(x, y, z) :
      i === 1 ? rPack(x, y, z) :
      i === 2 ? rArm(0, x, y, z) :
      i === 3 ? rArm(1, x, y, z) :
      i === 4 ? rPelvis(x, y, z) :
      i === 5 ? rLeg(0, x, y, z) :
      i === 6 ? rLeg(1, x, y, z) :
                rHead(x, y, z)
    );

    function f(x, y, z) {
      bnd[0] = cap(x, y, z, pel[0], pel[1] - 0.04, pel[2], nck[0], nck[1] + 0.05, nck[2], 0.25, 0.30);
      bnd[1] = sph(x, y, z, chs[0], chs[1] + 0.08, chs[2] + 0.18, 0.27);
      bnd[2] = Math.min(cap(x, y, z, shL[0], shL[1], shL[2], elL[0], elL[1], elL[2], 0.11, 0.11), cap(x, y, z, elL[0], elL[1], elL[2], hdL[0], hdL[1], hdL[2], 0.10, 0.11));
      bnd[3] = Math.min(cap(x, y, z, shR[0], shR[1], shR[2], elR[0], elR[1], elR[2], 0.11, 0.11), cap(x, y, z, elR[0], elR[1], elR[2], hdR[0], hdR[1], hdR[2], 0.10, 0.11));
      bnd[4] = sph(x, y, z, pel[0], pel[1] - 0.06, pel[2] + 0.02, 0.26);
      bnd[5] = Math.min(cap(x, y, z, hipL[0], hipL[1], hipL[2], knL[0], knL[1], knL[2], 0.16, 0.14), cap(x, y, z, knL[0], knL[1], knL[2], ftL[0], ftL[1], ftL[2], 0.14, 0.20));
      bnd[6] = Math.min(cap(x, y, z, hipR[0], hipR[1], hipR[2], knR[0], knR[1], knR[2], 0.16, 0.14), cap(x, y, z, knR[0], knR[1], knR[2], ftR[0], ftR[1], ftR[2], 0.14, 0.20));
      bnd[7] = sph(x, y, z, hed[0], hed[1] + 0.02, hed[2] - 0.03, 0.28);

      let m = bnd[0], mi = 0;
      for (let i = 1; i < 8; i++) if (bnd[i] < m) { m = bnd[i]; mi = i; }
      if (m > 0.14) return m;
      const v0 = Rfn(mi, x, y, z), lim = v0 + 0.06;
      for (let i = 0; i < 8; i++) val[i] = i === mi ? v0 : (bnd[i] < lim ? Rfn(i, x, y, z) : 1e9);

      let d = smin(smin(smin(val[0], val[1], 0.016), val[2], 0.038), val[3], 0.038);
      const low = smin(smin(val[4], val[5], 0.042), val[6], 0.042);
      d = smin(d, low, 0.018);
      d = smin(d, val[7], 0.018);
      return d;
    }

    function attr(x, y, z, nx, ny, nz, out) {
      const dT = rTorso(x, y, z);
      const dP = rPack(x, y, z);
      rArm(0, x, y, z); const jL = armJ, eL = armE, gL = armG;
      rArm(1, x, y, z); const jR = armJ, eR = armE, gR = armG;
      const dPel = rPelvis(x, y, z);
      rLeg(0, x, y, z); const sL = legShort, kL = legGuard, shl = legShoe;
      rLeg(1, x, y, z); const sR = legShort, kR = legGuard, shr = legShoe;
      rHead(x, y, z);

      const dJersey = Math.min(dT, jL, jR);
      const dShorts = Math.min(dPel, sL, sR);
      const dGuard  = Math.min(kL, kR, eL, eR);
      const dGlove  = Math.min(gL, gR);
      const dShoe   = Math.min(shl, shr);

      let id = 0, best = dJersey;
      if (dShorts < best) { best = dShorts; id = 1; }
      if (dGuard  < best) { best = dGuard;  id = 2; }
      if (dGlove  < best) { best = dGlove;  id = 3; }
      if (dShoe   < best) { best = dShoe;   id = 4; }
      if (dP      < best) { best = dP;      id = 7; }
      if (hdNeck  < best) { best = hdNeck;  id = 8; }
      if (hdHelm  < best) { best = hdHelm;  id = 5; }
      if (hdGog - 0.003 < best) { best = hdGog; id = 6; }

      // Baked SDF ambient occlusion for crisp realistic crevices
      const ao = sat(0.28 + 0.72 * (
        0.60 * sat(f(x + nx * 0.055, y + ny * 0.055, z + nz * 0.055) / 0.055) +
        0.40 * sat(f(x + nx * 0.140, y + ny * 0.140, z + nz * 0.140) / 0.140)
      ));
      // Extra shader coordinate hints (head local y/z for goggle lens vs strap & chin vent)
      toLoc(B.head, x, y, z, q);
      out[0] = id;
      out[1] = ao;
      out[2] = q[1];
      out[3] = q[2];
    }

    return { f, attr };
  }

  // Compute smooth 3-bone skinning weights per vertex (garment-aware so arms don't stick to ribs!)
  function computeWeights(mesh, bd) {
    const J = bd.J, n = mesh.nv;
    const out = new Float32Array(n * 4);
    const dCap = (x, y, z, a, b, r) => sd.capsule(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r, r);
    const dPt  = (x, y, z, a, r) => Math.hypot(x - a[0], y - a[1], z - a[2]) - r;

    const cb = new Int32Array(12), cw = new Float32Array(12);
    let nc = 0;
    const add = (bi, dist, mul = 1, sig = 0.052) => {
      const w = mul * Math.exp(-Math.max(dist, 0) / sig);
      if (w < 1e-4) return;
      for (let i = 0; i < nc; i++) {
        if (cb[i] === bi) { if (w > cw[i]) cw[i] = w; return; }
      }
      cb[nc] = bi; cw[nc] = w; nc++;
    };

    const spineMid = v3.lerp(J.pelvis, J.chest, 0.5);
    const shMidL = v3.lerp(J.shL, J.elbowL, 0.5), faMidL = v3.lerp(J.elbowL, J.handL, 0.5);
    const shMidR = v3.lerp(J.shR, J.elbowR, 0.5), faMidR = v3.lerp(J.elbowR, J.handR, 0.5);

    for (let v = 0; v < n; v++) {
      const x = mesh.verts[v * 10], y = mesh.verts[v * 10 + 1], z = mesh.verts[v * 10 + 2];
      const id = Math.round(mesh.verts[v * 10 + 6]);
      const right = x >= 0;
      nc = 0;

      if (id === 5 || id === 6) {
        // Helmet & goggles: rigid on head
        add(B.head, 0, 1);
      } else if (id === 8) {
        // Neck blends chest -> neck -> head
        add(B.head, dPt(x, y, z, J.head, 0.09), 1);
        add(B.neck, dPt(x, y, z, J.neck, 0.06), 1.2);
        add(B.chest, dPt(x, y, z, J.chest, 0.14), 0.7);
      } else if (id === 7) {
        // Hydration pack follows chest + spine
        add(B.chest, dCap(x, y, z, J.chest, J.neck, 0.18), 1.2);
        add(B.spine, dPt(x, y, z, spineMid, 0.15), 0.5);
      } else if (id === 3) {
        // Motocross gloves follow hand + distal forearm
        const hb = right ? B.handR : B.handL;
        const fb = right ? B.farmR : B.farmL;
        const hd = right ? J.handR : J.handL;
        const el = right ? J.elbowR : J.elbowL;
        add(hb, dPt(x, y, z, hd, 0.055), 1.3, 0.04);
        add(fb, dCap(x, y, z, el, hd, 0.045), 0.55, 0.04);
      } else if (id === 4) {
        // MTB shoes follow foot + lower shin
        const fb = right ? B.footR : B.footL;
        const sb = right ? B.shinR : B.shinL;
        const ft = right ? J.footR : J.footL;
        const an = right ? J.ankleR : J.ankleL;
        add(fb, dPt(x, y, z, ft, 0.09), 1.5, 0.045);
        add(sb, dPt(x, y, z, an, 0.05), 0.35, 0.045);
      } else if (id === 1 || id === 2) {
        // Shorts (1) & Knee/Shin/Elbow Guards (2)
        const sh = right ? J.shR : J.shL, el = right ? J.elbowR : J.elbowL, hd = right ? J.handR : J.handL;
        const dElb = dPt(x, y, z, el, 0.06);
        if (id === 2 && dElb < 0.09 && y > 1.15) {
          // Elbow guard pad!
          const ub = right ? B.uarmR : B.uarmL;
          add(ub + 1, dElb, 1.4, 0.04);
          add(ub, dCap(x, y, z, sh, el, 0.05), 0.6, 0.04);
          add(ub + 2, dCap(x, y, z, el, hd, 0.045), 0.6, 0.04);
        } else {
          // Pelvis + Leg bones
          const hip = right ? J.hipR : J.hipL;
          const kn  = right ? J.kneeR : J.kneeL;
          const an  = right ? J.ankleR : J.ankleL;
          const base = right ? B.thighR : B.thighL;
          const midFade = smooth(0.015, 0.095, Math.abs(x));
          add(B.pelvis, dCap(x, y, z, J.hipL, J.hipR, 0.14), 1.0 - 0.55 * smooth(0.05, 0.22, J.pelvis[1] - y));
          add(base,     dCap(x, y, z, hip, kn, 0.095), midFade);
          add(base + 1, dPt(x, y, z, kn, 0.072), midFade * 1.15);
          add(base + 2, dCap(x, y, z, kn, an, 0.070), midFade);
          add(base + 3, dPt(x, y, z, right ? J.footR : J.footL, 0.075), midFade * 0.45);
        }
      } else {
        // Downhill Jersey (0): torso + sleeves cleanly separated by side & proximity
        const sh = right ? J.shR : J.shL, el = right ? J.elbowR : J.elbowL, hd = right ? J.handR : J.handL;
        const sb = right ? B.shR : B.shL;
        const dTor = dCap(x, y, z, J.pelvis, J.neck, 0.16);
        const dArm = Math.min(dCap(x, y, z, sh, el, 0.06), dCap(x, y, z, el, hd, 0.05));
        const armMask = smooth(0.14, 0.23, Math.abs(x)) * (dArm < dTor + 0.06 ? 1 : 0.15);
        const torMask = 1.0 - 0.85 * smooth(0.22, 0.30, Math.abs(x));

        add(B.pelvis, dCap(x, y, z, J.hipL, J.hipR, 0.14), torMask * 0.9);
        add(B.spine,  dPt(x, y, z, spineMid, 0.14), torMask);
        add(B.chest,  dCap(x, y, z, J.chest, J.neck, 0.16), torMask * 1.15);
        add(B.neck,   dPt(x, y, z, J.neck, 0.07), torMask * 0.65);

        add(sb,     dPt(x, y, z, sh, 0.08), Math.max(armMask, 0.35), 0.045);
        add(sb + 1, dCap(x, y, z, sh, el, 0.06), armMask * 1.1, 0.040);
        add(sb + 2, dPt(x, y, z, el, 0.055), armMask * 1.1, 0.038);
        add(sb + 3, dCap(x, y, z, el, hd, 0.05), armMask * 1.1, 0.038);
        add(sb + 4, dPt(x, y, z, hd, 0.05), armMask * 0.5, 0.035);
      }

      if (nc === 0) { cb[0] = B.pelvis; cw[0] = 1; nc = 1; }
      // Pick top 3 weights
      let i0 = 0; for (let k = 1; k < nc; k++) if (cw[k] > cw[i0]) i0 = k;
      let i1 = -1; for (let k = 0; k < nc; k++) if (k !== i0 && (i1 < 0 || cw[k] > cw[i1])) i1 = k;
      let i2 = -1; for (let k = 0; k < nc; k++) if (k !== i0 && k !== i1 && (i2 < 0 || cw[k] > cw[i2])) i2 = k;
      const w0 = cw[i0], w1 = i1 < 0 ? 0 : cw[i1], w2 = i2 < 0 ? 0 : cw[i2];
      const o = v * 4;
      out[o]     = cb[i0];
      out[o + 1] = i1 < 0 ? cb[i0] : cb[i1];
      out[o + 2] = w0 / (w0 + w1 + 1e-8);
      out[o + 3] = w2 > 0 ? cb[i2] + Math.min(w2 / (w0 + w1 + w2), 0.99) : 0;
    }
    return out;
  }

  // Split material boundary triangles so material IDs stay razor sharp across jersey/shorts/goggles/helmet
  function splitMaterials(m, bw) {
    const V = Array.from(m.verts), W = Array.from(bw), I = m.idx, dup = new Map();
    for (let t = 0; t < I.length; t += 3) {
      const a = Math.round(V[I[t] * 10 + 6]);
      const b = Math.round(V[I[t + 1] * 10 + 6]);
      const c = Math.round(V[I[t + 2] * 10 + 6]);
      if (a === b && b === c) continue;
      const id = (b === c) ? b : a;
      for (let k = 0; k < 3; k++) {
        const vi = I[t + k];
        if (Math.round(V[vi * 10 + 6]) === id) continue;
        const key = vi * 16 + id;
        let nvI = dup.get(key);
        if (nvI === undefined) {
          nvI = V.length / 10;
          for (let q = 0; q < 10; q++) V.push(V[vi * 10 + q]);
          V[nvI * 10 + 6] = id;
          for (let q = 0; q < 4; q++) W.push(W[vi * 4 + q]);
          dup.set(key, nvI);
        }
        I[t + k] = nvI;
      }
    }
    return { verts: new Float32Array(V), bw: new Float32Array(W), idx: I, nv: V.length / 10, ni: I.length };
  }

  function buildMesh() {
    if (meshInfo) return meshInfo;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    bind = solvePose(BIND_DESC);
    invBind = bind.F.map(m => m4.invert(m));
    const body = buildRiderSDF(bind);
    const raw = meshSDF(body.f, [-0.54, 0.28, -0.52], [0.54, 2.02, 0.44], 0.0195, {
      stride: 4,
      attr: body.attr,
      repair: true,
    });
    const bw = computeWeights(raw, bind);
    const sp = splitMaterials(raw, bw);
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    meshInfo = { V: sp.verts, W: sp.bw, I: sp.idx, nv: sp.nv, ni: sp.ni, ms };
    return meshInfo;
  }

  // GPU Vertex Skinning Library (works identically on WebGPU & WebGL2)
  const SKIN_SSL = `
struct SkinV {
  wp: vec3f,
  wn: vec3f,
}
fn fetchBone(baseRow: i32, bi: i32) -> mat4x4f {
  let r: i32 = baseRow + bi;
  let c0: vec4f = texFetch(tBones, vec2i(0, r), 0);
  let c1: vec4f = texFetch(tBones, vec2i(1, r), 0);
  let c2: vec4f = texFetch(tBones, vec2i(2, r), 0);
  let c3: vec4f = texFetch(tBones, vec2i(3, r), 0);
  return mat4x4f(c0, c1, c2, c3);
}
fn skinVertex(pos: vec3f, nrm: vec3f, bw: vec4f, baseRow: i32) -> SkinV {
  let b0: i32 = i32(bw.x + 0.5);
  let b1: i32 = i32(bw.y + 0.5);
  let b2: i32 = i32(floor(bw.w));
  let rawW2: f32 = fract(bw.w);
  let w2: f32 = select(0.0, rawW2, rawW2 > 0.002);
  let w0: f32 = bw.z * (1.0 - w2);
  let w1: f32 = (1.0 - bw.z) * (1.0 - w2);

  let m0: mat4x4f = fetchBone(baseRow, b0);
  let m1: mat4x4f = fetchBone(baseRow, b1);
  let p4: vec4f = vec4f(pos, 1.0);
  let n4: vec4f = vec4f(nrm, 0.0);

  var wp: vec3f = (m0 * p4).xyz * w0 + (m1 * p4).xyz * w1;
  var wn: vec3f = (m0 * n4).xyz * w0 + (m1 * n4).xyz * w1;
  if (w2 > 0.001) {
    let m2: mat4x4f = fetchBone(baseRow, b2);
    wp = wp + (m2 * p4).xyz * w2;
    wn = wn + (m2 * n4).xyz * w2;
  }
  var o: SkinV;
  o.wp = wp;
  o.wn = normalize(wn);
  return o;
}
`;

  function init(g) {
    gfx = g;
    const m = buildMesh();
    vb = gfx.buffer(m.V, 'vertex', false);
    vbW = gfx.buffer(m.W, 'vertex', false);
    ib = gfx.buffer(m.I, 'index', false);
    indexCount = m.ni;
    boneTex = gfx.texture({ w: 4, h: 256, format: 'rgba32f', filter: 'nearest' });

    const buffers = [
      { attrs: [['pos', 'vec3f'], ['nrm', 'vec3f'], ['mat', 'vec4f']] },
      { attrs: [['bw', 'vec4f']] },
    ];

    pipe = gfx.pipeline({
      name: 'riderSkinned',
      colorFormat: 'rgba8',
      depth: true,
      cull: 'back',
      buffers,
      varyings: { wp: 'vec3f', wn: 'vec3f', bp: 'vec3f', mat: 'vec4f' },
      uniforms: { uJersey: 'vec4f', uHelmet: 'vec4f', uAccent: 'vec4f', uMeta: 'vec4f' },
      textures: { tBones: 'fetch', uShadow: 'shadow' },
      lib: [SHADER_COMMON, SHADER_SHADOW, SKIN_SSL],
      vs: `
        fn vert(a: VIn) -> VOut {
          var v: VOut;
          let baseRow: i32 = i32(M.uMeta.x + 0.5);
          let s: SkinV = skinVertex(a.pos, a.nrm, a.bw, baseRow);
          v.wp = s.wp;
          v.wn = s.wn;
          v.bp = a.pos;
          v.mat = a.mat;
          v.clip = U.viewProj * vec4f(s.wp, 1.0);
          return v;
        }
      `,
      fs: `
        fn frag(v: VOut) -> FOut {
          let id: f32 = floor(v.mat.x + 0.5);
          let ao: f32 = v.mat.y;
          let hY: f32 = v.mat.z;
          let hZ: f32 = v.mat.w;
          let distCam: f32 = length(v.wp - U.camPos.xyz);

          // FPV camera lensCut: hide helmet, goggles, pack, neck & central torso/shoulders so ONLY forearms, gloves & bike remain cleanly in view!
          if (M.uMeta.z > 0.5) {
            if (id > 4.5 || (id < 0.5 && abs(v.bp.x) < 0.25) || distCam < M.uMeta.w) {
              discard;
            }
          }

          let n: vec3f = normalize(v.wn);
          let viewD: vec3f = normalize(U.camPos.xyz - v.wp);
          let ndv: f32 = max(dot(n, viewD), 0.0);
          let fres: f32 = pow(1.0 - ndv, 3.0);

          var alb: vec3f = M.uJersey.rgb;
          var rough: f32 = 0.65;
          var clothSheen: f32 = 0.0;
          var mirrorBoost: f32 = 0.0;

          let fold: f32 = fbm3(v.bp.xy * 18.0 + vec2f(v.bp.z * 14.0, 0.0));
          // Gritty trail dust/dirt creeping up shoes, shin guards & lower shorts hem
          let dustMask: f32 = smoothstep(1.02, 0.36, v.bp.y) * (0.45 + 0.55 * vnoise(v.bp.xz * 26.0 + v.bp.y * 14.0));
          let trailDust: vec3f = U.groundCol.rgb * 1.35 + vec3f(0.14, 0.11, 0.08);

          if (id < 0.5) {
            // 0: Pro Downhill Jersey with shoulder armor panels, chest graphic & woven fabric creases
            let stripe: f32 = smoothstep(0.035, 0.055, abs(v.bp.x) - 0.145) * smoothstep(1.24, 1.38, v.bp.y);
            let chestBand: f32 = 1.0 - smoothstep(0.022, 0.048, abs(v.bp.y - 1.46 + abs(v.bp.x) * 0.25));
            let sleeveCuff: f32 = smoothstep(0.28, 0.36, abs(v.bp.x));
            alb = mix(M.uJersey.rgb, vec3f(0.09, 0.10, 0.12), sleeveCuff * 0.78);
            alb = mix(alb, vec3f(0.90, 0.89, 0.86), chestBand * 0.82);
            alb = mix(alb, M.uAccent.rgb, stripe * 0.68);
            let weave: f32 = vnoise(v.bp.xy * 68.0 + v.bp.z * 38.0);
            alb = alb * (0.86 + 0.16 * fold + 0.08 * weave);
            alb = mix(alb, trailDust, dustMask * 0.22);
            rough = 0.78;
            clothSheen = 0.18;
          } else if (id < 1.5) {
            // 1: Heavy Cordura Baggy MTB Shorts (matte charcoal + subtle team trim + trail dust)
            let outerStripe: f32 = (1.0 - smoothstep(0.012, 0.024, abs(v.bp.z - 0.14))) * smoothstep(0.17, 0.22, abs(v.bp.x));
            alb = mix(vec3f(0.10, 0.11, 0.13), M.uAccent.rgb * 0.82, outerStripe * 0.65);
            let weave: f32 = vnoise(v.bp.yz * 56.0 + v.bp.x * 28.0);
            alb = alb * (0.86 + 0.16 * fold + 0.08 * weave);
            alb = mix(alb, trailDust, dustMask * 0.34);
            rough = 0.86;
            clothSheen = 0.10;
          } else if (id < 2.5) {
            // 2: Scuffed Hard-Shell Knee, Shin & Elbow Armor Guards
            let strap: f32 = 1.0 - smoothstep(0.015, 0.032, abs(fract(v.bp.y * 5.2) - 0.5));
            alb = mix(vec3f(0.14, 0.15, 0.17), M.uAccent.rgb * 0.65, strap * 0.45);
            alb = mix(alb, trailDust, dustMask * 0.46);
            rough = 0.40;
          } else if (id < 3.5) {
            // 3: Armored Motocross Gloves
            let knuckle: f32 = smoothstep(1.13, 1.17, v.bp.y);
            alb = mix(vec3f(0.08, 0.08, 0.10), M.uAccent.rgb * 0.82, knuckle * 0.55);
            rough = 0.58;
          } else if (id < 4.5) {
            // 4: Dusty Flat-Pedal MTB Trail Shoes with rubber sole
            let sole: f32 = 1.0 - smoothstep(0.39, 0.415, v.bp.y);
            alb = mix(vec3f(0.11, 0.11, 0.13), vec3f(0.76, 0.72, 0.64), sole);
            alb = mix(alb, trailDust, 0.36 * (0.5 + 0.5 * fold));
            rough = 0.74;
          } else if (id < 5.5) {
            // 5: Pro Carbon/Fiberglass Full-Face DH Helmet + Racing Stripe + Crisp Goggle Strap + Chin Vent
            let centerStripe: f32 = 1.0 - smoothstep(0.020, 0.032, abs(v.bp.x));
            let gogStrap: f32 = (1.0 - smoothstep(0.018, 0.026, abs(hY - 0.012))) * smoothstep(-0.095, -0.055, hZ);
            let chinVent: f32 = smoothstep(-0.085, -0.118, hZ) * (1.0 - smoothstep(-0.03, 0.01, hY));
            let underPeak: f32 = smoothstep(0.075, 0.105, hY) * smoothstep(-0.11, -0.15, hZ);
            let carbon: f32 = 0.94 + 0.08 * vnoise(v.bp.xz * 85.0);
            alb = mix(M.uHelmet.rgb, M.uAccent.rgb * 0.95, centerStripe * 0.78) * carbon;
            alb = mix(alb, vec3f(0.05, 0.05, 0.07), max(gogStrap * 0.96, max(chinVent * 0.90, underPeak * 0.50)));
            rough = mix(0.22, 0.80, gogStrap);
            mirrorBoost = 0.24 * (1.0 - gogStrap);
          } else if (id < 6.5) {
            // 6: Mirrored Motocross Goggles
            let isLens: f32 = smoothstep(-0.075, -0.098, hZ);
            let lensTint: vec3f = mix(vec3f(0.09, 0.22, 0.30), M.uAccent.rgb * 0.95 + vec3f(0.18), fres);
            alb = mix(vec3f(0.05, 0.05, 0.07), lensTint, isLens);
            rough = mix(0.72, 0.07, isLens);
            mirrorBoost = isLens * 0.82;
          } else if (id < 7.5) {
            // 7: Tactical Hydration Pack with rugged strap detail
            let strip: f32 = 1.0 - smoothstep(0.014, 0.026, abs(v.bp.x));
            alb = mix(vec3f(0.12, 0.13, 0.15), M.uAccent.rgb * 0.85, strip * 0.65);
            alb = alb * (0.90 + 0.14 * fold);
            rough = 0.70;
          } else {
            // 8: Neck / gaiter
            alb = vec3f(0.58, 0.42, 0.33);
            rough = 0.76;
          }

          let sh: f32 = sampleShadow(v.wp, n);
          var c: vec3f = litSurface(alb * mix(0.38, 1.0, ao), n, v.wp, rough, sh);

          // Woven jersey fabric sheen at grazing angles
          if (clothSheen > 0.0) {
            c = c + U.skyHor.rgb * fres * clothSheen * ao;
          }
          // Glossy helmet / mirrored goggle sky reflection
          if (mirrorBoost > 0.0) {
            let rdir: vec3f = reflect(-viewD, n);
            let skyRef: vec3f = mix(U.skyHor.rgb, U.skyZen.rgb * 1.15, saturate(rdir.y * 0.5 + 0.5));
            let sunGlint: f32 = pow(max(dot(rdir, U.sunDir.xyz), 0.0), 32.0) * 1.3;
            c = c + (skyRef * (0.32 + 0.65 * fres) + U.sunCol.rgb * sunGlint) * mirrorBoost;
          }
          // Subtle warm sunlit overdrive rim (grounded, not neon)
          if (M.uMeta.y > 0.01) {
            c = c + U.sunCol.rgb * fres * M.uMeta.y * 0.36;
          }

          var o: FOut;
          o.color = vec4f(acesTone(c * U.sunCol.w), 1.0);
          return o;
        }
      `,
    });

    shPipe = gfx.pipeline({
      name: 'riderSkinnedShadow',
      colorFormat: null,
      depth: true,
      depthBias: 2,
      depthBiasSlope: 2.5,
      cull: 'none',
      buffers,
      uniforms: { uMeta: 'vec4f' },
      textures: { tBones: 'fetch' },
      lib: [SKIN_SSL],
      vs: `
        fn vert(a: VIn) -> VOut {
          var v: VOut;
          let baseRow: i32 = i32(M.uMeta.x + 0.5);
          let s: SkinV = skinVertex(a.pos, a.nrm, a.bw, baseRow);
          v.clip = U.lightVP * vec4f(s.wp + s.wn * 0.015, 1.0);
          return v;
        }
      `,
    });
  }

  function clear() {
    drawList.length = 0;
  }

  // Pack one rider's 23 world bone matrices into boneData at slot * SLOT_STRIDE
  function queue(worldM, poseDesc, colors, meta) {
    if (!bind || drawList.length >= MAX_SLOTS) return;
    const slot = drawList.length;
    const sol = solvePose(poseDesc);
    const baseRow = slot * SLOT_STRIDE;

    for (let i = 0; i < NB; i++) {
      const mLocal = m4.mul(sol.F[i], invBind[i]);
      const mWorld = m4.mul(worldM, mLocal);
      const off = (baseRow + i) * 16;
      for (let k = 0; k < 16; k++) boneData[off + k] = mWorld[k];
    }

    drawList.push({
      baseRow,
      jersey: colors.jersey,
      helmet: colors.helmet,
      accent: colors.accent,
      boost: meta.boost || 0,
      fpvCut: meta.fpvCut ? 1 : 0,
      cutRadius: meta.cutRadius || 0.36,
      sol,
    });
  }

  function upload() {
    if (!boneTex || drawList.length === 0) return;
    const rows = Math.min(256, drawList.length * SLOT_STRIDE);
    gfx.updateTexture(boneTex, 0, 0, 4, rows, boneData.subarray(0, rows * 16));
  }

  function drawShadow() {
    if (!shPipe || drawList.length === 0) return;
    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      gfx.draw(shPipe, {
        vb: [vb, vbW], ib, count: indexCount,
        u: { uMeta: [d.baseRow, 0, 0, 0] },
        tex: { tBones: boneTex },
      });
    }
  }

  function drawColor(shadowTex) {
    if (!pipe || drawList.length === 0) return;
    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      gfx.draw(pipe, {
        vb: [vb, vbW], ib, count: indexCount,
        u: {
          uJersey: [d.jersey[0], d.jersey[1], d.jersey[2], 1],
          uHelmet: [d.helmet[0], d.helmet[1], d.helmet[2], 1],
          uAccent: [d.accent[0], d.accent[1], d.accent[2], 1],
          uMeta:   [d.baseRow, d.boost, d.fpvCut, d.cutRadius],
        },
        tex: { tBones: boneTex, uShadow: shadowTex },
      });
    }
  }

  return {
    init, clear, queue, upload, drawShadow, drawColor, buildMesh, solvePose,
    info: () => meshInfo,
    B,
    fpvRiderId: -1, // set to player.id when camera is in FPV mode
  };
})();

// ================================================================ 2. Instanced Procedural Solid Renderer (Bikes + World Props)
const Solid = (() => {
  const MAX_INST = 6400;
  const shapes = {};
  let gfx = null, pipe = null, shPipe = null, instBuf = null;
  const instCPU = new Float32Array(MAX_INST * 16);

  function makeBox() {
    const V = [], I = [];
    const faces = [
      [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
      [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
      [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
      [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    ];
    for (const [n, a, b, c, d] of faces) {
      const base = V.length / 6;
      for (const p of [a, b, c, d]) V.push(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5, n[0], n[1], n[2]);
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeCyl(seg = 12, topR = 0.5, botR = 0.5) {
    const V = [], I = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const ny = (botR - topR);
      const nl = Math.hypot(ca, ny, sa) || 1;
      V.push(ca * botR, -0.5, sa * botR, ca / nl, ny / nl, sa / nl);
      V.push(ca * topR,  0.5, sa * topR, ca / nl, ny / nl, sa / nl);
    }
    for (let k = 0; k < seg; k++) {
      const b = k * 2;
      I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const cBot = V.length / 6;
    V.push(0, -0.5, 0, 0, -1, 0);
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * TAU;
      V.push(Math.cos(a) * botR, -0.5, Math.sin(a) * botR, 0, -1, 0);
    }
    for (let k = 0; k < seg; k++) I.push(cBot, cBot + 1 + ((k + 1) % seg), cBot + 1 + k);

    if (topR > 0.01) {
      const cTop = V.length / 6;
      V.push(0, 0.5, 0, 0, 1, 0);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * TAU;
        V.push(Math.cos(a) * topR, 0.5, Math.sin(a) * topR, 0, 1, 0);
      }
      for (let k = 0; k < seg; k++) I.push(cTop, cTop + 1 + k, cTop + 1 + ((k + 1) % seg));
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeTorus(majSeg = 20, minSeg = 8, R = 0.36, r = 0.088) {
    // Knobby MTB tire lying in YZ plane (axle along X axis)
    const V = [], I = [];
    for (let i = 0; i <= majSeg; i++) {
      const u = (i / majSeg) * TAU, cu = Math.cos(u), su = Math.sin(u);
      const knob = (i & 1) ? 1.07 : 0.96; // subtle knobby DH tread profile!
      for (let j = 0; j <= minSeg; j++) {
        const v = (j / minSeg) * TAU, cv = Math.cos(v), sv = Math.sin(v);
        const tread = cv > 0.15 ? knob : 1.0;
        const rr = R + r * cv * tread;
        const x = r * sv * 0.92, y = rr * cu, z = rr * su;
        const nx = sv, ny = cv * cu, nz = cv * su;
        V.push(x, y, z, nx, ny, nz);
      }
    }
    const stride = minSeg + 1;
    for (let i = 0; i < majSeg; i++) {
      for (let j = 0; j < minSeg; j++) {
        const a = i * stride + j, b = a + stride;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeRim(majSeg = 20, minSeg = 6, R = 0.295, r = 0.024) {
    const V = [], I = [];
    for (let i = 0; i <= majSeg; i++) {
      const u = (i / majSeg) * TAU, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= minSeg; j++) {
        const v = (j / minSeg) * TAU, cv = Math.cos(v), sv = Math.sin(v);
        const rr = R + r * cv;
        V.push(r * sv * 1.15, rr * cu, rr * su, sv, cv * cu, cv * su);
      }
    }
    const stride = minSeg + 1;
    for (let i = 0; i < majSeg; i++) {
      for (let j = 0; j < minSeg; j++) {
        const a = i * stride + j, b = a + stride;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  function makeOctaSphere(lat = 7, lon = 10) {
    const V = [], I = [];
    for (let y = 0; y <= lat; y++) {
      const phi = (y / lat) * PI, sp = Math.sin(phi), cp = Math.cos(phi);
      for (let x = 0; x <= lon; x++) {
        const th = (x / lon) * TAU, ct = Math.cos(th), st = Math.sin(th);
        const nx = sp * ct, ny = cp, nz = sp * st;
        V.push(nx * 0.5, ny * 0.5, nz * 0.5, nx, ny, nz);
      }
    }
    const st = lon + 1;
    for (let y = 0; y < lat; y++) {
      for (let x = 0; x < lon; x++) {
        const a = y * st + x, b = a + st;
        I.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    return { v: new Float32Array(V), i: new Uint32Array(I) };
  }

  const queues = { box: [], cyl: [], cone: [], tire: [], rim: [], sphere: [] };

  function pushMat(kind, m, col, rough = 0.5) {
    queues[kind].push(
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      col[0], col[1], col[2], rough
    );
  }

  function ayCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function limbMat(a, b, rx, rz = rx) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return null;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    const ax = Math.abs(uy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const sx = v3.norm(ayCross(ax, [ux, uy, uz]));
    const sz = v3.cross([ux, uy, uz], sx);
    const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5, mz = (a[2] + b[2]) * 0.5;
    return [
      sx[0] * rx, sx[1] * rx, sx[2] * rx, 0,
      ux * len,   uy * len,   uz * len,   0,
      sz[0] * rz, sz[1] * rz, sz[2] * rz, 0,
      mx,         my,         mz,         1,
    ];
  }

  const S = {
    init(g) {
      gfx = g;
      const defs = {
        box: makeBox(),
        cyl: makeCyl(12, 0.5, 0.5),
        cone: makeCyl(9, 0.02, 0.52),
        tire: makeTorus(24, 9, 0.365, 0.060),
        rim: makeRim(24, 6, 0.312, 0.017),
        sphere: makeOctaSphere(6, 10),
      };
      for (const k in defs) {
        shapes[k] = {
          vb: gfx.buffer(defs[k].v, 'vertex', false),
          ib: gfx.buffer(defs[k].i, 'index', false),
          count: defs[k].i.length,
        };
      }
      instBuf = gfx.buffer(instCPU, 'vertex', true);

      const instBuffers = [
        { attrs: [['pos', 'vec3f'], ['nrm', 'vec3f']] },
        { instanced: true, attrs: [['iM0', 'vec4f'], ['iM1', 'vec4f'], ['iM2', 'vec4f'], ['iCol', 'vec4f']] },
      ];

      pipe = gfx.pipeline({
        name: 'solid',
        colorFormat: 'rgba8',
        depth: true,
        cull: 'back',
        buffers: instBuffers,
        varyings: { wpos: 'vec3f', wnrm: 'vec3f', col: 'vec4f' },
        textures: { uShadow: 'shadow' },
        lib: [SHADER_COMMON, SHADER_SHADOW],
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let p4: vec4f = vec4f(a.pos, 1.0);
            let wp: vec3f = vec3f(dot(a.iM0, p4), dot(a.iM1, p4), dot(a.iM2, p4));
            let wn: vec3f = normalize(vec3f(dot(a.iM0.xyz, a.nrm), dot(a.iM1.xyz, a.nrm), dot(a.iM2.xyz, a.nrm)));
            v.clip = U.viewProj * vec4f(wp, 1.0);
            v.wpos = wp;
            v.wnrm = wn;
            v.col = a.iCol;
            return v;
          }
        `,
        fs: `
          fn frag(v: VOut) -> FOut {
            let sh: f32 = sampleShadow(v.wpos, normalize(v.wnrm));
            var c: vec3f = litSurface(v.col.rgb, v.wnrm, v.wpos, v.col.w, sh);
            if (v.col.w < 0.0) {
              c = v.col.rgb * 2.1;
            }
            var o: FOut;
            o.color = vec4f(acesTone(c * U.sunCol.w), 1.0);
            return o;
          }
        `,
      });

      shPipe = gfx.pipeline({
        name: 'solidShadow',
        colorFormat: null,
        depth: true,
        depthBias: 2,
        depthBiasSlope: 2.5,
        cull: 'back',
        buffers: instBuffers,
        vs: `
          fn vert(a: VIn) -> VOut {
            var v: VOut;
            let p4: vec4f = vec4f(a.pos, 1.0);
            let wp: vec3f = vec3f(dot(a.iM0, p4), dot(a.iM1, p4), dot(a.iM2, p4));
            v.clip = U.lightVP * vec4f(wp, 1.0);
            return v;
          }
        `,
      });

      RiderMesh.init(gfx);
    },

    clear() {
      for (const k in queues) queues[k].length = 0;
      RiderMesh.clear();
    },

    push(kind, mat, col, rough = 0.5) {
      pushMat(kind, mat, col, rough);
    },

    pushTRS(kind, pos, rotY, rotX, rotZ, scl, col, rough = 0.5) {
      let m = m4.translate(pos);
      if (rotY) m = m4.mul(m, m4.rotY(rotY));
      if (rotX) m = m4.mul(m, m4.rotX(rotX));
      if (rotZ) m = m4.mul(m, m4.rotZ(rotZ));
      m = m4.mul(m, m4.scale(scl));
      pushMat(kind, m, col, rough);
    },

    pushLimb(a, b, r, col, rough = 0.45, kind = 'cyl', rz = r) {
      const m = limbMat(a, b, r, rz);
      if (m) pushMat(kind, m, col, rough);
    },

    _slices: [],
    upload() {
      S._slices.length = 0;
      let cursor = 0;
      for (const k in queues) {
        const q = queues[k];
        const n = Math.min(q.length / 16, MAX_INST - cursor);
        if (n <= 0) continue;
        instCPU.set(q.subarray ? q.subarray(0, n * 16) : q.slice(0, n * 16), cursor * 16);
        S._slices.push({ kind: k, base: cursor, count: n });
        cursor += n;
      }
      if (cursor > 0) gfx.updateBuffer(instBuf, 0, instCPU.subarray(0, cursor * 16));
      RiderMesh.upload();
    },

    drawShadow() {
      if (!shPipe) return;
      for (const sl of S._slices) {
        const sh = shapes[sl.kind];
        gfx.draw(shPipe, { vb: [sh.vb, instBuf], ib: sh.ib, count: sh.count, instances: sl.count, base: sl.base });
      }
      RiderMesh.drawShadow();
    },

    drawColor(shadowTex) {
      if (!pipe) return;
      for (const sl of S._slices) {
        const sh = shapes[sl.kind];
        gfx.draw(pipe, {
          vb: [sh.vb, instBuf], ib: sh.ib, count: sh.count, instances: sl.count, base: sl.base,
          tex: { uShadow: shadowTex },
        });
      }
      RiderMesh.drawColor(shadowTex);
    },
  };
  return S;
})();

// ================================================================ 3. Detailed Dual-Suspension Downhill MTB + Full Rider Pose Driver
const BikeMesh = (() => {
  function xform(m, p) { return m4.tp(m, p); }

  function emitRider(R, time) {
    const upg = R.upgrades || { frame: 0, fork: 0, drive: 0, tires: 0, combat: 0 };
    const colFrame  = R.frameCol  || [0.95, 0.28, 0.08];
    const colJersey = R.jerseyCol || [0.15, 0.72, 0.96];
    const colHelmet = R.helmetCol || [0.98, 0.85, 0.14];
    const colAccent = R.accentCol || colFrame;
    const colForkStanchion = upg.fork >= 2 ? [0.96, 0.74, 0.18] : [0.80, 0.82, 0.86];
    const colShockSpring   = upg.fork >= 2 ? [0.98, 0.22, 0.12] : [0.96, 0.76, 0.14];
    const colTire   = [0.09, 0.09, 0.10];
    const colRim    = [0.22, 0.24, 0.28];
    const colMetal  = [0.70, 0.72, 0.76];
    const colDark   = [0.14, 0.15, 0.18];
    const colRubber = [0.11, 0.11, 0.12];

    const tireScale = 0.98 + upg.tires * 0.055;
    const tubeScale = 1.0 + upg.frame * 0.08;
    const comp = clamp(R.susp || 0, -0.07, 0.26);
    const steerAng = clamp((R.steer || 0) * 0.44, -0.52, 0.52);
    const wheelR = 0.425 * tireScale;
    const pedA = R.pedalPhase || 0;
    const idleW = R.idleMode ? 1 : 0;
    const sprintAmp = (!R.air && !idleW && !R.crashed) ? sat((R.speed || 0) / 16) * (R.boosting ? 1.25 : 0.92) : 0;
    const bikePedalRock = Math.cos(pedA) * 0.052 * sprintAmp; // Pro DH standing sprint side-to-side frame pump!

    // 1. Bike world transform (riding or detached tumbling bike during crash)
    let bikeM;
    if (R.crashed) {
      bikeM = m4.translate(R.bikeCrashPos);
      bikeM = m4.mul(bikeM, m4.rotY(R.bikeCrashRot[1]));
      bikeM = m4.mul(bikeM, m4.rotX(R.bikeCrashRot[0]));
      bikeM = m4.mul(bikeM, m4.rotZ(R.bikeCrashRot[2]));
    } else {
      bikeM = m4.translate(R.pos);
      bikeM = m4.mul(bikeM, m4.rotY(R.yaw + (R.trickYaw || 0)));
      bikeM = m4.mul(bikeM, m4.rotX(R.pitch + (R.trickPitch || 0)));
      bikeM = m4.mul(bikeM, m4.rotZ(R.roll + (R.trickRoll || 0) + bikePedalRock));
    }

    // Tailwhip swings rear frame around headtube!
    let frameM = bikeM;
    if (!R.crashed && R.trickType === 'whip' && Math.abs(R.trickPhase || 0) > 0.01) {
      frameM = m4.mul(bikeM, m4.translate([0, 0.92, -0.42]));
      frameM = m4.mul(frameM, m4.rotY(R.trickPhase * 1.55));
      frameM = m4.mul(frameM, m4.translate([0, -0.92, 0.42]));
    }

    // ---- Bike Geometry in Local Space (forward = -Z, up = +Y, right = +X) ----
    const rearAxleL  = [0, wheelR, 0.67];
    const frontAxleL = [0, wheelR, -0.71];
    const bbL        = [0, 0.41 - comp * 0.72, 0.09];
    const seatMidL   = [0, 0.68 - comp * 0.80, 0.21];
    const seatTopL   = [0, 0.88 - comp * 0.85, 0.29];
    const headBotL   = [0, 0.80 - comp * 0.88, -0.44];
    const headTopL   = [0, 1.04 - comp * 0.88, -0.36];
    const rockerL    = [0, 0.76 - comp * 0.82, 0.25];
    const shockFront = [0, 0.58 - comp * 0.78, -0.05];

    const bb       = xform(frameM, bbL);
    const seatMid  = xform(frameM, seatMidL);
    const seatTop  = xform(frameM, seatTopL);
    const headBot  = xform(frameM, headBotL);
    const headTop  = xform(frameM, headTopL);
    const rocker   = xform(frameM, rockerL);
    const shFront  = xform(frameM, shockFront);

    // ---- Detailed Realistic MTB Wheels: slim knobby tire + alloy rim + 203mm rotor + hydraulic caliper + cassette + 8 thin spokes ----
    const wheelSpin = R.wheelSpin || 0;
    const emitWheel = (Mbase, localPos, steerY, isRear) => {
      let wm = m4.mul(Mbase, m4.translate(localPos));
      if (steerY) wm = m4.mul(wm, m4.rotY(steerY));
      const sm = m4.mul(wm, m4.rotX(wheelSpin));
      Solid.push('tire', m4.mul(sm, m4.scale([tireScale, tireScale, tireScale])), colTire, 0.88);
      Solid.push('rim',  m4.mul(sm, m4.scale([tireScale, tireScale, tireScale])), colRim, 0.30);
      // CNC anodized hub barrel
      Solid.push('cyl', m4.mul(sm, m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.088, 0.145, 0.088]))), colDark, 0.28);
      // Left-side 203mm stainless hydraulic disc rotor!
      Solid.push('cyl', m4.mul(sm, m4.mul(m4.translate([-0.062, 0, 0]), m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.23, 0.010, 0.23])))), colMetal, 0.20);
      // Mounted non-spinning hydraulic disc brake caliper gripping the rotor!
      const calZ = isRear ? -0.095 : 0.095;
      Solid.push('box', m4.mul(wm, m4.mul(m4.translate([-0.068, 0.075, calZ]), m4.scale([0.044, 0.065, 0.082]))), colDark, 0.32);
      // Rear 10-speed DH cassette gear stack on right side of rear hub!
      if (isRear) {
        Solid.push('cyl', m4.mul(sm, m4.mul(m4.translate([0.058, 0, 0]), m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.16, 0.032, 0.16])))), colMetal, 0.26);
        Solid.push('cyl', m4.mul(sm, m4.mul(m4.translate([0.068, 0, 0]), m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.11, 0.022, 0.11])))), colDark, 0.30);
      }
      // 4 crossed thin steel spoke bars (8 crisp visual spokes)
      for (let k = 0; k < 4; k++) {
        const rm = m4.mul(sm, m4.rotX(k * PI / 4));
        Solid.push('box', m4.mul(rm, m4.scale([0.008, wheelR * 1.48, 0.009])), colMetal, 0.28);
      }
    };
    emitWheel(frameM, rearAxleL, 0, true);
    emitWheel(bikeM, frontAxleL, steerAng, false);

    // ---- Hydroformed Downhill Frame ----
    // Thick rectangular hydroformed downtube + gusset brace
    Solid.pushLimb(bb, headBot, 0.064 * tubeScale, colFrame, 0.25, 'box', 0.088 * tubeScale);
    Solid.pushLimb(xform(frameM, [0, 0.68 - comp * 0.82, -0.24]), headTop, 0.044 * tubeScale, colFrame, 0.28, 'box', 0.062 * tubeScale);
    // Sloping hydroformed top tube
    Solid.pushLimb(seatTop, headTop, 0.052 * tubeScale, colFrame, 0.25, 'box', 0.068 * tubeScale);
    // Seat tube + seat post
    Solid.pushLimb(bb, seatTop, 0.056 * tubeScale, colFrame, 0.26);
    Solid.pushLimb(seatTop, xform(frameM, [0, 0.96 - comp * 0.85, 0.32]), 0.036, colDark, 0.35);
    // Head tube
    Solid.pushLimb(headBot, headTop, 0.072 * tubeScale, colDark, 0.30);
    // Contoured DH Saddle
    const sadM = m4.mul(frameM, m4.mul(m4.translate([0, 0.98 - comp * 0.85, 0.33]), m4.mul(m4.rotX(-0.14), m4.scale([0.16, 0.06, 0.30]))));
    Solid.push('box', sadM, colDark, 0.68);
    Solid.push('box', m4.mul(frameM, m4.mul(m4.translate([0, 0.99 - comp * 0.85, 0.36]), m4.scale([0.12, 0.035, 0.14]))), colAccent, 0.55);

    // ---- Rear Full-Suspension Swingarm + Rocker Linkage + Piggyback Coil Shock ----
    const rLeft  = xform(frameM, [-0.095, wheelR, 0.67]);
    const rRight = xform(frameM, [ 0.095, wheelR, 0.67]);
    const bLeft  = xform(frameM, [-0.075, bbL[1] + 0.02, bbL[2] + 0.04]);
    const bRight = xform(frameM, [ 0.075, bbL[1] + 0.02, bbL[2] + 0.04]);
    const kLeft  = xform(frameM, [-0.070, rockerL[1], rockerL[2]]);
    const kRight = xform(frameM, [ 0.070, rockerL[1], rockerL[2]]);
    // Chainstays
    Solid.pushLimb(bLeft, rLeft, 0.038 * tubeScale, colDark, 0.35, 'box', 0.050 * tubeScale);
    Solid.pushLimb(bRight, rRight, 0.038 * tubeScale, colDark, 0.35, 'box', 0.050 * tubeScale);
    // Seatstays
    Solid.pushLimb(kLeft, rLeft, 0.032 * tubeScale, colFrame, 0.28);
    Solid.pushLimb(kRight, rRight, 0.032 * tubeScale, colFrame, 0.28);
    // CNC Rocker linkage plates
    Solid.pushLimb(seatMid, rocker, 0.045, colMetal, 0.24, 'box', 0.065);
    // Rear coil shock + bright anodized spring!
    Solid.pushLimb(shFront, rocker, 0.038, colDark, 0.28);
    Solid.pushLimb(v3.lerp(shFront, rocker, 0.20), v3.lerp(shFront, rocker, 0.82), 0.064, colShockSpring, 0.26);

    // ---- Drivetrain: Chainring, Tensioned Upper/Lower Chain, Rear Derailleur, Cranks & Pedals ----
    const crankR = 0.175;
    const crkL = xform(frameM, [-0.14, bbL[1] + Math.sin(pedA) * crankR, bbL[2] + Math.cos(pedA) * crankR]);
    const crkR = xform(frameM, [ 0.14, bbL[1] - Math.sin(pedA) * crankR, bbL[2] - Math.cos(pedA) * crankR]);
    // Front chainring / gold bashguard (Lv2+)
    const ringCol = upg.drive >= 2 ? [0.95, 0.72, 0.16] : colMetal;
    Solid.push('cyl', m4.mul(frameM, m4.mul(m4.translate([0.072, bbL[1], bbL[2]]), m4.mul(m4.rotZ(PI * 0.5), m4.scale([0.22, 0.016, 0.22])))), ringCol, 0.24);
    // Tensioned upper & lower drive chain + hanging rear derailleur cage!
    const chTopF = xform(frameM, [0.068, bbL[1] + 0.095, bbL[2]]);
    const chBotF = xform(frameM, [0.068, bbL[1] - 0.095, bbL[2]]);
    const chTopR = xform(frameM, [0.066, wheelR + 0.075, 0.67]);
    const derPul = xform(frameM, [0.070, wheelR - 0.115, 0.65]);
    Solid.pushLimb(chTopF, chTopR, 0.012, colMetal, 0.30, 'box', 0.014);
    Solid.pushLimb(chBotF, derPul, 0.012, colMetal, 0.30, 'box', 0.014);
    Solid.pushLimb(xform(frameM, [0.074, wheelR, 0.67]), derPul, 0.022, colDark, 0.32, 'box', 0.032);
    // Crank arms & flat MTB pedals
    Solid.pushLimb(xform(frameM, [-0.08, bbL[1], bbL[2]]), crkL, 0.026, colDark, 0.30, 'box', 0.040);
    Solid.pushLimb(xform(frameM, [ 0.08, bbL[1], bbL[2]]), crkR, 0.026, colDark, 0.30, 'box', 0.040);
    Solid.push('box', m4.mul(frameM, m4.mul(m4.translate([-0.18, bbL[1] + Math.sin(pedA) * crankR, bbL[2] + Math.cos(pedA) * crankR]), m4.scale([0.11, 0.022, 0.105]))), colMetal, 0.36);
    Solid.push('box', m4.mul(frameM, m4.mul(m4.translate([ 0.18, bbL[1] - Math.sin(pedA) * crankR, bbL[2] - Math.cos(pedA) * crankR]), m4.scale([0.11, 0.022, 0.105]))), colMetal, 0.36);

    // ---- Burly Dual-Crown Front DH Fork (Steers with handlebars!) ----
    let steerM = m4.mul(bikeM, m4.translate([0, 0.92 - comp * 0.88, -0.40]));
    steerM = m4.mul(steerM, m4.rotY(steerAng));
    steerM = m4.mul(steerM, m4.translate([0, -(0.92 - comp * 0.88), 0.40]));

    const fTopL  = xform(steerM, [-0.115, 1.08 - comp * 0.88, -0.36]);
    const fTopR  = xform(steerM, [ 0.115, 1.08 - comp * 0.88, -0.36]);
    const fMidL  = xform(steerM, [-0.115, 0.72 - comp * 0.35, -0.55]);
    const fMidR  = xform(steerM, [ 0.115, 0.72 - comp * 0.35, -0.55]);
    const fAxL   = xform(steerM, [-0.115, wheelR, -0.71]);
    const fAxR   = xform(steerM, [ 0.115, wheelR, -0.71]);
    const fThick = 0.044 + upg.fork * 0.005;

    // Upper gleaming stanchions + rubber wiper seals + Lower black casting legs
    Solid.pushLimb(fTopL, fMidL, fThick * 0.84, colForkStanchion, 0.18);
    Solid.pushLimb(fTopR, fMidR, fThick * 0.84, colForkStanchion, 0.18);
    Solid.pushLimb(v3.lerp(fTopL, fMidL, 0.92), fMidL, fThick * 1.24, colRubber, 0.72);
    Solid.pushLimb(v3.lerp(fTopR, fMidR, 0.92), fMidR, fThick * 1.24, colRubber, 0.72);
    Solid.pushLimb(fMidL, fAxL,  fThick * 1.15, colDark, 0.30);
    Solid.pushLimb(fMidR, fAxR,  fThick * 1.15, colDark, 0.30);
    // Upper & lower dual-crown triple clamps + fork arch + classic DH front race number plate!
    Solid.pushLimb(fTopL, fTopR, 0.042, colMetal, 0.24, 'box', 0.072);
    Solid.pushLimb(xform(steerM, [-0.115, 0.84 - comp * 0.88, -0.45]), xform(steerM, [0.115, 0.84 - comp * 0.88, -0.45]), 0.040, colDark, 0.32, 'box', 0.066);
    Solid.pushLimb(fMidL, fMidR, 0.034, colFrame, 0.32, 'box', 0.052);
    Solid.push('box', m4.mul(steerM, m4.mul(m4.translate([0, 0.97 - comp * 0.88, -0.46]), m4.mul(m4.rotX(-0.32), m4.scale([0.19, 0.21, 0.016])))), [0.92, 0.91, 0.88], 0.42);
    Solid.push('box', m4.mul(steerM, m4.mul(m4.translate([0, 0.97 - comp * 0.88, -0.471]), m4.mul(m4.rotX(-0.32), m4.scale([0.15, 0.04, 0.008])))), colAccent, 0.45);
    // Front mini DH mudguard under lower crown
    Solid.push('box', m4.mul(steerM, m4.mul(m4.translate([0, 0.84 - comp * 0.52, -0.60]), m4.mul(m4.rotX(-0.28), m4.scale([0.13, 0.016, 0.26])))), colDark, 0.55);

    // ---- Cockpit: Stem, Wide Riser Handlebars, Lock-on Grips & Brake Levers ----
    const stemBase = xform(steerM, [0, 1.08 - comp * 0.88, -0.36]);
    const barMid   = xform(steerM, [0, 1.13 - comp * 0.88, -0.39]);
    Solid.pushLimb(stemBase, barMid, 0.046, colMetal, 0.26, 'box', 0.052);
    const barL  = xform(steerM, [-0.30, 1.14 - comp * 0.88, -0.37]);
    const barR  = xform(steerM, [ 0.30, 1.14 - comp * 0.88, -0.37]);
    const gripL = xform(steerM, [-0.45, 1.14 - comp * 0.88, -0.35]);
    const gripR = xform(steerM, [ 0.45, 1.14 - comp * 0.88, -0.35]);
    Solid.pushLimb(barL, barR, 0.034, colDark, 0.32);
    Solid.pushLimb(barL, gripL, 0.044, colAccent, 0.65);
    Solid.pushLimb(barR, gripR, 0.044, colAccent, 0.65);
    // Brake levers
    Solid.pushLimb(xform(steerM, [-0.28, 1.12 - comp * 0.88, -0.41]), xform(steerM, [-0.38, 1.11 - comp * 0.88, -0.44]), 0.014, colMetal, 0.24);
    Solid.pushLimb(xform(steerM, [ 0.28, 1.12 - comp * 0.88, -0.41]), xform(steerM, [ 0.38, 1.11 - comp * 0.88, -0.44]), 0.014, colMetal, 0.24);

    // Mounted combat gear upgrades
    if (upg.combat >= 1) {
      const btA = xform(frameM, [0, 0.56 - comp * 0.78, -0.10]);
      const btB = xform(frameM, [0, 0.74 - comp * 0.82, -0.25]);
      Solid.pushLimb(btA, btB, 0.066, [0.16, 0.58, 0.76], 0.28);
    }

    // ---- 2. SDF-Skinned Rider Pose & Queue ----
    const riderColors = { jersey: colJersey, helmet: colHelmet, accent: colAccent };
    const isFpvSelf = !R.crashed && R.id === RiderMesh.fpvRiderId;

    if (R.crashed) {
      // Skinned SDF Ragdoll flailing through the air!
      let rm = m4.translate(R.ragPos);
      rm = m4.mul(rm, m4.rotY(R.ragRot[1]));
      rm = m4.mul(rm, m4.rotX(R.ragRot[0]));
      rm = m4.mul(rm, m4.rotZ(R.ragRot[2]));
      // Offset so ragdoll center is at pelvis (0, 1.16, 0.22 in bind)
      rm = m4.mul(rm, m4.translate([0, -1.16, -0.22]));
      const fl = Math.sin(time * 20 + R.id * 1.7) * 0.32;
      const ragPose = {
        pelvis: [0, 1.16, 0.22],
        chest:  [0, 1.43, 0.16],
        neck:   [0, 1.66, 0.10],
        head:   [0, 1.80, 0.08],
        handL:  [-0.58, 1.68 + fl, -0.12],
        handR:  [ 0.58, 1.68 - fl,  0.18],
        footL:  [-0.32, 0.48 - fl * 0.7, 0.42],
        footR:  [ 0.32, 0.48 + fl * 0.7, 0.02],
        headYaw: fl * 1.4, headPitch: -0.2, torsoYaw: fl * 0.8, torsoRoll: fl * 0.5,
      };
      RiderMesh.queue(rm, ragPose, riderColors, { boost: 0, fpvCut: false });
      return;
    }

    // Compute athletic standing sprint / idle / trick / combat pose in bike-local coords
    const crouch = (R.charge || 0) * 0.24 + comp * 0.60 + (R.boosting ? 0.15 : 0);
    const leanX  = clamp(-(R.steer || 0) * 0.22, -0.26, 0.26);
    const pedalY = Math.sin(pedA) * crankR;
    const pedalZ = Math.cos(pedA) * crankR;
    // Energetic standing sprint cadence pump (hip & shoulders driving every downstroke like Downhill Domination!)
    const pumpY  = Math.sin(pedA * 2) * 0.036 * sprintAmp;
    const pumpX  = -Math.cos(pedA) * 0.052 * sprintAmp;
    const pumpCh = Math.sin(pedA * 2 + 0.55) * 0.042 * sprintAmp;

    // Gentle living breathing & glances when poised at the start gate!
    const breath = idleW ? Math.sin(time * 1.8 + R.id) * 0.015 : 0;
    const glance = idleW ? Math.sin(time * 0.65 + R.id * 2.1) * 0.34 : clamp(-(R.steer || 0) * 0.38, -0.42, 0.42);

    const barDx = Math.cos(steerAng) * 0.42;
    const barDz = Math.sin(steerAng) * 0.42;
    let handL = [-barDx, 1.14 - comp * 0.88, -0.36 + barDz];
    let handR = [ barDx, 1.14 - comp * 0.88, -0.36 - barDz];
    let footL = [-0.18, 0.41 - comp * 0.68 + pedalY * (1 - idleW), 0.10 + pedalZ * (1 - idleW)];
    let footR = [ 0.18, 0.41 - comp * 0.68 - pedalY * (1 - idleW), 0.10 - pedalZ * (1 - idleW)];
    let pel   = [leanX * 0.65 + pumpX, 1.19 - crouch + pumpY + idleW * 0.04, 0.22 + crouch * 0.14 - sprintAmp * 0.04];
    let chs   = [leanX * 0.95 + pumpX * 0.65, 1.44 - crouch * 1.12 + pumpCh + breath + idleW * 0.06, 0.04 - (R.boosting ? 0.10 : 0) - sprintAmp * 0.05 + idleW * 0.06];
    let nck   = [leanX * 1.05 + pumpX * 0.45, 1.66 - crouch * 1.15 + pumpCh * 0.85 + breath + idleW * 0.08, -0.07 - (R.boosting ? 0.12 : 0) - sprintAmp * 0.05 + idleW * 0.07];
    let hed   = [leanX * 1.08 + pumpX * 0.30, 1.79 - crouch * 1.15 + pumpCh * 0.70 + breath + idleW * 0.08, -0.12 - (R.boosting ? 0.14 : 0) - sprintAmp * 0.05 + idleW * 0.07];
    let torsoYaw = clamp(-(R.steer || 0) * 0.22, -0.28, 0.28) + Math.cos(pedA) * 0.085 * sprintAmp;
    let torsoRoll = leanX * 0.35 - Math.cos(pedA) * 0.075 * sprintAmp;
    let headPitch = 0.10 + crouch * 0.18 - idleW * 0.10;
    let elbowPoleL = [-0.85, -0.18, 0.55], elbowPoleR = [0.85, -0.18, 0.55];
    let kneePoleL = [-0.25, 0.15, -1.0], kneePoleR = [0.25, 0.15, -1.0];

    // Idle poised start-gate pose: left foot planted solidly on the dirt beside the pedal!
    if (idleW > 0.5) {
      footL = [-0.36, 0.06, 0.18];
      footR = [ 0.19, 0.44, 0.06];
      pel[0] = -0.05;
    }

    // ---- All 8 Iconic Downhill Domination Air Tricks! ----
    const tp = sat(Math.abs(R.trickPhase || 0));
    const tk = R.trickType || '';
    if (tp > 0.02 && !idleW) {
      if (tk === 'superman') {
        // Hands stay locked on handlebars, body & legs fly straight back horizontally!
        pel   = v3.lerp(pel,   [0, 1.48, 0.64], tp);
        chs   = v3.lerp(chs,   [0, 1.42, 0.20], tp);
        nck   = v3.lerp(nck,   [0, 1.46, -0.04], tp);
        hed   = v3.lerp(hed,   [0, 1.56, -0.16], tp);
        footL = v3.lerp(footL, [-0.18, 1.56, 1.38], tp);
        footR = v3.lerp(footR, [ 0.18, 1.56, 1.38], tp);
        kneePoleL = [-0.2, -0.8, 0.2]; kneePoleR = [0.2, -0.8, 0.2];
      } else if (tk === 'cancan') {
        // Left leg kicks boldly across the top tube to the right side!
        footL = v3.lerp(footL, [ 0.56, 0.86, -0.14], tp);
        pel   = v3.lerp(pel,   [ 0.12, 1.24,  0.22], tp);
        torsoYaw += 0.35 * tp;
      } else if (tk === 'dblcancan') {
        // Both legs whip far out to the right side together!
        footL = v3.lerp(footL, [ 0.64, 0.90, -0.08], tp);
        footR = v3.lerp(footR, [ 0.72, 0.78,  0.14], tp);
        pel   = v3.lerp(pel,   [ 0.22, 1.26,  0.22], tp);
        torsoYaw += 0.48 * tp;
      } else if (tk === 'nacnac') {
        // Rear leg kicks across & far behind saddle with stylish torso twist!
        footR = v3.lerp(footR, [-0.58, 0.98, 0.78], tp);
        pel   = v3.lerp(pel,   [-0.14, 1.30, 0.32], tp);
        torsoYaw -= 0.55 * tp;
      } else if (tk === 'nohander') {
        // Torso pops upright, both arms spread wide like eagle wings!
        pel   = v3.lerp(pel,   [0, 1.26, 0.24], tp);
        chs   = v3.lerp(chs,   [0, 1.58, 0.14], tp);
        nck   = v3.lerp(nck,   [0, 1.82, 0.08], tp);
        hed   = v3.lerp(hed,   [0, 1.96, 0.04], tp);
        handL = v3.lerp(handL, [-0.88, 1.72, 0.05], tp);
        handR = v3.lerp(handR, [ 0.88, 1.72, 0.05], tp);
        elbowPoleL = [-0.4, -0.5, 0.6]; elbowPoleR = [0.4, -0.5, 0.6];
      } else if (tk === 'tabletop') {
        // Tight tucked body leaning over horizontal bike!
        pel   = v3.lerp(pel,   [-0.18, 1.06, 0.24], tp);
        chs   = v3.lerp(chs,   [-0.22, 1.32, 0.04], tp);
        nck   = v3.lerp(nck,   [-0.24, 1.52, -0.08], tp);
        hed   = v3.lerp(hed,   [-0.22, 1.65, -0.14], tp);
        torsoRoll -= 0.45 * tp;
      } else if (tk === 'whip') {
        // Hover over bars as rear triangle swings out
        pel   = v3.lerp(pel,   [0, 1.32, 0.20], tp);
        footL = v3.lerp(footL, [-0.26, 0.62, 0.22], tp);
        footR = v3.lerp(footR, [ 0.26, 0.62, 0.22], tp);
      } else if (tk === 'backflip' || tk === 'spin') {
        // Athletic tight mid-air tuck
        pel = v3.lerp(pel, [0, 1.02, 0.26], tp);
        chs = v3.lerp(chs, [0, 1.30, 0.08], tp);
        nck = v3.lerp(nck, [0, 1.50, -0.02], tp);
        hed = v3.lerp(hed, [0, 1.62, -0.08], tp);
      }
    }

    // ---- Combat Punch / Boot Kick / Bat Swing Animation ----
    if ((R.attackTimer || 0) > 0) {
      const swing = Math.sin(sat(1 - R.attackTimer / 0.34) * PI);
      const sdSide = R.attackSide || 1;
      if (R.combatTier >= 1 && R.attackKind === 'kick') {
        if (sdSide < 0) footL = [-0.86 * swing - 0.18, 0.88, -0.02];
        else            footR = [ 0.86 * swing + 0.18, 0.88, -0.02];
        torsoYaw -= sdSide * 0.32 * swing;
      } else {
        const reach = (R.combatTier >= 3 ? 0.52 : 0.46) * swing;
        if (sdSide < 0) handL = [-0.46 - reach, 1.48, -0.18];
        else            handR = [ 0.46 + reach, 1.48, -0.18];
        torsoYaw += sdSide * 0.42 * swing;
      }
      // Visible alloy downhill bat / wrench at combat tier 3+!
      if (R.combatTier >= 3 && R.attackKind !== 'kick') {
        const gripW = xform(bikeM, sdSide < 0 ? handL : handR);
        const tipW  = xform(bikeM, [sdSide * (0.95 + 0.55 * swing), 1.48, -0.34]);
        Solid.pushLimb(gripW, tipW, 0.055, [0.92, 0.72, 0.28], 0.32);
      }
    }

    // Nemesis glowing fury arrow above helmet
    if (R.nemesis) {
      const nmPos = xform(bikeM, [hed[0], hed[1] + 0.40, hed[2]]);
      Solid.pushTRS('cone', nmPos, time * 4, PI, 0, [0.22, 0.28, 0.22], [1.0, 0.14, 0.12], -1.0);
    }

    RiderMesh.queue(bikeM, {
      pelvis: pel, chest: chs, neck: nck, head: hed,
      handL, handR, footL, footR,
      headYaw: glance, headPitch, torsoYaw, torsoRoll,
      elbowPoleL, elbowPoleR, kneePoleL, kneePoleR,
    }, riderColors, {
      boost: R.boosting ? 1.0 : (R.trickActive ? 0.55 : 0.0),
      fpvCut: isFpvSelf,
      cutRadius: 0.36,
    });
  }

  return { emitRider };
})();
