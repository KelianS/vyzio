/** Settings rubrics, declared as data (ADR-40) — organized by functional domain, never by scope or screen of origin. */
export interface SettingsRubric {
  /** Route segment under `/settings`. */
  readonly slug: string
  readonly label: string
  /** What the rubric governs, in a few words — a full sentence would compete with the label (ADR-43). */
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
    slug: 'conservation',
    label: 'Conservation',
    summary: 'Durée des enregistrements',
  },
  {
    slug: 'notifications',
    label: 'Notifications',
    summary: 'Canaux et horaires',
  },
  {
    slug: 'systeme',
    label: 'Système',
    summary: 'Stockage et ressources',
  },
]

export const SETTINGS_ROOT = '/settings'

export function rubricPath(slug: string) {
  return `${SETTINGS_ROOT}/${slug}`
}

/** A page is named once — the settings shell does it by default; routes naming something else (a camera, a task) declare it here. */
export interface SettingsRouteHandle {
  /** The route shows its own title; the rubric shell adds none. */
  readonly ownHeader?: boolean
  /** The route shows its own back link; the rubric shell adds none. */
  readonly ownBackLink?: boolean
}

/** Migrated screen that names itself and provides its own way back. */
export const OWN_HEADER: SettingsRouteHandle = { ownHeader: true, ownBackLink: true }

/** Not-yet-migrated screen: has its own title but no back link, so the shell keeps providing one. */
export const OWN_HEADER_ONLY: SettingsRouteHandle = { ownHeader: true }

function handlesOf(matches: readonly { readonly handle?: unknown }[]) {
  return matches.map((match) => match.handle as SettingsRouteHandle | undefined)
}

export function declaresOwnHeader(matches: readonly { readonly handle?: unknown }[]): boolean {
  return handlesOf(matches).some((handle) => handle?.ownHeader)
}

export function declaresOwnBackLink(matches: readonly { readonly handle?: unknown }[]): boolean {
  return handlesOf(matches).some((handle) => handle?.ownBackLink)
}
