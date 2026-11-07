/* ===== Page d'accueil professionnelle (plein écran) ===== */
const HOME = {
  keep: false, el: null,
  hide() { if (this.el) this.el.hidden = true; document.body.classList.remove('home-open'); },
  keepOpen(fn) { HOME.keep = true; fn(); },
  icon(k) {
    const P = {
      tt: '<path d="M22 6c-2 0-9 1-10 5l3 24c.3 3 2 5 6 5h2c4 0 5.700-2 6-5l3-24c-1-4-8-5-10-5z"/><path d="M13 13c5 3 15 3 20 0"/><path d="M16 26c4 2 10 2 14 0" opacity=".6"/>',
      tf: '<path d="M18 4c-2 0-6 1-7 5l4 27c.4 3 2 5 5 5h4c3 0 4.600-2 5-5l4-27c-1-4-5-5-7-5z"/><path d="M12 11c7 3 16 3 22 0"/><path d="M14 22c6 2 12 2 18 0" opacity=".6"/><path d="M16 32c4 1.500 10 1.500 14 0" opacity=".6"/>',
      trunk: '<path d="M10 6h26l-2 14c-.3 2 .3 4 2 6l1 14H9l1-14c1.700-2 2.300-4 2-6z"/><path d="M13 14h20M12 22h22M11 30h24" opacity=".6"/><path d="M23 6v34" opacity=".35"/>',
      osup: '<path d="M12 42V30c0-2 1-3 3-3h1V12c0-1.500 3-1.500 3 0v10-13c0-1.500 3-1.500 3 0v13-11c0-1.500 3-1.500 3 0v12-8c0-1.500 3-1.500 3 0v14c0 3-1 5-3 6l-3 3v7z"/>',
      oinf: '<path d="M16 5h10v20l6 5c4 2 8 4 8 9v3H8V30l8-5z"/><path d="M16 14h10M8 39h32" opacity=".6"/>'
    }[k];
    return '<svg viewBox="0 0 46 46" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P + '</svg>';
  },
  hero() {   // illustration d'emboîture : silhouette, contours de sections, cotes
    let L = '', left = [], right = [], N = 12;
    for (let i = 0; i <= N; i++) { const t = i / N, y = 42 + t * 218, w = 82 - 36 * Math.pow(t, 1.15) + (t > .86 ? -(t - .86) * 120 : 0), ry = Math.max(3, w * .2); left.push([160 - w, y]); right.push([160 + w, y]);
      L += `<ellipse cx="160" cy="${y.toFixed(1)}" rx="${w.toFixed(1)}" ry="${ry.toFixed(1)}" class="hc"${i === 0 ? ' style="stroke-opacity:.95"' : ''}/>`; }
    const d = 'M' + left.map(p => p.join(',')).join(' L') + ' L' + right.slice().reverse().map(p => p.join(',')).join(' L') + ' Z';
    return `<svg viewBox="0 0 400 320" class="hsvg" role="img" aria-label="Emboîture 3D"><defs>
      <linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a6fa0" stop-opacity=".55"/><stop offset=".55" stop-color="#3fb6ff" stop-opacity=".28"/><stop offset="1" stop-color="#0d2a40" stop-opacity=".7"/></linearGradient>
      <radialGradient id="hg2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3fb6ff" stop-opacity=".35"/><stop offset="1" stop-color="#3fb6ff" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="160" cy="268" rx="150" ry="34" fill="url(#hg2)"/><ellipse cx="160" cy="268" rx="118" ry="24" class="hgrid"/><ellipse cx="160" cy="268" rx="84" ry="17" class="hgrid"/><ellipse cx="160" cy="268" rx="132" ry="29" class="hring"/>
      <path d="${d}" fill="url(#hg1)" stroke="#6fd0ff" stroke-opacity=".7" stroke-width="1.4"/>${L}
      <path d="M96 60c-10 60-6 120 14 190" class="hhi"/>
      <g class="hdim" transform="translate(0 0)"><path d="M292 42v218M286 42h12M286 260h12"/><text x="302" y="156" transform="rotate(90 302 156)" text-anchor="middle">H 225 mm</text><path d="M78 24h164M78 18v12M242 18v12"/><text x="160" y="16" text-anchor="middle">Ø 96 mm</text></g>
      <g class="hpt"><circle cx="118" cy="130" r="4"/><circle cx="206" cy="176" r="4"/><circle cx="150" cy="226" r="4"/></g></svg>`;
  },
  async render() {
    const fams = [['tt', 'Prothèse transtibiale', 'PTB · TSB · hybride · KBM · PTS'], ['tf', 'Prothèse transfémorale', 'Quadrilatérale · ischiatique · MAS · sous-ischiale · HiFi'], ['trunk', 'Corset du tronc', 'Boston · Chêneau · Wilmington · Milwaukee · Charleston · LSO'], ['osup', 'Orthèse / attelle du membre supérieur', 'Poignet · main · avant-bras · coude'], ['oinf', 'Orthèse / attelle du membre inférieur', 'AFO · genou · jambière · cuisse']];
    const create = f => { HOME.hide(); const P = newProject(f); P.measures.tt.circAuto = P.measures.tf.circAuto = P.measures.trunk.circAuto = true; Store.ctx.scan = null; A_.visited.clear(); A_.step = 0; A_.frameNext = true; Store.load(P); };
    const raw = x => { const d = document.createElement('div'); d.innerHTML = x; return d.firstChild; };
    const iconBox = (k, cls) => { const s = h('span', { class: cls || 'hm-ic', 'aria-hidden': 'true' }); s.innerHTML = HOME.icon(k); return s; };
    const saved = h('div', { class: 'hm-list' }, h('p', { class: 'hm-empty' }, 'Chargement…'));
    const hero = h('div', { class: 'hm-art' }); hero.innerHTML = HOME.hero();
    ['Scan 3D', 'Charges et décharges', 'Export STL'].forEach((t, i) => hero.append(h('span', { class: 'hm-chip c' + i }, t)));
    const el = HOME.el || (HOME.el = h('div', { id: 'home' })); el.replaceChildren(
      h('header', { class: 'hm-nav' },
        h('div', { class: 'hm-brand' }, h('span', { class: 'hm-logo', 'aria-hidden': 'true' }, raw('<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#06121c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 2 12H8l2-12z"/></svg>')), h('span', null, 'Jophy', h('b', null, 'Ortho'), ' 3D')),
        h('nav', { class: 'hm-links' }, h('a', { href: '#hm-new' }, 'Nouveau dossier'), h('a', { href: '#hm-recent' }, 'Dossiers récents'), h('a', { href: '#hm-how' }, 'Fonctionnement'), h('a', { href: '#', onclick: e => { e.preventDefault(); HOME.keepOpen(showAbout); } }, 'À propos'), h('a', { href: '#', onclick: e => { e.preventDefault(); HOME.keepOpen(showHelp); } }, 'Aide'), h('a', { class: 'hm-don', href: '#', onclick: e => { e.preventDefault(); HOME.keepOpen(showDonate); } }, '♥ Faire un don')),
        h('div', { class: 'hm-nr' }, I18N.bar())),
      h('section', { class: 'hm-hero' },
        h('div', { class: 'hm-copy' }, h('div', { class: 'hm-eyebrow' }, 'CAO orthoprothétique'),
          h('h1', null, 'Concevez des emboîtures et des orthèses sur mesure, en 3D'),
          h('p', { class: 'hm-lead' }, 'De la mesure au fichier de fabrication : prothèses transtibiales et transfémorales, corsets du tronc, orthèses et attelles des membres.'),
          h('div', { class: 'hm-cta' }, h('a', { class: 'hm-btn p', href: '#hm-new', onclick: e => { e.preventDefault(); document.getElementById('hm-new').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Nouveau dossier'),
            h('button', { class: 'hm-btn', type: 'button', onclick: () => $('#fileProj').click() }, 'Importer un projet…'),
            Store.P && Store.undo.length ? h('button', { class: 'hm-btn', type: 'button', onclick: () => HOME.hide() }, 'Continuer le dossier en cours') : null),
          h('ul', { class: 'hm-trust' }, ['Gratuit, sans inscription','Fonctionne hors ligne', 'Données conservées sur votre appareil', 'Six langues'].map(t => h('li', null, t)))),
        hero),
      h('section', { class: 'hm-sec', id: 'hm-new' }, h('div', { class: 'hm-h' }, h('h2', null, 'Nouveau dossier'), h('p', null, 'Choisissez le type d\'appareil à modéliser.')),
        h('div', { class: 'hm-cards' }, fams.map(f => h('button', { class: 'hm-card', type: 'button', onclick: () => create(f[0]) }, iconBox(f[0]), h('b', null, f[1]), h('small', null, f[2]), h('span', { class: 'hm-go' }, 'Commencer →'))))),
      h('section', { class: 'hm-sec', id: 'hm-recent' }, h('div', { class: 'hm-h' }, h('h2', null, 'Dossiers récents'), h('p', null, 'Enregistrés dans ce navigateur, sur cet appareil.')), saved),
      h('section', { class: 'hm-sec', id: 'hm-how' }, h('div', { class: 'hm-h' }, h('h2', null, 'Fonctionnement'), h('p', null, 'Un parcours guidé, du patient à la pièce finie.')),
        h('ol', { class: 'hm-steps' }, [['Acquisition', 'Importez un scan 3D ou saisissez les mesures du patient.'], ['Mesures et repères', 'Sections, repères anatomiques, zones de charge et de décharge.'], ['Modélisation', 'Manchon, coque, renforts, ouvertures, charnières et composants.'], ['Export', 'STL, PLY, rapport et fiche de mesures prêts pour la fabrication.']].map((s, i) => h('li', null, h('span', { class: 'hm-n' }, String(i + 1)), h('b', null, s[0]), h('p', null, s[1]))))),
      h('section', { class: 'hm-sec' }, h('div', { class: 'hm-feats' }, [['Scan 3D ou mesures', 'Import STL, OBJ, PLY ou reconstruction paramétrique à partir des mesures.'], ['Pied et main détaillés', 'Anatomie réaliste, charges et décharges, charnières et butées.'], ['Coupes et cotes', 'Plans de coupe, mesures, calques et comparaison avant/après.'], ['Hors ligne', 'Aucune connexion requise : vos dossiers restent sur l\'appareil.'], ['Six langues', 'Français, anglais, espagnol, portugais, arabe et chinois.'], ['Pour le terrain', 'Interface adaptée au PC, à la tablette et au téléphone.']].map(f => h('div', { class: 'hm-feat' }, h('b', null, f[0]), h('p', null, f[1]))))),
      h('section', { class: 'hm-sec' }, h('div', { class: 'hm-donate' }, h('div', null, h('h2', null, 'Un logiciel gratuit, soutenu par vos dons'), h('p', null, 'JophyOrtho 3D est entièrement gratuit et sans inscription. Si cet outil vous est utile, un don aide à le maintenir et à l\'améliorer.')), h('button', { class: 'hm-btn p', type: 'button', onclick: () => HOME.keepOpen(showDonate) }, '♥ Faire un don'))),
      (() => { const c = JO_CONFIG.CONTACT; return h('footer', { class: 'hm-foot' }, h('div', null, h('span', null, 'Contact :'), ' ', h('b', { translate: 'no' }, c.name), ' · ', h('span', null, c.place), ' · ', h('a', { translate: 'no', href: 'tel:' + c.phone.replace(/\s/g, '') }, c.phone), ' · ', h('a', { translate: 'no', href: 'mailto:' + c.email }, c.email)), h('div', null, h('a', { href: '#', onclick: e => { e.preventDefault(); HOME.keepOpen(showAbout); } }, 'À propos'), ' · ', h('a', { href: '#', onclick: e => { e.preventDefault(); HOME.keepOpen(showDonate); } }, 'Faire un don'), ' · ', h('span', { translate: 'no' }, 'JophyOrtho 3D v1.0'))); })());
    if (!el.isConnected) document.body.append(el);
    el.hidden = false; el.scrollTop = 0; document.body.classList.add('home-open');
    try {
      const list = await DB.list(); saved.innerHTML = ''; if (!list.length) saved.append(h('p', { class: 'hm-empty' }, 'Aucun dossier enregistré.'));
      list.sort((a, b) => b.updated.localeCompare(a.updated)).forEach(r => saved.append(h('div', { class: 'hm-row' }, iconBox(r.family, 'hm-ic sm'), h('div', { class: 'hm-rt' }, h('b', null, `${r.name || 'sans nom'} · ${ENGINES[r.family].short}`), h('small', null, `${r.id} · ${r.updated.slice(0, 16).replace('T', ' ')}`)),
        h('div', { class: 'hm-ra' }, btn('Ouvrir', async () => { const d = await DB.load(r.id); if (!d) return; HOME.hide(); loadLoaded(d.P, d.scan); }, 'sm p'), btn('Supprimer', async () => { if (confirm('Supprimer ce dossier ?')) { await DB.remove(r.id); HOME.render(); } }, 'sm d')))));
    } catch (e) { saved.innerHTML = ''; saved.append(note('Stockage local indisponible : ' + e.message, 'warn')); }
  }
};
function showStart() { return HOME.render(); }
window.addEventListener('langchange', () => { if (HOME.el && !HOME.el.hidden) { const y = HOME.el.scrollTop; HOME.render().then(() => { HOME.el.scrollTop = y; }); } });
