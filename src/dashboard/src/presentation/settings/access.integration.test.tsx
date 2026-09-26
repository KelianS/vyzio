import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AccessView } from './access.component'

const STATE = 'GET /api/access/state'
const PASSWORD = 'PUT /api/access/password'
const SIGN_OUT = 'DELETE /api/access/session'
const SIGN_OUT_EVERYWHERE = 'DELETE /api/access/sessions'
const ACCESS = { path: '/settings/acces', url: '/settings/acces' }

const state = { installed: true, awaitingReset: false, minimumPasswordLength: 8 }

async function fillThePasswords(current: string, next: string) {
  await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), current)
  await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), next)
}

describe('AccessView', () => {
  it('onLoad_ShouldStateTheMinimumLength_WhenTheServerAnswers', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(state) })

    // Act
    renderScreen(<AccessView />, ACCESS)

    // Assert
    expect(await screen.findByText('Au moins 8 caractères.')).toBeInTheDocument()
  })

  it('onChangePassword_ShouldSaySoAndClearTheFields_WhenThePasswordChanges', async () => {
    // Arrange
    const network = fakeNetwork({ [STATE]: ok(state), [PASSWORD]: ok() })
    renderScreen(<AccessView />, ACCESS)
    await fillThePasswords('old-password', 'new-password')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    // Assert
    expect(
      await screen.findByText('Mot de passe changé. Les autres appareils ont été déconnectés.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('')
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: PASSWORD,
        body: { currentPassword: 'old-password', newPassword: 'new-password' },
      }),
    )
  })

  it('onChangePassword_ShouldSayBesideTheFieldItIsWrong_WhenTheCurrentPasswordIsRefused', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(state), [PASSWORD]: failure(400, 'wrong_password') })
    renderScreen(<AccessView />, ACCESS)
    await fillThePasswords('bad-password', 'new-password')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe actuel incorrect.')
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('bad-password')
  })

  it('onChangePassword_ShouldSayWhyAndForSupport_WhenTheChangeFails', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(state), [PASSWORD]: failure(500) })
    renderScreen(<AccessView />, ACCESS)
    await fillThePasswords('old-password', 'new-password')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/access\/password · 500/)).toBeVisible()
  })

  it('onSignOut_ShouldCloseThisSession_WhenTheUserSignsOut', async () => {
    // Arrange
    const network = fakeNetwork({ [STATE]: ok(state), [SIGN_OUT]: ok() })
    renderScreen(<AccessView />, ACCESS)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    // Assert
    expect(network.sent).toContainEqual(expect.objectContaining({ route: SIGN_OUT }))
  })

  it('onSignOutEverywhere_ShouldCloseEverySession_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({ [STATE]: ok(state), [SIGN_OUT_EVERYWHERE]: ok() })
    renderScreen(<AccessView />, ACCESS)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Déconnecter tous les appareils' }),
    )

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Déconnecter' }),
    )

    // Assert
    expect(network.sent).toContainEqual(expect.objectContaining({ route: SIGN_OUT_EVERYWHERE }))
  })
})
