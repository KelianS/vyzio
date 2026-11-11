# UC-CAM-02 · Détecter automatiquement les protocoles et les capacités

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux que les fonctionnalites avancees (PTZ, mode vie privee materiel, etc.) ne dependent pas de la marque de ma camera mais de ce qu'elle sait reellement faire, afin de ne pas etre prive d'une fonctionnalite uniquement parce que Vyzio ne connait pas ma marque. **En tant qu'utilisateur**, je veux que Vyzio teste reellement une capacite avant de me la proposer (ex. sonder le PTZ), afin de ne jamais me laisser activer une option qui ne fonctionnera pas sur ma camera. |

## Conditions

**Préalables** :

- la caméra existe (UC-CAM-01) et sa page est ouverte sur « Connexion » (CAM-03).

**Résultat en succès** : les protocoles qui répondent sont gardés, le flux vidéo est choisi s'il manquait, et chaque capacité que la caméra prouve, ou qu'elle laisse à confirmer, a sa carte (CAM-23).

**Résultats en échec** :

- la carte du flux vidéo demande le chemin du flux (E1) ;
- les capacités dont le protocole ne répond pas sont en échec, en le disant (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Détecter automatiquement | Nominal | L'utilisateur choisit « Détecter automatiquement », ou la page le lance à l'arrivée (CAM-40) |
| A1 | Rechercher les protocoles seulement | Alternative | L'utilisateur choisit « Rechercher les protocoles » dans Avancé |
| A2 | Une capacité reste à confirmer | Alternative | Un protocole répond avec le compte mais aucune lecture ne prouve la capacité |
| E1 | La caméra ne liste pas ses flux en RTSP | Échec | Aucun protocole ne convient pour le flux vidéo faute de liste de flux |
| E2 | Un protocole ne répond pas | Échec | Le protocole d'une capacité ne répond pas avec le compte |

## Détail des chemins

### N1 · Détecter automatiquement

1. L'utilisateur choisit « Détecter automatiquement », sous les capacités (CAM-43).
2. Vyzio cherche les protocoles habituels de la caméra, demande à chacun s'il répond avec son compte et garde ceux qui répondent (CAM-19).
3. Si la caméra n'a pas de flux vidéo, Vyzio le choisit (CAM-44).
4. Vyzio essaie chaque autre capacité sur les protocoles qui répondent, dans l'ordre fixe (CAM-42), et ne la garde que prouvée par une lecture (CAM-15).
5. Chaque capacité gardée a sa carte, avec ses mots d'état (CAM-21) ; Vyzio dit ce qui répond (CAM-40).

### A1 · Rechercher les protocoles seulement

1. L'utilisateur choisit « Rechercher les protocoles » dans Avancé.
2. Vyzio ajoute les protocoles habituels qui répondent et vérifie à nouveau ceux que la caméra a déjà, sans toucher à aucune capacité (CAM-43).

### A2 · Une capacité reste à confirmer

1. Un protocole répond avec le compte, mais aucune lecture ne peut prouver la capacité (CAM-16).
2. Vyzio garde sa carte « À confirmer » au lieu de la retirer (CAM-42) ; l'utilisateur la confirme par UC-CAM-04.

### E1 · La caméra ne liste pas ses flux en RTSP

1. Aucun protocole ne convient au flux vidéo parce que la caméra ne liste pas ses flux en RTSP (CAM-44).
2. La carte du flux vidéo le dit et demande le chemin du flux ; la détection reste possible tant que le flux n'est pas choisi.

### E2 · Un protocole ne répond pas

1. Le protocole d'une capacité ne répond pas avec le compte (CAM-19).
2. La capacité est en échec, en le disant, et sa carte dit comment en sortir (CAM-24).

## Règles locales

- **CAM-42** · la detection automatique essaie, pour chaque capacite autre que le flux video (son ordre : CAM-44), les protocoles dans un ordre fixe, le meme pour toute camera, les protocoles proprietaires d'abord (ex. sur une V380, l'orientation passe par son protocole avant ONVIF, meme si ONVIF la prouve par une lecture) ; elle garde le premier protocole, dans cet ordre, qui la prouve, ou sur lequel elle est a confirmer, et passe au suivant quand la capacite y manque ou y echoue : quand le protocole a repondu avec le compte et qu'aucune lecture ne peut prouver la capacite, la detection la garde en carte « à confirmer » au lieu de la retirer, et pour une camera sans ce materiel l'utilisateur repond « Non » une seule fois ; une capacite a laquelle l'utilisateur a repondu non n'est remplacee que par une preuve ; l'utilisateur change a la main le protocole de chaque capacite, et la detection ne revient jamais sur ce choix ;
- **CAM-43** · « Détecter automatiquement », visible sous les capacites sans rien ouvrir, traite les deux niveaux dans l'ordre : il cherche les protocoles habituels de la camera et garde ceux qui repondent, puis choisit le flux video s'il manque et les capacites ; « Rechercher les protocoles », dans Avance, cherche les protocoles de la meme facon sans toucher a aucune capacite : il ajoute les protocoles habituels qui repondent et verifie a nouveau ceux que la camera a deja, qu'il garde tous ;
- **CAM-44** · une camera sans flux video choisi le recoit de « Détecter automatiquement » : Vyzio essaie RTSP puis DVRIP, parmi les protocoles qui repondent (RTSP seulement si la camera y liste ses flux), et garde le premier dont le flux est verifie, ou a defaut le premier qui repond, avec la raison de l'echec ; quand aucun ne convient parce que la camera ne liste pas ses flux en RTSP, la carte du flux le dit et demande le chemin du flux ; la detection reste donc possible tant que le flux n'est pas choisi.

## Points ouverts

Aucun.
