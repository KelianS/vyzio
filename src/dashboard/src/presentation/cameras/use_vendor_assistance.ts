import type { GetVendorAssistance } from '../../domain/usecases/get_vendor_assistance.use_case'
import { useAsync } from '../../common/hooks/use_async'

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
