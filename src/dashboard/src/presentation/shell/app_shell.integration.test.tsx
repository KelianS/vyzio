import { describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { appContainer } from '../../infrastructure/providers/app.container'
import { useRootStore } from '../../infrastructure/store/root.store'
import { AppContainerProvider } from '../../infrastructure/providers/app_container.context'
import { ToastProvider } from '../../common/components/toast'
import { AppShell } from './app_shell.component'
import { FULL_SCREEN } from './app_shell.handle'

describe('AppShell', () => {
  it('onMount_ShouldReadTheCamerasAndTheSystemForEveryScreen_WhenTheShellOpens', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(null),
    })

    // Act
    renderScreen(<AppShell />)

    // Assert
    expect(await screen.findByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    expect(network.sent).toContainEqual(expect.objectContaining({ route: 'GET /api/system/stats' }))
  })

  it('useCameraListFailureToast_ShouldSayWhy_WhenAReloadFailsUnderAShownList', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(null),
    })
    renderScreen(<AppShell />)
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    network.answer('GET /api/cameras', failure(500))

    // Act
    await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras · 500/)).toBeVisible()
  })

  it('AppShell_ShouldDrawNoHeader_WhenTheScreenTakesTheWholeViewport', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(null) })
    const router = createMemoryRouter(
      [
        {
          element: (
            <AppContainerProvider>
              <ToastProvider>
                <AppShell />
              </ToastProvider>
            </AppContainerProvider>
          ),
          children: [{ path: '/direct', element: <p>Image</p>, handle: FULL_SCREEN }],
        },
      ],
      { initialEntries: ['/direct'] },
    )

    // Act
    render(<RouterProvider router={router} />)

    // Assert
    expect(await screen.findByText('Image')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument()
  })
})
