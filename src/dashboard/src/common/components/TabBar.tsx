import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { cn } from '../ui/utils'

interface Tab {
  readonly to: string
  readonly label: string
}

const FADE = '2rem'

// An alpha mask, not a colour: the tabs fade out on the side where more of them are hidden.
function fadeMask(start: boolean, end: boolean): string | undefined {
  if (start && end)
    return `linear-gradient(to right, transparent, black ${FADE}, black calc(100% - ${FADE}), transparent)`
  if (end) return `linear-gradient(to right, black calc(100% - ${FADE}), transparent)`
  if (start) return `linear-gradient(to right, transparent, black ${FADE})`
  return undefined
}

/** One row of tabs that scrolls on a phone, shows there is more, and keeps the current tab in view. */
export function TabBar({ label, tabs }: { label: string; tabs: readonly Tab[] }) {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const bar = ref.current
    if (!bar) return
    setEdges({
      start: bar.scrollLeft > 1,
      end: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    // Landing straight on the last tab must not leave it scrolled out of sight.
    ref.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [pathname, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const mask = fadeMask(edges.start, edges.end)

  return (
    <nav
      ref={ref}
      aria-label={label}
      onScroll={measure}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'shrink-0 rounded-lg px-3 py-2 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:bg-card/60',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
