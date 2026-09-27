import type { ScheduleRule, ScheduleRuleInput } from '../entities/schedule_rule.entity'
import type { ScheduleRepository } from '../ports/schedule.port'

export class UpdateScheduleRule {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(ruleId: string, input: ScheduleRuleInput): Promise<ScheduleRule> {
    return this.repository.update(ruleId, input)
  }
}
