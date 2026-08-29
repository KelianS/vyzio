import { RotateCw } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { useAsync } from '../../common/hooks/useAsync'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type {
  CommandOutcome,
  NotificationChannelName,
} from '../../domain/entities/NotificationChannelConfig'

const formatReceivedAt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const OUTCOME: Record<CommandOutcome, { label: string; muted: boolean }> = {
  succeeded: { label: 'Répondu', muted: true },
  failed: { label: 'Échec', muted: false },
  // Dit tel quel : c'est le seul signe qu'une autre conversation frappe a la porte (ADR-50).
  rejected: { label: 'Ignoré — conversation non reliée', muted: false },
}

/** What the channel was asked and how it ended -- the trace SPECS 5.4 requires. */
export function CommandJournal({ channel }: { channel: NotificationChannelName }) {
  const { notifications: container } = useAppContainer()
  const journal = useAsync(() => container.getCommandJournal.execute(channel), [channel])

  return (
    <div>
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={journal.loading}
          onClick={journal.reload}
        >
          <RotateCw className={cn(journal.loading && 'animate-spin')} aria-hidden="true" />
          Actualiser
        </Button>
      </div>

      {journal.data && journal.data.length > 0 ? (
        <ul className="divide-y divide-border text-sm">
          {journal.data.map((entry) => {
            const outcome = OUTCOME[entry.outcome]
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <span>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">/{entry.verb}</code>
                  <span className="ml-2 text-muted-foreground">
                    {formatReceivedAt.format(new Date(entry.receivedAt))}
                  </span>
                </span>
                <span className={cn(outcome.muted ? 'text-muted-foreground' : 'text-destructive')}>
                  {entry.errorMessage ?? outcome.label}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {journal.loading ? 'Chargement…' : 'Aucune commande reçue pour l’instant.'}
        </p>
      )}
    </div>
  )
}
