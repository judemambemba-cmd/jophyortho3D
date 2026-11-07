/* JophyOrtho 3D — 14 : cœur de l'interface (assistants DOM, calques, vue 3D, modes de sélection) */
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v); }
  kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
let toastT = 0;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', ms || 3500); }
let hintT = 0;
function hint(msg) { const t = $('#hint'); clearTimeout(hintT); if (!msg) { t.style.display = 'none'; return; } t.textContent = msg; t.style.display = 'block'; if (matchMedia('(pointer:coarse)').matches) hintT = setTimeout(() => { t.style.display = 'none'; }, 5000); }
/* vue 3D plein écran (mobile : pinceau confortable, outils flottants) */
function setMax(on) { const a = $('#app'); a.classList.toggle('max', !!on); const b = $('#bMax'); if (b) { b.classList.toggle('on', !!on); b.textContent = on ? '✕' : '⛶'; b.title = on ? 'Quitter le plein écran 3D' : 'Vue 3D plein écran'; } if (A_.dockRefresh) A_.dockRefresh(); setTimeout(() => { if (A_.viewer) { A_.viewer.resize(); A_.viewer.frame(A_.viewer.sceneBounds(o => o.layer !== 'lms' && o.layer !== 'axes')); A_.viewer.dirty = true; } }, 60); }
function modal(content) { const m = $('#modal'), c = $('#modalCard'); c.innerHTML = ''; c.append(...[].concat(content)); m.hidden = false; }
function closeModal() { $('#modal').hidden = true; if (typeof HOME !== 'undefined') { if (HOME.keep) HOME.keep = false; else HOME.hide(); } }
/* ---------- chemins d'état ---------- */
function root(P, seg) { return seg === 'dev' ? P.dev[P.family] : seg === 'm' ? P.measures[P.family] : P[seg]; }
function getPath(P, path) { const s = path.split('.'); let o = root(P, s[0]); for (let i = 1; i < s.length; i++) o = o[s[i]]; return o; }
function setPath(P, path, v) { const s = path.split('.'); let o = root(P, s[0]); for (let i = 1; i < s.length - 1; i++) o = o[s[i]]; o[s[s.length - 1]] = v; if (s[0] === 'm') P.measuresTouched = true; }
const A_ = {};   // état global de l'application
/* ---------- contrôles liés à l'état ---------- */
function ctl(label, path, o) {
  o = o || {}; const P = Store.P, val = getPath(P, path), type = o.type || (o.opts ? 'select' : 'text');
  const set = v => Store.apply(o.op || ('Modification : ' + label), p => { setPath(p, path, v); if (o.after) o.after(p, v); }, { kind: o.rerender ? 'rerender' : 'change' });
  let inp;
  if (type === 'select') { inp = h('select', { onchange: e => set(o.num ? +e.target.value : e.target.value) }, o.opts.map(x => h('option', { value: x[0], selected: String(x[0]) === String(val) }, x[1]))); return h('div', { class: 'f' }, h('label', null, label), inp); }
  if (type === 'range') {
    const rg = h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: val }), nm = h('input', { type: 'number', min: o.min, max: o.max, step: o.step || 1, value: val });
    const upd = v => { v = +v; if (isNaN(v)) return; set(v); };
    const clampV = v => Math.min(o.max, Math.max(o.min, v));
    rg.addEventListener('input', () => { nm.value = rg.value; upd(rg.value); });
    /* saisie au clavier : validée à la fin (Entrée / sortie du champ), bornée à la plage, sans appliquer les valeurs intermédiaires */
    nm.addEventListener('input', () => { const v = +nm.value; if (nm.value !== '' && !isNaN(v) && v >= o.min && v <= o.max) rg.value = v; });
    nm.addEventListener('change', () => { if (nm.value === '' || isNaN(+nm.value)) { nm.value = rg.value; return; } const v = clampV(+nm.value); nm.value = v; rg.value = v; upd(v); });
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') nm.blur(); });
    nm.addEventListener('focus', () => nm.select());
    return h('div', { class: 'f' }, h('label', null, label + (o.unit ? ' (' + o.unit + ')' : '')), h('div', { class: 'rg' }, rg, nm));
  }
  if (type === 'check') { const c = h('input', { type: 'checkbox', checked: !!val, onchange: e => set(e.target.checked) }); return h('label', { class: 'chk' }, c, h('span', null, label)); }
  if (type === 'textarea') { return h('div', { class: 'f' }, h('label', null, label), h('textarea', { oninput: e => set(e.target.value) }, val == null ? '' : val)); }
  inp = h('input', { type: type === 'number' ? 'number' : type, value: val == null ? '' : val, step: o.step, min: o.min, max: o.max, [type === 'number' ? 'onchange' : 'oninput']: e => { if (type !== 'number') return set(e.target.value); if (e.target.value === '') return; let v = +e.target.value; if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); e.target.value = v; set(v); } });
  return h('div', { class: 'f' }, h('label', null, label + (o.unit ? ' (' + o.unit + ')' : '')), inp);
}
const note = (t, c) => h('div', { class: c || 'info' }, t);
const btn = (t, fn, c) => h('button', { class: 'btn ' + (c || ''), onclick: fn }, t);
/* ---------- calques ---------- */
const LAYERS = [
  ['anat', 'Anatomie originale (scan / reconstruction)', [.86, .72, .62]], ['clean', 'Anatomie nettoyée (copie réparée)', [.75, .85, .7]], ['rect', 'Anatomie rectifiée', [.55, .75, .92]],
  ['liner', 'Manchon / doublure', [.35, .82, .68]], ['inner', 'Surface intérieure de l\'appareil', [.95, .7, .3]], ['outer', 'Surface extérieure de l\'appareil', [.62, .72, .95]],
  ['shell', 'Coque (paroi épaisse)', [.82, .85, .92]], ['comps', 'Composants', [.7, .74, .8]], ['lms', 'Repères', [1, .6, .2]], ['trim', 'Trimlines', [1, .9, .2]], ['axes', 'Axes / alignement', [1, 1, 1]]
];
A_.layers = {}; LAYERS.forEach(l => A_.layers[l[0]] = { vis: false, alpha: 1 });
A_.compare = 'off';
function setLayerPreset(p) { LAYERS.forEach(l => { A_.layers[l[0]].vis = !!p[l[0]]; if (p.alpha && p.alpha[l[0]] != null) A_.layers[l[0]].alpha = p.alpha[l[0]]; else A_.layers[l[0]].alpha = 1; }); refreshLayersPanel(); applyLayers(); }
function refreshLayersPanel() {
  const box = $('#layersPanel'); box.innerHTML = ''; box.append(h('b', null, 'Calques'));
  LAYERS.forEach(l => {
    const st = A_.layers[l[0]];
    box.append(h('div', { class: 'lay' },
      h('input', { type: 'checkbox', checked: st.vis, 'aria-label': 'Afficher ' + l[1], onchange: e => { st.vis = e.target.checked; applyLayers(); } }),
      h('span', { class: 'lb' }, l[1]),
      h('input', { type: 'range', min: 5, max: 100, value: Math.round(st.alpha * 100), 'aria-label': 'Transparence', oninput: e => { st.alpha = e.target.value / 100; applyLayers(); } }),
      h('button', { class: 'btn sm', title: 'Isoler ce calque', onclick: () => { LAYERS.forEach(x => A_.layers[x[0]].vis = x[0] === l[0]); refreshLayersPanel(); applyLayers(); } }, 'Solo')));
  });
  box.append(h('div', { class: 'btns' }, btn('Tout afficher', () => { LAYERS.forEach(x => A_.layers[x[0]].vis = true); refreshLayersPanel(); applyLayers(); }, 'sm'), btn('Assemblage', () => { setLayerPreset({ shell: 1, liner: 1, comps: 1, axes: 1 }); }, 'sm')));
}
function applyLayers() {
  const v = A_.viewer; if (!v) return;
  v.objects.forEach(o => {
    if (!o.layer) return; const st = A_.layers[o.layer]; let vis = st.vis, al = st.alpha;
    if (A_.compare !== 'off') {
      if (o.layer === 'anat') { vis = A_.compare === 'avant' || A_.compare === 'sup'; al = A_.compare === 'sup' ? .35 : 1; }
      if (o.layer === 'rect') { vis = A_.compare === 'apres' || A_.compare === 'sup'; al = 1; }
    }
    o.visible = !!vis && (!o.needs || o.needs()); o.alpha = (o.baseAlpha || 1) * al;
  });
  v.dirty = true;
}
/* ---------- scène ---------- */
const SKIN = [.86, .72, .62];
function putMesh(id, layer, mesh, color, extra) {
  const v = A_.viewer, old = v.objects.get(id); if (old && old.mesh && old.mesh !== mesh) v.freeMesh(old.mesh);
  if (!mesh) { if (old) v.remove(id); return; }
  v.set(id, Object.assign({ mesh, color, layer, order: LAYERS.findIndex(l => l[0] === layer) }, extra || {}));
}
function putLines(id, layer, lines, color, extra) { const v = A_.viewer; if (!lines || !lines.length) { v.remove(id); return; } const old = v.objects.get(id); if (old && old._buf) v.gl.deleteBuffer(old._buf); v.set(id, Object.assign({ lines, color, layer }, extra || {})); }
function updateScene() {
  const out = A_.out, v = A_.viewer, P = Store.P; if (!out || out.error) return;
  const dev = Store.dev;
  putMesh('anat', 'anat', out.original || out.anatomy, SKIN, { vcolors: out.anatColors, vcRev: out.anatColors, cutColor: [.9, .78, .68] });
  putMesh('clean', 'clean', P.acq.repair && out.cleaned !== out.original ? out.cleaned : null, [.7, .85, .7]);
  putMesh('rect', 'rect', out.rect, [.55, .75, .92], { vcolors: out.rectColors, vcRev: out.rectColors, cutColor: [.3, .55, .85] });
  putMesh('liner', 'liner', out.liner, [.35, .82, .68], { cutColor: [.15, .65, .5] });
  putMesh('inner', 'inner', out.innerSurface, [.95, .7, .3], { cutColor: [.95, .6, .1] });
  putMesh('outer', 'outer', out.outerSurface, [.62, .72, .95], { cutColor: [.5, .6, .9] });
  putMesh('shell', 'shell', out.shell, [.82, .85, .92], { cutColor: [.55, .6, .75] });
  // composants
  const keep = new Set(); out.comps.forEach(c => { keep.add('c:' + c.id); putMesh('c:' + c.id, 'comps', c.mesh, c.color, { cutColor: c.color.map(x => x * .7) }); });
  [...v.objects.keys()].filter(k => k.startsWith('c:') && !keep.has(k)).forEach(k => { const o = v.objects.get(k); if (o.mesh) v.freeMesh(o.mesh); v.remove(k); });
  // repères
  const H = out.stats.h, rr = clamp(H * 0.011, 2.2, 5), lkeep = new Set();
  out.landmarkList.forEach(l => { const id = 'lm:' + l.id, sel = A_.selLm === l.id, col = sel ? [1, 1, 1] : l.source === 'manuel' ? [.2, .9, 1] : [1, .6, .2]; lkeep.add(id); putMesh(id, 'lms', Prim.sphere(sel ? rr * 1.7 : rr, l.pos, 8), col, { noClip: true }); });
  [...v.objects.keys()].filter(k => k.startsWith('lm:') && !lkeep.has(k)).forEach(k => { v.freeMesh(v.objects.get(k).mesh); v.remove(k); });
  // zone sélectionnée
  const sz = dev.zones.find(z => z.id === A_.selZone); putMesh('zsel', 'lms', sz ? Prim.sphere(rr * 1.4, sz.pos, 8) : null, [1, 1, 1], { noClip: true });
  // trimline
  const sr = out.shellRings; const ringLine = (ring) => { const a = []; ring.concat([ring[0]]).forEach(p => a.push(p[0], p[1], p[2])); return new Float32Array(a); };
  if (sr) { putLines('trimT', 'trim', ringLine(sr.outerR[sr.outerR.length - 1]), [1, .9, .2], { strip: true, noClip: true }); putLines('trimTi', 'trim', ringLine(sr.innerR[sr.innerR.length - 1]), [1, .6, .1], { strip: true, noClip: true });
    putLines('trimB', 'trim', out.trim.bot ? ringLine(sr.outerR[0]) : null, [1, .9, .2], { strip: true, noClip: true }); }
  // axes / alignement
  putLines('ax1', 'axes', out.lines.mech, [.8, .8, .8], { noClip: true, onTop: true }); putLines('ax2', 'axes', out.lines.mechNow, [1, .55, .1], { noClip: true, onTop: true });
  putLines('ax3', 'axes', out.lines.anat, [.9, .3, .9], { noClip: true, onTop: true }); putLines('ax4', 'axes', out.lines.conn, [.2, .9, 1], { noClip: true, onTop: true });
  // arêtes ouvertes du scan
  putLines('open', 'anat', A_.showOpen && out.original ? openEdgeSegments(out.original) : null, [1, .15, .15], { noClip: true, onTop: true, needs: () => A_.showOpen });
  // mesure
  putLines('meas', 'lms', A_.measure && A_.measure.length === 2 ? new Float32Array([...A_.measure[0], ...A_.measure[1]]) : null, [1, 1, .2], { noClip: true, onTop: true });
  if (typeof updateCutPreview === 'function') updateCutPreview();
  applyLayers(); updateSectionRange(); updateLabels();
  $('#status').textContent = `${PROVENANCE[out.prov]} · H ${out.stats.h} mm · ${(out.stats.tris).toLocaleString(LOC())} triangles` + (A_.measureText ? ' · ' + A_.measureText : '');
}
/* recolore anatomie/rectifiée avec la sélection de zone en cours (sans reconstruire la géométrie) */
function recolorSelection() {
  const out = A_.out; if (!out || out.error) return; const dev = Store.dev, selZ = (Store.ctx.zoneSel || []).map(q => ({ type: 'selection', pos: q.pos, radius: q.radius, transition: 1, visible: true }));
  out.anatColors = zoneVertexColors(out.anatomy, dev.zones.concat(selZ)); out.rectColors = zoneVertexColors(out.rect, dev.zones.concat(selZ)); updateScene();
}
/* ---------- coupes ---------- */
function updateSectionRange() {
  const v = A_.viewer, b = v.sceneBounds(o => o.layer !== 'lms'); if (!b) return; const ax = v.clip.axis, k = { x: 0, y: 1, z: 2 }[ax];
  v.clip.pos = lerp(b.min[k], b.max[k], +$('#secPos').value / 100);
  v.clip.on = $('#secAxis').value !== 'off'; v.dirty = true;
}
function sectionLegend() {
  const items = [['Anatomie', [.9, .78, .68]], ['Rectifiée', [.3, .55, .85]], ['Manchon', [.15, .65, .5]], ['Espace fonct. (surface int.)', [.95, .6, .1]], ['Coque', [.55, .6, .75]], ['Renfort/composants', [.5, .5, .55]]];
  $('#secLegend').innerHTML = items.map(i => `<span><i style="background:rgb(${i[1].map(x => Math.round(x * 255))})"></i>${i[0]}</span>`).join('') + '<div style="width:100%">Coupe visuelle (sans remplissage des faces) : les parois apparaissent en couleur de calque.</div>';
}
/* ---------- projection écran (étiquettes) ---------- */
Viewer.prototype.project = function (p) {
  const { vp } = this.matrices(), x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  const r = this.canvas.getBoundingClientRect(); return [(x / w * .5 + .5) * r.width, (1 - (y / w * .5 + .5)) * r.height, w];
};
function updateLabels() {
  const box = $('#labels'); box.innerHTML = ''; const out = A_.out; if (!out) return;
  const add = (p, t) => { const s = A_.viewer.project(p); if (s[2] > 0) box.append(h('span', { style: `left:${s[0]}px;top:${s[1]}px` }, t)); };
  const l = A_.selLm && out.lm[A_.selLm]; if (l) add(l.pos, l.label + ' (' + l.source + ')');
  if (A_.measure) A_.measure.forEach((p, i) => add(p, i ? 'B' : 'A'));
  const z = Store.dev.zones.find(z => z.id === A_.selZone); if (z) add(z.pos, ZONE_TYPES[z.type].label + ' ' + z.value + ' mm');
  if (A_.labelsOn) A_.labelsOn(add);
}
/* ---------- reconstruction (débouncée) ---------- */
let bq = false;
function scheduleBuild() { if (bq) return; bq = true; setTimeout(() => { bq = false; rebuild(); }, 20); }
function rebuild() {
  try { A_.out = buildAll(Store.P, Store.ctx); } catch (e) { console.error(e); toast('Erreur de reconstruction : ' + e.message, 6000); return; }
  if (A_.out.error) { $('#status').textContent = A_.out.error; toast(A_.out.error, 6000); return; }
  updateHeader(); updateScene(); if (A_.onBuilt) A_.onBuilt(A_.out);
}
function updateHeader() {
  const P = Store.P, out = A_.out, eng = ENGINES[P.family], t = eng.types[Store.dev.type];
  const b = $('#provBadge'); b.className = 'prov ' + out.prov; b.textContent = PROVENANCE[out.prov];
  $('#ctxLabel').textContent = `${eng.label} · ${t.label} · ${P.meta.anon ? 'anonymisé' : (P.meta.name || 'sans nom')}`;
  $('#btnUndo').disabled = !Store.undo.length; $('#btnRedo').disabled = !Store.redo.length;
}
/* ---------- modes de sélection dans la vue 3D ---------- */
A_.mode = null;
function setMode(m, msg) { A_.mode = m; A_.viewer.pickMode = !!m; hint(m ? msg : ''); $('#bMeasure').classList.toggle('on', !!m && m.kind === 'measure'); }
function onPick(e) {
  const v = A_.viewer, m = A_.mode, out = A_.out; if (!out) return;
  const pickIds = o => !o.noPick && (o.layer === 'anat' || o.layer === 'clean' || o.layer === 'rect');
  if (!m) return;
  if (m.kind === 'measure') {
    const hit = v.pick(e.clientX, e.clientY, o => o.layer !== 'lms' && o.mesh); if (!hit) return;
    A_.measure = A_.measure && A_.measure.length === 1 ? [A_.measure[0], hit.point] : [hit.point];
    A_.measureText = A_.measure.length === 2 ? 'Distance : ' + V.dist(A_.measure[0], A_.measure[1]).toFixed(1) + ' mm' : '';
    updateScene(); return;
  }
  if (m.kind === 'shell') { const hit = v.pick(e.clientX, e.clientY, o => o.layer === 'shell' || o.layer === 'outer'); if (hit) { m.fn(hit); } return; }
  const hit = v.pick(e.clientX, e.clientY, pickIds); if (!hit) { toast('Touchez la surface du modèle (anatomie ou rectifiée visible).'); return; }
  m.fn(hit);
}
/* ---------- boutons de la barre 3D ---------- */
function initViewer() {
  const v = A_.viewer = new Viewer($('#gl')); v.onPick = onPick;
  const fam = () => Store.P ? Store.P.family : 'tt';
  const vv = $('#vViews'); const views = () => fam() === 'trunk' ? [['ant', 'Ant.'], ['post', 'Post.'], ['lat', 'Droite'], ['med', 'Gauche'], ['sup', 'Sup.'], ['inf', 'Inf.']] : [['ant', 'Ant.'], ['post', 'Post.'], ['med', 'Méd.'], ['lat', 'Lat.'], ['sup', 'Sup.'], ['inf', 'Inf.']];
  A_.fillViews = () => { vv.innerHTML = ''; views().forEach(x => vv.append(h('button', { title: 'Vue ' + x[1], onclick: () => v.setView(x[0]) }, x[1]))); };
  A_.fillViews();
  $('#vbar').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'max') setMax(!$('#app').classList.contains('max'));
    else if (a === 'frame') v.frame(v.sceneBounds(o => o.layer !== 'lms' && o.layer !== 'axes'));
    else if (a === 'proj') { v.cam.ortho = !v.cam.ortho; b.textContent = v.cam.ortho ? 'Ortho.' : 'Persp.'; v.dirty = true; }
    else if (a === 'wire') { A_.wire = !A_.wire; b.textContent = A_.wire ? 'Filaire' : 'Solide'; v.objects.forEach(o => { if (o.mesh) o.wire = A_.wire; }); v.dirty = true; A_.wireAll = A_.wire; }
    else if (a === 'axes') { v.showAxes = !v.showAxes; b.classList.toggle('on', v.showAxes); v.dirty = true; }
    else if (a === 'measure') { if (A_.mode && A_.mode.kind === 'measure') { setMode(null); A_.measure = null; A_.measureText = ''; updateScene(); } else { A_.measure = null; A_.measureText = ''; setMode({ kind: 'measure' }, 'Mesure : touchez deux points sur le modèle'); } }
    else if (a === 'layers') { const p = $('#layersPanel'); p.hidden = !p.hidden; $('#secPanel').hidden = true; b.classList.toggle('on', !p.hidden); }
    else if (a === 'section') { const p = $('#secPanel'); p.hidden = !p.hidden; $('#layersPanel').hidden = true; b.classList.toggle('on', !p.hidden); sectionLegend(); }
    else if (a === 'compare') { const seq = ['off', 'avant', 'apres', 'sup']; A_.compare = seq[(seq.indexOf(A_.compare) + 1) % 4]; b.textContent = { off: 'Avant/Après', avant: 'AVANT', apres: 'APRÈS', sup: 'Superposé' }[A_.compare]; b.classList.toggle('on', A_.compare !== 'off'); applyLayers(); }
  });
  $('#secAxis').onchange = () => { const s = $('#secAxis').value; if (s !== 'off') v.clip.axis = s; updateSectionRange(); };
  $('#secPos').oninput = updateSectionRange; $('#secFlip').onclick = () => { v.clip.flip = !v.clip.flip; v.dirty = true; };
  // fil d'Ariane des wire : appliquer le mode filaire aux nouveaux objets
  const origSet = v.set.bind(v); v.set = (id, o) => { const r = origSet(id, o); if (A_.wireAll && r.mesh) r.wire = true; return r; };
  refreshLayersPanel();
}
