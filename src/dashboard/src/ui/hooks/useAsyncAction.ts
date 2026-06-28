import { useCallback, useState } from 'react'
import type { AppError } from '../../domain/errors/AppError'
import { appErrorMessage } from '../../domain/errors/AppError'
import { toAppError } from '../../domain/errors/toAppError'
import { useToast } from '../components/Toast'

export interface AsyncActionResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>
  loading: boolean
  error: AppError | null
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: { onSuccess?: (result: TResult) => void; silent?: boolean } = {},
): AsyncActionResult<TArgs, TResult> {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setLoading(true)
      setError(null)
      try {
        const result = await fn(...args)
        options.onSuccess?.(result)
        return result
      } catch (e) {
        const appError = toAppError(e)
        setError(appError)
        if (!options.silent) {
          toast(appErrorMessage(appError), 'error')
        }
        return undefined
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, options.silent, options.onSuccess, toast],
  )

  return { run, loading, error }
}
