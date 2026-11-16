import type { HouseMoment } from '../../domain/entities/schedule_rule.entity'
import { WEEK_DAYS } from './schedule_types'

const DAY_MS = 24 * 60 * 60 * 1000

/** "22:00" reads « 22 h », "07:30" « 7 h 30 » (DESIGN SYSTEM § Shared words). */
export function formatHouseTime(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

/** An end within a day reads as its hour alone; further away, its day comes first. */
export function formatHouseEnd(moment: HouseMoment, now: Date): string {
  const hour = formatHouseTime(moment.time)
  if (Date.parse(moment.at) - now.getTime() < DAY_MS) return hour
  const day = WEEK_DAYS.find((d) => d.value === moment.dayOfWeek)?.name.toLowerCase()
  return day ? `${day} ${hour}` : hour
}
