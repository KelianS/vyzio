import { useEffect } from 'react'
import { useRootStore } from '../../infrastructure/store/rootStore'

/**
 * Declare qu'une page porte des modifications non enregistrees.
 *
 * La page ne bloque pas elle-meme : elle le **signale**, et `NavigationGuard`
 * en tire les consequences. C'est ce qui garde un seul blocage dans
 * l'application, la ou react-router n'en accepte qu'un.
 */
export function useUnsavedChanges(dirty: boolean) {
  const setUnsavedChanges = useRootStore((state) => state.setUnsavedChanges)

  useEffect(() => {
    setUnsavedChanges(dirty)
    return () => setUnsavedChanges(false)
  }, [dirty, setUnsavedChanges])

  useEffect(() => {
    if (!dirty) return
    // Fermeture d'onglet ou rechargement : le navigateur n'autorise qu'un
    // avertissement generique, et c'est tout ce qui est possible.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
