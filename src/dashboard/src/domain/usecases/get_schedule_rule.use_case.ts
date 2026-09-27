import type { ScheduleRule } from '../entities/schedule_rule.entity'
import type { ScheduleRepository } from '../ports/schedule.port'

export class GetScheduleRule {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(ruleId: string): Promise<ScheduleRule | null> {
    return this.repository.get(ruleId)
  }
}
