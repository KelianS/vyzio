# Cas d'utilisation, modèle et guide d'écriture

Un cas d'utilisation décrit **un objectif de l'utilisateur** et tous les chemins qui y mènent ou
qui échouent, du point de vue de l'utilisateur. Il est la suite de [SPECS](../SPECS.md), dont il
détaille un parcours : même nature (le *quoi*, jamais le *comment*), même langue, même discipline
(la cible au présent, DOCS-16). Ce qui vaut pour plusieurs cas, règle transverse ou niveau de
service, reste dans SPECS ; un cas le cite par son identifiant, sans le redire (DOCS-19).

## Écrire un cas

- **Un fichier par objectif**, `<domaine>-<nn>-<objet>.md` dans ce dossier, son titre
  `# UC-<DOMAINE>-<NN> · <objectif>`, et une ligne dans l'index de [SPECS](../SPECS.md). Les
  domaines sont ceux de SPECS § Identifiants, les numéros ne sont jamais recyclés (DOCS-18).
- **Objectif** : la ou les user stories qu'il sert, telles quelles.
- **Préalables** : ce qui est vrai avant que le cas commence, sans quoi il ne démarre pas. Un
  préalable n'est pas une règle.
- **Chemins** : un seul nominal `N1`, des alternatives `A1`, `A2`… qui réussissent autrement, des
  échecs `E1`, `E2`… qui n'atteignent pas l'objectif. Chaque chemin du tableau a son bloc de détail,
  avec le même identifiant et le même libellé, et réciproquement. On le cite `UC-CAM-01 A2`.
- **Détail d'un chemin** : des pas courts, « l'utilisateur… », « Vyzio… ». Un pas que régit une
  règle cite son identifiant au lieu de la redire.
- **Règles locales** : une contrainte que Vyzio applique, vérifiable, propre à ce seul cas, sous
  un identifiant `<DOMAINE>-NN` (DOCS-18). Une règle qu'un second cas doit citer remonte dans
  SPECS, avec son identifiant (DOCS-19).
- **Points ouverts** : une question sans réponse ; tranchée, elle devient une règle, un préalable
  ou un chemin.
- Ni composant, ni stockage, ni code d'erreur, ni numéro de version, ni issue : le SAD, les ADR et
  le code portent le reste.

## Modèle

```markdown
# UC-<DOMAINE>-<NN> · <objectif>

| Champ | Valeur |
| --- | --- |
| **Acteur** | <un rôle d'ACCESS-01, ou « l'utilisateur » quand les deux rôles le peuvent> |
| **Objectif** | <la ou les user stories, telles quelles> |

## Conditions

**Préalables** :

- <vrai avant le début du cas>

**Résultat en succès** : <ce qui est observable quand l'objectif est atteint>

**Résultats en échec** : <ce qui est observable quand aucun chemin ne réussit, un par chemin E>

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | <libellé> | Nominal | <ce qui le lance> |
| A1 | <libellé> | Alternative | <ce qui le lance> |
| E1 | <libellé> | Échec | <ce qui le lance> |

## Détail des chemins

### N1 · <libellé>

1. L'utilisateur …
2. Vyzio … (<ID de la règle qui le régit>)

### A1 · <libellé>

1. …

### E1 · <libellé>

1. …

## Règles locales

- **<DOMAINE>-NN** · <la contrainte>

## Points ouverts

Aucun.
```
