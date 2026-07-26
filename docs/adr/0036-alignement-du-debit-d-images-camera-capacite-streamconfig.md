# ADR-36 — Alignement du débit d'images sur la caméra : capacité `StreamConfig`

> Statut : Accepté

## Contexte

La documentation Frigate est explicite : *« réduire le débit d'images dans Frigate gaspille des
ressources CPU à décoder des images qui sont ensuite jetées »*. Le débit doit être réglé **sur la
caméra**, pas dans la configuration Frigate.

Mesuré sur l'instance de dev ([investigation](../investigations/frigate-cpu-profiling.md)) : les deux
caméras émettent à 12 images/s, `detect.fps` vaut 5. Environ **58 % du décodage est jeté**. Le
décodage n'est pas le poste dominant (≈ 9 % d'un cœur contre 96,7 % pour le détecteur, cf. ADR-35),
mais c'est un gaspillage pur, proportionnel au nombre de caméras, et il croît avec la résolution.

Vyzio pilote déjà ses caméras par leurs protocoles natifs pour le PTZ (ADR-21), le mode vie privée
(ADR-20) et les réglages image (ADR-27, ADR-29). Le principe produit #6 — affranchir l'utilisateur des
applications constructeur en pilotant la caméra directement — s'applique ici de la même manière, à
ceci près que le bénéfice est une performance système plutôt qu'un confort d'usage.

Une contrainte domine la décision : **aujourd'hui un seul flux porte à la fois la détection et
l'enregistrement.** `FrigateConfigApplier` génère une entrée `ffmpeg.inputs` unique avec le rôle
`detect` ; Frigate y adosse l'enregistrement en `-c:v copy`. Abaisser le débit de ce flux à 5 images/s
rendrait donc les enregistrements saccadés — Frigate recommande 15 images/s pour l'enregistrement.
Le gain CPU se paierait en qualité de preuve, ce qui est un mauvais échange pour un produit de
vidéosurveillance.

## Options comparées

1. **Capacité `StreamConfig` vérifiée, écriture conditionnée à la séparation des flux.** Le débit
   d'images devient une capacité au sens du catalogue (SPECS §2.3) : indépendante de la marque, liée à
   un `SupportedProtocol`, vérifiée par un test réel avant d'être proposée — exactement le modèle
   d'`ImageSettings` (ADR-27/28). Vyzio n'écrit le débit que sur le flux qui porte le rôle `detect`,
   et seulement lorsque ce flux est distinct de celui qui porte le rôle `record`.
2. **Écrire le débit sur le flux unique actuel.** Écarté : dégrade les enregistrements, cf. contrainte
   ci-dessus. Le gain (quelques pourcents de CPU) ne justifie pas de rendre la preuve vidéo moins
   exploitable.
3. **Laisser l'utilisateur régler le débit dans l'application constructeur.** Écarté : contredit
   frontalement les principes #1 (public non-technicien), #5 (plug & play) et #6 (contrôle unifié). Un
   utilisateur non technicien ne saura ni que ce réglage existe, ni quelle valeur choisir.
4. **Transcoder le flux dans go2rtc pour réduire le débit avant Frigate.** Écarté : transcoder impose
   de décoder **puis** de réencoder. On paierait plus cher que le décodage qu'on cherche à éviter,
   sauf à disposer d'un encodage matériel — auquel cas autant activer le décodage matériel
   directement. Le proxy déplace le coût, il ne le supprime pas.
5. **Piloter aussi la résolution et le codec** (imposer H.264 plutôt que H.265, qui décode nettement
   plus cher en logiciel). Écarté en v1, mais la capacité est nommée `StreamConfig` et non
   `StreamFps` précisément pour accueillir ces réglages ensuite sans nouvelle capacité. Le codec est
   un sujet plus délicat : il touche la compatibilité du live navigateur et le volume de stockage, et
   mérite sa propre décision.

## Décision

Option 1. Nouvelle valeur `StreamConfig` dans `CameraCapability`, adossée aux protocoles déjà
implémentés (ONVIF via le service Media, DVRIP via le client partagé d'ADR-29). L'écriture est
déclenchée à l'application de configuration, et aligne le débit du flux de détection sur le
`detect.fps` que `IFrigateDetectorPlanner` calcule déjà (ADR-34) — une seule source de vérité pour
cette valeur, jamais recalculée en parallèle.

**L'écriture est inconditionnellement bloquée tant qu'un même flux porte `detect` et `record`.** La
capacité peut être détectée et affichée dans ce cas, mais elle reste sans effet. Sa mise en service
effective dépend de la séparation flux de détection / flux d'enregistrement (backlog, issue
[#18](https://github.com/KelianS/vyzio/issues/18)).

## Conséquences

- `StreamConfig` suit intégralement le modèle de capacité existant : détection en cascade
  multi-protocole et flag `ManuallyConfigured` (ADR-28), preset par constructeur (ADR-22), vérification
  par test réel avant d'être proposée (SPECS §2.3). Aucun mécanisme nouveau n'est introduit — c'est une
  valeur de plus dans un catalogue qui sait déjà les gérer.
- **Vyzio mémorise le débit observé avant sa première écriture**, par caméra, afin de pouvoir le
  restaurer si l'utilisateur désactive la fonction ou retire la caméra. C'est une **dérogation
  assumée** à la règle d'ADR-27 (« la caméra est seule source de vérité, aucune copie locale ») :
  contrairement à la luminosité, que l'utilisateur modifie en connaissance de cause, le débit est écrit
  par Vyzio de sa propre initiative, pour son propre bénéfice. Écraser sans retour possible un réglage
  que l'utilisateur n'a pas demandé à changer serait une régression de confiance.
- L'écriture est **idempotente et non bloquante** : si la caméra est injoignable ou refuse le réglage,
  l'application de configuration se poursuit — le débit caméra est une optimisation, jamais une
  condition de fonctionnement du pipeline vidéo.
- La dépendance à la séparation des flux est structurante : sans elle, cet ADR ne produit aucun gain.
  Les deux sujets doivent être séquencés ensemble dans le backlog, sous peine de livrer une capacité
  visible mais inerte.
- Limite connue : les caméras purement RTSP, sans protocole de contrôle vérifié, ne bénéficient de
  rien. Elles continuent d'émettre à leur débit natif et Frigate continue de jeter le surplus. C'est
  cohérent avec le reste du catalogue de capacités — une caméra donne accès à ce qu'elle sait faire,
  jamais moins, jamais par déclaration.
