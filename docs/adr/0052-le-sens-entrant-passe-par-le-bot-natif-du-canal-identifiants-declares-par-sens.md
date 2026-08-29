# ADR-52 — Le sens entrant passe par le bot natif du canal : identifiants déclarés par sens

> Statut : Accepté

## Contexte

[ADR-50](0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md)
a tranché le principe — un registre de commandes agnostique du canal, alimenté par une **récupération
sortante** faute d'adresse publique — et le sens sortant est livré : un canal déclare ses capacités et
les identifiants qu'il exige, Telegram et Discord sont deux adaptateurs derrière un port unique.

Le sens entrant se heurte à un fait que le sens sortant n'avait pas révélé : **la surface qui reçoit
n'est pas celle qui envoie.** Telegram ne le montre pas, parce que son jeton de bot sert dans les deux
sens. Discord si : le canal livré passe par un *webhook entrant*, une adresse d'écriture seule, sans
route de lecture ni connexion persistante. Aucune commande ne peut arriver par là. Recevoir sur
Discord suppose une **application bot** connectée à la passerelle — d'autres identifiants, un autre
parcours d'installation.

Deuxième fait, de nature vie privée : un bot Discord qui lit le texte des messages ordinaires réclame
l'intention privilégiée *message content*, c'est-à-dire l'accès à toute la conversation du salon —
alors que Vyzio n'a besoin que de ce qui lui est adressé.

## Options comparées

1. **Garder le webhook pour le sortant, ajouter un bot pour l'entrant.** Écartée : deux installations
   à faire pour un seul canal, et les messages arrivent sous **deux identités** différentes dans le
   même salon. Surtout, « le canal est configuré » cesse de vouloir dire quelque chose — configuré
   pour envoyer, pour recevoir, pour les deux ?
2. **Le bot porte les deux sens ; les identifiants se déclarent par sens.** Retenue.
3. **Laisser Discord en sortie seule et ne livrer les commandes que sur Telegram.** Écartée : elle
   restaure exactement ce que l'étape précédente a démonté, un canal privilégié. La barre de l'étape
   est que le même jeu de commandes fonctionne partout sans code spécifique ; un seul canal ne la
   franchit pas.

## Décision

**Option 2.** Le descripteur de canal cesse de déclarer *des identifiants* : il déclare, **par sens**,
un transport et les identifiants que ce transport exige. Un canal peut n'en déclarer qu'un — c'est
alors une propriété visible du produit, pas un manque silencieux.

### Le sens entrant est une capacité comme une autre

Un canal sans transport entrant reste un canal : il reçoit les alertes et n'accepte pas de commandes.
L'interface le dit **avant** l'activation ([SPECS §5.2](../SPECS.md)), aucune boucle de récupération
ne démarre pour lui, et aucune commande ne lui est publiée. C'est le même raisonnement que le
catalogue de capacités caméra ([ADR-22](0022-catalogue-de-capacites-camera-decouplage-marque.md)) :
le produit s'adapte à ce que le canal sait faire.

### Les commandes sont publiées dans la grammaire du canal

Le registre est la source unique ; chaque adaptateur **publie** les commandes qu'il porte dans la
forme native de son canal — `setMyCommands` côté Telegram, commandes d'application côté Discord. Deux
effets : l'utilisateur découvre les commandes par l'autocomplétion de sa messagerie plutôt que par une
documentation, et les paramètres typés du registre sont validés par le canal avant d'arriver.

Sur Discord, cela dispense d'observer les messages ordinaires : les interactions de commande arrivent
par la passerelle sans l'intention *message content*. **Le bot ne lit pas la conversation, seulement
ce qui lui est adressé** — la lecture minimale, conformément au principe #3 et à la promesse du
produit.

### Discord passe du webhook au bot

Ses identifiants deviennent un jeton de bot et un identifiant de salon ; le webhook disparaît. Le
parcours d'installation s'allonge — créer une application, inviter le bot, copier l'identifiant du
salon — et c'est le prix des commandes : le guide d'installation du canal doit le porter entièrement,
puisque personne ne lira une documentation Discord.

## Conséquences

- **Aucune reprise de données.** Le webhook Discord n'a pas d'équivalent dans la nouvelle forme : la
  migration efface la configuration du canal, qui se refait depuis l'interface — même règle qu'à
  l'étape précédente, une seule instance et pas de publication encore faite.
- **L'appairage se raccroche au sens entrant, pas au canal.** Une conversation appairée n'a de sens
  que là où quelque chose écoute ; un canal sans transport entrant n'affiche pas d'appairage.
- **Le catalogue de capacités s'étend** : ce qu'un canal sait *rendre* (boutons, image, vidéo,
  longueur utile) et ce qu'il sait *recevoir* deviennent deux déclarations distinctes du même
  descripteur.
- **Une boucle de récupération par canal entrant configuré**, démarrée et arrêtée avec la
  configuration ; sa panne doit être lisible dans les réglages du canal, faute de quoi l'utilisateur
  conclura que Vyzio ne répond plus.
- **WhatsApp reste hors de portée en entrée**, pour la raison déjà consignée en ADR-50 : l'API Cloud
  n'expose que le webhook entrant. Il déclarera un transport sortant et rien d'autre — ce que le
  modèle ci-dessus sait exprimer sans cas particulier.
