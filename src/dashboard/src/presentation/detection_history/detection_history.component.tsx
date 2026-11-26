import { useEffect, useMemo, useReducer } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronDown, Ellipsis, ListFilter, X } from 'lucide-react'
import { useToast } from '../../common/components/toast'
import { HelpNotes, HelpQuestion } from '../../common/components/help_notes'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { ReadFailure } from '../../common/components/error_message'
import { PageHeader } from '../../common/components/page_header'
import { PressableControl } from '../../common/components/pressable'
import { SecondaryButton } from '../../common/components/secondary_button'
import { TopBarIconButton } from '../../common/components/top_bar'
import { EmptyState } from '../../common/components/empty_state'
import { Loading } from '../../common/components/loading'
import { ClipList } from '../../common/detection/clip_list'
import { ClipPlayer } from '../../common/detection/clip_player'
import { PLAYER_FRAME, StickyPlayer } from '../../common/detection/sticky_player'
import { clipFileName, clipUrl } from '../../common/detection/detection_formatters'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionHistoryQuery } from '../../domain/entities/detection_history.entity'
import { buildDetectionHistoryPresenter } from './detection_history.presenter'
import {
  detectionHistoryReducer,
  historyFailureSubject,
  playingClip,
} from './detection_history.reducer'
import {
  buildInitialDetectionHistoryUido,
  type DetectionHistoryUido,
} from './detection_history.uido'
import { FilterSheet } from './components/filter_sheet'
import { dayLabel, dayRange, type DayFilter } from './day_filter'
import { ClipActionsSheet, IdentitySheet } from './components/clip_sheets'

const PAGE_SIZE = 20

/** What the page reads: `engineCameras` is the engine's names of the checked cameras, comma-separated. */
function historyQuery(
  engineCameras: string,
  filters: DetectionHistoryUido['filters'],
  day: DayFilter,
): DetectionHistoryQuery {
  return {
    cameras: engineCameras ? engineCameras.split(',') : undefined,
    labels: filters.label,
    profileIds: filters.profile,
    ...dayRange(day, new Date()),
    limit: PAGE_SIZE,
  }
}

/** Saved on this device by the browser, never through a third party (HIST-19). */
function download(apiBaseUrl: string, event: DetectionEvent) {
  const link = document.createElement('a')
  link.href = clipUrl(apiBaseUrl, event.eventId)
  link.download = clipFileName(event)
  link.click()
}

/** The Détections page (HIST-18): the player on top, the clips by day below, one after another. */
export function DetectionHistoryView() {
  const { apiBaseUrl, detectionHistory: container } = useAppContainer()
  const { toast } = useToast()
  const [params] = useSearchParams()
  const cameras = useRootStore((s) => s.cameras)
  const camerasLoading = useRootStore((s) => s.camerasLoading)
  const [uido, dispatch] = useReducer(
    detectionHistoryReducer,
    params.get('camera') ?? '',
    buildInitialDetectionHistoryUido,
  )
  const presenter = usePresenter(buildDetectionHistoryPresenter, { container, dispatch, toast })

  const { filters, filterDay } = uido
  // A key, not the list: a camera list read again must not read the history again.
  const engineCameras = cameras
    .filter((known) => filters.camera.includes(known.id))
    .map((known) => known.frigateCameraName)
    .join(',')
  const query = useMemo(
    () => historyQuery(engineCameras, filters, filterDay),
    [engineCameras, filters, filterDay],
  )
  const checkedCameras = cameras.filter((known) => filters.camera.includes(known.id))
  // A camera named in the address waits for the list that says which one it is.
  const cameraPending = checkedCameras.length < filters.camera.length && camerasLoading

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => {
    if (!cameraPending) presenter.onLoadHistory(query)
  }, [presenter, query, cameraPending])

  const filterNames = [
    checkedCameras.map((known) => known.displayName),
    uido.profiles
      .filter((profile) => filters.profile.includes(profile.id))
      .map((profile) => profile.name),
    filters.label.map(
      (value) => uido.detectionLabels.find((label) => label.value === value)?.displayName ?? value,
    ),
    [dayLabel(filterDay)].filter((name): name is string => name !== null),
  ]
    .filter((names) => names.length > 0)
    .map((names) => names.join(', '))
  const filtered =
    Object.values(filters).some((values) => values.length > 0) || filterDay.kind !== 'any'
  // Filtering an empty history finds nothing: the filter is offered once there is something to sift, or to take back.
  const offersFilter = filtered || uido.items.length > 0
  const playing = playingClip(uido)

  return (
    <main className="flex flex-col gap-5">
      <PageHeader
        title="Détections"
        action={
          offersFilter && (
            <TopBarIconButton
              label="Filtrer"
              icon={ListFilter}
              onClick={() => presenter.onOpenSheet('filter')}
            />
          )
        }
      />

      {filtered && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="ml-1 min-w-0 text-body text-muted-foreground">{filterNames.join(' · ')}</p>
          <SecondaryButton icon={X} type="button" size="sm" onClick={presenter.onResetFilters}>
            Tout afficher
          </SecondaryButton>
        </div>
      )}

      {uido.error ? (
        <ReadFailure
          error={uido.error}
          subject={historyFailureSubject(uido.error)}
          onRetry={() => presenter.onLoadHistory(query)}
        />
      ) : !uido.loaded ? (
        <Loading lines={4} />
      ) : playing === null ? (
        <EmptyState>
          {filtered ? 'Aucune détection avec ces filtres.' : 'Aucune détection pour l’instant.'}
        </EmptyState>
      ) : (
        <>
          <StickyPlayer>
            <ClipPlayer
              event={playing}
              labels={uido.detectionLabels}
              apiBaseUrl={apiBaseUrl}
              clipGone={uido.clipGoneEventId === playing.eventId}
              withCamera
              className={PLAYER_FRAME}
              onVideoError={() => void presenter.onVideoFailed(playing.eventId)}
              onEnded={() => presenter.onClipEnded(playing.eventId)}
            >
              <PressableControl>
                <button
                  type="button"
                  aria-label="Plus d’actions"
                  aria-haspopup="dialog"
                  onClick={() => presenter.onOpenSheet('actions')}
                  className="absolute top-2.5 right-2.5 flex size-11 items-center justify-center rounded-full bg-glass outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Ellipsis className="size-5" aria-hidden="true" />
                </button>
              </PressableControl>
            </ClipPlayer>
          </StickyPlayer>

          <ClipList
            events={uido.items}
            labels={uido.detectionLabels}
            apiBaseUrl={apiBaseUrl}
            playingId={playing.eventId}
            withCamera
            follow={uido.playedOnItsOwn}
            now={new Date()}
            onPlay={(event) => presenter.onPlay(event.eventId)}
          />

          {/* The history is read back in time: a next page has no number. */}
          {uido.nextCursor && (
            <SecondaryButton
              icon={ChevronDown}
              type="button"
              size="sm"
              className="self-center"
              disabled={uido.loadingMore}
              onClick={() => presenter.onLoadMore(query, uido.nextCursor!)}
            >
              {uido.loadingMore ? 'Chargement…' : 'Voir plus ancien'}
            </SecondaryButton>
          )}
        </>
      )}

      <HelpNotes>
        <HelpQuestion title="Jusqu’où cette page remonte-t-elle ?">
          <p>
            Exactement aussi loin que votre durée de conservation : passez l’historique de détection
            à trente jours dans <em>Réglages › Conservation</em> et cette page en montrera trente,
            dès que la surveillance a redémarré. Une caméra peut s’en écarter depuis sa propre
            fiche.
          </p>
          <p>
            Raccourcir la durée fait sortir les détections plus anciennes, avec leur aperçu et leur
            vidéo ; comptez jusqu’à une heure avant que le ménage soit passé. Elle ne peut pas
            valoir zéro : ce serait vider l’historique, pas le raccourcir. Pour ne plus rien
            enregistrer d’une caméra, coupez-la&nbsp;: les vidéos déjà gardées restent jusqu’à la
            fin de leur durée de conservation.
          </p>
          <p>
            Un aperçu qui met quelques secondes à venir juste après une détection est normal :
            l’image est encore en train d’être écrite, et Vyzio réessaie tout seul.
          </p>
        </HelpQuestion>
      </HelpNotes>

      {uido.sheet === 'filter' && (
        <FilterSheet
          cameras={cameras}
          profiles={uido.profiles}
          labels={uido.detectionLabels}
          filters={filters}
          day={filterDay}
          onToggle={presenter.onToggleFilter}
          onClear={presenter.onClearFilter}
          onDay={presenter.onFilterDay}
          onClose={presenter.onCloseSheet}
        />
      )}
      {uido.sheet === 'actions' && playing && (
        <ClipActionsSheet
          event={playing}
          labels={uido.detectionLabels}
          downloadable={
            playing.hasClip && !playing.mediaExpired && uido.clipGoneEventId !== playing.eventId
          }
          onCorrect={() => presenter.onOpenSheet('identity')}
          onDownload={() => {
            download(apiBaseUrl, playing)
            presenter.onCloseSheet()
          }}
          onDelete={() => presenter.onAskDelete(playing.eventId)}
          onClose={presenter.onCloseSheet}
        />
      )}
      {uido.sheet === 'identity' && playing && (
        <IdentitySheet
          event={playing}
          profiles={uido.profiles}
          onPick={(profile) => void presenter.onCorrect(playing.eventId, profile)}
          onClose={presenter.onCloseSheet}
        />
      )}

      {uido.deletingEventId && (
        <ConfirmModal
          title="Supprimer cette détection ?"
          body="La détection et sa vidéo seront effacées."
          confirmLabel="Supprimer"
          tone="danger"
          onConfirm={() => presenter.onDelete(uido.deletingEventId!)}
          onCancel={presenter.onDismissDelete}
        />
      )}
    </main>
  )
}
