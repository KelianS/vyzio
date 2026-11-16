import { LogOut } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { HelpRow } from '../../common/components/help_panel'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { useToast } from '../../common/components/toast'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { buildAccessPresenter } from './access.presenter'
import { accessReducer } from './access.reducer'
import { buildInitialAccessUido } from './access.uido'

/** What one can do with their own access: change it, leave it, or take it back from every device (ADR-16). */
export function AccessView() {
  const { access: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(accessReducer, undefined, buildInitialAccessUido)
  const presenter = usePresenter(buildAccessPresenter, { container, dispatch, toast })

  useEffect(() => {
    presenter.onLoad()
  }, [presenter])

  // Signing out makes the interface disappear: the door closes, it is not a screen to refresh.
  async function leave(signOut: () => Promise<boolean>) {
    if (await signOut()) window.location.reload()
  }

  return (
    <SettingsPage>
      <SettingsSection
        title="Mot de passe"
        lede="Le changer déconnecte les autres appareils, pas celui-ci."
      >
        <ChangePasswordForm
          minLength={uido.minLength}
          changing={uido.changing}
          refused={uido.refused}
          onChange={presenter.onChangePassword}
        />
      </SettingsSection>

      {/* The cost of leaving everywhere is said by its confirmation, not above it (DESIGN SYSTEM § Help). */}
      <GroupedList label="Appareils">
        <GroupedRow
          icon={LogOut}
          title="Se déconnecter"
          weight="action"
          trailing="none"
          disabled={uido.leaving}
          onClick={() => void leave(presenter.onSignOut)}
        />
        <GroupedRow
          icon={LogOut}
          title="Déconnecter tous les appareils"
          weight="action"
          trailing="none"
          disabled={uido.leavingEverywhere}
          onClick={presenter.onAskSignOutEverywhere}
        />
        <HelpRow title="Quand faut-il déconnecter tous les appareils ?">
          <p>
            Quand un téléphone ou un ordinateur qui ouvrait Vyzio n’est plus entre vos mains :
            perdu, volé, revendu, ou simplement prêté. Tant qu’il reste connecté, il donne accès à
            vos caméras sans mot de passe.
          </p>
          <p>
            Si vous pensez que quelqu’un connaît votre mot de passe, cela ne suffit pas : il
            pourrait se reconnecter aussitôt. Changez-le plutôt, ci-dessus.
          </p>
        </HelpRow>
      </GroupedList>

      {uido.confirmEverywhere && (
        <ConfirmModal
          title="Déconnecter tous les appareils ?"
          body="Chaque appareil, celui-ci compris, devra saisir le mot de passe à nouveau. Le mot de passe, lui, ne change pas."
          confirmLabel="Déconnecter"
          onCancel={presenter.onCancelSignOutEverywhere}
          onConfirm={() => leave(presenter.onSignOutEverywhere)}
        />
      )}
    </SettingsPage>
  )
}

function ChangePasswordForm({
  minLength,
  changing,
  refused,
  onChange,
}: {
  minLength: number | null
  changing: boolean
  refused: boolean
  onChange: (current: string, next: string) => Promise<boolean>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')

  // The minimum length has one home, the server: restating it here would let the two drift apart.
  const tooShort = minLength !== null && next.length > 0 && next.length < minLength

  async function change() {
    if (!(await onChange(current, next))) return
    setCurrent('')
    setNext('')
  }

  const incomplete = current.length === 0 || next.length === 0 || tooShort

  return (
    <form
      className="max-w-sm space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (changing || incomplete) return
        void change()
      }}
    >
      <div className="space-y-2">
        <label
          htmlFor="current-password"
          className="ml-1 block text-label font-semibold text-muted-foreground"
        >
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
        <label
          htmlFor="new-password"
          className="ml-1 block text-label font-semibold text-muted-foreground"
        >
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
        {minLength !== null && (
          <p id="new-password-hint" className="text-body text-muted-foreground">
            Au moins {minLength} caractères.
          </p>
        )}
      </div>

      {/* A refusal is read beside the field it refused, in a line kept so the button never jumps. */}
      <div className="min-h-lh text-body">
        {refused && (
          <p role="alert" className="text-body font-medium text-destructive">
            Mot de passe actuel incorrect.
          </p>
        )}
      </div>

      <Button type="submit" disabled={changing || incomplete}>
        {changing ? 'Un instant…' : 'Changer le mot de passe'}
      </Button>
    </form>
  )
}
