# Décisions d'architecture (ADR)

Une décision d'architecture = un fichier. Format : Contexte → Options comparées → Décision
→ Conséquences (dont « Options écartées »). Règles de rédaction et cycle de vie :
[`../WORKFLOW.md`](../WORKFLOW.md). Le SAD ([`../SAD.md`](../SAD.md)) pose les frontières et
référence ces ADR sans les recopier.

| ADR | Décision | Statut |
|---|---|---|
| [ADR-01](0001-build-on-frigate-rather-than-reimplement-the-video-pipeline.md) | S'appuyer sur Frigate plutôt que réimplémenter le pipeline vidéo | Accepté |
| [ADR-02](0002-primary-language-dotnet-10.md) | Langage principal : .NET 10 | Accepté |
| [ADR-03](0003-face-recognition-frigate-chosen-over-a-python-worker.md) | Reconnaissance faciale : Frigate retenu, worker Python non retenu | Accepté |
| [ADR-04](0004-frigate-to-vyzio-communication-mqtt-and-frigate-rest-api.md) | Communication Frigate → Vyzio : MQTT + API REST Frigate | Accepté |
| [ADR-05](0005-vyzio-inter-service-communication-mqtt-and-channels.md) | Communication inter-services Vyzio : MQTT + Channels | Accepté |
| [ADR-06](0006-database-sqlite.md) | Base de données : SQLite | Accepté |
| [ADR-07](0007-api-asp-net-core.md) | API : ASP.NET Core | Accepté |
| [ADR-08](0008-dashboard-react-and-typescript.md) | Dashboard : React + TypeScript | Accepté |
| [ADR-09](0009-notifications-telegram-first-plus-fcm-and-alternative-channels.md) | Notifications : Telegram (prioritaire) + FCM + canaux alternatifs | Accepté |
| [ADR-10](0010-authentication-jwt-and-bcrypt.md) | Authentification : JWT + bcrypt | Accepté |
| [ADR-11](0011-non-technical-ux-strategy-simplified-vyzio-hub-plus-advanced-frigate.md) | Stratégie UX non-tech : Hub Vyzio simplifié + Frigate avancé | Accepté |
| [ADR-12](0012-camera-management-driven-by-vyzio-applied-to-frigate.md) | Gestion des caméras pilotée par Vyzio, appliquée à Frigate | Accepté |
| [ADR-13](0013-profile-photos-stored-by-vyzio-synced-through-the-frigate-rest-api.md) | Photos de profil : stockage Vyzio + synchronisation via API REST Frigate | Accepté |
| [ADR-14](0014-per-camera-detection-labels-json-column-on-camera.md) | Labels de détection par caméra : colonne JSON sur Camera | Accepté |
| [ADR-15](0015-profile-camera-association-join-table-and-filtering-in-profilerulesservice.md) | Association profil-caméra : table de jointure + filtrage dans ProfileRulesService | Accepté |
| [ADR-16](0016-live-stream-access-polling-latest-jpg-through-vyzio-frigate-never-exposed.md) | Accès au flux live : polling latest.jpg via Vyzio, Frigate non exposé | Accepté |
| [ADR-17](0017-event-clip-access-an-authenticated-streaming-vyzio-proxy.md) | Accès aux clips événementiels : proxy Vyzio authentifié en streaming | Accepté |
| [ADR-18](0018-continuous-recording-enabled-per-camera-in-the-generated-frigate-config.md) | Enregistrement continu : activation par caméra dans la config Frigate générée | Remplacé par ADR-39 (rétention, activation) |
| [ADR-19](0019-dvrip-xmeye-protocol-go2rtc-as-a-fallback-gateway-transparent-to-frigate.md) | Protocole dvrip/XMEye : go2rtc comme passerelle de fallback, transparent pour Frigate | Accepté |
| [ADR-20](0020-privacy-mode-vendor-api-first-frigate-fallback-and-ivendorcameraadapter.md) | Privacy Mode : API constructeur en premier, fallback Frigate `enabled: false` + `IVendorCameraAdapter` comme brique partagee | Accepté |
| [ADR-21](0021-ptz-parking-and-a-generic-onvif-adapter-a-layered-privacy-mode-strategy.md) | PTZ Parking et adaptateur ONVIF générique : stratégie multi-couche pour le mode vie privée | Accepté |
| [ADR-22](0022-camera-capability-catalogue-brand-protocol-decoupling-vendor-presets-manual-onboarding.md) | Catalogue de capacités caméra : découplage marque/protocole, presets vendor et onboarding manuel | Accepté |
| [ADR-23](0023-camera-reachability-monitoring-periodic-tcp-polling-independent-of-frigate.md) | Surveillance de joignabilité des caméras : polling TCP périodique indépendant de Frigate | Accepté |
| [ADR-24](0024-protocol-layer-separated-from-capability-layer-onvifclient-supportedprotocol-privacystrategy.md) | Séparation couche protocole / couche fonctionnelle : `OnvifClient`, `SupportedProtocol`, `PrivacyStrategy` | Accepté |
| [ADR-25](0025-ptz-position-management-native-presets-branch-a-vs-vyzio-managed-positions-branch-b.md) | Gestion des positions PTZ : presets natifs (Branch A) vs positions Vyzio-managed (Branch B) | Accepté |
| [ADR-26](0026-ptz-position-thumbnails-client-triggered-capture-file-storage-direct-serving.md) | Miniatures de positions PTZ : capture client-triggered, stockage fichier, serving direct | Accepté |
| [ADR-27](0027-advanced-image-settings-imagesettings-capability-onvif-imaging-service-values-not-persisted.md) | Réglages image avancés : capacité `ImageSettings`, ONVIF Imaging Service, valeurs non persistées | Accepté |
| [ADR-28](0028-cascading-multi-protocol-capability-detection-and-the-manuallyconfigured-flag.md) | Détection de capacité en cascade multi-protocole + flag `ManuallyConfigured` | Accepté |
| [ADR-29](0029-dvrip-a-shared-dvripclient-image-settings-and-ptz-move-stop.md) | DVRIP : `DvripClient` partagé, réglages image (`AVEnc.VideoColor.[0]`), PTZ Move/Stop | Accepté |
| [ADR-30](0030-native-v380-image-settings-rejected-imagesettings-through-onvif-only.md) | Réglages image V380 natif : écarté, `ImageSettings` via ONVIF uniquement | Accepté |
| [ADR-31](0031-manual-vendor-override-at-onboarding.md) | Override manuel du constructeur à l'onboarding | Accepté |
| [ADR-32](0032-three-stage-network-discovery-pipeline-identification-enrichment-interpretation.md) | Pipeline de découverte réseau en 3 étapes : identification / enrichissement / interprétation | Accepté |
| [ADR-33](0033-detection-engine-status-exposed-on-the-hub.md) | Statut du moteur de détection exposé au Hub : tracker de redémarrage + enrichissement de `/api/system/stats` | Accepté |
| [ADR-34](0034-automatic-hardware-adaptation-of-the-frigate-detector.md) | Adaptation matérielle automatique du détecteur Frigate : Coral → Intel GPU (`onnx` + YOLOX) → CPU (natif, FPS borné) | Accepté |
| [ADR-35](0035-self-adjusting-per-camera-detection-sensitivity.md) | Sensibilité de détection auto-adaptative par caméra : boucle fermée à trois paliers, appliquée à chaud par MQTT | Accepté |
| [ADR-36](0036-frame-rate-aligned-on-the-camera-the-streamconfig-capability.md) | Alignement du débit d'images sur la caméra : capacité `StreamConfig`, conditionnée à la séparation détection/enregistrement | Accepté |
| [ADR-37](0037-hardware-video-decoding-preset-vaapi-chosen-quicksync-deferred.md) | Décodage vidéo matériel : `preset-vaapi` retenu, QuickSync différé (faute de codec connu par caméra) | Accepté |
| [ADR-38](0038-camera-stream-model-one-stream-one-quality-separate-detect-and-record-roles.md) | Modèle de flux caméra : un flux = une qualité, un objectif = une caméra, rôles `detect`/`record` séparés | Accepté |
| [ADR-39](0039-global-settings-overridable-per-camera-applied-to-recording-retention.md) | Réglages globaux surchargeables par caméra, appliqué à la rétention d'enregistrement | Accepté (zéro sur les clips d'événement et l'extinction qui en découlait rétractés par ADR-48) |
| [ADR-40](0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md) | Architecture de l'information : séparer consulter et régler, arborescence de réglages à deux niveaux | Accepté |
| [ADR-41](0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md) | Cycle d'édition des réglages : brouillon explicite, et enregistrer vaut appliquer | Accepté (volet « enregistrer vaut appliquer » remplacé par ADR-44) |
| [ADR-42](0042-interface-component-foundation-shadcn-ui-on-radix-and-tailwind.md) | Socle de composants d'interface : shadcn/ui sur Radix et Tailwind, tokens du design system en source unique | Accepté |
| [ADR-43](0043-settings-grammar-a-setting-is-declared-not-drawn.md) | Grammaire des réglages : un réglage se déclare, il ne se dessine pas | Accepté (renvoi de l'aide longue à `docs/user/` remplacé par ADR-53) |
| [ADR-44](0044-surveillance-restart-an-explicit-user-act-grouped-and-deferred.md) | Redémarrage de la surveillance : un acte explicite de l'utilisateur, groupé et différé | Accepté |
| [ADR-45](0045-ptz-positions-configured-from-the-live-view-never-from-settings.md) | Positions PTZ configurées depuis la vue live, jamais depuis les réglages | Accepté (calibration et geste de création rétractés par ADR-46) |
| [ADR-46](0046-all-ptz-control-in-the-live-view-calibration-included.md) | Tout le pilotage PTZ dans la vue live, calibration comprise | Accepté |
| [ADR-47](0047-detection-history-an-index-reconciled-against-frigate-not-a-standalone-memory.md) | L'historique des détections : un index réconcilié sur Frigate, pas une mémoire autonome | Remplacé par ADR-49 |
| [ADR-48](0048-one-day-minimum-retention-retention-is-tuned-not-turned-off.md) | Rétention minimale d'un jour : la conservation se règle, elle ne s'éteint pas | Accepté |
| [ADR-49](0049-vyzio-does-not-persist-detections-history-is-frigates-list-enriched-on-read.md) | Vyzio ne persiste pas les détections : l'historique est la liste de Frigate, enrichie à la lecture | Accepté |
| [ADR-50](0050-the-messaging-channel-becomes-bidirectional-a-channel-agnostic-command-layer.md) | Le canal de messagerie devient bidirectionnel : une couche de commandes agnostique du canal | Accepté |
| [ADR-51](0051-remote-access-to-the-interface-netbird-overlay-network-operated-by-the-user.md) | Accès distant à l'interface : réseau overlay NetBird, guidé par Vyzio mais opéré par l'utilisateur | Accepté |
| [ADR-52](0052-the-inbound-direction-uses-the-channels-native-bot-credentials-declared-per-direction.md) | Le sens entrant passe par le bot natif du canal : identifiants déclarés par sens | Accepté |
| [ADR-53](0053-user-documentation-lives-in-the-interface-three-levels-of-help.md) | La documentation utilisateur vit dans l'interface : trois niveaux d'aide | Accepté |
| [ADR-54](0054-interface-access-guarded-by-an-owner-account-server-session-in-a-cookie.md) | L'accès à l'interface est gardé par un compte propriétaire, session serveur en cookie | Accepté |
