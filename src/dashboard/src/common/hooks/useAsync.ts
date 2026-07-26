import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppError } from '../errors/AppError'
import { toAppError } from '../errors/toAppError'

export interface AsyncResult<T> {
  data: T | null
  loading: boolean
  error: AppError | null
  reload: () => void
}

export function useAsync<T>(
  fn: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[],
  options: { initialLoading?: boolean; skip?: boolean } = {},
): AsyncResult<T> {
  const { initialLoading = true, skip = false } = options
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: AppError | null }>({
    data: null,
    loading: initialLoading && !skip,
    error: null,
  })

  const fnRef = useRef(fn)
  useLayoutEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    if (skip) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toAppError(e) })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken, skip])

  return { ...state, reload: () => setReloadToken((t) => t + 1) }
}
