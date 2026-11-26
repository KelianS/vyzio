import { describe, expect, it, vi } from 'vitest'
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

  it('PasswordScreen_ShouldShowThePasswordInClear_WhenTheUserPressesTheEye', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(installed), [SESSION]: failure(401) })
    renderGate()
    await typeThePassword('correct-horse')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))

    // Assert
    expect(screen.getByRole('textbox', { name: 'Mot de passe' })).toHaveValue('correct-horse')
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('PasswordScreen_ShouldMaskThePasswordAndKeepTheFocusInTheField_WhenTheUserPressesTheEyeAgain', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(installed), [SESSION]: failure(401) })
    renderGate()
    await typeThePassword('correct-horse')
    const eye = screen.getByRole('button', { name: 'Afficher le mot de passe' })
    await userEvent.click(eye)

    // Act
    await userEvent.click(eye)

    // Assert
    const field = screen.getByLabelText('Mot de passe')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveFocus()
    expect(eye).toHaveAttribute('aria-pressed', 'false')
  })

  it('PasswordScreen_ShouldMaskThePasswordAgain_WhenTheUserSubmitsItRevealed', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(installed), [SESSION]: failure(401), [SIGN_IN]: failure(401) })
    renderGate()
    await typeThePassword('guess')
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Déverrouiller' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('PasswordScreen_ShouldOpenWithThePasswordMasked_WhenAFreshInstallationAsksForOne', async () => {
    // Arrange
    fakeNetwork({ [STATE]: ok(fresh) })

    // Act
    renderGate()

    // Assert
    expect(await screen.findByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('onLoad_ShouldFillTheScreenSayingVyzioDoesNotAnswer_WhenTheStateCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [STATE]: failure(500) })
    renderGate()
    await screen.findByRole('heading', { name: 'Vyzio ne répond pas' })

    // Act
    await userEvent.click(screen.getByText('Détails techniques'))

    // Assert
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled()
    expect(screen.getByText(/Vyzio a rencontré une erreur/)).toBeVisible()
    expect(screen.getByText(/GET \/api\/access\/state · 500/)).toBeVisible()
  })

  it('onRetry_ShouldOpenTheInterfaceByItself_WhenVyzioAnswersAgain', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const network = fakeNetwork({ [STATE]: failure(503) })
    renderGate()
    await screen.findByRole('heading', { name: 'Vyzio ne répond pas' })
    network.answer(STATE, ok(installed))
    network.answer(SESSION, ok(session))

    // Act
    await act(() => vi.advanceTimersByTimeAsync(5000))

    // Assert
    expect(await screen.findByText('Interface ouverte')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('onRetry_ShouldKeepTheScreenWithoutABlank_WhenTheUserRetriesAndVyzioStillDoesNotAnswer', async () => {
    // Arrange
    const network = fakeNetwork({ [STATE]: failure(503) })
    renderGate()
    await screen.findByRole('heading', { name: 'Vyzio ne répond pas' })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(screen.getByRole('heading', { name: 'Vyzio ne répond pas' })).toBeInTheDocument()
    expect(network.sent.filter((request) => request.route === STATE)).toHaveLength(2)
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
