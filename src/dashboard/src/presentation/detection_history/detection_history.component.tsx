import { useEffect, useMemo, useReducer } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronDown, Ellipsis, ListFilter, X } from 'lucide-react'
import { useToast } from '../../common/components/toast'
import { HelpPanel } from '../../common/components/help_panel'
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
import { clipFileName, clipUrl } from '../../common/detection/detection_formatters'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import { buildDetectionHistoryPresenter } from './detection_history.presenter'
import {
  detectionHistoryReducer,
  historyFailureSubject,
  playingClip,
} from './detection_history.reducer'
import { buildInitialDetectionHistoryUido } from './detection_history.uido'
import { FilterSheet } from './components/filter_sheet'
import { ClipActionsSheet, IdentitySheet } from './components/clip_sheets'

const PAGE_SIZE = 20

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

  const camera = cameras.find((known) => known.id === uido.filterCameraId) ?? null
  // A camera named in the address waits for the list that says which one it is.
  const cameraPending = uido.filterCameraId !== '' && camera === null && camerasLoading
  const engineCamera = camera?.frigateCameraName
  const query = useMemo(
    () => ({
      camera: engineCamera,
      label: uido.filterLabel || undefined,
      profileId: uido.filterProfileId || undefined,
      limit: PAGE_SIZE,
    }),
    [engineCamera, uido.filterLabel, uido.filterProfileId],
  )

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => {
    if (!cameraPending) presenter.onLoadHistory(query)
  }, [presenter, query, cameraPending])

  const filters = [
    camera?.displayName,
    uido.profiles.find((profile) => profile.id === uido.filterProfileId)?.name,
    uido.filterLabel &&
      (uido.detectionLabels.find((label) => label.value === uido.filterLabel)?.displayName ??
        uido.filterLabel),
  ].filter((name): name is string => Boolean(name))
  const filtered = filters.length > 0
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
          <p className="ml-1 min-w-0 text-body text-muted-foreground">{filters.join(' · ')}</p>
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
          <ClipPlayer
            event={playing}
            labels={uido.detectionLabels}
            apiBaseUrl={apiBaseUrl}
            clipGone={uido.clipGoneEventId === playing.eventId}
            withCamera
            className="aspect-video w-full rounded-card"
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

          <ClipList
            events={uido.items}
            labels={uido.detectionLabels}
            apiBaseUrl={apiBaseUrl}
            playingId={playing.eventId}
            withCamera
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

      <HelpPanel title="Jusqu’où cette page remonte-t-elle ?">
        <p>
          Exactement aussi loin que votre durée de conservation : passez l’historique de détection à
          trente jours dans <em>Réglages › Conservation</em> et cette page en montrera trente, dès
          que la surveillance a redémarré. Une caméra peut s’en écarter depuis sa propre fiche.
        </p>
        <p>
          Raccourcir la durée fait sortir les détections plus anciennes, avec leur aperçu et leur
          vidéo ; comptez jusqu’à une heure avant que le ménage soit passé. Elle ne peut pas valoir
          zéro : ce serait vider l’historique, pas le raccourcir. Pour ne plus rien enregistrer
          d’une caméra, coupez-la&nbsp;: les vidéos déjà gardées restent jusqu’à la fin de leur
          durée de conservation.
        </p>
        <p>
          Un aperçu qui met quelques secondes à venir juste après une détection est normal : l’image
          est encore en train d’être écrite, et Vyzio réessaie tout seul.
        </p>
      </HelpPanel>

      {uido.sheet === 'filter' && (
        <FilterSheet
          cameras={cameras}
          profiles={uido.profiles}
          labels={uido.detectionLabels}
          cameraId={uido.filterCameraId}
          profileId={uido.filterProfileId}
          label={uido.filterLabel}
          onCamera={presenter.onFilterCamera}
          onProfile={presenter.onFilterProfile}
          onLabel={presenter.onFilterLabel}
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
