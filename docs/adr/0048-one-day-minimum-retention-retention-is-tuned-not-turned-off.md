# ADR-48 — Rétention minimale d'un jour : la conservation se règle, elle ne s'éteint pas

> Statut : Accepté
>
> Rétracte un point d'[ADR-39](0039-global-settings-overridable-per-camera-applied-to-recording-retention.md) :
> zéro comme valeur légitime des trois durées, et la caméra qui n'enregistre rien qui en découlait.

## Contexte

[ADR-39](0039-global-settings-overridable-per-camera-applied-to-recording-retention.md) a fait de
zéro une valeur légitime — « ne rien conserver de cette nature » — et en a tiré un effet observable :
une caméra dont les trois durées valent zéro reçoit `record.enabled: false`.

Ce zéro était pensé pour l'enregistrement, où il a du sens : ne pas garder de vidéo intégrale est un
choix courant, et c'est même la valeur livrée. Mais la troisième durée, celle des clips d'événement,
**porte l'historique** — la page la plus consultée du produit. Zéro y signifie « détecter, notifier,
et ne rien pouvoir montrer ensuite ».

[ADR-49](0049-vyzio-does-not-persist-detections-history-is-frigates-list-enriched-on-read.md)
rend le coût de ce zéro visible. Si l'historique **est** la liste de Frigate, alors une durée à zéro
ne produit pas un historique court : elle produit un historique qui n'existe pas. Le cas particulier
devrait être porté partout — lecture, affichage, notification — pour un seul résultat utile, un écran
vide que rien n'explique.

`KeepsAnything` est l'autre face du problème : un fait métier calculé sur trois compteurs, consulté à
deux endroits de la génération de configuration, dont l'unique raison d'être est ce cas limite.

## Options comparées

1. **Garder zéro, et traiter le cas partout.** Écartée : le cas limite se propage à chaque étape du
   pipeline de détection pour desservir un réglage dont le résultat est un produit qui ne montre
   rien. Le coût est permanent, le bénéfice nul.
2. **Garder zéro, et prévenir l'utilisateur des conséquences.** Écartée : c'est de l'explicabilité
   (#4) dépensée à justifier un réglage qui casse le produit, quand elle devrait servir à expliquer
   ce que le produit fait. Un réglage qu'il faut dissuader d'utiliser n'a pas à exister.
3. **Interdire zéro sur les trois durées.** Écartée : l'enregistrement intégral à zéro est la valeur
   livrée et un choix délibéré assumé par ADR-39 comme par
   [ADR-18](0018-continuous-recording-enabled-per-camera-in-the-generated-frigate-config.md) — c'est le seul dont le
   coût disque croît avec le temps qui passe et non avec ce qui se produit.
4. **Un plancher d'un jour sur la seule durée qui porte l'historique.** Retenue.

## Décision

**Option 4. La durée des clips d'événement vaut au minimum un jour**, à l'échelle de l'installation
comme dans une surcharge de caméra. Le plancher est posé au foyer unique où la rétention effective se
résout, donc valable pour toute couche qui l'interroge — génération de configuration comme frontière
API.

Les deux autres durées gardent zéro : ne pas enregistrer en continu reste un choix, et ADR-39 tient
sur ce point.

**`record.enabled: false` disparaît**, et avec lui la notion de caméra qui n'enregistre rien : une
caméra activée conserve au moins un jour de clips d'événement. Ne pas vouloir de vidéo d'une caméra
s'exprime en la désactivant, ce qui est déjà le geste prévu et le seul qui fasse cesser aussi la
détection — un réglage de durée n'a jamais été le bon endroit pour éteindre une caméra.

## Conséquences

- **Une installation ou une caméra réglée à zéro passe à un jour**, en silence à la première
  résolution. C'est un élargissement de ce qui est conservé, jamais une perte ; aucune reprise de
  données n'est nécessaire.
- **Le pipeline de détection n'a plus de cas « rien à montrer ».** C'est ce qui justifie cette
  décision maintenant plutôt qu'à froid : elle retire un cas limite d'un chantier en cours plutôt
  que d'en absorber le coût.
- **Le plancher est une contrainte de Vyzio, pas de Frigate**, qui accepterait zéro. Il est donc
  posé côté Vyzio, au même endroit que le plafond de 365 jours qui existe déjà pour la même raison —
  empêcher un réglage de produire une installation absurde.
- **L'interface doit refuser zéro sur cette durée**, et le dire avant la saisie plutôt qu'après :
  un contrôle qui accepte une valeur pour la corriger ensuite contredit
  [ADR-43](0043-settings-grammar-a-setting-is-declared-not-drawn.md).
- **Ce qu'ADR-39 pose et qui reste vrai** : le modèle global-surchargeable, les trois durées
  distinctes, `null` qui signifie « suivre l'installation », et zéro sur les deux durées
  d'enregistrement. Seuls tombent le zéro sur les clips d'événement et l'extinction qui en découlait.
