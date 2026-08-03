import { useBlocker } from 'react-router'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useRootStore } from '../../infrastructure/store/rootStore'
import { RESTART_BODY, RESTART_QUESTION } from '../../common/surveillance/pendingRestart'
import { useRestartSurveillance } from '../Surveillance/useRestartSurveillance'

const SETTINGS_ROOT = '/settings'

function isSettings(pathname: string) {
  return pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`)
}

/**
 * Le seul garde de navigation de l'application.
 *
 * react-router n'accepte **qu'un blocage a la fois** : deux `useBlocker`
 * concurrents ne se partagent pas le travail, le dernier enregistre gagne et
 * l'autre est ignore en silence. Les deux questions sont donc posees ici, dans
 * l'ordre ou elles se presentent — ce qui garantit aussi qu'elles ne s'empilent
 * jamais (ADR-41, ADR-44).
 */
export function NavigationGuard() {
  const unsaved = useRootStore((state) => state.unsavedChanges)
  const { pending, restarting, restart } = useRestartSurveillance()

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false
    if (unsaved) return true
    return pending && isSettings(currentLocation.pathname) && !isSettings(nextLocation.pathname)
  })

  // Le blocage survit a la disparition de sa cause — typiquement un enregistrement
  // entre-temps — et laisserait une question sans objet a l'ecran.
  if (blocker.state === 'blocked' && !unsaved && !pending) {
    blocker.reset?.()
    return null
  }

  if (blocker.state !== 'blocked') return null

  // Perdre des modifications passe avant tout le reste : c'est la seule des deux
  // questions dont la mauvaise reponse detruit quelque chose.
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
