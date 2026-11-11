import { Suspense, useEffect } from 'react'
import { Outlet, useMatches } from 'react-router'
import { AppHeader } from '../../common/components/app_header'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useCameraListFailureToast } from '../cameras/camera_list_read'
import { NavigationGuard } from '../navigation/navigation_guard.component'
import { RestartSurveillanceTrigger } from '../surveillance/restart_surveillance_trigger.component'
import { buildAppShellPresenter } from './app_shell.presenter'
import { isFullScreen } from './app_shell.handle'

/** The frame every signed-in screen sits in, and the reads they all share. */
export function AppShell() {
  const { cameras: camerasContainer, hub: hubContainer } = useAppContainer()
  const presenter = usePresenter(buildAppShellPresenter, { camerasContainer, hubContainer })
  useCameraListFailureToast()

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => presenter.onWatchSystem(), [presenter])

  const fullScreen = useMatches().some((match) => isFullScreen(match.handle))

  if (fullScreen)
    return (
      <>
        <NavigationGuard />
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </>
    )

  return (
    <div className="grid min-w-0 max-w-full gap-6 pt-5 *:min-w-0">
      <AppHeader trailing={<RestartSurveillanceTrigger />} />
      {/* The only navigation guard: react-router accepts a single one. */}
      <NavigationGuard />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </div>
  )
}
