/* JophyOrtho 3D — 12 : état du dossier, historique (annuler/rétablir), persistance IndexedDB */
'use strict';
function newProject(family) {
  family = family || 'tt';
  const P = {
    v: 1, app: 'JophyOrtho 3D', created: new Date().toISOString(), family,
    meta: { id: 'JO-' + Date.now().toString(36).toUpperCase(), ref: '', name: '', date: new Date().toISOString().slice(0, 10), side: 'D', age: '', weight: '', height: '', activity: '', profession: '', env: '', goals: '', prescription: '', obs: '', pro: '', anon: false },
    acq: { mode: 'measures', unit: 'mm', scale: 1, orient: { up: '+Y', ant: '+Z', lat: '+X' }, repair: false, flipNormals: false, smooth: 1, cuts: [], cutLargest: true, sel: null, scanName: '', scanInfo: null },
    measures: { osup: ENGINES.osup.defaults(), oinf: ENGINES.oinf.defaults(), tt: Object.assign(ENGINES.tt.defaults(), { circAuto: true }), tf: Object.assign(ENGINES.tf.defaults(), { circAuto: true }), trunk: Object.assign(ENGINES.trunk.defaults(), { circAuto: true }) }, measuresTouched: false,
    landmarks: {}, dev: {}, comfort: { items: {}, comment: '', pro: '' }, trials: [], log: [], validation: { status: 'Brouillon', by: '' }
  };
  const firstType = { tt: 'ptb', tf: 'quad', trunk: 'boston' };
  for (const f of ['tt', 'tf', 'trunk']) P.dev[f] = defaultDev(f, firstType[f]);
  P.dev.osup = orthDev('osup', 'repos_main'); P.dev.oinf = orthDev('oinf', 'afo_post');
  return P;
}
const Store = {
  P: null, ctx: { scan: null }, undo: [], redo: [], subs: [], lastLabel: '', lastT: 0,
  sub(fn) { this.subs.push(fn); },
  emit(kind) { this.subs.forEach(f => { try { f(kind); } catch (e) { console.error(e); } }); },
  load(P) { try { migrateRows(P); } catch (e) { /* ignoré */ } this.P = P; this.undo = []; this.redo = []; this.ctx.paramSec = null; this.emit('load'); },
  snap() { return JSON.stringify(this.P); },
  /* applique une modification ; coalesce les modifications répétées (curseurs) */
  apply(label, fn, opts) {
    opts = opts || {}; const now = Date.now();
    if (!(label === this.lastLabel && now - this.lastT < 900)) { this.undo.push({ label, s: this.snap() }); if (this.undo.length > 120) this.undo.shift(); this.P.log.push({ t: new Date().toISOString(), op: label }); if (this.P.log.length > 500) this.P.log.shift(); }
    this.lastLabel = label; this.lastT = now; this.redo = []; fn(this.P); this.emit(opts.kind || 'change');
  },
  doUndo() { if (!this.undo.length) return false; const u = this.undo.pop(); this.redo.push({ label: u.label, s: this.snap() }); this.P = JSON.parse(u.s); this.lastLabel = ''; this.emit('rerender'); return u.label; },
  doRedo() { if (!this.redo.length) return false; const r = this.redo.pop(); this.undo.push({ label: r.label, s: this.snap() }); this.P = JSON.parse(r.s); this.lastLabel = ''; this.emit('rerender'); return r.label; },
  get dev() { return this.P.dev[this.P.family]; }
};
/* ---------------- IndexedDB : projets + scans volumineux ---------------- */
const DB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB indisponible'));
      const rq = indexedDB.open('jophyortho3d', 1);
      rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore('projects', { keyPath: 'id' }); d.createObjectStore('scans', { keyPath: 'id' }); };
      rq.onsuccess = () => { this._db = rq.result; res(this._db); }; rq.onerror = () => rej(rq.error);
    });
  },
  async tx(store, mode, fn) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
  async saveProject(P, scanMesh) {
    const rec = { id: P.meta.id, name: P.meta.anon ? '(anonymisé)' : P.meta.name, family: P.family, ref: P.meta.ref, updated: new Date().toISOString(), data: JSON.stringify(P) };
    await this.tx('projects', 'readwrite', s => s.put(rec));
    if (scanMesh) await this.tx('scans', 'readwrite', s => s.put({ id: P.meta.id, v: scanMesh.v, f: scanMesh.f }));
  },
  async list() { return (await this.tx('projects', 'readonly', s => s.getAll())) || []; },
  async load(id) { const rec = await this.tx('projects', 'readonly', s => s.get(id)); if (!rec) return null; const sc = await this.tx('scans', 'readonly', s => s.get(id)); return { P: JSON.parse(rec.data), scan: sc ? new Mesh(sc.v, sc.f) : null }; },
  async remove(id) { await this.tx('projects', 'readwrite', s => s.delete(id)); await this.tx('scans', 'readwrite', s => s.delete(id)); }
};
const Prefs = {
  get(k, d) { try { const v = localStorage.getItem('jo3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('jo3d.' + k, JSON.stringify(v)); } catch (e) { /* ignoré */ } }
};
