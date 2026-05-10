# Vyzio — Software Architecture Document (SAD)

> Mai 2026 — v2.1 — Document vivant

---

## Table des matières

1. [Introduction et périmètre](#1-introduction-et-périmètre)
2. [Positionnement vis-à-vis de Frigate](#2-positionnement-vis-à-vis-de-frigate)
3. [Contraintes et principes directeurs](#3-contraintes-et-principes-directeurs)
4. [Vue d'ensemble de l'architecture](#4-vue-densemble-de-larchitecture)
5. [Décisions d'architecture (ADR)](#5-décisions-darchitecture-adr)
   - [ADR-01 — S'appuyer sur Frigate plutôt que réimplémenter le pipeline vidéo](#adr-01--sappuyer-sur-frigate-plutôt-que-réimplémenter-le-pipeline-vidéo)
   - [ADR-02 — Langage principal : .NET 10](#adr-02--langage-principal--net-10)
  - [ADR-03 — Reconnaissance faciale : Frigate retenu, worker Python non retenu](#adr-03--reconnaissance-faciale--frigate-retenu-worker-python-non-retenu)
   - [ADR-04 — Communication Frigate → Vyzio : MQTT + API REST Frigate](#adr-04--communication-frigate--vyzio--mqtt--api-rest-frigate)
   - [ADR-05 — Communication inter-services Vyzio : MQTT + Channels](#adr-05--communication-inter-services-vyzio--mqtt--channels)
   - [ADR-06 — Base de données : SQLite](#adr-06--base-de-données--sqlite)
   - [ADR-07 — API : ASP.NET Core](#adr-07--api--aspnet-core)
   - [ADR-08 — Dashboard : React + TypeScript](#adr-08--dashboard--react--typescript)
   - [ADR-09 — Notifications : Telegram (prioritaire) + FCM + canaux alternatifs](#adr-09--notifications--telegram-prioritaire--fcm--canaux-alternatifs)
   - [ADR-10 — Authentification : JWT + bcrypt](#adr-10--authentification--jwt--bcrypt)
    - [ADR-11 — Stratégie UX non-tech : Hub Vyzio simplifié + Frigate avancé](#adr-11--stratégie-ux-non-tech--hub-vyzio-simplifié--frigate-avancé)
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
| C8 | Stack cible : .NET 10 + TypeScript (runtime principal) | `.instructions.md` |

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

Chaque ADR suit le format : **Contexte → Options comparées → Décision → Conséquences**.

---

### ADR-01 — S'appuyer sur Frigate plutôt que réimplémenter le pipeline vidéo

#### Contexte

Le pipeline d'ingestion vidéo (RTSP/ONVIF, décodage H.264/H.265, détection de mouvement, détection de personnes, enregistrement) est un problème difficile et bien résolu. Réimplémenter ce pipeline représenterait des mois de développement pour un résultat inférieur, sans constituer la valeur ajoutée de Vyzio.

#### Options comparées

| Solution | Maturité | Détection personne | ONVIF | Accélération HW | API extensible | Licence |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Frigate** | ✅ v0.17.x, actif | ✅ TFLite/OpenVINO/Coral + enrichissements | ✅ | ✅ VAAPI/NVDEC/Coral | ✅ MQTT + REST | MIT |
| **Shinobi** | ✅ | ⚠️ Basique | ✅ | ⚠️ | ⚠️ API limitée | CC |
| **ZoneMinder** | ✅ Ancien | ⚠️ | ✅ | ⚠️ | ⚠️ API complexe | GPL |
| **MotionEye** | ⚠️ Peu actif | ❌ | ⚠️ | ❌ | ❌ | GPL |
| **Réimplémentation custom** | ❌ | ❌ À construire | ❌ | ❌ | ✅ Total | — |

**Frigate** se distingue par :
- Son intégration **MQTT native** : chaque détection publie un événement structuré consommable sans polling
- Son **API REST documentée** pour les clips, thumbnails et flux live HLS
- Sa **communauté active** (45k+ GitHub stars) et son intégration Home Assistant
- Son support d'**accélérateurs IA dédiés** (Coral Edge TPU, Intel OpenVINO, NVIDIA) — détection temps réel même sur Raspberry Pi
- Sa **configuration YAML simple**, déjà familière de l'écosystème domotique

#### Décision

**Frigate est le moteur d'ingestion vidéo et de détection de Vyzio.** Il est embarqué tel quel dans le Docker Compose et l'appliance, sans modification de son code source. Vyzio interagit avec Frigate exclusivement via ses interfaces publiques (MQTT + REST API).

La configuration Frigate (`config.yml`) est **générée et gérée par Vyzio** — l'utilisateur ne touche jamais ce fichier directement. L'onboarding Vyzio écrit cette configuration via l'assistant du dashboard.

#### Conséquences

- ✅ Pipeline vidéo production-ready dès le jour 1
- ✅ Support matériel (Coral, GPU, CPU) sans développement additionnel
- ✅ Mises à jour Frigate bénéficient à Vyzio automatiquement
- ✅ Développement concentré sur la vraie valeur ajoutée (reconnaissance faciale, UX)
- ⚠️ Dépendance à un projet tiers — mitigée par la couche d'abstraction `FrigateAdapter`
- ⚠️ Frigate est en Python — isolé dans son conteneur, aucune dépendance transitive sur la stack Vyzio

---

### ADR-02 — Langage principal : .NET 10

#### Contexte

Les services Vyzio (orchestration, API, notifications, profils) doivent être implémentés dans un langage performant, typé et adapté aux contraintes embarquées. Les instructions du projet définissent .NET ou Rust comme priorités.

#### Options comparées

| Critère | .NET 10 (C#) | Rust | Go | Python |
|---|:---:|:---:|:---:|:---:|
| Productivité / vélocité | ✅ Élevée | ⚠️ Courbe d'apprentissage | ✅ Bonne | ✅ Élevée |
| Performance | ✅ Excellente (AOT, SIMD) | ✅ Maximale | ✅ Bonne | ❌ GIL |
| Consommation mémoire (NativeAOT) | ✅ ~50 MB | ✅ ~5 MB | ✅ ~15 MB | ❌ ~150 MB+ |
| Écosystème embarqué arm64 | ✅ NativeAOT cross-compile | ✅ | ✅ | ⚠️ |
| ONNX Runtime bindings officiels | ✅ Microsoft | ❌ Non officiel | ❌ | ✅ |
| ORM + migrations | ✅ EF Core | ❌ sqlx (no migrations) | ⚠️ GORM | ✅ Alembic |
| WebSocket / SignalR | ✅ Natif ASP.NET | ✅ tungstenite | ✅ | ✅ |
| Pool de contributeurs | ✅ Large | ⚠️ Niche | ✅ | ✅ |

**Rust** est écarté non pour des raisons de performance, mais de **vélocité** : EF Core + ASP.NET Core + SignalR forment un écosystème cohérent sans assembler des primitives bas niveau. Pour un projet produit avec une équipe de taille réduite, Rust alourdirait le delivery sans bénéfice justifié ici.

#### Décision

**.NET 10 (C#)** pour tous les services Vyzio.

- **NativeAOT** en production : démarrage < 100ms, pas de JIT, empreinte réduite
- **ASP.NET Core + EF Core + MQTT client** pour garder une stack unique du domaine jusqu'aux intégrations
- **SignalR** pour pousser les événements enrichis vers le dashboard en temps réel

#### Conséquences

- ✅ Stack cohérente : ASP.NET Core + EF Core + SignalR dans un seul écosystème
- ✅ NativeAOT → binaires autonomes, pas de runtime installé sur l'appliance
- ✅ arm64 supporté nativement → Raspberry Pi 5, Apple Silicon
- ✅ Pas de runtime Python requis dans l'architecture cible

---

### ADR-03 — Reconnaissance faciale : Frigate retenu, worker Python non retenu

#### Contexte

Depuis Frigate 0.16+, la reconnaissance faciale locale est disponible nativement et intégrée au flux Frigate (UI, filtres, MQTT, notifications). Réimplémenter systématiquement la face recognition dans Vyzio crée une duplication coûteuse.

#### Options comparées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Face Recognition Frigate natif** | Intégration native, maintenance faible, cohérence UI/événements | Dépend des capacités Frigate et de son rythme d'évolution |
| **Worker Python Vyzio obligatoire** | Contrôle complet pipeline IA | Coût élevé, dette de maintenance, duplication d'une feature déjà disponible |
| **Mode hybride** (Frigate par défaut + worker optionnel) | Optimise coûts et garde une porte pour besoins avancés | Complexité de gouvernance de deux modes |

#### Décision

**Solution retenue : Face Recognition native de Frigate.**

Le worker Python dédié reste un **choix étudié, non retenu** en cible v1/v2 car il duplique une capacité déjà mature dans Frigate et augmente fortement la complexité d'exploitation.

#### Choix étudié (non retenu)

Une variante avec service Python isolé a été évaluée :

```
Face Recognition Worker (Python 3.12)
├── Exposé uniquement en gRPC local (port non publié hors Docker network)
├── Aucun accès à SQLite Vyzio
├── Aucun accès au bus MQTT Vyzio
├── Interface unique : Recognize(image) → embeddings + bboxes
└── Stateless — pas de persistance locale
```

Le worker étudié était conçu comme un **microservice de calcul pur**. Toute logique métier aurait dû rester dans le Core .NET.

Transport étudié pour cette option non retenue :

| Option | Latence locale | Contrat typé | Complexité |
|---|:---:|:---:|:---:|
| gRPC | ✅ < 2ms | ✅ Protobuf | ⚠️ Proto à maintenir |
| HTTP/REST (JSON) | ✅ < 5ms | ⚠️ OpenAPI | ✅ Minimal |
| Unix socket | ✅ < 1ms | ❌ | ⚠️ |

```protobuf
service FaceRecognition {
  rpc Recognize (RecognizeRequest) returns (RecognizeResponse);
  rpc ComputeEmbedding (EmbeddingRequest) returns (EmbeddingResponse);
}
message RecognizeRequest  { bytes image_jpeg = 1; }
message RecognizeResponse { repeated FaceResult faces = 1; }
message FaceResult {
  repeated float embedding = 1;  // 512 dims ArcFace
  BoundingBox    bbox       = 2;
  float          confidence = 3;
}
```

#### Conséquences

- ✅ Réduction de la dette de réimplémentation
- ✅ Stack opérationnelle plus simple (moins de conteneurs, moins de surfaces de panne)
- ✅ Time-to-market meilleur pour une offre non-tech
- ✅ Les options étudiées sont conservées dans la documentation pour réévaluation future

---

### ADR-04 — Communication Frigate → Vyzio : MQTT + API REST Frigate

#### Contexte

Frigate publie nativement ses événements de détection et d'enrichissement sur MQTT et expose une API REST. Vyzio doit consommer ces événements pour appliquer ses règles métier, persister les événements utiles et déclencher les notifications.

#### Topics MQTT Frigate utilisés

```
frigate/events            → Création/mise à jour d'une détection (person, car, etc.)
frigate/{camera}/motion   → État du mouvement (true/false)
frigate/stats             → Santé système Frigate
```

#### Contrat d'entree Frigate retenu

Vyzio retient un **contrat d'entree volontairement borne** par rapport a l'ensemble des topics et champs Frigate disponibles. Le but est de limiter le couplage aux donnees necessaires a la solution cible retenue.

**Topic consomme dans l'architecture cible actuelle :**

- `frigate/events`

**Topics non consommes par Vyzio dans l'architecture cible actuelle :**

- `frigate/{camera}/motion` : utile pour du contexte, mais non requis par la solution retenue ;
- `frigate/stats` : reserve a l'observabilite et a l'administration, pas au flux metier Vyzio ;
- tout autre topic Frigate non documente dans le present contrat.

**Regles de filtrage cote Vyzio :**

- Vyzio ne consomme que les messages `frigate/events` possedant un objet `after` exploitable ;
- Vyzio applique un filtre configurable par l'utilisateur sur `after.label` pour determiner quels types de detection entrent dans le flux metier nominal ;
- la solution cible doit permettre au minimum d'activer ou desactiver des categories telles que `person`, `car`, `dog`, `cat` selon les capacites exposees par Frigate ;
- les champs inconnus sont ignores par le `FrigateAdapter` tant qu'un besoin n'a pas ete valide dans les SPECS/SAD.

**Champs Frigate requis pour entrer dans le domaine Vyzio :**

| Champ | Statut | Usage Vyzio |
|---|---|---|
| `type` | requis | cycle de vie Frigate (`new`, `update`, `end`) |
| `after.id` | requis | identifiant externe stable Frigate |
| `after.camera` | requis | nom logique de camera |
| `after.label` | requis | type de detection Frigate soumis au filtrage configurable Vyzio |
| `after.start_time` | requis | horodatage de debut de detection |

**Champs Frigate optionnels retenus :**

| Champ | Statut | Usage Vyzio |
|---|---|---|
| `after.sub_label` | optionnel | identite enrichie par Frigate si disponible |
| `after.score` | optionnel | score de detection |
| `after.top_score` | optionnel | fallback si `score` n'est pas present |
| `after.end_time` | optionnel | fin de detection |
| `after.has_clip` | optionnel | autorise ensuite un proxy clip |
| `after.has_snapshot` | optionnel | autorise ensuite un proxy snapshot/thumbnail |

**Ressources REST Frigate autorisees en complement :**

- `GET /api/events/{id}` pour completer un evenement deja connu ;
- `GET /api/events/{id}/thumbnail.jpg` ou ressource equivalente exposee par Frigate pour l'image ;
- `GET /api/events/{id}/clip.mp4` ou ressource equivalente exposee par Frigate pour le clip.

Vyzio ne persiste pas le payload Frigate brut en entier. Il conserve uniquement les champs utiles a ses regles, a ses notifications et a son exposition API.

**Evenement interne minimal publie par le `FrigateAdapter` :**

```json
{
  "source": "frigate",
  "frigate_event_id": "1715000000.123-abc",
  "lifecycle": "new",
  "camera": "front_door",
  "label": "dog",
  "identity": null,
  "confidence": 0.92,
  "occurred_at": "2024-05-06T12:13:20Z",
  "has_clip": true,
  "has_snapshot": true
}
```

**Regles de normalisation minimales :**

- `frigate_event_id` ← `after.id`
- `camera` ← `after.camera`
- `label` ← `after.label`
- `identity` ← `after.sub_label` si present, sinon `null`
- `confidence` ← `after.score`, sinon `after.top_score`, sinon `null`
- `occurred_at` ← `after.start_time` par defaut ; `after.end_time` peut etre retenu pour un message `end` s'il est present
- `has_clip` ← `after.has_clip ?? false`
- `has_snapshot` ← `after.has_snapshot ?? false`

**Consequences d'architecture :**

- le flux metier nominal repose sur un sous-ensemble configurable des labels Frigate, pilote par les preferences utilisateur ;
- le schema Vyzio n'a pas a modeliser tout le payload MQTT Frigate ;
- les futurs tests d'integration devront verifier ce contrat minimal plutot qu'un reflet integral des messages Frigate.

Exemple de payload `frigate/events` :
```json
{
  "type": "new",
  "after": {
    "id": "1715000000.123-abc",
    "camera": "front_door",
    "label": "person",
    "score": 0.92,
    "thumbnail": "/api/events/1715000000.123-abc/thumbnail.jpg",
    "has_clip": true,
    "start_time": 1715000000.123
  }
}
```

#### Décision

- **MQTT** (broker Mosquitto dédié sur le réseau Docker interne) pour les événements temps réel
- **API REST Frigate** pour : thumbnails, clips, configuration caméras, flux live HLS

Le `FrigateAdapter` est le **seul composant d'infrastructure couplé à Frigate**. Il traduit les événements Frigate en événements du domaine Vyzio et les publie sur les topics MQTT Vyzio. Le reste des composants consomme uniquement les événements normalisés Vyzio.

```csharp
// Seul composant couplé à Frigate
public class FrigateAdapter : IHostedService
{
    // Souscrit MQTT frigate/events
  // Transforme FrigateEvent → DetectionEnrichedEvent (domaine Vyzio)
  // Publie via un bus d'événements Vyzio (MQTT)
}
```

#### Conséquences

- ✅ Couplage limité à une seule classe — migration vers autre backend vidéo possible
- ✅ Broker MQTT dédié, explicite et réutilisable par Frigate puis Vyzio
- ⚠️ Format MQTT Frigate peut évoluer — versionner le `FrigateAdapter`

---

### ADR-05 — Communication inter-services Vyzio : MQTT + Channels

#### Contexte

Les composants Vyzio (règles métier, storage, notification) doivent réagir aux mêmes événements de façon découplée. MediatR est explicitement écarté.

#### Options comparées

| Solution | Complexité | Dépendance infra | Persistance events | Continuité Frigate | Intégrations tierces |
|---|:---:|:---:|:---:|:---:|:---:|
| **MQTT** (Mosquitto dédié) | ✅ Faible | ✅ Léger | ⚠️ QoS 1 | ✅ | ✅ |
| **Redis Streams** | ⚠️ +1 conteneur | ❌ | ✅ Oui | ❌ | ⚠️ |
| HTTP callbacks internes | ⚠️ | ✅ | ❌ | ⚠️ | ❌ |
| MediatR | ❌ Écarté | ✅ | ❌ | ❌ | ❌ |
| gRPC streaming | ⚠️ | ❌ | ❌ | ❌ | ❌ |

**MQTT** : un broker Mosquitto dédié tourne sur le réseau Docker interne. Frigate y publie ses événements et Vyzio peut s'y raccorder sans couplage aux processus internes de Frigate. QoS 1 garantit la livraison at-least-once et le broker reste exposable localement pour les intégrations de développement.

**Redis Streams** : persistance robuste, groupes de consommateurs, replay d'événements. Solution préférable si les composants Vyzio deviennent plusieurs processus distincts. Overhead : ~30 MB + 1 conteneur. Retenu comme **option v2** si le besoin de persistance forte se confirme.

**HTTP callbacks internes** : solution simple mais plus couplée, moins naturelle pour exposer les événements Vyzio aux intégrations tierces et moins cohérente avec Frigate.

#### Décision

**MQTT (broker Mosquitto dédié) pour tous les événements métier.**

Le `FrigateAdapter` souscrit aux topics Frigate et publie des événements Vyzio sur des topics dédiés. Chaque composant Vyzio (ProfileRulesService, StorageService, NotificationService) souscrit indépendamment aux topics qui le concernent.

```
Topics MQTT Frigate (consommés par FrigateAdapter) :
frigate/events                    → detections Frigate retenues dans la solution cible
frigate/{camera}/motion           → non consomme par le flux metier cible

Topics MQTT Vyzio (publiés par Vyzio, consommés par ses propres services + tiers) :
vyzio/events/detection_enriched   → { frigate_event_id, camera, label, sub_label, confidence, occurred_at }
vyzio/events/notification_ready   → { event_id, profile_id, priority, channels }
vyzio/events/camera_status        → { camera, status: online|offline|error }
```

```csharp
// FrigateAdapter : consomme Frigate, publie sur Vyzio topics
public class FrigateAdapter : IHostedService
{
    public async Task HandleFrigateEventAsync(FrigateEvent e)
    {
    // Normalisation (camera, label, sub_label, score, liens Frigate)
    await _mqttClient.PublishAsync("vyzio/events/detection_enriched", payload);
    }
}

// ProfileRulesService : applique le mapping produit et prépare les actions
public class ProfileRulesService : IHostedService
{
  // Souscrit : vyzio/events/detection_enriched
  // Mappe sub_label Frigate vers un profil Vyzio, évalue les règles
  // Publie : vyzio/events/notification_ready
}

// NotificationService : souscrit aux événements enrichis
public class NotificationService : IHostedService
{
  // Souscrit : vyzio/events/notification_ready
  // Envoie Telegram / FCM / webhook
}
```

**Redis Streams** est documenté comme évolution v2 si le besoin de persistance ou de replay d'événements se confirme.

#### Conséquences

- ✅ Dépendance explicite et légère — un broker Mosquitto dédié, visible dans le runtime
- ✅ Continuité avec Frigate — une seule technologie de messagerie dans le système
- ✅ Intégrations tierces (Home Assistant, n8n) nativement exposées sur les topics Vyzio
- ✅ Composants Vyzio découplés — chacun souscrit uniquement aux topics qu'il consomme
- ✅ Testabilité : un broker MQTT léger (Mosquitto en container test) remplace le mock
- ⚠️ MQTT QoS 1 : at-least-once, pas exactly-once — les services doivent être idempotents sur réception
- ⚠️ Pas de persistance native des événements en vol si le broker redémarre — mitigé par QoS 1 et sessions persistantes

---

### ADR-06 — Base de données : SQLite

#### Contexte

Vyzio stocke : profils produit, mapping avec les identités Frigate, événements de reconnaissance, règles de notification et sessions.

#### Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **SQLite** | Zéro infra, fichier unique, backup simple | Concurrence en écriture limitée |
| PostgreSQL | Robustesse multi-process, scalabilité | Complexité d'installation et d'exploitation plus élevée |
| MariaDB/MySQL | Écosystème large | Surcoût opérationnel non nécessaire en local-first |

#### Décision

**SQLite + EF Core** pour tous les déploiements.

```yaml
# vyzio.yml
database:
  connection_string: "Data Source=/data/vyzio.db"
```

- Zéro infrastructure supplémentaire : pas de conteneur dédié, pas de processus séparé
- Sauvegarde triviale : `cp vyzio.db vyzio.db.bak`
- EF Core + `EFCore.NamingConventions` (snake_case) + migrations automatiques au démarrage
- Les données biométriques calculées par Frigate restent dans Frigate ; Vyzio stocke uniquement les métadonnées métier et les références nécessaires à l'orchestration produit
- WAL mode activé pour la concurrence lecture/écriture

#### Conséquences

- ✅ Zéro dépendance infra — plug & play sur mini-PC, Raspberry Pi, NAS
- ✅ Sauvegarde triviale (fichier unique)
- ✅ Empreinte RAM minimale
- ⚠️ 1 seul writer concurrent — acceptable : les services Vyzio sont dans le même processus
- ⚠️ Frigate utilise sa propre SQLite indépendante — aucun partage

---

### ADR-07 — API : ASP.NET Core

#### Contexte

L'API sert le dashboard React, les webhooks et les intégrations tierces. Elle doit exposer des flux temps réel et proxyfier les ressources Frigate avec authentification.

#### Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **ASP.NET Core Minimal APIs** | Cohérence .NET, performance, outillage mature | Expertise .NET requise |
| FastAPI (Python) | Vélocité rapide sur cas simples | Introduit un second runtime principal |
| NestJS/Node | Ecosystème web riche | Moins cohérent avec le cœur .NET |

#### Décision

**ASP.NET Core (.NET 10) — Minimal APIs** avec :
- **SignalR** pour le hub WebSocket événements temps réel → dashboard
- **SSE** via `IAsyncEnumerable` pour les flux légers (état caméras)
- **Scalar** pour la documentation OpenAPI
- Proxy authentifié devant Frigate : clips et flux live HLS redirigés depuis l'API Frigate après vérification du JWT Vyzio — Frigate n'est jamais exposé directement

#### Routes principales

```
GET    /api/cameras                  → Config + état (via Frigate REST)
POST   /api/cameras                  → Ajout (écrit frigate.yml + reload)
GET    /api/cameras/{id}/live        → Proxy HLS Frigate (auth Vyzio)

GET    /api/profiles
POST   /api/profiles                 → Upload photo → sync bibliothèque Frigate + métadonnées Vyzio
DELETE /api/profiles/{id}

GET    /api/events                   → Paginé, filtrable
GET    /api/events/{id}/thumbnail    → Proxy Frigate + URL signée (accès distant)
WS     /hubs/events                  → SignalR hub push temps réel

GET    /api/clips/{id}               → Proxy clip MP4 Frigate (auth Vyzio)

POST   /api/auth/login
POST   /api/auth/refresh
DELETE /api/auth/logout

GET    /api/settings
PATCH  /api/settings
```

#### Conséquences

- ✅ Stack 100% .NET — logs unifiés, DI partagé, même pipeline middleware
- ✅ SignalR gère la reconnexion WebSocket automatiquement côté client
- ✅ Frigate jamais exposé directement — Vyzio est le proxy authentifié obligatoire
- ⚠️ Proxy clips vidéo : utiliser `HttpClient` en streaming pour éviter le buffering mémoire

---

### ADR-08 — Dashboard : React + TypeScript

#### Contexte

Le dashboard est l'interface grand public. Il doit être mobile-first, accessible à des non-techniciens, et gérer des interactions complexes (zones polygonales, flux vidéo, onboarding guidé).

#### Options comparées

| Critère | React + TypeScript | SvelteKit | Vue 3 | Angular |
|---|:---:|:---:|:---:|:---:|
| Maturité / écosystème | ✅ Dominant | ⚠️ Croissant | ✅ | ✅ Entreprise |
| Pool contributeurs open source | ✅ Maximum | ⚠️ | ✅ | ⚠️ |
| Bibliothèques UI (Shadcn, Radix) | ✅ React-first | ⚠️ Portages | ✅ | ✅ |
| TypeScript (instructions projet) | ✅ | ✅ | ✅ | ✅ |
| Bundle size | ⚠️ Moyen (tree-shakeable) | ✅ Très faible | ⚠️ | ❌ |
| Tests (Vitest + Testing Library) | ✅ Standard | ✅ | ✅ | ⚠️ |

SvelteKit offre un bundle plus léger mais React est le choix le plus défendable pour un projet open source : pool de contributeurs maximal et écosystème UI le plus riche pour construire une interface accessible sans designer dédié.

#### Décision

**React 19 + TypeScript + Vite** (SPA, build statique servi par ASP.NET Core).

- **Tanstack Query** — gestion requêtes/cache serveur
- **Tanstack Router** — routing typé TypeScript
- **Shadcn/ui + Tailwind CSS** — composants accessibles, mobile-first
- **React-Konva** — dessin de zones polygonales sur les aperçus caméra
- **@microsoft/signalr** — client SignalR pour les événements temps réel

Pas de SSR (Next.js) : SEO non pertinent sur réseau local, et évite un processus Node.js en production.

#### Conséquences

- ✅ Communauté React maximale pour les contributions
- ✅ Shadcn/ui : composants qualité prod sans designer
- ✅ Build statique servi par ASP.NET Core `StaticFiles` — pas de Node.js en production
- ⚠️ Bundle plus lourd que SvelteKit — sans impact sur réseau local (latence < 1ms)

---

### ADR-09 — Notifications : Telegram (prioritaire) + FCM + canaux alternatifs

#### Contexte

L'exigence clé est de recevoir la **photo de détection directement dans la notification**, y compris hors réseau local. Les canaux de messagerie (Telegram, WhatsApp, etc.) ont été explicitement proposés comme alternative aux notifications push classiques (FCM).

#### Comparatif des canaux de messagerie avec support image natif

| Canal | Image native | Setup utilisateur | Compte tiers requis | Open source | Confidentialité image |
|---|:---:|:---:|:---:|:---:|:---:|
| **Telegram Bot** | ✅ sendPhoto API | ✅ Minimal (1 commande) | ✅ Telegram | ✅ Bot API | ⚠️ Image sur serveurs Telegram |
| **WhatsApp Business API** | ✅ | ❌ Très complexe + payant | ✅ Meta | ❌ | ❌ Meta |
| **Signal** | ✅ | ❌ Pas d'API bot officielle | ✅ | ✅ | ✅ E2E |
| **Discord webhook** | ✅ | ✅ Minimal | ✅ Discord | ❌ | ⚠️ Image sur CDN Discord |
| **Matrix (Element)** | ✅ | ⚠️ Moyen | ✅ (self-hostable) | ✅ | ✅ Si auto-hébergé |
| **FCM + tunnel** | ✅ Via URL signée | ⚠️ Tunnel à configurer | ✅ Google | ✅ | ✅ Image reste locale |
| **ntfy** | ✅ Attachment | ✅ (app ntfy) | Non (self-host) | ✅ | ✅ Si auto-hébergé |

**WhatsApp** : API officielle complexe, payante, réservée aux entreprises. Bibliothèques non officielles contre les CGU. Écarté.

**Signal** : pas d'API bot officielle publique. Écarté (pour l'instant).

**Telegram** : Bot API officielle, gratuite, documentée. `sendPhoto` envoie une image JPEG directement dans le message — l'image transite par les serveurs Telegram mais n'est pas exposée publiquement (lien privé par channel ID + token). Setup en 30 secondes avec `@BotFather`. C'est la solution qui résout le plus simplement l'exigence "voir la photo hors réseau".

#### Décision

**Canal prioritaire : Telegram Bot**

Telegram résout nativement le problème de l'image hors réseau : la photo est envoyée directement dans le message, visible instantanément sur n'importe quel appareil sans tunnel ni URL signée.

```
Setup utilisateur (30 secondes) :
1. Ouvrir Telegram → chercher @BotFather
2. /newbot → récupérer le token
3. Démarrer une conversation avec son bot → récupérer le chat_id
4. Saisir token + chat_id dans le dashboard Vyzio
```

Intégration .NET via l'API HTTP Telegram (pas de SDK lourd nécessaire) :

```csharp
// Envoi photo + caption via Telegram Bot API
var url = $"https://api.telegram.org/bot{_token}/sendPhoto";
using var form = new MultipartFormDataContent();
form.Add(new StringContent(_chatId), "chat_id");
form.Add(new ByteArrayContent(thumbnailJpeg), "photo", "detection.jpg");
form.Add(new StringContent(caption), "caption");  // "Alice est arrivée • Porte d'entrée • 09:32"
form.Add(new StringContent("HTML"), "parse_mode");
await _http.PostAsync(url, form);
```

**Confidentialité** : la photo transite par les serveurs Telegram. C'est un compromis explicite opt-in : l'utilisateur choisit Telegram en connaissance de cause. Les embeddings et données biométriques ne transitent jamais.

**Canaux complémentaires supportés** (configurables indépendamment) :

| Canal | Usage | Image hors réseau |
|---|---|:---:|
| **Telegram** | Principal — grand public | ✅ Natif |
| **Discord webhook** | Utilisateurs gaming/tech | ✅ Natif |
| **FCM (push natif)** | Utilisateurs souhaitant notification système iOS/Android | ✅ Via URL signée + tunnel |
| **ntfy** | Utilisateurs privacy-first sans Telegram | ✅ Via attachment |
| **Webhook générique** | Intégrations (Home Assistant, n8n) | ✅ URL signée |
| **Email** | Fallback | ✅ Image en pièce jointe |

**URL signée HMAC** (maintenue pour FCM, webhook et ntfy) :

```csharp
public string GenerateSignedThumbnailUrl(string eventId, string baseUrl)
{
    var expires = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
    var message = $"{eventId}:{expires}";
    var sig = HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(_secret),
        Encoding.UTF8.GetBytes(message));
    return $"{baseUrl}/api/events/{eventId}/thumbnail?expires={expires}&sig={Convert.ToHexString(sig).ToLower()}";
}
```

#### Conséquences

- ✅ Telegram : photo visible hors réseau sans aucune configuration tunnel — le cas d'usage principal est résolu simplement
- ✅ Setup Telegram en 30 secondes, accessible au grand public
- ✅ Discord : alternative naturelle pour les utilisateurs déjà sur Discord
- ✅ FCM + ntfy maintenus pour les utilisateurs préférant les notifications système ou zéro tiers
- ⚠️ Telegram : la photo transite par leurs serveurs — compromis documenté et opt-in explicite
- ⚠️ FCM seul : nécessite un tunnel pour voir la photo hors réseau — plus complexe à configurer

---

### ADR-10 — Authentification : JWT + bcrypt

#### Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **JWT + refresh tokens (local)** | Local-first, autonome, simple à embarquer | Gestion sécurité à maintenir en interne |
| OAuth2/OIDC externe | Standard entreprise | Dépendance externe, moins adapté offline |
| Reverse-proxy auth uniquement | Simple dans certains déploiements | Moins portable pour une appliance grand public |

#### Décision

**JWT access token (15 min) + refresh token révocable (7 jours, stocké SQLite)** avec bcrypt cost factor 12, implémenté via `Microsoft.AspNetCore.Authentication.JwtBearer`.

- Logout = suppression du refresh token en base → révocation effective
- Rate limiting login : 5 tentatives / 15 min par IP (`AspNetCoreRateLimit`)
- TLS : certificat auto-signé généré au premier démarrage (Trust On First Use)

---

### ADR-11 — Stratégie UX non-tech : Hub Vyzio simplifié + Frigate avancé

#### Contexte

Le besoin produit principal est l'accessibilité pour des utilisateurs non-tech. Frigate est puissant mais expose des concepts parfois complexes (configuration, flux caméra, tuning).

#### Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| UI Frigate seule | Time-to-market maximal | Trop technique pour la promesse grand public |
| UI Vyzio 100% custom | Contrôle total UX | Coût/risque très élevé, duplication |
| **Approche hybride** | Simplicité pour non-tech + puissance expert | Nécessite une gouvernance claire des frontières |

#### Décision

Vyzio adopte une **stratégie UX en deux couches** :

- **Couche 1 (par défaut)** : Hub Vyzio, orienté assistant, vocabulaire non-tech, workflow guidé.
- **Couche 2 (optionnelle)** : UI Frigate en mode avancé pour experts/support.

#### Frontières produit

- Vyzio Hub gère : installation, onboarding, découverte caméra, tests de flux, génération de configuration, presets simples.
- Frigate gère : opérations avancées NVR/enrichissements, debug, tuning expert.
- Vyzio API orchestre la cohérence entre les deux couches et protège l'accès par rôle.

#### Conséquences

- ✅ Répond à la promesse "clef en main" sans perdre la puissance Frigate
- ✅ Réduit le coût de développement UI en réutilisant l'existant pertinent
- ✅ Permet une progression utilisateur du mode simple vers expert
- ⚠️ Exige une documentation claire des parcours simple vs avancé

---

## 6. Architecture des services

### 6.1 Responsabilités

```
Frigate                           → Vidéo brut, détection, clips
Mosquitto Broker                  → Bus MQTT partagé entre Frigate et Vyzio
FrigateAdapter (.NET)             → Pont Frigate ↔ domaine Vyzio (MQTT consumer)
Profile & Rules Service (.NET)    → Profils produit, mapping identités Frigate, règles d'alertes
Notification Service (.NET)       → Règles + envoi FCM/webhook/email
Storage Service (.NET)            → Persistance événements enrichis (EF Core)
API (ASP.NET Core)                → REST + SignalR + proxy Frigate (auth)
Dashboard / Hub (React + TS)      → UI grand public guidée
```

### 6.2 Flux complet : détection → notification

```
1. Frigate détecte une personne
   └─► Publish MQTT sur le broker: frigate/events { label: "person", thumbnail: "...", camera: "front_door" }

2. Broker Mosquitto dédié
   └─► Transporte `frigate/events` vers les consommateurs Vyzio

3. FrigateAdapter (.NET) — souscrit frigate/events
  └─► Normalise l'événement Frigate (label, sub_label, score, thumbnail)
  └─► Publie MQTT sur le broker: vyzio/events/detection_enriched { frigate_event_id, camera, label, sub_label, confidence }

4. Services Vyzio (souscripteurs MQTT indépendants, en parallèle) :

  Mode par défaut (Frigate natif) :
  └─► Frigate publie des objets enrichis (sub_label, face/LPR) sur le broker MQTT
  └─► Vyzio mappe l'identité Frigate vers ses profils produit puis applique ses règles métier

   StorageService — souscrit vyzio/events/detection_enriched
   └─► EF Core INSERT recognition_events

  ProfileRulesService — souscrit vyzio/events/detection_enriched
  └─► RuleEngine : Alice → notify, heure active, pas de rate-limit
  └─► Publie vyzio/events/notification_ready

  NotificationService — souscrit vyzio/events/notification_ready
   └─► Telegram sendPhoto : "Alice est arrivée • Porte d'entrée • 09:32" + photo
   └─► SignalR : push vers dashboard ouvert
```

---

## 7. Modèle de données

### 7.1 Périmètre

Vyzio gère uniquement ses propres données (profils, événements enrichis, notifications, sessions). Les clips et événements vidéo bruts restent dans la base Frigate — Vyzio y accède uniquement via l'API REST Frigate.

### 7.2 Schéma SQLite Vyzio (EF Core)

```sql
CREATE TABLE profiles (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'other',   -- household|known|delivery|pet|other
    alert_mode      TEXT NOT NULL DEFAULT 'notify',  -- notify|silent|ignore
    last_seen_at    TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE observed_events (
    id                TEXT PRIMARY KEY,
    frigate_event_id  TEXT NOT NULL,     -- référence Frigate (pour proxy clips/thumbnails)
  lifecycle         TEXT NOT NULL,     -- new|update|end
  camera            TEXT NOT NULL,
  label             TEXT NOT NULL,     -- person|dog|car|...
  identity          TEXT,              -- sub_label Frigate si disponible
    profile_id        TEXT REFERENCES profiles(id),
    confidence        REAL,
    occurred_at       TEXT NOT NULL,
  has_clip          INTEGER NOT NULL DEFAULT 0,
  has_snapshot      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_events_occurred ON observed_events(occurred_at DESC);
CREATE INDEX idx_events_profile  ON observed_events(profile_id, occurred_at DESC);

CREATE TABLE notifications (
    id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL REFERENCES observed_events(id),
  channel       TEXT NOT NULL,         -- telegram|discord|fcm|webhook|email|ntfy
    status        TEXT NOT NULL DEFAULT 'pending',
    sent_at       TEXT,
    error_message TEXT
);

CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,         -- refresh token
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL                  -- JSON
);
```

---

## 8. Architecture de déploiement

### 8.1 Docker Compose (self-hosted)

```yaml
services:
  frigate:
    image: ghcr.io/blakeblackshear/frigate:stable
    volumes:
      - ./config/frigate.yml:/config/config.yml
      - ./data/frigate:/media/frigate
    devices:
      - /dev/dri:/dev/dri               # Intel VAAPI (optionnel)
      - /dev/bus/usb:/dev/bus/usb       # Coral USB (optionnel)
    ports:
      - "127.0.0.1:5000:5000"           # API Frigate — local uniquement
  mqtt:
    image: eclipse-mosquitto:2
    volumes:
      - ./config/mosquitto.conf:/mosquitto/config/mosquitto.conf
    ports:
      - "127.0.0.1:1883:1883"           # MQTT — local uniquement

  vyzio:
    image: vyzio/core
    volumes:
      - ./data/vyzio:/data
      - ./config/vyzio.yml:/config/vyzio.yml
    ports:
      - "8443:8443"                     # HTTPS — seul port exposé utilisateur
    environment:
      FRIGATE_API_URL: http://frigate:5000
      FRIGATE_MQTT_HOST: mqtt
    depends_on:
      frigate: { condition: service_healthy }
      mqtt: { condition: service_started }
```

**Un seul port exposé à l'utilisateur** : `8443`. Frigate n'est jamais accessible directement depuis le réseau.

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

## Annexe B — Structure du monorepo

```
vyzio/
├── services/
│   ├── vyzio/                     # .NET 10 (C#)
│   │   ├── Vyzio.Core/            # Entités domaine + interfaces (ports)
│   │   ├── Vyzio.Application/     # Use cases métier
│   │   ├── Vyzio.Api/             # ASP.NET Core Minimal APIs + SignalR
│   │   ├── Vyzio.Infrastructure/  # EF Core, SQLite, Telegram, MQTT, FrigateAdapter
│   │   └── Vyzio.Tests/           # xUnit + Testcontainers
│
├── dashboard/                     # React 19 + TypeScript
│   ├── src/
│   │   ├── routes/                # Tanstack Router
│   │   ├── components/            # Shadcn/ui + composants métier
│   │   ├── hooks/                 # Tanstack Query
│   │   └── lib/signalr.ts
│   └── vite.config.ts
│
├── config/
│   ├── frigate.dev.yml            # Fallback de developpement avant config geree par Vyzio
│   └── vyzio.yml
│
├── docker-compose.yml
├── docker-compose.appliance.yml
└── docs/
    ├── SPECS.md
    ├── SAD.md
    └── BUSINESS_PLAN.md
```

---

## Annexe C — Choix Étudiés Non Retenus

| Fonctionnalité | Option non retenue | Pourquoi non retenue maintenant | Condition de réévaluation |
|---|---|---|---|
| Reconnaissance faciale | Worker Python dédié (InsightFace + gRPC) | Duplique Frigate, complexifie l'exploitation | Besoin métier non couvert par Frigate ou contrainte de précision spécifique |
| API principale | FastAPI / Node | Introduit un runtime principal supplémentaire | Changement majeur d'équipe/stack |
| Base de données | PostgreSQL | Surcoût opérationnel pour offre local-first | Passage multi-nœud / haute concurrence d'écriture |
| UI | 100% UI custom sans Frigate | Coût et délais élevés, duplication de capacités | Besoin produit fort non atteignable via approche hybride |
