/* JophyOrtho 3D — 11b : construction des orthèses de membres (couverture peinte → coque épaisse, doublure, sangles). */
'use strict';
/* topologie soudée : identifiants de sommets fusionnés, voisinage des triangles par arête */
function orthTopo(mesh) {
  const nv = mesh.nv, nt = mesh.nt, q = 200, map = new Map(), wid = new Int32Array(nv), wp = [];
  for (let i = 0; i < nv; i++) { const k = Math.round(mesh.v[i * 3] * q) + '_' + Math.round(mesh.v[i * 3 + 1] * q) + '_' + Math.round(mesh.v[i * 3 + 2] * q); let id = map.get(k); if (id === undefined) { id = wp.length / 3; map.set(k, id); wp.push(mesh.v[i * 3], mesh.v[i * 3 + 1], mesh.v[i * 3 + 2]); } wid[i] = id; }
  const tw = new Int32Array(nt * 3); for (let i = 0; i < nt * 3; i++) tw[i] = wid[mesh.f[i]];
  const nb = new Int32Array(nt * 3).fill(-1), em = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = tw[t * 3 + k], b = tw[t * 3 + (k + 1) % 3]; if (a === b) continue; const key = a < b ? a * 4294967296 + b : b * 4294967296 + a, o = em.get(key); if (o === undefined) em.set(key, t * 3 + k); else { nb[t * 3 + k] = (o / 3) | 0; nb[o] = t; } }
  return { nw: wp.length / 3, wp: Float32Array.from(wp), tw, nb, nt };
}
function orthSign(mesh) { let s = 0; const v = mesh.v, f = mesh.f; for (let i = 0; i < f.length; i += 3) { const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3; s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]); } return s >= 0 ? 1 : -1; }
function orthNormals(mesh, T, sg) {
  const n = new Float32Array(T.nw * 3), wp = T.wp;
  for (let t = 0; t < T.nt; t++) { const a = T.tw[t * 3] * 3, b = T.tw[t * 3 + 1] * 3, c = T.tw[t * 3 + 2] * 3, ux = wp[b] - wp[a], uy = wp[b + 1] - wp[a + 1], uz = wp[b + 2] - wp[a + 2], vx = wp[c] - wp[a], vy = wp[c + 1] - wp[a + 1], vz = wp[c + 2] - wp[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; } }
  for (let i = 0; i < T.nw; i++) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1; n[i * 3] *= sg / l; n[i * 3 + 1] *= sg / l; n[i * 3 + 2] *= sg / l; }
  return n;
}
/* nettoyage de la zone peinte : filtre majoritaire + suppression des îlots */
function orthClean(mask, T, passes) {
  let m = Uint8Array.from(mask);
  for (let p = 0; p < passes; p++) { const o = new Uint8Array(m.length); for (let t = 0; t < T.nt; t++) { let c = 0, k = 0; for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if (q >= 0) { k++; c += m[q]; } } o[t] = m[t] ? (c >= 1 || k === 0 ? 1 : 0) : (c >= 2 ? 1 : 0); } m = o; }
  const seen = new Uint8Array(m.length), st = [];
  for (let t0 = 0; t0 < m.length; t0++) if (m[t0] && !seen[t0]) { const comp = [t0]; seen[t0] = 1; st.push(t0); while (st.length) { const t = st.pop(); for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if (q >= 0 && m[q] && !seen[q]) { seen[q] = 1; comp.push(q); st.push(q); } } } if (comp.length < 40) comp.forEach(t => m[t] = 0); }
  return orthDePinch(m, T);
}
/* supprime les points de pincement (sommets touchés par plusieurs contours) qui rendraient la coque non-manifold */
function orthDePinch(m, T) {
  for (let it = 0; it < 4; it++) {
    const deg = new Uint8Array(T.nw); let bad = 0;
    for (let t = 0; t < T.nt; t++) if (m[t]) for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if (q < 0 || !m[q]) { deg[T.tw[t * 3 + e]]++; deg[T.tw[t * 3 + (e + 1) % 3]]++; } }
    for (let t = 0; t < T.nt; t++) if (m[t]) { let rm = false; for (let k = 0; k < 3 && !rm; k++) if (deg[T.tw[t * 3 + k]] > 2) { for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if ((q < 0 || !m[q]) && (e === k || (e + 1) % 3 === k)) rm = true; } } if (rm) { m[t] = 0; bad++; } }
    if (!bad) break;
  }
  return m;
}
function orthErode(mask, T, k) { let m = Uint8Array.from(mask); for (let s = 0; s < k; s++) { const o = Uint8Array.from(m); for (let t = 0; t < T.nt; t++) if (m[t]) for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if (q < 0 || !m[q]) { o[t] = 0; break; } } m = o; } return m; }
/* patch épaissi : surface décalée de off0 à off1 le long des normales, bord relié par des parois */
function orthPatch(mesh, T, nrm, mask, off0, off1, rimIt, dw) {
  const used = new Int32Array(T.nw).fill(-1); let nu = 0;
  for (let t = 0; t < T.nt; t++) if (mask[t]) for (let k = 0; k < 3; k++) { const w = T.tw[t * 3 + k]; if (used[w] < 0) used[w] = nu++; }
  if (!nu) return null;
  const P0 = new Float32Array(nu * 3), P1 = new Float32Array(nu * 3), wv = new Int32Array(nu);
  for (let w = 0; w < T.nw; w++) if (used[w] >= 0) { const u = used[w], dd = dw ? Math.max(-(off0 + 2.5), dw[w]) : 0; wv[u] = w; for (let k = 0; k < 3; k++) { P0[u * 3 + k] = T.wp[w * 3 + k] + nrm[w * 3 + k] * (off0 + dd); P1[u * 3 + k] = T.wp[w * 3 + k] + nrm[w * 3 + k] * (off1 + dd); } }
  // arêtes de bord (orientées comme dans le triangle)
  const bnd = []; for (let t = 0; t < T.nt; t++) if (mask[t]) for (let e = 0; e < 3; e++) { const q = T.nb[t * 3 + e]; if (q < 0 || !mask[q]) bnd.push([used[T.tw[t * 3 + e]], used[T.tw[t * 3 + (e + 1) % 3]]]); }
  if (rimIt) { // lissage du contour (même déplacement sur les deux faces)
    const adj = new Map(); bnd.forEach(([a, b]) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
    for (let it = 0; it < rimIt; it++) { const d = new Map(); adj.forEach((ns, a) => { if (ns.length !== 2) return; const dv = [0, 0, 0]; for (let k = 0; k < 3; k++) dv[k] = ((P0[ns[0] * 3 + k] + P0[ns[1] * 3 + k]) / 2 - P0[a * 3 + k]) * .5; d.set(a, dv); }); d.forEach((dv, a) => { for (let k = 0; k < 3; k++) { P0[a * 3 + k] += dv[k]; P1[a * 3 + k] += dv[k]; } }); }
  }
  const nt = mask.reduce((s, x) => s + x, 0), v = new Float32Array(nu * 6); v.set(P1, 0); v.set(P0, nu * 3);   // [0,nu) = surface extérieure ; [nu,2nu) = surface intérieure
  const f = []; for (let t = 0; t < T.nt; t++) if (mask[t]) { const a = used[T.tw[t * 3]], b = used[T.tw[t * 3 + 1]], c = used[T.tw[t * 3 + 2]]; f.push(a, b, c, nu + a, nu + c, nu + b); }
  bnd.forEach(([a, b]) => { f.push(b, a, nu + a, b, nu + a, nu + b); });
  const shell = new Mesh(v, new Uint32Array(f)).touch();
  const outerF = [], innerF = []; for (let i = 0; i < f.length; i += 6 * 1) { /* séparation inutile : construite à part */ }
  const oF = [], iF = []; for (let t = 0; t < T.nt; t++) if (mask[t]) { const a = used[T.tw[t * 3]], b = used[T.tw[t * 3 + 1]], c = used[T.tw[t * 3 + 2]]; oF.push(a, b, c); iF.push(nu + a, nu + c, nu + b); }
  return { shell, outer: new Mesh(v, new Uint32Array(oF)).touch(), inner: new Mesh(v, new Uint32Array(iF)).touch(), nu, nt };
}
/* aération : retire des triangles selon un motif de trous (rangées décalées) dans la zone interne */
function orthVent(mask, T, mesh, sec, vent, y0, y1) {
  const inner = orthErode(mask, T, Math.max(1, Math.round(vent.margin / 3.5))), o = Uint8Array.from(mask), s = vent.s, rs = s * .866, r2 = vent.r * vent.r;
  for (let t = 0; t < T.nt; t++) if (inner[t]) {
    const a = T.tw[t * 3] * 3, b = T.tw[t * 3 + 1] * 3, c = T.tw[t * 3 + 2] * 3, x = (T.wp[a] + T.wp[b] + T.wp[c]) / 3, y = (T.wp[a + 1] + T.wp[b + 1] + T.wp[c + 1]) / 3, z = (T.wp[a + 2] + T.wp[b + 2] + T.wp[c + 2]) / 3;
    if (y < y0 || y > y1) continue; const row = Math.round((y - y0) / rs), yr = y0 + row * rs, cc = sec.cAt(y), Rr = Math.max(15, sec.perimeterAt(clamp(yr, sec.y0, sec.y1)) / (2 * Math.PI)), N = Math.max(4, Math.floor(2 * Math.PI * Rr / s)), step = 2 * Math.PI / N, th = Math.atan2(x - cc[0], z - cc[1]), off = (row & 1) * .5, col = Math.round(th / step - off), thc = (col + off) * step, d = Rr * angDiff(th, thc);
    if ((y - yr) * (y - yr) + d * d < r2) o[t] = 0;
  }
  return o;
}
/* ---------- charges / décharges : champ de déplacement local de la surface interne (mm le long de la normale) ---------- */
function orthLoadField(dev, lmList, anat, T, mk) {
  const loads = (dev.loads || []).filter(z => !z.off); if (!loads.length) return null;
  const dw = new Float32Array(T.nw), wp = T.wp, info = []; let eA = null, eB = null;
  const edges = () => { if (eA) return; const a = [], b = []; for (let t = 0; t < T.nt; t++) for (let e = 0; e < 3; e++) { const p = T.tw[t * 3 + e], q = T.tw[t * 3 + (e + 1) % 3]; if (p < q) { a.push(p); b.push(q); } } eA = Int32Array.from(a); eB = Int32Array.from(b); };
  const vin = new Uint8Array(T.nw); if (mk) for (let t = 0; t < T.nt; t++) if (mk[t]) for (let k = 0; k < 3; k++) vin[T.tw[t * 3 + k]] = 1;
  loads.forEach(z => {
    const mm = (z.kind === 'load' ? -1 : 1) * z.mm; let wv = null;
    if (z.src === 'lm') {
      const lm = lmList.find(l => l.id === z.lm); if (!lm) { info.push({ z, missing: true }); return; }
      const sc = z.scale || 1, R = z.r.map(x => x * sc); wv = new Float32Array(T.nw);
      for (let w = 0; w < T.nw; w++) { const dx = (wp[w * 3] - lm.pos[0]) / R[0], dy = (wp[w * 3 + 1] - lm.pos[1]) / R[1], dz = (wp[w * 3 + 2] - lm.pos[2]) / R[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < 1) wv[w] = .5 * (1 + Math.cos(Math.PI * Math.sqrt(d2))); }
    } else if (z.rle && z.nt === anat.nt) {
      const pm = rleDec(z.rle, z.nt), cnt = new Float32Array(T.nw), tot = new Float32Array(T.nw); wv = new Float32Array(T.nw); edges();
      for (let t = 0; t < T.nt; t++) for (let k = 0; k < 3; k++) { const w = T.tw[t * 3 + k]; tot[w]++; if (pm[t]) cnt[w]++; }
      for (let w = 0; w < T.nw; w++) wv[w] = tot[w] ? cnt[w] / tot[w] : 0;
      for (let it = 0; it < 4; it++) { const sm = Float32Array.from(wv), c = new Float32Array(T.nw).fill(1); for (let e = 0; e < eA.length; e++) { sm[eA[e]] += wv[eB[e]]; sm[eB[e]] += wv[eA[e]]; c[eA[e]]++; c[eB[e]]++; } for (let w = 0; w < T.nw; w++) wv[w] = sm[w] / c[w]; }
    }
    if (!wv) return; let cov = 0; for (let w = 0; w < T.nw; w++) { dw[w] += mm * wv[w]; if (wv[w] > .3 && vin[w]) cov++; } info.push({ z, cov });
  });
  for (let w = 0; w < T.nw; w++) dw[w] = clamp(dw[w], -10, 14);
  dw.info = info; return dw;
}
/* ---------- articulations mécaniques (charnières) : disque d'axe + montants ---------- */
const ORTH_JOINTS = {
  oinf: { cheville: { label: 'cheville', lat: 'malleole_lat', med: 'malleole_med', up: 110, dn: 45, a: 'Butée de flexion dorsale (°)', b: 'Butée de flexion plantaire (°)' }, genou: { label: 'genou', lat: 'condyle_lat', med: 'condyle_med', up: 120, dn: 120, a: 'Butée de flexion (°)', b: 'Butée d\'extension (°)' } },
  osup: { coude: { label: 'coude', lat: 'epicondyle_lat', med: 'epicondyle_med', up: 100, dn: 100, a: 'Butée de flexion (°)', b: 'Butée d\'extension (°)' }, poignet: { label: 'poignet', lat: 'styloide_rad', med: 'styloide_ulna', up: 70, dn: 35, a: 'Butée d\'extension (°)', b: 'Butée de flexion (°)' } }
};
function cylMesh(c, ax, r, h, A) {
  A = A || 24; const u = [0, 1, 0], vv = V.norm(V.cross(ax, u)), rings = [];
  [-h / 2, h / 2].forEach(t => { const ring = []; for (let j = 0; j < A; j++) { const a = j / A * Math.PI * 2; ring.push(V.add(V.add(c, V.mul(ax, t)), V.add(V.mul(u, Math.cos(a) * r), V.mul(vv, Math.sin(a) * r)))); } rings.push(ring); });
  let mm = Prim.fromRings(rings, { capStart: true, capEnd: true }); if (mm.volume() < 0) mm = Prim.fromRings(rings, { capStart: true, capEnd: true, flip: true }); return mm;
}
function orthHinges(P, out, sec, dev) {
  const h = dev.hinge, fam = P.family, J = h && h.on && ORTH_JOINTS[fam][h.joint]; if (!J) return [];
  const res = [], base = (dev.pad || 0) + (dev.gap || 0) + (dev.thick || 3), side = h.side || 'both';
  [['lat', 'latérale'], ['med', 'médiale']].forEach(([k, nm]) => {
    if (side !== 'both' && side !== k) return; const lm = out.landmarkList.find(l => l.id === J[k]); if (!lm) { out.warnings.push('Articulation ' + nm + ' : repère « ' + J[k] + ' » absent (placez-le ou utilisez les mesures).'); return; }
    const y0 = clamp(lm.pos[1], sec.y0, sec.y1), cc = sec.cAt(y0), dir = V.norm([lm.pos[0] - cc[0], 0, lm.pos[2] - cc[1]]), th = ((Math.atan2(dir[0], dir[2]) * 180 / Math.PI) + 360) % 360;
    const rr = (h.bar || 6) / 2, off = base + rr + 1.2, ptsAt = (yy, dd) => { const pts = []; for (let q = 0; q <= 10; q++) { const y = clamp(y0 + dd * q / 10, sec.y0 + 2, sec.y1 - 2), c2 = sec.cAt(y), p = lmAt(sec, y, th, 1), o = V.norm([p[0] - c2[0], 0, p[2] - c2[1]]); pts.push([p[0] + o[0] * off, y, p[2] + o[2] * off]); } return pts; };
    const cen = [lm.pos[0] + dir[0] * (base + 3.2), y0, lm.pos[2] + dir[2] * (base + 3.2)];
    const parts = [cylMesh(cen, dir, (h.d || 18) / 2, 4), sweepTube(ptsAt(y0, J.up * (h.up || J.up) / J.up), Array(11).fill(rr), 10), sweepTube(ptsAt(y0, -(h.dn || J.dn)), Array(11).fill(rr), 10)];
    res.push({ id: 'hinge_' + k, name: 'Articulation ' + nm + ' (' + J.label + ')', mesh: Mesh.merge(parts), color: [.72, .74, .8], schematic: false });
  });
  return res;
}
/* ---------- zones prédéfinies selon le type d'orthèse ---------- */
function orthPreset(P, anat, sec) {
  const fam = P.family, dev = P.dev[fam], m = P.measures[fam], mask = new Uint8Array(anat.nt), v = anat.v, f = anat.f;
  const Y = ORTH_Y[fam === 'osup' ? 'sup' : 'inf'](m), type = dev.type, sg = orthSign(anat);
  for (let t = 0; t < anat.nt; t++) {
    const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3, x = (v[a] + v[b] + v[c]) / 3, y = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, z = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2]; let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx *= sg / nl; ny *= sg / nl; nz *= sg / nl;
    const cc = sec.cAt(clamp(y, sec.y0, sec.y1)); let th = Math.atan2(x - cc[0], z - cc[1]) * 180 / Math.PI; if (th < 0) th += 360; const ant = th < 100 || th > 260 ? 1 : 0;
    const inTh = (a0, a1) => th >= a0 && th <= a1;
    let on = false;
    if (fam === 'osup') {
      const ext = y < Y.yM + 4;
      if (type === 'attelle_poignet') on = !ext && y >= Y.yM + 4 && y <= Y.yW + m.lenFore * .55 && (th <= 100 || th >= 260);
      else if (type === 'repos_main') on = ext ? (nz > .1 && x < m.palmW * .5 + 2) : (y <= Y.yE - 60 && (th <= 120 || th >= 240));
      else if (type === 'avant_bras') on = !ext && y >= Y.yW + 22 && y <= Y.yE - 28 && !(th > 255 && th < 285);
      else if (type === 'coude') on = !ext && y >= Y.yE - 150 && y <= Y.yE + 120 && inTh(100, 260);
    } else {
      const foot = anat.tubeNt != null ? t >= anat.tubeNt : y < Y.yA - 6, legOK = !foot && y >= Y.yA - 6 && ny > -.6, F = m.footLen, zH = -.19 * F, zE = zH + ({ heel: .34, mid: .58, mt: .8, toes: 1.25 }[dev.footExt || 'mt']) * F, wall = dev.wall == null ? 22 : dev.wall, plantar = foot && ny < -.25 && z < zE;
      const side = foot && y < wall && z < Math.min(zE, zH + .62 * F), heelBack = foot && nz < -.35 && z < zH + .3 * F;
      if (type === 'afo_post' || type === 'afo_coque' || type === 'afo_art') on = foot ? (plantar || side || heelBack) : (legOK && y <= Y.yK - 55 && (type === 'afo_post' ? inTh(85, 275) : (th >= 40 && th <= 320)));
      else if (type === 'genou' || type === 'genou_art') on = legOK && y >= Y.yK - 100 && y <= Y.yK + 110 && inTh(70, 290);
      else if (type === 'jambiere') on = legOK && y >= Y.yA + 15 && y <= Y.yK - 35 && !(th < 8 || th > 352);
      else if (type === 'ucbl') on = foot && (plantar || (y < lerp(Math.max(wall, 40), 14, clamp((z - zH) / (.5 * F), 0, 1)) && z < zH + .56 * F));
      else if (type === 'plantaire') on = foot && (plantar || (y < Math.min(wall, 14) && z < zH + .4 * F));
      else if (type === 'stirrup') on = (foot ? (y >= 22 && z < zH + .5 * F && ny > -.5) : (legOK && y <= Y.yA + 120)) && (inTh(50, 130) || inTh(230, 310));
      else if (type === 'botte') on = foot ? (!(ny > .5 && z > zH + .3 * F) && z < zE && !(y > wall + 50 && th > 340)) : (legOK && y <= Y.yK - 55 && !(th < 10 || th > 350));
    }
    mask[t] = on ? 1 : 0;
  }
  return mask;
}
/* ---------- sangles ---------- */
function orthStraps(P, sec, dev, off, rng) {
  const out = []; if (!dev.strapOn || !dev.straps || !dev.straps.length) return out; const A = sec.A;
  dev.straps.forEach((s, i) => {
    const lo = rng ? rng[0] : sec.y0, hi = rng ? rng[1] : sec.y1, yc = lo + clamp(s.pos, 0, 1) * (hi - lo), w = Math.max(8, s.w), t = dev.strapT || 2, rings = [];
    const ringAt = (y, o) => { const r = []; for (let j = 0; j < A; j++) { const p = sec.pointAt(clamp(y, sec.y0, sec.y1), j), c = sec.cAt(clamp(y, sec.y0, sec.y1)), dx = p[0] - c[0], dz = p[2] - c[1], l = Math.hypot(dx, dz) || 1; r.push([p[0] + dx / l * o, p[1], p[2] + dz / l * o]); } return r; };
    rings.push(ringAt(yc - w / 2, off), ringAt(yc - w / 2, off + t), ringAt(yc + w / 2, off + t), ringAt(yc + w / 2, off), ringAt(yc - w / 2, off));
    out.push({ id: 'strap' + i, name: 'Sangle ' + (i + 1), mesh: Prim.fromRings(rings, { flip: true }), color: [.25, .27, .32], schematic: false });
  });
  return out;
}
/* ---------- construction complète ---------- */
function buildOrth(P, ctx) {
  const fam = P.family, eng = ENGINES[fam], dev = P.dev[fam], m = P.measures[fam], out = { warnings: [], family: fam, comps: [], lines: {}, trim: {} };
  let anat, sec, akey;
  if (ctx.scan && ctx.scan.original && P.acq.mode !== 'measures') {
    const sc = prepareScan(P, ctx); if (!sc || sc.error || !sc.cleaned) { out.error = sc && sc.error; return out; }
    if (!sc.sec || sc.secKey !== sc.key + P.acq.smooth) { sc.sec = P.acq.smooth ? smoothSec(extractSections(sc.cleaned, { step: 3 }), P.acq.smooth) : extractSections(sc.cleaned, { step: 3 }); sc.secKey = sc.key + P.acq.smooth; }
    sec = sc.sec; anat = sc.cleaned; out.prov = 'scan'; out.cleaned = sc.cleaned; out.scanStats = sc.stats; akey = 'scan' + sc.key; out.original = anat;
    if (sc.stats && !sc.stats.closed) out.warnings.push(`Scan : maillage ouvert (${sc.stats.open} arêtes libres) : la coque suit tout de même la surface peinte.`);
  } else {
    const key = JSON.stringify(m) + fam; if (!ctx.orthA || ctx.orthKey !== key) { ctx.orthA = orthAnatomy(m, fam); ctx.orthKey = key; ctx.orthShell = null; }
    sec = ctx.orthA.sec; anat = ctx.orthA.mesh; out.prov = 'measures'; akey = key; out.original = anat; out.anatomy = anat;
  }
  CURRENT_SEC = sec; out.sec = sec; out.m = m; out.anatomy = anat;
  // landmarks
  const lms = []; const yfn = fam === 'osup' ? ORTH_Y.sup : ORTH_Y.inf;
  eng.landmarkDefs.forEach(d => { const st = P.landmarks[d.id]; if (st && st.pos) lms.push({ id: d.id, label: d.label, pos: st.pos, source: st.source || 'manuel' }); else if (out.prov === 'measures' && d.foot) { const fp = ctx.orthA && ctx.orthA.footLM && ctx.orthA.footLM[d.id]; if (fp) lms.push({ id: d.id, label: d.label, pos: fp, source: 'reconstruction' }); } else if (out.prov === 'measures') { const y = clamp(d.y(m), sec.y0, sec.y1); lms.push({ id: d.id, label: d.label, pos: lmAt(sec, y, d.th, d.rf), source: 'reconstruction' }); } });
  out.landmarkList = lms;
  // couverture
  let mask = null; if (dev.cover && dev.cover.nt === anat.nt && dev.cover.rle) mask = rleDec(dev.cover.rle, anat.nt);
  out.coverCount = mask ? mask.reduce((s, x) => s + x, 0) : 0;
  const ck = JSON.stringify([akey, dev.cover && dev.cover.rle, dev.gap, dev.thick, dev.pad, dev.vent, dev.rim, dev.clean, dev.loads, P.landmarks]);
  let res = ctx.orthShell && ctx.orthShell.key === ck ? ctx.orthShell : null;
  if (!res) {
    res = { key: ck, shell: null };
    if (mask && out.coverCount) {
      const T = orthTopo(anat), nrm = orthNormals(anat, T, orthSign(anat)); let mk = orthClean(mask, T, dev.clean == null ? 2 : dev.clean);
      if (dev.vent && dev.vent.on) mk = orthDePinch(orthVent(mk, T, anat, sec, dev.vent, sec.y0, sec.y1), T);
      const pad = dev.pad || 0, g = dev.gap || 0, th = dev.thick || 3, rim = dev.rim == null ? 3 : dev.rim;
      const dw = orthLoadField(dev, lms, anat, T, mk); res.dwInfo = dw ? dw.info : null; const sh = orthPatch(anat, T, nrm, mk, pad + g, pad + g + th, rim, dw); if (sh) { res.shell = sh.shell; res.outer = sh.outer; res.inner = sh.inner; }
      if (pad > 0) { const ln = orthPatch(anat, T, nrm, mk, .2, pad + .2, rim, dw); if (ln) res.liner = ln.shell; }
      res.mask = mk; res.closed = res.shell ? analyzeMesh(weldIndexed(res.shell)) : null;
    }
    ctx.orthShell = res;
  }
  out.shell = res.shell; out.liner = res.liner || null; out.innerSurface = res.inner || null; out.outerSurface = res.outer || null; out.rect = null; out.outerEnvelope = null;
  out.shellClosed = res.closed || { closed: true, open: 0, nonManifold: 0 };
  let rng = null; if (res.mask) { let lo = Infinity, hi = -Infinity; for (let t = 0; t < anat.nt; t++) if (res.mask[t]) { const y = (anat.v[anat.f[t * 3] * 3 + 1] + anat.v[anat.f[t * 3 + 1] * 3 + 1] + anat.v[anat.f[t * 3 + 2] * 3 + 1]) / 3; if (y >= sec.y0) { if (y < lo) lo = y; if (y > hi) hi = y; } } if (hi > lo) rng = [lo + 5, hi - 5]; }
  out.comps = orthStraps(P, sec, dev, (dev.pad || 0) + (dev.gap || 0) + (dev.thick || 3) + .4, rng);
  out.comps.push(...orthHinges(P, out, sec, dev));
  if (res.dwInfo) res.dwInfo.forEach(i => { if (i.missing) out.warnings.push('Zone « ' + i.z.label + ' » : repère absent, sans effet.'); else if (i.cov < 3) out.warnings.push('Zone « ' + i.z.label + ' » hors de la coque (non couverte) : sans effet.'); });
  out.warnings.push(...eng.warnings(m));
  if (!out.coverCount) out.warnings.push('Aucune zone couverte : choisissez un type d\'orthèse ou peignez la zone à couvrir.');
  else if (res.shell && !out.shellClosed.closed) out.warnings.push(`Coque : ${out.shellClosed.open} arêtes libres, ${out.shellClosed.nonManifold} non-manifold (zone peinte irrégulière) : lissez ou retouchez la zone.`);
  out.stats = { volShell: res.shell ? Math.round(res.shell.volume() / 1000) : 0, tris: anat.nt + (res.shell ? res.shell.nt : 0), h: Math.round(sec.y1 - sec.y0), volAnat: Math.round(anat.volume() / 1000), volRect: 0, volOuter: 0, volLiner: res.liner ? Math.round(res.liner.volume() / 1000) : 0 };
  return out;
}
function orthDev(fam, type) {
  return { type, zones: [], openings: [], cover: null, presetApplied: '', gap: 1.5, thick: 3, pad: 3, rim: 3, clean: 2, material: 'PETG / polypropylène', vent: { on: false, r: 5, s: 16, margin: 10 }, strapOn: true, strapT: 2, straps: fam === 'osup' ? [{ pos: .3, w: 25 }, { pos: .85, w: 25 }] : [{ pos: .3, w: 28 }, { pos: .8, w: 28 }], align: { flex: 0 }, loads: [], hinge: { on: false, joint: fam === 'osup' ? 'coude' : 'cheville', side: 'both', d: 18, bar: 6, up: fam === 'osup' ? 100 : 110, dn: fam === 'osup' ? 100 : 45, stopA: 10, stopB: 20 }, footExt: 'mt', wall: 22 };
}
