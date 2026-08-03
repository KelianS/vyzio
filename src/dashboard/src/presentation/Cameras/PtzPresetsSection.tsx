import { useCallback, useEffect, useState } from 'react'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import { isReservedPreset } from '../../domain/entities/PtzPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import { toAppError } from '../../common/errors/toAppError'
import { appErrorMessage } from '../../common/errors/AppError'
import { useToast } from '../../common/components/Toast'
import { Badge } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'

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

  // Everything runs after the first await, so switching cameras swaps the list without flashing "Chargement…".
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getPtzPresets.execute(cameraId)
        if (cancelled) return
        setPresets(data.presets ?? [])
        setCalibrated(data.calibrated ?? true)
        setCurrentPosition(data.currentPosition ?? null)
      } catch (e) {
        if (!cancelled) setError(appErrorMessage(toAppError(e)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cameraId, getPtzPresets])

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
    // No own surface: the page provides one already.
    <div className="flex flex-col gap-3">
      {calibrated && currentPosition && (
        <span className="text-sm text-muted-foreground">
          Position actuelle : {currentPosition.x}, {currentPosition.y}
        </span>
      )}

      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {!calibrated && (
            <div className="flex flex-col gap-2 rounded-inset border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Calibrez la caméra pour établir la position de référence (butée mécanique), puis
                naviguez vers la position souhaitée avant de définir un preset.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={calibrating}
                onClick={handleCalibrate}
              >
                {calibrating ? 'Calibration en cours…' : 'Calibrer (position 0)'}
              </Button>
            </div>
          )}

          {calibrated && (
            <p className="text-sm text-muted-foreground">
              Orientez la caméra, puis « Définir ici » pour sauvegarder la position.
            </p>
          )}

          <ul className="divide-y divide-border">
            {ALL_PRESET_IDS.map((presetId) => {
              const preset = getPreset(presetId)
              const state = actionStates[presetId] ?? 'idle'
              const reserved = isReservedPreset(presetId)
              const label =
                preset?.label ??
                (presetId === 1
                  ? 'Surveillance'
                  : presetId === 2
                    ? 'Parking'
                    : `Position ${presetId}`)

              const thumbSrc = `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${thumbVersions[presetId] ?? 1}`

              return (
                <li key={presetId} className="flex items-center gap-3 py-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {preset && (
                      <img
                        key={thumbSrc}
                        src={thumbSrc}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden'
                        }}
                        onLoad={(e) => {
                          e.currentTarget.style.visibility = 'visible'
                        }}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      {label}
                      {reserved && <Badge tone="neutral">réservé</Badge>}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {preset
                        ? preset.native
                          ? 'Natif'
                          : `${preset.stepsX ?? 0}, ${preset.stepsY ?? 0} pas`
                        : 'Non défini'}
                    </span>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {preset && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={state !== 'idle'}
                        onClick={() => handleGoto(presetId)}
                      >
                        {state === 'going' ? '…' : 'Aller'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={state !== 'idle' || !calibrated}
                      title={!calibrated ? "Calibrez la caméra d'abord" : undefined}
                      onClick={() => handleSave(presetId)}
                    >
                      {state === 'saving' ? '…' : 'Définir ici'}
                    </Button>
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
