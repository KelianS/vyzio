import type { SystemStats } from '../../domain/entities/system_stats.entity'
import type { SystemStatsRepository } from '../../domain/usecases/get_system_stats.use_case'
import { fetchJson } from '../http/fetch_json'

export class HttpSystemRepository implements SystemStatsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getStats(): Promise<SystemStats> {
    return fetchJson<SystemStats>(`${this.apiBaseUrl}/api/system/stats`)
  }
}
