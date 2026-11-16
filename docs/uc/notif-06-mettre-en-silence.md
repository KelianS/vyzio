# UC-NOTIF-06 · Mettre les notifications en silence

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux faire taire toutes les notifications d'un geste, pour un moment, sans que mes caméras cessent de filmer et de détecter, afin d'être tranquille sans baisser ma surveillance. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : aucun canal n'envoie de notification de détection jusqu'à l'heure choisie, ou jusqu'à ce que l'utilisateur finisse le Silence, la détection et l'enregistrement continuent (NOTIF-33), et l'accueil le dit, avec son heure quand il en a une (NOTIF-34).

**Résultats en échec** : la demande n'aboutit pas ; rien n'a changé, et l'erreur se lit à deux niveaux (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Lancer un Silence pour une durée | Nominal | L'utilisateur touche « Silence » à l'accueil |
| A1 | Lancer un Silence jusqu'au prochain changement de la planification | Alternative | Une plage Silence existe |
| A4 | Lancer un Silence sans heure de fin | Alternative | L'utilisateur choisit « Jusqu'à réactivation » |
| A2 | Finir le Silence | Alternative | L'utilisateur touche le Silence en cours |
| A3 | Le Silence arrive à son heure | Alternative | L'heure choisie est atteinte |
| E1 | Le Silence ne peut pas être lancé | Échec | Vyzio ne répond pas ou refuse la demande |

## Détail des chemins

### N1 · Lancer un Silence pour une durée

1. L'utilisateur touche « Silence » à l'accueil : une feuille dit l'effet, puis propose les durées (NOTIF-34).
2. Il touche une durée : le Silence commence aussitôt, sans confirmation, et la feuille se ferme (UI-16, NOTIF-34).
3. Aucun canal n'envoie de notification de détection ; la détection, l'enregistrement et l'historique continuent (NOTIF-33).
4. L'accueil montre le Silence en cours et jusqu'à quand (NOTIF-34).

### A1 · Lancer un Silence jusqu'au prochain changement de la planification

1. Une plage Silence existe (SCHED-02) : la première option propose de taire les notifications jusqu'au prochain changement de ces plages, et dit qu'ensuite la planification reprend (NOTIF-34).
2. Le chemin reprend à N1, pas 2.

### A2 · Finir le Silence

1. L'utilisateur touche le Silence en cours : il prend fin aussitôt, sans confirmation (NOTIF-34).
2. Les notifications reprennent, sauf sur un canal qu'une plage Silence vise à ce moment (NOTIF-33).

### A3 · Le Silence arrive à son heure

1. L'heure choisie est atteinte : le Silence prend fin de lui-même, et les notifications reprennent comme en A2, pas 2.

### A4 · Lancer un Silence sans heure de fin

1. L'utilisateur choisit « Jusqu'à réactivation », la première option : le Silence commence comme en N1, pas 2, et dure jusqu'à ce qu'il le finisse (A2), redémarrage de Vyzio compris (NOTIF-34).
2. L'accueil dit qu'un Silence est en cours, sans heure (NOTIF-34).

### E1 · Le Silence ne peut pas être lancé

1. Vyzio ne répond pas ou refuse la demande : rien ne change, et l'erreur se lit à deux niveaux (UI-01).

## Règles locales

- **NOTIF-34** · le Silence se lance depuis l'accueil, par une feuille qui dit son effet (plus de notifications, les caméras continuent de filmer et de détecter) et propose, dans cet ordre : « Jusqu'à réactivation », sans heure de fin ; « Jusqu'à HH h », le prochain changement des plages Silence, avec « Ensuite, la planification reprend », seulement quand une plage Silence existe ; puis 30 minutes, 1 heure, 2 heures, 4 heures ; une heure de fin choisie est bornée, pour qu'un Silence à heure ne s'étire pas au-delà de ce que propose la feuille, et seul « Jusqu'à réactivation » dure jusqu'à ce que l'utilisateur le finisse ; un toucher le lance et ferme la feuille ; tant qu'il dure, le bouton de l'accueil, ambre, dit « Silence jusqu'à HH h », à l'heure de la maison (SCHED-03), ou « Silence activé » sans heure de fin, et la tuile Notifications le redit (« En silence jusqu'à HH h », « En silence ») ; un toucher sur ce bouton y met fin ; le Silence survit à un redémarrage de Vyzio jusqu'à son heure, ou jusqu'à ce qu'il soit fini ; le relancer pendant qu'il dure remplace sa fin.

## Points ouverts

Aucun.
