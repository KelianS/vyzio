# UC-ACCESS-01 · Créer le mot de passe du propriétaire

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux proteger l'acces a mon systeme, afin qu'un tiers local ne puisse pas consulter mes donnees. |

## Conditions

**Préalables** :

- l'installation est neuve, ou son mot de passe a été remis à zéro (UC-ACCESS-05).

**Résultat en succès** : l'interface est protégée par le mot de passe du propriétaire (ACCESS-03), qui est connecté et arrive à l'accueil (UC-UI-01).

**Résultats en échec** : aucun propre à ce cas ; sans mot de passe, rien d'autre ne s'ouvre (ACCESS-06).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Créer le mot de passe à la mise en service | Nominal | Le propriétaire ouvre une installation neuve |

## Détail des chemins

### N1 · Créer le mot de passe à la mise en service

1. Le propriétaire ouvre l'interface : elle s'ouvre sur la création du mot de passe (ACCESS-06).
2. Il choisit son mot de passe ; il est connecté (UC-ACCESS-02), et l'accueil annonce la mise en service (UC-UI-01 A1).

## Règles locales

- **ACCESS-06** · une installation neuve **s'ouvre sur la creation du mot de passe** du proprietaire : c'est la premiere etape, avant l'ajout d'une camera, et elle ne se saute pas.

## Points ouverts

Aucun.
