import type { HouseClock } from '../entities/schedule_rule.entity'
import type { ScheduleRepository } from '../ports/schedule.port'

export class GetHouseClock {
  constructor(private readonly repository: ScheduleRepository) {}

  async execute(): Promise<HouseClock> {
    return this.repository.clock()
  }
}
