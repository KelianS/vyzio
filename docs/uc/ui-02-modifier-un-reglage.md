# UC-UI-02 · Modifier un réglage et l'appliquer

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur non-technicien**, je veux trouver un reglage sans savoir comment le produit est construit. **En tant qu'utilisateur exigeant**, je veux acceder aux reglages fins sans qu'ils encombrent le parcours courant. **En tant qu'utilisateur**, je veux savoir ce que j'ai modifie avant de valider, et pouvoir renoncer. **En tant qu'utilisateur**, je veux choisir moi-meme le moment ou ma surveillance s'interrompt. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : le réglage est enregistré, puis repris par la surveillance au moment que le propriétaire a choisi (UI-13).

**Résultats en échec** : la surveillance ne reprend pas les réglages enregistrés, et l'interface le signale de façon persistante (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Modifier, enregistrer, puis appliquer | Nominal | Le propriétaire change un réglage |
| A1 | Renoncer | Alternative | Le propriétaire renonce à ses modifications |
| A2 | Quitter les réglages sans redémarrer | Alternative | Le propriétaire ne veut pas interrompre la surveillance maintenant |
| A3 | Régler un réglage rare | Alternative | Le réglage cherché est mis en profondeur |
| E1 | La surveillance ne reprend pas les réglages | Échec | Le redémarrage échoue |

## Détail des chemins

### N1 · Modifier, enregistrer, puis appliquer

1. Le propriétaire trouve le réglage à son emplacement prévisible, à la portée qu'il lit sans explication (UI-07, UI-08), présenté comme les réglages de même nature (UI-18), l'aide à portée de doigt (UI-19).
2. Il le modifie : rien ne change encore ; il voit ce qu'il a modifié (UI-11).
3. Il enregistre : la main lui revient aussitôt (UI-12, UI-20).
4. En quittant les réglages, la question de redémarrer se pose quand un réglage l'exige (UI-13, UI-15) ; il redémarre.

### A1 · Renoncer

1. Le propriétaire renonce avant d'enregistrer : rien ne change (UI-11).

### A2 · Quitter les réglages sans redémarrer

1. Le propriétaire quitte sans redémarrer : l'écart se voit et dit quels réglages attendent (UI-14).
2. Il redémarre plus tard, depuis n'importe où (UI-13).

### A3 · Régler un réglage rare

1. Le réglage est mis en profondeur, atteignable sans mode à activer (UI-09) ; le chemin reprend à N1, pas 2.

### E1 · La surveillance ne reprend pas les réglages

1. L'interface le signale de façon persistante et permet de réessayer (UI-17).

## Règles locales

Aucune.

## Points ouverts

Aucun.
