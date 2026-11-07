/* JophyOrtho 3D — 09 : pipeline de l'appareil (repères, rectification, doublure, coque, ouvertures).
   Chaque étape produit un objet NOUVEAU ; l'anatomie (scan ou reconstruction) n'est jamais modifiée. */
'use strict';
function defaultDev(famId, typeId) {
  const eng = ENGINES[famId], t = eng.types[typeId];
  return {
    type: typeId, mix: .5, redPct: t.red, zones: [], suspension: t.susp ? t.susp[0] : '',
    trim: Object.assign({}, t.trim, { smooth: 2, flare: t.flare, fillet: 2 }), trimB: Object.assign({ ant: 0, post: 0, D: 0, G: 0 }, t.trimB || {}),
    liner: { on: famId !== 'trunk', material: 'silicone', shore: 35, tGen: 3, tProx: 4, tDist: 6, pocket: 0, reinf: 0, vent: 0, texture: 'lisse', extra: 8 },
    shell: { material: 'composite', gap: 1.5, tGen: 4, tProx: 3, tDist: 5, lattice: 0, reinf: [] },
    openings: [], conn: { type: 'aucun', ap: 0, ml: 0, h: 35, ins: 10, rot: 0, tilt: 0, tiltAb: 0, plateR: 32, size: 1, material: 'alu' },
    align: { flex: 0, abd: 0, rot: 0, ap: 0, ml: 0 },
    trunk: { axExt: 0, trochExt: 0, ribRelief: 0, straps: 3, pads: true }
  };
}
/* mesures « effectives » : en mode scan on déduit des proportions du scan ce qui manque */
function effMeasures(P, sec) {
  const eng = ENGINES[P.family], m = JSON.parse(JSON.stringify(P.measures[P.family]));
  if (P.acq.mode !== 'measures' && sec) {
    const H = sec.y1 - sec.y0;
    if (!(P.measuresTouched)) {
      if (P.family === 'tt') { m.lenPT = Math.round(H * 0.8); m.condH = Math.round(H * 0.1); }
      else if (P.family === 'tf') m.lenPer = Math.round(H * 0.92);
      else m.H = Math.round(H);
    }
  }
  return P.family === 'trunk' ? m : normRows(m, P.family === 'tt' ? m.lenPT : m.lenPer);
}
function lmLength(P, m) { return P.family === 'tt' ? m.lenPT : P.family === 'tf' ? m.lenPer : m.H; }
function resolveLandmarks(P, m, sec) {
  const eng = ENGINES[P.family], L = lmLength(P, m), out = {}, y0 = sec.y0;
  eng.landmarkDefs.forEach(d => {
    const st = P.landmarks[d.id];
    if (st && st.pos) { out[d.id] = { pos: st.pos, source: st.source || 'manuel', label: d.label }; return; }
    const th = typeof d.th === 'function' ? d.th(m) : d.th, y = y0 + d.y(L, m);
    out[d.id] = { pos: lmAt(sec, clamp(y, sec.y0, sec.y1), th, d.rf), source: P.acq.mode === 'measures' ? 'reconstruction' : 'estimation', label: d.label };
  });
  return out;
}
/* ------------- trimline ------------- */
function dirOffsetArray(eng, vals, A) {
  const degs = eng.trimDirDeg || { ant: 0, lat: 90, post: 180, med: 270 }, keys = eng.trimDirs, out = new Float32Array(A);
  const pts = keys.map(k => [degs[k], vals[k] || 0]).sort((a, b) => a[0] - b[0]);
  for (let j = 0; j < A; j++) {
    const d = j / A * 360; let lo = pts[pts.length - 1], hi = pts[0], l0 = lo[0] - 360, h0 = hi[0];
    for (let k = 0; k < pts.length; k++) if (pts[k][0] <= d) { lo = pts[k]; l0 = lo[0]; hi = pts[(k + 1) % pts.length]; h0 = hi[0] + (k + 1 >= pts.length ? 360 : 0); }
    const t = (d - l0) / ((h0 - l0) || 1); out[j] = lerp(lo[1], hi[1], (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2);
  }
  return out;
}
function smoothCirc(a, n) { for (let p = 0; p < n; p++) { const t = Float32Array.from(a), A = a.length; for (let j = 0; j < A; j++) a[j] = .25 * t[(j + A - 1) % A] + .5 * t[j] + .25 * t[(j + 1) % A]; } return a; }
function trimArrays(P, m, dev, sec, lm) {
  const eng = ENGINES[P.family], A = sec.A, tr = dev.trim, t = eng.types[dev.type];
  let top = dirOffsetArray(eng, tr, A), bot = null;
  if (eng.bothEnds) {
    const H = sec.y1 - sec.y0, tb = dirOffsetArray(eng, dev.trimB, A); bot = new Float32Array(A);
    for (let j = 0; j < A; j++) {
      const th = j / A * 2 * Math.PI, side = Math.max(Math.abs(Math.sin(th)), 0);
      top[j] = sec.y0 + ({ axilla: m.hAxilla, xiph: m.hXiph, crete: m.hCrete }[t.topRef] || .9 * H) + (t.topOff || 0) + top[j] + dev.trunk.axExt * side * (Math.abs(Math.sin(th)) > .5 ? 1 : 0);
      bot[j] = sec.y0 + (t.botOff || 0) + tb[j] - dev.trunk.trochExt * (Math.abs(Math.sin(th)) > .5 ? 1 : 0);
      if (t.asym && m) { /* Charleston : bord supérieur asymétrique côté convexe */ }
      if (t.bending) { const c = ENGINES.trunk.curves(m)[0]; if (c) top[j] += 30 * Math.sin(th) * c.s; }
    }
    smoothCirc(top, tr.smooth); smoothCirc(bot, tr.smooth);
    for (let j = 0; j < A; j++) { top[j] = clamp(top[j], sec.y0 + 30, sec.y1); bot[j] = clamp(bot[j], sec.y0 - 20, top[j] - 30); }
  } else {
    const ref = P.family === 'tt' ? lm.tendon.pos[1] : lm.perinee.pos[1];
    for (let j = 0; j < A; j++) top[j] += ref;
    smoothCirc(top, tr.smooth);
    for (let j = 0; j < A; j++) top[j] = clamp(top[j], sec.y0 + 40, sec.y1);
  }
  return { top, bot };
}
/* ------------- rectification ------------- */
function zoneWeight(z, p) {
  const d = Math.hypot(p[0] - z.pos[0], p[1] - z.pos[1], p[2] - z.pos[2]); if (d >= z.radius) return 0;
  return Math.pow(smooth(1 - d / z.radius), clamp(z.transition || 1, 0.3, 4));
}
function zoneDelta(zones, p) {
  let tot = 0; const act = [];
  for (const z of zones) { if (!z.visible || z.suggested) continue; const w = zoneWeight(z, p); if (w > 0) act.push([z, w]); }
  act.sort((a, b) => (a[0].priority || 1) - (b[0].priority || 1));
  for (const [z, w] of act) { const T = ZONE_TYPES[z.type]; tot += T.sign * T.k * z.value * w; }
  return clamp(tot, -20, 20);
}
function rectifySec(P, m, dev, sec) {
  const eng = ENGINES[P.family], t = eng.types[dev.type], shape = t.shape(m, dev), L = lmLength(P, m) + sec.y0, rs = sec.clone(), A = sec.A;
  const ang = i => i / A * Math.PI * 2;
  for (let i = 0; i < sec.L; i++) {
    const y = sec.ys[i], cx = sec.cx[i], cz = sec.cz[i];
    for (let j = 0; j < A; j++) {
      const r = sec.r[i * A + j]; if (r <= 0.01) continue;
      const th = ang(j), p = [cx + r * Math.sin(th), y, cz + r * Math.cos(th)];
      let d = -(dev.redPct + rowInterp(m.rows, y - sec.y0, 'red')) / 100 * r;                          // réduction globale
      d += shape(y - sec.y0, th, L - sec.y0);                 // règles propres au type
      if (P.family === 'trunk' && dev.trunk.ribRelief) d += dev.trunk.ribRelief * (gAng(th, 20, 30) + gAng(th, 340, 30)) * maskY((y - sec.y0) / (sec.y1 - sec.y0), .5, .75, .08);
      if (P.family === 'trunk' && t.waist) d -= t.waist * gauss((y - sec.y0) / (sec.y1 - sec.y0), .45, .08);
      d += zoneDelta(dev.zones, p);                           // zones utilisateur
      rs.r[i * A + j] = Math.max(0, r + d * (r < 6 ? r / 6 : 1));
    }
  }
  return rs;
}
function zoneVertexColors(mesh, zones, base) {
  const v = mesh.v, n = mesh.nv, c = new Float32Array(n * 3), vis = zones.filter(z => z.visible);
  base = base || [0.80, 0.72, 0.66];
  for (let i = 0; i < n; i++) {
    let cr = base[0], cg = base[1], cb = base[2]; if (mesh.c) { cr = mesh.c[i * 3]; cg = mesh.c[i * 3 + 1]; cb = mesh.c[i * 3 + 2]; } const p = [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    for (const z of vis) { const w = zoneWeight(z, p) * (z.suggested ? .35 : .95); if (w > 0) { const zc = ZONE_TYPES[z.type].color; cr = cr * (1 - w) + zc[0] * w; cg = cg * (1 - w) + zc[1] * w; cb = cb * (1 - w) + zc[2] * w; } }
    c[i * 3] = cr; c[i * 3 + 1] = cg; c[i * 3 + 2] = cb;
  }
  return c;
}
/* ------------- épaisseurs ------------- */
function thickProfile(s, tDist, tGen, tProx) { return s < .3 ? lerp(tDist, tGen, smooth(s / .3)) : s > .7 ? lerp(tGen, tProx, smooth((s - .7) / .3)) : tGen; }
function reinfAdd(list, p) { let a = 0; for (const z of list) { if (!z.visible) continue; a += z.value * smooth(1 - Math.hypot(p[0] - z.pos[0], p[1] - z.pos[1], p[2] - z.pos[2]) / z.radius); } return a; }
function makeGrid(rs, tops, bots, flare, N) {
  const A = rs.A, rings = secRings(rs, {
    N, top: j => tops[j], bottomFn: bots ? (j => bots[j]) : null,
    delta: flare ? ((p, j, y) => flare * smooth((y - (tops[j] - 14)) / 14) + (bots ? flare * smooth(((bots[j] + 14) - y) / 14) : 0)) : null
  });
  const grid = Prim.fromRings(rings, { flip: true }), nor = grid.normals();
  return { rings, nor, A, N };
}
function offsetRings(g, tf) { // tf(p,i,j)->épaisseur ; renvoie nouveaux anneaux
  const out = g.rings.map((ring, i) => ring.map((p, j) => { const k = (i * g.A + j) * 3, t = tf(p, i, j); return [p[0] + g.nor[k] * t, p[1] + g.nor[k + 1] * t, p[2] + g.nor[k + 2] * t]; }));
  return out;
}
function fixPole(rings, which) { const r = rings[which], c = r.reduce((s, p) => V.add(s, p), [0, 0, 0]).map(x => x / r.length); for (let j = 0; j < r.length; j++) rings[which][j] = c.slice(); }
/* Paroi épaisse fermée : surfaces intérieure/extérieure + bords + parois des ouvertures */
function buildWall(rIn, rOut, skip, o) {
  o = o || {}; const N = rIn.length - 1, A = rIn[0].length, v = [], f = [], nIn = (N + 1) * A;
  rIn.forEach(r => r.forEach(p => v.push(p[0], p[1], p[2]))); rOut.forEach(r => r.forEach(p => v.push(p[0], p[1], p[2])));
  const I = (i, j) => i * A + ((j % A) + A) % A, O = (i, j) => nIn + I(i, j), P3 = k => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]];
  const sk = (i, j) => (i < 0 || i >= N) ? null : !!(skip && skip(i, ((j % A) + A) % A));
  const quad = (a, b, c, d, hint) => { // (a,b,c),(b,d,c) orientés selon hint
    const pa = P3(a), pb = P3(b), pc = P3(c), n = V.cross(V.sub(pb, pa), V.sub(pc, pa));
    if (V.dot(n, hint) >= 0) f.push(a, b, c, b, d, c); else f.push(a, c, b, b, c, d);
  };
  const ctr = (i, j) => V.mul(V.add(V.add(P3(O(i, j)), P3(O(i + 1, j + 1))), V.add(P3(O(i, j + 1)), P3(O(i + 1, j)))), .25);
  for (let i = 0; i < N; i++) for (let j = 0; j < A; j++) {
    if (sk(i, j)) continue; const a = I(i, j), b = I(i, j + 1), c = I(i + 1, j), d = I(i + 1, j + 1);
    f.push(a, b, c, b, d, c);                                   // extérieur (normale vers l'extérieur) — pour la face interne : sens inverse
  }
  // NB : rIn = surface « support » orientée vers l'extérieur ; la paroi utilise rIn comme face interne (normales inversées) et rOut comme face externe
  const f2 = []; for (let k = 0; k < f.length; k += 3) f2.push(f[k] + nIn, f[k + 1] + nIn, f[k + 2] + nIn);
  const fin = []; for (let k = 0; k < f.length; k += 3) fin.push(f[k], f[k + 2], f[k + 1]);
  f.length = 0; f.push(...fin, ...f2);
  // bords haut / bas (anneaux libres)
  const topRim = !o.noTop, botRim = !!o.bothEnds;
  for (let j = 0; j < A; j++) {
    if (topRim && !sk(N - 1, j)) quad(I(N, j), I(N, j + 1), O(N, j), O(N, j + 1), [0, 1, 0]);
    if (botRim && !sk(0, j)) quad(I(0, j), I(0, j + 1), O(0, j), O(0, j + 1), [0, -1, 0]);
  }
  // parois de découpe
  if (skip) for (let i = 0; i < N; i++) for (let j = 0; j < A; j++) {
    if (sk(i, j)) continue;
    const nb = [[i, j - 1, [[i, j], [i + 1, j]]], [i, j + 1, [[i, j + 1], [i + 1, j + 1]]], [i - 1, j, [[i, j], [i, j + 1]]], [i + 1, j, [[i + 1, j], [i + 1, j + 1]]]];
    for (const [ni, nj, e] of nb) { if (sk(ni, nj) !== true) continue; const hint = V.sub(ctr(ni, nj), ctr(i, j)); quad(I(e[0][0], e[0][1]), I(e[1][0], e[1][1]), O(e[0][0], e[0][1]), O(e[1][0], e[1][1]), hint); }
  }
  return new Mesh(new Float32Array(v), new Uint32Array(f));
}
/* ------------- ouvertures / fenêtres / ventilation → prédicat de quads supprimés ------------- */
function openingSkip(P, m, dev, sec, tops, bots, N) {
  const A = sec.A, ops = dev.openings.filter(o => o.on !== false), lat = dev.shell.lattice;
  return (i, j) => {
    const th = (j + .5) / A * 360, s = (i + .5) / N, yb = bots ? bots[j] : sec.y0, y = yb + (tops[j] - yb) * s;
    for (const o of ops) {
      if (o.kind === 'fenetre') {
        const dth = Math.abs(angDiff(rad(th), rad(o.th))) * (sec.rAt(y, j) + 1), dy = y - (sec.y0 + o.y);
        if ((dth / o.w) ** 2 + (dy / o.h) ** 2 <= 1) return true;
      } else { // fentes : ouverture avant/arrière/latérale, bivalve (D+G)
        const centers = o.kind === 'bivalve' ? [90, 270] : [o.th]; const y0 = sec.y0 + (o.yFrom != null ? o.yFrom : 0);
        for (const c of centers) { const r = sec.rAt(y, j) + 1; if (Math.abs(angDiff(rad(th), rad(c))) * r <= o.w / 2 && y >= y0) return true; }
      }
    }
    if (lat > 0) { const k = Math.max(2, Math.round(10 - lat / 12)); if (s > .12 && s < .9 && ((i % k) < 1) && (((j + ((i / k | 0) % 2) * (k >> 1)) % k) < 1 + (lat > 50 ? 1 : 0))) return true; }
    return false;
  };
}
