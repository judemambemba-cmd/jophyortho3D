/* JophyOrtho 3D — 04 : grille de sections (Sec) = base commune de reconstruction, rectification et coque.
   Convention : Y = axe proximo-distal (+ = proximal), Z = antérieur (+), X = latéral (+). Angle θ=0 vers +Z, θ=90° vers +X. Unité : mm. */
'use strict';
const NA = 96; // nombre d'angles par section
class Sec {
  constructor(ys, A) {
    this.ys = Float32Array.from(ys); this.L = ys.length; this.A = A || NA;
    this.cx = new Float32Array(this.L); this.cz = new Float32Array(this.L); this.r = new Float32Array(this.L * this.A);
  }
  clone() { const s = new Sec(this.ys, this.A); s.cx.set(this.cx); s.cz.set(this.cz); s.r.set(this.r); return s; }
  get y0() { return this.ys[0]; } get y1() { return this.ys[this.L - 1]; }
  _idx(y) { // indice flottant du niveau
    const ys = this.ys; if (y <= ys[0]) return 0; if (y >= ys[this.L - 1]) return this.L - 1;
    let lo = 0, hi = this.L - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ys[m] <= y) lo = m; else hi = m; }
    return lo + (y - ys[lo]) / ((ys[hi] - ys[lo]) || 1);
  }
  rAt(y, j) { const f = this._idx(y), i = Math.floor(f), t = f - i, i2 = Math.min(i + 1, this.L - 1), A = this.A; j = ((j % A) + A) % A; return lerp(this.r[i * A + j], this.r[i2 * A + j], t); }
  cAt(y) { const f = this._idx(y), i = Math.floor(f), t = f - i, i2 = Math.min(i + 1, this.L - 1); return [lerp(this.cx[i], this.cx[i2], t), lerp(this.cz[i], this.cz[i2], t)]; }
  pointAt(y, j) { const c = this.cAt(y), r = this.rAt(y, j), a = j / this.A * Math.PI * 2; return [c[0] + r * Math.sin(a), y, c[1] + r * Math.cos(a)]; }
  perimeterAt(y) { let s = 0, p = this.pointAt(y, 0), p0 = p; for (let j = 1; j <= this.A; j++) { const q = j === this.A ? p0 : this.pointAt(y, j); s += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; } return s; }
  widthAt(y) { // ML (X) et AP (Z) extrêmes
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let j = 0; j < this.A; j++) { const p = this.pointAt(y, j); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    return { ml: x1 - x0, ap: z1 - z0, xmin: x0, xmax: x1, zmin: z0, zmax: z1 };
  }
}
/* Lissage léger (θ circulaire puis y) — appliqué à une COPIE */
function smoothSec(sec, passes) {
  const s = sec.clone(), A = s.A, L = s.L;
  for (let p = 0; p < (passes || 1); p++) {
    const t = new Float32Array(s.r);
    for (let i = 0; i < L; i++) for (let j = 0; j < A; j++) s.r[i * A + j] = .25 * t[i * A + (j + A - 1) % A] + .5 * t[i * A + j] + .25 * t[i * A + (j + 1) % A];
    const u = new Float32Array(s.r);
    for (let i = 1; i < L - 1; i++) for (let j = 0; j < A; j++) s.r[i * A + j] = .25 * u[(i - 1) * A + j] + .5 * u[i * A + j] + .25 * u[(i + 1) * A + j];
  }
  return s;
}
/* Construit les anneaux 3D de la surface. o: {N, top(j)->y, bottom, delta(p,j,y)->mm radial, closed} */
function secRings(sec, o) {
  o = o || {}; const N = o.N || 64, A = sec.A, rings = [], y0 = o.bottom != null ? o.bottom : sec.y0;
  for (let i = 0; i <= N; i++) {
    const s = i / N, ring = [];
    for (let j = 0; j < A; j++) {
      const top = o.top ? o.top(j) : sec.y1, yb = o.bottomFn ? o.bottomFn(j) : y0, y = yb + (top - yb) * s;
      const c = sec.cAt(y); let r = sec.rAt(y, j); const a = j / A * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      let p = [c[0] + r * sx, y, c[1] + r * cz];
      if (o.delta) { const d = o.delta(p, j, y); if (d) { r = Math.max(0.0, r + d); p = [c[0] + r * sx, y, c[1] + r * cz]; } }
      ring.push(p);
    }
    rings.push(ring);
  }
  return rings;
}
function secToMesh(sec, o) {
  o = o || {}; const rings = secRings(sec, o);
  return Prim.fromRings(rings, { flip: true, capStart: !!o.capStart, capEnd: !!o.capEnd });
}
/* Surface décalée le long des normales (épaisseur variable). thick(p)->mm ; renvoie un NOUVEAU maillage */
function offsetMesh(mesh, thick) {
  const n = mesh.normals(), v = mesh.v, o = mesh.clone();
  for (let i = 0; i < v.length; i += 3) { const t = thick([v[i], v[i + 1], v[i + 2]], i / 3); o.v[i] = v[i] + n[i] * t; o.v[i + 1] = v[i + 1] + n[i + 1] * t; o.v[i + 2] = v[i + 2] + n[i + 2] * t; }
  return o.touch();
}
function flipMesh(m) { const o = m.clone(); for (let i = 0; i < o.f.length; i += 3) { const t = o.f[i + 1]; o.f[i + 1] = o.f[i + 2]; o.f[i + 2] = t; } return o.touch(); }

/* Extraction des sections d'un scan (le scan lui-même n'est jamais modifié).
   Hypothèse : section « étoilée » autour d'un centre (les contre-dépouilles ne sont pas représentées). */
function extractSections(mesh, o) {
  o = o || {}; const v = mesh.v, f = mesh.f, b = mesh.bounds(), y0 = b.min[1], y1 = b.max[1];
  const L = clamp(Math.round((y1 - y0) / (o.step || 3)), 24, 180), ys = []; for (let i = 0; i < L; i++) ys.push(y0 + (y1 - y0) * i / (L - 1));
  const segs = Array.from({ length: L }, () => []), dy = (y1 - y0) / (L - 1) || 1;
  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3, bb = f[t + 1] * 3, c = f[t + 2] * 3, ya = v[a + 1], yb = v[bb + 1], yc = v[c + 1];
    const lo = Math.min(ya, yb, yc), hi = Math.max(ya, yb, yc);
    let i0 = Math.max(0, Math.ceil((lo - y0) / dy - 1e-9)), i1 = Math.min(L - 1, Math.floor((hi - y0) / dy + 1e-9));
    for (let i = i0; i <= i1; i++) {
      const y = ys[i], pts = [];
      [[a, bb], [bb, c], [c, a]].forEach(e => {
        const p = e[0], q = e[1], yp = v[p + 1], yq = v[q + 1];
        if ((yp - y) * (yq - y) < 0 || (yp === y && yq !== y)) { const s = (y - yp) / (yq - yp); pts.push(v[p] + (v[q] - v[p]) * s, v[p + 2] + (v[q + 2] - v[p + 2]) * s); }
      });
      if (pts.length >= 4) segs[i].push(pts[0], pts[1], pts[2], pts[3]);
    }
  }
  const sec = new Sec(ys, NA), A = NA; let lastC = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  for (let i = 0; i < L; i++) {
    const sg = segs[i]; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (let k = 0; k < sg.length; k += 2) { mnx = Math.min(mnx, sg[k]); mxx = Math.max(mxx, sg[k]); mnz = Math.min(mnz, sg[k + 1]); mxz = Math.max(mxz, sg[k + 1]); }
    const c = sg.length ? [(mnx + mxx) / 2, (mnz + mxz) / 2] : lastC; lastC = c; sec.cx[i] = c[0]; sec.cz[i] = c[1];
    const r = new Float32Array(A).fill(-1);
    for (let k = 0; k < sg.length; k += 4) {
      const px = sg[k] - c[0], pz = sg[k + 1] - c[1], qx = sg[k + 2] - c[0], qz = sg[k + 3] - c[1];
      const a1 = Math.atan2(px, pz), a2 = Math.atan2(qx, qz); let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > 3.0) continue;
      const lo = Math.min(a1, a1 + d), hi = Math.max(a1, a1 + d);
      let j0 = Math.ceil(lo / (2 * Math.PI) * A - 1e-9), j1 = Math.floor(hi / (2 * Math.PI) * A + 1e-9);
      for (let jj = j0; jj <= j1; jj++) {
        const th = jj / A * 2 * Math.PI, dx = Math.sin(th), dz = Math.cos(th), ex = qx - px, ez = qz - pz, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
        const rr = (px * ez - pz * ex) / den; const j = ((jj % A) + A) % A; if (rr > r[j]) r[j] = rr;
      }
    }
    let any = false; for (let j = 0; j < A; j++) if (r[j] >= 0) any = true;
    if (!any) r.fill(0); else for (let j = 0; j < A; j++) if (r[j] < 0) { // interpolation circulaire
      let a = 1, b2 = 1; while (r[(j - a + A * 4) % A] < 0 && a < A) a++; while (r[(j + b2) % A] < 0 && b2 < A) b2++;
      const ra = r[(j - a + A * 4) % A], rb = r[(j + b2) % A]; r[j] = ra + (rb - ra) * a / (a + b2);
    }
    sec.r.set(r, i * A);
  }
  return sec;
}
