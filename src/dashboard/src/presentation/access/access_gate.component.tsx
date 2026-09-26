import { useEffect, useReducer, type ReactNode } from 'react'
import { ErrorMessage } from '../../common/components/error_message'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { CreateOwnerScreen } from './components/create_owner_screen'
import { SignInScreen } from './components/sign_in_screen'
import { buildAccessGatePresenter } from './access_gate.presenter'
import { accessGateReducer } from './access_gate.reducer'
import { buildInitialAccessGateUido } from './access_gate.uido'

/** Nothing shows before someone is in: first the password to choose, then sign-in (ADR-54). */
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

  if (uido.loading) return null

  if (uido.error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="font-serif text-2xl">Vyzio ne répond pas</h1>
        <ErrorMessage error={uido.error} className="text-muted-foreground" />
        <button
          type="button"
          onClick={() => void presenter.onLoad()}
          className="text-sm font-medium underline"
        >
          Réessayer
        </button>
      </main>
    )
  }

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
