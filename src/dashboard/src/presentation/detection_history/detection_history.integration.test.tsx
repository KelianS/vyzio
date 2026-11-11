import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
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

  const oneCat = {
    ...reference,
    'GET /api/detection-events/history': ok({
      items: [makeDetectionEvent({ label: 'cat' })],
      nextCursor: null,
    }),
  }

  async function confirmDeletion() {
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer la détection : Détection « cat »' }),
    )
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
  }

  it('onDelete_ShouldRemoveTheDetectionAndSaySo_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ ...oneCat, 'DELETE /api/detection-events/event-1': ok() })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(await screen.findByText('Détection supprimée.')).toBeInTheDocument()
    expect(screen.queryByText('Détection « cat »')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'DELETE /api/detection-events/event-1' }),
    )
  })

  it('onAskDelete_ShouldStateTheRecordingAndTheNotificationsInTheConfirmation_WhenTheUserAsks', async () => {
    // Arrange
    fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)

    // Act
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer la détection : Détection « cat »' }),
    )

    // Assert
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('tout ce que la caméra a enregistré pendant ce passage')
    expect(dialog).toHaveTextContent('Les notifications déjà reçues restent')
  })

  it('onDismissDelete_ShouldKeepTheDetectionAndSendNothing_WhenTheUserCancels', async () => {
    // Arrange
    const network = fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer la détection : Détection « cat »' }),
    )

    // Act
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }),
    )

    // Assert
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('Détection « cat »')).toBeInTheDocument()
    expect(network.sent).not.toContainEqual(
      expect.objectContaining({ route: 'DELETE /api/detection-events/event-1' }),
    )
  })

  it('onDelete_ShouldKeepTheDetectionAndSayWhyForSupport_WhenTheSurveillanceFails', async () => {
    // Arrange
    fakeNetwork({
      ...oneCat,
      'DELETE /api/detection-events/event-1': failure(
        502,
        'erasure_failed',
        'POST /api/reviews/delete answered 500; nothing erased yet',
      ),
    })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(
      await screen.findByText(/La détection n’a pas pu être entièrement supprimée/),
    ).toBeInTheDocument()
    expect(screen.getByText(/DELETE \/api\/detection-events\/event-1 · 502/)).toBeInTheDocument()
    expect(screen.getByText('Détection « cat »')).toBeInTheDocument()
  })

  it('onDelete_ShouldAskToWaitForTheEnd_WhenTheDetectionIsStillInProgress', async () => {
    // Arrange
    fakeNetwork({
      ...oneCat,
      'DELETE /api/detection-events/event-1': failure(409, 'detection_in_progress'),
    })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(
      await screen.findByText(
        'Cette détection est encore en cours : réessayez une fois qu’elle sera terminée',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Détection « cat »')).toBeInTheDocument()
  })

  it('onDelete_ShouldDropTheRowAndSayItIsGone_WhenTheDetectionNoLongerExists', async () => {
    // Arrange
    fakeNetwork({
      ...oneCat,
      'DELETE /api/detection-events/event-1': failure(404, 'detection_not_found'),
    })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(await screen.findByText('Cette détection n’existe plus.')).toBeInTheDocument()
    expect(screen.queryByText('Détection « cat »')).not.toBeInTheDocument()
  })
})
