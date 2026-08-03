import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { Image, Play, X } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { cn } from '../../common/ui/utils'
import { useToast } from '../../common/components/Toast'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { Profile } from '../../domain/entities/Profile'
import { buildDetectionHistoryPresenter } from './DetectionHistory.Presenter'
import { detectionHistoryReducer } from './DetectionHistory.Reducer'
import { buildInitialDetectionHistoryUido } from './DetectionHistory.Uido'
import { PickOne, UNKNOWN } from './HistoryPickers'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** A detection without an identity isn't anonymous by mistake — it's unknown. */
const UNIDENTIFIED = 'Inconnu'

export function DetectionHistoryView() {
  const { apiBaseUrl, detectionHistory: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    detectionHistoryReducer,
    undefined,
    buildInitialDetectionHistoryUido,
  )
  const presenter = usePresenter(buildDetectionHistoryPresenter, { container, dispatch, toast })

  const query = {
    camera: uido.filterCamera || undefined,
    label: uido.filterLabel || undefined,
    profileId: uido.filterProfileId || undefined,
    from: uido.filterFrom || undefined,
    to: uido.filterTo || undefined,
    page: uido.currentPage,
    limit: 20,
  }

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => {
    presenter.onLoadHistory(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    presenter,
    uido.filterCamera,
    uido.filterLabel,
    uido.filterProfileId,
    uido.filterFrom,
    uido.filterTo,
    uido.currentPage,
  ])

  const filtered = Boolean(
    uido.filterCamera ||
    uido.filterLabel ||
    uido.filterProfileId ||
    uido.filterFrom ||
    uido.filterTo,
  )

  return (
    <main className="flex flex-col gap-4 py-4">
      <div>
        <h1 className="font-serif text-3xl">Historique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uido.page
            ? `${uido.page.total} détection${uido.page.total > 1 ? 's' : ''}${filtered ? ' avec ces filtres' : ''}.`
            : 'Ce que Vyzio a vu, et qui il a cru reconnaître.'}
        </p>
      </div>

      <section
        aria-label="Filtres"
        className="rounded-card bg-card p-4 text-card-foreground shadow-[var(--shadow-soft)]"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Caméra">
            <Input
              value={uido.filterCamera}
              placeholder="Toutes"
              onChange={(event) => presenter.onFilterCameraChange(event.target.value)}
            />
          </Field>

          <Field label="Type">
            <PickOne
              value={uido.filterLabel}
              anyLabel="Tous"
              options={uido.detectionLabels.map((label) => ({
                value: label.value,
                label: `${label.emoji} ${label.displayName}`,
              }))}
              onChange={presenter.onFilterLabelChange}
            />
          </Field>

          <Field label="Personne">
            <PickOne
              value={uido.filterProfileId}
              anyLabel="Toutes"
              options={uido.profiles.map((profile) => ({
                value: profile.id,
                label: profile.name,
              }))}
              onChange={presenter.onFilterProfileChange}
            />
          </Field>

          <Field label="Depuis">
            <Input
              type="datetime-local"
              value={toLocalInput(uido.filterFrom)}
              onChange={(event) => presenter.onFilterFromChange(fromLocalInput(event.target.value))}
            />
          </Field>

          <Field label="Jusqu’à">
            <Input
              type="datetime-local"
              value={toLocalInput(uido.filterTo)}
              onChange={(event) => presenter.onFilterToChange(fromLocalInput(event.target.value))}
            />
          </Field>
        </div>

        {/* Reinitialiser n'existe que s'il y a quelque chose a reinitialiser. */}
        {filtered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={presenter.onResetFilters}
          >
            Tout afficher
          </Button>
        )}
      </section>

      {uido.error && <p className="text-destructive">{uido.error}</p>}

      {uido.loading && <p className="text-muted-foreground">Chargement…</p>}

      {!uido.loading && uido.page && uido.page.items.length === 0 && (
        <p className="rounded-card bg-card p-6 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
          {filtered ? 'Aucune détection avec ces filtres.' : 'Aucune détection pour l’instant.'}
        </p>
      )}

      {!uido.loading && uido.page && uido.page.items.length > 0 && (
        <ul className="divide-y divide-border rounded-card bg-card px-4 text-card-foreground shadow-[var(--shadow-soft)]">
          {uido.page.items.map((event) => (
            <EventRow
              key={event.eventId}
              event={event}
              profiles={uido.profiles}
              apiBaseUrl={apiBaseUrl}
              correcting={uido.correctingEventId === event.eventId}
              onCorrect={(profileId) => presenter.onCorrect(event.eventId, profileId, query)}
              onShowSnapshot={presenter.onSnapshotSet}
            />
          ))}
        </ul>
      )}

      {uido.page && uido.page.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uido.currentPage <= 1}
            onClick={() => presenter.onPageChange(uido.currentPage - 1)}
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {uido.page.page} sur {uido.page.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uido.currentPage >= uido.page.totalPages}
            onClick={() => presenter.onPageChange(uido.currentPage + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      {uido.snapshotUrl && (
        <SnapshotOverlay url={uido.snapshotUrl} onClose={() => presenter.onSnapshotSet(null)} />
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function EventRow({
  event,
  profiles,
  apiBaseUrl,
  correcting,
  onCorrect,
  onShowSnapshot,
}: {
  event: DetectionEvent
  profiles: Profile[]
  apiBaseUrl: string
  correcting: boolean
  onCorrect: (profileId: string | null) => Promise<void>
  onShowSnapshot: (url: string) => void
}) {
  const [fixing, setFixing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pickedProfileId, setPickedProfileId] = useState(event.profileId ?? '')

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{event.identity ?? UNIDENTIFIED}</span>
        <span className="text-sm text-muted-foreground">
          {dateFormatter.format(new Date(event.occurredAt))}
        </span>
      </div>

      {/* Ce que la detection dit d'elle-meme : ou, quoi, et avec quelle
          certitude. La certitude ne se lit que si le moteur en a donne une. */}
      <p className="mt-0.5 text-sm text-muted-foreground">
        {[
          event.camera,
          event.label,
          event.confidence !== null ? `${Math.round(event.confidence * 100)} % de certitude` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {event.hasSnapshot && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onShowSnapshot(`${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`)
            }
          >
            <Image aria-hidden="true" />
            Aperçu
          </Button>
        )}
        {event.hasClip && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPlaying((previous) => !previous)}
          >
            <Play aria-hidden="true" />
            {playing ? 'Masquer la vidéo' : 'Vidéo'}
          </Button>
        )}

        {fixing ? (
          <span className="flex flex-wrap items-center gap-2">
            <PickOne
              value={pickedProfileId}
              anyLabel={UNIDENTIFIED}
              anyValue={UNKNOWN}
              options={profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
              onChange={setPickedProfileId}
            />
            <Button
              type="button"
              size="sm"
              disabled={correcting}
              onClick={async () => {
                await onCorrect(pickedProfileId || null)
                setFixing(false)
              }}
            >
              {correcting ? 'Correction…' : 'Valider'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFixing(false)}>
              Annuler
            </Button>
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFixing(true)}>
            {event.identity ? 'Ce n’est pas elle' : 'Je sais qui c’est'}
          </Button>
        )}
      </div>

      {playing && (
        <video
          src={`${apiBaseUrl}/api/detection-events/${event.eventId}/clip`}
          controls
          preload="metadata"
          className="mt-3 max-h-80 w-full rounded-lg bg-surface-inverse"
        />
      )}
    </li>
  )
}

function SnapshotOverlay({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Aperçu de la détection"
      onClick={onClose}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-surface-inverse/85 backdrop-blur-sm',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fermer"
        className="absolute top-4 right-4 text-surface-inverse-foreground"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </Button>
      <img
        src={url}
        alt=""
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-lg"
      />
    </div>
  )
}

/** `datetime-local` speaks local time with no timezone; the filter stores ISO. */
function toLocalInput(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : ''
}
