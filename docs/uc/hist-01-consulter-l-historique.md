# UC-HIST-01 · Consulter les détections

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux consulter l'historique recent des evenements, afin de comprendre ce qu'il s'est passe. **En tant qu'utilisateur**, je veux pouvoir recuperer un clip pertinent, afin de le conserver ou le partager si necessaire. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : l'utilisateur voit les détections qu'il cherche, chacune avec sa caméra, son heure et l'identité estimée (DET-02), et les regarde à la suite (HIST-18).

**Résultats en échec** : la lecture échoue, et l'erreur se lit à deux niveaux (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Regarder les détections | Nominal | L'utilisateur touche la tuile « Détections » à l'accueil |
| A1 | Filtrer les détections | Alternative | L'utilisateur touche le filtre de la barre |
| A2 | Ouvrir les détections d'une caméra | Alternative | L'utilisateur touche « Toutes ses détections » dans la vue d'une caméra |
| A3 | Agir sur un clip | Alternative | L'utilisateur ouvre le menu « ⋯ » d'un clip |
| E1 | Les détections ne peuvent pas être lues | Échec | La lecture des détections échoue |

## Détail des chemins

### N1 · Regarder les détections

1. L'utilisateur touche la tuile « Détections » à l'accueil (UC-UI-01) : la page s'ouvre, le lecteur en haut, les clips groupés par jour en dessous (HIST-18).
2. Il touche un clip : il se lit dans le lecteur, puis les suivants à la suite, sans rien à toucher (HIST-18).
3. Une vidéo effacée avec une autre détection, ou dont la conservation est échue, le dit sans s'afficher en panne (HIST-11, HIST-17).

### A1 · Filtrer les détections

1. L'utilisateur touche le filtre de la barre : il coche une ou plusieurs caméras, personnes ou types d'événement, et choisit un jour (HIST-03) ; la liste suit à chaque toucher.
2. Le chemin reprend à N1, pas 2, sur les détections filtrées.

### A2 · Ouvrir les détections d'une caméra

1. Depuis la vue d'une caméra, l'utilisateur touche « Toutes ses détections » (UC-LIVE-01 A3) : la page s'ouvre filtrée sur cette caméra (HIST-03).
2. Le retour ramène à la vue de la caméra (UI-29).

### A3 · Agir sur un clip

1. L'utilisateur ouvre le menu « ⋯ » d'un clip : il corrige la reconnaissance (UC-DET-02), télécharge le clip (HIST-19) ou le supprime (UC-HIST-03).

### E1 · Les détections ne peuvent pas être lues

1. La lecture échoue : l'écran le dit avec son détail technique (UI-01).

## Règles locales

- **HIST-03** · l'utilisateur doit pouvoir consulter un historique filtré par caméra, personne, type d'événement et jour ; caméra, personne et type acceptent plusieurs valeurs à la fois, le jour en prend un : aujourd'hui, hier, les sept derniers jours ou un jour choisi ;
- **HIST-04** · les clips associes a un evenement doivent etre consultables quand ils existent ;
- **HIST-17** · la video d'une detection dont la duree de conservation est echue ne s'affiche pas en panne : son lecteur dit qu'elle n'est plus conservee, en raison de la duree choisie (UC-HIST-02) ;
- **HIST-18** · la page « Détections » porte en haut le même lecteur que la vue d'une caméra (UC-LIVE-01 A3), et en dessous les clips groupés par jour, les plus récents d'abord, chacun avec ce qui a été vu, que l'icône de son type fait reconnaître d'un coup d'œil, sa caméra et son heure ; un toucher lit le clip ; à sa fin, le clip suivant de la liste se lit de lui-même, d'un jour au précédent, sans commande pour le régler, et après le dernier le lecteur s'arrête sur sa dernière image ; le lecteur reste en haut de l'écran, sous la barre, pendant que la liste défile, sauf téléphone en paysage ; le clip qui démarre de lui-même est amené en vue dans la liste ; les actions d'un clip sont dans son menu « ⋯ », et le filtre est une icône de la barre ;
- **HIST-19** · un clip se télécharge depuis son menu, pour le conserver ou le partager hors de Vyzio ; le téléchargement se fait sur l'appareil qui consulte, sans passer par un service tiers (SEC-01).

## Points ouverts

Aucun.
