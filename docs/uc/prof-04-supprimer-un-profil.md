# UC-PROF-04 · Supprimer un profil

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux supprimer un profil et ses donnees associees, afin de rester maitre de mes donnees. |

## Conditions

**Préalables** :

- la personne a un profil (UC-PROF-01).

**Résultat en succès** : le profil et ses données liées sont supprimés (PROF-06).

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Supprimer un profil | Nominal | Le propriétaire supprime le profil depuis l'interface |

## Détail des chemins

### N1 · Supprimer un profil

1. Le propriétaire supprime le profil depuis l'interface (PROF-01) ; c'est une action, qui prend effet tout de suite (UI-16).
2. Vyzio supprime ses données liées (PROF-06).

## Règles locales

- **PROF-06** · la suppression d'un profil doit supprimer ses donnees liees selon la politique produit definie.

## Points ouverts

| # | Question | Effet tant qu'elle reste ouverte |
| --- | --- | --- |
| 1 | Quelles données liées la politique produit de PROF-06 supprime-t-elle avec le profil ? | Rien ne dit ce qui reste sur la machine après la suppression |
