import { useState } from 'react'
import { HelpPanel } from '../../common/components/HelpPanel'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useToast } from '../../common/components/Toast'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

/** What one can do with their own access: change it, leave it, or take it back from every device (ADR-54). */
export function AccessPage() {
  const { access } = useAppContainer()
  const [confirming, setConfirming] = useState(false)

  // Signing out makes the interface disappear: the door closes, it is not a screen to refresh.
  const leaving = useAsyncAction(async () => access.signOut.execute(), {
    onSuccess: () => window.location.reload(),
  })

  const leavingEverywhere = useAsyncAction(async () => access.signOutEverywhere.execute(), {
    onSuccess: () => window.location.reload(),
  })

  return (
    <SettingsPage lede="Qui peut ouvrir cette interface, et depuis quels appareils.">
      <SettingsSection
        title="Mot de passe"
        lede="Le changer ferme toutes les sessions ouvertes ailleurs. Cet appareil reste connecté."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <SettingsSection
        title="Cet appareil"
        lede="Cet appareil reste connecté plusieurs semaines sans redemander le mot de passe. Le déconnecter ne change rien aux autres."
      >
        <Button variant="outline" disabled={leaving.loading} onClick={() => void leaving.run()}>
          Se déconnecter
        </Button>
      </SettingsSection>

      <SettingsSection
        title="Tous les appareils"
        lede="Referme toutes les sessions ouvertes, celle-ci comprise. Le mot de passe reste le même : chaque appareil devra le saisir à nouveau."
      >
        <Button
          variant="outline"
          disabled={leavingEverywhere.loading}
          onClick={() => setConfirming(true)}
        >
          Déconnecter tous les appareils
        </Button>

        <HelpPanel title="Quand faut-il déconnecter tous les appareils ?">
          <p>
            Quand un téléphone ou un ordinateur qui ouvrait Vyzio n’est plus entre vos mains :
            perdu, volé, revendu, ou simplement prêté. Tant qu’une session y reste ouverte, elle
            donne accès à vos caméras sans mot de passe.
          </p>
          <p>
            Si vous pensez que quelqu’un connaît votre mot de passe, cela ne suffit pas : il
            pourrait se reconnecter aussitôt. Changez-le d’abord, ci-dessus — le changer ferme les
            sessions par la même occasion.
          </p>
        </HelpPanel>
      </SettingsSection>

      {confirming && (
        <ConfirmModal
          title="Déconnecter tous les appareils ?"
          body="Vous devrez saisir votre mot de passe à nouveau, ici comme ailleurs."
          confirmLabel="Déconnecter"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false)
            await leavingEverywhere.run()
          }}
        />
      )}
    </SettingsPage>
  )
}

function ChangePasswordForm() {
  const { access } = useAppContainer()
  const { toast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [refused, setRefused] = useState(false)

  // The minimum length has one home, the server: restating it here would let the two drift apart.
  const state = useAsync(async () => access.getAccessState.execute(), [])
  const minLength = state.data?.minimumPasswordLength
  const tooShort = minLength !== undefined && next.length > 0 && next.length < minLength

  const changing = useAsyncAction(async () => access.changePassword.execute(current, next), {
    onSuccess: (result) => {
      if (result === 'wrong-password') {
        setRefused(true)
        return
      }
      setCurrent('')
      setNext('')
      toast('Mot de passe changé. Les autres appareils ont été déconnectés.', 'success')
    },
  })

  const incomplete = current.length === 0 || next.length === 0 || tooShort

  return (
    <form
      className="max-w-sm space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (changing.loading || incomplete) return
        setRefused(false)
        void changing.run()
      }}
    >
      <div className="space-y-2">
        <label htmlFor="current-password" className="block text-sm font-medium">
          Mot de passe actuel
        </label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          aria-invalid={refused}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="new-password" className="block text-sm font-medium">
          Nouveau mot de passe
        </label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          aria-invalid={tooShort}
          aria-describedby="new-password-hint"
        />
        {minLength !== undefined && (
          <p id="new-password-hint" className="text-sm text-muted-foreground">
            Au moins {minLength} caractères.
          </p>
        )}
      </div>

      {/* A refusal is read beside the field it refused, never in a notification that fades. */}
      {refused && (
        <p role="alert" className="text-sm font-medium text-danger">
          Mot de passe actuel incorrect.
        </p>
      )}

      <Button type="submit" disabled={changing.loading || incomplete}>
        {changing.loading ? 'Un instant…' : 'Changer le mot de passe'}
      </Button>
    </form>
  )
}
