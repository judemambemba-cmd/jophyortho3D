/* JophyOrtho 3D — 07 : MOTEUR TRANSFÉMORAL (mesures complètes, indépendant du moteur transtibial) */
'use strict';
ENGINES.tf = {
  id: 'tf', label: 'Prothèse transfémorale', short: 'TF', limb: true, unitNote: 'Y = axe du fémur (proximal +), Z = antérieur, X = latéral. Les mesures se prennent à 0 %, 25 %, 50 %, 75 % et 100 % de la longueur du membre résiduel (périnée → extrémité), depuis l\'extrémité distale ; le niveau « périnée » (100 %) utilise les diamètres AP ischio-Scarpa et ML adducteurs ↔ trochanter.',
  trimDirs: ['ant', 'post', 'med', 'lat'],
  rowLabel(r, m) { if (r.pct != null) return r.pct + ' %' + (r.pct === 0 ? ' · extrémité distale' : r.pct === 100 ? ' · périnée' : '') + ' (' + Math.round(r.pct / 100 * m.lenPer) + ' mm)'; const d = r.y - m.lenPer; return r.y + ' mm' + (Math.abs(d) <= 8 ? ' · périnée' : d > 8 ? ' · périnée +' + Math.round(d) : ' · périnée ' + Math.round(d)); },
  defaults() {
    const L = 300, old = [[0, 66, 64], [.2, 76, 76], [.4, 88, 88], [.6, 100, 100], [.8, 110, 114], [1, 118, 128]];
    const at = (y, i) => { const f = clamp(y / L, 0, 1); let k = 0; while (k < 4 && f > old[k + 1][0]) k++; const t = (f - old[k][0]) / (old[k + 1][0] - old[k][0]); return lerp(old[k][i], old[k + 1][i], t); };
    const rows = [0, 25, 50, 75, 100].map(p => mkRowPct(p, L, Math.round(at(p / 100 * L, 1)), Math.round(at(p / 100 * L, 2))));
    return {
      lenPer: 300, lenTroch: 330, lenContra: 800, footStack: 480, subIsch: 0, apIsch: 0, mlAdd: 0, adductH: 14, gluteH: 30, flex: 0, add: 0, femurRot: 0, softProx: 'normal', softDist: 22, rows,
      distalShape: 'arrondie', firmness: 3, volVar: 3, skin: 'intacte', scars: '', adhesions: 'non', pain: 0, distalTol: 'moyenne'
    };
  },
  fields: [
    { k: 'lenPer', label: 'Longueur périnée → extrémité du membre résiduel', unit: 'mm', min: 120, max: 520, step: 1 },
    { k: 'lenTroch', label: 'Longueur grand trochanter → extrémité', unit: 'mm', min: 130, max: 560, step: 1 },
    { k: 'apIsch', label: 'Diamètre AP ischio-Scarpa (0 = valeur du niveau 100 %)', unit: 'mm', min: 0, max: 170, step: 1 },
    { k: 'mlAdd', label: 'Diamètre ML adducteurs ↔ trochanter (0 = valeur du niveau 100 %)', unit: 'mm', min: 0, max: 170, step: 1 },
    { k: 'subIsch', label: 'Périmètre sous-ischial (0 = non mesuré)', unit: 'mm', min: 0, max: 700, step: 1 },
    { k: 'adductH', label: 'Tendon des adducteurs : distance sous le périnée', unit: 'mm', min: 0, max: 80, step: 1 },
    { k: 'gluteH', label: 'Pli fessier : distance sous le périnée', unit: 'mm', min: 0, max: 100, step: 1 },
    { k: 'flex', label: 'Angle de flexion de hanche', unit: '°', min: 0, max: 50, step: 1 },
    { k: 'add', label: 'Adduction du fémur', unit: '°', min: -10, max: 30, step: 1 },
    { k: 'femurRot', label: 'Orientation du fémur (rotation)', unit: '°', min: -30, max: 30, step: 1 },
    { k: 'softDist', label: 'Épaisseur du capiton distal', unit: 'mm', min: 5, max: 50, step: 1 },
    { k: 'lenContra', label: 'Hauteur périnée → sol, côté sain', unit: 'mm', min: 500, max: 1100, step: 1 },
    { k: 'footStack', label: 'Hauteur genou prothétique + pied + adaptateurs', unit: 'mm', min: 250, max: 700, step: 1 }
  ],
  clinical: [
    { k: 'softProx', label: 'Tissus proximaux', type: 'select', opts: [['normal', 'Normaux'], ['abondant', 'Abondants / roulé adducteur marqué'], ['fibreux', 'Fibreux / peu compliants']] },
    { k: 'distalShape', label: 'Forme distale', type: 'select', opts: [['arrondie', 'Arrondie'], ['conique', 'Conique'], ['plate', 'Plate / tronquée'], ['bulbeuse', 'Bulbeuse']] },
    { k: 'firmness', label: 'Fermeté des tissus (1 mou – 5 ferme)', type: 'range', min: 1, max: 5, step: 1 },
    { k: 'volVar', label: 'Variation de volume observée (%)', type: 'range', min: 0, max: 15, step: 1 },
    { k: 'skin', label: 'État cutané', type: 'select', opts: [['intacte', 'Intacte'], ['fragile', 'Fragile'], ['lesion', 'Lésion / plaie'], ['irritee', 'Irritée / rougeur']] },
    { k: 'adhesions', label: 'Adhérences', type: 'select', opts: [['non', 'Non'], ['oui', 'Oui']] },
    { k: 'pain', label: 'Douleur (0–10)', type: 'range', min: 0, max: 10, step: 1 },
    { k: 'distalTol', label: 'Tolérance distale', type: 'select', opts: [['bonne', 'Bonne'], ['moyenne', 'Moyenne'], ['faible', 'Faible / nulle']] },
    { k: 'scars', label: 'Cicatrices (localisation)', type: 'text' }
  ],
  buildSec(m) {
    m = normRows(m, m.lenPer); const L = m.lenPer, top = L + 30, N = 80, ys = []; for (let i = 0; i < N; i++) ys.push(top * i / (N - 1));
    const rows = m.rows.map(r => Object.assign({}, r)).sort((a, b) => a.y - b.y), capH = clamp(m.softDist + 8, 16, 60), last = rows[rows.length - 1];
    if (last.y < L - 1) { const pm = m.mlAdd > 0 ? m.mlAdd : last.ml * 1.1, pa = m.apIsch > 0 ? m.apIsch : last.ap * 1.15; rows.push(Object.assign({}, last, { y: L, pct: 100, ml: pm, ap: pa, circ: Math.round(ellipsePerimeter(pm, pa)) })); }   // niveau périnée (100 %) : ML adducteurs-trochanter et AP ischio-Scarpa
    else { const l2 = rows[rows.length - 1]; if (m.mlAdd > 0) { l2.ml = m.mlAdd; l2.circ = Math.round(ellipsePerimeter(l2.ml, l2.ap)); } if (m.apIsch > 0) { l2.ap = m.apIsch; l2.circ = Math.round(ellipsePerimeter(l2.ml, l2.ap)); } }
    const tf = Math.tan(rad(m.flex)), ta = Math.tan(rad(m.add)), rowAt = (y, key) => rowInterp(rows, y, key);
    const pad = m.softProx === 'abondant' ? 1.4 : m.softProx === 'fibreux' ? 0.6 : 1;
    return buildSecFrom(ys, y => [rowAt(y, 'dML') - Math.max(L - y, 0) * ta, rowAt(y, 'dAP') + Math.max(L - y, 0) * tf], (y, th) => {
      const ml = rowAt(y, 'ml'), ap = rowAt(y, 'ap'), rot = rowAt(y, 'rot') + m.femurRot, circ = rowAt(y, 'circ');
      const sc = clamp(circ / ellipsePerimeter(ml, ap), 0.8, 1.25);
      let r = superR(ml / 2, ap / 2, th - rad(rot), 2.3) * sc;
      r *= 1 + 0.10 * pad * gAng(th, 270, 30) * maskY(y, 0.55 * L, L + 25, 10);
      r *= 1 + 0.06 * gAng(th, 180, 40) * maskY(y, 0.8 * L, top, 10);
      r *= 1 + 0.05 * gAng(th, 90, 28) * maskY(y, 0.8 * L, top, 8);
      r *= 1 - 0.04 * gAng(th, 335, 20) * maskY(y, 0.85 * L, L + 12, 8);
      return r * capFactor(y, capH, m.distalShape);
    });
  },
  landmarkDefs: [
    { id: 'ischion', label: 'Ischion', y: (L, m) => L - 5, th: 215 },
    { id: 'branche', label: 'Branche ischio-pubienne', y: (L, m) => L - 5, th: 300 },
    { id: 'trochanter', label: 'Grand trochanter', y: (L, m) => m.lenTroch ? Math.min(m.lenTroch, L + 25) : L * 0.93, th: 90 },
    { id: 'scarpa', label: 'Triangle de Scarpa', y: (L, m) => L - 5, th: 335 },
    { id: 'adduct_tendon', label: 'Tendon des adducteurs', y: (L, m) => L - (m.adductH || 14), th: 285 },
    { id: 'canal_add', label: 'Canal des adducteurs', y: (L, m) => L * 0.4, th: 280 },
    { id: 'pli_fessier', label: 'Pli fessier', y: (L, m) => L - (m.gluteH || 30), th: 180 },
    { id: 'perinee', label: 'Périnée', y: (L, m) => L, th: 270, rf: .95 },
    { id: 'femur_end', label: 'Extrémité fémorale', y: (L, m) => 14, th: 0, rf: 0 },
    { id: 'extremite', label: 'Extrémité distale', y: (L, m) => 1, th: 0, rf: 0 }
  ],
  trimRef(m) { return m.lenPer; },
  types: {
    quad: { label: 'Quadrilatérale', desc: 'Entrée proximale quadrangulaire, rapport ML/AP réduit (ML étroit), siège ischiatique postérieur, quatre parois fonctionnelles.', red: 3.0, trim: { ant: 28, post: 0, med: 8, lat: 18 }, flare: 3, susp: ['Valve + bandage de succion', 'Ceinture pelvienne'],
      shape() { return (y, th, L) => { const mk = maskY(y, 0.45 * L, L + 8, 0.25 * L); return mk * (-6 * Math.sin(th) ** 2 + 3.5 * Math.cos(th) ** 2 + 3 * Math.sin(2 * th) ** 2) - 4 * gAng(th, 200, 25) * maskY(y, L - 28, L + 6, 6); }; } },
    ic: { label: 'Contention ischiatique', desc: 'Containment ischio-ramal : paroi médiale plus haute, ML étroit, stabilisation pelvienne, adduction du fémur représentée (préréglage d\'adduction proposé).', red: 3.5, trim: { ant: 20, post: 5, med: 40, lat: 28 }, flare: 2, addPreset: 8, susp: ['Succion / manchon + verrou'],
      shape() { return (y, th, L) => { const mk = maskY(y, 0.4 * L, L + 8, 0.25 * L); return mk * (-9 * Math.sin(th) ** 2 + 4 * Math.cos(th) ** 2) + 3 * gAng(th, 300, 20) * maskY(y, L - 20, L + 5, 5) - 4 * gAng(th, 215, 25) * maskY(y, L - 25, L + 6, 6); }; } },
    mas: { label: 'MAS', desc: 'Contour proximal réduit et anatomique, hauteur/containment adaptés, forme postéro-médiale spécifique.', red: 3.0, trim: { ant: 12, post: 5, med: 15, lat: 12 }, flare: 2, susp: ['Succion / manchon + verrou'],
      shape() { return (y, th, L) => -2.5 * maskY(y, 0.75 * L, L + 8, 0.15 * L) - 5 * gAng(th, 225, 35) * maskY(y, 0.8 * L, L + 5, 8); } },
    subisch: { label: 'Sous-ischiale', desc: 'Bord proximal sous l\'ischion, amplitude de hanche plus libre ; dépend d\'une suspension adaptée.', red: 4.0, trim: { ant: -8, post: -22, med: -28, lat: -10 }, flare: 4, susp: ['Manchon silicone + verrou', 'Succion / vide (indispensable)'],
      shape() { return (y, th, L) => 3 * (gAng(th, 90, 40) + gAng(th, 270, 40)) * maskY(y, 0.8 * L, L + 8, 8); } },
    hifi: { label: 'HiFi', desc: 'Contention longitudinale : alternance de zones de compression et de dégagement (struts/aires de contrôle).', red: 3.5, trim: { ant: 15, post: 3, med: 22, lat: 22 }, flare: 3, susp: ['Succion / manchon + verrou'],
      shape() { return (y, th, L) => 3.2 * Math.cos(6 * th) * maskY(y, 0.25 * L, 0.95 * L, 0.1 * L); } }
  },
  suggest(type, m, lm, dev) {
    const z = (t, id, r, v, c) => lm[id] ? mkZone(t, lm[id], r, v, { landmark: id, comment: c, suggested: true }) : null, out = [];
    const dt = m.distalTol === 'faible' ? 5 : m.distalTol === 'moyenne' ? 3 : 1.5;
    if (type === 'quad') out.push(z('charge', 'ischion', 38, 5, 'Siège ischiatique (appui)'), z('decharge', 'scarpa', 32, 3, 'Dégagement vasculaire (Scarpa)'), z('decharge', 'adduct_tendon', 28, 4, 'Dégagement tendon des adducteurs'), z('stabilisation', 'trochanter', 34, 3, 'Paroi latérale'), z('charge', 'pli_fessier', 34, 3, 'Appui fessier postérieur'));
    else if (type === 'ic') out.push(z('stabilisation', 'ischion', 36, 4, 'Containment ischiatique'), z('stabilisation', 'branche', 30, 4, 'Containment ischio-ramal'), z('stabilisation', 'trochanter', 36, 4, 'Stabilisation pelvienne latérale'), z('decharge', 'scarpa', 30, 3, 'Dégagement vasculaire (Scarpa)'), z('decharge', 'adduct_tendon', 26, 4, 'Dégagement tendon des adducteurs'), z('protection', 'perinee', 28, 3, 'Protection périnéale'));
    else if (type === 'mas') out.push(z('stabilisation', 'ischion', 32, 3, 'Containment postéro-médial'), z('stabilisation', 'trochanter', 32, 3, 'Stabilisation latérale'), z('decharge', 'scarpa', 28, 3, 'Dégagement vasculaire (Scarpa)'), z('decharge', 'adduct_tendon', 26, 3, 'Dégagement tendon des adducteurs'));
    else if (type === 'subisch') out.push(z('decharge', 'ischion', 34, 4, 'Dégagement : bord sous l\'ischion'), z('stabilisation', 'trochanter', 34, 3, 'Stabilisation latérale'), z('stabilisation', 'adduct_tendon', 28, 3, 'Contention médiale'), z('decharge', 'scarpa', 26, 3, 'Dégagement vasculaire (Scarpa)'));
    else if (type === 'hifi') out.push(z('stabilisation', 'ischion', 32, 3, 'Contention longitudinale postéro-médiale'), z('stabilisation', 'trochanter', 32, 3, 'Contention longitudinale latérale'), z('decharge', 'scarpa', 28, 3, 'Dégagement vasculaire (Scarpa)'));
    out.push(z('decharge', 'extremite', 34, dt, 'Tolérance distale : ' + m.distalTol));
    return out.filter(Boolean);
  },
  warnings(m) {
    const w = [];
    m.rows.forEach((r, i) => { const s = circScale(r); if (Math.abs(s - 1) > 0.08) w.push(`Niveau « ${ENGINES.tf.rowLabel(r, m)} » : circonférence ${r.circ} mm incohérente avec ML×AP (écart ${Math.round((s - 1) * 100)} %).`); });
    if (m.subIsch > 0) { const pe = ellipsePerimeter(m.rows[m.rows.length - 1].ml, m.rows[m.rows.length - 1].ap); if (Math.abs(m.subIsch / pe - 1) > 0.1) w.push(`Périmètre sous-ischial saisi (${m.subIsch} mm) différent du périmètre ML×AP du niveau proximal (${Math.round(pe)} mm).`); }
    if (m.flex > 25) w.push('Flexion de hanche > 25° : contracture à documenter ; l\'effet sur la forme est approximatif (cisaillement des sections).');
    if (m.lenTroch && m.lenTroch < m.lenPer) w.push('Longueur trochanter → extrémité inférieure à la longueur périnée → extrémité : incohérent.');
    if (m.lenPer < 180) w.push('Membre résiduel court : choix du type d\'emboîture à confirmer cliniquement.');
    if (m.skin === 'lesion') w.push('Lésion cutanée signalée : aucun essayage sans avis du professionnel responsable.');
    if (m.pain >= 6) w.push('Douleur élevée signalée : vérifier les zones de charge avant tout essayage.');
    if (m.adhesions === 'oui' || m.scars) w.push('Cicatrice/adhérence signalée : envisager une zone « Protection ».');
    if (m.volVar >= 8) w.push('Variation de volume importante : prévoir des essayages multiples.');
    return w;
  }
};
