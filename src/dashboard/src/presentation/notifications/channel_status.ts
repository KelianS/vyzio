import type { BadgeTone } from '../../common/components/badge'

/** A configured channel's pill, the same in the list and on its page (DESIGN SYSTEM § Page header). */
export function channelPill(enabled: boolean): { tone: BadgeTone; label: string } {
  return enabled ? { tone: 'ok', label: 'Actif' } : { tone: 'neutral', label: 'En pause' }
}

/** Whether a configured channel sends, in one sentence shared by the list and the channel's page. */
export function sendingSentence(enabled: boolean): string {
  return enabled
    ? 'Les notifications sont envoyées.'
    : 'Configuré, mais aucune notification n’est envoyée.'
}
