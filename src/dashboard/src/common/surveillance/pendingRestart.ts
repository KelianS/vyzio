// Wording of the restart (ADR-44, DESIGN SYSTEM vocabulary).
// Names the waiting state, not the act: the trigger may be read days after the save.
export const RESTART_ACTION = 'Appliquer les changements'
export const RESTART_QUESTION = 'Redémarrer la surveillance maintenant ?'
export const RESTART_BODY =
  'Des réglages enregistrés ne sont pas encore appliqués. La surveillance s’interrompt quelques secondes.'

export interface RestartWording {
  triggerLabel: string
  body: string
  confirmLabel: string
}

/**
 * Un echec de redemarrage est persistant (ADR-44) : partout ou la question se repose, elle se
 * repose en le disant. Foyer unique — l'en-tete et le garde de navigation posent la meme question,
 * et le garde la reposait avec le texte d'origine, comme si rien n'avait echoue.
 */
export function restartWording(failure: string | null): RestartWording {
  return failure
    ? {
        triggerLabel: 'Redémarrage échoué',
        body: `${failure} ${RESTART_BODY}`,
        confirmLabel: 'Réessayer',
      }
    : { triggerLabel: RESTART_ACTION, body: RESTART_BODY, confirmLabel: 'Redémarrer' }
}
