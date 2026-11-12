# UC-DET-02 · Confirmer ou corriger une reconnaissance

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir confirmer ou corriger une reconnaissance, afin d'ameliorer la qualite du systeme dans le temps. |

## Conditions

**Préalables** :

- un événement reconnu ou incertain est dans l'historique (DET-02, DET-03, UC-HIST-01).

**Résultat en succès** : la reconnaissance porte l'identité que l'utilisateur a confirmée ou corrigée.

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Corriger une reconnaissance | Nominal | L'identité estimée n'est pas la bonne |
| A1 | Confirmer une reconnaissance | Alternative | L'identité estimée, ou incertaine, est la bonne |

## Détail des chemins

### N1 · Corriger une reconnaissance

1. L'utilisateur ouvre l'événement, qui dit l'identité estimée, ou qu'elle est incertaine (DET-02, DET-03).
2. Il la corrige depuis un parcours simple (DET-06).

### A1 · Confirmer une reconnaissance

1. L'utilisateur confirme l'identité estimée depuis le même parcours (DET-06).

## Règles locales

- **DET-06** · l'utilisateur doit pouvoir corriger une reconnaissance depuis un parcours simple.

## Points ouverts

Aucun.
