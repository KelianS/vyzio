# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### 1.0.0 - P3 - Support protocole dvrip/XMEye comme fallback (cameras sans RTSP)
> But : permettre l'integration de cameras qui n'exposent pas de RTSP natif (tout firmware Xiongmai : ICSee, Annke, Sannce, Zosi, etc.) via go2rtc comme passerelle transparente. **Le RTSP reste le chemin principal** ; dvrip est propose uniquement quand le port 34567 est detecte et que RTSP est absent. Voir [ADR-19](./SAD.md).

**Taches :**
- [x] Ajouter le champ `StreamProtocol` (`"rtsp"` | `"dvrip"`, defaut `"rtsp"`) sur l'entite `Camera` + migration EF Core
- [x] Mettre a jour `FrigateConfigApplier` : generer la section `go2rtc` quand au moins une camera active a `StreamProtocol == "dvrip"`, et pointer l'input ffmpeg vers `rtsp://127.0.0.1:8554/{slug}` pour ces cameras
- [x] Mettre a jour le parcours UI d'ajout de camera : quand le signal `dvrip_port_detected` est present (toute marque), proposer le mode dvrip comme fallback si RTSP indisponible, avec explication contextuelle sur les limitations (batterie, reveil necessaire)
- [x] Tests unitaires sur `FrigateConfigApplier` : generation correcte de la section `go2rtc` pour les cameras dvrip, absence de la section pour les cameras RTSP seules
- [x] Mettre a jour `vendors/icsee.md` : presenter dvrip comme chemin de fallback (apres tentative RTSP)

**Criteres de validation :**
- Une camera avec `dvrip_port_detected` peut etre ajoutee en mode dvrip via le parcours guide
- Une camera RTSP classique n'est pas affectee (pas de section `go2rtc` generee inutilement)
- Le parcours propose toujours RTSP en premier ; dvrip n'apparait que si RTSP echoue ou est absent
- L'utilisateur comprend la contrainte de reveil sans connaitre le protocole dvrip

---

### 1.0.1 - P1 - Privacy mode
> But : permettre à l'utilisateur de couper une caméra temporairement ou de manière récurrente (ex. tous les soirs de 22h à 6h) pour préserver la vie privée, avec un impact minimal sur les autres fonctionnalités (notifications, reconnaissance, etc.) et une indication claire du statut de confidentialité de chaque caméra. La caméra doit réellement être coupée et le flux RTSP ne doit être visible de personne sur le réseau, y compris de Frigate. Voir [ADR-20](./SAD.md).

**Taches :**

*Domaine / Core*
- [x] Ajouter `PrivacyModeActive`, `PrivacyModeSource` (nullable : `"manual"` | `"schedule"`), `PrivacyVendorCut` (bool) sur l'entite `Camera` + migration EF Core
- [x] Creer l'entite `CameraPrivacySchedule` (id, camera_id, enabled, days_of_week JSON, start_time, end_time, created_at) + migration EF Core
- [x] Creer l'interface `IVendorCameraAdapter` dans `Vyzio.Core` : `VendorFamily`, `SupportsPrivacyModeAsync`, `SetPrivacyModeAsync` (stub pour `SupportsSystemInfoAsync` en commentaire)
- [x] Creer `IVendorCameraAdapterFactory` dans `Vyzio.Core` : resout l'adaptateur selon `Camera.VendorFamily`
- [x] Creer l'interface `ICameraPrivacyRepository` dans `Vyzio.Core` (GetActiveSchedules, GetSchedule, SaveSchedule, DeleteSchedule)

*Infrastructure — adaptateurs constructeur*
- [x] `TapoCameraAdapter` : `SetPrivacyModeAsync` via protocole KLAP local (`set_lens_mask`) — active le cache physique + eteint le voyant LED
- [x] `ICSeeXMEyeCameraAdapter` : `SupportsPrivacyModeAsync = false` — pas de commande DVRIP fiable pour couper le capteur ; fallback enregistrement désactivé documenté dans `vendors/icsee.md`
- [x] `V380ProCameraAdapter` : `SupportsPrivacyModeAsync = false` — pas d'API locale connue ; fallback enregistrement désactivé documenté dans `vendors/v380_pro.md`
- [x] `NullVendorCameraAdapter` : fallback pour les marques non reconnues (`SupportsPrivacyModeAsync` retourne `false`)
- [x] `VendorCameraAdapterFactory` : mappe `VendorFamily` → implementation concrete
- [x] Implementer `CameraPrivacyRepository` (EF Core)
- [x] Mettre a jour `FrigateConfigApplier` : injecter `enabled: false` dans la section camera lorsque `PrivacyModeActive == true`
- ~~[ ] `ReolinkCameraAdapter`~~ — marque non dans le catalogue, hors perimetre
- ~~[ ] `HikvisionCameraAdapter`~~ — marque non dans le catalogue, hors perimetre
- ~~[ ] `DahuaCameraAdapter`~~ — marque non dans le catalogue, hors perimetre

*Application — use cases*
- [x] `ToggleCameraPrivacyModeUseCase` : (1) met a jour l'etat en base, (2) appelle l'adaptateur vendor si supporte, (3) toujours regenere la config + reload
- [x] `BatchToggleCameraPrivacyModeUseCase` : applique les etapes 1–2 pour chaque camera de la liste, puis un seul reload
- [x] `CreateCameraPrivacyScheduleUseCase` : validation jours non vides, start_time format valide
- [x] `UpdateCameraPrivacyScheduleUseCase`
- [x] `DeleteCameraPrivacyScheduleUseCase`
- [x] `PrivacySchedulerService` (BackgroundService) : evalue toutes les minutes ; active si entree fenetre et `source != "manual"` ; desactive si sortie fenetre et `source == "schedule"`

*API*
- [x] Endpoints privacy unitaire et batch (toggle, CRUD planifications)
- [x] Etendre la reponse `GET /api/cameras` avec `privacyModeActive`, `privacyModeSource` et `privacyVendorCut`

*Dashboard*
- [x] Badge / icone "vie privee" par camera, avec indication du niveau de garantie (coupure materielle vs enregistrement desactive)
- [x] Vue live d'une camera en mode vie privee : etat explicite au lieu d'une erreur
- [x] Bouton toggle rapide sur la carte camera
- [x] Action globale "Tout couper / Tout reactiver" (batch toggle)
- [x] Ecran de configuration des planifications : jours de la semaine + plage horaire + "appliquer a toutes les cameras"

*Catalogue constructeur*
- [x] `vendors/README.md` : source unique du materiel supporte + guide de contribution (fiche .md + decouverte + adaptateur)
- [x] Fiche `tplink_tapo.md` : section "Mode vie privee" avec niveau de garantie materielle
- [x] Fiche `icsee.md` : section "Mode vie privee" avec niveau de garantie et explication des limites DVRIP
- [x] Fiche `v380_pro.md` : section "Mode vie privee" avec niveau de garantie

*Tests*
- [x] Tests unitaires `ToggleCameraPrivacyModeUseCase` : adaptateur vendor appele si supporte ; reload toujours declenche ; `PrivacyVendorCut` correctement mis a jour
- [x] Tests unitaires `BatchToggleCameraPrivacyModeUseCase` : un seul reload pour N cameras
- [x] Tests unitaires `PrivacySchedulerService` : activation a l'entree de fenetre, pas de desactivation si `source = "manual"`, desactivation a la sortie si `source = "schedule"`
- [x] Tests unitaires `FrigateConfigApplier` : `enabled: false` pour camera en mode vie privee, absent pour camera normale
- [x] Tests unitaires `TapoCameraAdapter` : handshake KLAP mocke, verifier que `set_lens_mask` est envoye avec la bonne valeur

*UI/UX — polish dashboard*
- [x] Miniature live : padding intérieur + `text-align: center` + classe `live-thumb-privacy-label` avec `word-break: break-word` — le texte ne colle plus les bords
- [x] Bouton batch privacy : remplacé par un bouton pill "🔇 Mode vie privée global" (ambre) / "🔒 Désactiver" (vert) + vraie modale de confirmation (`PrivacyConfirmModal`) avec backdrop flouté, texte fonctionnel non-tech, bouton Annuler
- [x] Menu caméra : colonne unique (`camera-detail-sections` 1fr) — `DetectionConfigSection` et `PrivacyScheduleSection` migrent en `camera-detail-section` (boîte blanche) avec couleurs light-theme corrigées
- [x] Scroll horizontal mobile : `overflow-x: hidden` sur le body + `flex-wrap: wrap` sur `.hub-section-header` et `.hub-section-actions`

*Documentation utilisateur*
- [x] `docs/user/PRIVACY_MODE.md` : toggle manuel, planification, distinction "camera vraiment eteinte" vs "enregistrement desactive", comportement au redemarrage, marques supportees

**Criteres de validation :**
- Camera Tapo en mode vie privee : le voyant LED physique de la camera s'eteint — signal non falsifiable que la capture est arretee au niveau materiel
- Camera ICSee / V380 PRO en mode vie privee : le moteur de detection ne recoit plus de flux ; l'UI affiche "enregistrement desactive" (pas "coupure materielle")
- Camera de marque non reconnue : fallback identique a ICSee/V380 PRO, l'UI indique le niveau de garantie reduit
- La planification 22h–06h active et desactive automatiquement le mode sans intervention utilisateur
- Une activation manuelle pendant une fenetre planifiee n'est pas ecrasee par le scheduler
- Le batch toggle sur 3 cameras declenche un seul reload
- L'etat persiste apres redemarrage de Vyzio
- Une camera non concernee par le mode vie privee n'a pas `enabled: false` dans sa config generee

### 1.0.1 - P2 - PTZ, camera info et controle avancé
> But : permettre à l'utilisateur de contrôler les caméras PTZ compatibles depuis l'interface Vyzio, avec des commandes de base (panoramique, inclinaison, zoom) et la possibilité de définir des positions prédéfinies pour un accès rapide. Toute info système exposée par la caméra (ex. température, état de la connexion, batterie, etc.) doit être affichée dans l'interface pour aider à la maintenance et au diagnostic.
>
> **Contexte privacy mode — PTZ parking :** Investigation approfondie sur ICSee/XMEye et V380 Pro (juin 2026).
>
> **ICSee/XMEye :** Les seules commandes DVRIP capables d'affecter le flux vidéo sont les commandes PTZ (OPPTZControl, cmd 1400). VideoEnable, PrivacyMask, VideoColor, OPSleep/OPStandby ont toutes été testées et échouent (soit Ret=606 firmware, soit sans effet sur le flux cloud P2P XMEye). PTZ parking confirmé : SetPreset + DirectionLeftUp 8s + GotoPreset.
>
> **V380 Pro :** ONVIF disponible (port 8899) mais privacy masks non implémentés (`GetPrivacyMasks` → "Service has no operation"), OSD non implémenté, `SetVideoEncoderConfiguration` échoue ("Missing element Multicast" — bug firmware, même sans modification du payload), `RemoveVideoEncoderConfiguration` non implémenté. La seule solution hardware viable reste le PTZ parking via ONVIF `ContinuousMove + Stop` (confirmés fonctionnels). Investigation port 8800 (protocole propriétaire) : port ouvert, répond à un paquet binaire Sofia-like (`9c ff ff ff` = -100 en LE, rejection), 205ms de réponse. Non standard, nécessite reverse-engineering du protocole V380 propriétaire pour contrôle précis — voir NEXTS.
>
> **Stratégie combinée :** Le mode `ptz_parking` est **cumulatif** avec le fallback software — la caméra pivote physiquement vers la butée ET Frigate reste désactivé (`enabled: false`). Ce double mécanisme garantit un feedback visuel clair dans l'UI ("Caméra orientée — enregistrement désactivé") et une protection même si le mouvement PTZ échoue. L'utilisateur choisit la stratégie par caméra (logicielle, PTZ parking, ou hardware natif comme Tapo) et peut définir la position de surveillance via l'interface.
>
> **Architecture adaptateurs :** ONVIF PTZ est un standard supporté par la quasi-totalité des PTZ du marché (V380, Hikvision, Dahua, Reolink, Axis…). `OnvifCameraAdapter` est générique et couvre toutes ces caméras. `VendorCameraAdapterFactory` résout : `"icsee"` → DVRIP, `"tplink_tapo"` → KLAP, `"onvif"` → ONVIF générique, `"v380_pro"` → alias `"onvif"`, défaut → Null.
>
> **Limitation ONVIF V380 Pro :** Le firmware V380 Pro traite toutes les commandes PTZ (ContinuousMove, Stop) en ~3s indépendamment de la connexion (keep-alive testé). Le serveur ONVIF est mono-thread. Stop est toujours exécuté ~3s après ContinuousMove. Le step précis est impossible via ONVIF sur ce firmware. L'app native V380 utilise le protocole propriétaire port 8800. `SendCommandAsync` utilise fire-and-forget 500ms pour ne pas bloquer le thread serveur.

**Taches :**

*Domaine / Core*
- [x] Ajouter `PtzSupported` (bool), `PrivacyModeStrategy` (`"software"` | `"ptz_parking"` | `"hardware"`) sur l'entité `Camera` + migration EF Core
- [x] Créer use case `ConfigurePtzParkingPositionUseCase` : ordonne à l'adaptateur de sauvegarder la position actuelle comme position de surveillance (preset 1)
- [x] Étendre `IVendorCameraAdapter` : ajouter `SupportsPtzAsync`, `PtzMoveAsync`, `PtzStopAsync`, `PtzStepAsync` (default fallback Move+Stop), `PtzGoToPresetAsync`, `PtzSavePresetAsync`, `GetPtzPositionAsync`

*Infrastructure — adaptateurs PTZ*
- [x] **`OnvifCameraAdapter`** (générique) : `ContinuousMove` + `Stop` + `RelativeMove` (si `GetConfigurationOptions` déclare `RelativePanTiltTranslationSpace`). `PtzStepAsync` : RelativeMove si capable, sinon ContinuousMove + `Task.Delay(stepMs)` + Stop. `GetPtzCapabilitiesAsync` caché par caméra. `VendorFamily = "onvif"`. V380ProCameraAdapter supprimé.
- [x] `ICSeeXMEyeCameraAdapter` : PTZ via DVRIP OPPTZControl (cmd 1400) — 8 directions + `SetPreset` + `GotoPreset`. Sofia hash MD5 validé live.
- [x] `VendorCameraAdapterFactory` : alias `"v380_pro"` → `"onvif"`. Résolution `"onvif"` → `OnvifCameraAdapter`, `"icsee"` → `ICSeeXMEyeCameraAdapter`, `"tplink_tapo"` → `TapoCameraAdapter`, défaut → `NullVendorCameraAdapter`.
- [x] `ToggleCameraPrivacyModeUseCase` : branching selon `Camera.PrivacyModeStrategy` — `"hardware"` → adaptateur vendor, `"ptz_parking"` → `PtzMoveAsync(DownLeft, 8s)` fire-and-forget Stop **ET** Frigate désactivé, retour → `PtzGoToPresetAsync(1)`, `"software"` → Frigate only.
- [ ] Onboarding : détecter ONVIF PTZ à l'ajout (port 8899 + GetCapabilities) → assigner `vendorFamily = "onvif"` et `PtzSupported = true` automatiquement. Actuellement : checkbox manuelle dans la fiche caméra.

*API*
- [x] `POST /api/cameras/{id}/ptz/step` — tap + hold (chaining côté UI)
- [x] `POST /api/cameras/{id}/ptz/preset/save`
- [x] `POST /api/cameras/{id}/ptz/preset/goto`
- [x] `POST /api/cameras/{id}/ptz/configure-parking` — sauvegarde preset 1
- [x] `GET /api/cameras/{id}/ptz/position` — diagnostic GetStatus
- [x] `PATCH /api/cameras/{id}/privacy-strategy`

*Dashboard — composant partagé `PtzControlPanel`*
- [x] `ui/components/PtzControlPanel.tsx` : joystick 8 directions, bouton home (GotoPreset 1), bouton "Définir position de surveillance" (optionnel, contexte fiche caméra). Tap = 1 step, hold = chaining de steps jusqu'au relâcher.

*Dashboard — vue live (`LiveFeedModal`)*
- [x] `LiveFeedModal` (inline dans `App.tsx`) : overlay `PtzControlPanel` si `ptzSupported = true`

*Dashboard — fiche caméra (configuration)*
- [x] `PtzControlPanel` intégré dans `CameraOnboardingView` avec `ptzSavePreset` + `configurePtzParking`
- [x] Sélecteur de stratégie privacy (`software` / `ptz_parking` / `hardware`) avec descriptions et contraintes (`ptz_parking` masqué si `!ptzSupported`, `hardware` masqué si pas Tapo)
- [x] Badge vie privée : "Coupure matérielle confirmée" / "Caméra orientée — enregistrement désactivé" (ptz_parking) / "Enregistrement désactivé"

*Dashboard — parcours d'ajout (onboarding)*
- [ ] Si PTZ détecté automatiquement à l'ajout : étape dédiée "Configurer position de surveillance". Actuellement la fiche caméra couvre ce cas manuellement.

*Tests*
- [x] Tests unitaires `OnvifCameraAdapter` : VendorFamily, SupportsPrivacyMode, SupportsPtz, PtzMoveAsync (GetProfiles + ContinuousMove), PtzStopAsync, direction → velocity mapping
- [x] Tests unitaires `ICSeeXMEyeCameraAdapter` : SofiaHash validé live, structure hash (16 chars, charset)
- [x] Tests unitaires `ToggleCameraPrivacyModeUseCase` : branching hardware/software/ptz_parking, PtzMove appelé, GoToPreset au retour, skip si SupportsPtz=false
- [x] Tests unitaires `SetCameraPrivacyStrategyUseCase` : valeurs valides, rejet valeur inconnue, camera not found

*Catalogue constructeur*
- [ ] Mettre à jour `vendors/icsee.md` : PTZ parking comme stratégie privacy, mention ONVIF générique si disponible
- [ ] Mettre à jour `vendors/v380_pro.md` : adaptateur ONVIF générique, limitation firmware 3s, port 8800 investigation

**Critères de validation :**
- Caméra ICSee PTZ parking : pivote à l'activation, revient à la position de surveillance à la désactivation ✓
- Caméra V380 Pro PTZ parking : idem via ONVIF générique ✓ (step imprécis — limitation firmware, voir NEXTS)
- Nouvelle caméra ONVIF PTZ : fonctionne avec `vendorFamily = "onvif"` sans code supplémentaire ✓
- L'utilisateur peut définir sa position de surveillance depuis la vue live et la fiche caméra ✓
- Caméra sans PTZ : pas d'option "PTZ parking" dans la configuration ✓
- Caméra Tapo : non impactée ✓
- La stratégie choisie persiste après redémarrage ✓

---

### 1.0.2 - P2 - PTZ step précis V380 Pro — investigation close

> **Contexte** : Investigation ONVIF juin 2026 sur `192.168.1.135`. Le firmware V380 Pro est mono-thread côté ONVIF : chaque commande moteur (ContinuousMove, Stop) prend ~3s à répondre, indépendamment de la connexion (keep-alive testé, connexions parallèles testées — aucune différence). Stop est systématiquement exécuté ~3s après ContinuousMove — le step précis est impossible via ONVIF sur ce firmware. `SendCommandAsync` fire-and-forget 500ms est le meilleur compromis. `GetConfigurationOptions` répond en 16ms — seules les commandes moteur sont bloquantes.
>
> **Port 8800 (propriétaire) :** port ouvert, répond à un paquet DVRIP-like en 205ms avec `9c ff ff ff` (= -100 en LE int32, code de rejet). Protocole non standard, nécessite reverse-engineering. Estimation : 2-3 jours pour un PTZ de base. L'app native utilise ce protocole et n'a pas la limitation 3s.
>
> **`RelativeMove`, `GetStatus`, `SetPreset`, `GotoPreset`** : HTTP 400 "method not implemented" sur V380 Pro. `GotoPreset` retourne 400 — le bouton Home ONVIF n'a pas d'effet sur V380 (pas masqué actuellement dans l'UI).

**Tâches :**

- [x] **V380 — step via ContinuousMove + Delay + Stop** : `PtzStepAsync` dans `OnvifCameraAdapter` — `stepMs = Math.Clamp(speed * 2, 40, 200)` — fire-and-forget avec `SemaphoreSlim(1,1)` par caméra pour éviter les collisions Move/Stop. `GetPtzCapabilitiesAsync` détecte RelativeMove via `GetConfigurationOptions` et l'utilise si présent (caméras ONVIF conformes).
- [ ] **V380 — bouton Home masqué** : `GotoPreset` retourne HTTP 400 sur V380, le bouton home tente l'appel sans effet. Option : ajouter `SupportsPresetAsync` sur l'interface ou détecter à l'exécution. Non bloquant pour la release.
- [ ] **Protocole port 8800** : reverse-engineering V380 propriétaire pour step précis et contrôle temps réel. Estimation 2-3j. Voir NEXTS.

**Critères de validation :**
- Step via ONVIF : la caméra bouge, même si l'amplitude est difficile à contrôler précisément sur V380 ✓
- Les caméras ONVIF conformes (Hikvision, Dahua) utilisent RelativeMove ✓
- Home sur V380 : tentative ONVIF sans effet visible (pas bloquant)

---

### TECH - Modale commune pour les actions destructives

> But : toute action irréversible ou à fort impact (batch privacy, suppression de caméra, réinitialisation de config…) doit passer par un composant `ConfirmModal` partagé, réutilisable, accessible (`role="dialog"`, `aria-modal`, focus trap). Aujourd'hui `PrivacyConfirmModal` dans `App.tsx` est isolé et non réutilisable.

**Taches :**
- [x] Créer `src/dashboard/src/ui/components/ConfirmModal.tsx` : props `title`, `body`, `confirmLabel`, `cancelLabel`, `tone` (`"warn"` | `"danger"` | `"default"`), `onConfirm`, `onCancel`, `loading`
- [x] Ajouter le focus trap (premier élément focusable à l'ouverture, piège focus dans la modale, `Escape` annule)
- [x] Remplacer `PrivacyConfirmModal` dans `App.tsx` par `ConfirmModal`
- [x] Remplacer `window.confirm` ou les confirmations inline restantes dans le code (supprimer caméra, etc.) par `ConfirmModal`

**Critères de validation :**
- Aucune action destructive n'est déclenchée sans passer par `ConfirmModal`
- Le composant est dans `ui/components/` et n'importe rien de `application/` ou `infrastructure/`

---

### TECH - Architecture frontend — conformité Clean Architecture

> But : le code frontend (`App.tsx`, `CameraOnboardingView.tsx`) ne respecte plus la séparation des couches. Des logiques qui appartiennent à la couche `application/` (orchestration d'actions, gestion d'état global) sont directement dans `App.tsx`. Des composants `ui/components/` contiennent des sous-composants internes, des types locaux, et des styles inline qui devraient être en CSS. Le résultat est un fichier App.tsx de 600+ lignes et des composants non réutilisables.

**Problèmes identifiés :**
- `App.tsx` orchestre `HubView`, `HubOperationalState`, `PrivacyConfirmModal`, `LiveFeedModal` — il est à la fois root component et logique métier
- `CameraOnboardingView.tsx` embarque `DetectionConfigSection`, `PrivacyScheduleSection`, `CameraLiveView` comme fonctions locales non exportées — impossible à tester isolément
- Les couleurs et espacements en `style={{ ... }}` inline rendent le CSS impossible à auditer
- Les types locaux (`DiscoveryCandidate`, `CameraSelection`) dupliquent potentiellement des types du domaine

**Taches :**
- [ ] Extraire `HubOperationalState` dans `ui/components/HubView.tsx` (ou `ui/views/HubView.tsx`)
- [ ] Extraire `DetectionConfigSection` dans `ui/components/DetectionConfigSection.tsx`
- [ ] Extraire `PrivacyScheduleSection` dans `ui/components/PrivacyScheduleSection.tsx`
- [ ] Extraire `LiveFeedModal` dans `ui/components/LiveFeedModal.tsx`
- [ ] Migrer les `style={{ ... }}` inline restants vers des classes CSS dans `App.css`
- [ ] Vérifier que `ui/components/` n'importe rien de `infrastructure/` (dépendance via props uniquement)
- [ ] Auditer `DiscoveryCandidate` : si c'est un concept du domaine, créer `domain/entities/DiscoveryCandidate.ts`

**Critères de validation :**
- `App.tsx` ne dépasse pas 150 lignes
- Chaque composant dans `ui/components/` est importable et testable sans monter `App`
- Aucun import `infrastructure/` dans un fichier `ui/`

---

### TECH - Refactoring VendorFamily — source unique typée

> But : éliminer les chaînes littérales dispersées qui représentent les familles constructeur (`"tplink_tapo"`, `"icsee"`, `"v380_pro"`). Le bug `TapoCameraAdapter.VendorFamily = "tapo"` (au lieu de `"tplink_tapo"`) a existé sans qu'aucune erreur de compilation ne le signale — preuve que le couplage implicite par string est fragile.

**Taches :**
- [ ] Créer `VendorFamily` comme type fortement typé dans `Vyzio.Core` (classe statique avec constantes, ou record struct, ou enum — à décider dans le SAD avant implémentation)
- [ ] Remplacer toutes les occurrences de strings littérales (`"tplink_tapo"`, `"icsee"`, `"v380_pro"`, `"generic"`) dans : `AssistedCameraDiscoveryKnownDevices`, `AssistedCameraDiscoveryIdentifier`, tous les `IVendorCameraAdapter`, et le frontend TypeScript (`Camera.vendorFamily`)
- [ ] Vérifier que le nom du fichier `.md` dans `vendors/` correspond mécaniquement à la constante (test ou convention documentée)
- [ ] Mettre à jour le `vendors/README.md` pour référencer la constante à utiliser plutôt qu'une string libre

**Critères de validation :**
- Ajouter un nouveau constructeur sans utiliser la bonne constante doit produire une erreur de compilation ou un warning exploitable
- Aucune string littérale de vendorFamily dans le code de production

---

### NEXTS

- [ ] **PTZ précis V380 Pro via port 8800 (protocole propriétaire)** : port ouvert, répond à un paquet binaire Sofia-like en 205ms (`9c ff ff ff` = -100 LE = rejet de notre format). Protocole non standard, magic bytes différents du DVRIP classique (`ff000000`). Estimation 2-3j de reverse-engineering pour obtenir login + ContinuousMove + Stop. L'app native V380 utilise ce protocole et permet un contrôle précis sans la limitation 3s du serveur ONVIF. Scripts de probe dans `tools/camera-probe/probe_8800.py`.

- [ ] **Réveil a distance des cameras DVRIP sur batterie — investigation close, non implementable.** Le chipset WiFi reste en 802.11 PSM (Power Save Mode) : il repond aux pings ICMP (~510ms) au niveau NIC sans reveiller le processeur principal. TCP knock et UDP discovery (payload DVRIP 0x0590, WS-Discovery ONVIF, WoL magic packet) ont tous echoue — aucun port n'est ouvert en veille. Le seul mecanisme de reveil est un WoWLAN pattern filter proprietaire programme dans le NIC par le firmware ICSee, declenche via leur canal cloud (connexion persistante maintenue par le NIC). Non accessible sans reverse-engineering. **Limitation acceptee** : l'utilisateur doit reveiller la camera manuellement via l'app ICSee avant la verification DVRIP.
==> non acceptable, il faudra implémenter un WoL et faire une inspection de paquet pour déclencher le réveil de la caméra.
- [ ] Notification de l'utilisateur pour des evennements système (camera offline, batterie faible, systeme boot, mise à jour effectuée ...). Configurable!
- [ ] Canal discord et notification vers des groupes
- [ ] tests end 2 end (playwright) pour chaque US des SPECS.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
