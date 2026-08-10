# ADR-50 — Le canal de messagerie devient bidirectionnel : une couche de commandes agnostique du canal

> Statut : Accepté

## Contexte

Hors du domicile, Vyzio ne répond aujourd'hui qu'à moitié : les notifications sortent, tout le reste
du produit s'arrête à la porte du logement. L'[étude sur l'accès à distance](../investigations/acces-a-distance.md)
en tire un constat exploitable immédiatement : **le canal de messagerie est le seul chemin déjà
distant, et il ne pose aucun problème réseau** — pas de CGNAT, pas de certificat, pas d'exposition.
Le rendre bidirectionnel couvre le geste le plus fréquent (« qu'est-ce qui se passe chez moi, et
coupe-moi ça ») sans rien exiger de l'installation.

C'est ce qui permet à l'accès réseau ([ADR-51](0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md))
de rester **optionnel** au lieu d'être le prérequis de tout usage distant.

Deuxième constat, celui-là dans le code : [SPECS §5.2](../SPECS.md) promet que « plusieurs canaux
pourront coexister », mais **rien n'est générique, même dans le sens sortant**. Le port du domaine
s'appelle `ITelegramNotificationSender`, le use case `SendTelegramDetectionNotificationUseCase`, et
`NotificationChannelConfig` — entité au nom générique — porte `BotToken` et `ChatId`, qui sont des
colonnes Telegram, avec un `Channel` en chaîne libre (`"telegram"`) que la règle des comparaisons
type-safe interdit par ailleurs. Ajouter WhatsApp ou Discord *par-dessus* cette forme, dans les deux
sens, multiplierait la surface par le nombre de canaux.

## Options comparées

1. **Implémenter les commandes dans l'adaptateur Telegram, puis les recopier par canal.** Écartée :
   N commandes × M canaux, et chaque commande nouvelle se paie autant de fois qu'il y a de canaux.
   C'est la règle suprême zéro-duplication enfreinte sur du comportement produit.
2. **Un registre de commandes agnostique du canal, et des adaptateurs de canal minces.** Retenue.
3. **Déléguer à un automate externe** (n8n, Home Assistant) qui appellerait l'API Vyzio. Écartée :
   elle reporte la friction sur l'utilisateur — héberger et configurer un second système, contre le
   principe #5 — et laisse un jeton d'API de longue durée dans un tiers.
4. **Ne rien faire côté commandes et tout miser sur l'accès réseau.** Écartée : elle rend une
   installation de VPN obligatoire pour le geste le plus courant du produit.

## Décision

**Option 2.** Une commande se déclare **une fois**, indépendamment du canal qui la porte.

### Ce qu'une commande déclare

Son nom, ses paramètres typés, son autorisation, et un **résultat structuré** : un texte, un média
optionnel, et les suites proposées. Le canal ne décide de rien — il **rend** ce résultat selon ce
qu'il sait faire.

Chaque canal déclare donc ses **capacités** (boutons, image, vidéo, longueur utile). Un canal qui ne
sait pas afficher de boutons rend les suites en texte ; il n'y a pas de commande « pour Telegram ».
C'est la même logique que le catalogue de capacités caméra ([ADR-22](0022-catalogue-de-capacites-camera-decouplage-marque.md))
appliquée aux canaux : le produit s'adapte à ce que le canal sait faire, il ne le suppose pas.

### Une commande n'est pas un second produit

Elle s'exécute par les **mêmes use cases** que l'API HTTP. Le canal de messagerie est un adaptateur
d'entrée de plus, jamais un chemin métier parallèle — sans quoi les deux surfaces divergeraient en
comportement, et une règle corrigée d'un côté resterait fausse de l'autre.

### Le canal entrant est une frontière d'authentification

Seule une conversation **appairée explicitement depuis l'interface** est acceptée. Tout message
d'une autre origine est ignoré **sans réponse** : répondre confirmerait l'existence du système à qui
l'a trouvé par hasard. L'appairage est révocable depuis l'interface, et le révoquer coupe l'accès
immédiatement.

### Périmètre : consulter et agir, jamais configurer

Sont exposés l'état du système, l'aperçu d'une caméra, les dernières détections, le mode vie privée,
les positions PTZ, la pause et la reprise de la surveillance — l'usage courant.

**La configuration reste dans l'interface.** Un fil de discussion ne peut pas porter la grammaire des
réglages ([ADR-43](0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)) : ni
la provenance d'une valeur, ni le brouillon, ni le retour arrière, ni le fait de voir ce qu'on a
modifié avant de valider ([ADR-41](0041-cycle-d-edition-des-reglages-brouillon-explicite-enregistrer-vaut-appliquer.md)).
Prétendre régler depuis un chat produirait des changements invisibles et irréversibles.

Deux corollaires : **pas de flux vidéo continu** par un canal de messagerie — image fixe et clip,
ce que les canaux savent faire ; et **toute action conséquente demande une confirmation dans le
fil** (couper la surveillance, lever le mode vie privée), parce qu'un message part d'un geste plus
léger qu'un clic dans une interface.

Comme partout, la restitution ne nomme jamais le moteur de détection sous-jacent (principe #2).

## Conséquences

- **`NotificationChannelConfig` se scinde** : ce qui est commun (activation, plages horaires, seuil,
  format, anti-spam) d'un côté ; ce qui appartient au canal (jeton, destinataire) de l'autre.
  `Channel` devient un enum, conformément à la règle des comparaisons type-safe. Aucune reprise de
  données : les migrations repartent de zéro avant publication.
- **Le sens sortant devient générique lui aussi.** `ITelegramNotificationSender` cède la place à un
  port de canal ; Telegram devient un adaptateur parmi d'autres. Le chantier n'est donc pas
  « ajouter les commandes », c'est **rendre le canal générique dans les deux sens** — et c'est ce qui
  rend les canaux Discord et WhatsApp déjà au backlog quasi gratuits ensuite.
- **Le mécanisme d'entrée est contraint par l'absence d'URL publique.** Un hub non exposé ne peut pas
  recevoir de webhook : seule une **récupération sortante** (long polling Telegram, passerelle
  WebSocket) est compatible. Un canal qui n'accepte que le webhook entrant restera limité au sens
  sortant tant qu'aucune adresse publique n'existe — ce que
  [ADR-51](0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md)
  ne fournit pas et ne veut pas fournir. **C'est une propriété du canal, à vérifier avant de
  l'annoncer** : Telegram et Discord offrent une voie sortante, l'API WhatsApp Cloud **n'expose que
  le webhook et aucune route de récupération** — elle restera donc limitée au sens sortant. Les
  bibliothèques non officielles qui simulent un client WhatsApp maintiennent bien une connexion
  sortante, mais au prix des conditions d'utilisation de Meta et d'un risque de blocage du numéro :
  ce n'est pas une base acceptable pour un produit vendu.
- **Les commandes dépendent d'Internet**, comme les notifications : [SPECS §5.3](../SPECS.md)
  s'applique telle quelle. Elles ne remplacent jamais l'accès local, elles le prolongent.
- **Un journal des commandes** (origine, commande, issue, horodatage) est un fait que Vyzio produit
  et que personne d'autre ne détient — même raisonnement que le journal des notifications
  ([ADR-49](0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md)).
  Il est aussi la seule trace exploitable si un appairage fuit.
- **La déclaration de commande sert au-delà du chat.** La même surface alimentera les intégrations
  tierces via MQTT ([ADR-05](0005-communication-inter-services-vyzio-mqtt-channels.md)) sans être
  redéclarée.
