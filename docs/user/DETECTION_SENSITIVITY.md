# Sensibilité de détection

> Où : fiche d'une caméra → section **Détection**.

## À quoi ça sert

Certaines scènes bougent tout le temps sans que rien d'intéressant ne s'y passe : du feuillage agité
par le vent, des ombres qui tournent, une route au fond du jardin. Analyser chacun de ces mouvements
occupe le boîtier pour rien, et finit par le ralentir au point de lui faire manquer ce qui compte.

La sensibilité règle le seuil à partir duquel un mouvement mérite d'être analysé.

| Niveau | Ce que ça change |
| --- | --- |
| **Élevée** | La caméra réagit au moindre mouvement. |
| **Moyenne** | Les petits mouvements sont ignorés pour éviter les alertes inutiles. |
| **Réduite** | Seuls les mouvements francs sont analysés — pour une scène très animée. |

## Le réglage automatique

Par défaut, la case **« Régler la sensibilité automatiquement »** est cochée : Vyzio observe
l'agitation réelle de chaque caméra et ajuste son niveau tout seul. Le niveau courant reste affiché,
avec l'explication de ce qu'il implique.

Deux choses à savoir :

- **L'ajustement est lent, volontairement.** Vyzio observe une caméra pendant au moins une douzaine
  d'heures avant de changer quoi que ce soit, pour ne pas confondre une nuit calme avec une scène
  paisible. C'est normal de ne voir aucun changement le premier jour.
- **Le réglage ne descend jamais en dessous de « Réduite ».** L'objectif est de garder le système
  fluide, jamais d'aveugler une caméra.

## Reprendre la main

Décochez la case pour figer le niveau : un menu apparaît, votre choix s'applique immédiatement et
Vyzio cesse d'ajuster cette caméra. Les autres caméras continuent d'être réglées automatiquement,
chacune de son côté.

Recochez la case à tout moment pour redonner la main à Vyzio ; le niveau en place est conservé
jusqu'à ce que l'observation justifie de le changer.

## Si une caméra rate des choses

Passez-la en sensibilité **Élevée** et figez-la. Si le problème persiste, c'est que le sujet est trop
petit ou trop peu contrasté dans l'image : c'est un sujet de cadrage ou de résolution, pas de
sensibilité.
