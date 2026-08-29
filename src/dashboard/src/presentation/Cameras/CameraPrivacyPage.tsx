import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { HelpPanel } from '../../common/components/HelpPanel'
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

  useUnsavedChanges(draft.dirty)

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

          <HelpPanel title="Comment les plages et la coupure manuelle s’articulent-elles ?">
            <p>
              Une plage coupe la caméra à son entrée et la rétablit à sa sortie. Si vous avez coupé
              la caméra vous-même, la plage ne la rétablira pas : ce que vous avez décidé à la main
              ne se défait qu’à la main.
            </p>
            <p>
              Une plage ne passe pas minuit : pour couvrir 22:00–02:00, créez-en deux, 22:00–23:59
              puis 00:00–02:00.
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
