import type {
  NewScheduleRule,
  ScheduleRule,
  ScheduleRuleInput,
} from '../entities/schedule_rule.entity'

export interface ScheduleRepository {
  list(): Promise<ScheduleRule[]>
  /** Null when the rule no longer exists. */
  get(ruleId: string): Promise<ScheduleRule | null>
  create(rule: NewScheduleRule): Promise<ScheduleRule>
  update(ruleId: string, input: ScheduleRuleInput): Promise<ScheduleRule>
  delete(ruleId: string): Promise<void>
}
