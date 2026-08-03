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
- Enregistrer le codec du flux par caméra (relevé à la vérification de la caméra), ce qui ouvrirait deux choses : choisir `preset-intel-qsv-h264/h265` plutôt que `preset-vaapi` sur Intel gen13+/Arc — écarté d'[ADR-37](adr/0037-decodage-video-materiel-preset-vaapi-quicksync-differe.md) faute de ce prérequis, les presets QuickSync n'existant qu'en variantes codec-spécifiques — et signaler qu'une caméra en H.265 coûte nettement plus cher à décoder qu'en H.264.

---

## 🎯 Backlog d'exécution

Chaque theme a un tag stable (pas d'ordre impose entre thematiques). Un theme termine disparait simplement, sans decaler les autres.

### `config-ui` — Socle de configuration : navigation, edition, composants

Direction tranchee et cadrage aligne : [ADR-40](adr/0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md) (architecture de l'information), [ADR-41](adr/0041-cycle-d-edition-des-reglages-brouillon-explicite-enregistrer-vaut-appliquer.md) (cycle d'edition), [ADR-42](adr/0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md) (composants), [ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md) (grammaire des reglages). Constat chiffre et options ecartees : [investigation](investigations/socle-configuration-navigation.md).

Les quatre decisions se livrent ensemble : une arborescence propre remplie de formulaires incoherents, ou des composants impeccables dans une navigation qui n'a pas de place pour eux, ne reglent rien. L'ordre ci-dessous est celui des dependances, pas des preferences.

**Le chantier va jusqu'au bout** : `App.css` est supprime, pas reduit (ADR-42). Il habille les six ecrans, donc le perimetre inclut les ecrans de **consultation** — accueil, historique, profils — au-dela du declencheur. La taille du fichier est l'indicateur d'avancement, sa disparition la condition de fin.

1. **Outillage du socle** — Tailwind et primitives shadcn/ui installes, tokens du [DESIGN SYSTEM](DESIGN%20SYSTEM.md) declares comme theme, dossier de primitives separe des composants Vyzio. Aucune reprise d'ecran a cette etape : la seule sortie attendue est qu'un ecran neuf puisse etre ecrit dans le nouveau socle.

2. **Coquille de navigation** — barre principale reduite a la consultation, arborescence de reglages a deux niveaux, routage porteur de la selection. Les ecrans existants sont branches dessous **tels quels**, sans regression fonctionnelle : c'est ce qui rend la transition incrementale au lieu d'un big-bang.

3. **Grammaire des reglages** ([ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)) — la ligne de reglage et son rendu declaratif : un reglage est decrit (nature, options, unite, portee), le composant en deduit controle, alignement, provenance et retour arriere. C'est le prerequis des etapes 6 et 9 : sans lui, chaque ecran repris redessine ses champs et la derive recommence.

4. **Primitives d'edition** — brouillon de page, barre d'actions a position fixe, annonce de ce qui a change et du cout (interruption de la surveillance), confirmation a la sortie d'une page modifiee. Le retour arriere par champ d'ADR-39 est repris tel quel par-dessus.

5. ~~**Redemarrer la surveillance, sur decision de l'utilisateur**~~ **Fait.** ([ADR-44](adr/0044-redemarrage-de-la-surveillance-acte-explicite-groupe-et-differe.md)) Enregistrer n'interrompt plus rien ; un declencheur d'en-tete redemarre la surveillance, et la question se pose en quittant les reglages. Le marqueur d'attente reste un booleen : nommer la rubrique en attente n'apprenait rien (retracte dans l'ADR), et l'annonce prealable du cout disparait avec la decision. Debloque l'etape 8, dont l'ecran d'ajout etait le seul appelant du declencheur.

6. **Reprise des ecrans de reglages**, en commencant par les reglages d'installation (les plus recents, les moins intriques), puis notifications, puis personnes, puis detection. Chaque ecran repris emporte la suppression de ses regles dans `App.css`. Un ecran n'est repris que quand ses reglages passent par la grammaire (ADR-43) et son nom par la coquille (ADR-40 § « Une page est nommee une seule fois ») — le marqueur `OWN_HEADER_ONLY` de sa route tombe a ce moment-la, et sa disparition est le signal d'avancement de l'etape.

7. ~~**Aplatir la hierarchie a l'interieur d'une page.**~~ **Fait.** La regle est tranchee et vit dans [ADR-40](adr/0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md) § « Une page est nommee une seule fois » : le nom appartient a ce qui mene a la page, jamais a la page. Les pages camera l'appliquent (mode vie privee et plages horaires fusionnes, image et pilotage reunis, capacites rattachees a la connexion), et un test e2e la tient. Reste a l'appliquer aux ecrans repris aux etapes 6 et 10, qui portent encore leur propre titre.

8. ~~**Demontage de `Cameras.Component.tsx`**~~ **Fait.** L'ecran de 800 lignes est remplace par `AddCamera.*`, qui ne porte plus que la tache d'ajout : la fiche camera et ses reglages vivent sous `CameraShell`, et l'union `CameraSelection` est scindee — `AddCameraSelection` ne connait plus la selection d'une camera existante. Les trois etages du pipeline de decouverte ne sont plus des titres d'ecran : les faits techniques sont sous « Avance ». Au passage, `ApplyCamera` et `GetCameraStatus`, devenus sans appelant, sont supprimes jusqu'au port.

9. **Sort de l'interface technique** — elle quitte la barre principale pour la section avancee des reglages systeme.

10. **Reprise des ecrans de consultation** — accueil et historique. Hors declencheur, mais la coherence visuelle et la nouvelle hierarchie de navigation valent pour toute l'application, pas seulement pour les reglages. **Etape de cloture** : c'est elle qui vide le dernier reste d'`App.css`, et donc elle qui termine le chantier.

    Les profils **ne sont pas ici** : ils vivent sous `Reglages > Detection > Personnes` (ADR-40) et se reprennent a l'etape 6, avec les autres ecrans de reglages.

11. **Passe de coherence, une fois tous les ecrans repris** — les etapes 6 a 10 reprennent ecran par ecran, chacun conforme isolement ; ce qu'aucune ne peut voir, c'est ce qui ne se juge qu'en comparant. Perimetre : reglages ranges au meme endroit d'un ecran a l'autre, aides redigees dans le meme registre, memes mots pour les memes choses, et surtout **reglages mal ranges** — un reglage n'est pas force d'etre reste dans la rubrique ou l'ancienne interface l'avait mis. C'est une relecture d'ensemble, pas une reprise : elle produit des corrections ciblees, ou rien.

**Fin de chantier** — les trois conditions, aucune negociable : `App.css` supprime ; aucun ecran hors socle ; aucun reglage hors grammaire ([ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)). Un chantier arrete avant est un chantier qui a ajoute un systeme au lieu d'en remplacer un.

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

1. **Alerte de capacite disque critique** — exigee par SPECS §6.2, et rendue necessaire par la livraison ci-dessus : la retention consomme desormais reellement du disque, la ou elle ne conservait presque rien. Reste a cadrer : seuil de declenchement, canal d'alerte, et surtout comportement quand le disque sature — arreter d'enregistrer, ou raccourcir la retention de soi-meme (ce qui supprimerait des enregistrements que l'utilisateur croyait garder).

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
