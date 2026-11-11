import type { ReactNode } from 'react'

export interface DetectionMedia {
  type: 'image' | 'video'
  url: string
  eventId: string
}

interface DetectionPreviewProps {
  media: DetectionMedia
  /** The video was erased with another detection: said as such, never as a broken player (SPECS 6.2). */
  clipGone: boolean
  onVideoError: () => void
  /** What the screen offers on the opened detection, under it. */
  children?: ReactNode
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
        <p className="rounded-card bg-card p-6 text-center text-card-foreground">
          La vidéo de ce moment a été supprimée.
        </p>
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
      {children}
    </div>
  )
}
