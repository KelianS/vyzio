import { useCallback, useEffect, useState } from 'react'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import { isReservedPreset } from '../../domain/entities/PtzPreset'
import type { GetPtzPresets } from '../../application/use-cases/GetPtzPresets'
import type { PtzSaveCurrentAsPreset } from '../../application/use-cases/PtzSaveCurrentAsPreset'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import type { PtzCalibrate } from '../../application/use-cases/PtzCalibrate'
import type { CapturePtzPresetThumbnail } from '../../application/use-cases/CapturePtzPresetThumbnail'
import { toAppError } from '../../domain/errors/toAppError'
import { appErrorMessage } from '../../domain/errors/AppError'
import { useToast } from './Toast'

const ALL_PRESET_IDS = [1, 2, 3, 4]
const CAPTURE_DELAY_MS = 1500

interface PtzPresetsSectionProps {
  cameraId: string
  apiBaseUrl: string
  getPtzPresets: GetPtzPresets
  ptzSaveCurrentAsPreset: PtzSaveCurrentAsPreset
  ptzGoToPreset: PtzGoToPreset
  ptzCalibrate: PtzCalibrate
  capturePtzPresetThumbnail: CapturePtzPresetThumbnail
}

export function PtzPresetsSection({
  cameraId,
  apiBaseUrl,
  getPtzPresets,
  ptzSaveCurrentAsPreset,
  ptzGoToPreset,
  ptzCalibrate,
  capturePtzPresetThumbnail,
}: PtzPresetsSectionProps) {
  const { toast } = useToast()
  const [presets, setPresets] = useState<PtzPreset[]>([])
  const [calibrated, setCalibrated] = useState(true)
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const [actionStates, setActionStates] = useState<Record<number, 'idle' | 'saving' | 'going'>>({})
  const [thumbVersions, setThumbVersions] = useState<Record<number, number>>({})

  const triggerCapture = useCallback(
    (presetId: number) => {
      setTimeout(() => {
        capturePtzPresetThumbnail
          .execute(cameraId, presetId)
          .then(() => setThumbVersions((v) => ({ ...v, [presetId]: Date.now() })))
          .catch(() => {})
      }, CAPTURE_DELAY_MS)
    },
    [cameraId, capturePtzPresetThumbnail],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPtzPresets.execute(cameraId)
      setPresets(data.presets ?? [])
      setCalibrated(data.calibrated ?? true)
      setCurrentPosition(data.currentPosition ?? null)
    } catch (e) {
      setError(appErrorMessage(toAppError(e)))
    } finally {
      setLoading(false)
    }
  }, [cameraId, getPtzPresets])

  useEffect(() => {
    reload()
  }, [reload])

  const handleCalibrate = useCallback(async () => {
    setCalibrating(true)
    try {
      await ptzCalibrate.execute(cameraId)
      setCalibrated(true)
      setCurrentPosition({ x: 0, y: 0 })
      toast(
        'Calibration terminée — la caméra est à la position 0. Naviguez vers la position souhaitée puis cliquez « Définir ici ».',
        'success',
      )
    } catch (e) {
      toast(appErrorMessage(toAppError(e)), 'error')
    } finally {
      setCalibrating(false)
    }
  }, [cameraId, ptzCalibrate, toast])

  const handleSave = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'saving' }))
      try {
        await ptzSaveCurrentAsPreset.execute(cameraId, presetId)
        toast('Position enregistrée.', 'success')
        await reload()
        triggerCapture(presetId)
      } catch (e) {
        const msg = appErrorMessage(toAppError(e))
        if (msg.includes('not_calibrated') || msg.includes('Conflict')) {
          toast("Calibrez d'abord la caméra avant de définir une position.", 'error')
          setCalibrated(false)
        } else {
          toast(msg, 'error')
        }
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzSaveCurrentAsPreset, reload, toast, triggerCapture],
  )

  const handleGoto = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'going' }))
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
        await reload()
        triggerCapture(presetId)
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzGoToPreset, reload, toast, triggerCapture],
  )

  const getPreset = (presetId: number): PtzPreset | undefined =>
    presets.find((p) => p.presetId === presetId)

  return (
    <div className="camera-detail-section ptz-presets-section">
      <div className="ptz-presets-header">
        <h3 className="ptz-presets-title">Positions</h3>
        {calibrated && currentPosition && (
          <span className="ptz-position-indicator">
            Position actuelle&nbsp;: {currentPosition.x},{currentPosition.y}
          </span>
        )}
      </div>

      {loading && <p className="camera-section-copy" style={{ margin: 0 }}>Chargement…</p>}
      {error && <p className="ptz-presets-error">{error}</p>}

      {!loading && !error && (
        <>
          {!calibrated && (
            <div className="ptz-calibration-banner">
              <p className="ptz-calibration-text">
                Calibrez la caméra pour établir la position de référence (butée mécanique), puis
                naviguez vers la position souhaitée avant de définir un preset.
              </p>
              <button
                type="button"
                className="secondary-cta ptz-calibration-btn"
                disabled={calibrating}
                onClick={handleCalibrate}
              >
                {calibrating ? 'Calibration en cours…' : 'Calibrer (position 0)'}
              </button>
            </div>
          )}

          {calibrated && (
            <p className="camera-section-copy" style={{ margin: 0, fontSize: '0.82rem' }}>
              Orientez la caméra, puis «&nbsp;Définir ici&nbsp;» pour sauvegarder la position.
            </p>
          )}

          <ul className="ptz-presets-list">
            {ALL_PRESET_IDS.map((presetId) => {
              const preset = getPreset(presetId)
              const state = actionStates[presetId] ?? 'idle'
              const reserved = isReservedPreset(presetId)
              const label =
                preset?.label ??
                (presetId === 1 ? 'Surveillance' : presetId === 2 ? 'Parking' : `Position ${presetId}`)

              const thumbSrc = `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${thumbVersions[presetId] ?? 1}`

              return (
                <li key={presetId} className="ptz-preset-row">
                  <div className="ptz-preset-thumb">
                    {preset && (
                      <img
                        key={thumbSrc}
                        src={thumbSrc}
                        alt=""
                        className="ptz-preset-thumb-img"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.visibility = 'hidden'
                        }}
                        onLoad={(e) => {
                          ;(e.target as HTMLImageElement).style.visibility = 'visible'
                        }}
                      />
                    )}
                  </div>
                  <div className="ptz-preset-info">
                    <span className="ptz-preset-label">
                      {label}
                      {reserved && <span className="ptz-preset-badge">réservé</span>}
                    </span>
                    {preset ? (
                      <span className="ptz-preset-status ptz-preset-status--configured">
                        {preset.native ? 'Natif' : `${preset.stepsX ?? 0}, ${preset.stepsY ?? 0} pas`}
                      </span>
                    ) : (
                      <span className="ptz-preset-status">Non défini</span>
                    )}
                  </div>
                  <div className="ptz-preset-actions">
                    {preset && (
                      <button
                        type="button"
                        className="secondary-cta capability-btn"
                        disabled={state !== 'idle'}
                        onClick={() => handleGoto(presetId)}
                      >
                        {state === 'going' ? '…' : 'Aller'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="capability-btn-ghost"
                      disabled={state !== 'idle' || !calibrated}
                      title={!calibrated ? "Calibrez la caméra d'abord" : undefined}
                      onClick={() => handleSave(presetId)}
                    >
                      {state === 'saving' ? '…' : 'Définir ici'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
