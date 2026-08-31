# ADR-37 — Décodage vidéo matériel : `preset-vaapi` retenu, QuickSync différé

> Statut : Accepté

## Contexte

La documentation Frigate qualifie le décodage vidéo de *« l'une des tâches les plus coûteuses en
CPU »* et annonce qu'une accélération matérielle permet de *« supporter 2 à 3 fois plus de caméras à
matériel égal »*. Or `FrigateConfigApplier` n'émettait aucune section `ffmpeg` : la configuration
générée laissait `hwaccel_args` vide, donc tout le décodage en logiciel, même sur un hôte doté d'un
iGPU Intel — celui-là même qu'[ADR-34](0034-automatic-hardware-adaptation-of-the-frigate-detector.md)
détecte déjà et pour lequel `/dev/dri` est déjà exposé au conteneur.

Mesuré sur l'instance de dev ([investigation](../investigations/frigate-cpu-profiling.md)) : ~9 % d'un
cœur pour deux caméras, dont 5,8 % pour la seule caméra 3 MP en HEVC. Poste secondaire face au
détecteur, mais gaspillage pur et proportionnel au nombre de caméras et à leur résolution.

Deux éléments contraignent le choix du preset :

- **Les presets QuickSync sont codec-spécifiques.** Sur la version pinnée, `ffmpeg_presets.py`
  n'expose que `preset-intel-qsv-h264` et `preset-intel-qsv-h265` — il n'existe pas de variante
  agnostique. `preset-vaapi`, lui, l'est.
- **Vyzio ne connaît pas le codec de ses caméras.** `Camera` ne porte aucun champ de codec et le
  pipeline de découverte ne le relève pas. Au moment de générer la configuration, rien ne permet de
  choisir entre les deux variantes QSV.

## Options comparées

1. **`preset-vaapi` dès qu'un iGPU Intel est détecté.** Codec-agnostique, fonctionne de la
   génération 1 à la génération 12 et reste fonctionnel au-delà. Aucun prérequis nouveau.
2. **Sélectionner QuickSync (`preset-intel-qsv-h264/h265`) selon la génération Intel.** La
   documentation le recommande à partir de la génération 13 et sur les GPU Arc. Écarté : la
   détection de génération ne suffit pas — il faudrait aussi le codec de chaque caméra, que Vyzio
   n'enregistre pas. Implémenter la détection de génération seule produirait du code qui ne décide de
   rien. Reporté au backlog, conditionné à l'enregistrement du codec par caméra.
3. **Sonder le codec à la volée au moment de générer la configuration** (ffprobe par caméra) pour
   pouvoir choisir la variante QSV. Écarté : introduit des entrées/sorties réseau dans la génération
   de configuration, jusqu'ici purement locale et déterministe, et fait dépendre l'écriture de
   `frigate.yml` de la joignabilité des caméras.
4. **Laisser l'utilisateur choisir son preset.** Écarté : contredit les principes produit #1 et #5,
   et suppose qu'il connaisse la génération de son processeur et le codec de ses caméras.

## Décision

Option 1. `IHardwareAccelerationDetector.DetectVideoAcceleration()` renvoie `FrigateHwAccel.Vaapi`
dès qu'un iGPU Intel est détecté, et `FrigateConfigApplier` émet alors
`ffmpeg.hwaccel_args: preset-vaapi`.

**Le décodage est résolu indépendamment du palier de détection.** Un hôte peut porter un Coral *et*
un iGPU Intel — c'est le montage Frigate classique : l'inférence revient au Coral, le décodage doit
rester sur le GPU. Dériver l'accélération vidéo de `FrigateDetectorKind` aurait silencieusement perdu
ce cas, puisque le Coral l'emporte pour la détection.

## Conséquences

- `FrigateHwAccel` (Core/Entities) est un enum et non la chaîne de preset — aucune valeur littérale
  Frigate n'est comparée en dur, elle n'apparaît qu'à la sérialisation YAML (règle des comparaisons
  type-safe, `src/vyzio/CLAUDE.md`).
- `FrigateDetectorPlan` porte désormais le décodage en plus du détecteur et du FPS : le plan reste le
  point unique où la détection matérielle est traduite en décisions, consommé sans être recalculé.
- Les hôtes sans iGPU Intel n'émettent aucune section `ffmpeg`, plutôt qu'un preset neutre : une
  option absente est plus sûre qu'une option inopérante, et laisse les défauts de Frigate s'appliquer.
- Limite connue et assumée : sur les générations Intel les plus anciennes (≤ 5, pilote `i965`),
  VAAPI peut exiger `LIBVA_DRIVER_NAME=i965` dans l'environnement du conteneur. Non géré — aucun
  matériel de ce type dans le périmètre constaté, et la variable relève du déploiement
  (`docker-compose.yml`), pas de la configuration générée.
- Nvidia et AMD restent hors périmètre pour la même raison qu'ADR-34 : leurs presets exigent un
  variant d'image Docker différent.
