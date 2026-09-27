import type { ScheduleRepository } from '../ports/schedule.port'

export class DeleteScheduleRule {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(ruleId: string): Promise<void> {
    return this.repository.delete(ruleId)
  }
}
