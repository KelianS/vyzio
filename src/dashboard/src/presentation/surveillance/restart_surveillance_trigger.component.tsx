import { useState } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { cn } from '../../common/ui/utils'
import { RESTART_QUESTION, restartWording } from '../../common/surveillance/pending_restart'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { buildRestartSurveillancePresenter } from './restart_surveillance.presenter'
import { useRestartState } from './use_restart_state'

// Shown only when something is actually waiting, so its absence is a positive statement (ADR-15, UI-28).
export function RestartSurveillanceTrigger() {
  const { cameras: camerasContainer, hub: hubContainer } = useAppContainer()
  const presenter = usePresenter(buildRestartSurveillancePresenter, {
    camerasContainer,
    hubContainer,
  })
  const { pending, restarting, failure } = useRestartState()
  const [asking, setAsking] = useState(false)
  const wording = restartWording(failure)

  if (!pending && !failure) return null

  return (
    <>
      <Button
        type="button"
        variant={failure ? 'destructive' : 'default'}
        disabled={restarting}
        onClick={() => setAsking(true)}
        // The bar's main action, on its own line under the title (DESIGN SYSTEM § Top bar).
        className="h-12 w-full"
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
          diagnostic={wording.diagnostic}
          confirmLabel={wording.confirmLabel}
          cancelLabel="Plus tard"
          loading={restarting}
          onConfirm={async () => {
            await presenter.onRestart()
            setAsking(false)
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}
