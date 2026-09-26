import { EyeOff, Lock, TriangleAlert } from 'lucide-react'
import type { PrivacyBadgeKind } from './privacyStatus'

/** One drawing per privacy state, shared by the badge and the tile. */
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
    case 'missed':
      return <TriangleAlert className={className} aria-hidden="true" />
    case 'off':
      return <EyeOff className={className} aria-hidden="true" />
    default: {
      const unknown: never = kind
      return unknown
    }
  }
}
