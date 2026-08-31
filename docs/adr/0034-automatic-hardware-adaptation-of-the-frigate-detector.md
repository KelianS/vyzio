# ADR-34 — Adaptation matérielle automatique du détecteur Frigate

> Statut : Accepté

## Contexte

`FrigateConfigApplier.BuildDocument` génère la section `detectors`/`model` de `frigate.yml`. Avant
cet ADR, elle était figée : un seul détecteur `cpu1` de type `cpu`, `detect.fps` fixé à 5 pour toutes
les caméras, quel que soit le matériel présent et le nombre de caméras. Cela contredit le principe
produit #5 (plug & play) : un utilisateur disposant d'un accélérateur dédié (Coral) ou d'une carte
graphique doit en bénéficier sans rien configurer, et un hôte CPU-only avec plusieurs caméras a besoin
d'une fréquence d'analyse réduite pour ne pas saturer le processeur (SPECS §7.2).

Deux contraintes façonnent la décision :

- **Image Docker déployée.** Sur la version Frigate pinnée (`0.17.1`,
  [`docker-compose.yml`](../../docker-compose.yml)), Coral (edgetpu) et Intel (OpenVINO/onnx)
  fonctionnent avec l'image `ghcr.io/blakeblackshear/frigate:0.17.1` déjà déployée. Nvidia (`tensorrt`)
  et AMD (`rocm`) exigent un **variant d'image Docker différent** — recréer le conteneur, pas
  seulement réécrire sa config et le redémarrer (`FrigateConfigApplier.ApplyAsync` fait uniquement ce
  dernier).
- **Licence du modèle IA.** Le modèle par défaut d'OpenVINO (`ssdlite_mobilenet_v2`, origine Intel Open
  Model Zoo) s'est révélé, en test terrain, nettement moins fiable que le modèle du détecteur `cpu`
  natif (`MobileDet`, origine Google Coral) — un chat détecté `bird`/`person` avec ~96 % de confiance.
  Frigate recommande YOLOv9 comme alternative, mais son dépôt
  ([WongKinYiu/yolov9](https://github.com/WongKinYiu/yolov9)) est **GPL-3.0** : l'embarquer dans l'image
  Vyzio distribuée en ferait Vyzio le distributeur d'un binaire dérivé GPL. Test exploratoire détaillé
  dans [`investigations/yolov9_frigate_openvino.md`](../investigations/yolov9_frigate_openvino.md).

## Options comparées

1. **Coral (`edgetpu`) → Intel GPU (`onnx`, modèle YOLOX bundlé dans l'image Vyzio) → CPU (détecteur
   natif `cpu`, `MobileDet`).** `IHardwareAccelerationDetector` sonde, dans l'ordre : Coral PCIe
   (`/dev/apex_0`) ; sinon un device DRI (`/dev/dri/renderD128`) dont le vendor PCI
   (`/sys/class/drm/renderD128/device/vendor`) est Intel (`0x8086`) ; sinon CPU. `FrigateDetectorPlanner`
   résout (kind, FPS cible). `FrigateConfigApplier` traduit le résultat en `detectors`/`model` Frigate.
   Le palier Intel GPU utilise `onnx` (plutôt que `openvino` explicite) : sur l'image stock, `onnx`
   détecte et utilise automatiquement OpenVINO comme execution provider GPU, avec **YOLOX** (Megvii,
   [Apache-2.0](https://github.com/Megvii-BaseDetection/YOLOX)) — licence permissive, poids
   pré-entraînés téléchargeables directement (pas d'étape d'export comme YOLOv9), variante `yolox_s`
   (640×640) bundlée dans l'image `vyzio-api` (Dockerfile) et installée à la demande dans le volume
   `vyzio-config` partagé avec Frigate par `IFrigateModelAssetInstaller`. Le palier CPU seul garde le
   détecteur natif `cpu` (`MobileDet`) — cf. Option 2 pour pourquoi il n'utilise pas YOLOX aussi.
2. **YOLOX (ou tout modèle de la famille YOLO) également sur le palier CPU seul**, testé en v1. Écarté
   après test terrain : pics CPU à ~800 % avec 2 caméras et détections dégradées (frames perdues sous
   charge) — même la plus petite variante (`yolox_nano`) coûte plus cher par inférence que le modèle du
   détecteur `cpu` natif (`MobileDet`), qui s'est montré fiable en test terrain séparé. Un modèle plus
   précis n'est un gain net que là où du matériel dédié absorbe le surcoût (Coral, GPU) — pas sur le
   palier qui est par définition la machine la moins capable.
3. **YOLOv9** comme modèle de remplacement. Écarté : licence GPL-3.0 du dépôt d'origine — Vyzio
   deviendrait distributeur d'un binaire dérivé GPL en l'embarquant dans son image. Frigate lui-même ne
   fournit jamais de poids YOLOv9 pré-exportés, seulement la procédure pour les générer soi-même,
   vraisemblablement pour la même raison.
4. **YOLO-NAS** comme modèle de remplacement. Écarté : poids pré-entraînés
   ([Deci-AI/super-gradients](https://github.com/Deci-AI/super-gradients)) explicitement interdits
   d'usage commercial par leur licence.
5. Convertir le modèle `MobileDet` (utilisé par le détecteur `cpu` natif, jugé fiable en test terrain)
   en IR OpenVINO pour l'utiliser sur le palier GPU Intel. Écarté : conversion tflite→OpenVINO non
   documentée/supportée par Frigate, même classe de risque que l'export YOLOv9 (mismatch d'opset ou de
   post-traitement produisant des détections mal calibrées sans erreur explicite).
6. Étendre la détection à Nvidia/AMD et recréer le conteneur Frigate sur le variant d'image adapté
   (`-tensorrt`/`-rocm`) au moment de l'apply. Écarté : nécessite de tirer une image potentiellement
   absente localement (tension avec le fonctionnement hors ligne), de gérer l'échec de
   pull/recréation sans casser un système qui fonctionnait. Reste une évolution possible en projet
   séparé (backlog Idées) si un besoin terrain Nvidia/AMD se confirme.
7. Configuration manuelle du détecteur/modèle par l'utilisateur. Écarté : contredit le principe plug &
   play — l'utilisateur ne doit pas avoir à connaître son matériel ni le vocabulaire Frigate.
8. Ajustement dynamique et continu du FPS piloté par la charge CPU observée en temps réel. Écarté :
   complexité disproportionnée ; un calcul déterministe basé sur cœurs disponibles et caméras actives,
   borné min/max, couvre le besoin sans introduire d'oscillation.

## Décision

Option 1 : Coral (`edgetpu`, modèle par défaut Frigate) → Intel GPU (`onnx`, modèle **YOLOX**
Apache-2.0 `yolox_s`, bundlé dans l'image Vyzio) → CPU seul (détecteur natif `cpu`, `MobileDet`).
`IFrigateDetectorPlanner` (Infrastructure) résout la décision (kind + FPS) une fois par génération de
config ; `FrigateConfigApplier` et `GetSystemStatsUseCase` la consomment tous les deux, jamais
recalculée indépendamment.

## Conséquences

- `FrigateDetectorKind` (Core/Entities, `EdgeTpu`/`Openvino`/`Cpu`) reste un enum — cohérent avec la
  règle de comparaisons type-safe (`src/vyzio/CLAUDE.md`) : aucune chaîne littérale Frigate n'est
  comparée en dur, elle n'apparaît qu'à la sérialisation YAML. Le nom `Openvino` désigne le palier
  matériel (Intel GPU/iGPU détecté), pas le détecteur Frigate littéral — celui-ci est `onnx` pour ce
  palier ; `Cpu` reste sur le détecteur natif `cpu`.
- Le FPS CPU est calculé ainsi : `clamp(floor(nb_coeurs * FpsParCoeur / nb_cameras_actives), FpsMin,
  FpsMax)` — budget proportionnel aux cœurs disponibles (`IHardwareAccelerationDetector.CpuCoreCount`,
  testable indépendamment de la machine d'exécution), réparti entre caméras actives. Paramètres dans
  `VyzioRuntimeSettings.Frigate` (défauts 1, 5, 1.0), clamp toujours appliqué. Pour Coral/Intel GPU, le
  FPS reste fixe (5) — l'accélération dédiée absorbe la charge.
- `model.path` ne doit jamais être omis pour un détecteur `onnx`/`openvino` : Frigate 0.17.1 plante au
  démarrage sinon (`TypeError: stat: path should be string... not NoneType`), aucun défaut implicite
  fonctionnel malgré ce que la doc laisse entendre.
- `IFrigateModelAssetInstaller` (Infrastructure) copie `yolox_s.onnx` depuis `/app/models` (bundlé dans
  l'image `vyzio-api`, téléchargé au build — Dockerfile) vers `vyzio-config/model_cache/` (volume
  partagé avec `frigate`) — seulement si absent, pas à chaque génération de config, et uniquement pour
  le palier Intel GPU. `frigate` (privilégié, tourne en root) partage ce volume avec `vyzio-api`
  (non-root) : le dossier et le fichier installés sont rendus explicitement accessibles en écriture aux
  deux (`File.SetUnixFileMode`), sans quoi une création antérieure par l'un bloque l'autre.
- La détection matérielle ne sonde que des chemins connus du système de fichiers (aucune dépendance à
  `nvidia-smi`/`lsusb`) : un hôte qui ne les expose pas (dev Windows, CI) retombe sur CPU —
  déterministe et testable sans matériel réel.
- Limitations connues, assumées : Coral USB non détecté (seul le PCIe l'est) ; Nvidia/AMD retombent sur
  CPU faute de variant d'image adapté (cf. Option 6 écartée) ; le choix de `yolox_s` pour le palier
  Intel GPU est une estimation raisonnable, non benchmarkée exhaustivement sur du matériel varié — à
  ajuster si le terrain le justifie.
- `vyzio-api` et `frigate` ont besoin d'accès à `/dev/dri`/`/dev/apex_0` pour détecter puis exploiter le
  matériel : `privileged: true` + bind mount `/dev:/dev` (lecture seule côté `vyzio-api`,
  lecture-écriture côté `frigate`) plutôt que des `devices:` explicites, qui feraient échouer le
  démarrage sur un hôte sans iGPU/Coral. `/dev:/dev` sur `frigate` écrase aussi `/dev/shm` (mémoire
  partagée inter-process) avec celui de l'hôte — remonté explicitement en tmpfs
  (`tmpfs: - /dev/shm:size=512m`) pour conserver un dimensionnement dédié, sans quoi Frigate ne démarre
  plus (crash silencieux, seulement des 502 côté proxy).
- Le Hub affiche le palier détecté et le FPS cible dans le panneau système existant
  (`SystemMonitorPanel`, champ `Detection` de `/api/system/stats`) à titre informatif — pas une pastille
  de statut (Design System : pastille = état, rien à cliquer ici). Motivation directe : Frigate
  lui-même n'expose pas cette info, l'utilisateur n'avait aucun moyen de savoir quel matériel est
  réellement utilisé.
