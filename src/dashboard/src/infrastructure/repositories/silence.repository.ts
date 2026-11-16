import type { ChosenEnd } from '../../domain/entities/chosen_end.entity'
import type { Silence } from '../../domain/entities/silence.entity'
import type { SilenceRepository } from '../../domain/ports/silence.port'
import { deleteJson, fetchJson, putJson } from '../http/fetch_json'

export class HttpSilenceRepository implements SilenceRepository {
  constructor(private readonly apiBaseUrl: string) {}

  getSilence(): Promise<Silence> {
    return fetchJson<Silence>(this.url())
  }

  startSilence(end: ChosenEnd): Promise<Silence> {
    return putJson<Silence>(this.url(), end)
  }

  stopSilence(): Promise<Silence> {
    return deleteJson<Silence>(this.url())
  }

  private url() {
    return `${this.apiBaseUrl}/api/notifications/silence`
  }
}
