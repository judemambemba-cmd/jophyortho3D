/* JophyOrtho 3D — 05 : outils communs aux trois moteurs (formes paramétriques, tableaux de niveaux) */
'use strict';
const ENGINES = {};            // enregistré par 06-tt.js, 07-tf.js, 08-trunk.js
const gauss = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) * ((x - m) / s));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const gAng = (th, deg0, sigDeg) => gauss(angDiff(th, rad(deg0)), 0, rad(sigDeg));   // bosse angulaire circulaire
const maskY = (y, y0, y1, soft) => smooth((y - y0) / (soft || 1)) * (1 - smooth((y - y1) / (soft || 1)));
function ellipsePerimeter(ml, ap) { const a = ml / 2, b = ap / 2; return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); }
/* rayon d'une super-ellipse (demi-axes a=ML/2 selon X, b=AP/2 selon Z) à l'angle θ (0 = +Z) */
function superR(a, b, th, n) { const s = Math.abs(Math.sin(th)) / Math.max(a, 1e-3), c = Math.abs(Math.cos(th)) / Math.max(b, 1e-3); return Math.pow(Math.pow(s, n) + Math.pow(c, n), -1 / n); }
/* interpolation d'un tableau de niveaux ordonnés par y croissant (y = mm depuis l'extrémité distale / la base) */
function rowInterp(rows, y, key) {
  if (y <= rows[0].y) return rows[0][key] || 0; if (y >= rows[rows.length - 1].y) return rows[rows.length - 1][key] || 0;
  for (let i = 0; i < rows.length - 1; i++) if (y <= rows[i + 1].y) { const t = (y - rows[i].y) / ((rows[i + 1].y - rows[i].y) || 1); return lerp(rows[i][key] || 0, rows[i + 1][key] || 0, smooth(t) * 0.5 + t * 0.5); }
}
/* Forme anatomique : la face « fixe » (dos du tronc, crête tibiale) ne bouge pas quand on modifie AP/circonférence ;
   l'excédent de circonférence est reporté sur la face « libre » (ventre/poitrine, mollet). free = angle (°, 0 = antérieur, 180 = postérieur) ;
   nA/nP = exposants de la super-ellipse en avant / en arrière (nP élevé = dos plat). */
function anatR(ml, ap, circ, th, rot, o, cache) {
  const pw = t => smooth((-Math.cos(t) - 0.2) / 0.8), nAt = t => o.nA + (o.nP - o.nA) * pw(t);
  const r0 = t => superR(ml / 2, ap / 2, t - rot, nAt(t)), w = t => Math.pow((1 + Math.cos(t - rad(o.free))) / 2, 1.3) + 0.12;
  const key = ml.toFixed(2) + '|' + ap.toFixed(2) + '|' + rot.toFixed(3); let k = cache.get(key);
  if (k === undefined) { let a = 0, b = 0; for (let i = 0; i < 36; i++) { const t = i / 36 * Math.PI * 2, r = r0(t); a += r; b += r * w(t); } k = a / Math.max(b, 1e-6); cache.set(key, k); }
  const sc = clamp(circ / ellipsePerimeter(ml, ap), 0.8, 1.25);
  return r0(th) * clamp(1 + (sc - 1) * k * w(th), 0.7, 1.4);
}
const num = (x, d) => (x === '' || x == null || isNaN(+x)) ? d : +x;
/* Niveaux de mesure des emboîtures : 25 %, 50 %, 75 % de la longueur du membre résiduel (depuis l'extrémité distale). */
const mkRowPct = (pct, L, ml, ap, rot, dAP, dML, red) => Object.assign(mkRow(Math.round(pct / 100 * L * 10) / 10, ml, ap, rot, dAP, dML, red), { pct });
function normRows(m, L) { if (!m || !m.rows || !m.rows.some(r => r.pct != null)) return m; const o = Object.assign({}, m); o.rows = m.rows.map(r => r.pct != null ? Object.assign({}, r, { y: Math.round(r.pct / 100 * L * 10) / 10 }) : r); return o; }
function migrateRows(P) { ['tt', 'tf'].forEach(f => { const m = P.measures && P.measures[f]; if (!m || !m.rows) return; const L = f === 'tt' ? m.lenPT : m.lenPer; if (m.rows.some(r => r.pct == null) && L > 0) m.rows.forEach(r => { if (r.pct == null) r.pct = Math.round(r.y / L * 1000) / 10; });
    const has = p => m.rows.some(r => Math.abs(r.pct - p) < 1), sorted = () => m.rows.sort((a, b) => a.pct - b.pct);
    if (L > 0 && m.rows.length >= 2) { sorted(); const ext = (p, a, b) => { const t = (p - a.pct) / ((b.pct - a.pct) || 1), k = x => Math.max(1, Math.round((a[x] + (b[x] - a[x]) * t) * 10) / 10); const ml = k('ml'), ap = k('ap'); return Object.assign(mkRowPct(p, L, ml, ap), { circ: Math.round(ellipsePerimeter(ml, ap)) }); };
      if (!has(0)) m.rows.unshift(ext(0, m.rows[0], m.rows[1])); if (!has(100)) { const n = m.rows.length; m.rows.push(ext(100, m.rows[n - 2], m.rows[n - 1])); } sorted(); } }); }
/* ligne par défaut cohérente : circonférence = périmètre de l'ellipse ML×AP */
const mkRow = (y, ml, ap, rot, dAP, dML, red) => ({ y, ml, ap, circ: Math.round(ellipsePerimeter(ml, ap)), rot: rot || 0, dAP: dAP || 0, dML: dML || 0, red: red || 0 });
/* Cohérence ML/AP vs circonférence : retourne facteur d'échelle appliqué au périmètre (circ saisie / périmètre ellipse) */
function circScale(row) { const pe = ellipsePerimeter(row.ml, row.ap); return pe > 0 ? row.circ / pe : 1; }
/* Forme distale (fermeture) : facteur 0..1 en fonction de la hauteur y au-dessus de l'extrémité */
function capFactor(y, capH, shape) {
  if (y >= capH) return 1; const s = clamp(y / capH, 0, 1);
  switch (shape) {
    case 'conique': return s;
    case 'plate': return Math.pow(s, 0.28);
    case 'bulbeuse': return Math.sqrt(1 - Math.pow(1 - s, 2)) * (1 + 0.10 * Math.sin(s * Math.PI));
    default: return Math.sqrt(1 - Math.pow(1 - s, 2)); // arrondie
  }
}
/* Construit un Sec depuis une fonction de forme shape(y, th, ctx) → rayon, et un centre c(y) */
function buildSecFrom(ys, centerFn, radiusFn) {
  const s = new Sec(ys, NA);
  for (let i = 0; i < ys.length; i++) {
    const c = centerFn(ys[i]); s.cx[i] = c[0]; s.cz[i] = c[1];
    for (let j = 0; j < NA; j++) s.r[i * NA + j] = Math.max(0, radiusFn(ys[i], j / NA * Math.PI * 2, i));
  }
  return s;
}
/* position d'un repère défini par (y, θ°, fraction de rayon) sur une section */
function lmAt(sec, y, thDeg, rf) { const j = ((thDeg % 360 + 360) % 360) / 360 * sec.A; const jf = Math.floor(j), t = j - jf; const p0 = sec.pointAt(y, jf), p1 = sec.pointAt(y, jf + 1); const p = V.lerp(p0, p1, t); const c = sec.cAt(y); return rf == null || rf === 1 ? p : [c[0] + (p[0] - c[0]) * rf, y, c[1] + (p[2] - c[1]) * rf]; }
/* Zones prédéfinies : fabrique */
let _zid = 1;
function mkZone(type, pos, radius, value, o) {
  o = o || {};
  return { id: 'z' + Date.now().toString(36) + (_zid++), type, pos: pos.slice(), radius, value, transition: o.transition != null ? o.transition : 1.0, priority: o.priority || 1, comment: o.comment || '', landmark: o.landmark || '', date: new Date().toISOString(), author: o.author || '', visible: true, suggested: !!o.suggested };
}
const ZONE_TYPES = {
  charge: { label: 'Charge', color: [0.93, 0.25, 0.25], sign: -1, k: 1.0, note: 'réduction locale du volume interne (contact/appui)' },
  decharge: { label: 'Décharge', color: [0.25, 0.5, 0.98], sign: +1, k: 1.0, note: 'dégagement local (espace libre)' },
  stabilisation: { label: 'Stabilisation', color: [0.2, 0.78, 0.35], sign: -1, k: 0.6, note: 'contention modérée (réduction à 60 % de la valeur)' },
  selection: { label: 'Sélection', color: [0.85, 0.3, 0.95], sign: 0, k: 0, note: 'sélection en cours (sans effet sur la forme)' },
  protection: { label: 'Protection', color: [0.97, 0.82, 0.2], sign: +1, k: 0.5, note: 'dégagement à 50 % + marque une protection locale (épaisseur de doublure accrue)' }
};
const SUPPORTED_NOTICE = '';

let CURRENT_SEC = null; // section de travail courante (utilisée par les suggestions de zones)
