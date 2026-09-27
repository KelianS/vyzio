import {
  isScheduleRuleKind,
  type HouseClock,
  type NewScheduleRule,
  type ScheduleRule,
  type ScheduleRuleInput,
} from '../../domain/entities/schedule_rule.entity'
import type { ScheduleRepository } from '../../domain/ports/schedule.port'
import { deleteReq, fetchJson, postJson, putJson } from '../http/fetch_json'
import { HttpError } from '../http/http_error'

type ScheduleRuleResponse = Omit<ScheduleRule, 'kind'> & { kind: string }

// A type this interface does not know is a failed read with its name, never a screen that breaks.
function toRule(response: ScheduleRuleResponse): ScheduleRule {
  const { kind } = response
  if (!isScheduleRuleKind(kind)) throw new Error(`Unknown schedule rule kind: ${kind}`)
  return { ...response, kind }
}

export class HttpScheduleRepository implements ScheduleRepository {
  constructor(private readonly apiBaseUrl: string) {}

  private url(ruleId?: string) {
    return ruleId === undefined
      ? `${this.apiBaseUrl}/api/schedules`
      : `${this.apiBaseUrl}/api/schedules/${encodeURIComponent(ruleId)}`
  }

  async list(): Promise<ScheduleRule[]> {
    return (await fetchJson<ScheduleRuleResponse[]>(this.url())).map(toRule)
  }

  async get(ruleId: string): Promise<ScheduleRule | null> {
    try {
      return toRule(await fetchJson<ScheduleRuleResponse>(this.url(ruleId)))
    } catch (error) {
      // A rule deleted meanwhile is an answer the screen says as such, not a failed read.
      if (error instanceof HttpError && error.status === 404) return null
      throw error
    }
  }

  async create(rule: NewScheduleRule): Promise<ScheduleRule> {
    return toRule(await postJson<ScheduleRuleResponse>(this.url(), rule))
  }

  async update(ruleId: string, input: ScheduleRuleInput): Promise<ScheduleRule> {
    return toRule(await putJson<ScheduleRuleResponse>(this.url(ruleId), input))
  }

  async delete(ruleId: string): Promise<void> {
    await deleteReq(this.url(ruleId))
  }

  async clock(): Promise<HouseClock> {
    return fetchJson<HouseClock>(`${this.url()}/clock`)
  }
}
