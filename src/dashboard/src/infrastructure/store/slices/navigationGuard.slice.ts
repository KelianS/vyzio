import type { StateCreator } from 'zustand'

export interface NavigationGuardSlice {
  // The open page has edits worth confirming before leaving (ADR-41).
  unsavedChanges: boolean
  setUnsavedChanges: (unsaved: boolean) => void
}

// Held in the store because react-router allows a single blocker: the one guard that owns it needs
// to see the open page's draft state without being that page.
export const createNavigationGuardSlice: StateCreator<NavigationGuardSlice> = (set) => ({
  unsavedChanges: false,
  setUnsavedChanges: (unsavedChanges) => set({ unsavedChanges }),
})
