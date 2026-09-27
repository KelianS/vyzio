import type { ScheduleWeekAction } from './schedule_week.actions'
import type { ScheduleWeekUido } from './schedule_week.uido'

export function scheduleWeekReducer(
  state: ScheduleWeekUido,
  action: ScheduleWeekAction,
): ScheduleWeekUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, rules: action.rules, channels: action.channels }
    // An unread week is not an empty one: nothing shown may pass for "rien de prévu".
    case 'LOAD_FAILED':
      return { ...state, loading: false, rules: [], channels: [], error: action.error }
  }
}
