import { useMemo } from 'react'

/** Builds a presenter exactly once per component scope — the single React-aware bridge. */
export function usePresenter<TContext, TPresenter>(
  factory: (context: TContext) => TPresenter,
  context: TContext,
): TPresenter {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; context (dispatch + container + toast) is stable
  return useMemo(() => factory(context), [])
}
