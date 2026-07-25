import { useEffect, useState } from 'react'
import { Btn } from '../../common/components/Btn'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraPrivacySchedule } from '../../domain/entities/CameraPrivacySchedule'
import type { GetCameraPrivacySchedules } from '../../domain/usecases/GetCameraPrivacySchedules'
import type { CreateCameraPrivacySchedule } from '../../domain/usecases/CreateCameraPrivacySchedule'
import type { DeleteCameraPrivacySchedule } from '../../domain/usecases/DeleteCameraPrivacySchedule'
import { appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import { useToast } from '../../common/components/Toast'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface PrivacyScheduleSectionProps {
  camera: Camera
  cameraId: string
  allCameras: Camera[]
  getSchedules: GetCameraPrivacySchedules
  createSchedule: CreateCameraPrivacySchedule
  deleteSchedule: DeleteCameraPrivacySchedule
}

export function PrivacyScheduleSection({
  camera,
  cameraId,
  allCameras,
  getSchedules,
  createSchedule,
  deleteSchedule,
}: PrivacyScheduleSectionProps) {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<CameraPrivacySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState('22:00')
  const [endTime, setEndTime] = useState('06:00')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    getSchedules
      .execute(cameraId)
      .then(setSchedules)
      .catch((e: unknown) => {
        toast(appErrorMessage(toAppError(e)), 'error')
      })
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect
  useEffect(() => {
    reload()
  }, [cameraId])

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))

  const handleAdd = async () => {
    if (days.length === 0) {
      setError('Sélectionnez au moins un jour.')
      return
    }
    setError(null)
    setAdding(true)
    try {
      await createSchedule.execute(cameraId, { daysOfWeek: days, startTime, endTime })
      reload()
    } catch (e: unknown) {
      setError(appErrorMessage(toAppError(e)))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteSchedule.execute(cameraId, scheduleId)
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    } catch (e: unknown) {
      setError(appErrorMessage(toAppError(e)))
    }
  }

  const handleApplyToAll = async () => {
    if (days.length === 0) {
      setError('Sélectionnez au moins un jour.')
      return
    }
    setError(null)
    setAdding(true)
    try {
      for (const cam of allCameras) {
        await createSchedule.execute(cam.id, { daysOfWeek: days, startTime, endTime })
      }
      reload()
    } catch (e: unknown) {
      setError(appErrorMessage(toAppError(e)))
    } finally {
      setAdding(false)
    }
  }

  const privacyCutLabel = camera.privacyVendorCut
    ? { text: 'Coupure matérielle confirmée', cls: 'privacy-cut-badge--hw' }
    : camera.privacyModeActive && camera.privacyStrategy === 'ptz_parking'
      ? { text: 'Caméra orientée — enregistrement désactivé', cls: 'privacy-cut-badge--sw' }
      : camera.privacyModeActive
        ? { text: 'Enregistrement désactivé', cls: 'privacy-cut-badge--sw' }
        : null

  return (
    <section className="camera-detail-section">
      <h3 className="camera-detail-section-title">Vie privée — planification</h3>

      {privacyCutLabel && (
        <div className={`privacy-cut-badge ${privacyCutLabel.cls}`}>
          {camera.privacyVendorCut ? '🔒' : '🔇'} {privacyCutLabel.text}
        </div>
      )}

      {loading ? (
        <p className="camera-detail-section-loading">Chargement…</p>
      ) : schedules.length === 0 ? (
        <p className="privacy-schedule-empty">Aucune planification configurée.</p>
      ) : (
        <ul className="privacy-schedule-list">
          {schedules.map((s) => (
            <li key={s.id} className="privacy-schedule-item">
              <span className="privacy-schedule-days">
                {s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}
              </span>
              <span className="privacy-schedule-time">
                {s.startTime} → {s.endTime}
              </span>
              {!s.enabled && <span className="privacy-schedule-disabled">désactivé</span>}
              <button
                type="button"
                className="privacy-schedule-delete"
                onClick={() => handleDelete(s.id)}
                title="Supprimer"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="privacy-schedule-form">
        <div className="privacy-schedule-days-row">
          {DAY_LABELS.map((label, d) => (
            <button
              key={d}
              type="button"
              className={`privacy-day-btn${days.includes(d) ? ' privacy-day-btn--on' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="privacy-schedule-time-row">
          <label>
            <span>Début</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <span className="privacy-schedule-arrow">→</span>
          <label>
            <span>Fin</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        {error && <p className="privacy-schedule-error">{error}</p>}
        <div className="privacy-schedule-actions">
          <Btn variant="secondary" size="sm" onClick={handleAdd} loading={adding}>
            Ajouter à cette caméra
          </Btn>
          {allCameras.length > 1 && (
            <Btn
              variant="secondary"
              size="sm"
              onClick={handleApplyToAll}
              loading={adding}
              title={`Appliquer ce schedule aux ${allCameras.length} caméras`}
            >
              Appliquer à toutes ({allCameras.length})
            </Btn>
          )}
        </div>
      </div>
    </section>
  )
}
