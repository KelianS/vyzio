# UC-HIST-02 · Régler la conservation des enregistrements

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux choisir combien de temps mes enregistrements sont conserves, afin de gerer mon espace disque. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : chaque nature d'enregistrement est gardée la durée choisie, puis supprimée d'elle-même (HIST-16, HIST-09).

**Résultats en échec** : la surveillance ne reprend pas les réglages enregistrés, et l'interface le signale (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Régler les durées de l'installation | Nominal | Le propriétaire ouvre la conservation de l'installation |
| A1 | Surcharger une durée pour une caméra | Alternative | Le propriétaire ouvre l'onglet « Conservation » d'une caméra |
| A2 | Activer l'enregistrement de la vidéo complète | Alternative | Le propriétaire donne une durée à la vidéo complète |
| E1 | La surveillance ne reprend pas le réglage | Échec | Le redémarrage de la surveillance échoue |

## Détail des chemins

### N1 · Régler les durées de l'installation

1. Le propriétaire règle la durée de chaque nature d'enregistrement pour toute l'installation (HIST-16, HIST-06).
2. Il voit ce qu'il a modifié, enregistre (UI-11), puis applique les changements (UC-UI-02).

### A1 · Surcharger une durée pour une caméra

1. Le propriétaire surcharge une durée sur l'onglet « Conservation » de la caméra (CAM-03) ; l'écran dit laquelle des deux portées s'applique (HIST-06, UI-08).
2. Le chemin reprend à N1, pas 2.

### A2 · Activer l'enregistrement de la vidéo complète

1. Avant l'activation, l'écran annonce l'ordre de grandeur de la consommation disque (HIST-07, UI-19).
2. Le chemin reprend à N1, pas 2.

### E1 · La surveillance ne reprend pas le réglage

1. L'interface le signale de façon persistante et permet de réessayer (UI-17).

## Règles locales

- **HIST-06** · une duree de retention doit valoir pour toute l'installation par defaut, et rester surchargeable camera par camera ; une camera qui ne surcharge rien suit l'installation, et l'interface doit rendre visible lequel des deux s'applique ;
- **HIST-07** · l'enregistrement de la video complete doit rester un choix explicite, et l'ordre de grandeur de sa consommation disque doit etre annonce avant activation ;
- **HIST-16** · la retention doit etre configurable, sur trois natures d'enregistrement distinctes : la video complete, les portions ou l'image bouge, et les clips rattaches a une detection ; chacune a sa propre duree ; une duree nulle signifie que rien n'est conserve pour la video complete ou les portions ou l'image bouge ; les clips rattaches a une detection, qui font l'historique, sont gardes au moins un jour, et l'ecran le dit avant la saisie ; ne plus garder de nouvelle video d'une camera se fait par le mode vie privee (PRIV-13), qui arrete les nouveaux enregistrements sans effacer les clips deja gardes, toujours soumis a ce minimum d'un jour ;
- **HIST-09** · le systeme doit supprimer automatiquement les donnees arrivees au terme de retention.

## Points ouverts

Aucun.
