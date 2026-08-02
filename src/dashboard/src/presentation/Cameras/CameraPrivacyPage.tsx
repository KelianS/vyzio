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
import { SettingsPanel } from '../Settings/SettingsPanel'
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

      <div className="flex flex-col gap-4">
        <SettingsPanel
          title="Vie privée"
          lede="Ce que Vyzio fait de cette caméra quand vous ne voulez pas être filmé."
        >
          <SettingsList settings={settings} />
        </SettingsPanel>

        {/* Section non encore reprise : elle garde ses propres actions. */}
        <SettingsPanel title="Plages horaires" lede="Couper et rétablir automatiquement.">
          <PrivacyScheduleSection
            camera={camera}
            cameraId={camera.id}
            allCameras={allCameras}
            getSchedules={container.getCameraPrivacySchedules}
            createSchedule={container.createCameraPrivacySchedule}
            deleteSchedule={container.deleteCameraPrivacySchedule}
          />
        </SettingsPanel>
      </div>

      <SettingsDraftBar
        changes={draft.changes}
        interruptsMonitoring
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}
