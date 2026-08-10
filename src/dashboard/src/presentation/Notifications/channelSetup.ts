import type { NotificationChannelName } from '../../domain/entities/NotificationChannelConfig'

/**
 * What the user has to do outside Vyzio, per channel — the only place a channel is named.
 *
 * A step body is plain text with two marks the renderer understands: `code` for what is typed or
 * clicked, and [label](url) for a link. Keeping it text keeps this file a declaration.
 */
export interface ChannelSetupStep {
  readonly title: string
  readonly body: string
}

export interface ChannelSetup {
  readonly lede: string
  readonly steps: readonly ChannelSetupStep[]
}

export const CHANNEL_SETUP: Record<NotificationChannelName, ChannelSetup> = {
  telegram: {
    lede: 'Quatre étapes dans Telegram, une seule fois.',
    steps: [
      {
        title: 'Créez un bot',
        body: 'Écrivez à [@BotFather](https://t.me/BotFather) et envoyez `/newbot`. Il répond avec une clé de la forme `123456:ABC…` à recopier ci-dessus.',
      },
      {
        title: 'Démarrez-le',
        body: 'Ouvrez la conversation avec votre nouveau bot et envoyez-lui `/start`. Sans ce premier message, Telegram lui interdit de vous écrire.',
      },
      {
        title: 'Relevez l’identifiant de conversation',
        body: 'Écrivez à [@userinfobot](https://t.me/userinfobot) : il répond aussitôt avec votre numéro.',
      },
      {
        title: 'Vérifiez',
        body: 'Enregistrez, puis envoyez un message de test : il doit arriver sur Telegram.',
      },
    ],
  },
  discord: {
    lede: 'Quatre étapes dans Discord, une seule fois.',
    steps: [
      {
        title: 'Créez un bot',
        body: 'Sur le [portail développeur de Discord](https://discord.com/developers/applications), `New Application`, puis onglet `Bot` › `Reset Token` : la clé obtenue se recopie ci-dessus.',
      },
      {
        title: 'Invitez-le sur votre serveur',
        body: 'Onglet `OAuth2` › `URL Generator` : cochez `bot` et `applications.commands`, puis `Send Messages`. Ouvrez l’adresse produite en bas et choisissez votre serveur.',
      },
      {
        title: 'Relevez l’identifiant du salon',
        body: 'Activez `Paramètres` › `Avancés` › `Mode développeur`, puis clic droit sur le salon qui recevra les alertes › `Copier l’identifiant`. Tous ceux qui y ont accès verront les images.',
      },
      {
        title: 'Vérifiez',
        body: 'Enregistrez, puis envoyez un message de test : il doit arriver dans le salon.',
      },
    ],
  },
}

export function channelSetupLede(channel: NotificationChannelName): string {
  return CHANNEL_SETUP[channel].lede
}
