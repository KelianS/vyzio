import type { StateCreator } from 'zustand'
import type { AppError } from '../../../common/errors/app_error'
import { toAppError } from '../../../common/errors/to_app_error'
import { privacyMissNotice } from '../../../common/privacy/privacy_status'
import type { Camera } from '../../../domain/entities/camera.entity'
import type { GetCameras } from '../../../domain/usecases/get_cameras.use_case'

export interface CamerasSlice {
  cameras: Camera[]
  camerasLoading: boolean
  camerasError: AppError | null
  loadCameras: (getCameras: GetCameras) => Promise<void>
  /** Cameras the user is cutting or resuming: their miss is the act's to tell (PRIV-05). */
  privacyActing: readonly string[]
  /** Misses a toast already told: the bar leaves them out while they last. */
  privacyMissesTold: readonly string[]
  privacyActStarted: (cameraIds: readonly string[]) => void
  privacyActEnded: (cameraIds: readonly string[], toldKeys: readonly string[]) => void
}

/** Cross-screen camera list — shared by Hub, Cameras and the live view instead of each fetching its own copy. */
export const createCamerasSlice: StateCreator<CamerasSlice> = (set) => ({
  cameras: [],
  camerasLoading: true,
  camerasError: null,
  privacyActing: [],
  privacyMissesTold: [],
  loadCameras: async (getCameras) => {
    set({ camerasLoading: true, camerasError: null })
    try {
      const cameras = await getCameras.execute()
      // A miss that ended is forgotten: should it come back, it is news again.
      const current = cameras.map((camera) => privacyMissNotice(camera)?.key)
      set((state) => ({
        cameras,
        camerasLoading: false,
        privacyMissesTold: state.privacyMissesTold.filter((key) => current.includes(key)),
      }))
    } catch (e) {
      set({ camerasError: toAppError(e), camerasLoading: false })
    }
  },
  privacyActStarted: (cameraIds) =>
    set((state) => ({ privacyActing: [...state.privacyActing, ...cameraIds] })),
  privacyActEnded: (cameraIds, toldKeys) =>
    set((state) => ({
      privacyActing: state.privacyActing.filter((id) => !cameraIds.includes(id)),
      privacyMissesTold: [...state.privacyMissesTold, ...toldKeys],
    })),
})
