export interface PtzPreset {
  presetId: number
  label: string
  native: boolean
  stepsX: number | null
  stepsY: number | null
  configured: boolean
}

export const PRESET_LABELS: Record<number, string> = {
  1: 'Surveillance',
  2: 'Parking',
}

export function isReservedPreset(presetId: number): boolean {
  return presetId === 1 || presetId === 2
}
