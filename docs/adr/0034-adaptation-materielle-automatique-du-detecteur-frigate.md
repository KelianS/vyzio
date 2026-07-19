# ADR-34 — Adaptation matérielle automatique du détecteur Frigate

> Statut : Accepté

## Contexte

`FrigateConfigApplier.BuildDocument` génère aujourd'hui une section `detectors` figée dans
`frigate.yml` : un seul détecteur `cpu1` de type `cpu`, avec une fréquence d'analyse (`detect.fps`)
fixée à 5 pour toutes les caméras, quel que soit le matériel réellement présent sur la machine hôte
et quel que soit le nombre de caméras. Cela contredit le principe produit #5 (plug & play) : un
utilisateur disposant d'un accélérateur dédié (Coral) ou d'une carte graphique doit en bénéficier sans
rien configurer manuellement, et un hôte CPU-only avec plusieurs caméras a besoin d'une fréquence
d'analyse réduite pour ne pas saturer le processeur (SPECS §7.2).

Le choix du détecteur GPU n'est pas qu'une question de champ `type` dans `config.yml` : sur la version
Frigate pinnée (`0.17.1`, [`docker-compose.yml`](../../docker-compose.yml)), Intel (OpenVINO) et Coral
(edgetpu) fonctionnent avec l'image `ghcr.io/blakeblackshear/frigate:0.17.1` déjà déployée, alors que
Nvidia (`tensorrt`) et AMD (`rocm`) exigent de faire tourner un **variant d'image Docker différent**
(`stable-tensorrt` / `stable-rocm`) — donc de recréer le conteneur Frigate, pas seulement de réécrire
sa config et de le redémarrer (`FrigateConfigApplier.ApplyAsync` fait uniquement ce dernier).

## Options comparées

1. **Détection best-effort par sondage de fichiers système (Linux), limitée aux paliers compatibles
   avec l'image Frigate déjà déployée : Coral → Intel GPU → CPU.**
   `IHardwareAccelerationDetector` sonde, dans l'ordre : présence d'un Coral PCIe (`/dev/apex_0`) ;
   sinon présence d'un device DRI (`/dev/dri/renderD128`) dont le vendor PCI
   (`/sys/class/drm/renderD128/device/vendor`) est Intel (`0x8086` → `openvino`) ; sinon CPU. Un GPU
   Nvidia ou AMD détecté (vendor `0x10de`/`0x1002`) retombe sur CPU en v1 plutôt que de générer une
   config qui suppose une image Docker non déployée. `FrigateConfigApplier` traduit le résultat en
   section `detectors` Frigate valide, et — seulement pour le palier CPU — borne `detect.fps` selon le
   nombre de caméras actives entre un minimum et un maximum fixes.
2. Étendre la détection à Nvidia/AMD et recréer le conteneur Frigate sur le variant d'image adapté
   (`-tensorrt`/`-rocm`) au moment de l'apply. Écarté pour cette itération : nécessite de tirer une
   image potentiellement absente localement (tension avec le fonctionnement hors ligne), de gérer
   l'échec de pull/recréation sans casser un système qui fonctionnait, et une bascule d'image bien plus
   risquée qu'un `docker restart` sur une config invalide. Reste une évolution possible, à traiter comme
   projet séparé (backlog Idées) si un besoin terrain Nvidia/AMD se confirme.
3. Configuration manuelle du détecteur par l'utilisateur (champ dans les réglages). Écarté : contredit
   directement le principe plug & play — l'utilisateur ne doit pas avoir à connaître son propre
   matériel ni le vocabulaire Frigate (`edgetpu`, `openvino`, `tensorrt`, `rocm`).
4. Ajustement dynamique et continu du FPS piloté par la charge CPU observée en temps réel (feedback
   loop). Écarté : complexité disproportionnée par rapport au besoin ; un calcul déterministe basé sur
   le nombre de caméras actives, borné min/max, couvre le cas d'usage (éviter la saturation) sans
   introduire d'oscillation ni de dépendance à un monitoring système supplémentaire.

## Décision

Option 1, limitée en v1 aux paliers déployables sans changer l'image Frigate : Coral (edgetpu) → Intel
GPU (openvino) → CPU. `IHardwareAccelerationDetector` (Core/Interfaces, implémentation Infrastructure)
expose une détection synchrone et sans configuration, résolue une fois par génération de config. Le
résultat (`FrigateDetectorKind` — `EdgeTpu`, `Openvino`, `Cpu`) pilote à la fois la section `detectors`
et le calcul du FPS.

## Conséquences

- `FrigateDetectorKind` (Core/Entities) est un enum — cohérent avec la règle de comparaisons
  type-safe (`src/vyzio/CLAUDE.md`) : aucune chaîne littérale Frigate (`"edgetpu"`, `"openvino"`,
  `"cpu"`) n'est comparée en dur, elle n'apparaît qu'au moment de sérialiser le YAML.
- Le FPS CPU est calculé ainsi : `clamp(floor(nb_coeurs * FpsParCoeur / nb_cameras_actives), FpsMin,
  FpsMax)` — le budget FPS total est proportionnel au nombre de cœurs disponibles
  (`Environment.ProcessorCount`, exposé par `IHardwareAccelerationDetector.CpuCoreCount` pour rester
  testable sans dépendre de la machine d'exécution), réparti entre les caméras actives. `FpsMin`,
  `FpsMax` et `FpsParCoeur` sont des paramètres de `VyzioRuntimeSettings.Frigate` (défauts 1, 5 et 1.0)
  mais le clamp s'applique quelle que soit leur valeur — aucune configuration ni combinaison
  cœurs/caméras ne peut produire un FPS hors bornes. `FpsParCoeur` est une estimation grossière, non
  benchmarkée sur du matériel réel — à ajuster si le terrain montre un décalage.
- Pour les paliers Coral/Intel GPU, le FPS reste fixe (valeur actuelle : 5) — l'accélération dédiée
  absorbe la charge, il n'y a pas de motif de le réduire dynamiquement.
- La détection ne sonde que des chemins connus du système de fichiers (aucune dépendance à un outil
  externe type `nvidia-smi` ou `lsusb`) : sur un hôte qui ne les expose pas (dev Windows, CI), la
  détection retombe naturellement sur CPU — comportement déterministe et testable sans matériel réel.
- Limitations connues, assumées pour cette itération : le Coral USB n'est pas détecté (seul le PCIe
  l'est) ; Nvidia et AMD retombent sur CPU malgré la présence d'un GPU, faute de pouvoir changer le
  variant d'image Frigate déployé (cf. Option 2 écartée) — à réévaluer si un besoin terrain se
  confirme.
- Ni `vyzio-api` (où tourne la détection) ni `frigate` (qui exploite le détecteur au runtime) n'ont
  par défaut de visibilité sur `/dev/dri` ou `/dev/apex_0`. Deux mécanismes sont nécessaires ensemble,
  pas un seul : `privileged: true` lève la restriction du device cgroup (sans lui, l'ouverture d'un
  device hors de la liste par défaut est refusée même si le node existe) ; un bind mount complet
  `/dev:/dev` rend les nodes de l'hôte visibles dans le conteneur (le `/dev` d'un conteneur Docker est
  un devtmpfs qui recouvre l'original — `privileged` seul ne garantit pas que `/dev/dri` y apparaisse).
  `/dev:/dev` plutôt qu'un `devices:` par device précis, car Compose refuse de démarrer un conteneur
  dont un device déclaré n'existe pas sur l'hôte (casserait le plug & play sur une machine sans iGPU ni
  Coral) — `/dev` en tant que répertoire existe toujours, donc le bind mount ne peut pas échouer au
  démarrage. `vyzio-api` monte le sien en lecture seule (la détection ne fait que lire/stat) ;
  `frigate` en lecture-écriture (le device est réellement utilisé pour l'inférence). `vyzio-api` monte
  déjà le socket Docker (accès quasi-root implicite), le delta de surface d'attaque du passage en
  `privileged` reste marginal.
