import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { SystemMonitorPanel } from './system_monitor_panel'

const running: SystemStats = {
  status: 'active',
  storage: { totalGb: 100, usedGb: 95, freeGb: 5 },
  cameras: [{ camera: 'front_door', fps: 10 }],
  detection: { hardware: 'edge_tpu', targetFps: 5 },
  pendingChanges: false,
}

const cameras = [makeCamera({ frigateCameraName: 'front_door', displayName: 'Porte d’entrée' })]

function renderPanel(stats: SystemStats) {
  render(
    <MemoryRouter>
      <SystemMonitorPanel stats={stats} cameras={cameras} />
    </MemoryRouter>,
  )
}

describe('SystemMonitorPanel', () => {
  it('SystemMonitorPanel_ShouldShowTheStateAndTheDiskAndFoldTheFigures_WhenSurveillanceRuns', () => {
    // Arrange & Act
    renderPanel(running)

    // Assert
    expect(screen.getByText('En marche')).toBeVisible()
    expect(screen.getByText('5 Go libres sur 100 Go')).toBeVisible()
    expect(screen.getByText('Accélérateur dédié · 5 images par seconde')).not.toBeVisible()
    expect(screen.getByText('Porte d’entrée')).not.toBeVisible()
    expect(screen.getByRole('link', { name: 'Ouvrir l’interface technique' })).toHaveAttribute(
      'href',
      '/settings/systeme/avance',
    )
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
    expect(screen.queryByText(/Trop peu d’images/)).not.toBeInTheDocument()
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
    expect(screen.queryByRole('link', { name: 'Diagnostiquer' })).not.toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldOfferADiagnosis_WhenSurveillanceIsStopped', () => {
    // Arrange & Act
    renderPanel({ ...running, status: 'unavailable' })

    // Assert
    expect(screen.getByText('Arrêtée')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Diagnostiquer' })).toHaveAttribute(
      'href',
      '/settings/systeme/avance',
    )
  })
})
