/* Configuration commerciale — À RENSEIGNER par l'éditeur avant diffusion. */
const JO_CONFIG = {
  PRODUCT: 'JophyOrtho 3D',
  CONTACT: { name: 'Jude Mambemba', place: 'Kinshasa, RDC', email: 'judemambemba@gmail.com', phone: '+243 814 178 011', url: '', price: '' },   // coordonnées affichées pour obtenir une licence (vides = non affichées)
};
const esc_c = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function creditHTML() { const c = JO_CONFIG.CONTACT; return `<p style="margin-top:18px;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#444">Contact : <b>${esc_c(c.name)}</b> · ${esc_c(c.place)} · ${esc_c(c.phone)} · ${esc_c(c.email)}</p>`; }
