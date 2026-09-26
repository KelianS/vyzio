import { useRootStore } from '../../infrastructure/store/root.store'

/** What the header trigger and the navigation guard both show of a restart (ADR-44). */
export function useRestartState() {
  const restarting = useRootStore((state) => state.restarting)
  const failure = useRootStore((state) => state.restartFailure)
  const pending = useRootStore((state) => state.systemStats?.pendingChanges ?? false)
  return { pending, restarting, failure }
}
