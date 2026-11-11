import type { ReactNode } from 'react'

export type DetectionMedia =
  | { type: 'image' | 'video'; url: string; eventId: string }
  /** A detection with nothing to show, opened all the same for what can be done on it. */
  | { type: 'none'; eventId: string; expired: boolean }

/** Expiry is not a failure: nothing to retry, said the same in the list and once opened. */
export const MEDIA_EXPIRED = 'Aperçu et vidéo effacés — au-delà de la durée de conservation.'

interface DetectionPreviewProps {
  media: DetectionMedia
  /** The video was erased with another detection: said as such, never as a broken player (HIST-11). */
  clipGone: boolean
  onVideoError: () => void
  /** What the screen offers on the opened detection, under it. */
  children?: ReactNode
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-card p-6 text-center text-card-foreground">{children}</p>
}

/** The opened detection, the same on the home screen and in the history. */
export function DetectionPreview({
  media,
  clipGone,
  onVideoError,
  children,
}: DetectionPreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {media.type === 'image' && <img src={media.url} alt="" className="max-h-[80vh] rounded-lg" />}
      {media.type === 'video' && clipGone && (
        <Notice>La vidéo de ce moment a été supprimée.</Notice>
      )}
      {media.type === 'video' && !clipGone && (
        <video
          src={media.url}
          controls
          autoPlay
          className="max-h-[80vh] rounded-lg"
          onError={onVideoError}
        />
      )}
      {media.type === 'none' && (
        <Notice>{media.expired ? MEDIA_EXPIRED : 'Cette détection n’a ni aperçu ni vidéo.'}</Notice>
      )}
      {children}
    </div>
  )
}
