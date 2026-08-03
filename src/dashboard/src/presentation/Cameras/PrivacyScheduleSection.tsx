import { useEffect, useState } from 'react'
import { Badge } from '../../common/components/Badge'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { cn } from '../../common/ui/utils'
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

  // All setState calls happen inside the promise, so switching cameras swaps the list in place
  // instead of flashing "Chargement…" over the still-valid previous one.
  useEffect(() => {
    let cancelled = false
    getSchedules
      .execute(cameraId)
      .then((data) => {
        if (!cancelled) setSchedules(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) toast(appErrorMessage(toAppError(e)), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cameraId, getSchedules, toast])

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

  const privacyCut = camera.privacyVendorCut
    ? { text: 'Coupure matérielle confirmée', icon: '🔒' }
    : camera.privacyModeActive && camera.privacyStrategy === 'ptz_parking'
      ? { text: 'Caméra orientée — enregistrement désactivé', icon: '🔇' }
      : camera.privacyModeActive
        ? { text: 'Enregistrement désactivé', icon: '🔇' }
        : null

  return (
    // No own frame or title: the page already carries them.
    <section className="flex flex-col gap-4">
      {privacyCut && (
        <Badge tone={camera.privacyVendorCut ? 'ok' : 'neutral'} className="w-fit">
          {privacyCut.icon} {privacyCut.text}
        </Badge>
      )}

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : schedules.length === 0 ? (
        <p className="text-muted-foreground">Aucune planification configurée.</p>
      ) : (
        <ul className="divide-y divide-border">
          {schedules.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="min-w-0">{s.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}</span>
              <span className="text-muted-foreground">
                {s.startTime} → {s.endTime}
              </span>
              {!s.enabled && <span className="text-muted-foreground">désactivé</span>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                title="Supprimer"
                aria-label="Supprimer cette planification"
                onClick={() => handleDelete(s.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                days.includes(d)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Début</span>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
          </label>
          <span className="text-muted-foreground">→</span>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Fin</span>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-32"
            />
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={adding} onClick={handleAdd}>
            {adding ? 'Ajout…' : 'Ajouter à cette caméra'}
          </Button>
          {allCameras.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={adding}
              title={`Appliquer ce planning aux ${allCameras.length} caméras`}
              onClick={handleApplyToAll}
            >
              {adding ? 'Ajout…' : `Appliquer à toutes (${allCameras.length})`}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
