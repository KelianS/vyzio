import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
} from './fixtures/fake_backend'

const salon = makeFakeCamera({ id: 'camera-1', slug: 'salon', displayName: 'Salon' })
const cuisine = makeFakeCamera({ id: 'camera-2', slug: 'cuisine', displayName: 'Cuisine' })

// One calendar for every scheduled rule of the house (SCHED-01, ADR-15).
test.describe('House calendar', () => {
  test('ScheduleWeekView_ShouldShowTheNightForBothCameras_WhenOnePrivacyRangeTargetsThem', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, cuisine] }))
    await page.goto('/settings')
    await page.getByRole('link', { name: /Planification/ }).click()

    await page
      .getByRole('region', { name: 'Caméras coupées' })
      .getByRole('link', { name: 'Ajouter une plage' })
      .click()
    // The effect of the type reads before anything is chosen.
    await expect(
      page.getByText('Aucun enregistrement, aucune détection, aucune notification.'),
    ).toBeVisible()
    await page.getByRole('checkbox', { name: 'Salon' }).click()
    await page.getByRole('checkbox', { name: 'Cuisine' }).click()
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page).toHaveURL(/\/settings\/schedule$/)
    const monday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Lundi' }) })
    await expect(
      monday.getByRole('link', {
        name: 'Caméras coupées · 22 h – 6 h le lendemain · Salon, Cuisine',
      }),
    ).toBeVisible()
    // Monday's night ends on Tuesday: the calendar shows it where it still runs.
    const tuesday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Mardi' }) })
    await expect(
      tuesday.getByRole('link', {
        name: 'Caméras coupées · jusqu’à 6 h, depuis la veille · Salon, Cuisine',
      }),
    ).toBeVisible()
  })

  test('CameraPrivacyView_ShouldCountTheRangeAndLeadToTheCalendar_WhenARangeTargetsTheCamera', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [salon, cuisine],
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'privacy',
            targetIds: ['camera-1', 'camera-2'],
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '22:00',
            endTime: '06:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/cameras/camera-1/privacy')

    await expect(page.getByText('1 plage « Caméras coupées » s’applique')).toBeVisible()
    await page.getByRole('link', { name: 'Voir la planification' }).click()

    await expect(page).toHaveURL(/\/settings\/schedule$/)
    await expect(page.getByRole('link', { name: /Salon, Cuisine/ }).first()).toBeVisible()
  })

  test('ScheduleRuleView_ShouldSayWhatToChange_WhenStartAndEndAreTheSame', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon] }))
    await page.goto('/settings/schedule/add')

    await page.getByRole('checkbox', { name: 'Salon' }).click()
    await page.getByLabel('À', { exact: true }).fill('22:00')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('choisissez deux heures différentes')
    await expect(alert).toContainText('schedule_empty_range')
    await expect(page).toHaveURL(/\/settings\/schedule\/add$/)
  })

  test('NotificationChannelView_ShouldCountTheMutingRange_WhenOneTargetsTheChannel', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        notificationChannels: { telegram: makeFakeChannel('telegram') },
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'mute_notifications',
            targetIds: ['telegram'],
            daysOfWeek: [0, 6],
            startTime: '09:00',
            endTime: '12:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/notifications/telegram')

    await expect(page.getByText('1 plage « Silence » s’applique')).toBeVisible()
    await page.getByRole('link', { name: 'Voir la planification' }).click()

    const saturday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Samedi' }) })
    await expect(
      saturday.getByRole('link', { name: 'Silence · 9 h – 12 h · Telegram' }),
    ).toBeVisible()
  })

  test('ScheduleRuleView_ShouldTakeTheRangeOffTheWeek_WhenTheUserDeletesIt', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [salon],
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'privacy',
            targetIds: ['camera-1'],
            daysOfWeek: [3],
            startTime: '08:00',
            endTime: '12:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/schedule')

    await page.getByRole('link', { name: /Caméras coupées · 8 h – 12 h/ }).click()
    await page.getByRole('button', { name: 'Supprimer la plage' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()

    await expect(page).toHaveURL(/\/settings\/schedule$/)
    await expect(page.getByText('Rien de prévu')).toHaveCount(7)
  })

  test('ScheduleWeekView_ShouldPlaceTheRangeAtItsHoursMarkNowAndOpenIt_WhenTheUserTapsItsBlock', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [salon],
        houseClock: { dayOfWeek: 2, time: '07:30' },
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'privacy',
            targetIds: ['camera-1'],
            daysOfWeek: [2],
            startTime: '08:00',
            endTime: '12:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/schedule')

    const tuesday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Mardi' }) })
    await expect(tuesday.getByRole('img', { name: 'Maintenant, 07:30' })).toBeVisible()
    const block = tuesday.getByRole('link', { name: 'Caméras coupées · 8 h – 12 h · Salon' })
    // 08:00 to 12:00 starts a third of the way along the day's bar and spans a sixth of it.
    const [start, width] = await block.evaluate((element) => {
      const bar = element.closest('ul')!.parentElement!.getBoundingClientRect()
      const own = element.getBoundingClientRect()
      return [(own.left - bar.left) / bar.width, own.width / bar.width]
    })
    expect(start).toBeCloseTo(1 / 3, 1)
    expect(width).toBeCloseTo(1 / 6, 1)

    await block.click()
    await expect(page).toHaveURL(/\/settings\/schedule\/rule-1$/)
  })

  test('ScheduleWeekView_ShouldOpenARangeAndShowItsChange_WhenItsRowIsTappedEditedAndSaved', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [salon],
        scheduleRules: [
          {
            id: 'rule-1',
            kind: 'privacy',
            targetIds: ['camera-1'],
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '22:00',
            endTime: '07:00',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    await page.goto('/settings/schedule')

    await page
      .getByRole('region', { name: 'Caméras coupées' })
      .getByRole('link', { name: '22 h – 7 h Salon · lundi au vendredi' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Caméras coupées' })).toBeVisible()
    await expect(page.getByText('Se termine le lendemain.')).toBeVisible()
    await page.getByRole('button', { name: 'Samedi' }).click()
    await page.getByLabel('À', { exact: true }).fill('06:00')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page).toHaveURL(/\/settings\/schedule$/)
    await expect(
      page
        .getByRole('region', { name: 'Caméras coupées' })
        .getByRole('link', { name: '22 h – 6 h Salon · lundi au samedi' }),
    ).toBeVisible()
    const saturday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Samedi' }) })
    await expect(
      saturday.getByRole('link', { name: 'Caméras coupées · 22 h – 6 h le lendemain · Salon' }),
    ).toBeVisible()
  })
})
