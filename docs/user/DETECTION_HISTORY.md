# Historique de détection

> Où : **Historique**, dans la barre de navigation. Les dernières détections apparaissent aussi sur
> l'accueil.

## Jusqu'où remonte l'historique

**Exactement aussi loin que votre durée de conservation.** Si vous conservez 14 jours, l'historique
montre 14 jours ; si vous passez à 30, il en montre 30 dès que la surveillance a redémarré.

C'est une seule et même durée, réglée à un seul endroit : **Réglages** → **Conservation** →
**Historique de détection**, et sur la fiche d'une caméra si vous voulez qu'elle s'en écarte. Voir
[Durées de conservation](RECORDING_RETENTION.md).

Deux conséquences directes :

- **Raccourcir la durée raccourcit l'historique.** Les détections plus anciennes en sortent, avec
  leur aperçu et leur vidéo. Le ménage n'est pas instantané : comptez jusqu'à une heure.
- **La durée ne peut pas valoir zéro.** Un jour au minimum : une durée nulle ne raccourcirait pas
  l'historique, elle le supprimerait, et vous détecteriez sans jamais rien pouvoir revoir.

Si vous ne voulez rien conserver d'une caméra, **désactivez la caméra** — c'est le geste prévu, et
le seul qui arrête aussi sa détection.

## Ce qu'une ligne vous montre

Chaque ligne porte l'aperçu de la détection, ce qui a été détecté, la caméra, l'heure, et la
certitude du moteur quand il en donne une.

- **L'aperçu** est l'image recadrée sur ce qui a été détecté. Cliquez dessus pour ouvrir le plan
  large — la même image que celle de vos notifications, qui montre la scène entière.
- **Vidéo** ouvre l'extrait rattaché à la détection, quand il en existe un.

## Quand un aperçu ou une vidéo manque

Deux causes, et Vyzio vous dit laquelle :

- **« Aperçu et vidéo effacés — au-delà de la durée de conservation. »** La détection est plus
  ancienne que ce que sa caméra conserve. Ce n'est pas une panne : c'est votre réglage qui a fait son
  travail. La ligne reste, avec ce qu'elle sait ; l'image, elle, n'existe plus.
- **« La surveillance ne répond pas. »** La surveillance est arrêtée ou ne démarre pas. Tant qu'elle
  l'est, il n'y a pas d'historique du tout — et surtout, **il n'y a pas de surveillance en cours**.
  C'est le point à traiter en premier.

Un aperçu qui met quelques secondes à venir juste après une détection est normal : l'image est
encore en train d'être écrite. Vyzio réessaie tout seul.

## Corriger une reconnaissance

Quand Vyzio a mis un nom sur quelqu'un et s'est trompé, corrigez-le depuis la ligne : le bon profil,
ou aucun. La correction part immédiatement et vous la voyez tout de suite ; elle met quelques
secondes à être prise en compte partout.

## Voir aussi

- [Durées de conservation](RECORDING_RETENTION.md) — la durée qui fixe la profondeur de cette page.
- [Notifications Telegram](TELEGRAM_NOTIFICATIONS.md) — ce qui part au moment de la détection, sans
  attendre.
