import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { createFakeBackendState, installFakeBackend } from '../../tests/e2e/fixtures/fake_backend'
import { settledScreenshot } from '../../tests/e2e/fixtures/settled_screenshot'

const OUT = path.resolve(import.meta.dirname, '../../../../docs/assets')

// The phone viewport: that is the form factor the interface is designed for (UI-10).
test.use({ viewport: { width: 390, height: 844 } })

test('adding a camera', async ({ page }) => {
  await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
  let step = 0
  // Each frame waits on what makes its step recognisable, then on the motion to rest, never on a
  // timer: a capture racing the interface produces a spinner or a page mid-transition.
  const shoot = async (recognisable: Locator) => {
    await expect(recognisable).toBeVisible()
    await settledScreenshot(page, { path: path.join(OUT, `onboarding-${++step}.png`) })
  }

  await page.goto('/settings/cameras/add')
  await shoot(page.getByRole('heading', { name: 'Ajouter une caméra' }))

  await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
  await expect(page.getByRole('alertdialog').getByText(/plage configurée par défaut/)).toBeVisible()

  await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()
  await shoot(page.getByRole('button', { name: /Caméra détectée/ }))

  await page.getByRole('button', { name: /Caméra détectée/ }).click()
  await shoot(page.getByRole('button', { name: 'Ajouter', exact: true }))
})
