import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { cn } from '../ui/utils'
import { useTabPager } from '../motion/use_tab_pager'
import { TabIndicator, TabPanel } from './tab_pager'

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

/** A plain left click, the one that opens the tab here rather than elsewhere. */
function opensHere(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/**
 * One row of tabs that scrolls on a phone, shows there is more, and keeps the current tab in view;
 * `children`, the current tab's content, follows a sideways finger to the next (DESIGN SYSTEM § Tabs).
 */
export function TabBar({
  label,
  tabs,
  children,
}: {
  label: string
  tabs: readonly Tab[]
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [edges, setEdges] = useState({ start: false, end: false })
  const index = tabs.findIndex((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))
  // A tab is the same page seen another way: switching never adds a step for the back button (UI-29).
  const pager = useTabPager(index, tabs.length, (next) =>
    navigate(tabs[next].to, { replace: true }),
  )

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
    const reveal = () => {
      ref.current
        ?.querySelector('[aria-current="page"]')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      measure()
    }
    reveal()
    // Once the font arrives the tabs widen: revealed again, or the last one ends half hidden.
    void document.fonts?.ready.then(reveal)
  }, [pathname, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const mask = fadeMask(edges.start, edges.end)

  return (
    <>
      <nav
        ref={ref}
        aria-label={label}
        onScroll={measure}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabIndicator pager={pager} index={index} className="h-11" />
        {tabs.map((tab, at) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            replace
            data-tab
            onClick={(event) => opensHere(event) && pager.prepare(at)}
            className={({ isActive }) =>
              cn(
                'relative inline-flex h-11 shrink-0 items-center rounded-full px-4 text-body font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <TabPanel pager={pager}>{children}</TabPanel>
    </>
  )
}
