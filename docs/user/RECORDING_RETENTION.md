# Durées de conservation

> Où : page **Historique** → section **Ce que Vyzio conserve** pour toute l'installation.
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

## Le réglage vaut pour toute l'installation, sauf si une caméra en décide autrement

Sur la page Historique, vous réglez les trois durées **pour toutes vos caméras**. C'est le cas
normal : l'espace disque est partagé, autant raisonner sur l'ensemble.

Sur la fiche d'une caméra, une case **« Comme le reste de l'installation »** est cochée par défaut,
et le bloc vous rappelle simplement ce qui s'applique. Décochez-la pour donner à cette caméra ses
propres durées — elle part des valeurs qui s'appliquaient déjà, donc rien ne change tant que vous ne
touchez à rien. Recochez-la et la caméra revient sur les réglages de l'installation.

## Pourquoi la vidéo complète est à 0 par défaut

C'est la seule des trois dont le coût grandit avec le temps qui passe plutôt qu'avec ce qui se
produit. **Compter environ 1 à 3 Go par jour et par caméra** : une semaine sur quatre caméras dépasse
les 50 Go.

Les séquences de mouvement couvrent le besoin courant — retrouver ce qui s'est passé — pour une
fraction de cette place. Activez la vidéo complète sur une caméra précise si vous voulez pouvoir
remonter le temps sans dépendre de ce que Vyzio a jugé être un mouvement.

## Quand le changement prend effet

**Au redémarrage du moteur de détection**, pas immédiatement. Après avoir changé une durée, la page
Caméras vous propose d'appliquer la configuration.

Et une fois la nouvelle durée active, **le ménage n'est pas instantané** : Vyzio repasse environ
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
