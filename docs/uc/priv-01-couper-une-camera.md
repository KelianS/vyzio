# UC-PRIV-01 · Couper une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux couper une camera instantanement, afin d'etre certain qu'aucune image de moi ou de mon foyer n'est capturee ni enregistree. **En tant qu'utilisateur**, je veux voir clairement quelle camera est en mode vie privee, afin de savoir a tout moment ce qui surveille et ce qui ne surveille pas. **En tant qu'utilisateur**, je veux que la camera soit vraiment eteinte et pas uniquement silencieuse, afin d'avoir la certitude qu'aucun flux n'est accessible, ni par Frigate, ni par Vyzio, ni par personne d'autre sur le reseau. **En tant qu'utilisateur**, je veux basculer plusieurs cameras en mode vie privee simultanement (ex. "tout eteindre d'un coup"), afin de ne pas devoir repeter l'action camera par camera. **En tant qu'utilisateur**, je veux que mon choix soit maintenu apres un redemarrage du systeme, afin de ne pas devoir reconfigurer la vie privee a chaque fois. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : la caméra est en mode vie privée (PRIV-01, PRIV-02, PRIV-13), jusqu'à ce que l'utilisateur la réactive ou jusqu'à l'heure qu'il a choisie pour toutes les caméras (PRIV-22), son badge dit ce qu'elle a répondu (PRIV-04), et l'état survit à un redémarrage (PRIV-08).

**Résultats en échec** :

- la caméra n'a pas suivi : l'enregistrement reste coupé, et le badge nomme ce qui n'a pas eu lieu (E1) ;
- Vyzio ne sait pas ce que la caméra a fait (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Couper une caméra | Nominal | L'utilisateur touche l'œil d'une caméra à l'accueil, ou « Couper la caméra » dans sa vue |
| A1 | Couper toutes les caméras d'un coup | Alternative | L'utilisateur touche « Couper les caméras » à l'accueil |
| A2 | Reprendre la surveillance | Alternative | L'utilisateur touche l'œil d'une caméra coupée, ou « Réactiver » dans sa vue |
| A3 | Reprendre la surveillance pendant une plage | Alternative | La caméra est coupée par une plage Caméras coupées |
| A4 | La coupure de toutes les caméras arrive à son heure | Alternative | L'heure choisie en A1 est atteinte |
| A5 | Réactiver toutes les caméras | Alternative | Toutes les caméras sont coupées et l'utilisateur touche le bouton de l'accueil |
| E1 | La caméra ne suit pas | Échec | La caméra refuse, ne répond pas, ou ne peut pas suivre sa stratégie |
| E2 | La demande est interrompue | Échec | La demande s'arrête avant la réponse de la caméra |

## Détail des chemins

### N1 · Couper une caméra

1. L'utilisateur touche l'œil à côté du nom de la caméra, à l'accueil, ou « Couper la caméra » dans sa vue ; c'est une action, qui prend effet tout de suite, sans confirmation (UI-16, PRIV-03, PRIV-21).
2. Vyzio arrête l'enregistrement, la détection et les notifications de la caméra (PRIV-01, PRIV-02), et lui demande ce que sa stratégie ajoute (PRIV-10, PRIV-12).
3. Sa marque passe à « coupée » partout (UI-31) ; sa carte et sa vue disent qu'elle est coupée à la place de l'image (PRIV-20) ; son écran vie privée dit ce que la caméra a répondu (PRIV-04).

### A1 · Couper toutes les caméras d'un coup

1. L'utilisateur touche « Couper les caméras » à l'accueil : une feuille dit l'effet, puis propose jusqu'à quand (PRIV-22).
2. Il touche une option : toutes les caméras sont coupées aussitôt, la feuille se ferme, et ce toucher tient lieu de confirmation (PRIV-14, PRIV-22).
3. Le chemin reprend à N1, pas 2, pour chaque caméra ; quand une heure est choisie, la carte de chaque caméra et le bouton de l'accueil disent jusqu'à quand (PRIV-20, PRIV-22).

### A2 · Reprendre la surveillance

1. L'utilisateur touche l'œil de la caméra coupée, ou « Réactiver » dans sa vue, sans confirmation (PRIV-21).
2. Vyzio restaure son flux sans autre intervention (PRIV-09) ; une caméra parquée revient sur sa position Surveillance (PRIV-12).

### A3 · Reprendre la surveillance pendant une plage

1. La caméra est coupée par une plage Caméras coupées (UC-SCHED-01) ; l'utilisateur reprend sa surveillance.
2. La plage ne la recoupe pas jusqu'à sa fin, et l'écran vie privée dit jusqu'à quand (PRIV-07).

### A4 · La coupure de toutes les caméras arrive à son heure

1. L'heure choisie en A1 est atteinte, Vyzio ayant redémarré entre-temps ou non : la coupure prend fin d'elle-même (PRIV-07, PRIV-22).
2. Chaque caméra suit la planification : une caméra qu'une plage Caméras coupées vise reste coupée par cette plage, les autres reprennent comme en A2, pas 2 ; une caméra réactivée puis recoupée entre-temps par son œil reste coupée jusqu'à ce qu'il la réactive (PRIV-07, PRIV-21).

### A5 · Réactiver toutes les caméras

1. Toutes les caméras sont coupées ; l'utilisateur touche le bouton de l'accueil qui le dit : elles reprennent toutes aussitôt, sans feuille ni confirmation (PRIV-21, PRIV-22).
2. Le chemin reprend à A2, pas 2, pour chaque caméra.

### E1 · La caméra ne suit pas

1. La caméra refuse, ne répond pas, ou ne peut pas suivre sa stratégie.
2. L'enregistrement reste coupé ; l'interface dit en une ligne ce qui n'a pas eu lieu, en réponse au geste de l'utilisateur, ou en alerte quand une plage ou un redémarrage l'a demandé, avec « Réessayer » quand redemander à la caméra y remédie (PRIV-05). Une caméra hors ligne n'en dit rien de plus que son alerte hors ligne.

### E2 · La demande est interrompue

1. La demande s'arrête avant la réponse de la caméra.
2. L'interface dit que la caméra ne l'a peut-être pas suivie, sans prétendre qu'elle a refusé, et propose « Réessayer » (PRIV-05).

## Règles locales

- **PRIV-14** · l'interface doit permettre d'activer ou de desactiver le mode vie privee sur plusieurs cameras simultanement (selection multiple ou action globale "tout couper / tout reactiver"), sans reload Frigate separe par camera — un seul rechargement pour l'ensemble de la selection ;
- **PRIV-19** · des qu'un second compte existe, une coupure de vie privee dit qui l'a posee, comme une coupure venue d'une conversation.

## Points ouverts

Aucun.
