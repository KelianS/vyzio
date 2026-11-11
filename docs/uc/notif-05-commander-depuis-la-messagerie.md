# UC-NOTIF-05 · Commander Vyzio depuis la messagerie

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, depuis une conversation reliée, plafonnée au rôle résident (NOTIF-09) |
| **Objectif** | **En tant qu'utilisateur hors de chez moi**, je veux repondre a une notification par une action (voir la camera, couper la surveillance, verifier l'etat) sans avoir a joindre l'interface. **En tant qu'utilisateur**, je veux retrouver les memes commandes quel que soit le canal de messagerie que j'utilise, afin de ne pas reapprendre le produit en changeant de canal. |

## Conditions

**Préalables** :

- la conversation est reliée et le canal écoute (UC-NOTIF-04).

**Résultat en succès** : Vyzio répond à la commande dans la conversation, de la même façon sur tous les canaux (NOTIF-08), et la commande entre dans la trace (NOTIF-29).

**Résultats en échec** :

- le message reste sans réponse (E1) ;
- rien n'est réglé depuis la conversation (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Demander l'état ou un aperçu | Nominal | L'utilisateur envoie une commande de consultation |
| A1 | Commander une action aux conséquences visibles | Alternative | L'utilisateur demande de couper la surveillance ou de lever le mode vie privée |
| A2 | Relire la trace des commandes | Alternative | Le propriétaire ouvre la trace dans l'interface |
| E1 | Le message reste sans réponse | Échec | La conversation n'est pas reliée, ou le canal n'écoute pas |
| E2 | La demande est un réglage | Échec | L'utilisateur demande de régler quelque chose |

## Détail des chemins

### N1 · Demander l'état ou un aperçu

1. L'utilisateur envoie une commande de l'usage courant (NOTIF-26, NOTIF-27).
2. Vyzio répond, en images fixes ou en clips, jamais en flux continu (NOTIF-10), même pendant une plage sans notification (NOTIF-07).

### A1 · Commander une action aux conséquences visibles

1. L'utilisateur demande de couper la surveillance ou de lever le mode vie privée.
2. Vyzio demande une confirmation explicite avant que l'action prenne effet (NOTIF-28).

### A2 · Relire la trace des commandes

1. Le propriétaire ouvre la trace des commandes reçues et de leur issue (NOTIF-29).

### E1 · Le message reste sans réponse

1. La conversation n'est pas reliée, ou le canal n'écoute pas : le message reste sans réponse (NOTIF-23, NOTIF-25).

### E2 · La demande est un réglage

1. La configuration ne se fait pas depuis la conversation : les réglages restent dans l'interface (NOTIF-09).

## Règles locales

- **NOTIF-26** · le canal de messagerie doit fonctionner **dans les deux sens** : recevoir des notifications, et accepter des commandes ;
- **NOTIF-27** · les commandes doivent couvrir l'usage courant a distance — etat du systeme, apercu d'une camera, dernieres detections, mode vie privee, positions PTZ, interruption et reprise de la surveillance — de sorte qu'un acces reseau au produit reste **optionnel** ;
- **NOTIF-28** · une action aux consequences visibles — couper la surveillance, lever le mode vie privee — doit demander une confirmation explicite avant de prendre effet ;
- **NOTIF-29** · l'utilisateur doit pouvoir consulter la trace des commandes recues et de leur issue.

## Points ouverts

Aucun.
