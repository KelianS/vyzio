import type { ReactNode } from 'react'
import { cn } from '../../../common/ui/utils'
import { ViewTab } from './view_tab'

const LABEL: Record<ViewTab, string> = {
  controls: 'Contrôles',
  detections: 'Détections',
}

const ORDER: ViewTab[] = [ViewTab.Controls, ViewTab.Detections]

/** Two pills in one track, the selected one raised (DESIGN SYSTEM § Tabs), and the selected tab's panel. */
export function ViewTabs({
  current,
  onChoose,
  children,
}: {
  current: ViewTab
  onChoose: (tab: ViewTab) => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-card p-1">
        {ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={tab === current}
            aria-controls={`panel-${tab}`}
            onClick={() => onChoose(tab)}
            className={cn(
              'flex h-11 items-center justify-center rounded-full text-body outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              tab === current
                ? 'bg-secondary font-semibold text-foreground'
                : 'font-medium text-muted-foreground',
            )}
          >
            {LABEL[tab]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`}>
        {children}
      </div>
    </div>
  )
}
