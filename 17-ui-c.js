/* JophyOrtho 3D — 17 : Confort, Essayages, Export, navigation, écran de démarrage, démarrage de l'application */
'use strict';
const COMFORT_ITEMS = [['skin', 'État cutané'], ['scars', 'Cicatrices'], ['pain', 'Douleur'], ['sensitive', 'Zones sensibles'], ['firmness', 'Fermeté des tissus'], ['volume', 'Variation de volume'], ['sweat', 'Transpiration'], ['heat', 'Chaleur'], ['pressure', 'Pression ressentie'], ['piston', 'Pistonnement'], ['rotation', 'Rotation'], ['stability', 'Stabilité'], ['donning', 'Facilité d\'enfilage'], ['autonomy', 'Autonomie']];
const CSTATUS = [['na', 'Non évalué'], ['ok', 'Satisfaisant'], ['watch', 'À surveiller'], ['bad', 'Problème signalé']];
STEP.confort = {
  label: 'Dossier de confort', layers: { anat: 1, shell: 1 }, layerAlpha: { shell: .4 },
  render(b) {
    const P = Store.P; COMFORT_ITEMS.forEach(i => { if (!P.comfort.items[i[0]]) P.comfort.items[i[0]] = 'na'; });
    b.append(h('h2', null, 'Dossier de confort prévisionnel'), note('Aucun « score scientifique » n\'est calculé : il n\'existe pas ici de modèle validé. Cet écran liste des données saisies, les données manquantes, les points à vérifier et les risques signalés.', 'warn'));
    COMFORT_ITEMS.forEach(i => b.append(ctl(i[1], 'comfort.items.' + i[0], { opts: CSTATUS, rerender: true })));
    b.append(ctl('Score de confort ressenti (0–10, saisi par le patient)', 'comfort.score', { type: 'range', min: 0, max: 10, step: 1 }), ctl('Commentaires du patient', 'comfort.comment', { type: 'textarea' }), ctl('Observations du professionnel', 'comfort.pro', { type: 'textarea' }));
    const missing = COMFORT_ITEMS.filter(i => P.comfort.items[i[0]] === 'na').map(i => i[1]), watch = COMFORT_ITEMS.filter(i => P.comfort.items[i[0]] === 'watch').map(i => i[1]), bad = COMFORT_ITEMS.filter(i => P.comfort.items[i[0]] === 'bad').map(i => i[1]);
    b.append(h('h3', null, 'Synthèse'), h('div', { class: 'card2' }, h('b', null, 'Données manquantes (' + missing.length + ')'), h('div', { class: 'sub' }, missing.join(', ') || 'aucune')), h('div', { class: 'card2' }, h('b', null, 'Points à vérifier'), h('div', { class: 'sub' }, watch.join(', ') || 'aucun signalé'), h('div', { id: 'cWarn' })), h('div', { class: 'card2' }, h('b', null, 'Risques signalés'), h('div', { class: 'sub' }, bad.join(', ') || 'aucun signalé')));
    const ev = P.trials.filter(t => t.score != null).map((t, i) => `essai ${P.trials.indexOf(t) + 1} : ${t.score}/10`);
    b.append(h('div', { class: 'card2' }, h('b', null, 'Évolution entre les essayages'), h('div', { class: 'sub' }, ev.length ? ev.join(' → ') : 'Aucun score d\'essayage enregistré')));
    STEP.confort.onBuilt = o => { const w = $('#cWarn'); if (!w) return; w.innerHTML = ''; o.warnings.forEach(t => w.append(h('div', { class: 'sub' }, '• ' + t))); }; if (A_.out) STEP.confort.onBuilt(A_.out);
  }
};
/* ---------- photos ---------- */
function readPhoto(file, cb) { const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { const s = Math.min(1, 520 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); cb(c.toDataURL('image/jpeg', .72)); }; img.onerror = () => toast('Image illisible'); img.src = url; }
STEP.essais = {
  label: 'Essayages', layers: { anat: 1, rect: 0, shell: 1, lms: 1 }, layerAlpha: { shell: .45 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family];
    b.append(h('h2', null, 'Boucle d\'essayage'), h('p', { class: 'sub' }, 'Chaque essayage enregistre un instantané de la géométrie (type, zones, coque…) auquel on peut revenir.'));
    b.append(h('div', { class: 'btns' }, btn('+ Nouvel essayage', () => Store.apply('Nouvel essayage', p => { p.trials.push({ id: 't' + Date.now().toString(36), date: new Date().toISOString().slice(0, 10), score: null, pain: [], red: [], press: [], loose: [], tight: [], piston: 'non', rotation: 'non', stability: '', gait: '', comment: '', changes: '', photos: [], flags: [], snap: { family: p.family, dev: JSON.parse(JSON.stringify(p.dev[p.family])), measures: JSON.parse(JSON.stringify(p.measures[p.family])) } }); }, { kind: 'rerender' }), 'p')));
    if (!P.trials.length) b.append(note('Aucun essayage. Sans essayage réel, aucune validation n\'est possible.', 'warn'));
    const labels = ['Essai 1', 'Corrections', 'Essai 2', 'Corrections', 'Validation finale'];
    P.trials.forEach((t, i) => {
      const pre = 'trials.' + i + '.', card = h('div', { class: 'card2' }, h('b', null, `Essayage ${i + 1} — ${labels[Math.min(i, 4)] || ''}`));
      card.append(h('div', { class: 'row2' }, ctl('Date', pre + 'date', { type: 'date' }), ctl('Confort (0–10)', pre + 'score', { type: 'number', min: 0, max: 10, step: 1 })));
      const zoneChips = (key, label) => { const box = h('div', { class: 'f' }, h('div', { class: 'lb' }, label)), ch = h('div', { class: 'chips' }); eng.landmarkDefs.forEach(d => { const on = t[key].includes(d.id); ch.append(h('button', { class: 'chip' + (on ? ' on' : ''), style: 'min-height:32px;padding:3px 9px;font-size:12px', onclick: () => Store.apply('Essayage ' + label, p => { const a = p.trials[i][key], k = a.indexOf(d.id); if (k >= 0) a.splice(k, 1); else a.push(d.id); }, { kind: 'rerender' }) }, d.label)); }); box.append(ch); return box; };
      card.append(zoneChips('pain', 'Carte de douleur'), zoneChips('red', 'Rougeurs'), zoneChips('press', 'Pression excessive'), zoneChips('loose', 'Zone trop lâche'), zoneChips('tight', 'Zone trop serrée'));
      card.append(h('div', { class: 'row3' }, ctl('Pistonnement', pre + 'piston', { opts: [['non', 'Non'], ['leger', 'Léger'], ['marque', 'Marqué']] }), ctl('Rotation', pre + 'rotation', { opts: [['non', 'Non'], ['leger', 'Légère'], ['marque', 'Marquée']] }), ctl('Stabilité', pre + 'stability', { opts: [['', '—'], ['bonne', 'Bonne'], ['moyenne', 'Moyenne'], ['faible', 'Faible']] })));
      card.append(ctl(eng.limb ? 'Marche' : 'Posture', pre + 'gait', { type: 'text' }), ctl('Commentaires', pre + 'comment', { type: 'textarea' }), ctl('Modifications décidées', pre + 'changes', { type: 'textarea' }));
      const ph = h('div', { class: 'chips' }); t.photos.forEach((u, k) => ph.append(h('span', null, h('img', { src: u, style: 'height:64px;border-radius:6px;display:block' }), h('button', { class: 'btn sm d', onclick: () => Store.apply('Photo retirée', p => { p.trials[i].photos.splice(k, 1); }, { kind: 'rerender' }) }, '×'))));
      card.append(h('div', { class: 'f' }, h('div', { class: 'lb' }, 'Photos (facultatif, stockées localement)'), ph, btn('+ Photo', () => { A_.photoFor = i; $('#filePhoto').click(); }, 'sm')));
      card.append(h('div', { class: 'btns' }, btn('Revenir à la géométrie de cet essayage', () => { if (confirm('Restaurer la géométrie (type, zones, coque…) de cet essayage ? (annulable)')) Store.apply('Retour à la géométrie de l\'essayage ' + (i + 1), p => { const s = t.snap; p.family = s.family; p.dev[s.family] = JSON.parse(JSON.stringify(s.dev)); p.measures[s.family] = JSON.parse(JSON.stringify(s.measures)); }, { kind: 'rerender' }); }, 'sm p'), btn('Mettre à jour l\'instantané', () => Store.apply('Instantané de l\'essayage mis à jour', p => { p.trials[i].snap = { family: p.family, dev: JSON.parse(JSON.stringify(p.dev[p.family])), measures: JSON.parse(JSON.stringify(p.measures[p.family])) }; }), 'sm'), btn('Supprimer', () => { if (confirm('Supprimer cet essayage ?')) Store.apply('Essayage supprimé', p => { p.trials.splice(i, 1); }, { kind: 'rerender' }); }, 'sm d')));
      b.append(card);
    });
    b.append(ctl('Statut de validation', 'validation.status', { opts: [['Brouillon', 'Brouillon'], ['En essayage', 'En essayage'], ['Modifications demandées', 'Modifications demandées'], ['Validé par le professionnel responsable', 'Validé par le professionnel responsable']] }), ctl('Validé / revu par', 'validation.by', { type: 'text' }));
  }
};
/* ---------- export ---------- */
A_.ack = false;
STEP.export = {
  label: 'Export et rapport', layers: { anat: 0, rect: 0, shell: 1, liner: 1, comps: 1 },
  render(b) {
    const P = Store.P;
    b.append(h('h2', null, 'Export, sauvegarde et rapport'), note('Exportez les fichiers STL, le dossier JSON ou le rapport. « Pièce unique » fusionne la coque et le connecteur en un seul fichier.', 'info'));
    const ex = (t, kind) => { const x = btn(t, () => { const r = exportSTL(Store.P, A_.out, kind); toast(r.msg, 7000); }, ''); return x; };
    b.append(h('h3', null, 'Orientation des fichiers exportés'), ctl('Orientation', 'meta.exportUp', { opts: [['Z', 'Debout : Z vers le haut (CAD, impression 3D, Meshmixer, Blender…) — recommandé'], ['Y', 'Repère de l\'application : Y vers le haut']], op: 'Orientation d\'export' }));
    b.append(h('h3', null, 'STL'), h('div', { class: 'btns' }, ex('Anatomie rectifiée', 'rect'), ex('Manchon', 'liner'), ex('Coque', 'shell'), ex('Pièce unique (coque + connecteur)', 'one'), ex('Assemblage', 'assembly')));
    b.append(h('h3', null, 'Couleur (PLY)'), h('p', { class: 'sub' }, 'Le STL ne peut pas contenir de couleur. Le PLY conserve la texture du scan et les zones colorées (charge, décharge, stabilisation, protection).'), h('div', { class: 'btns' }, btn('Anatomie rectifiée + zones (PLY)', () => toast(exportPLY(Store.P, A_.out, 'rectcolor').msg, 6000), ''), A_.out && (A_.out.cleaned || A_.out.original) ? btn('Scan texturé (PLY)', () => toast(exportPLY(Store.P, A_.out, 'scancolor').msg, 6000), '') : null));
    b.append(h('h3', null, 'Projet'), ctl('Inclure le scan original dans le JSON (peut être volumineux)', 'acq.includeScan', { type: 'check' }));
    b.append(h('div', { class: 'btns' }, btn('Exporter le dossier complet (JSON)', () => { exportProject(Store.P, Store.ctx.scan && Store.ctx.scan.original, !!Store.P.acq.includeScan); toast('Dossier exporté.'); }, 'p'), btn('Enregistrer dans ce navigateur', saveProject, ''), btn('Importer un projet…', () => $('#fileProj').click(), '')));
    b.append(h('h3', null, 'Rapport'), h('div', { class: 'btns' }, btn('Ouvrir le rapport (imprimable / PDF)', () => openReport(false), 'p'), btn('Télécharger le rapport HTML', () => openReport(true), '')));
    b.append(h('h3', null, 'Contrôles'), h('div', { id: 'expChk' }));
    STEP.export.onBuilt = o => { const c = $('#expChk'); if (!c) return; c.innerHTML = ''; c.append(h('dl', { class: 'kv' }, h('dt', null, 'Provenance'), h('dd', null, PROVENANCE[o.prov]), h('dt', null, 'Coque fermée'), h('dd', null, o.shellClosed.closed ? 'oui' : 'non (découpes/ouvertures)'), h('dt', null, 'Triangles'), h('dd', null, o.stats.tris.toLocaleString(LOC())), h('dt', null, 'Avertissements'), h('dd', null, o.warnings.length))); }; if (A_.out) STEP.export.onBuilt(A_.out);
  }
};
async function saveProject() { try { await DB.saveProject(Store.P, Store.ctx.scan && Store.ctx.scan.original); toast('Dossier enregistré dans ce navigateur (IndexedDB).'); } catch (e) { toast('Enregistrement impossible : ' + e.message + ' — utilisez l\'export JSON.', 6000); } }
function openReport(download) {
  const html = I18N.html(buildReport(Store.P, A_.out, A_.viewer.toDataURL())), blob = new Blob([html], { type: 'text/html' });
  if (download) downloadBlob(blob, fileStem(Store.P) + '_rapport.html'); else { const w = window.open(URL.createObjectURL(blob), '_blank'); if (!w) { downloadBlob(blob, fileStem(Store.P) + '_rapport.html'); toast('Fenêtre bloquée : rapport téléchargé.'); } }
}
/* ---------- réinitialisation d'une étape ---------- */
const RESETS = {
  mesures: p => { p.measures[p.family] = ENGINES[p.family].defaults(); p.measures[p.family].circAuto = true; p.measuresTouched = false; },
  zones: p => { p.dev[p.family].zones = []; },
  manchon: p => { p.dev[p.family].liner = defaultDev(p.family, p.dev[p.family].type).liner; },
  coque: p => { const d = p.dev[p.family], n = defaultDev(p.family, d.type); d.shell = n.shell; d.trim.fillet = n.trim.fillet; },
  trim: p => { const d = p.dev[p.family], n = defaultDev(p.family, d.type); d.trim = n.trim; d.trimB = n.trimB; d.openings = []; },
  comp: p => { const d = p.dev[p.family], n = defaultDev(p.family, d.type); d.conn = n.conn; d.trunk = n.trunk; },
  align: p => { p.dev[p.family].align = { flex: 0, abd: 0, rot: 0, ap: 0, ml: 0 }; },
  type: p => { const d = p.dev[p.family], n = defaultDev(p.family, d.type); d.redPct = n.redPct; d.mix = .5; }
};
/* ---------- navigation ---------- */
function stepList() { const P = Store.P; if (ENGINES[P.family].orth) return ['dossier', 'acq', ...(P.acq.mode !== 'measures' ? ['zone', 'cles'] : []), 'mesuresO', 'cover', 'charges', 'orthese', 'exportO']; return [['dossier'], ['acq'], ...(P.acq.mode !== 'measures' ? [['zone'], ['cles']] : []), ['mesures'], ['reperes'], ['type'], ['zones'], ['manchon'], ['coque'], ['trim'], ['comp'], ...(ENGINES[P.family].limb ? [['align']] : []), ['confort'], ['essais'], ['export']].map(x => x[0]); }
A_.step = 0; A_.visited = new Set();
function curStep() { return STEP[stepList()[A_.step]]; }
function renderSteps() {
  const nav = $('#steps'); nav.innerHTML = ''; const L = stepList();
  L.forEach((id, i) => nav.append(h('button', { class: (i === A_.step ? 'cur ' : '') + (A_.visited.has(id) && i !== A_.step ? 'done' : ''), onclick: () => goStep(i), 'aria-current': i === A_.step ? 'step' : null }, h('span', { class: 'n' }, i + 1), h('span', { class: 't' }, STEP[id].label))));
  const cur = nav.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  $('#btnPrev').disabled = A_.step === 0; $('#btnNext').disabled = A_.step === L.length - 1; $('#stepInfo').textContent = `Étape ${A_.step + 1}/${L.length} · ${STEP[L[A_.step]].label}`;
}
function renderPanel(keepScroll) {
  const p = $('#panel'), body = $('#panelBody'), st = p.scrollTop; body.innerHTML = ''; const id = stepList()[A_.step], s = STEP[id];
  try { s.render(body); } catch (e) { console.error(e); body.append(note('Erreur d\'affichage de l\'étape : ' + e.message, 'err')); }
  if (RESETS[id]) body.append(h('div', { class: 'btns', style: 'margin-top:22px' }, btn('Réinitialiser cette étape', () => { if (confirm('Réinitialiser cette étape ? (annulable avec ↶)')) Store.apply('Étape réinitialisée : ' + s.label, RESETS[id], { kind: 'rerender' }); }, 'sm d')));
  p.scrollTop = keepScroll ? st : 0;
}
function goStep(i) {
  const L = stepList(); i = clamp(i, 0, L.length - 1);
  if (Store.P.acq.mode !== 'measures' && Store.ctx.scan) {
    const iz = L.indexOf('zone'), ic = L.indexOf('cles');
    if (iz >= 0 && i > iz && !(Store.P.acq.sel && Store.P.acq.sel.done)) { toast('Validez d\'abord la sélection de la partie à conserver (moignon ou tronc).'); i = iz; }
    else if (ic >= 0 && i > ic && lmsMissing(Store.P).length) { toast('Placez d\'abord les points clés demandés.'); i = ic; }
  }
  const prev = STEP[L[A_.step]]; if (prev && prev.leave) { try { prev.leave(); } catch (e) { /* ignoré */ } }
  setMode(null); A_.curStepId = null; A_.visited.add(L[A_.step]); A_.step = i; const s = STEP[L[i]];
  setLayerPreset(Object.assign({}, s.layers, s.layerAlpha ? { alpha: s.layerAlpha } : {})); A_.compare = 'off'; $('#bCompare').textContent = 'Avant/Après'; $('#bCompare').classList.remove('on'); A_.showOpen = false;
  renderSteps(); renderPanel(false); if (A_.out) { if (s.onBuilt) s.onBuilt(A_.out); updateScene(); }
}
/* ---------- écran de démarrage ---------- */
function loadLoaded(P, scan) { Store.ctx.scan = scan ? { original: scan, name: P.acq.scanName } : null; A_.visited.clear(); A_.step = 0; A_.frameNext = true; Store.load(P); if (!scan && P.acq.scanName) toast('Le scan « ' + P.acq.scanName + ' » n\'est pas inclus : réimportez-le (étape Acquisition).', 7000); }
function showHelp() {
  modal([h('h2', null, 'Limites et fonctionnement'), 
    h('h3', null, 'Fonctions opérationnelles'), h('ul', null, ['Import STL (ASCII/binaire), OBJ, PLY ; orientation, échelle, normales, réparation sur copie, arêtes ouvertes', 'Trois moteurs séparés (transtibial, transfémoral, tronc) : mesures, repères, types, trimlines, composants propres', 'Zones charge/décharge/stabilisation/protection par toucher 3D, effet lissé sur le calque rectifiée', 'Manchon, coque épaisse fermée, renforts, ouvertures, fenêtres, structure ajourée, connecteurs réels, alignement', 'Coupes sagittale/frontale/transversale, mesure, calques, avant/après, annuler/rétablir, historique', 'Export STL (rectifiée, manchon, coque, assemblage), JSON, rapport HTML, sauvegarde IndexedDB'].map(t => h('li', null, t))),
    h('h3', null, 'Approximations de modélisation'), h('ul', null, ['Sections extraites du scan par balayage radial : contre-dépouilles non représentées', 'Reconstruction paramétrique : forme plausible, pas l\'anatomie exacte', 'Épaisseurs par décalage le long des normales ; congés = amincissement du bord ; coupes sans remplissage', 'Alignement/suspension : paramètres géométriques, aucune analyse biomécanique', 'Zones suggérées et règles de types : conventions de départ, ajustables par le professionnel'].map(t => h('li', null, t))),
    h('div', { class: 'btns' }, btn('Fermer', closeModal, 'p'))]);
}
function showHistory() {
  const P = Store.P; modal([h('h2', null, 'Historique des opérations'), h('div', { class: 'btns' }, btn('↶ Annuler', () => { Store.doUndo(); closeModal(); }), btn('↷ Rétablir', () => { Store.doRedo(); closeModal(); })), h('ol', { style: 'font-size:13px' }, P.log.slice(-80).reverse().map(l => h('li', null, `${l.t.slice(11, 19)} — ${l.op}`))), h('div', { class: 'btns' }, btn('Fermer', closeModal, 'p'))]);
}
/* ---------- démarrage ---------- */
function boot() {
  try { initViewer(); } catch (e) { document.body.innerHTML = '<div style="padding:24px;font:16px system-ui;color:#fff">WebGL est indisponible sur cet appareil : JophyOrtho 3D ne peut pas afficher la vue 3D. (' + e.message + ')</div>'; return; }
  A_.onBuilt = out => { const s = curStep(); if (s && s.onBuilt) { try { s.onBuilt(out); } catch (e) { console.error(e); } } if (A_.frameNext) { A_.frameNext = false; A_.viewer.frame(A_.viewer.sceneBounds(o => o.layer !== 'lms' && o.layer !== 'axes')); A_.viewer.setView('ant'); } };
  Store.sub(kind => {
    if (kind === 'load') { A_.fillViews(); renderSteps(); goStep(0); scheduleBuild(); }
    else if (kind === 'rerender') { renderSteps(); renderPanel(true); scheduleBuild(); }
    else scheduleBuild();
    updateHeader && Store.P && A_.out && updateHeader();
  });
  $('#btnPrev').onclick = () => goStep(A_.step - 1); $('#btnNext').onclick = () => goStep(A_.step + 1);
  $('#btnUndo').onclick = () => { const l = Store.doUndo(); if (l) toast('Annulé : ' + l); }; $('#btnRedo').onclick = () => { const l = Store.doRedo(); if (l) toast('Rétabli : ' + l); };
  $('#btnHist').onclick = showHistory; $('#btnHelp').onclick = showHelp; $('#btnSave').onclick = saveProject; $('#btnHome').onclick = showStart;
  $('#fileScan').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importScanFiles(fs); };
  $('#fileProj').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const r = importProjectText(await f.text()); closeModal(); loadLoaded(r.P, r.scan); toast('Projet importé.'); } catch (er) { toast('Import impossible : ' + er.message, 6000); } };
  $('#filePhoto').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (!f || A_.photoFor == null) return; readPhoto(f, u => Store.apply('Photo ajoutée', p => { p.trials[A_.photoFor].photos.push(u); }, { kind: 'rerender' })); };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && Store.P) closeModal(); });
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { if (e.key === 'z') { e.preventDefault(); Store.doUndo(); } else if (e.key === 'y') { e.preventDefault(); Store.doRedo(); } } });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('service-worker.js').catch(() => { });
  // projet de démonstration initial (gabarit non spécifique) pour que la vue ne soit jamais vide
  const P0 = newProject('tt'); P0.measures.tt.circAuto = P0.measures.tf.circAuto = P0.measures.trunk.circAuto = true; Store.load(P0); showStart();
}
window.addEventListener('DOMContentLoaded', boot);
