# UC-ACCESS-04 · Changer son mot de passe

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir changer mon mot de passe, afin de reprendre son acces a qui l'aurait appris. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : le nouveau mot de passe vaut, et toutes les sessions ouvertes ailleurs sont refermées (ACCESS-10).

**Résultats en échec** : l'ancien mot de passe n'est pas le bon, et rien ne change (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Changer le mot de passe | Nominal | Le propriétaire choisit de changer son mot de passe |
| E1 | L'ancien mot de passe est faux | Échec | Le mot de passe redemandé ne correspond pas |

## Détail des chemins

### N1 · Changer le mot de passe

1. Le propriétaire saisit l'ancien mot de passe, puis le nouveau (ACCESS-10).
2. Le changement referme toutes les sessions ouvertes ailleurs (ACCESS-10).

### E1 · L'ancien mot de passe est faux

1. Le mot de passe redemandé ne correspond pas : rien ne change.

## Règles locales

- **ACCESS-10** · **changer son mot de passe** se fait dans l'interface : l'ancien est redemande, et le changement referme toutes les sessions ouvertes ailleurs.

## Points ouverts

Aucun.
