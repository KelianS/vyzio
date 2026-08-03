import { useBlocker } from 'react-router'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { RESTART_BODY, RESTART_QUESTION } from '../../common/surveillance/pendingRestart'
import { useRestartSurveillance } from './useRestartSurveillance'

const SETTINGS_ROOT = '/settings'

function isSettings(pathname: string) {
  return pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`)
}

// Asked when leaving the settings, never between two settings pages (ADR-44).
export function LeavingSettingsPrompt() {
  const { pending, restarting, restart } = useRestartSurveillance()

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      pending && isSettings(currentLocation.pathname) && !isSettings(nextLocation.pathname),
  )

  if (blocker.state !== 'blocked') return null

  return (
    <ConfirmModal
      title={RESTART_QUESTION}
      body={RESTART_BODY}
      confirmLabel="Redémarrer"
      cancelLabel="Plus tard"
      tone="confirm"
      loading={restarting}
      onConfirm={() => {
        // Not held during the restart: progress reads on the surveillance status (ADR-33).
        void restart()
        blocker.proceed?.()
      }}
      // Both answers let through: the gap is allowed, and the trigger stays in the header.
      onCancel={() => blocker.proceed?.()}
    />
  )
}
