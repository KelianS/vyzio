import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { SystemStats } from '../../../domain/entities/system_stats.entity'
import { makeCamera } from '../../../testing/camera_fixture'
import { SystemMonitorPanel } from './system_monitor_panel'

const running: SystemStats = {
  status: 'active',
  storage: { totalGb: 100, usedGb: 95, freeGb: 5 },
  cameras: [{ camera: 'front_door', fps: 10 }],
  detection: { hardware: 'edge_tpu', targetFps: 5 },
  pendingChanges: false,
}

const cameras = [makeCamera({ frigateCameraName: 'front_door', displayName: 'Porte d’entrée' })]

function renderPanel(stats: SystemStats, onDiagnose = () => undefined) {
  render(
    <MemoryRouter>
      <SystemMonitorPanel stats={stats} cameras={cameras} onDiagnose={onDiagnose} />
    </MemoryRouter>,
  )
}

describe('SystemMonitorPanel', () => {
  it('SystemMonitorPanel_ShouldShowTheStateAndTheDiskAndFoldTheFigures_WhenSurveillanceRuns', () => {
    // Arrange & Act
    renderPanel(running)

    // Assert
    expect(screen.getByRole('img', { name: 'En marche' })).toBeVisible()
    expect(screen.getByText('5 Go libres sur 100 Go')).toBeVisible()
    expect(screen.getByText('Accélérateur dédié · 5 images par seconde')).not.toBeVisible()
    expect(screen.getByText('Porte d’entrée')).not.toBeVisible()
  })

  it('SystemMonitorPanel_ShouldKeepTheDetailsClosedAndTheFigureNeutral_WhenACameraSendsFewImages', () => {
    // Arrange & Act
    renderPanel({ ...running, cameras: [{ camera: 'front_door', fps: 0.5 }] })

    // Assert
    expect(screen.getByText('0,5')).not.toBeVisible()
    expect(screen.getByText('0,5')).not.toHaveClass('text-destructive')
    expect(screen.queryByText(/Trop peu d’images/)).not.toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldSayTheCameraWasRemovedOrRenamed_WhenVyzioDoesNotKnowIt', () => {
    // Arrange & Act
    renderPanel({ ...running, cameras: [{ camera: 'old_name', fps: 0 }] })

    // Assert
    expect(screen.getByText('Caméra retirée ou renommée')).toBeInTheDocument()
    expect(screen.queryByText('old_name')).not.toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldLeaveOutDiskAndCameras_WhenNeitherIsReported', () => {
    // Arrange & Act
    renderPanel({ ...running, storage: null, cameras: [] })

    // Assert
    expect(screen.queryByText('Espace disque')).not.toBeInTheDocument()
    expect(screen.queryByText('Images reçues par seconde')).not.toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldSayTheMeasuresComeBackWithNoDiagnosis_WhenSurveillanceRestarts', () => {
    // Arrange & Act
    renderPanel({ ...running, status: 'restarting' })

    // Assert
    expect(screen.getByText('Les mesures réapparaîtront d’elles-mêmes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Diagnostiquer' })).not.toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldOfferADiagnosis_WhenSurveillanceIsStopped', async () => {
    // Arrange
    const onDiagnose = vi.fn()
    renderPanel({ ...running, status: 'unavailable' }, onDiagnose)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Diagnostiquer' }))

    // Assert
    expect(screen.getByText('Arrêtée')).toBeInTheDocument()
    expect(onDiagnose).toHaveBeenCalledOnce()
  })
})
