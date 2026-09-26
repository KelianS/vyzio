import type { AppError } from '../../common/errors/app_error'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'

export type PtzDirection = 'Up' | 'Down' | 'Left' | 'Right'

/** What a position tile is busy with. */
export type PresetActivity = 'idle' | 'saving' | 'going'

export interface LiveViewUido {
  presets: PtzPreset[]
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
    presets: [],
    presetsError: null,
    calibrated: true,
    calibrating: false,
    activePresetId: null,
    activities: {},
    thumbnailVersions: {},
    overridePresetId: null,
  }
}
