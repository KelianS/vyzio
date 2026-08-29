type Listener = () => void

const listeners = new Set<Listener>()

/**
 * Une session qui a expire pendant qu'on regardait un ecran : la reponse arrive sur n'importe quel
 * appel, et l'interface doit ramener a la connexion en le disant, pas laisser un ecran vide (ADR-54).
 */
export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportSessionLost(url: string) {
  // Les routes d'acces repondent 401 pour dire « mot de passe refuse » : ce n'est pas une session perdue.
  if (url.includes('/api/access/')) return

  listeners.forEach((listener) => listener())
}
