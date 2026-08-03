# Durées de conservation

> Où : **Réglages** → **Conservation**, pour toutes les caméras.
> Pour une caméra en particulier : sa fiche → section **Détection** → bloc **Ce qui est conservé**.

## À quoi ça sert

Vyzio conserve trois choses différentes, et vous décidez combien de temps chacune est gardée.

| Ce qui est conservé | Ce que c'est | Livré à |
| --- | --- | --- |
| **Vidéo complète** | Tout, en continu, même quand il ne se passe rien | 0 jour (rien) |
| **Séquences de mouvement** | Seulement les moments où l'image bouge | 7 jours |
| **Clips d'alerte** | Les extraits rattachés à une détection, ceux de l'historique | 14 jours |

Mettre **0** signifie que rien n'est conservé de cette nature. Si les trois valent 0 pour une
caméra, cette caméra n'enregistre plus rien du tout.

## Le réglage vaut pour toutes les caméras, sauf si l'une en décide autrement

Dans **Réglages** → **Conservation**, vous fixez les trois durées **pour toutes vos caméras**. C'est le cas
normal : l'espace disque est partagé, autant raisonner sur l'ensemble.

Sur la fiche d'une caméra (**Réglages** → **Caméras**), les trois mêmes durées apparaissent, **déjà remplies avec ce qui
s'applique**. La couleur du nombre dit d'où il vient :

- **Grisé** — la valeur vient de la page **Conservation**. Si vous la changez, cette caméra suivra.
- **Normal, avec un bouton ↺ à côté** — cette durée-là est propre à la caméra et ne bouge plus avec
  le réglage d'ensemble. Le bouton vous y ramène, en nommant la valeur que vous retrouverez.

Écrire dans un champ grisé suffit à en faire une valeur propre à la caméra.

La page **Conservation** marche pareil, un cran au-dessus : une durée que vous n'avez jamais
touchée reste grisée, et dès que vous la changez un **↺** apparaît pour revenir à la valeur d'origine
de Vyzio. Vous pouvez donc toujours retrouver un état connu.

**Chaque durée est indépendante.** Donner 30 jours de mouvement à la caméra du jardin ne détache pas
ses deux autres durées : elles continuent de suivre le réglage d'ensemble.

## Rien ne part tant que vous n'avez pas validé

Vous pouvez changer les durées, revenir en arrière, essayer : **tant que vous n'avez pas
enregistré, rien ne bouge**. Une barre apparaît en bas de l'écran dès la première modification.
Elle vous dit **combien** de réglages ont changé, **lesquels**, et que la détection s'interrompra
quelques secondes.

De là, deux gestes seulement : **Annuler**, qui remet la page comme vous l'avez trouvée, et
**Enregistrer**, qui fait tout — il n'y a rien à « appliquer » ensuite.

Si vous quittez la page en ayant oublié d'enregistrer, Vyzio vous le demande avant de vous laisser
partir.

## Pourquoi la vidéo complète est à 0 par défaut

C'est la seule des trois dont le coût grandit avec le temps qui passe plutôt qu'avec ce qui se
produit. **Compter environ 1 à 3 Go par jour et par caméra** : une semaine sur quatre caméras dépasse
les 50 Go.

Les séquences de mouvement couvrent le besoin courant — retrouver ce qui s'est passé — pour une
fraction de cette place. Activez la vidéo complète sur une caméra précise si vous voulez pouvoir
remonter le temps sans dépendre de ce que Vyzio a jugé être un mouvement.

## Quand le changement prend effet

La surveillance reprend les nouvelles durées **quelques secondes après l'enregistrement**, le temps
qu'elle redémarre. Vous n'avez rien à faire pendant ce temps, et vous pouvez continuer à régler
ailleurs.

Une fois la nouvelle durée active, **le ménage n'est pas instantané** : Vyzio repasse environ
toutes les heures pour supprimer ce qui a dépassé son terme. Raccourcir une durée ne libère donc pas
le disque dans la seconde.

## Si vous venez d'une version précédente

Jusqu'ici, une case « Enregistrer en continu » existait sur chaque caméra **sans conserver quoi que
ce soit** : seuls les extraits liés à une alerte survivaient, dix jours. Cette case est remplacée
par les durées ci-dessus.

Deux conséquences à connaître :

- Une caméra où la case était cochée conserve désormais **7 jours de vidéo complète**. C'est ce que
  vous demandiez, mais cela occupe réellement de la place — vérifiez que ça vous convient.
- Toutes vos caméras se mettent à conserver **7 jours de séquences de mouvement**, là où elles ne
  gardaient presque rien. C'est le comportement attendu d'un système de vidéosurveillance ; c'est
  aussi une consommation disque nouvelle.

## Voir aussi

- [Image analysée](ANALYSED_IMAGE.md) — quelle image Vyzio analyse ; le choix ne change jamais la
  qualité de vos enregistrements.
- [Sensibilité de détection](DETECTION_SENSITIVITY.md) — ce qui déclenche une alerte, donc ce qui
  finit en clip d'alerte.
