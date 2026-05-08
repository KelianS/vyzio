# Vyzio — Software Architecture Document (SAD)

> Mai 2026 — v2.0 — Document vivant

---

## Table des matières

1. [Introduction et périmètre](#1-introduction-et-périmètre)
2. [Positionnement vis-à-vis de Frigate](#2-positionnement-vis-à-vis-de-frigate)
3. [Contraintes et principes directeurs](#3-contraintes-et-principes-directeurs)
4. [Vue d'ensemble de l'architecture](#4-vue-densemble-de-larchitecture)
5. [Décisions d'architecture (ADR)](#5-décisions-darchitecture-adr)
   - [ADR-01 — S'appuyer sur Frigate plutôt que réimplémenter le pipeline vidéo](#adr-01--sappuyer-sur-frigate-plutôt-que-réimplémenter-le-pipeline-vidéo)
   - [ADR-02 — Langage principal : .NET 10](#adr-02--langage-principal--net-10)
   - [ADR-03 — Worker de reconnaissance faciale : Python isolé](#adr-03--worker-de-reconnaissance-faciale--python-isolé)
   - [ADR-04 — Communication Frigate → Vyzio : MQTT + API REST Frigate](#adr-04--communication-frigate--vyzio--mqtt--api-rest-frigate)
   - [ADR-05 — Communication inter-services Vyzio : MediatR + MQTT](#adr-05--communication-inter-services-vyzio--mediatr--mqtt)
   - [ADR-06 — Base de données : PostgreSQL vs SQLite](#adr-06--base-de-données--postgresql-vs-sqlite)
   - [ADR-07 — API : ASP.NET Core](#adr-07--api--aspnet-core)
   - [ADR-08 — Dashboard : React + TypeScript](#adr-08--dashboard--react--typescript)
   - [ADR-09 — Notifications : Telegram (prioritaire) + FCM + canaux alternatifs](#adr-09--notifications--telegram-prioritaire--fcm--canaux-alternatifs)
   - [ADR-10 — Authentification : JWT + bcrypt](#adr-10--authentification--jwt--bcrypt)
6. [Architecture des services](#6-architecture-des-services)
7. [Modèle de données](#7-modèle-de-données)
8. [Architecture de déploiement](#8-architecture-de-déploiement)
9. [Sécurité](#9-sécurité)
10. [Performances et scalabilité](#10-performances-et-scalabilité)
11. [Risques et mitigations](#11-risques-et-mitigations)

---

## 1. Introduction et périmètre

Ce document décrit les décisions d'architecture du système **Vyzio**, un produit de surveillance domestique local-first destiné à un public non-technicien.

**Philosophie centrale** : ne pas réinventer ce qui existe et fonctionne. Vyzio est une **couche produit au-dessus de Frigate** — il apporte l'expérience utilisateur, la reconnaissance faciale, les profils nommés et les notifications intelligentes. Frigate apporte l'ingestion vidéo, la détection de mouvement et l'enregistrement. L'effort de développement est concentré sur la vraie valeur ajoutée.

### Audience

Ingénieurs contribuant au projet. Prérequis : .NET 10, React/TypeScript, architecture événementielle, notions de machine learning (pour le worker Python).

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

### 2.2 Ce que Frigate ne fait PAS — valeur ajoutée de Vyzio

| Fonctionnalité | Vyzio |
|---|---|
| **Reconnaissance faciale** (qui est cette personne ?) | ✅ Face Recognition Worker |
| **Profils nommés** (Alice, livreur, inconnu) + comportements d'alerte | ✅ Vyzio Core |
| **Notifications push intelligentes** (nom + photo, règles horaires) | ✅ Notification Service |
| **Accès distant aux photos** via tunnel sécurisé | ✅ Vyzio Core |
| **UI grand public** : onboarding guidé, interface mobile-first | ✅ Dashboard React |
| **Packaging all-in-one** : livré prêt à brancher, zéro configuration technique | ✅ Docker Compose / Appliance |
| **Support français** et documentation non-technicienne | ✅ Produit |

### 2.3 Dépendance à Frigate — risques et mitigations

| Risque | Probabilité | Mitigation |
|---|:---:|---|
| Breaking change API Frigate | Faible (API stable v0.12+) | Couche d'abstraction `FrigateAdapter` versionnée |
| Arrêt du projet Frigate | Très faible (communauté active, HA intégration) | Architecture permet de remplacer Frigate par autre backend MQTT/REST |
| Bug Frigate impactant Vyzio | Moyen | Tests d'intégration sur contrat MQTT/REST, pas sur les internals Frigate |

---

## 3. Contraintes et principes directeurs

### 3.1 Contraintes fermes

| # | Contrainte | Source |
|---|---|---|
| C1 | Les données biométriques (embeddings, frames) ne quittent jamais le réseau local | Specs §9.2 |
| C2 | Le système fonctionne sans connexion Internet | Specs §6.5 |
| C3 | Déploiement sur mini-PC (Intel NUC, Raspberry Pi 5, NAS) | Specs §2.1 |
| C4 | Installation plug & play sans technicité | Specs §2.1 |
| C5 | Support RTSP, ONVIF, HTTP MJPEG | Délégué à Frigate |
| C6 | Reconnaissance faciale < 2s après détection de mouvement | Specs §4.1 |
| C7 | Pas de dépendance cloud pour les fonctions critiques | Specs §9.2 |
| C8 | Stack .NET 10 + TypeScript (sauf IA — voir ADR-03) | `.instructions.md` |

### 3.2 Principes directeurs

- **Ne pas réinventer Frigate** : toute fonctionnalité couverte par Frigate est déléguée.
- **Python confiné** : Python est limité à un seul service isolé (Face Recognition Worker), sans accès direct à la base de données ni au bus d'événements principal.
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
│  ┌─────────────────────────────────────────┐                            │
│  │  Frigate  (Python — NON MODIFIÉ)        │                            │
│  │  - Ingestion RTSP/ONVIF/MJPEG           │                            │
│  │  - Détection mouvement + personnes      │                            │
│  │  - Enregistrement clips MP4             │                            │
│  │  - API REST :5000  /  MQTT :1883        │                            │
│  └──────────┬─────────────────┬────────────┘                            │
│             │ MQTT events     │ REST (clips, live HLS)                  │
│             ▼                 ▼                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Vyzio Core  (.NET 10)                                         │     │
│  │                                                                │     │
│  │  ┌──────────────────┐  gRPC  ┌──────────────────────────────┐ │     │
│  │  │  FrigateAdapter  │───────►│  Face Recognition Worker     │ │     │
│  │  │  (MQTT consumer  │◄───────│  (Python 3.12 isolé)         │ │     │
│  │  │  + REST client)  │        │  InsightFace + ONNX Runtime   │ │     │
│  │  └────────┬─────────┘        └──────────────────────────────┘ │     │
│  │           │ MediatR (INotification)                            │     │
│  │           ▼                                                    │     │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐ │     │
│  │  │  Profile Service │  │  Notification   │  │  Storage     │ │     │
│  │  │  (profils,       │  │  Service        │  │  Service     │ │     │
│  │  │   embeddings)    │  │  (FCM, webhook) │  │  (events DB) │ │     │
│  │  └──────────────────┘  └─────────────────┘  └──────────────┘ │     │
│  └──────────────────────────────┬───────────────────────────────┘      │
│                                 │ HTTP REST + WebSocket (SignalR)        │
│  ┌──────────────────────────────▼───────────────────────────────────┐   │
│  │  Vyzio API  (ASP.NET Core — .NET 10)                             │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │ HTTPS                                  │
│  ┌──────────────────────────────▼───────────────────────────────────┐   │
│  │  Vyzio Dashboard  (React 19 + TypeScript — build statique)       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
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
| **Frigate** | ✅ v0.14, actif | ✅ TFLite/OpenVINO/Coral | ✅ | ✅ VAAPI/NVDEC/Coral | ✅ MQTT + REST | MIT |
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
- **System.Numerics.Tensors** pour les opérations SIMD sur les embeddings (comparaison cosinus)
- **Microsoft.ML.OnnxRuntime** disponible si des modèles légers s'avèrent utiles en complément du worker Python

#### Conséquences

- ✅ Stack cohérente : ASP.NET Core + EF Core + SignalR + MediatR dans un seul écosystème
- ✅ NativeAOT → binaires autonomes, pas de runtime installé sur l'appliance
- ✅ arm64 supporté nativement → Raspberry Pi 5, Apple Silicon
- ⚠️ Python reste nécessaire pour InsightFace — strictement confiné (ADR-03)

---

### ADR-03 — Worker de reconnaissance faciale : Python isolé

#### Contexte

La reconnaissance faciale (InsightFace, ArcFace, RetinaFace) repose sur un écosystème Python sans équivalent mature dans d'autres langages. C'est la **seule justification de Python** dans le projet.

#### Pourquoi Python est inévitable ici

| Besoin | Python | .NET | Notes |
|---|:---:|:---:|---|
| InsightFace (pipeline complet) | ✅ Officiel | ❌ | Preprocessing + inférence + postprocessing intégrés |
| ONNX Runtime (inférence seule) | ✅ | ✅ Microsoft | Possible en .NET mais perd le pipeline InsightFace |
| RetinaFace detection | ✅ | ❌ | Modèle ONNX exportable, pipeline non |

**Option étudiée** : exporter les modèles en ONNX et les inférer depuis .NET. Cette approche couvre le calcul d'embedding mais perd le pipeline de preprocessing InsightFace (détection, crop, alignement facial, normalisation). Réimplémenter ce pipeline en C# représente un risque de régression de précision non acceptable pour un produit grand public.

**Python reste, mais strictement isolé :**

```
Face Recognition Worker (Python 3.12)
├── Exposé uniquement en gRPC local (port non publié hors Docker network)
├── Aucun accès à SQLite Vyzio
├── Aucun accès au bus MediatR
├── Interface unique : Recognize(image) → embeddings + bboxes
└── Stateless — pas de persistance locale
```

Le worker est un **microservice de calcul pur**. Toute logique métier (comparer avec les profils, décider connu/inconnu/incertain, persister) reste dans le Core .NET.

#### Transport : gRPC

| Option | Latence locale | Contrat typé | Complexité |
|---|:---:|:---:|:---:|
| **gRPC** | ✅ < 2ms | ✅ Protobuf | ⚠️ Proto à maintenir |
| HTTP/REST (JSON) | ✅ < 5ms | ⚠️ OpenAPI | ✅ Minimal |
| Unix socket | ✅ < 1ms | ❌ | ⚠️ |

**gRPC** retenu : contrat Protobuf typé des deux côtés (.NET + Python), performance optimale, streaming disponible pour batches futurs.

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

- ✅ Python confiné sans accès aux données — surface d'attaque minimale
- ✅ Worker remplaçable sans toucher au Core .NET (contrat gRPC stable)
- ✅ Scalable indépendamment si GPU disponible
- ⚠️ Dépendance Python dans le Docker Compose — documentée, isolée, acceptée

---

### ADR-04 — Communication Frigate → Vyzio : MQTT + API REST Frigate

#### Contexte

Frigate publie nativement ses événements de détection sur MQTT et expose une API REST. Vyzio doit consommer ces événements pour déclencher la reconnaissance faciale.

#### Topics MQTT Frigate utilisés

```
frigate/events            → Création/mise à jour d'une détection (person, car, etc.)
frigate/{camera}/motion   → État du mouvement (true/false)
frigate/stats             → Santé système Frigate
```

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

- **MQTT** (Mosquitto, embarqué dans Frigate) pour les événements temps réel
- **API REST Frigate** pour : thumbnails, clips, configuration caméras, flux live HLS

Le `FrigateAdapter` est la **seule classe du codebase qui connaît Frigate**. Il traduit les événements Frigate en événements du domaine Vyzio et les publie via MediatR. Le reste du Core ignore que Frigate existe.

```csharp
// Seule classe couplée à Frigate
public class FrigateAdapter : IHostedService
{
    // Souscrit MQTT frigate/events
    // Transforme FrigateEvent → PersonDetectedEvent (domaine Vyzio)
    // Publie via IMediator.Publish()
}
```

#### Conséquences

- ✅ Couplage limité à une seule classe — migration vers autre backend vidéo possible
- ✅ MQTT Mosquitto inclus dans Frigate — zéro dépendance supplémentaire
- ⚠️ Format MQTT Frigate peut évoluer — versionner le `FrigateAdapter`

---

### ADR-05 — Communication inter-services Vyzio : MediatR + MQTT

#### Contexte

Les handlers Vyzio (reconnaissance, storage, notification) doivent réagir aux mêmes événements de façon découplée et testable. Trois options ont été sérieusement considérées : MediatR (in-process), MQTT (déjà présent via Frigate) et Redis Streams.

#### Options comparées

| Solution | Complexité | Dépendance infra | Persistance events | Testabilité | Continuité Frigate |
|---|:---:|:---:|:---:|:---:|:---:|
| **MediatR** (in-process) | ✅ Nulle | ✅ Aucune | ❌ Non | ✅ | ❌ |
| **MQTT** (Mosquitto embarqué Frigate) | ✅ Faible | ✅ Déjà présent | ⚠️ QoS 1 | ⚠️ | ✅ |
| **Redis Streams** | ⚠️ +1 process | ❌ | ✅ Oui | ⚠️ | ❌ |
| gRPC streaming inter-services | ⚠️ | ❌ | ❌ | ⚠️ | ❌ |
| System.Threading.Channels | ✅ | ✅ Aucune | ❌ | ✅ | ❌ |

**Analyse MQTT** : Mosquitto est déjà embarqué dans Frigate et tourne sur le réseau Docker interne. Utiliser MQTT pour les événements inter-services Vyzio assure une continuité technologique et permet à des intégrateurs tiers (Home Assistant, n8n) de souscrire aux événements Vyzio sans configuration supplémentaire. MQTT QoS 1 garantit la livraison au moins une fois.

**Analyse Redis Streams** : offre la persistance (replay d'événements), les groupes de consommateurs et l'at-least-once delivery robuste. C'est la solution la plus solide si les services Vyzio deviennent des processus distincts. Overhead : ~30 MB RAM + 1 conteneur.

**Analyse MediatR** : parfait pour un monolith .NET in-process. Zéro overhead, testable sans infrastructure. Limite : si un service crash, les events en vol sont perdus.

#### Décision

**Architecture hybride en deux couches** :

**Couche 1 — In-process (MediatR)** : orchestration synchrone des handlers dans le processus Vyzio Core. Rapide, sans latence réseau, testable unitairement.

**Couche 2 — MQTT (Mosquitto Frigate)** : publication des événements domaine Vyzio sur des topics dédiés, en parallèle de MediatR. Permet l'intégration tierce et la persistance légère.

```
Topics MQTT publiés par Vyzio (en sus des topics Frigate) :
vyzio/events/face_recognized   → { profile, confidence, camera, timestamp }
vyzio/events/face_unknown      → { camera, thumbnail_url, timestamp }
vyzio/events/camera_status     → { camera, status }
```

```csharp
// MediatR pour l'orchestration interne
public record PersonDetectedEvent(string FrigateEventId, string CameraName, byte[] Thumbnail)
    : INotification;

// Handlers en parallèle — chacun testable indépendamment
public class FaceRecognitionHandler : INotificationHandler<PersonDetectedEvent> { ... }
public class StorageHandler         : INotificationHandler<PersonDetectedEvent> { ... }
public class MqttPublisherHandler   : INotificationHandler<PersonDetectedEvent> { ... } // publie sur MQTT
```

**Redis Streams** est documenté comme option de montée en charge si l'architecture évolue vers des services distincts (hors scope v1).

#### Conséquences

- ✅ MediatR : zéro overhead in-process, handlers testables sans infrastructure
- ✅ MQTT : continuité avec Frigate, intégrations tierces (Home Assistant, n8n) sans configuration supplémentaire
- ✅ Mosquitto déjà présent — zéro dépendance additionnelle
- ✅ Topics Vyzio séparés des topics Frigate — pas de collision
- ⚠️ MQTT QoS 1 : livraison at-least-once, pas exactly-once — acceptable pour des notifications

---

### ADR-06 — Base de données : PostgreSQL vs SQLite

#### Contexte

Vyzio stocke : profils + embeddings, événements de reconnaissance, règles de notification, sessions. La préférence exprimée est PostgreSQL, avec SQLite comme option pour les déploiements contraints.

#### Options comparées

| Critère | PostgreSQL + EF Core | SQLite + EF Core | LiteDB |
|---|:---:|:---:|:---:|
| EF Core support officiel | ✅ | ✅ | ❌ |
| Migrations EF Core | ✅ | ✅ | ❌ |
| Concurrence multi-writers | ✅ | ⚠️ WAL (1 writer) | ✅ |
| Robustesse / ACID complet | ✅ | ✅ | ✅ |
| Requêtes avancées / JSON ops | ✅ | ⚠️ | ❌ |
| Empreinte RAM | ⚠️ ~50 MB | ✅ Minimale | ✅ |
| Configuration | ⚠️ Processus dédié | ✅ Aucune | ✅ |
| Sauvegarde | ✅ `pg_dump` / WAL archiving | ✅ `cp fichier` | ✅ |
| Appliance mini-PC (8 GB RAM) | ✅ Acceptable | ✅ Idéal | ✅ |
| Appliance Raspberry Pi (4 GB) | ⚠️ Serré | ✅ | ✅ |

**Pour PostgreSQL** : meilleure robustesse en écriture concurrente, opérateurs JSON natifs (utiles pour les settings et zones polygonales), outils d'administration connus (`pgAdmin`, `psql`), écosystème de sauvegarde mature. C'est la base de référence pour un projet qui évolue.

**Pour SQLite** : zéro administration, fichier unique, idéal pour les déploiements embarqués contraints (Raspberry Pi, NAS). EF Core abstrait les deux de façon transparente — le code métier ne change pas.

#### Décision

**Architecture dual-provider avec EF Core** : le code Vyzio est identique quelle que soit la base. Le provider est configuré via `vyzio.yml` :

```yaml
# vyzio.yml
database:
  provider: postgres          # 'postgres' | 'sqlite'
  connection_string: "Host=localhost;Database=vyzio;Username=vyzio;Password=..."
  # Pour SQLite : connection_string: "Data Source=/data/vyzio.db"
```

**Profil par défaut selon le déploiement** :
- **Appliance hardware** (mini-PC livré) → **PostgreSQL** : ressources suffisantes, robustesse maximale, administration facilitée
- **Self-hosted Docker sur Raspberry Pi / NAS** → **SQLite** : zéro overhead, plug & play
- **Self-hosted Docker sur PC/serveur** → **PostgreSQL** recommandé

PostgreSQL est embarqué dans le Docker Compose via l'image officielle `postgres:17-alpine` (~80 MB image, ~50 MB RAM).

Les embeddings sont stockés en `BYTEA` (PostgreSQL) ou `BLOB` (SQLite) — même approche dans les deux cas : chargement en mémoire au démarrage, comparaison SIMD sans requête SQL.

#### Conséquences

- ✅ EF Core abstrait le provider — le code métier est identique
- ✅ PostgreSQL par défaut sur appliance : robuste, connu, outillé
- ✅ SQLite disponible pour les déploiements contraints sans modification du code
- ✅ Migration SQLite → PostgreSQL possible via `pg_loader` ou export/import EF Core
- ⚠️ PostgreSQL ajoute ~50 MB RAM et un conteneur Docker — acceptable sur mini-PC 8 GB, serré sur Pi 4 4 GB
- ⚠️ Frigate continue d'utiliser sa propre SQLite — les deux bases sont indépendantes

---

### ADR-07 — API : ASP.NET Core

#### Contexte

L'API sert le dashboard React, les webhooks et les intégrations tierces. Elle doit exposer des flux temps réel et proxyfier les ressources Frigate avec authentification.

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
POST   /api/profiles                 → Upload photo → gRPC → embedding
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

#### Décision

**JWT access token (15 min) + refresh token révocable (7 jours, stocké SQLite)** avec bcrypt cost factor 12, implémenté via `Microsoft.AspNetCore.Authentication.JwtBearer`.

- Logout = suppression du refresh token en base → révocation effective
- Rate limiting login : 5 tentatives / 15 min par IP (`AspNetCoreRateLimit`)
- TLS : certificat auto-signé généré au premier démarrage (Trust On First Use)

---

## 6. Architecture des services

### 6.1 Responsabilités

```
Frigate                           → Vidéo brut, détection, clips
FrigateAdapter (.NET)             → Pont Frigate ↔ domaine Vyzio (MQTT consumer)
Face Recognition Worker (Python)  → Calcul embeddings uniquement (gRPC server)
Profile Service (.NET)            → CRUD profils + comparaison cosinus SIMD
Notification Service (.NET)       → Règles + envoi FCM/webhook/email
Storage Service (.NET)            → Persistance événements enrichis (EF Core)
API (ASP.NET Core)                → REST + SignalR + proxy Frigate (auth)
Dashboard (React + TS)            → UI grand public
```

### 6.2 Flux complet : détection → notification

```
1. Frigate détecte une personne
   └─► MQTT: frigate/events { label: "person", thumbnail: "...", camera: "front_door" }

2. FrigateAdapter (.NET)
   └─► Télécharge thumbnail via Frigate REST API
   └─► Publie: IMediator.Publish(new PersonDetectedEvent(...))

3. Handlers MediatR (parallèles) :

   FaceRecognitionHandler
   └─► gRPC → Face Worker → embeddings[]
   └─► Profile Service : cosinus similarity vs embeddings mémoire
   └─► Résultat : { profile: "Alice", confidence: 0.82 } → FACE_RECOGNIZED
   └─► Publie: FaceRecognizedEvent

   StorageHandler
   └─► EF Core INSERT recognition_events (type, profile_id, confidence, thumbnail)

   NotificationHandler (sur FaceRecognizedEvent)
   └─► RuleEngine : Alice → notify, heure active, pas de rate-limit
   └─► Génère URL signée thumbnail (si tunnel configuré)
   └─► FCM : "Alice est arrivée • Porte d'entrée • 09:32"
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
    embedding       BLOB,                            -- float32[512]
    embedding_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at    TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE recognition_events (
    id                TEXT PRIMARY KEY,
    frigate_event_id  TEXT NOT NULL,     -- référence Frigate (pour proxy clips/thumbnails)
    camera_name       TEXT NOT NULL,
    recognition_type  TEXT NOT NULL,     -- face_known|face_unknown|face_uncertain|motion_only
    profile_id        TEXT REFERENCES profiles(id),
    confidence        REAL,
    face_thumbnail    BLOB,              -- JPEG ≤ 100KB, copie locale
    occurred_at       TEXT NOT NULL,
    notified          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_events_occurred ON recognition_events(occurred_at DESC);
CREATE INDEX idx_events_profile  ON recognition_events(profile_id, occurred_at DESC);

CREATE TABLE notifications (
    id            TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL REFERENCES recognition_events(id),
    channel       TEXT NOT NULL,         -- fcm|webhook|email|ntfy
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
      - "127.0.0.1:1883:1883"           # MQTT — local uniquement

  face-worker:
    image: vyzio/face-worker
    expose: ["50051"]                   # gRPC — interne Docker uniquement
    volumes:
      - ./data/models:/models
    deploy:
      resources:
        limits: { memory: 1G }

  vyzio:
    image: vyzio/core
    volumes:
      - ./data/vyzio:/data
      - ./config/vyzio.yml:/config/vyzio.yml
    ports:
      - "8443:8443"                     # HTTPS — seul port exposé utilisateur
    environment:
      FRIGATE_API_URL: http://frigate:5000
      FRIGATE_MQTT_HOST: frigate
      FACE_WORKER_GRPC: http://face-worker:50051
    depends_on:
      frigate: { condition: service_healthy }
      face-worker: { condition: service_started }
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
| Exfiltration embeddings | API Vyzio | Embeddings jamais inclus dans les réponses API |
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
  ├── vyzio ──► frigate:1883    (MQTT)
  └── vyzio ──► face-worker:50051 (gRPC)
```

---

## 10. Performances et scalabilité

### 10.1 Budget ressources — Intel NUC i5, 8 GB RAM

| Conteneur | RAM cible | Notes |
|---|---|---|
| Frigate | 400–800 MB | Variable : nb caméras, modèle IA |
| Face Worker (Python + InsightFace) | 600 MB–1 GB | ArcFace R50 ONNX chargé en mémoire |
| Vyzio Core + API (.NET 10 NativeAOT) | ~150 MB | NativeAOT réduit significativement l'empreinte |
| **Total** | **~1.5 GB** | ~6.5 GB libres |

### 10.2 Latence pipeline reconnaissance (CPU-only)

| Étape | Responsable | Temps estimé |
|---|---|---|
| Détection personne | Frigate TFLite | ~50ms |
| MQTT → gRPC dispatch | FrigateAdapter .NET | ~5ms |
| RetinaFace + ArcFace R50 (ONNX) | Face Worker Python | ~250ms |
| Cosinus similarity 100 profils | Profile Service SIMD | < 1ms |
| FCM push | Notification Service | ~200ms réseau |
| **Total perçu** | | **~500ms** |

Avec **Coral Edge TPU** (Frigate) + **GPU** (Face Worker) : **< 100ms** total.

---

## 11. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|:---:|:---:|---|
| Breaking change API/MQTT Frigate | Faible | Moyen | `FrigateAdapter` versionné, tests contrat MQTT |
| Arrêt projet Frigate | Très faible | Élevé | Architecture découplée — `FrigateAdapter` remplaçable |
| Faux positif reconnaissance faciale | Moyen | Élevé | Seuil configurable, mode "incertain", confirmation depuis notification |
| Caméra incompatible Frigate | Moyen | Faible | Frigate supporte >200 modèles + fallback RTSP manuel |
| Face Worker — dépendance InsightFace | Faible | Élevé | Contrat gRPC stable, worker remplaçable sans toucher Core |
| Espace disque saturé (clips Frigate) | Moyen | Moyen | Politique rétention Frigate configurée par Vyzio + alertes dashboard |
| Performance CPU sans GPU | Moyen | Moyen | ~500ms acceptable, recommandation Coral TPU documentée |

---

## Annexe A — Synthèse des choix technologiques

| Composant | Technologie | Alternative écartée | Raison |
|---|---|---|---|
| Pipeline vidéo | **Frigate** (open source) | Réimplémentation custom | Ne pas réinventer ce qui existe |
| Langage principal | **.NET 10 (C#)** | Rust | Vélocité + écosystème cohérent (ASP.NET, EF Core, SignalR) |
| Worker IA | **Python 3.12** (isolé) | .NET ONNX seul | InsightFace n'existe qu'en Python |
| Transport IA | **gRPC** | HTTP/REST | Contrat typé Protobuf |
| Bus événements interne | **MediatR** + MQTT (Mosquitto Frigate) | Redis Streams | In-process + continuité Frigate |
| Base de données (appliance) | **PostgreSQL 17** | SQLite | Robustesse, outillage |
| Base de données (Pi/NAS) | **SQLite** | PostgreSQL | Zéro overhead embarqué |
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
│   │   ├── Vyzio.Core/            # Domaine, MediatR handlers, services métier
│   │   ├── Vyzio.Api/             # ASP.NET Core Minimal APIs + SignalR
│   │   ├── Vyzio.Infrastructure/  # EF Core, SQLite, FCM, FrigateAdapter
│   │   └── Vyzio.Tests/           # xUnit + Testcontainers
│   │
│   └── face-worker/               # Python 3.12 — gRPC server InsightFace
│       ├── server.py
│       ├── recognizer.py
│       └── pyproject.toml
│
├── dashboard/                     # React 19 + TypeScript
│   ├── src/
│   │   ├── routes/                # Tanstack Router
│   │   ├── components/            # Shadcn/ui + composants métier
│   │   ├── hooks/                 # Tanstack Query
│   │   └── lib/signalr.ts
│   └── vite.config.ts
│
├── proto/
│   └── face_recognition.proto     # Contrat gRPC partagé .NET ↔ Python
│
├── config/
│   ├── frigate.yml.template       # Généré par l'onboarding Vyzio
│   └── vyzio.yml
│
├── docker-compose.yml
├── docker-compose.appliance.yml
└── docs/
    ├── SPECS.md
    ├── SAD.md
    └── BUSINESS_PLAN.md
```
