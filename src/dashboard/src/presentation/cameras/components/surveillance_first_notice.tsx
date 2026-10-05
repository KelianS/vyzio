import { Link } from 'react-router'
import { SurveillanceEntry } from '../../../common/camera/camera_status'
import { LiveViewNeed } from '../live_view_need'

const LIVE_VIEW_WAITS: Record<LiveViewNeed, string> = {
  [LiveViewNeed.Positions]:
    'La vue live, où se règlent ses positions, s’ouvre une fois la caméra en surveillance',
  [LiveViewNeed.ParkingOrientation]:
    'Les positions de l’orientation à l’écart se règlent depuis la vue live, qui s’ouvre une fois la caméra en surveillance',
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
          {LIVE_VIEW_WAITS[need]}, et son flux vidéo n’a pas encore fonctionné : voir «{' '}
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
      return (
        <p className="text-sm text-muted-foreground">
          {LIVE_VIEW_WAITS[need]} : appliquez les changements, en haut de l’écran, pour qu’elle y
          entre.
        </p>
      )
    default: {
      const unknown: never = entry
      return unknown
    }
  }
}
