import type { AppError } from '../../common/errors/app_error'
import { LiveQuality } from '../../domain/entities/camera.entity'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'

export type PtzDirection = 'Up' | 'Down' | 'Left' | 'Right'

/** What a position tile is busy with. */
export type PresetActivity = 'idle' | 'saving' | 'going'

export interface LiveViewUido {
  /** The quality watched, for as long as the view is open: never stored (ADR-72 c). */
  quality: LiveQuality
  /** Off at every opening, a gesture turns it on. */
  soundOn: boolean
  /** The slots that hold a position; null until read, so no slot passes for empty before the camera answers (ADR-69). */
  presets: PtzPreset[] | null
  presetsError: AppError | null
  /** Without a reference the camera does not know where it stands: saved positions are inert. */
  calibrated: boolean
  calibrating: boolean
  /** The saved position the camera sits on, if any. */
  activePresetId: number | null
  activities: Record<number, PresetActivity>
  /** Bumped by each new capture, so the tile fetches its thumbnail again. */
  thumbnailVersions: Record<number, number>
  /** The saved position the user asked to redefine, awaiting confirmation. */
  overridePresetId: number | null
}

export function buildInitialLiveViewUido(): LiveViewUido {
  return {
    quality: LiveQuality.Low,
    soundOn: false,
    presets: null,
    presetsError: null,
    calibrated: true,
    calibrating: false,
    activePresetId: null,
    activities: {},
    thumbnailVersions: {},
    overridePresetId: null,
  }
}
