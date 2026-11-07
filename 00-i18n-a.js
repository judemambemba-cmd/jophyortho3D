/* i18n — français (langue source) → en, es, pt, ar, zh. Traduction à la volée par dictionnaire + motifs {0}, {1}…
   Un MutationObserver traduit tout le DOM (texte et attributs) ; le français d'origine est mémorisé pour pouvoir
   changer de langue à tout moment sans toucher à l'état de la modélisation. */
const I18N = {
  langs: [['fr', 'FR', 'Français'], ['en', 'EN', 'English'], ['es', 'ES', 'Español'], ['pt', 'PT', 'Português'], ['ar', 'ع', 'العربية'], ['zh', '中', '中文']],
  locales: { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', pt: 'pt-PT', ar: 'ar-u-nu-latn', zh: 'zh-CN' },
  dict: {}, lang: 'fr', _pat: {}, _cache: {}, ATTRS: ['title', 'placeholder', 'aria-label', 'alt'],
  norm(s) { return s.replace(/\s+/g, ' ').trim(); },
  patterns(l) {
    if (this._pat[l]) return this._pat[l];
    const d = this.dict[l] || {}, out = [];
    for (const k in d) if (/\{\d+\}/.test(k)) {
      const parts = k.split(/\{(\d+)\}/); let re = '^', idx = [];
      parts.forEach((p, i) => { if (i % 2) { re += '([\\s\\S]+?)'; idx.push(+p); } else re += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      try { out.push({ re: new RegExp(re + '$'), idx, to: d[k], n: k.length }); } catch (e) { }
    }
    out.sort((a, b) => b.n - a.n); return this._pat[l] = out;
  },
  seg(s, d, depth) {
    if (/\.\s+[A-ZÀ-Ý]/.test(s)) { const ps = s.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/), tr = ps.map(p => this.tr1(p, d, depth + 1)); if (ps.length > 1 && tr.some((t, i) => t !== ps[i])) return tr.join(' '); }
    const seps = [' · ', ' — ', ' : ', ' / ', ' → ', ', ', ' + ', ' × ', ' (', ') '], sp1 = (a, b) => { for (const sp of a) if (s.includes(sp)) { const parts = s.split(sp), tr = parts.map(p => this.tr1(p, d, depth + 1)); if (tr.some((t, i) => t !== parts[i])) return tr.join(sp); } return null; };
    let r1 = sp1(seps.slice(0, 8)); if (r1 !== null) return r1;
    let mm = /^([\s\S]*\S) \(([^()]*)\)$/.exec(s);   // « libellé (unité ou précision) »
    if (mm) { const a = this.tr1(mm[1], d, depth + 1), b = /^[^A-Za-zÀ-ÿ]*$|^(mm|cm|kg|mm²|cm²|cm³|°C)$/.test(mm[2]) ? mm[2] : this.tr1(mm[2], d, depth + 1); if (a !== mm[1] || b !== mm[2]) return a + ' (' + b + ')'; }
    r1 = sp1(seps.slice(8)); if (r1 !== null) return r1;
    mm = /^([\s\S]*\S)\s*(:|…|\.)$/.exec(s);
    if (mm && !d[s]) { const a = this.tr1(mm[1], d, depth + 1); if (a !== mm[1]) return a + (mm[2] === ':' && this.lang === 'zh' ? '：' : mm[2]); }
    return null;
  },
  tr1(s, d, depth) {
    const m = /^([\s·—]*)([\s\S]*?)([\s·—]*)$/.exec(s), core = this.norm(m[2]); if (!core || !/[A-Za-zÀ-ÿ]/.test(core)) return s;
    let r = d[core]; if (r === undefined) {
      for (const p of this.patterns(this.lang)) { const x = p.re.exec(core); if (x) { r = p.to.replace(/\{(\d+)\}/g, (_, n) => { const i = p.idx.indexOf(+n); return i < 0 ? '' : (depth < 4 ? this.tr1(x[i + 1], d, depth + 1) : x[i + 1]); }); break; } }
      if (r === undefined && depth < 4) { r = this.seg(core, d, depth); if (r === null) r = undefined; }
    }
    return r === undefined ? s : m[1] + r + m[3];
  },
  T(s) {
    if (this.lang === 'fr' || typeof s !== 'string' || !s) return s;
    const c = this._cache[this.lang] || (this._cache[this.lang] = new Map()); let r = c.get(s);
    if (r === undefined) { r = this.tr1(s, this.dict[this.lang] || {}, 0); if (c.size > 20000) c.clear(); c.set(s, r); }
    return r;
  },
  skip(n) { for (; n; n = n.parentNode) if (n.nodeType === 1 && (/^(SCRIPT|STYLE|TEXTAREA|CANVAS|NOSCRIPT)$/.test(n.tagName) || n.getAttribute('translate') === 'no')) return true; return false; },
  tNode(n) {
    if (n.__fr !== undefined && n.data === n.__tr) { const t = this.lang === 'fr' ? n.__fr : this.T(n.__fr); if (t !== n.data) n.data = t; n.__tr = n.data; return; }
    n.__fr = n.data; const t = this.lang === 'fr' ? n.data : this.T(n.data); if (t !== n.data) n.data = t; n.__tr = n.data;
  },
  tAttr(el, a) {
    const v = el.getAttribute(a); if (v == null) return; const st = el.__a || (el.__a = {}), o = st[a];
    const fr = o && v === o.tr ? o.fr : v; const t = this.lang === 'fr' ? fr : this.T(fr); if (t !== v) el.setAttribute(a, t); st[a] = { fr, tr: t };
  },
  walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!this.skip(root.parentNode)) this.tNode(root); return; }
    if (root.nodeType !== 1 || this.skip(root)) return;
    const doEl = e => { for (const a of this.ATTRS) if (e.hasAttribute(a)) this.tAttr(e, a); };
    doEl(root);
    const rec = el => { for (let c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) this.tNode(c); else if (c.nodeType === 1 && !this.skip(c)) { doEl(c); rec(c); } } };
    rec(root);
  },
  html(src) {
    if (this.lang === 'fr') return src;
    const doc = new DOMParser().parseFromString(src, 'text/html'), tw = doc.createTreeWalker(doc.documentElement, 5); let n; const nodes = [];
    while ((n = tw.nextNode())) nodes.push(n);
    nodes.forEach(x => { if (x.nodeType === 3) { if (!/^(SCRIPT|STYLE)$/.test(x.parentNode.tagName)) x.data = this.T(x.data); } else for (const a of this.ATTRS) if (x.hasAttribute(a)) x.setAttribute(a, this.T(x.getAttribute(a))); });
    doc.documentElement.lang = this.lang; doc.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  },
  bar() {   // sélecteur de langue pour la page d'accueil : noms natifs
    const g = document.createElement('div'); g.className = 'homelang'; g.setAttribute('translate', 'no'); g.setAttribute('role', 'group');
    this.langs.forEach(([c, lab, name]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.lang = c; b.dataset.l = c; if (c === this.lang) b.classList.add('on'); b.onclick = () => { this.set(c); g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.l === c)); }; g.append(b); });
    window.addEventListener('langchange', e => g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.l === e.detail)));
    return g;
  },
  set(l, persist) {
    if (!this.locales[l]) l = 'fr'; this.lang = l;
    const de = document.documentElement; de.lang = l; de.dir = l === 'ar' ? 'rtl' : 'ltr';
    if (persist !== false) { try { localStorage.setItem('jo3d.lang', l); } catch (e) { } }
    if (this.obs) this.obs.disconnect();
    this.walk(document.body); document.title = l === 'fr' ? this.titleFr : this.T(this.titleFr);
    document.querySelectorAll('#langs button').forEach(b => { const on = b.dataset.l === l; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    this.start();
    try { if (typeof updateHeader === 'function' && Store.P && A_.out) updateHeader(); } catch (e) { }
    try { if (A_.viewer) A_.viewer.dirty = true; } catch (e) { }
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  },
  start() {
    if (!this.obs) this.obs = new MutationObserver(recs => {
      this.obs.disconnect();
      try { for (const r of recs) { if (r.type === 'characterData') { if (!this.skip(r.target.parentNode)) this.tNode(r.target); } else if (r.type === 'childList') r.addedNodes.forEach(x => this.walk(x)); else if (r.type === 'attributes' && r.target.nodeType === 1 && !this.skip(r.target)) this.tAttr(r.target, r.attributeName); } } catch (e) { console.error(e); }
      this.obs.observe(document.body, this.opts);
    });
    this.opts = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: this.ATTRS };
    this.obs.observe(document.body, this.opts);
  },
  init() {
    const self = this; this.titleFr = document.title;
    ['alert', 'confirm', 'prompt'].forEach(k => { const o = window[k]; window[k] = function (m, ...r) { return o.call(window, self.T(String(m == null ? '' : m)), ...r); }; });
    const boot = () => {
      const top = document.getElementById('top');
      if (top && !document.getElementById('langs')) {
        const g = document.createElement('div'); g.id = 'langs'; g.setAttribute('role', 'group'); g.setAttribute('translate', 'no');
        this.langs.forEach(([c, lab, name]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.l = c; b.textContent = lab; b.title = name; b.setAttribute('aria-label', name); b.lang = c; g.append(b); });
        g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (window.matchMedia('(max-width:700px)').matches && !g.classList.contains('open') && b.classList.contains('on')) { g.classList.add('open'); return; } g.classList.remove('open'); this.set(b.dataset.l); });
        document.addEventListener('click', e => { if (!g.contains(e.target)) g.classList.remove('open'); });
        top.append(g);
      }
      let l = ''; try { l = localStorage.getItem('jo3d.lang') || ''; } catch (e) { }
      if (!this.locales[l]) l = 'fr';
      this.set(l, false);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
};
const T = s => I18N.T(s);
const LOC = () => I18N.locales[I18N.lang];
