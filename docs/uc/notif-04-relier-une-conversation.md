# UC-NOTIF-04 · Relier une conversation de messagerie

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | Relier sa conversation de messagerie à Vyzio, pour qu'elle seule puisse lui parler (UC-NOTIF-05). |

## Conditions

**Préalables** :

- le canal de messagerie est configuré et sait recevoir (UC-NOTIF-02).

**Résultat en succès** : la conversation est reliée, et l'interface dit si le canal écoute encore (NOTIF-25).

**Résultats en échec** :

- le code ne vaut plus, et la conversation n'est pas reliée (E1) ;
- le canal a cessé d'écouter, et l'interface dit pourquoi (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Relier une conversation | Nominal | Le propriétaire lance la liaison depuis l'interface |
| A1 | Révoquer la liaison | Alternative | Le propriétaire révoque la conversation reliée |
| E1 | Le code ne vaut plus | Échec | Le code a expiré, ou trop d'essais ont échoué |
| E2 | Le canal n'écoute plus | Échec | Le canal devient muet alors qu'une conversation est reliée |

## Détail des chemins

### N1 · Relier une conversation

1. Le propriétaire lance la liaison depuis l'interface, qui lui donne un code (NOTIF-23, NOTIF-24) ; cette liaison n'ouvre pas l'interface (ACCESS-02).
2. Il envoie le code depuis la conversation ; Vyzio la relie.
3. L'interface dit si le canal écoute (NOTIF-25).

### A1 · Révoquer la liaison

1. Le propriétaire révoque la conversation reliée (NOTIF-23) ; ses messages restent ensuite sans réponse.

### E1 · Le code ne vaut plus

1. Le code a expiré, ou trop d'essais ont échoué (NOTIF-24, NOTIF-14).
2. La conversation n'est pas reliée ; le propriétaire relance la liaison.

### E2 · Le canal n'écoute plus

1. Le canal devient muet alors qu'une conversation est reliée ou en cours de liaison.
2. L'interface dit qu'il a cessé d'écouter, et pourquoi (NOTIF-25).

## Règles locales

- **NOTIF-23** · seule une conversation appairee explicitement depuis l'interface doit etre acceptee ; l'appairage doit etre revocable, et un message d'une autre origine doit rester sans reponse ;
- **NOTIF-24** · le code qui relie une conversation doit etre a duree de vie courte **et** cesser de valoir apres quelques essais infructueux (NOTIF-14) : un code court que l'on peut deviner sans fin ne protege rien ;
- **NOTIF-25** · des qu'une conversation est reliee ou en cours de liaison, l'interface doit dire si le canal **ecoute encore**, et pourquoi il a cesse : une conversation reliee ne prouve rien, elle survit a la panne qui rend le canal muet. Tant qu'aucune ne l'est, une commande reste sans reponse de toute facon.

## Points ouverts

Aucun.
