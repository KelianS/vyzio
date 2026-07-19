# Docs — cadrage (chargé à l'édition de `docs/`)

Ce dossier porte les documents de cadrage. Avant d'en écrire ou modifier un, applique l'**ordre
imposé**, l'**architecture documentaire** (types SAD / ADR / TAD…) et la **discipline de rédaction**
définis dans [`WORKFLOW.md`](WORKFLOW.md) — foyer unique de la gouvernance documentaire.

Où écrire quoi : une **décision** d'architecture → un ADR dans [`adr/`](adr/) ; le **fonctionnement
détaillé** d'un composant → un TAD dans [`design/`](design/) ; les **frontières et la vue
d'ensemble** → [`SAD.md`](SAD.md), qui référence ADR et TAD sans les recopier.

Rappel du point le plus souvent enfreint : **un SAD définit la cible, pas l'histoire.** Ce qui était
fait avant ne vit que dans la rubrique « Options écartées » de l'ADR concerné. Corollaires (pas de
paraphrase du code, historique d'exploration → [`investigations/`](investigations/)) : voir WORKFLOW.md.
