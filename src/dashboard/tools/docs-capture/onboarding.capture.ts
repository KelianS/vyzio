import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { createFakeBackendState, installFakeBackend } from '../../tests/e2e/fixtures/fakeBackend'

const OUT = path.resolve(import.meta.dirname, '../../../../docs/assets')

// The phone viewport: that is the form factor the interface is designed for (SPECS 7.2).
test.use({ viewport: { width: 390, height: 844 } })

test('adding a camera', async ({ page }) => {
  await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
  let step = 0
  // Each frame waits on what makes its step recognisable, never on a timer: a capture racing the
  // interface produces a screenshot of a spinner.
  const shoot = async (settled: Locator) => {
    await expect(settled).toBeVisible()
    await page.screenshot({ path: path.join(OUT, `onboarding-${++step}.png`) })
  }

  await page.goto('/settings/cameras/ajout')
  await shoot(page.getByRole('heading', { name: 'Ajouter une caméra' }))

  await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
  await shoot(page.getByRole('alertdialog'))

  await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()
  await shoot(page.getByRole('button', { name: /Caméra détectée/ }))

  await page.getByRole('button', { name: /Caméra détectée/ }).click()
  await page.getByRole('button', { name: 'Vérifier la connexion' }).click()
  await shoot(page.getByText(/Flux valide/))

  await page.getByRole('button', { name: 'Ajouter la caméra' }).click()
  await shoot(page.getByRole('button', { name: /Appliquer les changements/ }))
})
