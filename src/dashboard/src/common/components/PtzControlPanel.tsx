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
import { useToast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { toAppError } from '../errors/toAppError'
import { appErrorMessage } from '../errors/AppError'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
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

// Tap goes to the preset; holding this long redefines it — same gesture start, so timing is what tells them apart.
const LONG_PRESS_MS = 600

function PresetTile({
  preset,
  reserved,
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
    if (!editable) return
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
    if (tap && !longPressedRef.current && preset) onGoto()
  }

  return (
    <button
      type="button"
      disabled={state !== 'idle'}
      title={
        preset
          ? `${preset.label} — appui : y aller, appui long : redéfinir ici`
          : editable
            ? 'Appui long : définir cette position ici'
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
      className={cn(
        'relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted transition-colors',
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
}: PtzControlPanelProps) {
  const { toast } = useToast()
  const [presets, setPresets] = useState<PtzPreset[]>([])
  const [presetsError, setPresetsError] = useState<string | null>(null)
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
    try {
      const data = await getPtzPresets.execute(cameraId)
      setPresets(data.presets ?? [])
      setPresetsError(null)
    } catch (e) {
      setPresetsError(appErrorMessage(toAppError(e)))
    }
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

  const handleGoto = useCallback(
    async (presetId: number) => {
      setActionStates((s) => ({ ...s, [presetId]: 'going' }))
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
        scheduleCapture(presetId)
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzGoToPreset, scheduleCapture, toast],
  )

  const handleSave = useCallback(
    async (presetId: number) => {
      if (!ptzSaveCurrentAsPreset) return
      setActionStates((s) => ({ ...s, [presetId]: 'saving' }))
      try {
        await ptzSaveCurrentAsPreset.execute(cameraId, presetId)
        toast('Position enregistrée.', 'success')
        await reloadPresets()
        scheduleCapture(presetId)
      } catch (e) {
        const msg = appErrorMessage(toAppError(e))
        toast(
          msg.includes('not_calibrated') || msg.includes('Conflict')
            ? "Calibrez d'abord la caméra depuis ses réglages de pilotage."
            : msg,
          'error',
        )
      } finally {
        setActionStates((s) => ({ ...s, [presetId]: 'idle' }))
      }
    },
    [cameraId, ptzSaveCurrentAsPreset, reloadPresets, scheduleCapture, toast],
  )

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

          <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
            {ALL_PRESET_IDS.map((presetId) => {
              const preset = presets.find((p) => p.presetId === presetId)
              const state = actionStates[presetId] ?? 'idle'
              const version = thumbVersions[presetId] ?? 1
              const thumbKey = `${presetId}:${version}`
              const thumbSrc = preset
                ? `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${presetId}/thumbnail?t=${version}`
                : null
              const label = preset?.label ?? PRESET_LABELS[presetId] ?? `Position ${presetId}`

              return (
                <div key={presetId} className="flex w-16 flex-col items-center gap-1">
                  <PresetTile
                    preset={preset}
                    reserved={isReservedPreset(presetId)}
                    thumbSrc={thumbSrc}
                    thumbLoaded={!!loadedThumbs[thumbKey]}
                    onThumbLoad={() => setLoadedThumbs((v) => ({ ...v, [thumbKey]: true }))}
                    state={state}
                    editable={!!ptzSaveCurrentAsPreset}
                    onGoto={() => handleGoto(presetId)}
                    onSave={() => (preset ? setOverridePresetId(presetId) : handleSave(presetId))}
                  />
                  <span className="w-full text-center text-[11px] leading-tight text-muted-foreground">
                    {label}
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
