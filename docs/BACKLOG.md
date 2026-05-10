# Vyzio — Backlog de reprise

> Mai 2026 — plan de remise a plat avant reprise du developpement
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

---

## Objectif de ce backlog

Ce document remplace le backlog d'implementation precedent.

Il sert a remettre le projet sous controle avant d'ecrire de nouvelles fonctionnalites. Le depot contient deja plusieurs scaffolds techniques, mais une partie d'entre eux a ete creee avant consolidation de la strategie produit et de l'architecture cible.

La priorite immediate n'est donc **pas** d'accelerer le delivery. La priorite est de :

1. realigner le depot sur le SAD retenu ;
2. supprimer ou isoler les pistes non retenues par defaut ;
3. definir un ordre d'execution sobre et verifiable ;
4. reviewer ce plan ensemble avant toute nouvelle feature.

---

## Regles de reprise

1. **Pas de nouvelle feature tant que la phase 0 n'est pas closee.**
2. **Frigate reste le moteur de video-surveillance.** Vyzio n'implemente pas ce que Frigate couvre deja correctement.
3. **Le worker Python n'est pas une brique par defaut.** Il reste documente comme option etudiee, pas comme dependance MVP.
4. **Chaque etape doit produire un artefact de validation** : document, test, check runtime ou demonstration reproductible.
5. **Le code existant peut etre supprime ou simplifie** s'il ne sert pas le plan retenu.

---

## Diagnostic de depart

### Constats

- Le backlog precedent etait oriente vers une execution prematuree.
- Le depot contient deja des scaffolds `dashboard`, `face-worker`, `.NET API`, migrations et compose.
- Une partie de ces elements ne correspond plus a la strategie retenue dans le SAD.
- Le risque principal est de continuer a empiler du code sur une base mal cadree.

### Decision operative

La reprise se fait en **4 phases**, avec une **phase 0 bloquante** de cadrage et nettoyage.

---

## Vue d'ensemble

| Phase | Nom | But | Sortie attendue | Statut cible |
|---|---|---|---|---|
| P0 | Reprise en main | Nettoyer, aligner, figer les priorites | Depot coherent + plan valide | Bloquant |
| P1 | Fondations runtime | Stabiliser Frigate + config + persistance minimale | Environnement de base fiable | Ensuite |
| P2 | Integration Vyzio ↔ Frigate | Consommer les evenements Frigate proprement | Contrat d'evenements valide | Ensuite |
| P3 | Experience produit | API metier, notifications, UI simplifiee | Parcours utilisateur MVP | Ensuite |

---

## P0 — Reprise en main

> **Gate absolu** : tant que cette phase n'est pas validee, on ne construit aucune nouvelle fonctionnalite produit.

### US-P0.1 — Revue du depot existant

**En tant que** porteur technique du projet, je veux inventorier ce qui est deja present et ce qui doit etre conserve, afin d'eviter de repartir sur des hypotheses implicites.

**Taches :**
- [ ] Lister les composants presents dans le depot : API, infrastructure, tests, dashboard, face-worker, proto, compose, config
- [ ] Identifier pour chaque composant son statut : `a conserver`, `a simplifier`, `a retirer`, `a geler`
- [ ] Verifier les ecarts entre code existant et decisions du SAD
- [ ] Consigner les ecarts majeurs dans une section de synthese du backlog ou d'un document de reprise

**Criteres d'acceptation :**
- Le statut de chaque composant existant est explicite
- Les zones de dette ou d'incoherence sont visibles sans lire tout le code

### US-P0.2 — Nettoyage structurel du depot

**En tant que** developpeur, je veux que le depot n'expose plus de dependances contraires au plan retenu, afin que la base de travail soit lisible et honnete.

**Taches :**
- [ ] Retirer du runtime par defaut toute dependance au `face-worker`
- [ ] Supprimer ou neutraliser les morceaux purement scaffoldes qui suggerent une architecture non retenue
- [ ] Conserver uniquement les composants utiles a la trajectoire MVP retenue
- [ ] Garder les alternatives etudiees dans la documentation, pas dans le chemin critique runtime

**Criteres d'acceptation :**
- `docker-compose.yml` reflete l'architecture cible par defaut
- Le chemin d'execution par defaut n'impose aucun composant non retenu
- Le depot est plus simple a comprendre qu'avant nettoyage

### US-P0.3 — Plan d'attaque valide

**En tant que** equipe produit/technique, nous voulons un ordre d'execution revu et assume, afin de reprendre le developpement sans reouvrir le debat a chaque tache.

**Taches :**
- [ ] Reordonner les travaux selon la valeur produit et les dependances reelles
- [ ] Distinguer clairement : `MVP`, `post-MVP`, `options etudiees`
- [ ] Definir les checkpoints de validation par phase
- [ ] Faire une revue humaine du plan avant reprise du code feature

**Criteres d'acceptation :**
- Le backlog peut etre relu seul et servir de reference operative
- Les frontieres MVP / hors MVP sont explicites

### Gate de sortie P0

La phase P0 est terminee seulement si :

- le backlog de reprise est valide ensemble ;
- le runtime par defaut est aligne sur le SAD ;
- aucun composant non retenu n'est encore place au coeur du chemin nominal.

---

## P1 — Fondations runtime

> **But** : obtenir une base d'execution minimale, fiable et conforme au positionnement Frigate-first.

### US-P1.1 — Compose minimal et coherent

**Taches :**
- [ ] Stabiliser `docker-compose.yml` autour des seuls services retenus par defaut
- [ ] Clarifier les volumes, ports et reseaux
- [ ] Documenter ce qui est requis pour un boot local de developpement

**Criteres d'acceptation :**
- `docker compose up` demarre la base retenue sans service optionnel parasite
- Les roles de chaque service sont comprehensibles au premier coup d'oeil

### US-P1.2 — Configuration Frigate maitrisee

**Taches :**
- [ ] Valider un `frigate.yml` minimal compatible version cible
- [ ] Documenter les parties generees par Vyzio et les parties purement Frigate
- [ ] Verifier qu'un flux de test peut etre integre sans bricolage excessif

**Criteres d'acceptation :**
- Frigate demarre avec une config valide
- Les hypotheses de configuration sont documentees

### US-P1.3 — Persistance Vyzio minimale

**Taches :**
- [ ] Garder uniquement les entites et tables utiles au MVP reel
- [ ] Confirmer le provider par defaut et la strategie de migration
- [ ] Verifier que le demarrage API applique les migrations sans logique parasite

**Criteres d'acceptation :**
- La persistence minimale est comprise et testable
- Le schema en place ne simule pas encore des features non construites

---

## P2 — Integration Vyzio vers Frigate

> **But** : construire la premiere vraie couture produit sans derivation prematuree vers des services secondaires.

### US-P2.1 — Contrat d'evenements Frigate entrant

**Taches :**
- [ ] Definir les evenements Frigate reellement consommes par Vyzio
- [ ] Creer un modele d'entree limite aux besoins MVP
- [ ] Ajouter des tests de deserialisation ou d'adaptation

**Criteres d'acceptation :**
- Le contrat Frigate utile au MVP est explicite
- Vyzio ne depend pas de payloads implicites ou de strings dispersees

### US-P2.2 — FrigateAdapter minimal

**Taches :**
- [ ] Consommer MQTT et/ou REST Frigate via une seule couche d'adaptation
- [ ] Convertir les signaux Frigate en evenements Vyzio comprehensibles
- [ ] Journaliser clairement les erreurs d'integration

**Criteres d'acceptation :**
- Une detection Frigate pertinente est visible cote Vyzio
- Le couplage a Frigate reste localise

### US-P2.3 — Contrat interne Vyzio

**Taches :**
- [ ] Definir les evenements internes Vyzio necessaires au MVP
- [ ] Eviter de modeliser des canaux non utilises a court terme
- [ ] Documenter le contrat dans un document dedie

**Criteres d'acceptation :**
- Les evenements internes ont un nommage stable et limite
- Le contrat est reutilisable par API, notifications et UI

---

## P3 — Experience produit MVP

> **But** : materialiser la valeur Vyzio la ou Frigate ne suffit pas seul pour un public non-tech.

### US-P3.1 — API metier minimale

**Taches :**
- [ ] Exposer uniquement les parcours MVP prioritaires
- [ ] Separer lecture/ecriture de facon simple et testable
- [ ] Eviter les endpoints de confort non relies a un parcours utilisateur clair

**Criteres d'acceptation :**
- L'API sert un parcours produit identifiable

### US-P3.2 — Notifications utiles

**Taches :**
- [ ] Implementer le premier canal retenu par la strategie produit
- [ ] Limiter le scope aux notifications a forte valeur
- [ ] Ajouter les regles de bruit minimum

**Criteres d'acceptation :**
- Une detection prioritaire genere une notification intelligible

### US-P3.3 — Hub Vyzio simplifie

**Taches :**
- [ ] Definir l'UI minimale necessaire pour un utilisateur non-tech
- [ ] Eviter de reconstruire l'integralite des ecrans Frigate
- [ ] Conserver un acces avance vers Frigate hors parcours nominal

**Criteres d'acceptation :**
- Le parcours MVP peut se faire sans exposer l'UI Frigate comme interface principale

---

## Hors chemin critique

Les sujets suivants sont **etudies mais non retenus dans le chemin nominal actuel** :

- Worker Python dedie pour la reconnaissance faciale
- gRPC inter-services pour l'IA
- UI 100 % custom couvrant toutes les fonctions avancees de Frigate
- Multi-base de donnees des le MVP
- Acces distant complet et tunnels avant validation du parcours local

Ils pourront revenir plus tard via ADR ou backlog post-MVP si un besoin concret l'impose.

---

## Ordre de travail recommande a partir de maintenant

1. Valider ensemble ce backlog de reprise.
2. Finir le nettoyage structurel du depot.
3. Verifier que la base runtime restante demarre proprement.
4. Reprendre ensuite seulement la phase P1, une story a la fois.

---

## Definition of done pour une story

Une story n'est pas consideree comme terminee si un seul des points suivants manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- impact documentaire mis a jour si necessaire ;
- absence de dependance implicite a une option non retenue.

---

### US-6.3 — Canal Discord Webhook

**En tant qu'** utilisateur, je veux recevoir les alertes sur mon serveur Discord avec la photo de détection.

**Tâches :**
- [ ] Implémenter `DiscordNotificationChannel : INotificationChannel`
- [ ] Envoyer un embed Discord avec la photo (multipart form)
- [ ] Configurer via `settings` : `discord.webhook_url`

**Critères d'acceptation :**
- Message Discord avec embed et image reçu < 3s après détection

---

### US-6.4 — Canal FCM (push natif Android/iOS)

**En tant qu'** utilisateur, je veux recevoir une notification push système sur mon téléphone.

**Tâches :**
- [ ] Implémenter `FcmNotificationChannel : INotificationChannel`
- [ ] Payload : titre + corps + URL signée HMAC du thumbnail (TTL 5 min)
- [ ] Configurer via `settings` : `fcm.server_key`, `fcm.device_tokens[]`
- [ ] Générer l'URL signée via `SignedUrlService` (HMAC-SHA256)

**Critères d'acceptation :**
- Notification push reçue sur Android/iOS
- L'URL de la photo expire après 5 minutes

**Références SAD :** §6.6, ADR-09

---

### US-6.5 — Canaux ntfy + Webhook générique + Email

**En tant qu'** utilisateur avancé, je veux des canaux de notification alternatifs (ntfy, webhook, email).

**Tâches :**
- [ ] Implémenter `NtfyNotificationChannel` : HTTP POST avec attachment JPEG
- [ ] Implémenter `WebhookNotificationChannel` : HTTP POST JSON avec URL signée thumbnail
- [ ] Implémenter `EmailNotificationChannel` : SMTP avec photo en pièce jointe (MailKit)
- [ ] Configurer via `settings`

---

## E7 — API REST + SignalR

> **Objectif** : l'API ASP.NET Core expose tous les endpoints nécessaires au dashboard et aux intégrations tierces.

### US-7.1 — Authentification JWT

**En tant qu'** utilisateur, je veux protéger le dashboard par mot de passe, afin qu'un visiteur sur mon réseau ne puisse pas accéder à mes enregistrements.

**Tâches :**
- [ ] `POST /api/auth/login` : vérifie mot de passe (bcrypt cost 12), retourne access token (JWT 15 min) + refresh token (7 jours)
- [ ] `POST /api/auth/refresh` : échange un refresh token valide contre un nouveau pair
- [ ] `DELETE /api/auth/logout` : révoque le refresh token en base
- [ ] Rate limiting : 5 tentatives / 15 min / IP (`AspNetCoreRateLimit`)
- [ ] Middleware d'authentification JWT sur toutes les routes sauf `/api/auth/*`
- [ ] TLS : certificat auto-signé généré au premier démarrage (Trust On First Use)
- [ ] Stocker le hash du mot de passe dans `settings`

**Critères d'acceptation :**
- Impossible d'accéder à l'API sans JWT valide
- Après 5 tentatives échouées, l'IP est bloquée 15 minutes
- Le logout invalide immédiatement le refresh token

**Références SAD :** ADR-10, §9.2

---

### US-7.2 — Endpoints Caméras

**En tant qu'** utilisateur, je veux gérer mes caméras via l'API.

**Tâches :**
- [ ] `GET /api/cameras` — liste + état (proxyfie Frigate REST)
- [ ] `POST /api/cameras` — ajoute une caméra (valide + écrit `frigate.yml` + reload Frigate)
- [ ] `DELETE /api/cameras/{id}` — supprime une caméra
- [ ] `GET /api/cameras/{id}/live` — proxy HLS Frigate (streaming, auth Vyzio obligatoire)
- [ ] `GET /api/cameras/{id}/snapshot` — proxy thumbnail live Frigate
- [ ] `POST /api/cameras/scan` — déclenche un scan ONVIF réseau (via Frigate)

**Critères d'acceptation :**
- Le flux live HLS est accessible depuis le dashboard sans que Frigate soit exposé directement
- L'ajout d'une caméra démarre la surveillance en < 10s

---

### US-7.3 — Endpoints Profils

**En tant qu'** utilisateur, je veux gérer les profils de personnes via l'API.

**Tâches :**
- [ ] `GET /api/profiles` — liste tous les profils
- [ ] `POST /api/profiles` — upload photo(s) → calcul embedding → création
- [ ] `GET /api/profiles/{id}` — détail + dernière apparition
- [ ] `PATCH /api/profiles/{id}` — mise à jour nom/catégorie/alertMode
- [ ] `DELETE /api/profiles/{id}` — suppression + cascade événements
- [ ] `POST /api/profiles/{id}/photos` — ajout de photos de référence

**Critères d'acceptation :**
- Un profil créé est immédiatement actif (embeddings chargés en mémoire)
- Les embeddings ne sont jamais inclus dans les réponses API

---

### US-7.4 — Endpoints Événements & Historique

**En tant qu'** utilisateur, je veux accéder à l'historique des détections via l'API.

**Tâches :**
- [ ] `GET /api/events` — paginé, filtres : `camera`, `profile_id`, `type`, `from`, `to`
- [ ] `GET /api/events/{id}/thumbnail` — proxy thumbnail + validation URL signée (accès distant)
- [ ] `POST /api/events/{id}/confirm` — confirme la reconnaissance
- [ ] `POST /api/events/{id}/correct` — corrige le profil associé
- [ ] `GET /api/clips/{id}` — proxy clip MP4 Frigate (streaming HTTP range requests)
- [ ] `GET /api/clips/{id}/download` — téléchargement du clip

**Critères d'acceptation :**
- La pagination fonctionne correctement (cursor-based ou offset)
- Le streaming des clips fonctionne sans buffering mémoire (HttpClient streaming)

---

### US-7.5 — Hub SignalR (événements temps réel)

**En tant que** dashboard, je veux recevoir les événements en temps réel via WebSocket, afin de mettre à jour l'interface sans polling.

**Tâches :**
- [ ] Implémenter `EventsHub : Hub` (SignalR)
- [ ] Souscrire MQTT `vyzio/events/*` dans un `IHostedService` → push SignalR vers tous les clients connectés
- [ ] Authentification JWT sur le hub SignalR
- [ ] Events poussés : `face_recognized`, `face_unknown`, `face_uncertain`, `camera_status`

**Critères d'acceptation :**
- Le dashboard reçoit un événement SignalR < 200ms après la publication MQTT
- La reconnexion SignalR est automatique (gérée par le client `@microsoft/signalr`)

---

### US-7.6 — Endpoints Paramètres

**En tant qu'** utilisateur, je veux configurer Vyzio depuis le dashboard.

**Tâches :**
- [ ] `GET /api/settings` — retourne la configuration active (sans secrets)
- [ ] `PATCH /api/settings` — met à jour les paramètres (notifications, rétention, seuils IA)
- [ ] `POST /api/settings/notifications/test` — envoie un message de test sur tous les canaux configurés

---

## E8 — Dashboard React

> **Objectif** : interface grand public, mobile-first, 5 vues définies dans les specs.

### US-8.1 — Setup & architecture frontend

**Tâches :**
- [ ] Vite + React 19 + TypeScript strict
- [ ] Tanstack Router (routing typé)
- [ ] Tanstack Query (fetching/cache)
- [ ] Shadcn/ui + Tailwind CSS
- [ ] `@microsoft/signalr` pour le hub événements
- [ ] Client API typé (généré depuis OpenAPI Scalar ou codegen)
- [ ] Layout responsive mobile-first

---

### US-8.2 — Vue Accueil

**En tant qu'** utilisateur, je veux voir l'état global du système et les derniers événements dès l'ouverture du dashboard.

**Tâches :**
- [ ] Indicateur "Tout fonctionne" ou liste des alertes actives
- [ ] Feed des événements du jour (live via SignalR)
- [ ] Accès rapide "Visages inconnus"
- [ ] Compteur de caméras actives / en erreur

**Références SPECS :** §8.2 Vue 1

---

### US-8.3 — Vue Caméras

**En tant qu'** utilisateur, je veux voir mes caméras et gérer les zones de détection.

**Tâches :**
- [ ] Liste caméras avec miniature live (snapshot polling ou HLS)
- [ ] Clic → flux live plein écran (HLS player, ex. `hls.js`)
- [ ] Overlay zones de détection polygonales (React-Konva)
- [ ] Outil de dessin de zones polygonales sur l'image
- [ ] Gestion des plages horaires par zone
- [ ] Statut en temps réel (SignalR `camera_status`)

**Références SPECS :** §8.2 Vue 2, §3.4

---

### US-8.4 — Vue Personnes (Profils)

**En tant qu'** utilisateur, je veux gérer les profils depuis le dashboard.

**Tâches :**
- [ ] Liste des profils : photo miniature, nom, dernière apparition, badge catégorie
- [ ] Formulaire de création : upload drag & drop, validation visage, choix catégorie + alertMode
- [ ] Édition inline du nom et des paramètres
- [ ] Suppression avec confirmation (mention RGPD)
- [ ] Upload de photos supplémentaires pour enrichir un profil

**Références SPECS :** §8.2 Vue 3

---

### US-8.5 — Vue Historique

**En tant qu'** utilisateur, je veux consulter l'historique des événements avec les clips vidéo.

**Tâches :**
- [ ] Timeline paginée par jour
- [ ] Filtres : caméra, personne, type d'événement, plage de dates
- [ ] Clic sur événement → modal avec clip vidéo + visage + détails
- [ ] Lecteur vidéo intégré (MP4)
- [ ] Bouton "Télécharger ce clip"
- [ ] Boutons confirmer/corriger pour les événements incertains

**Références SPECS :** §8.2 Vue 4

---

### US-8.6 — Vue Paramètres

**En tant qu'** utilisateur, je veux configurer tous les canaux de notification et la politique de rétention depuis le dashboard.

**Tâches :**
- [ ] Section notifications : formulaires par canal (Telegram, Discord, FCM, ntfy, webhook, email)
- [ ] Bouton "Tester" pour chaque canal
- [ ] Politique de rétention vidéo (slider jours)
- [ ] Paramètres IA : seuils de détection et reconnaissance
- [ ] Gestion du compte : changement de mot de passe

**Références SPECS :** §8.2 Vue 5

---

### US-8.7 — Onboarding guidé (premier démarrage)

**En tant qu'** utilisateur non-technicien, je veux être guidé étape par étape lors du premier démarrage.

**Tâches :**
- [ ] Écran "Bienvenue dans Vyzio"
- [ ] Étape 1 : définir un mot de passe
- [ ] Étape 2 : scan réseau ONVIF → sélection caméra(s) → nommage → test flux
- [ ] Étape 3 : ajouter un premier profil (optionnel, "Passer pour l'instant")
- [ ] Étape 4 : configurer un canal de notification + test
- [ ] Fin : redirection vers l'accueil

**Références SAD :** §8.2

---

## E9 — Authentification & Sécurité

> Cette épique consolide les éléments de sécurité transversaux.

### US-9.1 — TLS auto-signé (Trust On First Use)

**Tâches :**
- [ ] Générer un certificat auto-signé au premier démarrage (via `dotnet dev-certs` ou `BouncyCastle`)
- [ ] Stocker le certificat sur le volume persistant
- [ ] Configurer Kestrel pour TLS obligatoire sur `8443`
- [ ] Afficher le fingerprint dans les logs pour vérification manuelle

---

### US-9.2 — Chiffrement des credentials caméra

**Tâches :**
- [ ] Chiffrer les URL RTSP (avec credentials) via `Microsoft.AspNetCore.DataProtection`
- [ ] Les credentials ne sont jamais retournés en clair par l'API

---

### US-9.3 — Audit de sécurité (OWASP Top 10)

**Tâches :**
- [ ] Valider toutes les entrées utilisateur côté serveur (pas uniquement frontend)
- [ ] Requêtes EF Core paramétrées uniquement — zéro SQL brut
- [ ] Headers sécurité HTTP : CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] Embeddings jamais sérialisés dans les réponses API
- [ ] Frigate non accessible depuis le réseau hôte (lié à `127.0.0.1` dans Docker)

---

## E10 — Accès distant & Tunnels

### US-10.1 — URL signée HMAC pour les thumbnails

**En tant que** service, je veux générer des URLs de thumbnail à durée limitée, afin que les images ne soient pas accessibles indéfiniment hors réseau.

**Tâches :**
- [ ] Implémenter `SignedUrlService.GenerateSignedThumbnailUrl(eventId, baseUrl)` → HMAC-SHA256 + TTL 5 min
- [ ] Valider la signature dans le middleware `GET /api/events/{id}/thumbnail`
- [ ] Thumbnail ≤ 100 KB, résolution max 400×300

**Références SAD :** §6.6, ADR-09

---

### US-10.2 — Support Cloudflare Tunnel (opt-in)

**En tant qu'** utilisateur, je veux activer un tunnel Cloudflare depuis le dashboard, afin d'accéder à Vyzio depuis Internet sans ouvrir de port.

**Tâches :**
- [ ] Intégrer `cloudflared` dans le Docker Compose (service optionnel)
- [ ] Page de configuration tunnel dans les paramètres
- [ ] Afficher l'URL publique générée

---

## E11 — Packaging & Déploiement

### US-11.1 — Build NativeAOT .NET

**Tâches :**
- [ ] Configurer `PublishAot=true` pour `Vyzio.Api`
- [ ] Valider la compatibilité NativeAOT de toutes les dépendances
- [ ] Cross-compilation arm64 pour Raspberry Pi 5 / NUC
- [ ] Démarrage vérifié < 100ms

---

### US-11.2 — Docker Compose production (appliance)

**Tâches :**
- [ ] `docker-compose.appliance.yml` : ports fermés sauf 8443, restart policies, health checks
- [ ] Volumes nommés persistants pour toutes les données
- [ ] Script `install.sh` pour l'appliance : clone, config initiale, `docker compose up -d`

---

### US-11.3 — Tests d'intégration

**Tâches :**
- [ ] `Vyzio.Tests` : Testcontainers (PostgreSQL + Mosquitto en conteneurs de test)
- [ ] Tests contrat MQTT : publier un événement Frigate simulé, vérifier les topics Vyzio publiés
- [ ] Tests API : xUnit + `WebApplicationFactory`
- [ ] Tests Face Worker : image test → vérifier embedding 512 dims retourné

---

## Récapitulatif des dépendances

```
E1 (Frigate + Infra)
  └─► E2 (FrigateAdapter + MQTT)
        └─► E4 (Profiles + Reconnaissance)
        └─► E5 (Storage)
        └─► E6 (Notifications)
              └─► E7 (API + SignalR)
                    └─► E8 (Dashboard)
                    └─► E9 (Auth & Sécurité) ← peut démarrer en parallèle de E7
  └─► E3 (Face Worker Python)
        └─► E4 (Profiles + Reconnaissance)
E7 + E9 └─► E10 (Accès distant)
Tous    └─► E11 (Packaging)
```

---

## Prochaines étapes immédiates (Sprint 1)

1. **US-1.1** — Structure monorepo + solutions initiales (.NET, React, Python)
2. **US-1.2** — `docker-compose.yml` de base avec Frigate + PostgreSQL
3. **US-1.3** — Configuration Frigate minimale + validation MQTT
4. **US-1.4** — Schéma EF Core + migrations
5. **US-2.1** — Client MQTT Vyzio
6. **US-3.1** — Contrat Protobuf

> **Fin de Sprint 1** : Frigate ingère un flux RTSP, les événements MQTT apparaissent, la DB Vyzio est créée.
