import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { HelpPanel } from '../../common/components/HelpPanel'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { appErrorMessage } from '../../common/errors/AppError'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { onSessionLost } from '../../infrastructure/http/sessionLost'
import { PasswordScreen } from './PasswordScreen'

/**
 * Nothing shows before someone is in: a fresh installation opens on choosing the password, and a
 * session that ended returns to sign-in saying so (ADR-54).
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { access } = useAppContainer()
  const [expired, setExpired] = useState(false)

  const gate = useAsync(async () => {
    const state = await access.getAccessState.execute()
    const session = state.installed ? await access.getCurrentSession.execute() : null
    return { state, session }
  }, [])

  const { reload } = gate
  const reopen = useCallback(() => {
    setExpired(false)
    reload()
  }, [reload])

  // A session can end while a screen is open: the answer lands on whichever call happens next.
  useEffect(() => onSessionLost(() => setExpired(true)), [])

  if (gate.loading) return null

  if (gate.error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="font-serif text-2xl">Vyzio ne répond pas</h1>
        <p className="text-sm text-muted-foreground">{appErrorMessage(gate.error)}</p>
        <button type="button" onClick={reload} className="text-sm font-medium underline">
          Réessayer
        </button>
      </main>
    )
  }

  if (!gate.data) return null

  if (!gate.data.state.installed) {
    return (
      <CreateOwnerScreen
        minLength={gate.data.state.minimumPasswordLength}
        afterReset={gate.data.state.awaitingReset}
        onCreated={reopen}
      />
    )
  }

  if (expired || !gate.data.session) {
    return <SignInScreen expired={expired} onSignedIn={reopen} />
  }

  return children
}

function CreateOwnerScreen({
  minLength,
  afterReset,
  onCreated,
}: {
  minLength: number
  afterReset: boolean
  onCreated: () => void
}) {
  const { access } = useAppContainer()

  const creating = useAsyncAction(
    async (password: string) => access.createOwnerAccount.execute(password),
    { onSuccess: onCreated },
  )

  return (
    <PasswordScreen
      // Same screen, different moment: after a reset the installation already exists, and the first
      // question its owner has is what became of it.
      title={afterReset ? 'Choisissez un nouveau mot de passe' : 'Protégez votre installation'}
      lede={
        afterReset
          ? 'Le mot de passe a été retiré depuis la machine qui héberge Vyzio. Vos caméras, vos réglages et votre historique n’ont pas bougé.'
          : 'Vyzio donne accès à vos caméras : choisissez le mot de passe qui ouvrira cette interface. C’est la seule étape avant d’ajouter votre première caméra.'
      }
      label="Mot de passe"
      hint={`Au moins ${minLength} caractères.`}
      minLength={minLength}
      action={afterReset ? 'Enregistrer et continuer' : 'Protéger et continuer'}
      busy={creating.loading}
      onSubmit={(value) => void creating.run(value)}
      help={
        afterReset ? undefined : (
          <HelpPanel title="Et si je l’oublie ?">
            <p>
              Il n’y a ni courriel de récupération ni compte en ligne : Vyzio ne connaît personne
              d’autre que vous. Un mot de passe oublié se remet à zéro depuis la machine qui héberge
              Vyzio — il faut donc y avoir accès, ce qui est précisément ce qui protège vos images.
            </p>
            <p>
              Choisissez-en un que votre navigateur retient. Il ne vous sera pas redemandé à chaque
              visite : une fois connecté, cet appareil le reste plusieurs semaines.
            </p>
          </HelpPanel>
        )
      }
    />
  )
}

function SignInScreen({ expired, onSignedIn }: { expired: boolean; onSignedIn: () => void }) {
  const { access } = useAppContainer()
  const [refused, setRefused] = useState(false)

  const signingIn = useAsyncAction(async (password: string) => access.signIn.execute(password), {
    onSuccess: (session) => {
      // A refused password is not a failure: the screen says so and lets them try again.
      if (session === null) setRefused(true)
      else onSignedIn()
    },
  })

  return (
    <PasswordScreen
      title="Vyzio est verrouillé"
      lede={
        expired
          ? 'Votre session a pris fin. Saisissez votre mot de passe pour reprendre où vous en étiez.'
          : 'Saisissez le mot de passe de cette installation.'
      }
      label="Mot de passe"
      action="Déverrouiller"
      error={refused ? 'Mot de passe incorrect.' : undefined}
      busy={signingIn.loading}
      onSubmit={(value) => {
        setRefused(false)
        void signingIn.run(value)
      }}
    />
  )
}
