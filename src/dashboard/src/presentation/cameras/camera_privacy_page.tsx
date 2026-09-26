import { useReloadCameraList } from './camera_list_read'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { useAsyncAction } from '../../common/hooks/use_async_action'
import { useAsync } from '../../common/hooks/use_async'
import { PARKING_PRESET_ID, SURVEILLANCE_PRESET_ID } from '../../domain/entities/ptz_preset.entity'
import { ErrorMessage } from '../../common/components/error_message'
import { useToast } from '../../common/components/toast'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import type { Camera, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { PrivacyScheduleSection } from './privacy_schedule_section'
import { PrivacyAnswerNotice } from './privacy_answer_notice'
import { buildPrivacySettings } from './camera_privacy_settings'

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

  useUnsavedChanges(draft.dirty)
  const reloadCameras = useReloadCameraList()

  const saving = useAsyncAction(
    async () => container.setPrivacyStrategy.execute(camera.id, draft.values.strategy),
    {
      onSuccess: () => {
        draft.accept()
        toast('Mode vie privée enregistré.', 'success')
        reloadCameras()
      },
    },
  )

  const presets = useAsync(() => container.getPtzPresets.execute(camera.id), [camera.id], {
    skip: !camera.ptzSupported,
  })
  const saved = (slot: number) =>
    presets.data?.presets.some((p) => p.presetId === slot && p.configured) ?? false
  // Unknown until read: a failed read must not pass for positions never saved.
  const positionsSaved = presets.data
    ? saved(PARKING_PRESET_ID) && saved(SURVEILLANCE_PRESET_ID)
    : null

  const settings = buildPrivacySettings({
    camera,
    setup: { positionsSaved },
    value: draft.values.strategy,
    onChange: (strategy) => draft.set('strategy', strategy),
  })

  return (
    <>
      {/* Le mode et ses plages horaires repondent a une seule question : quand la
          surveillance s'arrete, et comment. Les separer en deux cadres donnait
          deux titres a un unique reglage. */}
      <SettingsPage lede="Ce que Vyzio fait de cette caméra quand vous ne voulez pas être filmé.">
        <PrivacyAnswerNotice camera={camera} />
        <SettingsList settings={settings} />
        {presets.error && <ErrorMessage error={presets.error} />}

        {/* Section non encore reprise : elle garde ses propres actions. */}
        <SettingsSection title="Plages horaires" lede="Couper et rétablir automatiquement.">
          <PrivacyScheduleSection
            cameraId={camera.id}
            allCameras={allCameras}
            getSchedules={container.getCameraPrivacySchedules}
            createSchedule={container.createCameraPrivacySchedule}
            deleteSchedule={container.deleteCameraPrivacySchedule}
          />

          <HelpPanel title="Comment les plages et la coupure manuelle s’articulent-elles ?">
            <p>
              Une plage coupe la caméra à son entrée et la rétablit à sa sortie. Si vous avez coupé
              la caméra vous-même, la plage ne la rétablira pas : ce que vous avez décidé à la main
              ne se défait qu’à la main.
            </p>
            <p>
              Une plage peut passer minuit : 22:00 → 06:00 commence le soir des jours choisis et se
              termine le lendemain à 06:00.
            </p>
            <p>
              Un redémarrage de Vyzio ne réveille rien : une coupure manuelle est retrouvée telle
              quelle, et les plages sont réévaluées — si l’heure courante tombe dans l’une d’elles,
              la caméra repart coupée.
            </p>
          </HelpPanel>
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
