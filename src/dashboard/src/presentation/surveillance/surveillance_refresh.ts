import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { useRootStore } from '../../infrastructure/store/root.store'

// Called after a save: the background poll would find it seconds later, which reads as nothing happening.
export function refreshSurveillance(hubContainer: HubContainer): void {
  void useRootStore.getState().loadSystemStats(hubContainer.getSystemStats)
}
