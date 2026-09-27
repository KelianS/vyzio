import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyStrategy } from '../../domain/entities/camera.entity'
import type { CameraPrivacySchedule } from '../../domain/entities/camera_privacy_schedule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { CameraPrivacyView } from './camera_privacy.component'

const camera = makeCamera()

const PRIVACY_TAB = {
  path: '/settings/cameras/:cameraId/vie-privee',
  url: '/settings/cameras/camera-1/vie-privee',
  outletContext: camera,
}

const SCHEDULES = 'GET /api/cameras/camera-1/privacy/schedules'
const ADD_SCHEDULE = 'POST /api/cameras/camera-1/privacy/schedules'
const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'

const ptzCamera = makeCamera({ ptzSupported: true })

function makeSchedule(overrides: Partial<CameraPrivacySchedule> = {}): CameraPrivacySchedule {
  return {
    id: 'schedule-1',
    cameraId: 'camera-1',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

async function clearTheWeekdays() {
  await userEvent.click(screen.getByRole('button', { name: 'Lun' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Jeu' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ven' }))
}

describe('CameraPrivacyView', () => {
  it('onLoad_ShouldSayThereIsNoRange_WhenTheCameraHasNone', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: ok([]) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(await screen.findByText('Aucune planification configurée.')).toBeInTheDocument()
  })

  it('onLoad_ShouldListEachRangeWithItsDaysAndHours_WhenTheCameraHasSome', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: ok([makeSchedule()]) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    const range = await screen.findByRole('listitem')
    expect(range).toHaveTextContent('Lun, Mar, Mer, Jeu, Ven')
    expect(range).toHaveTextContent('22:00 → 06:00 le lendemain')
  })

  it('onLoad_ShouldSayTheRangesCouldNotBeReadWhereTheyWouldBe_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: failure(500) })

    // Act
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Assert
    expect(
      await screen.findByText('Les plages horaires de cette caméra n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(screen.getByText(/GET \/api\/cameras\/camera-1\/privacy\/schedules · 500/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.queryByText('Aucune planification configurée.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter à cette caméra' })).not.toBeInTheDocument()
  })

  it('onRetrySchedules_ShouldListTheRanges_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ [SCHEDULES]: failure(500) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(SCHEDULES, ok([makeSchedule()]))

    // Act
    await userEvent.click(retry)

    // Assert
    expect(await screen.findByText('Lun, Mar, Mer, Jeu, Ven')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onAddSchedule_ShouldListTheCreatedRange_WhenReadingAgainWouldFail', async () => {
    // Arrange
    const network = fakeNetwork({
      [SCHEDULES]: ok([]),
      [ADD_SCHEDULE]: ok(makeSchedule()),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await screen.findByText('Aucune planification configurée.')
    network.answer(SCHEDULES, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter à cette caméra' }))

    // Assert
    expect(await screen.findByText('Lun, Mar, Mer, Jeu, Ven')).toBeInTheDocument()
    expect(screen.queryByText('Aucune planification configurée.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onLoad_ShouldSayThePositionsCouldNotBeReadAndOfferARetry_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: ok([]), [PRESETS]: failure(500) })

    // Act
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })

    // Assert
    expect(
      await screen.findByText('Les positions de cette caméra n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/cameras/camera-1/ptz/presets · 500')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('onRetryPresets_ShouldClearTheFailure_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ [SCHEDULES]: ok([]), [PRESETS]: failure(500) })
    renderScreen(<CameraPrivacyView />, { ...PRIVACY_TAB, outletContext: ptzCamera })
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(PRESETS, ok({ presets: [], calibrated: true, currentPosition: null }))

    // Act
    await userEvent.click(retry)

    // Assert
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onEndTimeChange_ShouldSayTheRangeEndsTheNextDay_WhenTheEndIsBeforeTheStart', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: ok([]) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    const end = await screen.findByLabelText('Fin')
    await userEvent.clear(end)

    // Act
    await userEvent.type(end, '05:00')

    // Assert
    expect(screen.getByText(/passe minuit/)).toBeInTheDocument()
  })

  it('onEndTimeChange_ShouldNotAnnounceTheNextDay_WhenTheEndIsNotSet', async () => {
    // Arrange
    fakeNetwork({ [SCHEDULES]: ok([]) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    const end = await screen.findByLabelText('Fin')

    // Act
    await userEvent.clear(end)

    // Assert
    expect(screen.queryByText(/passe minuit/)).toBeNull()
  })

  it('onAddSchedule_ShouldAddTheRangeAndListIt_WhenTheUserAddsItHere', async () => {
    // Arrange
    const network = fakeNetwork({
      [SCHEDULES]: ok([]),
      [ADD_SCHEDULE]: ok(makeSchedule()),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await screen.findByText('Aucune planification configurée.')
    network.answer(SCHEDULES, ok([makeSchedule()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter à cette caméra' }))

    // Assert
    expect(await screen.findByText('Lun, Mar, Mer, Jeu, Ven')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: ADD_SCHEDULE,
        body: { daysOfWeek: [1, 2, 3, 4, 5], startTime: '22:00', endTime: '06:00' },
      }),
    )
  })

  it('onAddSchedule_ShouldAskForADay_WhenNoDayIsChosen', async () => {
    // Arrange
    const network = fakeNetwork({ [SCHEDULES]: ok([]) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await screen.findByText('Aucune planification configurée.')
    await clearTheWeekdays()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter à cette caméra' }))

    // Assert
    expect(screen.getByText('Choisissez au moins un jour')).toBeInTheDocument()
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: ADD_SCHEDULE }))
  })

  it('onAddSchedule_ShouldSayWhatToChange_WhenTheServerRefusesAnEmptyRange', async () => {
    // Arrange
    fakeNetwork({
      [SCHEDULES]: ok([]),
      [ADD_SCHEDULE]: failure(400, 'schedule_empty_range'),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await screen.findByText('Aucune planification configurée.')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter à cette caméra' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le début et la fin sont à la même heure : choisissez deux heures différentes',
    )
  })

  it('onAddSchedule_ShouldAddTheRangeToEveryCamera_WhenTheUserAppliesItToAll', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok([camera, makeCamera({ id: 'camera-2', slug: 'garden' })]),
      [SCHEDULES]: ok([]),
      [ADD_SCHEDULE]: ok(makeSchedule()),
      'POST /api/cameras/camera-2/privacy/schedules': ok(
        makeSchedule({ id: 'schedule-2', cameraId: 'camera-2' }),
      ),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await readTheCameraList()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Appliquer à toutes (2)' }))

    // Assert
    await screen.findByRole('button', { name: 'Ajouter à cette caméra' })
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: 'POST /api/cameras/camera-2/privacy/schedules' }),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: ADD_SCHEDULE }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('render_ShouldNotOfferToApplyToAll_WhenThereIsOneCamera', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([camera]), [SCHEDULES]: ok([]) })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Act
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('Aucune planification configurée.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Appliquer à toutes/ })).toBeNull()
  })

  it('onDeleteSchedule_ShouldRemoveTheRange_WhenTheUserDeletesIt', async () => {
    // Arrange
    fakeNetwork({
      [SCHEDULES]: ok([makeSchedule()]),
      'DELETE /api/cameras/camera-1/privacy/schedules/schedule-1': ok(null),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)

    // Act
    await userEvent.click(
      await screen.findByRole('button', { name: 'Supprimer cette planification' }),
    )

    // Assert
    expect(await screen.findByText('Aucune planification configurée.')).toBeInTheDocument()
  })

  it('onSaveStrategy_ShouldSaveTheChosenMode_WhenTheUserSaves', async () => {
    // Arrange
    const network = fakeNetwork({
      [SCHEDULES]: ok([]),
      'PATCH /api/cameras/camera-1/privacy-strategy': ok(camera),
      'GET /api/cameras': ok([camera]),
    })
    renderScreen(<CameraPrivacyView />, PRIVACY_TAB)
    await screen.findByText('Aucune planification configurée.')
    // The keyboard picks from the list the way it opens, highlighted on the current mode.
    screen.getByRole('combobox', { name: 'Quand vous coupez la surveillance' }).focus()
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Mode vie privée enregistré.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PATCH /api/cameras/camera-1/privacy-strategy',
        body: { strategy: PrivacyStrategy.None },
      }),
    )
  })
})
