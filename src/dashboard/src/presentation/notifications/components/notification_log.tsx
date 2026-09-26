import { RotateCw } from 'lucide-react'
import { Button } from '../../../common/ui/button'
import { cn } from '../../../common/ui/utils'
import type { NotificationLogEntry } from '../../../domain/entities/notification_channel_config.entity'

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
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onRefresh}>
          <RotateCw className={cn(loading && 'animate-spin')} aria-hidden="true" />
          Actualiser
        </Button>
      </div>

      {entries.length > 0 ? (
        <ul className="divide-y divide-border text-sm">
          {entries.map((entry) => (
            <li
              key={`${entry.sentAt}-${entry.status}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
            >
              <span>{formatSentAt.format(new Date(entry.sentAt))}</span>
              <span
                className={cn(
                  'text-sm',
                  entry.status === 'sent' ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {entry.status === 'sent' ? 'Envoyé' : (entry.errorMessage ?? 'Échec')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {loading ? 'Chargement…' : 'Aucun envoi pour l’instant.'}
        </p>
      )}
    </div>
  )
}
