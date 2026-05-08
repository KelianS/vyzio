# Vyzio — Spécifications Fonctionnelles

> Mai 2026 — Document vivant

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

---

## 1. Vue d'ensemble du système

### 1.1 Description générale

Un système de surveillance domestique **local-first, clef-en-main**, qui ingère des flux vidéo depuis des caméras IP, analyse en temps réel via IA embarquée (reconnaissance faciale), et notifie l'utilisateur d'événements pertinents — sans que les données ne quittent son réseau.

### 1.2 Composants principaux

| Composant | Rôle |
|---|---|
| **Camera Service** | Ingestion flux RTSP/ONVIF |
| **Core Engine** | Détection mouvement + reconnaissance faciale IA |
| **Storage Service** | Enregistrement vidéo + métadonnées |
| **Notification Service** | Push mobile, webhook, email |
| **API Service** | REST pour dashboard et intégrations |
| **Dashboard Web** | Interface de gestion utilisateur |

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

### 2.1 Appliance matérielle (principal)

- Mini-PC avec stack pré-installée, livré prêt à l'emploi
- Plug & Play : brancher sur le réseau suffit, accès au dashboard depuis navigateur
- Découverte caméras automatique via ONVIF
- Mises à jour Over-The-Air (OTA) automatiques
- Toutes les données restent 100 % locales sur l'appareil

### 2.2 Self-hosted (open source)

- Déploiement via Docker Compose sur la machine de l'utilisateur (PC, NAS, serveur Linux)
- Configuration via fichier YAML et dashboard
- Toutes les données restent 100 % locales, aucune communication sortante par défaut

---

## 3. Intégration caméras

### 3.1 User Stories

> **En tant qu'utilisateur**, je veux que Vyzio découvre automatiquement mes caméras sur le réseau, afin de ne pas avoir à chercher des adresses IP ou configurer des ports.

> **En tant qu'utilisateur**, je veux pouvoir nommer chaque caméra (ex. "Porte d'entrée", "Jardin"), afin de savoir d'où vient une alerte sans ambiguïté.

> **En tant qu'utilisateur**, je veux définir des zones de détection sur l'image de chaque caméra, afin d'ignorer les zones non pertinentes (route, arbre, etc.).

> **En tant qu'utilisateur**, je veux que Vyzio se reconnecte automatiquement à une caméra qui tombe, afin que la surveillance ne soit pas interrompue sans que je le sache.

> **En tant qu'utilisateur**, je veux voir un aperçu en direct de chaque caméra depuis le dashboard, afin de vérifier à tout moment que tout fonctionne.

### 3.2 Protocoles supportés

| Protocole | Support | Notes |
|---|:---:|---|
| RTSP | ✓ | Ingestion du flux vidéo |
| ONVIF | ✓ | Découverte réseau automatique, PTZ |
| HTTP MJPEG | ✓ | Compatibilité caméras bas de gamme |

### 3.3 Flux de connexion d'une caméra

1. Dashboard propose "Connecter une caméra"
2. Scan ONVIF automatique sur le réseau local
3. L'utilisateur sélectionne sa caméra dans la liste détectée
4. Vyzio teste la connexion et affiche un aperçu
5. L'utilisateur nomme la caméra et valide
6. La surveillance démarre immédiatement

Si la caméra n'est pas détectée automatiquement, l'utilisateur peut saisir l'URL RTSP manuellement.

### 3.4 Zones de détection

- Zones polygonales dessinables sur l'image de chaque caméra
- La détection (mouvement, visage) n'est déclenchée qu'à l'intérieur des zones actives
- Plusieurs zones par caméra, nommables indépendamment
- Chaque zone peut avoir des plages horaires d'activation différentes

### 3.5 Gestion des flux

- Reconnexion automatique en cas de perte de flux (backoff exponentiel)
- Support H.264 et H.265
- Résolution : 480p à 4K selon ressources disponibles
- Framerate analyse IA configurable (défaut : 5 fps)

---

## 4. Pipeline de détection et reconnaissance

### 4.1 User Stories

> **En tant qu'utilisateur**, je veux être notifié immédiatement quand une personne que je connais est détectée, avec son nom, afin de savoir qui est arrivé.

> **En tant qu'utilisateur**, je veux être alerté quand un visage inconnu est détecté, afin de pouvoir réagir rapidement.

> **En tant qu'utilisateur**, je veux que le système ne me notifie pas pour chaque mouvement sans visage (feuilles, voiture, animal), afin de ne pas être submergé d'alertes inutiles.

> **En tant qu'utilisateur**, je veux pouvoir confirmer ou corriger une reconnaissance depuis la notification, afin d'améliorer la précision au fil du temps.

### 4.2 Étapes du pipeline

```
Frame vidéo
  └─► 1. Détection de mouvement (frame differencing)
        └─► Si mouvement :
              └─► 2. Détection de visages (RetinaFace @ 5fps)
                    └─► Si visage(s) :
                          └─► 3. Extraction embedding (InsightFace, 512 dims)
                                └─► 4. Comparaison cosinus vs profils en base
                                      ├─► Score > 0.6 → Profil identifié
                                      └─► Score < 0.6 → Visage inconnu
```

### 4.3 Détection de mouvement

- Algorithme : frame differencing (léger CPU)
- Sensibilité configurable par zone
- Sert de pré-filtre avant analyse IA

### 4.4 Détection faciale

- Modèle : RetinaFace via InsightFace
- Seuil de confiance : 0.85 (configurable)
- Plusieurs visages détectables par frame
- Accélération GPU : NVIDIA CUDA (optionnel), Apple Silicon MPS (optionnel), fallback CPU

### 4.5 Reconnaissance faciale

- Embedding : 512 dimensions (InsightFace)
- Comparaison : distance cosinus vs embeddings des profils
- Seuil de reconnaissance : 0.60 (configurable)
- Score proche du seuil : événement marqué "incertain", l'utilisateur peut confirmer depuis la notification

---

## 5. Gestion des profils

### 5.1 User Stories

> **En tant qu'utilisateur**, je veux ajouter une personne en uploadant simplement sa photo, afin que Vyzio la reconnaisse dès son prochain passage.

> **En tant qu'utilisateur**, je veux choisir le comportement d'alerte pour chaque personne (notifier, silencieux, ignorer), afin d'adapter les alertes à mon foyer.

> **En tant qu'utilisateur**, je veux voir la dernière apparition de chaque personne connue dans la liste des profils, afin de savoir qui est passé récemment.

> **En tant qu'utilisateur**, je veux supprimer un profil et que toutes ses données associées disparaissent, afin de respecter la vie privée de la personne.

### 5.2 Structure d'un profil

Chaque profil contient :
- **Nom** (obligatoire)
- **Photos de référence** (1 minimum, plusieurs recommandées)
- **Embeddings** calculés et stockés (les photos brutes ne sont pas conservées après calcul)
- **Catégorie** : Foyer / Connu / Livraison / Animaux / Autre
- **Comportement d'alerte** : Notifier / Silencieux / Ignorer

### 5.3 Création d'un profil

1. L'utilisateur clique sur "Ajouter une personne"
2. Upload d'une ou plusieurs photos (JPG/PNG)
3. Vyzio valide que chaque photo contient exactement un visage visible
4. Les embeddings sont calculés
5. L'utilisateur nomme le profil et choisit la catégorie
6. Le profil est actif immédiatement

### 5.4 Amélioration continue

- Depuis une notification, l'utilisateur peut confirmer ou corriger une reconnaissance
- Les confirmations enrichissent les embeddings du profil (opt-in)

---

## 6. Système de notifications

### 6.1 User Stories

> **En tant qu'utilisateur**, je veux recevoir une notification push sur mon téléphone avec la photo et le nom de la personne détectée, afin de savoir immédiatement qui est à ma porte.

> **En tant qu'utilisateur**, je veux voir la photo de la détection directement dans ma notification, même lorsque je suis hors de chez moi (hors réseau local), afin de pouvoir réagir immédiatement sans devoir me connecter au dashboard.

> **En tant qu'utilisateur**, je veux pouvoir désactiver les notifications la nuit, afin de ne pas être réveillé par des alertes de personnes connues.

> **En tant qu'utilisateur**, je veux être alerté si une caméra devient inaccessible, afin de détecter une coupure réseau ou une tentative de sabotage.

> **En tant qu'utilisateur**, je veux que les notifications continuent d'arriver même si je n'ai pas le dashboard ouvert, afin d'être alerté en temps réel où que je sois.

### 6.2 Types d'événements

| Événement | Contenu de la notification |
|---|---|
| Personne connue détectée | Nom + photo du clip + caméra + timestamp |
| Visage inconnu détecté | "Visage inconnu" + photo + caméra + timestamp |
| Mouvement seul (sans visage) | "Mouvement détecté" + caméra (configurable) |
| Perte de flux caméra | "Caméra X inaccessible" |
| Retour en ligne | "Caméra X de nouveau disponible" |

### 6.3 Canaux de notification

- **Push mobile** (prioritaire) — FCM (Firebase Cloud Messaging) pour Android et iOS
  - Les notifications push transitent via les serveurs FCM pour la livraison uniquement
  - La photo de détection (thumbnail du visage, JPEG redimensionné) est incluse dans la notification
  - Deux modes selon la configuration d'accès distant (voir §6.6) :
    - **Mode local-only** : deep-link vers le dashboard, photo visible uniquement sur le réseau local
    - **Mode accès distant activé** : URL signée éphémère (TTL 5 min) pointant vers l'appliance exposée via tunnel sécurisé
- **Webhook** — Pour intégrations tierces (Home Assistant, n8n, Zapier, etc.)
- **Email** — Optionnel, configurable

### 6.4 Règles de notification

- Délai minimum configurable entre deux notifications du même type sur la même caméra (défaut : 30s)
- Plages horaires d'activation par profil et par type d'événement
- Mode "Ne pas déranger" : suspension globale des notifications
- Chaque profil peut avoir un comportement d'alerte indépendant

### 6.5 Comportement hors ligne

- Si Internet est indisponible, les événements sont mis en file locale
- Les notifications sont envoyées dès que la connexion est rétablie
- La surveillance locale continue sans interruption

### 6.6 Accès distant aux photos de détection

Par défaut, le système est 100 % local. L'accès aux photos hors réseau local est une fonctionnalité **opt-in** qui nécessite une configuration explicite de l'utilisateur.

**Deux mécanismes supportés :**

**Option A — Tunnel sécurisé (recommandé)**
- L'utilisateur configure un tunnel Cloudflare Tunnel ou Tailscale depuis le dashboard
- L'appliance devient accessible depuis Internet via une URL HTTPS dédiée (ex. `https://vyzio-xxxx.trycloudflare.com`)
- La photo est servie directement depuis l'appliance via une **URL signée éphémère** (token HMAC, TTL 5 minutes)
- La photo ne transite jamais par un serveur tiers — seule la requête HTTP passe par le tunnel
- Aucun stockage externe : la photo reste sur l'appliance

**Option B — VPN (auto-hébergé)**
- L'utilisateur gère son propre VPN (WireGuard, OpenVPN) pour accéder au réseau local à distance
- Vyzio n'a pas de dépendance supplémentaire — le dashboard local reste accessible normalement via le VPN
- Configuration entièrement à la charge de l'utilisateur

**Contraintes communes aux deux options :**
- La photo transmise dans la notification est un **thumbnail** JPEG ≤ 100 KB (visage + contexte, résolution 400×300 max)
- L'URL de la photo expire automatiquement après 5 minutes — passé ce délai, la photo reste consultable uniquement depuis le dashboard
- L'accès distant ne concerne que les thumbnails d'événements, pas les clips vidéo ni les flux live
- La désactivation du tunnel/VPN remet le système en mode local-only sans perte de données

---

## 7. Stockage et rétention

### 7.1 User Stories

> **En tant qu'utilisateur**, je veux choisir combien de jours mes enregistrements sont conservés, afin de gérer l'espace disque selon mes besoins.

> **En tant qu'utilisateur**, je veux que les anciennes vidéos soient supprimées automatiquement passé le délai configuré, afin de ne pas gérer manuellement l'espace.

> **En tant qu'utilisateur**, je veux pouvoir télécharger un clip depuis l'historique, afin de le conserver ou le partager si nécessaire.

### 7.2 Base de données

- SQLite (appliance / DIY)
- Schéma :
  - `cameras` — configuration et état des caméras
  - `profiles` — personnes + embeddings
  - `events` — historique des détections
  - `clips` — références aux fichiers vidéo
  - `notifications` — log des notifications envoyées

### 7.3 Enregistrements vidéo

- Format : MP4 H.264 (compatibilité maximale)
- Déclenchement sur événement (mouvement / visage)
- Durée du clip : configurable (défaut : 30s avant + 30s après l'événement)
- Enregistrement continu : optionnel
- Stockage sur volume local dédié

### 7.4 Politique de rétention

- Durée configurable par l'utilisateur (ex. 7 jours, 30 jours, illimité)
- Suppression automatique des clips au-delà du seuil
- Alerte dashboard si l'espace disque est insuffisant

---

## 8. Dashboard de gestion

### 8.1 User Stories

> **En tant qu'utilisateur**, je veux voir en un coup d'œil si toutes mes caméras fonctionnent, afin d'être rassuré que le système surveille bien.

> **En tant qu'utilisateur**, je veux voir les derniers événements dès l'ouverture du dashboard, afin d'avoir un résumé immédiat de ce qui s'est passé.

> **En tant qu'utilisateur**, je veux visionner le clip vidéo associé à chaque événement en un clic, afin de voir exactement ce qui s'est passé.

> **En tant qu'utilisateur**, je veux gérer mes caméras et profils depuis la même interface, sans avoir à passer par un fichier de configuration.

> **En tant qu'utilisateur**, je veux accéder au dashboard depuis mon téléphone ou PC via un navigateur, sans avoir à installer une application.

### 8.2 Structure du dashboard (5 vues)

**Vue 1 — Accueil**
- État global du système : "Tout fonctionne" ou liste des alertes actives
- Flux des événements du jour : "Alice est arrivée (09:32)", "Visage inconnu (14:17)"
- Accès rapide : "Voir les visages inconnus"

**Vue 2 — Caméras**
- Liste des caméras avec miniature en direct
- Clic sur une caméra : flux live plein écran + zones de détection superposées
- Gestion des zones : dessin de polygones directement sur l'image
- Statut de chaque caméra (connectée / déconnectée / en erreur)

**Vue 3 — Personnes**
- Liste des profils (photo, nom, dernière apparition)
- Création, édition, suppression de profils
- Upload de photos de référence
- Configuration du comportement d'alerte par profil

**Vue 4 — Historique**
- Timeline des événements par jour
- Filtres : par caméra, par personne, par type d'événement
- Clic sur un événement : clip vidéo + visage détecté + heure + caméra
- Téléchargement d'un clip

**Vue 5 — Paramètres**
- Gestion des caméras (ajout, suppression, test de connexion)
- Paramètres des notifications (canaux, règles, plages horaires)
- Politique de rétention vidéo
- Export de configuration

---

## 9. Sécurité et confidentialité

### 9.1 User Stories

> **En tant qu'utilisateur**, je veux que mes images ne quittent jamais mon réseau local sans mon accord explicite, afin d'être certain que personne d'autre n'y a accès.

> **En tant qu'utilisateur**, je veux protéger l'accès au dashboard par un mot de passe, afin qu'un visiteur sur mon réseau ne puisse pas consulter mes enregistrements.

> **En tant qu'utilisateur**, je veux pouvoir supprimer toutes mes données (profils, clips, événements) en un clic, afin de reprendre le contrôle total de mes données.

### 9.2 Principes

- **Local-first** : aucune donnée ne quitte l'appareil sauf si l'utilisateur l'autorise explicitement
- **Pas de compte cloud obligatoire** : le système fonctionne de façon autonome sans inscription
- **Chiffrement des communications** : TLS pour tout accès au dashboard depuis le réseau local
- **Auth** : mot de passe (hash bcrypt) ou code PIN 4-6 chiffres

### 9.3 Accès réseau

- Dashboard accessible uniquement sur le réseau local (IP locale / mDNS `.local`)
- Aucun port ouvert sur Internet par défaut
- Accès distant possible via VPN (configuration à la charge de l'utilisateur)

### 9.4 Données personnelles

- Les embeddings facials sont stockés, pas les photos brutes après calcul
- Suppression d'un profil = suppression de tous ses embeddings et événements associés
- Export des données possible (format JSON) sur demande
