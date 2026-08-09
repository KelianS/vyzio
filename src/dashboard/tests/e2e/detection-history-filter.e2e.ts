import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fakeBackend'

test.describe('Historique — filtres', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({}),
          makeFakeDetectionEvent({
            eventId: 'evt-2',
            camera: 'garage',
            cameraName: 'garage',
            label: 'car',
            confidence: 0.81,
          }),
        ],
      }),
    )
    await page.goto('/history')
    // Les filtres sont une option qu'on ouvre (voir `ui-defauts.e2e.ts`), pas le haut de l'ecran.
    await page.getByRole('button', { name: 'Filtrer' }).click()
  })

  test('user_When filtering by detection type_Should narrow the list', async ({ page }) => {
    await expect(page.getByText(/front door/)).toBeVisible()
    await expect(page.getByText(/garage/)).toBeVisible()

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await expect(page.getByText(/garage/)).toBeVisible()
    await expect(page.getByText(/front door/)).toHaveCount(0)
  })

  test('user_When a filter matches nothing_Should be told the filters are the reason', async ({
    page,
  }) => {
    await page.getByLabel('Caméra').fill('cave')

    await expect(page.getByText('Aucune détection avec ces filtres.')).toBeVisible()
  })

  test('user_When a filter is active_Should be offered a way back to everything', async ({
    page,
  }) => {
    // Rien a reinitialiser tant que rien n'est filtre.
    await expect(page.getByRole('button', { name: 'Tout afficher' })).toHaveCount(0)

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await expect(page.getByText(/front door/)).toBeVisible()
    await expect(page.getByText(/garage/)).toBeVisible()
  })
})
