import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, FAKE_PASSWORD } from './fixtures/fake_backend'

/**
 * The product's front door (ADR-54). These screens are the only ones seen without being in, so what
 * they say is the only help available at that moment.
 */

test.describe('First opening', () => {
  test('AccessGate_ShouldAskForAPasswordBeforeAnythingElse_WhenTheInstallationHasNone', async ({
    page,
  }) => {
    const state = createFakeBackendState({ access: { installed: false, signedIn: false } })
    await installFakeBackend(page, state)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Protégez votre installation' })).toBeVisible()
    // None of the application is mounted behind it: no navigation, no cameras.
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0)

    await page.getByLabel('Mot de passe').fill(FAKE_PASSWORD)
    await page.getByRole('button', { name: 'Protéger et continuer' }).click()

    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  })

  test('AccessGate_ShouldSayTheMinimumAndWithholdSubmit_WhenTheChosenPasswordIsTooShort', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ access: { installed: false, signedIn: false } }),
    )

    await page.goto('/')
    await page.getByLabel('Mot de passe').fill('court')

    await expect(page.getByText('Au moins 8 caractères.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Protéger et continuer' })).toBeDisabled()
  })
})

test.describe('Sign-in', () => {
  test('AccessGate_ShouldSayItBesideTheFieldAndLetTheUserRetry_WhenThePasswordIsWrong', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ access: { installed: true, signedIn: false } }),
    )

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()

    await page.getByLabel('Mot de passe').fill('pas-le-bon-mot')
    await page.getByRole('button', { name: 'Déverrouiller' }).click()

    // A refusal is not a failure: it reads beside the field, and the screen stays usable.
    await expect(page.getByRole('alert')).toContainText('Mot de passe incorrect.')

    await page.getByLabel('Mot de passe').fill(FAKE_PASSWORD)
    await page.getByRole('button', { name: 'Déverrouiller' }).click()

    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  })
})

test.describe('Password change', () => {
  test('AccessView_ShouldRefuseAndKeepTheSession_WhenTheCurrentPasswordIsWrong', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/acces')
    await page.getByLabel('Mot de passe actuel').fill('pas-le-bon-mot')
    await page.getByLabel('Nouveau mot de passe').fill('un-nouveau-mot')
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click()

    await expect(page.getByRole('alert')).toContainText('Mot de passe actuel incorrect.')
    // A refused field is not a session ending: the screen stays where it was.
    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toHaveCount(0)
  })

  test('AccessView_ShouldLetOnlyTheNewPasswordUnlock_WhenThePasswordChanges', async ({ page }) => {
    const state = createFakeBackendState()
    await installFakeBackend(page, state)

    await page.goto('/settings/acces')
    await page.getByLabel('Mot de passe actuel').fill(FAKE_PASSWORD)
    await page.getByLabel('Nouveau mot de passe').fill('un-nouveau-mot')
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click()

    await expect(page.getByText('Mot de passe changé.')).toBeVisible()

    // What matters is not the message: it is that the old password stops opening anything.
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()

    await page.getByLabel('Mot de passe').fill(FAKE_PASSWORD)
    await page.getByRole('button', { name: 'Déverrouiller' }).click()
    await expect(page.getByRole('alert')).toContainText('Mot de passe incorrect.')

    await page.getByLabel('Mot de passe').fill('un-nouveau-mot')
    await page.getByRole('button', { name: 'Déverrouiller' }).click()
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  })
})

test.describe('Forgotten password', () => {
  test('AccessGate_ShouldAskForANewPasswordAndSayNothingWasLost_WhenTheHostRemovedIt', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        access: { installed: false, signedIn: false, awaitingReset: true },
      }),
    )

    await page.goto('/')

    // Not the same moment as a first install: the installation is already there.
    await expect(
      page.getByRole('heading', { name: 'Choisissez un nouveau mot de passe' }),
    ).toBeVisible()
    await expect(page.getByText('n’ont pas bougé')).toBeVisible()

    await page.getByLabel('Mot de passe').fill('un-nouveau-mot')
    await page.getByRole('button', { name: 'Enregistrer et continuer' }).click()

    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  })
})

test.describe('Session end', () => {
  test('AccessGate_ShouldLockAndSaySo_WhenTheSessionEndsWhileAScreenIsOpen', async ({ page }) => {
    const state = createFakeBackendState()
    await installFakeBackend(page, state)

    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()

    // The session ends elsewhere: another device closed it, or it expired.
    state.access = { ...state.access, signedIn: false }

    // Nothing is clicked on purpose: the status poll notices within its own interval, which is the
    // stronger promise: the screen does not wait for the user to walk into a closed door.
    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible({
      timeout: 12_000,
    })
    // The point of the whole thing: a session that ended says so, it does not leave a blank screen.
    await expect(page.getByText('Votre session a pris fin.')).toBeVisible()
  })

  test('AccessView_ShouldLeadBackToTheLockedScreen_WhenTheUserSignsOut', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/acces')
    await page.getByRole('button', { name: 'Se déconnecter' }).click()

    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()
  })

  test('AccessView_ShouldConfirmThenLockThisDeviceToo_WhenTheUserSignsOutEveryDevice', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/acces')
    await page.getByRole('button', { name: 'Déconnecter tous les appareils' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Déconnecter tous les appareils ?')
    // The cost is read at the moment of deciding, not in a paragraph above the button.
    await expect(dialog).toContainText('celui-ci compris')
    await dialog.getByRole('button', { name: 'Déconnecter' }).click()

    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()
  })
})
