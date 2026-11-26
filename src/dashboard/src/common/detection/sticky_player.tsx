import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * What holds the player: it stays under the bar while the list below scrolls, opaque so no row shows
 * through, under the Radix layers (`z-50`); a phone on its side is too short, so there it scrolls
 * with the page (HIST-18, DESIGN SYSTEM § Top bar).
 */
export const STICKY_WELL =
  'sticky top-(--top-bar-height) z-30 -my-2 bg-background py-2 [@media(orientation:landscape)_and_(max-height:32rem)]:static'

/** The player at 16:9 across the page, never taller than 40% of an upright screen. */
export const PLAYER_FRAME = 'aspect-video w-full rounded-card portrait:max-h-[40svh]'

/**
 * The well over a list whose rows come into view on their own: its height, published on the page,
 * keeps such a row clear of it (`ClipList`'s `follow`).
 */
export function StickyPlayer({ children }: { children: ReactNode }) {
  const well = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = well.current
    const page = element?.parentElement
    if (!element || !page) return
    const observer = new ResizeObserver(() =>
      page.style.setProperty('--clip-player-height', `${element.offsetHeight}px`),
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      page.style.removeProperty('--clip-player-height')
    }
  }, [])

  return (
    <div ref={well} className={STICKY_WELL}>
      {children}
    </div>
  )
}
