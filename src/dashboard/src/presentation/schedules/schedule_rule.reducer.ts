import type { ScheduleRuleAction } from './schedule_rule.actions'
import type { ScheduleRuleUido } from './schedule_rule.uido'

export function scheduleRuleReducer(
  state: ScheduleRuleUido,
  action: ScheduleRuleAction,
): ScheduleRuleUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, readError: null, gone: false }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, rule: action.rule, channels: action.channels }
    case 'LOAD_FAILED':
      return { ...state, loading: false, rule: null, readError: action.error }
    case 'RULE_GONE':
      return { ...state, loading: false, rule: null, gone: true, confirmDelete: false }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    // The saved rule becomes the draft's reference, so the page reads unchanged.
    case 'SAVED':
      return { ...state, saving: false, rule: action.rule }
    // The page leaves for the week: nothing to show of the new rule here.
    case 'ADDED':
      return { ...state, saving: false }
    case 'SAVE_FAILED':
      return { ...state, saving: false }

    case 'DELETE_ASKED':
      return { ...state, confirmDelete: true }
    case 'DELETE_CANCELLED':
      return { ...state, confirmDelete: false }
    case 'DELETE_STARTED':
      return { ...state, deleting: true }
    // The question closes on a failure: the toast says why, over the page.
    case 'DELETE_FAILED':
      return { ...state, deleting: false, confirmDelete: false }
  }
}
