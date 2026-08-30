# ADR-46 — Tout le pilotage PTZ dans la vue live, calibration comprise

> Statut : Accepté
>
> Rétracte deux points d'[ADR-45](0045-positions-ptz-configurees-depuis-la-vue-live-pas-les-reglages.md) :
> la calibration restée dans les réglages, et l'appui long comme geste de création.

## Contexte

[ADR-45](0045-positions-ptz-configurees-depuis-la-vue-live-pas-les-reglages.md) a déplacé l'édition
des positions dans la vue live, en laissant la calibration dans la fiche caméra. À l'usage, deux
défauts en découlent (relevés au chantier `ui-defauts`, livré) :

**Une caméra non calibrée rend la vue live inerte sans le dire.** Sans position de référence, la
caméra ne sait pas où elle est : enregistrer une position échoue et y aller ne mène nulle part. La
vue live jetait pourtant le `calibrated` que `GET /ptz/presets` lui renvoyait. L'utilisateur voyait
des tuiles qui ne répondaient pas, sans savoir pourquoi ni quoi faire ; il fallait deviner qu'un
passage par les réglages débloquait la situation.

**L'appui long, seul geste de création, contredit ce que la tuile `+` annonce.** ADR-45 voulait
déjà que créer soit l'acte léger — « en définir une nouvelle n'écrase rien et se fait sans
confirmation » — mais lui a donné le geste lourd, celui de l'écrasement. Sur mobile, ce geste est
en plus disputé : l'appui long ouvre le menu contextuel du navigateur.

## Options comparées

1. **La vue live explique, et renvoie aux réglages pour calibrer.** Écartée : elle impose un
   aller-retour pour une opération que la vue live peut faire, et qu'elle est le seul endroit à
   pouvoir montrer — on ne calibre pas une caméra sans la voir bouger.
2. **La calibration rejoint la vue live ; la fiche caméra n'est plus qu'une porte.** Retenue. Elle
   achève ce qu'ADR-45 avait commencé : un seul endroit pour piloter une caméra.
3. **Calibrer automatiquement à la première tentative d'enregistrement.** Écartée : la calibration
   envoie la caméra en butée mécanique. La déclencher sans la demander détruirait le cadrage que
   l'utilisateur venait justement de viser.

## Décision

**Option 2, et le geste de création devient l'appui simple.**

- **Tout le pilotage vit dans `PtzControlPanel`** : joystick, positions, et calibration. Quand la
  caméra n'a pas de référence, le panneau le dit et propose de calibrer sur place ; les tuiles ne
  sont pas modifiables tant que ce n'est pas fait. La fiche caméra ne garde que l'état lu et le
  bouton qui ouvre la vue live.
- **Trois gestes, trois actes.** Appui sur une position vide : elle s'enregistre. Appui sur une
  position définie : la caméra y va. Appui long sur une position définie : elle se redéfinit, après
  confirmation. L'appui long ne porte plus que l'écrasement, et le menu contextuel du navigateur est
  neutralisé là où il volait ce geste.
- **Le panneau accuse ce qu'il fait** : une arrivée en position s'annonce, et la position où se
  trouve la caméra se lit sur la tuile (`aria-pressed`), déduite du `currentPosition` que l'API
  renvoyait déjà sans que rien ne l'utilise.

## Conséquences

- `PtzCalibrationSection` ne calibre plus : elle lit l'état et ouvre la vue live. Son nom devient
  impropre — à renommer quand on y touchera.
- La vue live reçoit `ptzCalibrate` en plus, depuis l'accueil comme depuis la fiche caméra : les
  deux portes mènent au même panneau, avec les mêmes pouvoirs.
- Le geste de création n'a plus de délai : la latence perçue à la première position disparaît.
