# ADR-45 — Positions PTZ configurées depuis la vue live, jamais depuis les réglages

> Statut : Accepté — la calibration restée dans les réglages et l'appui long comme geste de
> création sont rétractés par
> [ADR-46](0046-tout-le-pilotage-ptz-dans-la-vue-live-calibration-comprise.md).

## Contexte

SPECS §9.3 l'exige déjà : « les contrôles PTZ doivent être accessibles depuis la vue live de la
caméra (pas seulement depuis les paramètres) — c'est le parcours d'usage quotidien ». L'implémentation
livrée par [ADR-26](0026-miniatures-de-positions-ptz-capture-client-triggered.md) ne l'a jamais
respecté pour l'écriture : la section positions PTZ de la fiche caméra (`PtzPresetsSection`) exposait
un bouton « Définir ici » qui enregistrait **immédiatement** la position courante de la caméra, sans
aucun moyen de l'orienter avant — le joystick n'existe que dans la modale live
(`PtzControlPanel`/`LiveFeedModal`). L'utilisateur ne pouvait donc définir une position qu'en la
laissant où elle se trouvait par hasard, jamais en la choisissant.

## Options comparées

1. **Dupliquer le joystick dans l'écran de réglages**, pour que déplacement et enregistrement se
   fassent au même endroit que l'ancien bouton. Écartée : un second joystick à maintenir en plus de
   celui de la vue live, pour un geste que SPECS §9.3 place justement dans la vue live.
2. **Déplacer l'édition des positions dans la vue live**, à côté du joystick qui y vit déjà ; l'écran
   de réglages ne garde que la calibration et une porte vers cette vue live. Retenue.
3. **Garder l'édition dans les réglages, bouton désactivé tant que l'utilisateur n'est pas passé par
   la vue live.** Écartée : un aller-retour entre deux écrans pour un seul geste, sans rien gagner sur
   l'option 2, pour un état supplémentaire à suivre.

## Décision

**Option 2.** Une position PTZ ne se configure qu'à un seul endroit : `PtzControlPanel`, dans la vue
live. La fiche caméra ne porte plus que `PtzCalibrationSection` — statut de calibration, bouton de
calibration, et un bouton « Configurer les positions » qui ouvre la vue live en overlay.

### Un geste, deux actions

Chaque position s'affiche en tuile — miniature si configurée, `+` sinon. **Un appui** va à la
position ; **un appui long** enregistre la position courante de la caméra dans cette tuile. Écraser
une position déjà configurée demande confirmation (modale) ; en définir une nouvelle (tuile `+`)
n'écrase rien et se fait sans confirmation.

## Conséquences

- `PtzPresetsSection` (réglages) est supprimée ; remplacée par `PtzCalibrationSection`, qui ne connaît
  plus les positions elles-mêmes.
- `PtzControlPanel` gère désormais lui-même le chargement des presets, leur sauvegarde et la capture
  de miniature déclenchée par [ADR-26](0026-miniatures-de-positions-ptz-capture-client-triggered.md) —
  ce n'était plus réparti entre deux composants.
- La liste d'affichage d'ADR-26 (« Affichage ») pointe ici plutôt que vers un composant qui n'existe
  plus.
