import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Back to the previous page, or to `fallback` when the app opened on this one (UI-29). */
export function useGoBack(): (fallback?: string) => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  // The router names the first entry of the session `default`: nothing of the app to go back to.
  return useCallback(
    (fallback = '/') =>
      void (key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1)),
    [key, navigate],
  )
}
