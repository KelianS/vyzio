import type { SettingOption } from '../../common/settings/settingDeclaration'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/Profile'

/** Foyer unique des libelles : une table, pas une recherche dans un tableau d'options. */
export const CATEGORY_LABELS: Record<ProfileCategory, string> = {
  family: 'Famille',
  friend: 'Ami',
  staff: 'Intervenant',
  other: 'Autre',
}

export const ALERT_MODE_LABELS: Record<ProfileAlertMode, string> = {
  always: 'Me prévenir',
  never: 'Ne rien signaler',
}

export const CATEGORY_OPTIONS: readonly SettingOption[] = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

export const ALERT_MODE_OPTIONS: readonly SettingOption[] = Object.entries(ALERT_MODE_LABELS).map(
  ([value, label]) => ({ value, label }),
)
