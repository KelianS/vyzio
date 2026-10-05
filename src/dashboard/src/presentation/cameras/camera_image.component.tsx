import { useEffect, useReducer, type ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/settings_list'
import { SettingsDraftBar } from '../../common/settings/settings_draft_bar'
import { useUnsavedChanges } from '../navigation/use_unsaved_changes'
import { useSettingsDraft } from '../../common/settings/use_settings_draft'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { Overlay } from '../../common/components/overlay'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import type { Camera } from '../../domain/entities/camera.entity'
import type {
  CameraImageSettings,
  IrCutMode,
} from '../../domain/entities/camera_image_settings.entity'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { LiveView } from '../live_view/live_view.component'
import { OrientationUnavailable } from '../../common/components/orientation_unavailable'
import {
  MOVES,
  OrientationControl,
  orientationControlOf,
} from '../../common/orientation/orientation_control'
import { ReadFailure } from '../../common/components/error_message'
import { PtzCalibrationSection } from './components/ptz_calibration_section'
import { SurveillanceFirstNotice } from './components/surveillance_first_notice'
import { SurveillanceEntry, surveillanceEntryOf } from '../../common/camera/camera_status'
import { CameraNotFound } from './components/camera_not_found'
import { buildCameraImagePresenter } from './camera_image.presenter'
import { cameraImageReducer } from './camera_image.reducer'
import { buildInitialCameraImageUido } from './camera_image.uido'

// Beyond the basics: offered only where writing it is confirmed (ADR-29).
const ADJUSTMENTS = [
  { key: 'brightness', label: 'Luminosité', beyondBasics: false },
  { key: 'contrast', label: 'Contraste', beyondBasics: false },
  { key: 'saturation', label: 'Saturation', beyondBasics: false },
  { key: 'sharpness', label: 'Netteté', beyondBasics: true },
] as const

const IR_CUT_OPTIONS = [
  { value: 'auto', label: 'Automatique' },
  { value: 'on', label: 'Toujours' },
  { value: 'off', label: 'Jamais' },
] as const

const DRAFT_LABELS: Record<keyof CameraImageSettings, string> = {
  brightness: 'Luminosité',
  contrast: 'Contraste',
  saturation: 'Saturation',
  sharpness: 'Netteté',
  irCutMode: 'Vision nocturne',
}

/** The only page carrying two subjects (image and control): splitting them in two frames duplicated the tab title. */
export function CameraImageView() {
  const camera = useOutletContext<Camera>()
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(cameraImageReducer, undefined, buildInitialCameraImageUido)
  const presenter = usePresenter(buildCameraImagePresenter, { container, dispatch, toast })

  const cameraId = camera.id
  const hasImageSettings = camera.verifiedCapabilities.includes('image_settings')
  const orientation = orientationControlOf(camera)
  const moves = MOVES[orientation]
  const entry = surveillanceEntryOf(camera)

  useEffect(() => {
    presenter.onLoad(cameraId, { imageSettings: hasImageSettings, ptz: moves })
  }, [presenter, cameraId, hasImageSettings, moves])

  const pilotageBody = (): ReactNode => {
    switch (orientation) {
      case OrientationControl.Off:
        return null
      case OrientationControl.Unusable:
        return <OrientationUnavailable cameraId={cameraId} />
      case OrientationControl.Usable:
        // Positions are saved from the live view, which only a camera in surveillance has (SPECS 9.3).
        if (entry !== SurveillanceEntry.Watched)
          return <SurveillanceFirstNotice cameraId={cameraId} entry={entry} />
        return (
          <>
            <PtzCalibrationSection
              loading={uido.ptzLoading}
              error={uido.ptzError}
              calibrated={uido.calibrated}
              currentPosition={uido.currentPosition}
              onOpenLiveView={presenter.onOpenLiveView}
              onRetry={() => presenter.onRetryPtz(cameraId)}
            />
            {uido.liveViewOpen && (
              <Overlay
                label={`Pilotage : ${camera.displayName}`}
                onClose={() => presenter.onCloseLiveView(cameraId)}
              >
                <LiveView
                  cameraId={cameraId}
                  label={camera.displayName}
                  orientation={orientation}
                  qualities={camera.liveQualities}
                />
              </Overlay>
            )}
          </>
        )
      default: {
        const unknown: never = orientation
        return unknown
      }
    }
  }

  const body = pilotageBody()
  // The lede names what the section holds, so it goes with the controls.
  const pilotage = body ? (
    <SettingsSection
      title="Pilotage"
      lede={moves ? 'Calibration et positions enregistrées.' : undefined}
    >
      {body}
    </SettingsSection>
  ) : null

  if (!hasImageSettings) {
    return (
      <SettingsPage>
        {pilotage ?? (
          <p className="text-muted-foreground">
            Cette caméra n’expose ni réglages d’image ni pilotage.
          </p>
        )}
      </SettingsPage>
    )
  }

  if (uido.cameraGone)
    return (
      <SettingsPage>
        <CameraNotFound within="tab" />
      </SettingsPage>
    )
  // Control does not depend on these settings: it stays on screen while they load, failure included.
  if (uido.settingsLoading) return <SettingsPage>Chargement…{pilotage}</SettingsPage>
  if (uido.settingsError)
    return (
      <SettingsPage>
        <ReadFailure
          error={uido.settingsError}
          onRetry={() => presenter.onRetrySettings(cameraId)}
          subject="Les réglages d’image de cette caméra n’ont pas pu être lus."
        />
        {pilotage}
      </SettingsPage>
    )
  if (!uido.settings) return <SettingsPage>{pilotage}</SettingsPage>

  return (
    <ImageForm
      settings={uido.settings}
      writableBeyondBasics={uido.writableBeyondBasics}
      saving={uido.saving}
      onSave={(values) => presenter.onSave(cameraId, values)}
      beyondBasicsFailure={
        uido.bindingsError && (
          <ReadFailure
            error={uido.bindingsError}
            onRetry={() => presenter.onRetryBindings(cameraId)}
            subject="Vyzio n’a pas pu vérifier si cette caméra accepte la netteté et la vision nocturne."
          />
        )
      }
    >
      {pilotage}
    </ImageForm>
  )
}

function ImageForm({
  settings,
  writableBeyondBasics,
  saving,
  onSave,
  beyondBasicsFailure,
  children,
}: {
  settings: CameraImageSettings
  writableBeyondBasics: boolean
  saving: boolean
  onSave: (values: CameraImageSettings) => Promise<boolean>
  /** Shown where sharpness and night vision would be, when whether they are writable is unknown. */
  beyondBasicsFailure: ReactNode
  children: ReactNode
}) {
  const draft = useSettingsDraft<CameraImageSettings>({ saved: settings, labels: DRAFT_LABELS })

  useUnsavedChanges(draft.dirty)

  const declarations: SettingDeclaration[] = ADJUSTMENTS.filter(
    (adjustment) => !adjustment.beyondBasics || writableBeyondBasics,
  ).map((adjustment) => ({
    id: `image-${adjustment.key}`,
    label: adjustment.label,
    // A bounded value with a continuous meaning: a slider and a number, to aim and to re-read (ADR-43).
    nature: { kind: 'range', unit: '%', min: 0, max: 100 },
    value: draft.values[adjustment.key],
    onChange: (value) => draft.set(adjustment.key, value as number),
  }))

  if (writableBeyondBasics) {
    declarations.push({
      id: 'image-ir-cut',
      label: 'Vision nocturne',
      nature: { kind: 'choice', options: [...IR_CUT_OPTIONS] },
      help: 'En automatique, la caméra bascule seule quand la lumière baisse. Forcer un mode est utile derrière une vitre, où le reflet infrarouge trompe la détection.',
      value: draft.values.irCutMode,
      onChange: (value) => draft.set('irCutMode', value as IrCutMode),
    })
  }

  return (
    <>
      <SettingsPage lede="Ce que la caméra envoie, avant toute analyse.">
        <SettingsList settings={declarations} />
        {beyondBasicsFailure}
        {children}
      </SettingsPage>

      <SettingsDraftBar
        changes={draft.changes}
        saving={saving}
        onSave={async () => {
          if (await onSave(draft.values)) draft.accept()
        }}
        onDiscard={draft.discard}
      />
    </>
  )
}
