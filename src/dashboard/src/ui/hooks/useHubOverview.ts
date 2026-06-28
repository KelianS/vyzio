import type { HubOverview } from '../../domain/entities/HubOverview'
import type { GetHubOverview } from '../../application/use-cases/GetHubOverview'
import { useAsync } from './useAsync'

export function useHubOverview(useCase: GetHubOverview) {
  return useAsync(() => useCase.execute(), [useCase])
}
