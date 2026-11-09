# Passation — DemiFond Scan v2 (à lire en entier avant toute modification)

Tu reprends un travail en cours pour une enseignante d'EPS du lycée Vauban (Luxembourg).
**Réponds-lui toujours en français**, simplement, sans jargon technique.

## 1. Règles de travail (non négociables)

1. **Aucune perte de données.** Les données des élèves sont sur l'iPad (localStorage). Ne change jamais la clé de stockage ni le format des données.
2. **Compatibilité dans les deux sens avec l'ancienne version (v1)** : une sauvegarde HTML faite par la v2 doit se relire dans la v1, et inversement. Tu peux ajouter des champs, mais tu ne dois jamais en renommer ni en supprimer.
3. **Les calculs de notes ne doivent pas changer.** Ils ont été recopiés à l'identique de la v1 (0 différence sur 116 résultats réels). Si tu touches à `v2/core.js`, vérifie que les notes restent identiques.
4. **Travaille sur la branche `refonte`, jamais sur `main`.** `main` est l'application que l'enseignante utilise en classe. La fusion de `refonte` dans `main` ne se fait **qu'avec son accord explicite**.
5. Elle veut que les mises à jour soient publiées directement (commit + push sur `refonte`) : ne lui demande pas de le faire elle-même.
6. Teste avant de publier, et dis-lui clairement ce qui a été testé et ce qui ne l'a pas été (la vraie caméra de l'iPad ne peut pas être testée hors de l'iPad).

## 2. Où se trouve le code

- Dépôt GitHub : `EPS-BARLETTA/DemiFond_Scan_CFF`, branche **`refonte`**.
- Hébergement : Vercel.
  - Production (branche `main`) : https://demi-fond-scan-cff.vercel.app
  - Test (branche `refonte`) : https://demi-fond-scan-cff-git-refonte-barlettas-projects.vercel.app
  - Chaque push sur `refonte` redéploie automatiquement l'adresse de test.
- Application statique en JavaScript, sans framework ni étape de construction.

| Fichier | Rôle |
|---|---|
| `index.html` | Page de la v2 (charge `jsQR.js`, `v2/core.js`, `v2/app.js`). |
| `v2/core.js` | `window.DF` : données, calculs 2×800 et 3×500, validation des QR, copies de secours (IndexedDB). |
| `v2/app.js` | Interface : navigation, pages, scanner, fenêtres de correction, barèmes, import et export. |
| `v2/app.css` | Style. Un « thème couleurs EPS » est ajouté en fin de fichier. |
| `sw-v2.js` | Service worker (cache `df-v2-2.2`). **À chaque changement, incrémente la version** dans `sw-v2.js`, `index.html` (`?v=`) et `APP_VERSION` dans `app.js`. |
| `index-v1.html` + les autres `.js`/`.css` à la racine | Ancienne version (v1), accessible par le lien « ancienne version ». **Ne pas modifier.** |
| `jsQR.js` | Lecteur de QR. |

## 3. Données (clé localStorage `df-scan-ccf-v2`)

```
{ groups:[{ id, name, classroom, archived, uiColor, bareme500Id?, students:[], sessions:[] }],
  trainingScans:[], history:[],
  settings:{ exam500Bareme, bareme500Library?, htmlExports, lastHtmlExportAt, lastChangeAt } }
```

- Une **classe** (`group`) contient des **exercices** (`sessions`). Une **séance** n'est pas un objet stocké : c'est le regroupement des exercices qui ont le même `lessonId`.
- Exercice : `{ id, lessonId, lessonDate, lessonLabel, label, type:'ccf'|'exam500'|'training'|'', status:'open'|'closed'|'locked', students[] }`.
- Résultat 2×800 (CCF) : `races{1,2:{totalMs, splits[4 temps cumulés], project, resultId, status}}`, `aflAllocation`, `afl2Level`, `afl3Level`.
- Résultat 3×500 : `exam500.races[{race, project, projectMs, split250Ms, total500Ms}]`, plus `exam500Afl2/Afl3` (Seconde) ou `exam500Warmup/Carnet/Observation` (Première).
- Réglages d'un exercice 3×500 : `exam500Bareme`, `exam500EvaluationLevel` ('seconde'|'premiere'), `exam500IndexMode` ('c1c2'|'three'), `exam500EstimationCount` (2|3), `exam500QrConfig`, `exam500BaremeCustomized`, `exam500BaremeName`, `exam500Afl2Label`, `exam500Afl3Label`.
- Barèmes (ajouts de la v2.2) :
  - `settings.bareme500Library` : `[{ id, name, level, anchors:{girls:[[pts,sec/500]…], boys:[…]} }]`, ou `rows:{girls,boys,efficiency}` pour un barème ajusté ligne par ligne ;
  - `group.bareme500Id` : barème choisi pour la classe. S'il est absent, le niveau est deviné d'après le nom de la classe (« 1… » → Première, « 2… » → Seconde) ; s'il vaut `"model"`, c'est le modèle par défaut qui s'applique.
- Élève ajouté à la main : `manual:true`, `externalId:""`. Quand son QR est scanné plus tard, il est retrouvé par son nom et son prénom, et l'`externalId` est alors recopié.
- Types de QR : `DF_CCF_RESULT` v1, `DF_3X500_RESULT` v1, `DF_TRAINING_RESULT` (format compact v3).
- Sauvegarde HTML : balise `<script id="demifond-archive-data" type="application/json">` contenant `{format:'demifond-class-backup', version:2, scope:'all'|'class'|'lesson', …}`. Une restauration `all` remplace tout ; `class` et `lesson` fusionnent avec les données existantes. Une copie de secours IndexedDB est faite avant chaque import ou suppression.
- Code d'accès au barème : **57**. C'est un simple verrou d'interface, comme dans la v1.

## 4. Ce qui est fait (v2.2, sur `refonte`)

- Navigation Classes → Classe (onglets Séances / Élèves) → Séance → Exercice, avec un fil d'Ariane.
- Scanner plein écran dans l'exercice ouvert :
  - un QR déjà scanné est refusé ;
  - un relevé déjà enregistré peut être remplacé, après confirmation ;
  - « Annuler ce scan » est proposé après chaque scan ;
  - un QR d'un autre protocole est rangé dans le bon exercice de la même séance.
- Fenêtres de correction 2×800 et 3×500 (lien « Corriger › » sous le nom), retrait d'un élève, toast avec bouton Annuler.
- Élèves sans résultat signalés, filtre « À compléter seulement », export CSV des notes.
- Suivi d'un élève avec courbes (meilleur 800, total 3×500).
- Sauvegardes : export et import HTML compatibles avec la v1, copies de secours automatiques.
- Thème coloré (bandeau d'accueil bleu, couleur par classe, couleur par type d'exercice) : l'enseignante avait trouvé la première v2 « trop austère ».
- Barèmes 3×500 (page `#/baremes`, code 57) :
  - un barème par classe, attribué automatiquement ;
  - un constructeur à partir de 6 allures au 500 m par sexe, qui génère 24 paliers ;
  - une bibliothèque de barèmes ;
  - l'application d'un barème aux exercices existants ;
  - un éditeur ligne par ligne dans chaque exercice ;
  - le modèle par défaut.
- « ＋ Ajouter un élève » dans les exercices 2×800 et 3×500.

## 5. À faire ensuite (dans l'ordre, après les retours de l'enseignante)

1. **Recueillir ses retours de test sur l'iPad** (caméra réelle, style, barèmes) et les corriger.
2. Ajout manuel d'un **résultat d'entraînement** (pour l'instant, seule la suppression est possible).
3. **Impression / PDF des bilans** d'un exercice. La v1 le faisait ; la v2 n'a pour l'instant que la sauvegarde HTML et le CSV.
4. **Passage en production**, seulement quand elle le demande :
   - fusionner `refonte` dans `main` ;
   - vérifier que `sw-v2.js` remplace l'ancien `offline-worker.js` sans perdre les données (même origine, même clé) ;
   - garder `index-v1.html` accessible.
   - Avant la fusion, lui demander de faire une sauvegarde HTML de toutes ses classes.

## 6. Comment tester

- Serveur local : `python3 -m http.server 8793` à la racine du dépôt, puis ouvrir http://localhost:8793/.
- Jeu de données réel : sa sauvegarde `DemiFond_Toutes_les_classes_3.html` (7 classes, 109 élèves, 116 résultats). Importe-la par la page Sauvegardes. Elle ne doit **pas** être ajoutée au dépôt : ce sont des données d'élèves.
- Tests automatisés possibles avec Playwright : scan simulé en collant le contenu JSON du QR dans le champ « saisie manuelle » du scanner (`#qrText`, puis le bouton `[data-act=scan-text]`).
- À vérifier après chaque modification :
  - aucune erreur JavaScript ;
  - notes identiques avant et après ;
  - l'export de la v2 se réimporte dans la v1, et inversement ;
  - l'affichage est correct en largeur iPad (820 px et 1180 px).

## 7. Préférences de l'enseignante

- Elle veut des réponses courtes et concrètes, en français : ce qui a changé, où le trouver, ce qui reste à faire.
- Pas de questions inutiles : on fait, puis on montre.
- Elle tient beaucoup à la sécurité de ses données et à pouvoir corriger vite une erreur de scan.
- L'outil compagnon est Chrono Carnet EPS (https://chrono-carnet-eps.vercel.app/) : il produit les QR que DemiFond scanne.

## 8. Ses autres applications (même organisation GitHub, EPS-BARLETTA)

- **Mon Classeur Prof** (`Mon-classeur-prof-`, GitHub Pages, version 23) : bilan trimestriel, appréciations (mode admin, code 3946), onglet CCF Terminale.
- **Mes évaluations en EPS** (`MesEvaluationsEPS`) : copie de Mon Classeur Prof sans les appréciations, sur le même domaine github.io. Cache et service worker séparés, clé `mes-evaluations-eps-v1`.
- **Bac_Vauban** (dépôt privé, Vercel) : encart des convocations, PV avec la date reprise automatiquement (imprimée seulement en face des élèves importés).

Ces applications sont terminées et en service : n'y touche que si elle le demande.
