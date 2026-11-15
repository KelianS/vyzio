import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

// Restarting is the user's act (ADR-15): saving interrupts nothing, and the question is only asked on the way out.
test.describe('Surveillance restart', () => {
  const trigger = (name = /Appliquer les changements/) => ({ name })

  test('RestartSurveillanceTrigger_ShouldStayHidden_WhenNothingChanged', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/retention')

    // Its absence is the information: everything saved is in service.
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('RestartSurveillanceTrigger_ShouldAppearWithoutInterrupting_WhenTheUserSavesASetting', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/retention')

    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).not.toContainText('interrompt')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByRole('button', trigger())).toBeVisible()
  })

  test('RestartSurveillanceTrigger_ShouldConfirmThenClear_WhenTheUserRestarts', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/retention')

    await page.getByRole('button', trigger()).click()

    // The cost is stated before acting.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('La surveillance s’interrompt quelques secondes.')

    await dialog.getByRole('button', { name: 'Redémarrer' }).click()
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('RestartSurveillanceTrigger_ShouldKeepSayingItFailed_WhenTheRestartFails', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    state.restartFails = true
    await installFakeBackend(page, state)
    await page.goto('/settings/retention')

    await page.getByRole('button', trigger()).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Redémarrer' }).click()

    // Saying it once then forgetting would let the user believe the settings were taken up.
    const failed = page.getByRole('button', { name: /Redémarrage échoué/ })
    await expect(failed).toBeVisible()

    // Leaving the settings asks the question again - it must start from the failure, not from zero.
    await page.getByRole('banner').getByRole('button', { name: 'Retour' }).click()
    const guard = page.getByRole('alertdialog')
    await expect(guard).toContainText('La surveillance n’a pas redémarré.')
    await guard.getByRole('button', { name: 'Réessayer' }).click()

    // Outside the settings the failure stays, as the bar's alert (UI-17, UI-30).
    await expect(page).toHaveURL('/')
    await expect(
      page
        .getByRole('list', { name: 'Alertes' })
        .getByText('Les changements ne sont pas appliqués'),
    ).toBeVisible()
  })

  test('RestartSurveillanceTrigger_ShouldShowWhatSupportNeeds_WhenTheServerBreaksOnTheRestart', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    state.restartBreaks = true
    await installFakeBackend(page, state)
    await page.goto('/settings/retention')

    await page.getByRole('button', trigger()).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Redémarrer' }).click()
    await page.getByRole('button', { name: /Redémarrage échoué/ }).click()

    // A photo of this dialog is what support receives: the failed request must be readable on it (UI-01).
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Vyzio a rencontré une erreur')
    await expect(dialog).toContainText('POST /api/cameras/apply-configuration · 500')
    await expect(dialog).toContainText('trace 00-e2e-01')
  })

  test('NavigationGuard_ShouldAskNothing_WhenTheUserMovesBetweenSettingsPages', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/detection')

    // The most common gesture while configuring: asking here would nag, and stack with the draft guard.
    await page.getByRole('link', { name: 'Conservation', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras/camera-1/retention')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  // Wait for the page to be mounted: with two blockers competing this passed by a race.
  for (const [url, where] of [
    ['/settings/retention', 'a settings page'],
    ['/settings/cameras/camera-1/detection', 'a camera page'],
  ]) {
    test(`NavigationGuard_ShouldAskAndLetThroughEitherWay_WhenTheUserLeavesTheSettings (${where})`, async ({
      page,
    }) => {
      const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
      state.pendingChanges = true
      await installFakeBackend(page, state)
      await page.goto(url)
      await expect(page.getByRole('region', { name: 'Modifications en attente' })).toBeHidden()

      await page.getByRole('banner').getByRole('button', { name: 'Retour' }).click()

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText('Redémarrer la surveillance maintenant ?')

      // "Plus tard" lets through too: the gap is allowed, and asked about from the settings only (UI-28).
      await dialog.getByRole('button', { name: 'Plus tard' }).click()
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('button', trigger())).toHaveCount(0)
    })
  }

  test('NavigationGuard_ShouldAskAboutUnsavedEditsFirst_WhenAPageHasSome', async ({ page }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/retention')

    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    await page.getByRole('banner').getByRole('button', { name: 'Retour' }).click()

    // Losing edits comes first: the only one of the two whose wrong answer destroys something.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Quitter sans enregistrer ?')
  })
})
