import type { DetectionHistoryAction } from './DetectionHistory.Actions'
import type { DetectionHistoryUido } from './DetectionHistory.Uido'

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
      return { ...state, loading: false, page: action.page }
    case 'HISTORY_LOAD_FAILED':
      return { ...state, loading: false, error: "Impossible de charger l'historique." }

    case 'FILTER_CAMERA_SET':
      return { ...state, filterCamera: action.value, currentPage: 1 }
    case 'FILTER_LABEL_SET':
      return { ...state, filterLabel: action.value, currentPage: 1 }
    case 'FILTER_PROFILE_SET':
      return { ...state, filterProfileId: action.value, currentPage: 1 }
    case 'FILTER_FROM_SET':
      return { ...state, filterFrom: action.value, currentPage: 1 }
    case 'FILTER_TO_SET':
      return { ...state, filterTo: action.value, currentPage: 1 }
    case 'FILTERS_RESET':
      return {
        ...state,
        filterCamera: '',
        filterLabel: '',
        filterProfileId: '',
        filterFrom: '',
        filterTo: '',
        currentPage: 1,
      }
    case 'PAGE_SET':
      return { ...state, currentPage: action.page }

    case 'MEDIA_SET':
      return { ...state, media: action.media }
    case 'FILTERS_TOGGLED':
      return { ...state, filtersOpen: !state.filtersOpen }

    case 'CORRECT_STARTED':
      return { ...state, correctingEventId: action.eventId }
    case 'CORRECT_SUCCEEDED':
      return { ...state, correctingEventId: null, page: action.page }
    case 'CORRECT_FAILED':
      return { ...state, correctingEventId: null }
  }
}
