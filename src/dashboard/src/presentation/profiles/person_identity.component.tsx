import { useReducer } from 'react'
import { useNavigate } from 'react-router'
import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useToast } from '../../common/components/toast'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { Button } from '../../common/ui/button'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/profile.entity'
import type { UpdateProfileRequest } from '../../domain/ports/profile.port'
import { ALERT_MODE_FIELD_LABEL, ALERT_MODE_OPTIONS, CATEGORY_OPTIONS } from './person_labels'
import { usePerson } from './person_context'
import { buildPersonIdentityPresenter } from './person_identity.presenter'
import { personIdentityReducer } from './person_identity.reducer'
import { buildInitialPersonIdentityUido } from './person_identity.uido'

const DRAFT_LABELS: Record<keyof UpdateProfileRequest, string> = {
  name: 'Nom',
  category: 'Lien avec vous',
  alertMode: ALERT_MODE_FIELD_LABEL,
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

export function PersonIdentityView() {
  const { person, reload } = usePerson()
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [uido, dispatch] = useReducer(
    personIdentityReducer,
    undefined,
    buildInitialPersonIdentityUido,
  )
  const presenter = usePresenter(buildPersonIdentityPresenter, { container, dispatch, toast })

  const draft = useSettingsDraft<UpdateProfileRequest>({
    saved: { name: person.name, category: person.category, alertMode: person.alertMode },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const declarations: SettingDeclaration[] = [
    {
      id: 'person-name',
      label: 'Nom',
      nature: { kind: 'text' },
      value: draft.values.name,
      onChange: (value) => draft.set('name', value as string),
    },
    {
      id: 'person-category',
      label: 'Lien avec vous',
      nature: { kind: 'choice', options: CATEGORY_OPTIONS },
      value: draft.values.category,
      onChange: (value) => draft.set('category', value as ProfileCategory),
    },
    {
      id: 'person-alert',
      label: ALERT_MODE_FIELD_LABEL,
      nature: { kind: 'choice', options: ALERT_MODE_OPTIONS },
      help: 'Sans alerte, la détection reste consultable dans l’historique : elle n’est pas ignorée, seulement silencieuse.',
      value: draft.values.alertMode,
      onChange: (value) => draft.set('alertMode', value as ProfileAlertMode),
    },
  ]

  return (
    <>
      <SettingsPage lede={describeLastSeen(person.lastSeenAt)}>
        <SettingsList settings={declarations} />

        <div className="mt-5">
          <Button type="button" variant="destructive" onClick={presenter.onAskDelete}>
            Supprimer cette personne
          </Button>
        </div>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={uido.saving}
        onSave={async () => {
          if (!(await presenter.onSave(person.id, draft.values))) return
          draft.accept()
          reload()
        }}
        onDiscard={draft.discard}
      />

      {uido.confirmDelete && (
        <ConfirmModal
          title={`Supprimer « ${person.name} » ?`}
          body="Ses photos sont effacées et Vyzio cesse de la reconnaître. Les détections déjà enregistrées restent dans l’historique."
          confirmLabel="Supprimer"
          tone="danger"
          loading={uido.deleting}
          onConfirm={async () => {
            if (await presenter.onDelete(person)) void navigate('/settings/detection/personnes')
          }}
          onCancel={presenter.onCancelDelete}
        />
      )}
    </>
  )
}

function describeLastSeen(lastSeenAt: string | null): string {
  return lastSeenAt
    ? `Vue pour la dernière fois le ${dateFormatter.format(new Date(lastSeenAt))}.`
    : 'Jamais reconnue jusqu’ici.'
}
