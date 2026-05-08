# Vyzio — System Architecture Document (SAD)

> Version 0.1 — Mai 2026 — Document vivant

---

## Table des matières

1. [Objectifs architecturaux](#1-objectifs-architecturaux)
2. [Vue d'ensemble du système](#2-vue-densemble-du-système)
3. [Composants et responsabilités](#3-composants-et-responsabilités)
4. [Flux de données](#4-flux-de-données)
5. [Comparaison et choix technologiques](#5-comparaison-et-choix-technologiques)
6. [Déploiement](#6-déploiement)
7. [Sécurité](#7-sécurité)
8. [Décisions d'architecture (ADR)](#8-décisions-darchitecture-adr)

---

## 1. Objectifs architecturaux

| Priorité | Objectif | Justification |
|---|---|---|
| 1 | **Privacy by design** | Aucune image ne quitte le réseau local sans consentement explicite |
| 2 | **Offline-first** | Le système fonctionne sans connexion internet |
| 3 | **Réutilisation de briques existantes** | Ne pas réinventer ce qui est déjà battle-tested |
| 4 | **Modularité** | Chaque composant est remplaçable indépendamment |
| 5 | **Déployabilité** | Stack 100 % conteneurisée, un seul `docker compose up` suffit |

---

## 2. Vue d'ensemble du système

```
┌─────────────────────────────────────────────────────────────┐
│                         Réseau local                        │
│                                                             │
│   Caméra IP 1 ──┐                                          │
│   Caméra IP 2 ──┤                                          │
│   Caméra IP N ──┘                                          │
│        │ RTSP / ONVIF                                       │
│        ▼                                                    │
│   ┌─────────────┐    MQTT events     ┌──────────────────┐  │
│   │   Frigate   │ ──────────────────► │   Vyzio Core     │  │
│   │  (NVR/IA)   │    + snapshots     │  (Python / IA)   │  │
│   └─────────────┘                    └────────┬─────────┘  │
│          │                                    │            │
│          │ clips vidéo                        │ embeddings │
│          ▼                                    ▼            │
│   ┌─────────────┐                    ┌──────────────────┐  │
│   │   Storage   │                    │   PostgreSQL     │  │
│   │  (volumes)  │                    │  + pgvector      │  │
│   └─────────────┘                    └────────┬─────────┘  │
│                                               │            │
│                                               ▼            │
│                                      ┌──────────────────┐  │
│                                      │   Vyzio API      │  │
│                                      │   (FastAPI)      │  │
│                                      └────────┬─────────┘  │
│                                               │            │
│                              ┌────────────────┼──────────┐ │
│                              ▼                ▼          │ │
│                       ┌────────────┐  ┌─────────────┐   │ │
│                       │  Dashboard │  │    ntfy     │   │ │
│                       │ (React/TS) │  │  (push DIY) │   │ │
│                       └────────────┘  └─────────────┘   │ │
└─────────────────────────────────────────────────────────────┘
                                                  │
                                    (si connecté) │ push mobile
                                                  ▼
                                         Application mobile
                                         (webapp responsive)
```

---

## 3. Composants et responsabilités

| Composant | Image Docker | Responsabilité |
|---|---|---|
| **Frigate** | `ghcr.io/blakeblackshear/frigate` | Ingestion RTSP/ONVIF, détection de mouvement, enregistrement clips, émission d'événements MQTT |
| **Vyzio Core** | `vyzio/core` (custom) | Consommation des événements MQTT, détection faciale, calcul d'embeddings, matching profils |
| **PostgreSQL + pgvector** | `pgvector/pgvector:pg16` | Stockage de toutes les données (profils, embeddings, événements, config) |
| **Vyzio API** | `vyzio/api` (custom) | API REST JWT, gestion des profils/caméras/zones, webhooks sortants |
| **Dashboard** | `vyzio/dashboard` (custom) | Interface web React/TypeScript, live view, historique, configuration |
| **ntfy** | `binwiederhier/ntfy` | Serveur de notifications push self-hosted pour DIY/Hub |
| **MQTT Broker** | `eclipse-mosquitto` | Bus de messages entre Frigate et Vyzio Core |

---

## 4. Flux de données

### 4.1 Détection et notification (chemin critique)

```
1. Frigate détecte un mouvement sur une zone active
2. Frigate publie un événement MQTT : { camera, snapshot, timestamp, type: "person" }
3. Vyzio Core reçoit l'événement
4. InsightFace extrait les embeddings du snapshot
5. pgvector recherche le profil le plus proche (distance cosinus)
   ├─► Match (score > seuil) → profil identifié
   └─► Pas de match → "visage inconnu"
6. L'événement est persisté en base (events + clip reference)
7. Notification Service envoie via ntfy (DIY/Hub) ou FCM (Cloud)
8. L'utilisateur reçoit : nom / "visage inconnu" + vignette + lien dashboard
```

### 4.2 Ajout d'un profil

```
1. Utilisateur upload photo(s) via Dashboard → API
2. Vyzio Core extrait les embeddings de chaque photo
3. Embeddings stockés dans PostgreSQL (table profiles_embeddings)
4. Profil actif immédiatement pour les prochaines détections
```

---

## 5. Comparaison et choix technologiques

> Les sections suivantes présentent les options disponibles pour chaque composant. Les décisions finales sont à prendre après évaluation approfondie. Les contraintes et points de vigilance identifiés sont signalés explicitement.

---

### 5.0 Frigate — Capacités réelles de l'API (findings terrain)

Une exploration de l'API de démo de Frigate (v0.17) a permis d'identifier les points suivants :

**Ce que Frigate expose via API :**

| Endpoint | Type | Capacité |
|---|---|---|
| `GET /api/config` | REST | Config complète en lecture seule |
| `GET /api/stats` | REST | Stats temps réel par caméra (fps, détection, mémoire) |
| `GET /api/{camera}/latest.jpg` | REST | Snapshot instantané d'une caméra |
| `GET /api/events` | REST | Historique des événements détectés |
| Live stream | WebRTC/HLS | Via **go2rtc** intégré dans Frigate |
| Événements temps réel | MQTT | Publication de chaque détection avec snapshot |

**Limitation critique — Gestion des caméras :**

Il n'existe **pas** d'endpoint `POST /api/cameras` ni `PUT /api/config`. L'ajout, la suppression ou la modification d'une caméra passe obligatoirement par l'édition du fichier **`config.yml`** suivi d'un rechargement de Frigate. Cela impacte directement la façon dont Vyzio devra gérer la configuration des caméras depuis son dashboard.

Options pour contourner cette contrainte :
- **Option A** — Vyzio génère et écrit le `config.yml` de Frigate via un volume Docker partagé, puis déclenche un reload via l'API Frigate (`POST /api/config/save`)
- **Option B** — Utiliser l'API de configuration de Frigate qui permet la sauvegarde du YAML depuis son interface (à confirmer selon la version)
- **Option C** — Développer un custom NVR sur cette seule partie si la gestion dynamique est bloquante

**Point notable — Reconnaissance faciale native dans Frigate :**

Frigate v0.14+ embarque un module de **reconnaissance faciale native** (`face_recognition: enabled`), confirmé dans la config live : `"face_recognition": {"enabled": false, "model_size": "small", "recognition_threshold": 0.9, "detection_threshold": 0.7, ...}`. Ce module est à évaluer sérieusement (voir section 5.2).

---

### 5.1 NVR — Ingestion caméras et détection de mouvement

**Problème :** Ingérer des flux RTSP/ONVIF de manière fiable, détecter le mouvement avec accélération matérielle, et enregistrer les clips.

| Solution | Langage | Avantages | Inconvénients |
|---|---|---|---|
| **Frigate** | Python / C | Battle-tested, accél. matérielle (Coral, NVIDIA, OpenVINO), MQTT natif, go2rtc intégré pour le live stream, reconnaissance faciale native (v0.14+), communauté active, MIT | Config caméras via YAML uniquement (pas d'API CRUD), gestion dynamique à implémenter côté Vyzio |
| Développement custom | Go / Rust | Contrôle total, API sur mesure | Plusieurs mois de travail, réinventer la roue sur des problèmes résolus |
| MotionEye | Python | Simple, interface basique | Pas d'IA, peu maintenu, pas de MQTT natif |
| Shinobi | Node.js | Interface riche, API REST partielle | Communauté plus petite, moins d'accélération matérielle |

**Question ouverte :** La contrainte de gestion via YAML est-elle acceptable en l'état (Option A), ou faut-il envisager une alternative / développement partiel ?

---

### 5.2 Reconnaissance faciale — Détection + embeddings + matching

**Problème :** Détecter les visages dans une image, extraire un vecteur d'embedding, et retrouver le profil correspondant.

> **Contexte important :** Frigate v0.14+ intègre un module de reconnaissance faciale native. Avant de choisir une lib externe, il faut évaluer si ce module répond aux besoins de Vyzio (gestion de profils custom, précision, contrôle des seuils, API de matching).

| Solution | Type | Précision | Perf. CPU | Licence | Intégration Frigate | Notes |
|---|---|---|---|---|---|---|
| **Frigate native** | Intégré à Frigate | Bonne (modèle `small`/`large`) | Bonne (même process) | MIT | Native, zéro overhead | Gestion des profils via config Frigate — à évaluer si suffisant pour Vyzio |
| **InsightFace** | Lib Python | SOTA (ArcFace) | Bonne | MIT | Service séparé | Contrôle total, modèle `buffalo_l`, embeddings 512D, très flexible |
| **DeepFace** | Lib Python | Bonne (multi-backend) | Moyenne | MIT | Service séparé | Plusieurs backends (ArcFace, Facenet, etc.), plus simple à démarrer |
| **CompreFace** | Microservice REST | Bonne | Moyenne | Apache 2.0 | Via API REST | Language-agnostic, interface d'admin incluse, facile à tester |
| face_recognition (dlib) | Lib Python | Correcte | Faible | MIT | Service séparé | Simple mais daté, performances limitées |
| AWS Rekognition | Cloud API | Excellente | N/A | Propriétaire | N/A | Exclure — contre les principes privacy |
| Azure Face API | Cloud API | Excellente | N/A | Propriétaire | N/A | Exclure — contre les principes privacy |

**Questions ouvertes :**
- La reconnaissance faciale native de Frigate permet-elle de gérer des profils custom (nommés) sans passer par son interface ?
- L'API Frigate expose-t-elle les résultats de matching avec un score de confiance utilisable par Vyzio Core ?
- Si Frigate native est suffisant : gain architectural majeur (un composant de moins). Si insuffisant : InsightFace ou CompreFace sont les alternatives les plus solides.

---

### 5.3 Stockage des embeddings — Recherche de similarité vectorielle

**Problème :** Stocker les vecteurs d'embeddings (512D) et effectuer des recherches de similarité efficacement.

| Solution | Type | Intégration | Complexité opérationnelle | Score |
|---|---|---|---|---|
| **pgvector** ✓ | Extension PostgreSQL | Native, même DB | Nulle (déjà PostgreSQL) | ⭐⭐⭐⭐⭐ |
| Qdrant | DB vectorielle dédiée | Via API REST | Un service de plus | ⭐⭐⭐ |
| Weaviate | DB vectorielle dédiée | Via API REST | Lourd, complexe | ⭐⭐ |
| FAISS (in-memory) | Lib Python | Directe | Pas de persistance native | ⭐⭐⭐ |
| Milvus | DB vectorielle dédiée | Via SDK | Très lourd pour ce use case | ⭐⭐ |

**Note :** pgvector devient non nécessaire si la reconnaissance faciale native de Frigate est retenue (Frigate gère ses propres embeddings). À réévaluer selon la décision prise en 5.2.

---

### 5.4 Notifications push

**Problème :** Envoyer une notification push sur mobile lors d'un événement, avec une image et un texte. Compatible avec le mode offline-first.

| Solution | Self-hosted | iOS | Android | Dépendance externe | Score DIY | Score Cloud |
|---|:---:|:---:|:---:|---|---|---|
| **ntfy** ✓ | ✓ | ✓ | ✓ | Aucune (self-hosted) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **FCM** ✓ (Cloud) | ✗ | ✓ | ✓ | Google Firebase | ✗ (DIY) | ⭐⭐⭐⭐⭐ |
| Pushover | ✗ | ✓ | ✓ | Pushover (abonnement) | ⭐⭐ | ⭐⭐ |
| Gotify | ✓ | ✗ | ✓ | Aucune | ⭐⭐⭐ | ✗ |
| Apprise | ✓ | Multi | Multi | Agrégateur | ⭐⭐⭐ | ⭐⭐⭐ |

**Points de vigilance :**
- ntfy requiert que l'utilisateur installe une app tierce (friction à l'onboarding)
- FCM introduit une dépendance Google pour le Cloud, qui peut être perçue comme contradictoire avec le positionnement privacy — à évaluer dans la communication
- Apprise pourrait servir de couche d'abstraction commune aux deux modes

---

### 5.5 API Backend

**Problème :** Exposer une API REST pour le dashboard, les apps mobiles et les webhooks tiers.

| Solution | Langage | Perf. | Maturité | Cohérence stack | Score |
|---|---|---|---|---|---|
| **FastAPI** ✓ | Python | Très bonne (async) | ✓ | Même runtime que Core IA | ⭐⭐⭐⭐⭐ |
| Django REST | Python | Bonne | ✓ | Même runtime | ⭐⭐⭐ |
| .NET Minimal API | C# | Excellente | ✓ | Runtime différent | ⭐⭐⭐⭐ |
| Axum | Rust | Excellente | Jeune | Runtime différent | ⭐⭐⭐ |
| Express / Fastify | Node.js | Bonne | ✓ | Runtime différent | ⭐⭐⭐ |

**Note :** Le choix du runtime Python est conditionné par la décision sur la reconnaissance faciale (section 5.2). Si Frigate native est retenu, le Core IA Python disparaît et .NET ou Go deviennent des options tout aussi pertinentes pour l'API.

---

### 5.6 Bus de messages (Frigate → Core)

**Problème :** Frigate émet ses événements sur MQTT. Il faut un broker entre Frigate et Vyzio Core.

| Solution | Légèreté | Standard | Score |
|---|---|---|---|
| **Mosquitto** ✓ | ✓ Très léger | MQTT 3.1 / 5.0 | ⭐⭐⭐⭐⭐ |
| RabbitMQ | Non | AMQP | ⭐⭐ (surdimensionné) |
| Redis Pub/Sub | Moyen | Propriétaire | ⭐⭐⭐ |

**Note :** Mosquitto reste la valeur sûre quelle que soit la décision sur la reconnaissance faciale, tant que Frigate est dans la stack.

---

### 5.7 Dashboard Frontend

**Problème :** Interface web de gestion (live view, historique, configuration).

| Solution | Langage | Écosystème | Complexité | Score |
|---|---|---|---|---|
| **React + TypeScript** ✓ | TypeScript | Énorme | Moyenne | ⭐⭐⭐⭐⭐ |
| Vue 3 + TypeScript | TypeScript | Grand | Faible | ⭐⭐⭐⭐ |
| SvelteKit | TypeScript | Moyen | Faible | ⭐⭐⭐⭐ |
| Angular | TypeScript | Grand | Élevée | ⭐⭐⭐ |

**Note :** Le live stream vidéo depuis Frigate est exposé via go2rtc (WebRTC/HLS) — compatible nativement avec React et Vue. Pas de contrainte technique forte sur ce choix.

---

## 6. Déploiement

### 6.1 DIY et Vyzio Hub — Docker Compose

```yaml
# Aperçu de la stack (docker-compose.yml)
services:
  frigate:        # NVR, motion detection
  mosquitto:      # MQTT broker
  vyzio-core:     # IA, face recognition
  vyzio-api:      # REST API
  vyzio-dashboard # Web UI
  postgres:       # PostgreSQL + pgvector
  ntfy:           # Push notifications (self-hosted)
```

Un seul fichier, un seul `docker compose up`. Volumes persistants pour les clips et la base de données.

### 6.2 Vyzio Cloud — Kubernetes

- Un **Deployment** par service
- **HorizontalPodAutoscaler** sur le Core IA (CPU-bound)
- **StatefulSet** pour PostgreSQL
- **Ingress** NGINX avec TLS Let's Encrypt
- Hébergement : OVHcloud ou Scaleway (infrastructure française)
- Séparation des tenants par namespace ou par instance selon le volume

---

## 7. Sécurité

| Mécanisme | Détail |
|---|---|
| Transport | HTTPS (TLS 1.2+) sur toutes les API externes |
| Authentification | JWT (access 15 min + refresh 30 jours, révocable) |
| Mots de passe | bcrypt, coût ≥ 12 |
| Données biométriques | Embeddings uniquement (jamais les photos brutes en production) |
| Réseau Docker | Services internes sur réseau bridge privé, seuls API et Dashboard exposés |
| Secrets | Variables d'environnement via `.env` (DIY) ou Kubernetes Secrets (Cloud) |
| Rate limiting | Sur tous les endpoints d'authentification (100 req/min max) |

---

## 8. Décisions d'architecture (ADR)

### ADR-001 — Utiliser Frigate comme couche NVR
**Statut :** En cours d'évaluation  
**Contexte :** Frigate résout l'ingestion RTSP, la détection de mouvement et l'enregistrement. Licence MIT. Mais la gestion dynamique des caméras (ajout/suppression) passe par un fichier YAML, pas par API.  
**Options :**
- A) Accepter et gérer le YAML via volume Docker partagé
- B) Chercher si Frigate expose un endpoint de sauvegarde config utilisable
- C) Développer une couche NVR custom minimale

**Bloquant pour décision :** Confirmer l'option de gestion du config.yml depuis Vyzio.

### ADR-002 — Reconnaissance faciale : Frigate native vs lib externe
**Statut :** Ouvert — décision critique  
**Contexte :** Frigate v0.14+ embarque un module de reconnaissance faciale native (confirmé en prod). Utiliser ce module simplifierait massivement l'architecture (pas de Core IA séparé). En revanche, le contrôle sur les profils, les seuils et les données biométriques serait délégué à Frigate.  
**Options :**
- A) Frigate native — architecture simplifiée, moins de contrôle sur les embeddings
- B) InsightFace (lib Python) — contrôle total, service supplémentaire
- C) CompreFace (microservice REST) — language-agnostic, facile à évaluer

**Bloquant pour décision :** Tester la reconnaissance faciale native de Frigate sur un cas réel (ajout profil custom, matching, score retourné via MQTT/API).

### ADR-003 — Stockage des embeddings
**Statut :** Conditionnel à ADR-002  
**Contexte :** Si Frigate native est retenu, la gestion des embeddings est interne à Frigate. Si lib externe, pgvector dans PostgreSQL est la solution la plus simple.  
**Décision :** À trancher après ADR-002.

### ADR-004 — Notifications push DIY/Hub
**Statut :** En cours d'évaluation  
**Contexte :** Le mode DIY doit fonctionner sans dépendance cloud. ntfy est self-hosted et supporte iOS/Android mais requiert l'installation d'une app tierce par l'utilisateur.  
**Options :**
- A) ntfy self-hosted (friction à l'onboarding, mais 100 % local)
- B) Apprise comme abstraction (supporte ntfy + d'autres canaux)
- C) Webhook uniquement en DIY (déléguer les notifs à l'utilisateur)

### ADR-005 — Langage principal du backend
**Statut :** Conditionnel à ADR-002  
**Contexte :** Si un Core IA Python est nécessaire (InsightFace), Python/FastAPI pour l'API est cohérent. Si Frigate native est retenu, le Core IA disparaît et .NET, Go ou Rust deviennent des options équivalentes pour l'API REST.  
**Décision :** À trancher après ADR-002.
