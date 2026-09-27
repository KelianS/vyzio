import { useEffect, useReducer } from 'react'
import { SettingsPage } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useToast } from '../../common/components/toast'
import { ReadFailure } from '../../common/components/error_message'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { Camera } from '../../domain/entities/camera.entity'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'
import { useRootStore } from '../../infrastructure/store/root.store'
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
  const { profiles: container, cameras: camerasContainer } = useAppContainer()
  const { toast } = useToast()
  const cameras = useRootStore((state) => state.cameras)
  const camerasLoading = useRootStore((state) => state.camerasLoading)
  const camerasError = useRootStore((state) => state.camerasError)
  const [uido, dispatch] = useReducer(
    personCamerasReducer,
    undefined,
    buildInitialPersonCamerasUido,
  )
  const presenter = usePresenter(buildPersonCamerasPresenter, {
    container,
    camerasContainer,
    dispatch,
    toast,
  })

  const personId = person.id

  useEffect(() => {
    presenter.onLoad(personId)
  }, [presenter, personId])

  // An unread camera list is not an empty one: saying "no camera" would be false.
  if (camerasError && cameras.length === 0)
    return (
      <SettingsPage>
        <ReadFailure error={camerasError} onRetry={presenter.onReloadCameras} />
      </SettingsPage>
    )
  if (uido.loading || (camerasLoading && cameras.length === 0))
    return <SettingsPage>Chargement…</SettingsPage>
  if (!uido.links) return null

  return (
    <CameraLinksForm
      cameras={cameras}
      links={uido.links}
      saving={uido.saving}
      onSave={(cameraIds) => presenter.onSave(personId, cameraIds)}
    />
  )
}

function CameraLinksForm({
  cameras,
  links,
  saving,
  onSave,
}: {
  cameras: readonly Camera[]
  links: ProfileCameraLink[]
  saving: boolean
  onSave: (cameraIds: string[]) => Promise<boolean>
}) {
  // No link exists before a camera is ticked, so the options are the installed cameras.
  const draft = useSettingsDraft<CameraValues>({
    saved: { cameraIds: links.filter((link) => link.enabled).map((link) => link.cameraId) },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  return (
    <>
      <SettingsPage lede="Sans choix, cette personne est reconnue sur toutes les caméras.">
        {cameras.length > 0 ? (
          <SettingsList
            settings={[
              {
                id: 'person-cameras',
                label: 'La reconnaître seulement sur',
                nature: {
                  kind: 'multiChoice',
                  options: cameras.map((camera) => ({
                    value: camera.id,
                    label: camera.displayName,
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
