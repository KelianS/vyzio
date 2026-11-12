# UC-PROF-01 · Ajouter une personne à reconnaître

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux ajouter une personne a reconnaitre a partir d'une ou plusieurs photos. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : le profil existe, avec son nom, ses données de référence et sa politique de notification (PROF-02) ; il reste modifiable et supprimable (PROF-01).

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Créer un profil à partir de photos | Nominal | Le propriétaire ajoute une personne |

## Détail des chemins

### N1 · Créer un profil à partir de photos

1. Le propriétaire ajoute une personne : son nom, une ou plusieurs photos, et sa politique de notification (PROF-02, UC-PROF-02).
2. Il enregistre ; Vyzio la reconnaît ensuite sur les caméras (DET-02).

## Règles locales

- **PROF-02** · un profil doit contenir au minimum un nom, des donnees de reference suffisantes et une politique de notification.

## Points ouverts

Aucun.
