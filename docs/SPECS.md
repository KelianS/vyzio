# Vyzio — Spécifications Fonctionnelles (V2)

> Version 0.2 — Mai 2026 — Focus sécurité, grand public non-tech

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
9. [Sécurité et confidentialité](#9-sécurité-et-confidentialité)
10. [MVP - Scope et limites](#10-mvp---scope-et-limites)

---

## 1. Vue d'ensemble du système

### 1.1 Description générale

Vyzio est un système de surveillance domestique **local-first, clef-en-main**, qui ingère des flux vidéo depuis des caméras IP, analyse en temps réel via IA embarquée (reconnaissance faciale), et notifie l'utilisateur d'événements pertinents.

**Philosophie :** Une chose bien = surveillance simple + reconnaisance faciale. Pas 10 features, 1 feature excellente.

### 1.2 Composants principaux

| Composant | Rôle |
|---|---|
| **Camera Service** | Ingestion flux RTSP/ONVIF |
| **Core Engine** | Détection mouvement + reconnaissance faciale IA |
| **Storage Service** | Enregistrement vidéo + métadonnées |
| **Notification Service** | Push mobile (FCM) |
| **API Service** | REST pour dashboard |
| **Dashboard Web** | Interface ultra-simple (5 écrans) |

### 1.3 Flux de données global

```
Caméra IP (RTSP/ONVIF)
  └─► Camera Service
        └─► Motion Detection (frame diff)
              └─► Si mouvement :
                    └─► Face Detection (RetinaFace)
                          ├─► Visage reconnu → Notification "X est arrivé"
                          └─► Visage inconnu → Notification + clip + Dashboard
                                └─► Storage (vidéo + metadata)
                                    └─► Dashboard / API
```

---

## 2. Modes de déploiement

### 2.1 Deployment matériel (PRINCIPAL)

- **Mini-PC** avec stack pré-installée
- **Plug & Play :** branche sur réseau, accède à l'UI depuis navigateur
- **Découverte caméras automatique** via ONVIF
- **Mises à jour OTA** (Over-The-Air)
- **Données 100% locales** sur l'appareil
- **Support français inclus**

### 2.2 Deployment self-hosted (DIY)

- **Docker Compose** sur machine utilisateur (PC, NAS, Linux)
- Installation manuelle, config YAML
- Pour makers / tech-aware
- Données 100% locales, aucune communication sortante par défaut

---

## 3. Intégration caméras

### 3.1 Protocoles supportés (MVP)

| Protocole | Support | Notes |
|---|:---:|---|
| RTSP | ✓ Obligatoire | Ingestion flux vidéo |
| ONVIF | ✓ Obligatoire | Découverte réseau, configuration |
| HTTP MJPEG | ✗ V2 | Compatibilité bas de gamme |

### 3.2 Marques caméras certifiées (MVP)

**Cible V1 : 5-10 marques testées et garanties**

- Marques standards PoE (très répandues)
- Marques standards réseau
- Marques standards WiFi
- Autres sur demande

**Approche :** Certification veut dire "on a testé 10 fois, ça marche, on support"

### 3.3 Ajout d'une caméra (UX)

**Pour grand public (Hub/Cloud) :**
1. Dashboard dit "Connecter une caméra?"
2. Scan ONVIF réseau local automatique
3. Utilisateur sélectionne caméra dans liste
4. Dashboard teste la connexion
5. "Bravo! Ça marche. Nommez cette caméra" (ex. "Porte d'entrée")
6. Caméra opérationnelle, surveillance démarre

**Pas de :** URL RTSP manuelle, port custom, codec négociation, etc.

### 3.4 Résolution & framerate

- **Ingestion :** 480p à 2K (adaptée ressources Hub)
- **Analyse IA :** 5 fps par défaut (configurable)
- **Enregistrement :** Full quality du flux source (H.264/H.265)

---

## 4. Pipeline de détection et reconnaissance

### 4.1 Étapes du pipeline

```
Frame vidéo (résolution native)
  └─► 1. Motion Detection (frame differencing)
        └─► Si mouvement:
              └─► 2. Face Detection (RetinaFace @ 5fps)
                    └─► Si face(s) détecté(s):
                          └─► 3. Face Embedding (InsightFace)
                                └─► 4. Vector search (cosinus distance)
                                      ├─► Score > 0.6 → Match! Profil identifié
                                      └─► Score < 0.6 → Visage inconnu
                                            └─► Notification + clip + Dashboard
```

### 4.2 Détection de mouvement

- **Algorithme :** Frame differencing (léger CPU)
- **Sensibilité :** Configurable par zone
- **Rôle :** Pré-filtre avant IA (évite overload)

### 4.3 Détection faciale

- **Modèle :** RetinaFace (via InsightFace)
- **Seuil confiance :** 0.85 (configurable)
- **Multi-face :** Support plusieurs visages par frame
- **GPU :** Support optionnel NVIDIA (CUDA) / Apple Silicon (MPS), fallback CPU

### 4.4 Reconnaissance faciale

- **Embedding :** 512 dims (InsightFace)
- **Comparaison :** Cosinus distance vs profils stockés
- **Seuil reconnaissance :** 0.60 (configurable)
- **Incertitude :** Score proche seuil = "uncertain", user peut confirmer

---

## 5. Gestion des profils

### 5.1 Un profil = une personne

Chaque profil contient :
- **Nom** (obligatoire) — "Alice", "Livreur", "Chat", etc.
- **Photos** (1+ minimum) — user upload via dashboard
- **Embeddings** (calculés) — stockés en DB, pas les photos brutes
- **Catégorie** — Foyer / Connu / Livraison / Animaux / Autre
- **Alerte associée** — Notifier / Silencieux / Ignorer

### 5.2 Création d'un profil (UX pour non-tech)

1. Dashboard : "Ajouter une personne?"
2. User upload 1-3 photos (facile format: JPG/PNG)
3. Vyzio valide qu'il y a UNE face claire par photo
4. Si OK : "Nommez cette personne"
5. Profil actif immédiatement

### 5.3 Amélioration continue

- User peut "confirmer" une reconnaissance depuis notification
- Confirmations optionnelles enrichissent les embeddings du profil
- Feedback utilisateur = amélioration over time

---

## 6. Système de notifications

### 6.1 Types d'événements notifiés

| Événement | Contenu notification |
|---|---|
| **Personne connue** | Nom + photo clip + caméra + timestamp |
| **Visage inconnu** | "Visage inconnu" + photo + caméra + timestamp |
| **Mouvement seul** | "Mouvement détecté" + caméra (optionnel) |
| **Perte de flux** | Alerte technique "Caméra X inaccessible" |
| **Retour en ligne** | "Caméra X de nouveau disponible" |

### 6.2 Canaux

- **Push mobile** (prioritaire) — FCM (Firebase Cloud Messaging)
  - Hub/DIY : notifications via serveur Vyzio pour livraison FCM seulement (pas image)
  - Images restent locales, accessible via lien deep-link dashboard
- **Webhook** — Pour intégrations (Home Assistant, n8n, etc.)
- **Email** — Optionnel, configurable

### 6.3 Règles anti-spam

- **Délai minimum** entre deux notifications même type même caméra : 30s (configurable)
- **Plages horaires** : Possibilité désactiver notif sur plages (ex. 22h-8h)
- **Par profil** : Chaque personne peut avoir alerte différente
- **Mode "Ne pas déranger"** : Suspension globale notif

### 6.4 Offline

- Si Internet down : événements queued localement
- Notifications envoyées dès reconnexion
- Surveillance locale continue sans interruption

---

## 7. Stockage et rétention

### 7.1 Base de données

- **Unique DB:** SQLite pour DIY/Hub, PostgreSQL pour Cloud
- Schéma simplifié pour MVP :
  - `cameras` — configuration caméras
  - `profiles` — personnes + embeddings
  - `events` — historique détections
  - `clips` — références fichiers vidéo
  - `notifications` — log notifications envoyées

### 7.2 Enregistrements vidéo

- **Format :** MP4 H.264 (compatibilité max)
- **Déclenchement :** Sur événement (motion / face)
- **Durée clip :** 30s avant + 30s après (configurable)
- **Enregistrement continu** optionnel (consomme beaucoup)
- **Stockage :** Volume Docker dédié

### 7.3 Politique de rétention

- **Hub :** Configurable par utilisateur (ex. "Garder 30 jours")
- **Cloud :** Selon plan (7/30/90 jours)
- **Auto-suppression :** Après seuil, vidéos anciennes supprimées

---

## 8. Dashboard de gestion

### 8.1 Principes de design

**Pour NON-TECH = ultra-simple = 5 écrans majeurs**

1. **Accueil** — Statut système, derniers événements
2. **Caméras** — Liste caméras, flux live, zones
3. **Personnes** — Profils + photos
4. **Historique** — Timeline événements avec clips
5. **Paramètres** — Notifications, caméras, réseau

### 8.2 Écran 1 : Accueil

- **État système :** "Tout va bien" ou "⚠️ Caméra X inaccessible"
- **Événements d'aujourd'hui :** "Alice est arrivée (09:32)" + photo
- **Quick access :** "Voir les visages inconnus"

### 8.3 Écran 2 : Caméras live

- **Liste caméras** (thumbnail live)
- **Click sur caméra :** Live + zones de détection
- **Zones :** Rectangles dessinables sur image

### 8.4 Écran 3 : Profils

- **Liste personnes** (photo + nom + dernier vu)
- **Edit profil :** Upload photos, nom, catégorie
- **Delete profil**

### 8.5 Écran 4 : Historique

- **Timeline :** Événements par jour
- **Click événement :** Clip vidéo + face détecté
- **Filter :** Par personne, par caméra

### 8.6 Écran 5 : Paramètres

- **Notifications :** On/off par type + sensibilité
- **Caméras :** Ajouter, retirer, tester
- **Réseau/DNS :** Basics pour non-tech
- **Backup :** Export simples (settings, pas vidéos)

---

## 9. Sécurité et confidentialité

### 9.1 Principes

- **Local-first :** Données jamais quittent l'appareil sauf utilisateur l'autorise
- **Chiffrement :** TLS pour toute communication (DIY)
- **Auth simple :** Code PIN / password (pas OAuth)

### 9.2 Hub (local)

- Réseau local seulement (pas port 80 ouvert internet)
- Accès via IP locale ou DNS local (.local)
- Auth : code PIN 4-6 chiffres

### 9.3 Cloud

- TLS 1.3 chiffrage flux
- Données stockées chiffrées (AES-256)
- Pas de clé centrale = chiffrement côté user
- RGPD compliance : droit à l'oubli, export data

### 9.4 Pas dans MVP

- ❌ OAuth / Google / Facebook login
- ❌ Cloud storage optionnel
- ❌ Partage vidéos publiques
- ❌ Export API (V2)

---

## 10. MVP - Scope et limites

### 10.1 MVP = V1 objectif

**What's in :**
✓ 1-10 caméras max par utilisateur  
✓ 5-10 profils max  
✓ 5 écrans dashboard  
✓ Reconnaissance faciale + notifications  
✓ Stockage vidéo local (7-30 jours)  
✓ Push mobile (FCM)  
✓ Support 5-10 marques caméras  

**What's NOT in :**
✗ Home Assistant intégration  
✗ Jellyfin  
✗ PTZ (pan/tilt/zoom) caméras  
✗ Détection d'objets (person/car/animal)  
✗ Détection intrusion avancée  
✗ Machine learning training  
✗ API B2B  
✗ Multi-user / accounts  
✗ Mobile app native  

### 10.2 Limites acceptées pour V1

- **Hardware Hub :** Intel N100/N150 seulement (pas ARM Raspberry Pi pour V1)
- **Caméras :** RTSP/ONVIF seulement, pas proprietary APIs
- **Résilience :** Internet down = local ok, cloud = down
- **Scalabilité :** Single-user local setup, pas multi-tenancy DIY
- **Support caméras :** 5-10 marques certified, autres "best effort"

### 10.3 Quand on veut plus = V2

- Jellyfin intégration (for media)
- Home Assistant (for home automation)
- Mobile app native
- Multi-caméra scaling (>10)
- PTZ support
- Et cetera

---

## Annexe: Roadmap technique

### M0-M3 : Développement core
- Frigate intégration + wrapper
- Face detection/recognition (InsightFace)
- DB schema, API skeleton
- Dashboard base (5 écrans)

### M3-M4 : UX & Bêta
- Polir UX pour non-tech (itérations)
- Support pour bêta users
- Bug fixes, perf tuning

### M4-M6 : MVP public
- Derniers bug fixes
- DIY repo public
- Hub production ready
- Cloud beta launch
