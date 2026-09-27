import type {
  NewScheduleRule,
  ScheduleRule,
  ScheduleRuleInput,
} from '../../domain/entities/schedule_rule.entity'
import type { ScheduleRepository } from '../../domain/ports/schedule.port'
import { deleteReq, fetchJson, postJson, putJson } from '../http/fetch_json'
import { HttpError } from '../http/http_error'

export class HttpScheduleRepository implements ScheduleRepository {
  constructor(private readonly apiBaseUrl: string) {}

  private url(ruleId?: string) {
    return ruleId === undefined
      ? `${this.apiBaseUrl}/api/schedules`
      : `${this.apiBaseUrl}/api/schedules/${encodeURIComponent(ruleId)}`
  }

  async list(): Promise<ScheduleRule[]> {
    return fetchJson<ScheduleRule[]>(this.url())
  }

  async get(ruleId: string): Promise<ScheduleRule | null> {
    try {
      return await fetchJson<ScheduleRule>(this.url(ruleId))
    } catch (error) {
      // A rule deleted meanwhile is an answer the screen says as such, not a failed read.
      if (error instanceof HttpError && error.status === 404) return null
      throw error
    }
  }

  async create(rule: NewScheduleRule): Promise<ScheduleRule> {
    return postJson<ScheduleRule>(this.url(), rule)
  }

  async update(ruleId: string, input: ScheduleRuleInput): Promise<ScheduleRule> {
    return putJson<ScheduleRule>(this.url(ruleId), input)
  }

  async delete(ruleId: string): Promise<void> {
    await deleteReq(this.url(ruleId))
  }
}
