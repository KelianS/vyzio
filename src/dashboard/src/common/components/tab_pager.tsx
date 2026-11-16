import { useLayoutEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { paintOn } from '../motion/ghost'
import type { TabPager } from '../motion/use_tab_pager'
import { cn } from '../ui/utils'

/** The raised pill under the selected tab, following the pager between two tabs (DESIGN SYSTEM § Tabs). */
export function TabIndicator({
  pager,
  index,
  className,
}: {
  pager: TabPager
  index: number
  className?: string
}) {
  const [pill, setPill] = useState<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const track = pill?.parentElement
    if (!pill || !track) return
    const tabs = () => [...track.querySelectorAll<HTMLElement>('[data-tab]')]
    const base = () => Math.max(1, tabs()[index]?.offsetWidth ?? 1)
    const paint = () => {
      const all = tabs()
      if (index < 0 || all.length === 0) {
        pill.style.display = 'none'
        return
      }
      const at = Math.max(0, Math.min(all.length - 1, pager.progress.get()))
      const from = all[Math.floor(at)]
      const to = all[Math.ceil(at)]
      const share = at - Math.floor(at)
      const left = from.offsetLeft + (to.offsetLeft - from.offsetLeft) * share
      const width = from.offsetWidth + (to.offsetWidth - from.offsetWidth) * share
      pill.style.display = ''
      if (pill.style.width !== `${base()}px`) pill.style.width = `${base()}px`
      pill.style.transform = `translate3d(${left}px, 0, 0) scaleX(${width / base()})`
    }
    const stop = paintOn([pager.progress], paint)
    // The tabs widen once the font arrives, and with the window.
    const resized = new ResizeObserver(paint)
    resized.observe(track)
    return () => {
      stop()
      resized.disconnect()
    }
  }, [pill, pager, index])

  return (
    <span
      ref={setPill}
      aria-hidden="true"
      className={cn('absolute top-0 left-0 origin-left rounded-full bg-secondary', className)}
    />
  )
}

/** The content under a tab bar, which a sideways finger drags between the tabs. */
export function TabPanel({
  pager,
  children,
  ...props
}: {
  pager: TabPager
  children: ReactNode
} & Omit<ComponentProps<'div'>, 'ref'>) {
  return (
    <div
      {...pager.panelProps}
      {...props}
      className={cn('touch-pan-y touch-pinch-zoom', props.className)}
    >
      {children}
    </div>
  )
}
