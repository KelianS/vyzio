import type { NotificationChannelName } from '../../domain/entities/NotificationChannelConfig'

/**
 * The install checklist of a channel, in its own words — the only place a channel is named. It ends
 * inside Vyzio, on the pairing: a channel that alerts but answers nothing is a half-installed one.
 *
 * A step body is plain text with two marks the renderer understands: `code` for what is typed or
 * clicked, and [label](url) for a link. Keeping it text keeps this file a declaration.
 */
interface ChannelSetupStep {
  readonly title: string
  readonly body: string
}

export interface ChannelSetup {
  readonly lede: string
  readonly steps: readonly ChannelSetupStep[]
}

export const CHANNEL_SETUP: Record<NotificationChannelName, ChannelSetup> = {
  telegram: {
    lede: 'Cinq étapes, une seule fois.',
    steps: [
      {
        title: 'Créez un bot',
        body: 'Écrivez à [@BotFather](https://t.me/BotFather) et envoyez `/newbot`. Il répond avec un token de la forme `123456:ABC…` : c’est le `Token du bot` ci-dessus.',
      },
      {
        title: 'Démarrez-le',
        body: 'Ouvrez la conversation avec votre nouveau bot et envoyez-lui `/start`. Sans ce premier message, Telegram lui interdit de vous écrire.',
      },
      {
        title: 'Relevez l’identifiant de conversation',
        body: 'Écrivez à [@userinfobot](https://t.me/userinfobot) : il répond aussitôt avec votre numéro, à recopier dans `Identifiant de conversation`.',
      },
      {
        title: 'Vérifiez',
        body: 'Enregistrez, puis envoyez un message de test : il doit arriver sur Telegram.',
      },
      {
        title: 'Reliez la conversation',
        body: 'Sans elle, le bot alerte mais ne répond à personne. La section `Commander depuis la conversation`, plus bas, donne un code et la commande à lui envoyer.',
      },
    ],
  },
  discord: {
    lede: 'Cinq étapes, une seule fois.',
    steps: [
      {
        title: 'Créez un bot',
        body: 'Sur le [portail développeur de Discord](https://discord.com/developers/applications) : `Nouvelle application`, donnez-lui un nom (`Vyzio`), puis onglet `Bot` › `Réinitialiser le token` › `Copier`. Ce token est le `Token du bot` ci-dessus.',
      },
      {
        title: 'Invitez-le sur votre serveur',
        body: 'Onglet `Installation` : `Type d’installation` › `Installation pour une guilde` (c’est un serveur, pas un compte). Cochez les portées `bot` et `applications.commands`, puis la permission `Envoyer des messages`. Ouvrez l’adresse d’installation proposée et choisissez votre serveur.',
      },
      {
        title: 'Relevez l’identifiant du salon',
        body: 'Dans Discord : `Paramètres utilisateur` › `Avancés` › activez `Mode développeur`. Puis, sur votre serveur, clic droit sur le salon qui recevra les alertes › `Copier l’identifiant du salon`, à recopier dans `Identifiant du salon`. Tous ceux qui y ont accès verront les images.',
      },
      {
        title: 'Vérifiez',
        body: 'Enregistrez, puis envoyez un message de test : il doit arriver dans le salon.',
      },
      {
        title: 'Reliez le salon',
        body: 'Sans lui, le bot alerte mais ne répond à personne. La section `Commander depuis la conversation`, plus bas, donne un code et la commande à lui envoyer.',
      },
    ],
  },
}

export function channelSetupLede(channel: NotificationChannelName): string {
  return CHANNEL_SETUP[channel].lede
}
