import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeChannelConfig, makePairing } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { NotificationChannelView } from './notification_channel.component'

const SETTINGS = 'GET /api/notifications/settings/telegram'
const SAVE = 'PUT /api/notifications/settings/telegram'
const TEST = 'POST /api/notifications/settings/telegram/test'
const REMOVE = 'DELETE /api/notifications/settings/telegram'
const LABELS = 'GET /api/detection-labels/notifications'
const LOG = 'GET /api/notifications/log/telegram'
const PAIRING = 'GET /api/notifications/settings/telegram/pairing'
const START_PAIRING = 'POST /api/notifications/settings/telegram/pairing'
const REVOKE = 'DELETE /api/notifications/settings/telegram/pairing'
const LISTENING = 'GET /api/notifications/settings/telegram/listening'
const COMMANDS = 'GET /api/notifications/settings/telegram/commands'

function channelAt(slug: string) {
  return { path: '/settings/notifications/:channel', url: `/settings/notifications/${slug}` }
}

// What every channel page reads, with the channel's settings given.
function channelRoutes(config = makeChannelConfig()) {
  return { [SETTINGS]: ok(config), [LABELS]: ok([]), [LOG]: ok([]) }
}

// A channel that answers commands also reads its pairing, its listening and its journal.
function commandRoutes(pairing = makePairing()) {
  return {
    ...channelRoutes(makeChannelConfig({ acceptsCommands: true })),
    [PAIRING]: ok(pairing),
    [LISTENING]: ok(null),
    [COMMANDS]: ok([]),
  }
}

describe('NotificationChannelView', () => {
  it('NotificationChannelView_ShouldSayTheChannelIsMissing_WhenTheAddressNamesNone', async () => {
    // Arrange
    fakeNetwork({ [LABELS]: ok([]) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('pigeon'))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Canal introuvable' })).toBeInTheDocument()
  })

  it('onConfirmEnable_ShouldAskFirstThenSave_WhenTheUserEnablesTheChannel', async () => {
    // Arrange
    const network = fakeNetwork({
      ...channelRoutes(makeChannelConfig({ isEnabled: false })),
      [SAVE]: ok(makeChannelConfig()),
    })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('switch', { name: /Notifications Telegram/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const question = screen.getByRole('alertdialog', {
      name: 'Envoyer les notifications par Telegram ?',
    })

    // Act
    await userEvent.click(within(question).getByRole('button', { name: 'Activer' }))

    // Assert
    expect(await screen.findByText('Notifications enregistrées.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: SAVE, body: expect.objectContaining({ isEnabled: true }) }),
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({ ...channelRoutes(), [SAVE]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('switch', { name: /Notifications Telegram/ }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/notifications\/settings\/telegram · 500/)).toBeVisible()
    expect(screen.getByRole('switch', { name: /Notifications Telegram/ })).not.toBeChecked()
  })

  it('onTest_ShouldSayTheSendFailedAndShowWhy_WhenTheChannelRefuses', async () => {
    // Arrange
    fakeNetwork({
      ...channelRoutes(),
      [TEST]: ok({ success: false, errorMessage: 'Unauthorized bot' }),
    })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer un message de test' }))

    // Assert
    expect(await screen.findByText('Échec de l’envoi.')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized bot')).toBeVisible()
  })

  it('onRemove_ShouldRemoveAndGoBackToTheChannels_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [REMOVE]: ok() })
    const { router } = renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer le canal' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/notifications'))
    expect(network.sent).toContainEqual(expect.objectContaining({ route: REMOVE }))
  })

  it('onOpen_ShouldShowWhatWasActuallySent_WhenTheChannelHasSentAlerts', async () => {
    // Arrange
    fakeNetwork({
      ...channelRoutes(),
      [LOG]: ok([
        { status: 'failed', sentAt: '2026-09-01T08:00:00Z', errorMessage: 'Chat not found' },
      ]),
    })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(await screen.findByText('Chat not found')).toBeInTheDocument()
  })

  it('onStartPairing_ShouldShowWhatToSend_WhenTheUserLinksAConversation', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(), [START_PAIRING]: ok(makePairing()) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    const link = await screen.findByRole('button', { name: 'Relier une conversation' })
    network.answer(
      PAIRING,
      ok(makePairing({ status: 'awaiting_conversation', instruction: '/lier 123456' })),
    )

    // Act
    await userEvent.click(link)

    // Assert
    expect(await screen.findByText('/lier 123456')).toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: START_PAIRING }))
  })

  it('onRevoke_ShouldCutTheLinkAndSaySo_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
      ...commandRoutes(makePairing({ status: 'paired' })),
      [REVOKE]: ok(),
    })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('button', { name: 'Couper le lien' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Couper le lien' }),
    )

    // Assert
    expect(
      await screen.findByText('La conversation ne peut plus commander votre installation.'),
    ).toBeInTheDocument()
    expect(network.sent).toContainEqual(expect.objectContaining({ route: REVOKE }))
  })

  it('onRevoke_ShouldKeepTheQuestionOpenAndSayWhy_WhenTheCutFails', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(makePairing({ status: 'paired' })), [REVOKE]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('button', { name: 'Couper le lien' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Couper le lien' }),
    )

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
