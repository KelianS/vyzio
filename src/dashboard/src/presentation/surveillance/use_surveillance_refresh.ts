import { useCallback } from 'react'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { refreshSurveillance } from './surveillance_refresh'

export function useSurveillanceRefresh() {
  const { hub } = useAppContainer()

  return useCallback(() => refreshSurveillance(hub), [hub])
}
