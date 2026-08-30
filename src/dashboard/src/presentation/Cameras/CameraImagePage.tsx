import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { useUnsavedChanges } from '../Navigation/useUnsavedChanges'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraImageSettings, IrCutMode } from '../../domain/entities/CameraImageSettings'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { PtzCalibrationSection } from './PtzCalibrationSection'

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Luminosité' },
  { key: 'contrast', label: 'Contraste' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'sharpness', label: 'Netteté' },
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
export function CameraImagePage() {
  const camera = useOutletContext<Camera>()
  const hasImageSettings = camera.verifiedCapabilities.includes('image_settings')
  const pilotage = camera.ptzSupported ? <PilotageSection camera={camera} /> : null

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

  return <ImageAdjustments camera={camera}>{pilotage}</ImageAdjustments>
}

function ImageAdjustments({ camera, children }: { camera: Camera; children: ReactNode }) {
  const { cameras: container } = useAppContainer()
  const settings = useAsync(() => container.getCameraImageSettings.execute(camera.id), [camera.id])
  const bindings = useAsync(() => container.getCameraCapabilities.execute(camera.id), [camera.id])

  // Control does not depend on these settings: it stays on screen while they load, failure included.
  if (settings.loading) return <SettingsPage>Chargement…{children}</SettingsPage>
  if (settings.error || !settings.data) return <SettingsPage>{children}</SettingsPage>

  return (
    <ImageForm
      camera={camera}
      settings={settings.data}
      // Sharpness/night vision not confirmed writable over DVRIP (ADR-29): do not offer them silently.
      writableBeyondBasics={
        bindings.data?.find((binding) => binding.capability === 'image_settings')?.protocol !==
        'dvrip'
      }
      reload={settings.reload}
    >
      {children}
    </ImageForm>
  )
}

function ImageForm({
  camera,
  settings,
  writableBeyondBasics,
  reload,
  children,
}: {
  camera: Camera
  settings: CameraImageSettings
  writableBeyondBasics: boolean
  reload: () => void
  children: ReactNode
}) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()

  const draft = useSettingsDraft<CameraImageSettings>({ saved: settings, labels: DRAFT_LABELS })

  useUnsavedChanges(draft.dirty)

  const saving = useAsyncAction(
    async () => container.setCameraImageSettings.execute(camera.id, draft.values),
    {
      onSuccess: () => {
        draft.accept()
        toast('Réglages d’image enregistrés.', 'success')
        reload()
      },
    },
  )

  const declarations: SettingDeclaration[] = ADJUSTMENTS.filter(
    (adjustment) => adjustment.key !== 'sharpness' || writableBeyondBasics,
  ).map((adjustment) => ({
    id: `image-${adjustment.key}`,
    label: adjustment.label,
    // A bounded value with a continuous meaning: a slider **and** a number, to be
    // able to aim and to re-read oneself (ADR-43).
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
        {children}
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

function PilotageSection({ camera }: { camera: Camera }) {
  const { apiBaseUrl, cameras: container } = useAppContainer()
  const systemStats = useRootStore((s) => s.systemStats)

  return (
    <SettingsSection title="Pilotage" lede="Calibration et positions enregistrées.">
      <PtzCalibrationSection
        cameraId={camera.id}
        cameraLabel={camera.displayName}
        apiBaseUrl={apiBaseUrl}
        frigateStatus={systemStats?.status ?? 'active'}
        getPtzPresets={container.getPtzPresets}
        ptzCalibrate={container.ptzCalibrate}
        ptzStep={container.ptzStep}
        ptzGoToPreset={container.ptzGoToPreset}
        ptzSaveCurrentAsPreset={container.ptzSaveCurrentAsPreset}
        capturePtzPresetThumbnail={container.capturePtzPresetThumbnail}
      />
    </SettingsSection>
  )
}
