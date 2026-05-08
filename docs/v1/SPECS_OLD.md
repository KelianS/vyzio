# Vyzio — Spécifications Fonctionnelles

> Version 0.1 — Mai 2026 — Document vivant, en cours de rédaction

---

## Table des matières

1. [Vue d'ensemble du système](#1-vue-densemble-du-système)
2. [Modes de déploiement](#2-modes-de-déploiement)
3. [Intégration caméras](#3-intégration-caméras)
4. [Pipeline de détection et reconnaissance](#4-pipeline-de-détection-et-reconnaissance)
5. [Gestion des profils](#5-gestion-des-profils)
6. [Système de notifications](#6-système-de-notifications)
7. [Stockage et rétention](#7-stockage-et-rétention)
8. [Dashboard de gestion](#8-dashboard-de-gestion)
9. [API de gestion](#9-api-de-gestion)
10. [Sécurité et confidentialité](#10-sécurité-et-confidentialité)
11. [Contraintes et limites](#11-contraintes-et-limites)

---

## 1. Vue d'ensemble du système

### 1.1 Description générale

Vyzio est un système de surveillance domestique local qui ingère des flux vidéo depuis des caméras IP, analyse les images en temps réel via un moteur IA embarqué, et notifie l'utilisateur d'événements pertinents (visage connu, visage inconnu, mouvement, intrusion).

### 1.2 Composants principaux

| Composant | Rôle |
|---|---|
| **Camera Service** | Ingestion des flux RTSP/ONVIF |
| **Core Engine** | Détection de mouvement, détection et reconnaissance faciale |
| **Storage Service** | Enregistrement vidéo, métadonnées, profils |
| **Notification Service** | Envoi des alertes push mobile |
| **API Service** | Interface REST pour le dashboard et les apps |
| **Dashboard** | Interface web de gestion |

### 1.3 Flux de données global

```
Caméra IP
  └─► Camera Service (RTSP/ONVIF)
        └─► Core Engine
              ├─► Détection de mouvement
              └─► Détection faciale
                    ├─► Reconnaissance → Profil connu → Notification "X est arrivé"
                    └─► Pas de match → Notification "Visage inconnu"
                          └─► Storage Service (clip vidéo + métadonnées)
                                └─► Dashboard / API
```

---

## 2. Modes de déploiement

### 2.1 DIY (Self-hosted)

- Déploiement via **Docker Compose** sur machine de l'utilisateur (PC, NAS, serveur Linux)
- L'utilisateur fournit sa propre machine et ses caméras
- Configuration initiale via le dashboard web
- Mise à jour manuelle via `docker compose pull && docker compose up -d`
- Données : 100 % locales, aucune communication sortante par défaut

**Prérequis minimaux :**
- CPU : x86_64 ou ARM64, 4 cœurs recommandés
- RAM : 4 Go minimum, 8 Go recommandé
- Stockage : dépend de la rétention vidéo souhaitée
- OS : Linux (recommandé), Windows avec Docker Desktop
- Réseau : accès local aux caméras IP

### 2.2 Vyzio Hub

- Mini-PC livré par Vyzio, pré-configuré avec la stack Docker Compose
- Plug & Play : l'utilisateur branche le Hub sur son réseau, accède au dashboard depuis son navigateur
- Mises à jour OTA (Over-The-Air) via le service de mise à jour Vyzio
- Données : 100 % locales, sur le Hub

### 2.3 Vyzio Cloud

- Hébergé sur infrastructure française gérée par Vyzio
- Déployé sur **Kubernetes**, architecture multi-tenant
- L'utilisateur configure ses caméras depuis le dashboard ; les flux transitent de manière chiffrée vers l'infrastructure Vyzio
- Modèle d'abonnement mensuel
- Les clips vidéo et métadonnées sont stockés dans l'infrastructure Vyzio, avec chiffrement au repos

---

## 3. Intégration caméras

### 3.1 Protocoles supportés

| Protocole | Support | Notes |
|---|:---:|---|
| RTSP | Obligatoire | Ingestion du flux vidéo brut |
| ONVIF | Obligatoire | Découverte réseau, PTZ, configuration |
| HTTP MJPEG | Optionnel | Compatibilité caméras bas de gamme |

### 3.2 Ajout d'une caméra

1. L'utilisateur saisit l'URL RTSP ou lance une découverte ONVIF sur le réseau local
2. Vyzio teste la connexion et affiche un aperçu du flux
3. L'utilisateur nomme la caméra et définit sa position (ex. "Entrée", "Jardin")
4. La caméra est enregistrée et la surveillance démarre automatiquement

### 3.3 Gestion des flux

- Reconnexion automatique en cas de perte du flux (backoff exponentiel)
- Support des flux H.264 et H.265
- Résolution : de 480p à 4K (traitement IA adapté selon les ressources disponibles)
- Framerate d'analyse IA configurable (par défaut : 5 fps pour l'analyse, flux complet pour l'enregistrement)

### 3.4 Zones de détection

- L'utilisateur peut définir des **zones polygonales** sur l'image de chaque caméra
- La détection (mouvement, visage) n'est déclenchée qu'à l'intérieur des zones actives
- Plusieurs zones par caméra, nommables indépendamment
- Chaque zone peut avoir des plages horaires d'activation différentes

---

## 4. Pipeline de détection et reconnaissance

### 4.1 Étapes du pipeline

```
Frame vidéo
  └─► 1. Détection de mouvement (légère, frame diff ou MOG2)
        └─► Si mouvement détecté :
              └─► 2. Détection de visages (YOLO / MTCNN / RetinaFace)
                    └─► Si visage(s) détecté(s) :
                          └─► 3. Extraction d'embeddings (InsightFace / DeepFace)
                                └─► 4. Comparaison avec la base de profils (distance cosinus)
                                      ├─► Score > seuil → Personne identifiée
                                      └─► Score < seuil → Visage inconnu
```

### 4.2 Détection de mouvement

- Algorithme léger (frame differencing ou MOG2) pour éviter de solliciter l'IA à chaque frame
- Sensibilité configurable par zone
- Sert de pré-filtre avant l'analyse IA

### 4.3 Détection faciale

- Bibliothèque privilégiée : **InsightFace** (RetinaFace) ou **MTCNN**
- Seuil de confiance configurable (par défaut : 0.85)
- Plusieurs visages détectables par frame

### 4.4 Reconnaissance faciale

- Extraction d'un vecteur d'embedding (512 dimensions) par visage détecté
- Comparaison avec les embeddings stockés en base (distance cosinus)
- Seuil de reconnaissance configurable (par défaut : 0.6)
- En cas de doute (score proche du seuil), l'événement est marqué "incertain" et l'utilisateur peut confirmer

### 4.5 Accélération matérielle

- Support GPU NVIDIA via CUDA (optionnel, détection automatique)
- Support Apple Silicon (MPS) — optionnel
- Fallback CPU si aucun GPU disponible
- Sur Vyzio Hub : adaptation selon le matériel embarqué

---

## 5. Gestion des profils

### 5.1 Profil d'une personne

Chaque profil contient :
- Nom (obligatoire)
- Photo(s) de référence (1 minimum, plusieurs recommandées pour la précision)
- Embeddings calculés à partir des photos (stockés en base, pas les photos brutes)
- Catégorie : `Foyer` / `Connu` / `Livraison` / `Animaux` / `Autre`
- Comportement d'alerte associé (notifier, notifier discrètement, ignorer)

### 5.2 Ajout d'un profil

1. L'utilisateur upload une ou plusieurs photos via le dashboard
2. Vyzio détecte et valide que chaque photo contient exactement un visage visible
3. Les embeddings sont calculés et stockés
4. Le profil est actif immédiatement

### 5.3 Amélioration continue

- Lorsqu'un visage connu est détecté avec un score élevé, l'utilisateur peut valider la reconnaissance depuis la notification
- Les validations peuvent enrichir la base d'embeddings du profil (opt-in)

---

## 6. Système de notifications

### 6.1 Types d'événements notifiés

| Événement | Contenu de la notification |
|---|---|
| Personne connue détectée | Nom + photo du clip + caméra source |
| Visage inconnu détecté | "Visage inconnu" + photo du clip + caméra source |
| Mouvement sans visage | "Mouvement détecté" + caméra + zone (si activé) |
| Perte de flux caméra | Alerte technique : "Caméra X inaccessible" |
| Retour en ligne | "Caméra X de nouveau disponible" |

### 6.2 Canaux de notification

- **Push mobile** (prioritaire) — via FCM (Firebase Cloud Messaging) pour Android/iOS
  - Mode DIY/Hub : les notifications transitent par le serveur Vyzio uniquement pour la livraison push (pas d'image)
  - Les images restent locales et sont accessibles via lien deep-link vers le dashboard local
- **Webhook** — pour intégrations tierces (Home Assistant, n8n, etc.)
- **Email** — optionnel, configurable

### 6.3 Règles de notification

- Anti-spam : délai minimum configurable entre deux notifications du même type sur la même caméra (par défaut : 30 secondes)
- Plages horaires : possibilité de désactiver les notifications sur certaines plages
- Par profil : chaque profil peut avoir un comportement différent (notifier, silencieux, bloquer)
- Mode "Ne pas déranger" : suspension globale des notifications

### 6.4 Comportement offline

- Si la connexion internet est indisponible, les événements sont mis en file d'attente
- Les notifications sont envoyées dès que la connectivité est rétablie
- La surveillance locale continue sans interruption

---

## 7. Stockage et rétention

### 7.1 Base de données

- **PostgreSQL** — unique système de base de données pour tous les modes de déploiement
- Schéma principal :
  - `cameras` — configuration des caméras
  - `profiles` — personnes enregistrées + embeddings
  - `events` — historique des événements détectés
  - `clips` — références aux fichiers vidéo
  - `zones` — zones de détection par caméra
  - `notifications` — log des notifications envoyées
  - `users` — comptes d'accès au dashboard

### 7.2 Enregistrements vidéo

- Format : **MP4 (H.264)** — compatibilité maximale
- Enregistrement déclenché sur événement (motion / visage)
- Durée du clip : configurable (par défaut : 30s avant + 30s après l'événement)
- Enregistrement continu optionnel (haute consommation disque)
- Stockage local dans un volume Docker dédié

### 7.3 Politique de rétention

- Configurable par l'utilisateur :
  - Durée maximale de rétention (par défaut : 30 jours)
  - Espace disque maximum alloué (par défaut : 50 Go)
- Suppression automatique des clips les plus anciens lorsque la limite est atteinte
- Les événements en base sont conservés séparément des clips vidéo (plus légers)

---

## 8. Dashboard de gestion

### 8.1 Accès

- Interface web responsive, accessible depuis le réseau local (DIY/Hub) ou via internet (Cloud)
- Authentification : login/mot de passe + option 2FA (TOTP)
- Support multi-utilisateurs avec rôles : `Admin` / `Viewer`

### 8.2 Fonctionnalités

#### Vue principale — Live
- Grille de flux en direct de toutes les caméras
- Indicateur d'état par caméra (actif, hors ligne, en alerte)
- Overlay des zones de détection configurées

#### Historique des événements
- Timeline des événements par date/caméra/type
- Vignette + clip associé pour chaque événement
- Filtres : type d'événement, caméra, profil, plage de dates
- Possibilité de marquer un événement (confirmé, faux positif)

#### Gestion des caméras
- Ajout / suppression / renommage de caméras
- Configuration par caméra : zones de détection, sensibilité, plages horaires
- Test de connexion et aperçu du flux

#### Gestion des profils
- Ajout / modification / suppression de profils
- Upload de photos de référence
- Visualisation des événements associés à un profil

#### Paramètres de notifications
- Configuration par canal (push, webhook, email)
- Règles d'anti-spam et plages horaires
- Gestion du mode "Ne pas déranger"

#### Paramètres système
- Politique de rétention vidéo
- Statut des services (CPU, RAM, disque)
- Gestion des utilisateurs et des accès

---

## 9. API de gestion

### 9.1 Description générale

- API **REST** (JSON) exposée par le service API
- Authentification par **JWT** (Bearer token)
- Base URL : `http(s)://<host>/api/v1`
- Versionnée dès le départ (`/v1`)

### 9.2 Ressources principales

| Ressource | Endpoints clés |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Cameras | `GET /cameras`, `POST /cameras`, `GET /cameras/:id`, `PUT /cameras/:id`, `DELETE /cameras/:id` |
| Profiles | `GET /profiles`, `POST /profiles`, `GET /profiles/:id`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Events | `GET /events`, `GET /events/:id`, `PATCH /events/:id` |
| Clips | `GET /clips/:id`, `GET /clips/:id/stream` |
| Zones | `GET /cameras/:id/zones`, `POST /cameras/:id/zones`, `PUT /zones/:id`, `DELETE /zones/:id` |
| Notifications | `GET /notifications/settings`, `PUT /notifications/settings` |
| System | `GET /system/status`, `GET /system/health` |

### 9.3 Webhooks sortants

- L'API peut émettre des webhooks configurables sur chaque type d'événement
- Payload JSON standardisé avec : type, timestamp, camera_id, profile_id (si connu), clip_url

---

## 10. Sécurité et confidentialité

### 10.1 Principes fondamentaux

- **Aucune image ne quitte le réseau local** en mode DIY/Hub sans action explicite de l'utilisateur
- Les embeddings faciaux sont stockés localement, jamais envoyés à des tiers
- Le mode Cloud implique un transit chiffré ; engagement contractuel de non-exploitation des données

### 10.2 Sécurité technique

- Toutes les communications API en **HTTPS** (TLS 1.2+)
- Mots de passe hashés avec **bcrypt** (coût ≥ 12)
- Tokens JWT avec expiration courte (15 min) + refresh token (30 jours, révocable)
- Headers de sécurité HTTP : HSTS, CSP, X-Frame-Options, etc.
- Rate limiting sur les endpoints d'authentification
- Logs d'accès conservés (sans données personnelles)

### 10.3 Conformité RGPD

- Les données biométriques (embeddings) sont des données sensibles au sens du RGPD
- Consentement explicite requis avant l'enregistrement d'un profil
- Droit à l'effacement : suppression complète d'un profil (embeddings + événements associés) via le dashboard
- Pas de partage de données avec des tiers sans consentement

---

## 11. Contraintes et limites

### 11.1 Contraintes techniques

- La reconnaissance faciale nécessite un visage suffisamment visible (≥ 80x80 pixels, angle < 45°)
- Latence cible entre détection et notification : < 5 secondes
- Charge CPU en mode analyse continue : à surveiller, recommandation d'un CPU dédié pour > 4 caméras
- PostgreSQL doit rester accessible en permanence pour le fonctionnement du système

### 11.2 Limites connues

- Pas de reconnaissance dans l'obscurité totale (dépend de la caméra — caméras IR compatibles)
- Jumeaux identiques : limite inhérente aux systèmes de reconnaissance faciale
- Performances dégradées si le matériel hôte est sous-dimensionné (DIY sur vieille machine)

### 11.3 Hors scope (v1)

- Reconnaissance de plaques d'immatriculation
- Détection de comportements (chute, agression)
- Intégration alarme physique
- Application mobile native (v1 = webapp responsive)
