# UC-SCHED-01 · Planifier une plage

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux voir et regler a un seul endroit tout ce qui se passe a heure fixe dans la maison, afin de ne pas le recreer camera par camera ni canal par canal. **En tant qu'utilisateur**, je veux planifier l'arret automatique d'une ou de plusieurs cameras a la fois sur des plages horaires recurrentes (ex. les cameras interieures tous les soirs de 22h a 6h), afin de ne pas avoir a y penser chaque jour. |

## Conditions

**Préalables** :

- le propriétaire a ouvert la Planification, dans les réglages (SCHED-01).

**Résultat en succès** : la plage est enregistrée, visible dans la semaine (SCHED-05), et s'applique à ses cibles (SCHED-04).

**Résultats en échec** :

- la plage est refusée, avec une phrase qui dit quoi changer (E1) ;
- la plage reste visible mais sans effet, et le dit (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Créer une plage | Nominal | Le propriétaire ajoute une plage |
| A1 | Créer une plage qui passe minuit | Alternative | La fin de la plage précède son début |
| A2 | Modifier une plage | Alternative | Le propriétaire touche une plage de la semaine |
| A3 | Supprimer une plage | Alternative | Le propriétaire supprime une plage |
| A4 | Renoncer | Alternative | Le propriétaire quitte sans enregistrer |
| E1 | La plage est refusée | Échec | La plage est vide, sans jour, sans cible ou mal formée |
| E2 | Les cibles de la plage ont disparu | Échec | Toutes les caméras ou tous les canaux visés ont été retirés |

## Détail des chemins

### N1 · Créer une plage

1. Le propriétaire lit la semaine, à l'heure de la maison (SCHED-05, SCHED-03), et ajoute une plage.
2. Il choisit son type, dont l'effet reste visible (SCHED-02), ses cibles (SCHED-07), ses jours et ses heures.
3. Il enregistre (SCHED-09) ; la plage s'applique (SCHED-04) et apparaît dans la semaine.

### A1 · Créer une plage qui passe minuit

1. La plage commence un jour et finit le lendemain ; l'écran de la plage le dit en clair, et la semaine la montre se prolonger (SCHED-05).
2. Le chemin reprend à N1, pas 3.

### A2 · Modifier une plage

1. Le propriétaire touche une plage de la semaine, qui s'ouvre (SCHED-05).
2. Il change ses cibles, ses jours ou ses heures ; son type ne change plus (SCHED-09).
3. Le chemin reprend à N1, pas 3.

### A3 · Supprimer une plage

1. Le propriétaire supprime la plage ; la confirmation nomme son type et ses cibles (SCHED-09).

### A4 · Renoncer

1. Le propriétaire quitte sans enregistrer : rien ne change (SCHED-09, UI-11).

### E1 · La plage est refusée

1. La plage est vide (début = fin), sans jour, sans cible ou mal formée.
2. Vyzio la refuse avec une phrase qui dit quoi changer (SCHED-06).

### E2 · Les cibles de la plage ont disparu

1. Toutes les caméras ou tous les canaux visés ont été retirés.
2. La plage reste visible, sans effet, et le dit (SCHED-07).

## Règles locales

- **SCHED-05** · la semaine s'y lit d'un coup d'oeil, comme un calendrier : un jour par ligne, du lundi au dimanche, chacun sur ses 24 heures, chaque plage posee a ses heures, concue pour le telephone d'abord ; le moment present y est marque, a l'heure de la maison ; une plage peut passer minuit (22h a 6h) : elle appartient au jour ou elle commence et se termine le lendemain, ce que l'ecran de la plage dit en clair, et la semaine la montre se prolonger sur le lendemain, pour qu'on ne manque pas une coupure en cours en lisant un seul jour ; une plage qui finit a minuit pile s'arrete a la fin de son jour ; une plage courte reste assez large pour etre touchee, des plages qui se chevauchent s'empilent sans qu'aucune soit cachee, et une legende associe chaque motif et icone au nom de son type ; toucher une plage l'ouvre ; quand l'heure de la maison ne peut pas etre lue, le moment present n'est pas marque plutot que marque faux ; la semaine se lit aussi au lecteur d'ecran, chaque plage disant son type, ses heures et ses cibles, et un jour vide qu'il n'y a rien de prevu ;
- **SCHED-06** · une plage vide (debut = fin), sans jour, sans cible ou mal formee est refusee avec une phrase qui dit quoi changer, jamais comme une erreur du serveur ;
- **SCHED-07** · une plage vise plusieurs choses a la fois, plusieurs cameras ou plusieurs canaux, qu'elle nomme ; viser toutes les cameras revient a cocher celles qui existent, une camera ajoutee ensuite n'est pas visee d'office ; une plage dont toutes les cibles ont disparu reste visible, sans effet, et le dit ;
- **SCHED-08** · une camera ou un canal dit combien de plages s'appliquent a lui, avec le chemin vers la Planification ; la bascule manuelle (couper une camera ou reprendre sa surveillance maintenant) reste sur la camera et garde sa priorite (PRIV-07) : la planification ne fait que programmer ;
- **SCHED-09** · une plage se modifie avec le meme cycle qu'un reglage (UI-11) : rien ne change avant d'avoir enregistre, et l'on peut renoncer ; son type se choisit a sa creation et ne change plus ; une plage enregistree, meme deja commencee, s'applique dans le delai de SCHED-04 ; supprimer une plage demande une confirmation qui nomme son type et ses cibles.

## Points ouverts

Aucun.
