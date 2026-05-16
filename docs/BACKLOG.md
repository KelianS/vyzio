# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### US-P3.5 — Gestion configuration des notification via UI

> But : permettre a l'utilisateur de configurer les canaux de notification via l'interface, l'aider a configurer Telegram et les autres canaux. Permettre de choisir les categories de detection a notifier et les politiques d'alerte associees. Permettre de choisir le format des messages et les informations a inclure.

**Taches :**
- [x] Completer le cadrage SPECS/SAD pour expliciter le parcours UI de configuration des notifications, le modele de destinations et les regles produit a exposer
- [x] Definir le modele metier de configuration des notifications cote Vyzio : destinations, statuts de configuration, regles de diffusion, format de message, resultat des tests d'envoi
- [x] Introduire une persistence dediee a cette configuration dans Vyzio, sans dependre uniquement des options runtime injectees au demarrage
- [x] Definir la strategie de stockage des secrets canal (ex. token Telegram) et la separation entre donnees sensibles, statut produit et historique d'envoi
- [x] Exposer une API de lecture/ecriture pour la configuration des notifications, avec contrats stables pour l'UI
- [x] Exposer une action de test ciblee par destination pour verifier un canal configure sans attendre une vraie detection
- [x] Construire le premier parcours UI guide pour Telegram : etat configure / non configure, saisie assistee, aide de configuration, test d'envoi, retour d'erreur comprehensible
- [x] Etendre le pipeline de notification pour resoudre les destinations actives et les regles applicables depuis la configuration persistante, et non depuis un seul switch Telegram statique
- [x] Introduire un modele de capacites par canal pour afficher clairement ce que chaque destination supporte (image, dependance tierce, prerequis reseau, confidentialite)
- [x] Permettre de configurer au minimum les categories / types d'evenements notifies, le niveau minimal d'alerte et les plages horaires associees
- [x] Permettre de configurer le format du message envoye, avec activation minimale des champs camera, heure, type d'evenement, identite et apercu
- [x] Ajouter les validations backend/frontend, tests unitaires/integration et documentation utilisateur necessaires pour verrouiller le parcours de configuration et le test d'envoi

**Criteres d'acceptation :**
- L'utilisateur peut configurer Telegram depuis l'interface sans modifier de fichier ni redemarrer manuellement le produit
- L'utilisateur voit clairement si une destination est configuree, testee avec succes, en erreur ou inactive
- Une notification de test peut etre envoyee a la demande pour valider la configuration d'un canal
- L'utilisateur peut regler depuis l'interface les destinations actives, les categories d'evenements, le niveau minimal d'alerte et les plages horaires minimales retenues
- Le format du message reste comprehensible, configurable dans les limites du MVP et coherent entre backend, UI et documentation
- Les compromis d'un canal tiers comme Telegram sont affiches explicitement avant activation
- Le pipeline d'envoi applique la configuration persistante courante sans exiger une edition manuelle du runtime


### US-P3.6 — Gestion detections, profils et reconnaissance via UI
> But : Pouvoir configurer ce qui va être détecté, des personnes, animaux, véhicules, etc. Pouvoir reconnaitre une personne en particulier, pas uniquement "person", mais "Alice", "Bob, etc. Pouvoir associer des profils à des caméras, par exemple "Caméra de la porte d'entrée : détecter les personnes, reconnaître Alice et Bob, mais pas les véhicules". Pouvoir avoir une vue claire de ce qui est détecté sur chaque caméra et un historique des détections avec les métadonnées associées (catégorie, identité reconnue, caméra, heure).

**Taches :**

#### Cadrage préalable — aligner SAD avant implémentation

- [x] Compléter le SAD pour documenter le modèle de stockage des photos de profil : comment Vyzio transmet les photos vers la bibliothèque de reconnaissance Frigate (API REST Frigate ou écriture directe dans le volume), quel identifiant Vyzio utilise pour le rattachement (nom profil ou slug), et ce que Vyzio conserve localement (référence de chemin ou métadonnées uniquement)
- [x] Compléter le SAD pour documenter la configuration de détection par caméra : comment Vyzio persiste les labels actifs par caméra (`person`, `car`, `dog`, etc.) et comment cette configuration est projetée dans la section `cameras` de `frigate.yml` via le `CameraConfigWriter` existant
- [x] Compléter le SAD pour documenter l'association profil-caméra comme agrégat métier Vyzio : structure de données, cardinalité (N profils × M caméras), et quand cette association influence le comportement de reconnaissance (filtrage dans `ProfileRulesService` ou configuration Frigate)

#### Modèle métier et persistance

- [x] Introduire le modèle de photo de profil dans `Core` et `Infrastructure` : entité ou value object portant la référence fichier, le statut de synchronisation vers Frigate et la date d'ajout ; repository dédié ou extension de `IProfileRepository`
- [x] Introduire la configuration de détection par caméra dans `Core` et `Infrastructure` : entité portant la liste des labels activés par caméra (`CameraDetectionConfig`), repository dédié, migration EF Core
- [x] Introduire l'association profil-caméra dans `Core` et `Infrastructure` : entité de jointure `ProfileCameraLink` (profile_id, camera_id, enabled), repository, migration EF Core
- [x] Étendre le schéma SQLite via migrations EF Core pour les trois nouvelles entités, sans rupture des tables existantes

#### Use cases backend

- [x] Implémenter `AddProfilePhotoUseCase` : valider et stocker la photo localement, déclencher la synchronisation vers la bibliothèque de reconnaissance Frigate via l'API REST Frigate, retourner le statut de sync
- [x] Implémenter `RemoveProfilePhotoUseCase` : supprimer la photo locale et retirer l'entrée correspondante de la bibliothèque Frigate
- [x] Implémenter `GetCameraDetectionConfigUseCase` et `SaveCameraDetectionConfigUseCase` : lire et écrire la liste des labels actifs par caméra ; déclencher la regénération de `frigate.yml` via le `CameraConfigWriter` existant si la config change
- [x] Implémenter `SetCameraProfileLinksUseCase` et `SetProfileCameraLinksUseCase` : remplacer intégralement les associations profil-caméra (full replacement idempotent)
- [x] Implémenter `GetDetectionHistoryUseCase` : requête paginée sur `detection_events` avec filtres combinables (camera, label, profile_id, plage de dates), triée par `occurred_at` décroissant
- [x] Implémenter `CorrectDetectionIdentityUseCase` : permettre de lier ou délier un événement de détection à un profil existant, mettre à jour `profile_id` et `identity` dans `detection_events`
- [x] Étendre `FrigateAdapter` pour appliquer les associations profil-caméra (ADR-15) : une reconnaissance Frigate (`sub_label`) n'est mappée vers un profil Vyzio que si ce profil est associé à la caméra concernée (ou si aucun lien n'est défini)

#### API

- [x] Exposer les endpoints photo de profil : `POST /api/profiles/{id}/photos` (upload multipart), `DELETE /api/profiles/{id}/photos/{photoId}` ; inclure le statut de sync Frigate dans la réponse
- [x] Exposer les endpoints de configuration détection par caméra : `GET /api/cameras/{id}/detection-config`, `PUT /api/cameras/{id}/detection-config` avec validation des labels connus
- [x] Exposer les endpoints d'association profil-caméra : `GET /api/cameras/{id}/profile-links`, `PUT /api/cameras/{id}/profile-links`, `GET /api/profiles/{id}/camera-links`, `PUT /api/profiles/{id}/camera-links`
- [x] Exposer l'endpoint historique détections filtré et paginé : `GET /api/detection-events/history?camera=&label=&profileId=&from=&to=&page=&limit=`
- [x] Exposer l'endpoint de correction de reconnaissance : `PATCH /api/detection-events/{id}/identity` avec `{ profileId: string | null }`

#### Interface utilisateur

- [x] Construire la page de gestion des profils (liste complète) : afficher tous les profils avec nom, catégorie, mode d'alerte ; bouton de création ; accessible via `#profiles`
- [x] Construire le formulaire de création et d'édition de profil : nom, catégorie, mode d'alerte
- [x] Construire la vue détail d'un profil : onglets Informations / Photos / Cameras ; galerie de photos avec upload et suppression individuelle + statut sync Frigate ; liste des caméras liées avec toggle
- [x] Construire l'interface de configuration de détection par caméra : depuis `CameraOnboardingView`, endpoints `GET/PUT /cameras/{id}/detection-config`
- [x] Construire l'interface d'association profil-caméra : depuis le détail profil (onglet Cameras), liste des caméras avec checkbox ; cohérent avec `PUT /profiles/{id}/camera-links`
- [x] Construire la vue historique des détections : liste paginée d'événements avec label, identité reconnue, caméra, heure, lien snapshot ; filtres par caméra, label, profil, plage de dates ; accessible via `#history`
- [x] Permettre la correction d'une reconnaissance depuis la vue historique : bouton "Corriger" inline sur chaque événement avec dropdown profil, appel `PATCH /detection-events/{id}/identity`

#### Tests

- [x] Tests unitaires (NSubstitute, zéro DB) pour : `AddProfilePhotoUseCase`, `RemoveProfilePhotoUseCase`, `SetCameraProfileLinksUseCase`, `CorrectDetectionIdentityUseCase`
- [x] Tests d'intégration (SQLite in-memory, EnsureCreated) pour : `ProfilePhotoRepository`, `ProfileCameraLinkRepository` (upsert, unicité, suppression), `DetectionEventRepository.GetPagedAsync` (filtres, pagination), `UpdateIdentityAsync`
- [x] Tests de contrat FrigateAdapter (ADR-15) : vérifier que le ProfileId est résolu uniquement si le profil est lié à la caméra ; sans lien défini, la reconnaissance s'applique sur toutes les caméras

**Critères d'acceptation :**
- L'utilisateur peut créer un profil, y ajouter une ou plusieurs photos et voir la synchronisation confirmée vers Frigate depuis l'interface, sans ouvrir un terminal ni modifier un fichier
- L'utilisateur peut configurer, par caméra, les catégories de détection actives (personnes, animaux, véhicules, etc.) depuis l'interface ; la configuration est appliquée à Frigate sans intervention manuelle
- L'utilisateur peut associer des profils à des caméras spécifiques ; seuls les profils associés à une caméra sont candidats à la reconnaissance sur cette caméra
- Lorsque Frigate retourne un `sub_label` correspondant à un profil Vyzio associé à la caméra, l'événement apparaît avec le nom de la personne dans l'historique et dans les notifications
- L'utilisateur dispose d'une vue historique filtrée et paginée des détections, avec miniature, identité reconnue, caméra et heure, accessible sans passer par Frigate
- L'utilisateur peut corriger une reconnaissance erronée depuis l'historique en assignant ou retirant un profil d'un événement
- La suppression d'un profil supprime ses photos, retire ses associations caméra et préserve les événements historiques avec une référence neutre

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

### US-P3.8 — UI uniformisee, coherente et guidante
> But : mettre de la cohérence entre les pages, les noms, comportements, actions de navigation toujours au même endroit. La vue principale devra aussi être repensée pour guider l'utilisateur vers les actions de configuration ou la vue d'utilisation du système (feed live caméra, notifications, statuts).

**Taches :**

#### Audit et cadrage

- [ ] Auditer la cohérence cross-pages : terminologie (noms des actions, labels, statuts), patterns de navigation (boutons retour, accès aux sections), comportements des formulaires
- [ ] Identifier les composants UI dupliqués entre pages et définir les abstractions communes à extraire

#### Vue principale (hub)

- [ ] Repenser la vue principale pour orienter clairement l'utilisateur selon son état : première configuration (aucune caméra), système opérationnel (lien vers live feed), système dégradé (guidage vers la correction)
- [ ] Intégrer un accès rapide au live feed sur la vue principale une fois P3.7 livré
- [ ] Afficher sur la vue principale un résumé actionnable des statuts : caméras actives, profils synchronisés, dernière notification, alertes en attente

#### Guidage utilisateur — reconnaissance

- [ ] Avertir l'utilisateur si une caméra n'a plus `person` dans ses labels de détection alors qu'elle a des profils associés — la reconnaissance ne pourra pas s'exécuter sans ce label
- [ ] Donner un retour lors de l'upload d'une photo de profil si aucun visage n'est détectable dans l'image (photo de dos, qualité insuffisante, etc.)
- [ ] Afficher le nombre de photos par profil et une indication sur le minimum recommandé pour une reconnaissance fiable (3 à 5 photos, angles variés)
- [ ] Valider le flow end-to-end `sub_label` → profil : vérifier que lorsque Frigate pose un `sub_label` reconnu, l'événement remonte dans l'historique avec le nom du profil (non encore confirmé en conditions réelles)

#### Cohérence composants et navigation

- [ ] Uniformiser les patterns de navigation entre toutes les vues (position et libellé du bouton retour, fil d'Ariane, transitions)
- [ ] Harmoniser les composants de feedback (messages d'erreur, états de chargement, confirmations) pour qu'ils aient le même rendu et le même comportement quelle que soit la page


### US-P3.9 - Privacy mode
> But : permettre à l'utilisateur de couper une caméra temporairement ou de manière récurrente (ex. tous les soirs de 22h à 6h) pour préserver la vie privée, avec un impact minimal sur les autres fonctionnalités (notifications, reconnaissance, etc.) et une indication claire du statut de confidentialité de chaque caméra. La caméra doit réellement être coupé et le flux RTSP ne doit être visible de personne sur le réseau, y compris de Frigate.

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
