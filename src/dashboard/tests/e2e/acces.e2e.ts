import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, FAKE_PASSWORD } from './fixtures/fakeBackend'

/**
 * La porte d'entree du produit (ADR-54). Ces ecrans sont les seuls qu'on voit sans etre entre :
 * ce qu'ils disent est la seule aide disponible a ce moment-la.
 */

test.describe('Première ouverture', () => {
  test('user_When the install has no password yet_Should be asked to choose one before anything else', async ({
    page,
  }) => {
    const state = createFakeBackendState({ access: { installed: false, signedIn: false } })
    await installFakeBackend(page, state)

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Protégez votre installation' })).toBeVisible()
    // Rien de l'application n'est monte derriere : pas de navigation, pas de cameras.
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

    // Un refus n'est pas une panne : il se lit a cote du champ, et l'ecran reste utilisable.
    await expect(page.getByRole('alert')).toContainText('Mot de passe incorrect.')

    await page.getByLabel('Mot de passe').fill(FAKE_PASSWORD)
    await page.getByRole('button', { name: 'Déverrouiller' }).click()

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

    // La session finit ailleurs — un autre appareil l'a fermee, ou elle a expire.
    state.access = { installed: true, signedIn: false }
    await page.getByRole('link', { name: 'Historique' }).click()

    await expect(page.getByRole('heading', { name: 'Vyzio est verrouillé' })).toBeVisible()
    // Le point du chantier : une session finie se dit, elle ne laisse pas un ecran vide.
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
