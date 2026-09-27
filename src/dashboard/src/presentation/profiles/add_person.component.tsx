import { useReducer } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/profile.entity'
import { ALERT_MODE_FIELD_LABEL, ALERT_MODE_OPTIONS, CATEGORY_OPTIONS } from './person_labels'
import { buildAddPersonPresenter } from './add_person.presenter'
import { addPersonReducer } from './add_person.reducer'
import { buildInitialAddPersonUido } from './add_person.uido'

/** Adding a person is one task, one page (ADR-40). */
export function AddPersonView() {
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [uido, dispatch] = useReducer(addPersonReducer, undefined, buildInitialAddPersonUido)
  const presenter = usePresenter(buildAddPersonPresenter, { container, dispatch, toast })
  const { name, category, alertMode } = uido.form

  async function add() {
    const createdId = await presenter.onCreate(uido.form)
    // Photos are next: without them recognition can't do anything with this profile.
    if (createdId) void navigate(`/settings/detection/personnes/${createdId}/photos`)
  }

  const declarations: SettingDeclaration[] = [
    {
      id: 'person-name',
      label: 'Nom',
      nature: { kind: 'text', placeholder: 'Alice' },
      value: name,
      onChange: (value) => presenter.onNameChange(value as string),
    },
    {
      id: 'person-category',
      label: 'Lien avec vous',
      nature: { kind: 'choice', options: CATEGORY_OPTIONS },
      value: category,
      onChange: (value) => presenter.onCategoryChange(value as ProfileCategory),
    },
    {
      id: 'person-alert',
      label: ALERT_MODE_FIELD_LABEL,
      nature: { kind: 'choice', options: ALERT_MODE_OPTIONS },
      help: 'Sans alerte, la détection reste consultable dans l’historique : elle n’est pas ignorée, seulement silencieuse.',
      value: alertMode,
      onChange: (value) => presenter.onAlertModeChange(value as ProfileAlertMode),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/settings/detection/personnes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Personnes
        </Link>
        <h1 className="mt-1 font-serif text-3xl">Ajouter une personne</h1>
      </div>

      <SettingsPage lede="Les photos viendront juste après.">
        <SettingsList settings={declarations} />

        <div className="mt-5">
          <Button type="button" disabled={uido.creating || !name.trim()} onClick={() => void add()}>
            {uido.creating ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </SettingsPage>
    </div>
  )
}
