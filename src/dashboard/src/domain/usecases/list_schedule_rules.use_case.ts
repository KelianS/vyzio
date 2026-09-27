import type { ScheduleRule } from '../entities/schedule_rule.entity'
import type { ScheduleRepository } from '../ports/schedule.port'

export class ListScheduleRules {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(): Promise<ScheduleRule[]> {
    return this.repository.list()
  }
}
