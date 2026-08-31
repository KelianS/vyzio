# ADR-38 — Modèle de flux caméra : un flux = une qualité, rôles `detect` / `record` séparés

> Statut : Accepté

## Contexte

`Camera.StreamPath` est une chaîne unique : une caméra a exactement un flux. Frigate en tire une seule
entrée `ffmpeg.inputs`, à laquelle il adjoint lui-même le rôle `record` — vérifié dans la configuration
résolue, les deux caméras de l'instance de dev tournent en `"roles": ["record", "detect"]`.

Ce modèle bloque trois sujets à la fois :

- **La performance.** L'[investigation](../investigations/frigate-cpu-profiling.md) mesure un sous-flux
  ICSee à 640×360 qui décode **6,4× moins cher** que le flux principal 2304×1296, et montre que
  `detect.width/height`, jamais émis par Vyzio, laisse Frigate appliquer son défaut 1280×720 — au point
  d'**agrandir** une source 640×480, dépensant du CPU pour fabriquer des pixels interpolés et donner au
  modèle une image floue.
- **Le débit d'images caméra** ([ADR-36](0036-frame-rate-aligned-on-the-camera-the-streamconfig-capability.md)),
  explicitement conditionné à cette séparation : tant qu'un même flux porte les deux rôles, abaisser son
  débit dégraderait les enregistrements.
- **Les caméras à plusieurs objectifs** (issue [#18](https://github.com/KelianS/vyzio/issues/18)), qui
  exposent plusieurs flux RTSP simultanés depuis un seul boîtier.

Une contrainte, vérifiée dans les sources de Frigate 0.17.1, gouverne la décision : **la reconnaissance
faciale, les snapshots d'événement, les vignettes et le live lisent tous la trame de détection.**
`embeddings/maintainer.py` récupère la trame via `frame_manager.get(frame_name, camera_config.frame_shape_yuv)`
— c'est la trame `detect` — et le live Vyzio interroge `api/{camera}/latest.jpg`, servie depuis la même
trame (ADR-16). Or `face_recognition.min_area` vaut 750 px² par défaut, soit un visage d'environ 27×27 px.
Basculer la détection sur un sous-flux 640×360 ferait passer la plupart des visages sous ce seuil et
arrêterait silencieusement la reconnaissance faciale, qui est une promesse produit centrale (ADR-03).

**Le sous-flux n'est donc pas un gain gratuit : c'est un arbitrage entre fluidité et reconnaissance.**

## Options comparées

### Sur la représentation d'un boîtier à plusieurs objectifs

1. **Un objectif = une `Camera` Vyzio ; un flux = une qualité.** Sous une caméra, tous les flux
   décrivent la même scène et ne diffèrent que par leur qualité. Un boîtier à trois objectifs produit
   trois caméras Vyzio groupées par un identifiant d'appareil. Chacune dispose sans rien changer de ses
   labels, de sa sensibilité, de son PTZ, de sa vignette et de ses clips.
2. **Une `Camera` portant N canaux × M qualités.** Plus fidèle au matériel, mais l'axe « canal »
   contamine tout : labels de détection, sensibilité de mouvement, mode vie privée, PTZ, positions,
   vignette du Hub, clips et live devraient tous passer de la caméra au canal. Écarté : coût transverse
   majeur, aucun gain de performance, et une refonte du Hub pour un cas matériel minoritaire.
3. **Traiter les flux uniformément sans distinguer qualité et objectif.** Écarté : deux flux de la même
   scène se composent en **une** caméra Frigate (rôles `detect` + `record`), deux flux de scènes
   différentes doivent en donner **deux**. Sans cette distinction, la génération de configuration devient
   ambiguë — on enregistrerait une scène en détectant sur une autre.

### Sur le choix du flux de détection

4. **Choix explicite de l'utilisateur, avec la résolution de chaque flux et une explication de
   l'arbitrage.** Le compromis fluidité / reconnaissance des visages dépend de la scène (distance des
   visages, cadrage) et de l'usage attendu de la caméra — deux choses que Vyzio n'observe pas.
5. **Décision automatique** (flux principal dès que le label `person` est suivi, sous-flux sinon).
   Écarté : la règle serait fausse dans les deux sens — une caméra de jardin suit `person` sans qu'on
   attende d'y reconnaître qui que ce soit, et une caméra de couloir gagnerait à rester en principal.
   Un choix automatique invisible qui désactive silencieusement la reconnaissance faciale contredit le
   principe d'explicabilité (#4).
6. **Sous-flux systématique dès qu'il existe.** Écarté : dégrade la reconnaissance faciale sans
   contrepartie visible, pour un gain mesuré à environ −11 % d'un cœur sur 119 %.
7. **Flux principal systématique** (se limiter à aligner `detect.width/height`). Écarté : abandonne un
   gain réel et proportionnel au nombre de caméras alors qu'il est sans danger sur les caméras où la
   reconnaissance faciale n'est pas attendue.

## Décision

**Options 1 et 4.**

`CameraStream` devient le foyer unique des points d'accès vidéo d'une caméra : une ligne par flux, avec
son **rang**, son chemin et ses caractéristiques relevées (résolution, débit). `Camera.StreamPath`
disparaît — le chemin du flux de rang 0 est une ligne de cette table comme les autres. La frontière API
continue d'exposer `streamPath` pour ce flux, afin que l'onboarding reste inchangé.

**Les flux sont rangés, pas étiquetés.** Le rang 0 est le plus défini ; chaque rang suivant est plus
léger. Un palier nommé (« principal » / « secondaire ») aurait été une invention de Vyzio par-dessus
un tri par nombre de pixels, et surtout un modèle à deux valeurs : une caméra exposant trois flux en
aurait silencieusement perdu un. L'interface n'affiche donc pas de palier mais **la donnée réelle** —
résolution et débit relevés sur la caméra. Le rang ne remonte en surface que lorsque le protocole
liste ses flux sans les mesurer (DVRIP), et sert alors de repli assumé.

L'énumération s'appuie sur ONVIF `GetProfiles` + `GetStreamUri`, déjà parlé par
[`OnvifClient`](../../src/vyzio/Vyzio.Infrastructure/VendorAdapters/OnvifClient.cs). **Le `SourceToken`
d'un profil porte la distinction objectif / qualité** : les profils qui le partagent sont des qualités
d'une même scène, ceux qui en ont un différent sont des objectifs distincts. C'est la sémantique ONVIF
elle-même, pas une heuristique Vyzio.

Pour DVRIP, l'énumération interroge `Simplify.Encode` via le `DvripClient` partagé
([ADR-29](0029-dvrip-a-shared-dvripclient-image-settings-and-ptz-move-stop.md)) : la réponse décrit `MainFormat` et
`ExtraFormat`, et `ExtraFormat.VideoEnable` **atteste que le sous-flux existe et est actif** avant que
Vyzio ne le propose. Le chemin correspondant suit la convention `?channel=0&subtype=1` vérifiée sur le
terrain. Aucun flux n'est donc proposé sur simple convention, conformément à la règle de vérification
avant proposition (SPECS §2.3).

Le flux de détection est **choisi par l'utilisateur**, par caméra, parmi les flux énumérés — présentés
avec leur résolution et une explication de ce que le choix change.

**Le flux le plus léger est le défaut quand il en existe plusieurs.** Frigate redimensionne de toute
façon l'image de détection à sa propre taille (1280×720 par défaut) : analyser un flux 3 MP ou 4K paie
un décodage lourd pour une image aussitôt réduite. Le défaut suit donc l'usage attendu — surveiller — et non le cas
particulier de la reconnaissance faciale à distance, qui reste accessible en un clic et dont le coût
est explicité dans l'interface. Le flux principal reste le repli lorsqu'aucun sous-flux n'existe.

`detect.width/height` est émis à la résolution réelle du flux retenu quand elle est connue, et jamais
au-dessus : Vyzio cesse d'agrandir une source plus petite que 1280×720.

## Conséquences

- **ADR-36 est débloqué.** Dès que les rôles `detect` et `record` portent sur deux flux distincts,
  écrire le débit d'images sur le flux de détection ne touche plus aux enregistrements. La mise en
  œuvre de la capacité `StreamConfig` reste un item de backlog à part entière.
- **L'issue #18 se réduit à de l'onboarding.** Un boîtier multi-objectifs devient N caméras à créer et
  à grouper ; aucune notion de canal n'entre dans le modèle de flux.
- **Le mode vie privée matériel reste câblé à l'appareil, pas à l'objectif.** Couper une caméra d'un
  boîtier multi-objectifs coupe ses sœurs. L'identifiant d'appareil existe pour que ce fait soit
  affichable ; le comportement lui-même relève d'ADR-20 et n'est pas modifié ici.
- **La qualité du live et des snapshots suit le flux de détection.** Un utilisateur qui choisit le
  sous-flux verra une vignette et des snapshots de notification plus grossiers. C'est la conséquence
  directe de son choix, et c'est pourquoi ce choix est explicite plutôt que déduit.
- **Une caméra sans énumération exploitable garde un flux unique** portant les deux rôles, exactement
  comme aujourd'hui. Aucune caméra ne devient inopérante faute de savoir décrire ses flux : l'absence
  d'information ramène au comportement actuel, jamais à une erreur.
- **Seule une résolution exacte est enregistrée.** ONVIF renvoie des pixels (`Resolution/Width`,
  `Resolution/Height`) ; DVRIP renvoie un **libellé nominal** (`"3M"`, `"D1"`) qui ne correspond pas aux
  dimensions réelles — mesuré sur le terrain, un `ExtraFormat` annoncé `"D1"` (nominalement 720×576)
  produit un flux 640×360. Émettre ces libellés reviendrait à réintroduire l'agrandissement que cet ADR
  supprime, et les afficher tels quels contredirait le principe #1. Les flux DVRIP sont donc énumérés et
  choisissables, mais sans résolution affichée ni `detect.width/height`.
- **Une résolution n'est retenue que si elle décrit l'adresse réellement utilisée.** Les constructeurs
  aliasent leurs flux : une caméra qui répond sur `/stream1` annonce en ONVIF `/live/ch00_1` (1920×1080)
  et `/live/ch00_0` (640×480) — constaté sur le terrain. Le chemin du flux principal reste celui que
  l'utilisateur a saisi et vérifié ; sa taille annoncée n'est adoptée que lorsque les deux adresses
  coïncident. Sinon elle est écartée, et Frigate retombe sur son défaut. Prêter à un flux la taille
  d'un autre réintroduirait exactement l'agrandissement que cet ADR supprime. Le sous-flux, lui,
  arrive comme un couple adresse/taille cohérent et garde les deux.
- **Limite connue : un flux de taille inconnue peut être agrandi.** Sans `detect.width/height`, Frigate
  sonde lui-même le flux (`need_detect_dimensions` → ffprobe) et ne retombe sur son défaut 1280×720 que
  si la sonde échoue — ce qui arrive souvent au chargement de la configuration, et systématiquement sur
  une caméra sur batterie endormie. Un sous-flux DVRIP 640×360 est alors analysé en 1280×720, soit
  l'agrandissement que cet ADR supprime ailleurs. Le défaut reste néanmoins le flux le plus léger : le
  gain de décodage mesuré (×6,4) est acquis et concerne précisément les caméras les plus coûteuses, là
  où la perte est une image interpolée pour le modèle. Résolution durable renvoyée au backlog : mesurer
  la taille depuis Vyzio plutôt que la lire dans une déclaration de protocole.
- Ni `ffprobe` ni go2rtc ne comblent ce trou : le conteneur `vyzio-api` n'embarque pas ffmpeg, et
  l'API go2rtc ne rapporte pas les dimensions d'un flux DVRIP (vérifié — son objet `codec` se limite au
  nom du codec). Les obtenir supposerait de décoder le SPS du flux, hors de proportion avec l'enjeu.
