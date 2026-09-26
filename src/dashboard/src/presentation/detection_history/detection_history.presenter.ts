import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { DetectionHistoryQuery } from '../../domain/entities/detection_history.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import type { DetectionHistoryContainer } from '../../infrastructure/providers/detection_history.container'
import type { DetectionHistoryAction } from './detection_history.actions'
import type { DetectionMedia } from './detection_history.uido'

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
  }
}
