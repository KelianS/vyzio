# UC-PROF-02 · Régler les notifications d'une personne

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux choisir le comportement de notification associe a une personne, afin d'adapter le systeme a mon foyer. **En tant qu'utilisateur**, je veux n'etre notifie du passage d'une personne de mon foyer que sur certaines cameras, afin de ne pas etre derange la ou sa presence est normale. |

## Conditions

**Préalables** :

- la personne a un profil (UC-PROF-01).

**Résultat en succès** : les notifications de la personne suivent sa politique et ses caméras (PROF-03, PROF-04), sa reconnaissance et son historique restant les mêmes.

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Choisir la politique de notification | Nominal | Le propriétaire ouvre le profil de la personne |
| A1 | Limiter ses notifications à certaines caméras | Alternative | Le propriétaire coche des caméras sur le profil |

## Détail des chemins

### N1 · Choisir la politique de notification

1. Le propriétaire choisit la politique de notification de la personne, par exemple « ne pas me notifier » (PROF-03), puis enregistre (UI-11).

### A1 · Limiter ses notifications à certaines caméras

1. Le propriétaire coche les caméras où la personne est notifiée (PROF-04), puis enregistre.

## Règles locales

Aucune.

## Points ouverts

Aucun.
