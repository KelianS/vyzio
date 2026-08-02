# ADR-39 — Réglages globaux surchargeables par caméra, appliqué à la rétention d'enregistrement

> Statut : Accepté

## Contexte

L'enregistrement ne conserve rien. `FrigateConfigApplier` n'émet qu'un `record.enabled: true` global,
sans aucune durée de rétention ; les défauts de Frigate 0.17 s'appliquent donc
(`frigate/config/camera/record.py`) : `continuous.days: 0` et `motion.days: 0`. Seuls survivent les
segments rattachés à une revue, via `alerts.retain.days: 10` et `detections.retain.days: 10` — deux
valeurs que Vyzio n'a jamais choisies. Constaté sur l'instance de dev : 67 Mo conservés, aucun
fichier au-delà de la fenêtre de dix jours.

Le réglage par caméra est **inerte dans les deux sens**. `record.enabled: true` étant posé
globalement et aucune caméra n'émettant de surcharge, une caméra dont l'utilisateur a décoché
« Enregistrer en continu » enregistre quand même, et une caméra où il l'a coché n'ajoute qu'un
`enabled: true` déjà vrai. Le booléen `Camera.ContinuousRecordingEnabled` n'a donc aucun effet
observable, ni sur l'activation, ni sur la rétention.

L'interface annonce pourtant « environ 1 a 3 Go par jour par camera » avant activation. La promesse
est fausse dans les deux sens : elle sur-estime la consommation réelle (proche de zéro) et
sur-estime ce qui est conservé (rien). Un produit de vidéosurveillance qui perd silencieusement ses
enregistrements échoue à sa raison d'être, et l'utilisateur ne le découvre qu'au moment où il en a
besoin.

[ADR-18](0018-enregistrement-continu-activation-par-camera-dans-la.md) avait explicitement renvoyé
la rétention à plus tard (« sera exposee dans l'UI en US-P3.7 ou une future story ») et décrivait un
schéma Frigate — `record.retain.days` + `record.retain.mode` — qui n'existe plus en 0.17. Le présent
ADR le remplace sur ce point.

Enfin, Vyzio n'a aujourd'hui **aucun réglage à l'échelle de l'installation** : `Camera` est le seul
foyer de préférences persistées, et le `DbContext` ne connaît aucune table de réglages. Or la
rétention est d'abord une question de capacité disque, qui est une ressource partagée.

## Options comparées

### Sur la portée d'un réglage

1. **Une valeur globale, surchargeable par caméra.** C'est le modèle de configuration de Frigate
   lui-même : `record:` à la racine pose la valeur, `cameras.<nom>.record:` la surcharge — et
   `cameras.<nom>.record` accepte le `RecordConfig` complet, vérifié dans `config/camera/camera.py`.
   Vyzio décrit donc la même chose que ce qu'il génère, sans traduction.
2. **Une valeur globale unique.** Plus simple à comprendre, mais impose la même durée à une caméra
   d'entrée et à une caméra de garage dont les usages n'ont rien à voir. Écarté : la contrainte
   viendrait de Vyzio, pas du besoin.
3. **Un réglage par caméra uniquement.** Écarté : la capacité disque est une ressource partagée, donc
   sans valeur d'ensemble l'utilisateur ne peut pas raisonner sur son installation. Et une
   installation de six caméras impose six réglages identiques à la main, contre le principe #5.

### Sur le modèle de rétention

4. **Deux fenêtres de rétention indépendantes** — « tout » et « seulement s'il se passe quelque
   chose » — chacune avec sa durée, pouvant coexister. C'est le modèle réel de Frigate
   (`record.continuous.days` et `record.motion.days`), et il autorise la combinaison la plus utile :
   garder tout un jour, et le mouvement une semaine.
5. **Un mode à deux valeurs (`tout` / `mouvement`) et une seule durée.** Deux contrôles au lieu de
   trois, mais écarté : c'est une invention de Vyzio par-dessus deux compteurs indépendants, elle
   interdit la combinaison ci-dessus, et elle recrée exactement le travers corrigé par
   [ADR-38](0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md) — un
   modèle à deux valeurs plaqué sur une réalité qui en compte davantage.

### Sur les clips d'événement

6. **Une durée explicite, choisie par Vyzio et réglable.** Les clips rattachés à une détection sont
   les seuls enregistrements que l'utilisateur voit vraiment, dans l'historique. Les laisser sur un
   défaut de Frigate revient à ce que la durée de conservation de l'historique soit subie.
7. **Garder le défaut Frigate de dix jours.** Écarté : c'est déjà l'état actuel, et il est invisible.
   Un réglage subi qui gouverne la page la plus consultée contredit le principe d'explicabilité (#4).

## Décision

**Options 1, 4 et 6.**

### Le modèle de réglage

**Un réglage a une valeur d'installation, qu'une caméra peut surcharger.** C'est la forme retenue
pour les réglages à venir, pas seulement pour la rétention : une entité typée porte les valeurs
d'ensemble, `Camera` porte des surcharges **nullables**, et `null` signifie « suivre l'installation »
— jamais une valeur déguisée. La résolution `surcharge ?? global` a un point unique dans `Core`, que
partagent la génération de configuration et la frontière API ; aucune couche ne la réimplémente.

Ce modèle est celui de Frigate, ce qui n'est pas un hasard : Vyzio pilote Frigate
([ADR-12](0012-gestion-des-cameras-pilotee-par-vyzio-appliquee-a.md)), et décrire sa configuration
dans une autre forme obligerait à traduire dans les deux sens à chaque réglage ajouté.

### La rétention

Trois durées en jours, chacune globale et surchargeable :

- **Tout** — la vidéo complète, qu'il se passe quelque chose ou non.
- **Mouvement** — seulement les portions où l'image bouge.
- **Clips d'événement** — les extraits rattachés à une détection, ceux de l'historique.

Elles sont projetées sur `record.continuous.days`, `record.motion.days` et — pour la troisième —
sur `alerts.retain.days` **et** `detections.retain.days` à la fois. Frigate distingue alertes et
détections ; cette distinction relève de son propre modèle de revue, elle n'a pas de sens pour un
utilisateur non-technicien (principe #1) et n'est donc pas remontée. Une seule durée gouverne les
deux.

**Zéro est une valeur légitime** et signifie « ne rien conserver de cette nature ». Une caméra dont
les trois durées valent zéro n'enregistre rien du tout : elle reçoit `record.enabled: false`, ce qui
donne enfin un effet observable au fait de ne pas vouloir d'enregistrement.

**`Camera.ContinuousRecordingEnabled` disparaît.** Un booléen d'activation à côté d'une durée serait
deux sources de vérité pour un même fait : l'enregistrement continu est actif si, et seulement si, sa
durée effective est supérieure à zéro. La migration préserve l'intention exprimée — une caméra où la
case était cochée reçoit une surcharge explicite, une caméra où elle ne l'était pas garde `null` et
suit l'installation.

### Les valeurs livrées

Tout : **0 jour**. Mouvement : **7 jours**. Clips d'événement : **14 jours**.

L'enregistrement intégral reste un choix délibéré, conformément à l'esprit d'ADR-18 : c'est le seul
des trois dont le coût disque est proportionnel au temps qui passe plutôt qu'à ce qui se produit.
Les deux autres sont actifs par défaut, parce qu'une installation neuve qui ne conserve rien est le
défaut que cet ADR corrige.

L'ordre de grandeur affiché avant activation est celui d'ADR-18 (1 à 3 Go par jour et par caméra),
mais il ne s'applique qu'à la fenêtre « tout » — c'est la seule qui enregistre en continu.

## Conséquences

- **Le comportement change sur les installations existantes.** Une installation qui ne conservait
  que dix jours de clips se met à conserver sept jours de séquences de mouvement. C'est
  l'aboutissement recherché — l'enregistrement se met enfin à enregistrer — mais c'est une
  consommation disque nouvelle, qu'il faut annoncer dans la documentation utilisateur.
- **La première table de réglages d'installation apparaît.** Elle est un singleton : une ligne, créée
  avec ses valeurs livrées si elle est absente. Les réglages d'installation suivants suivront la même
  forme, une entité typée par domaine plutôt qu'une table clé/valeur générique — une table
  clé/valeur renoncerait au typage et donc à la règle de comparaison type-safe du backend.
- **`FrigateConfigApplier` dépend des réglages d'installation.** Ils lui arrivent par un port injecté
  plutôt que par un paramètre de `WriteConfigAsync`, dont la signature reste inchangée pour tous ses
  appelants.
- **La rétention reste appliquée par Frigate, pas par Vyzio.** Vyzio décide et écrit ; la suppression
  effective est le fait du cycle de nettoyage de Frigate (`expire_interval`, 60 minutes par défaut).
  Un changement de durée n'est donc pas instantané, et raccourcir une durée ne libère pas le disque
  immédiatement.
- **Un changement de rétention exige un redémarrage du moteur**, comme tout changement de
  configuration : il emprunte le signal « configuration à appliquer » existant (ADR-38).
- **La surcharge se décide réglage par réglage, jamais en bloc.** Une caméra qui fixe une seule durée
  garde les autres attachées aux valeurs d'ensemble. Un interrupteur « cette caméra décide de tout »
  aurait figé les deux autres durées à leur valeur du moment sans le dire, et c'est précisément ce
  qu'un modèle par surcharge doit éviter. L'interface montre donc, sur chaque durée, si elle est
  suivie ou propre à la caméra, et le retour arrière **nomme la valeur** qu'il rétablit plutôt que
  d'annoncer une remise à zéro — la valeur d'ensemble voyage jusqu'à la frontière API pour cela.
- **La configuration générée ne répète pas ce qu'une caméra n'a pas surchargé.** Seul le réglage
  réellement propre à la caméra apparaît sous elle ; sinon le fichier laisserait croire que la valeur
  vient de la caméra alors qu'elle vient de l'installation.
- **L'alerte de capacité disque critique reste à faire.** SPECS §6.2 l'exige et cette décision la rend
  plus nécessaire, puisque la rétention devient réellement consommatrice ; elle reste un item de
  backlog distinct.
- ADR-18 est **remplacé sur la rétention et sur l'activation par caméra** : son schéma
  `record.retain.days` / `record.retain.mode` ne correspond plus à Frigate 0.17, et le booléen
  d'activation qu'il introduisait disparaît. Ce qu'il pose et qui reste vrai : l'enregistrement
  intégral est un choix explicite, et son ordre de grandeur disque doit être annoncé avant
  activation.
