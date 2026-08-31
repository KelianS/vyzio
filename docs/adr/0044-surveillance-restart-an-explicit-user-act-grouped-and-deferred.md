# ADR-44 — Redémarrage de la surveillance : un acte explicite de l'utilisateur, groupé et différé

> Statut : Accepté
>
> Remplace le volet « enregistrer vaut appliquer » de
> [ADR-41](0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md).

## Contexte

[ADR-41](0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md) a
supprimé le troisième état — « enregistré mais pas appliqué » — en décidant qu'enregistrer valait
appliquer, la mise en service se poursuivant en arrière-plan.

La livraison du socle a montré deux choses.

**Le troisième état n'a jamais disparu ; il est sorti de la vue.** Chaque enregistrement de réglage
appelle `WriteConfigAsync`, qui écrit la configuration du moteur et pose un marqueur en attente, mais
ne redémarre rien. Seul `ApplyAsync` redémarre, et son unique déclencheur dans l'interface est
`POST /api/cameras/apply-configuration`, appelé depuis le seul écran d'ajout hérité. Les écrans de
réglages livrés disent donc « Enregistrer » et annoncent une interruption de la surveillance qui ne
se produit pas : le réglage reste écrit-mais-pas-en-service jusqu'à ce que quelqu'un presse un bouton
situé ailleurs.

**Et le redémarrage n'est pas une formalité administrative.** C'est une interruption de la
surveillance. Le placer en tâche de fond ne masque pas un détail d'implémentation : cela décide, à la
place de l'utilisateur, du moment où ses caméras cessent de voir. Dans un produit local-first où il
est seul maître de son installation, ce choix ne nous revient pas. ADR-41 a voulu supprimer une étape
administrative et a supprimé avec elle un fait qui compte.

Une vérification borne le risque du décalage : choisir une stratégie de vie privée n'écrit rien chez
le moteur (`SetCameraPrivacyStrategyUseCase` ne prend que le repository), et **couper réellement la
surveillance** (`ToggleCameraPrivacyModeUseCase`) appelle `ApplyAsync` immédiatement. La promesse de
vie privée ne dépend donc d'aucun redémarrage différé.

## Options comparées

1. **Mise en service en tâche de fond, fusionnante** (décision d'ADR-41). Écartée : elle rend le
   moment de l'interruption ni choisi ni visible, ce qui est précisément ce qu'il fallait éviter. Elle
   exige en outre un service de fond et une file fusionnante dont le coût n'achète rien d'autre que ce
   masquage.
2. **Redémarrage explicite, global et différé.** Retenue.
3. **Redémarrage synchrone à chaque enregistrement.** Écartée : elle interrompt la surveillance à
   chaque réglage validé, sérialise les pages, et facture à une page un délai qui appartient à
   l'installation.

## Décision

**Option 2.**

### Enregistrer enregistre ; redémarrer redémarre

Deux gestes, deux portées. **Enregistrer** est local à la page, immédiat, et sans effet sur la
surveillance. **Redémarrer la surveillance** est un acte d'installation, explicite, et groupé.

Ce n'est pas le retour des trois étapes qu'ADR-41 combattait : l'ancien « appliquer » était une
corvée **par changement**. Celui-ci est global — N réglages sur M pages, un seul redémarrage — donc
moins de gestes que tout modèle où chaque enregistrement redémarre.

### Une action s'applique tout de suite, un réglage attend le redémarrage

La frontière existe déjà, tracée par le brouillon d'ADR-41 : vérifier une connexion, supprimer une
caméra, couper la surveillance sont des **actions** — elles agissent et rendent un résultat. Elles ne
diffèrent jamais. Un **réglage** est une valeur ; il attend.

### Le décalage se voit, et le déclencheur est ce qui le dit

Vyzio et le moteur ont le droit de diverger temporairement, et rien n'oblige à réconcilier tout de
suite. Cette permission n'est tenable qu'à une condition : le décalage **se voit**. C'est le rôle du
déclencheur lui-même, dont la seule présence énonce qu'il reste quelque chose à reprendre — jamais
une pastille muette à côté, qui serait l'état opaque que le principe produit #4 proscrit.

> Une première version nommait en plus le **domaine** touché (« Détection et Conservation attendent
> le redémarrage »). Retiré à l'usage : le domaine est une catégorie de notre architecture de
> l'information, pas une chose que l'utilisateur reconnaît — il vient de régler une sensibilité, pas
> « la Détection ». Nommer un domaine satisfaisait la lettre de l'exigence sans rien apprendre. Le
> niveau de détail qui aurait servi — le réglage exact — supposerait de faire remonter le vocabulaire
> d'interface jusque dans la couche applicative, ce qui coûte plus qu'il ne rend.

### Le déclencheur est toujours atteignable, et la question se pose en sortant des réglages

Le déclencheur est visible depuis n'importe où, et n'apparaît que lorsqu'il y a quelque chose à
redémarrer : son absence est alors une information positive.

La question « redémarrer maintenant ? » **ne se pose pas au changement de page**. Passer de Détection
à Conservation est le geste le plus courant quand on règle, et le brouillon y a déjà sa propre
confirmation — deux modales d'affilée dans le pire cas. La frontière qui a du sens est la **sortie des
réglages** vers la consultation : là, l'utilisateur a fini de régler, et la question est réelle.

### Le déclencheur ne s'allume que si un redémarrage est requis

Notifications, profils, positions PTZ et réglages d'image ne touchent pas la configuration du moteur.
Un déclencheur qui apparaîtrait après ces réglages-là crierait au loup, et l'état nommé ci-dessus
mentirait.

La garantie est **structurelle** plutôt que déclarative : l'attente n'est nourrie que par les
écritures qui changent réellement la configuration. Un réglage qui n'écrit pas ne peut donc pas
convoquer le déclencheur, et un enregistrement qui ne change rien ne le convoque pas non plus.

> ADR-41 demandait en plus que l'API dise **avant** enregistrement si un réglage exigeait un
> redémarrage, pour que le brouillon en annonce le coût. Ce besoin **disparaît avec la présente
> décision** : enregistrer ne coûte plus rien à annoncer. Construire cette réponse ne servirait
> aucun lecteur.

### Le vocabulaire nomme l'effet, jamais la technique

Le principe produit #2 interdit de nommer le moteur, **pas** de nommer ce qui se passe. Un terme de
service générique — « mettre en service » — ne cacherait pas un détail d'implémentation : il cacherait
l'interruption elle-même. Le verbe retenu est donc **« redémarrer la surveillance »** : le mécanisme
est dit, l'objet nommé est celui que l'utilisateur reconnaît, et le moteur n'est jamais prononcé.

Mais le déclencheur et la question ne parlent pas du même instant. La question est posée au moment de
décider, et nomme l'acte. Le déclencheur, lui, **peut se lire des jours après l'enregistrement**, sans
que rien n'ait redémarré : il nomme donc l'état qui persiste, **« appliquer les changements »**, et non
un acte accompli. L'interruption reste énoncée là où elle se décide. Les formulations exactes vivent
dans le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md), foyer unique du vocabulaire d'interface.

## Conséquences

- **ADR-41 est partiellement remplacé.** Tombent : « Deux temps, pas trois » et « Enregistrer rend la
  main tout de suite ; la mise en service se poursuit derrière ». Survivent inchangés : le brouillon,
  son unité par page, la confirmation en quittant une page modifiée, le retour arrière par champ, et
  l'échec de redémarrage comme état persistant.
- **Le coût annoncé déménage.** La barre de brouillon annonce aujourd'hui une interruption de la
  surveillance au moment d'enregistrer ; c'est faux depuis le premier jour. L'annonce appartient au
  redémarrage.
- **Ni file d'attente ni service de fond.** Le besoin disparaît avec la décision : c'est l'utilisateur
  qui ordonnance, et il ne redémarre qu'une fois.
- **`HasPendingChanges` redevient un état de premier plan**, et un booléen suffit : c'est la présence
  du déclencheur qui porte le message, pas une énumération.
- **L'écran d'ajout hérité ne peut être démonté qu'après le relogement du déclencheur**, dont il est
  aujourd'hui le seul appelant.
