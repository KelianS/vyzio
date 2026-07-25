import type { GetVendorAssistance } from '../../domain/usecases/GetVendorAssistance'
import { useAsync } from '../../common/hooks/useAsync'

export function useVendorAssistance(
  useCase: GetVendorAssistance,
  vendorFamily: string | null,
  streamPath: string | null,
  connected: boolean,
) {
  return useAsync(
    () => useCase.execute({ vendorFamily: vendorFamily!, streamPath, connected }),
    [useCase, vendorFamily, streamPath, connected],
    { initialLoading: false, skip: !vendorFamily },
  )
}
