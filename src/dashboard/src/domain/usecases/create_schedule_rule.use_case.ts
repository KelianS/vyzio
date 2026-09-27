import type { NewScheduleRule, ScheduleRule } from '../entities/schedule_rule.entity'
import type { ScheduleRepository } from '../ports/schedule.port'

export class CreateScheduleRule {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(rule: NewScheduleRule): Promise<ScheduleRule> {
    return this.repository.create(rule)
  }
}
