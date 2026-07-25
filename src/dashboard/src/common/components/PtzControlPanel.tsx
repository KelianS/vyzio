import { useCallback, useLayoutEffect, useRef, useState } from 'react'
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
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      handlePress(d)
    },
    onTouchEnd: handleRelease,
  })

  return (
    <div className={`ptz-panel${compact ? ' ptz-panel--compact' : ''}`}>
      <div className="ptz-panel-inner">
        <div className="ptz-grid">
          <button
            type="button"
            className="ptz-btn ptz-btn--diag"
            title="Haut-gauche"
            {...dir('UpLeft')}
          >
            ↖
          </button>
          <button type="button" className="ptz-btn" title="Haut" {...dir('Up')}>
            ↑
          </button>
          <button
            type="button"
            className="ptz-btn ptz-btn--diag"
            title="Haut-droite"
            {...dir('UpRight')}
          >
            ↗
          </button>

          <button type="button" className="ptz-btn" title="Gauche" {...dir('Left')}>
            ←
          </button>
          <div className="ptz-btn ptz-btn--placeholder" aria-hidden />
          <button type="button" className="ptz-btn" title="Droite" {...dir('Right')}>
            →
          </button>

          <button
            type="button"
            className="ptz-btn ptz-btn--diag"
            title="Bas-gauche"
            {...dir('DownLeft')}
          >
            ↙
          </button>
          <button type="button" className="ptz-btn" title="Bas" {...dir('Down')}>
            ↓
          </button>
          <button
            type="button"
            className="ptz-btn ptz-btn--diag"
            title="Bas-droite"
            {...dir('DownRight')}
          >
            ↘
          </button>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="ptz-preset-shortcuts">
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
                className="ptz-return-btn"
                disabled={gotoLoading !== null}
                onClick={() => handleGotoPreset(p.presetId)}
                title={`Aller à : ${p.label}`}
              >
                {thumbSrc && (
                  <img
                    key={thumbSrc}
                    src={thumbSrc}
                    alt=""
                    className="ptz-shortcut-thumb"
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
