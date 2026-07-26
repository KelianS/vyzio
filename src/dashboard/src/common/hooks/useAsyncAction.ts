import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { AppError } from '../errors/AppError'
import { appErrorMessage } from '../errors/AppError'
import { toAppError } from '../errors/toAppError'
import { useToast } from '../components/Toast'

export interface AsyncActionResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>
  loading: boolean
  error: AppError | null
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    onSuccess?: (result: TResult) => void
    onError?: (error: AppError) => void
    silent?: boolean
  } = {},
): AsyncActionResult<TArgs, TResult> {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)

  const fnRef = useRef(fn)
  const optionsRef = useRef(options)
  useLayoutEffect(() => {
    fnRef.current = fn
    optionsRef.current = options
  })

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setLoading(true)
      setError(null)
      try {
        const result = await fnRef.current(...args)
        optionsRef.current.onSuccess?.(result)
        return result
      } catch (e) {
        const appError = toAppError(e)
        setError(appError)
        if (optionsRef.current.onError) {
          optionsRef.current.onError(appError)
        } else if (!optionsRef.current.silent) {
          toast(appErrorMessage(appError), 'error')
        }
        return undefined
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  return { run, loading, error }
}
