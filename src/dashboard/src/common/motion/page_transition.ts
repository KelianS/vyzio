import { motionValue, type MotionValue } from 'motion/react'
import { NavigationType } from 'react-router'
import { ghostOf, paintOn, translation } from './ghost'
import {
  BAR_SWAP_SHIFT,
  RECEDED_DIM,
  RECEDED_SHIFT,
  prefersReducedMotion,
  springTo,
  type SpringKind,
} from './springs'

/** Opening a page, or going back to one. */
export type PageDirection = 'forward' | 'back'

/** A push opens a page and a pop goes back; a replace (a tab, a redirect) moves no page (UI-29). */
export function pageDirection(navigation: NavigationType): PageDirection | null {
  switch (navigation) {
    case NavigationType.Push:
      return 'forward'
    case NavigationType.Pop:
      return 'back'
    case NavigationType.Replace:
      return null
    default: {
      const unknown: never = navigation
      return unknown
    }
  }
}

/** The elements of the shell that move: the page, its dimming veil, the bar's contents, its plate and what it grows for. */
export interface ShellParts {
  readonly stage: HTMLElement
  readonly dim: HTMLElement
  readonly row: HTMLElement
  readonly plate: HTMLElement
  readonly below: HTMLElement
}

interface Leaving {
  readonly element: HTMLElement
  readonly direction: PageDirection
  readonly x: MotionValue<number>
  readonly dim: MotionValue<number>
  readonly stop: () => void
}

/** What the outgoing page and bar contents left behind, read before React replaced them. */
export interface PageSnapshot {
  readonly direction: PageDirection
  readonly page: Leaving | null
  readonly row: HTMLElement | null
  readonly seed: { x: number; dim: number } | null
}

function veilOf(element: HTMLElement): HTMLElement | null {
  return element.querySelector<HTMLElement>('[data-page-veil]')
}

/**
 * The anchored bar and the pages under it (DESIGN SYSTEM § Top bar, § Page transition): a page
 * slides in under the bar while the previous one recedes and dims, back is the reverse, and the bar
 * only swaps its contents vertically and springs its height. Every value starts from where it stands.
 */
export class PageTransition {
  private readonly stageX = motionValue(0)
  private readonly stageDim = motionValue(0)
  private readonly stageOpacity = motionValue(1)
  private readonly rowY = motionValue(0)
  private readonly rowOpacity = motionValue(1)
  private readonly barOffset = motionValue(0)
  private parts: ShellParts | null = null
  private leaving: Leaving | null = null
  private generation = 0

  attach(parts: ShellParts): () => void {
    this.parts = parts
    const stops = [
      paintOn([this.stageX, this.barOffset, this.stageOpacity], () => {
        parts.stage.style.transform = translation(this.stageX.get(), this.barOffset.get())
        parts.stage.style.opacity =
          this.stageOpacity.get() === 1 ? '' : String(this.stageOpacity.get())
      }),
      paintOn([this.stageDim], () => {
        parts.dim.style.opacity = String(this.stageDim.get())
        parts.dim.style.display = this.stageDim.get() === 0 ? 'none' : 'block'
      }),
      paintOn([this.rowY, this.rowOpacity], () => {
        parts.row.style.transform = translation(0, this.rowY.get())
        parts.row.style.opacity = this.rowOpacity.get() === 1 ? '' : String(this.rowOpacity.get())
      }),
      paintOn([this.barOffset], () => {
        parts.plate.style.transform = translation(0, this.barOffset.get())
        parts.below.style.transform = translation(0, this.barOffset.get())
      }),
    ]
    return () => {
      stops.forEach((stop) => stop())
      this.dropLeaving()
      this.parts = null
    }
  }

  /** The bar grew by `delta` pixels (or shrank): it springs from its old height, the page with it. */
  barResized(delta: number) {
    // Under reduced motion the bar takes its new height at once.
    if (prefersReducedMotion()) return
    const velocity = this.barOffset.getVelocity()
    this.barOffset.jump(this.barOffset.get() - delta)
    void springTo(this.barOffset, 0, delta > 0 ? 'arrival' : 'departure', velocity)
  }

  /** Copies the outgoing page and bar contents, where they stand, before React replaces them. */
  capture(direction: PageDirection): PageSnapshot | null {
    const parts = this.parts
    if (!parts) return null
    const previous = this.leaving
    // Reversed mid-flight, the page coming back takes over from where its copy stood.
    const seed =
      previous && previous.direction !== direction
        ? { x: previous.x.get(), dim: previous.dim.get() }
        : null
    this.dropLeaving()
    if (prefersReducedMotion()) return { direction, page: null, row: null, seed: null }

    const pageX = this.stageX.get()
    const element = ghostOf(
      parts.stage,
      direction === 'forward' ? 10 : 30,
      pageX,
      this.barOffset.get(),
    )
    const x = motionValue(pageX)
    const dim = motionValue(this.stageDim.get())
    const veil = veilOf(element)
    const stop = paintOn([x, dim], () => {
      element.style.transform = translation(x.get(), 0)
      if (veil) Object.assign(veil.style, { opacity: String(dim.get()), display: 'block' })
    })
    const row = ghostOf(parts.row, 41, 0, this.rowY.get())
    row.style.opacity = String(this.rowOpacity.get())
    return { direction, page: { element, direction, x, dim, stop }, row, seed }
  }

  /** Plays the change once the new page is on the page, before it is painted. */
  play(snapshot: PageSnapshot) {
    const parts = this.parts
    if (!parts) return
    const generation = ++this.generation
    const forward = snapshot.direction === 'forward'
    const kind: SpringKind = forward ? 'arrival' : 'departure'

    if (!snapshot.page) {
      // Reduced motion: the new page and the bar's contents fade in where they stand.
      this.stageOpacity.jump(0)
      this.rowOpacity.jump(0)
      void springTo(this.stageOpacity, 1, kind)
      void springTo(this.rowOpacity, 1, kind)
      return
    }

    const width = parts.stage.getBoundingClientRect().width || window.innerWidth
    const page = snapshot.page
    this.leaving = page
    parts.stage.style.zIndex = '20'
    parts.stage.style.minHeight = `${Math.max(0, window.innerHeight - parts.stage.getBoundingClientRect().top)}px`

    this.stageX.jump(snapshot.seed?.x ?? (forward ? width : -RECEDED_SHIFT * width))
    this.stageDim.jump(snapshot.seed?.dim ?? (forward ? 0 : RECEDED_DIM))
    const moves = [
      springTo(this.stageX, 0, kind),
      springTo(this.stageDim, 0, kind),
      springTo(page.x, forward ? -RECEDED_SHIFT * width : width, kind),
      springTo(page.dim, forward ? RECEDED_DIM : 0, kind),
    ]
    void Promise.all(moves).then(() => {
      if (generation !== this.generation) return
      this.dropLeaving()
      parts.stage.style.zIndex = ''
      parts.stage.style.minHeight = ''
    })

    this.swapRow(snapshot.row, forward, kind)
  }

  /** The old contents rise out as the new come up from below; going back, the reverse. */
  private swapRow(old: HTMLElement | null, forward: boolean, kind: SpringKind) {
    const shift = forward ? BAR_SWAP_SHIFT : -BAR_SWAP_SHIFT
    this.rowY.jump(shift)
    this.rowOpacity.jump(0)
    void springTo(this.rowY, 0, kind)
    void springTo(this.rowOpacity, 1, kind)
    if (!old) return
    const y = motionValue(0)
    const opacity = motionValue(Number(old.style.opacity || 1))
    const stop = paintOn([y, opacity], () => {
      old.style.transform = translation(0, y.get())
      old.style.opacity = String(opacity.get())
    })
    void springTo(opacity, 0, 'departure')
    void springTo(y, -shift, 'departure').then(() => {
      stop()
      old.remove()
    })
  }

  private dropLeaving() {
    const leaving = this.leaving
    if (!leaving) return
    this.leaving = null
    leaving.x.stop()
    leaving.dim.stop()
    leaving.stop()
    leaving.element.remove()
  }
}
