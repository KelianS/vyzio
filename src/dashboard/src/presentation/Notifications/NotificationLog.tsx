import { RotateCw } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

const formatSentAt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** What Vyzio actually sent — the only proof the channel works outside of a manual test. */
export function NotificationLog({ channel }: { channel: string }) {
  const { notifications: container } = useAppContainer()
  const log = useAsync(() => container.getNotificationLog.execute(channel), [channel])

  return (
    <div>
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={log.loading}
          onClick={log.reload}
        >
          <RotateCw className={cn(log.loading && 'animate-spin')} aria-hidden="true" />
          Actualiser
        </Button>
      </div>

      {log.data && log.data.length > 0 ? (
        <ul className="divide-y divide-border text-sm">
          {log.data.map((entry) => (
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
          {log.loading ? 'Chargement…' : 'Aucun envoi pour l’instant.'}
        </p>
      )}
    </div>
  )
}
