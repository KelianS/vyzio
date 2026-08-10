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
- Verification des credentials contre les protocoles supportes (ONVIF, DVRIP, RTSP) avant de les stocker dans la DB. Eviter de stocker des credentials invalides ou d'attendre sur Frigate pour detecter un flux invalide. Configurer pendant l'onboarding les capacités de la caméra (PTZ, multi-flux, etc.) et vérifier que les credentials fournis permettent d'accéder à ces fonctionnalités.
- Améliorer le 'live' avec un vrai flux vidéo, pas uniquement un pulling a 1fps + latence.
- Rendre chaque détéction plus configurable en mode avancée, par exemple les min_threshold, min_score etc, par label. Et reprendre le systèle + override par caméra.
- Nettoyage des migrations de DB : app pas encore publique, donc pas de risque de casser des installations existantes. Supprimer les migrations inutiles, fusionner les migrations redondantes, renommer les tables et colonnes pour qu'elles soient plus claires.
- Réglages image Tapo KLAP — investigation terrain nécessaire avant implémentation (protocole binaire propriétaire, pas de doc publique). ONVIF et DVRIP déjà livrés, voir [ADR-27](adr/0027-reglages-image-avances-capacite-imagesettings-onvif.md)/[ADR-29](adr/0029-dvrip-dvripclient-partage-reglages-image-avenc.md).
- Notifications d'événements système (caméra offline, batterie faible, boot Vyzio, mise à jour) — configurable par caméra et par type.
- Canal WhatsApp — **notifications seulement, jamais de commandes** : l'API Cloud de Meta ne délivre les messages entrants que par webhook, et n'expose aucune route de récupération ; un hub sans adresse publique ne peut donc pas les recevoir. Les bibliothèques non officielles (Baileys, WWebJS) tiennent une connexion sortante mais contreviennent aux conditions de Meta et exposent au blocage du numéro — pas une base pour un produit vendu.
- Application Android mince encapsulant le client de réseau overlay et la vue web, pour revenir à un geste unique hors du domicile — horizon évoqué par [ADR-51](adr/0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md), non décidé.
- Relais d'accès distant opéré par Vyzio (modèle Nabu Casa) — meilleure expérience possible, écartée pour l'instant faute de base installée ; à rouvrir quand elle existe ([ADR-51](adr/0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md) option 3).
- Intégration Home Assistant (capteurs d'ouverture, détection de mouvement, présence, scénarios d'automatisation).
- Tests end-to-end Playwright pour chaque user story des SPECS.
- Distinguer détection de présence (« person ») et reconnaissance faciale (identification) — aujourd'hui les deux sont couplées sans option pour les découpler : `FrigateConfigApplier` active `face_recognition` globalement dès qu'une caméra est activée, et toute caméra qui suit le label `person` se voit automatiquement ajouter `face` (voir commentaire « face must be tracked whenever person is »). Une caméra qui ne veut que savoir « quelqu'un est présent » paie donc quand même le coût du pipeline d'identification faciale (embeddings, un process séparé de la détection d'objets). À investiguer : impact réel sur les perfs d'inférence, et si un découplage par caméra (suivre `person` sans `face`) est pertinent.
- Support Nvidia (tensorrt) et AMD (rocm) pour le détecteur Frigate — nécessite de recréer le conteneur sur le variant d'image adapté (`-tensorrt`/`-rocm`), pas seulement de changer `config.yml` ; écarté de [ADR-34](adr/0034-adaptation-materielle-automatique-du-detecteur-frigate.md) faute de besoin terrain confirmé. Coral USB (en plus du PCIe déjà supporté) également hors scope actuel.
- Benchmarker `yolox_s` (retenu pour le palier Intel GPU dans [ADR-34](adr/0034-adaptation-materielle-automatique-du-detecteur-frigate.md)) sur du matériel varié et évaluer une variante plus précise (`yolox_m`/`l`) si le terrain le justifie — pas de mesure exhaustive à ce stade. Le palier CPU seul reste sur le détecteur natif `cpu` (YOLOX, même la plus petite variante, a produit des pics CPU ~800% et des détections dégradées en test terrain — pas un gain sur ce palier). YOLOv9 écarté (licence GPL-3.0, test exploratoire erratique : voir [investigation](investigations/yolov9_frigate_openvino.md)) ; YOLO-NAS écarté (poids non-commerciaux).
- Le nom d'une camera se regle sous « Connexion », qui n'est pas ce qu'il est — il faudrait une page de plus. Constat de la passe de coherence du chantier `config-ui`, non corrigeable sans trancher le rangement.
- La marche a suivre d'un canal de notification est un mode d'emploi affiche dans un ecran de reglages, ce qu'[ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md) renvoie a [`user/`](user/) — mais rien dans l'application ne mene encore a cette documentation. Meme origine que le constat ci-dessus.
- **L'ecran Expert ne peut pas fonctionner depuis un telephone.** Il integre l'UI de Frigate en iframe directement depuis le navigateur ([ADR-11](adr/0011-strategie-ux-non-tech-hub-vyzio-simplifie-frigate.md)), sur `http://<hote>:5000` — mais le conteneur publie ce port sur `127.0.0.1` seulement. Depuis un appareil du reseau local, l'ecran affiche « Frigate inaccessible » sans que rien ne soit en panne. Deux issues : exposer Frigate sur le reseau (port sans authentification, contre « Frigate invisible »), ou le servir en proxy authentifie comme tout le reste. Seul endroit ou le navigateur parle a Frigate sans passer par Vyzio.
- Trier l'historique sur le modèle *review* de Frigate (sévérité `alert` / `detection`, regroupement des objets d'un même passage), que Vyzio ignore aujourd'hui — hors périmètre d'[ADR-49](adr/0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md), qui en pose le constat. Chantier produit distinct : il change ce que l'historique montre, pas d'où il tient sa vérité.
- Enregistrer le codec du flux par caméra (relevé à la vérification de la caméra), ce qui ouvrirait deux choses : choisir `preset-intel-qsv-h264/h265` plutôt que `preset-vaapi` sur Intel gen13+/Arc — écarté d'[ADR-37](adr/0037-decodage-video-materiel-preset-vaapi-quicksync-differe.md) faute de ce prérequis, les presets QuickSync n'existant qu'en variantes codec-spécifiques — et signaler qu'une caméra en H.265 coûte nettement plus cher à décoder qu'en H.264.

---

## 🎯 Backlog d'exécution

Chaque theme a un tag stable (pas d'ordre impose entre thematiques). Un theme termine disparait simplement, sans decaler les autres.

### `onboarding` — Onboarding & capacités

Itérations courtes, buildables indépendamment. Priorité décroissante.

1. **Étape "Position de surveillance" à l'onboarding PTZ** — si PTZ détecté à l'ajout (détection généralisée à tous protocoles, [ADR-28](adr/0028-detection-de-capacite-en-cascade-multi-protocole-flag.md)), proposer une étape dédiée pour orienter la caméra avant de terminer l'onboarding.

2. **`GET /api/cameras` — capacités vérifiées dans la réponse liste** — intégrer les bindings `Verified = true` dans la réponse pour éviter un second appel au chargement du hub. Actuellement : `Camera.PtzSupported` booléen legacy reste la seule indication côté liste.

3. **Boîtiers à plusieurs objectifs** — voir issue [#18](https://github.com/KelianS/vyzio/issues/18). Le modèle est en place ([ADR-38](adr/0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md) : un objectif = une caméra, groupées par `Camera.DeviceId`) et l'énumération ONVIF distingue déjà les objectifs par leur `SourceToken`. Reste l'onboarding : proposer la création des N caméras d'un même appareil, les nommer, et signaler dans l'UI que couper la vie privée matérielle de l'une coupe ses sœurs.

---

### `remote-access` — Usage hors du domicile

Direction tranchée : [ADR-50](adr/0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md)
(commandes), [ADR-52](adr/0052-le-sens-entrant-passe-par-le-bot-natif-du-canal-identifiants-declares-par-sens.md)
(comment le canal reçoit) et [ADR-51](adr/0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md)
(accès réseau) ; attendus produit en [SPECS](SPECS.md) §5.4 et §7.2. Comparaison des solutions et
critères d'arbitrage : [étude](investigations/acces-a-distance.md).

Restent deux étapes, chacune livrable et démontrable seule. **2 ne dépend pas de 1** — mais elle est
bloquée par son propre prérequis, le transport chiffré, et elle n'a d'intérêt qu'après 1, qui la rend
facultative.

#### 1. Rendre le canal bidirectionnel : les commandes

Périmètre produit : [SPECS §5.4](SPECS.md). C'est l'étape qui rend l'étape 2 optionnelle — donc celle
qui compte le plus pour l'usage réel. Elle n'ajoute **aucun comportement métier** : toute commande
s'exécute par un use case déjà livré, le canal entrant n'est qu'un adaptateur d'entrée de plus.

Livré : le registre de commandes et leur journal (1.1), Telegram bout en bout avec appairage
révocable (1.2), le jeu de commandes courant et ses confirmations (1.3), et le canal Discord passé du
webhook au bot (1.4) — le même jeu de commandes tourne sur les deux canaux sans une ligne de code
spécifique. Restent deux itérations.

Une réserve assumée : **l'interruption et la reprise de la surveillance** ne sont pas des commandes,
écartées à l'arbitrage de 1.3 ; à rouvrir si l'usage les réclame.

**1.5 — Ce que l'utilisateur voit.** État de l'appairage et santé de la boucle de récupération dans
les réglages du canal — « le canal n'écoute plus » doit se lire, sinon Vyzio passera pour en panne ;
journal des commandes consultable. *Fait quand* débrancher le réseau se voit dans les réglages.

**1.6 — Doc utilisateur** : ce qu'on peut demander, comment appairer, comment révoquer — rien de tout
cela n'est écrit dans [`user/NOTIFICATION_CHANNELS.md`](user/NOTIFICATION_CHANNELS.md), qui ne parle
que des alertes. Les parcours d'installation y sont recopiés du mode d'emploi affiché dans l'écran du
canal : à trancher, un seul foyer.

**Fait quand** le même jeu de commandes fonctionne sur Telegram et Discord sans code spécifique, et
qu'un message d'un inconnu ne produit rien du tout.

#### 2. Accès distant à l'interface (NetBird)

- **prérequis bloquant — le transport chiffré.** Le produit est servi en clair aujourd'hui
  (SAD §8.1) : chiffrer le trajet jusqu'à la maison pour livrer l'interface en HTTP à l'arrivée
  n'aurait aucun sens, et l'identifiant de session circulerait avec. À livrer avant, pas en parallèle.
- **à vérifier avant de s'engager** : le parcours réel sur Android et iOS en 4G, chez au moins deux
  opérateurs.
- **réglage d'installation** : parcours guidé de création du compte NetBird, saisie de la clé
  d'appairage (chiffrée comme les identifiants caméra), état de la connexion, adresse d'accès à
  copier, retrait sans effet de bord ;
- **le pair est un conteneur que Vyzio démarre lui-même** par le socket Docker déjà monté, dans
  l'espace de noms réseau du conteneur qui sert l'interface — rien d'autre n'y est joignable
  ([ADR-51](adr/0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md)).
  Le mode réseau *host* n'est qu'un repli documenté ;
- **cycle de vie et pannes** : « le pair ne monte pas » doit se lire dans l'interface, sinon
  l'utilisateur conclura que Vyzio est en panne ;
- l'interface dit explicitement que la disponibilité dépend d'un service tiers, pas de Vyzio ;
- doc utilisateur : le parcours complet, compte compris, et comment s'en passer.

**Fait quand** le hub est joignable depuis un téléphone en 4G, que rien d'autre que l'interface ne
l'est, et que retirer la clé rend l'installation purement locale.

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
