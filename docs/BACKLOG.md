# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### US-P3.7 — Live feed, replay détections et enregistrements continus
> But : Avoir depuis l'interface une vue en direct du flux de chaque caméra. Avoir une courte vidéo en replay des dernières secondes avant et après une détection, pour pouvoir vérifier rapidement ce qui s'est passé sans devoir aller chercher les fichiers d'enregistrement. Avoir la possibilité d'activer un enregistrement continu sur certaines caméras, pour pouvoir faire du time-lapse ou de la recherche d'événements sur une période donnée.

**Taches :**

#### Cadrage préalable — aligner SAD avant implémentation

- [x] Documenter dans le SAD la stratégie d'accès au live feed : URL HLS directe vers Frigate ou proxy Vyzio, implications réseau et authentification (ADR-16)
- [x] Documenter dans le SAD la stratégie d'accès aux clips : URL directe Frigate ou endpoint Vyzio, cycle de rétention, taille estimée par caméra (ADR-17)
- [x] Documenter dans le SAD la stratégie d'enregistrement continu : activation par caméra dans la config Frigate générée, impact sur le stockage, politique de rétention configurable (ADR-18)

#### Configuration Frigate

- [x] Activer l'enregistrement des clips dans la config Frigate générée (`record.enabled: true` global + `events.retain.default: 14j`) — condition préalable à `has_clip: true` sur les événements
- [x] Ajouter `ContinuousRecordingEnabled` dans `CameraDetectionConfig` et le projeter dans la section `record.enabled` par caméra dans `frigate.generated.yml` (ADR-18)

#### API

- [x] Implémenter `GET /api/cameras/{id}/live/latest.jpg` : proxy de la dernière frame Frigate (`/api/{slug}/latest.jpg`), rafraîchi en polling 1fps côté UI (ADR-16) — Frigate non exposé au navigateur
- [x] Implémenter `GET /api/detection-events/{id}/clip` : proxy MP4 Frigate authentifié en streaming chunked avec support Range (ADR-17)

#### Interface utilisateur

- [x] Construire la vue live feed : polling `latest.jpg` à 1fps par caméra, toggle Voir/Arrêter dans le panneau détail caméra (ADR-16)
- [x] Construire le replay des détections : depuis l'historique, afficher le clip de l'événement dans un `<video>` inline expandable si `has_clip: true` (ADR-17)
- [x] Permettre d'activer ou désactiver l'enregistrement continu par caméra depuis l'interface de configuration, avec indication de l'impact stockage (~1-3 Go/jour)

#### Notifications enrichies — clip en pièce jointe

- [x] Différer l'envoi de la notification Telegram au lifecycle `end` de l'événement Frigate (plutôt que `new`) afin d'inclure le clip MP4 quand `has_clip: true`
- [x] Télécharger le clip depuis Frigate via le proxy `GET /api/detection-events/{id}/clip` et l'envoyer via `sendVideo` Telegram en pièce jointe de la notification (snapshot en aperçu, clip en vidéo)
- [x] Gérer le cas `has_clip: false` à la fin de l'événement : envoyer la notification avec snapshot uniquement, sans attendre indéfiniment

#### Fixes et améliorations notifications (post-P3.7)

- [x] **Détection animaux** : corriger le filtre `retained_labels: [person]` dans `vyzio.yml` qui bloquait cat/dog/bird/etc. au niveau de l'intake MQTT — passer à `[]` pour tout accepter, le filtrage par catégorie restant configurable par canal
- [x] **Anti-spam cooldown** : ajouter un cooldown configurable par canal (minutes, par caméra × label) pour éviter le spam lors d'une détection continue ; configurable depuis l'interface Telegram
- [x] **Mode média configurable** : exposer un choix de format par canal (`clip_or_photo`, `photo`, `text`) configurable depuis l'UI ; l'option `clip_or_photo` envoie un album Telegram (`sendMediaGroup`) avec la photo bbox + le clip ensemble
- [x] **Album Telegram (sendMediaGroup)** : remplacer `sendVideo` seul par un album photo+clip quand les deux sont disponibles, permettant d'afficher le snapshot avec bounding box à côté du clip
- [x] **Délai de finalisation clip** : attendre 10 s (configurable, 0 en tests) avant de tenter le fetch clip/snapshot, Frigate finalisant les fichiers après avoir publié le payload MQTT `end`
- [x] **Suppression des gardes `has_clip`/`has_snapshot`** : ne plus bloquer le fetch sur les flags MQTT non fiables ; toujours tenter après le délai et tomber en fallback sur 404
- [x] **Fuseau horaire** : corriger les horodatages Telegram (heure locale) et les plages horaires actives en remplaçant `ToLocalTime()` (fuseau système souvent UTC en Docker) par `TimeZoneInfo.ConvertTime()` avec un `time_zone` configurable dans `vyzio.yml`
- [x] **Format de notification amélioré** : emoji par catégorie (🚶🐱🐕🚗…), titre en gras HTML, métadonnées sur une seconde ligne (📷 caméra · 🕐 heure · confiance), `parse_mode=HTML` sur tous les appels Telegram

#### Tests

- [x] Vérifier que la config Frigate générée inclut bien `record` et `clips` quand activés, sans régression sur les caméras non concernées

#### Refonte modèle de labels (post-P3.7)

- [x] **Séparation labels détection / labels notification** : introduction de deux endpoints distincts (`GET /api/detection-labels/camera` et `GET /api/detection-labels/notifications`) comme source de vérité unique côté backend — les deux contextes n'exposent plus la même liste
- [x] **Disparition de `face` de l'UI** : le label `face` n'apparaît ni en config caméra ni dans les notifications ; sélectionner "Personne" en config caméra couvre implicitement `person` + `face` ; côté notifications, les événements `face` sont absorbés dans `person_unknown` ou `person_known` selon l'identity
- [x] **Introduction de `person_unknown` / `person_known`** : les labels de notification utilisent désormais une sémantique explicite (inconnu / reconnu) indépendante des labels Frigate ; `person_known` couvre toute personne avec une identité, qu'elle vienne d'un événement `person` ou `face`
- [x] **`ResolveNotificationLabel`** : mapping centralisé `(label Frigate, identity?) → label notification` — `person|face` sans identity → `person_unknown`, avec identity → `person_known`, tout autre label → identique ; `IsLabelAllowed` réduit à une vérification simple après résolution
- [x] **Frontend aligné** : `getCameraLabels` et `getNotificationLabels` deux use cases distincts ; chaque vue (config caméra, notifications, historique) branchée sur le bon endpoint sans filtre ad hoc ; `DetectionLabel` simplifié (plus de `notificationOnly`)
- [x] **Tests unitaires** : couverture de `ResolveNotificationLabel` (person/face avec et sans identity, autres labels) et `IsLabelAllowed` (tous les cas known/unknown/other)

### US-P3.8 — UI uniformisee, coherente et guidante
> But : mettre de la cohérence entre les pages, les noms, comportements, actions de navigation toujours au même endroit. La vue principale devra aussi être repensée pour guider l'utilisateur vers les actions de configuration ou la vue d'utilisation du système (feed live caméra, notifications, statuts).

**Taches :**

#### Audit et cadrage

- [x] Auditer la cohérence cross-pages : terminologie (noms des actions, labels, statuts), patterns de navigation (boutons retour, accès aux sections), comportements des formulaires
- [x] Identifier les composants UI dupliqués entre pages et définir les abstractions communes à extraire

#### Vue principale (hub)

- [x] Repenser la vue principale pour orienter clairement l'utilisateur selon son état : première configuration (aucune caméra), système opérationnel (lien vers live feed), système dégradé (guidage vers la correction)
- [x] Intégrer un accès rapide au live feed sur la vue principale une fois P3.7 livré
- [x] Afficher sur la vue principale un résumé actionnable des statuts : caméras actives, profils synchronisés, dernière notification, alertes en attente

#### Guidage utilisateur — reconnaissance

- [x] Avertir l'utilisateur si une caméra n'a plus `person` dans ses labels de détection alors qu'elle a des profils associés — la reconnaissance ne pourra pas s'exécuter sans ce label
- [x] Afficher le nombre de photos par profil et une indication sur le minimum recommandé pour une reconnaissance fiable (3 à 5 photos, angles variés)
- [x] Valider le flow end-to-end `sub_label` → profil : vérifier que lorsque Frigate pose un `sub_label` reconnu, l'événement remonte dans l'historique avec le nom du profil (non encore confirmé en conditions réelles)

#### Cohérence composants et navigation

- [x] Uniformiser les patterns de navigation entre toutes les vues (position et libellé du bouton retour, fil d'Ariane, transitions)
- [x] Harmoniser les composants de feedback (messages d'erreur, états de chargement, confirmations) pour qu'ils aient le même rendu et le même comportement quelle que soit la page
- [x] Avoir des loaders et information utilisateurs lors des chargements longs, application de config etc...
- [x] Avoir une cohérence entre les actions et les messages de retour (un appui bouton sur un panel ne devrait pas avoir un message d'erreur dans un autre panel, etc...)


### US-P3.9 — Vue experte intégrée (Frigate en iframe)
> But : donner accès à l'interface Frigate directement dans Vyzio, sans ouvrir un onglet externe. L'utilisateur accède aux réglages avancés dans le même contexte que le reste du produit, avec le header Vyzio visible au-dessus. La route `#expert` est ajoutée à la navigation principale.

**Tâches :**
- [x] Ajouter la route `#expert` dans le router hash de l'application et l'entrée correspondante dans `AppHeader`
- [x] Construire la vue `ExpertView` : iframe pointant vers `frigateBaseUrl`, pleine hauteur disponible sous le header
- [x] Gérer les cas d'indisponibilité Frigate : message d'erreur clair si l'iframe ne charge pas (timeout 10s)
- [x] Vérifier que l'iframe ne pose pas de problème CORS ou X-Frame-Options selon la configuration Frigate locale (Frigate ne pose pas de X-Frame-Options par défaut ; si bloqué, un lien "Ouvrir dans un onglet" est proposé)

**Critères d'acceptation :**
- L'utilisateur peut accéder à Frigate depuis `#expert` sans quitter Vyzio
- Le header Vyzio reste visible et fonctionnel pendant la navigation dans l'iframe
- Un message clair s'affiche si Frigate n'est pas joignable
- La route `#expert` apparaît dans la navigation principale

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

### US-P3.11 — Privacy mode
> But : permettre à l'utilisateur de couper une caméra temporairement ou de manière récurrente (ex. tous les soirs de 22h à 6h) pour préserver la vie privée, avec un impact minimal sur les autres fonctionnalités (notifications, reconnaissance, etc.) et une indication claire du statut de confidentialité de chaque caméra. La caméra doit réellement être coupé et le flux RTSP ne doit être visible de personne sur le réseau, y compris de Frigate.

**Taches :**
TODO

### US-P3.12 — PTZ
> But : permettre à l'utilisateur de contrôler les caméras PTZ compatibles depuis l'interface Vyzio, avec des commandes de base (panoramique, inclinaison, zoom) et la possibilité de définir des positions prédéfinies pour un accès rapide.

**Taches :**
TODO
---

### BUGFIX
- [ ] Dans le menu caméra, "appliquer" ne déclenche aucun feedback utilisateur, on ne sait pas s'il se passe quelque chose. Le message d'erreur est toujours en dehors dans le panel de détail.
- [x] Plus d'acces Docker quand non root : permission denied while trying to connect to the docker API at unix:///var/run/docker.sock (entrypoint.sh reads socket GID at runtime, adds vyzio user to group, drops to vyzio via su-exec)
- [ ] Les photos et clips de détection s'ouvre dans une page externe (fait pour les liens dans le markdown), mais les photos internes ne devrait pas subir cette règle et devrait s'ouvrir dans une modale pour rester dans le contexte de l'application.
- [ ] Pouvoir agrandir le live feed dans une modale comme pour les miniatures de détections
---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
