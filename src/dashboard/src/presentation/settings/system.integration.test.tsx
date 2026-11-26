import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { pollTheSurveillance, readTheCameraList } from '../../testing/shared_reads'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { SystemView } from './system.component'

const running: SystemStats = {
  status: 'active',
  storage: { totalGb: 100, usedGb: 40, freeGb: 60 },
  cameras: [{ camera: 'front_door', fps: 10 }],
  detection: { hardware: 'cpu', targetFps: 5 },
  pendingChanges: false,
}

describe('SystemView', () => {
  it('SystemView_ShouldShowTheStateAndTheDisk_WhenSurveillanceRuns', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': ok(running), 'GET /api/cameras': ok([makeCamera()]) })
    renderScreen(<SystemView />)

    // Act
    await pollTheSurveillance()

    // Assert
    const card = within(screen.getByRole('region', { name: 'Surveillance' }))
    expect(card.getByRole('img', { name: 'En marche' })).toBeVisible()
    expect(card.getByText('60 Go libres sur 100 Go')).toBeVisible()
    expect(card.getByText('Processeur · 5 images par seconde')).not.toBeVisible()
  })

  it('SystemView_ShouldShowTheFiguresUnderTheCameraNames_WhenTheUserOpensTheDetails', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': ok(running), 'GET /api/cameras': ok([makeCamera()]) })
    renderScreen(<SystemView />)
    await readTheCameraList()
    await pollTheSurveillance()
    const card = within(screen.getByRole('region', { name: 'Surveillance' }))

    // Act
    await userEvent.click(card.getByText('Détails techniques'))

    // Assert
    expect(card.getByText('Processeur · 5 images par seconde')).toBeVisible()
    expect(card.getByText('Front Door')).toBeVisible()
  })

  it('SystemView_ShouldEndWithAClosedAvance_WhenRendered', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': ok(running), 'GET /api/cameras': ok([]) })

    // Act
    renderScreen(<SystemView />)
    await pollTheSurveillance()

    // Assert
    expect(screen.getByText('Avancé')).toBeVisible()
    expect(screen.queryByRole('link', { name: /Interface technique/ })).not.toBeInTheDocument()
  })

  it('AdvancedFold_ShouldLeadToTheTechnicalInterfaceAndSayWhatItCosts_WhenTheUserOpensIt', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': ok(running), 'GET /api/cameras': ok([]) })
    renderScreen(<SystemView />)
    await pollTheSurveillance()

    // Act
    await userEvent.click(screen.getByText('Avancé'))

    // Assert
    const technical = screen.getByRole('link', { name: /Interface technique/ })
    expect(technical).toHaveAttribute('href', '/settings/hardware/technical-interface')
    expect(technical).toHaveTextContent('Ce qu’on y modifie n’est pas repris par Vyzio')
  })

  it('SystemView_ShouldWaitForTheNextReading_WhenTheStateCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': failure(500), 'GET /api/cameras': ok([]) })
    renderScreen(<SystemView />)

    // Act
    await pollTheSurveillance()

    // Assert
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Surveillance' })).not.toBeInTheDocument()
  })
})
