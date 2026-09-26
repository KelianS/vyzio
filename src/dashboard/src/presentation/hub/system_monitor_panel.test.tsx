import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { SystemMonitorPanel } from './system_monitor_panel'

const running: SystemStats = {
  status: 'active',
  storage: { totalGb: 100, usedGb: 95, freeGb: 5 },
  cameras: [{ camera: 'front_door', fps: 0.5 }],
  detection: { hardware: 'edge_tpu', targetFps: 5 },
  pendingChanges: false,
}

function renderPanel(stats: SystemStats) {
  render(
    <MemoryRouter>
      <SystemMonitorPanel stats={stats} />
    </MemoryRouter>,
  )
}

describe('SystemMonitorPanel', () => {
  it('SystemMonitorPanel_ShouldShowTheMeasures_WhenSurveillanceRuns', () => {
    // Arrange & Act
    renderPanel(running)

    // Assert
    expect(screen.getByText('En marche')).toBeInTheDocument()
    expect(screen.getByText('Accélérateur dédié · 5 images par seconde')).toBeInTheDocument()
    expect(screen.getByText('5 Go libres sur 100 Go')).toBeInTheDocument()
    expect(screen.getByText('front door')).toBeInTheDocument()
    expect(screen.getByText('0.5/s')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Détails techniques' })).toBeInTheDocument()
  })

  it('SystemMonitorPanel_ShouldLeaveOutDiskAndCameras_WhenNeitherIsReported', () => {
    // Arrange & Act
    renderPanel({ ...running, storage: null, cameras: [] })

    // Assert
    expect(screen.queryByText('Espace disque')).not.toBeInTheDocument()
    expect(screen.queryByText('Images reçues')).not.toBeInTheDocument()
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
