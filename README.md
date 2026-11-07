# JophyOrtho 3D — CAO orthoprothétique (transtibial · transfémoral · corset du tronc)

Application web autonome, hors ligne, pour assister la modélisation 3D de **prothèses transtibiales**, **prothèses transfémorales** et **corsets du tronc**.

> Un badge permanent indique la provenance : « Scan patient importé », « Reconstruction à partir des mesures » ou « Gabarit de démonstration non spécifique au patient ».

## Installation / utilisation
* Ouvrir `index.html` (double-clic) **ou** `JophyOrtho3D-monopage.html` (un seul fichier). Aucun serveur, aucun réseau requis. WebGL est nécessaire.
* Pour l'installation PWA/hors-ligne : servir le dossier en HTTP(S) (`python3 -m http.server`) ; le service worker met alors l'application en cache.
* Reconstruire `app.js`, le monopage et le ZIP : `node build.js` (assemble `src/01…17-*.js`, sans dépendance).
* Moteur 3D : **WebGL natif** écrit pour ce projet (`src/01-math`, `03-render`). Three.js n'a pas pu être embarqué (réseau indisponible lors de la construction) ; aucune bibliothèque externe n'est utilisée.

## Parcours (14 étapes, 13 pour le corset)
Dossier → Acquisition (scan/mesures/hybride) → Mesures → Repères → Type → Zones → Manchon → Coque → Trimlines/ouvertures → Composants → Alignement (prothèses) → Confort → Essayages → Export/rapport.

## Architecture
| Fichier | Rôle |
|---|---|
| `src/01-math`, `03-render` | vecteurs/matrices ; renderer WebGL (une seule boucle rAF, tampons en cache, coupe par plan, caméra persp./ortho, tactile) |
| `src/02-mesh` | maillages, import STL ASCII/binaire, OBJ, PLY, export STL, contrôle (arêtes ouvertes, non-manifold, normales), réparation sur copie |
| `src/04-sections` | grille de sections radiales commune (extraction depuis un scan, anneaux, décalage de surface) |
| `src/06-tt`, `07-tf`, `08-trunk` | **trois moteurs séparés** : mesures, repères, types, trimlines, composants, avertissements propres |
| `src/09-device`, `10-parts`, `11-build` | rectification, zones, doublure, coque épaisse fermée, ouvertures, connecteurs, composants du corset |
| `src/12-state` | état du dossier, historique annuler/rétablir, IndexedDB (projets + scans) |
| `src/13-export` | STL, JSON, rapport HTML imprimable |
| `src/14…17-ui` | interface, calques, étapes |

Calques strictement séparés : anatomie originale (jamais modifiée) · anatomie nettoyée (copie réparée) · rectifiée · manchon · surface intérieure · surface extérieure · coque · composants · zones · repères · assemblage.

## Fonctions réellement opérationnelles
* Import STL (ASCII/binaire), OBJ, PLY ; unité mm/cm + facteur d'échelle ; orientation proximal/antérieur/latéral ; inversion des normales ; réparation non destructive ; affichage des arêtes ouvertes.
* Trois moteurs paramétriques distincts et leurs types : TT (PTB, TSB, hybride, KBM, PTS), TF (quadrilatérale, contention ischiatique, MAS, sous-ischiale, HiFi), corset (Boston, Chêneau 3D, Wilmington, Milwaukee, Charleston, LSO). Chaque type produit une forme différente sans toucher à l'anatomie.
* Zones Charge/Décharge/Stabilisation/Protection par toucher 3D (transition lissée, priorité, commentaire, repère, date, auteur), propositions de zones jamais appliquées silencieusement.
* Manchon, coque (paroi épaisse fermée, épaisseurs distale/générale/proximale, jeu, renforts, structure ajourée), trimlines par côté, ouvertures/bivalve/fenêtres/découpes libres.
* Connecteurs distaux réels (plaque, pyramide 4 trous avec perçages, récepteur femelle creux, insert fileté, tube, verrou, valve) toujours sous l'emboîture, alignement 3D avec axes avant/après.
* Coupes sagittale/frontale/transversale, mesure de distance, calques (afficher/masquer/transparence/solo), avant/après, historique annuler/rétablir, réinitialisation par étape.
* Dossier de confort (données manquantes, points à vérifier, risques ; **aucun score calculé**), boucle d'essayage avec retour à la géométrie de chaque essai.
* Exports : STL rectifiée/manchon/coque/assemblage, JSON complet (scan optionnel), rapport HTML/PDF, sauvegarde IndexedDB, réimport. Les fichiers issus du gabarit portent « Géométrie de démonstration non spécifique au patient » (nom + en-tête STL + rapport).

## Mesures et connecteur (version actuelle)
* Mesures : longueurs et hauteurs repères propres à chaque moteur (TT : PT, plateau→distal, condyles, tubérosité, tendon, flexion/varus du genou, longueur controlatérale ; TF : longueur périnée, trochanter, ischion, adduction/flexion fémorale ; corset : hauteurs axille / xiphoïde / sous-costal / taille / crêtes, longueurs ant./post./latérales D-G, gibbosité), plus un tableau de niveaux libres (hauteur, circonférence, ML, AP, rotation, décalages, réduction % par niveau, ajout/suppression).
* Connecteur : fusionné à la coque en une seule pièce ; le fond de l'emboîture est supprimé, la cavité descend jusqu'au connecteur et laisse un vide sous le moignon pour les têtes de vis. Réglages : hauteur bas du moignon → face haute du connecteur, profondeur d'insertion, décalages, rotation. Export STL « Pièce unique ».

## Coupe par plan et anatomie (version actuelle)
* Étape Acquisition → « Coupe par plan (Plane Cut) », inspirée de Meshmixer : hauteur, inclinaisons sagittale/frontale, placement du plan en touchant le modèle, côté à conserver (la partie supprimée apparaît en rouge), remplissage plat de la section, suppression des îlots flottants. Coupes successives, annulables, listées et enregistrées dans le dossier ; le scan original n'est jamais modifié.
* Reconstruction paramétrique anatomique : corset — le dos reste plat (position postérieure indépendante de AP), les variations de AP et de circonférence se font sur le ventre et la poitrine ; le dos suit une géométrie humaine (courbes de lordose et de cyphose, sillon rachidien, masses paravertébrales, omoplates, angles costaux, fossettes lombaires, triangle sacré, fessiers et pli interfessier), réglable par « Relief anatomique du dos » ; transtibial — la crête tibiale reste fixe, les variations se font sur le mollet.

## Textures et export debout (version actuelle)
* Import : sélectionnez ensemble le `.obj`, son `.mtl` et les images de texture (PNG/JPG…) ; les couleurs de sommets des OBJ/PLY sont aussi lues. La texture est convertie en couleurs de sommets, conservée à travers orientation, coupes et réparation. Le STL ne contient pas de couleur.
* Export : STL « debout » par défaut (Z vers le haut, face antérieure vers −Y, posé sur Z = 0, centré), réglable dans l'étape Export. Export PLY couleur (scan texturé, anatomie rectifiée avec zones colorées).

## Zones : sélection puis application unique
* Étape Zones : 1) sélectionner la zone en touchant le modèle (disques cumulables, en violet, sans effet sur la forme) ; 2) choisir charge / décharge / stabilisation / protection, valeur, transition, priorité, puis « Appliquer à la sélection » une seule fois. Les zones créées forment un groupe (suppression du groupe possible) et l'opération est annulable en une étape.

## Approximations de modélisation
* Les sections d'un scan sont extraites par balayage radial autour d'un axe (**contours « étoilés »**) : les contre-dépouilles sont perdues dans l'anatomie rectifiée/coque. Le scan original reste affiché tel quel.
* Reconstruction paramétrique : forme plausible (super-ellipses + reliefs anatomiques), pas l'anatomie du patient.
* Épaisseurs par décalage le long des normales ; « congé » = amincissement du bord ; ouvertures = suppression de cellules de la grille.
* Coupes : rendu visuel sans remplissage des faces ; sangles du corset = surfaces schématiques (non exportées en STL).
* Règles propres aux types, zones suggérées, convention signe des zones, suspension : conventions de démonstration à valider par le professionnel. Alignement : transformation géométrique, pas une analyse biomécanique. Ventilation/texture du manchon : documentaires.

## Contrôles effectués (Chromium/WebGL logiciel + Node)
Syntaxe JS ; ouverture sans erreur console ; navigation des 14/13 étapes et boutons Précédent/Suivant ; import STL ASCII et binaire ; rotation/zoom ; calques ; zones par toucher ; épaisseurs ; connecteurs sous l'emboîture ; coupe ; export STL (coque fermée, volume signé > 0), JSON, rapport ; annuler/rétablir ; réimport JSON ; sauvegarde IndexedDB ; original du scan inchangé (somme de contrôle) ; mobile 390 px sans débordement.

## Mesures (mise à jour)
- Prothèses : niveaux de mesure à 25 %, 50 %, 75 % de la longueur du membre résiduel, depuis l'extrémité distale.
- Saisie : les valeurs tapées au clavier ne sont appliquées qu'à la validation (Entrée ou sortie du champ), bornées à la plage ; une seule entrée d'annulation par saisie.
- Circonférence saisie dans le tableau : le calcul automatique ML×AP est désactivé et la valeur mesurée est conservée.
- Fiches PDF de prise de mesures (TT, TF, corset) fournies à part.

## Sélection de la partie à conserver (remplace la coupe par plan)
Après l'import et l'orientation du scan, l'étape **Sélection** permet de peindre au pinceau (clic maintenu / doigt) sur le modèle 3D la seule partie à conserver (moignon ou tronc). Outils : pinceau, gomme, navigation, taille réglable, inverser, tout effacer, annuler le dernier trait. La validation supprime tout le reste (l'original n'est jamais modifié ; « Modifier la sélection » la rouvre).
L'étape **Points clés** impose ensuite : tendon rotulien + extrémité distale (TT), périnée + extrémité distale (TF), ou sternum, xiphoïde, épines et crêtes iliaques, trochanters, sacrum (corset). La longueur (PT → extrémité, périnée → extrémité) et les hauteurs de crête / xiphoïde sont déduites et reportées dans les mesures.

## Orthèses / attelles des membres supérieur et inférieur (nouveau)
Deux nouveaux dossiers : **Orthèse du membre supérieur** (poignet, main, avant-bras, coude) et **Orthèse du membre inférieur** (AFO, genou, jambière).
1. **Membre 3D anatomique** généré à partir des mesures (longueurs, circonférences, largeurs osseuses, angles) : muscles (deltoïde, biceps, triceps, brachio-radial, quadriceps, mollet…), repères osseux (olécrâne, épicondyles, styloïdes, rotule, tubérosité tibiale, tête fibulaire, malléoles), main avec doigts et pouce, pied avec voûte et orteils. Il se met à la taille du patient à chaque modification.
2. **Scan** : import, puis **Sélection** au pinceau du seul membre, puis **Points clés** (olécrâne + styloïde ulnaire, ou rotule + malléole latérale) qui renseignent les mesures.
3. **Zones couvertes** : choix d'un type d'orthèse (zone de départ) puis dessin au pinceau des zones à couvrir / libérer.
4. **Orthèse** : coque épaisse construite sur la zone peinte (épaisseur, jeu, doublure, lissage du contour), aération (perforations), sangles.
5. **Export** : STL de l'orthèse (coque + sangles), coque seule, doublure, anatomie ; rapport imprimable ; dossier JSON.

## Ergonomie PC / tablette / mobile
- **Plein écran 3D** (bouton ⛶ de la barre de vue, ou « Peindre en plein écran 3D » dans les étapes Sélection / Zones couvertes) : le modèle occupe tout l'écran, avec une barre d'outils flottante (Pinceau, Gomme, Tourner, Annuler, Terminé, taille du pinceau). Échap ou ✕ pour quitter.
- Cibles tactiles agrandies sur écran tactile, champs en 16 px (pas de zoom automatique sur iOS), pinceau plus large par défaut, message d'aide qui disparaît seul.
- Disposition adaptée : téléphone (portrait), téléphone en paysage (3D à gauche, panneau à droite), tablette (étapes réduites aux numéros), PC.
- Raccourcis PC : B pinceau, E gomme, N naviguer, [ et ] taille du pinceau, Échap quitter le plein écran, Ctrl+Z annuler.

## Pied détaillé, charges / décharges et articulations (orthèses)
- **Pied (membre inférieur)** : talon (tubérosité calcanéenne), cou-de-pied, tubérosité du naviculaire, base du 5e métatarsien, têtes métatarsiennes, voûte longitudinale médiale, 5 orteils à phalanges avec ongles. Nouvelles mesures : largeur du talon, hauteur du cou-de-pied, circonférence métatarsienne, circonférence en 8 (contrôle), longueur et valgus du gros orteil, rotation externe, flexion dorsale / équin de la cheville, varus / valgus de l'arrière-pied. Neuf repères du pied (talon, naviculaire, base et têtes des métatarsiens, dos du pied, voûte, zone rétro-capitale, gros orteil).
- **Nouveaux types** : AFO articulée, orthèse de genou articulée, orthèse plantaire à coque talonnière (UCBL), semelle plantaire, étrier bimalléolaire, botte de décharge. Réglages : étendue de la semelle (talon / médio-pied / têtes MT / orteils) et hauteur des rebords du pied.
- **Étape « Charges / décharges »** : zones anatomiques prédéfinies (malléoles, tête de la fibula, crête tibiale, rotule, condyles, creux poplité, Achille, talon, naviculaire, base du 5e MT, têtes MT, dos du pied ; membre supérieur : olécrâne, épicondyles, styloïdes, pisiforme, têtes métacarpiennes ; charges : voûte, pelote rétro-capitale, contention du talon, appuis à 3 points, arche palmaire, thénar) et zones libres peintes. Chaque zone : décharge ou charge, intensité (mm), taille. La surface interne de la coque (et de la doublure) est déplacée localement le long de la normale, avec un raccord progressif.
- **Articulations mécaniques** : disque d'axe et montants latéral / médial sur cheville, genou, coude ou poignet ; butées consignées dans le rapport.

## Pied anatomique (v5)
Le pied est désormais une surface continue (champ de distance + « surface nets », lissage de Taubin) : coussinet talonnier et calcanéus, tarse et métatarse en sections elliptiques, tubérosité du naviculaire, base du 5e métatarsien, têtes métatarsiennes (pelote plantaire), arche médiale creusée, appui plantaire plat, cinq orteils (hallux à 2 phalanges) reliés par leurs palmures, raccord progressif avec la cheville. Maillage fermé (~34 000 triangles, volume ≈ 750 cm³ pour un pied de 255 mm). Mis en cache : seules les mesures du pied le recalculent (≈ 0,5 s).

## Langues (v6)
- Français, English, Español, Português, العربية (RTL) et 中文, sélecteur en haut à droite, changement à tout moment (l'état de la modélisation est conservé), choix mémorisé.
- Traduction à la volée (`src/00-i18n-a.js` + dictionnaires `src/00-i18n-b.js`) : texte, infobulles, boîtes de dialogue et rapports HTML.
- Coordonnées de l'éditeur affichées en bas de page, dans les rapports et sur l'écran de connexion (src/18-a-config.js).
- Une chaîne absente du dictionnaire reste en français (jamais de blocage).

## Main anatomique (v6)
- Main reconstruite en surface implicite : paume distale, têtes métacarpiennes, doigts à 3 phalanges (nodosités, pulpe, ongle), pouce à 2 phalanges + éminence thénar, palmures et 1re commissure.

## Accès libre et dons
Plus aucune authentification : pas de compte, pas d'essai, pas de licence. Le logiciel est gratuit et s'ouvre directement sur la page d'accueil. La rubrique « Faire un don » (`src/18-d-donate.js`) affiche les coordonnées bancaires ; « À propos » et les coordonnées de contact restent disponibles.
