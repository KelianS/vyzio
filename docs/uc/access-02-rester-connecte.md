# UC-ACCESS-02 · Se connecter et le rester

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur, propriétaire ou résident (ACCESS-01) |
| **Objectif** | **En tant qu'utilisateur**, je veux que mon telephone reste connecte, afin de ne pas ressaisir un mot de passe chaque fois que je jette un oeil a mes cameras. |

## Conditions

**Préalables** :

- le mot de passe du propriétaire existe (UC-ACCESS-01).

**Résultat en succès** : l'utilisateur est connecté, et le reste sur cet appareil (ACCESS-07).

**Résultats en échec** : la session est terminée, et l'écran de connexion le dit (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Se connecter | Nominal | L'utilisateur ouvre l'interface sans session |
| A1 | Rouvrir l'interface sans rien ressaisir | Alternative | L'utilisateur rouvre l'interface depuis un appareil déjà connecté |
| E1 | La session est terminée | Échec | La session a expiré, ou a été fermée ailleurs |

## Détail des chemins

### N1 · Se connecter

1. L'utilisateur ouvre l'interface et saisit le mot de passe ; il est connecté.

### A1 · Rouvrir l'interface sans rien ressaisir

1. L'utilisateur rouvre l'interface depuis le même appareil : rien ne lui est redemandé (ACCESS-07, ACCESS-04).

### E1 · La session est terminée

1. La session a expiré, ou a été fermée ailleurs (UC-ACCESS-03, UC-ACCESS-04).
2. L'interface ramène à l'écran de connexion en le disant (ACCESS-08) ; le chemin reprend à N1.

## Règles locales

- **ACCESS-07** · une fois connecte, l'utilisateur le reste : rouvrir l'interface depuis le meme appareil ne redemande rien pendant la duree d'ACCESS-04 ;
- **ACCESS-08** · une session terminee ramene a l'ecran de connexion en le disant, jamais sur un ecran vide ou une erreur technique.

## Points ouverts

Aucun.
