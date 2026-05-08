# Vyzio — Software Architecture Document (SAD)

> Mai 2026 — v1.0 — Document vivant

---

## Table des matières

1. [Introduction et périmètre](#1-introduction-et-périmètre)
2. [Contraintes et principes directeurs](#2-contraintes-et-principes-directeurs)
3. [Vue d'ensemble de l'architecture](#3-vue-densemble-de-larchitecture)
4. [Décisions d'architecture (ADR)](#4-décisions-darchitecture-adr)
   - [ADR-01 — Langage principal : Python](#adr-01--langage-principal--python)
   - [ADR-02 — Communication inter-services : bus d'événements interne](#adr-02--communication-inter-services--bus-dévénements-interne)
   - [ADR-03 — Ingestion vidéo : FFmpeg + PyAV](#adr-03--ingestion-vidéo--ffmpeg--pyav)
   - [ADR-04 — Pipeline IA : InsightFace](#adr-04--pipeline-ia--insightface)
   - [ADR-05 — Base de données : SQLite](#adr-05--base-de-données--sqlite)
   - [ADR-06 — API : FastAPI](#adr-06--api--fastapi)
   - [ADR-07 — Dashboard : SvelteKit](#adr-07--dashboard--sveltekit)
   - [ADR-08 — Notifications push : FCM via serveur relay minimal](#adr-08--notifications-push--fcm-via-serveur-relay-minimal)
   - [ADR-09 — Stockage vidéo : fichiers MP4 sur disque local](#adr-09--stockage-vidéo--fichiers-mp4-sur-disque-local)
   - [ADR-10 — Authentification : JWT + bcrypt](#adr-10--authentification--jwt--bcrypt)
5. [Architecture des services](#5-architecture-des-services)
   - [5.1 Camera Service](#51-camera-service)
   - [5.2 Core Engine](#52-core-engine)
   - [5.3 Storage Service](#53-storage-service)
   - [5.4 Notification Service](#54-notification-service)
   - [5.5 API Service](#55-api-service)
   - [5.6 Dashboard Web](#56-dashboard-web)
6. [Modèle de données](#6-modèle-de-données)
7. [Architecture de déploiement](#7-architecture-de-déploiement)
8. [Sécurité](#8-sécurité)
9. [Performances et scalabilité](#9-performances-et-scalabilité)
10. [Risques et mitigations](#10-risques-et-mitigations)

---

## 1. Introduction et périmètre

Ce document décrit les décisions d'architecture du système **Vyzio**, une solution de surveillance domestique local-first. Il justifie chaque choix technique en le comparant aux alternatives, en tenant compte des contraintes spécifiques du projet :

- Exécution sur mini-PC embarqué (ressources limitées)
- Absence de connexion cloud obligatoire
- Public non-technique (installation simple)
- Privacy by design (aucune donnée biométrique ne sort du réseau)
- Deux cibles de déploiement : appliance hardware et self-hosted Docker

### Audience

Ce document est destiné aux ingénieurs contribuant au projet. Il présuppose des connaissances en Python, systèmes distribués, vision par ordinateur et sécurité applicative.

---

## 2. Contraintes et principes directeurs

### 2.1 Contraintes fermes

| # | Contrainte | Source |
|---|---|---|
| C1 | Les données biométriques (embeddings, frames) ne doivent jamais quitter le réseau local | Specs §9.2 |
| C2 | Le système doit fonctionner sans connexion Internet | Specs §6.5 |
| C3 | L'appliance tourne sur un mini-PC (ex. Intel NUC, Raspberry Pi 5) | Specs §2.1 |
| C4 | Installation plug & play sans technicité | Specs §2.1 |
| C5 | Support RTSP, ONVIF, HTTP MJPEG | Specs §3.2 |
| C6 | Reconnaissance faciale < 2s après détection de mouvement (cible) | Specs §4.1 |
| C7 | Pas de dépendance à un service cloud tiers pour les fonctions critiques | Specs §9.2 |

### 2.2 Principes directeurs

- **Local-first** : toute fonctionnalité de surveillance est opérationnelle hors-ligne.
- **Faible couplage** : chaque service peut être arrêté, redémarré, ou remplacé sans impacter les autres, sauf le Core Engine (critique).
- **Cohérence éventuelle** : on privilégie la disponibilité à la cohérence stricte (un événement peut arriver en doublon plutôt que d'être perdu).
- **Minimalisme** : pas de dépendances externes non nécessaires — chaque bibliothèque doit gagner sa place.
- **Observabilité** : les logs structurés (JSON) permettent de diagnostiquer sans accès interactif à la machine.

---

## 3. Vue d'ensemble de l'architecture

### 3.1 Style architectural

Vyzio adopte une **architecture orientée services à déploiement monorepo**, organisée autour d'un **bus d'événements interne** (non réseau, voir ADR-02). Ce n'est ni un monolithe strict, ni des microservices distribués — c'est un **modulith** : des services clairement délimités, qui s'exécutent dans le même processus ou en processus séparés légers selon le profil de déploiement.

Ce choix est motivé par la contrainte C3 (ressources limitées) et C4 (simplicité de déploiement) : un broker réseau externe (Kafka, RabbitMQ) serait disproportionné.

### 3.2 Diagramme de contexte (C4 Level 1)

```
┌────────────────────────────────────────────────────────────┐
│  Réseau local de l'utilisateur                             │
│                                                            │
│  ┌─────────────┐    RTSP/ONVIF    ┌──────────────────────┐ │
│  │  Caméras IP │ ───────────────► │      Vyzio           │ │
│  └─────────────┘                  │    (mini-PC /        │ │
│                                   │     Docker)          │ │
│  ┌─────────────┐    HTTP(S)       │                      │ │
│  │  Navigateur │ ◄──────────────► │  Dashboard + API     │ │
│  └─────────────┘                  └──────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                                           │
                                    FCM (push uniquement,
                                    pas de données visuelles)
                                           │
                              ┌────────────▼────────────┐
                              │  Téléphone (Android/iOS) │
                              └──────────────────────────┘
```

### 3.3 Diagramme des conteneurs (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Vyzio Runtime                                                      │
│                                                                     │
│  ┌──────────────────┐   frames   ┌──────────────────────────────┐  │
│  │  Camera Service  │──────────►│         Core Engine           │  │
│  │  (RTSP/ONVIF/    │           │  ┌──────────────────────────┐ │  │
│  │   MJPEG reader)  │           │  │  Motion Detector         │ │  │
│  └──────────────────┘           │  └────────────┬─────────────┘ │  │
│                                 │               │ si mouvement   │  │
│  ┌──────────────────┐           │  ┌────────────▼─────────────┐ │  │
│  │  Storage Service │◄──────────│  │  Face Detector           │ │  │
│  │  (vidéo + SQLite)│  events   │  │  (RetinaFace)            │ │  │
│  └──────────────────┘           │  └────────────┬─────────────┘ │  │
│                                 │               │ si visage(s)   │  │
│  ┌──────────────────┐           │  ┌────────────▼─────────────┐ │  │
│  │ Notification     │◄──────────│  │  Face Recognizer         │ │  │
│  │ Service          │  events   │  │  (InsightFace embeddings) │ │  │
│  └──────────────────┘           │  └──────────────────────────┘ │  │
│                                 └──────────────────────────────┘  │
│  ┌──────────────────┐                                              │
│  │  API Service     │◄──── HTTP REST ◄──── Dashboard Web (SPA)    │
│  │  (FastAPI)       │                                              │
│  └──────────────────┘                                             │
│                                                                     │
│  ══════════════════════ Bus d'événements interne ════════════════  │
│         (asyncio Queue / Redis Streams selon déploiement)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Décisions d'architecture (ADR)

Chaque ADR suit le format : **Contexte → Options comparées → Décision → Conséquences**.

---

### ADR-01 — Langage principal : Python

#### Contexte

Le Core Engine repose sur des bibliothèques de vision par ordinateur et de machine learning (InsightFace, OpenCV, RetinaFace). Le choix du langage principal conditionne la facilité d'intégration de ces bibliothèques et la vélocité de développement.

#### Options comparées

| Critère | Python 3.11+ | Go | Rust | Node.js |
|---|:---:|:---:|:---:|:---:|
| Écosystème ML/CV | ✅ Excellent (PyTorch, InsightFace, OpenCV) | ⚠️ Limité (bindings C) | ⚠️ Émergent | ❌ Inexistant |
| Performance brute | ⚠️ GIL (contournable async/multiprocess) | ✅ Natif | ✅ Natif | ⚠️ I/O seulement |
| Ressources mémoire | ⚠️ Élevé | ✅ Faible | ✅ Très faible | ⚠️ Moyen |
| Vitesse de dev | ✅ | ⚠️ | ❌ Lent | ✅ |
| Opérabilité sur mini-PC | ✅ (optimisable) | ✅ | ✅ | ⚠️ |
| Maturité bibliothèques vidéo | ✅ | ⚠️ | ⚠️ | ❌ |

#### Décision

**Python 3.11+** pour l'ensemble des services backend.

La contrainte absolue est l'écosystème ML : InsightFace, RetinaFace, PyTorch n'existent pas en dehors de Python avec une maturité suffisante. Écrire des services annexes dans un autre langage (Go pour l'API, par exemple) fragmenterait la stack sans gain net compte tenu de la taille du projet.

Le GIL est contourné en isolant le Core Engine dans **des processus séparés** (`multiprocessing`) plutôt que des threads, ce qui est la pratique standard pour le ML Python.

#### Conséquences

- ✅ Un seul écosystème à maîtriser pour les contributeurs
- ✅ Intégration directe des modèles IA sans FFI
- ⚠️ Consommation mémoire plus élevée → imposer un budget mémoire par service (voir §9)
- ⚠️ GIL → architecture multiprocessus obligatoire pour le Core Engine

---

### ADR-02 — Communication inter-services : bus d'événements interne

#### Contexte

Les services doivent communiquer des événements (frame avec mouvement, visage détecté, événement à stocker, notification à envoyer). Le couplage entre services doit être minimal pour permettre de tester, redémarrer ou remplacer un service indépendamment.

#### Options comparées

| Solution | Complexité opérationnelle | Latence | Persistance | Adapté mini-PC |
|---|:---:|:---:|:---:|:---:|
| **asyncio Queue (in-process)** | ✅ Nulle | ✅ Minimale | ❌ Non | ✅ |
| **Redis Streams** | ⚠️ Faible (+1 process) | ✅ Faible | ✅ Oui | ✅ |
| **RabbitMQ** | ❌ Élevée | ⚠️ Faible | ✅ Oui | ❌ Trop lourd |
| **Kafka** | ❌ Très élevée | ⚠️ Faible | ✅ Oui | ❌ Incompatible |
| **ZeroMQ** | ⚠️ Moyenne | ✅ Très faible | ❌ Non | ✅ |
| **gRPC streaming** | ⚠️ Moyenne | ✅ Faible | ❌ Non | ✅ |

#### Décision

**Architecture à deux niveaux** :

1. **Profil appliance (monolith process)** : `asyncio.Queue` interne — latence nulle, zéro overhead.
2. **Profil Docker Compose (multi-process)** : **Redis Streams** — persistance légère, reconnexion automatique, consommateur unique par groupe.

Redis est déjà une dépendance naturelle pour le cache de sessions API. Son overhead (~30 MB RAM) est acceptable. Les Streams offrent un historique court utile pour rejouer des événements si un service redémarre.

L'interface de publication (`EventBus`) est **abstraite** derrière un protocole commun afin que les services ne sachent pas s'ils communiquent via Queue ou Redis.

```python
# Interface commune — les services ne connaissent que ça
class EventBus(Protocol):
    async def publish(self, topic: str, payload: dict) -> None: ...
    async def subscribe(self, topic: str) -> AsyncIterator[dict]: ...
```

#### Conséquences

- ✅ Faible couplage entre services — chaque service ne connaît que les topics qu'il écoute/publie
- ✅ Testabilité — l'`EventBus` est mockable sans infrastructure
- ✅ Scalabilité progressive — passer de Queue à Redis est transparent pour le code métier
- ⚠️ Redis doit être disponible en mode Docker avant les autres services (health check requis)

---

### ADR-03 — Ingestion vidéo : FFmpeg + PyAV

#### Contexte

Le Camera Service doit lire des flux RTSP, ONVIF (qui est une couche de gestion au-dessus de RTSP) et HTTP MJPEG depuis des caméras IP, décoder les frames, et les transmettre au Core Engine.

#### Options comparées

| Solution | RTSP | MJPEG | H.265 | CPU overhead | Maturité |
|---|:---:|:---:|:---:|:---:|:---:|
| **OpenCV VideoCapture** | ✅ | ✅ | ✅ | ⚠️ (software) | ✅ |
| **PyAV (FFmpeg bindings)** | ✅ | ✅ | ✅ | ✅ (hwaccel) | ✅ |
| **GStreamer (Python)** | ✅ | ✅ | ✅ | ✅ (hwaccel) | ⚠️ Complexe |
| **aiortsp (async RTSP)** | ✅ | ❌ | ⚠️ | ✅ | ⚠️ Immature |

**Pour la découverte ONVIF** :

| Solution | Discovery | PTZ | Auth | Maturité |
|---|:---:|:---:|:---:|:---:|
| **onvif-zeep** | ✅ | ✅ | ✅ | ✅ |
| **python-onvif** | ✅ | ✅ | ⚠️ | ⚠️ |
| **WS-Discovery manuel** | ✅ | ❌ | ❌ | ❌ |

#### Décision

- **PyAV** (wrapping FFmpeg) pour le décodage vidéo : accès aux filtres FFmpeg, support hardware acceleration (VAAPI Linux, VideoToolbox macOS, NVDEC NVIDIA), et décodage séparé du rendu.
- **onvif-zeep** pour la découverte ONVIF et la gestion PTZ.
- Chaque caméra tourne dans son **propre thread asyncio** avec reconnexion automatique (backoff exponentiel, délai max 60s).

La découverte réseau ONVIF utilise WS-Discovery (multicast UDP 239.255.255.250:3702) isolé dans un coroutine dédié pour ne pas bloquer le reste.

#### Conséquences

- ✅ Support natif H.264/H.265 avec décodage hardware sur la plupart des mini-PC Intel
- ✅ Reconnexion automatique robuste
- ⚠️ PyAV nécessite FFmpeg système installé — packagé dans le Dockerfile
- ⚠️ La découverte ONVIF est non fiable sur certains firmwares de caméras — prévoir le fallback URL RTSP manuelle

---

### ADR-04 — Pipeline IA : InsightFace

#### Contexte

Le pipeline IA comprend deux étapes distinctes : la détection faciale (localiser les visages dans une frame) et la reconnaissance faciale (identifier à qui appartient le visage). Les specs imposent RetinaFace pour la détection et InsightFace pour les embeddings.

#### Options comparées — Détection faciale

| Modèle | Précision | Vitesse (CPU) | Vitesse (GPU) | Multi-visage |
|---|:---:|:---:|:---:|:---:|
| **RetinaFace (InsightFace)** | ✅ Excellente | ⚠️ ~200ms/frame | ✅ ~15ms | ✅ |
| **MTCNN** | ✅ Bonne | ⚠️ ~150ms | ✅ ~10ms | ✅ |
| **YuNet (OpenCV)** | ⚠️ Correcte | ✅ ~30ms | N/A | ✅ |
| **MediaPipe Face** | ⚠️ Correcte | ✅ ~20ms | N/A | ✅ |
| **Haar Cascade** | ❌ Faible | ✅ ~10ms | N/A | ✅ |

**YuNet** (OpenCV DNN) est une alternative sérieuse pour les déploiements CPU-only : 30ms/frame vs 200ms pour RetinaFace. Un **profil configurable** permettra de choisir le détecteur selon les ressources disponibles.

#### Options comparées — Reconnaissance (embedding)

| Modèle | Dims | Précision (LFW) | Taille | Backend |
|---|:---:|:---:|:---:|:---:|
| **InsightFace ArcFace R100** | 512 | 99.8% | 248 MB | ONNX/PyTorch |
| **InsightFace ArcFace R50** | 512 | 99.7% | 166 MB | ONNX/PyTorch |
| **FaceNet (facenet-pytorch)** | 128/512 | 99.6% | 89 MB | PyTorch |
| **DeepFace** | variable | 99.5% | variable | Multi-backend |
| **dlib face_recognition** | 128 | 99.4% | 22 MB | dlib |

#### Décision

- **Détection** : RetinaFace via InsightFace (conforme aux specs), avec fallback YuNet pour mode CPU-only configurable.
- **Reconnaissance** : InsightFace ArcFace R50 — compromis optimal taille/précision. R100 est disponible en option pour appliances avec GPU.
- Backend inférence : **ONNX Runtime** (portable, supporte CUDA, CoreML, DirectML, CPU) — évite de dépendre de PyTorch en production.

Le pipeline tourne à **5 fps** (configurable), uniquement sur les frames où un mouvement a été détecté (pré-filtre frame differencing).

#### Estimation ressources (CPU-only, Intel NUC i5)

| Étape | Temps moyen | CPU |
|---|---|---|
| Frame differencing | ~2ms | <5% |
| RetinaFace detection | ~180ms | ~40% |
| ArcFace R50 embedding | ~50ms | ~20% |
| Cosinus similarity (100 profils) | <1ms | <1% |
| **Total pipeline** | **~230ms** | **~60%** |

Avec GPU (NVIDIA) : < 30ms total.

#### Conséquences

- ✅ Pipeline entièrement local, aucune API externe
- ✅ ONNX Runtime portable sur CPU/GPU/Apple Silicon sans recompilation
- ⚠️ 180ms/frame en CPU-only → le mode 5fps est justifié (budget 200ms/frame)
- ⚠️ Premier chargement des modèles : ~3-5s → accepté au démarrage du service

---

### ADR-05 — Base de données : SQLite

#### Contexte

Le système doit stocker : configuration des caméras, profils et embeddings, historique des événements, références aux clips vidéo, logs des notifications. Les besoins en concurrence sont faibles (1 utilisateur, accès majoritairement en lecture).

#### Options comparées

| Critère | SQLite | PostgreSQL | MongoDB | DuckDB |
|---|:---:|:---:|:---:|:---:|
| Zéro configuration | ✅ | ❌ | ❌ | ✅ |
| ACID | ✅ | ✅ | ⚠️ | ✅ |
| Embeddings vectoriels (1:N) | ⚠️ (BLOB ou sqlite-vec) | ⚠️ (pgvector) | ✅ | ⚠️ |
| Concurrence multi-writers | ❌ WAL mode limité | ✅ | ✅ | ❌ |
| Taille en RAM | ✅ Minimale | ❌ ~50 MB | ❌ ~200 MB | ✅ |
| Adapté appliance mini-PC | ✅ | ⚠️ | ❌ | ✅ |
| Sauvegarde simple | ✅ (cp fichier) | ⚠️ pg_dump | ⚠️ mongodump | ✅ |

#### Décision

**SQLite en mode WAL** pour toutes les données relationnelles.

La charge d'écriture est faible : quelques événements par minute au plus. SQLite en WAL supporte les lectures concurrentes. C'est le seul choix raisonnable pour une appliance embarquée sans processus PostgreSQL.

Pour les **embeddings vectoriels** (comparaison cosinus), deux approches :
1. **Stockage dans SQLite** (BLOB) + **comparaison en Python** (numpy) — suffisant pour ≤ 10 000 embeddings.
2. **sqlite-vec** (extension C) si le catalogue dépasse 10 000 profils — peu probable en usage domestique.

Le seuil de 10 000 profils est largement au-dessus des besoins réels (< 100 personnes connues). La comparaison numpy en mémoire est donc la bonne approche.

#### Schéma principal

```sql
-- Résumé des tables (détail en §6)
cameras        -- config + état de connexion
profiles       -- personnes + embeddings (BLOB float32)
events         -- détections avec score de confiance
clips          -- références fichiers vidéo
notifications  -- log envoi
sessions       -- sessions API authentifiées
```

#### Conséquences

- ✅ Aucun processus de base de données à gérer — fichier unique sauvegardable
- ✅ Transactions ACID pour la cohérence des événements
- ✅ Migrations simples avec Alembic
- ⚠️ Pas adapté si le système était multi-tenant ou multi-nœud (hors scope)

---

### ADR-06 — API : FastAPI

#### Contexte

L'API REST sert le dashboard web et permettra des intégrations tierces (webhooks sortants, Home Assistant, etc.). Elle doit être asynchrone pour ne pas bloquer lors des accès à SQLite ou lors de la diffusion des flux vidéo live (SSE/WebSocket).

#### Options comparées

| Critère | FastAPI | Flask | Django REST | aiohttp | Litestar |
|---|:---:|:---:|:---:|:---:|:---:|
| Async natif | ✅ | ❌ | ❌ | ✅ | ✅ |
| Schema validation | ✅ Pydantic | ⚠️ Manuel | ✅ DRF | ⚠️ Manuel | ✅ |
| WebSocket / SSE | ✅ | ⚠️ | ⚠️ | ✅ | ✅ |
| OpenAPI auto-généré | ✅ | ❌ | ⚠️ | ❌ | ✅ |
| Overhead mémoire | ✅ Faible | ✅ Faible | ❌ Élevé | ✅ Faible | ✅ Faible |
| Maturité/communauté | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |

#### Décision

**FastAPI** avec **Uvicorn** (ASGI). L'OpenAPI auto-généré est précieux pour documenter l'API d'intégration (Home Assistant, webhooks). Pydantic v2 assure la validation des entrées et la sérialisation.

**Diffusion vidéo live** : SSE (Server-Sent Events) pour le flux d'événements en temps réel ; WebSocket pour le flux JPEG des caméras live (MJPEG over WebSocket), compatible avec les proxies NGINX sans configuration spéciale.

#### Routes principales (résumé)

```
GET  /api/cameras              Liste des caméras
POST /api/cameras              Ajout d'une caméra
GET  /api/cameras/{id}/stream  WebSocket flux live
GET  /api/profiles             Liste des profils
POST /api/profiles             Création d'un profil
GET  /api/events               Historique (filtrable)
GET  /api/events/stream        SSE flux en temps réel
GET  /api/clips/{id}           Téléchargement clip vidéo
POST /api/auth/login           Authentification
GET  /api/settings             Configuration système
```

#### Conséquences

- ✅ Documentation API interactive (Swagger UI) pour les intégrateurs
- ✅ Async end-to-end : pas de threads bloquants pour les opérations I/O
- ⚠️ Uvicorn en mode single-worker sur appliance (pas de Gunicorn multi-workers) — suffisant pour 1 utilisateur

---

### ADR-07 — Dashboard : SvelteKit

#### Contexte

Le dashboard est une SPA (Single Page Application) accessible depuis un navigateur mobile ou desktop sur le réseau local. Il doit afficher des flux vidéo live, permettre le dessin de zones polygonales sur des images, et rester léger pour un chargement rapide sur réseau local potentiellement limité.

#### Options comparées

| Critère | SvelteKit | React + Vite | Vue 3 + Vite | Angular | HTMX |
|---|:---:|:---:|:---:|:---:|:---:|
| Bundle size | ✅ Très faible | ⚠️ Moyen | ⚠️ Moyen | ❌ Élevé | ✅ Minimal |
| Réactivité fine | ✅ Compile-time | ⚠️ Virtual DOM | ⚠️ Virtual DOM | ⚠️ | ❌ |
| Canvas / WebGL | ✅ | ✅ | ✅ | ✅ | ❌ |
| WebSocket natif | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Complexité | ✅ Faible | ⚠️ Moyenne | ⚠️ Moyenne | ❌ Élevée | ✅ Faible |
| SSR (optionnel) | ✅ | ✅ | ✅ | ✅ | N/A |

**HTMX** a été écarté : le dessin de zones polygonales interactives sur canvas et la gestion des flux vidéo WebSocket requièrent du JavaScript riche que HTMX ne couvre pas.

#### Décision

**SvelteKit** avec rendu SPA (adapter-static). Le build produit des fichiers statiques servis directement par FastAPI (`StaticFiles`), éliminant un serveur Node.js en production.

Pour les zones de détection polygonales : **Konva.js** (canvas 2D) — léger, sans dépendance framework.

#### Conséquences

- ✅ Bundle final < 100 KB gzippé → chargement rapide même sur Wi-Fi domestique lent
- ✅ Pas de processus Node.js en production — serveur statique FastAPI suffit
- ✅ Konva.js couvre tous les besoins de dessin interactif (polygones, drag, redimensionnement)
- ⚠️ SvelteKit moins connu que React → courbe d'apprentissage pour nouveaux contributeurs

---

### ADR-08 — Notifications push : FCM via serveur relay minimal

#### Contexte

Les notifications push vers Android et iOS nécessitent inévitablement un intermédiaire : Apple (APNs) et Google (FCM) exigent un serveur tiers enregistré pour router les messages. C'est la seule sortie réseau non évitable du système.

Une nouvelle exigence (specs §6.6) demande que **la photo de détection soit visible dans la notification depuis l'extérieur du réseau local**. Cela crée une tension directe avec le principe local-first : la photo est stockée sur l'appliance, inaccessible par défaut depuis Internet.

#### Problème : comment rendre une photo locale accessible hors réseau ?

Quatre familles de solutions ont été évaluées :

| Approche | Confidentialité | Complexité | Photo hors-réseau | Dépendance tiers |
|---|:---:|:---:|:---:|:---:|
| **A — Tunnel sécurisé** (Cloudflare Tunnel / Tailscale) | ✅ Photo reste sur appliance | ⚠️ Setup utilisateur | ✅ Via URL signée | ⚠️ Cloudflare/Tailscale |
| **B — VPN utilisateur** (WireGuard) | ✅ | ❌ Complexe | ✅ (réseau étendu) | ✅ Aucune |
| **C — Relay serveur Vyzio** (upload thumbnail temporaire) | ⚠️ Photo transite par nos serveurs | ⚠️ Infra à gérer | ✅ | ❌ Serveur Vyzio requis |
| **D — Embed base64 dans FCM** | ✅ | ✅ | ✅ | ✅ FCM seul |
| **E — Notification sans image** (deep-link uniquement) | ✅ | ✅ | ❌ | ✅ FCM seul |

**Option D — Embed base64 dans FCM** : le payload de données FCM est limité à **4 096 octets**. Un thumbnail JPEG de 400×300 pixels compressé à qualité basse représente ~15–40 KB — bien au-delà de la limite. Cette option est **techniquement impossible** pour des images de qualité utilisable.

**Option C — Relay Vyzio** : viole le principe local-first (images biométriques sur nos serveurs) et crée une dépendance à notre infrastructure. Écarté.

**Option B — VPN** : solution la plus privée mais trop complexe pour le grand public (cible appliance). Maintenue comme option avancée documentée.

**Option A — Tunnel sécurisé** : la photo est servie **directement depuis l'appliance** via une URL HTTPS éphémère. Seule la requête HTTP transite par le tunnel (Cloudflare) — pas de stockage tiers. Le tunnel agit comme un proxy inverse, pas comme un stockage.

#### Décision

**Architecture à deux couches** :

**Couche 1 — Livraison push (toujours actif)** : FCM pour Android/iOS, ntfy en alternative.
- Le payload FCM contient : type d'événement, nom, caméra, timestamp
- Le champ `image` FCM pointe vers une **URL signée HMAC-SHA256** hébergée sur l'appliance (valide 5 min)
- Si aucun accès distant n'est configuré, ce champ est absent → pas d'image dans la notification (dégradation gracieuse)

**Couche 2 — Accès distant (opt-in, specs §6.6)** :

- **Mode Tunnel (recommandé)** : intégration Cloudflare Tunnel ou Tailscale configurée depuis le dashboard. Le Notification Service génère des URLs signées pointant vers le domaine du tunnel.
- **Mode VPN** : l'utilisateur gère son propre VPN, Vyzio ne fait rien de spécial.

**Génération des URLs signées** :

```python
import hmac, hashlib, time, base64

def signed_thumbnail_url(event_id: str, base_url: str, secret: str, ttl: int = 300) -> str:
    expires = int(time.time()) + ttl
    msg = f"{event_id}:{expires}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"{base_url}/api/events/{event_id}/thumbnail?expires={expires}&sig={sig}"
```

La route `/api/events/{id}/thumbnail` vérifie la signature et l'expiration **sans** nécessiter de JWT — ce qui permet à FCM de charger l'image directement sans session authentifiée, tout en restant sécurisé contre la devinette d'URLs.

**ntfy** est proposé en alternative pour les utilisateurs souhaitant zéro dépendance cloud : ntfy peut s'auto-héberger et supporte l'attachment d'images via son protocole.

**Comportement hors-ligne** : une table `notification_queue` dans SQLite stocke les notifications en attente et les envoie dès que la connectivité FCM est rétablie.

#### Conséquences

- ✅ En mode local-only (défaut) : aucune image ne sort du réseau — comportement inchangé
- ✅ En mode tunnel : la photo reste sur l'appliance, Cloudflare ne la stocke pas
- ✅ URL signée avec expiration : pas de fuite d'accès permanente même si l'URL est interceptée
- ✅ Dégradation gracieuse : si le tunnel est arrêté, la notification est envoyée sans image (pas d'erreur)
- ⚠️ Nécessite un projet Firebase enregistré → documenté dans le guide de déploiement
- ⚠️ Cloudflare Tunnel requiert un compte Cloudflare gratuit (ou Tailscale) — documenté comme prérequis opt-in
- ⚠️ La livraison FCM peut être retardée si Internet est intermittent — acceptable (§6.5 des specs)

---

### ADR-09 — Stockage vidéo : fichiers MP4 sur disque local

#### Contexte

Les clips vidéo déclenchés par événements doivent être stockés, consultables depuis le dashboard, et soumis à une politique de rétention automatique.

#### Options comparées

| Approche | Complexité | Compatibilité | Rétention auto | Recherche |
|---|:---:|:---:|:---:|:---:|
| **Fichiers MP4 sur disque** | ✅ Minimale | ✅ Universelle | ✅ cron/scheduler | ⚠️ Via SQLite |
| **MinIO (object storage)** | ❌ Élevée | ✅ | ✅ lifecycle policies | ✅ |
| **Frigate-like segments HLS** | ⚠️ Moyenne | ✅ | ✅ | ⚠️ |
| **Base de données BLOB** | ❌ Inadapté | ✅ | ✅ | ✅ |

#### Décision

**Fichiers MP4 sur volume dédié**, avec convention de nommage `{camera_id}/{YYYY-MM-DD}/{event_id}.mp4`.

- La table `clips` dans SQLite stocke la référence (chemin relatif, durée, taille, event_id)
- La rétention automatique est gérée par un **scheduler asyncio** (APScheduler) qui s'exécute quotidiennement et supprime les fichiers + entrées SQLite au-delà du seuil configuré
- Le serving des clips au dashboard se fait via une route FastAPI `GET /api/clips/{id}` avec streaming HTTP (`StreamingResponse`) et vérification d'authentification

#### Conséquences

- ✅ Aucune dépendance supplémentaire — compatibilité maximale avec tout NAS/disque
- ✅ Les clips sont lisibles directement sur le disque si nécessaire
- ✅ Sauvegarde simple (rsync, cp)
- ⚠️ Pas de déduplication ou compression intelligente — l'espace disque dépend du volume d'événements

---

### ADR-10 — Authentification : JWT + bcrypt

#### Contexte

Le dashboard doit être protégé par mot de passe. L'authentification doit fonctionner hors-ligne (pas de service d'identité externe). Le risque principal est l'accès non autorisé depuis le réseau local.

#### Options comparées

| Approche | Complexité | Hors-ligne | Sécurité |
|---|:---:|:---:|:---:|
| **JWT + bcrypt (stateless)** | ✅ | ✅ | ✅ |
| Sessions côté serveur (SQLite) | ✅ | ✅ | ✅ |
| OAuth2 (Authentik, Keycloak) | ❌ | ⚠️ | ✅ |
| mTLS certificats | ❌ | ✅ | ✅ |
| Pas d'auth (réseau local only) | ✅ | ✅ | ❌ |

#### Décision

**JWT à courte durée de vie (15 min) + refresh token (7 jours, stocké en SQLite)** avec mot de passe hashé bcrypt (cost factor 12).

Le refresh token est **révocable** (table `sessions` en SQLite) : logout = suppression du refresh token. Cela corrige la principale faiblesse des JWT stateless.

TLS est assuré par un **certificat auto-signé** généré au premier démarrage (ou Let's Encrypt via DNS challenge pour les utilisateurs avancés).

#### Conséquences

- ✅ Authentification entièrement locale sans dépendance externe
- ✅ Logout effectif grâce aux refresh tokens révocables
- ✅ Résistant aux attaques brute-force : rate limiting sur `/api/auth/login` (5 tentatives / 15 min)
- ⚠️ Certificat auto-signé → avertissement navigateur au premier accès — documenté dans l'onboarding

---

## 5. Architecture des services

### 5.1 Camera Service

**Responsabilité** : connexion et maintien des flux vidéo de chaque caméra, découverte ONVIF, transmission des frames au Core Engine.

```
CameraService
├── ONVIFDiscovery          # WS-Discovery multicast UDP
├── CameraConnection[]      # Une instance par caméra
│   ├── RTSPReader          # PyAV: lecture + décodage frames
│   ├── ReconnectManager    # Backoff exponentiel (1s → 60s)
│   └── ZoneFilter          # Masquage des zones inactives
└── FramePublisher          # Publie sur EventBus (topic: "frames")
```

**Interface publiée sur le bus** :

```python
# Topic: "frames"
{
  "camera_id": "cam_01",
  "timestamp": 1746700000.123,
  "frame": <numpy array HxWx3>,  # uniquement in-process
  "frame_ref": "shared_mem_key"  # en mode multi-process
}
```

**Isolation** : en mode multi-process, les frames ne sont pas sérialisées dans Redis (trop volumineuses). Un **shared memory buffer** (`multiprocessing.shared_memory`) est utilisé, et le bus transmet uniquement la clé de référence.

---

### 5.2 Core Engine

**Responsabilité** : pipeline de détection et reconnaissance. Composant le plus critique du système.

```
CoreEngine
├── MotionDetector          # Frame differencing par caméra
├── FaceDetector            # RetinaFace / YuNet (configurable)
├── FaceRecognizer          # ArcFace R50 ONNX + cosinus similarity
├── EmbeddingStore          # Cache numpy des embeddings en mémoire
└── EventPublisher          # Publie les événements détectés
```

**États d'un événement de détection** :

```
MOTION_DETECTED
  └─► FACE_DETECTED (si visage)
        ├─► FACE_RECOGNIZED (score > 0.6)  → profil_id + score
        ├─► FACE_UNCERTAIN (0.5 < score ≤ 0.6) → profil candidat
        └─► FACE_UNKNOWN (score < 0.5)    → inconnu
```

**Cache des embeddings** : au démarrage, le Core Engine charge tous les embeddings depuis SQLite dans un tableau numpy en mémoire (< 1 MB pour 100 profils × 512 dims). La comparaison cosinus est une opération matricielle instantanée.

**Isolation GPU** : le worker d'inférence tourne dans un processus dédié pour éviter les conflits de contexte CUDA avec le reste du système.

---

### 5.3 Storage Service

**Responsabilité** : écriture des événements en base, enregistrement des clips vidéo, rétention automatique.

```
StorageService
├── EventWriter             # INSERT events + clips dans SQLite
├── VideoRecorder           # FFmpeg subprocess : enregistre MP4
├── RetentionScheduler      # APScheduler : nettoyage quotidien
└── DiskMonitor             # Alerte si espace < seuil configuré
```

**Enregistrement d'un clip** :
Le VideoRecorder démarre l'enregistrement dès réception d'un événement `FACE_*` ou `MOTION_DETECTED`, en capturant N secondes **avant** l'événement (buffer circulaire de frames en mémoire, configurable, défaut 30s) et N secondes après.

---

### 5.4 Notification Service

**Responsabilité** : envoi des notifications selon les règles configurées.

```
NotificationService
├── RuleEngine              # Évalue si une notif doit être envoyée
│   ├── RateLimiter         # Délai min entre notifs (par caméra/type)
│   ├── ScheduleChecker     # Plages horaires actives
│   └── ProfileBehavior     # Notifier / Silencieux / Ignorer
├── FCMChannel              # Envoi push Android/iOS
├── WebhookChannel          # HTTP POST vers URL externe
├── EmailChannel            # SMTP optionnel
└── NotificationQueue       # SQLite queue pour mode hors-ligne
```

**Découplage** : le Notification Service ne connaît pas le Core Engine. Il consomme uniquement les événements publiés sur le bus. Les règles (plages horaires, profil silencieux) sont évaluées localement.

---

### 5.5 API Service

**Responsabilité** : interface REST pour le dashboard et les intégrateurs, streaming des flux live.

Toutes les routes nécessitent un JWT valide, sauf `/api/auth/login` et le health check `/api/health`.

**Streaming** :
- `GET /api/cameras/{id}/stream` → WebSocket, envoie des frames JPEG à ~10fps (configurable, distinct du pipeline IA)
- `GET /api/events/stream` → SSE, pousse les événements en temps réel

La diffusion des frames live est un flux JPEG indépendant du pipeline IA (lecture directe PyAV, pas de détection) pour ne pas interférer avec la charge de traitement.

---

### 5.6 Dashboard Web

**Responsabilité** : interface utilisateur (SPA SvelteKit, build statique servi par FastAPI).

**Architecture frontend** :

```
Dashboard
├── /                       # Vue Accueil — état système + événements récents
├── /cameras                # Vue Caméras — liste + live
├── /cameras/{id}           # Live plein écran + zones de détection (Konva.js)
├── /people                 # Vue Personnes — profils
├── /history                # Vue Historique — timeline événements
└── /settings               # Vue Paramètres — config globale
```

**Communication** :
- REST classique pour les opérations CRUD
- WebSocket pour les flux vidéo live
- SSE pour les événements en temps réel (EventSource API)

---

## 6. Modèle de données

### 6.1 Schéma SQLite complet

```sql
-- Caméras
CREATE TABLE cameras (
    id          TEXT PRIMARY KEY,        -- UUID
    name        TEXT NOT NULL,
    protocol    TEXT NOT NULL,           -- 'rtsp' | 'onvif' | 'mjpeg'
    url         TEXT NOT NULL,           -- URL de connexion
    username    TEXT,
    password    TEXT,                    -- stocké chiffré (Fernet)
    status      TEXT DEFAULT 'offline',  -- 'online' | 'offline' | 'error'
    fps_ai      INTEGER DEFAULT 5,
    created_at  REAL NOT NULL
);

-- Zones de détection par caméra
CREATE TABLE detection_zones (
    id          TEXT PRIMARY KEY,
    camera_id   TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    polygon     TEXT NOT NULL,           -- JSON [[x,y], ...]
    active      INTEGER DEFAULT 1,
    schedule    TEXT                     -- JSON plages horaires
);

-- Profils de personnes
CREATE TABLE profiles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT DEFAULT 'other',   -- 'household'|'known'|'delivery'|'pet'|'other'
    alert_mode  TEXT DEFAULT 'notify',  -- 'notify'|'silent'|'ignore'
    embedding   BLOB,                   -- numpy float32 array sérialisé
    embedding_count INTEGER DEFAULT 0, -- nb de photos utilisées
    last_seen   REAL,
    created_at  REAL NOT NULL
);

-- Événements de détection
CREATE TABLE events (
    id          TEXT PRIMARY KEY,
    camera_id   TEXT NOT NULL REFERENCES cameras(id),
    event_type  TEXT NOT NULL,           -- 'motion'|'face_known'|'face_unknown'|'face_uncertain'
    profile_id  TEXT REFERENCES profiles(id),
    confidence  REAL,                    -- score cosinus (0-1)
    face_bbox   TEXT,                    -- JSON [x, y, w, h]
    face_image  BLOB,                    -- thumbnail JPEG du visage détecté
    timestamp   REAL NOT NULL,
    clip_id     TEXT REFERENCES clips(id)
);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_camera    ON events(camera_id, timestamp DESC);

-- Clips vidéo
CREATE TABLE clips (
    id          TEXT PRIMARY KEY,
    camera_id   TEXT NOT NULL REFERENCES cameras(id),
    path        TEXT NOT NULL,           -- chemin relatif fichier MP4
    duration    REAL NOT NULL,           -- secondes
    size_bytes  INTEGER,
    created_at  REAL NOT NULL,
    expires_at  REAL                     -- NULL = illimité
);

-- Notifications envoyées
CREATE TABLE notifications (
    id          TEXT PRIMARY KEY,
    event_id    TEXT REFERENCES events(id),
    channel     TEXT NOT NULL,           -- 'fcm'|'webhook'|'email'
    status      TEXT DEFAULT 'pending',  -- 'pending'|'sent'|'failed'
    sent_at     REAL,
    error       TEXT
);

-- Sessions authentifiées (refresh tokens)
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,        -- refresh token (UUID)
    user_hash   TEXT NOT NULL,           -- hash SHA-256 du token pour invalidation rapide
    created_at  REAL NOT NULL,
    expires_at  REAL NOT NULL,
    revoked     INTEGER DEFAULT 0
);

-- Configuration clé-valeur
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL            -- JSON
);
```

### 6.2 Stockage des embeddings

Les embeddings sont stockés en BLOB SQLite (numpy `float32`, 512 dimensions = **2048 bytes par profil**). Pour 1000 profils : ~2 MB, trivial.

Au démarrage du Core Engine :
```python
# Chargement en mémoire (< 1ms pour 100 profils)
rows = db.execute("SELECT id, embedding FROM profiles").fetchall()
profile_ids = [r["id"] for r in rows]
embeddings = np.vstack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
# Shape: (N_profiles, 512)
```

---

## 7. Architecture de déploiement

### 7.1 Profil Appliance (mini-PC)

```
mini-PC (Ubuntu Server 24.04 LTS)
├── systemd units
│   ├── vyzio-core.service      # Core Engine (processus principal)
│   ├── vyzio-api.service       # FastAPI + Uvicorn
│   └── vyzio-redis.service     # Redis (mode Docker ou binaire)
├── /opt/vyzio/
│   ├── venv/                   # Python virtualenv
│   ├── static/                 # Build SvelteKit
│   └── config.yaml             # Configuration utilisateur
└── /var/vyzio/
    ├── db.sqlite               # Base de données
    ├── clips/                  # Clips vidéo MP4
    └── logs/                   # Logs JSON structurés
```

**Démarrage** : `vyzio-core` démarre en premier et expose un health endpoint interne. `vyzio-api` attend ce health check via `ExecStartPre` systemd avant de démarrer.

**Mises à jour OTA** : script systemd-timer qui pull la nouvelle image Docker (ou tarball Python), effectue les migrations Alembic, et redémarre les services. Rollback automatique en cas d'échec des migrations.

### 7.2 Profil Self-hosted (Docker Compose)

```yaml
# docker-compose.yml (résumé)
services:
  core:
    image: vyzio/core
    volumes:
      - ./data/db:/data/db
      - ./data/clips:/data/clips
      - ./config.yaml:/config.yaml
    devices:
      - /dev/dri:/dev/dri  # GPU Intel VAAPI (optionnel)
    depends_on:
      redis: { condition: service_healthy }

  api:
    image: vyzio/api
    ports: ["8443:8443"]  # HTTPS uniquement
    volumes:
      - ./data/db:/data/db
      - ./data/clips:/data/clips
    depends_on:
      core: { condition: service_healthy }

  redis:
    image: redis:7-alpine
    command: redis-server --save "" --maxmemory 64mb
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

**Pas de service frontend séparé** : le build SvelteKit est packagé dans l'image `api` et servi par FastAPI.

---

## 8. Sécurité

### 8.1 Threat model

| Menace | Surface | Mitigation |
|---|---|---|
| Accès non autorisé au dashboard | Réseau local | Authentification JWT + TLS |
| Interception du trafic vidéo | Réseau local | TLS sur toutes les communications |
| Exfiltration de données biométriques | API / stockage | Auth requise sur tous les endpoints, embeddings non exposés via API |
| Brute-force mot de passe | POST /auth/login | Rate limiting 5 req/15min par IP |
| Injection SQL | API | Requêtes paramétrées (SQLAlchemy), pas de SQL dynamique |
| Credentials caméra en clair | Base de données | Chiffrement Fernet (clé dérivée du mot de passe système) |
| Log poisoning | Logs JSON | Sanitisation des champs libres avant logging |
| Accès physique à l'appareil | Disque | Recommandation chiffrement disque (LUKS) dans la doc |

### 8.2 Flux de données sensibles

```
Embeddings facials
  ├─► Stockés UNIQUEMENT dans SQLite (BLOB chiffré avec SQLCipher optionnel)
  ├─► Chargés en RAM uniquement par le Core Engine
  ├─► JAMAIS exposés via l'API (non inclus dans les réponses JSON)
  └─► JAMAIS transmis via FCM

Thumbnails de visages (face_image dans events)
  ├─► Stockés en BLOB SQLite
  ├─► Exposés UNIQUEMENT via API authentifiée (GET /api/events/{id}/face)
  └─► JAMAIS transmis via FCM

Credentials caméras (url, username, password)
  ├─► Stockés chiffrés dans SQLite (Fernet)
  ├─► Exposés via API sans le champ password (masqué "***")
  └─► Utilisés uniquement par le Camera Service
```

### 8.3 TLS

Certificat auto-signé généré au premier démarrage (2048-bit RSA, validité 10 ans). L'utilisateur peut remplacer par un certificat Let's Encrypt. Le hash du certificat est affiché lors de la configuration initiale pour vérification manuelle (Trust On First Use).

---

## 9. Performances et scalabilité

### 9.1 Budget ressources — Appliance mini-PC (Intel NUC i5, 8 GB RAM)

| Service | RAM cible | CPU moyen | CPU pic |
|---|---|---|---|
| Camera Service (4 caméras) | 200 MB | 5% | 15% |
| Core Engine (CPU-only) | 800 MB | 30% | 70% |
| Storage Service | 100 MB | 3% | 10% |
| Notification Service | 50 MB | <1% | 2% |
| API Service | 150 MB | 2% | 10% |
| Redis | 64 MB | <1% | 2% |
| **Total** | **~1.4 GB** | **~41%** | **~109%** (pics non simultanés) |

**Limite pratique** : 4 caméras en analyse IA simultanée en CPU-only. Pour davantage de caméras, le framerate IA est réduit automatiquement ou un GPU est recommandé.

### 9.2 Scalabilité verticale

Le système est conçu pour une appliance unique. La scalabilité horizontale (multi-nœuds) est hors scope. La scalabilité verticale s'opère via :
- Ajout d'un GPU (NVIDIA CUDA ou Intel Arc) → réduction de 90% du temps d'inférence
- Augmentation RAM → davantage de caméras simultanées
- SSD NVMe → amélioration des performances d'écriture des clips

### 9.3 Framerate adaptatif

Le Core Engine surveille le temps de traitement moyen par frame et ajuste dynamiquement le framerate d'analyse (entre 1 et 10 fps) pour rester sous un budget de 200ms/frame. Les paramètres utilisateur sont les valeurs **cibles**, pas des limites strictes.

---

## 10. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|:---:|:---:|---|
| InsightFace — faux positifs (visage inconnu reconnu comme connu) | Moyen | Élevé | Seuil configurable, mode "incertain" à confirmer, enrichissement progressif des embeddings |
| Caméra incompatible ONVIF | Élevé | Faible | Fallback RTSP manuel documenté, liste de compatibilité maintenue |
| Espace disque saturé | Moyen | Moyen | Monitoring disque + alertes dashboard + politique de rétention stricte |
| FCM indisponible | Faible | Moyen | Queue locale, livraison différée, canaux alternatifs (webhook, ntfy) |
| Vulnérabilité dans les dépendances IA (InsightFace, PyAV) | Faible | Élevé | Scan automatique (pip-audit en CI), mises à jour OTA régulières |
| Mini-PC non compatible GPU | Moyen | Moyen | Pipeline CPU-only fonctionnel, framerate adaptatif, YuNet comme détecteur alternatif |
| Perte de données (crash pendant écriture clip) | Faible | Moyen | Écriture atomique (fichier temporaire + rename), WAL SQLite |

---

## Annexe A — Synthèse des choix technologiques

| Composant | Technologie choisie | Principale alternative écartée | Raison principale du choix |
|---|---|---|---|
| Langage backend | Python 3.11 | Go | Écosystème ML incontournable |
| Bus d'événements | asyncio.Queue / Redis Streams | RabbitMQ | Légèreté, zéro configuration |
| Ingestion vidéo | PyAV (FFmpeg) | OpenCV VideoCapture | Hardware acceleration |
| Découverte ONVIF | onvif-zeep | python-onvif | Maturité, support WS-Discovery |
| Détection faciale | RetinaFace (InsightFace) | YuNet | Précision (YuNet = fallback CPU) |
| Reconnaissance faciale | ArcFace R50 (ONNX) | FaceNet | Précision/taille optimale |
| Runtime inférence | ONNX Runtime | PyTorch | Portabilité multi-accélérateur |
| Base de données | SQLite (WAL) | PostgreSQL | Embarqué, zéro administration |
| API REST | FastAPI + Uvicorn | Flask | Async natif, OpenAPI auto |
| Dashboard | SvelteKit | React + Vite | Bundle size, réactivité compile-time |
| Canvas interactif | Konva.js | Fabric.js | Légèreté |
| Notifications push | FCM | Unified Push / ntfy | Support Android + iOS natif |
| Authentification | JWT + bcrypt + refresh tokens | OAuth2 (Keycloak) | Local-first, zéro dépendance |
| Scheduler | APScheduler | Celery Beat | Légèreté, pas de broker |
| TLS | Certificat auto-signé | Let's Encrypt | Fonctionne hors-ligne |

---

## Annexe B — Dépendances Python (principales)

```toml
# pyproject.toml (extrait)
[tool.poetry.dependencies]
python          = "^3.11"
# Vidéo
av              = "^12.0"      # PyAV (FFmpeg bindings)
onvif-zeep      = "^0.2"
# IA
insightface     = "^0.7"
onnxruntime     = "^1.17"      # CPU ; onnxruntime-gpu pour CUDA
numpy           = "^1.26"
# API
fastapi         = "^0.111"
uvicorn         = {extras=["standard"], version="^0.29"}
pydantic        = "^2.7"
# Base de données
sqlalchemy      = "^2.0"       # ORM + migrations via Alembic
aiosqlite       = "^0.20"      # Driver async SQLite
alembic         = "^1.13"
# Notifications
redis           = "^5.0"
apscheduler     = "^3.10"
httpx           = "^0.27"      # Webhook + FCM HTTP v1 API
cryptography    = "^42.0"      # Fernet (chiffrement credentials)
bcrypt          = "^4.1"
python-jose     = "^3.3"       # JWT
```
