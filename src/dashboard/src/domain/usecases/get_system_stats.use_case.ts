import type { SystemStats } from '../entities/system_stats.entity'

export interface SystemStatsRepository {
  getStats(): Promise<SystemStats>
}

export class GetSystemStats {
  constructor(private readonly repository: SystemStatsRepository) {}

  async execute(): Promise<SystemStats> {
    return this.repository.getStats()
  }
}
