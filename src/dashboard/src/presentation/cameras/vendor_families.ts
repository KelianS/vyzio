import type { ChoiceOption } from '../../common/settings/setting_declaration'

/** Vendor families Vyzio has a help sheet for, by the name the add screen shows. */
const VENDOR_FAMILY_LABELS = {
  v380_pro: 'V380 PRO',
  tplink_tapo: 'TP-Link Tapo',
  icsee: 'ICSee / XMEye',
} as const

type VendorFamily = keyof typeof VENDOR_FAMILY_LABELS

export function formatVendorFamily(vendorFamily: string | null): string | null {
  if (!vendorFamily) return null
  return VENDOR_FAMILY_LABELS[vendorFamily as VendorFamily] ?? vendorFamily
}

/** The help list's "no vendor" entry: a dropdown option needs a value, the screen keeps `null`. */
export const NO_HELP_VENDOR = 'none'

/** The add screen's help list: it only picks which vendor sheet shows (#274). */
export const helpVendorOptions: readonly ChoiceOption[] = [
  { value: NO_HELP_VENDOR, label: 'Je ne sais pas' },
  ...Object.entries(VENDOR_FAMILY_LABELS).map(([value, label]) => ({ value, label })),
]
