/* Page « À propos » : le logiciel, son concepteur et les coordonnées de contact. */
function showAbout() {
  const c = JO_CONFIG.CONTACT, tel = c.phone.replace(/\s/g, ''), skills = ['Orthèses et prothèses', 'Modélisation et impression 3D', 'CAO (AutoCAD, Blender, Meshmixer)', 'Suivi et évaluation (M&E)', 'Gestion de projets de santé', 'SIG, Python, SQL, Odoo'];
  const copy = (t, b) => () => { try { navigator.clipboard.writeText(t); } catch (e) { } b.textContent = '✔'; };
  const cbtn = t => { const b = h('button', { class: 'ab-copy', type: 'button', title: 'Copier' }, '⧉'); b.onclick = copy(t, b); return b; };
  modal([
    h('div', { class: 'about' },
      h('h2', null, 'À propos'),
      h('section', null, h('h3', null, 'Le logiciel'),
        h('p', null, 'JophyOrtho 3D est un logiciel de CAO orthoprothétique : modélisation 3D d\'emboîtures transtibiales et transfémorales, de corsets du tronc et d\'orthèses et attelles des membres, à partir d\'un scan ou de mesures.'),
        h('p', null, 'Il fonctionne en ligne et hors ligne ; les dossiers des patients restent sur votre appareil et ne sont envoyés à aucun serveur.')),
      h('section', { class: 'ab-who' },
        h('div', { class: 'ab-av', translate: 'no', 'aria-hidden': 'true' }, 'JM'),
        h('div', null, h('h3', null, 'Le concepteur'),
          h('div', { class: 'ab-name', translate: 'no' }, 'Jude Mambemba Kipoy-Jehudiel'),
          h('div', { class: 'ab-role' }, 'Orthoprothésiste · Ingénieur 3D et conception · Program & Operations Manager'))),
      h('p', null, 'Ingénieur (licence en génie électrique, option électricité-informatique) et titulaire d\'un master en développement durable, il conduit depuis plusieurs années des projets de santé et de réadaptation en République démocratique du Congo.'),
      h('p', null, 'Au sein de Prothea Congo (BDOM, Kinshasa), il a conçu des modèles 3D de prothèses et d\'orthèses, supervisé la production par impression 3D, puis piloté les opérations et la stratégie de suivi et d\'évaluation des programmes.'),
      h('p', null, 'Il a suivi le programme de rééducation des amputés du membre inférieur du CICR et de Physiopedia (2025). Ce logiciel est né du besoin de disposer d\'un outil de modélisation accessible, léger et utilisable sur le terrain, même sans connexion.'),
      h('div', { class: 'ab-tags' }, skills.map(s => h('span', null, s))),
      h('section', { class: 'ab-contact' }, h('h3', null, 'Contact'),
        h('p', null, 'Pour une formation, une personnalisation, une collaboration ou toute question :'),
        h('div', { class: 'ab-row' }, h('span', null, 'Téléphone / WhatsApp'), h('a', { translate: 'no', href: 'tel:' + tel }, c.phone), cbtn(c.phone)),
        h('div', { class: 'ab-row' }, h('span', null, 'E-mail'), h('a', { translate: 'no', href: 'mailto:' + c.email }, c.email), cbtn(c.email)),
        h('div', { class: 'ab-row' }, h('span', null, 'Lieu'), h('b', null, c.place))),
      h('div', { class: 'btns' }, btn('♥ Faire un don', () => { HOME.keep = true; showDonate(); }), btn('Fermer', closeModal, 'p')))]);
}
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-about]'); if (a) { e.preventDefault(); showAbout(); } });
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-donate]'); if (a) { e.preventDefault(); showDonate(); } });
