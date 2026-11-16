# UC-UI-01 · Voir l'état du système

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux voir rapidement si mon systeme fonctionne correctement. **En tant qu'utilisateur**, je veux retrouver les derniers evenements sans passer par plusieurs menus. **En tant qu'utilisateur**, je veux gerer mes cameras, mes profils et mes notifications depuis la meme interface. **En tant qu'utilisateur**, je veux pouvoir utiliser le systeme depuis un navigateur sur telephone ou ordinateur. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02), depuis un navigateur sur téléphone ou ordinateur (UI-10).

**Résultat en succès** : l'accueil montre chaque caméra avec son état, le nombre de détections de la dernière heure et l'état des notifications (UI-32).

**Résultats en échec** : Vyzio ne répond pas, et un écran entier le dit (E1) ; un état dégradé se lit dans la barre du haut (A3).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Lire l'état du système à l'accueil | Nominal | L'utilisateur ouvre l'interface |
| A1 | Mettre Vyzio en service | Alternative | Aucune caméra n'est encore ajoutée |
| A2 | Voir toutes les caméras | Alternative | Quatre caméras ou plus sont ajoutées |
| A3 | Une alerte se lève | Alternative | Une caméra ne répond plus, Vyzio cesse de répondre, le stockage devient critique ou la surveillance redémarre |
| A4 | Consulter le matériel | Alternative | L'utilisateur ouvre « Matériel » dans les réglages |
| E1 | Vyzio ne répond pas | Échec | L'interface s'ouvre sans que Vyzio réponde |

## Détail des chemins

### N1 · Lire l'état du système à l'accueil

1. L'utilisateur ouvre l'interface : pendant la lecture, l'accueil montre la forme de ce qui arrive.
2. L'accueil montre chaque caméra avec sa marque (UI-31) et son œil, puis le Silence et les tuiles (UI-32).
3. Il coupe ou réactive une caméra d'un toucher sur son œil (PRIV-21, UC-PRIV-01), lance un Silence (UC-NOTIF-06), ou touche une caméra pour ouvrir sa vue (UC-LIVE-01).
4. Il gère ses caméras, ses profils et ses notifications depuis les réglages, chaque réglage à son emplacement prévisible (UI-04, UI-06, UI-07, UI-29).

### A1 · Mettre Vyzio en service

1. Aucune caméra n'est encore ajoutée : l'accueil ne propose que « Ajouter une caméra » (UI-33).
2. Le chemin continue par UC-CAM-01.

### A2 · Voir toutes les caméras

1. Quatre caméras ou plus sont ajoutées : l'accueil en montre quatre et « Voir les N caméras » (UI-32).
2. L'utilisateur le touche : toutes les caméras s'affichent, chacune avec sa marque et son œil.

### A3 · Une alerte se lève

1. Une caméra ne répond plus, Vyzio cesse de répondre, le stockage devient critique (HIST-01) ou la surveillance redémarre ou est indisponible (SYS-01).
2. La barre du haut s'agrandit et le dit, sur toutes les pages, jusqu'à ce que la cause cesse (UI-30).

### A4 · Consulter le matériel

1. L'utilisateur ouvre « Matériel » dans les réglages : il lit le matériel qui fait tourner la détection (UI-35).

### E1 · Vyzio ne répond pas

1. L'interface s'ouvre sans que Vyzio réponde : un écran entier le dit, avec le détail technique, et réessaie de lui-même (UI-34).
2. Dès que Vyzio répond, l'interface s'ouvre comme en N1.

## Règles locales

- **UI-32** · l'accueil montre les caméras d'abord : moins de quatre, chacune en grande carte avec son image ; quatre ou plus, les quatre premières de la liste des caméras en grille et « Voir les N caméras » ; chacune avec son nom, sa marque (UI-31) et un œil qui la coupe ou la réactive (PRIV-21) ; au-dessus, « Couper les caméras », qui les coupe toutes et devient « Réactiver les caméras » quand toutes le sont, et « Silence » (UC-NOTIF-06) ; en dessous, deux tuiles : « Détections », qui compte les détections de la dernière heure (« 2 depuis 1 h »), sans rien retenir de ce que l'utilisateur a déjà vu, et mène aux détections (UC-HIST-01), et « Notifications », qui mène à leurs réglages et ne porte un sous-titre que pour une exception (« À configurer », un Silence en cours, UC-NOTIF-06) ;
- **UI-33** · tant qu'aucune caméra n'est ajoutée, l'interface, ouverte après la création du mot de passe (UC-ACCESS-01) ou plus tard, ouvre l'accueil, qui ne propose qu'une action, « Ajouter une caméra » (UC-CAM-01) ; il n'y a ni écran de bienvenue ni parcours à part pour la mise en service ;
- **UI-35** · la rubrique « Matériel » des réglages montre, à titre informatif, le matériel sur lequel tourne la détection (accélérateur dédié, carte graphique ou processeur) et la fréquence d'analyse retenue, ainsi que l'état de la surveillance (SYS-01), sans nommer le composant technique ; ce n'est pas un état à traiter, rien n'y est à toucher.

## Points ouverts

Aucun.
