# UC-CAM-07 · Nommer une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux nommer clairement chaque camera, afin de comprendre immediatement l'origine d'une notification. **En tant qu'utilisateur**, je veux qu'un boitier a plusieurs objectifs apparaisse comme plusieurs cameras que je nomme separement, afin de retrouver chaque angle de vue par son nom dans mes notifications. |

## Conditions

**Préalables** :

- la caméra existe (UC-CAM-01).

**Résultat en succès** : la caméra porte le nom choisi partout où elle apparaît, notifications comprises (NOTIF-03).

**Résultats en échec** : aucun ; tant que le nom n'est pas enregistré, l'ancien reste (UI-11).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Renommer une caméra | Nominal | L'utilisateur change le nom dans Avancé |
| A1 | Nommer chaque objectif d'un boîtier | Alternative | Le boîtier expose plusieurs objectifs |

## Détail des chemins

### N1 · Renommer une caméra

1. L'utilisateur ouvre Avancé sur « Connexion » et change le nom de la caméra (CAM-03, CAM-01).
2. Il voit ce qu'il a modifié, puis enregistre (UI-11, UI-12).

### A1 · Nommer chaque objectif d'un boîtier

1. Chaque objectif du boîtier est une caméra, reconnaissable comme appartenant au même appareil (CAM-02).
2. L'utilisateur nomme chacune par N1.

## Règles locales

Aucune.

## Points ouverts

Aucun.
