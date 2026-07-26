import type { SystemStats } from '../../domain/entities/SystemStats'
import type { SystemStatsRepository } from '../../domain/usecases/GetSystemStats'
import { fetchJson } from '../http/fetchJson'

export class HttpSystemRepository implements SystemStatsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getStats(): Promise<SystemStats> {
    return fetchJson<SystemStats>(`${this.apiBaseUrl}/api/system/stats`)
  }
}
