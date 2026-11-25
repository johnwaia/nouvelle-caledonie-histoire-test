# KANAKY · Une histoire en carte

Site interactif (Vue 3 + Leaflet + SQLite) qui retrace l'histoire de la Nouvelle-Calédonie, de la culture Lapita à aujourd'hui : 75 événements, 347 tribus et 33 communes.

## Fonctionnalités

- **Carte** (plein écran) : fond épuré (Esri Light Gray Canvas) dont les terres sont recolorées en vert. Les points trop proches s'écartent en restant, autant que possible, sur la terre ferme.
- **Frise chronologique** en bas : seules les années qui comptent au moins un événement y figurent. On la fait défiler à la souris, au doigt ou avec ← → (Début/Fin pour les extrémités).
- **Une année à la fois** : la carte n'affiche que les événements de l'année choisie, avec un fondu au changement d'année. Les événements hors de l'archipel (Paris, Bougival…) sont listés dans un encart.
- **Logos sur la carte** : drapeaux, casse-tête, usine… ou, à défaut, l'icône de la catégorie. Les référendums ont une urne, barrée d'une croix rouge s'ils ont été boycottés (1987 et 2021).
- **Fiche d'événement** au clic : image, date, lieu, description, vidéos, sources. Échap ou un clic à côté la ferme ; ← → passent à l'événement précédent ou suivant. Lien partageable : `#evenement=<id>`.
- **Tribus, communes, aires coutumières et provinces** : boutons de l'en-tête et fiche au clic. La fiche d'une commune liste ses tribus. Aires et provinces ne s'affichent pas en même temps. Liens partageables : `#tribu=<id>`, `#commune=<id>`.
- **Recherche** d'une tribu ou d'une commune : la carte n'affiche plus que le résultat choisi.

## Lancer le projet

Node.js 22.13 ou plus récent (SQLite intégré).

```bash
npm install
npm run dev         # http://localhost:5173
npm run admin       # administration : http://127.0.0.1:5180
npm run check-data  # vérifie la base
npm run build       # vérifie la base puis produit le site statique dans dist/
npm run preview     # prévisualise dist/
```

## Base de données

Toutes les informations et les images du site sont dans un seul fichier : `database/kanaky.sqlite` (tables décrites dans `database/schema.sql`).

- **Sur le site** : le navigateur télécharge une copie sans les images et la lit avec [sql.js](https://sql.js.org). À la publication, chaque image de la base devient un fichier (`images/…`), chargé seulement quand il est affiché.
- **Images** : stockées dans la base (`image_data`) ou simples liens `https://…` (Wikimedia Commons, CNRS).

### Modifier les données en ligne

Page `admin.html` du site publié (lien « Administration » dans le bouton « i » de la carte).

1. Créer une fois un jeton GitHub « fine-grained » limité à ce dépôt, avec la seule permission « Contents : Read and write » et une date d'expiration. La page de connexion détaille les étapes.
2. Se connecter avec ce jeton, modifier et enregistrer les fiches.
3. Cliquer sur **Publier** : toutes les modifications partent dans un seul commit sur `main` et le site est republié en une à deux minutes.

Tant que « Publier » n'a pas été cliqué, les changements n'existent que dans la page : la fermer les perd. Si la base a été modifiée ailleurs entre-temps, la publication est refusée plutôt que d'écraser ce travail. Le jeton n'est jamais enregistré ; ne pas le partager et le révoquer sur GitHub en cas de doute.

La page modifie le dépôt et la branche qui ont publié le site (affichés à la connexion) : un site de test ne modifie que son propre dépôt.

### Modifier les données en local

1. `npm run admin`, puis ouvrir http://127.0.0.1:5180 (même interface, sans jeton).
2. Vérifier le résultat avec `npm run dev` (la page se recharge à chaque enregistrement).
3. Committer `database/kanaky.sqlite` et pousser sur `main`.

Git ne sait pas fusionner deux versions de la base : éviter de la modifier sur deux branches en même temps, et faire `git pull` avant une modification locale. Chaque publication ajoute environ 6 Mo à l'historique : mieux vaut regrouper les modifications.

## Publication

Chaque push sur `main` publie le site sur GitHub Pages (`.github/workflows/deploy.yml`). À activer une fois : Settings → Pages → Source « GitHub Actions ». Le dossier `dist/` peut aussi être déposé sur n'importe quel hébergement statique.

## Structure

```
database/kanaky.sqlite      la base de données
database/schema.sql         description des tables
database/db.mjs             lecture et écriture depuis Node
database/vite-plugin.mjs    publication de la base et des images avec le site
admin.html                  administration en ligne
admin/ui.js                 interface d'administration (en ligne et locale)
admin/online.js             connexion et publication par GitHub
admin/server.mjs            serveur de l'administration locale
public/images/              icônes du site
assets-sources/             fichiers d'origine des logos
scripts/check-data.mjs      vérification de la base
scripts/import-tribus.mjs   import de la liste officielle des tribus (DITTT)
scripts/import-communes.mjs import des communes et de leur histoire (Wikipédia)
src/App.vue                 chargement des données, sélection, navigation
src/db/client.js            ouverture de la base dans le navigateur
src/db/read.js, write.js    lecture et écriture des tables
src/db/api.js, checks.js    actions de l'administration et règles de validation
src/components/MapView.vue       carte Leaflet et marqueurs
src/components/TimelineBar.vue   frise chronologique
src/components/SearchBox.vue     recherche (tribus / communes)
src/components/EventModal.vue    fiche d'un événement
src/components/TribuPanel.vue    fiche d'une tribu
src/components/CommunePanel.vue  fiche d'une commune
src/components/AirePanel.vue     fiche d'une aire coutumière
src/components/ProvincePanel.vue fiche d'une province
src/components/PhotoFigure.vue   image d'une fiche, avec son crédit
src/components/CategoryIcon.vue  icône d'une catégorie
src/utils/icons.js          icônes des catégories
src/utils/dates.js          dates (format français)
```

## Règles pour un événement

- **Obligatoires** : identifiant (a-z, 0-9, tirets), titre, date, lieu, catégorie, description.
- **Dates** : `AAAA`, `AAAA-MM` ou `AAAA-MM-JJ` ; année négative avant notre ère.
- **Coordonnées** : vides pour un événement hors de l'archipel.
- **Logo** : `urne.svg` pour un référendum, `urne_boycott.svg` s'il a été boycotté ; sans logo, l'icône de la catégorie est affichée.
- **Placer sous les autres points de l'année** : utilisé pour les drapeaux de 1984.

## Mettre à jour les tribus et les communes

```bash
node scripts/import-tribus.mjs    # conserve les fiches rédigées et les ajouts manuels
node scripts/import-communes.mjs
```

Ces scripts modifient la base. L'import des communes recharge « Présentation » et « Histoire » depuis Wikipédia ; pour garder un texte retouché, remplir « Histoire manuelle » dans l'administration.

## Crédits

Fond de carte © Esri, HERE, Garmin, contributeurs OpenStreetMap ; pour un site très fréquenté, vérifier les conditions d'Esri ou passer à un fournisseur dédié (MapTiler, Stadia Maps…) dans `src/components/MapView.vue`. Tribus : Gouvernement de la Nouvelle-Calédonie / DITTT. Histoire des communes : Wikipédia (CC BY-SA 4.0). Images : Wikimedia Commons, CNRS Images et ce dépôt ; le crédit est affiché sous l'image quand il est connu. Les 40 images d'événements stockées dans la base n'ont pas encore de crédit : auteurs et droits restent à vérifier. Vidéos : archives de l'INA.

Les textes sont des résumés à visée pédagogique : à relire et enrichir avec des sources de référence (Musée de Nouvelle-Calédonie, ADCK – centre culturel Tjibaou, Archives de la Nouvelle-Calédonie, travaux universitaires).
