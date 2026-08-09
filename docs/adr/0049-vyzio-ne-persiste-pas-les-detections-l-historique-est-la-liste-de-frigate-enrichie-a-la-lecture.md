# ADR-49 — Vyzio ne persiste pas les détections : l'historique est la liste de Frigate, enrichie à la lecture

> Statut : Accepté
>
> Remplace [ADR-47](0047-l-historique-des-detections-index-reconcilie-sur-frigate-et-non-memoire-autonome.md),
> qui cherchait à tenir une copie correcte au lieu de demander pourquoi il y avait une copie.

## Contexte

**Une ligne d'historique sur deux pointe vers un média qui n'existe plus.** Mesuré sur l'instance de
développement le 2026-08-04 — 416 lignes chez Vyzio, 216 événements chez Frigate : 200 lignes
survivent à l'événement qui les a produites, 138 proposent un aperçu ou une vidéo qui répond 404, et
62 n'ont jamais rien eu à montrer parce que Frigate a décidé objet par objet de ne rien garder.

La cause est unique : Vyzio recopie au message MQTT `end` des faits qui appartiennent à Frigate —
dont `has_clip` et `has_snapshot`, vrais à l'instant et faux dès l'expiration — et ne les revisite
jamais. Le même fait reçoit d'ailleurs trois réponses différentes selon le consommateur : la route de
l'aperçu ignore le drapeau, celle du clip le croit, la notification s'en passe et demande à Frigate.
C'est la règle suprême zéro-duplication enfreinte sur un **fait métier**.

[ADR-47](0047-l-historique-des-detections-index-reconcilie-sur-frigate-et-non-memoire-autonome.md)
en a tiré une réconciliation : garder la table, ne plus stocker les drapeaux, redemander et réparer.
Mais une fois posé le tableau d'appartenance des faits, il ne restait dans la table **aucun fait
détenu par Vyzio** — et une table qui ne détient rien est une copie qu'il faut entretenir sans
contrepartie.

Le seul fait qui semblait propre à Vyzio, la correction d'identité, ne l'est pas non plus : une
correction qui ne repart pas dans Frigate n'apprend rien au moteur et laisse Vyzio seul détenteur
d'une vérité qu'il ne peut pas défendre.

**Vérifié sur l'instance (Frigate 0.17.1) avant de décider :**

| Question | Réponse mesurée |
| --- | --- |
| `/api/events` porte-t-il tout ce que la table recopie ? | Oui — `camera`, `label`, `sub_label`, `top_score`, `start_time`/`end_time`, `has_clip`, `has_snapshot`, `zones` |
| Filtrer par caméra, label, identité, période ? | `cameras`, `labels`, `sub_labels`, `before`/`after` répondent |
| Paginer ? | `page=` est **inerte** (pages 1 et 2 identiques) ; la pagination se fait au curseur temporel `before=` |
| Écrire une correction d'identité ? | `POST /api/events/{id}/sub_label` accepté, persisté, et filtrable ensuite — propagation **asynchrone, ~5 s** |

## Options comparées

1. **Garder la table et la réconcilier** (décision d'ADR-47). Écartée : elle entretient une copie de
   faits que Vyzio ne détient pas, au prix d'un mécanisme de réparation, d'une règle de suppression,
   et d'un cas « Frigate injoignable » à arbitrer à chaque lecture. Tout cela pour ne rien posséder
   de plus à la fin.
2. **Ne pas persister les détections ; lire Frigate et enrichir à la lecture.** Retenue.
3. **Garder la table pour un historique plus profond que la rétention de Frigate.** Écartée : c'est
   ce que fait Vyzio aujourd'hui, et la profondeur supplémentaire est vide — 48 % de lignes sans
   média. Un historique qui remonte plus loin que ce qu'il peut montrer promet ce qu'il n'a pas.
4. **Copier les médias chez Vyzio pour rendre cette profondeur réelle.** Écartée : Vyzio deviendrait
   dépositaire du stockage vidéo, contre
   [ADR-01](0001-s-appuyer-sur-frigate-plutot-que-reimplementer-le.md) et
   [ADR-17](0017-acces-aux-clips-evenementiels-proxy-vyzio-authentifie.md) où il est un proxy
   authentifié devant les médias de Frigate.

## Décision

**Option 2. Vyzio ne persiste aucune détection.** L'historique est la liste des événements de
Frigate, filtrée et enrichie au moment où elle est lue. Le couplage à Frigate est assumé
(principe #2 : Frigate reste invisible pour l'utilisateur, pas pour l'architecture).

### Ce que Vyzio détient encore

**Une seule table : le journal des notifications.** C'est le seul fait que Vyzio produit et que
Frigate n'a pas — l'envoi, son canal, son issue, et l'ancre de déduplication. Elle **s'ancre
désormais sur l'identifiant d'événement Frigate**, seul identifiant qui survivra à la disparition de
la table des détections.

Tout le reste s'enrichit à la lecture, et gagne à ne pas être figé :

- **Le profil** se résout de `sub_label` vers les profils Vyzio à chaque lecture. Figé à l'ingestion,
  il se périmait au premier renommage ou suppression de profil.
- **Le nom lisible de la caméra** est une jointure, pas une copie.
- **L'existence des médias** est ce que Frigate répond, jamais ce que Vyzio a cru.

### La correction d'identité s'écrit dans Frigate

`POST /api/events/{id}/sub_label`, mesuré fonctionnel. Vyzio n'en garde rien. La propagation prend
quelques secondes : l'interface doit donc **afficher la correction sans attendre la relecture**,
sans quoi le geste paraîtra sans effet.

C'est aussi ce qui remet la correction sur le chemin de l'apprentissage, que
[SPECS §3.1](../SPECS.md) demande et que la réécriture d'une ligne locale ne pouvait pas atteindre.

### L'ingestion MQTT ne sert plus qu'à notifier

Plus rien à persister : le consommateur `frigate/events` n'a d'autre raison d'être que de déclencher
une notification. Il enregistre donc, rend la main immédiatement, et **n'attend jamais dans le
handler** — ce que le client MQTT attend avant de traiter le message suivant.

La finalisation du média cesse d'être une phase du pipeline. Elle n'existait que pour qu'une
notification parte avec une image : ce n'est pas un temps à respecter, c'est une **lecture qui
réessaie**, portée par la récupération du média elle-même. L'attente forfaitaire disparaît.

### Republier un événement enrichi reste une fonctionnalité, pas de la plomberie

Rediffuser `frigate/events` sous un autre nom n'apporte rien. Un topic `vyzio/…` ne se justifie que
s'il porte ce que Frigate n'a pas — le profil résolu et son mode d'alerte — au bénéfice d'une
intégration externe type Home Assistant, comme le prévoit
[ADR-05](0005-communication-inter-services-vyzio-mqtt-channels.md). C'est un besoin produit distinct,
il ne conditionne pas ce chantier et n'est pas le mécanisme interne du pipeline.

## Conséquences

- **La profondeur de l'historique devient exactement la rétention des clips d'événement.** C'est une
  promesse tenue qui remplace une promesse fausse. Cette durée cesse d'être un réglage interne au
  vocabulaire technique (« clips d'alerte ») pour devenir la **conservation de l'historique de
  détection** — ce qui est conservé, ce sont les détections, notifiées ou non. La nommer par son
  effet observable est ce qui la rend compréhensible (principe #1), et elle devient la seule durée
  qui gouverne ce que l'utilisateur voit.
- **Elle ne peut donc jamais valoir zéro** —
  [ADR-48](0048-retention-minimale-d-un-jour-la-conservation-se-regle-elle-ne-s-eteint-pas.md)
  en devient la garantie, et non plus une commodité d'implémentation.
- **Frigate injoignable ⇒ pas d'historique**, et l'écran le dit. Même boîtier, même cycle de vie :
  Frigate arrêté, il n'y a plus de surveillance du tout — masquer la panne derrière un cache
  afficherait une surveillance qui n'a pas lieu.
- **`observed_events` disparaît**, avec la réconciliation, la règle de suppression et le cas « Frigate
  a jeté ce que Vyzio garde ». Aucune reprise de données : les lignes existantes n'étaient affichables
  qu'à moitié, et rien n'en dépend.
- **Le frontend ne gagne aucun accès direct à Frigate.** Ce qui change est d'où le backend tient sa
  donnée, jamais à qui l'écran s'adresse : la surface d'API est inchangée, les médias restent servis
  en proxy ([ADR-17](0017-acces-aux-clips-evenementiels-proxy-vyzio-authentifie.md)), et
  `hasClip` / `hasSnapshot` gardent leur forme en changeant seulement de véracité — ils cessent
  d'être une copie pour devenir ce que Frigate vient de répondre. C'est ce qui rend la bascule
  invisible côté écran, et ce qui garde Frigate remplaçable.
- **La pagination de l'historique passe au curseur temporel.** `page=` ne fonctionne pas côté
  Frigate ; une liste chronologique se pagine par date, ce que le frontend doit suivre.
- **La rétention des aperçus s'aligne sur celle des clips.** Le 30 jours en dur de la génération de
  configuration fabriquait une seconde durée invisible pour un même événement.
- **Deux images nommées, jamais une URL fabriquée deux fois.** Frigate écrit déjà l'image recadrée
  sur l'objet (~8 Ko) là où la liste télécharge 123 Ko de plan large pour une tuile de 56 px ; la
  notification veut l'inverse, le plan large, parce que le contexte est ce qui la rend utile. Mesuré :
  les paramètres de recadrage et de taille sont **inertes** sur un événement terminé, seule la route
  dédiée répond.
- **Un média expiré est une conséquence d'un réglage, pas une panne**, et se dit à l'écran
  (principe #4). Cette information **ne remonte jamais dans le chemin de notification** : une
  notification part quelques secondes après la détection, très loin de toute expiration.
- **Le port Frigate remonte dans `Core`.** Il n'est plus un client HTTP posé à côté des endpoints
  mais la frontière du domaine avec Frigate — le seul endroit où une évolution de son API se traduit,
  au lieu de se propager.
- **Le modèle *review* de Frigate reste inexploité** (regroupement des objets d'un même passage,
  sévérité `alert`/`detection`) : chantier produit distinct, il change ce que l'historique montre, pas
  d'où il tient sa vérité.
