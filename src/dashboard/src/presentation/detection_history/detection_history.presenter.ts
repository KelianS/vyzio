import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, AppErrorKind, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { DetectionHistoryQuery } from '../../domain/entities/detection_history.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import type { DetectionHistoryContainer } from '../../infrastructure/providers/detection_history.container'
import type { DetectionHistoryAction } from './detection_history.actions'
import type { DayFilter } from './day_filter'
import type { DetectionSheet, FilterAxis } from './detection_history.uido'
import { explainVideoFailure } from '../../common/detection/explain_video_failure'
import { latestOnly } from '../../common/presenter/latest_only'

export interface DetectionHistoryPresenterContext {
  container: DetectionHistoryContainer
  dispatch: (action: DetectionHistoryAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildDetectionHistoryPresenter({
  container,
  dispatch,
  toast,
}: DetectionHistoryPresenterContext) {
  // The filter sheet stays open while the list follows: an earlier filter's answer must not land last.
  const nextHistoryRead = latestOnly()
  // The list on screen: an older page read for a list since replaced must not be added to the new one.
  let shownList = 0

  return {
    onMount() {
      container.getProfiles
        .execute()
        .then((profiles) => dispatch({ type: 'PROFILES_LOADED', profiles }))
        .catch((e: unknown) => toastError(toast, toAppError(e)))

      container.getCameraLabels
        .execute()
        .then((labels) => dispatch({ type: 'LABELS_LOADED', labels }))
        .catch((e: unknown) => toastError(toast, toAppError(e)))
    },

    onLoadHistory(query: DetectionHistoryQuery) {
      const isLatest = nextHistoryRead()
      shownList += 1
      dispatch({ type: 'HISTORY_LOAD_STARTED' })
      container.getDetectionHistory
        .execute(query)
        .then((page) => {
          if (isLatest()) dispatch({ type: 'HISTORY_LOAD_SUCCEEDED', page })
        })
        .catch((e: unknown) => {
          if (isLatest()) dispatch({ type: 'HISTORY_LOAD_FAILED', error: toAppError(e) })
        })
    },

    onLoadMore(query: DetectionHistoryQuery, cursor: string) {
      const listOfThisPage = shownList
      const sameList = () => listOfThisPage === shownList
      dispatch({ type: 'HISTORY_MORE_STARTED' })
      container.getDetectionHistory
        .execute({ ...query, cursor })
        .then((page) => {
          if (sameList()) dispatch({ type: 'HISTORY_MORE_SUCCEEDED', page })
        })
        .catch((e: unknown) => {
          if (!sameList()) return
          dispatch({ type: 'HISTORY_MORE_FAILED' })
          toastError(toast, toAppError(e))
        })
    },

    onToggleFilter(axis: FilterAxis, value: string) {
      dispatch({ type: 'FILTER_TOGGLED', axis, value })
    },
    onClearFilter(axis: FilterAxis) {
      dispatch({ type: 'FILTER_CLEARED', axis })
    },
    onFilterDay(day: DayFilter) {
      dispatch({ type: 'FILTER_DAY_SET', day })
    },
    onResetFilters() {
      dispatch({ type: 'FILTERS_RESET' })
    },
    onPlay(eventId: string) {
      dispatch({ type: 'CLIP_PLAYED', eventId })
    },
    onClipEnded(eventId: string) {
      dispatch({ type: 'CLIP_ENDED', eventId })
    },
    onOpenSheet(sheet: DetectionSheet) {
      dispatch({ type: 'SHEET_OPENED', sheet })
    },
    onCloseSheet() {
      dispatch({ type: 'SHEET_CLOSED' })
    },

    async onCorrect(eventId: string, profile: Profile | null): Promise<void> {
      dispatch({ type: 'SHEET_CLOSED' })
      try {
        await container.correctDetectionIdentity.execute(eventId, profile?.id ?? null)
        dispatch({
          type: 'CORRECT_SUCCEEDED',
          eventId,
          identity: profile?.name ?? null,
          profileId: profile?.id ?? null,
        })
        toast(profile ? 'Reconnaissance corrigée' : 'Identité retirée', 'success')
      } catch (e) {
        toastError(toast, toAppError(e), 'La correction de l’identité n’a pas abouti.')
      }
    },

    onAskDelete(eventId: string) {
      dispatch({ type: 'DELETE_ASKED', eventId })
    },
    onDismissDelete() {
      dispatch({ type: 'DELETE_DISMISSED' })
    },

    onVideoFailed(eventId: string): Promise<void> {
      return explainVideoFailure(
        container.checkDetectionClip,
        eventId,
        () => dispatch({ type: 'CLIP_GONE', eventId }),
        toast,
      )
    },

    async onDelete(eventId: string): Promise<void> {
      try {
        await container.deleteDetection.execute(eventId)
        dispatch({ type: 'DELETE_SUCCEEDED', eventId })
        toast('Détection supprimée.', 'info')
      } catch (e) {
        const error = toAppError(e)
        // Already gone is the outcome asked for, said as such, never a failure to retry.
        if (error.kind === AppErrorKind.NotFound) {
          dispatch({ type: 'DELETE_SUCCEEDED', eventId })
          toast('Cette détection n’existe plus.', 'info')
          return
        }
        dispatch({ type: 'DELETE_DISMISSED' })
        // A detection still being filmed is a rule to wait for, not a breakdown to photograph.
        if (
          error.code === ApiErrorCode.DetectionInProgress &&
          error.kind === AppErrorKind.Unknown
        ) {
          toast(error.message, 'info')
          return
        }
        toastError(toast, error, failureSentence(error.code))
      }
    },
  }
}

/** Whether anything is already gone decides what a retry means (HIST-14). */
function failureSentence(code: string | undefined): string | undefined {
  switch (code) {
    case ApiErrorCode.ErasureFailed:
      return 'La surveillance n’a pas pu supprimer cette détection : rien n’a été effacé. Réessayez dans un instant.'
    case ApiErrorCode.ErasureIncomplete:
      return 'La détection n’a été effacée qu’en partie. Réessayez pour terminer.'
    default:
      return undefined
  }
}
