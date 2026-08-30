import { AppErrorKind, type AppError } from '../../common/errors/AppError'
import type { DetectionHistoryAction } from './DetectionHistory.Actions'
import type { DetectionHistoryUido } from './DetectionHistory.Uido'

/**
 * Surveillance being stopped and a read failure are not said the same way: without surveillance
 * there is no history at all, and keeping quiet would read as "no detection" (principle #4).
 */
function historyErrorMessage(error: AppError): string {
  return error.kind === AppErrorKind.SurveillanceDown
    ? 'La surveillance ne répond pas : tant qu’elle est arrêtée, il n’y a pas d’historique à afficher.'
    : "Impossible de charger l'historique."
}

/** Changing a filter reads again from the start: a cursor does not outlive the criteria that produced it. */
const REFILTERED: Pick<DetectionHistoryUido, 'items' | 'nextCursor' | 'loaded'> = {
  items: [],
  nextCursor: null,
  loaded: false,
}

export function detectionHistoryReducer(
  state: DetectionHistoryUido,
  action: DetectionHistoryAction,
): DetectionHistoryUido {
  switch (action.type) {
    case 'PROFILES_LOADED':
      return { ...state, profiles: action.profiles }
    case 'LABELS_LOADED':
      return { ...state, detectionLabels: action.labels }

    case 'HISTORY_LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'HISTORY_LOAD_SUCCEEDED':
      return {
        ...state,
        loading: false,
        loaded: true,
        items: action.page.items,
        nextCursor: action.page.nextCursor,
      }
    case 'HISTORY_LOAD_FAILED':
      return { ...state, loading: false, error: historyErrorMessage(action.error) }

    case 'HISTORY_MORE_STARTED':
      return { ...state, loadingMore: true }
    case 'HISTORY_MORE_SUCCEEDED':
      return {
        ...state,
        loadingMore: false,
        items: [...state.items, ...action.page.items],
        nextCursor: action.page.nextCursor,
      }
    case 'HISTORY_MORE_FAILED':
      return { ...state, loadingMore: false }

    case 'FILTER_CAMERA_SET':
      return { ...state, ...REFILTERED, filterCamera: action.value }
    case 'FILTER_LABEL_SET':
      return { ...state, ...REFILTERED, filterLabel: action.value }
    case 'FILTER_PROFILE_SET':
      return { ...state, ...REFILTERED, filterProfileId: action.value }
    case 'FILTER_FROM_SET':
      return { ...state, ...REFILTERED, filterFrom: action.value }
    case 'FILTER_TO_SET':
      return { ...state, ...REFILTERED, filterTo: action.value }
    case 'FILTERS_RESET':
      return {
        ...state,
        ...REFILTERED,
        filterCamera: '',
        filterLabel: '',
        filterProfileId: '',
        filterFrom: '',
        filterTo: '',
      }

    case 'MEDIA_SET':
      return { ...state, media: action.media }
    case 'FILTERS_TOGGLED':
      return { ...state, filtersOpen: !state.filtersOpen }

    case 'CORRECT_STARTED':
      return { ...state, correctingEventId: action.eventId }
    // The correction shows without waiting for the re-read: Frigate takes a few seconds to
    // propagate it, and a screen that does not move suggests the gesture failed (ADR-49).
    case 'CORRECT_SUCCEEDED':
      return {
        ...state,
        correctingEventId: null,
        items: state.items.map((item) =>
          item.eventId === action.eventId
            ? { ...item, identity: action.identity, profileId: action.profileId }
            : item,
        ),
      }
    case 'CORRECT_FAILED':
      return { ...state, correctingEventId: null }
  }
}
