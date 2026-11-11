# UC-SEC-01 · Supprimer ou exporter ses données

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir supprimer ou exporter mes donnees, afin de garder le controle. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : les données que le propriétaire a choisi de supprimer ont disparu (SEC-05).

**Résultats en échec** : ceux du parcours de suppression suivi (UC-HIST-03, UC-PROF-04).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Supprimer une détection | Nominal | Le propriétaire veut effacer une scène |
| A1 | Supprimer un profil | Alternative | Le propriétaire veut effacer une personne et ses données |

## Détail des chemins

### N1 · Supprimer une détection

1. Le propriétaire supprime la détection, une à une, depuis l'historique (SEC-05, UC-HIST-03).

### A1 · Supprimer un profil

1. Le propriétaire supprime le profil et ses données liées (UC-PROF-04).

## Règles locales

- **SEC-05** · l'utilisateur doit pouvoir supprimer ses donnees produit dans un parcours comprensible ; une detection se supprime une a une depuis l'historique (UC-HIST-03).

## Points ouverts

| # | Question | Effet tant qu'elle reste ouverte |
| --- | --- | --- |
| 1 | Quel parcours exporte les données de l'utilisateur ? | L'objectif d'exporter ses données n'a aucun chemin |
