/* Rubrique « Faire un don » : le logiciel est gratuit ; coordonnées bancaires de l'auteur. */
const DON = {
  rows: [['Banque', 'Trust Merchant Bank (TMB S.A.)'], ['Adresse', '1223, avenue Lumumba, Lubumbashi, République Démocratique du Congo'], ['Intitulé', 'MAMBEMBA'], ['N° de compte', '00017-20048343'], ['Devise', 'USD'], ['Code Swift', 'TRMSCD3L'], ['Code BCC', '1230']],
  copyText() { return this.rows.map(r => T(r[0]) + ' : ' + r[1]).join('\n'); }
};
function showDonate() {
  const flash = (b, t) => { const o = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = o; }, 1400); };
  const cp = (t, b) => { try { navigator.clipboard.writeText(t); flash(b, '✔'); } catch (e) { flash(b, '!'); } };
  const rows = DON.rows.map(r => { const b = h('button', { class: 'ab-copy', type: 'button', title: 'Copier' }, '⧉'); b.onclick = () => cp(r[1], b); return h('div', { class: 'ab-row dn-row' }, h('span', null, r[0]), h('b', { translate: 'no' }, r[1]), b); });
  const all = h('button', { class: 'btn', type: 'button' }, 'Copier toutes les coordonnées'); all.onclick = () => cp(DON.copyText(), all);
  modal([h('div', { class: 'about donate' },
    h('h2', null, '♥ Faire un don'),
    h('p', null, 'JophyOrtho 3D est entièrement gratuit et sans inscription. Si ce logiciel vous est utile, vous pouvez soutenir son développement et sa maintenance par un don, du montant de votre choix.'),
    h('section', { class: 'ab-contact' }, h('h3', null, 'Coordonnées bancaires'), rows),
    h('p', { class: 'dn-note' }, 'Virement bancaire en dollars américains (USD). Merci pour votre soutien.'),
    h('div', { class: 'btns' }, all, btn('Fermer', closeModal, 'p')))]);
}
