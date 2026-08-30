import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, FAKE_PASSWORD } from './fixtures/fakeBackend'

/**
 * The product's front door (ADR-54). These screens are the only ones seen without being in, so what
 * they say is the only help available at that moment.
 */

test.describe('Première ouverture', () => {
  test('user_When the install has no password yet_Should be asked to choose one before anything else', async ({
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

  test('user_When the chosen password is too short_Should be told before submitting it', async ({
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

test.describe('Connexion', () => {
  test('user_When the password is wrong_Should be told next to the field, and able to try again', async ({
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

test.describe('Changer son mot de passe', () => {
  test('user_When the current password is wrong_Should be refused without losing the session', async ({
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

  test('user_When the password is changed_Should be the new one that unlocks afterwards', async ({
    page,
  }) => {
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

test.describe('Mot de passe oublie', () => {
  test('user_When the host removed the password_Should be asked for a new one and told nothing was lost', async ({
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

test.describe('Fin de session', () => {
  test('user_When the session ends while a screen is open_Should be brought back and told so', async ({
    page,
  }) => {
    const state = createFakeBackendState()
    await installFakeBackend(page, state)

    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()

    // The session ends elsewhere: another device closed it, or it expired.
    state.access = { ...state.access, signedIn: false }

    // Nothing is clicked on purpose: the status poll notices within its own interval, which is the
    // stronger promise — the screen does not wait for the user to walk into a closed door.
    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible({
      timeout: 12_000,
    })
    // The point of the whole thing: a session that ended says so, it does not leave a blank screen.
    await expect(page.getByText('Votre session a pris fin.')).toBeVisible()
  })

  test('user_When signing out from the settings_Should land back on the locked screen', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/acces')
    await page.getByRole('button', { name: 'Se déconnecter' }).click()

    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()
  })

  test('user_When cutting off every device_Should confirm first, then be locked out too', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/acces')
    await page.getByRole('button', { name: 'Déconnecter tous les appareils' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Déconnecter tous les appareils ?')
    await dialog.getByRole('button', { name: 'Déconnecter' }).click()

    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()
  })
})
