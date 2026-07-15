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
  - [ADR-21 — PTZ Parking et adaptateur ONVIF générique : stratégie multi-couche pour le mode vie privée](#adr-21--ptz-parking-et-adaptateur-onvif-générique--stratégie-multi-couche-pour-le-mode-vie-privée)
  - [ADR-22 — Catalogue de capacités caméra : découplage marque/protocole, presets vendor et onboarding manuel](#adr-22--catalogue-de-capacités-caméra--découplage-marqueprotocole-presets-vendor-et-onboarding-manuel)
  - [ADR-24 — Séparation couche protocole / couche fonctionnelle : OnvifClient, SupportedProtocol, PrivacyStrategy](#adr-24--séparation-couche-protocole--couche-fonctionnelle--onvifclient-supportedprotocol-privacystrategy)
  - [ADR-23 — Surveillance de joignabilité des caméras : polling TCP périodique indépendant de Frigate](#adr-23--surveillance-de-joignabilité-des-caméras--polling-tcp-périodique-indépendant-de-frigate)
  - [ADR-25 — Gestion des positions PTZ : presets natifs (Branch A) vs positions Vyzio-managed (Branch B)](#adr-25--gestion-des-positions-ptz--presets-natifs-branch-a-vs-positions-vyzio-managed-branch-b)
  - [ADR-26 — Miniatures de positions PTZ : capture client-triggered, stockage fichier, serving direct](#adr-26--miniatures-de-positions-ptz--capture-client-triggered-stockage-fichier-serving-direct)
  - [ADR-27 — Réglages image avancés : capacité `ImageSettings`, ONVIF Imaging Service, valeurs non persistées](#adr-27--réglages-image-avancés--capacité-imagesettings-onvif-imaging-service-valeurs-non-persistées)
  - [ADR-28 — Détection de capacité en cascade multi-protocole + flag `ManuallyConfigured`](#adr-28--détection-de-capacité-en-cascade-multi-protocole--flag-manuallyconfigured)
  - [ADR-29 — DVRIP : `DvripClient` partagé, réglages image (`AVEnc.VideoColor.[0]`), PTZ Move/Stop](#adr-29--dvrip--dvripclient-partagé-réglages-image-avencvideocolor0-ptz-movestop)
  - [ADR-30 — V380 natif pour `ImageSettings` : tenté puis abandonné (vision nocturne, opcode `0xC4`)](#adr-30--v380-natif-pour-imagesettings--tenté-puis-abandonné-vision-nocturne-opcode-0xc4)
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

### ADR-20 — Privacy Mode : API constructeur en premier, fallback Frigate `enabled: false` + `IVendorCameraAdapter` comme brique partagee

#### Contexte

Le mode vie privee (SPECS §9) exige qu'une camera soit **reellement coupee** : aucun flux RTSP diffuse par la camera, aucun enregistrement, aucune detection. La contrainte cle est que le flux RTSP ne soit accessible par personne sur le reseau local — y compris Frigate, y compris un tiers qui connaitrait l'IP de la camera.

Une solution qui ne desactive que le pipeline Frigate ne repond pas a cette exigence : la camera continue de diffuser, et quiconque sur le LAN connait son IP peut s'y connecter directement.

Deux besoins doivent etre couverts simultanement :

- activation manuelle instantanee ("couper maintenant") et bascule multiple simultanee ;
- planification recurrente (jours de la semaine + plage horaire, ex. tous les soirs 22h–6h).

**Note strategique :** l'interface avec le firmware de la camera est une brique qui sera reutilisee plus tard pour les infos systeme (batterie, temperature, etat connexion) et le PTZ (ADR futur). L'ADR-20 introduit l'abstraction `IVendorCameraAdapter` qui servira pour ces features ulterieures.

#### Analyse des mecanismes de coupure reelle

Le probleme fondamental est reseau : si une camera WiFi et un autre appareil sont tous les deux sur le meme routeur domestique, Vyzio ne peut pas intercepter leur trafic — `iptables` sur l'hote Docker ne bloque que les flux passant par cet hote, pas le trafic lateral sur le LAN. La seule facon de garantir la coupure est d'intervenir **a la source** (firmware de la camera) ou **sur l'alimentation** (PoE / smart plug).

| Mecanisme | Universalite | Dependance infra | Verdict |
|---|---|---|---|
| **API constructeur** (firmware REST/DVRIP) | Partiel, par marque | Aucune | ✅ Retenu en premier |
| **PoE port disable** (switch SNMP/REST) | Cameras filaires uniquement | Switch manage requis | ❌ Hors perimetre (futur optionnel) |
| **Smart plug** (Tasmota, Shelly, Tuya) | AC seulement | Smart plug compatible | ❌ Hors perimetre (futur optionnel) |
| **iptables sur hote Docker** | Seulement si Vyzio = gateway reseau | `NET_ADMIN` + routing | ❌ Non universel domestique |
| **`enabled: false` Frigate seul** | Universel | Aucune | ✅ Fallback obligatoire |

**Constat d'honnêteté produit :** pour les cameras dont le firmware ne supporte pas de commande de coupure, le fallback `enabled: false` dans Frigate est la seule option sans infra supplementaire. L'UI doit distinguer ces deux etats et informer l'utilisateur sur le niveau de garantie reel.

#### Decision

**Approche en deux couches, toujours cumulatives :**

1. **Couche 1 — API constructeur (si supportee)** : envoyer une commande au firmware de la camera pour desactiver la capture video ou le streaming. La camera cesse physiquement de diffuser.
2. **Couche 2 — Frigate `enabled: false` (toujours)** : quel que soit le resultat de la couche 1, regenerer `frigate.yml` avec `enabled: false` et recharger Frigate. Cette couche est systematique et ne depend pas du succes de la couche 1.

L'UI indique a l'utilisateur si la couche 1 a reussi ("camera eteinte") ou si seul le fallback Frigate est actif ("flux RTSP non accessible depuis Vyzio, mais potentiellement visible sur le LAN si votre camera ne supporte pas la coupure distante").

#### API constructeur — perimetre initial

Les marques suivantes sont retenues pour la v1 de l'adaptateur, par ordre de volume de marche grand public :

| Marque / Famille | Mecanisme de coupure | Endpoint / Commande | Signal physique verifiable |
|---|---|---|---|
| **TP-Link Tapo** | API locale KLAP (protocole documente par la communaute) | `set_lens_mask` (active le cache physique + eteint le voyant LED) | ✅ Voyant LED eteint = camera vraiment inactive |
| **Reolink** | REST API officielle | `POST /api.cgi?cmd=SetChannelStatus` `{ channel: 0, status: 0 }` | ⚠️ Selon modele |
| **Hikvision** | ISAPI REST | `PUT /ISAPI/System/Video/inputs/channels/1` `<enabled>false</enabled>` | ⚠️ Selon modele |
| **Dahua** | CGI REST | `GET /cgi-bin/configManager.cgi?action=setConfig&VideoOut[0].Enable=false` | ⚠️ Selon modele |
| **ICSee / XMEye / Xiongmai** | DVRIP (protocole deja utilise en ADR-19) | Commande `MSG_VIDEO_COMMAND` sur port 34567 | ⚠️ Selon modele |

**Note sur le protocole Tapo :** TP-Link Tapo utilise un protocole de chiffrement local nomme **KLAP** (Key-based Local Authentication Protocol) documente par la communaute (reverse-engineering). La commande `set_lens_mask` active le cache physique de l'objectif et eteint le voyant LED — ce sont des signaux physiques directement observables qui confirment que la camera ne capture plus. L'implementation requiert un handshake d'authentification locale (seed + HMAC-SHA256) independant du cloud TP-Link — coherent avec la philosophie local-first de Vyzio.

Les cameras pour lesquelles aucun adaptateur n'est disponible recoivent le `NullVendorAdapter` — fallback Frigate uniquement, avec indication UI.

#### `IVendorCameraAdapter` — interface partagee (brique reutilisable)

```csharp
// Core/Interfaces/IVendorCameraAdapter.cs
public interface IVendorCameraAdapter
{
    string VendorFamily { get; }  // "reolink" | "hikvision" | "dahua" | "icsee" | "generic"

    // Privacy Mode (ADR-20)
    Task<bool> SupportsPrivacyModeAsync(CancellationToken ct);
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct);

    // System Info — a implementer dans l'ADR futur PTZ/System info
    Task<bool> SupportsSystemInfoAsync(CancellationToken ct);
    // Task<CameraSystemInfo> GetSystemInfoAsync(Camera camera, CancellationToken ct);
}
```

La resolution de l'adaptateur se fait via un `IVendorCameraAdapterFactory` qui selectionne l'implementation selon `camera.VendorFamily` (champ deja present sur l'entite `Camera`).

#### Modele de donnees — extensions

```sql
ALTER TABLE cameras ADD COLUMN privacy_mode_active   INTEGER NOT NULL DEFAULT 0;
-- "manual" = active manuellement ; "schedule" = active par planification ; null = off
ALTER TABLE cameras ADD COLUMN privacy_mode_source   TEXT;
-- indique si la couche 1 (API constructeur) a reussi lors de la derniere bascule
ALTER TABLE cameras ADD COLUMN privacy_vendor_cut    INTEGER NOT NULL DEFAULT 0;

CREATE TABLE camera_privacy_schedules (
    id           TEXT PRIMARY KEY,
    camera_id    TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    enabled      INTEGER NOT NULL DEFAULT 1,
    days_of_week TEXT NOT NULL,   -- JSON array [0..6], 0 = dimanche
    start_time   TEXT NOT NULL,   -- "HH:mm"
    end_time     TEXT NOT NULL,   -- "HH:mm" ; passage minuit = deux plages
    created_at   TEXT NOT NULL
);
CREATE INDEX idx_privacy_schedules_camera ON camera_privacy_schedules(camera_id, enabled);
```

#### Regles de priorite manuel / schedule

- `privacy_mode_source = "manual"` : la planification ne peut pas desactiver automatiquement ; seul un toggle manuel repasse la source a `null` et rend le controle au scheduler.
- `privacy_mode_source = "schedule"` : le scheduler desactive a la fin de la fenetre.
- Quand l'utilisateur reactive manuellement pendant une fenetre planifiee, la source repasse a `null` (suivi de planification repris).

#### Flux d'activation

```
ToggleCameraPrivacyModeUseCase.ExecuteAsync(cameraId, active: true)
  1. Mettre a jour camera.privacy_mode_active = true, source = "manual"
  2. Resoudre IVendorCameraAdapter via IVendorCameraAdapterFactory
  3. Si SupportsPrivacyModeAsync() → appeler SetPrivacyModeAsync(camera, true)
       → succes : camera.privacy_vendor_cut = true
       → echec / non supporte : camera.privacy_vendor_cut = false (loggue)
  4. Toujours : regenerer frigate.yml avec enabled: false pour cette camera
  5. Toujours : declencher reload Frigate
```

`BatchToggleCameraPrivacyModeUseCase` execute les etapes 1–3 pour chaque camera de la liste, puis un seul reload Frigate couvrant l'ensemble.

#### `PrivacySchedulerService`

```csharp
public class PrivacySchedulerService : BackgroundService
{
    // Evalue toutes les minutes les planifications actives
    // Pour chaque camera : determine si l'heure courante est dans une fenetre planifiee
    // Si entree dans fenetre ET source != "manual" : appelle ToggleCameraPrivacyModeUseCase(active: true, source: "schedule")
    // Si sortie de fenetre ET source == "schedule" : appelle ToggleCameraPrivacyModeUseCase(active: false)
}
```

#### Endpoints API

```
POST   /api/cameras/{id}/privacy/toggle              → bascule manuelle unitaire
POST   /api/cameras/privacy/batch-toggle             → bascule simultanee ; body: { cameraIds: [...], active: bool }
GET    /api/cameras/{id}/privacy/schedules
POST   /api/cameras/{id}/privacy/schedules
PATCH  /api/cameras/{id}/privacy/schedules/{sid}
DELETE /api/cameras/{id}/privacy/schedules/{sid}
```

La reponse de `/api/cameras` est etendue avec `privacyModeActive`, `privacyModeSource` et `privacyVendorCut` pour que l'UI puisse afficher le bon niveau de garantie.

#### Consequences

- ✅ Coupure reelle cote camera pour les marques supportees (Reolink, Hikvision, Dahua, ICSee)
- ✅ Fallback universel via Frigate `enabled: false` — aucune camera n'est laissee sans protection Vyzio
- ✅ `IVendorCameraAdapter` est la brique pour le PTZ et les infos systeme (ADR futur)
- ✅ `VendorFamily` est deja sur l'entite `Camera` — pas de nouveau champ pour la selection d'adaptateur
- ✅ Batch toggle avec un seul reload Frigate
- ⚠️ Reload Frigate : breve coupure (~1–3s) sur toutes les cameras — l'UI indique que l'operation est en cours
- ⚠️ Cameras sans adaptateur vendor : l'UI indique explicitement que la coupure est Frigate uniquement (flux RTSP brut potentiellement accessible si quelqu'un connait l'IP)
- ⚠️ Passage minuit pour les planifications : a trancher en implementation (deux plages ou detection depassement dans le scheduler)
- ⚠️ Les credentials cameras (ADR-12) sont deja protegees via `DataProtection` — l'adaptateur vendor les consomme via le meme mecanisme

---

### ADR-21 — PTZ Parking et adaptateur ONVIF générique : stratégie multi-couche pour le mode vie privée

#### Contexte

ADR-20 introduit `IVendorCameraAdapter` comme brique partagée. L'investigation terrain de juin 2026 sur ICSee (DVRIP) et V380 Pro (ONVIF) a confirmé que **le PTZ parking est la seule solution hardware viable** pour les caméras sans API native de coupure flux :

- **ICSee/XMEye** : VideoEnable=False bloqué (Ret 606), PrivacyMask sans effet sur le flux cloud P2P XMEye, OPSleep non implémenté (Ret 103). PTZ via OPPTZControl cmd 1400 confirmé fonctionnel (SetPreset + DirectionLeftUp 8s + GotoPreset).
- **V380 Pro** : ONVIF disponible mais GetPrivacyMasks absent, SetVideoEncoderConfiguration inaccessible (bug firmware Multicast). PTZ via ONVIF ContinuousMove + Stop confirmé fonctionnel.

ONVIF PTZ est un standard supporté par la quasi-totalité des caméras PTZ du marché (Hikvision, Dahua, Reolink, Axis, V380…). Implémenter un adaptateur par marque serait une réimplémentation inutile de la même logique ONVIF.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Adaptateur par marque** | `V380ProAdapter`, `HikvisionAdapter`, `ReolinkAdapter`… chacun avec son implémentation PTZ | Isolation totale par marque | Duplication massive du code ONVIF ; chaque nouvelle marque = nouveau fichier |
| **B — `OnvifCameraAdapter` générique** | Un seul adaptateur pour toutes les caméras supportant ONVIF PTZ | Zero duplication ; toute nouvelle caméra ONVIF fonctionne sans code | Cas particuliers firmware peuvent nécessiter des workarounds dans l'adaptateur générique |
| **C — Délégation PTZ à Frigate** | Passer par l'API Frigate pour les commandes PTZ | Cohérent avec ADR-01 | Frigate n'expose pas d'API PTZ pour piloter les caméras depuis Vyzio |

**Option B retenue.** ONVIF PTZ est suffisamment standardisé pour qu'un adaptateur générique couvre la majorité des cas. Les quelques firewares incomplets (V380 presets non implémentés) sont gérés par des fallbacks dans l'adaptateur.

#### Décision

**Trois stratégies de mode vie privée, configurables par caméra.** Chaque stratégie est documentée comme une extension de la décision ADR-20 :

| Stratégie | Déclenchée par | Comportement |
|---|---|---|
| `"software"` | Toutes caméras | Frigate `enabled: false` uniquement |
| `"ptz_parking"` | Caméras PTZ (`PtzSupported = true`) | Mouvement vers butée mécanique **ET** Frigate `enabled: false` (cumulatif) |
| `"hardware"` | Tapo (et futures caméras avec firmware natif) | Coupure API constructeur **ET** Frigate `enabled: false` (cumulatif) |

**`ptz_parking` est toujours cumulatif avec le fallback software.** Cette règle n'est pas un compromis — c'est une garantie : si le mouvement PTZ échoue (timeout réseau, caméra hors portée), Frigate est quand même désactivé.

#### Architecture — `OnvifCameraAdapter` générique

```csharp
// Vyzio.Infrastructure/VendorAdapters/OnvifCameraAdapter.cs
// VendorFamily = "onvif"
// Couvre : V380 Pro, Hikvision, Dahua, Reolink, Axis et tout appareil ONVIF PTZ
public sealed class OnvifCameraAdapter : IVendorCameraAdapter
{
    public string VendorFamily => "onvif";

    // Privacy : PTZ parking cumulatif avec Frigate disabled (géré par ToggleCameraPrivacyModeUseCase)
    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct)
        => Task.FromResult(camera.PtzSupported);  // privacy hardware = ptz_parking si PTZ disponible

    // PTZ : ONVIF ContinuousMove + Stop
    public Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct) => Task.FromResult(true);
    public Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct);
    public Task PtzStopAsync(Camera camera, CancellationToken ct);
    // Preset : GotoPreset si supporté, sinon ContinuousMove inverse (fallback)
    public Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct);
    public Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct);
}
```

Séquence PTZ parking — privacy ON :
1. `ContinuousMove(pan=-1, tilt=-1)` pendant ~8s → butée mécanique
2. `Stop`

Séquence PTZ parking — privacy OFF :
1. `GotoPreset(presetId: 1)` si presets supportés
2. Sinon : `ContinuousMove(pan=+1, tilt=+1)` ~4s → `Stop` (retour approximatif)

#### Architecture — extension `IVendorCameraAdapter`

```csharp
public interface IVendorCameraAdapter
{
    string VendorFamily { get; }

    // Privacy (ADR-20)
    Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default);
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default);

    // PTZ (ADR-21)
    Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default);
    Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default);
    Task PtzStopAsync(Camera camera, CancellationToken ct = default);
    Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default);
    Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default);
}
```

#### Architecture — `VendorCameraAdapterFactory`

```
"tplink_tapo" → TapoCameraAdapter   (KLAP, hardware privacy natif)
"icsee"       → ICSeeXMEyeCameraAdapter  (DVRIP OPPTZControl cmd 1400)
"onvif"       → OnvifCameraAdapter   (ONVIF générique — V380, Hikvision, Dahua, Reolink, Axis…)
défaut        → NullVendorCameraAdapter
```

**Aucun adaptateur V380-spécifique.** V380 Pro utilise `vendorFamily = "onvif"`, assigné à l'onboarding via détection automatique.

#### Détection ONVIF PTZ à l'onboarding

Le parcours d'ajout de caméra est enrichi d'une sonde ONVIF PTZ :

```
Onboarding — nouvelle étape après vérification RTSP :
  Si port 8899 répond ET GetCapabilities retourne service PTZ :
    → Camera.PtzSupported = true
    → Camera.VendorFamily = "onvif" (si non déjà identifié comme "icsee" ou "tplink_tapo")
    → Proposer étape "Configurer le mode vie privée" avec sélecteur de stratégie
      et PtzControlPanel pour définir la position de surveillance
```

#### Composant `PtzControlPanel` — partagé multi-contexte

Un seul composant React, monté dans trois contextes :

| Contexte | Usage | Éléments affichés |
|---|---|---|
| `LiveFeedModal` | Usage quotidien | Joystick + stop + "Retour position surveillance" |
| Fiche caméra | Configuration | Joystick + stop + "Retour" + **"Définir position de surveillance"** |
| Onboarding | Première configuration | Joystick + stop + **"Définir position de surveillance"** |

Le bouton "Définir position de surveillance" déclenche `ConfigurePtzParkingPositionUseCase` → `PtzSavePresetAsync(presetId: 1)`.

#### Endpoints API PTZ

```
POST /api/cameras/{id}/ptz/move          → { direction, speed }
POST /api/cameras/{id}/ptz/stop
POST /api/cameras/{id}/ptz/preset/save   → { presetId }
POST /api/cameras/{id}/ptz/preset/goto   → { presetId }
PATCH /api/cameras/{id}/privacy-strategy → { strategy: "software"|"ptz_parking"|"hardware" }
```

#### Conséquences

- ✅ Zéro code supplémentaire pour chaque nouvelle caméra ONVIF PTZ — `vendorFamily = "onvif"` suffit
- ✅ PTZ parking cumulatif : protection garantie même en cas d'échec du mouvement PTZ
- ✅ `PtzControlPanel` partagé : cohérence UX entre vue live, fiche caméra et onboarding
- ✅ ICSee DVRIP isolé dans son adaptateur — ne pollue pas la logique ONVIF générique
- ⚠️ Les presets ONVIF ne sont pas universellement implémentés (V380 : "not implemented" lors des tests) — le fallback `ContinuousMove` inverse est le chemin nominal sur ces firmwares ; à valider marque par marque
- ⚠️ La durée du mouvement PTZ (~8s) est empirique — à rendre configurable si les tests montrent une hétérogénéité selon les modèles

> **Mise à jour 2026-07-05 (ADR-24) :** `PtzParkingPrivacyProvider` supprimé — la logique est inlinée dans `ToggleCameraPrivacyModeUseCase`. `PrivacyModeStrategy { Software, PtzParking, Hardware }` renommé en `PrivacyStrategy { None, SoftwareBlur, PtzParking, Hardware }` ; la valeur BDD `privacy_mode_strategy = 'software'` migrée en `'software_blur'`. Voir ADR-24.

---

### ADR-22 — Catalogue de capacités caméra : découplage marque/protocole, presets vendor et onboarding manuel

#### Contexte

ADR-20 et ADR-21 ont introduit `IVendorCameraAdapter` : une caméra a un `VendorFamily` (string) qui résout vers **un seul adaptateur monolithique**, lequel décide en dur si PTZ et mode vie privée sont supportés et comment les piloter. Ce modèle a deux limites structurelles, révélées par l'usage :

1. **Couplage fragile par string.** `TapoCameraAdapter.VendorFamily` a valu `"tapo"` au lieu de `"tplink_tapo"` sans aucune erreur de compilation — le ticket technique initial proposait de typer `VendorFamily`, mais cela ne traite que le symptôme : tant qu'une marque résout vers un seul adaptateur figé, le vrai problème (1 marque = 1 implémentation imposée) reste entier.
2. **Aucune caméra hors catalogue ne peut accéder aux fonctionnalités avancées.** Une caméra ICSee non reconnue (faux négatif de détection, variante de firmware) ne peut pas activer le PTZ ou un mode vie privée renforcé, même si son matériel le permet — alors que `OnvifCameraAdapter` prouve déjà que ces capacités sont souvent **indépendantes de la marque** (un seul adaptateur couvre V380, Hikvision, Dahua, Reolink, Axis sans code spécifique).

`OnvifCameraAdapter` est en réalité déjà un **provider de protocole**, pas un adaptateur de marque — son `VendorFamily = "onvif"` et l'alias runtime `"v380_pro" → "onvif"` (ADR-21) sont un début de découplage marque/comportement. Cette ADR généralise ce constat à l'ensemble du modèle.

#### Décision produit associée

Voir SPECS §2.3 : les fonctionnalités avancées deviennent des **capacités indépendantes de la marque**. Une marque "officiellement supportée" est une marque pour laquelle Vyzio connaît déjà la configuration de ces capacités (preset). Une caméra non répertoriée doit pouvoir accéder aux mêmes capacités via une déclaration manuelle **vérifiée par un test réel**, jamais sur simple déclaration.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Typer `VendorFamily` uniquement** (scope du ticket TECH initial) | Constantes typées, mais toujours 1 marque → 1 adaptateur figé | Change minimal, corrige le bug de typo | Ne résout pas le couplage de fond ; n'ouvre aucun chemin pour les caméras non répertoriées |
| **B — Catalogue de capacités + providers par protocole + presets vendor** | `Camera` expose des `CameraCapabilityBinding` (capacité × protocole × config), résolues par un registre typé par protocole ; les presets vendor pré-remplissent ces bindings | Découple marque (présentation/preset) et protocole (comportement réel, typé, vérifiable) ; débloque l'onboarding manuel ; chaque nouveau protocole profite à toutes les marques qui le parlent | Refactor plus large : nouvelle entité, migration EF, éclatement de `IVendorCameraAdapter` |
| **C — Garder l'adaptateur monolithique, ajouter une case "marque inconnue"** | Étendre `NullVendorCameraAdapter` avec des champs manuels ad hoc sur `Camera` | Minimal | Ne généralise pas — chaque nouvelle capacité manuelle nécessite de nouveaux champs ad hoc ; pas de sélection de protocole ; pas vérifiable proprement |

**Option B retenue.**

#### Décision

**Le `Stream` (transport RTSP/DVRIP, ADR-19) reste hors périmètre de ce refactor** — il est fondamental et déjà bien modélisé via `Camera.StreamProtocol` + `go2rtc`. Seules les **capacités optionnelles** (PTZ, mode vie privée matériel, futur info système) basculent vers le modèle générique.

**0. Principe transversal : enum en code, string inchangée en base — zéro migration sur l'existant.** Tous les champs qui représentent un ensemble fermé de valeurs (`VendorFamily`, `StreamProtocol`, `PrivacyModeSource`, `PrivacyModeStrategy`, `CameraCapability`, `CapabilityProtocol`) sont des **enums C# dans le code**, jamais des strings comparées à la main. La persistance EF Core reste sur les **mêmes colonnes `TEXT`, avec les mêmes valeurs déjà stockées** (`"tplink_tapo"`, `"rtsp"`, `"manual"`, `"ptz_parking"`...). Un converter pur (CLR type → même colonne, même type SQL, même nullabilité) ne modifie aucun facet détecté par EF Core : **`dotnet ef migrations add` ne génère aucune opération sur ces colonnes**. La seule migration réelle de ce chantier est l'ajout de la nouvelle table `camera_capability_bindings` (additive, voir §Migration).

```csharp
// Vyzio.Core/Entities/VendorFamily.cs — remplace les strings "tplink_tapo"/"icsee"/"v380_pro"
// Noms choisis pour que JsonNamingPolicy.SnakeCaseLower(nom) == valeur déjà stockée en base
// (vérifié : TplinkTapo → "tplink_tapo", Icsee → "icsee", V380Pro → "v380_pro")
public enum VendorFamily { TplinkTapo, Icsee, V380Pro }
// Camera.VendorFamily devient VendorFamily? (null = marque non détectée/non répertoriée)

// Vyzio.Core/Entities/StreamProtocol.cs — remplace "rtsp" | "dvrip" (ADR-19)
public enum StreamProtocol { Rtsp, Dvrip }

// Vyzio.Core/Entities/PrivacyModeSource.cs — remplace "manual" | "schedule" | null
public enum PrivacyModeSource { Manual, Schedule }
// Camera.PrivacyModeSource devient PrivacyModeSource? (null = jamais activé)

// Vyzio.Core/Entities/PrivacyModeStrategy.cs — remplace "software" | "ptz_parking" | "hardware" (ADR-21)
public enum PrivacyModeStrategy { Software, PtzParking, Hardware }

// Vyzio.Core/Entities/CameraCapability.cs
public enum CameraCapability { Ptz, PrivacyMode /* , SystemInfo (futur) */ }

// Vyzio.Core/Entities/CapabilityProtocol.cs — nouvelle colonne, aucune contrainte de valeur héritée
public enum CapabilityProtocol { Onvif, Dvrip, TapoKlap, PtzParking, SoftwareOnly, None }
```

`PtzParking` et `SoftwareOnly` sont des protocoles de `PrivacyMode` qui **composent** un protocole `Ptz` existant plutôt que de parler au firmware — voir point 3.

**Conversion EF Core — un seul converter générique, pas un mapping en dur par enum :**

```csharp
// Vyzio.Infrastructure/Persistence/Conversions/SnakeCaseEnumConverter.cs
public sealed class SnakeCaseEnumConverter<TEnum> : ValueConverter<TEnum, string>
    where TEnum : struct, Enum
{
    public SnakeCaseEnumConverter() : base(
        v => JsonNamingPolicy.SnakeCaseLower.ConvertName(v.ToString()),
        v => Enum.Parse<TEnum>(ToPascalCase(v), ignoreCase: true))
    { }

    private static string ToPascalCase(string snake) =>
        string.Concat(snake.Split('_').Select(s => char.ToUpperInvariant(s[0]) + s[1..]));
}
```

Appliqué identiquement aux 6 enums (variante `SnakeCaseEnumConverter<TEnum?>` pour les propriétés nullables `VendorFamily?` / `PrivacyModeSource?`). Un test unitaire round-trip (`ToSnakeCase(FromSnakeCase(s)) == s`) sur chaque valeur legacy déjà en base (`"tplink_tapo"`, `"icsee"`, `"v380_pro"`, `"rtsp"`, `"dvrip"`, `"manual"`, `"schedule"`, `"software"`, `"ptz_parking"`, `"hardware"`) verrouille la non-régression — c'est ce test, pas une relecture manuelle, qui garantit qu'aucune base existante n'est cassée par le renommage d'identifiants C# ci-dessus.

**2. Nouvelle entité `CameraCapabilityBinding` (remplace les booléens épars) :**

```csharp
public sealed class CameraCapabilityBinding
{
    public Guid Id { get; init; }
    public Guid CameraId { get; init; }
    public CameraCapability Capability { get; init; }
    public CapabilityProtocol Protocol { get; init; }
    public string? ConfigJson { get; set; }     // port, adresse ONVIF, credentials DVRIP, etc.
    public bool Verified { get; set; }          // résultat du dernier test reel — jamais déclaratif
    public DateTime? VerifiedAt { get; set; }
    public string? LastError { get; set; }
}
// Unique (CameraId, Capability) — une seule liaison active par capacité et par caméra
```

`Camera.VendorFamily` est **conservé** mais devient purement descriptif (affichage, lien vers `vendors/*.md`, choix du preset à l'onboarding) — il ne pilote plus aucune résolution fonctionnelle. `Camera.PtzSupported` devient un booléen dérivé/caché (`Verified == true` sur le binding `Ptz`) pour les requêtes UI rapides ; la source de vérité est le binding. `Camera.PrivacyModeStrategy` (enum `PrivacyModeStrategy`) ne change pas de rôle — c'est déjà un choix utilisateur protocole-agnostique, il passe juste de string à enum comme le reste (point 0).

**3. Interfaces de capacité, en remplacement de `IVendorCameraAdapter` monolithique :**

```csharp
public interface IPtzCapabilityProvider
{
    CapabilityProtocol Protocol { get; }
    Task<bool> ProbeAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task PtzMoveAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);
    Task PtzStopAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task PtzGoToPresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);
    Task PtzSavePresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);
    Task PtzStepAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default); // défaut : Move+Stop
}

public interface IPrivacyCapabilityProvider
{
    CapabilityProtocol Protocol { get; }
    Task<bool> ProbeAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task SetPrivacyModeAsync(CameraCapabilityBinding binding, bool active, CancellationToken ct = default);
}
```

**Implémentations (reprises des adaptateurs existants, sans réécriture du protocole bas niveau) :**

```
IPtzCapabilityProvider
  OnvifPtzProvider      ← logique extraite de OnvifCameraAdapter (ADR-21)
  DvripPtzProvider      ← logique extraite de ICSeeXMEyeCameraAdapter (OPPTZControl cmd 1400)
  TapoKlapProvider       ← NOUVEAU : motorMove via KLAP (voir note ci-dessous)

IPrivacyCapabilityProvider
  TapoKlapProvider          ← logique extraite de TapoCameraAdapter (KLAP, coupure matérielle)
  PtzParkingPrivacyProvider ← décore N'IMPORTE QUEL IPtzCapabilityProvider pour réaliser la
                              manœuvre de parking (ADR-21) ; généralise ptz_parking à tout
                              protocole PTZ, pas seulement Onvif/Dvrip
  SoftwareOnlyPrivacyProvider ← no-op, toujours disponible (fallback universel, ADR-20)
```

**Note — un protocole n'est pas limité à une seule capacité.** `TapoKlapProvider` implémente **les deux interfaces** (`IPrivacyCapabilityProvider` et `IPtzCapabilityProvider`) sur le même transport KLAP (handshake + chiffrement AES-128-GCM déjà implémentés dans `TapoCameraAdapter`). C'est un exemple concret du problème que ce refactor corrige : les caméras Tapo pan-tilt (C200, C210, C225…) supportent le PTZ via une commande KLAP (`motorMove`) **sur le même canal** que `set_lens_mask` — mais comme l'ancien `TapoCameraAdapter` n'exposait que les méthodes privacy de `IVendorCameraAdapter`, cette capacité PTZ n'a jamais été branchée, alors que toute l'infrastructure de transport (auth, chiffrement) existe déjà et fonctionne. `SupportsPtzAsync` retournait `false` pour Tapo non pas parce que le matériel ne le permet pas, mais parce que personne n'avait de raison de regarder au-delà de la capacité pour laquelle l'adaptateur avait été écrit initialement. Le découplage capacité/protocole rend ce genre de capacité manquante visible et triviale à ajouter (nouvelle commande KLAP, pas nouveau transport) — voir tâche dédiée dans le backlog.

**4. `ICapabilityProviderRegistry`** remplace `IVendorCameraAdapterFactory` : résolution par **(capacité, protocole)** typé, plus par `VendorFamily` string.

```csharp
public interface ICapabilityProviderRegistry
{
    IPtzCapabilityProvider ResolvePtz(CapabilityProtocol protocol);
    IPrivacyCapabilityProvider ResolvePrivacy(CapabilityProtocol protocol);
}
```

**5. Presets vendor — la marque redevient une donnée, pas du code :**

```csharp
// Preset = bindings par défaut proposées à l'onboarding pour une marque reconnue
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, CapabilityProtocol Protocol)> DefaultBindings);

// Vyzio.Infrastructure/VendorPresets/VendorCapabilityPresets.cs
public static readonly IReadOnlyList<VendorCapabilityPreset> All = new[]
{
    new VendorCapabilityPreset(VendorFamily.TplinkTapo, new[]
    {
        (CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap),
        (CameraCapability.Ptz, CapabilityProtocol.TapoKlap),   // nouveau — voir note TapoKlapProvider
    }),
    new VendorCapabilityPreset(VendorFamily.Icsee, new[]
    {
        (CameraCapability.Ptz, CapabilityProtocol.Dvrip),
        (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
    }),
    new VendorCapabilityPreset(VendorFamily.V380Pro, new[]
    {
        (CameraCapability.Ptz, CapabilityProtocol.Onvif),
        (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
    }),
};
```

Un test vérifie que chaque valeur de l'enum `VendorFamily` a un fichier `vendors/{nom_snake_case}.md` correspondant — le nom de fichier est dérivé via le même `SnakeCaseEnumConverter` que la persistance (`JsonNamingPolicy.SnakeCaseLower`), pas une seconde table de correspondance (clôt le critère de validation du ticket TECH initial).

**6. Onboarding :**

```
Marque détectée et reconnue (heuristiques inchangées, ADR-12) :
  → pré-remplir les bindings depuis VendorCapabilityPreset
  → probe automatique de chaque binding (silencieux, identique à l'expérience actuelle)
  → binding activé seulement si Verified == true

Marque non reconnue ("Configuration avancée — caméra non répertoriée") :
  → pour chaque capacité (PTZ, mode vie privée) : l'utilisateur choisit un protocole
    (ONVIF / DVRIP / Aucun) et saisit les paramètres de connexion requis
  → Vyzio exécute ProbeAsync() avant d'autoriser l'activation
  → échec de probe → message explicite, capacité non proposée (jamais un simple "à vos risques")
```

#### Migration

- **Une seule migration EF Core réelle dans ce chantier : ajout de la table `camera_capability_bindings`** (additive, aucune colonne existante touchée).
- Les colonnes existantes `vendor_family`, `stream_protocol`, `privacy_mode_source`, `privacy_mode_strategy` ne changent ni de nom, ni de type SQL, ni de contenu — seul le type CLR change côté EF Core (string → enum via `SnakeCaseEnumConverter`, point 0). `dotnet ef migrations add` ne doit générer aucune opération sur ces colonnes ; si une opération apparaît malgré tout à la génération, c'est un signal que le converter ne correspond pas exactement au schéma existant et qu'il faut le corriger avant de committer la migration — pas l'inverse.
- Script de backfill (logique applicative, pas une migration de schéma) : pour chaque caméra existante, dériver les `CameraCapabilityBinding` depuis l'état actuel —
  `VendorFamily == TplinkTapo` → binding `PrivacyMode/TapoKlap` (Verified = `PrivacyVendorCut` actuel) ; le binding `Ptz/TapoKlap` n'est **pas** backfillé automatiquement (capacité nouvellement exposée, jamais vérifiée auparavant) — proposé à l'utilisateur comme probe optionnel post-migration, jamais activé silencieusement ;
  `PtzSupported == true` + `VendorFamily ∈ {V380Pro (alias onvif), Icsee}` → binding `Ptz/Onvif` ou `Ptz/Dvrip` selon la marque ;
  `PrivacyModeStrategy == PtzParking` → binding `PrivacyMode/PtzParking` référençant le binding `Ptz` existant.
- Aucune régression fonctionnelle attendue sur les capacités déjà actives : le comportement par caméra existante est reconstruit à l'identique, pas réinitialisé. Seule nouveauté : la capacité PTZ Tapo, auparavant invisible, devient disponible (opt-in, probe requis).

#### Conséquences

- ✅ Une nouvelle marque qui parle un protocole déjà supporté (ONVIF, DVRIP) s'ajoute en **donnée** (preset + fiche `vendors/*.md`), sans nouveau code
- ✅ Les caméras non répertoriées accèdent aux mêmes capacités que les caméras supportées, via un onboarding plus long mais jamais bloquant par principe (SPECS §2.3)
- ✅ Plus aucune résolution fonctionnelle par string libre : tous les champs fermés (`VendorFamily`, `StreamProtocol`, `PrivacyModeSource`, `PrivacyModeStrategy`, `CapabilityProtocol`) sont des enums vérifiés à la compilation — le bug `"tapo"` vs `"tplink_tapo"` ne peut plus se reproduire, ni en lecture ni en écriture
- ✅ `ptz_parking` se généralise automatiquement à tout futur protocole PTZ (le décorateur `PtzParkingPrivacyProvider` ne connaît aucun détail de protocole)
- ✅ `VendorFamily` reste l'identifiant de présentation/documentation — aucune rupture pour `vendors/*.md`, les heuristiques de détection (ADR-12) ou l'affichage UI
- ✅ Le découplage capacité/protocole révèle une capacité déjà disponible mais jamais implémentée : le PTZ Tapo via KLAP (voir note `TapoKlapProvider`) — preuve directe que le modèle précédent cachait des capacités plutôt que de les rendre visibles
- ⚠️ Refactor plus large que le ticket TECH initial : migration EF + éclatement d'interface + UI d'onboarding manuel — à phaser explicitement dans le backlog
- ⚠️ Le protocole `TapoKlap` reste à ce jour mono-marque (Tapo) ; sa généralisation en `CapabilityProtocol` est surtout structurelle/symétrique pour la partie transport, mais lui permet déjà de servir deux capacités (Privacy + Ptz) au lieu d'une seule — gain de réutilisation réel, pas seulement symétrique
- ⚠️ L'onboarding manuel introduit une surface d'erreur utilisateur plus large (saisie de paramètres protocole) — le probe obligatoire avant activation est la garde-fou non négociable

> **Mise à jour 2026-07-05 (ADR-24) :** `CapabilityProtocol` supprimé et remplacé par `SupportedProtocol { Onvif, V380, Dvrip, TapoKlap, Rtsp }` (valeurs strictement protocole réseau). `CameraCapability.PrivacyMode` renommé `CameraCapability.HardwarePrivacy`. `OnvifPtzClient` → `OnvifClient` (pure transport). `PtzParkingPrivacyProvider` et `SoftwareOnlyPrivacyProvider` supprimés. `BackfillCameraCapabilityBindingsUseCase` supprimé. `Camera.SupportedProtocols` (JSON) ajouté. Voir ADR-24.

---

### ADR-24 — Séparation couche protocole / couche fonctionnelle : `OnvifClient`, `SupportedProtocol`, `PrivacyStrategy`

#### Contexte

ADR-22 a introduit `CapabilityProtocol` avec des valeurs mixant protocoles réseau (`Onvif`, `Dvrip`, `TapoKlap`) et stratégies fonctionnelles (`PtzParking`, `SoftwareOnly`, `None`). Ce mélange a rendu l'enum inapte à décrire les protocoles réellement détectés sur la caméra, et a couplé la stratégie de vie privée à la résolution des providers.

Trois problèmes structurels identifiés :
1. `CapabilityProtocol.PtzParking` n'est pas un protocole réseau — c'est une stratégie applicative. Stocker ce "protocole" dans `camera_capability_bindings.protocol` crée une colonne dont la valeur n'est pas interrogeable pour répondre à "quels protocoles réseau parle cette caméra ?".
2. `OnvifPtzClient` avait fusionné transport SOAP (Wire) et orchestration (caches de profile, locks de step, logique PTZ) — rendant le client non réutilisable pour d'autres usages ONVIF (ex: bootstrap device ID V380).
3. Bootstrap de l'ID V380 via série ONVIF nécessitait que `V380Client` accède à `OnvifPtzClient` ou duplique la logique HTTP ONVIF.

#### Décision

**1. `OnvifClient` — client ONVIF pur transport (Singleton).**

`OnvifPtzClient` éclaté en deux : `OnvifClient` (transport SOAP, Singleton) + `OnvifPtzProvider` (orchestration PTZ, caches, locks). `OnvifClient` expose uniquement des appels SOAP/HTTP sans état applicatif — réutilisable par n'importe quel provider.

```csharp
internal sealed class OnvifClient(IHttpClientFactory httpClientFactory, ILogger<OnvifClient> logger)
{
    // Wire methods uniquement
    Task<OnvifDeviceInfo> GetDeviceInformationAsync(Camera, CancellationToken);
    Task<(string ProfileToken, string PtzConfigToken)> GetFirstProfileAsync(Camera, CancellationToken);
    Task<PtzCapabilities> GetPtzConfigurationOptionsAsync(Camera, string configToken, CancellationToken);
    Task<PtzStatus> GetStatusAsync(Camera, string profileToken, CancellationToken);
    Task ContinuousMoveAsync(Camera, string profileToken, double pan, double tilt, CancellationToken);
    Task RelativeMoveAsync(Camera, string profileToken, double pan, double tilt, CancellationToken);
    Task StopAsync(Camera, string profileToken, CancellationToken);
    Task SetPresetAsync(Camera, string profileToken, int presetId, CancellationToken);
    Task GotoPresetAsync(Camera, string profileToken, int presetId, CancellationToken);
}
```

**2. `SupportedProtocol` — enum strictement protocoles réseau.**

`CapabilityProtocol` supprimé et remplacé :

| Avant (`CapabilityProtocol`) | Après (`SupportedProtocol`) |
|---|---|
| `Onvif` | `Onvif` |
| `Dvrip` | `Dvrip` |
| `TapoKlap` | `TapoKlap` |
| `V380` | `V380` |
| `PtzParking` | *(supprimé — stratégie, pas protocole)* |
| `SoftwareOnly` | *(supprimé — stratégie, pas protocole)* |
| `None` | *(supprimé)* |
| — | `Rtsp` *(ajouté pour futur binding Stream)* |

`Camera.SupportedProtocols` : nouvelle colonne JSON (`supported_protocols_json`) alimentée par le pipeline de probe, qui liste les protocoles réseau effectivement détectés sur la caméra.

**3. `PrivacyStrategy` — enum des stratégies vie privée par caméra.**

`PrivacyModeStrategy { Software, PtzParking, Hardware }` renommé en `PrivacyStrategy { None, SoftwareBlur, PtzParking, Hardware }`. Valeur BDD conservée dans la colonne `privacy_mode_strategy` (pas de rename schéma), avec migration de données `'software'` → `'software_blur'`.

**4. `PtzParkingPrivacyProvider` et `SoftwareOnlyPrivacyProvider` supprimés.**

La logique `PtzParking` est inlinée dans `ToggleCameraPrivacyModeUseCase` via le registry PTZ existant : `PtzGoToPresetAsync(presetId: 1)`. `SoftwareOnly` est la branche `default` du switch — aucun provider nécessaire.

**5. Bootstrap ID V380 via ONVIF (Singleton partagé).**

`V380PtzProvider` reçoit `OnvifClient` par injection. `ProbeAsync` tente dans l'ordre : ConfigJson persisté → `OnvifClient.GetDeviceInformationAsync` (serial bytes[2..5] BE = device_id) → UDP broadcast. L'ONVIF fonctionne en TCP depuis Docker bridge, contrairement au UDP.

```
Série ONVIF "9609019b8ae5" → bytes[2..5] = 0x019B8AE5 = 26970853 (device_id V380)
```

**6. `CameraCapability.PrivacyMode` → `CameraCapability.HardwarePrivacy`.**

Renommage sémantique : la capacité "privacy" enregistrée dans `camera_capability_bindings` désigne uniquement la coupure **matérielle** (Tapo KLAP). Le mode vie privée logiciel (Frigate disabled) ne nécessite pas de binding — il est universel.

**7. `BackfillCameraCapabilityBindingsUseCase` supprimé.**

Le backfill au démarrage via Linq était un one-shot de migration devenu stale. La migration EF Core `20260705120000_ArchProtocolRefacto` remplace toutes ses transformations de données.

#### Conséquences

- ✅ `OnvifClient` réutilisable par tout provider qui parle ONVIF (V380 bootstrap, futur discovery)
- ✅ `SupportedProtocol` décrit des protocoles réseau réels — interrogeable pour "quels protocoles parle cette caméra ?"
- ✅ `Camera.SupportedProtocols` ouvre la porte à des affichages informatifs en UI (badges protocoles)
- ✅ `PtzParking` en tant que stratégie vie privée n'est plus couplé à un provider par protocole — fonctionne avec tout provider PTZ existant ou futur
- ✅ `PrivacyStrategy.None` est maintenant une valeur explicite — les caméras sans stratégie configurée ne tombent plus silencieusement sur `SoftwareBlur`
- ⚠️ Migration de données requise : `'software'` → `'software_blur'` dans `privacy_mode_strategy`, `'privacy_mode'` → `'hardware_privacy'` dans `capability`, suppression des bindings `ptz_parking`/`software_only`

---

### ADR-23 — Surveillance de joignabilité des caméras : polling TCP périodique indépendant de Frigate

#### Contexte

Le statut réseau d'une caméra (`Camera.Status`) n'était mis à jour que sur action explicite de l'utilisateur (`POST /api/cameras/{id}/verify`). En dehors de ces appels, le statut pouvait rester figé pendant des heures, rendant `Camera.Status` peu fiable pour conditionner l'affichage UI.

Deux conséquences directes :

1. **Home page** : `CameraLiveThumbnail` pollingait `latest.jpg` toutes les secondes même pour les caméras hors ligne, générant un flux noir inutile via Frigate.
2. **Page caméra** : les contrôles PTZ et les boutons de probe de capacités restaient actifs alors que la caméra était injoignable, induisant des erreurs confuses pour l'utilisateur.

#### Décision

Introduire un `CameraReachabilityPollerService` (BackgroundService, couche Application) qui sonde périodiquement la joignabilité de chaque caméra validée par connexion TCP directe, sans passer par Frigate.

**Comportement :**
- Délai initial de 15 s au démarrage pour laisser le host se stabiliser.
- Intervalle de 60 s entre chaque cycle de sondage.
- Périmètre : caméras dont `ValidationState == "validated"` (les caméras en état `"draft"` ou `"pending_removal"` sont exclues).
- Probe : tentative de connexion TCP sur `Camera.Host:Camera.Port` avec timeout de 3 s.
- Résultat : `"online"` si la connexion aboutit, `"offline"` sinon.
- Mise à jour DB uniquement si le statut change (évite les writes inutiles).
- `LastReachabilityCheckAt` mis à jour à chaque changement de statut.

**Adaptation UI :**

| Zone | Comportement hors ligne |
|---|---|
| Home — `CameraLiveThumbnail` | `offline` initialisé à `!camera.connected`; polling Frigate suspendu si hors ligne |
| Caméra — section PTZ | Message « Caméra hors ligne » ; `PtzControlPanel` non rendu |
| Caméra — section Capacités | Message « Caméra hors ligne » ; boutons probe/configure désactivés |

`connected: boolean` est dérivé du champ `status` dans le mapper frontend (`status === 'online'`) — aucun nouveau champ DTO backend n'est nécessaire.

#### Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Polling TCP backend périodique** (retenu) | BackgroundService, sonde TCP 60 s, met à jour `Camera.Status` | Léger, découplé de Frigate, statut disponible pour toute l'UI et les futures alertes | Latence max 60 s avant propagation d'un changement d'état |
| **B — Probe à la demande (frontend poll)** | Le frontend appelle `GET /status` toutes les N secondes par caméra ouverte | Probe toujours fraîche | N appels réseau par caméra visible ; exécute un probe RTSP complet à chaque fois |
| **C — Écouter les événements Frigate** | Statut déduit des événements MQTT Frigate | Zéro probe supplémentaire | Couple la disponibilité réseau caméra à l'état de Frigate — hors périmètre souhaité (caméras non encore appliquées à Frigate seraient invisibles) |

**Option A retenue.**

#### Conséquences

- ✅ `Camera.Status` est désormais maintenu automatiquement et peut servir de source fiable pour les futures alertes de déconnexion (Track D backlog)
- ✅ Aucun appel Frigate impliqué — fonctionne même pour les caméras en état `validated` mais pas encore appliquées (`IsEnabled = false`)
- ✅ UI conditionnée sur `connected` sans polling supplémentaire côté frontend — la liste de caméras rafraîchie toutes les N secondes suffit
- ⚠️ Latence max de 60 s entre la perte réseau réelle et la mise à jour UI — acceptable pour le cas d'usage (surveillance, pas temps réel)
- ⚠️ Pour les caméras DVRIP sur batterie (ICSee), un timeout TCP peut indiquer « en veille » plutôt que vraiment hors ligne — le statut `"offline"` est donc une approximation ; la distinction « hors ligne / en veille » est renvoyée à une future évolution du poller

---

### ADR-25 — Gestion des positions PTZ : presets natifs (Branch A) vs positions Vyzio-managed (Branch B)

#### Contexte

`PtzGoToPresetAsync` et `PtzSavePresetAsync` sont des no-ops dans `V380PtzProvider` car le protocole V380 ne connaît pas le concept de preset. De même, certaines caméras ONVIF bon marché retournent une liste de presets vide ou retournent une erreur `not implemented`. `PtzGoToPreset(presetId: 1)` dans `ToggleCameraPrivacyModeUseCase` ne provoque donc aucun mouvement sur ces caméras.

Le problème est générique : tout futur protocole ou firmware incomplet produit le même symptôme. La solution ne peut pas être couplée au protocole V380 — elle doit s'appliquer à toute caméra dont la probe ne confirme pas le support natif des presets.

#### Décision

**Deux branches d'implémentation, routées à la probe par `SupportsNativePresets` dans `ConfigJson`, jamais par nom de protocole.**

**Branch A — presets natifs**

Si la probe confirme ≥ 1 preset (`GetPresets` ONVIF ou équivalent DVRIP retourne une liste non vide), le flag `"supports_native_presets": true` est persisté dans `CameraCapabilityBinding.ConfigJson`. Les use cases délèguent directement au provider :
- `PtzSavePresetAsync` → `OnvifClient.SetPresetAsync`
- `PtzGoToPresetAsync` → `OnvifClient.GotoPresetAsync`

**Branch B — positions Vyzio-managed (fallback universel)**

Si la probe ne confirme pas le support natif, `"supports_native_presets": false` est persisté. Les positions sont gérées par Vyzio via un mécanisme de **homing + comptage de pas** :

1. **Homing** : `IPtzCapabilityProvider.PtzHomingStepsAsync` envoie N steps `UpLeft` jusqu'à la butée mécanique (timeout-based). N est une constante par provider (défaut : 200 steps). Après homing, la position virtuelle `(0, 0)` est établie et mémorisée en session (`ConcurrentDictionary<cameraId, (StepsX, StepsY)>`).
2. **Tracking** : chaque appel à `PtzStepAsync` met à jour la position virtuelle en mémoire (`±1` par direction, `±1/±1` en diagonal).
3. **Save preset** : le use case lit la position virtuelle courante via `provider.GetVirtualPosition(cameraId)` et persiste `(steps_x, steps_y)` dans la table `ptz_presets`.
4. **Go to preset** : le use case exécute `PtzHomingStepsAsync`, charge `(steps_x, steps_y)` depuis `ptz_presets`, puis rejoue les steps vers la cible (`Right` × steps_x → `Down` × steps_y).

Le homing est déclenché une seule fois par session par cameraId (le vecteur `(0,0)` est mémorisé en mémoire jusqu'au redémarrage du service). Si la position courante n'est pas encore connue (caméra non encore homée cette session), `GetVirtualPosition` retourne `null` — le use case déclenche alors le homing avant de sauvegarder.

**Slots de presets réservés :**
- Preset 1 — Surveillance (home) : position de surveillance nominale.
- Preset 2 — Parking vie privée : destination lors de l'activation du mode `ptz_parking`.
- Presets 3–4 : libres, personnalisables par l'utilisateur.

#### Modèle de données — `ptz_presets`

```sql
CREATE TABLE ptz_presets (
    id           TEXT PRIMARY KEY,
    camera_id    TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    preset_id    INTEGER NOT NULL,    -- 1..4
    label        TEXT NOT NULL,       -- "Surveillance" | "Parking" | libre
    native       INTEGER NOT NULL DEFAULT 0,  -- 1 si Branch A, 0 si Branch B
    native_token TEXT,    -- token ONVIF (Branch A)
    steps_x      INTEGER, -- steps depuis (0,0) horizontalement (Branch B)
    steps_y      INTEGER, -- steps depuis (0,0) verticalement, positif = bas (Branch B)
    UNIQUE (camera_id, preset_id)
);
```

#### Modifications d'interface

```csharp
// IPtzCapabilityProvider — deux ajouts avec implémentation par défaut (no-op)

// Returns current virtual step position for Branch B providers.
// Returns null for Branch A providers (they don't track steps).
virtual (int StepsX, int StepsY)? GetVirtualPosition(string cameraId) => null;

// Homes the camera to mechanical UpLeft limit, resets virtual position to (0,0).
// Default no-op — only Branch B providers that support homing implement this.
virtual Task PtzHomingStepsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    => Task.CompletedTask;
```

#### Routing dans les use cases

```csharp
// Shared helper
static bool SupportsNativePresets(string? configJson)
{
    if (string.IsNullOrEmpty(configJson)) return false;
    using var doc = JsonDocument.Parse(configJson);
    return doc.RootElement.TryGetProperty("supports_native_presets", out var p) && p.GetBoolean();
}

// PtzSavePresetUseCase
if (SupportsNativePresets(binding.ConfigJson))
    await provider.PtzSavePresetAsync(camera, binding, presetId, ct);
else
{
    if (provider.GetVirtualPosition(camera.Id) is null)
        await provider.PtzHomingStepsAsync(camera, binding, ct);
    var (sx, sy) = provider.GetVirtualPosition(camera.Id) ?? (0, 0);
    await presets.UpsertAsync(cameraId, presetId, PresetLabel(presetId), sx, sy, ct);
}

// PtzGoToPresetUseCase
if (SupportsNativePresets(binding.ConfigJson))
    await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
else
{
    var preset = await presets.GetAsync(cameraId, presetId, ct);
    if (preset is null) return false;
    await provider.PtzHomingStepsAsync(camera, binding, ct);
    for (int i = 0; i < preset.StepsX; i++)
        await provider.PtzStepAsync(camera, binding, PtzDirection.Right, 50, ct);
    for (int i = 0; i < preset.StepsY; i++)
        await provider.PtzStepAsync(camera, binding, PtzDirection.Down, 50, ct);
}
```

#### Endpoints API

```
GET  /api/cameras/{id}/ptz/presets           → liste des presets configurés (tous les slots)
POST /api/cameras/{id}/ptz/presets/{pid}/save → save la position courante dans le slot pid
POST /api/cameras/{id}/ptz/presets/{pid}/goto → aller au preset pid
```

#### Conséquences

- ✅ Branch B est indépendant du protocole — V380, ONVIF cheap, DVRIP sans presets : même chemin
- ✅ Aucun changement dans `V380PtzProvider.PtzGoToPresetAsync` (reste no-op) — le routing est dans les use cases
- ✅ `OnvifPtzProvider` garde ses implémentations natives inchangées pour Branch A
- ✅ Les presets 1 et 2 sont réservés — `ConfigurePtzParkingPositionUseCase` et `ToggleCameraPrivacyModeUseCase` restent câblés sur `presetId: 1`
- ⚠️ La position virtuelle est en mémoire : un redémarrage du service perd le tracking — le homing est déclenché à nouveau sur le prochain GoToPreset, ce qui est acceptable (la position physique est connue après homing)
- ⚠️ Le replay de steps (homing + N Right + M Down) peut prendre plusieurs secondes — acceptable pour les use cases preset/parking qui ne sont pas du temps réel

---

### ADR-26 — Miniatures de positions PTZ : capture client-triggered, stockage fichier, serving direct

#### Contexte

Chaque preset PTZ configuré doit afficher une miniature de la vue caméra à la position enregistrée (SPECS §9.4). La miniature doit être capturée après un GoTo, persistée et servie par l'API.

#### Options comparées

| Option | Stockage | Déclenchement | Complexité |
|---|---|---|---|
| **BLOB SQLite sur PtzPreset** | DB | Post-goto | ⚠️ Migr. + DB bloat images |
| **Fichier sur disque** (retenu) | Fichier | Post-goto client | ✅ Simple, pas de migration |
| **URL client-side (localStorage)** | Browser | Post-goto | ❌ Éphémère, pas multi-device |

#### Décision

**Fichiers JPEG sur disque, dans le répertoire de données (`{data_dir}/ptz-thumbnails/{cameraId}-{presetId}.jpg`).**

- `IPtzThumbnailStore` (Core/Interfaces) — `SaveAsync` / `TryGetAsync`
- `FilePtzThumbnailStore` (Infrastructure/Services) — implémentation fichier
- Pas de use case Application dédié — la capture est orchestrée par deux endpoints Minimal API qui s'appuient directement sur `IFrigateRestClient` (même pattern que le proxy `latest.jpg`)

**Endpoints :**
```
POST /api/cameras/{id}/ptz/presets/{presetId}/snapshot  → capture frame Frigate + persiste
GET  /api/cameras/{id}/ptz/presets/{presetId}/thumbnail → sert le JPEG (404 si absent)
```

**Déclenchement côté client :**
- Après `POST /ptz/preset/goto` → attente 1 500 ms (délai de mouvement physique) → `POST /snapshot`
- Après `POST /ptz/preset/save` → même délai + capture (la caméra est déjà à la position)
- La miniature n'est pas capturée à la sauvegarde initiale d'un preset (la caméra n'est pas nécessairement à la position à ce moment)

**Affichage :**
- Section positions PTZ dans la fiche caméra (`PtzPresetsSection`) : miniature à gauche de chaque ligne preset
- `PtzControlPanel` (modale live) : déclenche la capture après GoTo mais n'affiche pas de miniature (affichage délégué à `PtzPresetsSection`)
- Cache-busting via `?t={timestamp}` dans le `src` de l'image, mis à jour après chaque capture réussie

#### Conséquences

- ✅ Aucune migration de base de données
- ✅ Cohérent avec le pattern existant `latest.jpg` et `FaceStorageOptions`
- ✅ Les miniatures survivent aux redémarrages (fichiers disque)
- ⚠️ Le délai de 1 500 ms est un heuristique — une caméra Branch B (homing + steps) peut être plus lente ; acceptable car la miniature est non-bloquante

---

### ADR-27 — Réglages image avancés : capacité `ImageSettings`, ONVIF Imaging Service, valeurs non persistées

#### Contexte

SPECS §10 : l'utilisateur doit pouvoir régler luminosité, contraste, saturation, netteté et vision nocturne (IR) depuis Vyzio plutôt que dans l'app constructeur — c'est le premier jalon du principe produit « contrôle unifié de toutes les caméras » (README, `../CLAUDE.md`). Comme PTZ et vie privée matérielle (ADR-22), ces réglages ne dépendent pas de la marque mais de ce que la caméra sait réellement faire.

Différence structurelle avec PTZ/privacy : il n'y a rien à persister côté Vyzio. La caméra reste la seule source de vérité pour ses réglages image — Vyzio lit et écrit en direct, comme un simple proxy protocolaire.

#### Décision

**Nouvelle valeur d'enum `CameraCapability.ImageSettings`**, résolue par protocole exactement comme `Ptz`/`HardwarePrivacy` — aucune extension du modèle `CameraCapabilityBinding` nécessaire (le binding existant sert uniquement à tracer quel protocole gère la capacité et le résultat du dernier probe).

```csharp
// Vyzio.Core/Entities/CameraCapability.cs
public enum CameraCapability { Stream, Ptz, HardwarePrivacy, ImageSettings }

// Vyzio.Core/Entities/CameraImageSettings.cs — snapshot live, jamais persisté en base
public sealed record CameraImageSettings(
    int Brightness,      // 0-100
    int Contrast,        // 0-100
    int Saturation,      // 0-100
    int Sharpness,       // 0-100
    IrCutMode IrCutMode); // Auto | On | Off

// Vyzio.Core/Interfaces/IImageSettingsCapabilityProvider.cs
public interface IImageSettingsCapabilityProvider
{
    SupportedProtocol Protocol { get; }
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
    Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
    Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default);
}
```

`ICapabilityProviderRegistry` gagne `ResolveImageSettings(SupportedProtocol)`, même contrat que `ResolvePtz`/`ResolvePrivacy` (throw si non enregistré).

**Protocole couvert dans cette itération : ONVIF uniquement**, via le service ONVIF Imaging (`GetImagingSettings`/`SetImagingSettings`, ver20/imaging/wsdl) — `OnvifClient` gagne les méthodes correspondantes, transport SOAP identique au PTZ (WS-UsernameToken, port 8899). `OnvifImageSettingsProvider` couvre donc la même liste de marques que `OnvifPtzProvider` (V380 Pro, Hikvision, Dahua, Reolink, Axis, tout ONVIF générique).

**DVRIP (ICSee/XMEye) et Tapo KLAP ne sont pas couverts par cette ADR** — leurs commandes de réglage image ne sont pas documentées publiquement et n'ont pas encore été investiguées sur le terrain (contrairement au PTZ DVRIP, cf. ADR-21). Reste en Idées backlog jusqu'à investigation terrain, suivant le même principe que ADR-23/26 (« jamais deviner un protocole binaire propriétaire sans capture réseau »).

**Pas de migration EF** : `Capability`/`Protocol` sont déjà des colonnes `TEXT` sur `camera_capability_bindings` (ADR-22) — ajouter une valeur d'enum ne change pas le schéma. Les valeurs de réglage elles-mêmes ne sont stockées nulle part côté Vyzio.

**Endpoints (lecture/écriture directe, pas de use case de persistance) :**
```
GET /api/cameras/{id}/image-settings  → lit en direct via le provider résolu, 404 si capacité non configurée/vérifiée
PUT /api/cameras/{id}/image-settings  → écrit en direct, renvoie le nouveau snapshot lu après écriture
```

`VendorCapabilityPresets` : ajout de `(CameraCapability.ImageSettings, SupportedProtocol.Onvif)` au preset `V380Pro` — c'est la seule marque officiellement supportée qui parle déjà ONVIF.

#### Conséquences

- ✅ Aucune migration de base de données, aucun risque de désynchronisation Vyzio/caméra (pas de copie locale à invalider)
- ✅ Réutilise entièrement le pattern ADR-22 (registry, probe, `VendorCapabilityPresets`) — zéro nouvelle abstraction
- ✅ `OnvifClient` déjà couvert par WS-UsernameToken/port 8899 — pas de nouveau transport
- ⚠️ DVRIP et Tapo KLAP restent hors périmètre — un utilisateur ICSee/Tapo ne voit pas cette capacité tant qu'une investigation terrain n'a pas produit un provider dédié
- ⚠️ Les plages ONVIF (`Brightness`/`Contrast`/`ColorSaturation`/`Sharpness`) sont nominalement 0-100 par le schéma `ver10/schema` mais certains firmwares appliquent leurs propres bornes ; pas de `GetOptions`/min-max dans cette itération — à ajouter si un firmware terrain contredit l'hypothèse 0-100

> **Correctif terrain (2026-07-14) :** deux caméras réelles (V380, ICSee) ont révélé que `OnvifClient` avalait toute erreur HTTP/SOAP en silence (`PostSoapAsync` loguait puis renvoyait `null`), remontant systématiquement une `LastError` vide côté binding — l'UI affichait alors un message générique au lieu de la vraie cause. Corrigé : `PostSoapAsync` accepte un paramètre `throwOnFailure` qui, pour les appels Imaging (`GetVideoSourceTokenAsync`, `GetImagingSettingsAsync`, `SetImagingSettingsAsync`), lève `OnvifCallException` avec le statut HTTP réel et le texte du SOAP fault si présent ; l'exception remonte jusqu'à `ProbeCameraCapabilityUseCase`, qui la capture déjà dans `LastError` (aucun changement nécessaire côté use case). Log terrain confirmé : un des deux boîtiers renvoie `400 Bad Request` sur `imaging_service` — cause probable : absence du paramètre SOAP 1.2 `action` dans le `Content-Type`, désormais ajouté (`soapAction` sur `PostSoapAsync`/`SendCommandAsync`) pour les appels Imaging. PTZ/Media/Device restent inchangés (comportement résilient à dessein, cf. tests `OnvifPtzProviderTests`) — seule la capacité `ImageSettings`, dont le probe doit être franc, adopte ce nouveau contrat.

---

### ADR-28 — Détection de capacité en cascade multi-protocole + flag `ManuallyConfigured`

#### Contexte

Deux défauts découverts en test terrain sur `SeedAndProbePresetsUseCase` (ADR-22), tous deux dans `SeedAndProbePresetAsync` :

1. **Écrasement silencieux d'une config manuelle.** Le code réinitialisait inconditionnellement le protocole d'un binding existant vers celui du preset dès qu'ils différaient (`existing.Protocol != protocol`). Ce comportement visait à migrer les vieux bindings quand le **preset lui-même change dans le code** (ex. V380Pro : `Onvif` → `V380`, migration historique) — mais il ne distingue pas ce cas de « l'utilisateur a choisi un autre protocole qui fonctionne ». Conséquence terrain : un utilisateur ICSee changeait manuellement le protocole PTZ vers `Onvif` (fonctionnel sur son unité), et le clic suivant sur « Détecter les capacités » l'écrasait silencieusement vers le `Dvrip` du preset.
2. **Un seul protocole essayé par capacité, jamais de repli.** Le preset ICSee ne déclarait que `Dvrip` pour PTZ — alors que certaines unités ICSee exposent aussi ONVIF (cf. `vendors/icsee.md` § A savoir). Sans second essai automatique, ces unités restent bloquées sur DVRIP même quand ONVIF marcherait mieux. C'était l'item backlog `onboarding` #5 (« Priorité protocole pour la détection de capacités »), resté en attente depuis le refacto `arch-protocol`.

#### Décision

**a) `VendorCapabilityPreset.DefaultBindings` déclare une liste ordonnée de protocoles candidats par capacité**, pas un protocole unique :

```csharp
// Vyzio.Core/Entities/VendorCapabilityPreset.cs
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, IReadOnlyList<SupportedProtocol> Protocols)> DefaultBindings);

// Vyzio.Core/Entities/VendorCapabilityPresets.cs
new VendorCapabilityPreset(VendorFamily.Icsee,
[
    (CameraCapability.Ptz, new[] { SupportedProtocol.Onvif, SupportedProtocol.Dvrip }),
]),
```

`SeedAndProbePresetAsync` essaie chaque candidat **dans l'ordre**, s'arrête au premier qui vérifie (`Verified = true`), et conserve le dernier essayé (avec son `LastError`) si aucun ne fonctionne — jamais de fallback silencieux vers un état non testé.

**b) Nouveau champ `CameraCapabilityBinding.ManuallyConfigured`** (colonne `manually_configured`, migration additive `AddManuallyConfiguredToCapabilityBindings`) :
- mis à `true` uniquement par `ConfigureCameraCapabilityUseCase` (le chemin manuel — formulaire de configuration, y compris sur une marque reconnue) ;
- laissé à `false` pour tout binding seedé depuis un preset ;
- `SeedAndProbePresetAsync` ne touche **jamais** un binding `ManuallyConfigured = true`, qu'il soit vérifié ou non — seul un nouveau choix manuel de l'utilisateur peut le changer. Il se contente de re-probe pour rafraîchir `Verified`/`LastError`.
- un binding déjà `Verified = true` avec un protocole toujours présent dans la liste de candidats du preset n'est pas non plus retesté depuis zéro — seulement re-probe, jamais reset.

**c) Le formulaire de configuration manuelle n'est plus réservé aux caméras non répertoriées.** Une capacité non encore liée (preset ou manuelle) reste toujours ajoutable à la main, même sur une marque reconnue — un preset déclare ce que Vyzio *attend*, pas un plafond exhaustif (ex. ajouter `ImageSettings/Onvif` sur une ICSee dont l'unité s'avère aussi parler ONVIF).

**d) Détection à l'ajout généralisée aux caméras sans marque reconnue.** `ICapabilityProviderRegistry.GetRegisteredProtocols(capability)` expose, pour PTZ/vie privée matérielle/réglages image, la liste des protocoles ayant un provider enregistré (ordre d'enregistrement DI, ONVIF en premier). Une caméra sans `VendorFamily` passe désormais par la même cascade que les marques reconnues, juste construite depuis cette liste au lieu d'un preset — au lieu de ne tenter que PTZ/ONVIF comme avant. Seule différence avec le chemin preset : si aucun protocole ne vérifie, le binding est supprimé plutôt que laissé en échec — un preset a le droit de proposer « à configurer », une caméra non reconnue n'a pas de raison de garder un essai à l'aveugle qui a échoué.

#### Conséquences

- ✅ Un choix manuel de protocole n'est plus jamais silencieusement écrasé par un nouveau clic sur « Détecter les capacités »
- ✅ Les marques dont certaines unités parlent plusieurs protocoles (ICSee/ONVIF) bénéficient d'un vrai essai en cascade, sans configuration manuelle nécessaire dans le cas nominal
- ✅ Une caméra non reconnue bénéficie de la même détection automatique (PTZ + réglages image + vie privée matérielle) qu'une marque connue, plus seulement PTZ/ONVIF
- ✅ Migration additive uniquement (`manually_configured INTEGER NOT NULL DEFAULT 0`) — aucune caméra existante affectée (tous les bindings existants restent `ManuallyConfigured = false`, donc toujours éligibles à la cascade/reset comme avant)
- ⚠️ Un binding manuel qui ne fonctionne plus (firmware changé, caméra remplacée) reste bloqué sur son protocole choisi jusqu'à une nouvelle action manuelle de l'utilisateur — c'est le compromis assumé : ne jamais surprendre l'utilisateur plutôt que « deviner » qu'il faut re-essayer un autre protocole à sa place

---

### ADR-29 — DVRIP : `DvripClient` partagé, réglages image (`AVEnc.VideoColor.[0]`), PTZ Move/Stop

#### Contexte

ICSee n'expose aucun service ONVIF (port 8899 refusé) — `ImageSettings/Onvif` (ADR-27) ne peut jamais fonctionner sur cette marque. `docs/investigations/icsee_dvrip_privacy.md` avait identifié la piste DVRIP pour les réglages image (`AVEnc.VideoColor.[0]`, notamment `Brightness`) mais avec plusieurs erreurs de transcription du protocole (header binaire, codes de commande, algorithme de hash — voir l'erratum en tête de ce document), jamais corrigées avant un test terrain complet. `DvripPtzProvider` (PTZ, ADR-22/25) partageait ces mêmes erreurs et n'a donc jamais fonctionné correctement en conditions réelles malgré des tests apparemment concluants lors de l'investigation initiale (obtenus via un outil différent du code Vyzio).

#### Décision

**a) `DvripClient` — client protocole partagé** (`Vyzio.Infrastructure/VendorAdapters/DvripClient.cs`), extrait de `DvripPtzProvider`. Même rôle que `OnvifClient` pour ONVIF : transport bas niveau uniquement (TCP port 34567, login, framing binaire, JSON), aucune logique fonctionnelle. `DvripPtzProvider` et `DvripImageSettingsProvider` en dépendent tous les deux.

**Protocole confirmé contre une caméra ICSee réelle** (comparaison directe avec la bibliothèque de référence `python-dvr`, puis test en direct) :
- Header binaire **20 octets** : `head(1)=0xFF version(1)=0x00 pad(2) session(4LE) seq(4LE) pad(2) cmd(2LE) dataLen(4LE)`.
- Login : champ JSON `"UserName"` (pas `"Name"`).
- `SofiaHash` : paires d'**octets bruts** du digest MD5 (8 caractères en sortie) — `sofia_hash("a4m3h5") == "S8jyn9CB"`.
- Codes de commande : Login=1000, ConfigGet=1042, ConfigSet=**1040**, OPPTZControl=1400.

```csharp
internal sealed class DvripClient(ILogger<DvripClient> logger)
{
    public Task<string?> ExecuteAsync(Camera, int cmdCode, Func<string, string> buildPayload, CancellationToken);
    public Task<bool> TryLoginAsync(Camera, CancellationToken); // probe de connectivité, jamais de throw
    public Task<JsonNode?> ConfigGetAsync(Camera, string configName, CancellationToken);  // throw DvripCallException
    public Task ConfigSetAsync(Camera, string configName, JsonNode config, CancellationToken); // throw DvripCallException
}

public sealed class DvripCallException(string message, Exception? inner = null) : Exception(message, inner);
```

`DvripCallException` reprend le principe d'`OnvifCallException` (ADR-28) : `ConfigGetAsync`/`ConfigSetAsync` lèvent avec la vraie cause (statut HTTP-like `Ret`, timeout distingué d'un rejet explicite) plutôt que d'avaler l'échec — `ProbeCameraCapabilityUseCase` la capture déjà dans `LastError`. Bornées à 5s au total (connexion + login + requête + réponse). `DvripPtzProvider.TryLoginAsync` garde son comportement probe existant (avale, renvoie `false`).

**b) `DvripImageSettingsProvider` — Brightness/Contrast/Saturation uniquement**, via `AVEnc.VideoColor.[0]` (`ConfigGet`/`ConfigSet`).

- Schéma JSON non garanti stable entre firmwares (plat ou imbriqué sous un tableau de plages horaires) : `FindIntProperty`/`SetIntProperty` parcourent récursivement l'arbre JSON par nom de champ plutôt que de supposer une structure fixe — même principe de résilience qu'`OnvifClient`. `SetImageSettingsAsync` relit toujours la config complète, ne modifie que les champs connus, renvoie l'arbre entier tel quel (aucun champ non modélisé n'est perdu).
- **Sharpness et IrCutMode non pris en charge** : absents de `VideoColor`, mode jour/nuit jamais investigué. `GetImageSettingsAsync` renvoie des valeurs neutres fixes (`Sharpness=50`, `IrCutMode=Auto`), `SetImageSettingsAsync` ignore silencieusement ces deux champs. Le frontend masque les contrôles correspondants quand le protocole résolu est `dvrip`.

**c) `VendorCapabilityPresets.Icsee`** déclare `(ImageSettings, [Dvrip])` — un seul candidat (ONVIF confirmé absent sur ce matériel).

**d) `VendorCapabilityPresets.V380Pro`** ne déclare **plus** `(ImageSettings, [Onvif])` — un test réel a renvoyé un SOAP fault ONVIF explicite (« GetImagingSettings not implemented »), signal définitif de non-implémentation. Un contrôle natif V380 (vision nocturne) a été tenté puis abandonné — voir ADR-30. `ImageSettings` reste configurable à la main pour V380 (via ONVIF) si une unité différente répond correctement, jamais activée sans test réussi.

**e) `DvripPtzProvider` — Move/Stop.** Payload `OPPTZControl` conforme à `python-dvr`/`dbuezas` (`icsee-ptz`, intégration Home Assistant en production pour cette même famille de caméras) : pas de champ `"Action"`, pas de `"POINT"`, `"Pattern"` toujours `"Start"`.

```csharp
// Mouvement : Command = direction, Preset = 0, Step = 1-8 selon la vitesse
// Arrêt     : Command = "DirectionUp" (fixe, indépendant de la direction en cours), Preset = -1, Step = 5
```

`Preset=-1` est le sentinel d'arrêt réel du firmware — pas une simple valeur "sans preset". `PtzStepAsync` retombe sur l'implémentation par défaut de l'interface (`Move` puis `Stop`), désormais correcte puisque les deux commandes sont protocolairement valides. Gauche/droite sont inversés dans `DirectionToCommand` par rapport au nom de commande DVRIP intuitif — montage moteur propre à ce modèle, haut/bas ne nécessitait pas d'inversion.

#### Conséquences

- ✅ Réglages image DVRIP et PTZ DVRIP fonctionnels et validés en direct sur matériel réel (lecture, écriture, mouvement, arrêt)
- ✅ `DvripClient` élimine la duplication du framing binaire entre PTZ et réglages image — même pattern que `OnvifClient`
- ✅ Résilient à un schéma JSON de config inconnu — pas de risque de corrompre un champ non modélisé côté Vyzio
- ⚠️ Netteté et vision nocturne restent indisponibles pour ICSee tant qu'une investigation terrain dédiée n'a pas confirmé une commande DVRIP fiable
- ⚠️ Tapo KLAP reste hors périmètre (aucune investigation), voir Idées backlog

---

### ADR-30 — V380 natif pour `ImageSettings` : tenté puis abandonné (vision nocturne, opcode `0xC4`)

#### Contexte

`ImageSettings/Onvif` est confirmé cassé sur V380 Pro (ADR-29d). Piste explorée : [`prsyahmi/v380`](https://github.com/prsyahmi/v380) (`v380.cpp`), déjà à l'origine du PTZ natif (ADR-22), contient une commande « lumière » IR (opcode `0xC4`, 16 octets, valeurs on/off/auto). Recherche systématique de tout ce que le protocole expose par ailleurs (pas de devinette) : tous les fichiers du dépôt inspectés, plus les autres sources V380 déjà rassemblées (structure d'authentification, handshake du relais P2P) — aucune commande Brightness/Contrast/Saturation/Sharpness n'existe nulle part ; la vision nocturne était la seule piste restante.

Implémentée (provider + cache de dernière valeur écrite, car le protocole n'a aucune lecture d'état — même limite que le PTZ V380 sans retour de position, ADR-25 Branch B) puis **testée par l'utilisateur en conditions réelles : aucun effet sur la caméra**, malgré un pipeline d'envoi identique à celui du PTZ (confirmé fonctionnel).

Avant de conclure à une limitation matérielle, vérification de la solidité de la source elle-même :
- Le `README.md` du dépôt ne documente **pas** le flag `--light` dans son aide (`-u`, `-p`, `-addr`, `-mac`, `-id`, `-port`, `-retry`, `--enable-ptz`, `--discover` seulement) — signe d'une fonctionnalité jamais vraiment finalisée/documentée par l'auteur.
- Le même dépôt contient une **seconde implémentation indépendante** du protocole (`v380-nodejs/`) qui, elle, **n'a aucune commande lumière du tout** — alors que le PTZ, lui, est bien présent dans les deux implémentations.
- **L'application officielle V380 elle-même n'a pas ce réglage** dans son UI — confirmé par l'utilisateur. Il n'existe donc aucun moyen de capturer le vrai trafic de référence pour comparer (contrairement à DVRIP, où `python-dvr` a servi de vérité terrain, ADR-29).

Conclusion : la commande `0xC4` est la partie la moins fiable de tout ce dépôt — probablement jamais validée par son propre auteur — et rien ne permet de la corriger par déduction supplémentaire.

#### Décision

**Retrait complet.** `V380ImageSettingsProvider`, `V380ImageSettingsTracker` et leurs tests ont été supprimés ; `VendorCapabilityPresets.V380Pro` ne déclare plus de binding `ImageSettings` par défaut (retour à l'état ADR-29d — `ImageSettings` reste configurable à la main via ONVIF pour une unité qui répondrait différemment, jamais activée sans test réussi). Le frontend ne propose plus `v380` dans les protocoles de réglages image.

Seule extraction conservée : **`V380DeviceIdBootstrap`** (`Vyzio.Infrastructure/VendorAdapters/`) — la logique de résolution du device ID (ConfigJson persisté → ONVIF serial → repli UDP) a été sortie de `V380PtzProvider` vers une classe statique partagée en prévision de ce provider. Gardée malgré le retrait : c'est une déduplication propre et sans risque, immédiatement réutilisable si une vraie commande de réglages image V380 natif est un jour confirmée.

#### Conséquences

- ✅ Aucun contrôle affiché qui ne fait rien réellement (principe ADR-22) — mieux vaut l'absence de la fonctionnalité qu'un faux contrôle
- ✅ `V380DeviceIdBootstrap` reste comme base réutilisable si une source fiable apparaît un jour
- ⚠️ Vision nocturne V380 natif reste hors périmètre tant qu'aucune capture réseau réelle (app tierce compatible, ou reverse engineering matériel) ne fournit une commande confirmée — pas une simple relecture de code existant
- ⚠️ V380 Pro n'a donc aucun contrôle image fonctionnel connu à ce jour (ONVIF cassé, natif inexistant) — à documenter côté utilisateur (`docs/user/`) si la question revient

---

### ADR-31 — Découverte réseau : signaux protocolaires V380/Tapo KLAP + override manuel du constructeur à l'onboarding

#### Contexte

Backlog `onboarding` (item « Scan réseau ») : la reconnaissance de constructeur à la découverte repose aujourd'hui sur du texte (nom/note/hostname) et l'OUI MAC (`AssistedCameraDiscoveryKnownDevices.DetectVendorFamily`), en plus des vrais signaux protocolaires ONVIF/RTSP/DVRIP déjà en place (§ Stratégie de découverte). Cette reconnaissance textuelle est fragile par nature (déjà noté dans les règles produit, § 2.2/2.3 SPECS) ; deux axes d'amélioration sont retenus :

1. Ajouter des signaux protocolaires réels pour V380 et Tapo KLAP, au même niveau de fiabilité que le signal DVRIP déjà retenu comme `camera_confirmed`.
2. Donner à l'utilisateur un moyen direct de corriger/court-circuiter une reconnaissance automatique ratée, sans repasser par la déclaration capacité-par-capacité de l'ADR-22 (qui reste le recours pour une marque réellement inconnue de Vyzio).

L'affichage des équipements non reconnus (« afficher tout ce qui est trouvé même si ça ne matche aucun pattern, priorité plus faible ») repose sur `AssistedCameraDiscoveryFormatter.ShouldExposeToFront` (expose déjà tout candidat sans filtrage) et `device_unknown` (qualification et priorité de tri les plus basses, § Modèle de qualification retenu) — mais ces deux mécanismes ne s'appliquent qu'aux candidats qui **atteignent** l'identifieur sous forme de signal brut. Or `DiscoverMacVendorSignalsAsync` ne produisait jusqu'ici un signal que si l'OUI MAC correspondait à une des 3 marques connues, et `DiscoverHostnameSignalsAsync` uniquement si le hostname matchait un motif connu : un équipement qui ne répond à **aucun** protocole sondé et dont l'OUI/hostname ne matche rien (typique d'une caméra cloud-only sans API locale documentée, ex. constatée en usage réel avec une YI YRS3521) ne produisait alors **aucun signal du tout** et restait invisible, contrairement à l'intention du backlog. Correction en (c).

#### Décision

**a) Deux nouveaux probes protocolaires dans `AssistedCameraDiscoveryProbePipeline`**, au même niveau que le probe DVRIP existant (`ProbeDvripEndpointAsync`) : sondes autonomes, sans credentials, sans dépendance à un `Camera` persisté — le pipeline de découverte est instancié manuellement (`new AssistedCameraDiscoveryProbePipeline(...)`), pas par DI, donc il ne réutilise pas `V380Client`/`TapoKlapProvider` (qui exigent une entité `Camera` et des credentials) ; comme pour DVRIP, dupliquer les quelques octets de handshake minimal est le choix retenu plutôt que de faire dépendre la découverte d'une entité métier.

- **V380** : requête UDP `NVDEVSEARCH^100` (port 10008, même format que `V380Client.DiscoverDeviceIdAsync`) ; une réponse parseable prouve qu'un service V380 répond, sans authentification.
- **Tapo KLAP** : `POST /app/handshake1` (port 80) avec un seed aléatoire ; une réponse ≥ 48 octets (seed serveur 16B + hash serveur 32B) prouve le protocole KLAP — `handshake1` ne dépend pas des credentials (seul `handshake2` en a besoin), donc ce signal est utilisable sans mot de passe connu.

Chaque probe positif ajoute une raison de qualification dédiée (`v380_port_detected`, `tapo_klap_detected`) traitée comme `camera_confirmed` par `AssistedCameraDiscoveryIdentifier.DetermineQualification`, au même titre que `dvrip_port_detected`.

**b) Override manuel du constructeur à l'onboarding.** Le contrat `CreateCameraRequest`/`UpdateCameraRequest` accepte déjà un `VendorFamily` optionnel, et `SeedAndProbePresetsUseCase` (ADR-28) l'utilise déjà pour choisir le chemin preset plutôt que la détection à l'aveugle — seule la surface UI manquait. Le formulaire d'ajout/édition (`CameraOnboardingView.tsx`) expose un sélecteur de marque optionnel (`v380_pro` / `tplink_tapo` / `icsee` / aucune) qui alimente le champ `vendorFamily` déjà câblé de bout en bout ; aucun nouveau endpoint ni nouvelle logique métier côté backend.

**c) Signal de secours « hôte présent, protocole inconnu ».** `DiscoverMacVendorSignalsAsync` émet désormais un signal dès qu'une adresse MAC est résolue dans la table ARP, que l'OUI soit reconnu ou non — seule l'absence totale de résolution MAC (hôte injoignable/hors LAN) est encore un motif d'exclusion. Un hôte dont l'OUI ne matche rien remonte avec la raison `mac_address_observed` (déjà gérée par `AssistedCameraDiscoveryIdentifier`, qui la classe en `device_unknown` faute d'autre signal), une note explicite invitant à vérifier l'accès local ou à déclarer l'équipement manuellement, et `vendorFamily = null`. Limite connue et non traitée ici : `ResolveMacAddress` ne lit `/proc/net/arp` que sous Linux (`OperatingSystem.IsLinux()`) et suppose que le conteneur backend voit la table ARP du réseau physique (mode réseau `host`, pas `bridge`) — un déploiement qui isole le conteneur sur un réseau Docker dédié ne verra pas les hôtes du LAN par ce mécanisme.

#### Conséquences

- ✅ Deux signaux d'identification supplémentaires basés sur une vraie réponse protocolaire plutôt qu'une correspondance de texte, sans risque (lecture seule, pas de credentials, mêmes garanties d'isolation que les probes existants)
- ✅ L'utilisateur peut corriger une reconnaissance automatique ratée en un clic, sans repasser par la déclaration capacité-par-capacité — cette dernière reste le recours pour une marque non répertoriée
- ✅ Un équipement qui ne répond à aucun protocole connu et n'a pas d'OUI reconnu reste désormais visible (priorité basse) au lieu de disparaître silencieusement, conformément à l'intention initiale du backlog
- ✅ Aucun changement de contrat API ni de modèle de données (le champ existait déjà, seule l'UI manquait)
- ⚠️ Les autres protocoles cités dans l'idée de backlog (ex. identification via ports ouverts génériques pour des marques non enregistrées) restent hors périmètre : seuls V380 et Tapo KLAP ont un protocole local connu et déjà implémenté ailleurs dans le code (`V380Client`, `TapoKlapProvider`) à réutiliser comme référence de handshake
- ⚠️ Le signal de secours (c) dépend d'un backend Linux avec accès à la table ARP du réseau physique (réseau `host`) ; sans cela, un équipement sans protocole reconnu reste invisible — à vérifier/documenter selon le mode de déploiement réel

---

### ADR-32 — Pipeline de découverte réseau en 3 étapes explicites : identification / enrichissement / interprétation

#### Contexte

Un usage réel a révélé deux limites concrètes du pipeline de découverte, au-delà du point (c) de l'ADR-31 :

1. **Aucune étape d'identification.** Le pipeline sonde directement chaque protocole (RTSP/ONVIF/HTTP/DVRIP/V380/KLAP) contre **toutes** les adresses d'une plage CIDR balayée, sans vérifier au préalable qu'un hôte y répond ne serait-ce qu'au niveau réseau. Concrètement : une caméra YI YRS3521 sans protocole local exposé restait invisible même après le correctif ARP de l'ADR-31c (la résolution MAC ne s'appuie que sur la table ARP déjà peuplée, ce qui n'apporte rien si l'hôte n'a jamais été contacté). Une identification explicite en amont (ping) était manquante.
2. **L'interprétation fuit dans l'enrichissement.** `AssistedCameraDiscoveryKnownDevices.DetectVendorFamily` construisait son empreinte de texte à partir du champ `Note` des signaux — un champ pensé comme explication lisible pour l'utilisateur, pas comme donnée structurée. Conséquence concrète : le probe DVRIP mentionnait "ICSee, Annke, Sannce" à titre d'exemples d'OEM partageant ce chipset, et cette même phrase faisait matcher `icsee` pour **toute** caméra DVRIP, y compris une Annke ou une Sannce réelle — un faux positif de marque.

Décision : formaliser trois étapes explicites et strictement ordonnées, chacune avec une responsabilité unique, plutôt que des sondes qui mélangent détection réseau, collecte de faits et suggestion de marque.

#### Décision

**1) Identification** (`AssistedCameraDiscoveryProbePipeline.IdentifyHostsAsync`/`PingSweepAsync`) — détermine quels hôtes méritent d'être enrichis, avant toute sonde protocolaire :
- les hôtes **explicites** (`ProbeHosts`, ou la cible unique d'une vérification manuelle via `CameraDiscoveryTarget`) ne sont **jamais** filtrés — l'utilisateur les a désignés directement, un ping manqué (ICMP désactivé sur l'appareil) ne doit jamais les faire disparaître ;
- les hôtes **balayés** (plage CIDR, ex. `192.168.1.0/24`) sont d'abord filtrés par un ping ICMP (`System.Net.NetworkInformation.Ping`) — tenter DVRIP/V380/RTSP/ONVIF/KLAP contre les 254 adresses d'un `/24` est inutilement coûteux ; une réponse au ping suffit à justifier l'enrichissement ;
- **filet de sécurité** : si absolument aucun hôte balayé ne répond au ping, le balayage retombe sur la liste non filtrée plutôt que de scanner silencieusement zéro hôte — un ping totalement bloqué (conteneur sans `CAP_NET_RAW`) est plus probable qu'un réseau réellement vide, donc ce cas ne doit jamais régresser en dessous de la couverture précédente ;
- l'annonce ONVIF multicast reste indépendante de cette étape : l'appareil s'auto-identifie en répondant le premier, il ne nécessite pas de ping préalable.

**2) Enrichissement** (les méthodes `Discover*SignalsAsync` existantes, désormais appliquées uniquement aux hôtes identifiés) — collecte des faits bruts par hôte : MAC (ARP), hostname (rDNS), et résultat de chaque handshake protocolaire. Aucune suggestion de marque n'est produite ici ; le texte des notes reste factuel (ex. la note DVRIP précise désormais explicitement que le protocole est **partagé par plusieurs OEM** et ne permet pas d'identifier la marque à lui seul, au lieu d'énumérer des marques comme si DVRIP les impliquait).

**3) Interprétation** (`AssistedCameraDiscoveryIdentifier`/`AssistedCameraDiscoveryFormatter`, déjà responsables de la qualification et du merge par hôte) — corrigée pour dériver la marque **uniquement** de preuves structurées : `DetectVendorFamily` prend désormais `discoverySource` au lieu de `Note` en entrée. Une réponse protocolaire V380/KLAP confirmée implique directement la marque (définitionnel, pas une supposition) ; DVRIP, partagé entre OEM, n'implique plus aucune marque à lui seul — seuls l'OUI MAC ou le hostname peuvent encore la déduire.

Chaque classe porte désormais un commentaire d'en-tête identifiant explicitement son étage (1, 2 ou 3) pour que la séparation reste visible dans le code, pas seulement dans ce document.

#### Conséquences

- ✅ Corrige l'invisibilité totale d'un appareil sans protocole reconnu et sans entrée ARP préalable (cas YI YRS3521) — un simple ping suffit désormais à le faire apparaître en priorité basse
- ✅ Réduit le travail réseau réel : un balayage `/24` sonde ~5-20 hôtes réellement vivants au lieu de tenter 6 protocoles contre 254 adresses
- ✅ Corrige un faux positif de marque réel (DVRIP → `icsee` pour tout appareil, y compris Annke/Sannce)
- ✅ Séparation des responsabilités testable indépendamment : un hôte explicite ignore totalement l'étape 1, ce qui limite le risque de régression (seul un test du jeu existant balaie une plage CIDR)
- ⚠️ Le ping ICMP a les mêmes contraintes de privilège que la lecture ARP (ADR-31c) — sous Linux, nécessite `CAP_NET_RAW` ou un utilisateur autorisé ; le filet de sécurité (repli sur la liste non filtrée) absorbe ce cas sans le résoudre à la source
- ⚠️ L'étape d'identification ajoute une latence séquentielle (ping puis sondes protocolaires) là où tout tournait auparavant en un seul lot parallèle ; compromis assumé pour la réduction de charge réseau

#### Correction (d) — l'identification ne doit jamais filtrer ce qui s'affiche

Constat en usage réel (déploiement Docker bridge, ARP indisponible comme prévu en ADR-31c) : le ping identifiait correctement des hôtes vivants (ex. 16 sur 508), mais un hôte identifié qui ne matchait ensuite aucun protocole/MAC/hostname produisait **zéro signal brut** et disparaissait quand même — l'étape d'identification, censée être un filtre sur *quoi enrichir*, se comportait de fait comme un filtre sur *quoi afficher*. C'est la régression exacte que ce ADR visait à corriger, réintroduite silencieusement.

**Correctif** : `AssistedCameraDiscoveryProbePipeline` génère désormais un signal de base (`network_host`, aucune raison de qualification) pour **chaque hôte identifié**, avant même de lancer les sondes d'enrichissement. Ce signal garantit que tout hôte identifié apparaît au moins en `device_unknown`, priorité la plus basse ; s'il existe par ailleurs un vrai signal (protocole, MAC, hostname), celui-ci l'emporte toujours à la fusion (`AssistedCameraDiscoveryFormatter.MergeCandidates`).

Piège rencontré et corrigé : la priorité initiale du signal `network_host` (1) dépassait par erreur celle d'un signal non répertorié dans la table de priorités (`http_service`, valeur par défaut 0), ce qui pouvait faire gagner le signal de base à la fusion et écraser le port/la source réels d'une vraie détection. Priorité finale : `-10`, strictement sous toute source répertoriée ou non.

- ✅ Un hôte identifié sans aucun signal d'enrichissement reste désormais visible (`device_unknown`), conformément à l'intention initiale
- ✅ Régression couverte par un test dédié + un test de non-régression sur la priorité de fusion

#### Correction (e) — un port détecté par protocole, pas seulement RTSP/HTTP/ONVIF

Constat : `DiscoveryTechnicalDetails` n'exposait un port détecté que pour RTSP/HTTP/ONVIF (`HttpPortsDetected`/`RtspPortsDetected`/`OnvifPortsDetected`) ; DVRIP, V380 et Tapo KLAP — trois protocoles pourtant sondés en Stage 2 — ne remontaient jamais leur port dans l'UI, alors même que leur détection avait réussi. Chaque nouveau protocole ajouté à la Stage 2 aurait à nouveau nécessité un champ + prédicat dédiés (`IsHttpSignal`, `IsRtspSignal`, `IsOnvifSignal`) au lieu d'être couvert automatiquement.

**Correctif** : remplacement des trois champs par une liste unique `DetectedPortSignal(Protocol, Port)`, alimentée par une table `discoverySource → protocole` (`AssistedCameraDiscoveryService.ProtocolLabelsBySource`) couvrant tous les protocoles enregistrés. Ajouter un futur protocole à la Stage 2 suffit à lui faire remonter son port dans l'enrichissement, sans toucher au DTO ni à l'UI.

Côté UI, l'ADR est aussi allé plus loin sur la séparation enrichissement/interprétation :
- le hostname résolu vit désormais dans l'enrichissement (fait brut), pas dans l'identification ;
- l'interprétation ne répète plus un fait déjà affiché en enrichissement (« Flux détecté » dupliquait « Chemins de flux détectés ») — elle synthétise désormais un verdict (« 1 flux RTSP actif (port X) » / « Aucun flux confirmé ») à partir des faits ;
- le constructeur en interprétation est désormais un contrôle toujours éditable (pas seulement un libellé conditionné à une détection réussie) — c'est le correctif demandé pour pouvoir corriger une détection automatique erronée, y compris pour une caméra pas encore prête (flux non détecté), cas où le formulaire complet restait auparavant caché.

#### Correction (f) — catalogue protocole unique, frontend en pur affichage, bug V380 réel corrigé

Constat : malgré (e), le port V380 ne remontait toujours pas en usage réel. Cause racine, sans rapport avec l'architecture : `ProbeV380EndpointAsync` n'envoyait qu'une requête `NVDEVSEARCH` unicast directe, alors que `V380Client.DiscoverDeviceIdAsync` (déjà en production pour le PTZ) sait que certaines caméras ne répondent qu'à un broadcast de sous-réseau — repli manquant dans la sonde de découverte. **Corrigé** : même repli à deux temps (unicast puis broadcast `.255`) qu'utilise `V380Client`, dupliqué ici pour la même raison qu'en ADR-31 (le pipeline n'a pas d'injection de dépendances pour réutiliser `V380Client` directement). Un bug de sûreté a été introduit puis corrigé au passage : le `try/catch` protégeant la résolution DNS a été perdu en split de méthode, provoquant un crash (`SocketException`) au lieu d'un retour `null` silencieux.

Par ailleurs, retour utilisateur explicite : le frontend ne doit porter **aucune règle** de détection/énumération de protocole — uniquement de l'affichage. Or `ProtocolLabelsBySource` (label par protocole) était dupliqué à l'identique côté backend (`AssistedCameraDiscoveryService`) et frontend (`formatProtocolLabel`), et la logique "DVRIP/V380 sont aussi des sources de flux" était récrite en dur côté frontend dans `formatStreamSummary`.

**Correctif** : nouveau `DiscoveryProtocolCatalog` (`Vyzio.Infrastructure.Services.CameraDiscovery`), unique table `discoverySource → (Protocol, Label, Priority, StreamCapable)` consommée par :
- `AssistedCameraDiscoveryFormatter.GetCandidatePriority` (priorité de fusion) ;
- `AssistedCameraDiscoveryService.GetDetectedPorts` (label + port + `StreamCapable` sur `DetectedPortSignal`).

`DetectedPortSignal` porte désormais `Label` et `StreamCapable` en plus de `Protocol`/`Port` — ces champs traversent le DTO jusqu'au frontend tels quels. Côté UI, l'Enrichissement affiche une table `Port | Protocole` directement depuis `detectedPorts` (aucun switch/mapping de protocole côté frontend), et `formatStreamSummary` (Interprétation) filtre simplement sur `entry.streamCapable` pour choisir le premier flux exploitable, sans jamais nommer un protocole en dur.

Ajouter un nouveau protocole à la Stage 2 ne nécessite désormais qu'une entrée dans `DiscoveryProtocolCatalog` : priorité de fusion, libellé d'affichage et capacité de flux sont dérivés automatiquement partout, frontend inclus.

- ✅ Bug réel V380 (repli broadcast manquant) et bug de sûreté (crash DNS) corrigés
- ✅ Un seul endroit à modifier pour ajouter un protocole (contre le backend dupliqué en 2 endroits + le frontend qui redéfinissait sa propre liste)
- ✅ Le frontend ne connaît plus aucun nom de protocole en dur

#### Correction (g) — enrichissement par balayage de ports (« nmap ») + capacités dérivées du registre

Deux limites subsistaient après (f) : la découverte V380 reposait toujours sur une sonde UDP fragile (invisible en Docker bridge), et l'interprétation portait des drapeaux par capacité en dur (`StreamCapable`, à répéter pour `PtzCapable`…) au lieu de réutiliser le registre de capacités existant. Sur demande utilisateur, refonte de l'enrichissement en deux temps :

**1) Balayage TCP générique (« nmap »).** `DiscoveryPortCatalog` devient l'unique source de vérité port→protocole (RTSP 554, ONVIF 2020, V380 8800, DVRIP 34567 en ports uniques « signal caméra » ; HTTP 80/443/8080 génériques). `AssistedCameraDiscoveryProbePipeline.DiscoverPortScanSignalsAsync` teste chaque port du catalogue en TCP-connect : un port ouvert est un fait. Un port « signal caméra » ouvert émet la raison générique `camera_port_open` → `DetermineQualification` confirme la caméra **sans code par protocole**. Les sondes UDP V380 et handshake DVRIP (dont le seul rôle était la détection de port) sont **supprimées** — V380 est maintenant détecté par 8800 TCP, robuste en bridge. Restent, pour leur valeur ajoutée uniquement : RTSP DESCRIBE (vrai chemin de flux), ONVIF multicast/unicast + fingerprint HTTP (indice constructeur), handshake Tapo KLAP (partage le port 80, indissociable d'un simple HTTP par un scan). La liste des ports balayés est configurable (`DiscoverySettings.PortScanPorts`, défaut = catalogue) pour permettre des tests hermétiques.

**2) Capacités dérivées du registre, `Stream` promue capacité de première classe.** `DetectedPortSignal` redevient un fait pur `(Protocol, Label, Port)` — plus aucun drapeau par capacité. `AssistedCameraDiscoveryService.GetDetectedCapabilities` croise les protocoles réellement détectés sur l'hôte (via le catalogue de ports + les sources de handshake ONVIF/KLAP) avec `ICapabilityProviderRegistry.GetRegisteredProtocols(capability)` — le **même** registre qui pilote la détection de capacités à l'ajout (ADR-22/28). Résultat many-to-many natif : une capacité liste tous ses protocoles détectés (PTZ → ONVIF **et** V380), et un protocole apparaît sous plusieurs capacités (ONVIF sous PTZ **et** Réglages image). Pour que `Stream` passe par le même mécanisme au lieu d'un cas explicite, ajout de `IStreamCapabilityProvider` + `RtspStreamProvider`/`DvripStreamProvider` (déclaratifs — le transport est passé à go2rtc/Frigate, ADR-19) : `GetRegisteredProtocols(Stream)` renvoie désormais `[Rtsp, Dvrip]` comme n'importe quelle autre capacité.

Le DTO transporte `DetectedCapability(Capability, Label, ProtocolLabels)` (libellés localisés côté backend). Le frontend affiche la table `Port | Protocole` et la liste `Capacité → protocoles` telles quelles — zéro nom de protocole ou de capacité en dur.

- ✅ V380 détecté par balayage TCP (8800), robuste là où l'UDP échouait
- ✅ Ajouter un protocole avec port dédié = **une ligne** dans `DiscoveryPortCatalog` (détection, table, confirmation caméra, croisement capacités) ; ajouter une capacité/un protocole de capacité = un provider DI, comme le reste
- ✅ `Stream` est une capacité comme les autres (provider + registre), plus de cas particulier
- ✅ Interprétation many-to-many correcte (plusieurs protocoles par capacité et inversement)
- ⚠️ Tapo KLAP et ONVIF-sur-80 gardent un handshake dédié : partageant le port 80 avec un serveur web générique, un port ouvert seul ne les distingue pas — c'est une limite intrinsèque du scan de ports, pas une entorse au principe

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
    -- Privacy mode (ADR-20)
    privacy_mode_active       INTEGER NOT NULL DEFAULT 0,
    privacy_mode_source       TEXT,   -- "manual" | "schedule" | null
    privacy_vendor_cut        INTEGER NOT NULL DEFAULT 0,
    -- PTZ + stratégie privacy (ADR-21, mis à jour ADR-24)
    ptz_supported             INTEGER NOT NULL DEFAULT 0,
    privacy_mode_strategy     TEXT NOT NULL DEFAULT 'none',  -- "none" | "software_blur" | "ptz_parking" | "hardware"
    -- Protocoles réseau détectés sur la caméra (ADR-24)
    supported_protocols_json  TEXT,                          -- JSON array : ["onvif", "v380", ...]
    created_at                TEXT NOT NULL,
    updated_at                TEXT NOT NULL
    -- Note: remplace detection_preset (retiré, ADR-14)
);

-- Capacités optionnelles (PTZ, vie privée matérielle) découplées de la marque (ADR-22, mis à jour ADR-24)
CREATE TABLE camera_capability_bindings (
    id            TEXT PRIMARY KEY,
    camera_id     TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    capability    TEXT NOT NULL,             -- "ptz" | "hardware_privacy" | "image_settings" (ADR-27)
    protocol      TEXT NOT NULL,             -- "onvif" | "dvrip" | "tapo_klap" | "v380" | "rtsp"
    config_json   TEXT,                      -- params protocole : port, adresse ONVIF, credentials...
    verified      INTEGER NOT NULL DEFAULT 0, -- résultat du dernier test réel, jamais déclaratif
    manually_configured INTEGER NOT NULL DEFAULT 0, -- true = jamais réécrit par SeedAndProbePresetsUseCase (ADR-28)
    verified_at   TEXT,
    last_error    TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE (camera_id, capability)
);
CREATE INDEX idx_capability_bindings_camera ON camera_capability_bindings(camera_id);

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
