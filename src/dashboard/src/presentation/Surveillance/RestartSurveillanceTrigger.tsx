import { useState } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { cn } from '../../common/ui/utils'
import { RESTART_QUESTION, restartWording } from '../../common/surveillance/pendingRestart'
import { useRestartSurveillance } from './useRestartSurveillance'

// Shown only when something is actually waiting, so its absence is a positive statement (ADR-44).
export function RestartSurveillanceTrigger() {
  const { pending, restarting, failure, restart } = useRestartSurveillance()
  const [asking, setAsking] = useState(false)
  const wording = restartWording(failure)

  if (!pending && !failure) return null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={failure ? 'destructive' : 'default'}
        disabled={restarting}
        onClick={() => setAsking(true)}
        // Own line on small screens: beside the nav it squeezed it into a vertical stack.
        className="basis-full sm:basis-auto"
      >
        {failure ? (
          <TriangleAlert aria-hidden="true" />
        ) : (
          <RotateCw className={cn(restarting && 'animate-spin')} aria-hidden="true" />
        )}
        {restarting ? 'Redémarrage…' : wording.triggerLabel}
      </Button>

      {asking && (
        <ConfirmModal
          title={RESTART_QUESTION}
          body={wording.body}
          confirmLabel={wording.confirmLabel}
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
