import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { ScheduleWeekView } from './schedule_week.component'

const WEEK = { path: '/settings/horaires', url: '/settings/horaires' }

const RULES = 'GET /api/schedules'
const CHANNELS = 'GET /api/notifications/channels'
const CAMERAS = 'GET /api/cameras'

const salon = makeCamera({ id: 'camera-1', displayName: 'Salon' })
const cuisine = makeCamera({ id: 'camera-2', displayName: 'Cuisine' })

function makeRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    kind: ScheduleRuleKind.Privacy,
    targetIds: ['camera-1', 'camera-2'],
    daysOfWeek: [1],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function dayBlock(name: string) {
  return screen.getByRole('heading', { name }).closest('li') as HTMLElement
}

describe('ScheduleWeekView', () => {
  it('onLoad_ShouldShowEachRangeUnderItsDaysWithItsTypeAndTargets_WhenTheHouseHasRanges', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon, cuisine]),
      [CHANNELS]: ok([makeChannelSummary({ channel: 'telegram', displayName: 'Telegram' })]),
      [RULES]: ok([
        makeRule(),
        makeRule({
          id: 'rule-2',
          kind: ScheduleRuleKind.MuteNotifications,
          targetIds: ['telegram'],
          daysOfWeek: [6],
          startTime: '09:00',
          endTime: '12:00',
        }),
      ]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    await screen.findByRole('heading', { name: 'Lundi' })
    const monday = within(dayBlock('Lundi'))
    expect(
      monday.getByRole('link', { name: /Vie privée · 22:00 → 06:00 le lendemains*Salon, Cuisine/ }),
    ).toHaveAttribute('href', '/settings/horaires/rule-1')
    expect(
      within(dayBlock('Mardi')).getByRole('link', { name: /jusqu’à 06:00, depuis la veille/ }),
    ).toBeVisible()
    expect(
      within(dayBlock('Samedi')).getByRole('link', {
        name: /Sans notification · 09:00 → 12:00s*Telegram/,
      }),
    ).toBeVisible()
    expect(within(dayBlock('Mercredi')).getByText('Rien de prévu')).toBeVisible()
  })

  it('onLoad_ShouldSayARuleNoLongerTargetsAnything_WhenItsCamerasWereRemoved', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [RULES]: ok([makeRule({ targetIds: ['removed'] })]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    // Once under its day, once under the next where its night ends.
    expect(await screen.findAllByText('Plus aucune caméra visée')).toHaveLength(2)
  })

  it('onLoad_ShouldOfferToAddARange_WhenTheWeekIsRead', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok([salon]), [CHANNELS]: ok([]), [RULES]: ok([]) })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByRole('link', { name: 'Ajouter une plage' })).toHaveAttribute(
      'href',
      '/settings/horaires/ajout',
    )
    expect(screen.getAllByText('Rien de prévu')).toHaveLength(7)
  })

  it('onLoad_ShouldSayTheWeekCouldNotBeReadWhereItWouldBe_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: ok([salon]), [CHANNELS]: ok([]), [RULES]: failure(500) })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('Les horaires n’ont pas pu être lus.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/schedules · 500')
    expect(screen.queryByText('Rien de prévu')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldReadTheWeekAgain_WhenTheUserRetries', async () => {
    // Arrange
    const network = fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [RULES]: failure(500),
    })
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(RULES, ok([]))

    // Act
    await userEvent.click(retry)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Lundi' })).toBeVisible()
  })

  it('onLoad_ShouldSayTheCamerasCouldNotBeRead_WhenTheListFails', async () => {
    // Arrange
    fakeNetwork({ [CAMERAS]: failure(500), [CHANNELS]: ok([]), [RULES]: ok([]) })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('La liste de vos caméras n’a pas pu être lue.')).toBeVisible()
  })
})
