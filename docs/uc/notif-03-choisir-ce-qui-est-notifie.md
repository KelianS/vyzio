# UC-NOTIF-03 · Choisir ce qui mérite une notification

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux regler les horaires et le niveau de bruit des notifications, afin de ne pas en etre submerge. **En tant qu'utilisateur**, je veux choisir quelles categories d'evenements meritent une notification et quel niveau de bruit appliquer selon le contexte. **En tant qu'utilisateur**, je veux choisir les informations affichees dans le message, afin de recevoir un contenu utile sans surcharge. |

## Conditions

**Préalables** :

- au moins un canal est configuré (UC-NOTIF-02).

**Résultat en succès** : les notifications suivent les destinations, catégories, certitude, plages et format choisis (NOTIF-21, NOTIF-22).

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Choisir les catégories et la certitude minimale | Nominal | Le propriétaire ouvre le réglage des notifications |
| A1 | Planifier des plages sans notification | Alternative | Le propriétaire veut faire taire un canal à heure fixe |
| A2 | Choisir le format du message | Alternative | Le propriétaire veut changer ce que dit le message |

## Détail des chemins

### N1 · Choisir les catégories et la certitude minimale

1. Le propriétaire choisit les destinations actives, les catégories notifiées et la certitude minimale (NOTIF-20, NOTIF-21).
2. Il voit ce qu'il a modifié et enregistre (UI-11).

### A1 · Planifier des plages sans notification

1. Le propriétaire planifie une plage sans notification dans la Planification (NOTIF-20, UC-SCHED-01).

### A2 · Choisir le format du message

1. Le propriétaire choisit ce que contient le message (NOTIF-22), puis enregistre.

## Règles locales

- **NOTIF-20** · l'utilisateur doit pouvoir regler une certitude minimale de notification, et planifier des plages **sans notification** dans la planification de la maison (SCHED-01), qui suivent NOTIF-07 ;
- **NOTIF-21** · le produit doit permettre de regler au minimum les destinations actives, les categories d'evenements notifiees, la certitude minimale et les plages sans notification ;
- **NOTIF-22** · le produit doit permettre de choisir un format de message simple, avec au minimum camera, heure, type d'evenement, identite si connue et apercu si autorise.

## Points ouverts

Aucun.
