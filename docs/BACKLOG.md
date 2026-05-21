# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### US-P3.10 — Production Ready infrastructure
> But : préparer le déploiement du projet sur une infrastructure de production.

**Taches :**
- [x] Configurer un pipeline CI/CD (github) pour automatiser les tests, la construction et le déploiement de l'application
- [x] Retirer tous les fichiers de configuration pour l'utilisateur, il ne doit avoir aucun fichier a écrire, tout ce fait depuis l'interface (ex. config Frigate générée, config Vyzio, etc.)
- [x] Monter la config Frigate dans un volume Docker plutôt que de devoir monter un dossier commun
- [x] Retirer l'exposition de Frigate, tout doit passer par Vyzio (live feed, clips, etc.) pour éviter les problèmes de CORS et d'authentification
- [x] Configurer NGINX et Dockerfile pour la partie frontend (`src/dashboard/Dockerfile` multi-stage + `nginx.conf` avec proxy `/api/` vers vyzio-api ; service `dashboard` sur `:8080` dans docker-compose)
- [x] Intégrer les docs 'vendors' dans l'image backend (déplacés vers `src/vyzio/vendors/`, `COPY` dans le Dockerfile backend, fallback par défaut `/app/vendors`)
- [x] Mettre en place une surveillance systeme wide sur le dashboard (CPU, RAM, stockage). Pour monitorer l'utilisation, principalement de Frigate, et alerter si trop de caméras ou détection pour le systeme. (Hint: Frigate a une page avec plein de metrics, certaines données peuvent être utilisé ou la page entière peut être intégrée — widget simplifié dans le hub + vue expert pour les détails techniques)
- [x] Configurer Mosquitto sans fichier supplémentaire (`entrypoint` inline dans docker-compose, suppression du volume `mosquitto.conf`)
- [ ] SAST et sanity check de l'app avant release MVP
- [x] Documenter le processus de déploiement et les prérequis système dans le README

**additional tasks from development:**
- [x] La découverte réseau ne fonctionne pas si l'on ne spécifie pas le subnet dans les options, il faudrait que ce soit automatique (ex. `ip addr` pour trouver le subnet de l'interface réseau principale) pour éviter d'avoir à configurer une option qui n'est pas censé être utilisée par l'utilisateur final.
- [x] Les photos et clips de détection s'ouvre dans une page externe (fait pour les liens dans le markdown), mais les photos internes ne devrait pas subir cette règle et devrait s'ouvrir dans une modale pour rester dans le contexte de l'application.
- [x] La lecture de clip ne fonctionne plus depuis que Proxifier par Vyzio — `GetStreamAsync` throw sur 400 Frigate ; corrigé en `GetAsync + ResponseHeadersRead` avec retour null gracieux.
- [x] Dans le menu caméra, "appliquer" ne déclenche aucun feedback utilisateur, on ne sait pas s'il se passe quelque chose. Le message d'erreur est toujours en dehors dans le panel de détail.
- [x] Pouvoir agrandir le live feed dans une modale comme pour les miniatures de détections


### US-P3.13 — Support protocole dvrip/XMEye comme fallback (cameras sans RTSP)
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

**additional tasks from development:**
- [x] `handleRefreshCandidate` : le find matchait sur `host + port`, or une camera en veille a `port = 0` dans le candidat initial — apres reveil et probe DVRIP reussi le port change, le candidat n'etait plus trouve. Corrige en matchant sur `host` uniquement.
- [x] `HttpCameraRepository` : le champ `streamProtocol` manquait dans l'interface locale `CameraDto` et dans `mapCamera` — la valeur etait `undefined` a l'usage malgre la presence dans l'API. Ajoute avec fallback `'rtsp'`.
- [x] `canUpdateConfiguredCamera` exigeait `streamPath` truthy, ce qui bloquait le bouton Enregistrer pour toute camera DVRIP (`streamPath = null`). Corrige en excluant le check streamPath quand `streamProtocol === 'dvrip'`.
- [x] Boutons `.primary-cta` et `.secondary-cta` sans style `:disabled` — visuellement identiques qu'ils soient actifs ou non. Ajoute `opacity: 0.4; cursor: not-allowed` sur `:disabled`.

---

### US-P3.10 — fixes post-merge
- [x] `FrigateConfigApplier.ApplyAsync` faisait ecriture YAML + reload Frigate en une seule operation — le bouton Enregistrer (detection config, update camera) declenchait un reload inutile et lent. Separe en `WriteConfigAsync` (ecriture seule, appelee a chaque save) et `ApplyAsync` (ecriture + reload, reserve au bouton Appliquer). La config est ainsi toujours a jour sur disque au reboot.
- [x] `formatEventTime` affichait uniquement l'heure (HH:mm) meme pour les evenements d'un jour precedent. Affiche maintenant `JJ/MM · HH:mm` si la date n'est pas aujourd'hui.

---

### US-P3.11 — Privacy mode
> But : permettre à l'utilisateur de couper une caméra temporairement ou de manière récurrente (ex. tous les soirs de 22h à 6h) pour préserver la vie privée, avec un impact minimal sur les autres fonctionnalités (notifications, reconnaissance, etc.) et une indication claire du statut de confidentialité de chaque caméra. La caméra doit réellement être coupé et le flux RTSP ne doit être visible de personne sur le réseau, y compris de Frigate.

**Taches :**
TODO

### US-P3.12 — PTZ
> But : permettre à l'utilisateur de contrôler les caméras PTZ compatibles depuis l'interface Vyzio, avec des commandes de base (panoramique, inclinaison, zoom) et la possibilité de définir des positions prédéfinies pour un accès rapide.

**Taches :**
TODO

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
