import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeChannel } from './fixtures/fakeBackend'

test.describe('Notifications — les canaux', () => {
  test('user_When configuring and enabling a channel_Should be warned before data leaves', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/notifications')
    await page.getByRole('link', { name: 'Ajouter un canal' }).click()
    await page.getByRole('link', { name: 'Telegram' }).click()

    await expect(page.getByText('Pas encore configuré.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Token du bot' }).fill('123456:ABCDEF')
    await page.getByRole('textbox', { name: 'Identifiant de conversation' }).fill('987654321')
    await page.getByRole('switch', { name: 'Alertes Telegram' }).click()

    await page.getByRole('button', { name: 'Enregistrer' }).click()

    // Invariant vie privee : les images quittent le reseau local, on le dit
    // avant, pas apres.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('serveurs de Telegram')
    await dialog.getByRole('button', { name: 'Activer' }).click()

    await expect(page.getByText('Les alertes sont envoyées.')).toBeVisible()

    await page.getByRole('button', { name: 'Envoyer un message de test' }).click()
    await expect(page.getByText('Message envoyé : le canal fonctionne.')).toBeVisible()
  })

  // La barre de l'etape : un second canal se configure avec le meme ecran, monte
  // sur ce qu'il declare, et avec son propre mode d'emploi (ADR-50, ADR-52).
  test('user_When adding a second channel_Should get the same screen with that channel instructions', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/notifications/discord')

    await expect(page.getByRole('heading', { name: 'Discord' })).toBeVisible()
    await expect(page.getByText('Invitez-le sur votre serveur')).toBeVisible()

    await page.getByRole('textbox', { name: 'Token du bot' }).fill('discord-bot-token')
    await page.getByRole('textbox', { name: 'Identifiant du salon' }).fill('4242')
    await page.getByRole('switch', { name: 'Alertes Discord' }).click()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Activer' }).click()

    // Le mode d'emploi ne disparait pas une fois le canal en place : il se
    // replie (ADR-53), pour rester la le jour ou on doit refaire un token.
    await expect(page.getByText('Où trouver ces informations dans Discord ?')).toBeVisible()

    await page.goto('/settings/notifications')
    await expect(page.getByRole('link', { name: /Discord/ })).toBeVisible()
  })

  test('user_When nothing is configured_Should not be able to send a test', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/telegram')

    // Tester sans canal enverrait vers nulle part : le bouton le dit au lieu
    // de laisser essayer.
    await expect(page.getByRole('button', { name: 'Envoyer un message de test' })).toBeDisabled()
  })

  test('user_When restricting hours_Should only then be asked which ones', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/telegram')

    // Les heures n'existent que si la plage est demandee : les montrer grisees
    // ferait deux reglages la ou l'utilisateur n'en decide qu'un.
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toHaveCount(0)
    await page.getByRole('switch', { name: 'Seulement à certaines heures' }).click()
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toBeVisible()
  })

  // Le critere de l'etape : debrancher le reseau doit se voir dans les reglages,
  // sinon Vyzio passe pour en panne alors qu'il attend (SPECS 5.4).
  test('user_When the channel stopped listening_Should read it, and why, where commands are set up', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        notificationChannels: { telegram: makeFakeChannel('telegram') },
        channelListening: {
          telegram: {
            listening: false,
            since: null,
            interruptedAt: new Date('2026-08-29T09:12:00Z').toISOString(),
            reason: 'No such host is known.',
          },
        },
        commandJournal: {
          telegram: [
            {
              id: 'c1',
              verb: 'maison',
              outcome: 'rejected',
              receivedAt: new Date('2026-08-29T09:10:00Z').toISOString(),
              errorMessage: null,
            },
          ],
        },
      }),
    )

    await page.goto('/settings/notifications/telegram')

    await expect(page.getByText('N’écoute plus')).toBeVisible()
    await expect(page.getByText(/No such host is known/)).toBeVisible()

    // La trace de ce qui a ete demande, y compris ce qui a ete ignore : c'est le
    // seul signe qu'une autre conversation frappe a la porte (ADR-50).
    await page.locator('summary').filter({ hasText: 'Avancé' }).click()
    await expect(page.getByText('Ignoré — conversation non reliée')).toBeVisible()
  })

  test('user_When the channel is listening_Should be told so plainly', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        notificationChannels: { telegram: makeFakeChannel('telegram') },
        channelListening: {
          telegram: {
            listening: true,
            since: new Date('2026-08-29T08:00:00Z').toISOString(),
            interruptedAt: null,
            reason: null,
          },
        },
      }),
    )

    await page.goto('/settings/notifications/telegram')
    await expect(page.getByText('À l’écoute')).toBeVisible()
  })
})
