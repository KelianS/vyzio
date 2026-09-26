import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AddNotificationChannelView } from './add_notification_channel.component'

const CHANNELS = 'GET /api/notifications/channels'
const ADD = { path: '/settings/notifications/ajout', url: '/settings/notifications/ajout' }

describe('AddNotificationChannelView', () => {
  it('onLoad_ShouldOfferEachChannelLeftAndWhetherItAnswers_WhenSomeAreFree', async () => {
    // Arrange
    fakeNetwork({
      [CHANNELS]: ok([
        makeChannelSummary(),
        makeChannelSummary({
          channel: 'discord',
          displayName: 'Discord',
          isConfigured: false,
          acceptsCommands: false,
        }),
      ]),
    })

    // Act
    renderScreen(<AddNotificationChannelView />, ADD)

    // Assert
    const discord = await screen.findByRole('link', { name: /Discord/ })
    expect(discord).toHaveTextContent(
      'Ce canal envoie des alertes, mais ne répond pas aux questions.',
    )
    expect(screen.queryByRole('link', { name: /Telegram/ })).not.toBeInTheDocument()
  })

  it('onLoad_ShouldSayEveryChannelIsInPlace_WhenNoneIsLeft', async () => {
    // Arrange
    fakeNetwork({ [CHANNELS]: ok([makeChannelSummary()]) })

    // Act
    renderScreen(<AddNotificationChannelView />, ADD)

    // Assert
    expect(
      await screen.findByText('Tous les canaux disponibles sont déjà en place.'),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldReadAsEveryChannelInPlace_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [CHANNELS]: failure(500) })

    // Act
    renderScreen(<AddNotificationChannelView />, ADD)

    // Assert
    expect(
      await screen.findByText('Tous les canaux disponibles sont déjà en place.'),
    ).toBeInTheDocument()
  })
})
