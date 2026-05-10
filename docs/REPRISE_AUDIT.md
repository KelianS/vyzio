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
- Le runtime nominal est bien recentre sur `frigate` + `vyzio-api`, mais la configuration Frigate reste au stade template de test.
- Les principaux ecarts sont documentaires et structurels : vocabulaire encore ambigu dans certains docs, artefacts generes presents localement, et modele de donnees encore marque par une logique biometrie interne a Vyzio.

---

## Cartographie de l'existant

| Surface | Role constate | Statut | Ecart principal | Action de reprise |
|---|---|---|---|---|
| `src/vyzio/Vyzio.Core` | Entites et interfaces domaine | **A conserver** | Certaines entites reflètent encore un pipeline biometrie interne | Simplifier le modele autour des donnees vraiment necessaires a l'integration Frigate |
| `src/vyzio/Vyzio.Application` | Use cases backend | **A conserver** | Slice `Profiles` present mais scope encore partiel | Garder comme base de reference pour les prochains use cases |
| `src/vyzio/Vyzio.Infrastructure` | EF Core + config runtime | **A conserver** | Persistance minimale utile, mais schema encore marque par `Embedding` et `RecognitionEvent` | Revoir le schema a l'aune du contrat Frigate retenu en P2 |
| `src/vyzio/Vyzio.Api` | Minimal API + migrations au boot | **A conserver** | Surface saine mais tres amont par rapport au MVP complet | Conserver sans etendre avant verrouillage du contrat Frigate |
| `src/vyzio/Vyzio.Tests` | Unit + integration tests | **A conserver** | Presence d'un fichier de test generique `UnitTest1.cs` encore mal nomme | Renommer/clarifier les tests pour qu'ils racontent le domaine reel |
| `src/dashboard` | Hub frontend minimal | **A geler** | UI encore placeholder, assets de scaffold encore visibles | Conserver la base Vite/React et retirer les reliquats inutiles |
| `docker-compose.yml` | Runtime nominal local | **A simplifier** | Compose minimal coherent, mais Frigate monte un template statique de test | Clarifier la strategie de config et le chemin nominal de boot |
| `docker-compose.override.yml` | Exposition dev locale | **A conserver** | RAS, utile pour le dev local | Garder tant qu'il reste strictement limite au mode dev |
| `config/frigate.yml.template` | Exemple de config Frigate | **A simplifier** | Template encore centre sur un flux factice et pas sur une config pilotee par Vyzio | Clarifier s'il s'agit d'un exemple manuel ou d'un artefact provisoire |
| `config/vyzio.yml` | Config runtime API | **A conserver** | Minimal mais coherent | Garder comme point d'entree runtime local |
| `README.md` | Vision et positionnement | **A ajuster** | Certaines formulations et contributions suggerent encore un moteur IA Vyzio autonome | Recentrer le discours sur Frigate-first et la couche produit Vyzio |
| `docs/SPECS.md` | Besoin produit | **A conserver** | Pas d'ecart majeur constate dans cette passe | Aucun nettoyage prioritaire |
| `docs/SAD.md` | Architecture cible | **A conserver** | Aligne sur Frigate, mais certains termes historiques restent encore presentes comme options etudiees | Garder tel quel pour piloter la reprise |
| `docs/BACKLOG.md` | Ordre de reprise | **A conserver** | Coherent avec la remise a plat | Utiliser comme reference de pilotage |

---

## Ajustements prioritaires identifies

### 1. Nettoyage documentaire haut niveau

**Constat**

- `README.md` parle encore de "moteur de detection et reconnaissance" et appelle des contributions sur les modeles IA, ce qui contredit le positionnement "Vyzio au-dessus de Frigate" retenu dans le SAD.

**Impact**

- Le depot raconte encore deux histoires differentes selon le document lu.

**Action**

- Recentrer `README.md` sur la promesse produit, l'onboarding, les regles metier, les notifications et l'UX simplifiee.

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

- `docker-compose.yml` monte `config/frigate.yml.template` comme config active.
- Le template contient un flux `rtsp://replace-me-with-your-stream`, utile pour l'exemple mais ambigu comme chemin nominal.

**Impact**

- On ne sait pas encore clairement si la configuration Frigate est un exemple manuel, un fallback de dev, ou le debut de la future config pilotee par Vyzio.

**Action**

- Rendre explicite le statut de ce fichier et separer, si besoin, un exemple de dev d'une future config geree par Vyzio.

### 4. Simplification du modele de donnees MVP

**Constat**

- `Profile` porte encore `Embedding` et `EmbeddingCount`.
- `RecognitionEvent` est nomme du point de vue biometrie Vyzio plutot que du point de vue "evenement Frigate consomme puis enrichi".

**Impact**

- Le schema laisse penser qu'un pipeline de reconnaissance faciale natif a Vyzio existe ou va revenir dans le chemin nominal.

**Action**

- Requalifier le schema autour des identites, mappings Frigate, evenements consommes et decisions de notification, sans supposer un moteur biometrie maison.

### 5. Gel explicite du dashboard

**Constat**

- Le dashboard est propre mais volontairement vide fonctionnellement.
- Des assets de scaffold restent visibles (`react.svg`, `vite.svg`).

**Impact**

- Risque faible, mais le frontend peut sembler plus avance qu'il ne l'est reellement.

**Action**

- Garder le shell actuel, retirer les reliquats de scaffold sans ouvrir de vrai chantier UI avant P3.

### 6. Clarification des tests existants

**Constat**

- Les tests couvrent bien `Profiles` et la persistence SQLite.
- Le fichier `UnitTest1.cs` ne raconte pas son vrai contenu.

**Impact**

- Dette de lisibilite faible mais immediate pour une phase de reprise.

**Action**

- Renommer les fichiers et groupes de tests pour correspondre aux slices reels deja en place.

---

## Nettoyage recommande par ordre d'execution

1. Aligner `README.md` avec le SAD pour supprimer l'ambiguite de positionnement.
2. Nettoyer localement les artefacts generes (`bin`, `obj`, `dist`, `node_modules`) pour relire le depot proprement.
3. Clarifier le statut du fichier `config/frigate.yml.template` et son usage dans `docker-compose.yml`.
4. Requalifier le schema minimal backend pour ne garder que les donnees MVP utiles a l'integration Frigate.
5. Retirer les reliquats de scaffold du dashboard et renommer les tests generiques.

---

## Decision pratique pour lancer P0.2

Si cette synthese est validee, la prochaine passe de nettoyage peut etre decoupee en trois lots :

- **Lot A — Narratif repo** : `README.md` et messages de surface.
- **Lot B — Hygiene depot** : artefacts generes, reliquats de scaffold, noms trompeurs.
- **Lot C — Structure MVP** : clarification config Frigate et schema minimal backend.