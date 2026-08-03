import { useState } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { cn } from '../../common/ui/utils'
import {
  RESTART_ACTION,
  RESTART_COST,
  RESTART_QUESTION,
  describePendingRestart,
} from '../../common/surveillance/pendingRestart'
import { useRestartSurveillance } from './useRestartSurveillance'

// Shown only when something is actually waiting, so its absence is a positive statement (ADR-44).
export function RestartSurveillanceTrigger() {
  const { pending, restarting, failure, restart } = useRestartSurveillance()
  const [asking, setAsking] = useState(false)

  if (pending.length === 0 && !failure) return null

  const summary = describePendingRestart(pending)

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={restarting}
        // Rounded rectangle: an action, not a state (DESIGN SYSTEM shape rule).
        className={cn(
          'inline-flex h-8 items-center justify-center gap-1.5 rounded-btn px-3 text-sm font-medium',
          // Own line on small screens: beside the nav it squeezed it into a vertical stack.
          'basis-full sm:basis-auto sm:shrink-0',
          'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
          'disabled:opacity-60',
          failure
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-surface-inverse-foreground text-surface-inverse hover:bg-surface-inverse-foreground/90',
        )}
        title={failure ?? summary}
      >
        {failure ? (
          <TriangleAlert className="size-4" aria-hidden="true" />
        ) : (
          <RotateCw className={cn('size-4', restarting && 'animate-spin')} aria-hidden="true" />
        )}
        {restarting ? 'Redémarrage…' : failure ? 'Redémarrage échoué' : RESTART_ACTION}
      </button>

      {asking && (
        <ConfirmModal
          title={RESTART_QUESTION}
          // What waits, then what it costs; a previous failure is repeated here.
          body={[failure, summary, RESTART_COST].filter(Boolean).join(' ')}
          confirmLabel={failure ? 'Réessayer' : 'Redémarrer'}
          cancelLabel="Plus tard"
          tone="confirm"
          loading={restarting}
          onConfirm={async () => {
            await restart()
            setAsking(false)
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
