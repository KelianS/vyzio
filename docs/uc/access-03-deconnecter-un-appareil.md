# UC-ACCESS-03 · Déconnecter un appareil

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir deconnecter un appareil perdu, afin qu'il cesse d'acceder a mes images. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : l'appareil visé n'accède plus à l'interface ; une nouvelle ouverture y demande le mot de passe (UC-ACCESS-02 E1).

**Résultats en échec** : aucun propre à ce cas.

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Déconnecter tous les appareils | Nominal | Un téléphone est perdu |
| A1 | Se déconnecter de cet appareil | Alternative | L'utilisateur se déconnecte de l'appareil qu'il tient |

## Détail des chemins

### N1 · Déconnecter tous les appareils

1. L'utilisateur choisit de déconnecter tous les appareils (ACCESS-09) ; c'est une action, qui prend effet tout de suite (UI-16).

### A1 · Se déconnecter de cet appareil

1. L'utilisateur se déconnecte depuis l'interface (ACCESS-09).

## Règles locales

- **ACCESS-09** · se deconnecter est possible depuis l'interface, et **deconnecter tous les appareils** l'est aussi — c'est le geste attendu quand un telephone est perdu.

## Points ouverts

Aucun.
