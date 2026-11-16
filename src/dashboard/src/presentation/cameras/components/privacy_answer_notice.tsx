import { Badge } from '../../../common/components/badge'
import { privacyBadge } from '../../../common/privacy/privacy_status'
import { PrivacyStateIcon } from '../../../common/privacy/privacy_state_icon'
import type { Camera } from '../../../domain/entities/camera.entity'

/** What the camera confirmed to privacy mode (PRIV-04); a miss is told elsewhere (PRIV-05). */
export function PrivacyAnswerNotice({ camera }: { camera: Camera }) {
  const badge = privacyBadge(camera)
  if (!badge) return null

  return (
    <Badge tone={badge.tone} className="w-fit gap-1.5">
      <PrivacyStateIcon kind={badge.kind} className="size-3.5" />
      {badge.text}
    </Badge>
  )
}
