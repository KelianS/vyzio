import { useCallback, useEffect, useState } from 'react'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import { isReservedPreset } from '../../domain/entities/PtzPreset'
import type { GetPtzPresets } from '../../application/use-cases/GetPtzPresets'
import type { PtzSaveCurrentAsPreset } from '../../application/use-cases/PtzSaveCurrentAsPreset'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import { toAppError } from '../../domain/errors/toAppError'
import { appErrorMessage } from '../../domain/errors/AppError'
import { useToast } from './Toast'

const ALL_PRESET_IDS = [1, 2, 3, 4]

interface PtzPresetsSectionProps {
  cameraId: string
  getPtzPresets: GetPtzPresets
  ptzSaveCurrentAsPreset: PtzSaveCurrentAsPreset
  ptzGoToPreset: PtzGoToPreset
}

export function PtzPresetsSection({
  cameraId,
  getPtzPresets,
  ptzSaveCurrentAsPreset,
  ptzGoToPreset,
}: PtzPresetsSectionProps) {
  const { toast } = useToast()
  const [presets, setPresets] = useState<PtzPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionStates, setActionStates] = useState<Record<number, 'idle' | 'saving' | 'going'>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPtzPresets.execute(cameraId)
      setPresets(data)
    } catch (e) {
      setError(appErrorMessage(toAppError(e)))
    } finally {
      setLoading(false)
    }
  }, [cameraId, getPtzPresets])

  useEffect(() => {
    reload()
  }, [reload])

  const handleSave = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'saving' }))
      try {
        await ptzSaveCurrentAsPreset.execute(cameraId, presetId)
        toast('Position enregistrée.', 'success')
        await reload()
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzSaveCurrentAsPreset, reload, toast],
  )

  const handleGoto = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'going' }))
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzGoToPreset, toast],
  )

  const getPreset = (presetId: number): PtzPreset | undefined =>
    presets.find((p) => p.presetId === presetId)

  if (loading) return <p className="ptz-presets-loading">Chargement des positions…</p>
  if (error) return <p className="ptz-presets-error">{error}</p>

  return (
    <div className="ptz-presets-section">
      <h4 className="ptz-presets-title">Positions PTZ</h4>
      <p className="ptz-presets-hint">
        Orientez la caméra avec le joystick, puis cliquez «&nbsp;Définir ici&nbsp;» pour sauvegarder
        la position.
      </p>
      <ul className="ptz-presets-list">
        {ALL_PRESET_IDS.map((presetId) => {
          const preset = getPreset(presetId)
          const state = actionStates[presetId] ?? 'idle'
          const reserved = isReservedPreset(presetId)
          const label = preset?.label ?? (presetId <= 2 ? (presetId === 1 ? 'Surveillance' : 'Parking') : `Position ${presetId}`)

          return (
            <li key={presetId} className="ptz-preset-row">
              <div className="ptz-preset-info">
                <span className="ptz-preset-label">
                  {label}
                  {reserved && <span className="ptz-preset-badge">réservé</span>}
                </span>
                {preset ? (
                  <span className="ptz-preset-status ptz-preset-status--configured">
                    {preset.native ? 'Preset natif' : `(${preset.stepsX ?? 0}, ${preset.stepsY ?? 0}) pas`}
                  </span>
                ) : (
                  <span className="ptz-preset-status ptz-preset-status--empty">Non défini</span>
                )}
              </div>
              <div className="ptz-preset-actions">
                {preset && (
                  <button
                    type="button"
                    className="ptz-preset-btn ptz-preset-btn--goto"
                    disabled={state !== 'idle'}
                    onClick={() => handleGoto(presetId)}
                  >
                    {state === 'going' ? '…' : 'Aller'}
                  </button>
                )}
                <button
                  type="button"
                  className="ptz-preset-btn ptz-preset-btn--save"
                  disabled={state !== 'idle'}
                  onClick={() => handleSave(presetId)}
                >
                  {state === 'saving' ? '…' : 'Définir ici'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
