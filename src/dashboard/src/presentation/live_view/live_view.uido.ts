import type { AppError } from '../../common/errors/app_error'
import { LiveQuality } from '../../domain/entities/camera.entity'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

export type PtzDirection = 'Up' | 'Down' | 'Left' | 'Right'

/** What a position tile is busy with. */
export type PresetActivity = 'idle' | 'saving' | 'going'

export interface LiveViewUido {
  /** The quality watched, for as long as the view is open: never stored (ADR-07). */
  quality: LiveQuality
  /** Off at every opening, a gesture turns it on. */
  soundOn: boolean
  /** The slots that hold a position; null until read, so no slot passes for empty before the camera answers (ADR-09). */
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
  /** This camera's clips, the latest first; null until read, so an unread list never passes for empty. */
  clips: DetectionEvent[] | null
  clipsError: AppError | null
  /** What names a detection nobody was recognised in. */
  clipLabels: DetectionLabel[]
  /** The camera detected within the hour before its clips were read: a dot on its tab (LIVE-20). */
  clipsRecent: boolean
  /** The clip playing in place of the live picture, if any (LIVE-20). */
  playingId: string | null
  /** A clip whose video was erased with another detection (HIST-11). */
  clipGoneId: string | null
  /** A cut or a resume asked from the view is on its way. */
  privacyBusy: boolean
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
    clips: null,
    clipsError: null,
    clipLabels: [],
    clipsRecent: false,
    playingId: null,
    clipGoneId: null,
    privacyBusy: false,
  }
}
