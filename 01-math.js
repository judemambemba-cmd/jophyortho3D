/* JophyOrtho 3D — 01 : mathématiques (vec3, mat4) — WebGL natif, sans dépendance */
'use strict';
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;

const M4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) { // a*b (colonnes)
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = M4.ident();
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); return o;
  },
  lookAt(e, c, u) {
    const z = V.norm(V.sub(e, c)), x = V.norm(V.cross(u, z)), y = V.cross(z, x), o = M4.ident();
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[1] = y[0]; o[5] = y[1]; o[9] = y[2];
    o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -V.dot(x, e); o[13] = -V.dot(y, e); o[14] = -V.dot(z, e); return o;
  },
  translate(t) { const o = M4.ident(); o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; return o; },
  rotX(a) { const o = M4.ident(), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY(a) { const o = M4.ident(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  rotZ(a) { const o = M4.ident(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  apply(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  },
  applyDir(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
  },
  invert(m) {
    const i = new Float32Array(16), a = m;
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!d) return M4.ident(); d = 1 / d;
    i[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; i[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    i[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; i[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    i[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; i[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    i[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; i[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    i[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; i[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    i[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; i[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    i[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; i[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    i[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; i[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return i;
  }
};
/* Transformation « alignement » : rotations (deg) autour de l'origine + translation */
function composeTransform(flex, abd, rot, t, pivot) {
  pivot = pivot || [0, 0, 0];
  let m = M4.translate(t);
  m = M4.mul(m, M4.translate(pivot));
  m = M4.mul(m, M4.rotX(rad(flex)));
  m = M4.mul(m, M4.rotZ(rad(abd)));
  m = M4.mul(m, M4.rotY(rad(rot)));
  m = M4.mul(m, M4.translate(V.mul(pivot, -1)));
  return m;
}
