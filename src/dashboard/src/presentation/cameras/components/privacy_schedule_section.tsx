import { midnightRangeHint } from '../../../common/settings/midnight_range'
import { Button } from '../../../common/ui/button'
import { Input } from '../../../common/ui/input'
import { cn } from '../../../common/ui/utils'
import type { AppError } from '../../../common/errors/app_error'
import { ErrorMessage } from '../../../common/components/error_message'
import type { CameraPrivacySchedule } from '../../../domain/entities/camera_privacy_schedule.entity'
import type { ScheduleForm } from '../camera_privacy.uido'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** A range ending before it starts runs into the next day (SPECS 9.2); an unset time says nothing. */
const endsNextDay = (start: string, end: string) =>
  start !== '' && end !== '' && minutesOf(end) < minutesOf(start)

interface PrivacyScheduleSectionProps {
  schedules: CameraPrivacySchedule[]
  loading: boolean
  form: ScheduleForm
  adding: boolean
  invalid: string | null
  failure: AppError | null
  cameraCount: number
  onToggleDay: (day: number) => void
  onStartTimeChange: (value: string) => void
  onEndTimeChange: (value: string) => void
  onAddHere: () => void
  onAddEverywhere: () => void
  onDelete: (scheduleId: string) => void
}

export function PrivacyScheduleSection({
  schedules,
  loading,
  form,
  adding,
  invalid,
  failure,
  cameraCount,
  onToggleDay,
  onStartTimeChange,
  onEndTimeChange,
  onAddHere,
  onAddEverywhere,
  onDelete,
}: PrivacyScheduleSectionProps) {
  return (
    // No own frame or title: the page already carries them.
    <section className="flex flex-col gap-4">
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
                {endsNextDay(s.startTime, s.endTime) && ' le lendemain'}
              </span>
              {!s.enabled && <span className="text-muted-foreground">désactivé</span>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                title="Supprimer"
                aria-label="Supprimer cette planification"
                onClick={() => onDelete(s.id)}
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
              onClick={() => onToggleDay(d)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                form.days.includes(d)
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
              value={form.startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="w-32"
            />
          </label>
          <span className="text-muted-foreground">→</span>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Fin</span>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="w-32"
            />
          </label>
        </div>

        {endsNextDay(form.startTime, form.endTime) && (
          <p className="text-sm text-muted-foreground">{midnightRangeHint(form.endTime)}</p>
        )}

        {invalid && <p className="text-sm text-destructive">{invalid}</p>}
        {failure && <ErrorMessage error={failure} />}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={adding} onClick={onAddHere}>
            {adding ? 'Ajout…' : 'Ajouter à cette caméra'}
          </Button>
          {cameraCount > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={adding}
              title={`Appliquer cette planification aux ${cameraCount} caméras`}
              onClick={onAddEverywhere}
            >
              {adding ? 'Ajout…' : `Appliquer à toutes (${cameraCount})`}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
