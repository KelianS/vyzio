import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { makeProfile } from '../../testing/profile_fixture'
import { failure, fakeNetwork, late, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { DetectionHistoryView } from './detection_history.component'

const HISTORY = 'GET /api/detection-events/history'

const reference = {
  'GET /api/profiles': ok([]),
  'GET /api/detection-labels/camera': ok([
    { value: 'cat', displayName: 'Chat' },
    { value: 'car', displayName: 'Voiture' },
  ]),
}

const twoClips = {
  ...reference,
  [HISTORY]: ok({
    items: [
      makeDetectionEvent({ eventId: 'event-1', label: 'cat', hasClip: true }),
      makeDetectionEvent({ eventId: 'event-2', label: 'car', hasClip: true }),
    ],
    nextCursor: null,
  }),
}

const oneCat = {
  ...reference,
  [HISTORY]: ok({
    items: [makeDetectionEvent({ label: 'cat', hasSnapshot: true, hasClip: true })],
    nextCursor: null,
  }),
}

/** The player on top of the page, holding one clip at a time. */
function player() {
  return screen.getByRole('group', { name: /^Détection :/ })
}

async function openActions() {
  await userEvent.click(await screen.findByRole('button', { name: 'Plus d’actions' }))
  return screen.findByRole('dialog')
}

async function confirmDeletion() {
  const actions = await openActions()
  await userEvent.click(within(actions).getByRole('button', { name: 'Supprimer' }))
  const question = await screen.findByRole('alertdialog')
  await userEvent.click(within(question).getByRole('button', { name: 'Supprimer' }))
}

describe('DetectionHistoryView', () => {
  it('onLoadHistory_ShouldHoldTheMostRecentClipInThePlayerAboveTheList_WhenTheHistoryAnswers', async () => {
    // Arrange
    fakeNetwork(twoClips)

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(await screen.findByRole('group', { name: 'Détection : Chat' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Voiture/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chat/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByRole('button', { name: 'Voir plus ancien' })).not.toBeInTheDocument()
  })

  it('ClipList_ShouldSayTheCameraAndHourInTheRowAndHowSureInThePlayer_WhenTheListMixesCameras', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      [HISTORY]: ok({
        items: [makeDetectionEvent({ occurredAt: '2026-09-26T17:46:00', confidence: 0.92 })],
        nextCursor: null,
      }),
    })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(
      await screen.findByRole('button', { name: /Front Door · 17\sh\s46$/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /^Détection :/ })).toHaveTextContent(
      /Front Door · 17\sh\s46 · sûr\sà\s92\s%/,
    )
  })

  it('onPlay_ShouldPlayTheTappedClipInThePlayer_WhenTheUserTapsItsRow', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /Voiture/ }))

    // Assert
    expect(player()).toHaveAccessibleName('Détection : Voiture')
    expect(player().querySelector('video')).toHaveAttribute(
      'src',
      expect.stringMatching(/\/api\/detection-events\/event-2\/clip$/),
    )
  })

  it('onClipEnded_ShouldPlayTheNextClipWithNothingToTap_WhenTheClipInThePlayerEnds', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await screen.findByRole('group', { name: 'Détection : Chat' })

    // Act
    fireEvent.ended(player().querySelector('video')!)

    // Assert
    expect(player()).toHaveAccessibleName('Détection : Voiture')
    expect(screen.getByRole('button', { name: /Voiture/ })).toHaveAttribute('aria-current', 'true')
  })

  it('ClipList_ShouldBringTheNextRowIntoView_WhenTheNextClipStartsByItself', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await screen.findByRole('group', { name: 'Détection : Chat' })
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')

    // Act
    fireEvent.ended(player().querySelector('video')!)

    // Assert
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', behavior: 'auto' })
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole('button', { name: /Voiture/ }))
    scroll.mockRestore()
  })

  it('ClipList_ShouldLeaveTheListWhereItIs_WhenTheUserTapsARow', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    const row = await screen.findByRole('button', { name: /Voiture/ })
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')

    // Act
    await userEvent.click(row)

    // Assert
    expect(scroll).not.toHaveBeenCalled()
    scroll.mockRestore()
  })

  it('ClipPlayer_ShouldPauseTheClip_WhenTheUserTapsPauseWhileItPlays', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await screen.findByRole('group', { name: /^Détection :/ })
    fireEvent.play(player().querySelector('video')!)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)

    // Act
    await userEvent.click(within(player()).getByRole('button', { name: 'Pause' }))

    // Assert
    expect(pause).toHaveBeenCalledTimes(1)
    pause.mockRestore()
  })

  it('onClipEnded_ShouldRestOnTheLastClip_WhenTheLastOneEnds', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: /Voiture/ }))

    // Act
    fireEvent.ended(player().querySelector('video')!)

    // Assert
    expect(player()).toHaveAccessibleName('Détection : Voiture')
  })

  it('onLoadHistory_ShouldSayItIsEmptyAndOfferNoFilter_WhenNothingWasDetected', async () => {
    // Arrange
    fakeNetwork({ ...reference, [HISTORY]: ok({ items: [], nextCursor: null }) })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(await screen.findByText('Aucune détection pour l’instant.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filtrer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^Détection :/ })).not.toBeInTheDocument()
  })

  it('onLoadHistory_ShouldSayWhyAndForSupport_WhenTheHistoryFails', async () => {
    // Arrange
    fakeNetwork({ ...reference, [HISTORY]: failure(500, undefined, 'events read timed out') })

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    expect(await screen.findByText('Les détections n’ont pas pu être lues.')).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/detection-events\/history · 500/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('onOpenHelp_ShouldPointToCuttingTheCameraToRecordNothing_WhenTheUserAsksHowFarTheHistoryGoes', async () => {
    // Arrange
    fakeNetwork({ ...reference, [HISTORY]: ok({ items: [], nextCursor: null }) })
    renderScreen(<DetectionHistoryView />)

    // Act
    await userEvent.click(await screen.findByText('Jusqu’où cette page remonte-t-elle ?'))

    // Assert
    expect(screen.getByText(/coupez-la/)).toBeVisible()
  })

  it('onLoadMore_ShouldAppendTheOlderDetections_WhenTheUserAsksForMore', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
      [HISTORY]: ok({ items: [makeDetectionEvent({ label: 'cat' })], nextCursor: 'older' }),
    })
    renderScreen(<DetectionHistoryView />)
    const more = await screen.findByRole('button', { name: 'Voir plus ancien' })
    network.answer(
      HISTORY,
      ok({ items: [makeDetectionEvent({ eventId: 'event-2', label: 'car' })], nextCursor: null }),
    )

    // Act
    await userEvent.click(more)

    // Assert
    expect(await screen.findByRole('button', { name: /Voiture/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument()
    expect(network.sent.at(-1)?.query).toContain('cursor=older')
  })

  it('onToggleFilter_ShouldAskForEveryCameraChecked_WhenTheUserChecksSeveralByTheirName', async () => {
    // Arrange
    const network = fakeNetwork({
      ...twoClips,
      'GET /api/cameras': ok([
        makeCamera({ displayName: 'Porte d’entrée', frigateCameraName: 'front_door' }),
        makeCamera({ id: 'camera-2', displayName: 'Garage', frigateCameraName: 'cam_garage' }),
      ]),
    })
    renderScreen(<DetectionHistoryView />)
    await readTheCameraList()
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })
    expect(within(sheet).queryByText('cam_garage')).not.toBeInTheDocument()

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Garage' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Porte d’entrée' }))

    // Assert
    expect(network.sent.at(-1)).toMatchObject({
      route: HISTORY,
      query: '?camera=front_door&camera=cam_garage&limit=20',
    })
    expect(within(sheet).getByRole('button', { name: 'Garage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(sheet).getByRole('button', { name: 'Toutes les caméras' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('onToggleFilter_ShouldKeepTheListOfTheLastFilter_WhenAnEarlierFiltersAnswerArrivesLast', async () => {
    // Arrange
    const network = fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })
    network.answer(
      HISTORY,
      late(ok({ items: [makeDetectionEvent({ label: 'car' })], nextCursor: null }), 50),
    )
    await userEvent.click(within(sheet).getByRole('button', { name: 'Voiture' }))
    network.answer(HISTORY, ok({ items: [makeDetectionEvent({ label: 'cat' })], nextCursor: null }))

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Chat' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))

    // Assert
    // The open sheet hides the page from the accessibility tree; the list behind it is what counts.
    expect(
      screen.getByRole('group', { name: 'Détection : Chat', hidden: true }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Détection : Voiture', hidden: true }),
    ).not.toBeInTheDocument()
  })

  it('onToggleFilter_ShouldNameEveryValueCheckedAboveTheList_WhenTheSheetCloses', async () => {
    // Arrange
    fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Chat' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Voiture' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Hier' }))

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }))

    // Assert
    expect(await screen.findByText('Chat, Voiture · Hier')).toBeInTheDocument()
  })

  it('onFilterDay_ShouldReadOnlyThatDay_WhenTheUserChoosesADay', async () => {
    // Arrange
    const network = fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })

    // Act
    fireEvent.change(within(sheet).getByLabelText('Un autre jour'), {
      target: { value: '2026-11-02' },
    })

    // Assert
    expect(network.sent.at(-1)?.query).toMatch(/^\?from=[^&]+&to=[^&]+&limit=20$/)
    expect(within(sheet).getByRole('button', { name: 'Tous les jours' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('ClipList_ShouldShowTheIconOfEachClipsType_WhenTheHistoryAnswers', async () => {
    // Arrange
    fakeNetwork(twoClips)

    // Act
    renderScreen(<DetectionHistoryView />)

    // Assert
    const rows = await screen.findAllByRole('listitem')
    expect(rows[0].querySelector('svg.lucide-cat')).not.toBeNull()
    expect(rows[1].querySelector('svg.lucide-car')).not.toBeNull()
    expect(player().querySelector('svg.lucide-cat')).not.toBeNull()
  })

  it('onLoadHistory_ShouldOpenFilteredOnTheCameraOfTheAddress_WhenArrivingFromACameraView', async () => {
    // Arrange
    const network = fakeNetwork({
      ...twoClips,
      'GET /api/cameras': ok([
        makeCamera({ id: 'camera-2', displayName: 'Garage', frigateCameraName: 'cam_garage' }),
      ]),
    })

    // Act
    renderScreen(<DetectionHistoryView />, {
      path: '/detections',
      url: '/detections?camera=camera-2',
    })
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('Garage')).toBeInTheDocument()
    expect(network.sent.filter((request) => request.route === HISTORY)).toEqual([
      expect.objectContaining({ query: '?camera=cam_garage&limit=20' }),
    ])
  })

  it('onResetFilters_ShouldListEverythingAgain_WhenTheUserTapsToutAfficher', async () => {
    // Arrange
    const network = fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Voiture' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Tout afficher' }))

    // Assert
    expect(network.sent.at(-1)).toMatchObject({ route: HISTORY, query: '?limit=20' })
    expect(screen.queryByRole('button', { name: 'Tout afficher' })).not.toBeInTheDocument()
  })

  it('onLoadHistory_ShouldBlameTheFilters_WhenTheyMatchNothing', async () => {
    // Arrange
    const network = fakeNetwork(twoClips)
    renderScreen(<DetectionHistoryView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Filtrer' }))
    network.answer(HISTORY, ok({ items: [], nextCursor: null }))

    // Act
    const sheet = await screen.findByRole('dialog', { name: 'Filtrer' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Chat' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }))

    // Assert
    expect(await screen.findByText('Aucune détection avec ces filtres.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filtrer' })).toBeInTheDocument()
  })

  it('onCorrect_ShouldNameThePersonAndSaySo_WhenTheUserPicksThemFromTheMenu', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
      'GET /api/profiles': ok([makeProfile({ id: 'profile-1', name: 'Alex' })]),
      [HISTORY]: ok({ items: [makeDetectionEvent()], nextCursor: null }),
      'PATCH /api/detection-events/event-1/identity': ok(),
    })
    renderScreen(<DetectionHistoryView />)
    const actions = await openActions()
    await userEvent.click(
      within(actions).getByRole('button', { name: 'Corriger la reconnaissance' }),
    )

    // Act
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Qui est-ce ?' })).getByRole('button', {
        name: 'Alex',
      }),
    )

    // Assert
    expect(await screen.findByText('Reconnaissance corrigée')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Alex/ })).toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'PATCH /api/detection-events/event-1/identity',
      query: '',
      body: { profileId: 'profile-1' },
    })
  })

  it('onCorrect_ShouldSayTheCorrectionFailed_WhenTheBackendRefuses', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      [HISTORY]: ok({
        items: [makeDetectionEvent({ identity: 'Alex', profileId: 'profile-1' })],
        nextCursor: null,
      }),
      'PATCH /api/detection-events/event-1/identity': failure(500),
    })
    renderScreen(<DetectionHistoryView />)
    const actions = await openActions()
    await userEvent.click(
      within(actions).getByRole('button', { name: 'Corriger la reconnaissance' }),
    )

    // Act
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Qui est-ce ?' })).getByRole('button', {
        name: /Inconnu/,
      }),
    )

    // Assert
    expect(
      await screen.findByText(/La correction de l’identité n’a pas abouti/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Alex/ })).toBeInTheDocument()
  })

  it('ClipActionsSheet_ShouldOfferNoCorrection_WhenTheDetectionCannotCarryAnIdentity', async () => {
    // Arrange
    fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)

    // Act
    const actions = await openActions()

    // Assert
    expect(
      within(actions).queryByRole('button', { name: 'Corriger la reconnaissance' }),
    ).not.toBeInTheDocument()
    expect(
      within(actions).getByRole('button', { name: /Télécharger la vidéo/ }),
    ).toBeInTheDocument()
  })

  it('onDownload_ShouldSaveTheClipOnThisDeviceUnderItsCameraAndMoment_WhenTheUserDownloadsIt', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      [HISTORY]: ok({
        items: [makeDetectionEvent({ hasClip: true, occurredAt: '2026-09-26T08:05:00' })],
        nextCursor: null,
      }),
    })
    renderScreen(<DetectionHistoryView />)
    // jsdom navigates on a link's click: the browser's save is what is watched, not done.
    const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const actions = await openActions()

    // Act
    await userEvent.click(within(actions).getByRole('button', { name: /Télécharger la vidéo/ }))

    // Assert
    expect(save.mock.contexts).toEqual([
      expect.objectContaining({
        href: expect.stringMatching(/\/api\/detection-events\/event-1\/clip$/),
        download: 'Front Door 2026-09-26 08h05.mp4',
      }),
    ])
    save.mockRestore()
  })

  it('ClipActionsSheet_ShouldOfferNoDownload_WhenTheVideoExpired', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      [HISTORY]: ok({
        items: [makeDetectionEvent({ hasClip: true, mediaExpired: true })],
        nextCursor: null,
      }),
    })
    renderScreen(<DetectionHistoryView />)

    // Act
    const actions = await openActions()

    // Assert
    expect(screen.getByText(/au-delà de la durée de conservation/)).toBeInTheDocument()
    expect(
      within(actions).queryByRole('button', { name: /Télécharger la vidéo/ }),
    ).not.toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('onDelete_ShouldRemoveTheDetection_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ ...oneCat, 'DELETE /api/detection-events/event-1': ok() })
    renderScreen(<DetectionHistoryView />)

    // Act
    await confirmDeletion()

    // Assert
    expect(await screen.findByText('Détection supprimée.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chat/ })).not.toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'DELETE /api/detection-events/event-1' }),
    )
  })

  it('onAskDelete_ShouldSayInOneSentenceWhatGoes_WhenTheUserAsksFromTheMenu', async () => {
    // Arrange
    fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)
    const actions = await openActions()

    // Act
    await userEvent.click(within(actions).getByRole('button', { name: 'Supprimer' }))

    // Assert
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'La détection et sa vidéo seront effacées.',
    )
  })

  it('onDismissDelete_ShouldKeepTheDetectionAndSendNothing_WhenTheUserCancels', async () => {
    // Arrange
    const network = fakeNetwork(oneCat)
    renderScreen(<DetectionHistoryView />)
    const actions = await openActions()
    await userEvent.click(within(actions).getByRole('button', { name: 'Supprimer' }))

    // Act
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }),
    )

    // Assert
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: /Chat/ })).not.toBeInTheDocument()
  })

  it('onVideoFailed_ShouldSayTheVideoWasDeleted_WhenItsRecordingNoLongerExists', async () => {
    // Arrange
    fakeNetwork({ ...oneCat, 'GET /api/detection-events/event-1/clip': failure(404) })
    renderScreen(<DetectionHistoryView />)
    await screen.findByRole('group', { name: /^Détection :/ })

    // Act
    fireEvent.error(player().querySelector('video')!)

    // Assert
    expect(await screen.findByText('La vidéo de ce moment a été supprimée.')).toBeInTheDocument()
    expect(player().querySelector('video')).toBeNull()
  })

  it('onVideoFailed_ShouldSayItCouldNotBePlayedWithTheDetail_WhenTheSurveillanceFailsToServeIt', async () => {
    // Arrange
    fakeNetwork({
      ...oneCat,
      'GET /api/detection-events/event-1/clip': failure(
        502,
        'clip_unreadable',
        'GET clip.mp4 got no answer',
      ),
    })
    renderScreen(<DetectionHistoryView />)
    await screen.findByRole('group', { name: /^Détection :/ })

    // Act
    fireEvent.error(player().querySelector('video')!)

    // Assert
    expect(await screen.findByText('La vidéo n’a pas pu être lue.')).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/detection-events\/event-1\/clip · 502/)).toBeInTheDocument()
    expect(screen.queryByText('La vidéo de ce moment a été supprimée.')).not.toBeInTheDocument()
  })
})
