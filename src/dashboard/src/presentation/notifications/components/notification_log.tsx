import { RotateCw } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import type { NotificationLogEntry } from '../../../domain/entities/notification_channel_config.entity'
import { SecondaryButton } from '../../../common/components/secondary_button'
import { Loading } from '../../../common/components/loading'
import { EmptyState } from '../../../common/components/empty_state'

const formatSentAt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** What Vyzio actually sent — the only proof the channel works outside of a manual test. */
export function NotificationLog({
  entries,
  loading,
  onRefresh,
}: {
  entries: NotificationLogEntry[]
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div>
      <div className="mb-3">
        <SecondaryButton
          icon={RotateCw}
          iconClassName={cn(loading && 'animate-spin')}
          type="button"
          size="sm"
          disabled={loading}
          onClick={onRefresh}
        >
          Actualiser
        </SecondaryButton>
      </div>

      {entries.length > 0 ? (
        <ul className="divide-y divide-border text-body">
          {entries.map((entry) => (
            <li
              key={`${entry.sentAt}-${entry.status}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
            >
              <span>{formatSentAt.format(new Date(entry.sentAt))}</span>
              <span
                className={cn(
                  'text-body',
                  entry.status === 'sent' ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {entry.status === 'sent' ? 'Envoyé' : (entry.errorMessage ?? 'Échec')}
              </span>
            </li>
          ))}
        </ul>
      ) : loading ? (
        <Loading />
      ) : (
        <EmptyState>Aucun envoi pour l’instant.</EmptyState>
      )}
    </div>
  )
}
