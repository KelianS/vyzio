# UC-ACCESS-05 · Retrouver l'accès après un oubli

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire, sur la machine qui héberge Vyzio |
| **Objectif** | **En tant qu'utilisateur**, je veux pouvoir revenir dans mon installation apres avoir oublie mon mot de passe, sans perdre mes cameras ni mon historique. |

## Conditions

**Préalables** :

- le propriétaire a accès à la machine qui héberge Vyzio.

**Résultat en succès** : le propriétaire a choisi un nouveau mot de passe, et retrouve ses caméras et son historique (ACCESS-11).

**Résultats en échec** : personne ne choisit de mot de passe à temps, et l'installation se reverrouille (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Remettre le mot de passe à zéro | Nominal | Le propriétaire a oublié son mot de passe |
| E1 | Personne ne choisit de mot de passe à temps | Échec | Le délai d'ACCESS-05 passe sans nouveau mot de passe |

## Détail des chemins

### N1 · Remettre le mot de passe à zéro

1. Le propriétaire remet le mot de passe à zéro depuis la machine qui héberge Vyzio (ACCESS-11).
2. L'installation rouvre sur l'écran de choix du mot de passe (ACCESS-05) ; le chemin reprend à UC-ACCESS-01 N1, pas 2.

### E1 · Personne ne choisit de mot de passe à temps

1. Le délai passe sans nouveau mot de passe : l'installation se reverrouille (ACCESS-11).

## Règles locales

- **ACCESS-11** · un mot de passe oublie se remet a zero **depuis la machine qui heberge Vyzio**, sans compte cloud ni envoi de courriel. La remise a zero *retire* le mot de passe : l'installation reouvre sur l'ecran de choix pendant la duree d'ACCESS-05, sans rien perdre de ses cameras ni de son historique, puis se reverrouille si personne n'en choisit un.

## Points ouverts

Aucun.
