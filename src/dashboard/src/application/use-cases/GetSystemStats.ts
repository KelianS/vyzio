import type { SystemStats } from '../../domain/entities/SystemStats'

export interface SystemStatsRepository {
  getStats(): Promise<SystemStats>
}

export class GetSystemStats {
  constructor(private readonly repository: SystemStatsRepository) {}

  async execute(): Promise<SystemStats> {
    return this.repository.getStats()
  }
}
