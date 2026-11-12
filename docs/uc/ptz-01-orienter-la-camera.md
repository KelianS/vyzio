# UC-PTZ-01 · Orienter la caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir contrôler ma caméra PTZ directement depuis la vue live, sans passer par un menu de configuration, afin de réorienter la caméra facilement au quotidien. |

## Conditions

**Préalables** :

- la vue en direct de la caméra est ouverte (UC-LIVE-01).

**Résultat en succès** : la caméra tourne dans le sens de la flèche pressée.

**Résultats en échec** :

- aucune commande : une ligne dit pourquoi et renvoie à la page « Connexion » de la caméra (E1) ;
- les commandes sont suspendues, avec un message explicite (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Orienter la caméra depuis le direct | Nominal | L'utilisateur presse une flèche du pilotage |
| A1 | Aller à une position enregistrée | Alternative | L'utilisateur touche une position |
| A2 | Inverser gauche et droite | Alternative | La caméra tourne à l'envers de la flèche pressée |
| E1 | L'orientation ne fonctionne pas | Échec | L'orientation n'est ni prouvée, ni confirmée, ou elle est désactivée |
| E2 | La caméra est hors ligne | Échec | La caméra cesse de répondre |

## Détail des chemins

### N1 · Orienter la caméra depuis le direct

1. L'utilisateur trouve le pilotage dans la vue en direct (PTZ-01), parce que l'orientation fonctionne (PTZ-02).
2. Il presse une flèche : la caméra tourne dans ce sens.

### A1 · Aller à une position enregistrée

1. L'utilisateur touche une position : la caméra s'y rend (UC-PTZ-02 A1).

### A2 · Inverser gauche et droite

1. La caméra tourne à l'envers de la flèche pressée.
2. L'utilisateur inverse gauche et droite sur la capacité d'orientation de la caméra (PTZ-03).

### E1 · L'orientation ne fonctionne pas

1. L'orientation n'est ni prouvée, ni confirmée par l'utilisateur (CAM-21).
2. Aucune commande inerte : une ligne renvoie vers la page « Connexion » de la caméra, où sa carte dit pourquoi et comment en sortir (PTZ-02, CAM-24) ; une orientation désactivée n'y laisse rien.

### E2 · La caméra est hors ligne

1. Les commandes sont suspendues, avec un message explicite (CAM-08).

## Règles locales

- **PTZ-01** · les contrôles PTZ doivent être accessibles depuis la vue live de la caméra (pas seulement depuis les paramètres) : c'est le parcours d'usage quotidien ;
- **PTZ-03** · certaines caméras tournent à l'envers de la flèche pressée (leur firmware inverse le sens horizontal) : l'utilisateur peut inverser gauche et droite sur la capacité PTZ de la caméra ; Vyzio ne devine pas ce sens, et le réglage ne change ni le haut et le bas, ni les positions enregistrées.

## Points ouverts

Aucun.
