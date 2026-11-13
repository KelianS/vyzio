# UC-PTZ-02 · Enregistrer et rappeler des positions

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire pour enregistrer une position, qui se règle (PRIV-18) ; l'utilisateur pour s'y rendre, ACCESS-01 disant ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur avec une caméra PTZ**, je veux définir la position de surveillance depuis l'interface en orientant la caméra manuellement puis en cliquant "Enregistrer", afin que Vyzio sache toujours où la ramener après le mode vie privée. **En tant qu'utilisateur**, je veux gérer plusieurs positions nommées pour ma caméra PTZ — au minimum une position de surveillance et une position de parking — afin de personnaliser les zones couvertes sans devoir repositionner la caméra manuellement à chaque usage. **En tant qu'utilisateur**, je veux voir une miniature de la vue caméra associée à chaque position PTZ enregistrée, afin d'identifier visuellement la zone couverte sans devoir y naviguer. |

## Conditions

**Préalables** :

- l'orientation de la caméra fonctionne (PTZ-19) ;
- la caméra est en surveillance et sa vue en direct est ouverte (UC-LIVE-01, PRIV-18).

**Résultat en succès** : la position est enregistrée sur son slot, avec sa miniature (PTZ-07, PTZ-11).

**Résultats en échec** :

- les slots sont remplacés par un message qui dit que les positions n'ont pas pu être lues (E1) ;
- la page de la caméra dit ce qui manque avant de pouvoir enregistrer une position (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Enregistrer la vue actuelle sur un slot vide | Nominal | L'utilisateur touche le « + » d'un slot vide |
| A1 | Aller à une position | Alternative | L'utilisateur touche un slot qui garde une position |
| A2 | Remplacer une position | Alternative | L'utilisateur enregistre par-dessus une position existante |
| A3 | Retrouver une position enregistrée ailleurs | Alternative | La position a été enregistrée dans l'application du fabricant |
| A4 | Calibrer la caméra | Alternative | Vyzio garde les positions d'une caméra qui ne sait pas les garder |
| E1 | Les positions ne peuvent pas être lues | Échec | La caméra ne répond pas à la lecture de ses positions |
| E2 | La caméra n'est pas encore en surveillance | Échec | L'utilisateur veut régler les positions d'une caméra qui n'a pas de vue en direct |

## Détail des chemins

### N1 · Enregistrer la vue actuelle sur un slot vide

1. L'utilisateur oriente la caméra (UC-PTZ-01), puis touche le « + » d'un slot vide (PTZ-05, PTZ-07).
2. Vyzio enregistre la vue actuelle sur ce slot (PTZ-04, PTZ-06) et prend sa miniature une fois la caméra arrivée (PTZ-12).

### A1 · Aller à une position

1. L'utilisateur touche un slot qui garde une position : la caméra s'y rend (PTZ-07).
2. Arrivée, Vyzio prend sa miniature, ou la met à jour (PTZ-12, PTZ-15).

### A2 · Remplacer une position

1. L'utilisateur enregistre par-dessus une position existante ; Vyzio demande confirmation (PTZ-07).
2. Le chemin reprend à N1, pas 2.

### A3 · Retrouver une position enregistrée ailleurs

1. La position, enregistrée dans l'application du fabricant, apparaît sur son slot, sans miniature (PTZ-06, PTZ-07, PTZ-14).
2. Le chemin reprend à A1.

### A4 · Calibrer la caméra

1. La capacité d'orientation dit que Vyzio garde les positions, qu'elles sont moins fiables, et qu'il faut calibrer la caméra après chaque démarrage de Vyzio (PTZ-09).
2. L'utilisateur calibre la caméra depuis la vue en direct.

### E1 · Les positions ne peuvent pas être lues

1. La caméra ne répond pas à la lecture de ses positions.
2. Un message remplace les slots, avec « Réessayer » et le détail technique (PTZ-08, UI-01).

### E2 · La caméra n'est pas encore en surveillance

1. La caméra n'a pas encore de vue en direct.
2. L'écran de pilotage le dit et mène à ce qui manque (PRIV-18).

## Règles locales

- **PTZ-04** · l'utilisateur doit pouvoir définir la position de surveillance (preset "home") via des contrôles PTZ live dans l'interface — une fois orientée, il clique "Définir comme position de surveillance" ;
- **PTZ-05** · la gestion des positions PTZ expose 4 slots : **preset 1** (Surveillance : ramener la caméra vers la zone surveillée nominale), **preset 2** (Parking vie privée : position de stationnement lors de l'activation du mode vie privée), **presets 3 et 4** personnalisables par l'utilisateur ; les presets 1 et 2 ont des labels fixes, les presets 3 et 4 ont un label libre ;
- **PTZ-06** · sur une caméra qui garde ses positions elle-même, la caméra fait foi : le slot N de Vyzio est la position N de la caméra, numérotée comme dans l'application du fabricant quand celle-ci propose des positions ; une position enregistrée sous ce numéro dans cette application apparaît sur son slot, une position qui y est supprimée le libère, et les positions au-delà des quatre slots sont ignorées ([ADR-09](../adr/0009-ptz-positions-resolved-above-the-protocol.md)) ;
- **PTZ-07** · chaque slot montre l'un de trois états, quel que soit qui garde la position : **vide** (le signe « + », un appui y enregistre la vue actuelle), **position enregistrée, sans miniature** (par exemple enregistrée dans l'application du fabricant ; un appui y emmène la caméra et prend sa miniature), **position avec sa miniature** (un appui y emmène la caméra) ; seul un slot vide montre « + », et enregistrer par-dessus une position existante demande toujours confirmation ;
- **PTZ-09** · la capacité Orientation de la caméra dit, dans ses options, où sont gardées ses positions : par la caméra elle-même dès qu'elle sait les garder, même avant la première enregistrée, ou par Vyzio quand la caméra ne sait pas les garder ; dans ce second cas, elle dit que les positions sont moins fiables et qu'il faut calibrer la caméra après chaque démarrage de Vyzio, depuis la vue live ;
- **PTZ-10** · la disponibilité des presets est indépendante du protocole de la caméra : Vyzio gère les positions par un mécanisme de homing + mesure du temps de mouvement pour les caméras qui ne supportent pas les presets natifs (voir [ADR-09](../adr/0009-ptz-positions-resolved-above-the-protocol.md)) ;
- **PTZ-11** · chaque position enregistrée affiche une miniature de la vue caméra à cette position, dès qu'elle a été prise ;
- **PTZ-12** · la miniature est capturée automatiquement après chaque enregistrement d'une position et chaque déplacement GoTo vers un preset demandé depuis l'interface, une fois la caméra arrivée à destination ; les déplacements du mode vie privée n'en prennent aucune ;
- **PTZ-13** · la miniature est persistée côté serveur et survit à un rechargement de l'interface ;
- **PTZ-14** · une position enregistrée ailleurs (par exemple dans l'application du fabricant) n'a sa première miniature qu'après son premier GoTo ; avant, son slot montre qu'une position existe (PTZ-07), jamais le signe d'un slot vide ni une image générique ;
- **PTZ-15** · la miniature est mise à jour à chaque nouveau GoTo ;
- **PTZ-16** · l'arrivée sur une position s'annonce, et le slot de la position où se trouve la caméra se lit comme actif ;
- **PTZ-17** · la section Pilotage des réglages de la caméra ne montre que l'état de la calibration et mène à la vue en direct, seul endroit où l'on pilote, enregistre et calibre ;
- **PTZ-18** · tant qu'une caméra dont Vyzio garde les positions n'est pas calibrée, le pilotage le dit et propose de la calibrer sur place ; ses slots ne s'enregistrent pas avant.

## Points ouverts

Aucun.
