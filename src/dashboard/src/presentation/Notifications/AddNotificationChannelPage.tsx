import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { channelSetupLede } from './channelSetup'

/** Adding a channel is one task, one page (ADR-40) — the list of what Vyzio can talk through. */
export function AddNotificationChannelPage() {
  const { notifications: container } = useAppContainer()
  const channels = useAsync(() => container.listNotificationChannels.execute(), [])

  const available = (channels.data ?? []).filter((channel) => !channel.isConfigured)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/settings/notifications"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Notifications
        </Link>
        <h1 className="mt-1 font-serif text-3xl">Ajouter un canal</h1>
      </div>

      <SettingsPage lede="Le réglage est le même partout : seule la façon de s’y connecter change.">
        {available.length > 0 ? (
          <ul className="divide-y divide-border">
            {available.map((channel) => (
              <li key={channel.channel}>
                <Link
                  to={`/settings/notifications/${channel.channel}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{channel.displayName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {channelSetupLede(channel.channel)}
                    </span>
                    {/* Dit avant l'activation, pour ne jamais laisser croire qu'on pourra lui parler (ADR-52). */}
                    <span className="block text-sm text-muted-foreground">
                      {channel.acceptsCommands
                        ? 'Vous pourrez aussi lui demander ce qui se passe chez vous.'
                        : 'Ce canal envoie des alertes, mais ne répond pas aux questions.'}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-muted-foreground">
            {channels.loading ? 'Chargement…' : 'Tous les canaux disponibles sont déjà en place.'}
          </p>
        )}
      </SettingsPage>
    </div>
  )
}
