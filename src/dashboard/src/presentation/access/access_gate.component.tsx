import { useEffect, useReducer, type ReactNode } from 'react'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { CreateOwnerScreen } from './components/create_owner_screen'
import { SignInScreen } from './components/sign_in_screen'
import { buildAccessGatePresenter } from './access_gate.presenter'
import { accessGateReducer } from './access_gate.reducer'
import { buildInitialAccessGateUido } from './access_gate.uido'
import { HubUnreachableScreen } from './components/hub_unreachable_screen'

/** Often enough that the app opens soon after Vyzio is back, rarely enough to stay quiet. */
const RETRY_EVERY_MS = 5000

/** Nothing shows before someone is in: first the password to choose, then sign-in (ADR-16). */
export function AccessGate({ children }: { children: ReactNode }) {
  const { access: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(accessGateReducer, undefined, buildInitialAccessGateUido)
  const presenter = usePresenter(buildAccessGatePresenter, { container, dispatch, toast })

  useEffect(() => {
    void presenter.onLoad()
  }, [presenter])

  // A session can end while a screen is open: the answer lands on whichever call happens next.
  useEffect(() => presenter.onWatchSession(), [presenter])

  // Vyzio not answering: asked again on its own, silently, and the app opens once it does (UI-34).
  const unreachable = uido.error !== null
  useEffect(() => {
    if (!unreachable) return
    const timer = setInterval(() => void presenter.onRetry(), RETRY_EVERY_MS)
    return () => clearInterval(timer)
  }, [presenter, unreachable])

  if (uido.loading) return null

  if (uido.error)
    return (
      <HubUnreachableScreen
        error={uido.error}
        retrying={uido.retrying}
        onRetry={() => void presenter.onRetry()}
      />
    )

  if (!uido.state) return null

  if (!uido.state.installed) {
    return (
      <CreateOwnerScreen
        minLength={uido.state.minimumPasswordLength}
        afterReset={uido.state.awaitingReset}
        creating={uido.creating}
        onCreate={(password) => void presenter.onCreateOwner(password)}
      />
    )
  }

  if (uido.expired || !uido.session) {
    return (
      <SignInScreen
        expired={uido.expired}
        refused={uido.refused}
        signingIn={uido.signingIn}
        onSignIn={(password) => void presenter.onSignIn(password)}
      />
    )
  }

  return children
}
