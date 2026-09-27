import type { AppError } from '../../common/errors/app_error'
import type { ProfilePhoto } from '../../domain/entities/profile_photo.entity'

export interface PersonPhotosUido {
  photos: ProfilePhoto[]
  loading: boolean
  error: AppError | null
  uploading: boolean
  /** The photo the user asked to delete, awaiting confirmation. */
  confirmRemoveId: string | null
  removing: boolean
  confirmResync: boolean
  resyncing: boolean
}

export function buildInitialPersonPhotosUido(): PersonPhotosUido {
  return {
    photos: [],
    loading: true,
    error: null,
    uploading: false,
    confirmRemoveId: null,
    removing: false,
    confirmResync: false,
    resyncing: false,
  }
}
