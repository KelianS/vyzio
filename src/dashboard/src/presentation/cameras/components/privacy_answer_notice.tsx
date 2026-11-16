import { Link } from 'react-router'
import { Move, Plug, RotateCw } from 'lucide-react'
import { Badge } from '../../../common/components/badge'
import { Button } from '../../../common/ui/button'
import { cn } from '../../../common/ui/utils'
import { DiagnosticLine } from '../../../common/components/error_message'
import { GroupedItem, GroupedList } from '../../../common/components/grouped_list'
import { TechnicalDetails } from '../../../common/components/technical_details'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import {
  privacyBadge,
  privacyMissLabel,
  privacyMissRemedy,
  privacyMissSentence,
  RECORDING_OFF_TEXT,
  type PrivacyMissRemedy,
} from '../../../common/privacy/privacy_status'
import { PrivacyStateIcon } from '../../../common/privacy/privacy_state_icon'
import type { Camera } from '../../../domain/entities/camera.entity'
import { liveViewPath } from '../../live_view/live_view.route'

interface RetryProps {
  /** Asks the camera again for its privacy state. */
  onRetry: () => void
  retrying: boolean
}

/** What the camera answered to privacy mode, first on the screen the tile links to (PRIV-05). */
export function PrivacyAnswerNotice({ camera, ...retry }: { camera: Camera } & RetryProps) {
  const badge = privacyBadge(camera)
  const label = privacyMissLabel(camera)
  if (!badge && !label) return null

  return (
    <div className="flex flex-col gap-2">
      {badge && (
        <Badge tone={badge.tone} className="w-fit gap-1.5">
          <PrivacyStateIcon kind={badge.kind} className="size-3.5" />
          {badge.text}
        </Badge>
      )}
      {label && <MissRow camera={camera} label={label} {...retry} />}
    </div>
  )
}

/** The miss in one line with the one action that fixes it, its full account folded for support (UI-01). */
function MissRow({ camera, label, ...retry }: { camera: Camera; label: string } & RetryProps) {
  const remedy = privacyMissRemedy(camera)
  return (
    <GroupedList>
      <GroupedItem>
        <div role="status" className="pb-4">
          <div className="flex min-h-16 items-center gap-3.5 px-4 py-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive">
              <PrivacyStateIcon kind="missed" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-row font-semibold">{label}</span>
              {/* A space between the lines, so a reader says them as two words, not one. */}
              {camera.privacyModeActive && ' '}
              {camera.privacyModeActive && (
                <span className="text-body text-muted-foreground">{RECORDING_OFF_TEXT}</span>
              )}
            </span>
          </div>
          <div className="px-4">
            {remedy && <Remedy remedy={remedy} cameraId={camera.id} {...retry} />}
            <TechnicalDetails>
              <p>{privacyMissSentence(camera)}</p>
              {camera.privacyMissDetail && (
                <DiagnosticLine text={scrubSecrets(camera.privacyMissDetail)} />
              )}
            </TechnicalDetails>
          </div>
        </div>
      </GroupedItem>
    </GroupedList>
  )
}

/** The one action a miss offers, as the view's main action. */
function Remedy({
  remedy,
  cameraId,
  onRetry,
  retrying,
}: { remedy: PrivacyMissRemedy; cameraId: string } & RetryProps) {
  switch (remedy) {
    case 'retry':
      return (
        <Button type="button" className="w-full" disabled={retrying} onClick={onRetry}>
          <RotateCw className={cn(retrying && 'animate-spin')} aria-hidden="true" />
          Réessayer
        </Button>
      )
    case 'positions':
      return (
        <Button asChild className="w-full">
          <Link to={liveViewPath(cameraId)}>
            <Move aria-hidden="true" />
            Enregistrer ses positions
          </Link>
        </Button>
      )
    case 'connection':
      return (
        <Button asChild className="w-full">
          <Link to={`/settings/cameras/${cameraId}/connection`}>
            <Plug aria-hidden="true" />
            Vérifier dans Connexion
          </Link>
        </Button>
      )
    default: {
      const unknown: never = remedy
      return unknown
    }
  }
}
