# UC-HIST-01 · Consulter l'historique

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, propriétaire ou résident (ACCESS-01) |
| **Objectif** | **En tant qu'utilisateur**, je veux consulter l'historique recent des evenements, afin de comprendre ce qu'il s'est passe. **En tant qu'utilisateur**, je veux pouvoir recuperer un clip pertinent, afin de le conserver ou le partager si necessaire. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : l'utilisateur voit les événements qu'il cherche, chacun avec sa caméra, son heure et l'identité estimée (DET-02), et leur clip quand il existe (HIST-04).

**Résultats en échec** : la lecture échoue, et l'erreur se lit à deux niveaux (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Consulter l'historique filtré | Nominal | L'utilisateur ouvre l'historique |
| A1 | Ouvrir le clip d'un événement | Alternative | L'utilisateur ouvre l'aperçu d'un événement |
| E1 | L'historique ne peut pas être lu | Échec | La lecture de l'historique échoue |

## Détail des chemins

### N1 · Consulter l'historique filtré

1. L'utilisateur ouvre l'historique et le filtre par caméra, personne ou type d'événement (HIST-03).

### A1 · Ouvrir le clip d'un événement

1. L'utilisateur ouvre l'aperçu d'un événement et son clip, quand il existe (HIST-04).
2. Une vidéo effacée avec une autre détection le dit, sans s'afficher en panne (HIST-11).

### E1 · L'historique ne peut pas être lu

1. La lecture échoue : l'écran le dit avec son détail technique (UI-01).

## Règles locales

- **HIST-03** · l'utilisateur doit pouvoir consulter un historique filtre par camera, personne ou type d'evenement ;
- **HIST-04** · les clips associes a un evenement doivent etre consultables quand ils existent.

## Points ouverts

| # | Question | Effet tant qu'elle reste ouverte |
| --- | --- | --- |
| 1 | Comment l'utilisateur conserve-t-il ou partage-t-il un clip hors de Vyzio ? | L'objectif de récupérer un clip s'arrête à sa consultation |
