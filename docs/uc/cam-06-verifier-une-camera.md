# UC-CAM-06 · Vérifier une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux verifier rapidement le flux d'une camera depuis l'interface, afin de confirmer que tout fonctionne. **En tant qu'utilisateur**, je veux etre informe si une camera devient indisponible, afin de savoir que la surveillance n'est plus fiable. |

## Conditions

**Préalables** :

- la caméra existe et sa page est ouverte sur « Connexion » (CAM-03).

**Résultat en succès** : la carte vérifiée dit « Fonctionne » (CAM-21), et le protocole vérifié « Accessible » (CAM-22).

**Résultats en échec** :

- la capacité est « En échec », et sa carte dit comment en sortir (E1, E2) ;
- la caméra est hors ligne : ce qui demande une connexion active est suspendu, avec un message explicite (E3).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Vérifier la carte du flux vidéo | Nominal | L'utilisateur vérifie la carte du flux vidéo |
| A1 | Vérifier une ligne de flux | Alternative | L'utilisateur vérifie une seule ligne de flux |
| A2 | Vérifier un protocole | Alternative | L'utilisateur vérifie un protocole dans Avancé |
| A3 | Vérifier une autre capacité | Alternative | L'utilisateur vérifie la carte d'une autre capacité |
| E1 | La capacité échoue | Échec | La vérification ne prouve pas la capacité |
| E2 | Le flux vidéo ne répond pas | Échec | La vérification du flux vidéo échoue |
| E3 | La caméra est hors ligne | Échec | La caméra cesse de répondre |

## Détail des chemins

### N1 · Vérifier la carte du flux vidéo

1. L'utilisateur vérifie la carte du flux vidéo ; c'est une action, qui prend effet tout de suite (UI-16).
2. Vyzio demande une seule fois à chaque protocole s'il répond avec son compte (CAM-19), puis vérifie la caméra et tous ses flux (CAM-56).
3. La carte dit son état avec ses mots (CAM-21).

### A1 · Vérifier une ligne de flux

1. L'utilisateur vérifie une ligne de flux : Vyzio vérifie ce seul flux, sauf pour le flux qui enregistre, dont la vérification est celle de la caméra (CAM-56).

### A2 · Vérifier un protocole

1. L'utilisateur vérifie un protocole, sans passer par une capacité ; un flux en échec ne le suspend pas (CAM-23).
2. Le protocole dit son état (CAM-22).

### A3 · Vérifier une autre capacité

1. L'utilisateur vérifie une autre carte ; elle attend que la vérification du flux passe (CAM-08).
2. Vyzio la vérifie par une lecture (CAM-15), et la carte dit son état (CAM-21).

### E1 · La capacité échoue

1. La vérification ne prouve pas la capacité : elle n'est pas présentée comme disponible (CAM-14).
2. Sa carte dit comment en sortir (CAM-24).

### E2 · Le flux vidéo ne répond pas

1. La vérification du flux vidéo échoue.
2. La carte nomme les deux endroits où cela se corrige (CAM-24), et les autres capacités attendent (CAM-08).

### E3 · La caméra est hors ligne

1. La caméra cesse de répondre (CAM-07, CAM-27).
2. Son état le dit partout où il s'affiche, et ce qui demande une connexion active est suspendu, avec un message explicite (CAM-08).

## Règles locales

Aucune.

## Points ouverts

Aucun.
