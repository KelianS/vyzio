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
- [ ] Ajouter `PrivacyModeActive`, `PrivacyModeSource` (nullable : `"manual"` | `"schedule"`), `PrivacyVendorCut` (bool) sur l'entite `Camera` + migration EF Core
- [ ] Creer l'entite `CameraPrivacySchedule` (id, camera_id, enabled, days_of_week JSON, start_time, end_time, created_at) + migration EF Core
- [ ] Creer l'interface `IVendorCameraAdapter` dans `Vyzio.Core` : `VendorFamily`, `SupportsPrivacyModeAsync`, `SetPrivacyModeAsync` (stub pour `SupportsSystemInfoAsync` en commentaire)
- [ ] Creer `IVendorCameraAdapterFactory` dans `Vyzio.Core` : resout l'adaptateur selon `Camera.VendorFamily`
- [ ] Creer l'interface `ICameraPrivacyRepository` dans `Vyzio.Core` (GetActiveSchedules, GetSchedule, SaveSchedule, DeleteSchedule)

*Infrastructure — adaptateurs constructeur*
- [ ] `TapoCameraAdapter` : `SetPrivacyModeAsync` via protocole KLAP local (`set_lens_mask`) — active le cache physique + eteint le voyant LED
- [ ] `ReolinkCameraAdapter` : `SetPrivacyModeAsync` via `POST /api.cgi?cmd=SetChannelStatus`
- [ ] `HikvisionCameraAdapter` : `SetPrivacyModeAsync` via ISAPI `PUT /ISAPI/System/Video/inputs/channels/1`
- [ ] `DahuaCameraAdapter` : `SetPrivacyModeAsync` via CGI `configManager.cgi?action=setConfig`
- [ ] `ICSeeXMEyeCameraAdapter` : `SetPrivacyModeAsync` via commande DVRIP `MSG_VIDEO_COMMAND` (port 34567)
- [ ] `NullVendorCameraAdapter` : fallback pour les marques non supportees (`SupportsPrivacyModeAsync` retourne `false`)
- [ ] `VendorCameraAdapterFactory` : mappe `VendorFamily` → implementation concrete
- [ ] Implementer `CameraPrivacyRepository` (EF Core)
- [ ] Mettre a jour `FrigateConfigApplier` : injecter `enabled: false` dans la section camera lorsque `PrivacyModeActive == true`

*Application — use cases*
- [ ] `ToggleCameraPrivacyModeUseCase` : (1) met a jour l'etat en base, (2) appelle l'adaptateur vendor si supporte, (3) toujours regenere frigate.yml + reload Frigate
- [ ] `BatchToggleCameraPrivacyModeUseCase` : applique les etapes 1–2 pour chaque camera de la liste, puis un seul reload Frigate
- [ ] `CreateCameraPrivacyScheduleUseCase` : validation jours non vides, start_time format valide
- [ ] `UpdateCameraPrivacyScheduleUseCase`
- [ ] `DeleteCameraPrivacyScheduleUseCase`
- [ ] `PrivacySchedulerService` (BackgroundService) : evalue toutes les minutes ; active si entree fenetre et `source != "manual"` ; desactive si sortie fenetre et `source == "schedule"`

*API*
- [ ] Endpoints privacy unitaire et batch (toggle, CRUD planifications — contrats definis dans ADR-20)
- [ ] Etendre la reponse `GET /api/cameras` avec `privacyModeActive`, `privacyModeSource` et `privacyVendorCut`

*Dashboard*
- [ ] Badge / icone "vie privee" par camera, avec indication du niveau de garantie (coupure vendor vs fallback Frigate uniquement)
- [ ] Vue live d'une camera en mode vie privee : "Camera en pause — vie privee" au lieu d'une erreur
- [ ] Bouton toggle rapide sur la carte camera
- [ ] Action globale "Tout couper / Tout reactiver" (batch toggle)
- [ ] Ecran de configuration des planifications : jours de la semaine + plage horaire, validation inline

*Tests*
- [ ] Tests unitaires `ToggleCameraPrivacyModeUseCase` : adaptateur vendor appele si supporte ; reload toujours declenche ; `PrivacyVendorCut` correctement mis a jour
- [ ] Tests unitaires `BatchToggleCameraPrivacyModeUseCase` : un seul reload pour N cameras
- [ ] Tests unitaires `PrivacySchedulerService` : activation a l'entree de fenetre, pas de desactivation si `source = "manual"`, desactivation a la sortie si `source = "schedule"`
- [ ] Tests unitaires `FrigateConfigApplier` : `enabled: false` pour camera en mode vie privee, absent pour camera normale
- [ ] Tests unitaires `TapoCameraAdapter` : handshake KLAP mocke, verifier que `set_lens_mask` est envoye avec la bonne valeur
- [ ] Tests unitaires `ReolinkCameraAdapter`, `HikvisionCameraAdapter` : verifier la construction correcte de la requete HTTP (mock `HttpClient`)

*Documentation utilisateur*
- [ ] `docs/user/PRIVACY_MODE.md` : toggle manuel, planification, distinction "camera vraiment eteinte" vs "flux non accessible depuis Vyzio", comportement au redemarrage, marques supportees

**Criteres de validation :**
- Camera Tapo en mode vie privee : le voyant LED physique de la camera s'eteint — signal non falsifiable que la capture est arretee au niveau materiel
- Camera Reolink en mode vie privee : l'API Reolink est appelee ET Frigate ne detecte plus (`enabled: false` dans le yml genere)
- Camera de marque inconnue : seul le fallback Frigate s'applique ; l'UI indique le niveau de garantie reduit
- La planification 22h–06h active et desactive automatiquement le mode sans intervention utilisateur
- Une activation manuelle pendant une fenetre planifiee n'est pas ecrasee par le scheduler
- Le batch toggle sur 3 cameras declenche un seul reload Frigate
- L'etat persiste apres redemarrage de Vyzio
- Une camera non concernee par le mode vie privee n'a pas `enabled: false` dans sa config Frigate

### 1.0.1 - P2 - PTZ, camera info et controle avancé
> But : permettre à l'utilisateur de contrôler les caméras PTZ compatibles depuis l'interface Vyzio, avec des commandes de base (panoramique, inclinaison, zoom) et la possibilité de définir des positions prédéfinies pour un accès rapide. Toute info système exposée par la caméra (ex. température, état de la connexion, batterie, etc.) doit être affichée dans l'interface pour aider à la maintenance et au diagnostic.

**Taches :**
TODO

### NEXTS

- [ ] **Réveil a distance des cameras DVRIP sur batterie — investigation close, non implementable.** Le chipset WiFi reste en 802.11 PSM (Power Save Mode) : il repond aux pings ICMP (~510ms) au niveau NIC sans reveiller le processeur principal. TCP knock et UDP discovery (payload DVRIP 0x0590, WS-Discovery ONVIF, WoL magic packet) ont tous echoue — aucun port n'est ouvert en veille. Le seul mecanisme de reveil est un WoWLAN pattern filter proprietaire programme dans le NIC par le firmware ICSee, declenche via leur canal cloud (connexion persistante maintenue par le NIC). Non accessible sans reverse-engineering. **Limitation acceptee** : l'utilisateur doit reveiller la camera manuellement via l'app ICSee avant la verification DVRIP.
==> non acceptable, il faudra implémenter un WoL et faire une inspection de paquet pour déclencher le réveil de la caméra.


---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
