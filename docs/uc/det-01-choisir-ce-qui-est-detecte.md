# UC-DET-01 · Choisir ce qui est détecté

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux choisir quels types de detection doivent generer des evenements utiles, afin d'adapter le systeme a mon contexte (personnes, animaux, vehicules, etc.). |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : seules les catégories choisies génèrent des événements, une fois les changements repris par la surveillance (UI-14).

**Résultats en échec** : la surveillance ne reprend pas les réglages enregistrés, et l'interface le signale (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Activer ou désactiver une catégorie | Nominal | Le propriétaire ouvre le réglage de la détection |
| E1 | La surveillance ne reprend pas le réglage | Échec | Le redémarrage de la surveillance échoue |

## Détail des chemins

### N1 · Activer ou désactiver une catégorie

1. Le propriétaire ouvre le réglage de la détection, à son emplacement prévisible (UI-07).
2. Il active ou désactive des catégories (DET-04, DET-05), voit ce qu'il a modifié et enregistre (UI-11).
3. Il applique les changements en quittant les réglages (UI-13, UC-UI-02).

### E1 · La surveillance ne reprend pas le réglage

1. L'interface le signale de façon persistante et permet de réessayer (UI-17).

## Règles locales

- **DET-04** · l'utilisateur doit pouvoir configurer les types de detection Frigate pris en compte dans le flux produit ;
- **DET-05** · la configuration doit permettre au minimum d'activer ou desactiver des categories comme les personnes, animaux ou vehicules selon les capacites fournies par Frigate.

## Points ouverts

Aucun.
