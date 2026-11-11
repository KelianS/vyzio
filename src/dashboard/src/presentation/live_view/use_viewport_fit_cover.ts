import { useEffect } from 'react'

const COVER = 'viewport-fit=cover'

/** Lets the picture reach under the notch while this screen is shown; every other page keeps the browser's margins. */
export function useViewportFitCover() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return
    const saved = meta.content
    meta.content = `${saved}, ${COVER}`
    return () => {
      meta.content = saved
    }
  }, [])
}
