import type { Silence, StartSilenceRequest } from '../entities/silence.entity'
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

  execute(request: StartSilenceRequest): Promise<Silence> {
    return this.repository.startSilence(request)
  }
}

export class StopSilence {
  constructor(private readonly repository: SilenceRepository) {}

  execute(): Promise<Silence> {
    return this.repository.stopSilence()
  }
}
