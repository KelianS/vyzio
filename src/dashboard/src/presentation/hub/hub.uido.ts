import type { Silence } from '../../domain/entities/silence.entity'
import type { RecentDetections } from './home_wording'

export interface HubUido {
  /** Null until read; a failed read leaves it null, the home stays usable. */
  silence: Silence | null
  /** The Silence read answered or failed: the home waits for it, so the pill never jumps. */
  silenceSettled: boolean
  silenceSheetOpen: boolean
  /** A start or a stop is on its way. */
  silenceBusy: boolean
  /** Whether no channel can notify yet; null until the overview answers. */
  notificationsToConfigure: boolean | null
  recentDetections: RecentDetections | null
  /** The cameras whose cut or resume is on its way: their eye waits. */
  privacyBusyIds: string[]
}

export function buildInitialHubUido(): HubUido {
  return {
    silence: null,
    silenceSettled: false,
    silenceSheetOpen: false,
    silenceBusy: false,
    notificationsToConfigure: null,
    recentDetections: null,
    privacyBusyIds: [],
  }
}
