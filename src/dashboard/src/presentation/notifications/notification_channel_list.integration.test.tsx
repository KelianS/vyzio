import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { NotificationChannelListView } from './notification_channel_list.component'

const CHANNELS = 'GET /api/notifications/channels'
const LIST = { path: '/settings/notifications', url: '/settings/notifications' }

describe('NotificationChannelListView', () => {
  it('onLoad_ShouldListTheConfiguredChannelsAndOfferTheRest_WhenOneIsInPlace', async () => {
    // Arrange
    fakeNetwork({
      [CHANNELS]: ok([
        makeChannelSummary({ isEnabled: false }),
        makeChannelSummary({ channel: 'discord', displayName: 'Discord', isConfigured: false }),
      ]),
    })

    // Act
    renderScreen(<NotificationChannelListView />, LIST)

    // Assert
    const telegram = await screen.findByRole('link', { name: /Telegram/ })
    expect(telegram).toHaveTextContent('En pause')
    expect(screen.queryByRole('link', { name: /Discord/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajouter un canal' })).toBeInTheDocument()
  })

  it('onLoad_ShouldSayAlertsStayInTheInterface_WhenNoChannelIsConfigured', async () => {
    // Arrange
    fakeNetwork({ [CHANNELS]: ok([makeChannelSummary({ isConfigured: false })]) })

    // Act
    renderScreen(<NotificationChannelListView />, LIST)

    // Assert
    expect(
      await screen.findByText(
        'Aucun canal pour l’instant : aucune notification n’est envoyée, les détections restent dans l’historique.',
      ),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldReadAsNoChannel_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [CHANNELS]: failure(500) })

    // Act
    renderScreen(<NotificationChannelListView />, LIST)

    // Assert
    expect(
      await screen.findByText(
        'Aucun canal pour l’instant : aucune notification n’est envoyée, les détections restent dans l’historique.',
      ),
    ).toBeInTheDocument()
  })
})
