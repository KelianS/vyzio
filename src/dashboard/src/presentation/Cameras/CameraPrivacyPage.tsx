import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { UnsavedChangesGuard } from '../../common/settings/UnsavedChangesGuard'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { PrivacyScheduleSection } from './PrivacyScheduleSection'
import { buildPrivacySettings, type PrivacyStrategy } from './cameraPrivacySettings'

const DRAFT_LABELS = { strategy: 'Quand vous coupez la surveillance' }

export function CameraPrivacyPage() {
  const camera = useOutletContext<Camera>()
  const allCameras = useRootStore((state) => state.cameras)
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()

  const draft = useSettingsDraft<{ strategy: PrivacyStrategy }>({
    saved: { strategy: camera.privacyStrategy },
    labels: DRAFT_LABELS,
  })

  const saving = useAsyncAction(
    async () => container.setPrivacyStrategy.execute(camera.id, draft.values.strategy),
    {
      onSuccess: () => {
        draft.accept()
        toast('Mode vie privée enregistré.', 'success')
        void useRootStore.getState().loadCameras(container.getCameras)
      },
    },
  )

  const settings = buildPrivacySettings({
    camera,
    value: draft.values.strategy,
    onChange: (strategy) => draft.set('strategy', strategy),
  })

  return (
    <>
      <UnsavedChangesGuard when={draft.dirty} />

      {/* Le mode et ses plages horaires repondent a une seule question : quand la
          surveillance s'arrete, et comment. Les separer en deux cadres donnait
          deux titres a un unique reglage. */}
      <SettingsPage lede="Ce que Vyzio fait de cette caméra quand vous ne voulez pas être filmé.">
        <SettingsList settings={settings} />

        {/* Section non encore reprise : elle garde ses propres actions. */}
        <SettingsSection title="Plages horaires" lede="Couper et rétablir automatiquement.">
          <PrivacyScheduleSection
            camera={camera}
            cameraId={camera.id}
            allCameras={allCameras}
            getSchedules={container.getCameraPrivacySchedules}
            createSchedule={container.createCameraPrivacySchedule}
            deleteSchedule={container.deleteCameraPrivacySchedule}
          />
        </SettingsSection>
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
