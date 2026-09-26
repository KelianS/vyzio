import { act } from '@testing-library/react'
import { appContainer } from '../infrastructure/providers/app.container'
import { useRootStore } from '../infrastructure/store/root.store'

// The app shell reads the camera list for every screen; a screen mounted alone needs it done.
export async function readTheCameraList() {
  await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))
}

// What the header's background poll does, through the same network.
export async function pollTheSurveillance() {
  await act(() => useRootStore.getState().loadSystemStats(appContainer.hub.getSystemStats))
}
