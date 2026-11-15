import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { TopBar } from '../../common/components/top_bar'
import { usePresenter } from '../../common/presenter/use_presenter'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import { useCameraListFailureToast } from '../cameras/camera_list_read'
import { NavigationGuard } from '../navigation/navigation_guard.component'
import { isSettingsPath } from '../settings/settings.rubrics'
import { RestartSurveillanceTrigger } from '../surveillance/restart_surveillance_trigger.component'
import { buildAppShellPresenter } from './app_shell.presenter'
import { isFullScreen } from './app_shell.handle'
import { barAlerts } from './bar_alerts'
import { BarAlertList } from './components/bar_alert_list'

/** The frame every signed-in screen sits in, and the reads they all share. */
export function AppShell() {
  const { cameras: camerasContainer, hub: hubContainer } = useAppContainer()
  const presenter = usePresenter(buildAppShellPresenter, { camerasContainer, hubContainer })
  useCameraListFailureToast()

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => presenter.onWatchSystem(), [presenter])

  const { pathname } = useLocation()
  const fullScreen = useMatches().some((match) => isFullScreen(match.handle))
  const cameras = useRootStore((s) => s.cameras)
  const systemStats = useRootStore((s) => s.systemStats)
  const hubLost = useRootStore((s) => s.hubLost)
  const restartFailed = useRootStore((s) => s.restartFailure !== null)

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
    <TopBar
      home={pathname === '/'}
      below={
        <>
          <BarAlertList alerts={barAlerts({ cameras, systemStats, hubLost, restartFailed })} />
          {/* The restart is asked for from the settings only (UI-28). */}
          {isSettingsPath(pathname) && <RestartSurveillanceTrigger />}
        </>
      }
    >
      {/* The only navigation guard: react-router accepts a single one. */}
      <NavigationGuard />
      <div className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-6 pb-10 *:min-w-0">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </TopBar>
  )
}
