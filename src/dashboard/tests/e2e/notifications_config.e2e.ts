import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeChannel,
} from './fixtures/fake_backend'

test.describe('Notifications — les canaux', () => {
  test('NotificationChannelView_ShouldWarnBeforeDataLeaves_WhenTheUserEnablesAChannel', async ({
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

    // Privacy invariant: images leave the local network, and that is said
    // beforehand, not after.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('serveurs de Telegram')
    await dialog.getByRole('button', { name: 'Activer' }).click()

    await expect(page.getByText('Les alertes sont envoyées.')).toBeVisible()

    await page.getByRole('button', { name: 'Envoyer un message de test' }).click()
    await expect(page.getByText('Message envoyé : le canal fonctionne.')).toBeVisible()
  })

  // The bar for this step: a second channel is configured with the same screen, built
  // on what it declares, and with a how-to of its own (ADR-50, ADR-52).
  test('NotificationChannelView_ShouldShowThatChannelInstructions_WhenTheUserAddsASecondOne', async ({
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

    // The how-to does not disappear once the channel is in place: it folds
    // (ADR-53), to still be there the day a token has to be made again.
    await expect(page.getByText('Où trouver ces informations dans Discord ?')).toBeVisible()

    await page.goto('/settings/notifications')
    await expect(page.getByRole('link', { name: /Discord/ })).toBeVisible()
  })

  test('NotificationChannelView_ShouldKeepTheTestOff_WhenNothingIsConfigured', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/telegram')

    // Testing with no channel would send nowhere: the button says so instead
    // of letting one try.
    await expect(page.getByRole('button', { name: 'Envoyer un message de test' })).toBeDisabled()
  })

  test('NotificationChannelView_ShouldAskWhichHours_WhenTheUserRestrictsThem', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/telegram')

    // The hours only exist if the range is asked for: showing them greyed would
    // make two settings where the user decides only one.
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toHaveCount(0)
    await page.getByRole('switch', { name: 'Seulement à certaines heures' }).click()
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toBeVisible()
  })

  test('NotificationChannelView_ShouldSayWhenTheRangeEnds_WhenItCrossesMidnight', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications/telegram')

    await page.getByRole('switch', { name: 'Seulement à certaines heures' }).click()
    await page.getByRole('combobox', { name: 'À partir de' }).click()
    await page.getByRole('option', { name: '22:00' }).click()
    await page.getByRole('combobox', { name: 'Jusqu’à' }).click()
    await page.getByRole('option', { name: '07:00' }).click()

    await expect(
      page.getByText('La plage passe minuit : elle se termine le lendemain à 07:00.'),
    ).toBeVisible()
  })

  // The criterion for this step: unplugging the network must show in the settings,
  // or Vyzio looks broken when it is merely waiting (SPECS 5.4).
  test('NotificationChannelView_ShouldSayItStoppedListeningAndWhy_WhenTheLoopFell', async ({
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

    // The trace of what was asked, including what was ignored: it is the only
    // sign that another conversation is knocking at the door (ADR-50).
    await page.locator('summary').filter({ hasText: 'Avancé' }).click()
    await expect(page.getByText('Ignoré — conversation non reliée')).toBeVisible()
  })

  test('NotificationChannelView_ShouldSayItListens_WhenTheLoopRuns', async ({ page }) => {
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
