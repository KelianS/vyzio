# ADR-35 — Sensibilité de détection auto-adaptative par caméra

> Statut : Accepté

## Contexte

Le coût CPU du détecteur Frigate suit une relation simple, mesurée sur l'instance de dev
([investigation](../investigations/frigate-cpu-profiling.md)) :

```
CPU du détecteur ≈ (inférences / s) × ~26 ms de temps CPU
```

Le second terme est une constante matérielle : le benchmark du modèle montre que `num_threads` ne la
déplace que de 10 % (en échange d'une latence ×2,6). **Seul le nombre d'inférences est actionnable.**

Or Frigate ne lance pas une inférence par image, mais une par **région de mouvement**, plus une par
objet suivi. Le ratio inférences/image dépend donc entièrement du contenu de la scène. Mesuré :

| Caméra | Contexte | Inférences / image |
| --- | --- | --- |
| `v380_salon` | intérieur, scène stable | 1,2 |
| `lwip_jardin` | extérieur, feuillage et lumière changeante | **6,0** |

Une seule caméra extérieure non réglée concentre 83 % de la charge d'inférence, et le pipeline montre
déjà des images abandonnées (`skipped_fps > 0`) — la détection perd de l'information.

Frigate expose le réglage qui gouverne ce comportement : `motion.contour_area`, dont la documentation
donne trois niveaux de référence (10 = haute sensibilité, 30 = moyenne, 50 = basse). Le réglage par
défaut est 10, c'est-à-dire le plus sensible, pour toutes les caméras.

Deux contraintes cadrent la solution :

- **Le masque de mouvement est hors d'atteinte de la cible produit.** C'est le levier recommandé par
  la communauté, mais il suppose de dessiner des zones sur une image et de comprendre ce qu'est le
  « mouvement » au sens d'un NVR — incompatible avec le principe produit #1 (public non-technicien)
  et #2 (Frigate invisible).
- **Aucune valeur n'est bonne universellement.** 10 convient à un couloir et ruine une haie ; 50
  convient à une haie et fait rater un chat dans un couloir. Une constante en dur, quelle qu'elle
  soit, est un mauvais choix pour une partie du parc.

## Options comparées

1. **Boucle fermée à trois paliers, pilotée par un agrégat du ratio inférences/image sur fenêtre
   longue.** Vyzio échantillonne périodiquement `detection_fps` et `camera_fps` par caméra (déjà
   exposés par `/api/stats`, déjà consommés par `IFrigateStatsProvider` pour ADR-33), en dérive le
   ratio, et déplace la caméra d'un palier quand un **percentile haut du ratio sur 24 h** sort d'une
   plage cible. Trois paliers seulement (`contour_area` 10 / 30 / 50). Le palier courant est
   persisté par caméra.
2. **Une question produit à l'onboarding** — « Cette caméra filme-t-elle l'extérieur ? » — mappée sur
   deux paliers. Écarté comme solution principale : le bon palier ne dépend pas de la question
   intérieur/extérieur mais de la scène réelle (un intérieur avec un ventilateur ou un écran de
   télévision est agité, un extérieur sur un mur nu ne l'est pas), et le réglage juste change avec les
   saisons. Reste utilisable comme **valeur initiale** avant que la boucle ait convergé, si le besoin
   s'en fait sentir — pas retenu en v1, la boucle démarre au défaut Frigate.
3. **Masques de mouvement dessinés par l'utilisateur.** Écarté : cf. contrainte produit ci-dessus.
   Reste la meilleure solution pour un utilisateur avancé — accessible via l'UI Frigate en mode
   expert (ADR-11), non exposée dans le Hub.
4. **Décider sur les échantillons instantanés du ratio**, avec confirmation sur N mesures
   consécutives et hystérésis. Écarté après mesure terrain : le ratio ne caractérise pas le bruit de
   la scène mais **l'activité à l'instant t**. Frigate saute l'inférence sur les images sans
   mouvement, si bien qu'une même caméra a été relevée à 0,4 inférence/image au repos et 6,0 en
   activité. Une confirmation sur quelques minutes ne protège que des oscillations rapides : la
   caméra se serait désensibilisée chaque jour et resensibilisée chaque nuit, indéfiniment. D'où
   l'agrégation sur 24 h de l'option retenue.
5. **Moyenne sur la fenêtre** plutôt qu'un percentile haut. Écartée : les heures creuses tirent la
   moyenne vers le bas jusqu'à ce qu'une caméra réellement bruyante cesse de se distinguer d'une
   caméra calme. Un percentile haut répond à la question utile — « quand cette scène s'agite,
   à quel point ».
6. **Réglage continu de `contour_area`** (n'importe quelle valeur entière, asservie au ratio). Écarté
   pour la même raison qu'ADR-34 Option 8 avait écarté l'asservissement continu du FPS : un espace de
   valeurs continu invite l'oscillation et rend le comportement inexplicable. Trois paliers nommés
   sont explicables à l'utilisateur (principe produit #4) et bornent le pire cas.
7. **Piloter aussi `motion.threshold` et `improve_contrast`.** Écarté en v1 : trois réglages
   interdépendants dans une même boucle rendent la convergence difficile à raisonner et à tester.
   `contour_area` est celui dont la documentation donne des paliers de référence. Les deux autres
   restent des évolutions possibles une fois la boucle éprouvée.
8. **Baisser `detect.width/height` pour réduire les régions.** Écarté : sans effet sur le nombre
   d'inférences. `motion.frame_height` vaut 100 par défaut, donc l'analyse de mouvement tourne déjà sur
   une image réduite et le nombre de contours est quasi indépendant de la résolution de détection.
   Baisser `detect` reste utile pour d'autres postes (redimensionnement, `/dev/shm`), hors périmètre
   de cet ADR.
9. **Ajouter une seconde instance de détecteur** (recommandation communautaire quand `skipped_fps > 0`).
   Écarté : cela ne vaut qu'avec du matériel inexploité. Le détecteur est déjà CPU-bound sur 3 threads ;
   une seconde instance aggraverait la consommation au lieu de la réduire.

## Décision

Option 1 : boucle fermée à trois paliers.

**Application à chaud, sans redémarrage.** Frigate accepte `motion_contour_area` en commande MQTT
runtime (`frigate/<camera>/motion_contour_area/set`, vérifié dans `comms/dispatcher.py` sur la version
pinnée) et republie l'état sur le topic `/state` correspondant. Un changement de palier n'entraîne
donc **ni réécriture de `frigate.yml`, ni `ApplyAsync`, ni redémarrage** — ce qui serait rédhibitoire
pour un réglage qui bouge plusieurs fois par jour. Vyzio dispose déjà du bus MQTT (ADR-04, ADR-05).

Le palier reste néanmoins **persisté par caméra** et émis par `FrigateConfigApplier` dans la section
`motion`, pour deux raisons : le réglage runtime est perdu au redémarrage de Frigate, et la config
générée doit rester le reflet fidèle de l'état voulu.

## Conséquences

- Le palier est un **enum** `MotionSensitivity` (Core/Entities) — `High`/`Medium`/`Low` — jamais un
  entier comparé en dur. La correspondance vers `contour_area` (10/30/50) est une table unique, dans
  l'infrastructure, au même titre que les autres traductions vers le vocabulaire Frigate (règle des
  comparaisons type-safe, `src/vyzio/CLAUDE.md`). Le sens est inversé entre les deux échelles —
  sensibilité haute = `contour_area` bas — ce que l'enum a précisément pour rôle de masquer.
- La boucle ne se déplace **que d'un palier à la fois**, et jamais au-delà des bornes. Elle n'agit
  qu'une fois la fenêtre d'agrégation couverte sur une durée minimale, et la plage de retour est
  distincte de la plage de sortie (hystérésis). Ces paramètres — période d'échantillonnage, fenêtre,
  couverture minimale, percentile, plage cible, intervalle minimal entre deux changements — vivent
  dans `MotionTuningOptions`, pas en dur, pour être ajustables sans redéploiement et testables.
- **Un pas vide la fenêtre.** Tous les échantillons accumulés l'ont été sous l'ancien palier ; les
  conserver ferait traverser le palier suivant dans la foulée. Le prix est qu'un second pas demande
  de re-couvrir la fenêtre — convergence lente, mais monotone.
- Conséquence assumée de l'agrégation longue : **la boucle est inerte pendant sa période de chauffe**
  (couverture minimale, 12 h par défaut), y compris après chaque redémarrage de l'API puisque la
  fenêtre vit en mémoire. Persister les échantillons a été jugé disproportionné face à une écriture
  toutes les cinq minutes par caméra.
- Le résultat de chaque évaluation est un `MotionTuningDecision` explicite (`Warmup`, `Settled`,
  `AtBound`, `RateLimited`, `Stepped`) plutôt qu'un simple palier nullable : la même raison doit
  pouvoir alimenter les logs d'exploitation et, plus tard, la formulation produit affichée à
  l'utilisateur — sans qu'aucune des deux ne la ré-invente.
- **Garde-fou explicite : la boucle ne poursuit qu'un objectif de charge, jamais un objectif de
  qualité de détection.** Désensibiliser réduit le CPU mais peut faire manquer un objet lointain ou
  peu contrasté. Le palier `Low` est donc une borne dure, et la caméra n'est jamais désensibilisée
  au-delà. Ce compromis est réel et assumé ; il ne peut pas être annulé par un réglage plus fin, seule
  une accélération matérielle (ADR-34) ou un masque (mode expert) le lève.
- Le palier courant et sa justification sont **exposés à l'utilisateur** dans les termes du produit
  (« sensibilité réduite parce que cette scène est très animée »), pas en vocabulaire Frigate — le
  principe d'explicabilité (#4) interdit un état opaque. L'utilisateur doit pouvoir **figer** le palier
  d'une caméra ; la boucle cesse alors d'agir sur elle.
- La boucle s'appuie sur des grandeurs que Frigate expose déjà et que Vyzio consomme déjà (ADR-33) :
  aucun nouveau canal d'observation, aucun échantillonnage de charge CPU système. Une caméra dont les
  statistiques sont indisponibles (Frigate arrêté ou en redémarrage) est simplement ignorée pour ce
  tour, jamais ajustée sur une mesure absente.
- Le ratio est un indicateur de **mouvement parasite**, pas d'activité réelle : une caméra
  légitimement très fréquentée verra aussi son ratio monter et sera désensibilisée. C'est une limite
  connue de l'indicateur. La borne `Low` et la possibilité de figer le palier constituent la
  mitigation ; un indicateur plus fin (part des inférences ne produisant aucun objet suivi) est une
  évolution possible, non retenue en v1 faute de l'exposer simplement.
