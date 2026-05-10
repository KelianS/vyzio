# Vyzio — Backlog de reprise

> Mai 2026 — plan de remise a plat avant reprise du developpement
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

## Workflow obligatoire

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

Ce backlog ne fait qu'appliquer cet ordre; il n'en est pas la source de verite.

---

## Principes de reprise

1. **Pas de nouvelle feature tant que la phase P0 n'est pas validee.**
2. **Frigate reste le moteur central** pour la video, la detection et les enrichissements deja bien couverts.
3. **Le depot ne contient plus de service Python de reconnaissance faciale** dans le chemin nominal ni comme scaffold vide.
4. **Le code existant peut etre simplifie ou supprime** s'il ne sert pas clairement la trajectoire retenue.
5. **Chaque etape doit avoir une validation executable** ou une preuve documentaire explicite.

---

## Etat de depart

### Constats

- Le depot a ete demarre trop vite par rapport au cadrage.
- Une partie du code et des scaffolds a ete creee avant stabilisation du plan.
- Le runtime par defaut a ete nettoye pour sortir les composants non retenus.
- Le backlog precedent a ete abandonne car il poussait a implementer avant d'avoir verrouille la reprise.

### Objectif operationnel

Reprendre le projet en 4 phases, avec une **phase P0 bloquante** de nettoyage, verification et revalidation du plan.

---

## Vue d'ensemble

| Phase | Nom | But | Sortie attendue | Statut cible |
|---|---|---|---|---|
| P0 | Reprise en main | Nettoyer, aligner, figer les priorites | Depot coherent + plan valide | Bloquant |
| P1 | Fondations runtime | Stabiliser Frigate + config + persistance minimale | Environnement de base fiable | Ensuite |
| P2 | Integration Vyzio ↔ Frigate | Consommer et transformer les evenements Frigate proprement | Contrat d'evenements valide | Ensuite |
| P3 | Experience produit MVP | API metier, notifications, hub simplifie | Parcours utilisateur MVP | Ensuite |

---

## P0 — Reprise en main

> Gate absolu : aucune feature produit ne redemarre tant que cette phase n'est pas terminee.

### Etat actuel de P0

- **US-P0.1** : essentiellement realisee via l'audit de reprise et la cartographie des surfaces utiles.
- **US-P0.2** : largement engagee ; le repo a ete nettoye, le narratif Frigate-first a ete aligne, et le runtime de dev a ete clarifie.
- **US-P0.3** : a finaliser dans ce backlog pour verrouiller les checkpoints, acter le reste a faire, puis faire une revue humaine de sortie.

**Blocage restant avant sortie de P0 :**

- faire une revue humaine finale du depot et du plan avant reouverture des stories feature.

### US-P0.1 — Cartographier l'existant utile

**Taches :**
- [x] Lister les composants reellement presents dans le depot : API, application, infrastructure, tests, dashboard, compose, config, docs
- [x] Qualifier chaque composant : `a conserver`, `a simplifier`, `a retirer`, `a geler`
- [x] Identifier les ecarts entre code present et architecture retenue
- [x] Produire une synthese de reprise exploitable sans relire tout le repo

**Criteres d'acceptation :**
- Le statut de chaque surface existante est explicite
- Les incoherences majeures sont visibles rapidement

**Preuve actuelle :**

- `docs/REPRISE_AUDIT.md` sert de synthese de reprise et de cartographie de l'existant.

### US-P0.2 — Nettoyage structurel complet

**Taches :**
- [x] Retirer les reliquats de scaffolding non retenus
- [x] Aligner les documents repo avec l'architecture par defaut
- [x] Garder uniquement les composants utiles a la trajectoire MVP actuelle
- [x] Sortir les alternatives etudiees du chemin critique du depot

**Criteres d'acceptation :**
- Le depot raconte la meme histoire dans le code, le compose et les docs
- Aucun composant vide ou trompeur ne laisse penser qu'il fait partie du MVP

**Preuves actuelles :**

- `README.md` et `docs/SAD.md` sont alignes sur le positionnement Frigate-first.
- Le runtime de dev utilise `config/frigate.dev.yml` comme fallback explicite.
- Le runtime minimal a ete valide via WSL / Docker : `docker compose config`, `docker compose up -d`, API `http://localhost:8443/health` OK, UI/API Frigate OK.
- Le conteneur orphelin `vyzio-face-worker` a ete supprime de l'environnement Docker local.
- Le contrat minimal d'entree Frigate est fige dans `docs/SAD.md` : topic retenu, champs requis, champs optionnels et normalisation minimale.
- Le dashboard a ete gele sans reliquats de scaffold visibles.
- Le modele `Profile` ne porte plus de stockage d'embeddings.

### US-P0.3 — Verrouiller le plan d'attaque

**Taches :**
- [x] Reordonner le travail selon la valeur produit et les dependances reelles
- [x] Distinguer clairement `MVP`, `post-MVP` et `options etudiees`
- [x] Definir les checkpoints de validation par phase
- [ ] Faire une revue humaine avant reprise du code feature

**Criteres d'acceptation :**
- Le backlog peut servir de reference de pilotage
- Les frontieres MVP / hors MVP sont nettes

### Checkpoints de validation par phase

#### Checkpoint de sortie P0

- `docs/REPRISE_AUDIT.md` est valide comme synthese de reprise.
- Le repo ne contient plus de composant vide, ambigu ou contradictoire dans le chemin nominal.
- Le runtime minimal restant est valide sur une machine equipee de Docker (`docker compose config` puis `docker compose up`).
- Le backlog de reprise est relu et valide humainement avant reouverture des stories feature.

#### Checkpoint d'entree P1

- Le compose minimal et le fallback `config/frigate.dev.yml` sont consideres comme base de dev seulement.
- Les chantiers P1 n'introduisent pas de nouvelle strategie hors SAD/SPECS valides.

#### Checkpoint d'entree P2

- Le contrat d'entree Frigate est explicite et teste.
- Les evenements internes Vyzio ne dupliquent pas un pipeline IA deja porte par Frigate.

#### Checkpoint d'entree P3

- Le parcours MVP prioritaire est trace de bout en bout : evenement Frigate, regle Vyzio, notification ou exposition API, puis UI minimale.
- Les parcours UX retenus restent limites a la valeur produit non-tech.

### Gate de sortie P0

La phase P0 est terminee seulement si :

- le plan de reprise est valide ensemble ;
- le runtime par defaut est aligne sur le SAD ;
- le depot ne contient plus de composants vides ou contradictoires ;
- les prochaines stories peuvent etre prises sans reouvrir la strategie.

---

## P1 — Fondations runtime

> But : obtenir une base d'execution minimale, fiable et conforme au positionnement Frigate-first.

### US-P1.1 — Compose minimal et coherent

**Taches :**
- [ ] Stabiliser `docker-compose.yml` autour des seuls services retenus par defaut
- [ ] Clarifier volumes, ports, reseaux et dependances
- [ ] Documenter le boot local de developpement

**Criteres d'acceptation :**
- `docker compose up` demarre la base retenue sans service parasite
- Le role de chaque service est comprensible au premier coup d'oeil

### US-P1.2 — Configuration Frigate maitrisee

**Taches :**
- [ ] Valider un `frigate.yml` minimal compatible avec la version cible
- [ ] Documenter ce qui est gere par Vyzio et ce qui reste purement Frigate
- [ ] Verifier l'integration d'un flux de test sans bricolage excessif

**Criteres d'acceptation :**
- Frigate demarre avec une configuration valide
- Les hypotheses de configuration sont explicites

### US-P1.3 — Persistance Vyzio minimale

**Taches :**
- [ ] Garder uniquement les entites et tables utiles au MVP reel (profils produit, mapping identites Frigate, evenements, notifications, sessions)
- [ ] Confirmer le provider par defaut et la strategie de migration
- [ ] Verifier que le demarrage API applique les migrations sans logique parasite

**Criteres d'acceptation :**
- La persistence minimale est testable et comprise
- Le schema ne simule pas encore des features non construites (notamment un pipeline biometrie propre a Vyzio)

---

## P2 — Integration Vyzio vers Frigate

> But : construire la premiere vraie couture produit sans ouvrir trop tot les couches secondaires.

### US-P2.1 — Contrat d'entree Frigate

**Taches :**
- [ ] Definir les evenements Frigate reellement consommes par Vyzio
- [ ] Creer un modele d'entree limite au MVP
- [ ] Integrer un filtrage configurable des labels Frigate retenus par l'utilisateur
- [ ] Ajouter des tests de deserialisation et d'adaptation

**Criteres d'acceptation :**
- Le contrat utile est explicite
- Le code n'est pas couple a des payloads implicites disperses

### US-P2.2 — FrigateAdapter minimal

**Taches :**
- [ ] Consommer les evenements Frigate via une seule couche d'adaptation, avec MQTT pour le temps reel et REST uniquement pour les ressources complementaires necessaires
- [ ] Convertir les signaux Frigate en evenements Vyzio comprehensibles
- [ ] Appliquer le filtre de labels configure sans hardcoder `person` comme seule categorie utile
- [ ] Journaliser proprement les erreurs d'integration

**Criteres d'acceptation :**
- Une detection Frigate pertinente devient observable cote Vyzio
- Le couplage a Frigate reste localise

### US-P2.3 — Contrat interne Vyzio

**Taches :**
- [ ] Definir les evenements internes necessaires au MVP sans repliquer le pipeline IA de Frigate
- [ ] Eviter de modeliser des canaux non utilises a court terme
- [ ] Documenter le contrat dans un document dedie si necessaire

**Criteres d'acceptation :**
- Les evenements internes sont limites et stables
- Le contrat est reutilisable par API, notifications et UI, en partant d'evenements Frigate deja enrichis

---

## P3 — Experience produit MVP

> But : livrer la valeur Vyzio la ou Frigate seul ne suffit pas pour un public non-tech.

### US-P3.1 — API metier minimale

**Taches :**
- [ ] Exposer uniquement les parcours MVP prioritaires
- [ ] Separer lecture/ecriture de facon simple et testable
- [ ] Eviter les endpoints non relies a un parcours utilisateur clair

**Criteres d'acceptation :**
- L'API sert un parcours produit identifiable

### US-P3.2 — Notifications utiles

**Taches :**
- [ ] Implementer Telegram comme premier canal retenu par la strategie produit
- [ ] Limiter le scope aux notifications a forte valeur
- [ ] Ajouter les regles minimales de reduction du bruit

**Criteres d'acceptation :**
- Une detection prioritaire genere une notification intelligible
- Le premier parcours notif fonctionne sans imposer tunnel, URL signee ou configuration avancee

### US-P3.3 — Hub Vyzio simplifie

**Taches :**
- [ ] Definir l'UI minimale necessaire pour un utilisateur non-tech
- [ ] Eviter de reconstruire l'integralite des ecrans Frigate
- [ ] Conserver un acces avance vers Frigate hors parcours nominal

**Criteres d'acceptation :**
- Le parcours MVP fonctionne sans imposer l'UI Frigate comme interface principale

---

## Hors chemin critique

Ces sujets restent possibles mais ne font pas partie du chemin nominal actuel :

- worker dedie de reconnaissance faciale hors Frigate ;
- protocole inter-services specialise de type gRPC ;
- UI 100 % custom couvrant toutes les fonctions avancees de Frigate ;
- multi-base de donnees des le MVP ;
- acces distant complet avant validation du parcours local.

Ils ne reviennent dans le backlog qu'apres nouvelle decision documentaire dans les SPECS et/ou le SAD.

---

## Ordre de travail recommande a partir de maintenant

1. Valider ensemble la sortie documentaire de P0 (`BACKLOG` + `REPRISE_AUDIT`).
2. Faire la revue humaine finale de sortie P0.
3. Reprendre ensuite seulement P1, une story a la fois.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
