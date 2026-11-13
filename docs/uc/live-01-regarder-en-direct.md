# UC-LIVE-01 · Regarder une caméra en direct

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux voir ce que filme une camera en video fluide, avec le son quand elle en a, pour suivre ce qui se passe au moment ou ca se passe. **En tant qu'utilisateur sur mon telephone**, je veux que la vue en direct occupe tout l'ecran, pour voir l'image en grand et piloter la camera sans qu'une page reste autour. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : la vidéo de la caméra est à l'écran, sur son écran à elle (LIVE-07), proche de la scène (LIVE-01).

**Résultats en échec** :

- une image rafraîchie remplace la vidéo, avec la raison en une phrase (E1) ;
- aucune image : une phrase dit pourquoi et mène où cela se règle (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Ouvrir le direct depuis l'accueil | Nominal | L'utilisateur touche la vignette d'une caméra à l'accueil |
| A1 | Passer en haute qualité | Alternative | L'utilisateur choisit la haute qualité dans la barre |
| A2 | Activer le son | Alternative | L'utilisateur active le son dans la barre |
| A3 | Ouvrir le direct depuis la page de la caméra | Alternative | L'utilisateur ouvre le pilotage depuis la page de la caméra |
| A4 | Regarder en paysage | Alternative | L'utilisateur tourne son téléphone en paysage |
| A5 | Atteindre le direct par son adresse | Alternative | L'utilisateur ouvre l'adresse de la vue en direct |
| E1 | La vidéo ne peut pas être lue | Échec | Le navigateur ne lit pas la vidéo, ou le flux n'arrive pas |
| E2 | La caméra ne peut rien montrer | Échec | La caméra est en mode vie privée, hors ligne, à configurer, ou n'existe plus |
| E3 | La caméra cesse de répondre pendant la lecture | Échec | Plus aucune image n'arrive de la caméra |

## Détail des chemins

### N1 · Ouvrir le direct depuis l'accueil

1. L'utilisateur touche la vignette d'une caméra surveillée qui répond (LIVE-11).
2. Vyzio ouvre la vue en direct, son écran à elle (LIVE-07), en qualité économique et sans le son (LIVE-04, LIVE-05), disposée selon l'écran (LIVE-08, LIVE-09), le cadre à la forme de l'image (LIVE-14).
3. L'utilisateur revient en arrière par la barre ou le retour du navigateur, et retrouve l'accueil (LIVE-07).

### A1 · Passer en haute qualité

1. L'utilisateur choisit la haute qualité ; elle vaut le temps de la regarder (LIVE-04).

### A2 · Activer le son

1. L'utilisateur active le son d'un geste, quand le navigateur le lit (LIVE-05).

### A3 · Ouvrir le direct depuis la page de la caméra

1. L'utilisateur ouvre le pilotage depuis la page de la caméra (LIVE-07).
2. Au retour, il retrouve la page où il était, sans que la question du redémarrage se pose (LIVE-07, UI-15).

### A4 · Regarder en paysage

1. Le téléphone tenu en paysage, la vidéo occupe tout l'écran et les commandes s'y posent (LIVE-10).
2. Sans geste, elles s'effacent (LIVE-10) ; un appui sur l'image les fait revenir.
3. La vidéo continue pendant que le téléphone tourne, dans un sens comme dans l'autre (LIVE-16).
4. L'utilisateur peut faire rendre ses barres au navigateur ; la vue reste ouverte et la vidéo continue (LIVE-15).

### A5 · Atteindre le direct par son adresse

1. L'utilisateur ouvre l'adresse de la vue en direct d'une caméra surveillée qui répond.
2. Le chemin reprend à N1, pas 2 ; le retour mène à l'accueil (LIVE-07).

### E1 · La vidéo ne peut pas être lue

1. Le navigateur ne lit pas la vidéo, ou le flux n'arrive pas.
2. La vue montre une image rafraîchie, dit pourquoi et propose de réessayer quand la cause peut passer (LIVE-12).

### E2 · La caméra ne peut rien montrer

1. La caméra est en mode vie privée, hors ligne, à configurer, ou n'existe plus.
2. La vue le dit en une phrase, sans image ni tentative de flux, avec le chemin utile (LIVE-11, PRIV-06).

### E3 · La caméra cesse de répondre pendant la lecture

1. Plus aucune image n'arrive de la caméra : la vue ne laisse pas une image figée passer pour le direct, et le dit en une phrase, sans image (LIVE-13).
2. Au retour de la caméra, la vue reprend d'elle-même, sans rechargement.

## Règles locales

- **LIVE-04** · la vue en direct d'une camera montre une **video fluide**, proche de la scene (LIVE-01), en qualite economique a l'ouverture ; l'utilisateur passe en haute qualite le temps de la regarder, sans que ce choix soit retenu ni change le reglage de la camera ; une camera qui n'a qu'une qualite n'offre pas ce choix ;
- **LIVE-05** · le son de la vue en direct est coupe a l'ouverture et s'active d'un geste ; une camera dont le navigateur ne lit pas le son n'offre pas ce geste ;
- **LIVE-06** · regarder le direct ne doit pas perturber la surveillance de la camera ;
- **LIVE-07** · la vue en direct est un ecran a part entiere, jamais une fenetre posee sur la page : elle s'ouvre depuis la vignette d'une camera a l'accueil et depuis le pilotage de la page de la camera ; le retour du navigateur la referme et ramene la ou l'on etait, ou a l'accueil quand on l'a atteinte par son adresse ; l'ouvrir depuis les reglages n'est pas quitter les reglages : la question du redemarrage attend qu'on les quitte, alors que des modifications non enregistrees sont signalees comme a tout depart de la page ;
- **LIVE-08** · une barre ramene en arriere, nomme la camera et porte la qualite et le son ;
- **LIVE-09** · telephone tenu droit, la barre est au-dessus de la video, jamais posee sur l'image ; la video occupe toute la largeur juste en dessous, puis le pilotage, d'une taille confortable qui ne grandit pas avec la hauteur libre, et les positions juste en dessous, centres dans la place qui reste ; sur grand ecran, la video prend toute la place disponible, la barre posee sur l'image, le pilotage et les positions a cote ; sans pilotage, cette place ne garde que la ligne qui dit pourquoi, quand il y en a une (PTZ-19) ;
- **LIVE-10** · telephone tenu en paysage, la video occupe tout l'ecran : la barre, le pilotage et les positions, enregistrement compris, sont poses dessus, s'effacent apres quelques secondes sans geste, jamais pendant un appui, et reviennent d'un appui sur l'image ; ce qui explique un etat (la raison de l'image de secours, des positions non lues, une calibration a faire, une orientation indisponible) ne s'efface jamais ; le navigateur y masque ses propres barres des le premier geste quand il le permet, avec un bouton pour le lui redemander, et sinon la vue occupe tout ce qu'il laisse visible ;
- **LIVE-11** · atteinte par son adresse, la vue en direct d'une camera en mode vie privee, hors ligne, a configurer ou qui n'existe plus le dit en une phrase, sans image ni tentative de flux, avec le chemin utile (la page de la camera pour une camera a configurer ou hors ligne) ; la vignette, elle, ne l'ouvre que pour une camera surveillee qui repond (CAM-05, CAM-08, PRIV-06) ;
- **LIVE-12** · si la video ne peut pas etre lue, parce que le navigateur ne la lit pas ou que le flux n'arrive pas, la vue en direct montre une image rafraichie, dit pourquoi en une phrase et propose de reessayer quand la cause peut passer ; en mode vie privee, ou pour une camera qui n'existe plus, elle le dit sans image ; les vignettes restent des images rafraichies ;
- **LIVE-13** · si la video s'arrete en cours de lecture parce que la camera ne repond plus, la vue en direct ne laisse pas une image figee passer pour le direct : quelques secondes sans nouvelle image suffisent, et un flux que la camera cesse d'envoyer le fait savoir aussitot ; elle le dit en une phrase, sans image, et reprend d'elle-meme au retour de la camera, sans rechargement ; une coupure entre le navigateur et Vyzio, elle, se reconnecte ;
- **LIVE-14** · telephone tenu droit, le cadre de la video prend la forme de l'image de la camera : elle occupe toute la largeur, sans bande sur les cotes ni recadrage ;
- **LIVE-15** · quand le navigateur masque ses propres barres, un bouton les lui fait rendre sans quitter la vue, la video continuant ;
- **LIVE-16** · la video continue quand le telephone tourne, dans un sens comme dans l'autre, sans rouvrir la vue ;
- **LIVE-17** · pendant que la surveillance redemarre (SYS-01), les vignettes de l'accueil et la vue en direct montrent une attente plutot qu'une image figee ou cassee, et reprennent d'elles-memes quand elle repond de nouveau, sans rechargement ;
- **LIVE-18** · activer le mode vie privee referme aussitot toute vue en direct ouverte de la camera, qui le dit en une phrase, sans image.

## Points ouverts

Aucun.
