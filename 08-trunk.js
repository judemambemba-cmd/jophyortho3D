/* JophyOrtho 3D — 08 : MOTEUR CORSET / TRONC (reconstruction d'un tronc ; aucune géométrie de membre) */
'use strict';
ENGINES.trunk = {
  id: 'trunk', label: 'Corset orthopédique du tronc', short: 'Corset', limb: false, bothEnds: true,
  unitNote: 'Repère tronc : Y = axe rachidien (crânial +), Z = antérieur, X = côté DROIT du patient',
  trimDirs: ['ant', 'post', 'D', 'G'], trimDirDeg: { ant: 0, D: 90, post: 180, G: 270 }, trimLabels: { ant: 'Antérieur', post: 'Postérieur', D: 'Droit', G: 'Gauche' },
  rowLabel(r, m) { return r.y + ' mm depuis la base' + (Math.abs(r.y - m.hCrete) <= 15 ? ' · crête iliaque' : Math.abs(r.y - m.hWaist) <= 15 ? ' · taille' : Math.abs(r.y - m.hSubcostal) <= 15 ? ' · sous-costal' : Math.abs(r.y - m.hAxilla) <= 15 ? ' · axillaire' : ''); },
  defaults() {
    return {
      H: 480, hAxilla: 430, hXiph: 300, hSubcostal: 290, hWaist: 215, hCrete: 70, lenAnt: 420, lenPost: 470, lenLatD: 330, lenLatG: 330, hHump: 320, backDetail: 100,
      rows: [mkRow(0, 330, 220), mkRow(70, 320, 225), mkRow(140, 300, 230), mkRow(215, 270, 200), mkRow(290, 285, 205), mkRow(360, 300, 220), mkRow(430, 310, 190), mkRow(480, 290, 170)],
      lordosis: 35, kyphosis: 35, costalAsym: 0, shoulderTilt: 0, pelvicObl: 0,
      curve: 'aucune', convex: 'D', cobbT: 25, cobbL: 20, cobbTL: 25, apexT: .68, apexL: .3, apexTL: .5, vertRot: 0,
      xray: 'non', xrayNote: '', respiratory: 'normale', skin: 'intacte', pain: 0
    };
  },
  fields: [
    { k: 'H', label: 'Hauteur du tronc (bassin → épaules)', unit: 'mm', min: 250, max: 700, step: 1 },
    { k: 'hAxilla', label: 'Hauteur du pli axillaire (depuis la base)', unit: 'mm', min: 200, max: 650, step: 1 },
    { k: 'hXiph', label: 'Hauteur de l\'appendice xiphoïde', unit: 'mm', min: 150, max: 550, step: 1 },
    { k: 'hSubcostal', label: 'Hauteur du bord sous-costal', unit: 'mm', min: 120, max: 520, step: 1 },
    { k: 'hWaist', label: 'Hauteur de la taille (plus étroite)', unit: 'mm', min: 80, max: 450, step: 1 },
    { k: 'hCrete', label: 'Hauteur des crêtes iliaques', unit: 'mm', min: 20, max: 250, step: 1 },
    { k: 'lenAnt', label: 'Longueur antérieure (fourchette sternale → pubis)', unit: 'mm', min: 200, max: 650, step: 1 },
    { k: 'lenPost', label: 'Longueur postérieure (C7 → sacrum)', unit: 'mm', min: 250, max: 700, step: 1 },
    { k: 'lenLatD', label: 'Longueur latérale droite (aisselle → trochanter)', unit: 'mm', min: 200, max: 550, step: 1 },
    { k: 'lenLatG', label: 'Longueur latérale gauche (aisselle → trochanter)', unit: 'mm', min: 200, max: 550, step: 1 },
    { k: 'hHump', label: 'Hauteur de la gibbosité costale (depuis la base)', unit: 'mm', min: 150, max: 500, step: 1 },
    { k: 'backDetail', label: 'Relief anatomique du dos (sillon rachidien, paravertébraux, omoplates, fessiers)', unit: '%', min: 0, max: 150, step: 5 },
    { k: 'lordosis', label: 'Lordose lombaire', unit: '°', min: 0, max: 70, step: 1 },
    { k: 'kyphosis', label: 'Cyphose thoracique', unit: '°', min: 0, max: 80, step: 1 },
    { k: 'costalAsym', label: 'Asymétrie costale (gibbosité)', unit: 'mm', min: 0, max: 40, step: 1 },
    { k: 'shoulderTilt', label: 'Orientation des épaules (inclinaison, + = droite plus haute)', unit: '°', min: -15, max: 15, step: 1 },
    { k: 'pelvicObl', label: 'Obliquité pelvienne (+ = droite plus haute)', unit: '°', min: -15, max: 15, step: 1 }
  ],
  clinical: [
    { k: 'curve', label: 'Type de courbure', type: 'select', opts: [['aucune', 'Aucune / non documentée'], ['thoracique', 'Thoracique'], ['lombaire', 'Lombaire'], ['thoracolombaire', 'Thoraco-lombaire'], ['double', 'Double majeure (thoracique + lombaire)']] },
    { k: 'convex', label: 'Côté convexe (courbe principale)', type: 'select', opts: [['D', 'Droit'], ['G', 'Gauche']] },
    { k: 'cobbT', label: 'Angle documenté – courbe thoracique (°)', type: 'range', min: 0, max: 80, step: 1 },
    { k: 'cobbL', label: 'Angle documenté – courbe lombaire (°)', type: 'range', min: 0, max: 80, step: 1 },
    { k: 'cobbTL', label: 'Angle documenté – courbe thoraco-lombaire (°)', type: 'range', min: 0, max: 80, step: 1 },
    { k: 'apexT', label: 'Apex thoracique (fraction de la hauteur)', type: 'range', min: .5, max: .85, step: .01 },
    { k: 'apexTL', label: 'Apex thoraco-lombaire (fraction)', type: 'range', min: .35, max: .65, step: .01 },
    { k: 'apexL', label: 'Apex lombaire (fraction)', type: 'range', min: .15, max: .45, step: .01 },
    { k: 'vertRot', label: 'Rotation vertébrale documentée (°)', type: 'range', min: 0, max: 30, step: 1 },
    { k: 'xray', label: 'Radiographies disponibles', type: 'select', opts: [['non', 'Non'], ['oui', 'Oui']] },
    { k: 'xrayNote', label: 'Référence / date des radiographies', type: 'text' },
    { k: 'respiratory', label: 'Capacité respiratoire', type: 'select', opts: [['normale', 'Normale'], ['reduite', 'Réduite'], ['inconnue', 'Non évaluée']] },
    { k: 'skin', label: 'Tolérance cutanée', type: 'select', opts: [['intacte', 'Bonne'], ['fragile', 'Fragile'], ['lesion', 'Lésion / plaie'], ['irritee', 'Irritée / rougeur']] },
    { k: 'pain', label: 'Douleur (0–10)', type: 'range', min: 0, max: 10, step: 1 }
  ],
  curves(m) {
    const cv = m.convex === 'D' ? 1 : -1, c = [];
    if (m.curve === 'thoracique') c.push({ apex: m.apexT, cobb: m.cobbT, s: cv, name: 'thoracique' });
    else if (m.curve === 'lombaire') c.push({ apex: m.apexL, cobb: m.cobbL, s: cv, name: 'lombaire' });
    else if (m.curve === 'thoracolombaire') c.push({ apex: m.apexTL, cobb: m.cobbTL, s: cv, name: 'thoraco-lombaire' });
    else if (m.curve === 'double') { c.push({ apex: m.apexT, cobb: m.cobbT, s: cv, name: 'thoracique' }); c.push({ apex: m.apexL, cobb: m.cobbL, s: -cv, name: 'lombaire' }); }
    return c;
  },
  buildSec(m) {
    const H = m.H, N = 112, ys = []; for (let i = 0; i < N; i++) ys.push(H * i / (N - 1));
    const rows = m.rows.slice().sort((a, b) => a.y - b.y), cvs = ENGINES.trunk.curves(m), ta = Math.tan(rad(m.shoulderTilt)), tp = Math.tan(rad(m.pelvicObl));
    const lordA = m.lordosis / 50, kyphA = m.kyphosis / 50;
    const cx = y => { const f = y / H; let x = rowInterp(rows, y, 'dML'); cvs.forEach(c => { x += c.s * clamp(c.cobb, 0, 80) / 40 * 16 * gauss(f, c.apex, .17); }); x += ta * (y - .8 * H) * smooth((f - .7) / .2) + tp * (.15 * H - y) * (1 - smooth((f - .05) / .25)); return x; };
    const APREF = 220, cache = new Map(), rowAt0 = (y, key) => rowInterp(rows, y, key);   // le dos reste plat : sa position ne dépend pas de AP ; ventre/poitrine absorbent les variations
    const cz = y => { const f = y / H; return -(lordA * 14 * gauss(f, .15, .13)) + kyphA * 14 * gauss(f, .72, .15) + (rowAt0(y, 'ap') - APREF) / 2 + rowAt0(y, 'dAP'); };
    /* Relief anatomique du dos (mm, > 0 vers l'extérieur) : sillon rachidien, masses paravertébrales, omoplates, angles costaux, dimples sacrés, fessiers. */
    const hC = m.hCrete, hW = m.hWaist, hS = m.hSubcostal, hX = m.hXiph, hA = m.hAxilla, K = m.backDetail == null ? 1 : m.backDetail / 100;
    const zone = (y, a, b, so) => maskY(y, a, b, so);
    const lum = y => zone(y, hC - 30, hS + 10, 30), thor = y => zone(y, hS - 30, hA - 25, 35);
    const backRelief = (y, th) => {
      if (!K) return 0; const a = Math.abs(angDiff(th, Math.PI)) * 180 / Math.PI;          // écart angulaire à la ligne médiane postérieure (°)
      if (a > 125) return 0; const L = lum(y), T = thor(y), G = gAng, sp = th => G(th, 180, 9);
      let d = 0;
      d += (9 * L + 5.5 * T) * (G(th, 162, 10) + G(th, 198, 10));                            // masses paravertébrales (érecteurs du rachis)
      d -= (9 * L + (5.5 - 2.5 * kyphA) * T) * sp(th);                                         // sillon rachidien médian
      const hSc = hA - 95; d += 11 * (G(th, 140, 16) + G(th, 220, 16)) * gauss(y, hSc, 52);  // omoplates
      d -= 3 * sp(th) * gauss(y, hSc, 48);                                                  // sillon plus marqué entre les omoplates
      d += 3.5 * (G(th, 125, 14) + G(th, 235, 14)) * gauss(y, hX - 25, 45);                  // angles costaux postérieurs
      d += (2 + 4 * kyphA) * G(th, 180, 7) * gauss(y, hA + 25, 22);                          // proéminence de C7 / épineuses dorsales hautes
      d -= 3 * (G(th, 171, 5) + G(th, 189, 5)) * gauss(y, hC - 8, 10);                      // fossettes lombaires (épines iliaques postéro-supérieures)
      d += 2.5 * G(th, 180, 8) * gauss(y, hC - 40, 22);                                      // triangle sacré
      const gl = 1 - smooth((y - (hC - 70)) / 55); d += 13 * (G(th, 156, 16) + G(th, 204, 16)) * gl - 7 * G(th, 180, 6) * gl;   // fessiers et pli interfessier
      d += 3 * (G(th, 105, 12) + G(th, 255, 12)) * gauss(y, hC, 20);                          // crête iliaque postéro-latérale
      return d * K;
    };
    return buildSecFrom(ys, y => [cx(y), cz(y)], (y, th) => {
      const f = y / H; let rotv = 0; cvs.forEach(c => { rotv += c.s * m.vertRot * gauss(f, c.apex, .18); });
      const ml = rowInterp(rows, y, 'ml'), ap = rowInterp(rows, y, 'ap'), rot = rowInterp(rows, y, 'rot') + rotv, circ = rowInterp(rows, y, 'circ');
      let r = anatR(ml, ap, circ, th, rad(rot), { free: 0, nA: 2.4, nP: 3.1 }, cache);
      r *= 1 - 0.05 * lordA * gAng(th, 180, 40) * maskY(f, .0, .35, .1);               // lordose (indentation postérieure)
      r *= 1 + 0.06 * kyphA * gAng(th, 180, 40) * maskY(f, .5, .92, .1);               // cyphose (bombement postérieur)
      r += backRelief(y, th);
      const side = m.convex === 'D' ? 135 : 225;
      r += m.costalAsym * gAng(th, side, 28) * (m.hHump ? gauss(y, m.hHump, 0.12 * H) : maskY(f, .5, .9, .12));                  // gibbosité costale
      return r;
    });
  },
  lmLen(m) { return m.H; },
  landmarkDefs: [
    { id: 'sternum', label: 'Sternum', y: (H, m) => (m.hAxilla || .9 * H) - 60, th: 0 },
    { id: 'xiphoide', label: 'Appendice xiphoïde', y: (H, m) => m.hXiph || .62 * H, th: 0 },
    { id: 'epias_d', label: 'Épine iliaque antéro-supérieure D', y: (H, m) => (m.hCrete || .15 * H) - 25, th: 38 },
    { id: 'epias_g', label: 'Épine iliaque antéro-supérieure G', y: (H, m) => (m.hCrete || .15 * H) - 25, th: 322 },
    { id: 'crete_d', label: 'Crête iliaque D', y: (H, m) => m.hCrete || .15 * H, th: 82 },
    { id: 'crete_g', label: 'Crête iliaque G', y: (H, m) => m.hCrete || .15 * H, th: 278 },
    { id: 'troch_d', label: 'Grand trochanter D', y: H => .02 * H, th: 90 },
    { id: 'troch_g', label: 'Grand trochanter G', y: H => .02 * H, th: 270 },
    { id: 'apex', label: 'Apex de la courbure principale', y: (H, m) => { const c = ENGINES.trunk.curves(m)[0]; return (c ? c.apex : .65) * H; }, th: m => m.convex === 'D' ? 135 : 225 },
    { id: 'scapula', label: 'Pointe de la scapula', y: H => .78 * H, th: 155 },
    { id: 'angle_costal', label: 'Angle costal', y: H => .68 * H, th: 135 },
    { id: 'sacrum', label: 'Sacrum / L5', y: H => .08 * H, th: 180 },
    { id: 'c7', label: 'C7 (vertèbre proéminente)', y: H => H, th: 180, rf: .55 }
  ],
  trimRef() { return 0; },
  types: {
    boston: { label: 'Boston TLSO', desc: 'Coque thoraco-lombo-sacrée : zones de pression, dégagements opposés, ouverture postérieure, profil de taille.', red: 3.0, topRef: 'axilla', topOff: -40, botOff: 0, trim: { ant: -25, post: 0, D: 0, G: 0 }, trimB: { ant: 0, post: 15, D: 0, G: 0 }, flare: 2, open: { post: true }, waist: 5,
      shape(m) { return () => 0; } },
    cheneau: { label: 'Chêneau 3D', desc: 'Corrections asymétriques tridimensionnelles : appuis, chambres d\'expansion, dérotation (spirale appuis/expansions).', red: 2.5, topRef: 'axilla', topOff: -70, botOff: 0, trim: { ant: -30, post: 0, D: 0, G: 0 }, trimB: { ant: 0, post: 10, D: 0, G: 0 }, flare: 2, open: { ant: true }, waist: 3, asym: true,
      shape(m) { const cs = ENGINES.trunk.curves(m), c = cs[0], H = m.H; if (!c) return () => 0; const s = c.s, a = c.apex * H, d = th => th; return (y, th) => { const g = gauss(y, a, .1 * H), ang = s > 0 ? 0 : 180; const A = (deg) => gAng(th, s > 0 ? deg : 360 - deg, 32); return g * (-9 * A(135) + 10 * A(45) + 10 * A(225) - 6 * A(315)); }; } },
    wilmington: { label: 'Wilmington', desc: 'Enveloppe à contact total ajustée au tronc, fermeture antérieure.', red: 4.0, topRef: 'axilla', topOff: -50, botOff: 0, trim: { ant: -20, post: 0, D: 0, G: 0 }, trimB: { ant: 0, post: 10, D: 0, G: 0 }, flare: 2, open: { ant: true }, waist: 3,
      shape() { return () => 0; } },
    milwaukee: { label: 'Milwaukee CTLSO', desc: 'Corset inférieur + montants métalliques + superstructure cervicale avec anneau supérieur.', red: 3.0, topRef: 'xiph', topOff: 0, botOff: 0, trim: { ant: -10, post: 0, D: 0, G: 0 }, trimB: { ant: 0, post: 10, D: 0, G: 0 }, flare: 2, open: { ant: true }, waist: 4, superstructure: true,
      shape() { return () => 0; } },
    charleston: { label: 'Charleston nocturne', desc: 'Inclinaison corrective en bending, forme asymétrique (usage nocturne).', red: 2.0, topRef: 'axilla', topOff: -110, botOff: 0, trim: { ant: -25, post: 0, D: 0, G: 0 }, trimB: { ant: 0, post: 10, D: 0, G: 0 }, flare: 2, open: { ant: true }, waist: 0, bending: true,
      shape(m) { const cs = ENGINES.trunk.curves(m), c = cs[0], H = m.H; if (!c) return () => 0; const s = c.s, a = c.apex * H; const A = (th, deg) => gAng(th, s > 0 ? deg : 360 - deg, 42); return (y, th) => gauss(y, a, .16 * H) * (-14 * A(th, 90) + 12 * A(th, 270)) - 8 * A(th, 90) * gauss(y, .12 * H, .08 * H); } },
    lso: { label: 'LSO', desc: 'Orthèse lombo-sacrée : hauteur limitée aux régions lombaire et lombo-sacrée.', red: 3.0, topRef: 'crete', topOff: 70, botOff: 0, trim: { ant: -20, post: 5, D: 0, G: 0 }, trimB: { ant: 0, post: 15, D: 0, G: 0 }, flare: 2, open: { ant: true }, waist: 3,
      shape() { return () => 0; } }
  },
  suggest(type, m, lm, dev) {
    const out = [], H = m.H, cs = ENGINES.trunk.curves(m), c = cs[0];
    const z = (t, id, r, v, cm) => lm[id] ? mkZone(t, lm[id], r, v, { landmark: id, comment: cm, suggested: true }) : null;
    out.push(z('protection', 'crete_d', 30, 3, 'Protection de la crête iliaque D'), z('protection', 'crete_g', 30, 3, 'Protection de la crête iliaque G'), z('decharge', 'xiphoide', 34, 4, 'Dégagement xiphoïdien / respiration'));
    if (c && (type === 'boston' || type === 'wilmington' || type === 'lso')) {
      const th = c.s > 0 ? 135 : 225, thO = c.s > 0 ? 225 : 135, ap = c.apex * H;
      if (lm.apex && type !== 'lso') { out.push(mkZone('charge', lm.apex, 48, 6, { landmark: 'apex', comment: 'Appui sur la convexité (apex)', suggested: true }));
        const p = lmAtFromSec(CURRENT_SEC, ap, thO); if (p) out.push(mkZone('decharge', p, 48, 6, { comment: 'Dégagement opposé (concavité)', suggested: true })); }
    }
    if (type === 'cheneau' && c) out.push(mkZone('stabilisation', lm.apex || [0, 0, 0], 40, 3, { landmark: 'apex', comment: 'Appui de dérotation (complète la forme 3D du type)', suggested: true }));
    if (type === 'milwaukee') out.push(z('stabilisation', 'sacrum', 40, 3, 'Appui postérieur bas'));
    return out.filter(Boolean);
  },
  warnings(m) {
    const w = [];
    m.rows.forEach((r, i) => { const s = circScale(r); if (Math.abs(s - 1) > 0.08) w.push(`Niveau « ${ENGINES.trunk.rowLabel(r, m)} » : circonférence ${r.circ} mm incohérente avec largeur×profondeur (écart ${Math.round((s - 1) * 100)} %).`); });
    if (!(m.hCrete < m.hWaist && m.hWaist <= m.hSubcostal + 80 && m.hXiph < m.hAxilla && m.hAxilla <= m.H)) w.push('Hauteurs incohérentes : vérifier l\'ordre crête iliaque < taille < xiphoïde < axille ≤ hauteur du tronc.');
    if (Math.abs(m.lenLatD - m.lenLatG) > 12 && Math.abs(m.shoulderTilt) < 1 && Math.abs(m.pelvicObl) < 1) w.push('Longueurs latérales D/G différentes (' + m.lenLatD + ' / ' + m.lenLatG + ' mm) sans obliquité renseignée : vérifier l\'asymétrie.');
    const cvs = ENGINES.trunk.curves(m);
    if (cvs.length && m.xray !== 'oui') w.push('Courbure saisie sans radiographie référencée : les angles ne sont pas documentés.');
    if (cvs.some(c => c.cobb > 45)) w.push('Angle > 45° : indication à valider par l\'équipe médicale (cette application ne pose aucune indication).');
    if (m.respiratory === 'reduite') w.push('Capacité respiratoire réduite : contrôler la compression thoracique et les chambres d\'expansion.');
    if (m.skin === 'lesion') w.push('Lésion cutanée signalée : aucun essayage sans avis du professionnel responsable.');
    if (m.pain >= 6) w.push('Douleur élevée : vérifier les zones de pression avant tout essayage.');
    return w;
  }
};
function lmAtFromSec(sec, y, th) { return sec ? lmAt(sec, y, th, 1) : null; }
