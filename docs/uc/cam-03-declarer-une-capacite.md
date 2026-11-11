# UC-CAM-03 · Déclarer une capacité ou un protocole à la main

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur dont la camera a une fonctionnalite que la detection n'a pas trouvee**, je veux pouvoir suivre un parcours de configuration manuelle plus long pour l'activer, afin de profiter pleinement du produit sans devoir changer de materiel. |

## Conditions

**Préalables** :

- la caméra existe (UC-CAM-01) et sa page est ouverte sur « Connexion » (CAM-03) ;
- la détection automatique n'a pas trouvé la capacité voulue (CAM-12).

**Résultat en succès** : la capacité a sa carte, sur le protocole choisi, vérifiée aussitôt (CAM-13) ; ou le protocole ajouté apparaît avec son état (CAM-22).

**Résultats en échec** :

- l'ajout n'a rien à proposer et renvoie là où cela se règle (E1, E2) ;
- le retrait d'un protocole est refusé, avec sa raison (E3) ;
- la capacité ajoutée est en échec et sa carte dit comment en sortir (E4).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Ajouter une capacité | Nominal | L'utilisateur choisit d'ajouter une capacité |
| A1 | Ajouter un protocole | Alternative | La capacité passe par un protocole que la caméra n'a pas encore |
| A2 | Changer le protocole d'une capacité | Alternative | La capacité a déjà sa carte |
| A3 | Retirer un protocole | Alternative | L'utilisateur retire un protocole dans Avancé |
| E1 | Chaque capacité a déjà sa carte | Échec | L'utilisateur ouvre l'ajout d'une capacité |
| E2 | Aucun protocole ne convient | Échec | Aucun protocole de la caméra ne peut porter la capacité restante |
| E3 | Le retrait d'un protocole est refusé | Échec | Le protocole sert à une capacité, ou la page a des modifications non enregistrées |
| E4 | La capacité ajoutée échoue au test | Échec | Le test réel de la capacité ne la prouve pas |

## Détail des chemins

### N1 · Ajouter une capacité

1. L'utilisateur choisit d'ajouter une capacité, puis le protocole qui la porte, parmi ceux de la caméra capables de la porter, qu'ils répondent ou non (CAM-19, CAM-45).
2. Vyzio la teste aussitôt (CAM-13) ; prouvée, elle prend sa carte à la suite des capacités (CAM-23) ; sans lecture qui la prouve, elle est à confirmer (CAM-16, UC-CAM-04).

### A1 · Ajouter un protocole

1. L'utilisateur choisit « Ajouter un protocole » (CAM-48), saisit son port, le port habituel par défaut, et au besoin un compte spécifique (CAM-45).
2. Vyzio vérifie aussitôt le protocole et dit son état (CAM-22) ; le chemin reprend à N1.

### A2 · Changer le protocole d'une capacité

1. L'utilisateur ouvre les options de la carte et choisit un autre protocole (CAM-47, CAM-23).
2. Vyzio teste aussitôt la capacité sur ce protocole ; la détection ne reviendra pas sur ce choix (CAM-42).

### A3 · Retirer un protocole

1. L'utilisateur retire, dans Avancé, un protocole qu'aucune capacité n'utilise (CAM-46).
2. Vyzio le retire.

### E1 · Chaque capacité a déjà sa carte

1. L'ajout dit que chaque capacité a déjà sa carte et renvoie aux options des cartes (CAM-47).

### E2 · Aucun protocole ne convient

1. Aucun protocole de la caméra ne peut porter la capacité restante.
2. Vyzio le dit simplement et renvoie d'abord vers « Détecter automatiquement », puis vers « Ajouter un protocole » (CAM-47, CAM-48).

### E3 · Le retrait d'un protocole est refusé

1. Le protocole sert à une capacité, ou la page a des modifications non enregistrées.
2. Vyzio refuse et dit simplement pourquoi (CAM-46).

### E4 · La capacité ajoutée échoue au test

1. Le test réel ne prouve pas la capacité (CAM-14).
2. Sa carte la dit en échec, sans la présenter comme disponible, et dit comment en sortir (CAM-24).

## Règles locales

- **CAM-45** · une fois la camera ajoutee, l'utilisateur peut lui ajouter une capacite (a la suite des capacites, verifiee aussitot) et un protocole (son port, le port habituel par defaut, et un compte specifique facultatif, verifie aussitot) ; le compte specifique d'un protocole dit qu'il n'est presente qu'a la camera, sur le reseau local ;
- **CAM-46** · l'utilisateur peut retirer un protocole qu'aucune capacite n'utilise et sans modification non enregistree, et Vyzio dit simplement pourquoi il refuse sinon ;
- **CAM-47** · quand chaque capacite a deja sa carte, l'ajout le dit et renvoie aux options des cartes, et quand aucun protocole de la camera ne peut porter une capacite restante, il le dit et renvoie aux memes chemins que les cartes ; une capacite qui a deja sa carte change de protocole depuis les options de cette carte ;
- **CAM-48** · pour passer par un protocole que la camera n'a pas encore, l'utilisateur l'ajoute d'abord (« Ajouter un protocole ») : aucun choix de capacite n'en cree un en silence, et la ou aucun protocole de la camera ne convient, Vyzio le dit simplement et renvoie d'abord vers « Détecter automatiquement », puis vers cet ajout.

## Points ouverts

Aucun.
