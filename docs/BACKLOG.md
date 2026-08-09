# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans [`WORKFLOW.md`](./WORKFLOW.md).

---

## Role de ce document

Ce backlog a deux zones distinctes, a ne pas melanger :

- **Idées** : capture brute, sans friction. Une idée qui vient a l'esprit se note ici en une ligne, sans avoir a choisir une categorie, une priorite ou a rediger un contexte complet. Rien n'engage a l'implementer.
- **Backlog d'exécution** : direction deja decidee, alignee avec les SPECS et le SAD. Tant que ces documents ne sont pas alignes sur un sujet, l'item reste en Idées — le backlog d'execution ne sert pas a brainstormer la strategie.

Promotion d'une idée vers l'execution : une fois la direction tranchee (et les SPECS/SAD mis a jour si necessaire), on deplace la ligne d'Idées vers la section thematique concernee de l'execution, en la detaillant.

Item traite : une fois qu'un item d'execution devient une issue GitHub, on le retire de ce fichier pour que le backlog reste court.

---

## 💡 Idées

> Zone de capture libre. Un ajout = une ligne. Pas de tri, pas de priorite, pas de contexte obligatoire.

- Mesurer soi-meme la resolution reelle d'un flux, plutot que de dependre de ce que le protocole declare. Aujourd'hui seul ONVIF donne des pixels exacts ; DVRIP annonce des libelles nominaux faux ([ADR-38](adr/0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md)), et Frigate ne comble le trou qu'au prix d'une sonde ffprobe qui echoue souvent au chargement de la config — constate sur les deux cameras de dev, et sur une camera sur batterie endormie c'est systematique. Consequence : le flux d'analyse peut etre **agrandi** vers le 1280x720 par defaut de Frigate, exactement le gaspillage que la separation des flux supprime ailleurs. Pistes : embarquer `ffprobe` dans l'image de l'API (absent aujourd'hui), ou lire les dimensions dans le SPS annonce par le SDP RTSP. Debloquerait aussi l'affichage de la resolution pour tous les protocoles dans le choix du flux d'analyse.
- Faire disparaitre le champ libre « chemin de flux » du parcours d'ajout : depuis [ADR-38](adr/0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md), Vyzio sait demander a la camera ou sont ses flux (ONVIF `GetStreamUri`, DVRIP), donc faire saisir l'adresse a la main est devenu incoherent. Pre-remplir depuis l'enumeration, et ne reveler le champ que derriere une porte de secours (« ma camera n'a pas ete reconnue ») pour les cameras purement RTSP que rien ne sait enumerer — SPECS §2.3 interdit un parcours bloquant par principe. Proposer aussi l'adoption de l'adresse annoncee sur une camera existante quand elle differe de celle saisie (cas constate : une camera repond sur `/stream1` en 640x480 alors qu'elle annonce un flux 1080p).
- Generaliser l'heritage installation/camera ([ADR-39](adr/0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md)) a **tous les reglages de camera ou cela a du sens et est techniquement possible** — aujourd'hui seules les trois durees de retention le portent. La grammaire des reglages ([ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)) en est le prerequis : provenance et retour arriere etant des parties de la ligne, l'extension ne coute plus qu'une propriete par reglage au lieu d'un ecran a redessiner. A decouper reglage par reglage plutot qu'en une passe.
- Rendre `AssistedCameraDiscoveryServiceTests` hermetique : ces tests sondent reellement `127.0.0.1` et echouent des que la stack de dev ecoute sur des ports supplementaires (constate sur `main`, hors de tout changement de code). Injecter le sondage plutot que taper le reseau.
- Verification des credentials contre les protocoles supportes (ONVIF, DVRIP, RTSP) avant de les stocker dans la DB. Eviter de stocker des credentials invalides ou d'attendre sur Frigate pour detecter un flux invalide. Configurer pendant l'onboarding les capacités de la caméra (PTZ, multi-flux, etc.) et vérifier que les credentials fournis permettent d'accéder à ces fonctionnalités.
- Améliorer le 'live' avec un vrai flux vidéo, pas uniquement un pulling a 1fps + latence.
- Rendre chaque détéction plus configurable en mode avancée, par exemple les min_threshold, min_score etc, par label. Et reprendre le systèle + override par caméra.
- Nettoyage des migrations de DB : app pas encore publique, donc pas de risque de casser des installations existantes. Supprimer les migrations inutiles, fusionner les migrations redondantes, renommer les tables et colonnes pour qu'elles soient plus claires.
- Réglages image Tapo KLAP — investigation terrain nécessaire avant implémentation (protocole binaire propriétaire, pas de doc publique). ONVIF et DVRIP déjà livrés, voir [ADR-27](adr/0027-reglages-image-avances-capacite-imagesettings-onvif.md)/[ADR-29](adr/0029-dvrip-dvripclient-partage-reglages-image-avenc.md).
- Notifications d'événements système (caméra offline, batterie faible, boot Vyzio, mise à jour) — configurable par caméra et par type.
- Canal Discord pour les notifications (webhook).
- Canal WhatsApp pour notifications et commandes rapides (API Cloud Meta ou Baileys/WWebJS).
- Commandes chatbot (Discord ou autre) pour actions rapides : activer/désactiver le mode vie privée, statut des caméras, snapshot — bidirectionnel avec le canal de notifications.
- Accès à Vyzio depuis l'extérieur — pistes à comparer : tunnel réseau (Netbird), commandes via chatbot, relais SaaS façon app constructeur.
- Intégration Home Assistant (capteurs d'ouverture, détection de mouvement, présence, scénarios d'automatisation).
- Tests end-to-end Playwright pour chaque user story des SPECS.
- Distinguer détection de présence (« person ») et reconnaissance faciale (identification) — aujourd'hui les deux sont couplées sans option pour les découpler : `FrigateConfigApplier` active `face_recognition` globalement dès qu'une caméra est activée, et toute caméra qui suit le label `person` se voit automatiquement ajouter `face` (voir commentaire « face must be tracked whenever person is »). Une caméra qui ne veut que savoir « quelqu'un est présent » paie donc quand même le coût du pipeline d'identification faciale (embeddings, un process séparé de la détection d'objets). À investiguer : impact réel sur les perfs d'inférence, et si un découplage par caméra (suivre `person` sans `face`) est pertinent.
- Support Nvidia (tensorrt) et AMD (rocm) pour le détecteur Frigate — nécessite de recréer le conteneur sur le variant d'image adapté (`-tensorrt`/`-rocm`), pas seulement de changer `config.yml` ; écarté de [ADR-34](adr/0034-adaptation-materielle-automatique-du-detecteur-frigate.md) faute de besoin terrain confirmé. Coral USB (en plus du PCIe déjà supporté) également hors scope actuel.
- Benchmarker `yolox_s` (retenu pour le palier Intel GPU dans [ADR-34](adr/0034-adaptation-materielle-automatique-du-detecteur-frigate.md)) sur du matériel varié et évaluer une variante plus précise (`yolox_m`/`l`) si le terrain le justifie — pas de mesure exhaustive à ce stade. Le palier CPU seul reste sur le détecteur natif `cpu` (YOLOX, même la plus petite variante, a produit des pics CPU ~800% et des détections dégradées en test terrain — pas un gain sur ce palier). YOLOv9 écarté (licence GPL-3.0, test exploratoire erratique : voir [investigation](investigations/yolov9_frigate_openvino.md)) ; YOLO-NAS écarté (poids non-commerciaux).
- Le nom d'une camera se regle sous « Connexion », qui n'est pas ce qu'il est — il faudrait une page de plus. Constat de la passe de coherence du chantier `config-ui`, non corrigeable sans trancher le rangement.
- La marche a suivre Telegram est un mode d'emploi affiche dans un ecran de reglages, ce qu'[ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md) renvoie a [`user/`](user/) — mais rien dans l'application ne mene encore a cette documentation. Meme origine que le constat ci-dessus.
- **La reconnaissance faciale n'etiquette rien.** Mesure sur l'instance de developpement le 2026-08-09 : les 203 evenements Frigate ont tous `sub_label: null`. L'identite que Vyzio lit est donc toujours vide, et tout l'historique est « personne inconnue » — les profils, leurs photos et leurs liens caméra n'ont aucun effet observable. A investiguer avant tout travail sur l'identite : bibliotheque de visages vide, `face_recognition` inactif, ou visages jamais assez nets pour le seuil.
- Trier l'historique sur le modèle *review* de Frigate (sévérité `alert` / `detection`, regroupement des objets d'un même passage), que Vyzio ignore aujourd'hui — hors périmètre d'[ADR-49](adr/0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md), qui en pose le constat. Chantier produit distinct : il change ce que l'historique montre, pas d'où il tient sa vérité.
- Enregistrer le codec du flux par caméra (relevé à la vérification de la caméra), ce qui ouvrirait deux choses : choisir `preset-intel-qsv-h264/h265` plutôt que `preset-vaapi` sur Intel gen13+/Arc — écarté d'[ADR-37](adr/0037-decodage-video-materiel-preset-vaapi-quicksync-differe.md) faute de ce prérequis, les presets QuickSync n'existant qu'en variantes codec-spécifiques — et signaler qu'une caméra en H.265 coûte nettement plus cher à décoder qu'en H.264.

---

## 🎯 Backlog d'exécution

Chaque theme a un tag stable (pas d'ordre impose entre thematiques). Un theme termine disparait simplement, sans decaler les autres.

### `detection-pipeline` — Vyzio ne persiste plus les détections

Relevé à l'usage : **une ligne d'historique sur deux pointe vers un média qui n'existe plus.** Les
mesures, les vérifications faites sur l'instance et la décision sont dans
[ADR-49](adr/0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md) :
l'historique devient la liste de Frigate, enrichie à la lecture. La rétention plancher qui la
garantit est
[ADR-48](adr/0048-retention-minimale-d-un-jour-la-conservation-se-regle-elle-ne-s-eteint-pas.md).

Ce chantier **supprime** plus qu'il n'ajoute : `observed_events`, ses drapeaux de média, et le
délai forfaitaire du handler MQTT.

#### Ordre d'exécution

1. **Remonter le port Frigate dans `Core`**, et l'ingestion en use case d'`Application`. Prérequis
   de tout le reste, sans changement de comportement : tant que le port vit dans `Api`, aucun use
   case ne peut interroger Frigate.

2. **Lire l'historique depuis Frigate.** Un use case de lecture : filtres caméra / label / identité /
   période, **pagination au curseur temporel** (`page=` est inerte, mesuré), enrichissement profil et
   nom de caméra à la lecture. L'écran cesse de lire `observed_events`.

3. **Corriger une identité écrit dans Frigate** (`POST /api/events/{id}/sub_label`). Propagation
   asynchrone ~5 s : l'interface affiche la correction sans attendre la relecture. Ferme au passage
   le constat « corriger une identité n'apprend rien ».

4. **Supprimer `observed_events`** et tout ce qui en dépend. La déduplication des notifications
   se réancre sur l'identifiant d'événement Frigate — aujourd'hui `HasSentAsync` reçoit l'identifiant
   de la ligne Vyzio, qui n'existera plus.

5. **L'ingestion ne notifie plus en ligne.** Le handler MQTT rend la main immédiatement ; le délai
   forfaitaire de dix secondes devient une récupération de média avec reprise, portée par la
   récupération elle-même.

6. **Deux images nommées, pas une URL fabriquée deux fois.** La liste télécharge aujourd'hui 123 Ko
   de plan large pour une tuile de 56 px, quand Frigate a déjà écrit l'image recadrée sur l'objet en
   8 Ko (`thumbnail.jpg`, 175x175). Telegram veut l'inverse, le plan large — le contexte est ce qui
   rend la notification utile. Mesuré : `?crop=`/`?height=` sont inertes sur un événement terminé.

7. **Rétention minimale d'un jour**
   ([ADR-48](adr/0048-retention-minimale-d-un-jour-la-conservation-se-regle-elle-ne-s-eteint-pas.md)) :
   plancher au foyer de résolution, `KeepsAnything` et `record.enabled: false` disparaissent,
   l'interface refuse zéro avant la saisie. L'enregistrement continu reste optionnel.

8. **Renommer le réglage** : « conservation des clips d'alerte » devient la **conservation de
   l'historique de détection**, qui est son effet observable. Aligner au passage la rétention des
   aperçus sur celle des clips — supprimer le 30 en dur, qui fabriquait une seconde durée invisible.

9. **Dire ce qui manque, côté écran seulement.** Un média expiré est une conséquence du réglage de
   conservation, pas une panne, et Frigate injoignable n'est pas une expiration : deux causes, deux
   phrases (principe #4). **Rien de cette logique n'atteint le chemin de notification** — une
   notification part quelques secondes après la détection, très loin de toute expiration.

10. **Documenter la profondeur de l'historique** dans [`user/`](user/) : elle vaut désormais la durée
    de conservation, et c'est une promesse tenue là où la précédente était fausse.

---

### `onboarding` — Onboarding & capacités

Itérations courtes, buildables indépendamment. Priorité décroissante.

1. **Étape "Position de surveillance" à l'onboarding PTZ** — si PTZ détecté à l'ajout (détection généralisée à tous protocoles, [ADR-28](adr/0028-detection-de-capacite-en-cascade-multi-protocole-flag.md)), proposer une étape dédiée pour orienter la caméra avant de terminer l'onboarding.

2. **`GET /api/cameras` — capacités vérifiées dans la réponse liste** — intégrer les bindings `Verified = true` dans la réponse pour éviter un second appel au chargement du hub. Actuellement : `Camera.PtzSupported` booléen legacy reste la seule indication côté liste.

3. **Boîtiers à plusieurs objectifs** — voir issue [#18](https://github.com/KelianS/vyzio/issues/18). Le modèle est en place ([ADR-38](adr/0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md) : un objectif = une caméra, groupées par `Camera.DeviceId`) et l'énumération ONVIF distingue déjà les objectifs par leur `SourceToken`. Reste l'onboarding : proposer la création des N caméras d'un même appareil, les nommer, et signaler dans l'UI que couper la vie privée matérielle de l'une coupe ses sœurs.

---

### `detection-perf` — Performance du moteur de détection

Mesures de référence et hiérarchie des leviers :
[investigation](investigations/frigate-cpu-profiling.md).

1. **Capacité `StreamConfig`** ([ADR-36](adr/0036-alignement-du-debit-d-images-camera-capacite-streamconfig.md)) — détection/vérification de la capacité, écriture du débit d'images sur le flux de détection, mémorisation de la valeur d'origine pour restauration. Débloqué : la séparation des rôles `detect`/`record` est livrée ([ADR-38](adr/0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md)), l'écriture ne peut donc plus dégrader les enregistrements. L'énumération relève déjà le débit par flux (`CameraStream.Fps`), il reste à l'écrire.

---

### `recording` — Rétention d'enregistrement

Les trois durees de retention sont livrees ([ADR-39](adr/0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md)), globales et surchargeables par camera.

1. **Alerte de capacite disque critique** — exigee par SPECS §6.2, et rendue necessaire par la livraison ci-dessus : la retention consomme desormais reellement du disque, la ou elle ne conservait presque rien. Reste a cadrer : seuil de declenchement, canal d'alerte, et surtout comportement quand le disque sature — arreter d'enregistrer, ou raccourcir la retention de soi-meme (ce qui supprimerait des enregistrements que l'utilisateur croyait garder). Contrainte : [ADR-48](adr/0048-retention-minimale-d-un-jour-la-conservation-se-regle-elle-ne-s-eteint-pas.md) ferme la porte a « ne plus rien enregistrer » comme reponse a la saturation.

---

### `battery-wake` — Réveil caméras DVRIP sur batterie

Investigation close. Direction retenue : WoL + inspection de paquet.

- TCP knock, UDP DVRIP 0x0590, WS-Discovery et WoL magic packet échoués (aucun port ouvert en veille). Le chipset WiFi répond aux pings ICMP (~510ms) au niveau NIC sans réveiller le processeur. Le mécanisme de réveil est un WoWLAN pattern filter dans le NIC, déclenché par l'app ICSee via son canal cloud. **À faire** : capturer le trafic ICSee lors d'un réveil pour identifier le pattern UDP/broadcast, puis l'implémenter. Confirmer par inspection réseau avant de coder.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
