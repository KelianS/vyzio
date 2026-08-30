import { useBlocker } from 'react-router'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { RESTART_QUESTION, restartWording } from '../../common/surveillance/pendingRestart'
import { useRestartSurveillance } from '../Surveillance/useRestartSurveillance'

const SETTINGS_ROOT = '/settings'

function isSettings(pathname: string) {
  return pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`)
}

/**
 * The only navigation guard in the application.
 *
 * react-router accepts **one block at a time**: two competing `useBlocker` do not
 * share the work, the last one registered wins and the other is ignored silently.
 * Both questions are therefore asked here, in the order they come up - which also
 * guarantees they never stack (ADR-41, ADR-44).
 */
export function NavigationGuard() {
  const unsaved = useRootStore((state) => state.unsavedChanges)
  const { pending, restarting, failure, restart } = useRestartSurveillance()
  const wording = restartWording(failure)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false
    if (unsaved) return true
    return pending && isSettings(currentLocation.pathname) && !isSettings(nextLocation.pathname)
  })

  // The block outlives its cause - typically a save in the meantime - and would
  // leave a question with no object on screen.
  if (blocker.state === 'blocked' && !unsaved && !pending) {
    blocker.reset?.()
    return null
  }

  if (blocker.state !== 'blocked') return null

  // Losing changes comes before everything else: it is the only one of the two
  // questions whose wrong answer destroys something.
  if (unsaved) {
    return (
      <ConfirmModal
        title="Quitter sans enregistrer ?"
        body="Vos modifications seront perdues."
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Rester sur la page"
        tone="warn"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    )
  }

  return (
    <ConfirmModal
      title={RESTART_QUESTION}
      body={wording.body}
      confirmLabel={wording.confirmLabel}
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
