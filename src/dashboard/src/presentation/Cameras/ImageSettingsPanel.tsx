import { useState } from 'react'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraImageSettings, IrCutMode } from '../../domain/entities/CameraImageSettings'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { Btn } from '../../common/components/Btn'
import { Select } from '../../common/components/Select'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

interface ImageSettingsPanelProps {
  camera: Camera
  offline?: boolean
}

const IR_CUT_OPTIONS: { value: IrCutMode; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'on', label: 'Vision nocturne activée' },
  { value: 'off', label: 'Vision nocturne désactivée' },
]

const SLIDERS: {
  key: keyof Pick<CameraImageSettings, 'brightness' | 'contrast' | 'saturation' | 'sharpness'>
  label: string
}[] = [
  { key: 'brightness', label: 'Luminosité' },
  { key: 'contrast', label: 'Contraste' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'sharpness', label: 'Netteté' },
]

export function ImageSettingsPanel({ camera, offline }: ImageSettingsPanelProps) {
  const { toast } = useToast()
  const { getCameraCapabilities, getCameraImageSettings, setCameraImageSettings } =
    useAppContainer().cameras
  const {
    data: settings,
    loading,
    error,
  } = useAsync(() => getCameraImageSettings.execute(camera.id), [camera.id], { skip: offline })
  const { data: bindings } = useAsync(() => getCameraCapabilities.execute(camera.id), [camera.id], {
    skip: offline,
  })

  // Sharpness and night-vision mode aren't confirmed writable over DVRIP (ADR-29) — hide those
  // controls rather than let the user tweak something the camera silently ignores.
  const protocol = bindings?.find((b) => b.capability === 'image_settings')?.protocol
  const supportsSharpnessAndIrCut = protocol !== 'dvrip'

  const [draft, setDraft] = useState<CameraImageSettings | null>(null)
  // Baseline the "dirty" check compares against — must track the last value actually applied,
  // not the settings fetched once on mount. Without a separate baseline, saving a change then
  // picking a value equal to the page-load settings made "Appliquer" go disabled again even
  // though it would be a real change from the camera's current (just-applied) state.
  const [baseline, setBaseline] = useState<CameraImageSettings | null>(null)

  // Seeds the editable draft (and its dirty-check baseline) once the fetch resolves, adjusted
  // during render instead of an effect to avoid the extra setState-in-effect render cascade.
  const [prevSettings, setPrevSettings] = useState(settings)
  if (settings !== prevSettings) {
    setPrevSettings(settings)
    if (settings) {
      setDraft(settings)
      setBaseline(settings)
    }
  }

  const saveAction = useAsyncAction(
    (next: CameraImageSettings) => setCameraImageSettings.execute(camera.id, next),
    {
      onSuccess: (applied) => {
        setDraft(applied)
        setBaseline(applied)
        toast('Réglages image appliqués.', 'success')
      },
    },
  )

  if (offline) {
    return (
      <section className="camera-detail-section">
        <h4>Réglages image</h4>
        <p className="camera-inline-state">
          Caméra hors ligne — les réglages image seront disponibles dès que la caméra sera
          joignable.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="camera-detail-section">
        <h4>Réglages image</h4>
        <p className="capability-protocol">Chargement…</p>
      </section>
    )
  }

  if (error || !draft) {
    return (
      <section className="camera-detail-section">
        <h4>Réglages image</h4>
        <p className="camera-inline-state error">Réglages indisponibles pour cette caméra.</p>
      </section>
    )
  }

  const isDirty =
    baseline !== null &&
    (draft.brightness !== baseline.brightness ||
      draft.contrast !== baseline.contrast ||
      draft.saturation !== baseline.saturation ||
      draft.sharpness !== baseline.sharpness ||
      draft.irCutMode !== baseline.irCutMode)

  return (
    <section className="camera-detail-section">
      <h4>Réglages image</h4>

      <div className="image-settings-sliders">
        {SLIDERS.filter(({ key }) => supportsSharpnessAndIrCut || key !== 'sharpness').map(
          ({ key, label }) => (
            <label key={key} className="image-settings-slider">
              <span className="image-settings-slider-label">
                {label}
                <span className="image-settings-slider-value">{draft[key]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={draft[key]}
                disabled={saveAction.loading}
                onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
              />
            </label>
          ),
        )}

        {supportsSharpnessAndIrCut && (
          <label className="image-settings-ircut">
            <span>Vision nocturne</span>
            <Select
              size="sm"
              value={draft.irCutMode}
              disabled={saveAction.loading}
              onChange={(e) => setDraft({ ...draft, irCutMode: e.target.value as IrCutMode })}
            >
              {IR_CUT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        )}

        {!supportsSharpnessAndIrCut && (
          <p className="camera-inline-state" style={{ marginTop: 4 }}>
            Netteté et vision nocturne non disponibles sur ce protocole (DVRIP).
          </p>
        )}
      </div>

      <div className="image-settings-actions">
        <Btn
          variant="secondary"
          size="sm"
          disabled={!isDirty}
          loading={saveAction.loading}
          onClick={() => saveAction.run(draft)}
        >
          Appliquer
        </Btn>
      </div>
    </section>
  )
}
