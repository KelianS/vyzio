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
import type { Camera, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { ScheduleCountLine } from '../../common/schedule/schedule_count_line'
import { ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { PrivacyAnswerNotice } from './components/privacy_answer_notice'
import { SurveillanceFirstNotice } from './components/surveillance_first_notice'
import { LiveViewNeed } from './live_view_need'
import { surveillanceEntryOf } from '../../common/camera/camera_status'
import {
  OrientationControl,
  orientationControlOf,
} from '../../common/orientation/orientation_control'
import { buildPrivacySettings, STRATEGY_LABEL } from './camera_privacy_settings'
import { POSITIONS_UNREAD } from './cameras.formatters'
import { buildCameraPrivacyPresenter } from './camera_privacy.presenter'
import { cameraPrivacyReducer } from './camera_privacy.reducer'
import { buildInitialCameraPrivacyUido } from './camera_privacy.uido'

const DRAFT_LABELS = { strategy: STRATEGY_LABEL }

export function CameraPrivacyView() {
  const camera = useOutletContext<Camera>()
  const { cameras: container, schedules: schedulesContainer } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    cameraPrivacyReducer,
    undefined,
    buildInitialCameraPrivacyUido,
  )
  const presenter = usePresenter(buildCameraPrivacyPresenter, {
    container,
    schedulesContainer,
    dispatch,
    toast,
  })

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
        {/* Orientation à l'écart needs positions, saved from the live view (SPECS 9.3). */}
        {orientationControlOf(camera) === OrientationControl.Usable && (
          <SurveillanceFirstNotice
            cameraId={camera.id}
            entry={surveillanceEntryOf(camera)}
            need={LiveViewNeed.ParkingOrientation}
          />
        )}

        <SettingsSection title="Plages horaires">
          <ScheduleCountLine
            rules={uido.rules}
            kind={ScheduleRuleKind.Privacy}
            targetId={camera.id}
            error={uido.rulesError}
            onRetry={presenter.onRetryRules}
          />

          <HelpPanel title="Comment les plages et la coupure manuelle s’articulent-elles ?">
            <p>
              Une plage coupe la caméra à son entrée et la rétablit à sa sortie. Si vous avez coupé
              la caméra vous-même, la plage ne la rétablira pas : ce que vous avez décidé à la main
              ne se défait qu’à la main.
            </p>
            <p>
              Un redémarrage de Vyzio ne réveille rien : une coupure manuelle est retrouvée telle
              quelle, et les plages sont réévaluées : si l’heure courante tombe dans l’une d’elles,
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
