import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeChannelConfig, makePairing } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
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
const RULES = 'GET /api/schedules'

const PERSON = { value: 'person', displayName: 'Personne', emoji: '🧍' }
const FAILED_SEND = {
  status: 'failed',
  sentAt: '2026-09-01T08:00:00Z',
  errorMessage: 'Chat not found',
}
const ANSWERED = {
  id: 'command-1',
  verb: 'etat',
  outcome: 'succeeded',
  receivedAt: '2026-09-01T08:00:00Z',
  errorMessage: null,
}
const LISTENING_NOW = {
  channel: 'telegram',
  listening: true,
  since: null,
  interruptedAt: null,
  reason: null,
}
const LISTENING_STOPPED = { ...LISTENING_NOW, listening: false }
const PAIRED = makePairing({ status: 'paired' })

function muteRule(id: string, targetIds: string[]): ScheduleRule {
  return {
    id,
    kind: ScheduleRuleKind.MuteNotifications,
    targetIds,
    daysOfWeek: [1],
    startTime: '09:00',
    endTime: '12:00',
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function channelAt(slug: string) {
  return { path: '/settings/notifications/:channel', url: `/settings/notifications/${slug}` }
}

// What every channel page reads, with the channel's settings given.
function channelRoutes(config = makeChannelConfig()) {
  return { [SETTINGS]: ok(config), [LABELS]: ok([]), [LOG]: ok([]), [RULES]: ok([]) }
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
  it('onOpen_ShouldCountTheRangesMutingThisChannelAndLinkToTheCalendar_WhenSomeTargetIt', async () => {
    // Arrange
    fakeNetwork({
      ...channelRoutes(),
      [RULES]: ok([
        muteRule('here', ['telegram', 'discord']),
        muteRule('also', ['telegram']),
        muteRule('elsewhere', ['discord']),
      ]),
    })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText('2 plages « Sans notification » s’appliquent'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir les horaires' })).toHaveAttribute(
      'href',
      '/settings/horaires',
    )
    expect(screen.queryByText('Seulement à certaines heures')).not.toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheRangesCouldNotBeRead_WhenTheirReadFails', async () => {
    // Arrange
    fakeNetwork({ ...channelRoutes(), [RULES]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(await screen.findByText('Les horaires n’ont pas pu être lus.')).toBeInTheDocument()
    expect(
      screen.queryByText('Aucune plage « Sans notification » ne s’applique'),
    ).not.toBeInTheDocument()
  })

  it('onRetryRules_ShouldCountTheRanges_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [RULES]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByText('Les horaires n’ont pas pu être lus.')
    network.answer(RULES, ok([]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByText('Aucune plage « Sans notification » ne s’applique'),
    ).toBeInTheDocument()
  })

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

  it('onLoad_ShouldSayTheChannelIsUnreadAndHowToRetry_WhenItsSettingsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...channelRoutes(), [SETTINGS]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Ce canal ne s’affiche pas' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/notifications\/settings\/telegram · 500/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Canal introuvable' })).not.toBeInTheDocument()
  })

  it('onLoad_ShouldShowTheChannel_WhenTheRetryReadsItsSettings', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [SETTINGS]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByRole('alert')
    network.answer(SETTINGS, ok(makeChannelConfig()))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Telegram' })).toBeInTheDocument()
  })

  it('onLoad_ShouldSayTheTriggersAreUnreadAndKeepTheSettings_WhenTheLabelsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...channelRoutes(), [LABELS]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/detection-labels\/notifications · 500/),
    ).toBeVisible()
    expect(screen.getByRole('switch', { name: /Notifications Telegram/ })).toBeInTheDocument()
  })

  it('onRetryLabels_ShouldOfferTheTriggers_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [LABELS]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByRole('alert')
    network.answer(LABELS, ok([PERSON]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByRole('combobox', { name: /Ce qui déclenche une notification/ }),
    ).toHaveTextContent('Tout')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheLinkIsUnread_WhenThePairingCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(), [PAIRING]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/notifications\/settings\/telegram\/pairing · 500/),
    ).toBeVisible()
    expect(
      screen.getByText('Vyzio n’a pas pu lire si une conversation est reliée à ce canal.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/sans elle, le bot ne répond à personne/)).not.toBeInTheDocument()
  })

  it('onRetryPairing_ShouldShowTheLink_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(), [PAIRING]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByRole('alert')
    network.answer(PAIRING, ok(makePairing()))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Relier une conversation' }),
    ).toBeInTheDocument()
  })

  it('onOpen_ShouldOfferOnlyTheLink_WhenNoConversationIsLinked', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(), [LISTENING]: ok(LISTENING_STOPPED) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText(
        'Reliez une conversation pour lui parler depuis votre téléphone : sans elle, le bot ne répond à personne.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Relier une conversation' })).toBeInTheDocument()
    expect(screen.queryByText('N’écoute plus')).not.toBeInTheDocument()
    expect(screen.queryByText(/ce qui se passe chez vous/)).not.toBeInTheDocument()
    // The two left belong to the sent log and the command journal, under Avancé.
    expect(screen.getAllByRole('button', { name: 'Actualiser' })).toHaveLength(2)
  })

  it('onOpen_ShouldKeepQuietAboutTheListening_WhenItCannotBeReadAndNoConversationIsLinked', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(), [LISTENING]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByRole('button', { name: 'Relier une conversation' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Impossible de savoir si le canal est à l’écoute.'),
    ).not.toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheChannelStoppedListening_WhenACodeAwaitsItsConversation', async () => {
    // Arrange
    fakeNetwork({
      ...commandRoutes(
        makePairing({ status: 'awaiting_conversation', instruction: '/lier 123456' }),
      ),
      [LISTENING]: ok(LISTENING_STOPPED),
    })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(await screen.findByText('N’écoute plus')).toBeInTheDocument()
    expect(screen.getByText('/lier 123456')).toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheListeningIsUnknownWhereTheBadgeGoes_WhenItCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(PAIRED), [LISTENING]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText('Impossible de savoir si le canal est à l’écoute.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/GET \/api\/notifications\/settings\/telegram\/listening · 500/),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('onRetryListening_ShouldShowTheBadge_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(PAIRED), [LISTENING]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByText('Impossible de savoir si le canal est à l’écoute.')
    network.answer(LISTENING, ok(LISTENING_NOW))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('À l’écoute')).toBeInTheDocument()
  })

  it('onRefreshPairing_ShouldKeepTheBadgeAndSayWhy_WhenTheListeningRereadFails', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(PAIRED), [LISTENING]: ok(LISTENING_NOW) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    const badge = await screen.findByText('À l’écoute')
    network.answer(LISTENING, failure(500))

    // Act
    await userEvent.click(screen.getAllByRole('button', { name: 'Actualiser' })[0])

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(badge).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onRefreshPairing_ShouldKeepTheLinkAndSayWhy_WhenThePairingRereadFails', async () => {
    // Arrange
    const network = fakeNetwork(commandRoutes(makePairing({ status: 'paired' })))
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    const cut = await screen.findByRole('button', { name: 'Couper le lien' })
    network.answer(PAIRING, failure(500))

    // Act
    await userEvent.click(screen.getAllByRole('button', { name: 'Actualiser' })[0])

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(cut).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onSave_ShouldKeepTheSettingsAndSayWhy_WhenTheRereadAfterSavingFails', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [SAVE]: ok(makeChannelConfig()) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await userEvent.click(await screen.findByRole('switch', { name: /Notifications Telegram/ }))
    network.answer(SETTINGS, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Telegram' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Ce canal ne s’affiche pas' }),
    ).not.toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheLogIsUnread_WhenItCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...channelRoutes(), [LOG]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/notifications\/log\/telegram · 500/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Aucun envoi pour l’instant.')).not.toBeInTheDocument()
  })

  it('onRetryLog_ShouldShowWhatWasSent_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [LOG]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByText(/GET \/api\/notifications\/log\/telegram · 500/)
    network.answer(LOG, ok([FAILED_SEND]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('Chat not found')).toBeInTheDocument()
  })

  it('onRefreshLog_ShouldKeepWhatWasSentAndSayWhy_WhenTheRereadFails', async () => {
    // Arrange
    const network = fakeNetwork({ ...channelRoutes(), [LOG]: ok([FAILED_SEND]) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    const sent = await screen.findByText('Chat not found')
    network.answer(LOG, failure(500))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(sent).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('onOpen_ShouldSayTheJournalIsUnread_WhenItCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ ...commandRoutes(), [COMMANDS]: failure(500) })

    // Act
    renderScreen(<NotificationChannelView />, channelAt('telegram'))

    // Assert
    expect(
      await screen.findByText(/GET \/api\/notifications\/settings\/telegram\/commands · 500/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Aucune commande reçue pour l’instant.')).not.toBeInTheDocument()
  })

  it('onRetryJournal_ShouldShowTheCommands_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(), [COMMANDS]: failure(500) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    await screen.findByText(/GET \/api\/notifications\/settings\/telegram\/commands · 500/)
    network.answer(COMMANDS, ok([]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByText('Aucune commande reçue pour l’instant.')).toBeInTheDocument()
  })

  it('onRefreshJournal_ShouldKeepTheCommandsAndSayWhy_WhenTheRereadFails', async () => {
    // Arrange
    const network = fakeNetwork({ ...commandRoutes(), [COMMANDS]: ok([ANSWERED]) })
    renderScreen(<NotificationChannelView />, channelAt('telegram'))
    const command = await screen.findByText('/etat')
    network.answer(COMMANDS, failure(500))

    // Act
    await userEvent.click(screen.getAllByRole('button', { name: 'Actualiser' }).at(-1)!)

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(command).toBeInTheDocument()
  })
})
