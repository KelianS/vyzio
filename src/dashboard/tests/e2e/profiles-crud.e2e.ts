import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Personnes', () => {
  test('user_When adding a person_Should land on their photos, where recognition starts', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ profiles: [] }))

    await page.goto('/settings/detection/personnes')
    await expect(page.getByText('Personne d’enregistrée pour l’instant.')).toBeVisible()

    await page.getByRole('link', { name: 'Ajouter une personne' }).click()
    await page.getByRole('textbox', { name: 'Nom' }).fill('Alice')
    await page.getByRole('button', { name: 'Ajouter' }).click()

    // The rest of the task, and not the page: without a photo the profile recognises
    // nobody, and nothing else would say so.
    await expect(page).toHaveURL(/\/settings\/detection\/personnes\/profile-\d+\/photos$/)
    await expect(
      page.getByText('Aucune photo : la reconnaissance est inactive pour cette personne.'),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Personnes' }).click()
    await expect(page.getByRole('link', { name: /Alice/ })).toBeVisible()
  })

  test('user_When renaming a person_Should see the page follow the new name', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        profiles: [
          {
            id: 'profile-1',
            name: 'Alice',
            category: 'family',
            alertMode: 'always',
            lastSeenAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    )

    await page.goto('/settings/detection/personnes/profile-1/identite')
    await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Nom' }).fill('Alice Martin')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    // The name belongs to the shell: if it did not follow, the page would name
    // somebody who no longer exists.
    await expect(page.getByRole('heading', { name: 'Alice Martin' })).toBeVisible()
  })
})
