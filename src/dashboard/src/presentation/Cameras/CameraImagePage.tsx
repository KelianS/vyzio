import { useOutletContext } from 'react-router'
import { SettingsList } from '../../common/settings/SettingsList'
import { SettingsDraftBar } from '../../common/settings/SettingsDraftBar'
import { UnsavedChangesGuard } from '../../common/settings/UnsavedChangesGuard'
import { useSettingsDraft } from '../../common/settings/useSettingsDraft'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraImageSettings, IrCutMode } from '../../domain/entities/CameraImageSettings'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { PtzPresetsSection } from './PtzPresetsSection'

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

export function CameraImagePage() {
  const camera = useOutletContext<Camera>()
  const hasImageSettings = camera.verifiedCapabilities.includes('image_settings')

  return (
    <div className="flex flex-col gap-4">
      {hasImageSettings && <ImageAdjustments camera={camera} />}
      {camera.ptzSupported && <PtzPanel camera={camera} />}
      {!hasImageSettings && !camera.ptzSupported && (
        <SettingsPanel title="Image et pilotage">
          <p className="text-muted-foreground">
            Cette caméra n’expose ni réglages d’image ni pilotage.
          </p>
        </SettingsPanel>
      )}
    </div>
  )
}

function ImageAdjustments({ camera }: { camera: Camera }) {
  const { cameras: container } = useAppContainer()
  const settings = useAsync(() => container.getCameraImageSettings.execute(camera.id), [camera.id])
  const bindings = useAsync(() => container.getCameraCapabilities.execute(camera.id), [camera.id])

  if (settings.loading) return <SettingsPanel title="Image">Chargement…</SettingsPanel>
  if (settings.error || !settings.data) return null

  return (
    <ImageForm
      camera={camera}
      settings={settings.data}
      // La nettete et la vision nocturne ne sont pas confirmees inscriptibles en
      // DVRIP (ADR-29) : mieux vaut ne pas offrir un reglage que la camera
      // ignorerait en silence.
      writableBeyondBasics={
        bindings.data?.find((binding) => binding.capability === 'image_settings')?.protocol !==
        'dvrip'
      }
      reload={settings.reload}
    />
  )
}

function ImageForm({
  camera,
  settings,
  writableBeyondBasics,
  reload,
}: {
  camera: Camera
  settings: CameraImageSettings
  writableBeyondBasics: boolean
  reload: () => void
}) {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()

  const draft = useSettingsDraft<CameraImageSettings>({ saved: settings, labels: DRAFT_LABELS })

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
    // Valeur bornee a sens continu : curseur **et** valeur chiffree, pour
    // pouvoir viser et se relire (ADR-43).
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
      <UnsavedChangesGuard when={draft.dirty} />

      <SettingsPanel title="Image" lede="Ce que la caméra envoie, avant toute analyse.">
        <SettingsList settings={declarations} />
      </SettingsPanel>

      <SettingsDraftBar
        changes={draft.changes}
        // Ces reglages partent directement a la camera : la surveillance n'est
        // pas interrompue.
        interruptsMonitoring={false}
        saving={saving.loading}
        onSave={() => void saving.run()}
        onDiscard={draft.discard}
      />
    </>
  )
}

function PtzPanel({ camera }: { camera: Camera }) {
  const { apiBaseUrl, cameras: container } = useAppContainer()

  return (
    <SettingsPanel title="Pilotage" lede="Positions enregistrées et calibration.">
      <PtzPresetsSection
        cameraId={camera.id}
        apiBaseUrl={apiBaseUrl}
        getPtzPresets={container.getPtzPresets}
        ptzSaveCurrentAsPreset={container.ptzSaveCurrentAsPreset}
        ptzGoToPreset={container.ptzGoToPreset}
        ptzCalibrate={container.ptzCalibrate}
        capturePtzPresetThumbnail={container.capturePtzPresetThumbnail}
      />
    </SettingsPanel>
  )
}
