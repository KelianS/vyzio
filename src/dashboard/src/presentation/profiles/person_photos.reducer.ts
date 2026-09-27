import type { PersonPhotosAction } from './person_photos.actions'
import type { PersonPhotosUido } from './person_photos.uido'

export function personPhotosReducer(
  state: PersonPhotosUido,
  action: PersonPhotosAction,
): PersonPhotosUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, photos: action.photos }
    case 'LOAD_FAILED':
      return { ...state, loading: false, photos: [], error: action.error }
    case 'RELOAD_FAILED':
      return { ...state, loading: false }

    case 'UPLOAD_STARTED':
      return { ...state, uploading: true }
    case 'UPLOAD_FINISHED':
      return { ...state, uploading: false }

    case 'REMOVE_ASKED':
      return { ...state, confirmRemoveId: action.photoId }
    case 'REMOVE_CANCELLED':
      return { ...state, confirmRemoveId: null }
    case 'REMOVE_STARTED':
      return { ...state, removing: true }
    // Success or failure, the question has been answered.
    case 'REMOVE_FINISHED':
      return { ...state, removing: false, confirmRemoveId: null }

    case 'RESYNC_ASKED':
      return { ...state, confirmResync: true }
    case 'RESYNC_CANCELLED':
      return { ...state, confirmResync: false }
    case 'RESYNC_STARTED':
      return { ...state, resyncing: true }
    case 'RESYNC_FINISHED':
      return { ...state, resyncing: false, confirmResync: false }
  }
}
