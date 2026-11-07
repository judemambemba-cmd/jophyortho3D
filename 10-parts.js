/* JophyOrtho 3D — 10 : composants (connecteurs distaux, pads, sangles, superstructure Milwaukee) */
'use strict';
function flatten(m) { // dé-indexe pour un ombrage facetté
  const v = new Float32Array(m.f.length * 3), f = new Uint32Array(m.f.length);
  for (let i = 0; i < m.f.length; i++) { v[i * 3] = m.v[m.f[i] * 3]; v[i * 3 + 1] = m.v[m.f[i] * 3 + 1]; v[i * 3 + 2] = m.v[m.f[i] * 3 + 2]; f[i] = i; }
  return new Mesh(v, f);
}
/* solide de révolution autour de Y ; profile = [[r,y],...] (bas→haut le long de la paroi extérieure) ; coins doublés = arêtes vives */
function lathe(profile, seg) {
  seg = seg || 36; const pts = []; profile.forEach((p, i) => { pts.push(p); if (i > 0 && i < profile.length - 1) pts.push(p); });
  const rings = pts.map(p => { const r = []; for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; r.push([p[0] * Math.sin(a), p[1], p[0] * Math.cos(a)]); } return r; });
  return Prim.fromRings(rings, { flip: true });
}
const cyl = (R, y0, y1, seg) => lathe([[0, y0], [R, y0], [R, y1], [0, y1]], seg);
const tube = (R, r, y0, y1, seg) => lathe([[r, y0], [R, y0], [R, y1], [r, y1], [r, y0]], seg);
/* plaque à masque 2D arbitraire (trous réels, résolution ~1 mm) : face haute y=top, basse y=bot */
function gridPlate(half, bot, top, inside, res) {
  const n = res || 48, cs = 2 * half / n, v = [], f = [], key = new Map();
  const vid = (ix, iz, y) => { const k = ix + '_' + iz + '_' + y; let id = key.get(k); if (id === undefined) { id = v.length / 3; key.set(k, id); v.push(-half + ix * cs, y, -half + iz * cs); } return id; };
  const kept = (ix, iz) => ix >= 0 && iz >= 0 && ix < n && iz < n && inside(-half + (ix + .5) * cs, -half + (iz + .5) * cs);
  const quad = (a, b, c, d, hint) => { const P = k => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]], nn = V.cross(V.sub(P(b), P(a)), V.sub(P(c), P(a))); if (V.dot(nn, hint) >= 0) f.push(a, b, c, b, d, c); else f.push(a, c, b, b, c, d); };
  for (let ix = 0; ix < n; ix++) for (let iz = 0; iz < n; iz++) {
    if (!kept(ix, iz)) continue;
    quad(vid(ix, iz, top), vid(ix + 1, iz, top), vid(ix, iz + 1, top), vid(ix + 1, iz + 1, top), [0, 1, 0]);
    quad(vid(ix, iz, bot), vid(ix + 1, iz, bot), vid(ix, iz + 1, bot), vid(ix + 1, iz + 1, bot), [0, -1, 0]);
    [[-1, 0, [[ix, iz], [ix, iz + 1]], [-1, 0, 0]], [1, 0, [[ix + 1, iz], [ix + 1, iz + 1]], [1, 0, 0]], [0, -1, [[ix, iz], [ix + 1, iz]], [0, 0, -1]], [0, 1, [[ix, iz + 1], [ix + 1, iz + 1]], [0, 0, 1]]].forEach(e => {
      if (!kept(ix + e[0], iz + e[1])) quad(vid(e[2][0][0], e[2][0][1], top), vid(e[2][1][0], e[2][1][1], top), vid(e[2][0][0], e[2][0][1], bot), vid(e[2][1][0], e[2][1][1], bot), e[3]);
    });
  }
  return flatten(new Mesh(new Float32Array(v), new Uint32Array(f)));
}
function basisMatrix(o, n) { // repère dont l'axe Y local = n, origine o
  const y = V.norm(n), h = Math.abs(y[1]) > .95 ? [1, 0, 0] : [0, 1, 0], x = V.norm(V.cross(h, y)), z = V.cross(x, y), m = M4.ident();
  m[0] = x[0]; m[1] = x[1]; m[2] = x[2]; m[4] = y[0]; m[5] = y[1]; m[6] = y[2]; m[8] = z[0]; m[9] = z[1]; m[10] = z[2]; m[12] = o[0]; m[13] = o[1]; m[14] = o[2]; return m;
}
function rod(p, q, r) { const d = V.sub(q, p), L = V.len(d); return cyl(r, 0, L, 14).transformed(basisMatrix(p, d)); }
function torusPath(center, R, r, y) {
  const rings = [], n = 48; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rad_ = [Math.sin(a), 0, Math.cos(a)], c = [center[0] + R * rad_[0], y, center[2] + R * rad_[2]], ring = [];
    for (let k = 0; k < 12; k++) { const b = k / 12 * Math.PI * 2; ring.push(V.add(c, V.add(V.mul(rad_, r * Math.cos(b)), [0, r * Math.sin(b), 0]))); } rings.push(ring); }
  return Prim.fromRings(rings, {});
}
function oblate(c, n, r, t) { // pastille aplatie orientée selon n
  const s = Prim.sphere(1, [0, 0, 0], 10), M = basisMatrix(c, n), S = M4.ident(); S[0] = r; S[5] = t; S[10] = r; return s.transformed(M4.mul(M, S));
}
/* ----- connecteurs distaux : géométrie locale, origine = face supérieure (contre l'emboîture), Y vers le bas négatif ----- */
const CONNECTOR_TYPES = [['aucun', 'Aucun'], ['plaque', 'Plaque distale'], ['pyramide4', 'Pyramide mâle 4 trous'], ['femelle', 'Récepteur femelle'], ['insert', 'Insert fileté'], ['tube', 'Adaptateur tubulaire'], ['verrou', 'Verrou distal'], ['valve', 'Valve']];
const CONN_COLORS = { alu: [.72, .75, .8], acier: [.55, .57, .6], titane: [.62, .64, .7], composite: [.2, .22, .25] };
function connectorParts(c) {
  const s = c.size || 1, R = c.plateR, col = CONN_COLORS[c.material] || CONN_COLORS.alu, parts = [], steel = CONN_COLORS.acier, dark = [.12, .13, .15];
  const add = (name, mesh, color, o) => parts.push(Object.assign({ name, mesh, color: color || col }, o));
  const plate = (th) => add('Plaque', cyl(R, -th, 0, 48), [.78, .62, .35]);
  const axis = (a, b) => ({ axis: new Float32Array([0, a, 0, 0, b, 0]) });
  switch (c.type) {
    case 'plaque': plate(5 * s); return { parts, axis: new Float32Array([0, 20, 0, 0, -80, 0]) };
    case 'pyramide4': {
      plate(4); const h = 15 * s, hole = (x, z) => [[h, h], [-h, h], [h, -h], [-h, -h]].some(p => Math.hypot(x - p[0], z - p[1]) < 3.4);
      add('Platine 4 trous', gridPlate(21 * s, -12, -4, (x, z) => Math.abs(x) < 21 * s && Math.abs(z) < 21 * s && !hole(x, z), 56), col);
      const py = Prim.pyramid(24 * s, 15 * s, 18 * s, [0, 0, 0]).transformed(M4.mul(M4.translate([0, -12, 0]), M4.rotX(Math.PI))); add('Pyramide mâle', flatten(py), col);
      [[h, h], [-h, h], [h, -h], [-h, -h]].forEach((p, i) => add('Vis ' + (i + 1), cyl(2.6, -4 - 14, 0, 12).transformed(M4.translate([p[0], 0, p[1]])), steel));
      return { parts, axis: new Float32Array([0, 20, 0, 0, -90, 0]) };
    }
    case 'femelle': plate(4); add('Corps du récepteur', lathe([[12 * s, -28 * s], [17 * s, -28 * s], [17 * s, -4], [0, -4], [0, -4 - 10 * s], [12 * s, -4 - 10 * s], [12 * s, -28 * s]], 40), col);
      add('Cavité (indication)', cyl(11 * s, -4 - 10 * s - 0.2, -4 - 10 * s, 24), dark); return { parts, axis: new Float32Array([0, 20, 0, 0, -90, 0]) };
    case 'insert': plate(4); add('Insert fileté', cyl(7 * s, -26, -4, 24), col); for (let i = 0; i < 4; i++) add('Filet ' + (i + 1), cyl(8.2 * s, -9 - i * 4.5, -7.6 - i * 4.5, 24), steel); return { parts, axis: new Float32Array([0, 20, 0, 0, -80, 0]) };
    case 'tube': plate(4); add('Collier', cyl(21 * s, -16, -4, 36), col); add('Tube', tube(15 * s, 12 * s, -76 * s, -16, 36), col); return { parts, axis: new Float32Array([0, 20, 0, 0, -110, 0]) };
    case 'verrou': plate(4); add('Boîtier du verrou', cyl(22 * s, -34, -4, 40), col); add('Goupille', cyl(3.2 * s, -68, -34, 14), steel); add('Bouton', cyl(6 * s, -40, -34, 20), dark); return { parts, axis: new Float32Array([0, 20, 0, 0, -90, 0]) };
    case 'valve': add('Corps de valve', tube(9 * s, 5 * s, -26 * s, 0, 24), col); add('Clapet', cyl(7 * s, -30 * s, -26 * s, 24), dark); return { parts, axis: new Float32Array([0, 10, 0, 0, -50, 0]), side: true };
  }
  return { parts: [], axis: null };
}
/* ----- composants du corset ----- */
function bandMesh(sec, y, hw, thDeg0, thDeg1, off, n) { // sangle schématique (bande de largeur 2*hw)
  const rings = [], A = sec.A; for (const yy of [y - hw, y + hw]) { const r = []; for (let k = 0; k <= n; k++) { const th = rad(thDeg0 + (thDeg1 - thDeg0) * k / n), j = ((th / (Math.PI * 2)) * A); const jj = Math.floor(j), t = j - jj, p0 = sec.pointAt(yy, jj), p1 = sec.pointAt(yy, jj + 1), p = V.lerp(p0, p1, t), c = sec.cAt(yy), d = V.norm([p[0] - c[0], 0, p[2] - c[1]]); r.push(V.add(p, V.mul(d, off))); } rings.push(r); }
  return Prim.fromRings(rings, { open: true, flip: true });
}
