/* JophyOrtho 3D — 08b : moteurs « orthèses / attelles de membres » (supérieur et inférieur).
   Anatomie du membre générée à partir des mesures : tube de sections (muscles, os palpables, articulations) + main/pied.
   Repère : Y = axe du membre (proximal +), Z = antérieur, X = latéral ; θ = 0 → +Z (antérieur), 90° → latéral, 180° → postérieur, 270° → médial. */
'use strict';
function solveAP(ml, circ) { let lo = 5, hi = 500; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ellipsePerimeter(ml, m) < circ) lo = m; else hi = m; } return (lo + hi) / 2; }
/* tableau [y, circ, ratio AP/ML, ML imposé?] → lignes interpolables {y, ml, ap, circ} */
function orthRows(tab) {
  return tab.map(t => { const circ = t[1], ml = t[3] || circ / ellipsePerimeter(1, t[2]), ap = t[3] ? solveAP(ml, circ) : t[2] * ml; return { y: t[0], circ, ml, ap }; }).sort((a, b) => a.y - b.y);
}
/* tube balayé le long d'une polyligne (doigts, orteils) avec bout arrondi → maillage fermé côté bout, ouvert côté base */
function sweepTube(pts, radii, A, fb) {
  A = A || 14; fb = fb || 1; const sp = [], rr = [];
  for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(2, Math.ceil(V.dist(pts[i], pts[i + 1]) / 3)); for (let k = 0; k < n; k++) { const t = k / n; sp.push(V.lerp(pts[i], pts[i + 1], t)); rr.push(lerp(radii[i], radii[i + 1], t)); } }
  sp.push(pts[pts.length - 1]); rr.push(radii[radii.length - 1]);
  const tg = sp.map((p, i) => V.norm(V.sub(sp[Math.min(i + 1, sp.length - 1)], sp[Math.max(i - 1, 0)]))), last = tg[tg.length - 1], rl = rr[rr.length - 1], tip = sp[sp.length - 1];
  for (let k = 1; k <= 4; k++) { const a = k / 4 * Math.PI / 2; sp.push(V.add(tip, V.mul(last, rl * Math.sin(a)))); rr.push(Math.max(0.3, rl * Math.cos(a))); tg.push(last); }
  let nrm = Math.abs(tg[0][2]) < .9 ? [0, 0, 1] : [1, 0, 0]; const rings = [];
  for (let i = 0; i < sp.length; i++) {
    nrm = V.norm(V.sub(nrm, V.mul(tg[i], V.dot(nrm, tg[i])))); const b = V.cross(tg[i], nrm), ring = [];
    for (let j = 0; j < A; j++) { const a = j / A * Math.PI * 2; ring.push(V.add(sp[i], V.add(V.mul(nrm, Math.cos(a) * rr[i]), V.mul(b, Math.sin(a) * rr[i] * fb)))); }
    rings.push(ring);
  }
  return Prim.fromRings(rings, { capStart: true, capEnd: false });
}
/* ---------- MEMBRE SUPÉRIEUR ---------- */
const OSUP_LM = [
  { id: 'acromion', label: 'Acromion (sommet du bras)', y: m => ORTH_Y.sup(m).yT, th: 90, rf: .95 },
  { id: 'epicondyle_lat', label: 'Épicondyle latéral', y: m => ORTH_Y.sup(m).yE + 18, th: 90, rf: 1 },
  { id: 'epicondyle_med', label: 'Épicondyle médial (épitrochlée)', y: m => ORTH_Y.sup(m).yE + 20, th: 270, rf: 1 },
  { id: 'olecrane', label: 'Olécrâne', y: m => ORTH_Y.sup(m).yE, th: 180, rf: 1 },
  { id: 'pli_coude', label: 'Pli du coude', y: m => ORTH_Y.sup(m).yE + 8, th: 0, rf: 1 },
  { id: 'styloide_rad', label: 'Styloïde radiale', y: m => ORTH_Y.sup(m).yW + 4, th: 65, rf: 1 },
  { id: 'styloide_ulna', label: 'Styloïde ulnaire', y: m => ORTH_Y.sup(m).yW + 4, th: 228, rf: 1 },
  { id: 'pli_poignet', label: 'Pli palmaire du poignet', y: m => ORTH_Y.sup(m).yW + 2, th: 0, rf: 1 },
  { id: 'mcp', label: 'Articulations métacarpo-phalangiennes', y: m => ORTH_Y.sup(m).yM + 4, th: 0, rf: 1 },
  { id: 'thenar', label: 'Éminence thénar', y: m => ORTH_Y.sup(m).yW - (ORTH_Y.sup(m).yW - ORTH_Y.sup(m).yM) * .3, th: 42, rf: 1 },
  { id: 'hypothenar', label: 'Éminence hypothénar', y: m => ORTH_Y.sup(m).yW - (ORTH_Y.sup(m).yW - ORTH_Y.sup(m).yM) * .3, th: 322, rf: 1 },
  { id: 'pisiforme', label: 'Pisiforme', y: m => ORTH_Y.sup(m).yW - 4, th: 318, rf: 1 },
  { id: 'arche_palmaire', label: 'Arche palmaire transversale', y: m => ORTH_Y.sup(m).yM + (ORTH_Y.sup(m).yW - ORTH_Y.sup(m).yM) * .3, th: 0, rf: 1 }
];
const ORTH_Y = {
  sup(m) { const yM = m.lenHand * 0.43, yW = m.lenHand, yE = yW + m.lenFore; return { yM, yW, yE, yT: yE + m.lenArm }; },
  inf(m) { const yA = m.ankleH, yK = yA + m.lenLeg; return { y0: yA * 0.62, yA, yK, yT: yK + m.lenThigh }; }
};
function buildSecSup(m) {
  const Y = ORTH_Y.sup(m), { yM, yW, yE, yT } = Y, pl = m.lenHand * 0.57;
  const rows = orthRows([
    [yM, 2 * (m.palmW + m.palmT) * .96, m.palmT / m.palmW, m.palmW * 0.97], [yM + pl * .5, 2 * (m.palmW * .93 + m.palmT * 1.18) * .98, m.palmT * 1.18 / (m.palmW * .93), m.palmW * .93],
    [yW - 6, m.cWrist * 1.04, .72], [yW, m.cWrist, 0, m.wristW], [yW + 50, m.cWristAbove, .76], [yW + m.lenFore * .5, m.cForeMid, .8], [yE - 55, m.cForeMax, .86], [yE - 8, m.cElbow * .98, .95, m.elbowW * .9],
    [yE + 8, m.cElbow, .98], [yE + 55, m.cAboveElbow, .98], [yE + m.lenArm * .55, m.cBiceps, .96], [yT, m.cAxilla, .93]]);
  const ys = []; for (let y = yM; y < yT; y += 3.5) ys.push(y); ys.push(yT);
  const cache = new Map(), fl = Math.tan(rad(m.elbowFlex || 0));
  return buildSecFrom(ys, y => [0, y < yE ? (yE - y) * fl : 0], (y, th) => {
    const ml = rowInterp(rows, y, 'ml'), ap = rowInterp(rows, y, 'ap'), circ = rowInterp(rows, y, 'circ');
    let r = anatR(ml, ap, circ, th, 0, { free: 180, nA: 2.15, nP: 2.2 }, cache);
    const u = (y - yE) / m.lenArm, v = (y - yW) / m.lenFore, g = gAng, mk = maskY;
    r *= 1 + .075 * g(th, 90, 34) * mk(u, .55, 1.02, .12) + .06 * g(th, 350, 26) * mk(u, .2, .85, .12) + .06 * g(th, 175, 38) * mk(u, .2, .92, .12) + .03 * g(th, 140, 22) * mk(u, .3, .8, .1)
      - .03 * g(th, 300, 13) * mk(u, .25, .8, .1) - .05 * g(th, 0, 20) * mk(y, yE - 8, yE + 26, 6)
      + .08 * g(th, 180, 17) * mk(y, yE - 12, yE + 14, 5) + .07 * g(th, 270, 14) * mk(y, yE + 8, yE + 34, 6) + .05 * g(th, 90, 14) * mk(y, yE + 6, yE + 30, 6)
      + .06 * g(th, 40, 24) * mk(v, .55, .95, .08) + .05 * g(th, 315, 30) * mk(v, .6, .97, .08) + .045 * g(th, 140, 30) * mk(v, .45, .9, .08)
      + .08 * g(th, 228, 12) * mk(y, yW - 3, yW + 12, 4) + .06 * g(th, 65, 12) * mk(y, yW - 5, yW + 10, 4) + .02 * g(th, 0, 18) * mk(y, yW - 10, yW + 14, 4)
      + .10 * g(th, 55, 26) * mk(y, yW - 48, yW - 6, 8) + .07 * g(th, 305, 26) * mk(y, yW - 48, yW - 10, 8) - .035 * g(th, 0, 24) * mk(y, yW - 52, yW - 18, 8);
    const tp = .74 + .26 * smooth(clamp((y - yM) / 34, 0, 1)); r *= 1 - (1 - tp) * Math.pow(Math.cos(rad(th)), 2);   // la paume s'amincit vers les têtes métacarpiennes
    return r * capFactor(y - yM, 9, 'arrondie');
  });
}
/* ===== MAIN anatomique : surface implicite (même technique que le pied) =====
   Paume distale + têtes métacarpiennes (jointures), 4 doigts à 3 phalanges (articulations, pulpe, ongle), pouce à 2 phalanges + éminence thénar,
   palmures interdigitales et 1re commissure par fusion douce. Repère : poignet en haut (+Y), doigts vers −Y, paume vers +Z, radial (pouce) = +X. */
const HAND_CACHE = { key: '', val: null };
function sdCapZ_(x, y, z, a, b, ra, rb, fz) {   // capsule conique aplatie dans l'axe Z (dorso-palmaire)
  const az = a[2], zz = az + (z - az) / fz, pax = x - a[0], pay = y - a[1], paz = zz - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const hh = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1), dx = pax - bax * hh, dy = pay - bay * hh, dz = paz - baz * hh;
  return (Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * hh)) * (.4 + .6 * fz);
}
function handMesh(m) {
  const key = JSON.stringify([m.lenHand, m.palmW, m.palmT, m.fingerCurl, m.thumbAbd]);
  if (HAND_CACHE.key === key) return HAND_CACHE.val;
  const Y = ORTH_Y.sup(m), yM = Y.yM, yW = Y.yW, k = m.lenHand / 190, pw = m.palmW, pt = m.palmT, curl = rad(m.fingerCurl || 10);
  const fx = [.36, .12, -.12, -.34], fl = [.93, 1, .94, .76], fr = [10.3, 10.7, 9.9, 8.6], spl = [.1, .015, -.05, -.13], zc = [.0, .0, .0, .0];
  const fingers = [];
  fx.forEach((f, i) => {
    const L = yM * fl[i] * 1.02, l = [L * .46, L * .27, L * .27], a = [curl, curl * 2.1, curl * 3.1], r0 = fr[i] * (pw / 85);
    let p = [f * pw, yM + 4, zc[i]]; const pts = [p], rr = [r0 * 1.02, r0 * .93, r0 * .84, r0 * .72];
    l.forEach((len, q) => { p = [p[0] + spl[i] * len, p[1] - Math.cos(a[q]) * len, p[2] + Math.sin(a[q]) * len]; pts.push(p); });
    fingers.push({ pts, rr, r0 });
  });
  const ab = rad(m.thumbAbd || 30), d1 = V.norm([Math.sin(ab) * .8, -Math.cos(ab), .5]), cmc = [pw * .30, yM + (yW - yM) * .62, 2 * k], t0 = [pw * .5, yM + 36 * k, 9],
    t1 = V.add(t0, V.mul(d1, 34 * k)), t2 = V.add(t1, V.mul(V.norm([d1[0] * 1.05, d1[1] * .93, d1[2] + .22]), 28 * k)), tr = [10.6 * k + 1, 9.3 * k + 1, 8.2 * k + 1], thc = V.mul(V.add(cmc, t0), .5);
  const field = (x, y, z) => {
    // paume distale (jointure des métacarpiens) et têtes métacarpiennes dorsales
    let d = sdEll_(x, y, z, 0, yM + 9, -.5, pw * .5, 22, pt * .43);
    for (let i = 0; i < 3; i++) d = smin_(d, sdEll_(x, y, z, (fx[i] + fx[i + 1]) * .5 * pw, yM - 13, 0, 7.5, 14, pt * .3), 6);   // membranes interdigitales
    for (let i = 0; i < 4; i++) d = smin_(d, sdEll_(x, y, z, fx[i] * pw, yM + 3, -pt * .2 - 1, fingers[i].r0 * .92, 8, fingers[i].r0 * .8), 4);
    // éminence hypothénar (bord ulnaire) : petit relief palmaire
    d = smin_(d, sdEll_(x, y, z, -pw * .34, yM + (yW - yM) * .27, pt * .15, pw * .17, 26, pt * .33), 10);
    // doigts : 3 phalanges, articulations (nodosités dorsales), pulpe, ongle
    for (let i = 0; i < 4; i++) {
      const F = fingers[i], P = F.pts, R = F.rr; let df = 1e9;
      for (let q = 0; q < 3; q++) df = Math.min(df, sdCapZ_(x, y, z, P[q], P[q + 1], R[q], R[q + 1], .86));
      for (let q = 1; q < 3; q++) df = smin_(df, sdEll_(x, y, z, P[q][0], P[q][1], P[q][2] - R[q] * .16, R[q] * 1.08, R[q] * 1.05, R[q] * .98), 3);   // PIP / DIP
      const t3 = P[3], pu = [t3[0], t3[1] - R[3] * .5, t3[2] + R[3] * .22];
      df = smin_(df, sdEll_(x, y, z, pu[0], pu[1], pu[2], R[3] * .95, R[3] * 1.05, R[3] * .8), 3);   // pulpe digitale
      const n1 = V.lerp ? V.lerp(P[2], P[3], .35) : [(P[2][0] * .65 + P[3][0] * .35), (P[2][1] * .65 + P[3][1] * .35), (P[2][2] * .65 + P[3][2] * .35)];
      df = smin_(df, sdEll_(x, y, z, n1[0], n1[1] - R[3] * .25, n1[2] - R[3] * .68, R[3] * .62, R[3] * .95, R[3] * .22), 1.2);       // plaque unguéale
      d = smin_(d, df, 7.5);   // palmures interdigitales
    }
    // pouce : métacarpien, éminence thénar (palmaire), 2 phalanges, nodosité, pulpe, ongle
    let dt = sdCapZ_(x, y, z, cmc, t0, tr[0] * 1.18, tr[0], .78);
    dt = smin_(dt, sdEll_(x, y, z, thc[0] - 2, thc[1] + 3, thc[2] + 6 * k, 17 * k, 28 * k, 12 * k), 10);
    dt = smin_(dt, sdCapZ_(x, y, z, t0, t1, tr[0], tr[1], .84), 3);
    dt = smin_(dt, sdCapZ_(x, y, z, t1, t2, tr[1], tr[2], .84), 3);
    dt = smin_(dt, sdEll_(x, y, z, t1[0], t1[1], t1[2] - tr[1] * .15, tr[1] * 1.08, tr[1] * 1.05, tr[1] * .98), 3);
    dt = smin_(dt, sdEll_(x, y, z, t2[0], t2[1] - tr[2] * .45, t2[2] + tr[2] * .2, tr[2] * .96, tr[2] * 1.1, tr[2] * .82), 3);
    dt = smin_(dt, sdEll_(x, y, z, t2[0], t2[1] + tr[2] * .15, t2[2] - tr[2] * .66, tr[2] * .66, tr[2] * 1.05, tr[2] * .22), 1.2);
    return smin_(d, dt, 11);   // 1re commissure
  };
  const h = 1.8, xs = [-pw * .6, pw * .6 + 70 * k], x0 = xs[0] - 4, y0 = yM - yM * 1.04 - 10, z0 = -pt * .7 - 10, zmax = Math.max(...fingers.map(F => F.pts[3][2]), t2[2]) + 16;
  const nx = Math.ceil((xs[1] - x0 + 4) / h), ny = Math.ceil((yM + (yW - yM) * .75 - y0) / h), nz = Math.ceil((zmax - z0) / h);
  const sn = surfaceNets_(field, x0, y0, z0, nx, ny, nz, h);
  let mesh = new Mesh(sn.v, sn.f).touch(); if (mesh.volume() < 0) { const f2 = sn.f.slice(); for (let q = 0; q < f2.length; q += 3) { const t = f2[q + 1]; f2[q + 1] = f2[q + 2]; f2[q + 2] = t; } mesh = new Mesh(sn.v, f2).touch(); }
  const res = { mesh, nFingers: 5 }; HAND_CACHE.key = key; HAND_CACHE.val = res; return res;
}
/* ---------- MEMBRE INFÉRIEUR ---------- */
const OINF_LM = [
  { id: 'patella', label: 'Rotule (centre)', y: m => ORTH_Y.inf(m).yK, th: 0, rf: 1 },
  { id: 'tuberosite', label: 'Tubérosité tibiale', y: m => ORTH_Y.inf(m).yK - 35, th: 0, rf: 1 },
  { id: 'condyle_lat', label: 'Condyle fémoral latéral', y: m => ORTH_Y.inf(m).yK + 6, th: 90, rf: 1 },
  { id: 'condyle_med', label: 'Condyle fémoral médial', y: m => ORTH_Y.inf(m).yK + 6, th: 270, rf: 1 },
  { id: 'tete_fibula', label: 'Tête de la fibula', y: m => ORTH_Y.inf(m).yK - 22, th: 120, rf: 1 },
  { id: 'creux_popliteal', label: 'Creux poplité', y: m => ORTH_Y.inf(m).yK + 8, th: 180, rf: 1 },
  { id: 'crete_tibiale', label: 'Crête tibiale (mi-jambe)', y: m => ORTH_Y.inf(m).yA + m.lenLeg * .5, th: 0, rf: 1 },
  { id: 'gastrocnemien', label: 'Sommet du mollet', y: m => ORTH_Y.inf(m).yA + m.lenLeg * .68, th: 180, rf: 1 },
  { id: 'malleole_med', label: 'Malléole médiale', y: m => ORTH_Y.inf(m).yA + 5, th: 270, rf: 1 },
  { id: 'malleole_lat', label: 'Malléole latérale', y: m => ORTH_Y.inf(m).yA - 6, th: 90, rf: 1 },
  { id: 'achille', label: 'Tendon d\'Achille (insertion distale)', y: m => ORTH_Y.inf(m).yA + 45, th: 180, rf: 1 },
  { id: 'talon', label: 'Talon (calcanéus, face postérieure)', foot: true }, { id: 'naviculaire', label: 'Tubérosité du naviculaire', foot: true }, { id: 'base_5mt', label: 'Base du 5e métatarsien', foot: true },
  { id: 'tete_1mt', label: 'Tête du 1er métatarsien', foot: true }, { id: 'tete_5mt', label: 'Tête du 5e métatarsien', foot: true }, { id: 'dos_pied', label: 'Dos du pied (cou-de-pied)', foot: true },
  { id: 'voute', label: 'Voûte plantaire médiale', foot: true }, { id: 'retrocap', label: 'Zone rétro-capitale (plante)', foot: true }, { id: 'hallux', label: 'Bout du gros orteil', foot: true }
];
function buildSecInf(m) {
  const Y = ORTH_Y.inf(m), { y0, yA, yK, yT } = Y, fl = Math.tan(rad(m.kneeFlex || 0));
  const rows = orthRows([
    [y0, m.cAnkle * .74, 1.0, m.ankleW * .62], [yA, m.cAnkle, 0, m.ankleW], [yA + 55, m.cSupraAnkle, .9], [yA + m.lenLeg * .3, m.cLegMid * .98, .95], [yA + m.lenLeg * .68, m.cCalfMax, .98],
    [yK - 38, m.cBelowKnee, 1.0], [yK, m.cKnee, 1.08, m.kneeW * 1.02], [yK + 55, m.cAboveKnee, 1.0], [yK + m.lenThigh * .5, m.cThighMid, .98], [yT, m.cThighProx, .95]]);
  const ys = []; for (let y = y0; y < yT; y += 4) ys.push(y); ys.push(yT);
  const cache = new Map();
  return buildSecFrom(ys, y => [0, -Math.max(0, yK - y) * fl], (y, th) => {
    const ml = rowInterp(rows, y, 'ml'), ap = rowInterp(rows, y, 'ap'), circ = rowInterp(rows, y, 'circ');
    let r = anatR(ml, ap, circ, th, 0, { free: 180, nA: 2.3, nP: 2.1 }, cache);
    const l = (y - yA) / m.lenLeg, t = (y - yK) / m.lenThigh, g = gAng, mk = maskY;
    r *= 1 + .05 * g(th, 0, 9) * mk(l, .12, .92, .1) * (.5 + .5 * Math.sin(Math.PI * clamp(l, 0, 1))) - .02 * g(th, 300, 35) * mk(l, .1, .85, .1)
      + .09 * g(th, 195, 25) * mk(l, .42, .92, .08) + .07 * g(th, 165, 23) * mk(l, .42, .9, .08) + .03 * g(th, 130, 30) * mk(l, .25, .6, .1) - .04 * g(th, 180, 11) * mk(l, .02, .34, .08)
      + .12 * g(th, 270, 12) * mk(y, yA - 6, yA + 17, 4) + .10 * g(th, 90, 11) * mk(y, yA - 16, yA + 6, 4)
      + .05 * g(th, 120, 12) * mk(y, yK - 34, yK - 10, 4) + .06 * g(th, 0, 10) * mk(y, yK - 46, yK - 25, 4) + .08 * g(th, 0, 24) * mk(y, yK - 22, yK + 22, 5) - .06 * g(th, 180, 22) * mk(y, yK - 8, yK + 28, 6)
      + .06 * g(th, 0, 46) * mk(t, .12, .98, .1) + .05 * g(th, 60, 25) * mk(t, .1, .95, .1) + .07 * g(th, 315, 18) * mk(t, 0, .22, .05) + .05 * g(th, 180, 34) * mk(t, .12, .98, .1) + .04 * g(th, 270, 30) * mk(t, .35, 1.02, .1)
      + .05 * g(th, 180, 30) * mk(y, yT - 40, yT + 5, 12);
    return r * capFactor(y - y0, 5, 'plate');
  });
}
/* spline cubique monotone (Catmull-Rom limité) */
function crs(xs, ys, x) {
  const n = xs.length; if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, sl = k => k <= 0 ? (ys[1] - ys[0]) / (xs[1] - xs[0]) : k >= n - 1 ? (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]) : (ys[k + 1] - ys[k - 1]) / (xs[k + 1] - xs[k - 1]);
  const d = ys[i + 1] - ys[i]; let m0 = sl(i) * h, m1 = sl(i + 1) * h; if (d * m0 < 0) m0 = 0; if (d * m1 < 0) m1 = 0; const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * m1;
}
/* ===== PIED anatomique : surface implicite (champ de distance) extraite par « surface nets » =====
   Primitives fusionnées en douceur : calcanéus + coussinet talonnier, tarse / métatarse (sections elliptiques), cheville, tubérosités (naviculaire, base du 5e MT),
   têtes métatarsiennes (pelote plantaire), arche médiale creusée, 5 orteils à 3 segments (2 pour l'hallux) reliés par leurs palmures, appui plantaire plat.
   Repère : malléoles à z = 0, talon vers −Z, orteils vers +Z, sol à y = 0, X+ = latéral. */
const smin_ = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const smax_ = (a, b, k) => -smin_(-a, -b, k);
function sdEll_(x, y, z, cx, cy, cz, rx, ry, rz) { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz), gx = px / rx, gy = py / ry, gz = pz / rz, k1 = Math.sqrt(gx * gx + gy * gy + gz * gz); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); }
function sdCap_(x, y, z, a, b, ra, rb, fy) {
  const ay = a[1], yy = ay + (y - ay) / fy, pax = x - a[0], pay = yy - a[1], paz = z - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const hh = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1), dx = pax - bax * hh, dy = pay - bay * hh, dz = paz - baz * hh;
  return (Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * hh)) * (.4 + .6 * fy);
}
function surfaceNets_(f, x0, y0, z0, nx, ny, nz, h) {
  const sx = nx + 1, sy = ny + 1, sz = nz + 1, val = new Float32Array(sx * sy * sz), N = (i, j, k) => i + sx * (j + sy * k);
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) val[N(i, j, k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);
  const cid = new Int32Array(nx * ny * nz).fill(-1), C = (i, j, k) => i + nx * (j + ny * k), V = [], off = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const ED = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = off.map(o => val[N(i + o[0], j + o[1], k + o[2])]); let neg = 0; v.forEach(q => { if (q < 0) neg++; }); if (neg === 0 || neg === 8) continue;
    let px = 0, py = 0, pz = 0, n = 0; ED.forEach(([a, b]) => { if ((v[a] < 0) !== (v[b] < 0)) { const t = v[a] / (v[a] - v[b]); px += off[a][0] + (off[b][0] - off[a][0]) * t; py += off[a][1] + (off[b][1] - off[a][1]) * t; pz += off[a][2] + (off[b][2] - off[a][2]) * t; n++; } });
    cid[C(i, j, k)] = V.length / 3; V.push(x0 + (i + px / n) * h, y0 + (j + py / n) * h, z0 + (k + pz / n) * h);
  }
  const F = [], quad = (a, b, c, d, out) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; const o = out; const pa = [V[a * 3], V[a * 3 + 1], V[a * 3 + 2]], pb = [V[b * 3], V[b * 3 + 1], V[b * 3 + 2]], pc = [V[c * 3], V[c * 3 + 1], V[c * 3 + 2]], pd = [V[d * 3], V[d * 3 + 1], V[d * 3 + 2]];
    const n = V3.cross(V3.sub(pc, pa), V3.sub(pd, pb)); if (V3.dot(n, o) < 0) { [b, d] = [d, b]; } const d1 = V3.dist(pa, pc), d2 = V3.dist(pb, pd); if (d1 <= d2) F.push(a, b, c, a, c, d); else F.push(a, b, d, b, c, d); };
  const V3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const a = val[N(i, j, k)] < 0;
    if (a !== (val[N(i + 1, j, k)] < 0)) quad(cid[C(i, j - 1, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i, j - 1, k)], a ? [1, 0, 0] : [-1, 0, 0]);
    if (a !== (val[N(i, j + 1, k)] < 0)) quad(cid[C(i - 1, j, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i - 1, j, k)], a ? [0, 1, 0] : [0, -1, 0]);
    if (a !== (val[N(i, j, k + 1)] < 0)) quad(cid[C(i - 1, j - 1, k)], cid[C(i, j - 1, k)], cid[C(i, j, k)], cid[C(i - 1, j, k)], a ? [0, 0, 1] : [0, 0, -1]);
  }
  // projection des sommets sur l'iso-surface (2 itérations, gradient par différences centrées)
  const e = h * .5, nv = V.length / 3;
  for (let q = 0; q < nv; q++) for (let it = 0; it < 2; it++) {
    const x = V[q * 3], y = V[q * 3 + 1], z = V[q * 3 + 2], d0 = f(x, y, z), gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-9) break;
    const gl = Math.sqrt(g2), mv = clamp(-d0 * 2 * e / g2, -h * .6 / gl, h * .6 / gl); V[q * 3] = x + gx * mv; V[q * 3 + 1] = y + gy * mv; V[q * 3 + 2] = z + gz * mv;
  }
  // lissage de Taubin (λ|μ) : supprime le bruit d'échantillonnage sans rétrécir le volume
  const nbA = new Int32Array(F.length * 1), nbs = Array.from({ length: nv }, () => new Set());
  for (let q = 0; q < F.length; q += 3) { const a = F[q], b = F[q + 1], c = F[q + 2]; nbs[a].add(b); nbs[a].add(c); nbs[b].add(a); nbs[b].add(c); nbs[c].add(a); nbs[c].add(b); }
  const nl = nbs.map(st => Int32Array.from(st));
  for (let it = 0; it < 5; it++) for (const lam of [.5, -.53]) { const o = new Float32Array(V.length); for (let q = 0; q < nv; q++) { const ns = nl[q]; if (!ns.length) { o[q * 3] = V[q * 3]; o[q * 3 + 1] = V[q * 3 + 1]; o[q * 3 + 2] = V[q * 3 + 2]; continue; } let ax = 0, ay = 0, az = 0; for (let k = 0; k < ns.length; k++) { ax += V[ns[k] * 3]; ay += V[ns[k] * 3 + 1]; az += V[ns[k] * 3 + 2]; } ax /= ns.length; ay /= ns.length; az /= ns.length; o[q * 3] = V[q * 3] + lam * (ax - V[q * 3]); o[q * 3 + 1] = V[q * 3 + 1] + lam * (ay - V[q * 3 + 1]); o[q * 3 + 2] = V[q * 3 + 2] + lam * (az - V[q * 3 + 2]); } for (let q = 0; q < V.length; q++) V[q] = o[q]; }
  return { v: Float32Array.from(V), f: Uint32Array.from(F) };
}
const FOOT_CACHE = { key: '', val: null };
function footMesh(m, dz) {
  const key = JSON.stringify([m.footLen, m.footW, m.archH, m.heelW, m.instepH, m.cBall, m.halluxL, m.halluxAng, m.toeOut, m.ankleDF, m.hindfoot, m.ankleH, m.ankleW, m.cAnkle, dz || 0]);
  if (FOOT_CACHE.key === key) return FOOT_CACHE.val;
  const F = m.footLen, W = m.footW, Ha = m.ankleH, hw = Math.min(m.heelW || W * .62, W * .96), hl = m.halluxL || F * .24, kk = W / 100, zH = -.19 * F + (dz || 0);
  const instep = m.instepH || 64, topA = .94 * Ha, ballH = clamp((m.cBall || W * 2.45) / 1.8 - W, 24, 50), AH = m.archH || 0, hva = rad(m.halluxAng || 0);
  // ---- sections (tarse + métatarse), table d'échantillonnage en u = (z − zH) / F
  const us = [.06, .10, .16, .22, .30, .38, .46, .54, .62, .69, .74];
  const wt = [hw * .8, hw, hw * 1.04, hw * 1.06, lerp(hw, W, .2), lerp(hw, W, .42), lerp(hw, W, .6), lerp(hw, W, .78), lerp(hw, W, .93), W * .99, W * .96];
  const tt = [50, topA * .97, topA, instep, instep, instep * .95, instep * .78, Math.max(ballH * 1.3, instep * .58), ballH * 1.15, ballH * .92, ballH * .62];
  const uA = .03, uB = .76, NL = 200, L = { al: new Float32Array(NL), am: new Float32Array(NL), top: new Float32Array(NL) };
  for (let q = 0; q < NL; q++) {
    const u = uA + (uB - uA) * q / (NL - 1), ramp = smooth(clamp((u - .2) / .5, 0, 1)), w = crs(us, wt, u), ms = .5 + .06 * ramp; let al = w * (1 - ms), am = w * ms, tp = crs(us, tt, u);
    const gE = u > .62 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - .62) / .17, 2))) : 1, gR = u < .1 ? Math.sqrt(Math.max(.01, 1 - Math.pow((.1 - u) / .09, 2))) : 1, g = Math.min(gE, gR);
    L.al[q] = al * g; L.am[q] = am * g; L.top[q] = tp * Math.sqrt(g);
  }
  const body = (x, y, z) => {
    const u = (z - zH) / F, uc = clamp(u, uA, uB), q = (uc - uA) / (uB - uA) * (NL - 1), q0 = Math.min(NL - 2, q | 0), t = q - q0;
    const al = L.al[q0] + (L.al[q0 + 1] - L.al[q0]) * t, am = L.am[q0] + (L.am[q0 + 1] - L.am[q0]) * t, tp = L.top[q0] + (L.top[q0 + 1] - L.top[q0]) * t;
    const yc = .42 * tp, dy = y - yc, up = dy >= 0, hy = Math.max(.5, up ? .58 * tp : .42 * tp), ax = Math.max(.5, x >= 0 ? al : am), p = up ? 2.3 : 3.6;
    const r = Math.pow(Math.pow(Math.abs(x) / ax, p) + Math.pow(Math.abs(dy) / hy, p), 1 / p), d2 = (r - 1) * Math.min(ax, hy), dzo = Math.max((uA - u) * F, (u - uB) * F);
    return dzo > 0 ? Math.sqrt(Math.max(d2, 0) * Math.max(d2, 0) + dzo * dzo) : Math.max(d2, dzo);
  };
  const uAt = (u) => zH + u * F, secAt = (u) => { const q = (clamp(u, uA, uB) - uA) / (uB - uA) * (NL - 1), q0 = Math.min(NL - 2, q | 0), t = q - q0; return { al: L.al[q0] + (L.al[q0 + 1] - L.al[q0]) * t, am: L.am[q0] + (L.am[q0 + 1] - L.am[q0]) * t, top: L.top[q0] + (L.top[q0 + 1] - L.top[q0]) * t }; };
  // ---- orteils
  const xh = [-.375, -.19, -.005, .17, .335].map(v => v * W), hOff = [0, 3, 0, -6, -14], lenR = [1, .94, .8, .72, .6], rT = [13.2, 8.8, 8.2, 7.5, 6.8].map(v => v * kk), fy = .88, toes = [];
  for (let i = 0; i < 5; i++) {
    const zh = zH + F - hl + hOff[i], Lh = lenR[i] * hl, r = rT[i], yb = r * fy + 1.6, dxn = i === 0 ? Math.sin(hva) : -.02 * (i - 1) + (i === 1 ? .03 : 0), d = [dxn, 0, 1], dn = Math.hypot(d[0], d[2]), dd = [d[0] / dn, 0, d[2] / dn];
    const B = [xh[i], yb + 1, zh - 8], segs = i === 0 ? [.55, 1] : [.42, .74, 1], pts = [B], rad_ = [r * 1.0];
    segs.forEach((sg, k) => { { const ll = Lh * sg + 8 - (k === segs.length - 1 ? r * .85 : 0); pts.push([B[0] + dd[0] * ll, yb - .6 * (k + 1), B[2] + dd[2] * ll]); } rad_.push(r * (k === segs.length - 1 ? .82 : .96 - .02 * k)); });
    toes.push({ pts, rad: rad_, r, yb, head: [xh[i], zh] });
  }
  const archRx = .3 * W, archRz = .22 * F, archC = [-.2 * W, -6, zH + .4 * F];
  const eH = [[.185, 0, 8.5], [.0, 0, 8.5], [.0, 0, 8.5], [.0, 0, 8.5], [.0, 0, 8.5]];
  const field = (x, y, z) => {
    let d = body(x, y, z);
    d = smin_(d, sdEll_(x, y, z, 0, 35 * Math.sqrt(Ha / 70), zH + .115 * F, hw * .5, 36 * Math.sqrt(Ha / 70), .115 * F), 14);
    const ay = Ha * .85; d = smin_(d, Math.max(Math.sqrt(Math.pow(x / ((m.ankleW || 72) * .36), 2) + Math.pow((z - (zH + .19 * F)) / (solveAP(m.ankleW || 72, m.cAnkle || 250) * .36), 2)) - 1, Math.max(Ha * .62 - y, y - Ha * 1.4)) * 30, 14);
    // bosses osseuses
    const s1 = secAt(.37), s5 = secAt(.5);
    d = smin_(d, sdEll_(x, y, z, -s1.am * .95, .44 * s1.top, uAt(.37), 6, 8, 9), 5);
    d = smin_(d, sdEll_(x, y, z, s5.al * .93, .3 * s5.top, uAt(.5), 5, 6, 10), 5);
    // arche médiale
    d = smax_(d, -sdEll_(x, y, z, archC[0], archC[1], archC[2], archRx, AH + 6, archRz), 8);
    // têtes métatarsiennes (pelote plantaire)
    if (z < zH + .55 * F) return smax_(d, -y, 2.2);
    for (let i = 0; i < 5; i++) d = smin_(d, sdEll_(x, y, z, xh[i], 8, toes[i].head[1] - 2, rT[i] * 1.05, 9, 11), 6);
    // orteils
    for (let i = 0; i < 5; i++) { const t = toes[i]; let dt = 1e9; for (let k = 0; k < t.pts.length - 1; k++) dt = Math.min(dt, sdCap_(x, y, z, t.pts[k], t.pts[k + 1], t.rad[k], t.rad[k + 1], fy)); const tip = t.pts[t.pts.length - 1]; dt = smin_(dt, sdEll_(x, y, z, tip[0], tip[1], tip[2] - t.r * .1, t.r * .85, t.r * fy * .9, t.r * .95), 3); d = smin_(d, dt, 5); }
    return smax_(d, -y, 2.2);
  };
  const h = 2.2, x0 = -.62 * W, y0 = -2 * h, z0 = zH - 6, nx = Math.ceil(1.12 * W / h), ny = Math.ceil((Math.max(Ha * 1.4, 95) + 4 * h) / h), nz = Math.ceil((F + 14) / h);
  const sn = surfaceNets_(field, x0, y0, z0, nx, ny, nz, h);
  // ---- ongles
  const nails = [];
  toes.forEach((t, i) => { const n1 = t.pts[t.pts.length - 2], n2 = t.pts[t.pts.length - 1], dv = V.norm(V.sub(n2, n1)), nl = (i === 0 ? 15 : 8.5 - .6 * i) * kk, up = [0, t.r * fy * .68, 0], e2 = V.add(n2, V.mul(dv, t.r * .45)); nails.push([V.add(V.sub(e2, V.mul(dv, nl)), up), V.add(e2, up), t.r * (i === 0 ? .46 : .42)]); });
  // ---- repères (lancer de rayon sur le champ)
  const ray = (o, dir, maxD) => { let t = 0, last = field(o[0], o[1], o[2]); if (last < 0) return o; for (t = 1; t < maxD; t += 1) { const p = [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t], v = field(p[0], p[1], p[2]); if (v < 0) { let a = t - 1, b = t; for (let q = 0; q < 8; q++) { const c = (a + b) / 2, pc = field(o[0] + dir[0] * c, o[1] + dir[1] * c, o[2] + dir[2] * c); if (pc < 0) b = c; else a = c; } return [o[0] + dir[0] * b, o[1] + dir[1] * b, o[2] + dir[2] * b]; } } return null; };
  const sT = secAt(.3), lmL = {
    talon: ray([0, 32, zH - 30], [0, 0, 1], 80), naviculaire: ray([-90, .44 * secAt(.37).top, uAt(.37)], [1, 0, 0], 120), base_5mt: ray([90, .3 * secAt(.5).top, uAt(.5)], [-1, 0, 0], 120),
    tete_1mt: ray([-90, 9, toes[0].head[1] - 2], [1, 0, 0], 120), tete_5mt: ray([90, 9, toes[4].head[1] - 2], [-1, 0, 0], 120), dos_pied: ray([0, 140, uAt(.3)], [0, -1, 0], 160),
    voute: ray([archC[0], -12, archC[2]], [0, 1, 0], 40), retrocap: ray([0, -12, zH + .66 * F], [0, 1, 0], 30), hallux: ray([toes[0].pts[0][0], toes[0].pts[0][1], zH + F + 20], [0, 0, -1], 40)
  };
  // ---- transformation posturale (varus/valgus, rotation externe, flexion dorsale / équin)
  const piv = [0, .85 * Ha, dz || 0], hv = rad(m.hindfoot || 0), to = rad(m.toeOut || 0), df = rad(m.ankleDF || 0);
  const T = p => { let x = p[0] - piv[0], y = p[1] - piv[1], z = p[2] - piv[2], t; t = x * Math.cos(hv) - y * Math.sin(hv); y = x * Math.sin(hv) + y * Math.cos(hv); x = t; t = x * Math.cos(to) + z * Math.sin(to); z = -x * Math.sin(to) + z * Math.cos(to); x = t; t = y * Math.cos(df) + z * Math.sin(df); z = -y * Math.sin(df) + z * Math.cos(df); y = t; return [x + piv[0], y + piv[1], z + piv[2]]; };
  const vv = sn.v; for (let q = 0; q < vv.length; q += 3) { const p = T([vv[q], vv[q + 1], vv[q + 2]]); vv[q] = p[0]; vv[q + 1] = p[1]; vv[q + 2] = p[2]; }
  let mesh = new Mesh(sn.v, sn.f).touch(); if (mesh.volume() < 0) { const f2 = sn.f.slice(); for (let q = 0; q < f2.length; q += 3) { const t = f2[q + 1]; f2[q + 1] = f2[q + 2]; f2[q + 2] = t; } mesh = new Mesh(sn.v, f2).touch(); }
  const parts = [mesh];
  const lm = {}; Object.keys(lmL).forEach(k => { const p = lmL[k]; if (p) lm[k] = T(p); });
  const res = { mesh: Mesh.merge(parts), lm, fE: .78 }; FOOT_CACHE.key = key; FOOT_CACHE.val = res; return res;
}
/* ---------- ASSEMBLAGE ANATOMIE ---------- */
function orthAnatomy(m, fam) {
  const sec = fam === 'osup' ? buildSecSup(m) : buildSecInf(m);
  const tube = secToMesh(sec, { N: 96, capStart: true, capEnd: true });
  let ext, extName, footLM = null;
  if (fam === 'osup') { const h = handMesh(m); ext = h.mesh; extName = 'doigts'; }
  else { const dz = -Math.max(0, ORTH_Y.inf(m).yK - ORTH_Y.inf(m).yA) * Math.tan(rad(m.kneeFlex || 0)); const fm = footMesh(m, dz); ext = fm.mesh; extName = 'pied'; footLM = fm.lm; }
  const mesh = Mesh.merge([tube, ext]); mesh.tubeNt = tube.nt;
  return { sec, mesh, tube: tube.nt, ext: ext.nt, extName, footLM };
}
const ORTH_FIELDS = {
  osup: [
    { k: 'lenArm', label: 'Bras : acromion → olécrâne', unit: 'mm', min: 200, max: 400, step: 1 }, { k: 'lenFore', label: 'Avant-bras : olécrâne → styloïde ulnaire', unit: 'mm', min: 170, max: 340, step: 1 },
    { k: 'lenHand', label: 'Main : pli du poignet → bout du majeur', unit: 'mm', min: 140, max: 250, step: 1 }, { k: 'palmW', label: 'Largeur de la paume (têtes métacarpiennes)', unit: 'mm', min: 60, max: 120, step: 1 },
    { k: 'palmT', label: 'Épaisseur de la paume', unit: 'mm', min: 20, max: 50, step: 1 }, { k: 'cAxilla', label: 'Circonférence du bras, pli axillaire', unit: 'mm', min: 220, max: 480, step: 1 },
    { k: 'cBiceps', label: 'Circonférence du bras, maximale (biceps)', unit: 'mm', min: 180, max: 450, step: 1 }, { k: 'cAboveElbow', label: 'Circonférence 5 cm au-dessus du coude', unit: 'mm', min: 160, max: 400, step: 1 },
    { k: 'cElbow', label: 'Circonférence du coude (olécrâne)', unit: 'mm', min: 180, max: 420, step: 1 }, { k: 'elbowW', label: 'Largeur du coude (épicondyles)', unit: 'mm', min: 45, max: 100, step: 1 },
    { k: 'cForeMax', label: 'Circonférence avant-bras, maximale (5 cm sous le coude)', unit: 'mm', min: 160, max: 380, step: 1 }, { k: 'cForeMid', label: 'Circonférence avant-bras, milieu', unit: 'mm', min: 140, max: 340, step: 1 },
    { k: 'cWristAbove', label: 'Circonférence 5 cm au-dessus du poignet', unit: 'mm', min: 110, max: 260, step: 1 }, { k: 'cWrist', label: 'Circonférence du poignet (styloïdes)', unit: 'mm', min: 110, max: 260, step: 1 },
    { k: 'wristW', label: 'Largeur du poignet (styloïdes)', unit: 'mm', min: 40, max: 85, step: 1 }, { k: 'wristAP', label: 'Épaisseur AP du poignet', unit: 'mm', min: 25, max: 60, step: 1 },
    { k: 'elbowFlex', label: 'Flexion du coude', unit: '°', min: 0, max: 45, step: 1 }, { k: 'fingerCurl', label: 'Flexion des doigts (par articulation)', unit: '°', min: 0, max: 30, step: 1 }, { k: 'thumbAbd', label: 'Abduction du pouce', unit: '°', min: 0, max: 70, step: 1 }
  ],
  oinf: [
    { k: 'lenThigh', label: 'Cuisse : interligne du genou → pli fessier', unit: 'mm', min: 250, max: 560, step: 1 }, { k: 'lenLeg', label: 'Jambe : interligne du genou → malléole latérale', unit: 'mm', min: 250, max: 520, step: 1 },
    { k: 'ankleH', label: 'Hauteur de la malléole latérale (au-dessus du sol)', unit: 'mm', min: 45, max: 110, step: 1 }, { k: 'footLen', label: 'Longueur du pied', unit: 'mm', min: 190, max: 320, step: 1 },
    { k: 'footW', label: 'Largeur du pied (têtes métatarsiennes)', unit: 'mm', min: 70, max: 130, step: 1 }, { k: 'archH', label: 'Hauteur de la voûte plantaire', unit: 'mm', min: 0, max: 40, step: 1 },
    { k: 'heelW', label: 'Largeur du talon', unit: 'mm', min: 45, max: 90, step: 1 }, { k: 'instepH', label: 'Hauteur du cou-de-pied (au naviculaire)', unit: 'mm', min: 40, max: 95, step: 1 },
    { k: 'cBall', label: 'Circonférence métatarsienne (têtes des métatarsiens)', unit: 'mm', min: 200, max: 330, step: 1 }, { k: 'cFig8', label: 'Circonférence en 8 talon–cou-de-pied (contrôle)', unit: 'mm', min: 270, max: 420, step: 1 },
    { k: 'halluxL', label: 'Longueur du gros orteil (pli de flexion → bout)', unit: 'mm', min: 40, max: 85, step: 1 }, { k: 'halluxAng', label: 'Déviation du gros orteil (valgus)', unit: '°', min: 0, max: 45, step: 1 },
    { k: 'toeOut', label: 'Rotation externe du pied', unit: '°', min: -10, max: 30, step: 1 }, { k: 'ankleDF', label: 'Cheville : flexion dorsale (+) / équin (−)', unit: '°', min: -30, max: 25, step: 1 },
    { k: 'hindfoot', label: 'Arrière-pied : valgus (+) / varus (−)', unit: '°', min: -15, max: 15, step: 1 },
    { k: 'cThighProx', label: 'Circonférence cuisse, sous le pli fessier', unit: 'mm', min: 380, max: 800, step: 1 }, { k: 'cThighMid', label: 'Circonférence cuisse, milieu', unit: 'mm', min: 340, max: 720, step: 1 },
    { k: 'cAboveKnee', label: 'Circonférence 10 cm au-dessus de la rotule', unit: 'mm', min: 300, max: 640, step: 1 }, { k: 'cKnee', label: 'Circonférence du genou (mi-rotule)', unit: 'mm', min: 270, max: 560, step: 1 },
    { k: 'kneeW', label: 'Largeur du genou (condyles)', unit: 'mm', min: 70, max: 140, step: 1 }, { k: 'cBelowKnee', label: 'Circonférence sous la tubérosité tibiale', unit: 'mm', min: 260, max: 520, step: 1 },
    { k: 'cCalfMax', label: 'Circonférence du mollet, maximale', unit: 'mm', min: 240, max: 520, step: 1 }, { k: 'cLegMid', label: 'Circonférence de la jambe, milieu', unit: 'mm', min: 200, max: 440, step: 1 },
    { k: 'cSupraAnkle', label: 'Circonférence 5 cm au-dessus des malléoles', unit: 'mm', min: 150, max: 340, step: 1 }, { k: 'cAnkle', label: 'Circonférence de la cheville (malléoles)', unit: 'mm', min: 180, max: 380, step: 1 },
    { k: 'ankleW', label: 'Largeur de la cheville (malléoles)', unit: 'mm', min: 50, max: 100, step: 1 }, { k: 'kneeFlex', label: 'Flexion du genou', unit: '°', min: 0, max: 40, step: 1 }
  ]
};
const ORTH_TYPES = {
  osup: {
    attelle_poignet: { label: 'Attelle de poignet volaire', desc: 'Palmaire : paume et face antérieure de l\'avant-bras, pouce libre.' },
    repos_main: { label: 'Attelle de repos main-poignet', desc: 'Palme, doigts et avant-bras en position de repos.' },
    avant_bras: { label: 'Attelle d\'avant-bras bivalve', desc: 'Coque circonférentielle de l\'avant-bras, fente de fermeture médiale.' },
    coude: { label: 'Orthèse de coude postérieure', desc: 'Gouttière postérieure bras / avant-bras.' },
    libre: { label: 'Dessin libre', desc: 'Zones peintes à la main.' }
  },
  oinf: {
    afo_post: { label: 'Orthèse cheville-pied (AFO) à lame postérieure', desc: 'Lame postérieure de jambe + semelle plantaire.' },
    afo_coque: { label: 'AFO coque jambière + semelle', desc: 'Coque de jambe ouverte en avant avec semelle.' },
    genou: { label: 'Orthèse de genou (cuisse–jambe)', desc: 'Coque postéro-latérale genou, fenêtre rotulienne.' },
    afo_art: { label: 'AFO articulée (coque jambière + semelle + charnières de cheville)', desc: 'Coque jambière et semelle plantaire reliées par des charnières malléolaires avec butées.' },
    genou_art: { label: 'Orthèse de genou articulée (charnières latérale et médiale)', desc: 'Coque postéro-latérale cuisse–jambe avec articulations de genou.' },
    ucbl: { label: 'Orthèse plantaire à coque talonnière (type UCBL)', desc: 'Semelle et coque talonnière haute (contention du calcanéus, voûte soutenue).' },
    plantaire: { label: 'Semelle orthopédique plantaire (thermoformée)', desc: 'Surface plantaire avec petits rebords ; charges (voûte, pelote) et décharges au choix.' },
    stirrup: { label: 'Orthèse de cheville bimalléolaire (étrier)', desc: 'Deux valves latérale et médiale englobant les malléoles, talon libre.' },
    botte: { label: 'Botte de décharge / immobilisation cheville-pied', desc: 'Coque enveloppante jambe + pied, ouverture dorsale et antérieure.' },
    jambiere: { label: 'Orthèse jambière bivalve', desc: 'Coque circonférentielle de la jambe, fente de fermeture antérieure.' },
    libre: { label: 'Dessin libre', desc: 'Zones peintes à la main.' }
  }
};

/* catalogue des zones de charge / décharge prédéfinies : repère, type (relief = décharge, load = charge), intensité (mm) et rayons de la zone (x, y, z) */
const ORTH_ZONES = {
  oinf: [
    { id: 'r_mal_lat', lm: 'malleole_lat', label: 'Décharge malléole latérale', kind: 'relief', mm: 3, r: [22, 26, 22] },
    { id: 'r_mal_med', lm: 'malleole_med', label: 'Décharge malléole médiale', kind: 'relief', mm: 3, r: [22, 26, 22] },
    { id: 'r_fibula', lm: 'tete_fibula', label: 'Décharge tête de la fibula (nerf fibulaire)', kind: 'relief', mm: 4, r: [18, 22, 18] },
    { id: 'r_crete', lm: 'crete_tibiale', label: 'Décharge crête tibiale', kind: 'relief', mm: 2.5, r: [16, 90, 18] },
    { id: 'r_tubero', lm: 'tuberosite', label: 'Décharge tubérosité tibiale', kind: 'relief', mm: 2.5, r: [18, 22, 18] },
    { id: 'r_patella', lm: 'patella', label: 'Décharge rotule', kind: 'relief', mm: 3, r: [28, 30, 26] },
    { id: 'r_cond_lat', lm: 'condyle_lat', label: 'Décharge condyle latéral', kind: 'relief', mm: 2.5, r: [20, 24, 20] },
    { id: 'r_cond_med', lm: 'condyle_med', label: 'Décharge condyle médial', kind: 'relief', mm: 2.5, r: [20, 24, 20] },
    { id: 'r_poplite', lm: 'creux_popliteal', label: 'Décharge creux poplité', kind: 'relief', mm: 3, r: [32, 30, 26] },
    { id: 'r_achille', lm: 'achille', label: 'Décharge tendon d\'Achille', kind: 'relief', mm: 2.5, r: [14, 55, 14] },
    { id: 'r_talon', lm: 'talon', label: 'Décharge talon (épine calcanéenne)', kind: 'relief', mm: 3, r: [26, 18, 26] },
    { id: 'r_navic', lm: 'naviculaire', label: 'Décharge tubérosité du naviculaire', kind: 'relief', mm: 3, r: [18, 18, 18] },
    { id: 'r_base5', lm: 'base_5mt', label: 'Décharge base du 5e métatarsien', kind: 'relief', mm: 3, r: [18, 18, 18] },
    { id: 'r_head1', lm: 'tete_1mt', label: 'Décharge tête du 1er métatarsien', kind: 'relief', mm: 2.5, r: [18, 16, 18] },
    { id: 'r_head5', lm: 'tete_5mt', label: 'Décharge tête du 5e métatarsien', kind: 'relief', mm: 2.5, r: [16, 16, 16] },
    { id: 'r_dos', lm: 'dos_pied', label: 'Décharge dos du pied', kind: 'relief', mm: 2, r: [28, 24, 32] },
    { id: 'l_voute', lm: 'voute', label: 'Charge : soutien de la voûte longitudinale médiale', kind: 'load', mm: 4, r: [28, 18, 50] },
    { id: 'l_retro', lm: 'retrocap', label: 'Charge : pelote / barre rétro-capitale', kind: 'load', mm: 3, r: [52, 14, 16] },
    { id: 'l_talon', lm: 'talon', label: 'Charge : contention du talon (calcanéus)', kind: 'load', mm: 2, r: [30, 22, 28] },
    { id: 'l_gastro', lm: 'gastrocnemien', label: 'Charge : appui postérieur du mollet (3 points)', kind: 'load', mm: 2.5, r: [42, 60, 32] },
    { id: 'l_tibia', lm: 'crete_tibiale', label: 'Charge : appui antérieur de la jambe (3 points)', kind: 'load', mm: 2, r: [30, 55, 22] }
  ],
  osup: [
    { id: 'r_olec', lm: 'olecrane', label: 'Décharge olécrâne', kind: 'relief', mm: 3, r: [22, 28, 22] },
    { id: 'r_epi_lat', lm: 'epicondyle_lat', label: 'Décharge épicondyle latéral', kind: 'relief', mm: 2.5, r: [18, 22, 18] },
    { id: 'r_epi_med', lm: 'epicondyle_med', label: 'Décharge épicondyle médial (épitrochlée)', kind: 'relief', mm: 2.5, r: [18, 22, 18] },
    { id: 'r_sty_ul', lm: 'styloide_ulna', label: 'Décharge styloïde ulnaire', kind: 'relief', mm: 3, r: [16, 22, 16] },
    { id: 'r_sty_ra', lm: 'styloide_rad', label: 'Décharge styloïde radiale', kind: 'relief', mm: 2.5, r: [16, 22, 16] },
    { id: 'r_pisi', lm: 'pisiforme', label: 'Décharge pisiforme', kind: 'relief', mm: 2.5, r: [14, 16, 14] },
    { id: 'r_mcp', lm: 'mcp', label: 'Décharge têtes métacarpiennes', kind: 'relief', mm: 2, r: [48, 14, 16] },
    { id: 'l_arche', lm: 'arche_palmaire', label: 'Charge : soutien de l\'arche palmaire transversale', kind: 'load', mm: 3, r: [42, 14, 18] },
    { id: 'l_thenar', lm: 'thenar', label: 'Charge : appui thénar (opposition du pouce)', kind: 'load', mm: 2, r: [20, 24, 20] }
  ]
};
function orthDefaults(fam) {
  const sup = {
    lenArm: 300, lenFore: 250, lenHand: 190, palmW: 85, palmT: 30, cAxilla: 330, cBiceps: 295, cAboveElbow: 262, cElbow: 275, elbowW: 66, cForeMax: 262, cForeMid: 222, cWristAbove: 168, cWrist: 172, wristW: 58, wristAP: 40, elbowFlex: 0, fingerCurl: 10, thumbAbd: 30,
    firmness: 3, edema: 'non', skin: 'intacte', spasticity: 'non', pain: 0, scars: ''
  };
  const inf = {
    lenThigh: 420, lenLeg: 400, ankleH: 70, footLen: 255, footW: 100, archH: 22, heelW: 62, instepH: 64, cBall: 245, cFig8: 330, halluxL: 62, halluxAng: 5, toeOut: 8, ankleDF: 0, hindfoot: 0, cThighProx: 560, cThighMid: 500, cAboveKnee: 430, cKnee: 380, kneeW: 100, cBelowKnee: 360, cCalfMax: 370, cLegMid: 305, cSupraAnkle: 222, cAnkle: 250, ankleW: 72, kneeFlex: 0,
    firmness: 3, edema: 'non', skin: 'intacte', spasticity: 'non', pain: 0, scars: ''
  };
  return fam === 'osup' ? sup : inf;
}
const ORTH_CLIN = [
  { k: 'firmness', label: 'Fermeté des tissus (1 mou – 5 ferme)', type: 'range', min: 1, max: 5, step: 1 },
  { k: 'edema', label: 'Œdème', type: 'select', opts: [['non', 'Non'], ['leger', 'Léger'], ['marque', 'Marqué / fluctuant']] },
  { k: 'skin', label: 'État cutané', type: 'select', opts: [['intacte', 'Intacte'], ['fragile', 'Fragile'], ['lesion', 'Lésion / plaie'], ['irritee', 'Irritée / rougeur']] },
  { k: 'spasticity', label: 'Spasticité / raideur', type: 'select', opts: [['non', 'Non'], ['legere', 'Légère'], ['moderee', 'Modérée'], ['severe', 'Sévère']] },
  { k: 'pain', label: 'Douleur (0–10)', type: 'range', min: 0, max: 10, step: 1 },
  { k: 'scars', label: 'Cicatrices / zones sensibles (localisation)', type: 'text' }
];
ENGINES.osup = { id: 'osup', orth: true, label: 'Orthèse du membre supérieur', short: 'OS', limb: false, unitNote: 'Y = axe du membre (proximal +, main en bas), Z = antérieur (paume), X = latéral. Saisissez les mesures du patient : le bras en 3D se met automatiquement à sa taille.',
  fields: ORTH_FIELDS.osup, clinical: ORTH_CLIN, defaults: () => orthDefaults('osup'), landmarkDefs: OSUP_LM, types: ORTH_TYPES.osup, warnings(m) { const w = []; if (m.cWrist < m.cWristAbove * .85) w.push('Circonférence du poignet très inférieure à celle sus-jacente : vérifiez les mesures.'); if (m.cElbow < m.cAboveElbow * .85) w.push('Circonférence du coude inférieure à celle du bras : vérifiez.'); return w; }, buildSec: buildSecSup };
ENGINES.oinf = { id: 'oinf', orth: true, label: 'Orthèse du membre inférieur', short: 'OI', limb: false, unitNote: 'Y = axe du membre (proximal +, pied au sol), Z = antérieur, X = latéral. Saisissez les mesures du patient : la jambe en 3D se met automatiquement à sa taille.',
  fields: ORTH_FIELDS.oinf, clinical: ORTH_CLIN, defaults: () => orthDefaults('oinf'), landmarkDefs: OINF_LM, types: ORTH_TYPES.oinf, warnings(m) { const w = []; if (m.cAnkle < m.cSupraAnkle) w.push('Circonférence de la cheville inférieure à la sus-malléolaire : vérifiez.'); if (m.cCalfMax < m.cLegMid) w.push('Mollet maximal inférieur au milieu de jambe : vérifiez.'); return w; }, buildSec: buildSecInf };
