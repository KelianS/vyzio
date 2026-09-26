import { Badge } from '../../common/components/Badge'
import { DiagnosticLine } from '../../common/components/ErrorMessage'
import { scrubSecrets } from '../../common/errors/scrubSecrets'
import { privacyBadge, privacyMissSentence } from '../../common/privacy/privacyStatus'
import { PrivacyStateIcon } from '../../common/privacy/PrivacyStateIcon'
import type { Camera } from '../../domain/entities/Camera'

/** What the camera answered to privacy mode, first on the screen the tile links to (SPECS 9.2). */
export function PrivacyAnswerNotice({ camera }: { camera: Camera }) {
  const badge = privacyBadge(camera)
  const sentence = privacyMissSentence(camera)
  if (!badge && !sentence) return null

  return (
    <div className="flex flex-col gap-2">
      {badge && (
        <Badge tone={badge.tone} className="w-fit gap-1.5">
          <PrivacyStateIcon kind={badge.kind} className="size-3.5" />
          {badge.text}
        </Badge>
      )}
      {sentence && (
        <div role="status" className="text-sm">
          <p>{sentence}</p>
          {camera.privacyMissDetail && (
            <DiagnosticLine text={scrubSecrets(camera.privacyMissDetail)} />
          )}
        </div>
      )}
    </div>
  )
}
