/** The live view's own address: a screen, never a layer over a page (SPECS 7.2). */
export const LIVE_VIEW_ROUTE = '/cameras/:cameraId/direct'

const LIVE_VIEW_PATH = /^\/cameras\/[^/]+\/direct$/

export function liveViewPath(cameraId: string): string {
  return `/cameras/${encodeURIComponent(cameraId)}/direct`
}

export function isLiveViewPath(pathname: string): boolean {
  return LIVE_VIEW_PATH.test(pathname)
}
