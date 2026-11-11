# UC-PRIV-02 · Choisir la stratégie de vie privée d'une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur avec une caméra PTZ**, je veux qu'elle pivote physiquement à l'activation du mode vie privée, afin d'avoir un signal visuel et physique que la caméra ne capture plus ma pièce. **En tant qu'utilisateur**, je veux choisir la stratégie de mode vie privée pour chaque caméra (logiciel, parking PTZ, ou cache matériel si disponible), afin d'adapter le niveau de protection aux capacités de chaque modèle. |

## Conditions

**Préalables** :

- la caméra existe ; son écran « Vie privée » est ouvert (CAM-03). Le mode vie privée se règle sans flux (PRIV-18).

**Résultat en succès** : la stratégie choisie est enregistrée (PRIV-10), et l'écran vie privée dit ce qu'elle fait (PRIV-16).

**Résultats en échec** :

- la stratégie voulue reste grisée, avec la raison et l'endroit où y remédier (E1) ;
- le parking attend que les positions aient pu être lues (E2) ;
- la stratégie choisie ne peut plus agir, et l'écran dit ce qui manque et ce qui reste garanti (E3).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Choisir une stratégie disponible | Nominal | L'utilisateur choisit l'arrêt logiciel ou la coupure matérielle |
| A1 | Choisir le parking | Alternative | L'utilisateur choisit `ptz_parking` |
| E1 | La stratégie ne peut pas encore être choisie | Échec | Il manque à la caméra la capacité ou les positions que la stratégie demande |
| E2 | Les positions ne peuvent pas être lues | Échec | La caméra ne répond pas à la lecture de ses positions |
| E3 | La stratégie choisie ne peut plus agir | Échec | Une position ou la capacité manque après coup |

## Détail des chemins

### N1 · Choisir une stratégie disponible

1. L'écran liste les stratégies (PRIV-10), l'arrêt logiciel par défaut (PRIV-11).
2. L'utilisateur choisit l'arrêt logiciel, ou la coupure matérielle quand elle est vérifiée (PRIV-15), puis enregistre (UI-11).
3. L'écran dit ce que fait la stratégie choisie (PRIV-16).

### A1 · Choisir le parking

1. L'utilisateur choisit `ptz_parking`, possible une fois l'orientation vérifiée et activée et les positions Surveillance et Parking enregistrées (PRIV-15, UC-PTZ-02).
2. L'interface affiche l'avertissement avant d'enregistrer le choix (PRIV-17).
3. Le chemin reprend à N1, pas 3 ; le parking s'ajoute à l'arrêt logiciel (PRIV-12).

### E1 · La stratégie ne peut pas encore être choisie

1. Il manque à la caméra la capacité vérifiée ou les positions que la stratégie demande.
2. La stratégie reste dans la liste, grisée, avec la raison et l'endroit où y remédier (PRIV-15) ; l'écran mène à ce qui manque (PRIV-18).

### E2 · Les positions ne peuvent pas être lues

1. La caméra ne répond pas à la lecture de ses positions.
2. L'écran vie privée le dit : un parking déjà choisi est gardé, et le choisir attend que les positions aient pu être lues (PTZ-08).

### E3 · La stratégie choisie ne peut plus agir

1. Une position ou la capacité que demande la stratégie manque.
2. L'écran dit ce qui manque et ce qui reste garanti en attendant, sans promettre son effet (PRIV-16).

## Règles locales

- **PRIV-15** · l'option `ptz_parking` ne peut être choisie que si l'orientation de la caméra est vérifiée et activée (capacité détectée automatiquement sur la page de la caméra et configurable manuellement) et une fois les positions Surveillance (preset 1) et Parking (preset 2) enregistrées ; l'option `hardware` ne peut être choisie que si la coupure matérielle de la caméra est vérifiée (CAM-15, CAM-16) ; une stratégie qui ne peut pas encore être choisie reste dans la liste, grisée, avec la raison et l'endroit où y remédier (enregistrer les positions, vérifier ou essayer la capacité), jamais retirée ([DESIGN SYSTEM](../DESIGN%20SYSTEM.md) § Settings screens) ;
- **PRIV-16** · l'écran vie privée ne dit que ce que fait la stratégie choisie ; quand celle-ci ne peut plus agir (positions ou capacité manquantes), il dit ce qui manque et ce qui reste garanti en attendant, sans promettre son effet ;
- **PRIV-17** · lorsque l'utilisateur sélectionne la stratégie `ptz_parking`, l'interface doit afficher un avertissement explicite précisant que le flux vidéo reste techniquement accessible sur le réseau local — seul Vyzio est désactivé et la caméra pivote vers sa position Parking ; cet avertissement est un pré-requis non négociable avant d'enregistrer le choix ;
- **PRIV-18** · la page de la caméra propose le mode vie privée et les positions Surveillance et Parking dès l'ajout, sans étape d'ajout dédiée ; le mode vie privée se règle sans flux ; seules attendent les stratégies qui demandent une capacité vérifiée (CAM-08 suspend les vérifications tant que le flux ne fonctionne pas), et le parking PTZ, dont les positions s'enregistrent depuis la vue live, qui ne s'ouvre qu'une fois la caméra en surveillance : l'écran vie privée et l'écran de pilotage le disent et mènent à ce qui manque, la connexion tant que le flux ne fonctionne pas, puis le déclencheur de redémarrage ; une orientation à confirmer s'essaie d'abord depuis sa carte (UC-CAM-04), puis ses positions se règlent depuis la vue live.

## Points ouverts

Aucun.
