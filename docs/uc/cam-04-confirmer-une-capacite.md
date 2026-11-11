# UC-CAM-04 · Confirmer une capacité qu'aucune lecture ne prouve

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | Faire fonctionner une capacité que la caméra ne permet pas de prouver par une lecture (CAM-16), en l'essayant et en disant ce qui s'est passé. |

## Conditions

**Préalables** :

- la capacité est « À confirmer » sur sa carte (CAM-21) ;
- la caméra n'est pas en mode vie privée, et la vérification de son flux passe (CAM-16).

**Résultat en succès** : la capacité « Fonctionne », confirmée par l'utilisateur à cette date (CAM-21).

**Résultats en échec** :

- la capacité est « Non confirmée » : inutilisée, sans être en panne, et sa carte dit comment en sortir (A1) ;
- l'essai n'a pas lieu (E1, E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Essayer la capacité et répondre oui | Nominal | L'utilisateur choisit d'essayer la capacité depuis sa carte |
| A1 | Répondre non | Alternative | La caméra n'a ni bougé ni coupé pendant l'essai |
| A2 | Essayer à nouveau | Alternative | L'utilisateur choisit « Essayer à nouveau » sur une capacité non confirmée |
| A3 | Passer par un autre protocole ou retirer la capacité | Alternative | L'utilisateur choisit une autre sortie sur une capacité non confirmée |
| E1 | L'essai est refusé en mode vie privée | Échec | La caméra est en mode vie privée |
| E2 | L'essai attend le flux | Échec | La vérification du flux de la caméra ne passe pas |

## Détail des chemins

### N1 · Essayer la capacité et répondre oui

1. L'utilisateur choisit d'essayer la capacité depuis sa carte.
2. Vyzio annonce ce qui va se passer, puis fait l'essai (CAM-49, CAM-28).
3. Vyzio pose la question ; l'utilisateur répond oui.
4. La capacité est vérifiée, confirmée par lui à cette date (CAM-16).

### A1 · Répondre non

1. L'utilisateur répond non.
2. La capacité est « Non confirmée » ; Vyzio retient cette réponse (CAM-16), et la carte rappelle ce que l'utilisateur a dit avoir vu (CAM-24) et comment en sortir (CAM-50).

### A2 · Essayer à nouveau

1. L'utilisateur choisit « Essayer à nouveau » ; la capacité redevient « À confirmer » tant que la question n'a pas de réponse (CAM-21).
2. Le chemin reprend à N1, pas 2.

### A3 · Passer par un autre protocole ou retirer la capacité

1. L'utilisateur change le protocole de la capacité (UC-CAM-03 A2), ou la retire (CAM-50).

### E1 · L'essai est refusé en mode vie privée

1. La caméra est en mode vie privée : l'essai est refusé (CAM-16).

### E2 · L'essai attend le flux

1. La vérification du flux de la caméra ne passe pas : l'essai est suspendu, avec sa raison (CAM-08).

## Règles locales

- **CAM-49** · l'utilisateur essaie une capacite a confirmer depuis sa carte : Vyzio annonce ce qui va se passer, puis fait tourner la camera un peu et la ramene, ou la coupe, le temps de CAM-28, puis l'utilisateur repond a une question simple (« La caméra a bougé ? ») ;
- **CAM-50** · apres un non, la carte dit comment en sortir : l'essayer a nouveau, volontairement, ce qui repose la question, ou passer par un autre protocole, ou la retirer (ajoutee de nouveau a la main, elle repart a confirmer).

## Points ouverts

Aucun.
