/** What a route tells the shell about the frame around it. */
interface ShellRouteHandle {
  /** The screen covers the whole viewport: the shell draws no header around it. */
  readonly fullScreen?: boolean
}

export const FULL_SCREEN: ShellRouteHandle = { fullScreen: true }

export function isFullScreen(handle: unknown): boolean {
  return (handle as ShellRouteHandle | undefined)?.fullScreen === true
}
