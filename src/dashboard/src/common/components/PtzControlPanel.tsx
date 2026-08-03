import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from 'react'
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../ui/utils'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'

const CAPTURE_DELAY_MS = 1500

interface PtzControlPanelProps {
  cameraId: string
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  presets?: PtzPreset[]
  speed?: number
  compact?: boolean
  capturePtzPresetThumbnail?: CapturePtzPresetThumbnail
  apiBaseUrl?: string
}

type Direction = 'Up' | 'Down' | 'Left' | 'Right' | 'UpLeft' | 'UpRight' | 'DownLeft' | 'DownRight'

function DirButton({
  cellSize,
  diagonal,
  title,
  children,
  ...handlers
}: {
  cellSize: string
  diagonal?: boolean
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
        cellSize,
        'flex items-center justify-center rounded-none bg-muted text-foreground transition-colors',
        'hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground',
        diagonal && 'text-xs opacity-75',
      )}
    >
      {children}
    </button>
  )
}

// Tap: single step of STEP_MS on server (Move → wait → Stop in one HTTP call).
// Hold: once HOLD_THRESHOLD_MS has elapsed, chain repeated step calls until release.
const HOLD_THRESHOLD_MS = 300

export function PtzControlPanel({
  cameraId,
  ptzStep,
  ptzGoToPreset,
  presets = [],
  speed = 50,
  compact = false,
  capturePtzPresetThumbnail,
  apiBaseUrl,
}: PtzControlPanelProps) {
  const [gotoLoading, setGotoLoading] = useState<number | null>(null)
  const [thumbVersions, setThumbVersions] = useState<Record<number, number>>({})
  const [loadedThumbs, setLoadedThumbs] = useState<Record<string, boolean>>({})

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

  const handleGotoPreset = useCallback(
    async (presetId: number) => {
      setGotoLoading(presetId)
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
        scheduleCapture(presetId)
      } finally {
        setGotoLoading(null)
      }
    },
    [cameraId, ptzGoToPreset, scheduleCapture],
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

  const cellSize = compact ? 'size-[34px]' : 'size-10'

  return (
    <div className={cn('flex items-center gap-2.5', compact && 'gap-1.5')}>
      <div className={cn('grid overflow-hidden rounded-md', 'grid-cols-3 grid-rows-3')}>
        <DirButton cellSize={cellSize} diagonal title="Haut-gauche" {...dir('UpLeft')}>
          ↖
        </DirButton>
        <DirButton cellSize={cellSize} title="Haut" {...dir('Up')}>
          <ArrowUp className="size-4" aria-hidden="true" />
        </DirButton>
        <DirButton cellSize={cellSize} diagonal title="Haut-droite" {...dir('UpRight')}>
          ↗
        </DirButton>

        <DirButton cellSize={cellSize} title="Gauche" {...dir('Left')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
        </DirButton>
        <div className={cn(cellSize, 'pointer-events-none bg-transparent')} aria-hidden="true" />
        <DirButton cellSize={cellSize} title="Droite" {...dir('Right')}>
          <ArrowRight className="size-4" aria-hidden="true" />
        </DirButton>

        <DirButton cellSize={cellSize} diagonal title="Bas-gauche" {...dir('DownLeft')}>
          ↙
        </DirButton>
        <DirButton cellSize={cellSize} title="Bas" {...dir('Down')}>
          <ArrowDown className="size-4" aria-hidden="true" />
        </DirButton>
        <DirButton cellSize={cellSize} diagonal title="Bas-droite" {...dir('DownRight')}>
          ↘
        </DirButton>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap content-start gap-1.5">
          {presets.map((p) => {
            const version = thumbVersions[p.presetId] ?? 1
            const thumbKey = `${p.presetId}:${version}`
            const thumbSrc =
              apiBaseUrl !== undefined
                ? `${apiBaseUrl}/api/cameras/${cameraId}/ptz/presets/${p.presetId}/thumbnail?t=${version}`
                : null
            const thumbLoaded = !!loadedThumbs[thumbKey]

            return (
              <button
                key={p.presetId}
                type="button"
                disabled={gotoLoading !== null}
                onClick={() => handleGotoPreset(p.presetId)}
                title={`Aller à : ${p.label}`}
                className="flex flex-col items-start gap-0.5 rounded-sm border border-border bg-muted px-2.5 py-1 text-left text-xs text-foreground hover:bg-muted/70 disabled:opacity-50"
              >
                {thumbSrc && (
                  <img
                    key={thumbSrc}
                    src={thumbSrc}
                    alt=""
                    className="block h-[42px] w-full rounded-xs object-cover"
                    style={thumbLoaded ? undefined : { height: 0 }}
                    onLoad={() => setLoadedThumbs((v) => ({ ...v, [thumbKey]: true }))}
                    onError={() => {}}
                  />
                )}
                {gotoLoading === p.presetId ? '…' : p.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
