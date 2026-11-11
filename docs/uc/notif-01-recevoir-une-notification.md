# UC-NOTIF-01 · Recevoir une notification d'événement

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, sur le canal qu'il a configuré |
| **Objectif** | **En tant qu'utilisateur**, je veux recevoir une notification utile sur mon telephone quand un evenement important se produit. **En tant qu'utilisateur**, je veux pouvoir voir rapidement le contexte de l'evenement sans devoir fouiller dans l'interface. **En tant qu'utilisateur**, je veux continuer a etre informe meme si je n'ai pas l'interface ouverte. **En tant qu'utilisateur**, je veux etre notifie lorsqu'une personne connue est detectee, afin de savoir qui arrive. **En tant qu'utilisateur**, je veux etre notifie lorsqu'un visage inconnu apparait, afin de pouvoir reagir vite. **En tant qu'utilisateur**, je veux eviter les notifications inutiles, afin que le systeme reste credibile au quotidien. |

## Conditions

**Préalables** :

- au moins un canal est configuré (UC-NOTIF-02) ;
- la caméra est en surveillance, hors mode vie privée (CAM-05, PRIV-01).

**Résultat en succès** : la notification arrive sur le canal, avec son contexte (NOTIF-03), pendant que la personne est encore dans le champ (NOTIF-15).

**Résultats en échec** :

- rien n'est envoyé, la détection, l'enregistrement et l'historique continuant (A2, A3) ;
- le canal externe est indisponible : rien n'arrive, et rien n'est rejoué à son retour (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Être notifié d'une personne connue | Nominal | Une personne connue est reconnue |
| A1 | Être notifié d'un visage inconnu | Alternative | Un visage inconnu apparaît |
| A2 | La personne n'est pas notifiée ici | Alternative | Sa politique, ou ses caméras, l'excluent |
| A3 | Une plage sans notification est en cours | Alternative | La plage vise le canal |
| E1 | Le canal externe est indisponible | Échec | Le réseau ou le service du canal ne répond pas |

## Détail des chemins

### N1 · Être notifié d'une personne connue

1. Une personne connue est reconnue, l'événement passant le tri entre prioritaire et bruit (DET-01) et la certitude minimale choisie (UC-NOTIF-03).
2. Vyzio envoie la notification sur les canaux actifs, avec son contexte et le format choisi (NOTIF-03, UC-NOTIF-03), pendant que la personne est encore dans le champ (NOTIF-15).

### A1 · Être notifié d'un visage inconnu

1. Un visage inconnu apparaît ; l'événement le dit, incertain s'il l'est (DET-03).
2. Le chemin reprend à N1, pas 2.

### A2 · La personne n'est pas notifiée ici

1. La politique de la personne, ou ses caméras, l'excluent (PROF-03, PROF-04).
2. Rien n'est envoyé ; la personne reste reconnue et nommée dans l'historique.

### A3 · Une plage sans notification est en cours

1. Une plage sans notification vise le canal (SCHED-02).
2. Le canal n'envoie rien, et la notification est abandonnée, jamais différée (NOTIF-07).

### E1 · Le canal externe est indisponible

1. Le réseau ou le service du canal ne répond pas : la surveillance et l'enregistrement locaux continuent (SYS-03, SYS-04).
2. Au retour du canal, aucune rafale (NOTIF-11, NOTIF-13).

## Règles locales

Aucune.

## Points ouverts

Aucun.
