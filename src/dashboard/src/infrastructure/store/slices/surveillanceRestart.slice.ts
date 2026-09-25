import type { StateCreator } from 'zustand'

/** Its sentence, and the diagnostic line when a call failed (SPECS 1.5). */
interface RestartFailure {
  message: string
  diagnostic?: string
}

export interface SurveillanceRestartSlice {
  restarting: boolean
  // Persistent: an ephemeral message would let the user believe the settings were taken up (ADR-44).
  restartFailure: RestartFailure | null
  setRestarting: (restarting: boolean) => void
  setRestartFailure: (failure: RestartFailure | null) => void
}

// Restarting belongs to no screen, so its state has to survive navigation. State only — the
// trigger lives in presentation, which alone can reach the use cases.
export const createSurveillanceRestartSlice: StateCreator<SurveillanceRestartSlice> = (set) => ({
  restarting: false,
  restartFailure: null,
  setRestarting: (restarting) => set({ restarting }),
  setRestartFailure: (restartFailure) => set({ restartFailure }),
})
