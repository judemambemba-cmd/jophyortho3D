/* JophyOrtho 3D — 11 : construction complète des calques à partir de l'état du dossier */
'use strict';
const PROVENANCE = {
  scan: 'Scan patient importé',
  measures: 'Reconstruction à partir des mesures',
  demo: 'Reconstruction paramétrique à partir des mesures'
};
function provenanceOf(P, ctx) {
  if (ctx.scan && ctx.scan.original && P.acq.mode !== 'measures') return 'scan';
  return P.measuresTouched || ENGINES[P.family].orth ? 'measures' : 'demo';
}
/* ---------- orientation du scan (matrice rigide + échelle ; l'original n'est jamais modifié) ---------- */
function axisVec(s) { const k = { X: 0, Y: 1, Z: 2 }[s[1]], v = [0, 0, 0]; v[k] = s[0] === '-' ? -1 : 1; return v; }
function orientMatrix(o, unit, scale) {
  const up = axisVec(o.up), ant = axisVec(o.ant), lat = axisVec(o.lat), m = M4.ident();
  const ax = new Set([o.up[1], o.ant[1], o.lat[1]]); if (ax.size !== 3) return null;
  const rows = [lat, up, ant]; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[c * 4 + r] = rows[r][c];
  const k = (unit === 'cm' ? 10 : 1) * (scale || 1), S = M4.ident(); S[0] = S[5] = S[10] = k;
  return M4.mul(S, m);
}
function det3(m) { return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]); }
function guessOrientation(mesh) {
  const s = mesh.bounds().size, idx = [0, 1, 2].sort((a, b) => s[b] - s[a]), N = ['X', 'Y', 'Z'];
  return { up: '+' + N[idx[0]], lat: '+' + N[idx[1]], ant: '+' + N[idx[2]] };
}
function prepareScan(P, ctx) {
  const sc = ctx.scan; if (!sc || !sc.original) return null;
  const sig = JSON.stringify([P.acq.orient, P.acq.unit, P.acq.scale]), cuts = (P.acq.cuts || []).filter(c => c.sig === sig);
  const key = JSON.stringify([P.acq.orient, P.acq.unit, P.acq.scale, P.acq.flipNormals, P.acq.repair, sc.original.rev, P.acq.mirror, cuts, P.acq.cutLargest, P.acq.sel && P.acq.sel.done ? [P.acq.sel.all, P.acq.sel.nt, P.acq.sel.rle] : 0]);
  if (sc.key === key) return sc;
  const M = orientMatrix(P.acq.orient, P.acq.unit, P.acq.scale); if (!M) { sc.error = 'Les trois axes doivent être distincts (X, Y, Z).'; return sc; }
  sc.error = null; sc.mirrored = det3(M) < 0;
  let w = sc.original.transformed(M); if (P.acq.flipNormals) w = flipMesh(w);
  { const S = P.acq.sel; if (S && S.done && !S.all && S.rle && S.nt === sc.original.nt) { const km = rleDec(S.rle, S.nt); if (km.some(x => x)) w = subMeshByTri(w, km); } }
  sc.cutLog = []; for (const c of cuts) { w = planeCut(w, c.o, c.n, c.keep, c.fill); const ci = w.cutInfo; if (P.acq.cutLargest !== false) w = keepLargestShell(w); sc.cutLog.push({ info: ci, shells: w.removedShells || 0 }); }
  const b = w.bounds(); sc.shift = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2]; sc.sig = sig; w = w.transformed(M4.translate(sc.shift));
  sc.work = w; sc.cleaned = P.acq.repair ? repairMesh(w) : w; sc.stats = analyzeMesh(w); sc.sec = null; sc.key = key; sc.secKey = null;
  return sc;
}
/* ---------- construction ---------- */
function buildAll(P, ctx) {
  if (ENGINES[P.family].orth) return buildOrth(P, ctx);
  const fam = P.family, eng = ENGINES[fam], dev = P.dev[fam], out = { warnings: [], family: fam };
  const prov = provenanceOf(P, ctx); out.prov = prov;
  let sec, anat, anatColors = null;
  if (prov === 'scan') {
    const sc = prepareScan(P, ctx); if (!sc || sc.error || !sc.cleaned) { out.error = sc && sc.error; return out; }
    if (!sc.sec || sc.secKey !== sc.key + P.acq.smooth) { sc.sec = P.acq.smooth ? smoothSec(extractSections(sc.cleaned, { step: 3 }), P.acq.smooth) : extractSections(sc.cleaned, { step: 3 }); sc.secKey = sc.key + P.acq.smooth; }
    sec = sc.sec; anat = sc.cleaned; out.original = sc.work; out.cleaned = sc.cleaned; out.scanStats = sc.stats;
  } else {
    const key = JSON.stringify(P.measures[fam]) + fam; if (!ctx.paramSec || ctx.paramKey !== key) { ctx.paramSec = eng.buildSec(P.measures[fam]); ctx.paramKey = key; ctx.paramMesh = secToMesh(ctx.paramSec, { N: 90, capStart: !eng.limb, capEnd: true }); }
    sec = ctx.paramSec; anat = ctx.paramMesh;
  }
  CURRENT_SEC = sec;
  const m = effMeasures(P, sec), lm = resolveLandmarks(P, m, sec);
  out.m = m; out.sec = sec; out.lm = lm; out.anatomy = anat;
  const trims = trimArrays(P, m, dev, sec, lm); out.trim = trims;
  const rs = rectifySec(P, m, dev, sec); out.rs = rs;
  out.rect = secToMesh(rs, { N: 90, capStart: !eng.limb, capEnd: true });
  const selZ = (ctx.zoneSel || []).map(q => ({ type: 'selection', pos: q.pos, radius: q.radius, transition: 1, visible: true })); out.anatColors = zoneVertexColors(anat, dev.zones.concat(selZ)); out.rectColors = zoneVertexColors(out.rect, dev.zones.concat(selZ));
  const both = !!eng.bothEnds, N = eng.limb ? 64 : 80, A = sec.A, tdef = eng.types[dev.type];
  const yMin = sec.y0;
  // --- doublure (manchon)
  const L_ = dev.liner, S_ = dev.shell;
  const profT = (s, g) => thickProfile(s, g.tDist, g.tGen, g.tProx);
  let linerThick = () => 0;
  if (L_.on) {
    const topsL = Float32Array.from(trims.top, (t, j) => Math.min(sec.y1, t + L_.extra)); const botsL = trims.bot ? Float32Array.from(trims.bot, (b, j) => b) : null;
    const gL = makeGrid(rs, topsL, botsL, 0, N);
    const tl = (p, i) => { const s = i / N; let t = profT(s, L_) + (L_.pocket && s < .18 ? L_.pocket * (1 - s / .18) : 0); t += reinfAdd(dev.zones.filter(z => z.type === 'protection' && !z.suggested).map(z => ({ pos: z.pos, radius: z.radius, value: z.value * .5 + L_.reinf, visible: z.visible })), p); return t; };
    const outR = offsetRings(gL, tl); if (eng.limb) { fixPole(outR, 0); fixPole(gL.rings, 0); }
    out.liner = buildWall(gL.rings.map(r => r.slice()), outR, null, { bothEnds: both });
    out.linerRings = { gL, outR };
    linerThick = (p, i) => tl(p, i);
  }
  // --- coque : surface interne = surface rectifiée + doublure + jeu fonctionnel
  const tf = trims.top, gS = makeGrid(rs, tf, trims.bot, dev.trim.flare, N);
  const lt = (p, i) => (L_.on ? profT(i / N, L_) + (L_.pocket && i / N < .18 ? L_.pocket * (1 - i / N / .18) : 0) : 0) + S_.gap;
  const innerR = offsetRings(gS, lt); if (eng.limb) fixPole(innerR, 0);
  const g2 = { rings: innerR, A, N, nor: null }; const tmpMesh = Prim.fromRings(innerR, { flip: true }); g2.nor = tmpMesh.normals();
  const fil = clamp(dev.trim.fillet || 0, 0, 6);
  const ts = (p, i) => { const s = i / N; let t = profT(s, S_) + reinfAdd(S_.reinf, p); if (fil) t *= 1 - 0.07 * fil * (smooth((s - .93) / .07) + (both ? smooth((.07 - s) / .07) : 0)); return Math.max(0.8, t); };
  const outerR = offsetRings(g2, ts); if (eng.limb) fixPole(outerR, 0);
  const fused = eng.limb && dev.conn.type !== 'aucun' && dev.conn.type !== 'valve' ? fusePedestal(innerR, outerR, dev.conn, gS.rings[0][0][1], Math.max(4, S_.tDist)) : null; out.fused = fused;
  out.shellRings = { innerR, outerR };
  const skip = dev.openings.length || S_.lattice ? openingSkip(P, m, dev, sec, tf, trims.bot, N) : null;
  out.shell = buildWall(innerR, outerR, skip, { bothEnds: both }); if (fused && fused.cap) out.shell = Mesh.merge([out.shell, fused.cap, fused.capIn]);
  out.outerEnvelope = Prim.fromRings(outerR, { flip: true, capEnd: true, capStart: both || !!(fused && fused.cap) });
  out.innerSurface = Prim.fromRings(innerR, { flip: true, capStart: !!(fused && fused.capIn) });      // surface intérieure de l'appareil (visualisation)
  out.outerSurface = Prim.fromRings(outerR, { flip: true });       // surface extérieure
  // --- composants
  out.comps = []; out.lines = {};
  if (eng.limb) buildProsthesisComponents(P, dev, out, outerR, rs);
  else buildTrunkComponents(P, m, dev, out, sec, rs, trims, tdef);
  // --- repères
  out.landmarkList = Object.keys(lm).map(id => Object.assign({ id }, lm[id]));
  // --- avertissements
  out.warnings = eng.warnings(P.measures[fam]).slice();
  if (prov === 'scan') {
    const st = out.scanStats; if (!st.closed) out.warnings.push(`Scan : maillage ouvert/non étanche (${st.open} arêtes libres, ${st.nonManifold} non-manifold). Les sections sont extraites par intersection ; réparation conseillée.`);
    if (st.flipped) out.warnings.push('Scan : normales inversées détectées (volume signé négatif). Utilisez « Inverser les normales » ou « Réparer ».');
    const b = out.cleaned.bounds().size; if (b[1] < 60 || b[1] > 900) out.warnings.push(`Échelle suspecte : hauteur du scan ${Math.round(b[1])} mm. Vérifiez l'unité (mm/cm).`);
    if (ctx.scan.mirrored) out.warnings.push('Orientation choisie = transformation avec miroir (axes de chiralité inverse). Vérifiez le côté médial/latéral.');
    out.warnings.push(...scanVsMeasures(P, sec, m));
  }
  if (fused) {
    if (fused.g <= 0.5) out.warnings.push('Connecteur : hauteur bas du moignon → connecteur trop faible (' + dev.conn.h + ' mm) : pas de place pour doublure + coque + vide sous le moignon. Augmenter la hauteur (≥ ' + Math.ceil(fused.yS - fused.yoIn + 12) + ' mm).');
    if (fused.g > .5 && fused.void < 4) out.warnings.push('Vide sous le moignon trop faible (' + Math.round(fused.void * 10) / 10 + ' mm entre le fond de la doublure et la face haute du connecteur) : risque de contact avec les têtes de vis. Augmenter la hauteur.');
    if (fused.Rp > 0 && dev.conn.plateR + 4 > fused.Rp + 0.5) out.warnings.push('Connecteur : la plaque est plus large que la base distale de l\'emboîture ; le rayon d\'embase a été limité à ' + Math.round(fused.Rp) + ' mm.');
  }
  out.stats = {
    volAnat: Math.round(anat.volume() / 1000), volRect: Math.round(out.rect.volume() / 1000), volShell: Math.round(out.shell.volume() / 1000), volOuter: Math.round(out.outerEnvelope.volume() / 1000),
    volLiner: out.liner ? Math.round(out.liner.volume() / 1000) : 0, tris: anat.nt + out.rect.nt + out.shell.nt, h: Math.round(sec.y1 - sec.y0)
  };
  out.shellClosed = analyzeMesh(weldIndexed(out.shell));
  return out;
}
/* mesures saisies vs sections du scan (contrôle d'échelle / incohérences) */
function scanVsMeasures(P, sec, m) {
  const eng = ENGINES[P.family], w = [], rows = m.rows, L = lmLength(P, m);
  if (!P.measuresTouched) return w;
  rows.forEach((r, i) => { const y = sec.y0 + r.y; if (y > sec.y1 || y < sec.y0) return; const pe = sec.perimeterAt(y); if (pe > 0 && Math.abs(pe / r.circ - 1) > 0.1) w.push(`Mesure « ${eng.rowLabel(r, m)} » : circonférence saisie ${r.circ} mm vs scan ${Math.round(pe)} mm (écart ${Math.round((pe / r.circ - 1) * 100)} %). Vérifier l'échelle, l'orientation ou la mesure.`); });
  return w;
}
/* Déforme les anneaux distaux d'une surface : le pôle devient un disque plat de rayon R à la hauteur yT (fond cylindrique raccordé en continu au dôme).
   up = true : disque orienté vers +y (fond de cavité) ; sinon vers −y (base extérieure). */
function morphDistal(rings, cp, R, yT, up) {
  const A = rings[0].length, n = rings.length, yo = rings[0][0][1], g = yo - yT, info = { g, R, K: 0, cap: null };
  if (g <= 0.5) return info;
  const ctr = rings.map(r => { let x = 0, z = 0, y = 0; r.forEach(p => { x += p[0]; z += p[2]; y += p[1]; }); return [x / A, z / A, y / A]; });
  const rbar = rings.map((r, i) => r.reduce((s, p) => s + Math.hypot(p[0] - ctr[i][0], p[2] - ctr[i][1]), 0) / A);
  let K = -1; for (let i = 1; i < n; i++) if (rbar[i] >= R) { K = i; break; }
  if (K < 0 || K > n * 0.7) { K = Math.max(2, Math.floor(n * 0.45)); info.R = R = Math.min(R, rbar[K] * 0.95); }
  info.K = K; const yK = ctr[K][2], span = Math.max(yK - yo, 1);
  for (let i = 0; i < K; i++) {
    const w = 1 - smooth(clamp((ctr[i][2] - yo) / span, 0, 1)), cb = [lerp(ctr[i][0], cp[0], w), lerp(ctr[i][1], cp[1], w)];
    for (let j = 0; j < A; j++) {
      const p = rings[i][j]; let dx = p[0] - ctr[i][0], dz = p[2] - ctr[i][1], rr = Math.hypot(dx, dz);
      if (rr < 1e-6) { const th = j / A * Math.PI * 2; dx = Math.sin(th); dz = Math.cos(th); rr = 0; } else { dx /= rr; dz /= rr; }
      const r2 = lerp(rr, R, w); rings[i][j] = [cb[0] + dx * r2, p[1] - g * w, cb[1] + dz * r2];
    }
  }
  const v = [], f = []; rings[0].forEach(p => v.push(p[0], p[1], p[2])); v.push(cp[0], yT, cp[1]);
  for (let j = 0; j < A; j++) f.push(A, (j + 1) % A, j);
  { const q = [cp[0], yT, cp[1]], p1 = rings[0][1], p0 = rings[0][0], ny = V.cross(V.sub(p1, q), V.sub(p0, q))[1]; if (up ? ny < 0 : ny > 0) for (let t = 0; t < f.length; t += 3) { const x = f[t + 1]; f[t + 1] = f[t + 2]; f[t + 2] = x; } }
  info.cap = new Mesh(new Float32Array(v), new Uint32Array(f)); return info;
}
/* Embase distale évidée : la coque se prolonge jusqu'au connecteur (pièce unique). Le fond de l'emboîture est supprimé :
   la cavité descend en cylindre jusqu'à la face haute du connecteur (y_c), laissant un VIDE sous le moignon pour accéder aux têtes de vis.
   yS = bas du moignon ; h = hauteur bas du moignon → face haute du connecteur ; ins = insertion du connecteur dans la dalle de base. */
function fusePedestal(innerR, outerR, c, yS, wall) {
  const yC = yS - c.h, yB = yC - c.ins, cp = [outerR[0][0][0] + c.ml, outerR[0][0][2] + c.ap], yoIn = innerR[0][0][1], yoOut = outerR[0][0][1];
  const info = { yS, yC, yB, yoIn, yo: yoOut, g: Math.min(yoIn - yC, yoOut - yB), cap: null, capIn: null, Rin: c.plateR + 1, Rp: c.plateR + 1 + wall, cp, void: yoIn - yC };
  if (info.g <= 0.5) return info;
  const mi = morphDistal(innerR, cp, info.Rin, yC, true), mo = morphDistal(outerR, cp, Math.min(mi.R + wall, info.Rp), yB, false);
  info.Rin = mi.R; info.Rp = mo.R; info.capIn = mi.cap; info.cap = mo.cap; info.K = mo.K; return info;
}
function buildProsthesisComponents(P, dev, out, outerR, rs) {
  const c = dev.conn, f = out.fused, P0 = f && f.cap ? [f.cp[0], f.yB, f.cp[1]] : outerR[0][0].slice(); out.pole = P0;
  const cen = rs.cAt(rs.y1); const topC = [cen[0], rs.y1, cen[1]];
  const al = dev.align, Ma = composeTransform(al.flex, al.abd, al.rot, [al.ml, 0, al.ap], P0);
  out.alignMatrix = Ma;
  if (c.type !== 'aucun') {
    const cp = connectorParts(c); out.connAxis = cp.axis;
    const yTop = f ? f.yC : P0[1] - 2, cx = f ? f.cp[0] : P0[0] + c.ml, cz = f ? f.cp[1] : P0[2] + c.ap;
    let Mc = M4.mul(M4.translate([cx, yTop, cz]), M4.mul(M4.rotY(rad(c.rot)), M4.mul(M4.rotX(rad(c.tilt)), M4.rotZ(rad(c.tiltAb)))));
    if (cp.side) Mc = M4.mul(M4.translate([P0[0], P0[1] + 45, P0[2] + (outerR[Math.floor(outerR.length * .25)][0][2] - P0[2]) + 4]), M4.rotX(Math.PI / 2));
    out.connMatrix = Mc;      // le connecteur est solidaire de la coque : il n'est PAS transformé par l'alignement
    cp.parts.forEach((p, i) => out.comps.push({ id: 'conn' + i, name: p.name, mesh: p.mesh.transformed(Mc), color: p.color, fused: true }));
    out.connBottom = Math.min(...out.comps.map(k => k.mesh.bounds().min[1])); out.connTop = yTop;
  }
  // axes (avant/après alignement)
  const base = P0, nAx = [[0, 0, 0]];
  out.lines.mech = new Float32Array([topC[0], topC[1], topC[2], base[0], base[1] - 320, base[2]]);                    // axe mécanique (vertical neutre)
  out.lines.mechNow = new Float32Array([topC[0], topC[1], topC[2], ...M4.apply(Ma, [base[0], base[1] - 320, base[2]])]);
  out.lines.anat = new Float32Array(rs.ys.length ? [].concat(...Array.from(rs.ys).map((y, i) => [rs.cx[i], y, rs.cz[i]])) : []);          // axe anatomique (centroïdes des sections) : tibial (TT) ou fémoral (TF)
  const lineSegs = []; for (let i = 0; i < rs.ys.length - 1; i += 1) lineSegs.push(rs.cx[i], rs.ys[i], rs.cz[i], rs.cx[i + 1], rs.ys[i + 1], rs.cz[i + 1]); out.lines.anat = new Float32Array(lineSegs);
  if (out.connAxis) { const a = out.connAxis, q0 = M4.apply(out.connMatrix, [a[0], a[1], a[2]]), q1 = M4.apply(out.connMatrix, [a[3], a[4], a[5]]); out.lines.conn = new Float32Array([...q0, ...q1]); }
}
function buildTrunkComponents(P, m, dev, out, sec, rs, trims, tdef) {
  const o = dev.trunk, off = dev.shell.gap + dev.shell.tGen + (dev.liner.on ? dev.liner.tGen : 0) + 2.5;
  const strapY = []; const nS = clamp(o.straps | 0, 0, 6);
  for (let k = 0; k < nS; k++) strapY.push(lerp(trims.bot ? Math.max(...trims.bot) + 25 : sec.y0 + 25, (trims.top ? Math.min(...trims.top) : sec.y1) - 25, nS === 1 ? .5 : k / (nS - 1)));
  const openTh = tdef.open && tdef.open.post ? 180 : 0;
  strapY.forEach((y, i) => out.comps.push({ id: 'strap' + i, name: 'Sangle ' + (i + 1), mesh: bandMesh(rs, y, 12, openTh - 55, openTh + 55, off, 16), color: [.15, .15, .17], schematic: true }));
  if (o.pads) dev.zones.filter(z => (z.type === 'charge' || z.type === 'stabilisation') && !z.suggested && z.visible).forEach((z, i) => {
    const c = rs.cAt(z.pos[1]), n = V.norm([z.pos[0] - c[0], 0, z.pos[2] - c[1]]), t = Math.max(3, z.value); out.comps.push({ id: 'pad' + i, name: 'Coussinet ' + (i + 1), mesh: oblate(V.add(z.pos, V.mul(n, t * .8 + dev.shell.gap)), n, z.radius * .7, t), color: [.9, .55, .25] });
  });
  if (tdef.superstructure) {
    const yR = sec.y1 + 20, c = rs.cAt(sec.y1), ctr = [c[0], yR, c[1]];
    out.comps.push({ id: 'neck', name: 'Anneau cervical', mesh: torusPath(ctr, 60, 3.5, yR), color: CONN_COLORS.alu });
    [165, 195, 0].forEach((th, i) => { const j = th / 360 * sec.A, jj = Math.floor(j), yb = trims.top[((jj % sec.A) + sec.A) % sec.A]; const pb = out.shellRings.outerR[out.shellRings.outerR.length - 1][((jj % sec.A) + sec.A) % sec.A], pt = [ctr[0] + 60 * Math.sin(rad(th)), yR, ctr[2] + 60 * Math.cos(rad(th))];
      out.comps.push({ id: 'up' + i, name: 'Montant ' + (i + 1), mesh: rod(pb, pt, 4), color: CONN_COLORS.alu }); });
  }
}
