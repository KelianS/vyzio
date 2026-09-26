import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appContainer } from '../../infrastructure/providers/app.container'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { AccessGate } from './access_gate.component'

const STATE = 'GET /api/access/state'
const SESSION = 'GET /api/access/session'
const SIGN_IN = 'POST /api/access/session'
const CREATE = 'POST /api/access/account'

const installed = { installed: true, awaitingReset: false, minimumPasswordLength: 8 }
const fresh = { ...installed, installed: false }
const session = { role: 'owner', expiresAt: '2026-12-01T00:00:00Z' }

function renderGate() {
  return renderScreen(
    <AccessGate>
      <p>Interface ouverte</p>
    </AccessGate>,
  )
}

async function typeThePassword(password: string) {
  await userEvent.type(await screen.findByLabelText('Mot de passe'), password)
}

describe('AccessGate', () => {
  it('onLoad_ShouldOpenTheInterface_WhenASessionIsAlreadyOpen', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(installed), [SESSION]: ok(session) })

    // Act
    renderGate()

    // Assert
    expect(await screen.findByText('Interface ouverte')).toBeInTheDocument()
  })

  it('onCreateOwner_ShouldOpenTheInterface_WhenAFreshInstallationGetsItsPassword', async () => {
    // Arrange
    const network = fakeNetwork({ [STATE]: ok(fresh), [CREATE]: ok(session) })
    renderGate()
    await screen.findByRole('heading', { name: 'Protégez votre installation' })
    await typeThePassword('correct-horse')
    network.answer(STATE, ok(installed))
    network.answer(SESSION, ok(session))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Protéger et continuer' }))

    // Assert
    expect(await screen.findByText('Interface ouverte')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: CREATE, body: { password: 'correct-horse' } }),
    )
  })

  it('onSignIn_ShouldSayThePasswordIsWrong_WhenTheInstallationRefusesIt', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(installed), [SESSION]: failure(401), [SIGN_IN]: failure(401) })
    renderGate()
    await typeThePassword('guess')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Déverrouiller' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
  })

  it('onSignIn_ShouldOpenTheInterface_WhenThePasswordIsRight', async () => {
    // Arrange
    const network = fakeNetwork({
      [STATE]: ok(installed),
      [SESSION]: failure(401),
      [SIGN_IN]: ok(session),
    })
    renderGate()
    await typeThePassword('correct-horse')
    network.answer(SESSION, ok(session))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Déverrouiller' }))

    // Assert
    expect(await screen.findByText('Interface ouverte')).toBeInTheDocument()
  })

  it('onLoad_ShouldSayVyzioDoesNotAnswerAndWhy_WhenTheStateCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [STATE]: failure(500) })

    // Act
    renderGate()

    // Assert
    expect(await screen.findByRole('heading', { name: 'Vyzio ne répond pas' })).toBeInTheDocument()
    expect(screen.getByText(/Vyzio a rencontré une erreur/)).toBeVisible()
    expect(screen.getByText(/GET \/api\/access\/state · 500/)).toBeVisible()
  })

  it('onWatchSession_ShouldReturnToSignInSayingSo_WhenTheSessionEndsOnAnotherCall', async () => {
    // Arrange
    fakeNetwork({
      [STATE]: ok(installed),
      [SESSION]: ok(session),
      'GET /api/cameras': failure(401),
    })
    renderGate()
    await screen.findByText('Interface ouverte')

    // Act
    await act(() => appContainer.cameras.getCameras.execute().catch(() => undefined))

    // Assert
    expect(await screen.findByText(/Votre session a pris fin/)).toBeInTheDocument()
  })

  it('onSignIn_ShouldOpenTheInterfaceAgain_WhenTheUserSignsBackInAfterTheSessionEnded', async () => {
    // Arrange
    fakeNetwork({
      [STATE]: ok(installed),
      [SESSION]: ok(session),
      [SIGN_IN]: ok(session),
      'GET /api/cameras': failure(401),
    })
    renderGate()
    await screen.findByText('Interface ouverte')
    await act(() => appContainer.cameras.getCameras.execute().catch(() => undefined))
    await typeThePassword('correct-horse')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Déverrouiller' }))

    // Assert
    expect(await screen.findByText('Interface ouverte')).toBeInTheDocument()
  })
})
