# Investigation — profil CPU de Frigate avec 2 caméras (juillet 2026)

> Mesures prises sur l'instance de dev (hôte WSL 24 cœurs, Frigate 0.17.1, détecteur `cpu`, config
> générée par `FrigateConfigApplier`), suite au constat « l'utilisation CPU est énorme alors que
> Frigate ne fait pas grand-chose ».
>
> Toutes les valeurs `cpu` viennent de `/api/stats` et sont exprimées en **% d'un cœur** (source
> psutil), pas en % de la machine.

## 1. Ce qui tourne réellement

Flux mesurés à la source (`ffprobe` depuis le conteneur Frigate) :

| Caméra | Transport | Codec | Résolution source | FPS source | `detect` appliqué |
| --- | --- | --- | --- | --- | --- |
| `lwip_jardin` | DVRIP → go2rtc → RTSP | HEVC | **2304×1296** (3 MP) | 12 | downscale → 1280×720 @ 5 |
| `v380_salon` | RTSP direct `/stream1` | H264 | **640×480** | 12 | **upscale** → 1280×720 @ 5 |

Deux anomalies visibles dès cette table :

- le jardin décode 3 MP de HEVC en logiciel juste pour produire une image 1280×720 de détection ;
- le salon est **agrandi** 640×480 → 1280×720. C'est du CPU dépensé pour fabriquer des pixels
  interpolés, et le modèle voit une image floue : coût **et** perte de qualité de détection.

`detect.width/height` n'est jamais émis par `FrigateConfigApplier` → Frigate applique son défaut
1280×720 pour toutes les caméras, quelle que soit la source.

## 2. Répartition du CPU

Relevé `/api/stats` (2 caméras, aucun objet suivi, aucune personne dans le champ) :

| Processus | CPU (% d'un cœur) |
| --- | --- |
| `frigate.detector:cpu1` | **96.7** |
| `frigate.process:lwip_jardin` (mouvement + tracking) | 8.0 |
| ffmpeg `lwip_jardin` (décode + segments record) | 7.3 |
| ffmpeg `v380_salon` | 1.9 |
| `frigate.process:v380_salon` | 1.7 |
| embeddings / recording / review / output / go2rtc | ≈ 3 |
| **Total** | **≈ 1,2 cœur** (`frigate.full_system` : 5.1 % de 24 cœurs) |

**80 % du coût est le processus détecteur.** Le décodage vidéo, que l'on soupçonnait en premier, pèse
moins de 10 %.

## 3. Pourquoi le détecteur sature : ce n'est pas la vitesse d'inférence

`inference_speed: 8.87 ms` — le modèle est rapide. Le problème est ailleurs, en deux facteurs qui se
multiplient.

### 3.1 Le nombre d'inférences (×7 par rapport aux images)

| Caméra | `camera_fps` | `detection_fps` | inférences / image |
| --- | --- | --- | --- |
| `lwip_jardin` | 5.1 | **30.8** | **≈ 6** |
| `v380_salon` | 5.1 | 6.2 | ≈ 1.2 |
| Total | 10.2 | **37.0** | |

Frigate ne lance pas une inférence par image : il lance **une inférence par région de mouvement**,
plus une par objet suivi, à chaque image. Le jardin produit ~6 régions par image — feuillage, vent,
variations de lumière — avec les réglages `motion` par défaut (`threshold: 30`, `contour_area: 10`,
`improve_contrast: true`) évalués sur une image 1280×720. Le salon, scène intérieure stable, reste à
~1 région : c'est le comportement normal.

**Une seule caméra extérieure non masquée génère 83 % de la charge d'inférence.**

### 3.2 Le détecteur CPU utilise 3 threads par défaut

37 inférences/s × 8.87 ms = 0,33 s de calcul par seconde, soit ~33 % d'un thread. Le processus en
consomme 96.7 %. L'écart s'explique par `frigate/detectors/plugins/cpu_tfl.py` :

```python
num_threads: int = Field(default=3, title="Number of detection threads")
```

Vérifié à chaud : le processus détecteur porte 5 threads (3 tflite + main + zmq). 33 % × 3 ≈ 99 % —
cohérent au point près. **Chaque inférence mobilise 3 cœurs en parallèle**, et Vyzio ne fixe jamais
`num_threads`.

**Mais baisser `num_threads` ne réduit quasiment pas le CPU total.** Benchmark isolé du même modèle
(`/cpu_model.tflite`, 320×320, 120 inférences après échauffement, entrée aléatoire) :

| `num_threads` | Latence (wall) | Temps CPU | Ratio |
| --- | --- | --- | --- |
| 1 | 23,76 ms | **25,90 ms** | 1,09 |
| 2 | 12,53 ms | 26,87 ms | 2,14 |
| 3 (défaut) | 9,11 ms | 28,84 ms | 3,17 |
| 4 | 7,24 ms | 30,14 ms | 4,17 |

Le multithreading parallélise, il ne crée pas de travail : passer de 3 à 1 thread ne fait économiser
que **10 % de temps CPU** (28,8 → 25,9 ms). En revanche la latence est multipliée par 2,6, et à 37
inférences/s le détecteur passerait de 34 % à **88 % d'occupation** — au bord de la saturation, avec
explosion de `skipped_fps`.

**Conclusion : `num_threads` n'est pas un levier de consommation, c'est un réglage de latence.** Le
défaut 3 est le bon choix ; il n'y a rien à gagner là.

### 3.3 La formule qui résume tout

```
CPU du détecteur ≈ (inférences / s) × ~26 ms de temps CPU
```

Le second terme est une constante matérielle qu'aucun réglage Frigate ne déplace de plus de 10 %.
**Seul le nombre d'inférences est actionnable**, et il ne dépend que du contenu de la scène.

### 3.4 Le pipeline est déjà saturé

Second relevé, quelques minutes plus tard : `lwip_jardin` → `skipped_fps: 1.2`. Des images sont
**abandonnées** faute de pouvoir être traitées. Ce n'est plus une question de confort : la détection
perd déjà de l'information.

## 4. Sous-flux pour la détection : faisable, et mesuré

L'hypothèse « détecter sur le flux basse résolution, enregistrer sur le haute résolution » a été
vérifiée sur le terrain.

**Le sous-flux existe côté ICSee/DVRIP.** Enregistré temporairement dans go2rtc puis sondé :

```
dvrip://…@192.168.1.193:34567/?channel=0&subtype=1  →  HEVC 640×360 @ 12 fps
```

**Gain de décodage mesuré** (20 s de flux, temps CPU utilisateur d'ffmpeg avec la chaîne de filtres
exacte de Frigate) :

| Entrée | Temps CPU | Équivalent |
| --- | --- | --- |
| Principal 2304×1296 HEVC → 1280×720 | 1,156 s | 5,8 % d'un cœur |
| Sous-flux 640×360 HEVC → 640×360 | 0,181 s | 0,9 % d'un cœur |

**×6,4 moins cher**, mais sur un poste qui ne pesait que 5,8 % — le gain direct est réel et linéaire
par caméra, sans être le levier principal.

L'intérêt véritable du sous-flux est **indirect** : il rend légitime de descendre `detect.width/height`
à 640×360, ce qui réduit le travail de redimensionnement et de découpe des régions dans
`frigate.process` (8 %) et divise par 4 les images en `/dev/shm`.

⚠️ **Ne pas en attendre moins d'inférences.** L'analyse de mouvement ne tourne pas sur l'image de
détection pleine résolution : `motion.frame_height` vaut 100 par défaut (vérifié dans la config
résolue), donc Frigate redimensionne d'abord à ~100 px de haut. Le nombre de contours — et donc de
régions, et donc d'inférences — est **quasi indépendant de `detect.width/height`**. Baisser la
résolution de détection réduit le coût de redimensionnement, pas la charge du détecteur. Le seul
levier sur les 6 inférences/image reste le réglage `motion` et les masques (§ 7, levier 5).

L'enregistrement, lui, n'est pas concerné : ffmpeg utilise déjà `-c:v copy` sur le flux principal
(aucun ré-encodage). Séparer les rôles `detect` et `record` ne dégrade donc pas la qualité
d'enregistrement.

Note : `v380_salon` n'a **pas** de sous-flux distinct — `/stream0` et `/stream1` renvoient tous deux
640×480. Pour cette caméra, la bonne action est simplement de ne plus l'agrandir.

## 5. Accélération matérielle : absente

Config résolue : `"hwaccel_args": ""`. Aucun décodage matériel n'est configuré, alors qu'ADR-34 a déjà
mis en place le passthrough `/dev/dri` et détecte l'iGPU Intel. Sur le palier Openvino,
`ffmpeg.hwaccel_args: preset-vaapi` supprimerait quasiment le coût de décodage (~9 % ici, davantage
avec plus de caméras ou de la 4K).

## 6. Verdict

**Frigate n'est pas en cause.** Sur 24 cœurs, 2 caméras coûtent 1,2 cœur, soit ~5 % de la machine.
Ce qui est en cause, c'est que la configuration générée par Vyzio retient les défauts de Frigate sur
tous les axes qui comptent : flux principal pleine résolution pour la détection, résolution de
détection fixe (et parfois supérieure à la source), aucun masque de mouvement, aucune accélération
matérielle, 3 threads de détecteur.

Projection sur la cible (NUC 4 cœurs) : ~30 % en l'état, sans marge pour une 3ᵉ ou 4ᵉ caméra —
d'autant que `skipped_fps` montre que la saturation a déjà commencé.

## 7. Leviers, par rapport gain/effort

Base de comparaison : ≈ 119 % d'un cœur au total, dont 96,7 % pour le détecteur.

| # | Levier | Gain mesuré / estimé | Nature |
| --- | --- | --- | --- |
| 1 | Réduire les inférences parasites (réglages `motion`, masques) | jardin de 6 → ~1,5 inférence/image ⇒ détecteur **96,7 % → ~30 %**, soit **−55 % du total** | scène-dépendant |
| 2 | `hwaccel_args` adapté au matériel | ffmpeg 9,2 % → ~2 % | config générée |
| 3 | Sous-flux en `detect` + `detect.width/height` = résolution source | `frigate.process` 9,7 % → ~4 %, décodage ×6,4 moins cher | modèle de données + config |
| 4 | FPS de la caméra aligné sur `detect.fps` | supprime ~58 % du décodage restant | pilotage caméra |
| ~~5~~ | ~~`num_threads`~~ | **abandonné** — mesuré à −10 % de CPU pour ×2,6 de latence (§ 3.2) | — |

**Tout ce qui n'est pas le levier 1 pèse ensemble ~13 % d'un cœur sur 119 %**, soit environ −11 %.
Utile, déterministe, et proportionnel au nombre de caméras — mais marginal face au levier 1, qui vaut
à lui seul cinq fois les autres réunis.

Le levier 1 est aussi le seul dont le gain dépend de la scène, donc le seul non garanti. C'est la
tension centrale de ce sujet.

## 8. Recommandations officielles et communautaires, confrontées à notre config

Revue de la doc Frigate et des discussions du dépôt (sources § 9). Colonne « état » = ce que fait
Vyzio aujourd'hui, vérifié dans la config résolue.

### Déjà bon — rien à faire

| Recommandation | État |
| --- | --- |
| Désactiver `audio` si inutilisé | ✅ `enabled: false` (global et par caméra) |
| Désactiver `semantic_search` | ✅ `enabled: false` |
| Désactiver `lpr` (plaques) | ✅ `enabled: false` |
| Désactiver la classification (`bird`, custom) | ✅ `enabled: false` |
| `record` en `-c:v copy`, jamais de ré-encodage | ✅ vérifié dans la ligne de commande ffmpeg |
| `detect.fps: 5` (recommandation officielle) | ✅ sur le palier non-CPU ; borné 1–5 sur CPU (ADR-34) |
| Passer par go2rtc pour ne pas multiplier les connexions caméra | ✅ pour DVRIP ; le RTSP direct n'a qu'un consommateur |

### À corriger

| # | Recommandation | État Vyzio | Remarque |
| --- | --- | --- | --- |
| A | `hwaccel_args` — « le décodage vidéo est l'une des tâches les plus coûteuses », « 2–3× plus de caméras à matériel égal » | ❌ `hwaccel_args: ""` | `preset-vaapi` (Intel gen ≤ 12) ou `preset-intel-qsv-h264/h265` (gen 13+, Arc). Le choix dépend de la génération : à détecter, ou exposer un réglage |
| B | **Régler le FPS sur la caméra**, pas dans Frigate : « réduire le débit d'images dans Frigate gaspille du CPU à décoder des images jetées » | ❌ caméras à 12 fps, `detect.fps: 5` | On décode 12 images pour en garder 5 : **~58 % du décodage est jeté**. Vyzio pilote déjà l'ICSee en DVRIP — cadrer le débit côté caméra rejoint le principe produit n° 6 |
| C | Préférer **H.264** au H.265 pour le flux de détection et le live | ⚠️ jardin en HEVC | H.265 décode nettement plus cher en logiciel, et le live navigateur est moins compatible. À arbitrer avec le gain de bande passante |
| D | Éviter les « smart codecs » (H.264+/H.265+) qui suppriment des keyframes | ❓ non vérifié sur ces caméras | Cause classique de « no frames received » |
| E | Intervalle d'i-frame = FPS du flux (GOP 1×) | ❓ non vérifié | Un GOP trop long retarde le démarrage du live et fragilise go2rtc |
| F | Masques de mouvement sur les zones parasites | ❌ aucun masque (`mask: ""`) | **Le seul levier réel sur les 6 inférences/image du jardin** |
| G | Réglages `motion` : `contour_area` 10 = haute sensibilité, 30 = moyenne, 50 = basse ; monter `threshold` jusqu'à ne garder que le mouvement visible ; tenter `improve_contrast: false` si l'équilibre reste introuvable | ❌ tout aux défauts (`10` / `30` / `true`) | Une caméra extérieure avec du feuillage est le cas d'école visé par ces réglages |
| H | Désactiver `birdseye` si l'UI ne s'en sert pas | ❌ `enabled: true` | Vyzio a sa propre vue ; coûte `frigate.output` (1,1 %) + 3 ffmpeg mpeg1video |
| I | Rétention `record` explicite | ❌ `continuous.days: 0`, `motion.days: 0` | Bug fonctionnel distinct, cf. § 10 |

### À connaître, mais non applicable ici

- **« Le détecteur CPU n'est pas recommandé »** — la doc affirme qu'OpenVINO en mode CPU est plus
  efficace que le détecteur `cpu` natif. À nuancer : notre test terrain d'OpenVINO/ONNX + YOLOX sur
  CPU s'est soldé par des pics à 800 % (ADR-34). La doc compare probablement OpenVINO avec un
  **petit** modèle (SSD/MobileNet), pas avec un YOLO. Piste jamais testée : `type: openvino`,
  `device: CPU`, modèle SSD 320×320. À traiter comme une hypothèse, pas comme un acquis.
- **Modèle 320×320 plutôt que 640×640** — « Frigate optimise spécifiquement cette taille ». Notre
  palier Intel utilise `yolox_s` en 640×640 (ADR-34) : à re-questionner si le palier est un jour
  profilé sur du vrai matériel.
- **Plusieurs instances de détecteur** — recommandé quand `skipped_fps > 0` en continu, ce qui est
  notre cas. Mais ça ne s'applique qu'avec du matériel inexploité : ici le détecteur est déjà
  CPU-bound sur 3 threads, en ajouter un second aggraverait la consommation. À écarter.
- `motion.frame_height: 50` (conseil communautaire) — le défaut est déjà à **100** en 0.17, le gain
  résiduel est marginal et se paie en sensibilité.

## 9. Sources

- [Troubleshooting — High CPU Usage](https://docs.frigate.video/troubleshooting/cpu/)
- [Camera setup](https://docs.frigate.video/frigate/camera_setup/)
- [Hardware acceleration (video)](https://docs.frigate.video/configuration/hardware_acceleration_video)
- [Object detectors](https://docs.frigate.video/configuration/object_detectors)
- [Motion detection tuning](https://docs.frigate.video/configuration/motion_detection)
- [Live view](https://docs.frigate.video/configuration/live/) et [Configuring go2rtc](https://docs.frigate.video/guides/configuring_go2rtc/)
- [Discussion #5984 — Detect stream resolution and CPU usage](https://github.com/blakeblackshear/frigate/discussions/5984)
- [Discussion #19278 — Looking for ways to reduce CPU load](https://github.com/blakeblackshear/frigate/discussions/19278)
- [Discussion #2345 — Main stream or sub stream for detection](https://github.com/blakeblackshear/frigate/discussions/2345)

## 10. Effet de bord découvert : l'enregistrement continu ne conserve rien

Hors sujet CPU, mais constaté en vérifiant `record`. `FrigateConfigApplier` n'émet que
`record.enabled: true` ; les défauts 0.17 s'appliquent donc :

```
continuous: { days: 0.0 }     motion: { days: 0.0 }
detections: { retain: { days: 10.0, mode: motion } }
alerts:     { retain: { days: 10.0, mode: motion } }
```

`Camera.ContinuousRecordingEnabled` active le rôle `record` mais **aucune rétention continue** :
seuls les segments rattachés à un évènement survivent. Confirmé sur disque après 8 jours de
fonctionnement — 7 heures conservées, 55 Mo :

```
2026-07-19/20  2026-07-19/21
2026-07-25/17  2026-07-25/18  2026-07-25/19  2026-07-25/21
2026-07-26/11
```

Correctif : émettre une rétention explicite quand `ContinuousRecordingEnabled` est vrai. Le nombre de
jours et le `mode` (`all` vs `motion`) sont un arbitrage produit **et** capacité disque, pas un défaut
technique à trancher seul.

## Limites de cette mesure

Relevés faits sur un hôte de dev 24 cœurs sous WSL, sur deux caméras seulement, hors présence de
personne dans le champ (`face_recognition_speed: 0.0` — le coût de la reconnaissance faciale n'est
donc **pas** représenté ici). Les rapports entre postes sont fiables ; les pourcentages absolus
seront différents sur la cible. Le palier Openvino n'a pas été profilé, faute de matériel Intel
disponible.
