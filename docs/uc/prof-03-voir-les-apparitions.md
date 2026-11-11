# UC-PROF-03 · Voir les dernières apparitions d'une personne

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, propriétaire ou résident (ACCESS-01) |
| **Objectif** | **En tant qu'utilisateur**, je veux voir la derniere apparition d'une personne connue, afin de garder un historique simple. |

## Conditions

**Préalables** :

- la personne a un profil (UC-PROF-01).

**Résultat en succès** : l'utilisateur voit les apparitions récentes de la personne (PROF-05).

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Consulter l'historique d'une personne | Nominal | L'utilisateur ouvre le profil de la personne |

## Détail des chemins

### N1 · Consulter l'historique d'une personne

1. L'utilisateur ouvre le profil de la personne et y lit ses apparitions récentes (PROF-05), quelle que soit sa politique de notification (PROF-03).

## Règles locales

- **PROF-05** · l'historique recent d'une personne connue doit etre consultable.

## Points ouverts

Aucun.
