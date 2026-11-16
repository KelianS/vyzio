import type { ChosenEnd } from '../entities/chosen_end.entity'
import type { Silence } from '../entities/silence.entity'

export interface SilenceRepository {
  getSilence(): Promise<Silence>
  startSilence(end: ChosenEnd): Promise<Silence>
  stopSilence(): Promise<Silence>
}
