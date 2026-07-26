# Image analysée

> Où : fiche d'une caméra → section **Détection**, bloc **Image analysée**.

## À quoi ça sert

Beaucoup de caméras diffusent la même scène en deux versions : une image détaillée, lourde, et une
image allégée, bien plus légère à traiter. Vyzio les détecte tout seul quand vous vérifiez la caméra.

Le bloc **Image analysée** vous laisse choisir laquelle Vyzio analyse. C'est un arbitrage réel, et
c'est pour ça qu'il vous revient plutôt que d'être décidé dans votre dos.

| Choix | Ce que vous y gagnez | Ce que vous y perdez |
| --- | --- | --- |
| **Image allégée** (par défaut) | Le boîtier Vyzio est beaucoup moins occupé, et supporte davantage de caméras | Les visages éloignés risquent de ne plus être reconnus, et les images d'alerte sont moins nettes |
| **Image détaillée** | Les visages sont mieux reconnus, les images d'alerte sont nettes | Cette caméra occupe davantage le boîtier |

L'image allégée est le réglage par défaut parce que Vyzio réduit de toute façon l'image avant de
l'analyser : lui donner une image très détaillée coûte des ressources sans rien apporter à la détection.

## Ce que le choix ne change jamais

**Vos enregistrements.** Ils sont toujours faits sur l'image détaillée, quel que soit ce réglage. Une
scène analysée en image allégée reste enregistrée en pleine qualité — vous ne perdez jamais de preuve.

## Comment choisir

- **Une caméra de surveillance large** (jardin, garage, allée), où vous voulez seulement savoir que
  quelqu'un est passé : gardez l'image allégée. C'est le réglage par défaut, vous n'avez rien à faire.
- **Une caméra où vous voulez reconnaître les gens** (entrée, couloir, salon) : passez-la en image
  détaillée, surtout si les visages y apparaissent à plusieurs mètres.
- **Vyzio est lent, les caméras saccadent** : vérifiez qu'aucune caméra n'est restée en image
  détaillée. Voyez aussi la [sensibilité de détection](DETECTION_SENSITIVITY.md), qui pèse encore
  plus lourd.

**Le changement prend effet au redémarrage du moteur de détection**, pas immédiatement : appliquez la
configuration depuis la page Caméras après avoir choisi.

## Si le bloc n'apparaît pas

C'est que Vyzio n'a trouvé qu'une seule image sur cette caméra — il n'y a alors rien à arbitrer. Deux
causes possibles :

- **La caméra n'en propose réellement qu'une.** C'est fréquent sur les modèles d'entrée de gamme.
- **La caméra n'a pas encore été vérifiée depuis l'ajout de cette fonction.** Relancez la
  vérification depuis sa fiche : Vyzio en profite pour lui demander ce qu'elle sait diffuser.

## Si une résolution n'est pas affichée

Certaines caméras acceptent de lister leurs images sans en donner les dimensions exactes. Vyzio
préfère alors ne rien afficher plutôt qu'un chiffre approximatif : le choix reste possible, seule
l'indication de taille manque.
