import { SurveillanceEntry, surveillanceEntryOf } from '../../common/camera/camera_status'
import type { Camera } from '../../domain/entities/camera.entity'

/** What the live view's address reaches, before any stream is tried (SPECS 7.2). */
export const LiveAccess = {
  Loading: 'loading',
  Unread: 'unread',
  Removed: 'removed',
  Privacy: 'privacy',
  Unwatched: 'unwatched',
  Offline: 'offline',
  Open: 'open',
} as const

export type LiveAccess = (typeof LiveAccess)[keyof typeof LiveAccess]

/** The same gates as the home thumbnail, so an address never opens what a tap would not (SPECS 2.2, 9.2). */
export function liveAccessOf(
  camera: Camera | undefined,
  { loading, unread }: { loading: boolean; unread: boolean },
): LiveAccess {
  if (!camera) {
    if (loading) return LiveAccess.Loading
    return unread ? LiveAccess.Unread : LiveAccess.Removed
  }
  if (camera.privacyModeActive) return LiveAccess.Privacy
  if (surveillanceEntryOf(camera) !== SurveillanceEntry.Watched) return LiveAccess.Unwatched
  if (!camera.connected) return LiveAccess.Offline
  return LiveAccess.Open
}
