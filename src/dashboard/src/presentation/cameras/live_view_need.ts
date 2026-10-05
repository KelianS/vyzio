/** What waits for the live view on the screen that says the camera is not in surveillance yet. */
export const LiveViewNeed = {
  Positions: 'positions',
  ParkingOrientation: 'parking_orientation',
} as const

export type LiveViewNeed = (typeof LiveViewNeed)[keyof typeof LiveViewNeed]
