import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Accueil — couper la surveillance', () => {
  test('user_When cutting every camera_Should confirm, then see the page say so', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon', isEnabled: true })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')

    // Home says first what is being watched - that is what one comes to check.
    await expect(page.getByRole('heading', { name: '1 caméra sous surveillance' })).toBeVisible()
    await expect(page.getByText('Salon')).toBeVisible()

    await page.getByRole('button', { name: 'Tout couper' }).click()

    // The cost is said beforehand: nothing more is recorded nor reported.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Plus rien n’est enregistré ni signalé')
    await dialog.getByRole('button', { name: 'Tout couper' }).click()

    await expect(page.getByRole('heading', { name: 'Surveillance coupée' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reprendre la surveillance' })).toBeVisible()
  })
})
