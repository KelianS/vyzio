import type { ChosenEnd } from '../entities/chosen_end.entity'
import type { Silence } from '../entities/silence.entity'
import type { SilenceRepository } from '../ports/silence.port'

export class GetSilence {
  constructor(private readonly repository: SilenceRepository) {}

  execute(): Promise<Silence> {
    return this.repository.getSilence()
  }
}

/** Replaces a Silence already running. */
export class StartSilence {
  constructor(private readonly repository: SilenceRepository) {}

  execute(end: ChosenEnd): Promise<Silence> {
    return this.repository.startSilence(end)
  }
}

export class StopSilence {
  constructor(private readonly repository: SilenceRepository) {}

  execute(): Promise<Silence> {
    return this.repository.stopSilence()
  }
}
