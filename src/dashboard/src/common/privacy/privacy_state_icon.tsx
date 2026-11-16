import { EyeOff, Lock } from 'lucide-react'
import type { PrivacyBadgeKind } from './privacy_status'

/** One drawing per privacy state the camera confirmed (PRIV-04). */
export function PrivacyStateIcon({
  kind,
  className,
}: {
  kind: PrivacyBadgeKind
  className?: string
}) {
  switch (kind) {
    case 'cut':
      return <Lock className={className} aria-hidden="true" />
    case 'off':
      return <EyeOff className={className} aria-hidden="true" />
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}
