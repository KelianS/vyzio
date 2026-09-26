import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RecordingSettings } from '../../domain/entities/recording_settings.entity'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { ConservationView } from './conservation.component'

const SETTINGS = 'GET /api/settings/recording'
const SAVE = 'PUT /api/settings/recording'
const CONSERVATION = { path: '/settings/conservation', url: '/settings/conservation' }

const settings: RecordingSettings = {
  continuous: { days: 0, default: 0 },
  motion: { days: 7, default: 7 },
  eventClip: { days: 30, default: 30 },
  maxDays: 365,
  minEventClipDays: 1,
}

async function setMotionToTenDays() {
  const motion = await screen.findByLabelText('Séquences de mouvement')
  await userEvent.clear(motion)
  await userEvent.type(motion, '10')
  await userEvent.tab()
}

describe('ConservationView', () => {
  it('onSave_ShouldSaveTheDurationsAndRefreshSurveillance_WhenTheUserChangesOne', async () => {
    // Arrange
    const network = fakeNetwork({
      [SETTINGS]: ok(settings),
      [SAVE]: ok(settings),
      'GET /api/system/stats': ok(null),
    })
    renderScreen(<ConservationView />, CONSERVATION)
    await setMotionToTenDays()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Durées de conservation enregistrées.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: SAVE,
        body: { continuousDays: 0, motionDays: 10, eventClipDays: 30 },
      }),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: 'GET /api/system/stats' }))
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({ [SETTINGS]: ok(settings), [SAVE]: failure(500) })
    renderScreen(<ConservationView />, CONSERVATION)
    await setMotionToTenDays()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/settings\/recording · 500/)).toBeVisible()
    expect(screen.getByLabelText('Séquences de mouvement')).toHaveValue(10)
  })

  it('onRetry_ShouldShowTheDurations_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ [SETTINGS]: failure(500) })
    renderScreen(<ConservationView />, CONSERVATION)
    await screen.findByRole('alert')
    network.answer(SETTINGS, ok(settings))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByLabelText('Séquences de mouvement')).toHaveValue(7)
  })
})
