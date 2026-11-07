/* JophyOrtho 3D — 02 : maillages, import (STL ASCII/binaire, OBJ, PLY), export STL, contrôle qualité */
'use strict';
class Mesh {
  constructor(v, f) { this.v = v || new Float32Array(0); this.f = f || new Uint32Array(0); this.n = null; this.rev = 0; }
  get nv() { return this.v.length / 3; }
  get nt() { return this.f.length / 3; }
  clone() { const m = new Mesh(new Float32Array(this.v), new Uint32Array(this.f)); if (this.c) m.c = new Float32Array(this.c); return m; }
  touch() { this.rev++; this.n = null; this._b = null; return this; }
  bounds() {
    if (this._b) return this._b;
    const v = this.v; let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { const x = v[i + k]; if (x < mn[k]) mn[k] = x; if (x > mx[k]) mx[k] = x; }
    if (!v.length) { mn = [0, 0, 0]; mx = [0, 0, 0]; }
    return this._b = { min: mn, max: mx, size: V.sub(mx, mn), center: V.mul(V.add(mn, mx), .5) };
  }
  normals() {
    if (this.n) return this.n;
    const v = this.v, f = this.f, n = new Float32Array(v.length);
    for (let i = 0; i < f.length; i += 3) {
      const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
      const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      for (const j of [a, b, c]) { n[j] += nx; n[j + 1] += ny; n[j + 2] += nz; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return this.n = n;
  }
  /* applique une matrice 4x4 (retourne un NOUVEAU maillage) */
  transformed(m) {
    const o = this.clone(), v = o.v;
    for (let i = 0; i < v.length; i += 3) { const p = M4.apply(m, [v[i], v[i + 1], v[i + 2]]); v[i] = p[0]; v[i + 1] = p[1]; v[i + 2] = p[2]; }
    return o.touch();
  }
  volume() { // mm³ (signé → valeur absolue) ; fiable pour maillages fermés
    const v = this.v, f = this.f; let s = 0;
    for (let i = 0; i < f.length; i += 3) {
      const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
      s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
    }
    return Math.abs(s / 6);
  }
}
Mesh.merge = function (list) {
  let nv = 0, nf = 0; list.forEach(m => { nv += m.v.length; nf += m.f.length; });
  const v = new Float32Array(nv), f = new Uint32Array(nf); let ov = 0, of = 0;
  list.forEach(m => { v.set(m.v, ov); for (let i = 0; i < m.f.length; i++) f[of + i] = m.f[i] + ov / 3; ov += m.v.length; of += m.f.length; });
  const o = new Mesh(v, f);
  if (list.some(m => m.c)) { o.c = new Float32Array(nv); let q = 0; list.forEach(m => { if (m.c) o.c.set(m.c, q); else o.c.fill(0.78, q, q + m.v.length); q += m.v.length; }); }
  return o;
};

/* Soudure des sommets coïncidents (STL = soupe de triangles) */
function weldVertices(pos, tol) {
  const nTri = pos.length / 9, map = new Map(), verts = [], idx = new Uint32Array(nTri * 3);
  const q = 1 / (tol || 1e-4);
  for (let i = 0; i < nTri * 3; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const key = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
    let id = map.get(key);
    if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(x, y, z); }
    idx[i] = id;
  }
  return new Mesh(new Float32Array(verts), idx);
}

/* ---------------- Parseurs ---------------- */
function parseSTL(buf) {
  const dv = new DataView(buf);
  let binary = false;
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) binary = true;
  }
  if (!binary) { // ASCII si commence par "solid" et contient "facet"
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(512, buf.byteLength)));
    if (!(/^\s*solid/i.test(head) && /facet/i.test(head))) {
      if (buf.byteLength >= 84) binary = true; else throw new Error('Fichier STL invalide');
    }
  }
  let pos;
  if (binary) {
    const n = dv.getUint32(80, true); pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
  } else {
    const txt = new TextDecoder().decode(new Uint8Array(buf));
    const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g, a = []; let m;
    while ((m = re.exec(txt))) a.push(+m[1], +m[2], +m[3]);
    if (a.length % 9) a.length -= a.length % 9;
    pos = new Float32Array(a);
  }
  if (!pos.length) throw new Error('STL vide');
  return weldVertices(pos);
}
/* OBJ : géométrie + couleurs de sommets (v x y z r g b) + textures (MTL + images) « cuites » en couleurs de sommets.
   ctx = { mtl: texte du .mtl, images: Map(nom_minuscule → {w,h,data RGBA}) } */
function parseMTL(txt) {
  const mats = {}; let cur = null;
  (txt || '').split(/\r?\n/).forEach(l => { const p = l.trim().split(/\s+/), k = (p[0] || '').toLowerCase();
    if (k === 'newmtl') cur = mats[p.slice(1).join(' ')] = { kd: [0.8, 0.8, 0.8], map: null };
    else if (cur && k === 'kd') cur.kd = [+p[1], +p[2], +p[3]];
    else if (cur && k === 'map_kd') cur.map = p[p.length - 1].split(/[\\/]/).pop().toLowerCase(); });
  return mats;
}
function sampleTex(img, u, vv) {
  u = u - Math.floor(u); vv = vv - Math.floor(vv); const x = u * (img.w - 1), y = (1 - vv) * (img.h - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, img.w - 1), y1 = Math.min(y0 + 1, img.h - 1), fx = x - x0, fy = y - y0, d = img.data, o = [0, 0, 0];
  for (let k = 0; k < 3; k++) { const a = d[(y0 * img.w + x0) * 4 + k], b = d[(y0 * img.w + x1) * 4 + k], c = d[(y1 * img.w + x0) * 4 + k], e = d[(y1 * img.w + x1) * 4 + k]; o[k] = ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy) / 255; }
  return o;
}
function parseOBJ(text, ctx) {
  const v = [], vc = [], vt = [], f = [], corners = []; let hasVC = false, mat = null; const mats = ctx && ctx.mtl ? parseMTL(ctx.mtl) : {};
  const lines = text.split(/\r?\n/);
  for (const l of lines) {
    if (l.charCodeAt(0) === 118 && l.charCodeAt(1) === 32) { const p = l.trim().split(/\s+/); v.push(+p[1], +p[2], +p[3]); if (p.length >= 7) { hasVC = true; vc.push(+p[4], +p[5], +p[6]); } else vc.push(-1, -1, -1); }
    else if (l.startsWith('vt ')) { const p = l.trim().split(/\s+/); vt.push(+p[1], +p[2]); }
    else if (l.startsWith('usemtl ')) mat = mats[l.slice(7).trim()] || null;
    else if (l.startsWith('f ')) {
      const p = l.trim().split(/\s+/).slice(1).map(s => { const q = s.split('/'); let i = parseInt(q[0], 10), t = q[1] ? parseInt(q[1], 10) : NaN; return [i < 0 ? v.length / 3 + i : i - 1, isNaN(t) ? -1 : (t < 0 ? vt.length / 2 + t : t - 1)]; });
      for (let i = 1; i < p.length - 1; i++) { f.push(p[0][0], p[i][0], p[i + 1][0]); corners.push([p[0], p[i], p[i + 1], mat]); }
    }
  }
  if (!f.length) throw new Error('OBJ sans faces');
  const mesh = new Mesh(new Float32Array(v), new Uint32Array(f)), nV = v.length / 3;
  const tex = (m) => m && m.map && ctx && ctx.images ? ctx.images.get(m.map) : null;
  const needTex = corners.some(c => tex(c[3]) && c[0][1] >= 0);
  if (needTex) {
    const sum = new Float32Array(nV * 3), cnt = new Uint16Array(nV);
    for (const c of corners) for (let k = 0; k < 3; k++) { const [vi, ti] = c[k], im = tex(c[3]); let col; if (im && ti >= 0) col = sampleTex(im, vt[ti * 2], vt[ti * 2 + 1]); else if (hasVC && vc[vi * 3] >= 0) col = [vc[vi * 3], vc[vi * 3 + 1], vc[vi * 3 + 2]]; else col = c[3] ? c[3].kd : [0.8, 0.8, 0.8]; sum[vi * 3] += col[0]; sum[vi * 3 + 1] += col[1]; sum[vi * 3 + 2] += col[2]; cnt[vi]++; }
    mesh.c = new Float32Array(nV * 3); for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) mesh.c[i * 3 + k] = cnt[i] ? sum[i * 3 + k] / cnt[i] : 0.8;
    mesh.textured = true;
  } else if (hasVC) { mesh.c = new Float32Array(nV * 3); for (let i = 0; i < nV * 3; i++) mesh.c[i] = vc[i] < 0 ? 0.8 : (vc[i] > 1 ? vc[i] / 255 : vc[i]); }
  return mesh;
}
function parsePLY(buf) {
  const u8 = new Uint8Array(buf); let hdrEnd = 0, s = '';
  for (let i = 0; i < Math.min(u8.length, 4096); i++) { s += String.fromCharCode(u8[i]); if (s.endsWith('end_header\n')) { hdrEnd = i + 1; break; } }
  if (!hdrEnd) throw new Error('En-tête PLY invalide');
  const lines = s.split(/\r?\n/); let fmt = 'ascii', nV = 0, nF = 0, cur = '', vprops = [];
  let fcount = 'uchar', fidx = 'int';
  for (const l of lines) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'format') fmt = p[1];
    else if (p[0] === 'element') { cur = p[1]; if (cur === 'vertex') nV = +p[2]; else if (cur === 'face') nF = +p[2]; }
    else if (p[0] === 'property') {
      if (cur === 'vertex') vprops.push({ type: p[1], name: p[2] });
      else if (cur === 'face' && p[1] === 'list') { fcount = p[2]; fidx = p[3]; }
    }
  }
  const sz = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2, int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const v = new Float32Array(nV * 3), f = [], names0 = vprops.map(p => p.name), cIdx = ['red', 'green', 'blue'].map(n => names0.indexOf(n)), hasCol = cIdx.every(i => i >= 0), col = hasCol ? new Float32Array(nV * 3) : null;
  const cScale = hasCol ? (/^(float|double|float32|float64)$/.test(vprops[cIdx[0]].type) ? 1 : 1 / 255) : 1;
  if (fmt === 'ascii') {
    const body = new TextDecoder().decode(u8.subarray(hdrEnd)).split(/\r?\n/);
    const names = vprops.map(p => p.name), ix = names.indexOf('x'), iy = names.indexOf('y'), iz = names.indexOf('z');
    for (let i = 0; i < nV; i++) { const p = body[i].trim().split(/\s+/); v[i * 3] = +p[ix]; v[i * 3 + 1] = +p[iy]; v[i * 3 + 2] = +p[iz]; if (col) for (let k = 0; k < 3; k++) col[i * 3 + k] = p[cIdx[k]] * cScale; }
    for (let i = 0; i < nF; i++) { const p = body[nV + i].trim().split(/\s+/).map(Number); const n = p[0]; for (let k = 1; k < n - 1; k++) f.push(p[1], p[1 + k], p[2 + k]); }
  } else {
    const le = fmt === 'binary_little_endian', dv = new DataView(buf); let o = hdrEnd;
    const rd = (t, off) => {
      switch (t) {
        case 'char': case 'int8': return dv.getInt8(off); case 'uchar': case 'uint8': return dv.getUint8(off);
        case 'short': case 'int16': return dv.getInt16(off, le); case 'ushort': case 'uint16': return dv.getUint16(off, le);
        case 'int': case 'int32': return dv.getInt32(off, le); case 'uint': case 'uint32': return dv.getUint32(off, le);
        case 'float': case 'float32': return dv.getFloat32(off, le); default: return dv.getFloat64(off, le);
      }
    };
    for (let i = 0; i < nV; i++) {
      for (const p of vprops) { const val = rd(p.type, o); o += sz[p.type]; if (p.name === 'x') v[i * 3] = val; else if (p.name === 'y') v[i * 3 + 1] = val; else if (p.name === 'z') v[i * 3 + 2] = val; else if (col && p.name === 'red') col[i * 3] = val * cScale; else if (col && p.name === 'green') col[i * 3 + 1] = val * cScale; else if (col && p.name === 'blue') col[i * 3 + 2] = val * cScale; }
    }
    for (let i = 0; i < nF; i++) {
      const n = rd(fcount, o); o += sz[fcount]; const p = [];
      for (let k = 0; k < n; k++) { p.push(rd(fidx, o)); o += sz[fidx]; }
      for (let k = 1; k < n - 1; k++) f.push(p[0], p[k], p[k + 1]);
    }
  }
  if (!f.length) throw new Error('PLY sans faces');
  const mesh = new Mesh(v, new Uint32Array(f)); if (col) mesh.c = col; return mesh;
}
async function parseMeshFile(file, ctx) {
  const ext = file.name.split('.').pop().toLowerCase(), buf = await file.arrayBuffer();
  if (ext === 'stl') return parseSTL(buf);
  if (ext === 'obj') return parseOBJ(new TextDecoder().decode(buf), ctx);
  if (ext === 'ply') return parsePLY(buf);
  throw new Error('Format non pris en charge : .' + ext);
}

/* ---------------- Export STL ---------------- */
function meshToSTLBinary(mesh, header) {
  const nt = mesh.nt, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
  const h = (header || 'JophyOrtho 3D').slice(0, 79);
  for (let i = 0; i < h.length; i++) dv.setUint8(i, h.charCodeAt(i) & 127);
  dv.setUint32(80, nt, true); const v = mesh.v, f = mesh.f; let o = 84;
  for (let i = 0; i < nt; i++) {
    const a = f[i * 3] * 3, b = f[i * 3 + 1] * 3, c = f[i * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    [a, b, c].forEach((j, k) => { dv.setFloat32(o + 12 + k * 12, v[j], true); dv.setFloat32(o + 16 + k * 12, v[j + 1], true); dv.setFloat32(o + 20 + k * 12, v[j + 2], true); });
    o += 50;
  }
  return buf;
}

/* ---------------- Contrôle qualité d'un maillage ---------------- */
function analyzeMesh(m) {
  const edges = new Map(), f = m.f;
  for (let i = 0; i < f.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = f[i + k], b = f[i + (k + 1) % 3], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    const e = edges.get(key) || { n: 0, dir: 0 }; e.n++; e.dir += a < b ? 1 : -1; edges.set(key, e);
  }
  let open = 0, nonManifold = 0, inconsistent = 0;
  edges.forEach(e => { if (e.n === 1) open++; else if (e.n > 2) nonManifold++; else if (e.dir !== 0) inconsistent++; });
  const vol = signedVolume(m);
  return { open, nonManifold, inconsistent, closed: open === 0 && nonManifold === 0, flipped: vol < 0, signedVolume: vol };
}
function signedVolume(m) {
  const v = m.v, f = m.f; let s = 0;
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  return s / 6;
}
/* Réparation NON destructive : renvoie une nouvelle copie (l'original n'est jamais modifié) */
function repairMesh(m) {
  const o = m.clone();
  if (signedVolume(o) < 0) { for (let i = 0; i < o.f.length; i += 3) { const t = o.f[i + 1]; o.f[i + 1] = o.f[i + 2]; o.f[i + 2] = t; } }
  // supprime triangles dégénérés
  const keep = []; const v = o.v;
  for (let i = 0; i < o.f.length; i += 3) {
    const a = o.f[i], b = o.f[i + 1], c = o.f[i + 2]; if (a === b || b === c || a === c) continue;
    const ux = v[b * 3] - v[a * 3], uy = v[b * 3 + 1] - v[a * 3 + 1], uz = v[b * 3 + 2] - v[a * 3 + 2], wx = v[c * 3] - v[a * 3], wy = v[c * 3 + 1] - v[a * 3 + 1], wz = v[c * 3 + 2] - v[a * 3 + 2];
    if (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) < 1e-9) continue; keep.push(a, b, c);
  }
  o.f = new Uint32Array(keep); return o.touch();
}
/* Segments des arêtes ouvertes (pour affichage des limites) */
function openEdgeSegments(m) {
  const cnt = new Map(), f = m.f;
  for (let i = 0; i < f.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = f[i + k], b = f[i + (k + 1) % 3], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    const e = cnt.get(key); if (e) e.n++; else cnt.set(key, { a, b, n: 1 });
  }
  const out = []; cnt.forEach(e => { if (e.n !== 2) out.push(m.v[e.a * 3], m.v[e.a * 3 + 1], m.v[e.a * 3 + 2], m.v[e.b * 3], m.v[e.b * 3 + 1], m.v[e.b * 3 + 2]); });
  return new Float32Array(out);
}
/* sous-maillage : ne garde que les triangles dont mask[i] = 1 (sommets recompactés, couleurs conservées) */
function subMeshByTri(m, mask) {
  const map = new Int32Array(m.nv).fill(-1); let nv = 0, nt = 0;
  for (let i = 0; i < m.nt; i++) if (mask[i]) { nt++; for (let k = 0; k < 3; k++) { const a = m.f[i * 3 + k]; if (map[a] < 0) map[a] = nv++; } }
  const v = new Float32Array(nv * 3), f = new Uint32Array(nt * 3), cs = m.c ? m.c.length / m.nv : 0, c = cs ? new Float32Array(nv * cs) : null;
  for (let a = 0; a < m.nv; a++) { const b = map[a]; if (b < 0) continue; v[b * 3] = m.v[a * 3]; v[b * 3 + 1] = m.v[a * 3 + 1]; v[b * 3 + 2] = m.v[a * 3 + 2]; if (c) for (let k = 0; k < cs; k++) c[b * cs + k] = m.c[a * cs + k]; }
  let j = 0; for (let i = 0; i < m.nt; i++) if (mask[i]) { f[j++] = map[m.f[i * 3]]; f[j++] = map[m.f[i * 3 + 1]]; f[j++] = map[m.f[i * 3 + 2]]; }
  const o = new Mesh(v, f); if (c) o.c = c; if (m.textured) o.textured = true; return o.touch();
}
function rleEnc(mask) { const a = []; let cur = 0, run = 0; for (let i = 0; i < mask.length; i++) { const b = mask[i] ? 1 : 0; if (b === cur) run++; else { a.push(run); run = 1; cur = b; } } a.push(run); return a; }
function rleDec(a, nt) { const m = new Uint8Array(nt); let i = 0, v = 0; for (const r of a) { if (v) m.fill(1, i, i + r); i += r; v ^= 1; } return m; }
/* Lancer de rayon (Möller–Trumbore) → {t, tri, point} ou null */
function raycastMesh(m, o, d, maxT) {
  const v = m.v, f = m.f; let best = null;
  for (let i = 0; i < f.length; i += 3) {
    const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3;
    const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2], e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
    const id = 1 / det, tx = o[0] - v[a], ty = o[1] - v[a + 1], tz = o[2] - v[a + 2];
    const u = (tx * px + ty * py + tz * pz) * id; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const w = (d[0] * qx + d[1] * qy + d[2] * qz) * id; if (w < 0 || u + w > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * id; if (t > 1e-6 && (!best || t < best.t) && (!maxT || t < maxT)) best = { t, tri: i / 3 };
  }
  if (best) best.point = V.add(o, V.mul(d, best.t));
  return best;
}

/* copie soudée (positions identiques fusionnées) — sert aux contrôles d'étanchéité */
function weldIndexed(m, tol) {
  const q = 1 / (tol || 1e-3), map = new Map(), remap = new Uint32Array(m.nv), v = [];
  for (let i = 0; i < m.nv; i++) { const k = Math.round(m.v[i * 3] * q) + '_' + Math.round(m.v[i * 3 + 1] * q) + '_' + Math.round(m.v[i * 3 + 2] * q); let id = map.get(k); if (id === undefined) { id = v.length / 3; map.set(k, id); v.push(m.v[i * 3], m.v[i * 3 + 1], m.v[i * 3 + 2]); } remap[i] = id; }
  const f = []; for (let i = 0; i < m.f.length; i += 3) { const a = remap[m.f[i]], b = remap[m.f[i + 1]], c = remap[m.f[i + 2]]; if (a !== b && b !== c && a !== c) f.push(a, b, c); }
  return new Mesh(new Float32Array(v), new Uint32Array(f));
}

/* ---------- Coupe par plan (comme « Plane Cut » de Meshmixer) ----------
   Conserve le côté « above » (celui vers lequel pointe la normale) ou « below », recoupe les triangles traversés,
   et ferme (optionnellement) la section par un remplissage plat triangulé. Retourne un NOUVEAU maillage. */
function planeCut(m, o, n, keep, fill) {
  const nl = Math.hypot(n[0], n[1], n[2]) || 1, nx = n[0] / nl, ny = n[1] / nl, nz = n[2] / nl, s = keep === 'above' ? 1 : -1;
  const v = m.v, f = m.f, nvs = m.nv, d = new Float64Array(nvs);
  for (let i = 0; i < nvs; i++) { const x = s * ((v[i * 3] - o[0]) * nx + (v[i * 3 + 1] - o[1]) * ny + (v[i * 3 + 2] - o[2]) * nz); d[i] = Math.abs(x) < 1e-7 ? 0 : x; }
  const pos = [], cols = [], map = new Map(), tris = [], segs = [], hasC = !!m.c, mc = m.c;
  const idOf = (x, y, z, c0, c1, c2) => { const k = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000); let id = map.get(k); if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(x, y, z); if (hasC) cols.push(c0, c1, c2); } return id; };
  const idV = i => hasC ? idOf(v[i * 3], v[i * 3 + 1], v[i * 3 + 2], mc[i * 3], mc[i * 3 + 1], mc[i * 3 + 2]) : idOf(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  const P3 = i => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
  const isect = (i, j) => {
    let a = i, b = j; const pa = P3(a), pb = P3(b);
    if (pb[0] < pa[0] || (pb[0] === pa[0] && (pb[1] < pa[1] || (pb[1] === pa[1] && pb[2] < pa[2])))) { a = j; b = i; }
    const A = P3(a), B = P3(b), t = d[a] / (d[a] - d[b]), L = (k) => mc[a * 3 + k] + (mc[b * 3 + k] - mc[a * 3 + k]) * t; return hasC ? idOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, L(0), L(1), L(2)) : idOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t], b = f[t + 1], c = f[t + 2], ia = d[a] >= 0, ib = d[b] >= 0, ic = d[c] >= 0;
    if (ia && ib && ic) { const A = idV(a), B = idV(b), C = idV(c); if (A !== B && B !== C && A !== C) tris.push(A, B, C); continue; }
    if (!ia && !ib && !ic) continue;
    const vs = [a, b, c], ins = [ia, ib, ic], poly = []; let ex = -1, en = -1;
    for (let k = 0; k < 3; k++) {
      const cu = vs[k], nx2 = vs[(k + 1) % 3];
      if (ins[k]) poly.push(idV(cu));
      if (ins[k] !== ins[(k + 1) % 3]) { const id = isect(cu, nx2); poly.push(id); if (ins[k]) ex = id; else en = id; }
    }
    const q = poly.filter((id, k) => id !== poly[(k + 1) % poly.length]);
    for (let k = 1; k + 1 < q.length; k++) if (q[0] !== q[k] && q[k] !== q[k + 1] && q[0] !== q[k + 1]) tris.push(q[0], q[k], q[k + 1]);
    if (ex >= 0 && en >= 0 && ex !== en) segs.push([ex, en]);
  }
  const info = { loops: 0, holes: 0, open: 0, capTris: 0 };
  if (fill !== 'none' && segs.length) {
    const from = new Map(); segs.forEach((sg, i) => { let l = from.get(sg[0]); if (!l) from.set(sg[0], l = []); l.push(i); });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; const chain = [segs[i][0]]; used[i] = 1; let cur = segs[i][1], closed = false, guard = 0;
      while (guard++ < segs.length + 5) {
        if (cur === chain[0]) { closed = true; break; }
        chain.push(cur); const cand = (from.get(cur) || []).find(k => !used[k]); if (cand === undefined) break; used[cand] = 1; cur = segs[cand][1];
      }
      if (closed && chain.length >= 3) loops.push(chain); else info.open++;
    }
    // base du plan
    const ref = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let ux = ny * ref[2] - nz * ref[1], uy = nz * ref[0] - nx * ref[2], uz = nx * ref[1] - ny * ref[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux;
    const L2 = loops.map(l => { const p2 = l.map(id => [pos[id * 3] * ux + pos[id * 3 + 1] * uy + pos[id * 3 + 2] * uz, pos[id * 3] * wx + pos[id * 3 + 1] * wy + pos[id * 3 + 2] * wz]); let a = 0; for (let i = 0; i < p2.length; i++) { const q = p2[(i + 1) % p2.length]; a += p2[i][0] * q[1] - q[0] * p2[i][1]; } return { l, p2, a: a / 2 }; });
    if (L2.length) {
      const big = L2.reduce((b, x) => Math.abs(x.a) > Math.abs(b.a) ? x : b, L2[0]), sg0 = Math.sign(big.a);
      for (const lp of L2) {
        if (Math.sign(lp.a) !== sg0) { info.holes++; continue; }
        let ids = lp.l.slice(), pts = lp.p2.slice(); if (sg0 < 0) { ids.reverse(); pts.reverse(); }
        const idx = pts.map((_, i) => i); let guard = 0, i = 0;
        const cross = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[b][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[b][0]);
        const inTri = (p, a, b, c) => { const d1 = (p[0] - pts[b][0]) * (pts[a][1] - pts[b][1]) - (pts[a][0] - pts[b][0]) * (p[1] - pts[b][1]), d2 = (p[0] - pts[c][0]) * (pts[b][1] - pts[c][1]) - (pts[b][0] - pts[c][0]) * (p[1] - pts[c][1]), d3 = (p[0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[c][0] - pts[a][0]) * (p[1] - pts[a][1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
        const capT = [];
        while (idx.length > 3 && guard++ < pts.length * 4 + 20) {
          const Ln = idx.length; let found = false;
          for (let t = 0; t < Ln; t++) {
            const k = (i + t) % Ln, a = idx[(k + Ln - 1) % Ln], b = idx[k], c = idx[(k + 1) % Ln];
            if (cross(a, b, c) <= 1e-12) continue;
            let ok = true; for (let q = 0; q < Ln; q++) { const z = idx[q]; if (z === a || z === b || z === c) continue; if (inTri(pts[z], a, b, c)) { ok = false; break; } }
            if (!ok) continue; capT.push(ids[a], ids[b], ids[c]); idx.splice(k, 1); i = k % idx.length; found = true; break;
          }
          if (!found) break;
        }
        if (idx.length >= 3) for (let k = 1; k + 1 < idx.length; k++) capT.push(ids[idx[0]], ids[idx[k]], ids[idx[k + 1]]);
        // orientation : la normale du remplissage regarde la partie supprimée (−s·n)
        for (let t = 0; t < capT.length; t += 3) {
          const A = capT[t], B = capT[t + 1], C = capT[t + 2], e1 = [pos[B * 3] - pos[A * 3], pos[B * 3 + 1] - pos[A * 3 + 1], pos[B * 3 + 2] - pos[A * 3 + 2]], e2 = [pos[C * 3] - pos[A * 3], pos[C * 3 + 1] - pos[A * 3 + 1], pos[C * 3 + 2] - pos[A * 3 + 2]];
          const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
          if ((cx * nx + cy * ny + cz * nz) * (-s) >= 0) tris.push(A, B, C); else tris.push(A, C, B);
          info.capTris++;
        }
        info.loops++;
      }
    }
  }
  const out = new Mesh(new Float32Array(pos), new Uint32Array(tris)); if (hasC) { if (info.capTris) { /* le remplissage prend la couleur des sommets du contour */ } out.c = new Float32Array(cols); } out.cutInfo = info; return out;
}
/* ne garde que la plus grande pièce connexe (supprime les îlots flottants après une coupe) */
function keepLargestShell(m) {
  const nvs = m.nv, par = new Int32Array(nvs).map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const f = m.f; for (let t = 0; t < f.length; t += 3) { const a = find(f[t]), b = find(f[t + 1]), c = find(f[t + 2]); par[b] = a; par[find(c)] = find(a); }
  const cnt = new Map(); for (let t = 0; t < f.length; t += 3) { const r = find(f[t]); cnt.set(r, (cnt.get(r) || 0) + 1); }
  if (cnt.size <= 1) return m; let best = -1, bc = 0; cnt.forEach((c, r) => { if (c > bc) { bc = c; best = r; } });
  const remap = new Int32Array(nvs).fill(-1), pos = [], tr = [], cc = []; const vv = m.v;
  for (let t = 0; t < f.length; t += 3) { if (find(f[t]) !== best) continue; for (let k = 0; k < 3; k++) { const i = f[t + k]; if (remap[i] < 0) { remap[i] = pos.length / 3; pos.push(vv[i * 3], vv[i * 3 + 1], vv[i * 3 + 2]); if (m.c) cc.push(m.c[i * 3], m.c[i * 3 + 1], m.c[i * 3 + 2]); } tr.push(remap[i]); } }
  const o = new Mesh(new Float32Array(pos), new Uint32Array(tr)); if (m.c) o.c = new Float32Array(cc); o.removedShells = cnt.size - 1; return o;
}

/* PLY binaire avec couleurs de sommets (zones colorées, texture du scan) — le STL ne peut pas porter de couleur */
function meshToPLYBinary(mesh, colors) {
  const nv = mesh.nv, nt = mesh.nt, col = colors || mesh.c, hdr = `ply\nformat binary_little_endian 1.0\ncomment JophyOrtho3D\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\n` + (col ? 'property uchar red\nproperty uchar green\nproperty uchar blue\n' : '') + `element face ${nt}\nproperty list uchar int vertex_indices\nend_header\n`;
  const hb = new TextEncoder().encode(hdr), vs = 12 + (col ? 3 : 0), buf = new ArrayBuffer(hb.length + nv * vs + nt * 13), u8 = new Uint8Array(buf), dv = new DataView(buf); u8.set(hb, 0); let o = hb.length;
  for (let i = 0; i < nv; i++) { dv.setFloat32(o, mesh.v[i * 3], true); dv.setFloat32(o + 4, mesh.v[i * 3 + 1], true); dv.setFloat32(o + 8, mesh.v[i * 3 + 2], true); o += 12; if (col) { for (let k = 0; k < 3; k++) dv.setUint8(o + k, Math.round(clamp(col[i * 3 + k], 0, 1) * 255)); o += 3; } }
  for (let i = 0; i < nt; i++) { dv.setUint8(o, 3); dv.setInt32(o + 1, mesh.f[i * 3], true); dv.setInt32(o + 5, mesh.f[i * 3 + 1], true); dv.setInt32(o + 9, mesh.f[i * 3 + 2], true); o += 13; }
  return buf;
}
/* Repère d'export « CAD / impression 3D » : Z vers le haut (axe proximal), face antérieure vers −Y, posé sur Z = 0, centré en XY. */
function toCadFrame(mesh) {
  const o = mesh.clone(), v = o.v; for (let i = 0; i < v.length; i += 3) { const y = v[i + 1], z = v[i + 2]; v[i + 1] = -z; v[i + 2] = y; }
  o.touch(); const b = o.bounds(), dx = -(b.min[0] + b.max[0]) / 2, dy = -(b.min[1] + b.max[1]) / 2, dz = -b.min[2];
  for (let i = 0; i < v.length; i += 3) { v[i] += dx; v[i + 1] += dy; v[i + 2] += dz; } return o.touch();
}
