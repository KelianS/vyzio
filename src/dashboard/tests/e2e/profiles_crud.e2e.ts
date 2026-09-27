import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

test.describe('People', () => {
  test('AddPersonView_ShouldOpenThePhotosOfThePerson_WhenTheUserAddsSomeone', async ({ page }) => {
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

  test('PersonIdentityView_ShouldShowTheNewNameOnThePage_WhenTheUserRenamesThePerson', async ({
    page,
  }) => {
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

  test('PersonCamerasView_ShouldKeepTheChosenCamera_WhenTheUserRestrictsThePersonToIt', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [
          makeFakeCamera({ id: 'camera-1', displayName: 'Entrée' }),
          makeFakeCamera({ id: 'camera-2', slug: 'jardin', displayName: 'Jardin' }),
        ],
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
    await page.goto('/settings/detection/personnes/profile-1/cameras')

    // A new person is signalled everywhere: every camera is offered, none ticked.
    const cameras = page.getByRole('combobox', { name: 'Me notifier seulement sur' })
    await cameras.click()
    await expect(page.getByRole('checkbox', { name: 'Jardin' })).not.toBeChecked()
    await page.getByRole('checkbox', { name: 'Entrée' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Caméras enregistrées.')).toBeVisible()

    await page.reload()
    await expect(cameras).toHaveText(/Entrée/)
  })
})
