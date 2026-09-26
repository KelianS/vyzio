import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useAsync } from '../../common/hooks/use_async'
import { useAsyncAction } from '../../common/hooks/use_async_action'
import { useToast } from '../../common/components/toast'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'
import { usePerson } from './person_context'

interface CameraValues {
  cameraIds: string[]
}

const DRAFT_LABELS: Record<keyof CameraValues, string> = { cameraIds: 'Caméras' }

export function PersonCamerasPage() {
  const { person } = usePerson()
  const { profiles: container } = useAppContainer()
  const links = useAsync(() => container.getProfileCameraLinks.execute(person.id), [person.id])

  if (links.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (!links.data) return null

  return <CameraLinksForm personId={person.id} links={links.data} reload={links.reload} />
}

function CameraLinksForm({
  personId,
  links,
  reload,
}: {
  personId: string
  links: ProfileCameraLink[]
  reload: () => void
}) {
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()

  const draft = useSettingsDraft<CameraValues>({
    saved: { cameraIds: links.filter((link) => link.enabled).map((link) => link.cameraId) },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () => container.setProfileCameraLinks.execute(personId, draft.values.cameraIds),
    {
      onSuccess: () => {
        draft.accept()
        toast('Caméras enregistrées.', 'success')
        reload()
      },
    },
  )

  return (
    <>
      <SettingsPage lede="Sans choix, cette personne est reconnue sur toutes les caméras.">
        {links.length > 0 ? (
          <SettingsList
            settings={[
              {
                id: 'person-cameras',
                label: 'La reconnaître seulement sur',
                nature: {
                  kind: 'multiChoice',
                  options: links.map((link) => ({
                    value: link.cameraId,
                    label: link.cameraDisplayName ?? link.cameraId,
                  })),
                },
                value: draft.values.cameraIds,
                onChange: (value) => draft.set('cameraIds', value as string[]),
              },
            ]}
          />
        ) : (
          <p className="text-muted-foreground">Aucune caméra pour l’instant.</p>
        )}
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
