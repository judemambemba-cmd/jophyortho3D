/* ---------- Étape « Sélection » : peindre sur la 3D la seule partie à conserver ---------- */
const SEL = A_.sel = { target: 'scan', mask: null, nt: 0, src: null, tool: 'paint', brush: (typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches) ? 48 : 30, hist: [], pj: null, last: null, ovT: 0, cur: null };
const selWork = () => (SEL.target === 'cover' || SEL.target === 'load') ? (A_.out && A_.out.original) : (Store.ctx.scan && Store.ctx.scan.work);
const selLoadZ = () => { const P = Store.P; return P && SEL.target === 'load' ? (P.dev[P.family].loads || [])[SEL.loadIdx] : null; };
function selMask() {
  if (SEL.target === 'load') { const w = selWork(), z = selLoadZ(); if (!w || !z) return null; if (SEL.mask && SEL.src === w && SEL.maskKey === z.id) return SEL.mask; SEL.src = w; SEL.maskKey = z.id; SEL.nt = w.nt; SEL.mask = z.rle && z.nt === w.nt ? rleDec(z.rle, w.nt) : new Uint8Array(w.nt); SEL.hist = []; SEL.pj = null; return SEL.mask; }
  if (SEL.target === 'cover') { const w = selWork(); if (!w) return null; if (SEL.mask && SEL.src === w) return SEL.mask; SEL.src = w; SEL.nt = w.nt; const d = Store.P.dev[Store.P.family].cover; SEL.mask = d && d.rle && d.nt === w.nt ? rleDec(d.rle, w.nt) : new Uint8Array(w.nt); SEL.hist = []; SEL.pj = null; return SEL.mask; }
  const sc = Store.ctx.scan; if (!sc) return null;
  if (SEL.mask && SEL.src === sc.original) return SEL.mask;
  SEL.src = sc.original; SEL.nt = sc.original.nt; const S = Store.P.acq.sel;
  SEL.mask = S && S.rle && S.nt === SEL.nt ? rleDec(S.rle, SEL.nt) : new Uint8Array(SEL.nt); SEL.hist = []; SEL.pj = null; return SEL.mask;
}
const selEditable = () => { if (SEL.target === 'load') { const z = selLoadZ(); return !!(z && z.src === 'paint' && selWork()); } if (SEL.target === 'cover') return !!selWork(); const sc = Store.ctx.scan, S = Store.P.acq.sel; return !!(sc && sc.work && !(S && S.done)); };
function selCount() { const m = SEL.mask; let n = 0; if (m) for (let i = 0; i < m.length; i++) n += m[i]; return n; }
/* projection écran des centroïdes + visibilité (tampon de profondeur grossier) : pinceau rapide même sur de gros scans */
function selProject(v, work) {
  const W = v.canvas.clientWidth, H = v.canvas.clientHeight, { vp } = v.matrices(), key = Array.from(vp).join(',') + '|' + W + 'x' + H + '|' + (v.cam.ortho ? 1 : 0);
  if (SEL.pj && SEL.pj.work === work && SEL.pj.rev === work.rev && SEL.pj.key === key) return SEL.pj;
  const nt = work.nt, F = work.f, V_ = work.v, sx = new Float32Array(nt), sy = new Float32Array(nt), sd = new Float32Array(nt), ok = new Uint8Array(nt);
  let dmin = Infinity, dmax = -Infinity;
  for (let i = 0; i < nt; i++) {
    const a = F[i * 3] * 3, b = F[i * 3 + 1] * 3, c = F[i * 3 + 2] * 3, x = (V_[a] + V_[b] + V_[c]) / 3, y = (V_[a + 1] + V_[b + 1] + V_[c + 1]) / 3, z = (V_[a + 2] + V_[b + 2] + V_[c + 2]) / 3;
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 1e-6) continue;
    sx[i] = (cx / cw * .5 + .5) * W; sy[i] = (1 - (cy / cw * .5 + .5)) * H; const d = v.cam.ortho ? cz / cw : cw; sd[i] = d; ok[i] = 1; if (d < dmin) dmin = d; if (d > dmax) dmax = d;
  }
  const CS = 3, zw = Math.ceil(W / CS) + 2, zh = Math.ceil(H / CS) + 2, zb = new Float32Array(zw * zh).fill(Infinity), cell = i => ((sy[i] / CS) | 0) * zw + ((sx[i] / CS) | 0);
  for (let i = 0; i < nt; i++) if (ok[i] && sx[i] >= 0 && sy[i] >= 0 && sx[i] < W && sy[i] < H) { const k = cell(i); if (sd[i] < zb[k]) zb[k] = sd[i]; }
  const z2 = new Float32Array(zb.length).fill(Infinity);
  for (let y = 1; y < zh - 1; y++) for (let x = 1; x < zw - 1; x++) { let m = Infinity; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = zb[(y + dy) * zw + x + dx]; if (q < m) m = q; } z2[y * zw + x] = m; }
  const tol = Math.max(0.03 * (dmax - dmin), v.cam.ortho ? 1e-4 : 2), vis = new Uint8Array(nt);
  for (let i = 0; i < nt; i++) if (ok[i] && sx[i] >= 0 && sy[i] >= 0 && sx[i] < W && sy[i] < H) vis[i] = sd[i] <= z2[cell(i)] + tol ? 1 : 0;
  return SEL.pj = { work, rev: work.rev, key, sx, sy, vis, nt };
}
function selPaintAt(x, y, val) {
  const v = A_.viewer, work = selWork(), pj = selProject(v, work), m = SEL.mask, R = SEL.brush / 2, R2 = R * R, sx = pj.sx, sy = pj.sy, vis = pj.vis; let ch = 0;
  for (let i = 0; i < pj.nt; i++) { if (!vis[i]) continue; const dx = sx[i] - x, dy = sy[i] - y; if (dx * dx + dy * dy <= R2 && m[i] !== val) { m[i] = val; ch++; } }
  return ch;
}
function selOverlayNow() {
  const v = A_.viewer, on = ((A_.curStepId === 'zone' && SEL.target === 'scan') || (A_.curStepId === 'cover' && SEL.target === 'cover')) && selWork() && SEL.mask && selEditable();
  if (!on) { putMesh('selhl', 'anat', null); v.dirty = true; return; }
  const m = SEL.mask, W = selWork(); let n = 0; for (let i = 0; i < m.length; i++) n += m[i];
  if (!n) { putMesh('selhl', 'anat', null); v.dirty = true; selInfo(); return; }
  const pos = new Float32Array(n * 18), idx = new Uint32Array(n * 6); let j = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) {
    const a = W.f[i * 3] * 3, b = W.f[i * 3 + 1] * 3, c = W.f[i * 3 + 2] * 3, ux = W.v[b] - W.v[a], uy = W.v[b + 1] - W.v[a + 1], uz = W.v[b + 2] - W.v[a + 2], wx = W.v[c] - W.v[a], wy = W.v[c + 1] - W.v[a + 1], wz = W.v[c + 2] - W.v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx *= .4 / l; ny *= .4 / l; nz *= .4 / l;
    /* deux copies décalées de part et d'autre : celle qui est à l'extérieur du modèle est visible, l'autre est masquée (marche quel que soit le sens des normales) */
    [1, -1].forEach((sg, s2) => [a, b, c].forEach((q, k) => { const o = (j * 2 + s2) * 9 + k * 3; pos[o] = W.v[q] + sg * nx; pos[o + 1] = W.v[q + 1] + sg * ny; pos[o + 2] = W.v[q + 2] + sg * nz; idx[(j * 2 + s2) * 3 + k] = (j * 2 + s2) * 3 + k; }));
    j++;
  }
  putMesh('selhl', 'anat', new Mesh(pos, idx), SEL.target === 'load' ? ((selLoadZ() || {}).kind === 'load' ? [.3, .6, 1] : [1, .45, .25]) : [.1, .85, .4], { noClip: true, noPick: true, baseAlpha: .75 }); applyLayers(); v.dirty = true; selInfo();
}
function selOverlay(now) { if (now) { clearTimeout(SEL.ovT); selOverlayNow(); } else if (!SEL.ovT || true) { clearTimeout(SEL.ovT); SEL.ovT = setTimeout(selOverlayNow, 90); } }
function selInfo() { const el = document.getElementById('selInfo'); if (!el || !SEL.mask) return; const n = selCount(); el.textContent = n ? `${n.toLocaleString(LOC())} triangles sélectionnés sur ${SEL.nt.toLocaleString(LOC())} (${(n / SEL.nt * 100).toFixed(1)} %).` : 'Aucune sélection : peignez la partie à conserver.'; }
function selPush() { SEL.hist.push(new Uint8Array(SEL.mask)); if (SEL.hist.length > 12) SEL.hist.shift(); }
function selCursor(show, e) {
  const v = A_.viewer, par = v.canvas.parentElement; let c = SEL.cur;
  if (!c) { c = SEL.cur = document.createElement('div'); c.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;border:2px solid #25d366;box-sizing:border-box;display:none;z-index:5;transform:translate(-50%,-50%)'; par.appendChild(c); }
  if (!show || !e) { c.style.display = 'none'; return; }
  const r = par.getBoundingClientRect(); c.style.width = c.style.height = SEL.brush + 'px'; c.style.left = (e.clientX - r.left) + 'px'; c.style.top = (e.clientY - r.top) + 'px'; c.style.borderColor = SEL.tool === 'erase' ? '#ff5a4d' : '#25d366'; c.style.display = 'block';
}
function selUndo() { const m = SEL.hist.pop(); if (m) { SEL.mask.set(m); selOverlay(true); if (SEL.target === 'cover' && typeof coverCommit === 'function') coverCommit(); else if (SEL.target === 'load' && typeof loadCommit === 'function') loadCommit(); selInfo(); } else toast('Rien à annuler.'); }
/* barre d'outils flottante (plein écran 3D) */
function dockBuild() {
  const d = document.getElementById('dock'); if (!d) return;
  const on = (A_.curStepId === 'zone' || A_.curStepId === 'cover' || A_.curStepId === 'charges') && selEditable();
  d.hidden = !on; d.innerHTML = ''; if (!on) return;
  const tb = (id, ic, lb) => h('button', { class: 'dk' + (SEL.tool === id ? ' on' : ''), 'data-dk': id, onclick: () => selSetTool(id) }, h('i', null, ic), h('span', null, lb));
  const cov = SEL.target === 'cover' || SEL.target === 'load';
  d.append(h('div', { class: 'dkrow' }, tb('paint', '🖌', SEL.target === 'load' ? 'Peindre' : cov ? 'Couvrir' : 'Garder'), tb('erase', '⌫', cov ? 'Libérer' : 'Gomme'), tb('nav', '✋', 'Tourner'),
    h('button', { class: 'dk', onclick: selUndo }, h('i', null, '↶'), h('span', null, 'Annuler')),
    h('button', { class: 'dk ok', onclick: () => setMax(false) }, h('i', null, '✔'), h('span', null, 'Terminé'))),
    h('div', { class: 'dkrow' }, h('span', { class: 'dkl' }, 'Pinceau'), h('input', { type: 'range', min: 8, max: 160, step: 1, value: SEL.brush, 'aria-label': 'Taille du pinceau', oninput: e => { SEL.brush = +e.target.value; selCursor(false); } })));
}
A_.dockRefresh = dockBuild;
function selSetTool(t) { SEL.tool = t; const v = A_.viewer; v.paintMode = selEditable() && t !== 'nav'; selCursor(false); document.querySelectorAll('#panel [data-seltool]').forEach(b => b.classList.toggle('p', b.dataset.seltool === t)); document.querySelectorAll('#dock [data-dk]').forEach(b => b.classList.toggle('on', b.dataset.dk === t)); if (!document.querySelector('#dock .dk')) dockBuild(); if (t === 'nav') hint('Navigation : faites tourner le modèle (un doigt / clic gauche), déplacez (clic droit / deux doigts), zoomez (molette).'); else hint(t === 'paint' ? 'Maintenez le clic (ou le doigt) et peignez les zones à ' + (SEL.target === 'cover' ? 'COUVRIR' : SEL.target === 'load' ? 'TRAITER (charge / décharge)' : 'CONSERVER') + '. Ctrl/Alt + glisser = tourner, clic droit = déplacer.' : 'Gomme : maintenez le clic et effacez les zones à ne PAS ' + (SEL.target === 'cover' ? 'couvrir' : SEL.target === 'load' ? 'traiter' : 'conserver') + '.'); }
function selHandlers() {
  const v = A_.viewer;
  v.onPaint = (e, ph) => {
    if (!selEditable()) return; selMask(); const r = v.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, val = SEL.tool === 'erase' ? 0 : 1;
    selCursor(true, e);
    if (ph === 'down') { selPush(); SEL.last = [x, y]; selPaintAt(x, y, val); selOverlay(false); }
    else if (ph === 'move') { const l = SEL.last || [x, y], d = Math.hypot(x - l[0], y - l[1]), st = Math.max(3, SEL.brush * .35), n = Math.min(40, Math.ceil(d / st)); for (let k = 1; k <= n; k++) selPaintAt(l[0] + (x - l[0]) * k / n, l[1] + (y - l[1]) * k / n, val); SEL.last = [x, y]; selOverlay(false); }
    else { selOverlay(true); }
  };
  v.onHover = e => { if ((A_.curStepId === 'zone' || A_.curStepId === 'cover' || A_.curStepId === 'charges') && v.paintMode) selCursor(true, e); };
  v.canvas.addEventListener('pointerleave', () => selCursor(false));
}
STEP.zone = {
  label: 'Sélection', layers: { anat: 1 },
  leave() { const v = A_.viewer; setMax(false); const dk = document.getElementById('dock'); if (dk) dk.hidden = true; v.paintMode = false; v.onHover = null; v.onPaint = null; hint(''); selCursor(false); A_.curStepId = null; putMesh('selhl', 'anat', null); v.dirty = true; },
  render(b) {
    const P = Store.P, sc = Store.ctx.scan, S = P.acq.sel, fam = P.family; A_.curStepId = 'zone';
    b.append(h('h2', null, 'Sélection de la partie à conserver'), h('p', { class: 'sub' }, fam === 'trunk' ? 'Le scan contient aussi d\'autres éléments (support, jambes, bras, tête, arrière-plan…). Peignez sur le modèle 3D uniquement le TRONC : seul ce qui est sélectionné sera conservé.' : 'Le scan contient aussi d\'autres éléments (genou, cuisse, jambe saine, support, arrière-plan…). Peignez sur le modèle 3D uniquement le MOIGNON : seul ce qui est sélectionné sera conservé.')); if (ENGINES[fam].orth) b.lastChild.textContent = 'Le scan contient aussi d\'autres éléments (corps, support, arrière-plan…). Peignez sur le modèle 3D uniquement le MEMBRE sur lequel on travaille (bras ou jambe) : seul ce qui est sélectionné sera conservé.';;
    if (!sc || !sc.work) { b.append(note('Aucun scan chargé. Importez-le à l\'étape Acquisition.', 'warn')); return; }
    if (S && S.done) {
      b.append(note(S.all ? 'Le scan entier est conservé.' : 'Sélection validée : seule la partie sélectionnée est conservée.', 'info'), h('div', { class: 'btns' }, btn('Modifier la sélection', () => { Store.apply('Modification de la sélection', p => { p.acq.sel.done = false; p.landmarks = {}; }, { kind: 'rerender' }); A_.frameNext = true; }, 'p'), btn('Continuer → points clés', () => goStep(A_.step + 1), 'sm')));
      b.append(note('Modifier la sélection réinitialise les points clés (le repère change).', 'warn')); return;
    }
    selMask(); const v = A_.viewer; selHandlers();
    const tool = (id, label) => h('button', { class: 'btn sm' + (SEL.tool === id ? ' p' : ''), 'data-seltool': id, onclick: () => selSetTool(id) }, label);
    b.append(btn('⛶ Peindre en plein écran 3D', () => { setMax(true); }, 'sm p mobbtn'));
    b.append(h('div', { class: 'btns' }, tool('paint', '🖌 Pinceau'), tool('erase', '⌫ Gomme'), tool('nav', '✋ Naviguer')));
    b.append(h('div', { class: 'f' }, h('label', null, 'Taille du pinceau (px)'), h('div', { class: 'rg' }, h('input', { type: 'range', min: 8, max: 160, step: 1, value: SEL.brush, oninput: e => { SEL.brush = +e.target.value; n.value = SEL.brush; selCursor(false); } }), (() => { const n_ = h('input', { type: 'number', min: 8, max: 160, value: SEL.brush, onchange: e => { SEL.brush = clamp(+e.target.value || 30, 8, 160); e.target.value = SEL.brush; } }); window.__n = n_; return n_; })())));
    const n = window.__n;
    b.append(h('div', { class: 'info', id: 'selInfo' }, ''));
    b.append(h('div', { class: 'btns' },
      btn('Inverser', () => { selPush(); for (let i = 0; i < SEL.mask.length; i++) SEL.mask[i] ^= 1; selOverlay(true); }, 'sm'),
      btn('Tout effacer', () => { selPush(); SEL.mask.fill(0); selOverlay(true); }, 'sm'),
      btn('Tout sélectionner', () => { selPush(); SEL.mask.fill(1); selOverlay(true); }, 'sm'),
      btn('↶ Annuler le dernier trait', selUndo, 'sm')));
    b.append(h('div', { class: 'btns' }, btn('✔ Valider la sélection', () => {
      const n = selCount(); if (!n) { toast('Peignez d\'abord la partie à conserver.'); return; }
      if (n < SEL.nt * 0.002) { toast('Sélection très petite : vérifiez avant de valider.'); }
      const mask = new Uint8Array(SEL.mask); Store.apply('Sélection de la partie conservée', p => { p.acq.sel = { done: true, all: n === SEL.nt, nt: SEL.nt, rle: rleEnc(mask) }; p.acq.cuts = []; p.landmarks = {}; }, { kind: 'rerender' });
      A_.frameNext = true; selOverlay(true); goStep(A_.step + 1);
    }, 'p'), btn('Garder tout le scan', () => { Store.apply('Scan conservé en entier', p => { p.acq.sel = { done: true, all: true, nt: SEL.nt }; p.landmarks = {}; }, { kind: 'rerender' }); goStep(A_.step + 1); }, 'sm')));
    b.append(note('Astuce : peignez à grands traits, puis affinez avec la gomme. Tournez le modèle pour atteindre toutes les faces (outil Naviguer, ou Ctrl/Alt + glisser). L\'original du scan n\'est jamais modifié.', 'info'));
    selSetTool(SEL.tool); selInfo(); setTimeout(() => selOverlay(true), 0);
  }
};
/* ---------- Étape « Points clés » : points à déterminer avant de continuer ---------- */
const KEYPTS = { osup: ['olecrane', 'styloide_ulna'], oinf: ['patella', 'malleole_lat'], tt: ['tendon', 'extremite'], tf: ['perinee', 'extremite'], trunk: ['sternum', 'xiphoide', 'epias_d', 'epias_g', 'crete_d', 'crete_g', 'troch_d', 'troch_g', 'sacrum'] };
function lmsMissing(P) { if (P.acq.mode === 'measures') return []; return KEYPTS[P.family].filter(id => !(P.landmarks[id] && P.landmarks[id].pos && P.landmarks[id].source === 'manuel')); }
function deriveFromPoints(p) {
  const L = p.landmarks, ok = id => L[id] && L[id].source === 'manuel', m = p.measures[p.family], r = x => Math.round(x);
  if (p.family === 'tt' && ok('tendon') && ok('extremite')) { m.lenPT = clamp(r(L.tendon.pos[1] - L.extremite.pos[1]), 60, 280); p.measuresTouched = true; }
  if (p.family === 'tf' && ok('perinee') && ok('extremite')) { m.lenPer = clamp(r(L.perinee.pos[1] - L.extremite.pos[1]), 120, 520); p.measuresTouched = true; }
  if (p.family === 'osup' && ok('olecrane') && ok('styloide_ulna')) { m.lenFore = clamp(r(L.olecrane.pos[1] - L.styloide_ulna.pos[1]), 170, 340); m.lenHand = clamp(r(L.styloide_ulna.pos[1]), 140, 250); p.measuresTouched = true; }
  if (p.family === 'oinf' && ok('patella') && ok('malleole_lat')) { m.lenLeg = clamp(r(L.patella.pos[1] - L.malleole_lat.pos[1]), 250, 520); m.ankleH = clamp(r(L.malleole_lat.pos[1]), 45, 110); p.measuresTouched = true; }
  if (p.family === 'trunk') { if (ok('crete_d') && ok('crete_g')) { m.hCrete = clamp(r((L.crete_d.pos[1] + L.crete_g.pos[1]) / 2), 20, 250); p.measuresTouched = true; } if (ok('xiphoide')) { m.hXiph = clamp(r(L.xiphoide.pos[1]), 150, 550); p.measuresTouched = true; } }
}
STEP.cles = {
  label: 'Points clés', layers: { anat: 1, lms: 1 }, layerAlpha: { anat: .85 }, leave() { setMax(false); },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family], out = A_.out, ids = KEYPTS[P.family]; A_.curStepId = 'cles';
    b.append(h('h2', null, 'Points clés'), h('p', { class: 'sub' }, eng.orth ? (P.family === 'osup' ? 'Déterminez l\'olécrâne et la styloïde ulnaire : choisissez un point puis touchez la surface du modèle. Les longueurs avant-bras et main sont déduites et reportées dans les mesures.' : 'Déterminez le centre de la rotule et la malléole latérale : choisissez un point puis touchez la surface du modèle. La longueur de jambe et la hauteur de malléole sont déduites et reportées dans les mesures.') : P.family === 'trunk' ? 'Déterminez ces points sur le tronc avant de continuer : choisissez un point puis touchez la surface du modèle. Les hauteurs de la crête iliaque et de l\'appendice xiphoïde sont déduites automatiquement et reportées dans les mesures.' : P.family === 'tt' ? 'Déterminez le tendon rotulien et l\'extrémité distale du moignon : choisissez un point puis touchez la surface du modèle. La longueur « tendon rotulien → extrémité » est déduite et reportée dans les mesures.' : 'Déterminez le périnée et l\'extrémité distale du membre résiduel : choisissez un point puis touchez la surface. La longueur « périnée → extrémité » est déduite et reportée dans les mesures.'));
    const sc = Store.ctx.scan; if (!sc || !sc.work) { b.append(note('Aucun scan chargé.', 'warn')); return; }
    b.append(btn('⛶ Agrandir la vue 3D', () => setMax(true), 'sm mobbtn'));
    const miss = lmsMissing(P); b.append(h('div', { class: miss.length ? 'warn' : 'info', id: 'keyProg' }, miss.length ? `${ids.length - miss.length}/${ids.length} points placés.` : 'Tous les points clés sont placés. Vous pouvez continuer.'));
    const place = id => { A_.selLm = id; const d = eng.landmarkDefs.find(q => q.id === id); setMode({ kind: 'landmark', fn: hit => { Store.apply('Point clé placé : ' + d.label, p => { p.landmarks[id] = { pos: hit.point.map(x => Math.round(x * 10) / 10), source: 'manuel' }; deriveFromPoints(p); }, { kind: 'rerender' }); setMode(null); } }, 'Touchez la surface pour placer : ' + d.label); renderPanel(true); updateScene(); };
    ids.forEach(id => {
      const d = eng.landmarkDefs.find(q => q.id === id), done = !miss.includes(id), sel = A_.selLm === id;
      const lowest = () => { const W = sc.work; let bi = 0, by = Infinity; for (let i = 0; i < W.nv; i++) if (W.v[i * 3 + 1] < by) { by = W.v[i * 3 + 1]; bi = i; } let sx = 0, sz = 0, k = 0; for (let i = 0; i < W.nv; i++) if (W.v[i * 3 + 1] < by + 4) { sx += W.v[i * 3]; sz += W.v[i * 3 + 2]; k++; } return [sx / k, by, sz / k]; };
      b.append(h('div', { class: 'card2' + (sel ? ' sel' : '') }, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('span', { class: 'dot', style: 'background:' + (done ? '#33e6ff' : '#ff9933') }), h('b', { style: 'flex:1' }, d.label), h('span', { class: 'tag' }, done ? 'placé' : 'à placer')),
        h('div', { class: 'btns' }, btn(done ? 'Replacer' : 'Placer sur le modèle', () => place(id), 'sm p'), id === 'extremite' ? btn('Proposer (point le plus bas)', () => { Store.apply('Extrémité distale proposée', p => { const q = lowest(); p.landmarks.extremite = { pos: q.map(x => Math.round(x * 10) / 10), source: 'manuel' }; deriveFromPoints(p); }, { kind: 'rerender' }); }, 'sm') : null)));
    });
    if (eng.orth) b.append(note('Les valeurs déduites sont reportées à l\'étape Mesures (modifiables).', 'info'));
    else if (P.family !== 'trunk') { const m = P.measures[P.family]; b.append(note('Longueur retenue : ' + (P.family === 'tt' ? m.lenPT : m.lenPer) + ' mm (modifiable à l\'étape Mesures).', 'info')); }
    else b.append(note('Les autres repères (apex, scapula, angle costal…) pourront être placés à l\'étape Repères.', 'info'));
  }
};

/* raccourcis clavier (PC) : B pinceau, E gomme, N naviguer, [ ] taille */
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { if (e.key === 'Escape') setMax(false); return; }
  if (A_.curStepId !== 'zone' && A_.curStepId !== 'cover' && A_.curStepId !== 'charges') return; const k = e.key.toLowerCase();
  if (k === 'b') selSetTool('paint'); else if (k === 'e') selSetTool('erase'); else if (k === 'n') selSetTool('nav');
  else if (e.key === '[' || e.key === ']') { SEL.brush = clamp(SEL.brush + (e.key === ']' ? 6 : -6), 8, 160); selCursor(false); const r = document.querySelector('#dock input[type=range]'); if (r) r.value = SEL.brush; toast('Pinceau : ' + SEL.brush + ' px', 900); }
  else if (k === 'escape') setMax(false);
});
