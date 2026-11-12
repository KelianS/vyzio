# UC-DET-04 · Définir les zones utiles d'une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux definir des zones utiles sur l'image, afin d'ignorer les zones non pertinentes. |

## Conditions

**Préalables** :

- la caméra existe (UC-CAM-01).

**Résultat en succès** : la caméra a ses zones actives, une fois les changements repris par la surveillance (UI-14).

**Résultats en échec** : la surveillance ne reprend pas les réglages enregistrés, et l'interface le signale (UI-17).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Définir les zones actives | Nominal | Le propriétaire ouvre le réglage de la détection de la caméra |

## Détail des chemins

### N1 · Définir les zones actives

1. Le propriétaire définit une ou plusieurs zones actives sur l'image de la caméra (DET-12).
2. Il voit ce qu'il a modifié et enregistre (UI-11).

## Règles locales

- **DET-12** · l'utilisateur doit pouvoir definir plusieurs zones actives par camera.

## Points ouverts

Aucun.
