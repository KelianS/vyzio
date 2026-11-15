import type { Silence, StartSilenceRequest } from '../entities/silence.entity'

export interface SilenceRepository {
  getSilence(): Promise<Silence>
  startSilence(request: StartSilenceRequest): Promise<Silence>
  stopSilence(): Promise<Silence>
}
