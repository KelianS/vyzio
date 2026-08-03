import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SettingsPage } from '../../common/settings/SettingsPage'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Button } from '../../common/ui/button'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/Profile'
import { ALERT_MODE_OPTIONS, CATEGORY_OPTIONS } from './personLabels'
import { usePerson } from './personContext'

interface IdentityValues {
  name: string
  category: ProfileCategory
  alertMode: ProfileAlertMode
}

const DRAFT_LABELS: Record<keyof IdentityValues, string> = {
  name: 'Nom',
  category: 'Lien avec vous',
  alertMode: 'Quand elle est reconnue',
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

export function PersonIdentityPage() {
  const { person, reload } = usePerson()
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const draft = useSettingsDraft<IdentityValues>({
    saved: { name: person.name, category: person.category, alertMode: person.alertMode },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () => container.updateProfile.execute(person.id, draft.values),
    {
      onSuccess: () => {
        draft.accept()
        toast('Identité enregistrée.', 'success')
        reload()
      },
    },
  )

  const deleting = useAsyncAction(async () => container.deleteProfile.execute(person.id), {
    onSuccess: () => {
      toast(`« ${person.name} » supprimée.`, 'info')
      void navigate('/settings/detection/personnes')
    },
  })

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
      label: 'Quand elle est reconnue',
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
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Supprimer cette personne
          </Button>
        </div>
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />

      {confirmDelete && (
        <ConfirmModal
          title={`Supprimer « ${person.name} » ?`}
          body="Ses photos sont effacées et Vyzio cesse de la reconnaître. Les détections déjà enregistrées restent dans l’historique."
          confirmLabel="Supprimer"
          tone="danger"
          loading={deleting.loading}
          onConfirm={async () => {
            await deleting.run()
            setConfirmDelete(false)
          }}
          onCancel={() => setConfirmDelete(false)}
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
