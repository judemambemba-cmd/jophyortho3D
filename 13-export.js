/* JophyOrtho 3D — 13 : exports (STL, JSON, rapport HTML) et import de projet */
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function downloadBlob(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
function fileStem(P) { return (P.meta.anon ? 'anonyme' : (P.meta.name || 'dossier')).replace(/[^\w-]+/g, '_') + '_' + P.meta.id; }
function stlHeader(P, out, what) {
  const demo = out.prov === 'scan' ? 'scan patient' : 'reconstruction mesures';
  return `JophyOrtho3D ${what} | ${demo}`;
}
function stlMeshFor(kind, out) {
  const list = [];
  if (kind === 'orth') { if (!out.shell) return null; list.push(out.shell); out.comps.forEach(c => list.push(c.mesh)); }
  else if (kind === 'orthshell') { if (!out.shell) return null; list.push(out.shell); }
  else if (kind === 'orthliner') { if (!out.liner) return null; list.push(out.liner); }
  else if (kind === 'anat') list.push(out.original);
  else if (kind === 'rect') list.push(out.rect);
  else if (kind === 'liner') { if (!out.liner) return null; list.push(out.liner); }
  else if (kind === 'shell') list.push(out.shell);
  else if (kind === 'one') { list.push(out.shell); out.comps.filter(c => c.fused).forEach(c => list.push(c.mesh)); }
  else if (kind === 'assembly') { list.push(out.shell); if (out.liner) list.push(out.liner); out.comps.filter(c => !c.schematic).forEach(c => list.push(c.mesh)); }
  return list.length ? Mesh.merge(list) : null;
}
const STL_LABEL = { orth: 'orthese', orthshell: 'coque-orthese', orthliner: 'doublure-orthese', anat: 'anatomie-membre', rect: 'anatomie-rectifiee', liner: 'manchon', shell: 'coque', assembly: 'assemblage', one: 'piece-unique-coque-connecteur' };
function exportSTL(P, out, kind) {
  let m = stlMeshFor(kind, out); if (!m) return { ok: false, msg: kind === 'liner' ? 'Aucun manchon actif.' : 'Rien à exporter.' };
  const zup = (P.meta.exportUp || 'Z') === 'Z'; if (zup) m = toCadFrame(m);
  const demo = '';
  downloadBlob(new Blob([meshToSTLBinary(m, stlHeader(P, out, STL_LABEL[kind]))], { type: 'model/stl' }), `${fileStem(P)}_${STL_LABEL[kind]}${demo}.stl`);
  const warn = []; if (kind === 'shell' || kind === 'assembly') { const a = out.shellClosed; if (!a.closed) warn.push('Coque non étanche (ouvertures/découpes).'); }
  return { ok: true, msg: `STL « ${STL_LABEL[kind]} » exporté (${m.nt} triangles, ${zup ? 'debout : Z vers le haut, face antérieure vers −Y' : 'repère de l\'application : Y vers le haut'}).` + (warn.length ? ' ' + warn.join(' ') : '') };
}
/* ---------- PLY couleur (zones colorées, texture du scan) ---------- */
function exportPLY(P, out, kind) {
  let m, name;
  if (kind === 'rectcolor') { m = out.rect.clone(); m.c = out.rectColors; name = 'anatomie-rectifiee-zones-couleur'; }
  else { const base = out.cleaned || out.original; if (!base) return { ok: false, msg: 'Aucun scan chargé.' }; m = base.clone(); m.c = out.anatColors || base.c; name = 'scan-couleur'; }
  if ((P.meta.exportUp || 'Z') === 'Z') m = toCadFrame(m);
  downloadBlob(new Blob([meshToPLYBinary(m, m.c)], { type: 'application/octet-stream' }), `${fileStem(P)}_${name}.ply`);
  return { ok: true, msg: `PLY couleur « ${name} » exporté (${m.nt} triangles).` };
}
/* ---------- JSON complet ---------- */
function u8ToB64(u8) { let s = ''; const ch = 0x8000; for (let i = 0; i < u8.length; i += ch) s += String.fromCharCode.apply(null, u8.subarray(i, i + ch)); return btoa(s); }
function b64ToU8(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function projectToJSON(P, scanOriginal, includeScan) {
  const o = JSON.parse(JSON.stringify(P)); o.exportedAt = new Date().toISOString();
  if (P.meta.anon) { o.meta.name = '(anonymisé)'; o.meta.ref = ''; o.meta.pro = o.meta.pro ? '(masqué)' : ''; }
  if (includeScan && scanOriginal) o.scanSTLBase64 = u8ToB64(new Uint8Array(meshToSTLBinary(scanOriginal, 'JophyOrtho3D scan original')));
  return JSON.stringify(o, null, 1);
}
function exportProject(P, scanOriginal, includeScan) {
  downloadBlob(new Blob([projectToJSON(P, scanOriginal, includeScan)], { type: 'application/json' }), fileStem(P) + '.jophyortho.json');
}
function importProjectText(txt) {
  const o = JSON.parse(txt); if (!o || o.app !== 'JophyOrtho 3D' || !o.family || !o.dev) throw new Error('Fichier de projet JophyOrtho 3D invalide');
  let scan = null; if (o.scanSTLBase64) { const u = b64ToU8(o.scanSTLBase64); scan = parseSTL(u.buffer); delete o.scanSTLBase64; }
  const base = newProject(o.family); // complète les champs manquants (versions antérieures)
  const P = Object.assign(base, o); P.meta = Object.assign(base.meta, o.meta); P.acq = Object.assign(base.acq, o.acq);
  ['tt', 'tf', 'trunk', 'osup', 'oinf'].forEach(f => { P.measures[f] = Object.assign(base.measures[f], (o.measures || {})[f]); P.dev[f] = Object.assign(base.dev[f], (o.dev || {})[f]); });
  return { P, scan };
}
/* ---------- rapport HTML ---------- */
function buildReport(P, out, shot) {
  if (ENGINES[P.family].orth) return buildOrthReport(P, out, shot);
  const eng = ENGINES[P.family], dev = P.dev[P.family], m = P.family === 'trunk' ? P.measures[P.family] : normRows(P.measures[P.family], P.family === 'tt' ? P.measures.tt.lenPT : P.measures.tf.lenPer), t = eng.types[dev.type], now = new Date().toLocaleString(LOC());
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const mt = P.meta, prov = PROVENANCE[out.prov];
  const fields = [...(eng.fields || [])].map(f => row(f.label, (m[f.k] != null ? m[f.k] : '') + ' ' + (f.unit || ''))).join('') + (eng.clinical || []).map(f => row(f.label, m[f.k])).join('');
  const tab = `<table class="t"><tr><th>Niveau</th><th>Hauteur (mm)</th><th>Circ.</th><th>ML/Larg.</th><th>AP/Prof.</th><th>Rot.°</th><th>Déc. AP</th><th>Déc. ML</th><th>Réd. %</th></tr>${m.rows.map((r, i) => `<tr><td>${esc(eng.rowLabel(r, m))}</td><td>${r.y}</td><td>${r.circ}</td><td>${r.ml}</td><td>${r.ap}</td><td>${r.rot}</td><td>${r.dAP}</td><td>${r.dML}</td><td>${r.red || 0}</td></tr>`).join('')}</table>`;
  const lms = out.landmarkList.map(l => `<tr><td>${esc(l.label)}</td><td>${l.pos.map(x => Math.round(x * 10) / 10).join(' ; ')}</td><td>${esc(l.source)}</td></tr>`).join('');
  const zs = dev.zones.map(z => `<tr><td>${esc(ZONE_TYPES[z.type].label)}${z.suggested ? ' (suggérée, non appliquée)' : ''}</td><td>${z.pos.map(x => Math.round(x)).join(' ; ')}</td><td>${z.radius}</td><td>${z.value}</td><td>${z.transition}</td><td>${z.priority}</td><td>${esc(z.landmark)}</td><td>${esc(z.comment)}</td><td>${esc((z.date || '').slice(0, 10))} ${esc(z.author)}</td></tr>`).join('') || '<tr><td colspan="9">Aucune zone</td></tr>';
  const tr = Object.keys(dev.trim).map(k => `${k}: ${dev.trim[k]}`).join(' · ');
  const ops = dev.openings.map(o => `${o.kind}${o.th != null ? ' θ=' + o.th + '°' : ''}${o.w ? ' L=' + o.w : ''}${o.h ? ' H=' + o.h : ''}`).join(' ; ') || 'aucune';
  const conn = P.family === 'trunk' ? `Sangles : ${dev.trunk.straps} · Coussinets : ${dev.trunk.pads ? 'oui' : 'non'} · Extension axillaire ${dev.trunk.axExt} mm · Extension trochantérienne ${dev.trunk.trochExt} mm · Dégagement costal ${dev.trunk.ribRelief} mm` : `Type : ${(CONNECTOR_TYPES.find(c => c[0] === dev.conn.type) || [])[1]} · AP ${dev.conn.ap} · ML ${dev.conn.ml} · hauteur bas du moignon → connecteur ${dev.conn.h} mm · insertion ${dev.conn.ins} mm · pièce unique avec la coque mm · rotation ${dev.conn.rot}° · inclinaison ${dev.conn.tilt}°/${dev.conn.tiltAb}° · matériau ${dev.conn.material}`;
  const al = P.family === 'trunk' ? 'Sans objet (corset) — voir orientation épaules/bassin dans les mesures.' : `Flexion ${dev.align.flex}° · Abd/Add ${dev.align.abd}° · Rotation ${dev.align.rot}° · AP ${dev.align.ap} mm · ML ${dev.align.ml} mm (paramètres géométriques ; aucune validation biomécanique)`;
  const trials = P.trials.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.date)}</td><td>${x.score == null ? '—' : x.score}/10</td><td>${esc((x.flags || []).join(', '))}</td><td>${esc(x.comment)}</td><td>${esc(x.changes)}</td></tr>`).join('') || '<tr><td colspan="6">Aucun essayage enregistré</td></tr>';
  const warns = out.warnings.map(w => `<li>${esc(w)}</li>`).join('') || '<li>Aucun avertissement automatique.</li>';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport JophyOrtho 3D — ${esc(mt.anon ? 'anonyme' : mt.name)}</title><style>
body{font:14px/1.5 system-ui,Segoe UI,Arial;margin:24px auto;max-width:900px;color:#111;padding:0 16px}h1{margin:0}h2{border-bottom:2px solid #123;padding-bottom:3px;margin-top:26px}
.warn{border:2px solid #b00;background:#fff0f0;padding:10px 14px;border-radius:6px;margin:12px 0}.prov{display:inline-block;background:#123;color:#fff;padding:3px 10px;border-radius:12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left;vertical-align:top;font-size:13px}th{background:#eef}img{max-width:100%;border:1px solid #888}
@media print{.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="print()">Imprimer / PDF</button>
<h1>JophyOrtho 3D — Rapport de modélisation</h1><p>Généré le ${esc(now)} · Famille : <b>${esc(eng.label)}</b> · Type : <b>${esc(t.label)}</b></p>
<p class="note">Document de travail généré par JophyOrtho 3D. Les valeurs reflètent les mesures et réglages saisis par le professionnel responsable.</p>
<p>Provenance de la géométrie : <span class="prov">${esc(prov)}</span></p>
${shot ? `<img alt="Vue 3D" src="${shot}">` : ''}
<h2>Dossier</h2><table>${row('Identifiant', mt.id)}${row('Référence', mt.anon ? '(anonymisé)' : mt.ref)}${row('Patient', mt.anon ? '(anonymisé)' : mt.name)}${row('Date', mt.date)}${P.family === 'trunk' ? '' : row('Côté', mt.side === 'D' ? 'Droit' : 'Gauche')}${row('Âge / poids / taille', [mt.age, mt.weight, mt.height].join(' / '))}${row('Activité', mt.activity)}${row('Profession', mt.profession)}${row('Environnement', mt.env)}${row('Objectifs', mt.goals)}${row('Prescription', mt.prescription)}${row('Observations', mt.obs)}${row('Professionnel responsable', mt.anon && mt.pro ? '(masqué)' : mt.pro)}</table>
<h2>Acquisition</h2><table>${row('Mode', P.acq.mode)}${row('Scan', P.acq.scanName || '—')}${row('Unité / échelle', P.acq.unit + ' × ' + P.acq.scale)}${row('Orientation (proximal / antérieur / latéral)', [P.acq.orient.up, P.acq.orient.ant, P.acq.orient.lat].join(' / '))}${row('Coupes par plan appliquées', (P.acq.cuts || []).length ? P.acq.cuts.map((c, i) => (i + 1) + '. ' + c.label).join(' ; ') : 'aucune')}${row('Mesures saisies par l\'utilisateur', P.measuresTouched ? 'oui' : 'non (valeurs par défaut)')}</table>
<h2>Mesures</h2>${tab}<table>${fields}</table>
<h2>Repères</h2><table><tr><th>Repère</th><th>Position (mm)</th><th>Origine</th></tr>${lms}</table>
<h2>Zones de charge/décharge et rectifications</h2><p>Réduction globale : ${dev.redPct} % · Mix hybride : ${dev.mix}</p><table><tr><th>Type</th><th>Centre</th><th>Rayon</th><th>Valeur mm</th><th>Transition</th><th>Prio</th><th>Repère</th><th>Commentaire</th><th>Date/Auteur</th></tr>${zs}</table>
<h2>Interface, coque, trimlines</h2><table>${row('Suspension (documentaire)', dev.suspension)}${row('Manchon', dev.liner.on ? `${dev.liner.material} Shore ${dev.liner.shore} · ép. ${dev.liner.tDist}/${dev.liner.tGen}/${dev.liner.tProx} mm (distal/général/proximal)` : 'aucun')}${row('Coque', `${dev.shell.material} · jeu ${dev.shell.gap} mm · ép. ${dev.shell.tDist}/${dev.shell.tGen}/${dev.shell.tProx} mm · structure ajourée ${dev.shell.lattice} % · renforts ${dev.shell.reinf.length}`)}${row('Trimlines (mm)', tr)}${row('Ouvertures', ops)}${row('Volumes (cm³)', `anatomie ${out.stats.volAnat} · rectifiée ${out.stats.volRect} · coque (matériau) ${out.stats.volShell} · enveloppe externe ${out.stats.volOuter}`)}</table>
<h2>Composants</h2><p>${esc(conn)}</p><h2>Alignement</h2><p>${esc(al)}</p>
<h2>Confort et essayages</h2><p>Les scores sont des données saisies ; aucun score « scientifique » n'est calculé.</p><table><tr><th>#</th><th>Date</th><th>Confort</th><th>Signalements</th><th>Commentaire</th><th>Modifications décidées</th></tr>${trials}</table>
<h2>Avertissements</h2><ul>${warns}</ul>
<h2>Statut de validation</h2><p><b>${esc(P.validation.status)}</b>${P.validation.by ? ' — ' + esc(P.validation.by) : ''}</p>
<h2>Historique des opérations (${P.log.length})</h2><ol style="font-size:12px">${P.log.slice(-60).map(l => `<li>${esc(l.t.slice(0, 19))} — ${esc(l.op)}</li>`).join('')}</ol>
<h2>Limites</h2><ul><li>Reconstruction paramétrique et sections « étoilées » extraites du scan : approximations ; les contre-dépouilles ne sont pas représentées.</li><li>Épaisseurs obtenues par décalage le long des normales (approximation).</li><li>Les alignements et la suspension sont documentaires ; pas d'analyse mécanique.</li></ul>${creditHTML()}</body></html>`;
}
