import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigationType } from 'react-router'
import { useGoBack } from '../navigation/use_go_back'
import { ArrowLeft, Settings, X } from 'lucide-react'
import { pageDirection, PageTransition } from '../motion/page_transition'
import { SnapshotBeforeCommit } from '../motion/snapshot_before_commit'
import { cn } from '../ui/utils'
import { PressableControl } from './pressable'

/** The places inside the bar a page fills: its title, and one action on its right. */
interface TopBarSlots {
  title: HTMLElement | null
  action: HTMLElement | null
}

const TopBarSlotsContext = createContext<TopBarSlots>({ title: null, action: null })

/** A page's title, drawn in the bar; outside the shell (a screen alone under test) in place. */
export function TopBarTitle({ children }: { children: ReactNode }) {
  const { title } = useContext(TopBarSlotsContext)
  return title ? createPortal(children, title) : children
}

/** The one icon button a page about one thing carries on the bar's right (DESIGN SYSTEM § Top bar). */
export function TopBarAction({ children }: { children: ReactNode }) {
  const { action } = useContext(TopBarSlotsContext)
  return action ? createPortal(children, action) : children
}

const ROUND_BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-bar-control text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** A round icon button of the bar. */
export function TopBarIconLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof Settings
}) {
  return (
    <PressableControl>
      <Link to={to} aria-label={label} className={ROUND_BUTTON}>
        <Icon className="size-5" aria-hidden="true" />
      </Link>
    </PressableControl>
  )
}

/** A round icon button of the bar that acts in the page, such as opening its filter. */
export function TopBarIconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: typeof Settings
  onClick: () => void
}) {
  return (
    <PressableControl>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={ROUND_BUTTON}
        onClick={onClick}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </PressableControl>
  )
}

/** Back to the previous page, home when the app opened here (UI-29). */
function BackButton() {
  const goBack = useGoBack()
  return (
    <PressableControl>
      <button type="button" aria-label="Retour" className={ROUND_BUTTON} onClick={() => goBack()}>
        <ArrowLeft className="size-5" aria-hidden="true" />
      </button>
    </PressableControl>
  )
}

/**
 * The one bar of the app (UI-29), anchored at the top: the product name and the gear at home, the
 * way back and the page's title elsewhere. `below` grows it downwards, for its alerts and the
 * settings' apply (UI-28, UI-30). The page fills the title through its `PageHeader`. Pages slide
 * under it while only its contents swap (DESIGN SYSTEM § Top bar, § Page transition).
 */
export function TopBar({
  home,
  gear = true,
  onClose,
  below,
  children,
}: {
  home: boolean
  /** Without Vyzio, the settings cannot open: the bar then carries the name alone (UI-34). */
  gear?: boolean
  /** The settings' way out, a cross at the far right (UI-29). */
  onClose?: () => void
  below?: ReactNode
  children: ReactNode
}) {
  const [title, setTitle] = useState<HTMLElement | null>(null)
  const [action, setAction] = useState<HTMLElement | null>(null)
  const slots = useMemo(() => ({ title, action }), [title, action])
  const { key } = useLocation()
  const direction = pageDirection(useNavigationType())
  const [transition] = useState(() => new PageTransition())
  const header = useRef<HTMLElement>(null)
  const plate = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const belowSlot = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!plate.current || !row.current || !belowSlot.current || !stage.current || !veil.current)
      return
    return transition.attach({
      stage: stage.current,
      dim: veil.current,
      row: row.current,
      plate: plate.current,
      below: belowSlot.current,
    })
  }, [transition])

  useLayoutEffect(() => {
    const bar = header.current
    if (!bar) return
    let last: { width: number; height: number } | null = null
    const observer = new ResizeObserver(() => {
      const now = { width: bar.offsetWidth, height: bar.offsetHeight }
      // A wider or narrower window lays the bar out again: only an alert coming or going springs it.
      if (last && last.width === now.width && last.height !== now.height)
        transition.barResized(now.height - last.height)
      last = now
    })
    observer.observe(bar)
    return () => observer.disconnect()
  }, [transition])

  return (
    <TopBarSlotsContext.Provider value={slots}>
      <SnapshotBeforeCommit
        trigger={key}
        capture={() => (direction ? transition.capture(direction) : null)}
        play={(snapshot) => transition.play(snapshot)}
      >
        {/* A page or a tab sliding past the screen's edge never lets the screen scroll sideways. */}
        <div className="overflow-x-clip">
          <header
            ref={header}
            className={cn(
              // Below the Radix layers (`z-50`): a dialog or a list opened near the top covers it.
              'sticky top-0 z-40 text-foreground',
              'px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4',
            )}
          >
            {/* The bar's colour reaches above the screen, so its height springs by moving its bottom edge. */}
            <div
              ref={plate}
              aria-hidden="true"
              className="absolute inset-x-0 -top-[100vh] bottom-0 rounded-b-panel bg-bar"
            />
            <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-4">
              <div ref={row}>
                {home ? (
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    <span className="text-title font-bold">Vyzio</span>
                    {gear && <TopBarIconLink to="/settings" label="Réglages" icon={Settings} />}
                  </div>
                ) : (
                  <div className="flex min-h-11 items-center gap-3">
                    <BackButton />
                    <div ref={setTitle} className="min-w-0 flex-1" />
                    <div ref={setAction} className="contents" />
                    {onClose && (
                      <PressableControl>
                        <button
                          type="button"
                          aria-label="Fermer"
                          className={ROUND_BUTTON}
                          onClick={onClose}
                        >
                          <X className="size-5" aria-hidden="true" />
                        </button>
                      </PressableControl>
                    )}
                  </div>
                )}
              </div>
              {/* An alert slides out from under the bar's contents, never over them. */}
              <div className="overflow-hidden has-[>:empty]:hidden">
                <div ref={belowSlot} className="flex flex-col gap-4">
                  {below}
                </div>
              </div>
            </div>
          </header>
          <div ref={stage} className="relative bg-background">
            {children}
            <div
              ref={veil}
              data-page-veil
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-50 hidden bg-black"
            />
          </div>
        </div>
      </SnapshotBeforeCommit>
    </TopBarSlotsContext.Provider>
  )
}
