# Vyzio — Software Architecture Document (SAD)

> Juillet 2026 — v2.3 — Document vivant

---

## Table des matières

1. [Introduction et périmètre](#1-introduction-et-périmètre)
2. [Positionnement vis-à-vis de Frigate](#2-positionnement-vis-à-vis-de-frigate)
3. [Contraintes et principes directeurs](#3-contraintes-et-principes-directeurs)
4. [Vue d'ensemble de l'architecture](#4-vue-densemble-de-larchitecture)
5. [Décisions d'architecture (ADR)](#5-décisions-darchitecture-adr) → index complet dans [`adr/README.md`](adr/README.md)
6. [Architecture des services](#6-architecture-des-services)
7. [Modèle de données](#7-modèle-de-données)
8. [Architecture de déploiement](#8-architecture-de-déploiement)
9. [Sécurité](#9-sécurité)
10. [Performances et scalabilité](#10-performances-et-scalabilité)
11. [Risques et mitigations](#11-risques-et-mitigations)

---

## 1. Introduction et périmètre

Ce document décrit les décisions d'architecture du système **Vyzio**, un produit de surveillance domestique local-first destiné à un public non-technicien.

**Philosophie centrale** : ne pas réinventer ce qui existe et fonctionne. Vyzio est une **couche produit au-dessus de Frigate**. Frigate couvre le pipeline vidéo et de nombreux enrichissements IA. Vyzio se concentre sur l'accessibilité non-tech : installation, onboarding, configuration guidée, règles métier, notifications multi-canaux, support et packaging clef en main.

### Audience

Ingénieurs contribuant au projet. Prérequis : .NET 10, React/TypeScript, architecture événementielle.

---

## 2. Positionnement vis-à-vis de Frigate

### 2.1 Ce que Frigate fait — et que Vyzio NE réimplémente PAS

| Fonctionnalité | Prise en charge par |
|---|---|
| Ingestion flux RTSP / ONVIF / MJPEG | **Frigate** |
| Découverte caméras ONVIF | **Frigate** |
| Détection de mouvement | **Frigate** |
| Détection de présence humaine (TFLite / OpenVINO / Coral) | **Frigate** |
| Enregistrement vidéo MP4 + clips événementiels | **Frigate** |
| Politique de rétention des clips | **Frigate** |
| Support accélération matérielle (Coral TPU, GPU, VAAPI) | **Frigate** |
| API REST et MQTT events | **Frigate** (consommé par Vyzio) |
| Aperçu live des caméras (HLS / MJPEG) | **Frigate** (proxyfié par Vyzio) |
| Reconnaissance faciale locale | **Frigate** (v0.16+) |
| Reconnaissance de plaques (LPR) locale | **Frigate** (v0.16+) |
| Recherche sémantique + triggers | **Frigate** (v0.15+) |
| Classification locale (bird, object, state) | **Frigate** (v0.16/v0.17) |
| Audio events + transcription locale | **Frigate** |
| Notifications WebPush natives | **Frigate** |

### 2.2 Ce que Frigate ne fait PAS — valeur ajoutée de Vyzio

| Fonctionnalité | Vyzio |
|---|---|
| **Installation plug & play** (appliance + bootstrap) | ✅ Vyzio Hub |
| **Onboarding guidé caméras** (scan, test, nommage, zones) | ✅ Vyzio Dashboard |
| **Profils produit et règles métier** (foyer, livreur, plages horaires, priorités) | ✅ Vyzio Core |
| **Notifications intelligentes multi-canaux** (Telegram, Discord, ntfy, webhook, email) | ✅ Notification Service |
| **Accès distant aux photos** via tunnel sécurisé | ✅ Vyzio Core |
| **UI grand public** : parcours simplifié, mobile-first, termes non-techniques | ✅ Dashboard React |
| **Packaging all-in-one** : livré prêt à brancher, zéro configuration technique | ✅ Hub + Compose / Appliance |
| **Support français** et documentation non-technicienne | ✅ Produit |

### 2.3 Dépendance à Frigate — risques et mitigations

| Risque | Probabilité | Mitigation |
|---|:---:|---|
| Breaking change API Frigate | Faible (API stable v0.12+) | Couche d'abstraction `FrigateAdapter` versionnée |
| Arrêt du projet Frigate | Très faible (communauté active, HA intégration) | Architecture permet de remplacer Frigate par autre backend MQTT/REST |
| Bug Frigate impactant Vyzio | Moyen | Tests d'intégration sur contrat MQTT/REST, pas sur les internals Frigate |

### 2.4 Stratégie UX non-tech : comparaison

Objectif produit : rendre Frigate utilisable par un utilisateur non-technicien sans exposition aux concepts YAML, brokers, rôles `ffmpeg`, ou tuning IA.

| Option | Description | Avantages | Inconvénients | Verdict |
|---|---|---|---|---|
| **A — Exposer uniquement l'UI Frigate** | Vendre une appliance Frigate avec branding/support minimal | Time-to-market maximal, peu de dev UI | Onboarding et configuration caméra trop techniques pour le grand public | ❌ Insuffisant pour la promesse Vyzio |
| **B — UI Vyzio 100% custom, sans UI Frigate** | Refaire toute l'expérience, y compris fonctions avancées | Contrôle total UX | Coût très élevé, duplication de fonctionnalités Frigate, risque de retard | ❌ Trop coûteux / non aligné "ne pas réinventer" |
| **C — Approche hybride (recommandée)** | **Hub Vyzio simplifié par défaut** + **accès Frigate avancé** (mode expert) | UX non-tech cohérente + puissance Frigate conservée + vélocité | Nécessite une bonne gouvernance des frontières UI | ✅ Meilleur compromis produit/technique |

**Décision stratégique** : Vyzio adopte l'approche **hybride**. Le parcours principal passe par le Hub Vyzio (installation + onboarding + configuration simplifiée). L'UI Frigate reste disponible en mode avancé pour les utilisateurs experts et le support.

---

## 3. Contraintes et principes directeurs

### 3.1 Contraintes fermes

| # | Contrainte | Source |
|---|---|---|
| C1 | Les données biométriques (embeddings, frames) ne quittent jamais le réseau local | Specs §8.2 |
| C2 | Le système fonctionne sans connexion Internet | Specs §5.3 |
| C3 | Déploiement sur mini-PC (Intel NUC, Raspberry Pi 5, NAS) | Specs §1.3 |
| C4 | Installation plug & play sans technicité | Specs §1.3 |
| C5 | Support RTSP, ONVIF, HTTP MJPEG | Délégué à Frigate |
| C6 | Reconnaissance faciale < 2s après détection de mouvement | Contrainte d'architecture dérivée des objectifs produit |
| C7 | Pas de dépendance cloud pour les fonctions critiques | Specs §8.2 |
| C8 | Stack cible : .NET 10 + TypeScript (runtime principal) | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

### 3.2 Principes directeurs

- **Ne pas réinventer Frigate** : toute fonctionnalité couverte par Frigate est déléguée.
- **Délégation pragmatique à Frigate** : les enrichissements déjà fiables dans Frigate (face, LPR, semantic search, classification, audio) sont utilisés par défaut.
- **Choix explicites documentés** : chaque fonctionnalité suit la grille _options comparées → solution retenue → conséquences_.
- **Worker Python dédié non retenu** : conservé uniquement comme option étudiée, pas dans l'architecture cible.
- **Faible couplage Frigate/Vyzio** : Vyzio consomme Frigate via ses interfaces publiques (MQTT + REST), pas ses internals.
- **Local-first** : aucune image ni donnée biométrique ne sort du réseau sans opt-in explicite.
- **Orienté produit** : les décisions techniques servent l'expérience grand public, pas l'exhaustivité technique.

---

## 4. Vue d'ensemble de l'architecture

### 4.1 Diagramme de contexte (C4 Level 1)

```
┌────────────────────────────────────────────────────────────────┐
│  Réseau local de l'utilisateur                                 │
│                                                                │
│  ┌─────────────┐  RTSP/ONVIF  ┌──────────────────────────────┐│
│  │  Caméras IP │────────────► │         Vyzio                ││
│  └─────────────┘              │  (Frigate + couche produit)  ││
│                               │                              ││
│  ┌─────────────┐  HTTP(S)     │  Dashboard + API             ││
│  │  Navigateur │◄───────────► │                              ││
│  └─────────────┘              └──────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
                                          │
                                   FCM (push uniquement —
                                   payload texte + URL signée)
                                          │
                             ┌────────────▼───────────┐
                             │  Téléphone (Android/iOS)│
                             └─────────────────────────┘
```

### 4.2 Diagramme des conteneurs (C4 Level 2)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Vyzio Runtime (Docker Compose / Appliance)                              │
│                                                                          │
│  ┌──────────────────────────┐     MQTT publish/subscribe                 │
│  │  Frigate                 │──────────────┐                             │
│  │  (Python — non modifié)  │              │                             │
│  │  - Ingestion RTSP/ONVIF  │              ▼                             │
│  │  - Détection / clips     │   ┌──────────────────────┐                 │
│  │  - API REST :5000        │   │  Mosquitto Broker    │                 │
│  └──────────────┬───────────┘   │  - MQTT :1883        │                 │
│                 │ REST          └──────────┬───────────┘                 │
│                 │ (clips, live HLS)        │ MQTT                        │
│                 ▼                          ▼                             │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │  Vyzio Backend  (.NET 10)                                      │      │
│  │                                                                │      │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐   │      │
│  │  │  FrigateAdapter  │  │ Profile & Rules │  │  Storage     │   │      │
│  │  │  (MQTT consumer  │  │ Service         │  │  Service     │   │      │
│  │  │  + REST client)  │  │ (mapping,       │  │  (events DB) │   │      │
│  │  └────────┬─────────┘  │ schedules,      │  └──────────────┘   │      │
│  │           │            │ priorities)     │           │         │      │
│  │           │            └────────┬────────┘           │         │      │
│  │           │ MQTT (vyzio/events/*)│                   │         │      │
│  │           └──────────────────────┬───────────────────┘         │      │
│  │                                  ▼                             │      │
│  │                         ┌─────────────────┐                    │      │
│  │                         │  Notification   │                    │      │
│  │                         │  Service        │                    │      │
│  │                         │ (Telegram,      │                    │      │
│  │                         │  FCM, webhook)  │                    │      │
│  │                         └─────────────────┘                    │      │
│  └──────────────────────────────┬─────────────────────────────────┘      │
│                                 │ HTTPS                                  │
│  ┌──────────────────────────────▼───────────────────────────────────┐    │
│  │  Vyzio Dashboard  (React 19 + TypeScript — build statique)       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Décisions d'architecture (ADR)

Les décisions d'architecture sont consignées comme **ADR individuels** dans [`adr/`](adr/) — un fichier par décision, au format Contexte → Options comparées → Décision → Conséquences. Voir l'**index** : [`adr/README.md`](adr/README.md).

Le détail d'implémentation d'un composant (trames protocole, catalogues, schémas) vit dans un **TAD** sous [`design/`](design/), pas ici. Règles de rédaction : [`WORKFLOW.md`](WORKFLOW.md).

## 6. Architecture des services

### 6.1 Responsabilités

```
Frigate                           → Vidéo brut, détection, clips, bibliothèque de reconnaissance faciale
Mosquitto Broker                  → Bus MQTT partagé entre Frigate et Vyzio
FrigateAdapter (.NET)             → Pont Frigate ↔ domaine Vyzio (MQTT consumer + REST client)
FrigateRestClient (.NET)          → Appels REST Frigate : sub_label, upload photos faces, bibliothèque
Profile & Rules Service (.NET)    → Profils produit, mapping sub_label → profil, filtre profil-caméra, règles d'alertes
Notification Service (.NET)       → Règles + envoi FCM/webhook/email
Storage Service (.NET)            → Persistance des données propres à Vyzio (EF Core) — jamais les détections (ADR-49)
DetectionHistoryReader (.NET)     → Lecture des événements Frigate, filtrés et enrichis à la lecture (profil, nom de caméra, médias)
FaceLibrarySyncService (.NET)     → Synchronisation des photos de profil Vyzio vers la bibliothèque Frigate
CameraConfigWriter (.NET)         → Génération frigate.yml : caméras, labels détection, face_recognition, rôles detect/record
CameraStreamEnumerator (.NET)     → Énumération des flux d'une caméra et de leur résolution (ADR-38), via ONVIF ou convention protocole
MotionSensitivityTuner (.NET)     → Boucle d'auto-réglage de la sensibilité par caméra (ADR-35), appliquée à chaud via MQTT
API (ASP.NET Core)                → REST + SignalR + proxy Frigate (auth)
Dashboard / Hub (React + TS)      → UI grand public guidée : consultation et arborescence de réglages (ADR-40), cycle d'édition unique (ADR-41), socle shadcn/ui (ADR-42)
```

### 6.2 Flux complet : détection → notification

```
1. Frigate détecte une personne (bibliothèque faces déjà synchronisée par FaceLibrarySyncService)
   └─► Reconnaissance faciale Frigate : compare avec bibliothèque → sub_label = "Alice" si match
   └─► Publish MQTT: frigate/events { label: "person", sub_label: "Alice", camera: "front_door" }

2. Broker Mosquitto dédié
   └─► Transporte frigate/events vers les consommateurs Vyzio

3. FrigateAdapter (.NET) — souscrit frigate/events
   └─► Ne persiste rien : la détection appartient à Frigate (ADR-49)
   └─► Ne retient que la fin d'un événement, filtre les labels, puis passe la détection en file
   └─► Rend la main immédiatement — aucune attente dans le handler du message

4. NotificationService — consomme la file, hors du handler MQTT
   └─► Relit l'identité auprès de Frigate (sub_label "Alice") — la résolution du profil, elle,
       appartient à la lecture de l'historique (ADR-15)
   └─► Récupère le média avec reprise (Frigate le finalise quelques secondes après la fin),
       et retombe sur le texte si rien ne vient
   └─► Telegram sendPhoto : "Alice est arrivée • Porte d'entrée • 09:32" + photo
   └─► Journalise l'envoi, ancré sur l'identifiant d'événement Frigate — seul fait persisté
   └─► SignalR : push vers dashboard ouvert

4bis. Consultation de l'historique (indépendante du flux ci-dessus)
   └─► DetectionHistoryReader lit /api/events (filtres caméra, label, identité, période ;
       pagination au curseur temporel), enrichit profil et nom de caméra à la lecture
   └─► La profondeur de l'historique est celle de la rétention des clips d'événement
   └─► Deux manques, deux causes distinctes, dites à l'écran seulement (ADR-49) : un média
       au-delà de la rétention est marqué expiré à la lecture ; une surveillance injoignable
       répond 503, car aucun historique n'est autre chose qu'un historique vide

5. Flux de synchronisation bibliothèque (indépendant du flux de détection) :
   FaceLibrarySyncService
   └─► Déclenché par : ajout/suppression de photo profil, renommage profil
   └─► POST /api/faces/{name} → upload photo vers Frigate
   └─► Mise à jour profile_photos.frigate_synced = 1
   └─► Si activation face_recognition : régénère frigate.yml via CameraConfigWriter
```

---

## 7. Modèle de données

### 7.1 Périmètre

Vyzio gère uniquement ses propres données (profils, caméras, réglages, notifications, sessions). Les événements de détection comme leurs médias restent dans la base Frigate — Vyzio les lit via l'API REST et les enrichit à la lecture, sans jamais en garder copie (ADR-49).

### 7.2 Entités et relations

> Source de vérité : les entités EF (`src/vyzio/Vyzio.Core/Entities/`) et les migrations
> (`src/vyzio/Vyzio.Infrastructure/Persistence/Migrations/`). Ce tableau donne le **rôle et les
> relations** ; colonnes, index et valeurs par défaut vivent dans le code, non recopiés ici.

| Entité | Rôle | Relations clés |
|---|---|---|
| `Profile` | Personne/animal reconnu : catégorie + mode d'alerte | ← `ProfilePhoto`, `ProfileCameraLink` |
| `ProfilePhoto` | Photo de référence synchronisée vers Frigate (ADR-13) | → `Profile` |
| `ProfileCameraLink` | Filtrage reconnaissance profil ↔ caméra (ADR-15) | → `Profile`, `Camera` |
| `Camera` | Caméra : **une scène**, connexion, statut, privacy mode, protocoles détectés (ADR-38) | ← `CameraCapabilityBinding`, `ProfileCameraLink`, `CameraStream` |
| `CameraStream` | Point d'accès vidéo d'une caméra : qualité, chemin, résolution relevée (ADR-38) | → `Camera` |
| `CameraCapabilityBinding` | Capacité optionnelle (PTZ / privacy HW / image) découplée de la marque, **testée et jamais déclarative** (ADR-22/24/28) | → `Camera` |
| `RecordingSettings` | Durées de rétention de l'installation, surchargeables par caméra (ADR-39) | singleton |
| `Notification` | Envoi par canal pour un événement, ancré sur l'identifiant Frigate. **Seul fait persisté d'une détection** : les détections elles-mêmes ne sont pas stockées (ADR-49) | — |
| `Session` | Refresh token | — |

Entités secondaires (positions PTZ, plannings privacy, réglages image, config des canaux de
notification…) : voir le dossier des entités.

**Invariants de données** (contraintes d'architecture, pas de détail de colonne) :
- Vyzio ne stocke **aucun embedding ni frame** biométrique — uniquement des métadonnées métier et la
  référence Frigate (`frigate_event_id`) pour proxifier clips et thumbnails.
- Credentials caméra **chiffrés au repos** (`Microsoft.AspNetCore.DataProtection`, §9.1).
- Une capacité caméra n'est jamais activée sans un test réel réussi (`verified`, ADR-28).
- Une `Camera` décrit **une seule scène** : ses `CameraStream` en sont des qualités, jamais des angles
  de vue différents. Un boîtier multi-objectifs donne N `Camera` groupées par appareil (ADR-38).
- Un réglage d'installation se surcharge par caméra via une colonne **nullable** sur `Camera` ; `null`
  signifie « suivre l'installation » et jamais une valeur déguisée. La résolution `surcharge ?? global`
  a un point unique dans `Core`, partagé par la génération de configuration et la frontière API (ADR-39).

---

## 8. Architecture de déploiement

### 8.1 Docker Compose (self-hosted)

Trois conteneurs sur un réseau Docker interne — fichier réel : [`docker-compose.yml`](../docker-compose.yml) :

- **frigate** — pipeline vidéo ; API `:5000` liée à `127.0.0.1` (jamais exposée) ; accès matériel
  optionnel (`/dev/dri` VAAPI, Coral USB).
- **mqtt** (Mosquitto) — bus d'événements ; `:1883` lié à `127.0.0.1`.
- **vyzio** — Core + API ; **seul port exposé à l'utilisateur : `8443` (HTTPS)**.

Frigate n'est jamais joignable directement depuis le réseau : tout transite par le proxy
authentifié Vyzio (ADR-07/16/17).

### 8.2 Onboarding guidé (zéro fichier YAML pour l'utilisateur)

```
Dashboard Vyzio — Assistant de configuration
  Étape 1 : Scan réseau → liste caméras ONVIF détectées
  Étape 2 : Sélection + test connexion + aperçu live
  Étape 3 : Nommage ("Porte d'entrée") + zones de détection (canvas)
            → Vyzio génère frigate.yml + docker compose restart frigate
  Étape 4 : Ajout premier profil (upload photo)
  Étape 5 : Test notification push
  → Surveillance active
```

---

## 9. Sécurité

### 9.1 Threat model

| Menace | Surface | Mitigation |
|---|---|---|
| Accès non autorisé au dashboard | Réseau local | JWT + TLS, rate limiting |
| Accès direct API Frigate | Réseau local | Frigate lié à `127.0.0.1`, non routable hors Docker |
| Exfiltration données biométriques Frigate | API Vyzio | Vyzio ne stocke pas d'embeddings ; seules des métadonnées métier sont exposées |
| Interception thumbnail hors réseau | FCM / Tunnel | URL signée HMAC TTL 5min + HTTPS |
| Injection via EF Core | API | Requêtes paramétrées uniquement, zéro SQL brut |
| Credentials caméra en clair | SQLite | Chiffrement via `Microsoft.AspNetCore.DataProtection` |
| Brute-force login | POST /api/auth/login | Rate limiting 5 req/15min/IP |

### 9.2 Isolation réseau

```
Internet (optionnel)
  └─► Cloudflare Tunnel ──► 8443 (HTTPS Vyzio)
                                        │
Réseau local                            │
  └─► Navigateur ──► 8443 (HTTPS) ─► Vyzio API
                                        │
Docker internal network (non routable depuis l'extérieur)
  ├── vyzio ──► frigate:5000    (HTTP REST)
  ├── vyzio ──► mqtt:1883       (MQTT)
  └── composants Vyzio internes (API + services)
```

---

## 10. Performances et scalabilité

### 10.1 Budget ressources — Intel NUC i5, 8 GB RAM

| Conteneur | RAM cible | Notes |
|---|---|---|
| Frigate | 400–800 MB | Variable : nb caméras, modèle IA |
| Vyzio Core + API (.NET 10 NativeAOT) | ~150 MB | NativeAOT réduit significativement l'empreinte |
| **Total** | **~0.9–1.1 GB** | Profil cible sans worker Python dédié |

### 10.2 Latence pipeline reconnaissance (CPU-only)

| Étape | Responsable | Temps estimé |
|---|---|---|
| Détection personne | Frigate TFLite | ~50ms |
| Enrichissement face (mode par défaut) | Frigate | ~100–400ms |
| Règles métier + dispatch notification | Vyzio | ~5–20ms |
| FCM push | Notification Service | ~200ms réseau |
| **Total perçu (mode par défaut)** | | **~350–700ms** |

Avec **Coral Edge TPU** (Frigate) + **GPU** (enrichissements Frigate) : latence perçue significativement réduite.

---

## 11. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|:---:|:---:|---|
| Breaking change API/MQTT Frigate | Faible | Moyen | `FrigateAdapter` versionné, tests contrat MQTT |
| Arrêt projet Frigate | Très faible | Élevé | Architecture découplée — `FrigateAdapter` remplaçable |
| Faux positif reconnaissance faciale | Moyen | Élevé | Seuil configurable, mode "incertain", confirmation depuis notification |
| Caméra incompatible Frigate | Moyen | Faible | Frigate supporte >200 modèles + fallback RTSP manuel |
| Dérive fonctionnelle Frigate (évolutions rapides) | Moyen | Moyen | Version pinning, matrice de compatibilité, tests de non-régression |
| Dette de réimplémentation de features Frigate | Moyen | Élevé | Politique de délégation par défaut (ADR-03) |
| Pression de "rebuild" de features Frigate | Moyen | Élevé | Discipline ADR : comparer options et conserver les choix non retenus |
| Espace disque saturé (clips Frigate) | Moyen | Moyen | Politique rétention Frigate configurée par Vyzio + alertes dashboard |
| Performance CPU sans GPU | Moyen | Moyen | ~500ms acceptable, recommandation Coral TPU documentée |

---

## Annexe A — Synthèse des choix technologiques

| Composant | Technologie | Alternative écartée | Raison |
|---|---|---|---|
| Pipeline vidéo | **Frigate** (open source) | Réimplémentation custom | Ne pas réinventer ce qui existe |
| Langage principal | **.NET 10 (C#)** | Rust | Vélocité + écosystème cohérent (ASP.NET, EF Core, SignalR) |
| Face recognition (par défaut) | **Frigate natif** | Worker custom obligatoire | Réduction de dette, maintenance simplifiée |
| Bus événements | **MQTT** (Mosquitto dédié) | MediatR (écarté), Redis Streams (v2) | Dépendance légère, continuité Frigate |
| Base de données | **SQLite** | PostgreSQL | Zéro infra, plug & play, fichier unique |
| API | **ASP.NET Core Minimal APIs** | FastAPI (Python) | Cohérence stack .NET |
| WebSocket | **SignalR** | WebSocket brut | Reconnexion auto |
| Dashboard | **React 19 + TypeScript** | SvelteKit | Pool contributeurs, écosystème UI |
| UI components | **Shadcn/ui + Tailwind** | Material UI | Accessibilité, personnalisable sans designer |
| Canvas zones | **React-Konva** | Fabric.js | Intégration React native |
| Notification principale | **Telegram Bot** | FCM | Image native hors réseau, setup 30s |
| Notification alternative | **Discord / FCM / ntfy / Email** | WhatsApp (écarté) | Selon préférence utilisateur |
| Auth | **JWT + bcrypt + refresh tokens** | OAuth2/Keycloak | Local-first |
| TLS | **Certificat auto-signé** | Let's Encrypt | Fonctionne hors-ligne |
| Accès distant images | **URL signée HMAC** + tunnel opt-in | Relay Vyzio | Image reste sur l'appliance |

---

## Annexe B — Organisation du code

Monorepo sous `src/`. Backend .NET en couches hexagonales : `Vyzio.Core` (domaine + interfaces) →
`Vyzio.Application` (use cases) → `Vyzio.Infrastructure` (EF/SQLite, MQTT, clients protocole,
`FrigateAdapter`) → `Vyzio.Api` (ASP.NET Core + SignalR) ; tests dans `Vyzio.Tests`. Frontend
`src/dashboard/` (React 19 + TypeScript, miroir domain/application/infrastructure/ui). Setup, tâches
et détail d'arborescence : [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## Annexe C — Choix Étudiés Non Retenus

| Fonctionnalité | Option non retenue | Pourquoi non retenue maintenant | Condition de réévaluation |
|---|---|---|---|
| Reconnaissance faciale | Worker Python dédié (InsightFace + gRPC) | Duplique Frigate, complexifie l'exploitation | Besoin métier non couvert par Frigate ou contrainte de précision spécifique |
| API principale | FastAPI / Node | Introduit un runtime principal supplémentaire | Changement majeur d'équipe/stack |
| Base de données | PostgreSQL | Surcoût opérationnel pour offre local-first | Passage multi-nœud / haute concurrence d'écriture |
| UI | 100% UI custom sans Frigate | Coût et délais élevés, duplication de capacités | Besoin produit fort non atteignable via approche hybride |
