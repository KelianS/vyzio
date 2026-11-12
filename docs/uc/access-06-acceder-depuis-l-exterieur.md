# UC-ACCESS-06 · Accéder à l'interface depuis l'extérieur

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire, qui l'active ; l'utilisateur, qui s'en sert |
| **Objectif** | **En tant qu'utilisateur en deplacement**, je veux acceder a l'interface complete depuis l'exterieur de chez moi, sans configurer ma box ni exposer mes cameras sur Internet. **En tant qu'utilisateur soucieux de ma vie privee**, je veux que mes images ne transitent jamais en clair chez un tiers pour que je puisse les consulter a distance. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : l'interface complète s'ouvre depuis l'extérieur, chiffrée (SEC-03, SEC-04), sans que rien d'autre que le produit soit joignable (ACCESS-13).

**Résultats en échec** : l'accès distant ne répond pas, et l'usage local continue sans lui (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Activer l'accès distant | Nominal | Le propriétaire ouvre le réglage d'accès à distance |
| A1 | Utiliser l'interface depuis l'extérieur | Alternative | L'utilisateur ouvre l'interface hors de chez lui |
| A2 | Retirer l'accès distant | Alternative | Le propriétaire retire l'accès distant |
| E1 | L'accès distant ne répond pas | Échec | Le service dont dépend l'accès distant est indisponible |

## Détail des chemins

### N1 · Activer l'accès distant

1. Le propriétaire ouvre l'accès à distance, un réglage d'installation ordinaire (ACCESS-16), optionnel (ACCESS-14).
2. Quand l'accès repose sur un service tiers, l'interface le guide pas à pas et le lui annonce (ACCESS-15).
3. L'accès est actif, sans configuration de la box (ACCESS-12), et son état est visible (ACCESS-16).

### A1 · Utiliser l'interface depuis l'extérieur

1. L'utilisateur ouvre l'interface hors de chez lui, par le réseau overlay chiffré (SEC-03) ; il s'y connecte comme sur place (UC-ACCESS-02).

### A2 · Retirer l'accès distant

1. Le propriétaire retire l'accès distant depuis l'interface (ACCESS-14, ACCESS-16) ; le produit reste entier sans lui.

### E1 · L'accès distant ne répond pas

1. Le service dont dépend l'accès distant est indisponible : sa disponibilité ne dépend pas de Vyzio (ACCESS-15), et l'usage local n'en dépend jamais (ACCESS-14).

## Règles locales

- **ACCESS-12** · l'acces depuis l'exterieur du domicile doit exister sans exiger de configuration du routeur, et doit fonctionner meme lorsque l'operateur ne fournit pas d'adresse publique dediee ;
- **ACCESS-13** · l'acces distant ne doit rendre joignable **que le produit** : les cameras et les composants internes ne doivent jamais devenir atteignables depuis l'exterieur ;
- **ACCESS-14** · l'acces distant doit rester **optionnel, gratuit dans son parcours nominal et retirable** ; les fonctions d'acces distant doivent etre explicites, optionnelles et desactivables ; le produit doit rester entier sans lui, et l'usage local ne doit jamais dependre de sa disponibilite ;
- **ACCESS-15** · si l'acces distant repose sur un service tiers, l'interface doit guider l'utilisateur pas a pas, l'annoncer explicitement, et indiquer que sa disponibilite ne depend pas de Vyzio ;
- **ACCESS-16** · l'acces distant doit se presenter comme un reglage d'installation ordinaire : etat visible, activation et retrait depuis l'interface, sans manipulation de fichier.

## Points ouverts

Aucun.
