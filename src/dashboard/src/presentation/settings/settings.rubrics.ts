/** Settings rubrics, declared as data (UI-25) — organized by functional domain, never by scope or screen of origin. */
export interface SettingsRubric {
  /** Route segment under `/settings`. */
  readonly slug: string
  readonly label: string
  /** What the rubric governs, in a few words — a full sentence would compete with the label. */
  readonly summary: string
}

export const SETTINGS_RUBRICS: readonly SettingsRubric[] = [
  {
    slug: 'cameras',
    label: 'Caméras',
    summary: 'Ajout et réglages',
  },
  {
    slug: 'detection',
    label: 'Détection',
    summary: 'Ce qui est reconnu',
  },
  {
    slug: 'retention',
    label: 'Conservation',
    summary: 'Durée des enregistrements',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    summary: 'Canaux et messages',
  },
  {
    slug: 'schedule',
    label: 'Planification',
    summary: 'Vie privée et notifications',
  },
  {
    slug: 'access',
    label: 'Accès',
    summary: 'Mot de passe et appareils',
  },
  {
    slug: 'hardware',
    label: 'Matériel',
    summary: 'Stockage et ressources',
  },
]

export const SETTINGS_ROOT = '/settings'

/** Whether an address is one of the settings' pages, their root included. */
export function isSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`)
}

export function rubricPath(slug: string) {
  return `${SETTINGS_ROOT}/${slug}`
}

/** A page is named once: the settings shell names a rubric, a route naming something else (a camera, a task) declares it. */
interface SettingsRouteHandle {
  /** The route shows its own title; the rubric shell adds none. */
  readonly ownHeader?: boolean
}

export const OWN_HEADER: SettingsRouteHandle = { ownHeader: true }

export function declaresOwnHeader(matches: readonly { readonly handle?: unknown }[]): boolean {
  return matches.some((match) => (match.handle as SettingsRouteHandle | undefined)?.ownHeader)
}
