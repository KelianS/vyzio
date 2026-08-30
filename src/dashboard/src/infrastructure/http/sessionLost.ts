type Listener = () => void

const listeners = new Set<Listener>()

/**
 * A session that ended while a screen was open: the answer lands on any call at all, and the
 * interface must return to sign-in saying so rather than leave an empty screen (ADR-54).
 */
export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportSessionLost(url: string) {
  // The access routes answer 401 to mean "password refused", which is not a session ending.
  if (url.includes('/api/access/')) return

  listeners.forEach((listener) => listener())
}
