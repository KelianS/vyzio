import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from 'react'
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { cn } from '../ui/utils'
import { Button } from '../ui/button'
import { useToast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { toAppError } from '../errors/toAppError'
import { appErrorMessage } from '../errors/AppError'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import { PRESET_LABELS, isReservedPreset } from '../../domain/entities/PtzPreset'

const CAPTURE_DELAY_MS = 1500
const ALL_PRESET_IDS = [1, 2, 3, 4]

interface PtzControlPanelProps {
  cameraId: string
  apiBaseUrl: string
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  // Optional: a caller can show the joystick alone, without preset editing.
  getPtzPresets?: GetPtzPresets
  ptzSaveCurrentAsPreset?: PtzSaveCurrentAsPreset
  capturePtzPresetThumbnail?: CapturePtzPresetThumbnail
  ptzCalibrate?: PtzCalibrate
  speed?: number
  compact?: boolean
}

type Direction = 'Up' | 'Down' | 'Left' | 'Right'

const EDGE_POSITION: Record<Direction, string> = {
  Up: 'top-0.5 left-1/2 -translate-x-1/2',
  Down: 'bottom-0.5 left-1/2 -translate-x-1/2',
  Left: 'left-0.5 top-1/2 -translate-y-1/2',
  Right: 'right-0.5 top-1/2 -translate-y-1/2',
}

function DirButton({
  buttonSize,
  edge,
  title,
  children,
  ...handlers
}: {
  buttonSize: string
  edge: 'Up' | 'Down' | 'Left' | 'Right'
  title: string
  children: ReactNode
  onMouseDown: () => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onTouchStart: (e: TouchEvent) => void
  onTouchEnd: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      {...handlers}
      className={cn(
        buttonSize,
        'absolute flex items-center justify-center rounded-full bg-muted text-foreground transition-colors',
        'hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground',
        EDGE_POSITION[edge],
      )}
    >
      {children}
    </button>
  )
}

// Tap: single step of STEP_MS on server (Move → wait → Stop in one HTTP call).
// Hold: once HOLD_THRESHOLD_MS has elapsed, chain repeated step calls until release.
const HOLD_THRESHOLD_MS = 300

// Sur une position deja definie, tap = y aller et appui long = la redefinir : meme debut de geste,
// seule la duree les distingue. Une position vide n'a rien a distinguer, elle s'enregistre au tap.
const LONG_PRESS_MS = 600

function PresetTile({
  preset,
  reserved,
  active,
  thumbSrc,
  thumbLoaded,
  onThumbLoad,
  state,
  editable,
  onGoto,
  onSave,
}: {
  preset: PtzPreset | undefined
  reserved: boolean
  active: boolean
  thumbSrc: string | null
  thumbLoaded: boolean
  onThumbLoad: () => void
  state: 'idle' | 'saving' | 'going'
  editable: boolean
  onGoto: () => void
  onSave: () => void
}) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  function start() {
    if (!editable || !preset) return
    longPressedRef.current = false
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onSave()
    }, LONG_PRESS_MS)
  }

  function end(tap: boolean) {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (!tap || longPressedRef.current) return
    if (preset) onGoto()
    else if (editable) onSave()
  }

  return (
    <button
      type="button"
      disabled={state !== 'idle' || (!preset && !editable)}
      aria-pressed={preset ? active : undefined}
      title={
        preset
          ? `${preset.label} — appui : y aller, appui long : redéfinir ici`
          : editable
            ? 'Enregistrer la position actuelle ici'
            : 'Non définie'
      }
      onMouseDown={start}
      onMouseUp={() => end(true)}
      onMouseLeave={() => end(false)}
      onTouchStart={(e) => {
        e.preventDefault()
        start()
      }}
      onTouchEnd={() => end(true)}
      // L'appui long est notre geste : sans ca le navigateur mobile ouvre son menu par-dessus.
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative size-14 shrink-0 touch-none overflow-hidden rounded-md border bg-muted transition-colors select-none',
        '[-webkit-touch-callout:none]',
        active ? 'border-primary ring-2 ring-primary' : 'border-border',
        'disabled:opacity-60',
      )}
    >
      {preset ? (
        thumbSrc && (
          <img
            key={thumbSrc}
            src={thumbSrc}
            alt=""
            className="size-full object-cover"
            style={thumbLoaded ? undefined : { visibility: 'hidden' }}
            onLoad={onThumbLoad}
            onError={() => {}}
          />
        )
      ) : (
        <Plus className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
      )}
      {reserved && (
        <span
          className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      {state !== 'idle' && (
        <span className="absolute inset-0 flex items-center justify-center bg-surface-inverse/60 text-xs text-surface-inverse-foreground">
          …
        </span>
      )}
    </button>
  )
}

/** La position ou se trouve la camera, quand elle correspond a une position enregistree. */
function matchPreset(
  presets: PtzPreset[],
  position: { x: number; y: number } | null,
): number | null {
  if (!position) return null
  return presets.find((p) => p.stepsX === position.x && p.stepsY === position.y)?.presetId ?? null
}

export function PtzControlPanel({
  cameraId,
  apiBaseUrl,
  ptzStep,
  ptzGoToPreset,
  getPtzPresets,
  ptzSaveCurrentAsPreset,
  speed = 50,
  compact = false,
  capturePtzPresetThumbnail,
  ptzCalibrate,
}: PtzControlPanelProps) {
  const { toast } = useToast()
  const [presets, setPresets] = useState<PtzPreset[]>([])
  const [presetsError, setPresetsError] = useState<string | null>(null)
  const [calibrated, setCalibrated] = useState(true)
  const [calibrating, setCalibrating] = useState(false)
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  const [actionStates, setActionStates] = useState<Record<number, 'idle' | 'saving' | 'going'>>({})
  const [thumbVersions, setThumbVersions] = useState<Record<number, number>>({})
  const [loadedThumbs, setLoadedThumbs] = useState<Record<string, boolean>>({})
  const [overridePresetId, setOverridePresetId] = useState<number | null>(null)

  const isPressedRef = useRef(false)
  const isHoldingRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runStepRef = useRef<((direction: Direction) => void) | null>(null)

  const runStep = useCallback(
    (direction: Direction) => {
      ptzStep
        .execute(cameraId, direction, speed)
        .then(() => {
          if (isHoldingRef.current) runStepRef.current?.(direction) // chain next step while held
        })
        .catch(() => {
          isHoldingRef.current = false
          isPressedRef.current = false
        })
    },
    [cameraId, ptzStep, speed],
  )

  useLayoutEffect(() => {
    runStepRef.current = runStep
  })

  const handlePress = useCallback(
    (direction: Direction) => {
      if (isPressedRef.current) return
      isPressedRef.current = true
      isHoldingRef.current = false
      // Bouger, c'est quitter la position enregistree.
      setActivePresetId(null)

      // Fire the first step immediately (tap behavior).
      ptzStep.execute(cameraId, direction, speed).catch(() => {
        isPressedRef.current = false
      })

      // After HOLD_THRESHOLD_MS, switch to continuous chained mode.
      holdTimerRef.current = setTimeout(() => {
        if (isPressedRef.current) {
          isHoldingRef.current = true
          runStep(direction)
        }
      }, HOLD_THRESHOLD_MS)
    },
    [cameraId, ptzStep, speed, runStep],
  )

  const handleRelease = useCallback(() => {
    if (!isPressedRef.current) return
    isPressedRef.current = false
    isHoldingRef.current = false
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const reloadPresets = useCallback(async () => {
    if (!getPtzPresets) return
    const data = await getPtzPresets.execute(cameraId)
    setPresets(data.presets ?? [])
    setCalibrated(data.calibrated ?? true)
    setActivePresetId(matchPreset(data.presets ?? [], data.currentPosition ?? null))
    setPresetsError(null)
  }, [cameraId, getPtzPresets])

  // Everything runs after the first await, so switching cameras swaps the list without flashing stale data.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!getPtzPresets) return
      try {
        const data = await getPtzPresets.execute(cameraId)
        if (cancelled) return
        setPresets(data.presets ?? [])
        setCalibrated(data.calibrated ?? true)
        setActivePresetId(matchPreset(data.presets ?? [], data.currentPosition ?? null))
        setPresetsError(null)
      } catch (e) {
        if (!cancelled) setPresetsError(appErrorMessage(toAppError(e)))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cameraId, getPtzPresets])

  const scheduleCapture = useCallback(
    (presetId: number) => {
      if (!capturePtzPresetThumbnail) return
      setTimeout(() => {
        capturePtzPresetThumbnail
          .execute(cameraId, presetId)
          .then(() => setThumbVersions((v) => ({ ...v, [presetId]: Date.now() })))
          .catch(() => {})
      }, CAPTURE_DELAY_MS)
    },
    [cameraId, capturePtzPresetThumbnail],
  )

  const presetLabel = useCallback(
    (presetId: number) =>
      presets.find((p) => p.presetId === presetId)?.label ??
      PRESET_LABELS[presetId] ??
      `Position ${presetId}`,
    [presets],
  )

  const handleGoto = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'going' }))
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
        setActivePresetId(presetId)
        // Un deplacement dure : sans accuse, l'appui semble n'avoir rien fait.
        toast(`Caméra en position « ${presetLabel(presetId)} ».`, 'success')
        scheduleCapture(presetId)
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzGoToPreset, presetLabel, scheduleCapture, toast],
  )

  const handleSave = useCallback(
    async (presetId: number) => {
      if (!ptzSaveCurrentAsPreset) return
      setActionStates((s) => ({ ...s, [presetId]: 'saving' }))
      try {
        await ptzSaveCurrentAsPreset.execute(cameraId, presetId)
        toast(`Position « ${presetLabel(presetId)} » enregistrée.`, 'success')
        await reloadPresets()
        setActivePresetId(presetId)
        scheduleCapture(presetId)
      } catch (e) {
        const msg = appErrorMessage(toAppError(e))
        if (msg.includes('not_calibrated') || msg.includes('Conflict')) {
          setCalibrated(false)
          toast('Cette caméra doit d’abord être calibrée.', 'error')
        } else {
          toast(msg, 'error')
        }
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzSaveCurrentAsPreset, presetLabel, reloadPresets, scheduleCapture, toast],
  )

  const handleCalibrate = useCallback(async () => {
    if (!ptzCalibrate) return
    setCalibrating(true)
    try {
      await ptzCalibrate.execute(cameraId)
      await reloadPresets()
      toast('Caméra calibrée — les positions sont de nouveau utilisables.', 'success')
    } catch (e) {
      toast(appErrorMessage(toAppError(e)), 'error')
    } finally {
      setCalibrating(false)
    }
  }, [cameraId, ptzCalibrate, reloadPresets, toast])

  const dir = (d: Direction) => ({
    onMouseDown: () => handlePress(d),
    onMouseUp: handleRelease,
    onMouseLeave: handleRelease,
    onTouchStart: (e: TouchEvent) => {
      e.preventDefault()
      handlePress(d)
    },
    onTouchEnd: handleRelease,
  })

  const buttonSize = compact ? 'size-[34px]' : 'size-10'
  const circleSize = compact ? 'size-[116px]' : 'size-[140px]'

  const overridePreset =
    overridePresetId !== null ? presets.find((p) => p.presetId === overridePresetId) : undefined

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 sm:flex-row sm:items-start',
        compact && 'gap-2.5',
      )}
    >
      <div
        className={cn(
          'relative shrink-0 rounded-full border border-border bg-muted/40',
          circleSize,
        )}
      >
        <div
          className="absolute inset-[30%] rounded-full border-2 border-background/70"
          aria-hidden="true"
        />
        <DirButton buttonSize={buttonSize} edge="Up" title="Haut" {...dir('Up')}>
          <ArrowUp className="size-4" aria-hidden="true" />
        </DirButton>
        <DirButton buttonSize={buttonSize} edge="Left" title="Gauche" {...dir('Left')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
        </DirButton>
        <DirButton buttonSize={buttonSize} edge="Right" title="Droite" {...dir('Right')}>
          <ArrowRight className="size-4" aria-hidden="true" />
        </DirButton>
        <DirButton buttonSize={buttonSize} edge="Down" title="Bas" {...dir('Down')}>
          <ArrowDown className="size-4" aria-hidden="true" />
        </DirButton>
      </div>

      {getPtzPresets && (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:items-start">
          {presetsError && <p className="text-sm text-destructive">{presetsError}</p>}

          {/* Sans reference, la camera ne sait pas ou elle est : les positions sont inertes, et
              c'etait la seule chose que rien ne disait. */}
          {!calibrated && (
            <div className="flex flex-col items-center gap-2 rounded-inset border border-border bg-muted/40 p-2.5 sm:items-start">
              <p className="text-sm text-muted-foreground">
                Cette caméra n’a pas de position de référence : les positions enregistrées ne sont
                pas utilisables tant qu’elle n’est pas calibrée.
              </p>
              {ptzCalibrate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={calibrating}
                  onClick={handleCalibrate}
                >
                  {calibrating ? 'Calibration en cours…' : 'Calibrer maintenant'}
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
            {ALL_PRESET_IDS.map((presetId) => {
              const preset = presets.find((p) => p.presetId === presetId)
              const state = actionStates[presetId] ?? 'idle'
              const version = thumbVersions[presetId] ?? 1
              const thumbKey = `${presetId}:${version}`
              const thumbSrc = preset
                ? `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${version}`
                : null

              return (
                <div key={presetId} className="flex w-16 flex-col items-center gap-1">
                  <PresetTile
                    preset={preset}
                    reserved={isReservedPreset(presetId)}
                    active={activePresetId === presetId}
                    thumbSrc={thumbSrc}
                    thumbLoaded={!!loadedThumbs[thumbKey]}
                    onThumbLoad={() => setLoadedThumbs((v) => ({ ...v, [thumbKey]: true }))}
                    state={state}
                    editable={!!ptzSaveCurrentAsPreset && calibrated}
                    onGoto={() => handleGoto(presetId)}
                    onSave={() => (preset ? setOverridePresetId(presetId) : handleSave(presetId))}
                  />
                  <span
                    className={cn(
                      'w-full text-center text-[11px] leading-tight',
                      activePresetId === presetId
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {presetLabel(presetId)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {overridePreset && (
        <ConfirmModal
          title="Redéfinir cette position ?"
          body={`La position actuelle de la caméra va remplacer celle enregistrée pour « ${overridePreset.label} ».`}
          confirmLabel="Redéfinir"
          tone="warn"
          onConfirm={async () => {
            await handleSave(overridePreset.presetId)
            setOverridePresetId(null)
          }}
          onCancel={() => setOverridePresetId(null)}
        />
      )}
    </div>
  )
}
