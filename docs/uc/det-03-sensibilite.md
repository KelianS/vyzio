# UC-DET-03 · Laisser Vyzio régler la sensibilité, ou la figer

| Champ | Valeur |
| --- | --- |
| **Acteur** | Vyzio, qui ajuste ; le propriétaire, qui lit et fige |
| **Objectif** | **En tant qu'utilisateur**, je veux que Vyzio se regle tout seul sur une scene agitee (feuillage, route passante), afin de ne pas avoir a comprendre ce qu'est un « reglage de mouvement » pour que le systeme reste fluide. **En tant qu'utilisateur**, je veux savoir pourquoi une camera a ete rendue moins sensible et pouvoir figer ce reglage, afin de garder la main si le choix automatique ne me convient pas. |

## Conditions

**Préalables** :

- la caméra est en surveillance (CAM-05).

**Résultat en succès** : la caméra garde une sensibilité qui laisse le système fluide, et l'utilisateur lit son niveau et sa raison (DET-09).

**Résultats en échec** : aucun propre à ce cas ; l'ajustement ne descend jamais sous le niveau le plus bas prévu (DET-10).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Vyzio ajuste la sensibilité | Nominal | L'agitation observée sur la scène change |
| A1 | Lire le niveau et sa raison | Alternative | Le propriétaire ouvre le réglage de la détection de la caméra |
| A2 | Figer le niveau | Alternative | Le choix automatique ne convient pas au propriétaire |

## Détail des chemins

### N1 · Vyzio ajuste la sensibilité

1. Vyzio observe l'agitation réelle de la scène et ajuste la sensibilité de la caméra (DET-07), dans ses trois niveaux (DET-08), sans interruption visible du service (DET-11).

### A1 · Lire le niveau et sa raison

1. Le propriétaire lit le niveau courant de la caméra et sa raison (DET-09).

### A2 · Figer le niveau

1. Le propriétaire fige le niveau de la caméra : l'ajustement automatique cesse pour elle (DET-09).

## Règles locales

- **DET-07** · la sensibilite de detection s'ajuste automatiquement, par camera, en fonction de l'agitation reellement observee sur la scene ; l'utilisateur n'a aucun reglage technique a fournir ;
- **DET-08** · la sensibilite s'exprime en trois niveaux comprehensibles (elevee / moyenne / reduite) — jamais en valeur technique ni en vocabulaire Frigate ;
- **DET-09** · le niveau courant et sa raison doivent etre lisibles par l'utilisateur, qui doit pouvoir **figer** le niveau d'une camera pour desactiver l'ajustement automatique sur celle-ci ;
- **DET-10** · l'ajustement automatique poursuit un objectif de fluidite, jamais de qualite de detection : il ne doit jamais descendre en dessous du niveau le plus bas prevu, et ce compromis doit etre assume explicitement ;
- **DET-11** · l'ajustement ne doit provoquer aucune interruption visible du service (pas de coupure du flux ni des enregistrements).

## Points ouverts

Aucun.
