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
- [ ] Tests unitaires `ToggleCameraPrivacyModeUseCase` : adaptateur vendor appele si supporte ; reload toujours declenche ; `PrivacyVendorCut` correctement mis a jour
- [ ] Tests unitaires `BatchToggleCameraPrivacyModeUseCase` : un seul reload pour N cameras
- [ ] Tests unitaires `PrivacySchedulerService` : activation a l'entree de fenetre, pas de desactivation si `source = "manual"`, desactivation a la sortie si `source = "schedule"`
- [ ] Tests unitaires `FrigateConfigApplier` : `enabled: false` pour camera en mode vie privee, absent pour camera normale
- [ ] Tests unitaires `TapoCameraAdapter` : handshake KLAP mocke, verifier que `set_lens_mask` est envoye avec la bonne valeur

*Documentation utilisateur*
- [ ] `docs/user/PRIVACY_MODE.md` : toggle manuel, planification, distinction "camera vraiment eteinte" vs "enregistrement desactive", comportement au redemarrage, marques supportees

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

**Taches :**
TODO

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

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
