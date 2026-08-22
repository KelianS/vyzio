# Être prévenu — les canaux de notification

Vyzio vous prévient par messagerie quand il détecte quelque chose. Vous choisissez par où : Telegram,
Discord, ou les deux à la fois. Chaque canal a ses propres réglages, et le même écran les règle tous.

> Activer un canal fait **sortir les images de chez vous** : elles transitent par les serveurs du
> service choisi, qui en a connaissance. Vyzio vous le demande explicitement avant le premier envoi.

---

## Ajouter un canal

1. **Réglages › Notifications** liste les canaux déjà en place.
2. Cliquez sur **Ajouter un canal**, puis choisissez le service.
3. Renseignez ce que le canal demande (voir ci-dessous), activez **Alertes**, puis **Enregistrer**.
4. Cliquez sur **Envoyer un message de test** : le message doit arriver dans la conversation.

### Telegram

Telegram demande un **token de bot** et un **identifiant de conversation**.

1. Écrivez à `@BotFather` et envoyez `/newbot`. Il répond avec un token de la forme `123456:ABC…`.
2. Ouvrez la conversation avec votre nouveau bot et envoyez-lui `/start`. Sans ce premier message,
   Telegram lui interdit de vous écrire.
3. Écrivez à `@userinfobot` : il répond aussitôt avec votre identifiant de conversation.

### Discord

Discord demande un **token de bot** et l'**identifiant du salon**.

1. Sur le [portail développeur de Discord](https://discord.com/developers/applications) :
   *Nouvelle application*, donnez-lui un nom (`Vyzio`), puis onglet *Bot* › *Réinitialiser le token*
   › *Copier*.
2. Onglet *Installation* : *Type d'installation* › **Installation pour une guilde** (une guilde est
   un serveur ; l'installation pour un utilisateur ne donnerait accès à aucun salon). Cochez les
   portées `bot` et `applications.commands`, puis la permission *Envoyer des messages*. Ouvrez
   l'adresse d'installation proposée et choisissez votre serveur.
3. Dans Discord : *Paramètres utilisateur* › *Avancés* › activez *Mode développeur*. Puis, sur votre
   serveur, clic droit sur le salon qui recevra les alertes › *Copier l'identifiant du salon*. Tous
   ceux qui y ont accès verront les images.

### Relier la conversation

Un canal enregistré **envoie** les alertes ; il ne **répond** à personne tant qu'aucune conversation
ne lui est reliée. Une commande envoyée depuis une conversation non reliée reste sans réponse, et
c'est voulu : c'est ce qui protège votre installation d'un inconnu qui aurait trouvé le bot.

La section *Commandes* de la page du canal donne un code et la commande à envoyer au bot. Ce code ne
vaut que quelques minutes, et cesse de valoir après plusieurs essais infructueux : dans les deux cas,
la même section en génère un autre. Le lien se coupe depuis là aussi, à tout moment.

---

## Régler ce que vous recevez

Les réglages ci-dessous sont propres à chaque canal : vous pouvez recevoir tout sur Discord et
seulement les inconnus, la nuit, sur Telegram.

| Réglage | Effet |
|---|---|
| **Ce qui déclenche une alerte** | Seules les catégories cochées sont notifiées. Les autres restent détectées et consultables dans l'historique. |
| **Certitude minimale** | En dessous, la détection n'est pas notifiée. Trop bas : des fausses alertes ; trop haut : des détections réelles passent sous silence. |
| **Seulement à certaines heures** | Limite les envois à une plage horaire. Une plage qui se termine avant de commencer passe minuit. |
| **Espacer les alertes répétées** | Impose un silence après une alerte pour la même caméra et le même type d'événement. |
| **Ce qui est envoyé** | Photo et vidéo, photo seule, ou texte seul. |
| **Détails du message** | Caméra, heure, type d'événement, niveau de certitude, aperçu. |

Le choix *Photo et vidéo* n'apparaît que sur les canaux capables de porter une vidéo.

---

## Ce qui part, et quand

Une détection est notifiée sur **chaque canal configuré et actif** qui l'accepte. Un canal reçoit
l'alerte si, pour lui :

- le canal est activé et complètement renseigné ;
- la catégorie détectée fait partie de celles qu'il notifie ;
- la certitude atteint son seuil ;
- l'heure est dans sa plage, s'il en a une ;
- aucun envoi récent ne le fait taire (délai d'espacement) ;
- l'événement ne lui a pas déjà été envoyé.

La vidéo arrive quelques secondes après la détection, le temps que l'enregistrement se termine. Si
elle n'est pas prête, Vyzio envoie la photo ; si la photo manque à son tour, le message part en texte.

---

## Vérifier et dépanner

- **Derniers envois**, dans le repli *Avancé* de la page du canal, liste ce qui est réellement parti
  et l'erreur en cas d'échec. C'est la seule preuve que le canal fonctionne hors d'un test manuel.
- **Envoyer un message de test** n'est disponible qu'une fois la configuration enregistrée.
- **Supprimer le canal** efface ses informations de connexion. Les autres canaux ne sont pas touchés.
- Les notifications ont besoin d'Internet. Sans connexion, Vyzio continue de détecter et
  d'enregistrer chez vous ; les alertes, elles, ne partent pas.

---

Voir aussi : [Historique des détections](DETECTION_HISTORY.md) — ce qui reste consultable même sans
alerte.
