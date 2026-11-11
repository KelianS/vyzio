import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, AppErrorKind, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { DetectionHistoryQuery } from '../../domain/entities/detection_history.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import type { DetectionHistoryContainer } from '../../infrastructure/providers/detection_history.container'
import type { DetectionHistoryAction } from './detection_history.actions'
import type { DetectionMedia } from '../../common/detection/detection_preview'
import { explainVideoFailure } from '../../common/detection/explain_video_failure'

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
      dispatch({ type: 'HISTORY_LOAD_STARTED' })
      container.getDetectionHistory
        .execute(query)
        .then((page) => dispatch({ type: 'HISTORY_LOAD_SUCCEEDED', page }))
        .catch((e: unknown) => dispatch({ type: 'HISTORY_LOAD_FAILED', error: toAppError(e) }))
    },

    onLoadMore(query: DetectionHistoryQuery, cursor: string) {
      dispatch({ type: 'HISTORY_MORE_STARTED' })
      container.getDetectionHistory
        .execute({ ...query, cursor })
        .then((page) => dispatch({ type: 'HISTORY_MORE_SUCCEEDED', page }))
        .catch((e: unknown) => {
          dispatch({ type: 'HISTORY_MORE_FAILED' })
          toastError(toast, toAppError(e))
        })
    },

    onFilterCameraChange(value: string) {
      dispatch({ type: 'FILTER_CAMERA_SET', value })
    },
    onFilterLabelChange(value: string) {
      dispatch({ type: 'FILTER_LABEL_SET', value })
    },
    onFilterProfileChange(value: string) {
      dispatch({ type: 'FILTER_PROFILE_SET', value })
    },
    onFilterFromChange(value: string) {
      dispatch({ type: 'FILTER_FROM_SET', value })
    },
    onFilterToChange(value: string) {
      dispatch({ type: 'FILTER_TO_SET', value })
    },
    onResetFilters() {
      dispatch({ type: 'FILTERS_RESET' })
    },
    onMediaSet(media: DetectionMedia | null) {
      dispatch({ type: 'MEDIA_SET', media })
    },
    onFiltersToggle() {
      dispatch({ type: 'FILTERS_TOGGLED' })
    },

    async onCorrect(eventId: string, profile: Profile | null): Promise<void> {
      dispatch({ type: 'CORRECT_STARTED', eventId })
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
        dispatch({ type: 'CORRECT_FAILED' })
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
