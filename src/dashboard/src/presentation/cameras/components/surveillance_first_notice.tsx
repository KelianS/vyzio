import { Link } from 'react-router'
import { SurveillanceEntry } from '../../../common/camera/camera_status'
import { LiveViewNeed } from '../live_view_need'

/** What waits, before the Connexion link while the stream never worked, then while the restart is pending. */
const LIVE_VIEW_WAITS: Record<LiveViewNeed, { stream: string; restart: string }> = {
  [LiveViewNeed.Positions]: {
    stream:
      'La vue live, où se règlent ses positions, s’ouvre une fois la caméra en surveillance, et son flux vidéo n’a pas encore fonctionné',
    restart:
      'La vue live, où se règlent ses positions, s’ouvre une fois la caméra en surveillance : appliquez les changements, en haut de l’écran, pour qu’elle y entre.',
  },
  // One short line under the strategy: the Image et pilotage tab says the rest (DESIGN SYSTEM § Help).
  [LiveViewNeed.ParkingOrientation]: {
    stream: 'Ses positions se règlent une fois son flux vidéo fonctionnel',
    restart: 'Ses positions se règlent une fois les changements appliqués.',
  },
}

/** Where a setting needs the live view: says it waits for surveillance and leads to what is missing (SPECS 9.3). */
export function SurveillanceFirstNotice({
  cameraId,
  entry,
  need,
}: {
  cameraId: string
  entry: SurveillanceEntry
  need: LiveViewNeed
}) {
  switch (entry) {
    case SurveillanceEntry.Watched:
      return null
    case SurveillanceEntry.AwaitsStream:
      return (
        <p className="text-sm text-muted-foreground">
          {LIVE_VIEW_WAITS[need].stream} : voir «{' '}
          <Link
            to={`/settings/cameras/${cameraId}/connexion`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Connexion
          </Link>{' '}
          ».
        </p>
      )
    case SurveillanceEntry.AwaitsRestart:
      // The restart trigger stays in the page header, never repeated in the tab.
      return <p className="text-sm text-muted-foreground">{LIVE_VIEW_WAITS[need].restart}</p>
    default: {
      const unknown: never = entry
      return unknown
    }
  }
}
