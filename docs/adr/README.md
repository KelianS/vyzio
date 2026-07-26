# Décisions d'architecture (ADR)

Une décision d'architecture = un fichier. Format : Contexte → Options comparées → Décision
→ Conséquences (dont « Options écartées »). Règles de rédaction et cycle de vie :
[`../WORKFLOW.md`](../WORKFLOW.md). Le SAD ([`../SAD.md`](../SAD.md)) pose les frontières et
référence ces ADR sans les recopier.

| ADR | Décision | Statut |
|---|---|---|
| [ADR-01](0001-s-appuyer-sur-frigate-plutot-que-reimplementer-le.md) | S'appuyer sur Frigate plutôt que réimplémenter le pipeline vidéo | Accepté |
| [ADR-02](0002-langage-principal-net-10.md) | Langage principal : .NET 10 | Accepté |
| [ADR-03](0003-reconnaissance-faciale-frigate-retenu-worker-python.md) | Reconnaissance faciale : Frigate retenu, worker Python non retenu | Accepté |
| [ADR-04](0004-communication-frigate-vyzio-mqtt-api-rest-frigate.md) | Communication Frigate → Vyzio : MQTT + API REST Frigate | Accepté |
| [ADR-05](0005-communication-inter-services-vyzio-mqtt-channels.md) | Communication inter-services Vyzio : MQTT + Channels | Accepté |
| [ADR-06](0006-base-de-donnees-sqlite.md) | Base de données : SQLite | Accepté |
| [ADR-07](0007-api-asp-net-core.md) | API : ASP.NET Core | Accepté |
| [ADR-08](0008-dashboard-react-typescript.md) | Dashboard : React + TypeScript | Accepté |
| [ADR-09](0009-notifications-telegram-prioritaire-fcm-canaux.md) | Notifications : Telegram (prioritaire) + FCM + canaux alternatifs | Accepté |
| [ADR-10](0010-authentification-jwt-bcrypt.md) | Authentification : JWT + bcrypt | Accepté |
| [ADR-11](0011-strategie-ux-non-tech-hub-vyzio-simplifie-frigate.md) | Stratégie UX non-tech : Hub Vyzio simplifié + Frigate avancé | Accepté |
| [ADR-12](0012-gestion-des-cameras-pilotee-par-vyzio-appliquee-a.md) | Gestion des caméras pilotée par Vyzio, appliquée à Frigate | Accepté |
| [ADR-13](0013-photos-de-profil-stockage-vyzio-synchronisation-via.md) | Photos de profil : stockage Vyzio + synchronisation via API REST Frigate | Accepté |
| [ADR-14](0014-labels-de-detection-par-camera-colonne-json-sur-camera.md) | Labels de détection par caméra : colonne JSON sur Camera | Accepté |
| [ADR-15](0015-association-profil-camera-table-de-jointure-filtrage.md) | Association profil-caméra : table de jointure + filtrage dans ProfileRulesService | Accepté |
| [ADR-16](0016-acces-au-flux-live-polling-latest-jpg-via-vyzio.md) | Accès au flux live : polling latest.jpg via Vyzio, Frigate non exposé | Accepté |
| [ADR-17](0017-acces-aux-clips-evenementiels-proxy-vyzio-authentifie.md) | Accès aux clips événementiels : proxy Vyzio authentifié en streaming | Accepté |
| [ADR-18](0018-enregistrement-continu-activation-par-camera-dans-la.md) | Enregistrement continu : activation par caméra dans la config Frigate générée | Accepté |
| [ADR-19](0019-protocole-dvrip-xmeye-go2rtc-comme-passerelle-de.md) | Protocole dvrip/XMEye : go2rtc comme passerelle de fallback, transparent pour Frigate | Accepté |
| [ADR-20](0020-privacy-mode-api-constructeur-en-premier-fallback.md) | Privacy Mode : API constructeur en premier, fallback Frigate `enabled: false` + `IVendorCameraAdapter` comme brique partagee | Accepté |
| [ADR-21](0021-ptz-parking-et-adaptateur-onvif-generique-strategie.md) | PTZ Parking et adaptateur ONVIF générique : stratégie multi-couche pour le mode vie privée | Accepté |
| [ADR-22](0022-catalogue-de-capacites-camera-decouplage-marque.md) | Catalogue de capacités caméra : découplage marque/protocole, presets vendor et onboarding manuel | Accepté |
| [ADR-23](0023-surveillance-de-joignabilite-des-cameras-polling-tcp.md) | Surveillance de joignabilité des caméras : polling TCP périodique indépendant de Frigate | Accepté |
| [ADR-24](0024-separation-couche-protocole-couche-fonctionnelle.md) | Séparation couche protocole / couche fonctionnelle : `OnvifClient`, `SupportedProtocol`, `PrivacyStrategy` | Accepté |
| [ADR-25](0025-gestion-des-positions-ptz-presets-natifs-branch-a-vs.md) | Gestion des positions PTZ : presets natifs (Branch A) vs positions Vyzio-managed (Branch B) | Accepté |
| [ADR-26](0026-miniatures-de-positions-ptz-capture-client-triggered.md) | Miniatures de positions PTZ : capture client-triggered, stockage fichier, serving direct | Accepté |
| [ADR-27](0027-reglages-image-avances-capacite-imagesettings-onvif.md) | Réglages image avancés : capacité `ImageSettings`, ONVIF Imaging Service, valeurs non persistées | Accepté |
| [ADR-28](0028-detection-de-capacite-en-cascade-multi-protocole-flag.md) | Détection de capacité en cascade multi-protocole + flag `ManuallyConfigured` | Accepté |
| [ADR-29](0029-dvrip-dvripclient-partage-reglages-image-avenc.md) | DVRIP : `DvripClient` partagé, réglages image (`AVEnc.VideoColor.[0]`), PTZ Move/Stop | Accepté |
| [ADR-30](0030-reglages-image-v380-natif-ecarte-imagesettings-via.md) | Réglages image V380 natif : écarté, `ImageSettings` via ONVIF uniquement | Accepté |
| [ADR-31](0031-override-manuel-du-constructeur-a-l-onboarding.md) | Override manuel du constructeur à l'onboarding | Accepté |
| [ADR-32](0032-pipeline-de-decouverte-reseau-en-3-etapes.md) | Pipeline de découverte réseau en 3 étapes : identification / enrichissement / interprétation | Accepté |
| [ADR-33](0033-statut-du-moteur-de-detection-expose-au-hub.md) | Statut du moteur de détection exposé au Hub : tracker de redémarrage + enrichissement de `/api/system/stats` | Accepté |
| [ADR-34](0034-adaptation-materielle-automatique-du-detecteur-frigate.md) | Adaptation matérielle automatique du détecteur Frigate : Coral → Intel GPU (`onnx` + YOLOX) → CPU (natif, FPS borné) | Accepté |
| [ADR-35](0035-sensibilite-de-detection-auto-adaptative-par-camera.md) | Sensibilité de détection auto-adaptative par caméra : boucle fermée à trois paliers, appliquée à chaud par MQTT | Accepté |
| [ADR-36](0036-alignement-du-debit-d-images-camera-capacite-streamconfig.md) | Alignement du débit d'images sur la caméra : capacité `StreamConfig`, conditionnée à la séparation détection/enregistrement | Accepté |
| [ADR-37](0037-decodage-video-materiel-preset-vaapi-quicksync-differe.md) | Décodage vidéo matériel : `preset-vaapi` retenu, QuickSync différé (faute de codec connu par caméra) | Accepté |
