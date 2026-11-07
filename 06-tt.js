/* JophyOrtho 3D — 06 : MOTEUR TRANSTIBIAL (mesures complètes, repères, reconstruction, types d'emboîture, zones suggérées) */
'use strict';
ENGINES.tt = {
  id: 'tt', label: 'Prothèse transtibiale', short: 'TT', limb: true, unitNote: 'Y = axe tibial (proximal +), Z = antérieur, X = latéral. Les mesures se prennent à 0 %, 25 %, 50 %, 75 % et 100 % de la longueur du membre résiduel (tendon rotulien → extrémité), depuis l\'extrémité distale.',
  trimDirs: ['ant', 'post', 'med', 'lat'],
  rowLabel(r, m) { if (r.pct != null) return r.pct + ' %' + (r.pct === 0 ? ' · extrémité distale' : r.pct === 100 ? ' · niveau PT' : '') + ' (' + Math.round(r.pct / 100 * m.lenPT) + ' mm)'; const d = r.y - m.lenPT; return r.y + ' mm' + (Math.abs(d) <= 6 ? ' · niveau PT' : d > 6 ? ' · PT +' + Math.round(d) : ' · PT ' + Math.round(d)); },
  defaults() {
    const L = 160, old = [[0, 60, 64], [.25, 70, 74], [.5, 80, 84], [.75, 88, 92], [1, 95, 100]];
    const at = (y, i) => { const f = clamp(y / L, 0, 1); let k = 0; while (k < 3 && f > old[k + 1][0]) k++; const t = (f - old[k][0]) / (old[k + 1][0] - old[k][0]); return lerp(old[k][i], old[k + 1][i], t); };
    const rows = [0, 25, 50, 75, 100].map(p => mkRowPct(p, L, Math.round(at(p / 100 * L, 1)), Math.round(at(p / 100 * L, 2))));
    return {
      lenPT: 160, lenMTP: 178, condH: 35, tuberH: 32, fibH: 5, tendonDepth: 4, kneeFlex: 0, kneeVarus: 0, lenContra: 430, footStack: 90, rows,
      distalShape: 'arrondie', firmness: 3, volVar: 3, skin: 'intacte', scars: '', adhesions: 'non', pain: 0, distalTol: 'moyenne'
    };
  },
  fields: [
    { k: 'lenPT', label: 'Longueur tendon rotulien → extrémité distale du moignon', unit: 'mm', min: 60, max: 280, step: 1 },
    { k: 'lenMTP', label: 'Longueur plateau tibial médial → extrémité distale', unit: 'mm', min: 70, max: 300, step: 1 },
    { k: 'condH', label: 'Hauteur ligne articulaire / condyles au-dessus du PT', unit: 'mm', min: 10, max: 70, step: 1 },
    { k: 'tuberH', label: 'Distance PT → tubérosité tibiale (vers le bas)', unit: 'mm', min: 10, max: 60, step: 1 },
    { k: 'fibH', label: 'Position de la tête fibulaire par rapport au PT (+ = au-dessus)', unit: 'mm', min: -30, max: 40, step: 1 },
    { k: 'tendonDepth', label: 'Profondeur de modelage du tendon rotulien', unit: 'mm', min: 0, max: 10, step: 0.5 },
    { k: 'kneeFlex', label: 'Flexion du genou (contracture)', unit: '°', min: 0, max: 40, step: 1 },
    { k: 'kneeVarus', label: 'Varus (+) / valgus (−) du genou', unit: '°', min: -15, max: 15, step: 1 },
    { k: 'lenContra', label: 'Hauteur plateau tibial → sol, côté sain', unit: 'mm', min: 250, max: 650, step: 1 },
    { k: 'footStack', label: 'Hauteur pied + adaptateurs sous le tube', unit: 'mm', min: 40, max: 220, step: 1 }
  ],
  clinical: [
    { k: 'distalShape', label: 'Forme de l\'extrémité distale', type: 'select', opts: [['arrondie', 'Arrondie'], ['conique', 'Conique'], ['plate', 'Plate / tronquée'], ['bulbeuse', 'Bulbeuse']] },
    { k: 'firmness', label: 'Fermeté des tissus (1 mou – 5 ferme)', type: 'range', min: 1, max: 5, step: 1 },
    { k: 'volVar', label: 'Variation de volume observée (%)', type: 'range', min: 0, max: 15, step: 1 },
    { k: 'skin', label: 'État cutané', type: 'select', opts: [['intacte', 'Intacte'], ['fragile', 'Fragile'], ['lesion', 'Lésion / plaie'], ['irritee', 'Irritée / rougeur']] },
    { k: 'adhesions', label: 'Adhérences', type: 'select', opts: [['non', 'Non'], ['oui', 'Oui']] },
    { k: 'pain', label: 'Douleur (0–10)', type: 'range', min: 0, max: 10, step: 1 },
    { k: 'distalTol', label: 'Tolérance distale', type: 'select', opts: [['bonne', 'Bonne'], ['moyenne', 'Moyenne'], ['faible', 'Faible / nulle']] },
    { k: 'scars', label: 'Cicatrices (localisation)', type: 'text' }
  ],
  buildSec(m) {
    m = normRows(m, m.lenPT); const L = m.lenPT, top = L + m.condH + 30, N = 70, ys = []; for (let i = 0; i < N; i++) ys.push(top * i / (N - 1));
    const rows = m.rows.slice().sort((a, b) => a.y - b.y), capH = Math.min(34, L * 0.3), tfl = Math.tan(rad(m.kneeFlex || 0)), tva = Math.tan(rad(m.kneeVarus || 0)), fh = L + (m.fibH || 0);
    const yLast = rows[rows.length - 1].y, flare = y => smooth((y - yLast) / Math.max(1, L + m.condH - yLast)), FL = { ml: .14, ap: .05, circ: .1 };
    const rowAt = (y, key) => rowInterp(rows, y, key) * (FL[key] && y > yLast ? 1 + FL[key] * flare(y) : 1);   // évasement proximal au-dessus du niveau 75 %
    const cache = new Map(), APREF = 110;   // la crête tibiale (face antérieure) reste fixe : AP et circonférence se développent vers l'arrière (mollet)
    return buildSecFrom(ys, y => [rowAt(y, 'dML') - Math.max(L - y, 0) * tva, rowAt(y, 'dAP') - Math.max(L - y, 0) * tfl + (APREF - rowAt(y, 'ap')) / 2], (y, th) => {
      const ml = rowAt(y, 'ml'), ap = rowAt(y, 'ap'), rot = rowAt(y, 'rot'), circ = rowAt(y, 'circ');
      let r = anatR(ml, ap, circ, th, rad(rot), { free: 180, nA: 2.5, nP: 2.3 }, cache);
      r *= 1 + 0.09 * gAng(th, 0, 16) * maskY(y, 0.12 * L, L + 4, 12);
      r *= 1 + 0.07 * gAng(th, 115, 22) * maskY(y, fh - 23, fh + 17, 8);
      r *= 1 - 0.05 * gAng(th, 180, 28) * maskY(y, L - 25, L + 15, 10);
      r *= 1 + 0.05 * (gAng(th, 90, 25) + gAng(th, 270, 25)) * maskY(y, L, L + m.condH + 20, 8);
      return r * capFactor(y, capH, m.distalShape);
    });
  },
  landmarkDefs: [
    { id: 'tendon', label: 'Tendon rotulien', y: (L, m) => L, th: 0 },
    { id: 'tuberosite', label: 'Tubérosité tibiale', y: (L, m) => L - (m.tuberH || 32), th: 0 },
    { id: 'crete', label: 'Crête tibiale', y: (L, m) => L * 0.55, th: 0 },
    { id: 'fibula_tete', label: 'Tête fibulaire', y: (L, m) => L + (m.fibH || 0), th: 115 },
    { id: 'condyle_med', label: 'Condyle médial', y: (L, m) => L + m.condH * 0.6, th: 270 },
    { id: 'condyle_lat', label: 'Condyle latéral', y: (L, m) => L + m.condH * 0.6, th: 90 },
    { id: 'poplite', label: 'Creux poplité', y: (L, m) => L + 5, th: 180 },
    { id: 'tibia_bord_med', label: 'Bord médial du tibia', y: (L, m) => L * 0.5, th: 305 },
    { id: 'paratib_lat', label: 'Paratibial latéral', y: (L, m) => L * 0.5, th: 55 },
    { id: 'tibia_distal', label: 'Tibia distal', y: (L, m) => L * 0.12, th: 340 },
    { id: 'fibula_distale', label: 'Fibula distale', y: (L, m) => L * 0.15, th: 105 },
    { id: 'extremite', label: 'Extrémité distale', y: (L, m) => 1, th: 0, rf: 0 }
  ],
  trimRef(m) { return m.lenPT; },
  types: {
    ptb: { label: 'PTB', desc: 'Contact sélectif : modelage du tendon rotulien, appuis paratibiaux, dégagements crête tibiale et tête fibulaire.', red: 2.0, trim: { ant: 0, post: -15, med: 20, lat: 20 }, flare: 3, susp: ['Sangle supracondylienne', 'Manchon + cuissard'],
      shape(m, dev) { return (y, th, L) => -3.0 * gAng(th, 0, 20) * maskY(y, L - 25, L + 5, 6) + 2.5 * gAng(th, 180, 30) * maskY(y, L - 35, L + 25, 8); } },
    tsb: { label: 'TSB', desc: 'Contact global : réduction volumétrique uniforme, interface viscoélastique, corrections locales limitées.', red: 3.5, trim: { ant: 5, post: -12, med: 20, lat: 20 }, flare: 3, susp: ['Manchon silicone + pin/verrou', 'Manchon + vide'],
      shape(m, dev) { return () => 0; } },
    hybride: { label: 'Hybride PTB–TSB', desc: 'Combinaison ajustable entre réduction globale (TSB) et corrections locales (PTB).', red: 2.8, trim: { ant: 3, post: -13, med: 20, lat: 20 }, flare: 3, susp: ['Manchon silicone', 'Sangle supracondylienne'], mix: true,
      shape(m, dev) { const k = 1 - (dev.mix != null ? dev.mix : .5); return (y, th, L) => k * (-3.0 * gAng(th, 0, 20) * maskY(y, L - 25, L + 5, 6) + 2.5 * gAng(th, 180, 30) * maskY(y, L - 35, L + 25, 8)); } },
    kbm: { label: 'KBM supracondylaire', desc: 'Contention supracondylienne : bords médial et latéral plus hauts, forme proximale spécifique.', red: 2.5, trim: { ant: 8, post: -8, med: 42, lat: 42 }, flare: 2, susp: ['Auto-suspension supracondylienne'],
      shape(m, dev) { return (y, th, L) => -4.0 * (gAng(th, 90, 30) + gAng(th, 270, 30)) * maskY(y, L + 5, L + m.condH + 12, 6) + 2 * gAng(th, 0, 25) * maskY(y, L + 5, L + 40, 6); } },
    pts: { label: 'PTS suprapatellaire', desc: 'Extension suprapatellaire : bord antérieur plus haut, forme proximale distincte.', red: 3.0, trim: { ant: 55, post: -10, med: 35, lat: 35 }, flare: 2, susp: ['Auto-suspension suprapatellaire', 'Manchon silicone'],
      shape(m, dev) { return (y, th, L) => -3.0 * gAng(th, 0, 38) * maskY(y, L + 10, L + m.condH + 30, 8) - 1.5 * (gAng(th, 90, 28) + gAng(th, 270, 28)) * maskY(y, L + 5, L + m.condH + 30, 6); } }
  },
  /* Zones proposées (NON appliquées sans validation explicite de l'utilisateur) */
  suggest(type, m, lm, dev) {
    const z = (t, id, r, v, c, o) => lm[id] ? mkZone(t, lm[id], r, v, Object.assign({ landmark: id, comment: c, suggested: true }, o)) : null;
    const dt = m.distalTol === 'faible' ? 5 : m.distalTol === 'moyenne' ? 3 : 1.5, out = [];
    const mix = dev.mix != null ? dev.mix : .5;
    if (type === 'ptb' || type === 'hybride') {
      const k = type === 'ptb' ? 1 : (1 - 0.5 * mix);
      out.push(z('charge', 'tendon', 28, (m.tendonDepth != null ? m.tendonDepth : 4) * k, 'Modelage du tendon rotulien'), z('charge', 'tibia_bord_med', 34, 3 * k, 'Appui paratibial médial'), z('charge', 'paratib_lat', 34, 3 * k, 'Appui paratibial latéral'),
        z('charge', 'poplite', 36, 3 * k, 'Contre-appui poplité'), z('decharge', 'crete', 30, 5, 'Dégagement crête tibiale'), z('decharge', 'fibula_tete', 25, 5, 'Dégagement tête fibulaire'), z('decharge', 'tibia_distal', 26, 4, 'Dégagement tibia distal'), z('decharge', 'fibula_distale', 20, 3, 'Dégagement fibula distale'));
    } else if (type === 'tsb') {
      out.push(z('decharge', 'crete', 28, 3, 'Dégagement limité crête tibiale'), z('decharge', 'fibula_tete', 22, 3, 'Dégagement tête fibulaire'));
    } else if (type === 'kbm') {
      out.push(z('stabilisation', 'condyle_med', 30, 3, 'Contention supracondylienne médiale'), z('stabilisation', 'condyle_lat', 30, 3, 'Contention supracondylienne latérale'), z('charge', 'tendon', 26, 3, 'Appui tendon rotulien'), z('decharge', 'crete', 28, 3, 'Dégagement crête tibiale'), z('decharge', 'fibula_tete', 22, 3, 'Dégagement tête fibulaire'));
    } else if (type === 'pts') {
      out.push(z('charge', 'tendon', 30, 4, 'Appui tendon rotulien / suprapatellaire'), z('stabilisation', 'condyle_med', 28, 2, 'Contention condylienne médiale'), z('stabilisation', 'condyle_lat', 28, 2, 'Contention condylienne latérale'), z('decharge', 'crete', 30, 4, 'Dégagement crête tibiale'), z('decharge', 'fibula_tete', 24, 4, 'Dégagement tête fibulaire'), z('charge', 'poplite', 32, 3, 'Contre-appui poplité'));
    }
    out.push(z('decharge', 'extremite', 32, dt, 'Tolérance distale : ' + m.distalTol));
    return out.filter(Boolean);
  },
  warnings(m, sec) {
    const w = [];
    m.rows.forEach((r, i) => { const s = circScale(r); if (Math.abs(s - 1) > 0.08) w.push(`Niveau « ${ENGINES.tt.rowLabel(r, m)} » : circonférence ${r.circ} mm incohérente avec ML×AP (périmètre elliptique ${Math.round(ellipsePerimeter(r.ml, r.ap))} mm, écart ${Math.round((s - 1) * 100)} %). La reconstruction suit la circonférence saisie dans les limites de ±20 %.`); });
    if (m.lenMTP < m.lenPT) w.push('Longueur plateau tibial → extrémité inférieure à la longueur PT → extrémité : incohérent.');
    if (m.lenPT < 90) w.push('Membre résiduel court : choix du type d\'emboîture à confirmer cliniquement.');
    if (m.skin === 'lesion') w.push('Lésion cutanée signalée : aucun essayage sans avis du professionnel responsable.');
    if (m.pain >= 6) w.push('Douleur élevée signalée : vérifier les zones de charge avant tout essayage.');
    if (m.adhesions === 'oui' || m.scars) w.push('Cicatrice/adhérence signalée : envisager une protection locale (zone « Protection »).');
    if (m.volVar >= 8) w.push('Variation de volume importante : prévoir des essayages multiples et un dispositif d\'ajustement.');
    return w;
  }
};
