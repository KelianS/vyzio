import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { DetectionHistoryView } from './detection_history.component'

const reference = {
  'GET /api/profiles': ok([]),
  'GET /api/detection-labels/camera': ok([]),
}

describe('DetectionHistoryView', () => {
  it('onLoadHistory_ShouldListTheDetections_WhenTheHistoryAnswers', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/detection-events/history': ok({
        items: [makeDetectionEvent({ label: 'cat' })],
        nextCursor: null,
      }),
    })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(await screen.findByText('Détection « cat »')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voir plus ancien' })).not.toBeInTheDocument()
  })

  it('onLoadHistory_ShouldSayItIsEmpty_WhenNothingWasDetected', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/detection-events/history': ok({ items: [], nextCursor: null }),
    })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(await screen.findByText('Aucune détection pour l’instant.')).toBeInTheDocument()
  })

  it('onLoadHistory_ShouldSayWhyAndForSupport_WhenTheHistoryFails', async () => {
    // Arrange
    fakeNetwork({ ...reference, 'GET /api/detection-events/history': failure(500) })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Impossible de charger l'historique.")
    expect(alert).toHaveTextContent('GET /api/detection-events/history · 500')
  })

  it('onLoadMore_ShouldAppendTheOlderDetections_WhenTheUserAsksForMore', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
      'GET /api/detection-events/history': ok({
        items: [makeDetectionEvent({ label: 'cat' })],
        nextCursor: 'older',
      }),
    })
    renderScreen(<DetectionHistoryView />)
    const more = await screen.findByRole('button', { name: 'Voir plus ancien' })
    network.answer(
      'GET /api/detection-events/history',
      ok({ items: [makeDetectionEvent({ eventId: 'event-2', label: 'dog' })], nextCursor: null }),
    )

    // Act
    await userEvent.click(more)

    // Assert
    expect(await screen.findByText('Détection « dog »')).toBeInTheDocument()
    expect(screen.getByText('Détection « cat »')).toBeInTheDocument()
    expect(network.sent.at(-1)?.query).toContain('cursor=older')
  })

  it('onCorrect_ShouldRemoveTheIdentityAndSaySo_WhenTheUserValidatesUnknown', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
      'GET /api/detection-events/history': ok({
        items: [makeDetectionEvent({ identity: 'Alex' })],
        nextCursor: null,
      }),
      'PATCH /api/detection-events/event-1/identity': ok(),
    })
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Corriger' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    // Assert
    expect(await screen.findByText('Identité retirée')).toBeInTheDocument()
    expect(screen.getByText('Détection « person »')).toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'PATCH /api/detection-events/event-1/identity',
      query: '',
      body: { profileId: null },
    })
  })

  it('onCorrect_ShouldSayTheCorrectionFailed_WhenTheBackendRefuses', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/detection-events/history': ok({
        items: [makeDetectionEvent({ identity: 'Alex' })],
        nextCursor: null,
      }),
      'PATCH /api/detection-events/event-1/identity': failure(500),
    })
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Corriger' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    // Assert
    expect(
      await screen.findByText(/La correction de l’identité n’a pas abouti/),
    ).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
  })
})
