import type { StateCreator } from 'zustand'

export interface SurveillanceRestartSlice {
  restarting: boolean
  // Persistent: an ephemeral message would let the user believe the settings were taken up (ADR-44).
  restartFailure: string | null
  setRestarting: (restarting: boolean) => void
  setRestartFailure: (failure: string | null) => void
}

// Restarting belongs to no screen, so its state has to survive navigation. State only — the
// trigger lives in presentation, which alone can reach the use cases.
export const createSurveillanceRestartSlice: StateCreator<SurveillanceRestartSlice> = (set) => ({
  restarting: false,
  restartFailure: null,
  setRestarting: (restarting) => set({ restarting }),
  setRestartFailure: (restartFailure) => set({ restartFailure }),
})
