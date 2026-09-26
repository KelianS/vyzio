import { useEffect, useReducer } from 'react'
import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'
import { usePerson } from './person_context'
import { buildPersonCamerasPresenter } from './person_cameras.presenter'
import { personCamerasReducer } from './person_cameras.reducer'
import { buildInitialPersonCamerasUido } from './person_cameras.uido'

interface CameraValues {
  cameraIds: string[]
}

const DRAFT_LABELS: Record<keyof CameraValues, string> = { cameraIds: 'Caméras' }

export function PersonCamerasView() {
  const { person } = usePerson()
  const { profiles: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    personCamerasReducer,
    undefined,
    buildInitialPersonCamerasUido,
  )
  const presenter = usePresenter(buildPersonCamerasPresenter, { container, dispatch, toast })

  const personId = person.id

  useEffect(() => {
    presenter.onLoad(personId)
  }, [presenter, personId])

  if (uido.loading) return <SettingsPage>Chargement…</SettingsPage>
  if (!uido.links) return null

  return (
    <CameraLinksForm
      links={uido.links}
      saving={uido.saving}
      onSave={(cameraIds) => presenter.onSave(personId, cameraIds)}
    />
  )
}

function CameraLinksForm({
  links,
  saving,
  onSave,
}: {
  links: ProfileCameraLink[]
  saving: boolean
  onSave: (cameraIds: string[]) => Promise<boolean>
}) {
  const draft = useSettingsDraft<CameraValues>({
    saved: { cameraIds: links.filter((link) => link.enabled).map((link) => link.cameraId) },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

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
        saving={saving}
        onSave={async () => {
          if (await onSave(draft.values.cameraIds)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
