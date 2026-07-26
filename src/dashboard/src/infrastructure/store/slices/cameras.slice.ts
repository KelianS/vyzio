import type { StateCreator } from 'zustand'
import type { AppError } from '../../../common/errors/AppError'
import { toAppError } from '../../../common/errors/toAppError'
import type { Camera } from '../../../domain/entities/Camera'
import type { GetCameras } from '../../../domain/usecases/GetCameras'

export interface CamerasSlice {
  cameras: Camera[]
  camerasLoading: boolean
  camerasError: AppError | null
  loadCameras: (getCameras: GetCameras) => Promise<void>
}

/** Cross-screen camera list — shared by Hub, Cameras and the LiveFeed modal instead of each fetching its own copy. */
export const createCamerasSlice: StateCreator<CamerasSlice> = (set) => ({
  cameras: [],
  camerasLoading: true,
  camerasError: null,
  loadCameras: async (getCameras) => {
    set({ camerasLoading: true, camerasError: null })
    try {
      const cameras = await getCameras.execute()
      set({ cameras, camerasLoading: false })
    } catch (e) {
      set({ camerasError: toAppError(e), camerasLoading: false })
    }
  },
})
