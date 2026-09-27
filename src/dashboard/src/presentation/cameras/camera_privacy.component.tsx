import { useEffect, useReducer } from 'react'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import { ReadFailure } from '../../common/components/error_message'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import type { Camera, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { PrivacyScheduleSection } from './components/privacy_schedule_section'
import { PrivacyAnswerNotice } from './components/privacy_answer_notice'
import { buildPrivacySettings } from './camera_privacy_settings'
import { POSITIONS_UNREAD } from './cameras.formatters'
import { buildCameraPrivacyPresenter } from './camera_privacy.presenter'
import { cameraPrivacyReducer } from './camera_privacy.reducer'
import { buildInitialCameraPrivacyUido } from './camera_privacy.uido'

const DRAFT_LABELS = { strategy: 'Quand vous coupez la surveillance' }

export function CameraPrivacyView() {
  const camera = useOutletContext<Camera>()
  const allCameras = useRootStore((state) => state.cameras)
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    cameraPrivacyReducer,
    undefined,
    buildInitialCameraPrivacyUido,
  )
  const presenter = usePresenter(buildCameraPrivacyPresenter, { container, dispatch, toast })

  useEffect(() => {
    presenter.onLoad(camera.id, camera.ptzSupported)
  }, [presenter, camera.id, camera.ptzSupported])

  const draft = useSettingsDraft<{ strategy: PrivacyStrategy }>({
    saved: { strategy: camera.privacyStrategy },
    labels: DRAFT_LABELS,
  })

  useUnsavedChanges(draft.dirty)

  const settings = buildPrivacySettings({
    camera,
    setup: { positionsSaved: uido.positionsSaved },
    value: draft.values.strategy,
    onChange: (strategy) => draft.set('strategy', strategy),
  })

  return (
    <>
      {/* The mode and its ranges answer one question, so they share one frame. */}
      <SettingsPage lede="Ce que Vyzio fait de cette caméra quand vous ne voulez pas être filmé.">
        <PrivacyAnswerNotice camera={camera} />
        <SettingsList settings={settings} />
        {uido.presetsError && (
          <ReadFailure
            error={uido.presetsError}
            onRetry={() => presenter.onRetryPresets(camera.id, camera.ptzSupported)}
            subject={POSITIONS_UNREAD}
          />
        )}

        <SettingsSection title="Plages horaires" lede="Couper et rétablir automatiquement.">
          <PrivacyScheduleSection
            schedules={uido.schedules}
            loading={uido.schedulesLoading}
            readError={uido.schedulesError}
            onRetryRead={() => presenter.onRetrySchedules(camera.id)}
            form={uido.form}
            adding={uido.adding}
            invalid={uido.invalid}
            failure={uido.scheduleFailure}
            cameraCount={allCameras.length}
            onToggleDay={presenter.onToggleDay}
            onStartTimeChange={presenter.onStartTimeChange}
            onEndTimeChange={presenter.onEndTimeChange}
            onAddHere={() => void presenter.onAddSchedule([camera.id], uido.form)}
            onAddEverywhere={() =>
              void presenter.onAddSchedule(
                allCameras.map((entry) => entry.id),
                uido.form,
              )
            }
            onDelete={(scheduleId) => void presenter.onDeleteSchedule(camera.id, scheduleId)}
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
        saving={uido.saving}
        onSave={async () => {
          if (await presenter.onSaveStrategy(camera.id, draft.values.strategy)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
