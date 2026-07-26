import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Hub — privacy toggle', () => {
  test('user_When enabling privacy mode on a camera_Should confirm and reflect it live', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon', isEnabled: true })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')

    await expect(page.locator('.hub-live-grid').getByText('Salon')).toBeVisible()

    await page.getByRole('button', { name: 'Mode vie privée global' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('vie privée')

    await page.getByRole('button', { name: 'Couper toutes les caméras' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(page.getByRole('button', { name: 'Désactiver le mode vie privée' })).toBeVisible()
  })
})
