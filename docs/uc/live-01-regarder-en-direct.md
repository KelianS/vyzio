# UC-LIVE-01 · Regarder une caméra et ses détections

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux voir ce que filme une camera en video fluide, avec le son quand elle en a, pour suivre ce qui se passe au moment ou ca se passe. **En tant qu'utilisateur sur mon telephone**, je veux que la vue en direct occupe tout l'ecran, pour voir l'image en grand et piloter la camera sans qu'une page reste autour. **En tant qu'utilisateur**, je veux revoir ce que cette camera a detecte sans quitter sa vue, pour comprendre ce qui vient de se passer devant elle. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : la vidéo de la caméra est à l'écran, sur sa vue à elle (LIVE-19), proche de la scène (LIVE-01), et ses détections se revoient à la place du direct (LIVE-20).

**Résultats en échec** :

- une image rafraîchie remplace la vidéo, avec la raison en une phrase (E1) ;
- aucune image : une phrase dit pourquoi et mène où cela se règle (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Ouvrir la vue d'une caméra depuis l'accueil | Nominal | L'utilisateur touche une caméra à l'accueil |
| A1 | Passer en haute qualité | Alternative | L'utilisateur choisit la haute qualité sur l'image |
| A2 | Activer le son | Alternative | L'utilisateur active le son sur l'image |
| A3 | Revoir une détection de la caméra | Alternative | L'utilisateur ouvre l'onglet « Détections » et touche un clip |
| A4 | Regarder en plein écran | Alternative | L'utilisateur tourne son téléphone en paysage, ou touche « Plein écran » |
| A5 | Atteindre la vue par son adresse | Alternative | L'utilisateur ouvre l'adresse de la vue d'une caméra |
| A6 | Ouvrir les réglages de la caméra | Alternative | L'utilisateur touche la roue dentée de la barre |
| A7 | Regarder une caméra coupée | Alternative | La caméra est coupée |
| E1 | La vidéo ne peut pas être lue | Échec | Le navigateur ne lit pas la vidéo, ou le flux n'arrive pas |
| E2 | La caméra ne peut rien montrer | Échec | La caméra est hors ligne, à configurer, ou n'existe plus |
| E3 | La caméra cesse de répondre pendant la lecture | Échec | Plus aucune image n'arrive de la caméra |

## Détail des chemins

### N1 · Ouvrir la vue d'une caméra depuis l'accueil

1. L'utilisateur touche une caméra à l'accueil (LIVE-23).
2. Vyzio ouvre sa vue, son écran à elle (LIVE-19), le direct en haut, en qualité économique et sans le son (LIVE-04, LIVE-05), le cadre à la forme de l'image (LIVE-14), et l'onglet « Contrôles » en dessous.
3. L'utilisateur oriente la caméra (UC-PTZ-01), va à une position (UC-PTZ-02) ou la coupe (UC-PRIV-01).
4. Il revient en arrière par le bouton de la barre ou le retour du navigateur, et retrouve l'accueil (LIVE-19).

### A1 · Passer en haute qualité

1. L'utilisateur choisit la haute qualité sur l'image (LIVE-21) ; elle vaut le temps de la regarder (LIVE-04).

### A2 · Activer le son

1. L'utilisateur active le son d'un geste sur l'image (LIVE-21), quand le navigateur le lit (LIVE-05).

### A3 · Revoir une détection de la caméra

1. L'utilisateur ouvre l'onglet « Détections » : les clips de cette caméra s'y listent (LIVE-20).
2. Il touche un clip : il se lit à la place du direct (LIVE-20).
3. Il touche « Revenir au direct » : le direct reprend (LIVE-20).
4. Pour toutes les détections de la caméra, il ouvre la page des détections filtrée sur elle (UC-HIST-01 A2).

### A4 · Regarder en plein écran

1. Le téléphone tenu en paysage, ou « Plein écran » touché, la vidéo occupe tout l'écran et les commandes s'y posent (LIVE-10, LIVE-22).
2. Sans geste, elles s'effacent (LIVE-10) ; un appui sur l'image les fait revenir.
3. La vidéo continue pendant que le téléphone tourne, dans un sens comme dans l'autre (LIVE-16).
4. L'utilisateur peut faire rendre ses barres au navigateur ; la vue reste ouverte et la vidéo continue (LIVE-15).

### A5 · Atteindre la vue par son adresse

1. L'utilisateur ouvre l'adresse de la vue d'une caméra (LIVE-23).
2. Le chemin reprend à N1, pas 2 ; le retour mène à l'accueil (LIVE-19).

### A6 · Ouvrir les réglages de la caméra

1. L'utilisateur touche la roue dentée de la barre : les réglages de la caméra s'ouvrent sur « Connexion » (CAM-61).
2. Le retour ramène à la vue de la caméra (UI-29).

### A7 · Regarder une caméra coupée

1. La caméra est coupée : sa vue le dit à la place de l'image, avec « Réactiver », et ses contrôles sont désactivés (PRIV-20).
2. L'utilisateur touche « Réactiver » : la caméra reprend (UC-PRIV-01 A2), et le direct avec elle.

### E1 · La vidéo ne peut pas être lue

1. Le navigateur ne lit pas la vidéo, ou le flux n'arrive pas.
2. La vue montre une image rafraîchie, dit pourquoi et propose de réessayer quand la cause peut passer (LIVE-12).

### E2 · La caméra ne peut rien montrer

1. La caméra est hors ligne, à configurer, ou n'existe plus.
2. La vue le dit en une phrase, sans image ni tentative de flux, avec le chemin utile (LIVE-23).

### E3 · La caméra cesse de répondre pendant la lecture

1. Plus aucune image n'arrive de la caméra : la vue ne laisse pas une image figée passer pour le direct, et le dit en une phrase, sans image (LIVE-13).
2. Au retour de la caméra, la vue reprend d'elle-même, sans rechargement.

## Règles locales

- **LIVE-04** · la vue en direct d'une camera montre une **video fluide**, proche de la scene (LIVE-01), en qualite economique a l'ouverture ; l'utilisateur passe en haute qualite le temps de la regarder, sans que ce choix soit retenu ni change le reglage de la camera ; une camera qui n'a qu'une qualite n'offre pas ce choix ;
- **LIVE-05** · le son de la vue en direct est coupe a l'ouverture et s'active d'un geste ; une camera dont le navigateur ne lit pas le son n'offre pas ce geste ;
- **LIVE-06** · regarder le direct ne doit pas perturber la surveillance de la camera ;
- **LIVE-10** · telephone tenu en paysage, la video occupe tout l'ecran : la barre, le pilotage et les positions, enregistrement compris, sont poses dessus, s'effacent apres quelques secondes sans geste, jamais pendant un appui, et reviennent d'un appui sur l'image ; ce qui explique un etat (la raison de l'image de secours, des positions non lues, une calibration a faire, une orientation indisponible) ne s'efface jamais ; le navigateur y masque ses propres barres des le premier geste quand il le permet, avec un bouton pour le lui redemander, et sinon la vue occupe tout ce qu'il laisse visible ;
- **LIVE-12** · si la video ne peut pas etre lue, parce que le navigateur ne la lit pas ou que le flux n'arrive pas, la vue en direct montre une image rafraichie, dit pourquoi en une phrase et propose de reessayer quand la cause peut passer ; pour une caméra qui n'existe plus, elle le dit sans image, et une caméra coupée suit PRIV-20 ; les vignettes restent des images rafraichies ;
- **LIVE-13** · si la video s'arrete en cours de lecture parce que la camera ne repond plus, la vue en direct ne laisse pas une image figee passer pour le direct : quelques secondes sans nouvelle image suffisent, et un flux que la camera cesse d'envoyer le fait savoir aussitot ; elle le dit en une phrase, sans image, et reprend d'elle-meme au retour de la camera, sans rechargement ; une coupure entre le navigateur et Vyzio, elle, se reconnecte ;
- **LIVE-14** · telephone tenu droit, le cadre de la video prend la forme de l'image de la camera : elle occupe toute la largeur, sans bande sur les cotes ni recadrage ;
- **LIVE-15** · quand le navigateur masque ses propres barres, un bouton les lui fait rendre sans quitter la vue, la video continuant ;
- **LIVE-16** · la video continue quand le telephone tourne, dans un sens comme dans l'autre, sans rouvrir la vue ;
- **LIVE-17** · pendant que la surveillance redemarre (SYS-01), les vignettes de l'accueil et la vue en direct montrent une attente plutot qu'une image figee ou cassee, et reprennent d'elles-memes quand elle repond de nouveau, sans rechargement ;
- **LIVE-19** · la vue d'une caméra est un écran à part entière, jamais une fenêtre posée sur une page : la barre, au-dessus de l'image et jamais posée dessus téléphone tenu droit, porte le retour, le nom de la caméra avec sa marque (UI-31) et une roue dentée vers ses réglages ; le direct occupe toute la largeur juste en dessous, puis deux onglets : « Contrôles » (le pilotage rond, UC-PTZ-01 ; les positions en miniatures, UC-PTZ-02 ; « Couper la caméra », UC-PRIV-01) et « Détections » (LIVE-20) ; sur grand écran, la même structure se développe, le pilotage à côté de l'image ; le retour suit UI-29 ; passer des réglages à la vue d'une caméra n'est pas quitter les réglages : la question du redémarrage attend qu'on les quitte (UI-15) ;
- **LIVE-20** · l'onglet « Détections » de la vue liste les clips de cette caméra, les plus récents d'abord, et porte une marque quand elle a détecté dans la dernière heure ; un toucher sur un clip le lit à la place du direct, avec son nom et son heure, et « Revenir au direct » ramène le direct ; à sa fin, le lecteur s'arrête sur sa dernière image ; la liste se termine par « Toutes ses détections », qui ouvre les détections filtrées sur elle (UC-HIST-01) ;
- **LIVE-21** · la qualité, le son et le passage en plein écran se choisissent sur l'image, non dans la barre ;
- **LIVE-22** · en plein écran, l'image va de bord à bord : le nom de la caméra avec sa marque en haut à gauche, la sortie du plein écran en haut à droite, les positions en bas à gauche, le pilotage translucide en bas à droite ; l'œil n'y figure pas ;
- **LIVE-23** · toucher une caméra à l'accueil ouvre sa vue, sauf une caméra « À configurer », qui mène à sa page (CAM-05) ; atteinte par son adresse, la vue d'une caméra hors ligne, à configurer ou qui n'existe plus le dit en une phrase, sans image ni tentative de flux, avec le chemin utile (la page de la caméra pour une caméra à configurer ou hors ligne), et celle d'une caméra coupée montre ce que dit PRIV-20 ; l'adresse n'ouvre jamais ce qu'un toucher n'ouvrirait pas (CAM-08).

## Points ouverts

Aucun.
