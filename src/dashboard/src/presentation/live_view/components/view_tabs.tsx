import type { ReactNode } from 'react'
import { TabIndicator, TabPanel } from '../../../common/components/tab_pager'
import { useTabPager } from '../../../common/motion/use_tab_pager'
import { cn } from '../../../common/ui/utils'
import { ViewTab } from './view_tab'

const LABEL: Record<ViewTab, string> = {
  controls: 'Contrôles',
  detections: 'Détections',
}

const ORDER: ViewTab[] = [ViewTab.Controls, ViewTab.Detections]

/**
 * Two pills in one track, the selected one raised (DESIGN SYSTEM § Tabs), and the selected tab's
 * panel, which a sideways finger drags to the other; the steering pad keeps its own drags.
 */
export function ViewTabs({
  current,
  onChoose,
  children,
}: {
  current: ViewTab
  onChoose: (tab: ViewTab) => void
  children: ReactNode
}) {
  const index = ORDER.indexOf(current)
  const pager = useTabPager(index, ORDER.length, (next) => onChoose(ORDER[next]))

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="relative grid grid-cols-2 gap-1 rounded-full bg-card p-1">
        <TabIndicator pager={pager} index={index} className="top-1 h-11" />
        {ORDER.map((tab, at) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            data-tab
            aria-selected={tab === current}
            aria-controls={`panel-${tab}`}
            onClick={() => pager.choose(at)}
            className={cn(
              'relative flex h-11 items-center justify-center rounded-full text-body outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              tab === current
                ? 'font-semibold text-foreground'
                : 'font-medium text-muted-foreground',
            )}
          >
            {LABEL[tab]}
          </button>
        ))}
      </div>
      <TabPanel
        pager={pager}
        role="tabpanel"
        id={`panel-${current}`}
        aria-labelledby={`tab-${current}`}
      >
        {children}
      </TabPanel>
    </div>
  )
}
