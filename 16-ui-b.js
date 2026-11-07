/* JophyOrtho 3D — 16 : étapes Type, Zones, Manchon, Coque, Trimlines, Composants, Alignement */
'use strict';
const lmMap = out => { const o = {}; out.landmarkList.forEach(l => o[l.id] = l.pos); return o; };
function proposeZones() {
  const out = A_.out, P = Store.P, eng = ENGINES[P.family], dev = Store.dev; if (!out) return;
  const z = eng.suggest(dev.type, out.m, lmMap(out), dev);
  Store.apply('Zones proposées pour ' + eng.types[dev.type].label, p => { const d = p.dev[p.family]; d.zones = d.zones.filter(x => !x.suggested).concat(z); }, { kind: 'rerender' });
  toast(z.length + ' zones proposées (non appliquées) : à relire puis « Appliquer » dans l\'étape Zones.');
}
STEP.type = {
  label: 'Type d\'appareil', layers: { anat: 1, shell: 1 }, layerAlpha: { anat: .3 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family], dev = Store.dev;
    b.append(h('h2', null, 'Type — ' + eng.label), h('p', { class: 'sub' }, 'Changer de type ne remplace jamais l\'anatomie : seules la rectification, les bords et les formes fonctionnelles sont recalculés. Aucun type n\'est présenté comme supérieur aux autres.'));
    Object.keys(eng.types).forEach(id => {
      const t = eng.types[id], sel = dev.type === id;
      b.append(h('div', { class: 'card2' + (sel ? ' sel' : ''), style: 'cursor:pointer', onclick: () => selectType(id) }, h('b', null, t.label + (sel ? '  ✓' : '')), h('div', { class: 'sub', style: 'margin:3px 0 0' }, t.desc), h('div', { class: 'sub', style: 'margin:2px 0 0;font-size:12px' }, 'Réduction par défaut ' + t.red + ' % · bord : ' + eng.trimDirs.map(k => k + ' ' + (t.trim[k] != null ? t.trim[k] : 0)).join(', '))));
    });
    function selectType(id) {
      if (id === dev.type) return;
      Store.apply('Type d\'appareil : ' + eng.types[id].label, p => {
        const d = p.dev[p.family], t = eng.types[id]; d.type = id; d.redPct = t.red; d.trim = Object.assign({}, t.trim, { smooth: d.trim.smooth, flare: t.flare, fillet: d.trim.fillet });
        if (t.trimB) d.trimB = Object.assign({ ant: 0, post: 0, D: 0, G: 0 }, t.trimB); d.suspension = (t.susp || [''])[0]; d.zones = d.zones.filter(z => !z.suggested);
        if (!eng.limb) { d.openings = d.openings.filter(o => !o.auto); Object.keys(t.open || {}).forEach(k => d.openings.push({ kind: k, th: k === 'post' ? 180 : 0, w: 40, yFrom: 0, auto: true, on: true })); }
      }, { kind: 'rerender' });
    }
    const t = eng.types[dev.type];
    b.append(h('h3', null, 'Rectification globale'), ctl('Réduction volumétrique globale', 'dev.redPct', { type: 'range', min: 0, max: 10, step: 0.1, unit: '%' }));
    if (t.mix) b.append(ctl('Hybride : 0 = corrections locales (PTB) · 1 = contact global (TSB)', 'dev.mix', { type: 'range', min: 0, max: 1, step: 0.05 }));
    b.append(ctl('Suspension (documentaire)', 'dev.suspension', { opts: (t.susp || ['—']).map(s => [s, s]) }));
    if (t.addPreset != null) b.append(h('div', { class: 'info' }, `Ce type s'accompagne souvent d'une adduction du fémur (préréglage ${t.addPreset}°). `, btn('Appliquer ' + t.addPreset + '° d\'adduction', () => Store.apply('Adduction fémorale ' + t.addPreset + '°', p => { p.measures.tf.add = t.addPreset; p.measuresTouched = true; }, { kind: 'rerender' }), 'sm')));
    b.append(h('h3', null, 'Zones fonctionnelles du type'), h('p', { class: 'sub' }, 'Les zones sont proposées, jamais appliquées silencieusement : relisez-les dans l\'étape Zones.'), h('div', { class: 'btns' }, btn('Proposer les zones de ' + t.label, proposeZones, 'p')));
  }
};
/* ---------- zones ---------- */
A_.zoneTool = { type: 'charge', radius: 28, value: 3, transition: 1, priority: 1, comment: '' };
STEP.zones = {
  label: 'Zones charge/décharge', layers: { anat: 1, rect: 1 }, layerAlpha: { anat: .4 },
  render(b) {
    const P = Store.P, dev = Store.dev, T = A_.zoneTool;
    const sel = () => Store.ctx.zoneSel || (Store.ctx.zoneSel = []);
    b.append(h('h2', null, 'Cartographie des zones'), h('p', { class: 'sub' }, 'Deux temps : 1) sélectionnez la zone sur le modèle (elle apparaît en violet, sans aucun effet sur la forme) ; 2) choisissez charge ou décharge, la valeur, puis appliquez UNE SEULE fois à toute la sélection. L\'anatomie reste intacte ; l\'effet apparaît sur le calque « rectifiée » (bouton Avant/Après).'));
    const sl = (label, key, min, max, step, unit) => { const rg = h('input', { type: 'range', min, max, step, value: T[key] }), nm = h('input', { type: 'number', min, max, step, value: T[key] }); rg.oninput = () => { T[key] = +rg.value; nm.value = rg.value; }; nm.oninput = () => { T[key] = +nm.value; rg.value = nm.value; }; return h('div', { class: 'f' }, h('label', null, label + (unit ? ' (' + unit + ')' : '')), h('div', { class: 'rg' }, rg, nm)); };
    // ---- 1. sélection
    const cnt = h('div', { class: 'info', id: 'zSelCount' });
    const refreshCnt = () => { const n = sel().length; cnt.textContent = n ? n + ' point' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '') + ' (violet sur le modèle). Touchez encore pour étendre la zone.' : 'Aucune sélection. Touchez la surface 3D pour sélectionner une zone ; chaque contact ajoute un disque du rayon choisi.'; };
    b.append(h('h3', null, '1. Sélectionner la zone'), sl('Rayon du pinceau', 'radius', 8, 90, 1, 'mm'), cnt,
      h('div', { class: 'btns' }, btn('Retirer le dernier point', () => { sel().pop(); recolorSelection(); refreshCnt(); }, 'sm'), btn('Vider la sélection', () => { Store.ctx.zoneSel = []; recolorSelection(); refreshCnt(); }, 'sm')));
    refreshCnt();
    // ---- 2. application
    const chips = h('div', { class: 'chips' });
    Object.keys(ZONE_TYPES).filter(k => k !== 'selection').forEach(k => { const zt = ZONE_TYPES[k]; chips.append(h('button', { class: 'chip' + (T.type === k ? ' on' : ''), onclick: () => { T.type = k; [...chips.children].forEach(c => c.classList.toggle('on', c.dataset.k === k)); applyBtn.textContent = applyLabel(); }, 'data-k': k }, h('span', { class: 'dot', style: 'background:rgb(' + zt.color.map(x => Math.round(x * 255)) + ')' }), zt.label)); });
    const applyLabel = () => '✔ Appliquer ' + ZONE_TYPES[T.type].label.toLowerCase() + ' à la sélection';
    const applyBtn = btn(applyLabel(), () => {
      const S = sel(); if (!S.length) { toast('Sélectionnez d\'abord une zone sur le modèle.'); return; }
      const gid = 'g' + Date.now().toString(36); let last = null; const pts = S.slice(), tt = Object.assign({}, T);
      Store.apply('Zone ' + ZONE_TYPES[tt.type].label + ' appliquée (' + pts.length + ' point' + (pts.length > 1 ? 's' : '') + ')', p => {
        const d = p.dev[p.family], m = A_.out.lm;
        pts.forEach(pt => { let near = '', nd = 1e9; Object.keys(m).forEach(k => { const dd = V.dist(m[k].pos, pt.pos); if (dd < nd) { nd = dd; near = k; } });
          const nz = mkZone(tt.type, pt.pos, pt.radius, tt.value, { transition: tt.transition, priority: tt.priority, comment: tt.comment, landmark: nd < pt.radius * 1.5 ? near : '', author: p.meta.pro }); nz.group = gid; d.zones.push(nz); last = nz; });
      }, { kind: 'rerender' });
      Store.ctx.zoneSel = []; A_.selZone = null; toast(ZONE_TYPES[tt.type].label + ' appliquée à ' + pts.length + ' point' + (pts.length > 1 ? 's' : '') + ' : voir le calque « rectifiée ».', 5000);
    }, 'p');
    b.append(h('h3', null, '2. Appliquer charge / décharge'), chips, h('p', { class: 'sub' }, 'Charge = réduction locale du volume interne · Décharge = dégagement · Stabilisation = 60 % de la valeur en réduction · Protection = 50 % en dégagement + doublure renforcée.'));
    b.append(sl('Valeur', 'value', 0.5, 15, 0.5, 'mm'), sl('Transition (1 = douce, 3 = franche)', 'transition', 0.5, 3, 0.1), sl('Priorité', 'priority', 1, 5, 1));
    b.append(h('div', { class: 'f' }, h('label', null, 'Commentaire'), h('input', { type: 'text', oninput: e => T.comment = e.target.value, value: T.comment })));
    b.append(applyBtn);
    b.append(h('h3', null, 'Propositions et outils'), h('div', { class: 'btns' }, btn('Proposer les zones du type', proposeZones, 'sm'), btn('Appliquer toutes les zones proposées', () => Store.apply('Zones proposées appliquées', p => p.dev[p.family].zones.forEach(z => { if (z.suggested) { z.suggested = false; z.date = new Date().toISOString(); } }), { kind: 'rerender' }), 'sm'), btn('Effacer toutes les zones', () => { if (confirm('Effacer toutes les zones ?')) Store.apply('Toutes les zones effacées', p => { p.dev[p.family].zones = []; }, { kind: 'rerender' }); }, 'sm d')));
    setMode({ kind: 'zone', fn: hit => { sel().push({ pos: hit.point.map(x => Math.round(x * 10) / 10), radius: T.radius }); recolorSelection(); refreshCnt(); } }, 'Touchez la surface pour sélectionner la zone (étendez par plusieurs contacts)');
    const list = h('div', { id: 'zList' }); b.append(h('h3', null, 'Zones enregistrées'), list);
    const draw = () => {
      list.innerHTML = ''; const zs = Store.dev.zones; if (!zs.length) list.append(note('Aucune zone.'));
      zs.forEach((z, i) => {
        const zt = ZONE_TYPES[z.type], sel = A_.selZone === z.id;
        const card = h('div', { class: 'card2' + (sel ? ' sel' : '') + (z.suggested ? ' sug' : '') }, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('span', { class: 'dot', style: 'background:rgb(' + zt.color.map(x => Math.round(x * 255)) + ')' }), h('b', { style: 'flex:1' }, `${zt.label} · ${z.value} mm · r ${z.radius}`), z.suggested ? h('span', { class: 'tag' }, 'proposée') : null, !z.visible ? h('span', { class: 'tag' }, 'masquée') : null),
          z.comment || z.landmark ? h('div', { class: 'sub', style: 'margin:2px 0' }, (z.landmark ? '[' + z.landmark + '] ' : '') + z.comment) : null,
          h('div', { class: 'btns' }, btn(sel ? 'Fermer' : 'Éditer', () => { A_.selZone = sel ? null : z.id; updateScene(); draw(); }, 'sm'), z.suggested ? btn('Appliquer', () => Store.apply('Zone appliquée', p => { const q = p.dev[p.family].zones[i]; q.suggested = false; q.date = new Date().toISOString(); }, { kind: 'rerender' }), 'sm p') : null,
            btn(z.visible ? 'Masquer' : 'Afficher', () => Store.apply('Zone ' + (z.visible ? 'masquée' : 'affichée'), p => { const q = p.dev[p.family].zones[i]; q.visible = !q.visible; }, { kind: 'rerender' }), 'sm'), btn('Supprimer', () => { Store.apply('Zone supprimée', p => { p.dev[p.family].zones.splice(i, 1); }, { kind: 'rerender' }); }, 'sm d'), z.group ? btn('Supprimer le groupe', () => Store.apply('Groupe de zones supprimé', p => { p.dev[p.family].zones = p.dev[p.family].zones.filter(q => q.group !== z.group); }, { kind: 'rerender' }), 'sm d') : null));
        if (sel) { const pre = 'dev.zones.' + i + '.'; card.append(ctl('Type', pre + 'type', { opts: Object.keys(ZONE_TYPES).filter(k => k !== 'selection').map(k => [k, ZONE_TYPES[k].label]) }), ctl('Rayon', pre + 'radius', { type: 'range', min: 8, max: 90, step: 1, unit: 'mm' }), ctl('Valeur', pre + 'value', { type: 'range', min: 0.5, max: 15, step: 0.5, unit: 'mm' }), ctl('Transition', pre + 'transition', { type: 'range', min: 0.5, max: 3, step: 0.1 }), ctl('Priorité', pre + 'priority', { type: 'range', min: 1, max: 5, step: 1 }), ctl('Commentaire', pre + 'comment', { type: 'text' })); }
        list.append(card);
      });
    };
    STEP.zones.onBuilt = () => { if (!list.querySelector('input')) draw(); }; draw();
    STEP.zones.redraw = draw; STEP.zones.leave = () => { setMode(null); A_.selZone = null; Store.ctx.zoneSel = []; recolorSelection(); };
  }
};
/* ---------- manchon ---------- */
STEP.manchon = {
  label: 'Manchon / doublure', layers: { rect: 1, liner: 1 }, layerAlpha: { liner: .8 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family];
    b.append(h('h2', null, 'Manchon / doublure'), h('p', { class: 'sub' }, 'Objet 3D distinct de l\'anatomie : sa surface interne suit la rectification, sa surface externe est décalée le long des normales.'));
    b.append(ctl('Activer le manchon / la doublure', 'dev.liner.on', { type: 'check', rerender: true }));
    if (!Store.dev.liner.on) { b.append(note('Manchon désactivé : la coque est directement décalée de la rectification (+ jeu fonctionnel).')); return; }
    b.append(ctl('Matériau', 'dev.liner.material', { opts: [['silicone', 'Silicone'], ['gel', 'Gel'], ['polyurethane', 'Polyuréthane'], ['tpe', 'TPE'], ['mousse', 'Mousse (Pelite…)']] }), ctl('Dureté Shore A (documentaire)', 'dev.liner.shore', { type: 'range', min: 5, max: 80, step: 1 }));
    b.append(ctl('Épaisseur générale', 'dev.liner.tGen', { type: 'range', min: 0.5, max: 12, step: 0.1, unit: 'mm' }), ctl('Épaisseur proximale', 'dev.liner.tProx', { type: 'range', min: 0.5, max: 12, step: 0.1, unit: 'mm' }), ctl('Épaisseur distale (gradient distal → proximal lissé)', 'dev.liner.tDist', { type: 'range', min: 0.5, max: 14, step: 0.1, unit: 'mm' }));
    b.append(ctl('Poche souple distale (surépaisseur)', 'dev.liner.pocket', { type: 'range', min: 0, max: 10, step: 0.5, unit: 'mm' }), ctl('Renfort / protection locale (ajouté sur les zones « Protection »)', 'dev.liner.reinf', { type: 'range', min: 0, max: 4, step: 0.5, unit: 'mm' }), ctl('Dépassement du manchon au-dessus du bord de coque', 'dev.liner.extra', { type: 'range', min: 0, max: 40, step: 1, unit: 'mm' }));
    b.append(ctl('Ventilation du manchon (indication documentaire, non modélisée)', 'dev.liner.vent', { type: 'range', min: 0, max: 100, step: 5, unit: '%' }), ctl('Texture interne (indication documentaire, non modélisée)', 'dev.liner.texture', { opts: [['lisse', 'Lisse'], ['textile', 'Textile'], ['micro', 'Micro-alvéolée']] }));
    const st = h('dl', { class: 'kv' }); b.append(h('h3', null, 'Volumes'), st);
    STEP.manchon.onBuilt = o => { st.innerHTML = ''; st.append(h('dt', null, 'Volume du manchon'), h('dd', null, o.stats.volLiner + ' cm³'), h('dt', null, 'Volume anatomie rectifiée'), h('dd', null, o.stats.volRect + ' cm³')); }; if (A_.out) STEP.manchon.onBuilt(A_.out);
    b.append(note('Utilisez « Coupe » dans la barre 3D (plan transversal) pour visualiser l\'épaisseur ; la transparence se règle dans « Calques ».'));
  }
};
/* ---------- coque ---------- */
STEP.coque = {
  label: 'Coque et épaisseur', layers: { liner: 1, shell: 1 }, layerAlpha: { liner: .5 },
  render(b) {
    const dev = Store.dev;
    b.append(h('h2', null, 'Coque'), h('p', { class: 'sub' }, 'Paroi épaisse fermée : surface intérieure, surface extérieure, bords, fermeture distale (membres). Toute modification est recalculée immédiatement.'));
    b.append(ctl('Matériau', 'dev.shell.material', { opts: [['composite', 'Composite stratifié'], ['carbone', 'Fibre de carbone'], ['thermo', 'Thermoformé (PP/PE)'], ['resine', 'Résine / impression 3D']] }), ctl('Jeu fonctionnel (coque ↔ doublure/anatomie)', 'dev.shell.gap', { type: 'range', min: 0, max: 8, step: 0.1, unit: 'mm' }));
    b.append(ctl('Épaisseur générale', 'dev.shell.tGen', { type: 'range', min: 1, max: 12, step: 0.1, unit: 'mm' }), ctl('Épaisseur proximale', 'dev.shell.tProx', { type: 'range', min: 1, max: 12, step: 0.1, unit: 'mm' }), ctl('Épaisseur distale', 'dev.shell.tDist', { type: 'range', min: 1, max: 15, step: 0.1, unit: 'mm' }));
    b.append(ctl('Structure ajourée (0 = pleine)', 'dev.shell.lattice', { type: 'range', min: 0, max: 100, step: 5, unit: '%' }), ctl('Rayon de raccordement du bord (approximation : amincissement du bord)', 'dev.trim.fillet', { type: 'range', min: 0, max: 6, step: 0.5, unit: 'mm' }));
    b.append(h('h3', null, 'Renforts localisés'), h('p', { class: 'sub' }, 'Touchez la coque pour ajouter une surépaisseur locale.'));
    const rf = { r: 25, v: 3 };
    const sl = (label, key, min, max) => { const rg = h('input', { type: 'range', min, max, step: 1, value: rf[key] }), nm = h('input', { type: 'number', min, max, step: 1, value: rf[key] }); rg.oninput = () => { rf[key] = +rg.value; nm.value = rg.value; }; nm.oninput = () => { rf[key] = +nm.value; rg.value = nm.value; }; return h('div', { class: 'f' }, h('label', null, label), h('div', { class: 'rg' }, rg, nm)); };
    b.append(sl('Rayon du renfort (mm)', 'r', 8, 80), sl('Surépaisseur (mm)', 'v', 1, 10), h('div', { class: 'btns' }, btn('Placer un renfort (toucher la coque)', () => setMode({ kind: 'shell', fn: hit => { Store.apply('Renfort ajouté', p => { p.dev[p.family].shell.reinf.push({ id: 'r' + Date.now().toString(36), pos: hit.point.map(x => Math.round(x * 10) / 10), radius: rf.r, value: rf.v, visible: true }); }, { kind: 'rerender' }); setMode(null); } }, 'Touchez la coque pour placer le renfort'), 'p sm')));
    dev.shell.reinf.forEach((r, i) => b.append(h('div', { class: 'card2' }, h('b', null, `Renfort ${i + 1} · +${r.value} mm · r ${r.radius}`), h('div', { class: 'btns' }, btn(r.visible ? 'Désactiver' : 'Activer', () => Store.apply('Renfort basculé', p => { const q = p.dev[p.family].shell.reinf[i]; q.visible = !q.visible; }, { kind: 'rerender' }), 'sm'), btn('Supprimer', () => Store.apply('Renfort supprimé', p => { p.dev[p.family].shell.reinf.splice(i, 1); }, { kind: 'rerender' }), 'sm d')))));
    const st = h('dl', { class: 'kv' }); b.append(h('h3', null, 'Contrôle'), st);
    STEP.coque.onBuilt = o => { st.innerHTML = ''; st.append(h('dt', null, 'Volume de coque (matériau)'), h('dd', null, o.stats.volShell + ' cm³'), h('dt', null, 'Volume externe (enveloppe)'), h('dd', null, o.stats.volOuter + ' cm³'), h('dt', null, 'Étanchéité de la paroi'), h('dd', null, o.shellClosed.closed ? 'Fermée' : 'Ouverte (découpes) : ' + o.shellClosed.open + ' arêtes libres')); }; if (A_.out) STEP.coque.onBuilt(A_.out);
    STEP.coque.leave = () => setMode(null);
  }
};
/* ---------- trimlines ---------- */
STEP.trim = {
  label: 'Trimlines et ouvertures', layers: { shell: 1, trim: 1, anat: 0 }, layerAlpha: { shell: .9 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family], dev = Store.dev, t = eng.types[dev.type], lab = k => (eng.trimLabels ? eng.trimLabels[k] : { ant: 'Antérieur', post: 'Postérieur', med: 'Médial', lat: 'Latéral' }[k]);
    b.append(h('h2', null, 'Trimlines — ' + t.label), h('p', { class: 'sub' }, 'Décalages du bord (mm, + = plus haut) propres au type choisi. Chaque curseur ne modifie que son côté ; les côtés intermédiaires sont interpolés.'));
    b.append(h('h3', null, eng.bothEnds ? 'Bord supérieur' : 'Bord proximal'));
    eng.trimDirs.forEach(k => b.append(ctl('Contour ' + lab(k).toLowerCase(), 'dev.trim.' + k, { type: 'range', min: -90, max: 120, step: 1, unit: 'mm' })));
    if (eng.bothEnds) { b.append(h('h3', null, 'Bord inférieur (décalage, + = plus haut)')); eng.trimDirs.forEach(k => b.append(ctl('Contour ' + lab(k).toLowerCase(), 'dev.trimB.' + k, { type: 'range', min: -60, max: 80, step: 1, unit: 'mm' }))); }
    b.append(ctl('Lissage des bords (passes)', 'dev.trim.smooth', { type: 'range', min: 0, max: 8, step: 1 }), ctl('Évasement du bord', 'dev.trim.flare', { type: 'range', min: 0, max: 12, step: 0.5, unit: 'mm' }));
    b.append(btn('Rétablir les trimlines du type', () => Store.apply('Trimlines du type rétablies', p => { const d = p.dev[p.family], tt = ENGINES[p.family].types[d.type]; d.trim = Object.assign({}, tt.trim, { smooth: d.trim.smooth, flare: tt.flare, fillet: d.trim.fillet }); if (tt.trimB) d.trimB = Object.assign({ ant: 0, post: 0, D: 0, G: 0 }, tt.trimB); }, { kind: 'rerender' }), 'sm'));
    b.append(h('h3', null, 'Ouvertures, bivalve, fenêtres'));
    const add = o => Store.apply('Ouverture ajoutée : ' + o.kind, p => { p.dev[p.family].openings.push(Object.assign({ on: true }, o)); }, { kind: 'rerender' });
    const lim = eng.limb;
    b.append(h('div', { class: 'btns' }, btn('Ouverture antérieure', () => add({ kind: 'ant', th: 0, w: 40, yFrom: 0 }), 'sm'), btn('Ouverture postérieure', () => add({ kind: 'post', th: 180, w: 40, yFrom: 0 }), 'sm'), btn('Ouverture latérale', () => add({ kind: 'lat', th: 90, w: 40, yFrom: 0 }), 'sm'), btn('Bivalve (coque en 2 valves)', () => add({ kind: 'bivalve', w: 6, yFrom: 0 }), 'sm'),
      btn('Fenêtre (toucher la coque)', () => placeWindow('fenetre'), 'sm p'), btn('Découpe libre (toucher la coque)', () => placeWindow('libre'), 'sm p')));
    function placeWindow(kind) { setMode({ kind: 'shell', fn: hit => { const sec = A_.out.rs, c = sec.cAt(hit.point[1]), th = Math.round(deg(Math.atan2(hit.point[0] - c[0], hit.point[2] - c[1]) + 2 * Math.PI) % 360); add({ kind: 'fenetre', free: kind === 'libre', th, y: Math.round(hit.point[1] - sec.y0), w: 18, h: kind === 'libre' ? 30 : 20 }); setMode(null); } }, 'Touchez la coque pour centrer la ' + (kind === 'libre' ? 'découpe' : 'fenêtre')); }
    dev.openings.forEach((o, i) => {
      const pre = 'dev.openings.' + i + '.', card = h('div', { class: 'card2' }, h('b', null, `${i + 1}. ${{ ant: 'Ouverture antérieure', post: 'Ouverture postérieure', lat: 'Ouverture latérale', bivalve: 'Bivalve', fenetre: o.free ? 'Découpe libre' : 'Fenêtre' }[o.kind]}${o.auto ? ' (défaut du type)' : ''}`));
      if (o.kind === 'fenetre') card.append(ctl('Angle du centre (0° = antérieur)', pre + 'th', { type: 'range', min: 0, max: 359, step: 1, unit: '°' }), ctl('Hauteur du centre depuis la base', pre + 'y', { type: 'range', min: 0, max: 600, step: 1, unit: 'mm' }), ctl('Demi-largeur', pre + 'w', { type: 'range', min: 5, max: 80, step: 1, unit: 'mm' }), ctl('Demi-hauteur', pre + 'h', { type: 'range', min: 5, max: 120, step: 1, unit: 'mm' }));
      else { card.append(ctl('Largeur de la fente', pre + 'w', { type: 'range', min: 2, max: 120, step: 1, unit: 'mm' }), ctl('Début depuis la base (hauteur)', pre + 'yFrom', { type: 'range', min: 0, max: 600, step: 1, unit: 'mm' })); if (o.kind === 'lat') card.append(ctl('Angle', pre + 'th', { type: 'range', min: 0, max: 359, step: 1, unit: '°' })); }
      card.append(h('div', { class: 'btns' }, btn(o.on === false ? 'Activer' : 'Désactiver', () => Store.apply('Ouverture basculée', p => { const q = p.dev[p.family].openings[i]; q.on = q.on === false; }, { kind: 'rerender' }), 'sm'), btn('Supprimer', () => Store.apply('Ouverture supprimée', p => { p.dev[p.family].openings.splice(i, 1); }, { kind: 'rerender' }), 'sm d')));
      b.append(card);
    });
    b.append(note('Les ouvertures retirent des éléments de paroi (résolution de la grille) : approximation visuelle, non calculée en résistance.', 'warn'));
    STEP.trim.leave = () => setMode(null);
  }
};
/* ---------- composants ---------- */
STEP.comp = {
  label: 'Composants', layers: { shell: 1, liner: 1, comps: 1 }, layerAlpha: { shell: .55 },
  render(b) {
    const P = Store.P, eng = ENGINES[P.family], dev = Store.dev, c = dev.conn;
    if (!eng.limb) {
      b.append(h('h2', null, 'Composants du corset'), h('p', { class: 'sub' }, 'Sangles, coussinets, extensions et dégagements. Les sangles sont des représentations schématiques (non exportées en STL).'));
      b.append(ctl('Nombre de sangles', 'dev.trunk.straps', { type: 'range', min: 0, max: 6, step: 1 }), ctl('Coussinets (générés sur les zones Charge/Stabilisation appliquées)', 'dev.trunk.pads', { type: 'check' }), ctl('Extension axillaire latérale (+ haut)', 'dev.trunk.axExt', { type: 'range', min: 0, max: 60, step: 1, unit: 'mm' }), ctl('Extension trochantérienne (+ bas)', 'dev.trunk.trochExt', { type: 'range', min: 0, max: 60, step: 1, unit: 'mm' }), ctl('Dégagement costal antérieur (relief)', 'dev.trunk.ribRelief', { type: 'range', min: 0, max: 15, step: 0.5, unit: 'mm' }));
      if (eng.types[dev.type].superstructure) b.append(note('Milwaukee : anneau cervical et trois montants métalliques générés automatiquement au-dessus du sommet de l\'anatomie.'));
      b.append(note('Fenêtres, ouvertures et bivalve : étape « Trimlines et ouvertures ».'));
      return;
    }
    b.append(h('h2', null, 'Connecteur distal — pièce unique avec l\'emboîture'), h('p', { class: 'sub' }, 'Le connecteur est intégré à la coque : le fond de l\'emboîture est supprimé, la cavité descend jusqu\'au connecteur (vide sous le moignon pour insérer les vis depuis l\'intérieur) et coque + connecteur forment une seule pièce. Réglez la hauteur entre le bas du moignon et la face haute du connecteur inséré.'));
    b.append(ctl('Type', 'dev.conn.type', { opts: CONNECTOR_TYPES, rerender: true, after: (p, v) => { if (v !== 'aucun') setTimeout(() => { setLayerPreset({ shell: 1, liner: 1, comps: 1, axes: 0, alpha: { shell: .55 } }); A_.viewer.setView('inf'); A_.viewer.frame(A_.viewer.sceneBounds(o => o.layer !== 'lms' && o.layer !== 'axes')); }, 30); } }));
    if (c.type !== 'aucun') {
      if (c.type !== 'valve') b.append(ctl('Hauteur bas du moignon → connecteur inséré', 'dev.conn.h', { type: 'range', min: 5, max: 120, step: 0.5, unit: 'mm' }), ctl('Profondeur d\'insertion du connecteur dans l\'embase', 'dev.conn.ins', { type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm' }));
      b.append(ctl('Décalage AP du connecteur', 'dev.conn.ap', { type: 'range', min: -40, max: 40, step: 0.5, unit: 'mm' }), ctl('Décalage ML du connecteur', 'dev.conn.ml', { type: 'range', min: -40, max: 40, step: 0.5, unit: 'mm' }));
      b.append(ctl('Rotation autour de l\'axe', 'dev.conn.rot', { type: 'range', min: -180, max: 180, step: 1, unit: '°' }), ctl('Inclinaison sagittale', 'dev.conn.tilt', { type: 'range', min: -25, max: 25, step: 0.5, unit: '°' }), ctl('Inclinaison frontale', 'dev.conn.tiltAb', { type: 'range', min: -25, max: 25, step: 0.5, unit: '°' }));
      b.append(ctl('Rayon de la plaque', 'dev.conn.plateR', { type: 'range', min: 18, max: 55, step: 1, unit: 'mm' }), ctl('Échelle des dimensions', 'dev.conn.size', { type: 'range', min: 0.7, max: 1.4, step: 0.05 }), ctl('Matériau', 'dev.conn.material', { opts: [['alu', 'Aluminium'], ['acier', 'Acier inox'], ['titane', 'Titane'], ['composite', 'Composite']] }));
      const st = h('div', { id: 'connChk' }); b.append(st);
      STEP.comp.onBuilt = o => { st.innerHTML = ''; const f = o.fused; if (!f) return; const m = o.m; const rest = m.lenContra ? Math.round(m.lenContra - (m.lenMTP || m.lenPer || 0) - c.h - c.ins - (m.footStack || 0)) : null;
        st.append(note(`Embase fusionnée : bas du moignon → face haute du connecteur ${Math.round(c.h * 10) / 10} mm · fond de l\'emboîture supprimé : vide de ${Math.round(f.void * 10) / 10} mm sous la doublure pour les têtes de vis · cavité Ø ${Math.round(f.Rin * 2)} mm jusqu\'au connecteur · dalle de ${c.ins} mm. Export « Pièce unique » disponible.`, f.g > .5 ? 'info' : 'err'));
        if (rest != null) st.append(note('Longueur de tube résiduelle (longueur controlatérale − longueur résiduelle − hauteur − insertion − pied/adaptateurs) : ' + rest + ' mm.', rest < 0 ? 'warn' : 'info')); if (Math.hypot(c.ml, c.ap) > c.plateR + 20) st.append(note('Décalage important par rapport à l\'axe de l\'emboîture : vérifier la fixation.', 'warn')); }; if (A_.out) STEP.comp.onBuilt(A_.out);
      b.append(btn('Voir le dessous (vue inférieure)', () => { A_.viewer.setView('inf'); }, 'sm'));
    }
  }
};
/* ---------- alignement ---------- */
STEP.align = {
  label: 'Alignement', layers: { anat: 1, shell: 1, comps: 1, axes: 1 }, layerAlpha: { anat: .3, shell: .5 },
  render(b) {
    const P = Store.P, tt = P.family === 'tt';
    b.append(h('h2', null, 'Alignement géométrique'), h('p', { class: 'sub' }, 'Transformation de l\'axe mécanique par rapport à l\'emboîture (pivot = point distal). Le connecteur étant solidaire de la coque, seul l\'axe est transformé. Paramètres géométriques.'));
    b.append(ctl('Flexion (+) / extension (−)', 'dev.align.flex', { type: 'range', min: -20, max: 30, step: 0.5, unit: '°' }), ctl('Abduction (+) / adduction (−)', 'dev.align.abd', { type: 'range', min: -20, max: 20, step: 0.5, unit: '°' }), ctl('Rotation interne / externe', 'dev.align.rot', { type: 'range', min: -30, max: 30, step: 0.5, unit: '°' }), ctl('Translation AP', 'dev.align.ap', { type: 'range', min: -40, max: 40, step: 0.5, unit: 'mm' }), ctl('Translation ML', 'dev.align.ml', { type: 'range', min: -40, max: 40, step: 0.5, unit: 'mm' }));
    b.append(h('div', { class: 'btns' }, btn('Réinitialiser l\'alignement', () => Store.apply('Alignement réinitialisé', p => { p.dev[p.family].align = { flex: 0, abd: 0, rot: 0, ap: 0, ml: 0 }; }, { kind: 'rerender' }), 'sm')));
    b.append(h('h3', null, 'Axes affichés'), h('div', { class: 'legend', style: 'display:grid;gap:3px' }, h('span', null, '⬜ blanc : axe mécanique neutre (avant)'), h('span', { style: 'color:#ffa040' }, '▬ orange : axe mécanique transformé (après)'), h('span', { style: 'color:#e64de6' }, '▬ magenta : axe ' + (tt ? 'tibial' : 'fémoral') + ' (centroïdes des sections)'), h('span', { style: 'color:#33e6ff' }, '▬ cyan : axe du connecteur')));
    const tr = h('pre', { style: 'background:var(--bg2);padding:8px;border-radius:8px;font-size:11px;overflow:auto' }); b.append(h('h3', null, 'Transformation (matrice 4×4)'), tr);
    STEP.align.onBuilt = o => { if (!o.alignMatrix) return; const m = o.alignMatrix; let s = ''; for (let r = 0; r < 4; r++) s += [0, 1, 2, 3].map(c => (m[c * 4 + r]).toFixed(3).padStart(9)).join(' ') + '\n'; tr.textContent = s; }; if (A_.out) STEP.align.onBuilt(A_.out);
    b.append(note('L\'alignement agit sur l\'axe mécanique affiché ; il n\'affecte pas la pièce unique coque + connecteur.', 'info'));
  }
};
