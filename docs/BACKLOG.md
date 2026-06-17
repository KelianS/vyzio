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
> **V380 Pro :** ONVIF disponible (port 8899) mais privacy masks non implémentés (`GetPrivacyMasks` → "Service has no operation"), OSD non implémenté, `SetVideoEncoderConfiguration` échoue ("Missing element Multicast" — bug firmware, même sans modification du payload), `RemoveVideoEncoderConfiguration` non implémenté. La seule solution hardware viable reste le PTZ parking via ONVIF `ContinuousMove + Stop` (confirmés fonctionnels).
>
> **Stratégie combinée :** Le mode `ptz_parking` est **cumulatif** avec le fallback software — la caméra pivote physiquement vers la butée ET Frigate reste désactivé (`enabled: false`). Ce double mécanisme garantit un feedback visuel clair dans l'UI ("Caméra orientée — enregistrement désactivé") et une protection même si le mouvement PTZ échoue. L'utilisateur choisit la stratégie par caméra (logicielle, PTZ parking, ou hardware natif comme Tapo) et peut définir la position de surveillance via l'interface.
>
> **Architecture adaptateurs — ne pas réinventer la roue :** ONVIF PTZ est un standard supporté par la quasi-totalité des PTZ du marché (V380, Hikvision, Dahua, Reolink, Axis…). L'implémentation doit être un **`OnvifCameraAdapter` générique** couvrant toutes ces caméras d'un coup — pas un adaptateur par marque. Seul ICSee nécessite un adaptateur spécifique (DVRIP, cloud-only, pas d'ONVIF). La `VendorCameraAdapterFactory` résout : `"icsee"` → DVRIP, `"tplink_tapo"` → KLAP, `"onvif"` → ONVIF générique, défaut → Null. Le parcours d'ajout doit détecter la présence d'ONVIF PTZ (port 8899 + service PTZ) et assigner `vendorFamily = "onvif"` à l'onboarding pour que toute nouvelle caméra compatible fonctionne sans code supplémentaire.

**Taches :**

*Domaine / Core*
- [ ] Ajouter `PtzSupported` (bool), `PrivacyModeStrategy` (`"software"` | `"ptz_parking"` | `"hardware"`) sur l'entité `Camera` + migration EF Core
- [ ] Créer use case `ConfigurePtzParkingPositionUseCase` : ordonne à l'adaptateur de sauvegarder la position actuelle comme position de surveillance (preset "home")
- [ ] Étendre `IVendorCameraAdapter` : ajouter `SupportsPtzAsync`, `PtzMoveAsync` (direction + vitesse), `PtzStopAsync`, `PtzGoToPresetAsync`, `PtzSavePresetAsync`

*Infrastructure — adaptateurs PTZ*
- [ ] **`OnvifCameraAdapter`** (nouveau, générique) : implémenter PTZ via ONVIF standard — `ContinuousMove` + `Stop`, `GetPresets`, `GotoPreset`, `SetPreset`. Privacy parking : `ContinuousMove(pan=-1, tilt=-1)` ~8s → `Stop` ; retour via `GotoPreset` (preset "home" sauvegardé à la configuration) ou `ContinuousMove` inverse si presets non supportés. Couvre V380 Pro et toute future caméra ONVIF PTZ sans adaptateur supplémentaire. `VendorFamily = "onvif"`.
- [ ] `ICSeeXMEyeCameraAdapter` : implémenter PTZ via DVRIP OPPTZControl (cmd 1400) — `DirectionUp/Down/Left/Right/LeftUp/RightUp` + `SetPreset` + `GotoPreset`. Privacy parking : SetPreset 1 (home) → DirectionLeftUp 8s → GotoPreset 1 au retour. Mettre à jour `SetPrivacyModeAsync` pour utiliser la stratégie `ptz_parking` si configurée.
- [ ] Mettre à jour `VendorCameraAdapterFactory` : résolution `"onvif"` → `OnvifCameraAdapter`, `"icsee"` → `ICSeeXMEyeCameraAdapter`, `"tplink_tapo"` → `TapoCameraAdapter`, défaut → `NullVendorCameraAdapter`. Supprimer tout adaptateur V380-spécifique — couvert par ONVIF générique.
- [ ] Mettre à jour le parcours d'onboarding : détecter ONVIF PTZ (port 8899 + `GetCapabilities` service PTZ présent) → assigner `vendorFamily = "onvif"` et `PtzSupported = true` automatiquement, quelle que soit la marque.
- [ ] Mettre à jour `ToggleCameraPrivacyModeUseCase` : brancher la stratégie selon `Camera.PrivacyModeStrategy` — `"hardware"` → appel adaptateur direct (Tapo), `"ptz_parking"` → séquence parking/retour via PTZ **ET** Frigate désactivé (cumulatif), `"software"` → Frigate only

*API*
- [ ] Endpoints PTZ : `POST /api/cameras/{id}/ptz/move`, `POST /api/cameras/{id}/ptz/stop`, `POST /api/cameras/{id}/ptz/preset/save`, `POST /api/cameras/{id}/ptz/preset/goto`
- [ ] Endpoint configuration stratégie privacy : `PATCH /api/cameras/{id}/privacy-strategy`

*Dashboard — composant partagé `PtzControlPanel`*
- [ ] Créer `ui/components/PtzControlPanel.tsx` : joystick directionnel (8 directions) + bouton stop central + bouton "Retour position surveillance" (si preset home défini). Utilisé dans deux contextes — même composant, props identiques, rendu adapté au contexte parent. N'affiche rien si `PtzSupported = false`.

*Dashboard — vue live (`LiveFeedModal`)*
- [ ] Intégrer `PtzControlPanel` en overlay sur le flux vidéo (coins ou barre basse) si `PtzSupported = true` — l'utilisateur oriente la caméra directement depuis la vue live sans quitter le flux

*Dashboard — fiche caméra (configuration)*
- [ ] Intégrer `PtzControlPanel` dans la fiche caméra, accompagné du bouton **"Définir position de surveillance"** (déclenche `ConfigurePtzParkingPositionUseCase`, feedback de confirmation) — permet de positionner et sauvegarder le preset home dans un contexte dédié
- [ ] **Section "Mode vie privée"** : sélecteur de stratégie (`Enregistrement désactivé` / `Parking PTZ` / `Cache objectif`) avec description contextuelle ; `Parking PTZ` n'est proposé que si `PtzSupported = true`, `Cache objectif` que si `SupportsHardwarePrivacy = true`. Quand l'utilisateur sélectionne `Parking PTZ`, afficher un avertissement inline : *"La caméra pivote vers une zone neutre et l'enregistrement est désactivé dans Vyzio. Le flux vidéo reste techniquement accessible sur votre réseau local si quelqu'un connaît l'adresse de la caméra."*
- [ ] **Badge vie privée** : libellé selon la stratégie active — "Cache objectif" / "Caméra orientée — enregistrement désactivé" / "Enregistrement désactivé"

*Dashboard — parcours d'ajout (onboarding)*
- [ ] Si PTZ détecté à l'ajout (`PtzSupported = true`) : étape "Configurer le mode vie privée" avec sélecteur de stratégie et, si `ptz_parking` choisi, `PtzControlPanel` intégré pour orienter et sauvegarder la position de surveillance immédiatement — même composant, troisième contexte

*Tests*
- [ ] Tests unitaires `OnvifCameraAdapter` PTZ : mock ONVIF, séquence ContinuousMove → Stop → GotoPreset ; fallback ContinuousMove inverse si preset absent
- [ ] Tests unitaires `ICSeeXMEyeCameraAdapter` PTZ : connexion DVRIP, séquence login → SetPreset → DirectionLeftUp → Stop → GotoPreset
- [ ] Tests unitaires `ToggleCameraPrivacyModeUseCase` : branching correct selon `PrivacyModeStrategy`

*Catalogue constructeur*
- [ ] Mettre à jour `vendors/icsee.md` : PTZ parking comme stratégie privacy, mention que les caméras ICSee avec ONVIF utilisent l'adaptateur générique
- [ ] Mettre à jour `vendors/v380_pro.md` : PTZ parking via adaptateur ONVIF générique

**Critères de validation :**
- Caméra ICSee PTZ parking : pivote face au mur à l'activation et revient à la position de surveillance à la désactivation
- Caméra V380 Pro PTZ parking : idem via ONVIF, sans adaptateur V380-spécifique
- Ajout d'une nouvelle caméra ONVIF PTZ inconnue : fonctionne automatiquement avec `vendorFamily = "onvif"`, sans code ajouté
- L'utilisateur peut définir sa position de surveillance via les contrôles live et un bouton dédié
- Une caméra sans PTZ ne propose pas l'option "PTZ parking" dans la configuration
- Une caméra Tapo continue d'utiliser le cache objectif physique (non impacté par cet item)
- La stratégie choisie persiste après redémarrage de Vyzio

---

### TECH - Pipeline d'erreur frontend — clean architecture

> But : rendre les erreurs backend prévisibles et visibles dans toute l'application sans que chaque composant ait à gérer manuellement le feedback utilisateur. Aujourd'hui les erreurs HTTP sont des `Error` génériques opaques ; certains composants toastent, d'autres silencient (`.catch(() => {})`). La clean architecture offre les seams nécessaires pour une pipeline typée de bout en bout : infrastructure → domaine → use case → hook UI.

**Pipeline cible :**
```
fetch → HttpError (status, url) → use case → AppError (kind discriminé) → useAsync → toast / état
```

*Infrastructure — erreur typée*
- [ ] Créer `infrastructure/http/HttpError.ts` : classe `HttpError extends Error` avec `status: number` et `url: string` — remplace `throw new Error(\`HTTP ${status}\`)` dans tous les helpers fetch
- [ ] Centraliser `postJson`, `deleteJson`, `patchJson`, `putJson` dans `infrastructure/http/fetchJson.ts` — ils sont aujourd'hui dupliqués dans `HttpCameraRepository.ts` uniquement ; un seul fichier pour tous les verbes HTTP

*Domaine — erreur métier*
- [ ] Créer `domain/errors/AppError.ts` : type discriminé `AppError = { kind: 'not_found' } | { kind: 'network' } | { kind: 'server'; status: number } | { kind: 'unknown'; message: string }` — les use cases lèvent ce type, pas des strings ou des `HttpError` brutes
- [ ] Créer `domain/errors/toAppError.ts` : fonction pure `toAppError(e: unknown): AppError` qui mappe `HttpError` → `AppError` selon le status (404 → `not_found`, 5xx → `server`, NetworkError → `network`, reste → `unknown`)

*Application — use cases comme frontière*
- [ ] Chaque use case encapsule son `execute()` dans un try/catch qui appelle `toAppError` et relève une `AppError` — le domaine ne laisse plus fuiter d'erreurs HTTP vers l'UI

*UI — hook central*
- [ ] Créer `ui/hooks/useAsync.ts` : `useAsync<T>(fn: () => Promise<T>): { data: T | null, loading: boolean, error: AppError | null }` — catch automatique, pas de `useToast` à brancher dans chaque composant
- [ ] Créer `ui/hooks/useAsyncAction.ts` : variante pour les actions manuelles (boutons) — retourne `{ run, loading, error }`, toaste automatiquement selon `error.kind` (`not_found` → silencieux, `network` → "Impossible de joindre le serveur", `server` → "Erreur serveur", `unknown` → message brut)
- [ ] Migrer les hooks de chargement existants (`useCameras`, `useCameraStatus`, `useHubOverview`, etc.) vers `useAsync`
- [ ] Remplacer les blocs `.catch(() => {})` et les try/catch manuels dans les composants par `useAsyncAction`

**Critères de validation :**
- Toute erreur HTTP remontée d'un use case est de type `AppError` — aucune `Error` générique ne traverse la frontière application → UI
- Un appel backend en échec sans gestion explicite dans le composant affiche un toast automatique adapté au kind
- Aucun `.catch(() => {})` silencieux dans les composants (sauf intention documentée)
- Les use cases existants compilent sans modification de leur interface publique (breaking change zéro pour les tests)

---

### TECH - Modale commune pour les actions destructives

> But : toute action irréversible ou à fort impact (batch privacy, suppression de caméra, réinitialisation de config…) doit passer par un composant `ConfirmModal` partagé, réutilisable, accessible (`role="dialog"`, `aria-modal`, focus trap). Aujourd'hui `PrivacyConfirmModal` dans `App.tsx` est isolé et non réutilisable.

**Taches :**
- [ ] Créer `src/dashboard/src/ui/components/ConfirmModal.tsx` : props `title`, `body`, `confirmLabel`, `cancelLabel`, `tone` (`"warn"` | `"danger"` | `"default"`), `onConfirm`, `onCancel`, `loading`
- [ ] Ajouter le focus trap (premier élément focusable à l'ouverture, piège focus dans la modale, `Escape` annule)
- [ ] Remplacer `PrivacyConfirmModal` dans `App.tsx` par `ConfirmModal`
- [ ] Remplacer `window.confirm` ou les confirmations inline restantes dans le code (supprimer caméra, etc.) par `ConfirmModal`

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
