/** A slot that holds a position, whether the camera keeps it or Vyzio counts it (ADR-69). */
export interface PtzPreset {
  presetId: number
  label: string
  /** Whether its thumbnail was taken: a held slot without one is never shown as empty (SPECS 9.4). */
  thumbnail: boolean
  /** Milliseconds of motion right, then down, from the up-left limit, when Vyzio counts it (ADR-60). */
  panMs: number | null
  tiltMs: number | null
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
