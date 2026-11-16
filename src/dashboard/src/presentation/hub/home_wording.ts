import { WEEK_DAYS } from '../../common/schedule/schedule_types'
import type { Silence } from '../../domain/entities/silence.entity'

type HouseMoment = NonNullable<Silence['until']>

/** How many detections the Détections tile counted, and whether the read stopped before the end. */
export interface RecentDetections {
  count: number
  more: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "22:00" reads « 22 h », "07:30" « 7 h 30 » (DESIGN SYSTEM § Shared words). */
export function formatHouseTime(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

/** An end within a day reads as its hour alone; further away, its day comes first. */
export function formatSilenceEnd(moment: HouseMoment, now: Date): string {
  const hour = formatHouseTime(moment.time)
  if (Date.parse(moment.at) - now.getTime() < DAY_MS) return hour
  const day = WEEK_DAYS.find((d) => d.value === moment.dayOfWeek)?.name.toLowerCase()
  return day ? `${day} ${hour}` : hour
}

/** The Détections tile's subtitle (UI-32): nothing when nothing was seen in the last hour. */
export function recentDetectionsLine(recent: RecentDetections | null): string | null {
  if (recent === null || recent.count === 0) return null
  return `${recent.count}${recent.more ? '+' : ''} depuis 1 h`
}
