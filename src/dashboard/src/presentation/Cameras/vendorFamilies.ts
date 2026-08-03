import type { SettingOption } from '../../common/settings/settingDeclaration'

/**
 * Les marques que Vyzio sait reconnaitre.
 *
 * Foyer unique : la liste servait a trois endroits de l'ecran d'ajout, et la
 * moindre divergence entre eux se lisait comme deux marques differentes.
 */
export const VENDOR_FAMILY_LABELS = {
  v380_pro: 'V380 PRO',
  tplink_tapo: 'TP-Link Tapo',
  icsee: 'ICSee / XMEye',
} as const

export type VendorFamily = keyof typeof VENDOR_FAMILY_LABELS

/** « Pas de marque » est une valeur du choix, pas une absence : une liste ne peut pas offrir le vide. */
export const VENDOR_UNKNOWN = 'unknown'

export const VENDOR_FAMILY_OPTIONS: readonly SettingOption[] = [
  { value: VENDOR_UNKNOWN, label: 'Non reconnue' },
  ...Object.entries(VENDOR_FAMILY_LABELS).map(([value, label]) => ({ value, label })),
]

export function formatVendorFamily(vendorFamily: string | null): string | null {
  if (!vendorFamily) return null
  return VENDOR_FAMILY_LABELS[vendorFamily as VendorFamily] ?? vendorFamily
}

export function toVendorChoice(vendorFamily: string | null | undefined): string {
  return vendorFamily ?? VENDOR_UNKNOWN
}

export function fromVendorChoice(choice: string): string | null {
  return choice === VENDOR_UNKNOWN ? null : choice
}
