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

- [ ] Introduire le modèle de photo de profil dans `Core` et `Infrastructure` : entité ou value object portant la référence fichier, le statut de synchronisation vers Frigate et la date d'ajout ; repository dédié ou extension de `IProfileRepository`
- [ ] Introduire la configuration de détection par caméra dans `Core` et `Infrastructure` : entité portant la liste des labels activés par caméra (`CameraDetectionConfig`), repository dédié, migration EF Core
- [ ] Introduire l'association profil-caméra dans `Core` et `Infrastructure` : entité de jointure `ProfileCameraLink` (profile_id, camera_id, enabled), repository, migration EF Core
- [ ] Étendre le schéma SQLite via migrations EF Core pour les trois nouvelles entités, sans rupture des tables existantes

#### Use cases backend

- [ ] Implémenter `AddProfilePhotoUseCase` : valider et stocker la photo localement, déclencher la synchronisation vers la bibliothèque de reconnaissance Frigate via l'API REST Frigate, retourner le statut de sync
- [ ] Implémenter `RemoveProfilePhotoUseCase` : supprimer la photo locale et retirer l'entrée correspondante de la bibliothèque Frigate
- [ ] Implémenter `GetCameraDetectionConfigUseCase` et `SaveCameraDetectionConfigUseCase` : lire et écrire la liste des labels actifs par caméra ; déclencher la regénération de `frigate.yml` via le `CameraConfigWriter` existant si la config change
- [ ] Implémenter `LinkProfileToCameraUseCase` et `UnlinkProfileFromCameraUseCase` : créer ou désactiver l'association profil-caméra, mettre à jour le statut produit visible par l'UI
- [ ] Implémenter `GetDetectionHistoryUseCase` : requête paginée sur `observed_events` avec filtres combinables (camera, label, profile_id, plage de dates), triée par `occurred_at` décroissant
- [ ] Implémenter `CorrectDetectionIdentityUseCase` : permettre de lier ou délier un événement de détection à un profil existant, mettre à jour `profile_id` et `identity` dans `observed_events`, invalider le cache du profil concerné
- [ ] Étendre `ProfileRulesService` pour appliquer les associations profil-caméra lors de la résolution des règles métier : une reconnaissance Frigate (`sub_label`) n'est mappée vers un profil Vyzio que si ce profil est associé à la caméra concernée

#### API

- [ ] Exposer les endpoints photo de profil : `POST /api/profiles/{id}/photos` (upload multipart), `DELETE /api/profiles/{id}/photos/{photoId}` ; inclure le statut de sync Frigate dans la réponse
- [ ] Exposer les endpoints de configuration détection par caméra : `GET /api/cameras/{id}/detection-config`, `PUT /api/cameras/{id}/detection-config` avec validation des labels connus
- [ ] Exposer les endpoints d'association profil-caméra : `GET /api/cameras/{id}/profile-links`, `PUT /api/cameras/{id}/profile-links` (liste complète, idempotent), `GET /api/profiles/{id}/camera-links`
- [ ] Exposer l'endpoint historique détections filtré et paginé : `GET /api/detection-events?camera=&label=&profileId=&from=&to=&page=&limit=` avec en-têtes de pagination standard
- [ ] Exposer l'endpoint de correction de reconnaissance : `PATCH /api/detection-events/{id}/identity` avec `{ profileId: string | null }`

#### Interface utilisateur

- [ ] Construire la page de gestion des profils (liste complète) : afficher tous les profils avec nom, catégorie, mode d'alerte, date de dernière apparition, nombre de photos ; lien vers le détail ; bouton de création
- [ ] Construire le formulaire de création et d'édition de profil : nom, catégorie, mode d'alerte, upload de une ou plusieurs photos avec prévisualisation et statut de synchronisation Frigate
- [ ] Construire la vue détail d'un profil : informations du profil, galerie de photos avec possibilité de suppression individuelle, liste paginée des dernières apparitions avec miniature et caméra source, liste des caméras auxquelles le profil est associé
- [ ] Construire l'interface de configuration de détection par caméra : accessible depuis le détail caméra, afficher les labels Frigate disponibles sous forme de toggles (person, car, dog, cat, etc.), sauvegarder et déclencher la regénération Frigate
- [ ] Construire l'interface d'association profil-caméra : depuis le détail caméra, afficher la liste des profils existants avec toggle actif/inactif par profil ; depuis le détail profil, afficher la liste des caméras avec toggle ; les deux vues sont cohérentes
- [ ] Construire la vue historique des détections : liste paginée d'événements avec miniature, label, identité reconnue, nom de caméra, heure ; filtres par caméra, label et profil ; accessible depuis le menu principal
- [ ] Permettre la correction d'une reconnaissance depuis la vue historique : afficher un menu contextuel sur chaque événement permettant d'assigner ou de retirer un profil, avec confirmation visuelle immédiate

#### Tests

- [ ] Tests unitaires (NSubstitute, zéro DB) pour : `AddProfilePhotoUseCase`, `SaveCameraDetectionConfigUseCase`, `LinkProfileToCameraUseCase`, `GetDetectionHistoryUseCase`, `CorrectDetectionIdentityUseCase`, la logique de filtrage dans `ProfileRulesService`
- [ ] Tests d'intégration (SQLite in-memory, EnsureCreated) pour : les migrations des nouvelles tables, les requêtes filtrées sur `observed_events`, la cohérence des associations profil-caméra après upsert
- [ ] Tests de contrat MQTT : vérifier que `ProfileRulesService` ne mappe un `sub_label` Frigate vers un profil que si l'association profil-caméra est active pour la caméra concernée

#### Documentation utilisateur

- [ ] Rédiger la documentation utilisateur de gestion des profils : ajouter une personne, uploader des photos, modifier et supprimer un profil, comprendre le statut de synchronisation Frigate
- [ ] Rédiger la documentation utilisateur de configuration de détection : activer ou désactiver des catégories par caméra, associer des profils à des caméras, comprendre les limites de la reconnaissance faciale locale

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
TODO

### US-P3.8 — UI uniformisee, coherent et guidant
> But : mettre de la cohérence entre les pages, les noms, comportements, actions de navigation toujours au même endroit ... La vue principale devra aussi être repensé pour guider l'utilisateur vers les actions de configuration ou la vue d'utilisation du système (feed live camera, notifications, statuts ...)

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
