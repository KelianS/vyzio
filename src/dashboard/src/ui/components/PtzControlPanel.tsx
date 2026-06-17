import { useCallback, useRef, useState } from 'react'
import type { PtzMove } from '../../application/use-cases/PtzMove'
import type { PtzStop } from '../../application/use-cases/PtzStop'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import type { PtzSavePreset } from '../../application/use-cases/PtzSavePreset'
import type { ConfigurePtzParking } from '../../application/use-cases/ConfigurePtzParking'

interface PtzControlPanelProps {
  cameraId: string
  ptzMove: PtzMove
  ptzStop: PtzStop
  ptzGoToPreset: PtzGoToPreset
  // Only provided in fiche caméra context (not live overlay)
  ptzSavePreset?: PtzSavePreset
  configurePtzParking?: ConfigurePtzParking
  speed?: number
  compact?: boolean
}

type Direction = 'Up' | 'Down' | 'Left' | 'Right' | 'UpLeft' | 'UpRight' | 'DownLeft' | 'DownRight'

// Surveillance position is always stored as preset 1 by convention.
const SURVEILLANCE_PRESET = 1

export function PtzControlPanel({
  cameraId,
  ptzMove,
  ptzStop,
  ptzGoToPreset,
  ptzSavePreset,
  configurePtzParking,
  speed = 50,
  compact = false,
}: PtzControlPanelProps) {
  const [moving, setMoving] = useState(false)
  const [parkingFeedback, setParkingFeedback] = useState<string | null>(null)
  const stopRef = useRef(false)

  const startMove = useCallback(
    async (direction: Direction) => {
      if (moving) return
      setMoving(true)
      stopRef.current = false
      try {
        await ptzMove.execute(cameraId, direction, speed)
      } catch {
        setMoving(false)
      }
    },
    [cameraId, moving, ptzMove, speed],
  )

  const stopMove = useCallback(async () => {
    if (!moving) return
    stopRef.current = true
    setMoving(false)
    try {
      await ptzStop.execute(cameraId)
    } catch {
      // Best-effort; camera may have already stopped.
    }
  }, [cameraId, moving, ptzStop])

  const handleReturnToSurveillance = useCallback(async () => {
    try {
      await ptzGoToPreset.execute(cameraId, SURVEILLANCE_PRESET)
    } catch {
      // Preset may not be configured yet.
    }
  }, [cameraId, ptzGoToPreset])

  const handleSavePosition = useCallback(async () => {
    if (!configurePtzParking) return
    setParkingFeedback(null)
    try {
      await configurePtzParking.execute(cameraId)
      setParkingFeedback('Position de surveillance sauvegardée.')
      setTimeout(() => setParkingFeedback(null), 3000)
    } catch {
      setParkingFeedback('Erreur lors de la sauvegarde.')
    }
  }, [cameraId, configurePtzParking])

  const dir = (d: Direction) => ({
    onMouseDown: () => startMove(d),
    onMouseUp: stopMove,
    onMouseLeave: stopMove,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startMove(d) },
    onTouchEnd: stopMove,
  })

  return (
    <div className={`ptz-panel${compact ? ' ptz-panel--compact' : ''}`}>
      <div className="ptz-grid">
        <button type="button" className="ptz-btn ptz-btn--diag" title="Haut-gauche" {...dir('UpLeft')}>↖</button>
        <button type="button" className="ptz-btn" title="Haut" {...dir('Up')}>↑</button>
        <button type="button" className="ptz-btn ptz-btn--diag" title="Haut-droite" {...dir('UpRight')}>↗</button>

        <button type="button" className="ptz-btn" title="Gauche" {...dir('Left')}>←</button>
        <button
          type="button"
          className="ptz-btn ptz-btn--stop"
          title="Stop"
          onMouseDown={stopMove}
          onTouchStart={(e) => { e.preventDefault(); stopMove() }}
        >
          ■
        </button>
        <button type="button" className="ptz-btn" title="Droite" {...dir('Right')}>→</button>

        <button type="button" className="ptz-btn ptz-btn--diag" title="Bas-gauche" {...dir('DownLeft')}>↙</button>
        <button type="button" className="ptz-btn" title="Bas" {...dir('Down')}>↓</button>
        <button type="button" className="ptz-btn ptz-btn--diag" title="Bas-droite" {...dir('DownRight')}>↘</button>
      </div>

      <div className="ptz-actions">
        <button
          type="button"
          className="ptz-return-btn"
          onClick={handleReturnToSurveillance}
          title="Retourner à la position de surveillance"
        >
          ⌂ Position surveillance
        </button>

        {configurePtzParking && (
          <button
            type="button"
            className="ptz-save-btn"
            onClick={handleSavePosition}
            title="Sauvegarder la position actuelle comme position de surveillance"
          >
            ✓ Définir comme position de surveillance
          </button>
        )}
      </div>

      {parkingFeedback && (
        <p className="ptz-feedback">{parkingFeedback}</p>
      )}
    </div>
  )
}
