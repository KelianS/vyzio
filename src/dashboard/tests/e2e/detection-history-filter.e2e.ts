import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

const eventAt = (overrides: Record<string, unknown>) => ({
  eventId: 'evt-1',
  frigateEventId: 'frigate-1',
  lifecycle: 'end',
  camera: 'front_door',
  label: 'person',
  identity: null,
  profileId: null,
  confidence: 0.92,
  occurredAt: new Date().toISOString(),
  hasClip: false,
  hasSnapshot: false,
  ...overrides,
})

test.describe('Historique — filtres', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          eventAt({}),
          eventAt({ eventId: 'evt-2', camera: 'garage', label: 'car', confidence: 0.81 }),
        ],
      }),
    )
    await page.goto('/history')
  })

  test('user_When filtering by detection type_Should narrow the list', async ({ page }) => {
    await expect(page.getByText('2 détections.')).toBeVisible()
    await expect(page.getByText(/front_door/)).toBeVisible()
    await expect(page.getByText(/garage/)).toBeVisible()

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await expect(page.getByText(/garage/)).toBeVisible()
    await expect(page.getByText(/front_door/)).toHaveCount(0)
    // Le compte suit le filtre, et dit qu'il en vient un.
    await expect(page.getByText('1 détection avec ces filtres.')).toBeVisible()
  })

  test('user_When a filter is active_Should be offered a way back to everything', async ({
    page,
  }) => {
    // Rien a reinitialiser tant que rien n'est filtre.
    await expect(page.getByRole('button', { name: 'Tout afficher' })).toHaveCount(0)

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await expect(page.getByText('2 détections.')).toBeVisible()
  })
})
