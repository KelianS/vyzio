import { useLayoutEffect, useRef, useState } from 'react'
import { motionValue, type MotionValue } from 'motion/react'
import { projection, rubberBand, startsOnControl, useFingerDrag } from './gesture'
import { ghostOf, paintOn, translation } from './ghost'
import { prefersReducedMotion, springTo } from './springs'

/** What the content does once the tab changes: slide in beside its copy leaving, or fade in. */
type HandOff =
  | {
      kind: 'slide'
      copy: HTMLElement
      x: MotionValue<number>
      stop: () => void
      from: number
      to: number
    }
  | { kind: 'fade' }

/** A tab bar's shared motion: the tab shown, fractional while a finger or a spring moves between two. */
export interface TabPager {
  readonly progress: MotionValue<number>
  /** Moves to tab `next`: the content slides there once it shows, and settles back if refused. */
  readonly choose: (next: number) => void
  /** What the content's wrapper takes: its element, and the finger's handlers. */
  readonly panelProps: ReturnType<typeof useFingerDrag> & {
    ref: (element: HTMLDivElement | null) => void
  }
}

/**
 * Tabs whose content follows a sideways finger and lands on the tab its momentum projects
 * (DESIGN SYSTEM § Tabs); a drag that starts on a control is the control's, never the tabs'.
 */
export function useTabPager(
  index: number,
  count: number,
  onChoose: (next: number) => void | Promise<void>,
): TabPager {
  const [progress] = useState(() => motionValue(index))
  const [offset] = useState(() => motionValue(0))
  const [opacity] = useState(() => motionValue(1))
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const handOff = useRef<HandOff | null>(null)
  const shown = useRef(index)

  useLayoutEffect(() => {
    if (!panel) return
    return paintOn([offset, opacity], () => {
      panel.style.transform = translation(offset.get(), 0)
      panel.style.opacity = opacity.get() === 1 ? '' : String(opacity.get())
    })
  }, [panel, offset, opacity])

  useLayoutEffect(() => {
    shown.current = index
    const pending = handOff.current
    handOff.current = null
    if (index < 0) return
    if (!pending) {
      void springTo(progress, index, 'arrival')
      return
    }
    if (pending.kind === 'fade') {
      progress.jump(index)
      offset.jump(0)
      opacity.jump(0)
      void springTo(opacity, 1, 'arrival')
      return
    }
    void springTo(progress, index, 'arrival')
    document.body.append(pending.copy)
    offset.jump(pending.from)
    void springTo(offset, 0, 'arrival')
    void springTo(pending.x, pending.to, 'arrival').then(() => {
      pending.stop()
      pending.copy.remove()
    })
  }, [index, progress, offset, opacity])

  const prepare = (next: number) => {
    if (next === index || !panel) return
    if (prefersReducedMotion()) {
      handOff.current = { kind: 'fade' }
      return
    }
    const width = panel.getBoundingClientRect().width || window.innerWidth
    const from = offset.get()
    // Copied where it stands, but laid on the page only once the next tab shows.
    const copy = ghostOf(panel, 5, from)
    copy.remove()
    const x = motionValue(from)
    const stop = paintOn([x], () => {
      copy.style.transform = translation(x.get(), 0)
    })
    // Towards a later tab the content leaves to the left and the next one comes from the right.
    const side = next > index ? -1 : 1
    handOff.current = { kind: 'slide', copy, x, stop, from: from - side * width, to: side * width }
  }

  /** A change refused (a page with unsaved edits kept) leaves everything as if nothing happened. */
  const settleBack = (refused: HandOff) => {
    if (handOff.current !== refused) return
    handOff.current = null
    if (refused.kind === 'slide') refused.stop()
    void springTo(offset, 0, 'arrival')
    void springTo(progress, shown.current, 'arrival')
  }

  const choose = (next: number) => {
    if (next === index) return
    prepare(next)
    const pending = handOff.current
    // Once the router answered and React had its frames to show the tab, a hand-off still waiting was refused.
    void Promise.resolve(onChoose(next)).then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (pending) settleBack(pending)
        }),
      ),
    )
  }

  const widthOf = () => Math.max(1, panel?.getBoundingClientRect().width || window.innerWidth)

  const panelHandlers = useFingerDrag('x', {
    canStart: (target) => index >= 0 && !startsOnControl(target),
    onStart: () => {
      offset.stop()
      progress.stop()
      opacity.jump(1)
    },
    onMove: (moved) => {
      const width = widthOf()
      const pastEnd = (index === 0 && moved > 0) || (index === count - 1 && moved < 0)
      const next = !pastEnd ? moved : prefersReducedMotion() ? 0 : rubberBand(moved, width)
      offset.set(next)
      progress.set(index - next / width)
    },
    onEnd: (_moved, velocity) => {
      const width = widthOf()
      const landing = Math.round(index - (offset.get() + projection(velocity)) / width)
      // One tab at a time, never past the first or the last.
      const target = Math.max(
        Math.max(0, index - 1),
        Math.min(Math.min(count - 1, index + 1), landing),
      )
      if (target === index) {
        void springTo(offset, 0, 'arrival', velocity)
        void springTo(progress, index, 'arrival')
        return
      }
      choose(target)
    },
  })

  return { progress, choose, panelProps: { ...panelHandlers, ref: setPanel } }
}
