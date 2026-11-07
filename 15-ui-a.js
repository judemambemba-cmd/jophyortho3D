/* JophyOrtho 3D — 15 : étapes Dossier, Acquisition, Mesures, Repères */
'use strict';
const STEP = {};
STEP.dossier = {
  label: 'Dossier patient', layers: { anat: 1, rect: 0 },
  render(b) {
    const P = Store.P;
    b.append(h('h2', null, 'Dossier patient'), h('p', { class: 'sub' }, 'Données d\'identification et contexte clinique. Elles restent dans ce navigateur (IndexedDB) ; rien n\'est envoyé sur un serveur.'));
    b.append(ctl('Identifiant du dossier', 'meta.id'), ctl('Référence', 'meta.ref'), ctl('Nom ou pseudonyme du patient', 'meta.name', { after: () => 0 }));
    b.append(h('div', { class: 'row2' }, ctl('Date', 'meta.date', { type: 'date' }), P.family === 'trunk' ? h('div') : ctl('Côté', 'meta.side', { opts: [['D', 'Droit'], ['G', 'Gauche']] })));
    b.append(h('div', { class: 'row3' }, ctl('Âge', 'meta.age', { type: 'number', min: 0, max: 110 }), ctl('Poids (kg)', 'meta.weight', { type: 'number', min: 0, max: 300 }), ctl('Taille (cm)', 'meta.height', { type: 'number', min: 0, max: 250 })));
    b.append(ctl('Niveau d\'activité', 'meta.activity'), ctl('Profession', 'meta.profession'), ctl('Environnement (terrain, domicile…)', 'meta.env'), ctl('Objectifs', 'meta.goals', { type: 'textarea' }), ctl('Prescription', 'meta.prescription', { type: 'textarea' }), ctl('Observations', 'meta.obs', { type: 'textarea' }), ctl('Professionnel responsable', 'meta.pro'));
    b.append(ctl('Anonymiser les données (masque le nom, la référence et le professionnel dans les exports, le rapport et la liste des dossiers)', 'meta.anon', { type: 'check', rerender: true }));
    b.append(note('Le côté est documentaire : le repère 3D utilise toujours X+ = latéral pour les membres (X+ = droite du patient pour le tronc).'));
  }
};
/* ---------- import de scan ---------- */
async function decodeImageFile(file) {
  const bmp = await createImageBitmap(file), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  const c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(bmp, 0, 0); const d = c2.getImageData(0, 0, bmp.width, bmp.height); return { w: bmp.width, h: bmp.height, data: d.data };
}
/* Import : un ou plusieurs fichiers. Sélectionnez ensemble le .obj, son .mtl et les images de texture pour conserver les textures. */
async function importScanFiles(files) {
  try {
    const ext = f => f.name.split('.').pop().toLowerCase(), meshes = files.filter(f => ['obj', 'ply', 'stl'].includes(ext(f))).sort((a, b) => ['obj', 'ply', 'stl'].indexOf(ext(a)) - ['obj', 'ply', 'stl'].indexOf(ext(b)));
    if (!meshes.length) { toast('Sélectionnez un fichier de scan (.stl, .obj, .ply), avec son .mtl et ses images pour les textures.', 6000); return; }
    const file = meshes[0], ctx = { mtl: null, images: new Map() }; let missing = [];
    if (ext(file) === 'obj') {
      const mtlF = files.find(f => ext(f) === 'mtl'); if (mtlF) ctx.mtl = await mtlF.text();
      const imgs = files.filter(f => ['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext(f)));
      for (const f of imgs) ctx.images.set(f.name.toLowerCase(), await decodeImageFile(f));
      const need = ctx.mtl ? [...new Set(Object.values(parseMTL(ctx.mtl)).map(m => m.map).filter(Boolean))] : []; missing = need.filter(n => !ctx.images.has(n));
    }
    const mesh = await parseMeshFile(file, ctx), b = mesh.bounds(), mx = Math.max(...b.size);
    Store.ctx.scan = { original: mesh, name: file.name };
    let unit = 'mm', scale = 1, msg = '';
    if (mx < 3) { scale = 1000; msg = ' Dimensions < 3 : unité supposée en mètres (×1000). À vérifier.'; } else if (mx < 60) { unit = 'cm'; msg = ' Dimensions < 60 : unité supposée en centimètres. À vérifier.'; }
    if (mesh.c) msg += mesh.textured ? ' Texture appliquée (couleurs de sommets).' : ' Couleurs du scan conservées.';
    else if (ext(file) === 'stl') msg += ' Le format STL ne contient pas de couleur : utilisez OBJ + texture ou PLY couleur pour conserver l\'aspect.';
    if (missing.length) msg += ' Texture(s) manquante(s) : ' + missing.join(', ') + ' — sélectionnez aussi les images avec le .obj.';
    Store.apply('Import du scan « ' + file.name + ' »', P => {
      P.acq.mode = P.acq.mode === 'measures' ? 'scan' : P.acq.mode; P.acq.scanName = file.name; P.acq.orient = guessOrientation(mesh); P.acq.unit = unit; P.acq.scale = scale; P.acq.repair = false; P.acq.flipNormals = false; P.acq.cuts = []; P.acq.sel = null;
      P.acq.scanInfo = { nv: mesh.nv, nt: mesh.nt, size: b.size.map(x => Math.round(x * 100) / 100), colors: !!mesh.c }; P.landmarks = {};
    }, { kind: 'rerender' });
    A_.frameNext = true; toast('Scan importé (' + mesh.nv.toLocaleString(LOC()) + ' sommets, ' + mesh.nt.toLocaleString(LOC()) + ' triangles).' + msg, 8000);
  } catch (e) { console.error(e); toast('Import impossible : ' + e.message, 6000); }
}
const importScanFile = f => importScanFiles([f]);
const AXES = [['+X', '+X'], ['-X', '−X'], ['+Y', '+Y'], ['-Y', '−Y'], ['+Z', '+Z'], ['-Z', '−Z']];

/* ---------- Coupe par plan (inspirée de « Plane Cut » de Meshmixer) ---------- */
A_.cut = A_.cut || { h: null, tS: 0, tF: 0, ox: null, oz: null, keep: 'below', fill: 'flat' };
function cutPlane() {
  const sc = Store.ctx.scan, c = A_.cut; if (!sc || !sc.work) return null;
  const b = sc.work.bounds(); if (c.h == null) c.h = Math.round(b.max[1] * 0.5); if (c.ox == null) { c.ox = (b.min[0] + b.max[0]) / 2; c.oz = (b.min[2] + b.max[2]) / 2; }
  const S = rad(c.tS), F = rad(c.tF), n = V.norm([Math.sin(F), Math.cos(F) * Math.cos(S), Math.cos(F) * Math.sin(S)]);
  return { o: [c.ox, c.h, c.oz], n, b };
}
function updateCutPreview() {
  const v = A_.viewer, sc = Store.ctx.scan, pl = cutPlane(), on = A_.cutOn && pl && Store.P.acq.mode !== 'measures';
  if (!on) { putMesh('cutdrop', 'anat', null); putMesh('cutplane', 'anat', null); v.dirty = true; return; }
  const drop = planeCut(sc.work, pl.o, pl.n, A_.cut.keep === 'above' ? 'below' : 'above', 'none');
  putMesh('cutdrop', 'anat', drop.nt ? drop : null, [.95, .2, .2], { noClip: true, noPick: true, baseAlpha: .6 });
  // quadrilatère du plan (double face)
  const sz = Math.max(pl.b.size[0], pl.b.size[2]) * 0.75 + 20, u = Math.abs(pl.n[1]) < .9 ? [0, 1, 0] : [1, 0, 0], e1 = V.norm(V.cross(pl.n, u)), e2 = V.cross(pl.n, e1), q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(k => V.add(pl.o, V.add(V.mul(e1, k[0] * sz), V.mul(e2, k[1] * sz))));
  const vt = new Float32Array(q.flat()); putMesh('cutplane', 'anat', new Mesh(vt, new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2])), [.3, .6, 1], { noClip: true, noPick: true, baseAlpha: .35 }); v.dirty = true;
  const el = document.getElementById('cutInfo'); if (el) el.textContent = `Partie supprimée (en rouge) : ${drop.nt.toLocaleString(LOC())} triangles sur ${sc.work.nt.toLocaleString(LOC())}.`;
}
function cutPanel(b, P, sc) {
  if (!sc || !sc.work) return; const c = A_.cut, fam = P.family; b.append(h('span', { id: 'cutRoot' }));
  b.append(h('h3', null, 'Coupe par plan (Plane Cut)'), h('p', { class: 'sub' }, fam === 'trunk' ? 'Supprimez ce qui n\'est pas le tronc (jambes, tête, bras, support…) : placez le plan, choisissez le côté à conserver — la partie supprimée apparaît en rouge — puis appliquez. L\'original n\'est jamais modifié ; chaque coupe est annulable.' : 'Supprimez ce qui n\'est pas le moignon (genou, cuisse, jambe saine, support…) : placez le plan, choisissez le côté à conserver — la partie supprimée apparaît en rouge — puis appliquez. L\'original n\'est jamais modifié ; chaque coupe est annulable.'));
  const stop = () => { A_.cutOn = false; updateCutPreview(); };
  const mk = (label, key, min, max, step, unit) => { const pl = cutPlane(), id = 'cut_' + key; const lab = h('div', { class: 'f' }, h('label', null, label + ' (' + unit + ')'), h('div', { class: 'rg' }, h('input', { type: 'range', id: id + 'r', min, max, step, value: c[key], oninput: e => { c[key] = +e.target.value; document.getElementById(id + 'n').value = c[key]; A_.cutOn = true; updateCutPreview(); } }), h('input', { type: 'number', id: id + 'n', min, max, step, value: c[key], onchange: e => { c[key] = +e.target.value; document.getElementById(id + 'r').value = c[key]; A_.cutOn = true; updateCutPreview(); } }))); return lab; };
  const pl = cutPlane(), H = Math.ceil(pl.b.max[1]);
  b.append(mk('Hauteur du plan (depuis la base)', 'h', 0, H, 1, 'mm'), mk('Inclinaison sagittale (avant/arrière)', 'tS', -60, 60, 0.5, '°'), mk('Inclinaison frontale (droite/gauche)', 'tF', -60, 60, 0.5, '°'));
  b.append(ctl_sel('Côté à conserver', c, 'keep', [['below', 'En dessous du plan (distal / bas)'], ['above', 'Au-dessus du plan (proximal / haut)']]), ctl_sel('Remplissage de la section', c, 'fill', [['flat', 'Plat (ferme la section)'], ['none', 'Aucun (laisse ouvert)']]));
  b.append(ctl('Ne garder que la plus grande pièce après la coupe (supprime les îlots flottants)', 'acq.cutLargest', { type: 'check' }));
  b.append(h('div', { class: 'btns' },
    btn('Aperçu / afficher le plan', () => { A_.cutOn = true; updateCutPreview(); }, 'sm'),
    btn('Placer le plan en touchant le modèle', () => { A_.cutOn = true; setMode({ kind: 'cutpoint', fn: hit => { c.h = Math.round(hit.point[1]); c.ox = hit.point[0]; c.oz = hit.point[2]; document.getElementById('cut_hr').value = c.h; document.getElementById('cut_hn').value = c.h; updateCutPreview(); setMode(null); } }, 'Touchez la surface pour y placer le plan'); }, 'sm'),
    btn('Recentrer le plan', () => { c.ox = c.oz = null; updateCutPreview(); }, 'sm')));
  b.append(h('div', { class: 'info', id: 'cutInfo' }, 'Déplacez le plan : la partie qui sera supprimée apparaît en rouge.'));
  b.append(h('div', { class: 'btns' }, btn('✂ Appliquer la coupe', () => {
    const p = cutPlane(), sig = JSON.stringify([P.acq.orient, P.acq.unit, P.acq.scale]), sh = sc.shift || [0, 0, 0];
    A_.cutOn = false; Store.apply('Coupe par plan', q => { q.acq.cuts = (q.acq.cuts || []).filter(k => k.sig === sig); q.acq.cuts.push({ o: [p.o[0] - sh[0], p.o[1] - sh[1], p.o[2] - sh[2]].map(x => Math.round(x * 1000) / 1000), n: p.n.map(x => Math.round(x * 1e6) / 1e6), keep: c.keep, fill: c.fill, sig, label: (c.keep === 'below' ? 'garde dessous' : 'garde dessus') + ' · h=' + Math.round(c.h) + ' mm' + (c.tS || c.tF ? ' · incl. ' + c.tS + '°/' + c.tF + '°' : '') }); }, { kind: 'rerender' }); c.h = null; c.ox = null; toast('Coupe appliquée. Annulable avec ↶ ou depuis la liste.');
  }, 'p')));
  const cuts = (P.acq.cuts || []).filter(k => k.sig === JSON.stringify([P.acq.orient, P.acq.unit, P.acq.scale]));
  if (cuts.length) b.append(h('h3', null, 'Coupes appliquées'), ...cuts.map((k, i) => h('div', { class: 'card2', style: 'display:flex;align-items:center;gap:8px' }, h('span', { style: 'flex:1' }, (i + 1) + '. ' + k.label), btn('Supprimer', () => Store.apply('Coupe supprimée', q => { const ks = q.acq.cuts.filter(z => z.sig === k.sig); q.acq.cuts.splice(q.acq.cuts.indexOf(k), 1); }, { kind: 'rerender' }), 'sm d'))));
  if (P.acq.cuts && P.acq.cuts.length > cuts.length) b.append(note('Des coupes enregistrées avec une autre orientation/échelle sont ignorées : définissez l\'orientation avant de couper.', 'warn'));
  if (sc.cutLog && sc.cutLog.some(l => l.info && (l.info.holes || l.info.open))) b.append(note('Une section présente des trous ou des contours ouverts : le remplissage plat ne les ferme pas (voir les arêtes ouvertes).', 'warn'));
  if (sc.cutLog && sc.cutLog.some(l => l.shells)) b.append(note('Des pièces flottantes ont été supprimées après la coupe.', 'info'));
  if (A_.cutOn) setTimeout(updateCutPreview, 0);
}
function ctl_sel(label, obj, key, opts) { return h('div', { class: 'f' }, h('label', null, label), h('select', { onchange: e => { obj[key] = e.target.value; A_.cutOn = true; updateCutPreview(); } }, opts.map(o => h('option', { value: o[0], selected: obj[key] === o[0] ? true : null }, o[1])))); }

STEP.acq = {
  label: 'Acquisition', layers: { anat: 1, clean: 1 },
  leave() { A_.cutOn = false; if (A_.viewer) updateCutPreview(); },
  render(b) {
    const P = Store.P, sc = Store.ctx.scan;
    b.append(h('h2', null, 'Acquisition anatomique'), h('p', { class: 'sub' }, 'Le scan est la référence principale. Le maillage original est conservé tel quel ; toutes les opérations travaillent sur des copies.'));
    b.append(ctl('Mode d\'acquisition', 'acq.mode', { opts: [['scan', 'Scan 3D'], ['measures', 'Mesures (reconstruction paramétrique)'], ['hybrid', 'Hybride (scan + mesures de contrôle)']], rerender: true }));
    if (P.acq.mode === 'measures') b.append(note('Mode Mesures : la géométrie est reconstruite à partir des mesures saisies (étape suivante). Saisissez les mesures du patient à l\'étape suivante.', 'info'));
    b.append(h('div', { class: 'btns' }, btn('Importer un scan (STL, OBJ+texture, PLY couleur)…', () => $('#fileScan').click(), 'p'), sc ? btn('Retirer le scan', () => { Store.ctx.scan = null; Store.apply('Retrait du scan', p => { p.acq.mode = 'measures'; p.acq.scanName = ''; p.acq.scanInfo = null; }, { kind: 'rerender' }); }, 'd') : null));
    if (!sc) { b.append(note(P.acq.scanName ? `Le scan « ${P.acq.scanName} » n'est pas chargé dans cette session (non inclus dans le fichier). Réimportez-le pour reprendre la géométrie réelle.` : 'Aucun scan chargé. Formats pris en charge : STL ASCII, STL binaire, OBJ, PLY.', 'info')); return; }
    const info = h('div', { id: 'scanInfo' }); b.append(info);
    b.append(h('h3', null, 'Échelle et unité'), h('div', { class: 'row2' }, ctl('Unité du fichier', 'acq.unit', { opts: [['mm', 'Millimètres'], ['cm', 'Centimètres']] }), ctl('Facteur d\'échelle', 'acq.scale', { type: 'number', step: 0.001, min: 0.001, max: 10000 })));
    b.append(h('h3', null, 'Orientation anatomique'), h('p', { class: 'sub' }, 'Indiquez, dans les axes du fichier, la direction proximale, antérieure et latérale. Les trois axes doivent être distincts.'));
    b.append(h('div', { class: 'row3' }, ctl('Proximal (↑)', 'acq.orient.up', { opts: AXES }), ctl('Antérieur', 'acq.orient.ant', { opts: AXES }), ctl('Latéral', 'acq.orient.lat', { opts: AXES })));
    b.append(h('div', { class: 'btns' }, btn('Orientation automatique (suggestion)', () => Store.apply('Orientation automatique', p => { p.acq.orient = guessOrientation(Store.ctx.scan.original); }, { kind: 'rerender' }), 'sm'), btn('Inverser proximal/distal', () => Store.apply('Inversion proximal/distal', p => { const o = p.acq.orient; o.up = (o.up[0] === '+' ? '-' : '+') + o.up[1]; }, { kind: 'rerender' }), 'sm'), btn('Inverser antérieur/postérieur', () => Store.apply('Inversion antérieur/postérieur', p => { const o = p.acq.orient; o.ant = (o.ant[0] === '+' ? '-' : '+') + o.ant[1]; }, { kind: 'rerender' }), 'sm'), btn('Inverser médial/latéral', () => Store.apply('Inversion médial/latéral', p => { const o = p.acq.orient; o.lat = (o.lat[0] === '+' ? '-' : '+') + o.lat[1]; }, { kind: 'rerender' }), 'sm')));
    b.append(h('h3', null, 'Qualité et réparation (non destructive)'), ctl('Inverser les normales (copie de travail)', 'acq.flipNormals', { type: 'check' }), ctl('Réparer : orientation cohérente des faces + suppression des triangles dégénérés (crée l\'anatomie nettoyée)', 'acq.repair', { type: 'check', rerender: true }),
      ctl('Lissage des sections extraites', 'acq.smooth', { opts: [[0, 'Aucun'], [1, 'Léger (1 passe)'], [2, 'Moyen (2 passes)'], [3, 'Fort (3 passes)']], num: true }),
      h('div', { class: 'btns' }, btn('Afficher / masquer les limites du maillage ouvert', () => { A_.showOpen = !A_.showOpen; updateScene(); }, 'sm'), btn('Retour au scan importé (annuler orientation/réparation)', () => Store.apply('Retour au scan importé', p => { p.acq.orient = guessOrientation(Store.ctx.scan.original); p.acq.repair = false; p.acq.flipNormals = false; p.acq.scale = 1; p.acq.unit = 'mm'; p.acq.smooth = 1; p.acq.cuts = []; p.acq.sel = null; p.landmarks = {}; }, { kind: 'rerender' }), 'sm')));
    b.append(note('Étape suivante : « Sélection » — vous peindrez sur le modèle 3D la seule partie à conserver (moignon ou tronc).', 'info'));
    b.append(note('Limite : les sections sont extraites en supposant des contours « étoilés » autour de l\'axe. Les contre-dépouilles ne sont pas représentées. L\'anatomie rectifiée est donc une approximation du scan (voir README).', 'warn'));
    STEP.acq.onBuilt = out => {
      const st = out.scanStats; if (!st) { info.innerHTML = ''; return; }
      const sz = out.cleaned.bounds().size.map(x => x.toFixed(1)), orig = Store.ctx.scan.original;
      info.innerHTML = ''; info.append(h('h3', null, 'Contrôles du scan'), h('dl', { class: 'kv' }, h('dt', null, 'Sommets / triangles'), h('dd', null, `${orig.nv.toLocaleString(LOC())} / ${orig.nt.toLocaleString(LOC())}`), h('dt', null, 'Dimensions (ML × H × AP)'), h('dd', null, `${sz[0]} × ${sz[1]} × ${sz[2]} mm`), h('dt', null, 'Étanchéité'), h('dd', null, st.closed ? 'Fermé' : `Ouvert : ${st.open} arêtes libres, ${st.nonManifold} non-manifold`), h('dt', null, 'Normales'), h('dd', null, st.flipped ? 'Inversées (volume signé < 0)' : 'Cohérentes'), h('dt', null, 'Volume'), h('dd', null, st.closed ? Math.round(Math.abs(st.signedVolume) / 1000) + ' cm³' : 'non fiable (maillage ouvert)')));
      if (Store.ctx.scan.error) info.append(note(Store.ctx.scan.error, 'err'));
      if (Store.ctx.scan.original.c) info.append(note('Couleurs / texture du scan conservées à l\'écran, à travers les coupes et l\'orientation. Export couleur : PLY (étape Export).', 'info'));
    };
    if (A_.out) STEP.acq.onBuilt(A_.out);
  }
};
/* ---------- mesures ---------- */
function setRowVal(i, k, val) {
  const eng0 = ENGINES[Store.P.family];
  Store.apply('Mesure ' + eng0.rowLabel(Store.P.measures[Store.P.family].rows[i], Store.P.measures[Store.P.family]) + ' (' + k + ')', P => {
    const m = P.measures[P.family], r = m.rows[i]; r[k] = val; P.measuresTouched = true;
    if (m.circAuto !== false && (k === 'ml' || k === 'ap') && k !== 'circ') { r.circ = Math.round(ellipsePerimeter(r.ml, r.ap)); const el = document.getElementById('circ' + i); if (el) el.value = r.circ; }
    const last = m.rows[m.rows.length - 1]; if ('mlProx' in m) { m.mlProx = last.ml; m.apProx = last.ap; }
  });
}
function sortRows(P) { const m = P.measures[P.family]; m.rows.sort((a, b) => (a.pct != null && b.pct != null ? a.pct - b.pct : a.y - b.y)); }
STEP.mesures = {
  label: 'Mesures', layers: { anat: 1, axes: 0 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family], m = P.measures[P.family];
    b.append(h('h2', null, 'Mesures — ' + eng.label), h('p', { class: 'sub' }, eng.unitNote));
    if (P.acq.mode !== 'measures' && Store.ctx.scan) b.append(note('Avec un scan, les mesures servent à contrôler l\'échelle et les sections, à documenter le dossier et à signaler les incohérences ; elles ne remplacent pas le scan.'));
    else b.append(note('Sans scan, la forme est reconstruite de façon paramétrique à partir des mesures saisies.', 'info'));
    eng.fields.forEach(f => {
      const row = f.row;
      if (row) { const el = ctl(f.label, 'm.' + f.k, { type: 'range', min: f.min, max: f.max, step: f.step, unit: f.unit, after: (p, v) => { const mm = p.measures[p.family], r = mm.rows[mm.rows.length - 1]; r[row[1]] = v; if (mm.circAuto !== false) r.circ = Math.round(ellipsePerimeter(r.ml, r.ap)); const c = document.getElementById('circ' + (mm.rows.length - 1)); if (c) c.value = r.circ; const t = document.getElementById('c_' + (mm.rows.length - 1) + '_' + row[1]); if (t) t.value = v; } }); b.append(el); }
      else b.append(ctl(f.label, 'm.' + f.k, { type: 'range', min: f.min, max: f.max, step: f.step, unit: f.unit }));
    });
    b.append(h('h3', null, 'Niveaux de mesure'), ctl('Circonférence calculée automatiquement depuis ML×AP (décocher pour saisir la circonférence mesurée)', 'm.circAuto', { type: 'check', rerender: true, after: (p, v) => { if (v) p.measures[p.family].rows.forEach(r => r.circ = Math.round(ellipsePerimeter(r.ml, r.ap))); } }));
    if (m.circAuto === undefined) m.circAuto = true;
    const limb = !!eng.limb, Lm = P.family === 'tt' ? m.lenPT : m.lenPer, yOf = r => r.pct != null && limb ? Math.round(r.pct / 100 * Lm * 10) / 10 : r.y;
    const cols = [limb ? ['pct', 'Niveau (% longueur)', '%'] : ['y', 'Haut. (mm)', 'mm'], ['circ', 'Circ.', 'mm'], ['ml', limb ? 'ML' : 'Larg.', 'mm'], ['ap', limb ? 'AP' : 'Prof.', 'mm'], ['rot', 'Rot.', '°'], ['dAP', 'Déc.AP', 'mm'], ['dML', 'Déc.ML', 'mm'], ['red', 'Réd. %', '%']];
    b.append(h('p', { class: 'sub' }, (limb ? 'Les mesures se prennent à 0 %, 25 %, 50 %, 75 % et 100 % de la longueur du membre résiduel (' + (P.family === 'tt' ? 'tendon rotulien → extrémité' : 'périnée → extrémité') + '), mesurée depuis l\'extrémité distale (0 % = extrémité distale, 100 % = ' + (P.family === 'tt' ? 'niveau du tendon rotulien' : 'périnée') + '). La hauteur en mm est calculée automatiquement. ' : 'Hauteur = distance depuis le bas du corset (0 = base, bord inférieur au niveau du trochanter). ') + 'Chaque niveau peut recevoir sa propre réduction (% de rayon) ; la réduction globale reste réglable à l\'étape Type.'));
    const tb = h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'Niveau'), limb ? h('th', null, 'Hauteur') : null, cols.map(c => h('th', null, c[1])), h('th', null, '')));
    m.rows.forEach((r, i) => tb.append(h('tr', null, h('td', null, eng.rowLabel(r, m)), limb ? h('td', null, yOf(r) + ' mm') : null, cols.map(c => h('td', null, h('input', { type: 'number', id: c[0] === 'circ' ? 'circ' + i : 'c_' + i + '_' + c[0], value: r[c[0]], step: c[0] === 'red' ? 0.5 : 1, 'aria-label': eng.rowLabel(r, m) + ' · ' + c[1], onfocus: e => e.target.select(), onkeydown: e => { if (e.key === 'Enter') e.target.blur(); }, onchange: e => { if (e.target.value === '') { e.target.value = r[c[0]]; return; } const lim = { pct: [0, 100], y: [0, 2000], circ: [0, 2500], ml: [0, 1000], ap: [0, 1000], rot: [-90, 90], dAP: [-100, 100], dML: [-100, 100], red: [0, 30] }[c[0]]; const v = Math.min(lim[1], Math.max(lim[0], +e.target.value)); e.target.value = v;
          const wasAuto = Store.P.measures[Store.P.family].circAuto !== false; setRowVal(i, c[0], v);
          if (c[0] === 'y' || c[0] === 'pct') Store.apply('Tri des niveaux', P => sortRows(P), { kind: 'rerender' }); else if (c[0] === 'circ' && wasAuto) Store.apply('Circonférence saisie', P => { P.measures[P.family].circAuto = false; }, { kind: 'rerender' }); } }))), h('td', null, m.rows.length > (limb ? 5 : 4) && !(limb && (r.pct === 0 || r.pct === 100)) ? btn('✕', () => Store.apply('Niveau supprimé', P => { P.measures[P.family].rows.splice(i, 1); P.measuresTouched = true; }, { kind: 'rerender' }), 'sm d') : null))));
    b.append(h('div', { class: 'tw' }, tb));
    b.append(btn('+ Ajouter un niveau de mesure', () => Store.apply('Niveau ajouté', P => {
      const mm = P.measures[P.family], rr = mm.rows; let gi = 0, gap = -1; for (let i = 0; i < rr.length - 1; i++) if (rr[i + 1].y - rr[i].y > gap) { gap = rr[i + 1].y - rr[i].y; gi = i; }
      const a = rr[gi], c = rr[gi + 1], y = Math.round((a.y + c.y) / 2), t = .5, mix = k => Math.round((a[k] + (c[k] - a[k]) * t) * 10) / 10;
      const nr = mkRow(y, mix('ml'), mix('ap'), mix('rot'), mix('dAP'), mix('dML'), mix('red')); if (a.pct != null && c.pct != null) nr.pct = Math.round((a.pct + c.pct) / 2 * 10) / 10; rr.splice(gi + 1, 0, nr); P.measuresTouched = true;
    }, { kind: 'rerender' }), 'sm'));
    b.append(h('h3', null, 'Données cliniques'));
    eng.clinical.forEach(f => b.append(f.type === 'select' ? ctl(f.label, 'm.' + f.k, { opts: f.opts }) : f.type === 'range' ? ctl(f.label, 'm.' + f.k, { type: 'range', min: f.min, max: f.max, step: f.step }) : ctl(f.label, 'm.' + f.k, { type: 'text' })));
    b.append(btn('Rétablir les valeurs par défaut', () => Store.apply('Mesures par défaut', p => { p.measures[p.family] = ENGINES[p.family].defaults(); p.measuresTouched = false; }, { kind: 'rerender' }), 'sm'));
    const w = h('div', { id: 'mWarn' }); b.append(h('h3', null, 'Contrôles de cohérence'), w);
    STEP.mesures.onBuilt = out => { w.innerHTML = ''; (out.warnings.length ? out.warnings : ['Aucune incohérence détectée automatiquement (cela ne vaut pas validation).']).forEach(t => w.append(note(t, out.warnings.length ? 'warn' : 'info'))); };
    if (A_.out) STEP.mesures.onBuilt(A_.out);
  }
};
/* ---------- repères ---------- */
STEP.reperes = {
  label: 'Repères', layers: { anat: 1, lms: 1 }, layerAlpha: { anat: .85 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family];
    b.append(h('h2', null, 'Repères anatomiques'), h('p', { class: 'sub' }, 'Choisissez un repère puis touchez la surface pour le placer. Les positions « reconstruction/estimation » sont des propositions à vérifier ; un repère placé manuellement passe en « manuel ».'));
    const list = h('div', { id: 'lmList' }); b.append(list);
    const draw = () => {
      list.innerHTML = ''; const out = A_.out; if (!out) return;
      out.landmarkList.forEach(l => {
        const sel = A_.selLm === l.id;
        list.append(h('div', { class: 'card2' + (sel ? ' sel' : '') }, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('span', { class: 'dot', style: 'background:' + (l.source === 'manuel' ? '#33e6ff' : '#ff9933') }), h('b', { style: 'flex:1' }, l.label), h('span', { class: 'tag' }, l.source)),
          h('div', { class: 'btns' }, btn(sel && A_.mode && A_.mode.kind === 'landmark' ? 'En attente du toucher…' : 'Placer sur le modèle', () => selectLandmark(l.id), 'sm p'), btn('Centrer', () => { A_.selLm = l.id; A_.viewer.cam.target = l.pos.slice(); A_.viewer.dirty = true; updateScene(); draw(); }, 'sm'), l.source === 'manuel' ? btn('Revenir à la proposition', () => Store.apply('Repère ' + l.label + ' réinitialisé', p => { delete p.landmarks[l.id]; }), 'sm') : null)));
      });
    };
    function selectLandmark(id) { A_.selLm = id; setMode({ kind: 'landmark', fn: hit => { Store.apply('Repère placé : ' + eng.landmarkDefs.find(d => d.id === id).label, p => { p.landmarks[id] = { pos: hit.point.map(x => Math.round(x * 10) / 10), source: 'manuel' }; });
      const defs = eng.landmarkDefs, k = defs.findIndex(d => d.id === id); if (k < defs.length - 1) { selectLandmark(defs[k + 1].id); } else { setMode(null); } } }, 'Touchez la surface pour placer : ' + eng.landmarkDefs.find(d => d.id === id).label); draw(); }
    b.append(h('div', { class: 'btns' }, btn('Terminer le placement', () => { setMode(null); A_.selLm = null; updateScene(); draw(); }, 'sm'), btn('Tout réinitialiser', () => Store.apply('Repères réinitialisés', p => { p.landmarks = {}; }), 'sm d')));
    STEP.reperes.onBuilt = draw; draw();
    STEP.reperes.leave = () => { setMode(null); A_.selLm = null; };
  }
};
