import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

// The form opens on a night, the range users mean by "at night" (SPECS 9.2).
test.describe('Privacy schedule', () => {
  test('PrivacyScheduleSection_ShouldKeepTheNight_WhenTheDefaultRangeIsAdded', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await expect(page.getByText('Se termine le lendemain à 06:00.')).toBeVisible()
    await page.getByRole('button', { name: 'Ajouter à cette caméra' }).click()

    await expect(page.getByText('22:00 → 06:00 le lendemain')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('PrivacyScheduleSection_ShouldSayWhatToChange_WhenStartAndEndAreTheSame', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await page.getByLabel('Fin').fill('22:00')
    await page.getByRole('button', { name: 'Ajouter à cette caméra' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('choisissez deux heures différentes')
    await expect(alert).toContainText('schedule_empty_range')
  })
})
