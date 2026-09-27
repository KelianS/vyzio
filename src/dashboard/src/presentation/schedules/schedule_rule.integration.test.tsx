import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { ScheduleRuleView } from './schedule_rule.component'

const ADD = { path: '/settings/horaires/ajout', url: '/settings/horaires/ajout' }
const EDIT = { path: '/settings/horaires/:ruleId', url: '/settings/horaires/rule-1' }

const CAMERAS = 'GET /api/cameras'
const CHANNELS = 'GET /api/notifications/channels'
const CREATE = 'POST /api/schedules'
const RULE = 'GET /api/schedules/rule-1'
const UPDATE = 'PUT /api/schedules/rule-1'
const DELETE = 'DELETE /api/schedules/rule-1'

const salon = makeCamera({ id: 'camera-1', displayName: 'Salon' })
const cuisine = makeCamera({ id: 'camera-2', displayName: 'Cuisine' })
const telegram = makeChannelSummary({ channel: 'telegram', displayName: 'Telegram' })

function makeRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    kind: ScheduleRuleKind.Privacy,
    targetIds: ['camera-1'],
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function houseRoutes() {
  return { [CAMERAS]: ok([salon, cuisine]), [CHANNELS]: ok([telegram]) }
}

async function openAt(address: { path: string; url: string }) {
  const rendered = renderScreen(<ScheduleRuleView />, address)
  await readTheCameraList()
  return rendered
}

async function tick(target: string, label: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: target }))
  await userEvent.click(await screen.findByRole('checkbox', { name: label }))
}

describe('ScheduleRuleView', () => {
  it('onCreate_ShouldAddTheRangeForTheTickedCamerasAndGoBackToTheWeek_WhenTheUserAdds', async () => {
    // Arrange
    const network = fakeNetwork({ ...houseRoutes(), [CREATE]: ok(makeRule()) })
    const { router } = await openAt(ADD)
    await tick('Caméras', 'Salon')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cuisine' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/horaires'))
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: CREATE,
        body: {
          kind: 'privacy',
          targetIds: ['camera-1', 'camera-2'],
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '22:00',
          endTime: '06:00',
        },
      }),
    )
  })

  it('onLoad_ShouldSayWhatAPrivacyRangeDoesAndThatTheNightEndsTheNextDay_WhenAddingOne', async () => {
    // Arrange
    fakeNetwork(houseRoutes())

    // Act
    await openAt(ADD)

    // Assert
    expect(
      await screen.findByText('Aucun enregistrement, aucune détection, aucune notification.'),
    ).toBeVisible()
    expect(
      screen.getByText('La plage passe minuit : elle se termine le lendemain à 06:00.'),
    ).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Caméras' })).toHaveTextContent('Aucune caméra')
  })

  it('onChangeKind_ShouldOfferTheChannelsAndSayRecordingGoesOn_WhenTheUserPicksSansNotification', async () => {
    // Arrange
    fakeNetwork(houseRoutes())
    await openAt(ADD)
    ;(await screen.findByRole('combobox', { name: 'Type' })).focus()
    await userEvent.keyboard('{ArrowDown}')

    // Act
    await userEvent.click(await screen.findByRole('option', { name: 'Sans notification' }))

    // Assert
    expect(
      screen.getByText('Filme et enregistre, mais n’envoie aucune notification.'),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('combobox', { name: 'Canaux' }))
    expect(await screen.findByRole('checkbox', { name: 'Telegram' })).toBeInTheDocument()
  })

  it('onCreate_ShouldSayWhatToChange_WhenTheServerRefusesARangeWithoutTarget', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [CREATE]: failure(400, 'schedule_no_target') })
    const { router } = await openAt(ADD)
    await screen.findByRole('combobox', { name: 'Caméras' })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choisissez au moins une caméra ou un canal pour cette plage',
    )
    expect(router.state.location.pathname).toBe('/settings/horaires/ajout')
  })

  it('onUpdate_ShouldSaveTheNewEnd_WhenTheUserChangesItAndSaves', async () => {
    // Arrange
    const network = fakeNetwork({
      ...houseRoutes(),
      [RULE]: ok(makeRule()),
      [UPDATE]: ok(makeRule({ endTime: '07:00' })),
    })
    await openAt(EDIT)
    fireEvent.change(await screen.findByLabelText('Fin'), { target: { value: '07:00' } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Plage enregistrée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: UPDATE,
        body: {
          targetIds: ['camera-1'],
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '22:00',
          endTime: '07:00',
        },
      }),
    )
  })

  it('onLoad_ShouldKeepTheTypeFixedAndLeaveOutARemovedCamera_WhenEditingARange', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [RULE]: ok(makeRule({ targetIds: ['camera-1', 'removed'] })) })

    // Act
    await openAt(EDIT)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Vie privée' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Caméras' })).toHaveTextContent('Salon')
  })

  it('onDelete_ShouldDeleteTheRangeAndGoBackToTheWeek_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ ...houseRoutes(), [RULE]: ok(makeRule()), [DELETE]: ok() })
    const { router } = await openAt(EDIT)
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la plage' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/horaires'))
    expect(network.sent).toContainEqual(expect.objectContaining({ route: DELETE }))
  })

  it('onAskDelete_ShouldNameTheTypeTheTimesAndTheTargets_WhenTheUserAsksToDelete', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [RULE]: ok(makeRule()) })
    await openAt(EDIT)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la plage' }))

    // Assert
    expect(
      screen.getByText('La plage « Vie privée » de 22:00 à 06:00 sur Salon ne s’appliquera plus.'),
    ).toBeVisible()
  })

  it('onDelete_ShouldSayWhyAndStayOnTheRange_WhenTheServerFails', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [RULE]: ok(makeRule()), [DELETE]: failure(500) })
    const { router } = await openAt(EDIT)
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la plage' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('DELETE /api/schedules/rule-1 · 500')
    expect(router.state.location.pathname).toBe('/settings/horaires/rule-1')
  })

  it('onLoad_ShouldSayTheRangeIsGoneWithTheWayBack_WhenItWasDeletedMeanwhile', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [RULE]: failure(404) })

    // Act
    await openAt(EDIT)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Plage introuvable' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Horaires' })).toHaveAttribute(
      'href',
      '/settings/horaires',
    )
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onUpdate_ShouldSayTheRangeIsGone_WhenItWasDeletedBeforeTheSave', async () => {
    // Arrange
    fakeNetwork({ ...houseRoutes(), [RULE]: ok(makeRule()), [UPDATE]: failure(404) })
    await openAt(EDIT)
    fireEvent.change(await screen.findByLabelText('Fin'), { target: { value: '07:00' } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Plage introuvable' })).toBeVisible()
  })

  it('onLoad_ShouldSayTheRangeCouldNotBeReadAndOfferARetry_WhenTheReadFails', async () => {
    // Arrange
    const network = fakeNetwork({ ...houseRoutes(), [RULE]: failure(500) })
    await openAt(EDIT)
    await screen.findByText('Cette plage n’a pas pu être lue.')
    network.answer(RULE, ok(makeRule()))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Vie privée' })).toBeVisible()
  })

  it('onLoad_ShouldSayTheChannelsCouldNotBeRead_WhenAddingAndTheirReadFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok([salon]), [CHANNELS]: failure(500) })

    // Act
    await openAt(ADD)

    // Assert
    expect(
      await screen.findByText('Les canaux de notification n’ont pas pu être lus.'),
    ).toBeVisible()
  })

  it('onLoad_ShouldSayTheCamerasCouldNotBeRead_WhenTheListFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: failure(500), [CHANNELS]: ok([]) })

    // Act
    await openAt(ADD)

    // Assert
    expect(await screen.findByText('La liste de vos caméras n’a pas pu être lue.')).toBeVisible()
  })
})
