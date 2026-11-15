import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useGoBack } from '../navigation/use_go_back'
import { ArrowLeft, Settings } from 'lucide-react'
import { cn } from '../ui/utils'
import { PressableControl } from './pressable'

/** Where a page puts its title: a place inside the bar, filled from the page. */
const TopBarTitleContext = createContext<HTMLElement | null>(null)

/** A page's title, drawn in the bar; outside the shell (a screen alone under test) in place. */
export function TopBarTitle({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarTitleContext)
  return slot ? createPortal(children, slot) : children
}

const ROUND_BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-bar-control text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** A round icon button of the bar. */
function TopBarIconLink({
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
 * settings' apply (UI-28, UI-30). The page fills the title through its `PageHeader`.
 */
export function TopBar({
  home,
  below,
  children,
}: {
  home: boolean
  below?: ReactNode
  children: ReactNode
}) {
  const [title, setTitle] = useState<HTMLElement | null>(null)

  return (
    <TopBarTitleContext.Provider value={title}>
      <header
        className={cn(
          // Below the Radix layers (`z-50`): a dialog or a list opened near the top covers it.
          'sticky top-0 z-40 rounded-b-panel bg-bar text-foreground',
          'px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4',
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {home ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-title font-bold">Vyzio</span>
              <TopBarIconLink to="/settings" label="Réglages" icon={Settings} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <BackButton />
              <div ref={setTitle} className="min-w-0 flex-1" />
            </div>
          )}
          {below}
        </div>
      </header>
      {children}
    </TopBarTitleContext.Provider>
  )
}
