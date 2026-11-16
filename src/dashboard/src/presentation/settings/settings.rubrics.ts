import {
  Bell,
  CalendarClock,
  Server,
  Lock,
  ScanFace,
  Archive,
  Video,
  type LucideIcon,
} from 'lucide-react'

/** The two groups the rubrics are shown in (UI-36). */
export const SETTINGS_SECTIONS = ['Surveillance', 'Système'] as const

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/** Settings rubrics, declared as data (UI-25), organized by functional domain, never by scope or screen of origin. */
export interface SettingsRubric {
  /** Route segment under `/settings`. */
  readonly slug: string
  readonly label: string
  readonly section: SettingsSection
  /** The neutral icon of its row (DESIGN SYSTEM § Grouped lists). */
  readonly icon: LucideIcon
}

export const SETTINGS_RUBRICS: readonly SettingsRubric[] = [
  { slug: 'cameras', label: 'Caméras', section: 'Surveillance', icon: Video },
  { slug: 'detection', label: 'Détection', section: 'Surveillance', icon: ScanFace },
  { slug: 'schedule', label: 'Planification', section: 'Surveillance', icon: CalendarClock },
  { slug: 'notifications', label: 'Notifications', section: 'Surveillance', icon: Bell },
  { slug: 'retention', label: 'Conservation', section: 'Système', icon: Archive },
  { slug: 'access', label: 'Accès', section: 'Système', icon: Lock },
  { slug: 'hardware', label: 'Matériel', section: 'Système', icon: Server },
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
