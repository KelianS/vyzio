# Workflow & gouvernance documentaire

Source de vérité du processus de travail du repo. Tout changement significatif suit cet ordre ;
interdiction de commencer l'implémentation tant que les étapes documentaires amont ne sont pas alignées.

## Ordre imposé

1. **SPECS** ([`SPECS.md`](SPECS.md)) — si le besoin produit change : user stories, parcours, périmètre MVP.
2. **SAD** ([`SAD.md`](SAD.md)) — si la solution technique ou les frontières changent : composants, responsabilités, ADR.
3. **BACKLOG** ([`BACKLOG.md`](BACKLOG.md)) — ordre d'exécution, découpage, dépendances, gates de validation.
4. **Implémentation** — code minimal, cohérent avec les documents validés.
5. **Tests** — validation ciblée obligatoire du slice modifié.
6. **Aide dans l'interface** — toute feature livrable est documentée **dans l'écran qui la porte**,
   sur les trois niveaux d'[ADR-53](adr/0053-la-doc-utilisateur-vit-dans-l-interface-trois-niveaux-d-aide.md).
   Aucun mode d'emploi hors du produit.

## Règles pratiques

- Une feature qui ne modifie ni besoin, ni architecture, ni plan → directement implémentation puis tests.
- Une feature qui contredit un document existant → mettre le document à jour **avant** d'écrire le code.
- Le backlog ne sert jamais à découvrir la stratégie après coup ; il traduit une stratégie déjà décidée dans les SPECS et/ou le SAD.
- Aucune PR n'est propre si le code est à jour mais la documentation de cadrage en retard.

## Architecture documentaire (types de documents)

| Type | Rôle | Foyer | Stabilité |
|---|---|---|---|
| **SPECS** | Besoin, parcours, périmètre produit | [`SPECS.md`](SPECS.md) | moyenne |
| **SAD** | Frontières, grands choix, vue d'ensemble ; **référence** le code, ne le paraphrase pas | [`SAD.md`](SAD.md) | haute |
| **ADR** | Une décision d'architecture = un fichier (Contexte → Options → Décision → Conséquences) | [`adr/`](adr/) — un `NNNN-slug.md` par décision, index [`adr/README.md`](adr/README.md) | figée une fois `accepté` |
| **TAD** | *Comment* un sous-système fonctionne (détail trop spécifique pour le SAD) | [`design/`](design/) — un `.md` par composant, catalogue [`design/README.md`](design/README.md) | moyenne |
| **Investigation** | Exploration, essais, reverse engineering, captures | [`investigations/`](investigations/) | jetable |
| **Aide utilisateur** | Mode d'emploi d'une feature livrée | l'écran qui la porte, en code (ADR-53) | suit la feature |

Chaîne : le SAD pose les **frontières** → un ADR **tranche** une décision (et cite ses options
écartées) → un TAD documente le **comment** d'un composant → le code **fait**. Chacun son foyer,
aucune recopie.

**Règles d'échelle :**
- Le corps du SAD ne bouge pas quand une décision s'ajoute : un nouvel ADR = un fichier dans `adr/`
  + une ligne d'index. Le SAD §5 **pointe** vers l'index, il ne le recopie pas.
- Un ADR remplacé n'est jamais supprimé : statut `remplacé par ADR-NNNN` ; la décision qui le
  remplace résume l'option abandonnée dans sa rubrique « Options écartées ».
- Le détail bas niveau (trames d'octets, catalogues de ports, schéma SQL, payloads, listes de
  routes) vit dans un **TAD** ou dans le **code**, jamais dupliqué dans un ADR ni le SAD, qui le
  référencent.

## Discipline de rédaction (nature de chaque document)

Chaque document a une **nature** ; la respecter évite qu'il gonfle et se périme.

- **SAD = cible, pas histoire.** Le SAD décrit l'architecture **visée**, au présent — jamais ce qui
  était fait avant, ni le chemin parcouru. Le seul endroit où « ce qui était fait avant » peut
  apparaître est la rubrique **« Options écartées »** d'un ADR (valeur : expliquer *pourquoi pas*).
  Interdit : empiler des « Correction (a)(b)(c)… » chronologiques dans un ADR — fusionner dans la
  décision cible. Titre d'ADR orienté cible (« X écarté, Y retenu »), pas historique (« X tenté
  puis abandonné »).
- **Ne pas paraphraser le code.** Schéma SQL, signatures, trames d'octets, listes de routes ont leur
  foyer dans le code (entités EF, endpoints, catalogues). Les documents les **référencent**, ne les
  recopient pas — c'est la règle suprême zéro-duplication appliquée au couple doc/code.
- **Historique d'exploration** (essais, captures réseau, reverse engineering) → [`investigations/`](investigations/),
  jamais le SAD.

## Précédence (une info = un seul foyer)

Vision → [`../README.md`](../README.md) · Besoin → `SPECS.md` · Solution technique → `SAD.md` ·
Plan d'exécution → `BACKLOG.md` · Mode d'emploi → **l'écran lui-même** (ADR-53).

Chaque document décrit son propre rôle dans son en-tête. En cas de doute, remonter au bon niveau :
vision → besoin → architecture → exécution → usage. Ne jamais recopier une info d'un document à
l'autre — voir la règle suprême zéro-duplication dans [`../CLAUDE.md`](../CLAUDE.md).

## Git

- Branches : `main` (stable), `dev` (intégration), `feature/*` (travail).
- PR : review + tests au vert obligatoires.

### Commits et PR — anglais, format conventionnel

Un commit et une PR s'adressent à l'outillage et aux tiers, pas aux documents de cadrage : ils
suivent donc la langue du code, **l'anglais**, et le format [Conventional
Commits](https://www.conventionalcommits.org/en/v1.0.0/) — sujet, corps, titre et description de PR
compris. Les documents de cadrage (`docs/`) restent en français, voir la précédence ci-dessus.

```
type(scope): subject à l'impératif, minuscule, sans point final (≤ 72 caracteres)

Le corps dit le *pourquoi* : ce que le diff ne montre pas. Une ligne vide le
sépare du sujet. ASCII uniquement.

Co-Authored-By: …
```

- **type** : `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`. Un changement
  cassant s'écrit `type(scope)!: …`.
- **scope** : la zone touchée, optionnelle mais préférée — `api`, `dashboard`, `e2e`, `docs`,
  `frigate`, `ptz`… Un seul, celui qui porte le changement.
- **sujet** : l'effet obtenu, pas la mécanique employée. « ce que ça change pour qui lit », jamais
  « ajoute une méthode X ».
- **PR** : titre au même format que le sujet de commit, description en anglais — le *pourquoi*, le
  périmètre, et ce qui a été vérifié.
