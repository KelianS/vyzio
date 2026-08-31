# ADR-11 — Stratégie UX non-tech : Hub Vyzio simplifié + Frigate avancé

> Statut : Accepté

## Contexte

Le besoin produit principal est l'accessibilité pour des utilisateurs non-tech. Frigate est puissant mais expose des concepts parfois complexes (configuration, flux caméra, tuning).

## Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| UI Frigate seule | Time-to-market maximal | Trop technique pour la promesse grand public |
| UI Vyzio 100% custom | Contrôle total UX | Coût/risque très élevé, duplication |
| **Approche hybride** | Simplicité pour non-tech + puissance expert | Nécessite une gouvernance claire des frontières |

## Décision

Vyzio adopte une **stratégie UX en deux couches** :

- **Couche 1 (par défaut)** : Hub Vyzio, orienté assistant, vocabulaire non-tech, workflow guidé.
- **Couche 2 (optionnelle)** : UI Frigate en mode avancé pour experts/support.

## Frontières produit

- Vyzio Hub gère : installation, onboarding, découverte caméra, tests de flux, génération de configuration, presets simples.
- Frigate gère : opérations avancées NVR/enrichissements, debug, tuning expert.
- Vyzio API orchestre la cohérence entre les deux couches et protège l'accès par rôle.

## Conséquences

- ✅ Répond à la promesse "clef en main" sans perdre la puissance Frigate
- ✅ Réduit le coût de développement UI en réutilisant l'existant pertinent
- ✅ Permet une progression utilisateur du mode simple vers expert
- ⚠️ Exige une documentation claire des parcours simple vs avancé
