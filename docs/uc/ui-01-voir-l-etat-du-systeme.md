# UC-UI-01 · Voir l'état du système

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, propriétaire ou résident (ACCESS-01) |
| **Objectif** | **En tant qu'utilisateur**, je veux voir rapidement si mon systeme fonctionne correctement. **En tant qu'utilisateur**, je veux retrouver les derniers evenements sans passer par plusieurs menus. **En tant qu'utilisateur**, je veux gerer mes cameras, mes profils et mes notifications depuis la meme interface. **En tant qu'utilisateur**, je veux pouvoir utiliser le systeme depuis un navigateur sur telephone ou ordinateur. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02), depuis un navigateur sur téléphone ou ordinateur (UI-10).

**Résultat en succès** : l'accueil montre l'état global du système et les notifications récentes (UI-22).

**Résultats en échec** : aucun propre à ce cas ; un état dégradé se lit sur l'accueil (A2, A3).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Lire l'état du système à l'accueil | Nominal | L'utilisateur ouvre l'interface |
| A1 | Mettre Vyzio en service | Alternative | Aucune caméra n'est encore ajoutée |
| A2 | Le moteur de détection redémarre ou est indisponible | Alternative | La surveillance applique une configuration, ou ne répond plus |
| A3 | Le stockage devient critique | Alternative | Le disque atteint le seuil d'HIST-02 |

## Détail des chemins

### N1 · Lire l'état du système à l'accueil

1. L'utilisateur ouvre l'interface : l'accueil montre l'état global et les notifications récentes (UI-22), et l'état de chaque caméra (CAM-01, CAM-04, PRIV-04).
2. Il gère ses caméras, ses profils et ses notifications depuis la même interface, chaque réglage à son emplacement prévisible (UI-04, UI-06, UI-07).

### A1 · Mettre Vyzio en service

1. Aucune caméra n'est encore ajoutée : l'accueil annonce la mise en service en trois étapes (UI-23).
2. L'utilisateur va directement à l'ajout d'une caméra (UC-CAM-01) ou au réglage des notifications (UC-NOTIF-02).

### A2 · Le moteur de détection redémarre ou est indisponible

1. L'accueil dit l'état du moteur, sur ses trois paliers, sans nommer le composant (SYS-01) ; il suit son état réel (SYS-05).

### A3 · Le stockage devient critique

1. L'utilisateur en est informé (HIST-01).

## Règles locales

- **UI-22** · l'accueil doit rendre visible l'etat global du systeme et les notifications recentes ;
- **UI-23** · tant qu'aucune camera n'est ajoutee, l'accueil, ouvert apres la creation du mot de passe (UC-ACCESS-01), annonce la mise en service en trois etapes, ajouter une camera, choisir ce qui merite une notification, recevoir les notifications, et mene directement a l'ajout d'une camera et au reglage des notifications ; aucune etape ne demande de fichier a ecrire.

## Points ouverts

Aucun.
