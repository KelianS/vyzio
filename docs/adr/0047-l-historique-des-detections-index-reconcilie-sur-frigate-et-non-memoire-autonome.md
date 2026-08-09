# ADR-47 — L'historique des détections : un index réconcilié sur Frigate, pas une mémoire autonome

> Statut : Remplacé par [ADR-49](0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md)
>
> Le constat et l'appartenance des faits restent valides ; la décision ne l'est pas. Une fois établi
> que Vyzio ne détient aucun fait durable sur une détection, la table qu'il s'agissait de réconcilier
> n'avait plus de raison d'exister.

## Contexte

**Une ligne d'historique sur deux pointe vers un média qui n'existe plus.** Mesuré sur l'instance de
développement le 2026-08-04 — 416 lignes en base de Vyzio, 216 événements côté Frigate :

| Constat | Lignes |
| --- | --- |
| Événement disparu de Frigate, ligne conservée par Vyzio | 200 (48 %) |
| Aperçu ou bouton « Vidéo » proposé qui répond 404 | 138 |
| Bouton « Vidéo » proposé pour un clip expiré à 14 jours | 187 |
| Ni aperçu ni vidéo — Frigate n'a rien gardé, et a supprimé l'événement | 62 |

Trois causes distinctes, toutes vérifiées sur l'instance :

**Vyzio croit des drapeaux périmés.** `HasClip` / `HasSnapshot` sont la recopie du dernier message
MQTT reçu, jamais revérifiée. Or ces drapeaux sont une vérité à l'instant : Frigate expire les clips
à la durée choisie et remet `has_clip` à `false`. La coupure observée tombe exactement sur J-14, la
rétention réglée.

**Vyzio conserve ce que Frigate jette.** Un objet dont Frigate ne garde finalement aucun média voit
son événement supprimé de sa propre base ; Vyzio a persisté la ligne au message `end` et la garde
pour toujours. Ces 62 lignes se répartissent uniformément sur toutes les caméras, tous les labels,
tous les jours actifs, avec la même distribution de confiance que les lignes saines — ce n'est pas
une panne, c'est une décision de Frigate objet par objet.

**Les deux durées divergent par construction.** La rétention des aperçus est fixée à 30 jours en dur
dans la génération de configuration, quand les clips suivent le réglage utilisateur ([ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md)).
La fenêtre où un aperçu survit à son clip est fabriquée par Vyzio, pas par Frigate.

**La réponse est déjà écrite dans le code, à un seul endroit.** La notification Telegram porte en
commentaire que les drapeaux du message `end` sont peu fiables, et **demande à Frigate plutôt que de
les croire** : elle attend la finalisation, tente le clip, retombe sur l'aperçu, puis sur le texte.
L'historique fait l'inverse et n'a aucun repli. La même question — « quel média a cet événement ? » —
reçoit ainsi **trois réponses différentes** : la route de l'aperçu ignore le drapeau, celle du clip
le croit, la notification s'en passe. C'est la règle suprême zéro-duplication enfreinte au niveau
d'un **fait métier** : ce fait n'a pas de foyer.

Le pipeline n'est pas non plus au bon étage. `FrigateAdapter` est le use case d'ingestion — résoudre
l'identité, résoudre le profil, persister, notifier — mais vit dans `Api`, et `IFrigateRestClient`
est le seul port Frigate déclaré dans `Api` au lieu de `Core`. `Application` ne dépendant pas de
`Api`, **aucun use case ne peut interroger Frigate sur un événement** : la réconciliation est
littéralement impossible à écrire au bon endroit. Enfin l'ingestion appelle le dispatcher de
notification en ligne, sur le thread du message MQTT, ce qui fait attendre la finalisation du média
dans le handler que le client MQTT attend avant de traiter le message suivant.

## Options comparées

### Sur la source de vérité du média

1. **Croire les drapeaux, et les corriger par un balayage périodique.** Écartée : c'est
   réimplémenter chez Vyzio le calendrier de rétention de Frigate, avec un coût proportionnel à la
   taille de la base plutôt qu'à l'usage — et une base fausse entre deux passages, donc les mêmes
   404, plus rares.
2. **Demander à Frigate au moment où la réponse sert, et consigner ce qu'on apprend.** Retenue. La
   question n'est posée que pour ce qui est réellement regardé, et la réponse ne se périme pas entre
   le moment où elle est produite et celui où elle est utilisée.
3. **Ne rien changer en base et laisser chaque consommateur encaisser le 404.** Écartée : c'est
   l'état actuel. Chaque consommateur redécouvre la règle, et trois l'ont écrite différemment.

### Sur ce que Vyzio conserve

4. **Garder toute ligne détectée, indéfiniment.** Écartée : c'est ce qui produit les 200 lignes
   orphelines. Une ligne dont aucun média n'existera jamais n'apprend rien à l'utilisateur, et
   dilue l'historique de moitié.
5. **Ne pas garder ce que Frigate a jeté.** Retenue.
6. **Copier le média chez Vyzio pour s'affranchir de Frigate.** Écartée : elle duplique le stockage
   vidéo, fait porter à Vyzio une rétention qui est le métier de Frigate, et contredit
   [ADR-01](0001-s-appuyer-sur-frigate-plutot-que-reimplementer-le.md) comme
   [ADR-17](0017-acces-aux-clips-evenementiels-proxy-vyzio-authentifie.md), où Vyzio est un proxy
   authentifié devant les médias de Frigate, jamais leur dépositaire.

### Sur le couplage ingestion / utilisation

7. **L'ingestion notifie elle-même**, comme aujourd'hui. Écartée : elle fait dépendre la cadence
   d'ingestion du délai de finalisation du média et de la disponibilité de Telegram, et interdit
   d'ajouter un consommateur sans rouvrir l'ingestion.
8. **L'ingestion enregistre un fait ; les usages partent de ce fait.** Retenue — c'est déjà le
   modèle du SAD et d'[ADR-05](0005-communication-inter-services-vyzio-mqtt-channels.md), auquel ce
   pipeline avait échappé.

## Décision

**Options 2, 5 et 8. La base cesse d'être la mémoire autonome des détections pour devenir un index
réconcilié sur Frigate.** Frigate est le dépositaire des médias et de leur durée de vie ; Vyzio tient
l'index métier — identité, profil, notification — et **ne prétend jamais savoir seul** ce que Frigate
détient encore.

### Qui détient quoi — un fait, un détenteur

Rien n'est maintenu en double : chaque fait a un propriétaire unique, déterminé par sa nature.

| Nature du fait | Détenteur | Ce que fait Vyzio |
| --- | --- | --- |
| Existence et durée de vie des médias (clip, aperçu) | Frigate | Ne stocke rien, demande au moment où la réponse sert |
| Descripteurs figés à la fin de l'événement (caméra, label, score, horodatage) | Frigate | En garde une copie de lecture, jamais réécrite ni arbitrée |
| Faits métier de Vyzio (profil résolu, notification envoyée, correction d'identité) | Vyzio | Seul détenteur ; Frigate n'en a pas connaissance |

**En cas de désaccord sur un fait détenu par Frigate, Frigate gagne, sans arbitrage ni fusion.**
C'est ce qui distingue un index d'une seconde source de vérité, et c'est ce qui rend `HasClip` /
`HasSnapshot` illégitimes : un cache jamais invalidé sur une valeur qui change.

La copie des descripteurs figés est assumée : sans elle, afficher une page d'historique coûterait un
aller-retour par ligne, et une coupure de Frigate rendrait une page vide. Elle est licite parce que
ces valeurs ne changent plus une fois l'événement terminé — l'invalidation qui manque aux drapeaux
n'a donc pas d'objet ici.

L'identité est le seul fait qui **change de détenteur** : elle arrive du `sub_label` de Frigate, et
passe sous la propriété de Vyzio dès que l'utilisateur la corrige. La correction ne peut plus être
écrasée par une relecture.

Vyzio reste par ailleurs la seule façade : Frigate n'est jamais exposé
([ADR-16](0016-acces-au-flux-live-polling-latest-jpg-via-vyzio.md),
[ADR-17](0017-acces-aux-clips-evenementiels-proxy-vyzio-authentifie.md)), et le port Frigate dans
`Core` est ce qui donne au domaine un vocabulaire à lui, absorbant les évolutions de Frigate au lieu
de les propager.

### Un seul foyer pour « quel média a cet événement »

Un use case unique répond à cette question, et **demande plutôt que de croire**. Le repli déjà écrit
dans la notification devient la règle commune ; les trois politiques concurrentes disparaissent. Ce
qu'il découvre, il l'écrit : la vérité constatée n'est plus jetée après usage.

Corollaire structurel : `IFrigateRestClient` rejoint `Core`, et l'ingestion devient un use case
d'`Application`. Sans ce déplacement, la décision n'est pas exprimable dans la couche qui la porte.

### Deux moments pour réconcilier, aucun balayage

- **À la stabilisation.** L'attente de finalisation établit déjà la vérité sur le média pour
  notifier ; elle la consigne désormais. Elle ne couvre que les événements notifiés — un premier
  filet, pas le seul.
- **À la lecture, par lot.** Une page d'historique décrit une fenêtre temporelle, ce que Frigate sait
  interroger d'une seule requête : une requête par page, jamais une par ligne. C'est aussi le seul
  mécanisme **rétroactif** — il répare les lignes déjà fausses sans migration ni reprise de données.

### Ce que Frigate a jeté n'est pas gardé

Une ligne dont Frigate n'a finalement retenu aucun média est supprimée — **à la stabilisation,
jamais au message `end`**. La déduplication des notifications s'ancre sur l'identifiant d'événement
sans clé étrangère ; supprimer une ligne qu'une notification vient de référencer lui ferait perdre
son ancre.

### Deux images nommées, pas une URL fabriquée deux fois

L'aperçu de liste et l'image pleine sont deux besoins distincts. Frigate écrit déjà l'image recadrée
sur l'objet détecté, ~8 Ko, là où la liste télécharge aujourd'hui 123 Ko de plan large pour une
tuile de 56 px. La notification veut l'inverse : le plan large, parce que le contexte est ce qui la
rend utile. Mesuré sur Frigate 0.17 : les paramètres de recadrage et de taille sont **inertes** sur
un événement terminé — seule la route dédiée répond, ce qui rend le choix explicite plutôt que
paramétrable.

## Conséquences

- **L'historique rétrécit d'un coup, à la première lecture après déploiement.** C'est l'objectif :
  ce qui disparaît n'était affichable nulle part. À dire dans la documentation utilisateur, sans
  quoi cela se lira comme une perte de données.
- **La disponibilité de l'historique dépend désormais de Frigate joignable.** Une réconciliation qui
  échoue ne doit pas vider la page ni supprimer quoi que ce soit : sans réponse, l'index reste tel
  qu'il est. Supprimer sur silence transformerait une panne passagère en perte définitive.
- **Un média expiré est une conséquence d'un réglage, pas une panne**, et se dit à l'écran
  (principe #4). Cette information **ne remonte jamais dans le chemin de notification** : une
  notification part quelques secondes après la détection, très loin de toute expiration, et rien de
  cette logique ne doit l'atteindre par effet de bord.
- **La rétention des aperçus s'aligne sur celle des clips.** Le 30 en dur disparaît : deux durées
  divergentes pour un même événement fabriquent une incohérence que la réconciliation devrait
  ensuite absorber.
- **La durée qui porte l'historique ne peut plus valoir zéro** — voir
  [ADR-48](0048-retention-minimale-d-un-jour-la-conservation-se-regle-elle-ne-s-eteint-pas.md),
  qui rétracte ce point d'ADR-39.
- **Le modèle *review* de Frigate reste inexploité.** Frigate regroupe déjà les objets d'un même
  passage en items de sévérité `alert` / `detection` — mesuré : 15 détections `person` pour 7 items.
  L'historique de Vyzio reste une liste d'objets. C'est un chantier produit distinct, pas une
  conséquence de celui-ci.
