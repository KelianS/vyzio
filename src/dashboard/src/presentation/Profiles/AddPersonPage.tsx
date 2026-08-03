import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { SettingsList } from '../../common/settings/SettingsList'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/Profile'
import { ALERT_MODE_OPTIONS, CATEGORY_OPTIONS } from './personLabels'

/** Ajouter une personne : une tache, donc une page qui la nomme (ADR-40). */
export function AddPersonPage() {
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ProfileCategory>('family')
  const [alertMode, setAlertMode] = useState<ProfileAlertMode>('always')

  const creating = useAsyncAction(
    async () => container.createProfile.execute({ name: name.trim(), category, alertMode }),
    {
      onSuccess: (person) => {
        toast(`« ${person!.name} » ajoutée.`, 'success')
        // La suite de la tache est d'ajouter ses photos : sans elles, la
        // reconnaissance ne peut rien faire de ce profil.
        void navigate(`/settings/detection/personnes/${person!.id}/photos`)
      },
    },
  )

  const declarations: SettingDeclaration[] = [
    {
      id: 'person-name',
      label: 'Nom',
      nature: { kind: 'text', placeholder: 'Alice' },
      value: name,
      onChange: (value) => setName(value as string),
    },
    {
      id: 'person-category',
      label: 'Lien avec vous',
      nature: { kind: 'choice', options: CATEGORY_OPTIONS },
      value: category,
      onChange: (value) => setCategory(value as ProfileCategory),
    },
    {
      id: 'person-alert',
      label: 'Quand elle est reconnue',
      nature: { kind: 'choice', options: ALERT_MODE_OPTIONS },
      help: 'Sans alerte, la détection reste consultable dans l’historique : elle n’est pas ignorée, seulement silencieuse.',
      value: alertMode,
      onChange: (value) => setAlertMode(value as ProfileAlertMode),
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
          <Button
            type="button"
            disabled={creating.loading || !name.trim()}
            onClick={() => void creating.run()}
          >
            {creating.loading ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </SettingsPage>
    </div>
  )
}
