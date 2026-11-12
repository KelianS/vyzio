# UC-CAM-05 · Choisir les flux d'une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux choisir sur quel flux de ma camera l'analyse est faite, en voyant la resolution de chaque flux et ce que le choix change, afin d'arbitrer moi-meme entre fluidite du systeme et reconnaissance des visages. |

## Conditions

**Préalables** :

- la caméra a un flux vidéo choisi (UC-CAM-02 ou UC-CAM-03) ;
- l'utilisateur a ouvert les options de la carte du flux vidéo (CAM-56).

**Résultat en succès** : le flux choisi sert à l'analyse, ou à l'enregistrement, aussitôt (CAM-56), et un seul flux enregistre (CAM-54).

**Résultats en échec** :

- la détection ne fonctionne plus, et la carte le dit en laissant le choix à l'utilisateur (E1) ;
- le flux ajouté n'est pas vérifié, et sa ligne le dit (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Choisir le flux d'analyse | Nominal | L'utilisateur donne le rôle de détection à un flux |
| A1 | Ajouter un flux que la caméra sert | Alternative | L'utilisateur ajoute un flux parmi ceux que la caméra dit servir |
| A2 | Ajouter un flux RTSP par son chemin | Alternative | La caméra ne liste pas ses flux, ou le flux voulu n'y est pas |
| A3 | Retirer un flux | Alternative | L'utilisateur retire une ligne de flux |
| A4 | Changer le protocole du flux vidéo | Alternative | L'utilisateur choisit un autre protocole dans les options de la carte |
| E1 | Le flux de détection échoue | Échec | Le flux qui détecte ne répond plus |
| E2 | Le flux ajouté échoue à sa vérification | Échec | Le flux ajouté ne répond pas |

## Détail des chemins

### N1 · Choisir le flux d'analyse

1. Vyzio présente chaque flux, avec sa résolution, son rôle et son état (CAM-51), et explique ce que le choix change (CAM-52) ; le défaut est annoncé comme tel (CAM-53).
2. L'utilisateur donne le rôle de détection à un flux, sur le flux lui-même.
3. Le rôle passe aussitôt à ce flux et quitte celui qui l'avait (CAM-54, CAM-56) ; les enregistrements n'en sont pas dégradés (CAM-55).

### A1 · Ajouter un flux que la caméra sert

1. L'utilisateur choisit un flux parmi ceux que la caméra dit servir à ce moment, lus par qualité (CAM-57).
2. Vyzio le vérifie aussitôt et ajoute sa ligne, avec le rôle « Aucun » tant qu'il ne sert à rien (CAM-56).

### A2 · Ajouter un flux RTSP par son chemin

1. L'utilisateur saisit le chemin du flux (CAM-57, CAM-58).
2. Le chemin reprend à A1, pas 2.

### A3 · Retirer un flux

1. L'utilisateur retire une ligne de flux ; la confirmation dit, pour le flux qui détecte, que la détection passe sur le flux qui enregistre (CAM-56).
2. Le flux est retiré aussitôt et ne reviendra pas de lui-même (CAM-58) ; le flux qui enregistre ne peut pas l'être tant qu'un autre n'a pas pris son rôle (CAM-54).

### A4 · Changer le protocole du flux vidéo

1. L'utilisateur choisit un autre protocole ; le choix dit, avant de s'appliquer, qu'il remplace tous les flux (CAM-58).
2. Vyzio teste aussitôt le flux vidéo sur ce protocole (CAM-23).

### E1 · Le flux de détection échoue

1. Le flux qui détecte ne répond plus ; l'analyse ne se déplace pas d'elle-même.
2. La carte le dit et laisse le choix à l'utilisateur (CAM-55).

### E2 · Le flux ajouté échoue à sa vérification

1. Le flux ajouté ne répond pas : sa ligne le dit « En échec » (CAM-21), et un chemin erroné se corrige en ajoutant le bon flux (CAM-57).

## Règles locales

- **CAM-51** · lorsqu'une camera expose plusieurs flux de la meme scene, le produit doit les presenter chacun avec sa resolution quand elle est connue, son role (enregistrement, detection, les deux, ou aucun) et son propre etat, et laisser l'utilisateur choisir, sur le flux lui-meme, celui qui sert a l'analyse et celui qui enregistre ;
- **CAM-52** · ce choix doit etre accompagne d'une explication de ce qu'il change concretement (fluidite du systeme d'un cote, finesse de l'image analysee, donc reconnaissance des visages, vignette et images des notifications, de l'autre ; finesse des enregistrements pour le flux qui enregistre) ; il n'est jamais impose silencieusement ;
- **CAM-53** · par defaut, c'est le flux le plus leger qui est analyse et le plus detaille qui enregistre : le moteur de detection reduit l'image de toute facon, donc analyser un flux tres detaille coute des ressources sans rien apporter ; ce defaut doit etre annonce comme tel dans l'interface, et le flux detaille doit rester accessible en un geste pour qui veut privilegier la reconnaissance des visages ;
- **CAM-54** · il y a toujours exactement un flux qui enregistre : ce flux ne peut etre ni retire, ni prive de ce role tant qu'un autre flux ne l'a pas pris ; donner un role a un flux le retire au flux qui l'avait ;
- **CAM-55** · quand plus aucun flux n'a le role de detection (retire ou prive de ce role), l'analyse se fait sur le flux qui enregistre, et la carte du flux video le dit ; un flux de detection en echec ne deplace pas l'analyse de lui-meme : la carte dit que la detection ne fonctionne plus et laisse le choix a l'utilisateur ; le choix du flux d'analyse ne doit jamais degrader les enregistrements ;
- **CAM-57** · l'utilisateur ajoute un flux, verifie aussitot, parmi ceux que la camera dit servir a ce moment, lus par qualite et non par chemin, ou en RTSP en saisissant son chemin ; le chemin d'un flux est son identite et ne change jamais : un chemin errone se corrige en ajoutant le bon flux ;
- **CAM-58** · les flux sont trouves une fois, puis la liste appartient a l'utilisateur : un flux retire ne revient pas de lui-meme ; changer le protocole du flux video remplace tous les flux, ce que le choix du protocole dit avant de s'appliquer, et en RTSP un flux a toujours un chemin, saisi par l'utilisateur quand la camera ne liste pas ses flux ou ne repond pas (voir [ADR-65](../adr/0065-each-video-stream-is-a-checked-object-with-a-role-under-the-stream-binding.md)).

## Points ouverts

Aucun.
