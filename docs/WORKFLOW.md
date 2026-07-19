# Workflow & gouvernance documentaire

Source de vérité du processus de travail du repo. Tout changement significatif suit cet ordre ;
interdiction de commencer l'implémentation tant que les étapes documentaires amont ne sont pas alignées.

## Ordre imposé

1. **SPECS** ([`SPECS.md`](SPECS.md)) — si le besoin produit change : user stories, parcours, périmètre MVP.
2. **SAD** ([`SAD.md`](SAD.md)) — si la solution technique ou les frontières changent : composants, responsabilités, ADR.
3. **BACKLOG** ([`BACKLOG.md`](BACKLOG.md)) — ordre d'exécution, découpage, dépendances, gates de validation.
4. **Implémentation** — code minimal, cohérent avec les documents validés.
5. **Tests** — validation ciblée obligatoire du slice modifié.
6. **Doc utilisateur** ([`user/`](user/)) — toute feature livrable est documentée pour l'usage réel.

## Règles pratiques

- Une feature qui ne modifie ni besoin, ni architecture, ni plan → directement implémentation puis tests.
- Une feature qui contredit un document existant → mettre le document à jour **avant** d'écrire le code.
- Le backlog ne sert jamais à découvrir la stratégie après coup ; il traduit une stratégie déjà décidée dans les SPECS et/ou le SAD.
- Aucune PR n'est propre si le code est à jour mais la documentation de cadrage en retard.

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
Plan d'exécution → `BACKLOG.md` · Mode d'emploi → `user/`.

Chaque document décrit son propre rôle dans son en-tête. En cas de doute, remonter au bon niveau :
vision → besoin → architecture → exécution → usage. Ne jamais recopier une info d'un document à
l'autre — voir la règle suprême zéro-duplication dans [`../CLAUDE.md`](../CLAUDE.md).

## Git

- Branches : `main` (stable), `dev` (intégration), `feature/*` (travail).
- PR : review + tests au vert obligatoires.
