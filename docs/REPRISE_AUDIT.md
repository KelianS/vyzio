# Vyzio — Audit de reprise P0

> Mai 2026 — synthese operationnelle pour lancer P0.1 puis P0.2
> References : [BACKLOG.md](./BACKLOG.md) · [SAD.md](./SAD.md) · [SPECS.md](./SPECS.md) · [README.md](../README.md)

---

## Role de ce document

Ce document sert de synthese de reprise.

Il ne redefinit ni la strategie produit ni l'architecture cible. Il qualifie l'existant du depot pour decider quoi conserver, simplifier, retirer ou geler avant de reprendre le developpement feature.

---

## Synthese rapide

- Le depot contient deja une base backend .NET exploitable et coherente avec la Clean Architecture.
- Le dashboard existe mais reste volontairement en mode placeholder ; il doit etre conserve puis gele tant que les parcours MVP ne sont pas rouverts.
- Le runtime nominal est bien recentre sur `frigate` + `vyzio-api`, avec une configuration de developpement Frigate maintenant explicite.
- Les principaux ecarts restants sont documentaires et structurels : vocabulaire encore ambigu dans certains docs, artefacts generes presents localement, et contrat d'evenements backend encore a resserrer autour de Frigate.

---

## Cartographie de l'existant

| Surface | Role constate | Statut | Ecart principal | Action de reprise |
|---|---|---|---|---|
| `src/vyzio/Vyzio.Core` | Entites et interfaces domaine | **A conserver** | Le profil a ete simplifie, mais le contrat d'evenements reste encore oriente `RecognitionEvent` | Requalifier progressivement les evenements autour du contrat Frigate retenu |
| `src/vyzio/Vyzio.Application` | Use cases backend | **A conserver** | Slice `Profiles` present mais scope encore partiel | Garder comme base de reference pour les prochains use cases |
| `src/vyzio/Vyzio.Infrastructure` | EF Core + config runtime | **A conserver** | Persistance minimale utile, avec un schema deja allegé mais encore centre sur `RecognitionEvent` | Revoir le contrat d'evenements a l'aune de l'integration Frigate retenue en P2 |
| `src/vyzio/Vyzio.Api` | Minimal API + migrations au boot | **A conserver** | Surface saine mais tres amont par rapport au MVP complet | Conserver sans etendre avant verrouillage du contrat Frigate |
| `src/vyzio/Vyzio.Tests` | Unit + integration tests | **A conserver** | Structure plus lisible apres renommage, reste a etendre quand les nouveaux use cases arriveront | Garder comme base de validation de reference |
| `src/dashboard` | Hub frontend minimal | **A geler** | UI placeholder assumee | Conserver la base Vite/React sans rouvrir de chantier UI avant P3 |
| `docker-compose.yml` | Runtime nominal local | **A conserver** | Compose minimal coherent, avec un fichier Frigate de developpement explicite | Garder ce runtime de dev jusqu'a la generation de config par Vyzio |
| `docker-compose.override.yml` | Exposition dev locale | **A conserver** | RAS, utile pour le dev local | Garder tant qu'il reste strictement limite au mode dev |
| `config/frigate.dev.yml` | Config Frigate de developpement | **A conserver** | Flux factice volontaire pour le boot local | Garder comme fallback de dev en attendant la config geree par Vyzio |
| `config/vyzio.yml` | Config runtime API | **A conserver** | Minimal mais coherent | Garder comme point d'entree runtime local |
| `README.md` | Vision et positionnement | **A conserver** | Discours recentre sur Frigate-first | Garder comme point d'entree produit du repo |
| `docs/SPECS.md` | Besoin produit | **A conserver** | Pas d'ecart majeur constate dans cette passe | Aucun nettoyage prioritaire |
| `docs/SAD.md` | Architecture cible | **A conserver** | Aligne sur Frigate, mais certains termes historiques restent encore presentes comme options etudiees | Garder tel quel pour piloter la reprise |
| `docs/BACKLOG.md` | Ordre de reprise | **A conserver** | Coherent avec la remise a plat | Utiliser comme reference de pilotage |

---

## Ajustements prioritaires identifies

### 1. Nettoyage documentaire haut niveau

**Constat**

- Le `README.md` a ete recentre, mais les autres docs de surface doivent continuer a eviter toute ambiguite sur le role exact de Frigate.

**Impact**

- Le risque de contradiction a baisse, mais il faut garder un narratif repo uniforme dans les prochaines passes.

**Action**

- Continuer a verifier que les docs de surface restent alignees sur le cadrage Frigate-first.

### 2. Nettoyage des artefacts generes

**Constat**

- Des repertoires `bin/`, `obj/`, `dist/` et `node_modules/` sont presents dans le workspace.
- `git ls-files` ne montre pas ces artefacts comme suivis par Git.

**Impact**

- Le depot n'est pas pollue cote Git, mais la lecture du workspace est plus confuse pendant la reprise.

**Action**

- Supprimer localement ces sorties generees avant la phase de nettoyage structurel pour repartir d'un workspace lisible.

### 3. Clarification de la configuration Frigate

**Constat**

- `docker-compose.yml` monte maintenant `config/frigate.dev.yml` comme config active de developpement.
- Le flux `rtsp://replace-me-with-your-stream` reste volontairement un placeholder de boot local.

**Impact**

- La distinction dev versus config geree par Vyzio est maintenant explicite dans le runtime local.

**Action**

- Garder ce fichier comme fallback de developpement jusqu'a la mise en place de la generation de config par Vyzio.

### 4. Simplification du modele de donnees MVP

**Constat**

- Les champs d'embedding ont ete retires du profil.
- Le contrat d'evenements reste encore nomme du point de vue `RecognitionEvent` et devra etre resserre dans la suite de P0/P1.

**Impact**

- Le risque a baisse, mais le schema peut encore suggerer une couche d'evenements trop specifique a Vyzio.

**Action**

- Continuer la requalification du schema autour des identites, mappings Frigate, evenements consommes et decisions de notification.

### 5. Gel explicite du dashboard

**Constat**

- Le dashboard est propre, volontairement vide fonctionnellement et sans reliquats de scaffold visibles.

**Impact**

- Le risque de sur-promesse UI a ete reduit.

**Action**

- Garder le shell actuel sans ouvrir de vrai chantier UI avant P3.

### 6. Clarification des tests existants

**Constat**

- Les tests couvrent bien `Profiles` et la persistence SQLite.
- Le renommage de la suite de persistance a supprime le nom generique trompeur.

**Impact**

- La lisibilite a ete amelioree pour la reprise.

**Action**

- Conserver cette convention de nommage explicite pour les prochains slices.

---

## Nettoyage recommande par ordre d'execution

1. Aligner `README.md` avec le SAD pour supprimer l'ambiguite de positionnement.
2. Nettoyer localement les artefacts generes (`bin`, `obj`, `dist`, `node_modules`) pour relire le depot proprement.
3. Nettoyer localement les artefacts generes (`bin`, `obj`, `dist`, `node_modules`) pour relire le depot proprement.
4. Continuer a resserrer le contrat d'evenements backend autour des evenements Frigate reellement consommes.
5. Garder le dashboard gele tant que les parcours MVP ne sont pas rouverts.

---

## Decision pratique pour lancer P0.2

Si cette synthese est validee, la prochaine passe de nettoyage peut etre decoupee en trois lots :

- **Lot A — Narratif repo** : `README.md` et messages de surface.
- **Lot B — Hygiene depot** : artefacts generes, reliquats de scaffold, noms trompeurs.
- **Lot C — Structure MVP** : clarification config Frigate et schema minimal backend.