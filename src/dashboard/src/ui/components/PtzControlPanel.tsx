import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PtzStep } from '../../application/use-cases/PtzStep'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import type { PtzPreset } from '../../domain/entities/PtzPreset'

interface PtzControlPanelProps {
  cameraId: string
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  presets?: PtzPreset[]
  speed?: number
  compact?: boolean
}

type Direction = 'Up' | 'Down' | 'Left' | 'Right' | 'UpLeft' | 'UpRight' | 'DownLeft' | 'DownRight'

// Tap: single step of STEP_MS on server (Move → wait → Stop in one HTTP call).
// Hold: once HOLD_THRESHOLD_MS has elapsed, chain repeated step calls until release.
const HOLD_THRESHOLD_MS = 300

const SURVEILLANCE_PRESET = 1

export function PtzControlPanel({
  cameraId,
  ptzStep,
  ptzGoToPreset,
  presets = [],
  speed = 50,
  compact = false,
}: PtzControlPanelProps) {
  const [homeStatus, setHomeStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [gotoLoading, setGotoLoading] = useState<number | null>(null)

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

  const handleReturnToSurveillance = useCallback(async () => {
    setHomeStatus('loading')
    try {
      await ptzGoToPreset.execute(cameraId, SURVEILLANCE_PRESET)
      setHomeStatus('idle')
    } catch {
      setHomeStatus('error')
      setTimeout(() => setHomeStatus('idle'), 3000)
    }
  }, [cameraId, ptzGoToPreset])

  const handleGotoPreset = useCallback(
    async (presetId: number) => {
      setGotoLoading(presetId)
      try {
        await ptzGoToPreset.execute(cameraId, presetId)
      } finally {
        setGotoLoading(null)
      }
    },
    [cameraId, ptzGoToPreset],
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

  const hasSurveillancePreset = presets.some((p) => p.presetId === SURVEILLANCE_PRESET)
  const configuredPresets = presets.filter((p) => p.presetId !== SURVEILLANCE_PRESET)

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
          {hasSurveillancePreset ? (
            <button
              type="button"
              className={`ptz-btn ptz-btn--home${homeStatus === 'loading' ? ' ptz-btn--loading' : ''}`}
              title="Retourner à la position de surveillance"
              onClick={handleReturnToSurveillance}
              disabled={homeStatus === 'loading'}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </button>
          ) : (
            <div className="ptz-btn ptz-btn--placeholder" aria-hidden />
          )}
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

        {homeStatus === 'error' && (
          <p className="ptz-feedback ptz-feedback--error">
            Position non disponible — définissez-la d'abord dans la fiche caméra.
          </p>
        )}
      </div>

      {configuredPresets.length > 0 && (
        <div className="ptz-preset-shortcuts">
          {configuredPresets.map((p) => (
            <button
              key={p.presetId}
              type="button"
              className="ptz-return-btn"
              disabled={gotoLoading !== null}
              onClick={() => handleGotoPreset(p.presetId)}
              title={`Aller à : ${p.label}`}
            >
              {gotoLoading === p.presetId ? '…' : p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
