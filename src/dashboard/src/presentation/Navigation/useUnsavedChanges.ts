import { useEffect } from 'react'
import { useRootStore } from '../../infrastructure/store/rootStore'

/**
 * Declares that a page carries unsaved changes.
 *
 * The page does not block by itself: it **signals**, and `NavigationGuard` draws
 * the consequences. That is what keeps a single block in the application, where
 * react-router accepts only one.
 */
export function useUnsavedChanges(dirty: boolean) {
  const setUnsavedChanges = useRootStore((state) => state.setUnsavedChanges)

  useEffect(() => {
    setUnsavedChanges(dirty)
    return () => setUnsavedChanges(false)
  }, [dirty, setUnsavedChanges])

  useEffect(() => {
    if (!dirty) return
    // Closing the tab or reloading: the browser allows a generic warning only,
    // and that is all that is possible.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
