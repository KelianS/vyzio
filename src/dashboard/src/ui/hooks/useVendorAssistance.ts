import type { VendorAssistance } from '../../domain/entities/VendorAssistance'
import type { GetVendorAssistance } from '../../application/use-cases/GetVendorAssistance'
import { useAsync } from './useAsync'

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
