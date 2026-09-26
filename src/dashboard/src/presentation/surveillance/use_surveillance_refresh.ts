import { useCallback } from 'react'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'

// Called after a save: the background poll would find it seconds later, which reads as nothing happening.
export function useSurveillanceRefresh() {
  const { hub } = useAppContainer()

  return useCallback(() => {
    void useRootStore.getState().loadSystemStats(hub.getSystemStats)
  }, [hub])
}
