/** Vendor families Vyzio recognizes, by the name the add screen shows to tell a camera apart (ADR-68 e). */
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
