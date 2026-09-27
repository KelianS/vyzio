import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeChannel,
} from './fixtures/fake_backend'

const salon = makeFakeCamera({ id: 'camera-1', slug: 'salon', displayName: 'Salon' })
const cuisine = makeFakeCamera({ id: 'camera-2', slug: 'cuisine', displayName: 'Cuisine' })

// One calendar for every scheduled rule of the house (SPECS 7.3, ADR-63).
test.describe('House calendar', () => {
  test('ScheduleWeekView_ShouldShowTheNightForBothCameras_WhenOnePrivacyRangeTargetsThem', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon, cuisine] }))
    await page.goto('/settings')
    await page.getByRole('link', { name: /Planification/ }).click()

    await page.getByRole('link', { name: 'Ajouter une plage' }).click()
    // The effect of the type reads before anything is chosen.
    await expect(
      page.getByText('Aucun enregistrement, aucune détection, aucune notification.'),
    ).toBeVisible()
    await page.getByRole('combobox', { name: 'Caméras' }).click()
    await page.getByRole('checkbox', { name: 'Salon' }).click()
    await page.getByRole('checkbox', { name: 'Cuisine' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Ajouter' }).click()

    await expect(page).toHaveURL(/\/settings\/planification$/)
    const monday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Lundi' }) })
    await expect(
      monday.getByRole('link', {
        name: 'Vie privée · 22:00 → 06:00 le lendemain · Salon, Cuisine',
      }),
    ).toBeVisible()
    // Monday's night ends on Tuesday: the calendar shows it where it still runs.
    const tuesday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Mardi' }) })
    await expect(
      tuesday.getByRole('link', {
        name: 'Vie privée · jusqu’à 06:00, depuis la veille · Salon, Cuisine',
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
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await expect(page.getByText('1 plage « Vie privée » s’applique')).toBeVisible()
    await page.getByRole('link', { name: 'Voir la planification' }).click()

    await expect(page).toHaveURL(/\/settings\/planification$/)
    await expect(page.getByRole('link', { name: /Salon, Cuisine/ }).first()).toBeVisible()
  })

  test('ScheduleRuleView_ShouldSayWhatToChange_WhenStartAndEndAreTheSame', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [salon] }))
    await page.goto('/settings/planification/ajout')

    await page.getByRole('combobox', { name: 'Caméras' }).click()
    await page.getByRole('checkbox', { name: 'Salon' }).click()
    await page.keyboard.press('Escape')
    await page.getByLabel('Fin').fill('22:00')
    await page.getByRole('button', { name: 'Ajouter' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('choisissez deux heures différentes')
    await expect(alert).toContainText('schedule_empty_range')
    await expect(page).toHaveURL(/\/settings\/planification\/ajout$/)
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

    await expect(page.getByText('1 plage « Sans notification » s’applique')).toBeVisible()
    await page.getByRole('link', { name: 'Voir la planification' }).click()

    const saturday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Samedi' }) })
    await expect(
      saturday.getByRole('link', { name: 'Sans notification · 09:00 → 12:00 · Telegram' }),
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
    await page.goto('/settings/planification')

    await page.getByRole('link', { name: /Vie privée · 08:00 → 12:00/ }).click()
    await page.getByRole('button', { name: 'Supprimer la plage' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()

    await expect(page).toHaveURL(/\/settings\/planification$/)
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
    await page.goto('/settings/planification')

    const tuesday = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Mardi' }) })
    await expect(tuesday.getByRole('img', { name: 'Maintenant, 07:30' })).toBeVisible()
    const block = tuesday.getByRole('link', { name: 'Vie privée · 08:00 → 12:00 · Salon' })
    // 08:00 to 12:00 is the second sixth of the day's bar.
    const [start, width] = await block.evaluate((element) => {
      const bar = element.closest('ul')!.parentElement!.getBoundingClientRect()
      const own = element.getBoundingClientRect()
      return [(own.left - bar.left) / bar.width, own.width / bar.width]
    })
    expect(start).toBeCloseTo(1 / 3, 1)
    expect(width).toBeCloseTo(1 / 6, 1)

    await block.click()
    await expect(page).toHaveURL(/\/settings\/planification\/rule-1$/)
  })
})
