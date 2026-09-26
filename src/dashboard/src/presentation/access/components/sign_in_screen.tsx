import { PasswordScreen } from './password_screen'

export function SignInScreen({
  expired,
  refused,
  signingIn,
  onSignIn,
}: {
  expired: boolean
  refused: boolean
  signingIn: boolean
  onSignIn: (password: string) => void
}) {
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
      busy={signingIn}
      onSubmit={onSignIn}
    />
  )
}
