import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { NotificationChannelSummary } from '../../domain/entities/NotificationChannelConfig'

/** First level of the Notifications rubric: the channels in place. Adding one is its own task/page. */
export function NotificationChannelListPage() {
  const { notifications: container } = useAppContainer()
  const channels = useAsync(() => container.listNotificationChannels.execute(), [])

  const configured = (channels.data ?? []).filter((channel) => channel.isConfigured)
  const remaining = (channels.data ?? []).length - configured.length

  return (
    <SettingsPage lede="Par où Vyzio vous prévient quand il détecte quelque chose.">
      {configured.length > 0 ? (
        <ul className="divide-y divide-border">
          {configured.map((channel) => (
            <li key={channel.channel}>
              <Link
                to={`/settings/notifications/${channel.channel}`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{channel.displayName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {describeChannel(channel)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge tone={channel.isEnabled ? 'ok' : 'neutral'}>
                    {channel.isEnabled ? 'Actif' : 'En pause'}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-muted-foreground">
          {channels.loading
            ? 'Chargement…'
            : 'Aucun canal pour l’instant : vous n’êtes prévenu que dans l’interface.'}
        </p>
      )}

      {remaining > 0 && (
        <div className="mt-5">
          <Button asChild>
            <Link to="/settings/notifications/ajout">
              <Plus aria-hidden="true" />
              Ajouter un canal
            </Link>
          </Button>
        </div>
      )}
    </SettingsPage>
  )
}

function describeChannel(channel: NotificationChannelSummary): string {
  return channel.isEnabled
    ? 'Les alertes sont envoyées.'
    : 'Configuré, mais aucune alerte n’est envoyée.'
}
