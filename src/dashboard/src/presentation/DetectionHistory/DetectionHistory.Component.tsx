import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { SlidersHorizontal, UserRoundPen } from 'lucide-react'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { useToast } from '../../common/components/Toast'
import { HelpPanel } from '../../common/components/HelpPanel'
import { Overlay } from '../../common/components/Overlay'
import { DetectionList } from '../../common/detection/DetectionList'
import { carriesIdentity } from '../../common/detection/detectionFormatters'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { Profile } from '../../domain/entities/Profile'
import { buildDetectionHistoryPresenter } from './DetectionHistory.Presenter'
import { detectionHistoryReducer } from './DetectionHistory.Reducer'
import { buildInitialDetectionHistoryUido } from './DetectionHistory.Uido'
import { PickOne, UNKNOWN } from './HistoryPickers'

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl">Historique</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce que Vyzio a vu, et qui il a cru reconnaître.
          </p>
        </div>

        {/* Filtrer est une option qu'on ouvre, pas le haut de l'ecran : ce qu'on vient lire ici,
            ce sont les detections. */}
        <Button
          type="button"
          variant={uido.filtersOpen || filtered ? 'default' : 'outline'}
          size="sm"
          aria-expanded={uido.filtersOpen}
          aria-controls="history-filters"
          onClick={presenter.onFiltersToggle}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filtrer
        </Button>
      </div>

      {uido.filtersOpen && (
        <section
          id="history-filters"
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
                onChange={(event) =>
                  presenter.onFilterFromChange(fromLocalInput(event.target.value))
                }
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
      )}

      {uido.error && <p className="text-destructive">{uido.error}</p>}

      {uido.loading && <p className="text-muted-foreground">Chargement…</p>}

      {!uido.loading && uido.loaded && uido.items.length === 0 && (
        <p className="rounded-card bg-card p-6 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
          {filtered ? 'Aucune détection avec ces filtres.' : 'Aucune détection pour l’instant.'}
        </p>
      )}

      {!uido.loading && uido.items.length > 0 && (
        <div className="rounded-card bg-card px-4 py-2 text-card-foreground shadow-[var(--shadow-soft)]">
          <DetectionList
            events={uido.items}
            apiBaseUrl={apiBaseUrl}
            onOpenMedia={(type, url) => presenter.onMediaSet({ type, url })}
            renderExtra={(event) =>
              carriesIdentity(event) && (
                <IdentityCorrection
                  event={event}
                  profiles={uido.profiles}
                  correcting={uido.correctingEventId === event.eventId}
                  onCorrect={(profile) => presenter.onCorrect(event.eventId, profile)}
                />
              )
            }
          />
        </div>
      )}

      {/* L'historique se parcourt en remontant le temps : une page suivante n'a pas de numero. */}
      {!uido.loading && uido.nextCursor && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uido.loadingMore}
            onClick={() => presenter.onLoadMore(query, uido.nextCursor!)}
          >
            {uido.loadingMore ? 'Chargement…' : 'Voir plus ancien'}
          </Button>
        </div>
      )}

      <HelpPanel title="Jusqu’où cette page remonte-t-elle ?">
        <p>
          Exactement aussi loin que votre durée de conservation : passez l’historique de détection à
          trente jours dans <em>Réglages › Conservation</em> et cette page en montrera trente, dès
          que la surveillance a redémarré. Une caméra peut s’en écarter depuis sa propre fiche.
        </p>
        <p>
          Raccourcir la durée fait sortir les détections plus anciennes, avec leur aperçu et leur
          vidéo ; comptez jusqu’à une heure avant que le ménage soit passé. Elle ne peut pas valoir
          zéro : ce serait vider l’historique, pas le raccourcir — pour ne rien conserver d’une
          caméra, désactivez-la.
        </p>
        <p>
          Un aperçu qui met quelques secondes à venir juste après une détection est normal : l’image
          est encore en train d’être écrite, et Vyzio réessaie tout seul.
        </p>
      </HelpPanel>

      {uido.media && (
        <Overlay label="Aperçu de la détection" onClose={() => presenter.onMediaSet(null)}>
          {uido.media.type === 'image' ? (
            <img src={uido.media.url} alt="" className="max-h-[85vh] rounded-lg" />
          ) : (
            <video src={uido.media.url} controls autoPlay className="max-h-[85vh] rounded-lg" />
          )}
        </Overlay>
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

/** What the history adds to a detection row: saying who it really was. */
function IdentityCorrection({
  event,
  profiles,
  correcting,
  onCorrect,
}: {
  event: DetectionEvent
  profiles: Profile[]
  correcting: boolean
  onCorrect: (profile: Profile | null) => Promise<void>
}) {
  const [fixing, setFixing] = useState(false)
  const [pickedProfileId, setPickedProfileId] = useState(event.profileId ?? '')

  if (!fixing) {
    return (
      // `ghost` did not pass for a button, sitting under a line of grey text.
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1.5"
        onClick={() => setFixing(true)}
      >
        <UserRoundPen aria-hidden="true" />
        {event.identity ? 'Corriger' : 'Identifier'}
      </Button>
    )
  }

  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
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
          await onCorrect(profiles.find((profile) => profile.id === pickedProfileId) ?? null)
          setFixing(false)
        }}
      >
        {correcting ? 'Correction…' : 'Valider'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setFixing(false)}>
        Annuler
      </Button>
    </span>
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
