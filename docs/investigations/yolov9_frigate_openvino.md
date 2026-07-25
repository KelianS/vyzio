# Investigation — YOLOv9 sur détecteur OpenVINO Frigate (juillet 2026)

> Test manuel sur l'instance de dev (CPU only), suite à un constat de reconnaissance médiocre avec le
> modèle par défaut `ssdlite_mobilenet_v2` (ADR-34) : un chat clairement visible détecté comme
> `bird` / `person`.

## Contexte et contrainte de licence

Frigate recommande YOLOv9 plutôt que son détecteur CPU natif ou le modèle SSD par défaut pour de
meilleures perfs/précision (`docs.frigate.video/configuration/object_detectors`). Mais le dépôt
[WongKinYiu/yolov9](https://github.com/WongKinYiu/yolov9) est sous licence **GPL-3.0** — Frigate ne
fournit d'ailleurs jamais de poids pré-exportés, seulement la procédure pour les générer soi-même,
vraisemblablement pour ne pas être distributeur d'un binaire dérivé GPL.

**Décision prise** (voir échange avec l'utilisateur) : Vyzio n'embarque pas ces poids dans son image
distribuée. Ce test est une validation manuelle exploratoire, hors du code Vyzio — rien n'a été commité
lié à YOLOv9.

## Procédure d'export (fonctionne)

Commande documentée par Frigate, testée telle quelle :

```bash
docker build . --build-arg MODEL_SIZE=t --build-arg IMG_SIZE=320 --output . -f- <<'EOF'
FROM python:3.11 AS build
RUN apt-get update && apt-get install --no-install-recommends -y cmake libgl1 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.10.4 /uv /bin/
WORKDIR /yolov9
ADD https://github.com/WongKinYiu/yolov9.git .
RUN uv pip install --system -r requirements.txt
RUN uv pip install --system onnx==1.18.0 onnxruntime onnx-simplifier==0.4.* onnxscript
ARG MODEL_SIZE
ARG IMG_SIZE
ADD https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-${MODEL_SIZE}-converted.pt yolov9-${MODEL_SIZE}.pt
RUN sed -i "s/ckpt = torch.load(attempt_download(w), map_location='cpu')/ckpt = torch.load(attempt_download(w), map_location='cpu', weights_only=False)/g" models/experimental.py
RUN python3 export.py --weights ./yolov9-${MODEL_SIZE}.pt --imgsz ${IMG_SIZE} --simplify --include onnx
FROM scratch
ARG MODEL_SIZE
ARG IMG_SIZE
COPY --from=build /yolov9/yolov9-${MODEL_SIZE}.onnx /yolov9-${MODEL_SIZE}-${IMG_SIZE}.onnx
EOF
```

`MODEL_SIZE` : `t`/`s`/`m`/`c`/`e` (tiny → extra). Seul `t` (tiny) a été testé ici, pas `s` (retenu pour
le palier GPU Intel, cf. échange précédent — pas encore validé empiriquement).

Sortie : `yolov9-t-320.onnx` (7.8 Mo). L'export a émis un avertissement — la conversion vers l'opset
ONNX cible (12) a échoué, fallback conservé à l'**opset 18** :
```
Failed to convert the model to the target version 12 using the ONNX C API. The model was not modified
...
RuntimeError: ... No Adapter To Version $17 for Resize
```
Export marqué comme réussi malgré tout (`ONNX: export success ✅`). Impact potentiel de cet opset non
conforme à la demande initiale : non déterminé (voir Constat plus bas).

## Config Frigate utilisée pour le test

Le labelmap COCO-80 est **déjà présent** dans l'image Frigate stock à `/labelmap/coco-80.txt` — pas
besoin de le fournir.

```yaml
detectors:
  ov:
    type: openvino
    device: CPU
model:
  model_type: yolo-generic
  width: 320
  height: 320
  input_tensor: nchw
  input_pixel_format: bgr
  path: /config/model_cache/yolov9-t-320.onnx
  labelmap_path: /labelmap/coco-80.txt
```

Fichier `.onnx` copié dans le volume `vyzio-config` (déjà partagé avec `frigate`) via
`docker cp ... vyzio-frigate:/config/model_cache/`, `config.yml` édité à la main puis
`docker restart vyzio-frigate`.

## Résultat technique : ça charge et ça infère

Contrairement à une tentative précédente sans bloc `model` explicite (crash immédiat,
`TypeError: stat: path should be string... not NoneType`), cette config démarre sans erreur. Confirmé
via `/api/stats` :

```json
"detectors": {"ov": {"inference_speed": 8.47, "pid": 1073}}
"cpu_usages": {"1073": {"cpu": "104.6", "cmdline": "frigate.detector:ov"}}
```

Détecteur actif, ~8.5 ms/inférence, `detection_fps` non nul sur les deux caméras. `/dev/shm` utilisé
normalement (fix ADR-34 tmpfs tient).

## ⚠️ Constat : qualité de détection erratique, confiance mal calibrée

Retour terrain de l'utilisateur : détections erratiques, et surtout des **scores de confiance proches
de 100 % sur des détections fausses** (pas juste "peu précis" — confiant à tort). C'est un signal plus
inquiétant qu'une simple perte de précision attendue d'un petit modèle "tiny" : un modèle mal calibré
mais correctement branché a normalement une confiance basse sur les cas difficiles, pas une confiance
élevée sur des erreurs franches.

Pistes non vérifiées, à explorer avant toute décision de productionisation :
- **Mismatch d'opset** : l'export a gardé l'opset 18 malgré la demande d'opset 12 (cf. log ci-dessus) —
  possible mauvaise interprétation du graphe par l'import ONNX d'OpenVINO.
- **Post-traitement** : l'export a été fait avec `--include onnx` sans option NMS explicite — à vérifier
  si `yolo-generic` de Frigate suppose un NMS déjà inclus dans le graphe ONNX ou le fait lui-même ; un
  mismatch ici expliquerait des scores non calibrés.
- Seule la variante **tiny (t)** a été testée — la plus petite/rapide, pas celle retenue pour la cible
  prod (iGPU Intel, variante `s`). Pas de conclusion à tirer sur `s` à partir de ce test.

## Conclusion

Le pipeline d'export et le branchement config fonctionnent techniquement (pas de crash, inférence
active). Mais la qualité observée ne permet pas de conclure que YOLOv9 (en tout cas la variante tiny,
exportée ainsi) résout le problème de reconnaissance — au contraire, le symptôme (confiance élevée sur
erreurs) suggère un bug de configuration/export plutôt qu'une simple limite de modèle. **Ne pas
productioniser en l'état.** Prochaine étape si le sujet est repris : vérifier l'opset et le NMS avant de
re-tester, et valider la variante `s` séparément.
