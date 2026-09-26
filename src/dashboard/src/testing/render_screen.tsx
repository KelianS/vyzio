import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { ToastProvider } from '../common/components/toast'
import { AppContainerProvider } from '../infrastructure/providers/app_container.context'
import { useRootStore } from '../infrastructure/store/root.store'

/** Where the screen sits: its route pattern, and the address the test opens. */
interface ScreenAddress {
  path: string
  url: string
}

/** Mounts a screen as the app does: real container, real store, a data router and the toasts. */
export function renderScreen(
  screen: ReactElement,
  { path, url }: ScreenAddress = { path: '*', url: '/' },
) {
  // The store outlives a test otherwise: one screen's cameras would leak into the next.
  useRootStore.setState(useRootStore.getInitialState(), true)
  const router = createMemoryRouter(
    [
      {
        element: (
          <AppContainerProvider>
            <ToastProvider>
              <Outlet />
            </ToastProvider>
          </AppContainerProvider>
        ),
        children: [{ path, element: screen }],
      },
    ],
    { initialEntries: [url] },
  )
  return { router, ...render(<RouterProvider router={router} />) }
}
