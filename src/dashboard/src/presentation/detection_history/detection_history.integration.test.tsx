import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
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
      items: [makeDetectionEvent({ label: 'cat', hasSnapshot: true, hasClip: true })],
      nextCursor: null,
    }),
  }

  async function openPreview() {
    await userEvent.click(await screen.findByRole('button', { name: /Voir l’aperçu/ }))
    return screen.findByRole('dialog', { name: 'Aperçu de la détection' })
  }

  async function confirmDeletion() {
    const preview = await openPreview()
    await userEvent.click(within(preview).getByRole('button', { name: 'Supprimer' }))
    const question = await screen.findByRole('alertdialog')
    await userEvent.click(within(question).getByRole('button', { name: 'Supprimer' }))
  }

  it('onDelete_ShouldRemoveTheDetectionAndCloseItsPreview_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ ...oneCat, 'DELETE /api/detection-events/event-1': ok() })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(await screen.findByText('Détection supprimée.')).toBeInTheDocument()
    expect(screen.queryByText('Détection « cat »')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Aperçu de la détection' })).not.toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'DELETE /api/detection-events/event-1' }),
    )
  })

  it('onAskDelete_ShouldSayInOneSentenceWhatGoes_WhenTheUserAsksFromThePreview', async () => {
    // Arrange
    fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)
    const preview = await openPreview()

    // Act
    await userEvent.click(within(preview).getByRole('button', { name: 'Supprimer' }))

    // Assert
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'La détection et sa vidéo seront effacées.',
    )
  })

  it('onDismissDelete_ShouldKeepTheDetectionAndSendNothing_WhenTheUserCancels', async () => {
    // Arrange
    const network = fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)
    const preview = await openPreview()
    await userEvent.click(within(preview).getByRole('button', { name: 'Supprimer' }))

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

  it.each([
    [
      'erasure_failed',
      'La surveillance n’a pas pu supprimer cette détection : rien n’a été effacé. Réessayez dans un instant.',
    ],
    ['erasure_incomplete', 'La détection n’a été effacée qu’en partie. Réessayez pour terminer.'],
  ])(
    'onDelete_ShouldSayHowFarItGotAndKeepTheDetection_WhenTheSurveillanceFails (%s)',
    async (code, sentence) => {
      // Arrange
      fakeNetwork({
        ...oneCat,
        'DELETE /api/detection-events/event-1': failure(
          502,
          code,
          'DELETE /api/events/x answered 500',
        ),
      })
      renderScreen(<DetectionHistoryView />)

      // Act
      await confirmDeletion()

      // Assert
      expect(await screen.findByText(sentence)).toBeInTheDocument()
      expect(screen.getByText(/DELETE \/api\/detection-events\/event-1 · 502/)).toBeInTheDocument()
      expect(screen.getByText('Détection « cat »')).toBeInTheDocument()
    },
  )

  it('onDelete_ShouldAskToComeBackLater_WhenTheRecordingIsStillInProgress', async () => {
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
        'L’enregistrement de ce moment est encore en cours. Réessayez dans quelques minutes.',
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

  it('onVideoFailed_ShouldSayTheVideoWasDeleted_WhenItsRecordingNoLongerExists', async () => {
    // Arrange
    fakeNetwork({ ...oneCat, 'GET /api/detection-events/event-1/clip': failure(404) })
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Vidéo' }))
    const preview = await screen.findByRole('dialog', { name: 'Aperçu de la détection' })

    // Act
    fireEvent.error(preview.querySelector('video')!)

    // Assert
    expect(await screen.findByText('La vidéo de ce moment a été supprimée.')).toBeInTheDocument()
    expect(preview.querySelector('video')).toBeNull()
  })

  it('onVideoFailed_ShouldSayTheVideoCouldNotBePlayed_WhenItsRecordingStillExists', async () => {
    // Arrange
    fakeNetwork({ ...oneCat, 'GET /api/detection-events/event-1/clip': ok() })
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Vidéo' }))
    const preview = await screen.findByRole('dialog', { name: 'Aperçu de la détection' })

    // Act
    fireEvent.error(preview.querySelector('video')!)

    // Assert
    expect(await screen.findByText('La vidéo n’a pas pu être lue.')).toBeInTheDocument()
  })
})
