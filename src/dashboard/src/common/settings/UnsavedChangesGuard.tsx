import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmModal } from '../components/ConfirmModal'

/**
 * Quitter une page modifiee demande confirmation (ADR-41).
 *
 * Deux sorties existent et se traitent separement :
 *
 * - la navigation **dans** l'application, interceptee par le routeur, qui
 *   permet de poser une vraie question avec les mots du produit ;
 * - la fermeture d'onglet ou le rechargement, ou le navigateur n'autorise
 *   qu'un avertissement generique — mieux que rien, et c'est tout ce qui est
 *   possible.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when)

  useEffect(() => {
    if (!when) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [when])

  // `useBlocker` garde l'etat « bloque » si la condition disparait entre-temps
  // (typiquement apres un enregistrement) : sans cela, la question resterait
  // affichee alors qu'il n'y a plus rien a perdre.
  useEffect(() => {
    if (blocker.state === 'blocked' && !when) blocker.reset?.()
  }, [blocker, when])

  if (blocker.state !== 'blocked') return null

  return (
    <ConfirmModal
      title="Quitter sans enregistrer ?"
      body="Vos modifications seront perdues."
      confirmLabel="Quitter sans enregistrer"
      cancelLabel="Rester sur la page"
      tone="warn"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  )
}
