import type { SurveillanceChangeScope } from '../../domain/entities/SystemStats'

// Interface wording for the restart (ADR-44). The server carries scopes, never French.
const SCOPE_LABEL: Record<SurveillanceChangeScope, string> = {
  cameras: 'Caméras',
  detection: 'Détection',
  retention: 'Conservation',
}

// Fixed order: a list reshuffling between two polls would look like the wait changed.
const SCOPE_ORDER: SurveillanceChangeScope[] = ['cameras', 'detection', 'retention']

export const RESTART_ACTION = 'Redémarrer la surveillance'
export const RESTART_QUESTION = 'Redémarrer la surveillance maintenant ?'
export const RESTART_COST = 'La surveillance s’interrompt quelques secondes.'

export function sortScopes(scopes: readonly SurveillanceChangeScope[]): SurveillanceChangeScope[] {
  return SCOPE_ORDER.filter((scope) => scopes.includes(scope))
}

// Names the subjects rather than counting settings: the server only knows the domain touched.
export function describePendingRestart(scopes: readonly SurveillanceChangeScope[]): string {
  const labels = sortScopes(scopes).map((scope) => SCOPE_LABEL[scope])
  if (labels.length === 0) return ''

  const subject =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`

  return labels.length === 1
    ? `${subject} attend le redémarrage.`
    : `${subject} attendent le redémarrage.`
}
