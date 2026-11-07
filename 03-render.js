/* JophyOrtho 3D — 03 : moteur de rendu WebGL natif (une seule boucle rAF, tampons mis en cache) */
'use strict';
class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL indisponible sur cet appareil');
    this.gl = gl;
    this.uint = gl.getExtension('OES_element_index_uint');
    this.objects = new Map();         // id -> objet de scène
    this.cache = new WeakMap();       // mesh -> tampons
    this.cam = { target: [0, 0, 0], dist: 800, yaw: 0.6, pitch: 0.25, ortho: false, fov: 38 };
    this.bg = [0.07, 0.09, 0.12];
    this.clip = { on: false, axis: 'x', pos: 0, flip: false };
    this.showAxes = true; this.dirty = true; this.running = false; this.onPick = null; this.onHover = null;
    this.size = { w: 1, h: 1 }; this.disposed = false;
    this._initShaders(); this._initInput(); this._loop = this._loop.bind(this);
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ctxLost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.ctxLost = false; this.cache = new WeakMap(); this._initShaders(); this.invalidate(); });
    this.resize(); this.start();
  }
  _prog(vs, fs) {
    const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  _initShaders() {
    this.sMesh = this._prog(`
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uN;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main(){ vec4 w=uM*vec4(aPos,1.0); vW=w.xyz; vN=uN*aNor; vC=aCol; gl_Position=uVP*w; }`, `
precision mediump float;
uniform vec3 uColor; uniform float uAlpha; uniform float uUseVC; uniform vec4 uClip; uniform float uClipOn; uniform vec3 uCut; uniform vec3 uEye; uniform float uOrtho; uniform vec3 uView;
varying vec3 vN; varying vec3 vW; varying vec3 vC;
void main(){
  if(uClipOn>0.5 && dot(uClip.xyz,vW)-uClip.w>0.0) discard;
  vec3 base=mix(uColor,vC,uUseVC);
  vec3 n=normalize(vN);
  vec3 vd = uOrtho>0.5 ? uView : normalize(uEye-vW);
  if(!gl_FrontFacing){ n=-n; if(uClipOn>0.5){ gl_FragColor=vec4(uCut,uAlpha); return; } }
  float h=0.5+0.5*n.y; vec3 amb=mix(vec3(0.20,0.22,0.26),vec3(0.46,0.48,0.52),h);
  float d1=max(dot(n,normalize(vec3(0.4,0.7,0.6))),0.0), d2=max(dot(n,vd),0.0);
  vec3 r=reflect(-vd,n); float sp=pow(max(dot(r,normalize(vec3(0.4,0.7,0.6))),0.0),24.0)*0.18;
  vec3 col=base*(amb*0.8+0.45*d1+0.35*d2)+vec3(sp);
  gl_FragColor=vec4(col,uAlpha);
}`);
    this.sLine = this._prog(`
attribute vec3 aPos; uniform mat4 uVP; uniform mat4 uM; varying vec3 vW;
void main(){ vec4 w=uM*vec4(aPos,1.0); vW=w.xyz; gl_Position=uVP*w; }`, `
precision mediump float; uniform vec3 uColor; uniform float uAlpha; uniform vec4 uClip; uniform float uClipOn; varying vec3 vW;
void main(){ if(uClipOn>0.5 && dot(uClip.xyz,vW)-uClip.w>0.0) discard; gl_FragColor=vec4(uColor,uAlpha); }`);
  }
  /* ---------- scène ---------- */
  set(id, o) { // o: {mesh|lines, color, alpha, visible, wire, matrix, vcolors, layer, noClip, order}
    const prev = this.objects.get(id) || {};
    this.objects.set(id, Object.assign({ id, color: [.8, .8, .8], alpha: 1, visible: true, wire: false, matrix: null, order: 0 }, o));
    this.dirty = true; return this.objects.get(id);
  }
  patch(id, p) { const o = this.objects.get(id); if (o) { Object.assign(o, p); this.dirty = true; } }
  remove(id) { this.objects.delete(id); this.dirty = true; }
  clear() { this.objects.clear(); this.dirty = true; }
  invalidate() { this.dirty = true; }
  _buf(mesh) {
    const gl = this.gl; let c = this.cache.get(mesh);
    if (c && c.rev === mesh.rev) return c;
    if (c) this._free(c);
    c = { rev: mesh.rev, nIdx: mesh.f.length };
    c.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, c.pos); gl.bufferData(gl.ARRAY_BUFFER, mesh.v, gl.STATIC_DRAW);
    const n = mesh.normals(); c.nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, c.nor); gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);
    c.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.uint ? mesh.f : new Uint16Array(mesh.f), gl.STATIC_DRAW);
    c.col = null; c.wire = null; this.cache.set(mesh, c); return c;
  }
  _free(c) { const gl = this.gl;[c.pos, c.nor, c.idx, c.col, c.wire].forEach(b => b && gl.deleteBuffer(b)); }
  freeMesh(mesh) { const c = this.cache.get(mesh); if (c) { this._free(c); this.cache.delete(mesh); } }
  _wire(mesh, c) {
    if (c.wire) return c;
    const f = mesh.f, seen = new Set(), e = [];
    for (let i = 0; i < f.length; i += 3) for (let k = 0; k < 3; k++) {
      const a = f[i + k], b = f[i + (k + 1) % 3], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      if (!seen.has(key)) { seen.add(key); e.push(a, b); }
    }
    const gl = this.gl; c.wire = gl.createBuffer(); c.nWire = e.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.wire); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.uint ? new Uint32Array(e) : new Uint16Array(e), gl.STATIC_DRAW);
    return c;
  }
  /* ---------- caméra ---------- */
  eye() {
    const c = this.cam, cp = Math.cos(c.pitch);
    return [c.target[0] + c.dist * Math.sin(c.yaw) * cp, c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * Math.cos(c.yaw) * cp];
  }
  matrices() {
    const c = this.cam, e = this.eye(), asp = this.size.w / this.size.h;
    const up = Math.abs(c.pitch) > 1.5 ? [-Math.sin(c.yaw) * Math.sign(c.pitch), 0, -Math.cos(c.yaw) * Math.sign(c.pitch)] : [0, 1, 0];
    const view = M4.lookAt(e, c.target, up);
    const near = Math.max(1, c.dist * 0.02), far = c.dist * 20 + 5000;
    let proj;
    if (c.ortho) { const h = c.dist * Math.tan(rad(c.fov) / 2); proj = M4.ortho(-h * asp, h * asp, -h, h, -far, far); }
    else proj = M4.persp(rad(c.fov), asp, near, far);
    return { view, proj, vp: M4.mul(proj, view), eye: e };
  }
  setView(name) {
    const P = Math.PI / 2, m = { ant: [0, 0], post: [Math.PI, 0], lat: [P, 0], med: [-P, 0], sup: [0, P - 0.001], inf: [0, -P + 0.001] }[name]; if (!m) return;
    this.cam.yaw = m[0]; this.cam.pitch = m[1]; this.dirty = true;
  }
  frame(bounds) {
    if (!bounds) bounds = this.sceneBounds(); if (!bounds) return;
    this.cam.target = bounds.center.slice(); const r = Math.max(V.len(bounds.size) * 0.5, 50);
    this.cam.dist = r / Math.tan(rad(this.cam.fov) / 2) * 1.5; this.dirty = true;
  }
  sceneBounds(filter) {
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], any = false;
    this.objects.forEach(o => {
      if (!o.mesh || !o.visible || (filter && !filter(o))) return; const b = o.mesh.bounds(); any = true;
      const pts = [b.min, b.max]; pts.forEach(p => { const q = o.matrix ? M4.apply(o.matrix, p) : p; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); } });
    });
    if (!any) return null; return { min: mn, max: mx, size: V.sub(mx, mn), center: V.mul(V.add(mn, mx), .5) };
  }
  resize() {
    const p = this.canvas.parentElement || this.canvas, r = p.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(r.width * dpr)), h = Math.max(2, Math.floor(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.size = { w, h }; this.dirty = true;
  }
  /* ---------- rayon de sélection ---------- */
  rayAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
    const { vp } = this.matrices(), inv = M4.invert(vp);
    const un = z => { const x = inv[0] * nx + inv[4] * ny + inv[8] * z + inv[12], y = inv[1] * nx + inv[5] * ny + inv[9] * z + inv[13], zz = inv[2] * nx + inv[6] * ny + inv[10] * z + inv[14], w = inv[3] * nx + inv[7] * ny + inv[11] * z + inv[15]; return [x / w, y / w, zz / w]; };
    const a = un(-1), b = un(1); return { o: a, d: V.norm(V.sub(b, a)) };
  }
  pick(clientX, clientY, filter) {
    const ray = this.rayAt(clientX, clientY); let best = null;
    this.objects.forEach(o => {
      if (!o.mesh || !o.visible || (filter && !filter(o))) return;
      let oo = ray.o, dd = ray.d;
      if (o.matrix) { const inv = M4.invert(o.matrix); oo = M4.apply(inv, ray.o); dd = V.norm(M4.applyDir(inv, ray.d)); }
      if (this.clip.on && !o.noClip) { /* ignore : coupe seulement visuelle */ }
      const h = raycastMesh(o.mesh, oo, dd); if (h && (!best || h.t < best.t)) { best = { id: o.id, t: h.t, point: h.point, tri: h.tri, obj: o }; }
    });
    return best;
  }
  /* ---------- interaction ---------- */
  _initInput() {
    const cv = this.canvas, ptrs = new Map(); let moved = 0, last = null, pinch = 0, mode = null, downAt = null;
    cv.style.touchAction = 'none';
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; downAt = [e.clientX, e.clientY, e.button];
      mode = (e.button === 2 || e.shiftKey || e.button === 1) ? 'pan' : 'rot'; last = [e.clientX, e.clientY];
      this.painting = !!(this.paintMode && this.onPaint && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey && ptrs.size === 1); if (this.painting) this.onPaint(e, 'down');
      if (ptrs.size === 2) { this.painting = false; const p = [...ptrs.values()]; pinch = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); mode = 'pinch'; }
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) { if (this.onHover) this.onHover(e); return; }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.painting && ptrs.size === 1) { this.onPaint(e, 'move'); return; }
      if (ptrs.size === 2) {
        const p = [...ptrs.values()], d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), cx = (p[0][0] + p[1][0]) / 2, cy = (p[0][1] + p[1][1]) / 2;
        if (pinch > 0) this.cam.dist = clamp(this.cam.dist * pinch / d, 20, 20000); pinch = d;
        if (this._lastMid) this._pan(cx - this._lastMid[0], cy - this._lastMid[1]); this._lastMid = [cx, cy]; moved += 5; this.dirty = true; return;
      }
      const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
      if (this.pickMode && moved < 6) return;
      if (mode === 'pan') this._pan(dx, dy);
      else if (mode === 'rot' && !(this.lockRotate)) { this.cam.yaw -= dx * 0.008; this.cam.pitch = clamp(this.cam.pitch + dy * 0.008, -1.5707, 1.5707); }
      this.dirty = true;
    });
    const up = e => {
      if (this.painting) { this.painting = false; ptrs.delete(e.pointerId); this.onPaint(e, 'up'); return; }
      const had = ptrs.delete(e.pointerId); if (ptrs.size < 2) { pinch = 0; this._lastMid = null; }
      if (had && moved < 6 && downAt && ptrs.size === 0 && this.onPick) this.onPick(e, downAt[2]);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.cam.dist = clamp(this.cam.dist * Math.exp(e.deltaY * 0.0012), 20, 20000); this.dirty = true; }, { passive: false });
  }
  _pan(dx, dy) {
    const { view } = this.matrices(), k = this.cam.dist * Math.tan(rad(this.cam.fov) / 2) * 2 / this.canvas.clientHeight;
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
    this.cam.target = V.add(this.cam.target, V.add(V.mul(right, -dx * k), V.mul(up, dy * k)));
  }
  /* ---------- boucle unique ---------- */
  start() { if (!this.running) { this.running = true; requestAnimationFrame(this._loop); } }
  stop() { this.running = false; }
  _loop() {
    if (!this.running || this.disposed) return;
    if (this.dirty && !this.ctxLost) { this.dirty = false; try { this.render(); } catch (e) { console.error(e); } }
    requestAnimationFrame(this._loop);
  }
  _clipVec() {
    const c = this.clip, n = c.axis === 'x' ? [1, 0, 0] : c.axis === 'y' ? [0, 1, 0] : [0, 0, 1], s = c.flip ? -1 : 1;
    return [n[0] * s, n[1] * s, n[2] * s, c.pos * s];
  }
  render() {
    const gl = this.gl, { vp, eye, view } = this.matrices(), cl = this._clipVec();
    gl.viewport(0, 0, this.size.w, this.size.h); gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const list = [...this.objects.values()].filter(o => o.visible).sort((a, b) => ((a.alpha < 1) - (b.alpha < 1)) || (a.order - b.order));
    for (const o of list) {
      const M = o.matrix || M4.ident();
      if (o.mesh) this._drawMesh(o, M, vp, eye, view, cl); else if (o.lines) this._drawLines(o, M, vp, cl);
    }
    if (this.showAxes) this._drawAxes(vp);
  }
  _drawMesh(o, M, vp, eye, view, cl) {
    const gl = this.gl, S = this.sMesh, mesh = o.mesh; if (!mesh.nt) return;
    const c = this._buf(mesh); gl.useProgram(S.p);
    gl.uniformMatrix4fv(S.u.uVP, false, vp); gl.uniformMatrix4fv(S.u.uM, false, M);
    gl.uniformMatrix3fv(S.u.uN, false, new Float32Array([M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]]));
    gl.uniform3fv(S.u.uColor, o.color); gl.uniform1f(S.u.uAlpha, o.alpha); gl.uniform3fv(S.u.uEye, eye);
    gl.uniform1f(S.u.uOrtho, this.cam.ortho ? 1 : 0); gl.uniform3fv(S.u.uView, [view[2], view[6], view[10]]);
    const cut = o.cutColor || o.color.map(x => Math.min(1, x * 0.55 + 0.35)); gl.uniform3fv(S.u.uCut, cut);
    const clipOn = this.clip.on && !o.noClip; gl.uniform1f(S.u.uClipOn, clipOn ? 1 : 0); gl.uniform4fv(S.u.uClip, cl);
    const aP = gl.getAttribLocation(S.p, 'aPos'), aN = gl.getAttribLocation(S.p, 'aNor'), aC = gl.getAttribLocation(S.p, 'aCol');
    gl.bindBuffer(gl.ARRAY_BUFFER, c.pos); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.nor); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
    if (o.vcolors && o.vcolors.length === mesh.v.length) {
      if (!c.col) c.col = gl.createBuffer(); if (c.colRef !== o.vcolors || c.colRev !== o.vcRev) { gl.bindBuffer(gl.ARRAY_BUFFER, c.col); gl.bufferData(gl.ARRAY_BUFFER, o.vcolors, gl.DYNAMIC_DRAW); c.colRef = o.vcolors; c.colRev = o.vcRev; }
      gl.bindBuffer(gl.ARRAY_BUFFER, c.col); gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 0, 0); gl.uniform1f(S.u.uUseVC, 1);
    } else { gl.disableVertexAttribArray(aC); gl.vertexAttrib3f(aC, 0, 0, 0); gl.uniform1f(S.u.uUseVC, 0); }
    gl.depthMask(o.alpha >= 1); if (o.alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    const type = this.uint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    if (o.wire) { this._wire(mesh, c); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.wire); gl.drawElements(gl.LINES, c.nWire, type, 0); }
    else { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.idx); gl.drawElements(gl.TRIANGLES, c.nIdx, type, 0); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(aC);
  }
  _drawLines(o, M, vp, cl) {
    const gl = this.gl, S = this.sLine; if (!o.lines.length) return;
    if (!o._buf || o._src !== o.lines) { if (o._buf) gl.deleteBuffer(o._buf); o._buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o._buf); gl.bufferData(gl.ARRAY_BUFFER, o.lines, gl.STATIC_DRAW); o._src = o.lines; }
    gl.useProgram(S.p); gl.uniformMatrix4fv(S.u.uVP, false, vp); gl.uniformMatrix4fv(S.u.uM, false, M); gl.uniform3fv(S.u.uColor, o.color); gl.uniform1f(S.u.uAlpha, o.alpha);
    gl.uniform1f(S.u.uClipOn, (this.clip.on && !o.noClip) ? 1 : 0); gl.uniform4fv(S.u.uClip, cl);
    const aP = gl.getAttribLocation(S.p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, o._buf); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
    if (o.alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    if (o.onTop) gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(o.strip ? gl.LINE_STRIP : gl.LINES, 0, o.lines.length / 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  _drawAxes(vp) {
    if (!this._axes) { const L = 100; this._axes = [{ lines: new Float32Array([0, 0, 0, L, 0, 0]), color: [1, .3, .3], alpha: 1, noClip: true }, { lines: new Float32Array([0, 0, 0, 0, L, 0]), color: [.3, 1, .4], alpha: 1, noClip: true }, { lines: new Float32Array([0, 0, 0, 0, 0, L]), color: [.4, .6, 1], alpha: 1, noClip: true }]; }
    const b = this.sceneBounds(); const M = M4.translate(b ? [b.min[0] - 30, b.min[1], b.min[2] - 30] : [0, 0, 0]);
    this._axes.forEach(a => this._drawLines(a, M, vp, [0, 0, 0, 0]));
  }
  toDataURL() { this.render(); return this.canvas.toDataURL('image/png'); }
  dispose() { this.disposed = true; this.running = false; this._ro.disconnect(); }
}

/* ---------- primitives de maillage ---------- */
const Prim = {
  /* grille de sections : rings[i] = tableau de points [x,y,z] (même nombre par anneau), fermeture optionnelle */
  fromRings(rings, opts) {
    opts = opts || {}; const nr = rings.length, np = rings[0].length, v = [], f = [];
    rings.forEach(r => r.forEach(p => v.push(p[0], p[1], p[2])));
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < (opts.open ? np - 1 : np); j++) {
      const a = i * np + j, b = i * np + (j + 1) % np, c = (i + 1) * np + j, d = (i + 1) * np + (j + 1) % np;
      if (opts.flip) f.push(a, b, c, b, d, c); else f.push(a, c, b, b, c, d);
    }
    const cap = (ri, top) => {
      const r = rings[ri], c = r.reduce((s, p) => V.add(s, p), [0, 0, 0]).map(x => x / np), ci = v.length / 3; v.push(c[0], c[1], c[2]);
      for (let j = 0; j < np; j++) { const a = ri * np + j, b = ri * np + (j + 1) % np; if (top === !!opts.flip) f.push(ci, a, b); else f.push(ci, b, a); }
    };
    if (opts.capStart) cap(0, false); if (opts.capEnd) cap(nr - 1, true);
    return new Mesh(new Float32Array(v), new Uint32Array(f));
  },
  box(sx, sy, sz, c) {
    c = c || [0, 0, 0]; const h = [sx / 2, sy / 2, sz / 2], v = [], f = [];
    for (const z of [-1, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) v.push(c[0] + x * h[0], c[1] + y * h[1], c[2] + z * h[2]);
    [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]].forEach(q => f.push(q[0], q[1], q[2], q[0], q[2], q[3]));
    return new Mesh(new Float32Array(v), new Uint32Array(f));
  },
  cylinder(r1, r2, h, seg, c, capped) { // axe Y, de y=c.y à c.y+h
    c = c || [0, 0, 0]; seg = seg || 32; const rings = [[], []];
    for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; rings[0].push([c[0] + Math.cos(a) * r1, c[1], c[2] + Math.sin(a) * r1]); rings[1].push([c[0] + Math.cos(a) * r2, c[1] + h, c[2] + Math.sin(a) * r2]); }
    return Prim.fromRings(rings, { capStart: capped !== false, capEnd: capped !== false });
  },
  sphere(r, c, seg) {
    seg = seg || 14; const rings = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg * Math.PI, ring = []; for (let j = 0; j < seg * 2; j++) { const a = j / (seg * 2) * Math.PI * 2; ring.push([c[0] + r * Math.sin(t) * Math.cos(a), c[1] + r * Math.cos(t), c[2] + r * Math.sin(t) * Math.sin(a)]); } rings.push(ring); }
    return Prim.fromRings(rings, { flip: true });
  },
  pyramid(base, top, h, c) { // tronc de pyramide carré, axe Y
    c = c || [0, 0, 0]; const q = (s, y) => [[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]].map(p => [p[0] + c[0], p[1] + c[1], p[2] + c[2]]);
    return Prim.fromRings([q(base / 2, 0), q(top / 2, h)], { capStart: true, capEnd: true });
  }
};
