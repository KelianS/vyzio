import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { ScheduleWeekView } from './schedule_week.component'

const WEEK = { path: '/settings/planification', url: '/settings/planification' }

const RULES = 'GET /api/schedules'
const CLOCK = 'GET /api/schedules/clock'
const CHANNELS = 'GET /api/notifications/channels'
const CAMERAS = 'GET /api/cameras'

const salon = makeCamera({ id: 'camera-1', displayName: 'Salon' })
const cuisine = makeCamera({ id: 'camera-2', displayName: 'Cuisine' })
const wednesdayAfternoon = { dayOfWeek: 3, time: '14:30' }

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

function dayRow(name: string) {
  return screen.getByRole('heading', { name }).closest('li') as HTMLElement
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ScheduleWeekView', () => {
  it('onLoad_ShouldPlaceEachRangeOnItsDayWithItsTypeTimesAndTargets_WhenTheHouseHasRanges', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon, cuisine]),
      [CHANNELS]: ok([makeChannelSummary({ channel: 'telegram', displayName: 'Telegram' })]),
      [CLOCK]: ok(wednesdayAfternoon),
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
    expect(
      within(dayRow('Lundi')).getByRole('link', {
        name: 'Vie privée · 22:00 → 06:00 le lendemain · Salon, Cuisine',
      }),
    ).toHaveAttribute('href', '/settings/planification/rule-1')
    expect(
      within(dayRow('Mardi')).getByRole('link', {
        name: 'Vie privée · jusqu’à 06:00, depuis la veille · Salon, Cuisine',
      }),
    ).toBeVisible()
    expect(
      within(dayRow('Samedi')).getByRole('link', {
        name: 'Sans notification · 09:00 → 12:00 · Telegram',
      }),
    ).toBeVisible()
    expect(within(dayRow('Mercredi')).getByText('Rien de prévu')).toBeInTheDocument()
  })

  it('onLoad_ShouldPlaceABlockAtItsHours_WhenARangeIsShown', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([makeRule({ targetIds: ['camera-1'], startTime: '06:00', endTime: '12:00' })]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    const block = await screen.findByRole('link', { name: /Vie privée · 06:00 → 12:00/ })
    expect(block.style.left).toBe('min(25%, 100% - 1.5rem)')
    expect(block.style.width).toBe('max(1.5rem, 25%)')
  })

  it('onLoad_ShouldCarrySundayNightOntoMonday_WhenTheWeekWrapsAround', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([makeRule({ targetIds: ['camera-1'], daysOfWeek: [0] })]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    await screen.findByRole('heading', { name: 'Lundi' })
    expect(
      within(dayRow('Lundi')).getByRole('link', {
        name: 'Vie privée · jusqu’à 06:00, depuis la veille · Salon',
      }),
    ).toBeVisible()
  })

  it('onLoad_ShouldMarkTheHousesCurrentTimeOnTodayOnly_WhenTheClockIsRead', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    await screen.findByRole('heading', { name: 'Mercredi' })
    expect(
      within(dayRow('Mercredi')).getByRole('img', { name: 'Maintenant, 14:30' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Maintenant/ })).toHaveLength(1)
  })

  it('onWatchClock_ShouldMoveTheMarker_WhenAMinuteHasPassed', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const network = fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([]),
    })
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()
    await screen.findByRole('img', { name: 'Maintenant, 14:30' })
    network.answer(CLOCK, ok({ dayOfWeek: 3, time: '14:31' }))

    // Act
    await vi.advanceTimersByTimeAsync(60_000)

    // Assert
    expect(await screen.findByRole('img', { name: 'Maintenant, 14:31' })).toBeInTheDocument()
  })

  it('onLoad_ShouldSayARuleNoLongerTargetsAnything_WhenItsCamerasWereRemoved', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([makeRule({ targetIds: ['removed'] })]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText(/Plus aucune caméra visée/)).toHaveAttribute(
      'href',
      '/settings/planification/rule-1',
    )
    expect(
      within(dayRow('Lundi')).getByRole('link', {
        name: 'Vie privée · 22:00 → 06:00 le lendemain · Plus aucune caméra visée',
      }),
    ).toBeVisible()
  })

  it('onLoad_ShouldOfferToAddARange_WhenTheWeekIsRead', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByRole('link', { name: 'Ajouter une plage' })).toHaveAttribute(
      'href',
      '/settings/planification/ajout',
    )
    expect(screen.getAllByText('Rien de prévu')).toHaveLength(7)
  })

  it('onLoad_ShouldSayTheWeekCouldNotBeReadWhereItWouldBe_WhenTheReadFails', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: failure(500),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('La planification n’a pas pu être lue.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/schedules · 500')
    expect(screen.queryByText('Rien de prévu')).not.toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheWeekCouldNotBeRead_WhenTheHouseClockCannotBeRead', async () => {
    // Arrange
    fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: failure(500),
      [RULES]: ok([]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('La planification n’a pas pu être lue.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/schedules/clock · 500')
  })

  it('onLoad_ShouldReadTheWeekAgain_WhenTheUserRetries', async () => {
    // Arrange
    const network = fakeNetwork({
      [CAMERAS]: ok([salon]),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
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
    fakeNetwork({
      [CAMERAS]: failure(500),
      [CHANNELS]: ok([]),
      [CLOCK]: ok(wednesdayAfternoon),
      [RULES]: ok([]),
    })

    // Act
    renderScreen(<ScheduleWeekView />, WEEK)
    await readTheCameraList()

    // Assert
    expect(await screen.findByText('La liste de vos caméras n’a pas pu être lue.')).toBeVisible()
  })
})
