import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { PersonPhotosAction } from './person_photos.actions'

export interface PersonPhotosPresenterContext {
  container: ProfilesContainer
  dispatch: (action: PersonPhotosAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildPersonPhotosPresenter({
  container,
  dispatch,
  toast,
}: PersonPhotosPresenterContext) {
  // Moving to another person keeps the tab mounted: only the latest read may answer.
  const nextLoad = latestOnly()

  function load(personId: string, galleryShown = false) {
    const isLatest = nextLoad()
    dispatch({ type: 'LOAD_STARTED' })
    container.getProfilePhotos
      .execute(personId)
      .then((photos) => {
        if (isLatest()) dispatch({ type: 'LOAD_SUCCEEDED', photos })
      })
      .catch((e: unknown) => {
        if (!isLatest()) return
        const error = toAppError(e)
        // Under a gallery already shown, it stays and the failure goes to a toast (DESIGN SYSTEM § Errors).
        if (galleryShown) {
          toastError(toast, error)
          dispatch({ type: 'RELOAD_FAILED' })
        } else {
          dispatch({ type: 'LOAD_FAILED', error })
        }
      })
  }

  return {
    onLoad: (personId: string) => load(personId),

    async onUpload(personId: string, file: File) {
      dispatch({ type: 'UPLOAD_STARTED' })
      try {
        await container.addProfilePhoto.execute(personId, file)
        toast('Photo ajoutée.', 'success')
        load(personId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'UPLOAD_FINISHED' })
      }
    },

    onAskRemove(photoId: string) {
      dispatch({ type: 'REMOVE_ASKED', photoId })
    },
    onCancelRemove() {
      dispatch({ type: 'REMOVE_CANCELLED' })
    },
    async onRemove(personId: string, photoId: string) {
      dispatch({ type: 'REMOVE_STARTED' })
      try {
        await container.removeProfilePhoto.execute(personId, photoId)
        toast('Photo supprimée.', 'info')
        load(personId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'REMOVE_FINISHED' })
      }
    },

    onAskResync() {
      dispatch({ type: 'RESYNC_ASKED' })
    },
    onCancelResync() {
      dispatch({ type: 'RESYNC_CANCELLED' })
    },
    async onResync() {
      dispatch({ type: 'RESYNC_STARTED' })
      try {
        const synced = await container.resyncFaceLibrary.execute()
        toast(`${synced} photo(s) reprise(s).`, 'success')
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'RESYNC_FINISHED' })
      }
    },
  }
}
