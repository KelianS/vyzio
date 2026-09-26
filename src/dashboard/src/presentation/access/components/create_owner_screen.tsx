import { HelpPanel } from '../../../common/components/help_panel'
import { PasswordScreen } from './password_screen'

export function CreateOwnerScreen({
  minLength,
  afterReset,
  creating,
  onCreate,
}: {
  minLength: number
  afterReset: boolean
  creating: boolean
  onCreate: (password: string) => void
}) {
  return (
    <PasswordScreen
      // After a reset the installation still exists: its owner first wants to know what became of it.
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
      busy={creating}
      onSubmit={onCreate}
      help={
        afterReset ? undefined : (
          <HelpPanel title="Et si je l’oublie ?">
            <p>
              Il n’y a ni courriel de récupération ni compte en ligne : Vyzio ne connaît personne
              d’autre que vous. Un mot de passe oublié se remet à zéro depuis la machine qui héberge
              Vyzio : il faut donc y avoir accès, ce qui est précisément ce qui protège vos images.
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
