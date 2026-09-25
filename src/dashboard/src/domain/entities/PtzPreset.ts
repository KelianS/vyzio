export interface PtzPreset {
  presetId: number
  label: string
  native: boolean
  stepsX: number | null
  stepsY: number | null
  configured: boolean
}

/** Where privacy parking sends the camera, and where it brings it back (ADR-57). */
export const PARKING_PRESET_ID = 2
export const SURVEILLANCE_PRESET_ID = 1

export const PRESET_LABELS: Record<number, string> = {
  [SURVEILLANCE_PRESET_ID]: 'Surveillance',
  [PARKING_PRESET_ID]: 'Parking',
}

export function isReservedPreset(presetId: number): boolean {
  return presetId === SURVEILLANCE_PRESET_ID || presetId === PARKING_PRESET_ID
}
