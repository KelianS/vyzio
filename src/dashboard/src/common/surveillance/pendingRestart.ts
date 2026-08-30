// Wording of the restart (ADR-44, DESIGN SYSTEM vocabulary).
// Names the waiting state, not the act: the trigger may be read days after the save.
const RESTART_ACTION = 'Appliquer les changements'
export const RESTART_QUESTION = 'Redémarrer la surveillance maintenant ?'
const RESTART_BODY =
  'Des réglages enregistrés ne sont pas encore appliqués. La surveillance s’interrompt quelques secondes.'

export interface RestartWording {
  triggerLabel: string
  body: string
  confirmLabel: string
}

/**
 * A failed restart is persistent (ADR-44): everywhere the question is asked again, it is asked
 * saying so. A single home - the header and the navigation guard ask the same question, and the
 * guard used to ask it with the original wording, as if nothing had failed.
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
