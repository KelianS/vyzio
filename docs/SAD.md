# Vyzio — Software Architecture Document (SAD)

> Mai 2026 — v2.2 — Document vivant

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
  - [ADR-12 — Gestion des caméras pilotée par Vyzio, appliquée à Frigate](#adr-12--gestion-des-caméras-pilotée-par-vyzio-appliquée-à-frigate)
  - [ADR-13 — Photos de profil : stockage Vyzio + synchronisation via API REST Frigate](#adr-13--photos-de-profil--stockage-vyzio--synchronisation-via-api-rest-frigate)
  - [ADR-14 — Labels de détection par caméra : colonne JSON sur Camera](#adr-14--labels-de-détection-par-caméra--colonne-json-sur-camera)
  - [ADR-15 — Association profil-caméra : table de jointure + filtrage dans ProfileRulesService](#adr-15--association-profil-caméra--table-de-jointure--filtrage-dans-profilerulesservice)
  - [ADR-16 — Accès au flux live : polling latest.jpg via Vyzio, Frigate non exposé](#adr-16--accès-au-flux-live--polling-latestjpg-via-vyzio-frigate-non-exposé)
  - [ADR-17 — Accès aux clips événementiels : proxy Vyzio authentifié en streaming](#adr-17--accès-aux-clips-événementiels--proxy-vyzio-authentifié-en-streaming)
  - [ADR-18 — Enregistrement continu : activation par caméra dans la config Frigate générée](#adr-18--enregistrement-continu--activation-par-caméra-dans-la-config-frigate-générée)
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

#### Portee technique de la configuration des notifications

La cible technique retenue fait porter a Vyzio la configuration des notifications dans un parcours produit stable, en gardant **Telegram comme premier canal guide** et en preparant les abstractions necessaires pour les canaux complementaires.

Le systeme cible doit introduire les briques suivantes :

- une **configuration de notifications persistante** cote Vyzio, stockee en base, au lieu de dependre uniquement d'options runtime injectees au demarrage ;
- un **modele de destination** par canal, avec etat configure / non configure, etat active / inactive, metadonnees de verification et capacites affichees a l'UI ;
- un **modele de regles de diffusion** regroupant au minimum : categories d'evenements notifiees, niveau minimal d'alerte, plages horaires et options de reduction du bruit ;
- un **modele de format de message** permettant d'activer ou non les principaux champs du message (camera, heure, type, identite, apercu) sans dupliquer les templates par canal ;
- une **API de lecture / ecriture** dediee a la configuration des notifications ;
- un **use case de test cible** par destination, decouple du flux de detection normal, afin de verifier la configuration sans attendre un vrai evenement.

Le `NotificationService` ne doit plus dependre d'un unique snapshot `TelegramDetectionNotificationPolicy` fige au demarrage. Il doit resoudre la configuration active depuis un repository ou un provider applicatif, afin de prendre en compte les reglages effectues depuis l'UI.

Les secrets necessaires a un canal tiers (par exemple `bot_token` Telegram) doivent etre traites comme des donnees sensibles dans la couche Infrastructure. Le SAD ne fixe pas ici la technique exacte de protection, mais impose de separer :

- les secrets du canal ;
- le statut produit expose a l'UI ;
- l'historique des envois et tests de notification.

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
- ✅ P3.5 peut etre livre par increments : configuration UI Telegram d'abord, puis extension aux autres canaux sans reouvrir l'architecture
- ⚠️ La configuration des notifications devient un vrai sous-domaine produit : repository, API, validation, test d'envoi et projection UI doivent rester coherents

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

### ADR-12 — Gestion des caméras pilotée par Vyzio, appliquée à Frigate

#### Contexte

Vyzio doit offrir une gestion caméra simple pour un utilisateur non-technicien tout en conservant Frigate comme moteur vidéo et source d'exécution effective. L'utilisateur ne doit jamais modifier manuellement un fichier YAML, mais la cible technique finale reste que les caméras actives soient injectées dans la configuration Frigate puis appliquées par rechargement contrôlé de Frigate.

L'architecture doit donc résoudre simultanément quatre besoins durables :

- fournir un référentiel caméra intelligible côté Vyzio pour l'interface et les règles métier ;
- permettre un parcours guidé d'ajout, de vérification et de correction ;
- produire une configuration Frigate déterministe à partir de l'état validé côté Vyzio ;
- appliquer cette configuration à Frigate sans exposer les détails internes au parcours utilisateur.

Frigate reste responsable de l'ingestion ONVIF/RTSP/MJPEG, du pipeline vidéo, du live preview final et des détections. Vyzio reste responsable du parcours, du vocabulaire produit, de la validation et de l'orchestration de configuration.

#### Décision

La gestion des caméras est modélisée comme une orchestration Vyzio en quatre briques distinctes :

| Brique | Rôle | Source de vérité |
|---|---|---|
| **Camera Catalog** | référentiel Vyzio des caméras connues, de leur nom métier, mode de connexion, état de validation et paramètres utiles à la génération de configuration | SQLite Vyzio |
| **Camera Discovery Adapter** | découverte réseau assistée, qualification des candidats détectés et fallback manuel complet | Frigate/sondage réseau + saisie utilisateur |
| **Camera Config Writer** | génération déterministe de la section `cameras` de la configuration Frigate à partir des caméras actives validées | configuration Frigate générée par Vyzio |
| **Camera Status Projection** | synthèse d'état exploitable par l'UI (`online`, `offline`, `degraded`, `config_error`) à partir des checks Vyzio et du retour Frigate | projection applicative Vyzio |
| **Vendor Guidance Catalog** | notices d'activation, indicateur `camera supported` et aides de parcours par constructeur ou famille de caméras | catalogue applicatif Vyzio |

Cette séparation permet d'éviter deux erreurs :

- piloter directement l'UI depuis les concepts internes Frigate ;
- stocker toute la vérité caméra uniquement dans du YAML difficile à valider, versionner et tester.

#### Architecture cible

Le flux nominal cible est le suivant :

1. Vyzio découvre des équipements réseau via ONVIF, RTSP, HTTP(S) et sondages ciblés.
2. Vyzio qualifie chaque candidat avec un niveau de confiance produit (`camera_confirmed`, `camera_likely`, `device_unknown`) et, si possible, une famille constructeur.
3. Vyzio présente une aide d'activation adaptée quand le flux n'est pas encore exploitable, par exemple pour une caméra sortie de carton avec RTSP ou ONVIF désactivés.
4. Vyzio vérifie la joignabilité et la cohérence minimale du flux une fois les prérequis d'activation réunis.
5. Vyzio enregistre la caméra dans son catalogue avec un statut de validation explicite.
6. Vyzio génère la configuration Frigate complète à partir du catalogue des caméras actives.
7. Vyzio applique cette configuration par écriture atomique du fichier cible puis déclenche un reload/restart maîtrisé de Frigate.
8. Vyzio contrôle le retour de Frigate et met à jour un statut produit lisible pour l'utilisateur.

Le dashboard ne manipule donc jamais directement `frigate.yml`. Il agit sur des ressources Vyzio ; Vyzio dérive ensuite la configuration Frigate effective.

#### Stratégie de découverte et d'assistance retenue

La stratégie produit et technique retenue pour l'onboarding caméra suit quatre étages :

1. **Découverte device** : repérer les équipements potentiellement pertinents via ONVIF multicast, probes RTSP ciblés, probes HTTP(S) et futur support de signaux complémentaires si utiles.
2. **Qualification caméra** : attribuer à chaque candidat un niveau de confiance et une famille probable de constructeur au lieu d'afficher indistinctement tout objet connecté. La récupération best-effort de l'adresse MAC et l'exploitation de l'OUI constructeur sont retenues comme signaux supplémentaires de qualification, sans devenir une source de vérité unique.
3. **Assistance d'activation** : exposer une notice simple, adaptée au constructeur détecté, pour activer RTSP, ONVIF ou le mode de diffusion attendu sans imposer une recherche externe.
4. **Binding Frigate** : ne générer la configuration Frigate qu'une fois un flux effectivement exploitable confirmé.

Conséquence importante : l'activation automatique de RTSP n'est pas une hypothèse générale de l'architecture cible. Elle n'est envisageable que pour certains constructeurs disposant d'une API locale documentée et stable. La cible nominale reste une activation assistée, guidée par Vyzio, puis une reprise automatique du parcours dès que le flux devient joignable.

#### Modèle de qualification retenu

Le niveau d'information affiché à l'utilisateur ne doit pas être un score brut arbitraire. L'architecture retenue distingue :

- **les signaux observés** : ONVIF joignable, réponse RTSP cohérente, interface HTTP caractéristique, informations d'en-tête, OUI constructeur via MAC, chemin RTSP connu, comportement observé lors de la vérification ;
- **la qualification technique interne** : `camera_confirmed`, `camera_likely`, `device_unknown`, utile pour la découverte, le support et l'explication du comportement ;
- **les deux états produit exposés dans le parcours** : `camera supported` oui / non, `RTSP active` oui / non.

La qualification technique interne répond à la question : « cet équipement ressemble-t-il réellement à une caméra exploitable ? ».

L'état `camera supported` répond à la question : « Vyzio sait-il accompagner cette caméra dans le parcours nominal ? ».

L'état `RTSP active` répond à la question : « le flux est-il déjà activable et testable sans étape constructeur supplémentaire ? ».

Les signaux techniques internes et les états produit doivent rester distincts pour éviter deux dérives :

- considérer qu'un équipement est officiellement supporté simplement parce qu'il ressemble à une caméra ;
- exposer dans l'interface grand public une taxonomie technique plus complexe que nécessaire.

Règles d'interprétation retenues :

- `camera_confirmed` exige plusieurs signaux convergents compatibles avec une vraie caméra IP exploitable ;
- `camera_likely` couvre un équipement très probablement caméra mais encore incomplet, ambigu ou non vérifié ;
- `device_unknown` couvre un équipement joignable ou détecté sans preuve suffisante pour le présenter comme caméra ;
- `camera supported = oui` implique que Vyzio dispose d'un parcours nominal exploitable ou d'une guidance constructeur suffisante pour accompagner l'utilisateur ;
- `camera supported = non` implique que Vyzio ne sait pas encore accompagner cette caméra de façon suffisamment fiable dans le parcours nominal ;
- `RTSP active = oui` implique que le flux peut être vérifié immédiatement ;
- `RTSP active = non` implique qu'une étape d'activation ou de correction reste nécessaire avant vérification.

Conséquence d'architecture : les contrats de découverte peuvent conserver la qualification technique et ses raisons pour le support et le debug, mais le parcours utilisateur ne doit exposer que les états `camera supported` et `RTSP active`. L'UI ne doit pas avoir à recalculer cette logique.

#### Contrats API cibles

Les contrats externes doivent exprimer une intention produit, pas un détail d'infrastructure :

```
GET    /api/cameras                    → liste hub-friendly des caméras connues + statut synthétique
POST   /api/cameras/discovery          → renvoie des candidats normalisés issus de la découverte réseau
POST   /api/cameras                    → crée ou enregistre une caméra dans le catalogue Vyzio
POST   /api/cameras/{id}/verify        → teste la connectivité et produit un aperçu exploitable
PATCH  /api/cameras/{id}               → nommage + édition minimale
POST   /api/cameras/{id}/apply         → régénère la configuration Frigate et applique le changement
GET    /api/cameras/{id}/status        → détail d'état et aides à la correction
```

Principes de conception associés :

- les réponses doivent employer un vocabulaire produit (`connected`, `previewAvailable`, `needsAttention`) plutôt que des codes Frigate bruts ;
- la saisie manuelle est un chemin nominal de secours, pas une exception cachée ;
- la découverte doit retourner des candidats qualifiés et des aides d'activation, pas une simple liste brute de ports ouverts ;
- l'adresse MAC, quand elle peut être récupérée de façon fiable depuis l'hôte ou l'appliance, doit être utilisée comme signal complémentaire de qualification et de rattachement vendor ;
- une caméra potentielle sans RTSP actif reste un candidat utile si Vyzio sait fournir une guidance d'activation exploitable ;
- la liste des caméras officiellement supportées doit être maintenue côté Vyzio et exposée au parcours pour rendre le niveau de confiance explicite ;
- l'écriture de configuration doit rester atomique : génération complète puis application, jamais mutation partielle non traçable ;
- la base Vyzio n'est pas la configuration finale exécutée par le moteur vidéo ; elle stocke la vérité métier nécessaire pour générer cette configuration ;
- le hub et la future page caméras consomment le même contrat de statut pour éviter une divergence d'interprétation.

#### Modèle de données minimal côté Vyzio

Un stockage Vyzio dédié est nécessaire pour supporter la gestion métier des caméras et la projection d'état indépendamment des événements de détection.

```
CameraAggregate
  - Id
  - Slug
  - DisplayName
  - SourceType          // onvif | rtsp_manual | http_mjpeg
  - Host
  - Port
  - Username (référence secrète)
  - Password (référence secrète)
  - StreamPath
  - DetectionPreset
  - Status
  - LastReachabilityCheckAt
  - LastSuccessfulFrameAt
  - FrigateCameraName
  - ValidationState
```

Les secrets caméra ne doivent pas être stockés en clair dans la projection métier. Ils restent chiffrés via la stratégie déjà retenue dans le SAD (`DataProtection`) ou référencés via un magasin interne si ce besoin grossit.

#### Intégration Frigate retenue

La configuration finale exécutée par Frigate est générée par Vyzio à partir du catalogue caméra validé :

- Vyzio ne modifie jamais manuellement un fragment isolé côté utilisateur ; il régénère un document de configuration cohérent ;
- la section `cameras` de Frigate est dérivée des caméras actives Vyzio ;
- l'application du changement passe par une écriture atomique suivie d'un reload/restart contrôlé de Frigate ;
- en cas d'échec d'application, le statut utilisateur devient `config_error` et Vyzio conserve la trace du dernier état appliqué avec succès.

Le parcours reste compatible avec la stratégie "Hub Vyzio simplifié + Frigate avancé" :

- **découverte** : utiliser Frigate ou un adaptateur dédié quand une capacité exploitable existe, sans dépendre d'un écran Frigate ;
- **qualification** : distinguer les caméras confirmées, les caméras probables et les équipements non qualifiés avant de les proposer au parcours nominal ;
- **guidance** : exposer une notice par constructeur détecté, avec une liste de modèles officiellement supportés et le niveau d'assistance associé ;
- **prévisualisation** : passer par un proxy Vyzio pour éviter d'exposer directement Frigate au dashboard ;
- **application** : Vyzio régénère la configuration caméra Frigate à partir du catalogue, puis déclenche un reload/restart maîtrisé ;
- **état** : Vyzio recoupe le statut applicatif avec les signaux Frigate pour afficher une information simple au lieu d'un diagnostic brut.

Le point important de conception est de ne pas faire dépendre tout le parcours d'une API de découverte Frigate qui pourrait varier. L'abstraction `CameraDiscoveryAdapter` doit permettre un fallback manuel complet.

#### Conséquences

- ✅ Le dashboard reste découplé de la syntaxe et des contraintes internes de Frigate
- ✅ La base Vyzio sert de référence métier, tandis que Frigate reste la cible d'exécution effective
- ✅ L'état caméra devient un concept produit de premier ordre, au lieu d'être inféré uniquement depuis les détections
- ⚠️ Introduit une nouvelle agrégation métier et une synchronisation explicite BD Vyzio → configuration Frigate
- ⚠️ Le mécanisme de reload/restart Frigate doit être idempotent, observable et validé en environnement Docker réel

---

### ADR-13 — Photos de profil : stockage Vyzio + synchronisation via API REST Frigate

#### Contexte

La reconnaissance faciale de Frigate (v0.16+) repose sur une bibliothèque de photos de référence organisée par nom de personne. Pour qu'un profil Vyzio génère une reconnaissance, ses photos de référence doivent être présentes dans cette bibliothèque. Trois stratégies d'alimentation ont été évaluées.

#### API REST Frigate pour la gestion des faces (v0.16+)

Frigate expose les endpoints suivants pour gérer la bibliothèque de reconnaissance :

```
POST   /api/faces/{name}              → upload d'une photo de référence (multipart/form-data, champ "file")
DELETE /api/faces/{name}/{filename}   → suppression d'une photo de référence spécifique
GET    /api/faces                     → liste toutes les personnes et leurs photos dans la bibliothèque
```

La bibliothèque est physiquement stockée dans le volume Frigate sous `/media/frigate/clips/faces/{name}/`. L'activation de la reconnaissance faciale requiert dans `frigate.yml` :

```yaml
face_recognition:
  enabled: true
  threshold: 0.9    # score minimal pour valider une reconnaissance (0.0–1.0)
  min_area: 10000   # surface minimale du visage détecté en pixels²
```

Lors d'une détection avec reconnaissance réussie, Frigate publie sur MQTT le champ `sub_label` avec le nom de la personne reconnue — déjà consommé par le `FrigateAdapter` Vyzio existant.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Écriture directe dans le volume Frigate** | Vyzio écrit les fichiers photos dans `/media/frigate/clips/faces/{name}/` via un volume Docker partagé | Zéro API, minimal | Couplage fort à la structure interne Frigate ; casse si Frigate change son layout ; photos sous contrôle de Frigate, pas de Vyzio |
| **B — API REST Frigate uniquement** | Vyzio transmet la photo à Frigate via `POST /api/faces/{name}` sans en garder de copie | Simple, découplé | Si Frigate est réinitialisé ou recréé, les photos sont perdues ; pas de source de vérité côté Vyzio |
| **C — Stockage canonique Vyzio + sync via API REST** | Vyzio conserve une copie canonique dans `/data/vyzio/faces/{profile_id}/` et synchronise vers Frigate via `POST /api/faces/{name}` à chaque ajout, retrait ou renommage | Vyzio est source de vérité ; re-sync possible après reset Frigate ; photos sont données utilisateur sous contrôle Vyzio | Deux copies stockées (volume Vyzio + volume Frigate) |

#### Décision

**Option C retenue : stockage canonique Vyzio + synchronisation via API REST Frigate.**

Les photos sont des données utilisateur sensibles. Elles doivent rester sous le contrôle de Vyzio, pas dépendre de la stabilité du volume Frigate. Le `FrigateRestClient` existant est étendu avec les opérations de gestion de bibliothèque. Un use case de re-synchronisation (`ResyncFaceLibraryUseCase`) peut reconstruire l'état Frigate complet depuis les photos Vyzio à tout moment.

**Modèle de stockage local Vyzio :**

```
/data/vyzio/
  faces/
    {profile_id}/
      {photo_id}.jpg     ← copie canonique Vyzio
```

**Contrat `IFrigateRestClient` étendu :**

```csharp
// Ajouts à l'interface existante
Task UploadFacePhotoAsync(string personName, string filename, byte[] imageJpeg, CancellationToken ct = default);
Task DeleteFacePhotoAsync(string personName, string filename, CancellationToken ct = default);
Task<IReadOnlyList<FrigateFaceLibraryEntry>> GetFaceLibraryAsync(CancellationToken ct = default);
```

**Modèle de données côté Vyzio :**

```sql
CREATE TABLE profile_photos (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,                  -- nom canonique dans /data/vyzio/faces/{profile_id}/
    frigate_synced  INTEGER NOT NULL DEFAULT 0,     -- 1 si la photo est présente dans la bibliothèque Frigate
    synced_at       TEXT,
    created_at      TEXT NOT NULL
);
```

**Règle de nommage dans Frigate :** le `personName` transmis à Frigate est le `Profile.Name` (nom affiché). En cas de renommage de profil, une re-sync supprime les photos de l'ancien nom et les réenvoie sous le nouveau nom.

**Activation de la reconnaissance dans `frigate.yml` :** la section `face_recognition` est ajoutée par le `CameraConfigWriter` dès qu'au moins un profil dispose de photos synchronisées.

#### Conséquences

- ✅ Les photos restent sous contrôle de Vyzio — données utilisateur, supprimables intégralement depuis Vyzio
- ✅ Re-synchronisation possible après reset ou recréation du conteneur Frigate
- ✅ Couplage limité à l'API REST Frigate, pas à sa structure de fichiers interne
- ✅ Le statut `frigate_synced` permet d'afficher dans l'UI si une photo est effective dans la reconnaissance
- ⚠️ Deux copies des photos stockées — volume Vyzio + volume Frigate ; acceptable au vu du volume de données (photos de profil, pas de clips vidéo)
- ⚠️ Le renommage d'un profil déclenche une re-sync complète côté Frigate — à traiter dans `UpdateProfileUseCase`

---

### ADR-14 — Labels de détection par caméra : colonne JSON sur Camera

#### Contexte

Chaque caméra doit pouvoir détecter un sous-ensemble des labels Frigate (`person`, `car`, `dog`, `cat`, etc.). Cette configuration est projetée dans la section `objects.track` de chaque caméra dans `frigate.yml`. L'entité `Camera` possède déjà un champ `DetectionPreset` (valeur `"person_default"`) qui n'est pas encore utilisé dans la génération de config.

#### Frigate : structure de configuration des objets détectés

```yaml
cameras:
  front_door:
    objects:
      track:
        - person
        - dog
```

Sans cette section, Frigate utilise les objets définis au niveau global (par défaut `person` uniquement). La liste des labels disponibles dépend du modèle IA configuré dans Frigate — les labels courants sont : `person`, `car`, `motorcycle`, `bicycle`, `dog`, `cat`, `bird`, `deer`, `face`.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Valeurs de preset** | Étendre `DetectionPreset` avec des chaînes prédéfinies (`person_only`, `all_animals`, `full`) | Zéro migration, simple | Rigide ; combinaisons impossibles ; mapping preset → labels doit vivre quelque part |
| **B — Table `CameraDetectionConfig`** | Entité dédiée avec une ligne par label activé par caméra | Requêtes propres, extensible | Join supplémentaire pour la génération de config ; surcoût pour un besoin simple |
| **C — Colonne JSON `detection_labels_json` sur Camera** | Stocker la liste des labels actifs comme JSON sur la table `cameras` | Simple, flexible, pas de join pour la génération | JSON en base moins requêtable — acceptable car aucune query ne filtre sur les labels individuels |

#### Décision

**Option C retenue : colonne JSON `detection_labels_json` sur l'entité `Camera`.**

Le besoin est simple : stocker et lire une liste de chaînes par caméra. Aucune query ne filtre sur un label individuel — la liste est lue en bloc pour la génération de `frigate.yml`. Une table dédiée ajouterait de la complexité sans bénéfice ici. Le champ `DetectionPreset` existant est **remplacé** par `DetectionLabelsJson`.

**Modification de l'entité `Camera` :**

```csharp
// Remplace DetectionPreset
/// <summary>JSON array of active detection labels. Null defaults to ["person"].</summary>
[MaxLength(500)]
public string? DetectionLabelsJson { get; set; }

// Helper (non mappé EF)
public IReadOnlyList<string> GetDetectionLabels() =>
    DetectionLabelsJson is not null
        ? JsonSerializer.Deserialize<List<string>>(DetectionLabelsJson) ?? _defaultLabels
        : _defaultLabels;

private static readonly IReadOnlyList<string> _defaultLabels = ["person"];
```

**Projection dans `FrigateConfigApplier` :**

```csharp
Objects = new FrigateObjectsConfig
{
    Track = camera.GetDetectionLabels().ToList()
},
```

**Labels valides reconnus par Vyzio (liste ouverte, extensible) :**

| Label Frigate | Libellé UI |
|---|---|
| `person` | Personne |
| `face` | Visage |
| `car` | Voiture |
| `motorcycle` | Moto |
| `bicycle` | Vélo |
| `dog` | Chien |
| `cat` | Chat |
| `bird` | Oiseau |
| `deer` | Cerf |

La validation des labels fournis par l'UI se fait dans le use case (`SaveCameraDetectionConfigUseCase`) en comparant à une liste de référence maintenue dans `Core`. Les labels inconnus sont rejetés avec un message explicite.

#### Conséquences

- ✅ Migration minimale — une colonne ajoutée sur la table `cameras` existante
- ✅ Génération de config Frigate directe — pas de join, lecture en bloc
- ✅ La valeur `null` correspond au comportement par défaut (`["person"]`) — compatibilité avec les caméras existantes sans migration de données
- ⚠️ `DetectionPreset` est retiré — les caméras existantes ayant `person_default` seront migrées vers `detection_labels_json = null` (comportement équivalent)
- ⚠️ Un reload Frigate est déclenché dès qu'un label change — à traiter dans `SaveCameraDetectionConfigUseCase` via le `CameraConfigWriter` + `ApplyCommand` existants

---

### ADR-15 — Association profil-caméra : table de jointure + filtrage dans ProfileRulesService

#### Contexte

L'utilisateur veut pouvoir restreindre la reconnaissance à des profils spécifiques par caméra : "reconnaître Alice et Bob uniquement sur la caméra de la porte d'entrée, pas sur la caméra du jardin". Cela implique de modéliser une association N×M entre profils et caméras, et de décider où et comment ce filtre s'applique dans l'architecture.

#### Point clé : la reconnaissance Frigate est globale

La bibliothèque de reconnaissance faciale de Frigate est **globale** — elle ne supporte pas de restriction par caméra. Si Alice est dans la bibliothèque, Frigate peut la reconnaître sur n'importe quelle caméra. La restriction par caméra est donc nécessairement une **règle métier Vyzio**, appliquée après réception de l'événement enrichi, pas dans la configuration Frigate.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Table de jointure `profile_camera_links`** | Table many-to-many explicite avec `profile_id`, `camera_id`, `enabled` | Requêtable, extensible (futurs attributs par lien), source de vérité claire | Migration + entité supplémentaire |
| **B — JSON sur Camera** | Colonne `recognized_profile_ids_json` sur `cameras` | Un seul endroit à lire pour construire la config | Difficile de requêter "sur quelles caméras est Alice ?", JSON en base côté caméra |
| **C — JSON sur Profile** | Colonne `linked_camera_ids_json` sur `profiles` | Symétrique à l'option B | Même limitation que B, sens inversé |
| **D — Aucune association Vyzio — toujours reconnaître sur toutes les caméras** | La bibliothèque Frigate contient tous les profils, pas de filtre Vyzio | Zéro complexité | Ne répond pas au besoin produit ; risque de faux positifs sur des caméras non pertinentes |

#### Décision

**Option A retenue : table de jointure `profile_camera_links` + filtrage dans `ProfileRulesService`.**

La table de jointure est la représentation naturelle d'une relation many-to-many avec état (`enabled`). Elle permet de répondre proprement aux deux sens de la requête ("quels profils sur cette caméra ?" et "sur quelles caméras ce profil ?"). Le filtrage est appliqué dans `ProfileRulesService` lors de la résolution des règles : un événement enrichi avec un `sub_label` Frigate n'est mappé vers un profil Vyzio que si le lien profil-caméra correspondant est actif.

**Modèle de données :**

```sql
CREATE TABLE profile_camera_links (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    camera_id   TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    UNIQUE (profile_id, camera_id)
);
CREATE INDEX idx_pcl_camera ON profile_camera_links(camera_id, enabled);
CREATE INDEX idx_pcl_profile ON profile_camera_links(profile_id, enabled);
```

**Comportement par défaut :** un profil sans aucun lien défini est reconnaissable sur **toutes** les caméras (`null` associations = pas de restriction). Ce comportement est intentionnel pour minimiser la friction lors de la création d'un premier profil. L'utilisateur peut affiner en ajoutant des liens explicites.

**Règle de résolution dans `ProfileRulesService` :**

```
sub_label Frigate reçu sur caméra X
  → chercher un profil Vyzio dont le Name correspond au sub_label
  → vérifier si ce profil a des liens actifs définis
    → s'il n'en a pas : reconnaissance valide sur toutes les caméras
    → s'il en a : reconnaissance valide seulement si un lien actif existe pour la caméra X
  → si valide : mapper l'événement vers le profil, appliquer les règles d'alerte
  → si invalide : conserver l'identité Frigate brute sans mapper vers un profil Vyzio
```

**Impact sur la bibliothèque Frigate :** aucun. La bibliothèque Frigate contient toujours les photos de tous les profils. Le filtrage est exclusivement applicatif côté Vyzio.

#### Conséquences

- ✅ Requêtes propres dans les deux sens (par profil, par caméra)
- ✅ `enabled` permet de désactiver temporairement un lien sans supprimer l'association
- ✅ Compatible avec le comportement par défaut "reconnaître partout" — pas de friction à la création
- ✅ Extensible : on peut ajouter un `alert_override` par lien sans changer la structure globale
- ⚠️ Le `ProfileRulesService` doit charger les liens actifs par caméra lors de chaque évaluation — à mettre en cache court (TTL ~30s) pour éviter une requête SQLite par événement
- ⚠️ La suppression d'une caméra ou d'un profil doit supprimer les liens en cascade (`ON DELETE CASCADE` dans le schéma)

---

### ADR-16 — Accès au flux live : polling latest.jpg via Vyzio, Frigate non exposé

#### Contexte

L'interface Vyzio doit permettre de visualiser le flux en direct de chaque caméra. L'objectif est de minimiser le couplage réseau direct vers Frigate : le navigateur ne doit jamais connaître l'existence de Frigate ni s'y connecter directement. Vyzio est le seul point d'entrée réseau.

#### Endpoints live Frigate disponibles

```
GET  /api/{name}/latest.jpg                  → dernière frame JPEG (polling)
WS   /live/jsmpeg/{name}                     → flux MPEG1 via WebSocket (jsmpeg)
GET  /live/hls/{name}/index.m3u8             → HLS via go2rtc
GET  /live/webrtc/api/ws?src={name}          → WebRTC via go2rtc (peer-to-peer — non proxifiable)
```

**Constat terrain :** Frigate utilise WebSocket + jsmpeg pour son propre live feed — pas de flux MJPEG HTTP natif. WebRTC et jsmpeg sont non proxifiables sans infrastructure dédiée (TURN server, media relay).

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Polling latest.jpg via Vyzio** | `GET /api/cameras/{id}/live/latest.jpg` → proxy Frigate `/api/{slug}/latest.jpg`, rafraîchi à 1fps | Frigate jamais exposé ; 0 dépendance ; fiable sur tout réseau | ~1fps max ; qualité snapshot (pas de streaming fluide) |
| **B — Proxy WebSocket jsmpeg** | Vyzio bridgerait le WebSocket Frigate → navigateur | Fluide (~15fps) | Implémentation complexe (WS bridge ASP.NET Core) ; dépendance jsmpeg.js côté UI |
| **C — Proxy HLS Vyzio** | Proxy m3u8 + segments .ts, réécriture URLs | Bonne qualité, seeking possible | Complexe (URL rewriting) ; latence ~3-5s |
| **D — URL directe Frigate** | Vyzio retourne l'URL Frigate, navigateur se connecte directement | Zéro overhead | Frigate exposé — **non acceptable** |

#### Décision

**Option A retenue : proxy polling `latest.jpg` via `GET /api/cameras/{id}/live/latest.jpg`.**

Vyzio proxifie la dernière frame JPEG de Frigate. Le frontend rafraîchit l'URL toutes les secondes avec un paramètre de cache-busting (`?t=timestamp`) — aucune bibliothèque vidéo requise, aucune connexion WebSocket, implémentation minimale.

Frigate est **uniquement accessible sur le réseau Docker interne** (`vyzio-net`). Le port 5000 n'est pas publié sur l'interface hôte en production.

```csharp
// Implémentation backend
app.MapGet("/api/cameras/{id}/live/latest.jpg", async (string id, IFrigateRestClient frigate, CancellationToken ct) =>
{
    var frigateCamera = camera.FrigateCameraName ?? camera.Slug.Replace('-', '_');
    var response = await frigate.GetLatestFrameAsync(frigateCamera, ct);
    if (!response.IsSuccessStatusCode) return Results.StatusCode((int)response.StatusCode);
    return Results.Stream(await response.Content.ReadAsStreamAsync(ct), "image/jpeg");
});
```

```tsx
// Implémentation frontend — polling avec cache-busting
function CameraLiveView({ cameraId, apiBaseUrl }) {
  const [src, setSrc] = useState(`${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
  useEffect(() => {
    const id = setInterval(() => setSrc(`...?t=${Date.now()}`), 1000)
    return () => clearInterval(id)
  }, [cameraId])
  return <img src={src} />
}
```

**Bande passante estimée :** 1 requête/s, ~20–80 KB par frame JPEG 720p ≈ 20–80 KB/s par caméra — très acceptable sur LAN domestique.

#### Conséquences

- ✅ Frigate jamais exposé au navigateur — réseau simple, un seul point d'entrée (Vyzio)
- ✅ 0 dépendance côté UI (pas de jsmpeg.js, pas de HLS.js)
- ✅ Implémentation minimale et fiable — un simple GET proxifié
- ✅ Compatible accès distant sans révision réseau
- ⚠️ ~1fps — suffisant pour un aperçu de surveillance, pas pour un monitoring temps réel
- ⚠️ Si un live fluide devient nécessaire, l'option B (WebSocket jsmpeg proxy) est le chemin naturel

---

### ADR-17 — Accès aux clips événementiels : proxy Vyzio authentifié en streaming

#### Contexte

Chaque événement de détection peut produire un clip MP4 dans Frigate (si l'enregistrement de clips est activé). Le champ `has_clip` dans `observed_events` indique si un clip est disponible. L'UI doit permettre de lire ce clip depuis l'historique. À la différence du flux live (continu, haute bande passante), les clips sont des fichiers courts (<60s en général) : le proxy est acceptable.

#### Endpoints clips Frigate disponibles

```
GET /api/events/{event_id}/clip.mp4       → clip événementiel MP4
GET /api/events/{event_id}/thumbnail.jpg  → miniature de l'événement
GET /api/events/{event_id}/snapshot.jpg   → snapshot haute résolution
```

Frigate stocke les clips sous `/media/frigate/clips/` dans son volume. La rétention est contrôlée par la section `record.retain` de la config Frigate générée.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — URL directe Frigate** | Vyzio retourne l'URL Frigate, le navigateur accède directement | Zéro overhead serveur | Frigate exposé sans auth ; problème CORS selon navigateur |
| **B — Proxy Vyzio authentifié** | `GET /api/detection-events/{id}/clip` → Vyzio proxifie le MP4 depuis Frigate en streaming | Auth Vyzio obligatoire ; Frigate jamais exposé pour les clips ; pas de CORS | Overhead serveur modéré — acceptable (fichiers courts, pas de flux continu) |
| **C — Volume partagé + serve statique** | Vyzio monte le volume clips Frigate et les sert directement | Performance maximale | Couplage fort au layout interne Frigate ; déconseillé |

#### Décision

**Option B retenue : proxy Vyzio authentifié en streaming pour les clips et thumbnails.**

La route `GET /api/detection-events/{id}/clip` valide le JWT Vyzio, résout le `frigate_event_id` dans `observed_events`, puis proxifie le MP4 depuis `http://frigate:5000/api/events/{frigate_event_id}/clip.mp4` en **streaming chunked** pour éviter le buffering mémoire complet.

```csharp
// Principe de l'implémentation (pas de buffering complet)
var frigateStream = await httpClient.GetStreamAsync(frigateClipUrl, ct);
return Results.Stream(frigateStream, "video/mp4", enableRangeProcessing: true);
```

Le support des **Range headers** (HTTP 206) est activé pour permettre la navigation dans le clip depuis le player navigateur sans retélécharger le fichier entier.

**Routes exposées :**

```
GET /api/detection-events/{id}/clip        → proxy clip MP4 (streaming, Range support)
GET /api/detection-events/{id}/thumbnail   → proxy thumbnail JPEG (déjà existant via FrigateSnapshotProvider)
```

**Rétention clips Frigate :** contrôlée par la section `record` de `frigate.generated.yml`. Vyzio projette la rétention configurée par l'utilisateur (en jours) dans ce fichier. Quand Frigate supprime un clip arrivé à terme, `has_clip` dans `observed_events` n'est pas mis à jour automatiquement — l'UI doit gérer gracieusement un 404 sur la route clip.

#### Conséquences

- ✅ Auth Vyzio validée avant tout accès aux clips — Frigate jamais exposé pour les médias
- ✅ Support Range HTTP → navigation dans le clip sans re-download complet
- ✅ Pas de couplage au layout interne Frigate (volume)
- ⚠️ Overhead proxy modéré — acceptable pour des clips <60s ; à monitorer si clips longs (enregistrement continu)
- ⚠️ `has_clip: true` peut devenir obsolète si Frigate a supprimé le clip par rétention — l'UI affiche un état "clip expiré" si 404 reçu

---

### ADR-18 — Enregistrement continu : activation par caméra dans la config Frigate générée

#### Contexte

En plus des clips événementiels (court extrait autour d'une détection), Frigate supporte un mode d'enregistrement continu par caméra. Ce mode permet de conserver une vidéo complète sur une durée configurable, utile pour retrouver un événement qui n'a pas déclenché de détection. Ce mode a un impact significatif sur le stockage et doit être opt-in par caméra.

#### Configuration Frigate pour les clips événementiels et l'enregistrement continu

```yaml
# Clips événementiels (autour de chaque détection)
record:
  enabled: true
  retain:
    days: 7          # durée de rétention des segments sans événement
    mode: motion     # motion | continuous | active_objects
  events:
    retain:
      default: 14    # durée de rétention des clips liés à un événement

# Par caméra (surcharge la config globale)
cameras:
  front_door:
    record:
      enabled: true   # active l'enregistrement pour cette caméra
```

#### Décision

**L'enregistrement continu est activé par caméra via un champ booléen `ContinuousRecordingEnabled` dans `CameraDetectionConfig`, projeté dans la section `record` de `frigate.generated.yml` par le `CameraConfigWriter`.**

La rétention globale des clips est configurée au niveau du fichier Frigate généré via une section `record` globale. L'activation par caméra surcharge cette section.

**Extension du modèle `CameraDetectionConfig` :**

```csharp
public sealed class CameraDetectionConfig
{
    public string CameraId { get; init; } = "";
    public IReadOnlyList<string> ActiveLabels { get; init; } = [];
    public bool ContinuousRecordingEnabled { get; init; } = false;  // nouveau champ
}
```

**Projection dans `CameraConfigWriter` :**

```yaml
cameras:
  {slug}:
    record:
      enabled: {continuousRecordingEnabled}
    objects:
      track:
        - {label}
```

La section `record` globale (rétention) reste gérée par une config par défaut dans `CameraConfigWriter` et sera exposée dans l'UI en US-P3.7 ou une future story.

**Impact stockage estimé :**
- 1 caméra 1080p, H.264, 15fps ≈ 1–3 GB/jour selon la complexité de la scène
- L'UI doit afficher cet ordre de grandeur avant activation pour informer l'utilisateur

#### Conséquences

- ✅ Activation par caméra — zéro impact sur les caméras non concernées
- ✅ Projeté via le `CameraConfigWriter` existant — pas de nouveau pipeline
- ✅ Aucune migration EF Core nécessaire si `ContinuousRecordingEnabled` est ajouté à la colonne JSON existante `detection_labels_json` (ou dans une colonne dédiée)
- ⚠️ Activation massive → saturation disque rapide — l'UI doit avertir explicitement avant activation
- ⚠️ La rétention est contrôlée par Frigate, pas par Vyzio directement — la valeur configurée dans `frigate.yml` est la source de vérité

---

### ADR-19 — Protocole dvrip/XMEye : go2rtc comme passerelle de fallback, transparent pour Frigate

#### Contexte

Un ensemble de cameras grand public tournant sur firmware **Xiongmai** (ICSee, XMEye, Annke, Sannce, Zosi, Floureon, ieGeek et tout autre OEM) communique via un protocole binaire proprietaire, **DVRIP/XMEye**, sur le port TCP 34567. Ces cameras peuvent ou non exposer du RTSP — les modeles sur batterie en particulier desactivent souvent RTSP ou ne l'exposent pas du tout.

**Le chemin principal reste toujours RTSP.** go2rtc/dvrip est un **mode de fallback** propose uniquement quand RTSP n'est pas disponible et que le port 34567 repond au magic byte 0xFF du protocole DVRIP. Ce mode est generaliste : il s'applique a toute camera repondant sur ce port, independamment de la marque.

go2rtc est **deja embarque dans Frigate** (depuis v0.12). Il supporte le protocole `dvrip://` et peut retranscrire le flux en RTSP interne sur `127.0.0.1:8554`. Frigate peut donc consommer ce flux go2rtc exactement comme n'importe quelle camera RTSP.

#### Options comparées

| Option | Description | Avantages | Inconvenients | Verdict |
|---|---|---|---|---|
| **A — RTSP direct (chemin principal)** | La camera expose RTSP nativement | Simple, universel, aucun intermediaire | Non disponible sur les modeles batterie cloud-only | ✅ Toujours prefere quand disponible |
| **B — go2rtc dvrip (fallback, retenu)** | go2rtc connecte via dvrip:// et expose en RTSP interne | Deja embarque dans Frigate, aucun conteneur supplementaire, transparent pour Frigate | go2rtc doit etre configure dans le YAML Frigate ; camera doit etre eveilllee au demarrage | ✅ Retenu comme fallback |
| **C — Conteneur proxy dedie** | Sidecar Python/Go qui transcrit dvrip en RTSP | Isolation maximale | Complexite deploiement, surface d'attaque supplementaire | ❌ Sur-ingenierie |

#### Décision

**Le mode dvrip est un fallback propose par Vyzio uniquement quand RTSP n'est pas disponible et que le port 34567 repond au magic byte DVRIP.** Il est generaliste (toute marque sur firmware Xiongmai) et independant de la famille de constructeur detectee.

Pour les cameras avec `StreamProtocol == "dvrip"`, Vyzio genere une section `go2rtc` dans le `config.yml` Frigate. L'input ffmpeg pointe vers `rtsp://127.0.0.1:8554/{camera_slug}`. Le changement est transparent pour le reste du pipeline Frigate.

**Champ discriminant sur l'entite `Camera` :**

```csharp
[MaxLength(20)]
public string StreamProtocol { get; set; } = "rtsp"; // "rtsp" | "dvrip"
```

**Section `go2rtc` generee dans `config.yml` quand au moins une camera utilise `dvrip` :**

```yaml
go2rtc:
  streams:
    {camera_slug}:
      - dvrip://{username}:{password}@{host}:{port}

cameras:
  {camera_slug}:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/{camera_slug}
          roles:
            - detect
```

#### Conséquences

- ✅ Aucun conteneur supplementaire — go2rtc est deja dans Frigate
- ✅ Transparent pour le reste du pipeline : Frigate voit toujours du RTSP
- ✅ Extensible a d'autres protocoles go2rtc supports (rtmp, http-mjpeg, etc.)
- ⚠️ La camera doit etre eveilllee au moment du demarrage de Frigate — go2rtc reessaie mais ne peut pas reveiller une camera en veille profonde
- ⚠️ Migration EF Core necessaire pour le champ `StreamProtocol`

---

## 6. Architecture des services

### 6.1 Responsabilités

```
Frigate                           → Vidéo brut, détection, clips, bibliothèque de reconnaissance faciale
Mosquitto Broker                  → Bus MQTT partagé entre Frigate et Vyzio
FrigateAdapter (.NET)             → Pont Frigate ↔ domaine Vyzio (MQTT consumer + REST client)
FrigateRestClient (.NET)          → Appels REST Frigate : sub_label, upload photos faces, bibliothèque
Profile & Rules Service (.NET)    → Profils produit, mapping sub_label → profil, filtre profil-caméra, règles d'alertes
Notification Service (.NET)       → Règles + envoi FCM/webhook/email
Storage Service (.NET)            → Persistance événements enrichis (EF Core)
FaceLibrarySyncService (.NET)     → Synchronisation des photos de profil Vyzio vers la bibliothèque Frigate
CameraConfigWriter (.NET)         → Génération frigate.yml : caméras, labels détection, face_recognition
API (ASP.NET Core)                → REST + SignalR + proxy Frigate (auth)
Dashboard / Hub (React + TS)      → UI grand public guidée
```

### 6.2 Flux complet : détection → notification

```
1. Frigate détecte une personne (bibliothèque faces déjà synchronisée par FaceLibrarySyncService)
   └─► Reconnaissance faciale Frigate : compare avec bibliothèque → sub_label = "Alice" si match
   └─► Publish MQTT: frigate/events { label: "person", sub_label: "Alice", camera: "front_door" }

2. Broker Mosquitto dédié
   └─► Transporte frigate/events vers les consommateurs Vyzio

3. FrigateAdapter (.NET) — souscrit frigate/events
   └─► Normalise l'événement : label, sub_label (via REST si absent du MQTT), score, liens clips/snapshot
   └─► Publie MQTT: vyzio/events/detection_enriched { frigate_event_id, camera, label, identity: "Alice", confidence }

4. Services Vyzio (souscripteurs MQTT indépendants, en parallèle) :

   StorageService — souscrit vyzio/events/detection_enriched
   └─► EF Core INSERT observed_events (identity = "Alice", profile_id = résolu si lien actif)

   ProfileRulesService — souscrit vyzio/events/detection_enriched
   └─► Résolution profil : identity "Alice" → chercher profil Vyzio par name
   └─► Vérification lien profil-caméra : Alice associée à "front_door" ? (ADR-15)
       → si oui ou aucun lien défini : mapper → profil Alice, appliquer alert_mode
       → si non : événement sans profil mappé, pas de notification profil
   └─► Publie vyzio/events/notification_ready { profile_id, priority, channels }

   NotificationService — souscrit vyzio/events/notification_ready
   └─► Telegram sendPhoto : "Alice est arrivée • Porte d'entrée • 09:32" + photo
   └─► SignalR : push vers dashboard ouvert

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

-- Photos de référence pour la reconnaissance Frigate (ADR-13)
CREATE TABLE profile_photos (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,          -- nom du fichier dans /data/vyzio/faces/{profile_id}/
    frigate_synced  INTEGER NOT NULL DEFAULT 0,  -- 1 si présente dans la bibliothèque Frigate
    synced_at       TEXT,
    created_at      TEXT NOT NULL
);
CREATE INDEX idx_photos_profile ON profile_photos(profile_id);

-- Associations profil-caméra pour filtrage de reconnaissance (ADR-15)
CREATE TABLE profile_camera_links (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    camera_id   TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    UNIQUE (profile_id, camera_id)
);
CREATE INDEX idx_pcl_camera  ON profile_camera_links(camera_id, enabled);
CREATE INDEX idx_pcl_profile ON profile_camera_links(profile_id, enabled);

CREATE TABLE cameras (
    id                        TEXT PRIMARY KEY,
    slug                      TEXT NOT NULL UNIQUE,
    display_name              TEXT NOT NULL,
    source_type               TEXT NOT NULL DEFAULT 'rtsp_manual',
    host                      TEXT NOT NULL,
    port                      INTEGER NOT NULL DEFAULT 554,
    username                  TEXT,
    password                  TEXT,
    stream_path               TEXT,
    vendor_family             TEXT,
    detection_labels_json     TEXT,   -- JSON array ex: ["person","dog"] ; null = ["person"] (ADR-14)
    status                    TEXT NOT NULL DEFAULT 'needs_attention',
    validation_state          TEXT NOT NULL DEFAULT 'draft',
    is_enabled                INTEGER NOT NULL DEFAULT 0,
    last_reachability_check_at TEXT,
    last_successful_frame_at  TEXT,
    frigate_camera_name       TEXT,
    created_at                TEXT NOT NULL,
    updated_at                TEXT NOT NULL
    -- Note: remplace detection_preset (retiré, ADR-14)
);

CREATE TABLE observed_events (
    id                TEXT PRIMARY KEY,
    frigate_event_id  TEXT NOT NULL UNIQUE,  -- référence Frigate (pour proxy clips/thumbnails)
    lifecycle         TEXT NOT NULL,         -- new|update|end
    camera            TEXT NOT NULL,
    label             TEXT NOT NULL,         -- person|dog|car|...
    identity          TEXT,                  -- sub_label Frigate si disponible
    profile_id        TEXT REFERENCES profiles(id),
    confidence        REAL,
    occurred_at       TEXT NOT NULL,
    has_clip          INTEGER NOT NULL DEFAULT 0,
    has_snapshot      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_events_occurred ON observed_events(occurred_at DESC);
CREATE INDEX idx_events_profile  ON observed_events(profile_id, occurred_at DESC);
CREATE INDEX idx_events_camera   ON observed_events(camera, occurred_at DESC);
CREATE INDEX idx_events_label    ON observed_events(label, occurred_at DESC);

CREATE TABLE notifications (
    id            TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL REFERENCES observed_events(id),
    channel       TEXT NOT NULL,   -- telegram|discord|fcm|webhook|email|ntfy
    status        TEXT NOT NULL DEFAULT 'pending',
    sent_at       TEXT,
    error_message TEXT
);

CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,   -- refresh token
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL            -- JSON
);
```

**Index ajoutés dans cette version :** `idx_events_camera` et `idx_events_label` pour supporter les requêtes filtrées de la vue historique détections (US-P3.6).

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
    ├── BUSINESS_PLAN.md
    ├── DESIGN SYSTEM.md
    ├── user/
    │   ├── CAMERA_ONBOARDING.md
    │   └── TELEGRAM_NOTIFICATIONS.md
```

---

## Annexe C — Choix Étudiés Non Retenus

| Fonctionnalité | Option non retenue | Pourquoi non retenue maintenant | Condition de réévaluation |
|---|---|---|---|
| Reconnaissance faciale | Worker Python dédié (InsightFace + gRPC) | Duplique Frigate, complexifie l'exploitation | Besoin métier non couvert par Frigate ou contrainte de précision spécifique |
| API principale | FastAPI / Node | Introduit un runtime principal supplémentaire | Changement majeur d'équipe/stack |
| Base de données | PostgreSQL | Surcoût opérationnel pour offre local-first | Passage multi-nœud / haute concurrence d'écriture |
| UI | 100% UI custom sans Frigate | Coût et délais élevés, duplication de capacités | Besoin produit fort non atteignable via approche hybride |
