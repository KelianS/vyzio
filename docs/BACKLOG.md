# Vyzio — Backlog d'implémentation

> Mai 2026 — Document vivant  
> Référence : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md)

---

## Principes d'ordonnancement

1. **Frigate d'abord** — le pipeline vidéo est le fondement de tout le reste
2. **Bus MQTT ensuite** — la colonne vertébrale des événements
3. **IA au centre** — la reconnaissance faciale est la valeur ajoutée différenciante
4. **API + Dashboard en dernier** — une fois le backend solide

---

## Vue d'ensemble des épiques

| # | Épique | Dépendances | Priorité |
|---|---|---|:---:|
| E1 | Infrastructure & Frigate | — | 🔴 Critique |
| E2 | FrigateAdapter + Bus MQTT | E1 | 🔴 Critique |
| E3 | Face Recognition Worker (Python) | E1 | 🔴 Critique |
| E4 | Profile Service + Reconnaissance | E2, E3 | 🔴 Critique |
| E5 | Storage Service | E2 | 🟠 Haute |
| E6 | Notification Service | E4 | 🟠 Haute |
| E7 | API REST + SignalR | E4, E5, E6 | 🟠 Haute |
| E8 | Dashboard React | E7 | 🟡 Moyenne |
| E9 | Authentification & Sécurité | E7 | 🟠 Haute |
| E10 | Accès distant & Tunnels | E6, E9 | 🟡 Moyenne |
| E11 | Packaging & Déploiement | Tous | 🟡 Moyenne |

---

## E1 — Infrastructure & Frigate

> **Objectif** : un environnement Docker Compose fonctionnel avec Frigate accessible et configuré, base de données Vyzio initialisée.

### US-1.1 — Structure du monorepo

**En tant que** développeur, je veux une structure de dépôt cohérente avec les répertoires définis dans le SAD, afin de travailler dans un environnement organisé dès le départ.

**Tâches :**
- [ ] Créer la structure `services/vyzio/`, `services/face-worker/`, `dashboard/`, `proto/`, `config/`, `docs/`
- [ ] Initialiser la solution .NET 10 : `Vyzio.Core`, `Vyzio.Api`, `Vyzio.Infrastructure`, `Vyzio.Tests`
- [ ] Initialiser le projet React + TypeScript + Vite dans `dashboard/`
- [ ] Initialiser le projet Python `face-worker/` avec `pyproject.toml` (uv ou poetry)
- [ ] Ajouter `.gitignore`, `README.md` racine, `CONTRIBUTING.md`

**Critères d'acceptation :**
- `dotnet build` passe sans erreur
- `npm run dev` démarre le dashboard
- La structure correspond à l'Annexe B du SAD

---

### US-1.2 — Docker Compose de base

**En tant que** développeur, je veux un `docker-compose.yml` fonctionnel incluant Frigate, Mosquitto et PostgreSQL, afin de démarrer l'environnement complet en une seule commande.

**Tâches :**
- [ ] Ajouter le service `frigate` (image `ghcr.io/blakeblackshear/frigate:stable`)
- [ ] Ajouter le service `postgres` (image `postgres:17-alpine`)
- [ ] Configurer le réseau Docker interne `vyzio-net` (non exposé à l'extérieur)
- [ ] Exposer uniquement le port `8443` (Vyzio API) depuis l'hôte
- [ ] Lier Frigate sur `127.0.0.1:5000` (non routable depuis l'extérieur du Docker)
- [ ] Configurer les volumes : `frigate-data`, `postgres-data`, `vyzio-config`
- [ ] Ajouter le service `face-worker` (build local) sur le réseau interne uniquement
- [ ] Ajouter un `docker-compose.override.yml` pour le dev (hot-reload, ports exposés pour debug)

**Critères d'acceptation :**
- `docker compose up` démarre tous les services sans erreur
- Frigate UI accessible sur `localhost:5000` depuis l'hôte (dev uniquement)
- PostgreSQL accessible depuis le service `vyzio` sur le réseau interne

---

### US-1.3 — Configuration Frigate de base

**En tant que** développeur, je veux un template `frigate.yml` minimal valide, afin de valider que Frigate ingère correctement un flux RTSP de test.

**Tâches :**
- [ ] Créer `config/frigate.yml.template` avec la structure de base (MQTT, détecteurs, caméras placeholder)
- [ ] Configurer MQTT dans Frigate (broker : `localhost:1883`, inclus dans Frigate)
- [ ] Configurer un détecteur CPU par défaut (`detector: cpu`)
- [ ] Valider avec une caméra de test (flux RTSP public ou `ffmpeg` dummy stream)
- [ ] Documenter les variables à substituer lors de l'onboarding

**Critères d'acceptation :**
- Frigate démarre et se connecte au broker MQTT
- Les événements `frigate/events` apparaissent sur MQTT lors d'une détection
- Les thumbnails sont générés et accessibles via `GET http://frigate:5000/api/{event_id}/thumbnail.jpg`

**Références SAD :** ADR-01, §8.2

---

### US-1.4 — Base de données Vyzio + migrations EF Core

**En tant que** développeur, je veux que le schéma Vyzio soit créé automatiquement au démarrage via EF Core Migrations, afin de ne pas gérer le DDL manuellement.

**Tâches :**
- [ ] Configurer EF Core dans `Vyzio.Infrastructure` avec dual-provider (PostgreSQL / SQLite)
- [ ] Lire le provider depuis `vyzio.yml` (`database.provider`)
- [ ] Créer les entités EF Core : `Profile`, `RecognitionEvent`, `Notification`, `Session`, `Setting`
- [ ] Générer la migration initiale `InitialSchema`
- [ ] Appliquer les migrations automatiquement au démarrage (`MigrateAsync()`)
- [ ] Ajouter les index définis dans le SAD (§7.2)
- [ ] Ajouter un `docker-compose.override.yml` qui expose PostgreSQL sur `5432` pour le dev

**Critères d'acceptation :**
- `dotnet ef database update` crée le schéma complet
- Le schéma correspond exactement au §7.2 du SAD
- Les migrations s'appliquent automatiquement au démarrage du service Vyzio
- Le switch SQLite ↔ PostgreSQL fonctionne via `vyzio.yml` sans changer le code

**Références SAD :** ADR-06, §7.2

---

## E2 — FrigateAdapter + Bus MQTT

> **Objectif** : Vyzio consomme les événements Frigate via MQTT et les publie sur les topics Vyzio.

### US-2.1 — Client MQTT Vyzio

**En tant que** service Vyzio, je veux me connecter au broker MQTT de Frigate, afin de consommer ses événements et publier les miens.

**Tâches :**
- [ ] Ajouter le package `MQTTnet` dans `Vyzio.Infrastructure`
- [ ] Implémenter `IMqttBusService` : connect, subscribe, publish, reconnexion automatique
- [ ] Configurer la connexion via `vyzio.yml` (`mqtt.host`, `mqtt.port`)
- [ ] Enregistrer le service comme `IHostedService` dans le DI
- [ ] Tester la connexion avec un simple subscriber sur `frigate/#`

**Critères d'acceptation :**
- Le service se connecte au broker au démarrage
- Reconnexion automatique en cas de perte de connexion (backoff exponentiel)
- Les logs indiquent clairement l'état de connexion

---

### US-2.2 — FrigateAdapter : consommation des événements Frigate

**En tant que** FrigateAdapter, je veux souscrire aux topics `frigate/events` et `frigate/{camera}/motion`, afin de détecter les événements de présence humaine.

**Tâches :**
- [ ] Implémenter `FrigateAdapter : IHostedService` dans `Vyzio.Infrastructure`
- [ ] Désérialiser les payloads MQTT Frigate en `FrigateEvent` (type, label, camera, snapshot_path, thumbnail_path, start_time)
- [ ] Filtrer uniquement les événements `label == "person"` et `type == "new"`
- [ ] Télécharger le thumbnail via `GET http://frigate:5000/api/{event_id}/thumbnail.jpg` (HttpClient)
- [ ] Transformer en `RawDetectionEvent` (domaine Vyzio) et publier sur `vyzio/events/raw_detection`
- [ ] Logger les événements reçus et publiés

**Critères d'acceptation :**
- Quand Frigate publie une détection `person`, Vyzio publie sur `vyzio/events/raw_detection`
- Le thumbnail est inclus en base64 dans le payload
- Les événements non-pertinents (car, dog, etc.) sont ignorés
- L'adapter est la **seule** classe couplée à Frigate dans la codebase

**Références SAD :** ADR-04, §6.2

---

### US-2.3 — Topics MQTT Vyzio : contrat et documentation

**En tant que** développeur, je veux que les topics MQTT Vyzio soient documentés et validés, afin que tous les services puissent s'y souscrire de façon fiable.

**Tâches :**
- [ ] Documenter les topics dans `docs/MQTT_TOPICS.md` (payload JSON + schéma)
- [ ] Créer des constantes typées `VyzioTopics` dans `Vyzio.Core`
- [ ] Créer les records/DTOs correspondants aux payloads de chaque topic

**Topics à implémenter :**
```
vyzio/events/raw_detection      → { frigate_event_id, camera, thumbnail_b64, timestamp }
vyzio/events/face_recognized    → { profile_id, name, confidence, camera, thumbnail_b64, timestamp }
vyzio/events/face_unknown       → { camera, thumbnail_b64, timestamp }
vyzio/events/face_uncertain     → { profile_candidate_id, confidence, camera, thumbnail_b64, timestamp }
vyzio/events/camera_status      → { camera, status: online|offline|error }
```

**Critères d'acceptation :**
- Tous les payloads sont désérialisables sans erreur
- Les constantes de topics sont utilisées partout (zéro string hardcodée)

---

## E3 — Face Recognition Worker (Python)

> **Objectif** : un service gRPC Python qui reçoit une image JPEG et retourne les embeddings + bounding boxes.

### US-3.1 — Contrat Protobuf partagé

**En tant que** développeur, je veux un fichier `.proto` unique partagé entre .NET et Python, afin que les deux services parlent le même langage sans désynchronisation.

**Tâches :**
- [ ] Créer `proto/face_recognition.proto` avec les messages définis dans l'ADR-03
- [ ] Configurer la génération de code .NET depuis le `.proto` (`Grpc.Tools`)
- [ ] Configurer la génération de code Python depuis le `.proto` (`grpcio-tools`)
- [ ] Ajouter la génération de code dans les build steps CI

**Références SAD :** ADR-03

---

### US-3.2 — Serveur gRPC Python (Face Worker)

**En tant que** service Python, je veux exposer un serveur gRPC sur le port `50051`, afin que Vyzio Core puisse m'envoyer des images à analyser.

**Tâches :**
- [ ] Initialiser le projet Python avec `uv` : `insightface`, `onnxruntime`, `grpcio`, `grpcio-tools`, `Pillow`, `numpy`
- [ ] Implémenter `server.py` : serveur gRPC asyncio, écoute sur `0.0.0.0:50051`
- [ ] Implémenter `recognizer.py` : chargement InsightFace (`buffalo_l` ou `buffalo_s` selon CPU), méthodes `detect_faces()` et `compute_embedding()`
- [ ] Implémenter le handler `Recognize(image_jpeg)` → `RecognizeResponse`
- [ ] Implémenter le handler `ComputeEmbedding(image_jpeg)` → `EmbeddingResponse`
- [ ] Gérer les erreurs (pas de visage détecté, image corrompue)
- [ ] Health check gRPC (`grpc_health_checking`)
- [ ] Dockerfile multi-stage : build + image production slim

**Critères d'acceptation :**
- `Recognize()` retourne les embeddings (512 dims) et bounding boxes pour chaque visage détecté
- `ComputeEmbedding()` retourne l'embedding d'un visage seul (pour la création de profil)
- Seuil de confiance par défaut : 0.85 (configurable via env var)
- Le worker démarre en < 30s (chargement du modèle)
- Le worker est **stateless** : pas de connexion DB, pas de connexion MQTT

**Références SAD :** ADR-03, §4.4

---

### US-3.3 — Client gRPC .NET → Face Worker

**En tant que** service .NET, je veux appeler le Face Worker via gRPC, afin de déléguer le calcul d'embeddings sans dépendre de Python directement.

**Tâches :**
- [ ] Ajouter `Grpc.Net.Client` dans `Vyzio.Infrastructure`
- [ ] Implémenter `IFaceRecognitionClient` (interface dans `Vyzio.Core`)
- [ ] Implémenter `GrpcFaceRecognitionClient` dans `Vyzio.Infrastructure`
- [ ] Configurer l'endpoint via `vyzio.yml` (`face_worker.grpc_endpoint`)
- [ ] Retry policy : 3 tentatives avec backoff (Polly)
- [ ] Timeout : 5s par requête

**Critères d'acceptation :**
- Un test d'intégration appelle le worker avec une image de test et reçoit des embeddings valides
- Les erreurs gRPC sont gérées proprement (worker indisponible → exception métier)

---

## E4 — Profile Service + Face Recognition Service

> **Objectif** : gestion CRUD des profils, calcul et stockage des embeddings, comparaison cosinus SIMD pour l'identification.

### US-4.1 — Profile Service : CRUD des profils

**En tant que** service, je veux créer, lire, mettre à jour et supprimer des profils de personnes, afin de maintenir la base de référence pour la reconnaissance.

**Tâches :**
- [ ] Implémenter `IProfileService` dans `Vyzio.Core`
- [ ] `CreateProfile(name, category, alertMode, imageJpeg[])` → valide que chaque image contient exactement 1 visage (via gRPC), calcule les embeddings, persiste
- [ ] `GetProfile(id)`, `ListProfiles()`, `UpdateProfile(id, ...)`, `DeleteProfile(id)`
- [ ] La suppression efface les embeddings + tous les `RecognitionEvent` associés (RGPD)
- [ ] Les photos brutes ne sont **pas** persistées après calcul des embeddings
- [ ] Chargement de tous les embeddings en mémoire au démarrage pour la comparaison SIMD

**Critères d'acceptation :**
- Un profil créé avec une photo valide est reconnaissable dans le pipeline de détection
- La suppression d'un profil supprime en cascade tous ses événements
- Les photos brutes ne sont jamais stockées sur disque

**Références SAD :** §5.2, §5.3, §9.4

---

### US-4.2 — Face Recognition Service : pipeline de reconnaissance

**En tant que** service, je veux souscrire aux événements `vyzio/events/raw_detection`, analyser les visages, et publier le résultat (connu/inconnu/incertain), afin de déclencher les notifications appropriées.

**Tâches :**
- [ ] Implémenter `FaceRecognitionService : IHostedService` dans `Vyzio.Core`
- [ ] Souscrire MQTT `vyzio/events/raw_detection`
- [ ] Pour chaque événement : appeler `IFaceRecognitionClient.Recognize(thumbnail)`
- [ ] Pour chaque visage détecté : calculer la similarité cosinus vs tous les embeddings en mémoire (`System.Numerics.Tensors`)
- [ ] Seuil > 0.60 → `face_recognized`, entre 0.50 et 0.60 → `face_uncertain`, < 0.50 → `face_unknown`
- [ ] Publier le résultat sur le topic MQTT approprié
- [ ] Si plusieurs visages dans la frame : traiter chacun indépendamment
- [ ] Gérer l'idempotence (même `frigate_event_id` reçu deux fois)

**Critères d'acceptation :**
- Alice détectée → `vyzio/events/face_recognized` publié avec son `profile_id` et `confidence`
- Inconnu détecté → `vyzio/events/face_unknown` publié
- Score proche du seuil → `vyzio/events/face_uncertain`
- Latence totale (thumbnail reçu → MQTT publié) < 500ms sur CPU seul

**Références SAD :** §4.2, §4.5, §6.2

---

### US-4.3 — Confirmation / correction depuis notification

**En tant qu'** utilisateur, je veux confirmer ou corriger une reconnaissance depuis la notification, afin d'améliorer la précision au fil du temps.

**Tâches :**
- [ ] Endpoint API `POST /api/events/{id}/confirm` (confirme le profil identifié)
- [ ] Endpoint API `POST /api/events/{id}/correct` (associe un autre profil)
- [ ] Quand confirmation : ajouter le thumbnail comme référence additionnelle pour l'embedding (opt-in)
- [ ] Boutons inline dans la notification Telegram (callback queries)

**Critères d'acceptation :**
- Une confirmation enrichit les embeddings du profil concerné
- Une correction met à jour l'événement et peut enrichir le bon profil

**Références SAD :** §5.4, §4.1

---

## E5 — Storage Service

> **Objectif** : persistance de tous les événements enrichis (reconnaissance, statut caméra, notifications envoyées).

### US-5.1 — Persistance des événements de reconnaissance

**En tant que** service, je veux persister chaque événement de reconnaissance dans la base de données, afin de constituer l'historique consultable depuis le dashboard.

**Tâches :**
- [ ] Implémenter `StorageService : IHostedService` dans `Vyzio.Core`
- [ ] Souscrire MQTT : `vyzio/events/face_recognized`, `face_unknown`, `face_uncertain`
- [ ] Insérer un `RecognitionEvent` en base pour chaque événement reçu
- [ ] Stocker le thumbnail JPEG en base (ou sur le filesystem selon la config)
- [ ] Idempotence : vérifier l'existence via `frigate_event_id` avant insertion

**Critères d'acceptation :**
- Chaque détection est persistée en moins de 100ms
- Le dashboard peut lire l'historique paginé sans requête N+1

---

### US-5.2 — Politique de rétention automatique

**En tant qu'** utilisateur, je veux que les événements au-delà de la durée de rétention configurée soient supprimés automatiquement, afin de ne pas saturer le stockage.

**Tâches :**
- [ ] Lire la durée de rétention depuis `settings` (ex. 30 jours)
- [ ] Job de nettoyage quotidien (HostedService / BackgroundService)
- [ ] Supprimer les `RecognitionEvent` plus anciens que la durée configurée
- [ ] Logger le nombre d'événements supprimés
- [ ] Alerter (dashboard) si l'espace disque dépasse 80%

**Références SAD :** §7.4

---

## E6 — Notification Service

> **Objectif** : envoi des notifications via Telegram (prioritaire), Discord, FCM, ntfy, webhook, email.

### US-6.1 — Notification Service : orchestrateur

**En tant que** service, je veux souscrire aux événements de reconnaissance et décider quelles notifications envoyer selon les règles configurées, afin d'éviter les alertes intempestives.

**Tâches :**
- [ ] Implémenter `NotificationService : IHostedService` dans `Vyzio.Core`
- [ ] Souscrire MQTT : `vyzio/events/face_recognized`, `face_unknown`, `camera_status`
- [ ] Implémenter `RuleEngine` : vérifier `alert_mode` du profil, plages horaires, rate-limit (30s par défaut)
- [ ] Dispatcher vers les `INotificationChannel` configurés
- [ ] Logger chaque notification envoyée dans la table `notifications`
- [ ] Gérer la file locale si Internet est indisponible (retry à la reconnexion)

**Critères d'acceptation :**
- Mode `silent` → aucune notification envoyée
- Mode `ignore` → aucun événement créé
- Rate-limit respecté (pas deux notifications du même type sur la même caméra en < 30s)
- Plages horaires respectées

**Références SAD :** §6.4, ADR-09

---

### US-6.2 — Canal Telegram Bot

**En tant qu'** utilisateur, je veux recevoir les alertes sur Telegram avec la photo de détection, afin de voir immédiatement qui est à ma porte.

**Tâches :**
- [ ] Implémenter `TelegramNotificationChannel : INotificationChannel`
- [ ] Appeler `sendPhoto` API Telegram avec le thumbnail JPEG
- [ ] Caption : `"{Nom} est arrivé·e • {Caméra} • {HH:mm}"` (ou "Visage inconnu" si inconnu)
- [ ] Boutons inline (Telegram `InlineKeyboardMarkup`) : "✅ Confirmer" / "❌ Corriger" pour les événements `face_uncertain`
- [ ] Gérer les réponses de callback Telegram (webhook ou polling long)
- [ ] Configurer via `settings` : `telegram.bot_token`, `telegram.chat_id`
- [ ] Test de connexion depuis le dashboard ("Envoyer un message de test")

**Critères d'acceptation :**
- Message reçu sur Telegram avec la photo visible dans les 3s après détection
- La photo est visible hors réseau local sans configuration supplémentaire
- Les boutons de confirmation fonctionnent

**Références SAD :** ADR-09, §6.3

---

### US-6.3 — Canal Discord Webhook

**En tant qu'** utilisateur, je veux recevoir les alertes sur mon serveur Discord avec la photo de détection.

**Tâches :**
- [ ] Implémenter `DiscordNotificationChannel : INotificationChannel`
- [ ] Envoyer un embed Discord avec la photo (multipart form)
- [ ] Configurer via `settings` : `discord.webhook_url`

**Critères d'acceptation :**
- Message Discord avec embed et image reçu < 3s après détection

---

### US-6.4 — Canal FCM (push natif Android/iOS)

**En tant qu'** utilisateur, je veux recevoir une notification push système sur mon téléphone.

**Tâches :**
- [ ] Implémenter `FcmNotificationChannel : INotificationChannel`
- [ ] Payload : titre + corps + URL signée HMAC du thumbnail (TTL 5 min)
- [ ] Configurer via `settings` : `fcm.server_key`, `fcm.device_tokens[]`
- [ ] Générer l'URL signée via `SignedUrlService` (HMAC-SHA256)

**Critères d'acceptation :**
- Notification push reçue sur Android/iOS
- L'URL de la photo expire après 5 minutes

**Références SAD :** §6.6, ADR-09

---

### US-6.5 — Canaux ntfy + Webhook générique + Email

**En tant qu'** utilisateur avancé, je veux des canaux de notification alternatifs (ntfy, webhook, email).

**Tâches :**
- [ ] Implémenter `NtfyNotificationChannel` : HTTP POST avec attachment JPEG
- [ ] Implémenter `WebhookNotificationChannel` : HTTP POST JSON avec URL signée thumbnail
- [ ] Implémenter `EmailNotificationChannel` : SMTP avec photo en pièce jointe (MailKit)
- [ ] Configurer via `settings`

---

## E7 — API REST + SignalR

> **Objectif** : l'API ASP.NET Core expose tous les endpoints nécessaires au dashboard et aux intégrations tierces.

### US-7.1 — Authentification JWT

**En tant qu'** utilisateur, je veux protéger le dashboard par mot de passe, afin qu'un visiteur sur mon réseau ne puisse pas accéder à mes enregistrements.

**Tâches :**
- [ ] `POST /api/auth/login` : vérifie mot de passe (bcrypt cost 12), retourne access token (JWT 15 min) + refresh token (7 jours)
- [ ] `POST /api/auth/refresh` : échange un refresh token valide contre un nouveau pair
- [ ] `DELETE /api/auth/logout` : révoque le refresh token en base
- [ ] Rate limiting : 5 tentatives / 15 min / IP (`AspNetCoreRateLimit`)
- [ ] Middleware d'authentification JWT sur toutes les routes sauf `/api/auth/*`
- [ ] TLS : certificat auto-signé généré au premier démarrage (Trust On First Use)
- [ ] Stocker le hash du mot de passe dans `settings`

**Critères d'acceptation :**
- Impossible d'accéder à l'API sans JWT valide
- Après 5 tentatives échouées, l'IP est bloquée 15 minutes
- Le logout invalide immédiatement le refresh token

**Références SAD :** ADR-10, §9.2

---

### US-7.2 — Endpoints Caméras

**En tant qu'** utilisateur, je veux gérer mes caméras via l'API.

**Tâches :**
- [ ] `GET /api/cameras` — liste + état (proxyfie Frigate REST)
- [ ] `POST /api/cameras` — ajoute une caméra (valide + écrit `frigate.yml` + reload Frigate)
- [ ] `DELETE /api/cameras/{id}` — supprime une caméra
- [ ] `GET /api/cameras/{id}/live` — proxy HLS Frigate (streaming, auth Vyzio obligatoire)
- [ ] `GET /api/cameras/{id}/snapshot` — proxy thumbnail live Frigate
- [ ] `POST /api/cameras/scan` — déclenche un scan ONVIF réseau (via Frigate)

**Critères d'acceptation :**
- Le flux live HLS est accessible depuis le dashboard sans que Frigate soit exposé directement
- L'ajout d'une caméra démarre la surveillance en < 10s

---

### US-7.3 — Endpoints Profils

**En tant qu'** utilisateur, je veux gérer les profils de personnes via l'API.

**Tâches :**
- [ ] `GET /api/profiles` — liste tous les profils
- [ ] `POST /api/profiles` — upload photo(s) → calcul embedding → création
- [ ] `GET /api/profiles/{id}` — détail + dernière apparition
- [ ] `PATCH /api/profiles/{id}` — mise à jour nom/catégorie/alertMode
- [ ] `DELETE /api/profiles/{id}` — suppression + cascade événements
- [ ] `POST /api/profiles/{id}/photos` — ajout de photos de référence

**Critères d'acceptation :**
- Un profil créé est immédiatement actif (embeddings chargés en mémoire)
- Les embeddings ne sont jamais inclus dans les réponses API

---

### US-7.4 — Endpoints Événements & Historique

**En tant qu'** utilisateur, je veux accéder à l'historique des détections via l'API.

**Tâches :**
- [ ] `GET /api/events` — paginé, filtres : `camera`, `profile_id`, `type`, `from`, `to`
- [ ] `GET /api/events/{id}/thumbnail` — proxy thumbnail + validation URL signée (accès distant)
- [ ] `POST /api/events/{id}/confirm` — confirme la reconnaissance
- [ ] `POST /api/events/{id}/correct` — corrige le profil associé
- [ ] `GET /api/clips/{id}` — proxy clip MP4 Frigate (streaming HTTP range requests)
- [ ] `GET /api/clips/{id}/download` — téléchargement du clip

**Critères d'acceptation :**
- La pagination fonctionne correctement (cursor-based ou offset)
- Le streaming des clips fonctionne sans buffering mémoire (HttpClient streaming)

---

### US-7.5 — Hub SignalR (événements temps réel)

**En tant que** dashboard, je veux recevoir les événements en temps réel via WebSocket, afin de mettre à jour l'interface sans polling.

**Tâches :**
- [ ] Implémenter `EventsHub : Hub` (SignalR)
- [ ] Souscrire MQTT `vyzio/events/*` dans un `IHostedService` → push SignalR vers tous les clients connectés
- [ ] Authentification JWT sur le hub SignalR
- [ ] Events poussés : `face_recognized`, `face_unknown`, `face_uncertain`, `camera_status`

**Critères d'acceptation :**
- Le dashboard reçoit un événement SignalR < 200ms après la publication MQTT
- La reconnexion SignalR est automatique (gérée par le client `@microsoft/signalr`)

---

### US-7.6 — Endpoints Paramètres

**En tant qu'** utilisateur, je veux configurer Vyzio depuis le dashboard.

**Tâches :**
- [ ] `GET /api/settings` — retourne la configuration active (sans secrets)
- [ ] `PATCH /api/settings` — met à jour les paramètres (notifications, rétention, seuils IA)
- [ ] `POST /api/settings/notifications/test` — envoie un message de test sur tous les canaux configurés

---

## E8 — Dashboard React

> **Objectif** : interface grand public, mobile-first, 5 vues définies dans les specs.

### US-8.1 — Setup & architecture frontend

**Tâches :**
- [ ] Vite + React 19 + TypeScript strict
- [ ] Tanstack Router (routing typé)
- [ ] Tanstack Query (fetching/cache)
- [ ] Shadcn/ui + Tailwind CSS
- [ ] `@microsoft/signalr` pour le hub événements
- [ ] Client API typé (généré depuis OpenAPI Scalar ou codegen)
- [ ] Layout responsive mobile-first

---

### US-8.2 — Vue Accueil

**En tant qu'** utilisateur, je veux voir l'état global du système et les derniers événements dès l'ouverture du dashboard.

**Tâches :**
- [ ] Indicateur "Tout fonctionne" ou liste des alertes actives
- [ ] Feed des événements du jour (live via SignalR)
- [ ] Accès rapide "Visages inconnus"
- [ ] Compteur de caméras actives / en erreur

**Références SPECS :** §8.2 Vue 1

---

### US-8.3 — Vue Caméras

**En tant qu'** utilisateur, je veux voir mes caméras et gérer les zones de détection.

**Tâches :**
- [ ] Liste caméras avec miniature live (snapshot polling ou HLS)
- [ ] Clic → flux live plein écran (HLS player, ex. `hls.js`)
- [ ] Overlay zones de détection polygonales (React-Konva)
- [ ] Outil de dessin de zones polygonales sur l'image
- [ ] Gestion des plages horaires par zone
- [ ] Statut en temps réel (SignalR `camera_status`)

**Références SPECS :** §8.2 Vue 2, §3.4

---

### US-8.4 — Vue Personnes (Profils)

**En tant qu'** utilisateur, je veux gérer les profils depuis le dashboard.

**Tâches :**
- [ ] Liste des profils : photo miniature, nom, dernière apparition, badge catégorie
- [ ] Formulaire de création : upload drag & drop, validation visage, choix catégorie + alertMode
- [ ] Édition inline du nom et des paramètres
- [ ] Suppression avec confirmation (mention RGPD)
- [ ] Upload de photos supplémentaires pour enrichir un profil

**Références SPECS :** §8.2 Vue 3

---

### US-8.5 — Vue Historique

**En tant qu'** utilisateur, je veux consulter l'historique des événements avec les clips vidéo.

**Tâches :**
- [ ] Timeline paginée par jour
- [ ] Filtres : caméra, personne, type d'événement, plage de dates
- [ ] Clic sur événement → modal avec clip vidéo + visage + détails
- [ ] Lecteur vidéo intégré (MP4)
- [ ] Bouton "Télécharger ce clip"
- [ ] Boutons confirmer/corriger pour les événements incertains

**Références SPECS :** §8.2 Vue 4

---

### US-8.6 — Vue Paramètres

**En tant qu'** utilisateur, je veux configurer tous les canaux de notification et la politique de rétention depuis le dashboard.

**Tâches :**
- [ ] Section notifications : formulaires par canal (Telegram, Discord, FCM, ntfy, webhook, email)
- [ ] Bouton "Tester" pour chaque canal
- [ ] Politique de rétention vidéo (slider jours)
- [ ] Paramètres IA : seuils de détection et reconnaissance
- [ ] Gestion du compte : changement de mot de passe

**Références SPECS :** §8.2 Vue 5

---

### US-8.7 — Onboarding guidé (premier démarrage)

**En tant qu'** utilisateur non-technicien, je veux être guidé étape par étape lors du premier démarrage.

**Tâches :**
- [ ] Écran "Bienvenue dans Vyzio"
- [ ] Étape 1 : définir un mot de passe
- [ ] Étape 2 : scan réseau ONVIF → sélection caméra(s) → nommage → test flux
- [ ] Étape 3 : ajouter un premier profil (optionnel, "Passer pour l'instant")
- [ ] Étape 4 : configurer un canal de notification + test
- [ ] Fin : redirection vers l'accueil

**Références SAD :** §8.2

---

## E9 — Authentification & Sécurité

> Cette épique consolide les éléments de sécurité transversaux.

### US-9.1 — TLS auto-signé (Trust On First Use)

**Tâches :**
- [ ] Générer un certificat auto-signé au premier démarrage (via `dotnet dev-certs` ou `BouncyCastle`)
- [ ] Stocker le certificat sur le volume persistant
- [ ] Configurer Kestrel pour TLS obligatoire sur `8443`
- [ ] Afficher le fingerprint dans les logs pour vérification manuelle

---

### US-9.2 — Chiffrement des credentials caméra

**Tâches :**
- [ ] Chiffrer les URL RTSP (avec credentials) via `Microsoft.AspNetCore.DataProtection`
- [ ] Les credentials ne sont jamais retournés en clair par l'API

---

### US-9.3 — Audit de sécurité (OWASP Top 10)

**Tâches :**
- [ ] Valider toutes les entrées utilisateur côté serveur (pas uniquement frontend)
- [ ] Requêtes EF Core paramétrées uniquement — zéro SQL brut
- [ ] Headers sécurité HTTP : CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] Embeddings jamais sérialisés dans les réponses API
- [ ] Frigate non accessible depuis le réseau hôte (lié à `127.0.0.1` dans Docker)

---

## E10 — Accès distant & Tunnels

### US-10.1 — URL signée HMAC pour les thumbnails

**En tant que** service, je veux générer des URLs de thumbnail à durée limitée, afin que les images ne soient pas accessibles indéfiniment hors réseau.

**Tâches :**
- [ ] Implémenter `SignedUrlService.GenerateSignedThumbnailUrl(eventId, baseUrl)` → HMAC-SHA256 + TTL 5 min
- [ ] Valider la signature dans le middleware `GET /api/events/{id}/thumbnail`
- [ ] Thumbnail ≤ 100 KB, résolution max 400×300

**Références SAD :** §6.6, ADR-09

---

### US-10.2 — Support Cloudflare Tunnel (opt-in)

**En tant qu'** utilisateur, je veux activer un tunnel Cloudflare depuis le dashboard, afin d'accéder à Vyzio depuis Internet sans ouvrir de port.

**Tâches :**
- [ ] Intégrer `cloudflared` dans le Docker Compose (service optionnel)
- [ ] Page de configuration tunnel dans les paramètres
- [ ] Afficher l'URL publique générée

---

## E11 — Packaging & Déploiement

### US-11.1 — Build NativeAOT .NET

**Tâches :**
- [ ] Configurer `PublishAot=true` pour `Vyzio.Api`
- [ ] Valider la compatibilité NativeAOT de toutes les dépendances
- [ ] Cross-compilation arm64 pour Raspberry Pi 5 / NUC
- [ ] Démarrage vérifié < 100ms

---

### US-11.2 — Docker Compose production (appliance)

**Tâches :**
- [ ] `docker-compose.appliance.yml` : ports fermés sauf 8443, restart policies, health checks
- [ ] Volumes nommés persistants pour toutes les données
- [ ] Script `install.sh` pour l'appliance : clone, config initiale, `docker compose up -d`

---

### US-11.3 — Tests d'intégration

**Tâches :**
- [ ] `Vyzio.Tests` : Testcontainers (PostgreSQL + Mosquitto en conteneurs de test)
- [ ] Tests contrat MQTT : publier un événement Frigate simulé, vérifier les topics Vyzio publiés
- [ ] Tests API : xUnit + `WebApplicationFactory`
- [ ] Tests Face Worker : image test → vérifier embedding 512 dims retourné

---

## Récapitulatif des dépendances

```
E1 (Frigate + Infra)
  └─► E2 (FrigateAdapter + MQTT)
        └─► E4 (Profiles + Reconnaissance)
        └─► E5 (Storage)
        └─► E6 (Notifications)
              └─► E7 (API + SignalR)
                    └─► E8 (Dashboard)
                    └─► E9 (Auth & Sécurité) ← peut démarrer en parallèle de E7
  └─► E3 (Face Worker Python)
        └─► E4 (Profiles + Reconnaissance)
E7 + E9 └─► E10 (Accès distant)
Tous    └─► E11 (Packaging)
```

---

## Prochaines étapes immédiates (Sprint 1)

1. **US-1.1** — Structure monorepo + solutions initiales (.NET, React, Python)
2. **US-1.2** — `docker-compose.yml` de base avec Frigate + PostgreSQL
3. **US-1.3** — Configuration Frigate minimale + validation MQTT
4. **US-1.4** — Schéma EF Core + migrations
5. **US-2.1** — Client MQTT Vyzio
6. **US-3.1** — Contrat Protobuf

> **Fin de Sprint 1** : Frigate ingère un flux RTSP, les événements MQTT apparaissent, la DB Vyzio est créée.
