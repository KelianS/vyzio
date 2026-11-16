/** How many detections the Détections tile counted, and whether the read stopped before the end. */
export interface RecentDetections {
  count: number
  more: boolean
}

/** The Détections tile's subtitle (UI-32): nothing when nothing was seen in the last hour. */
export function recentDetectionsLine(recent: RecentDetections | null): string | null {
  if (recent === null || recent.count === 0) return null
  return `${recent.count}${recent.more ? '+' : ''} depuis 1 h`
}
