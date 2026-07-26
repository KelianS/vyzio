import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetectionConfigSection } from './DetectionConfigSection'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

const ALL_LABELS: DetectionLabel[] = [
  { value: 'person', displayName: 'Personne', emoji: '🧑' },
  { value: 'car', displayName: 'Voiture', emoji: '🚗' },
  { value: 'dog', displayName: 'Chien', emoji: '🐕' },
]

type Props = Parameters<typeof DetectionConfigSection>[0]

// Only the fields a test actually cares about are spelled out at the call site; everything else
// stays at a neutral default so adding a prop does not touch every test.
function renderSection(overrides: Partial<Props> = {}) {
  const props: Props = {
    labels: ['person'],
    availableLabels: [],
    allLabels: ALL_LABELS,
    loading: false,
    continuousRecordingEnabled: false,
    motionSensitivity: 'high',
    motionSensitivityPinned: false,
    onToggle: vi.fn(),
    onToggleContinuousRecording: vi.fn(),
    onChangeMotionSensitivity: vi.fn(),
    onToggleMotionSensitivityPin: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<DetectionConfigSection {...props} />) }
}

describe('DetectionConfigSection', () => {
  it('shows a loading state instead of the label grid', () => {
    renderSection({ labels: [], loading: true })

    expect(screen.getByText('Chargement…')).toBeInTheDocument()
    expect(screen.queryByText('Personne')).not.toBeInTheDocument()
  })

  it('restricts displayed labels to availableLabels when provided', () => {
    renderSection({ availableLabels: ['person', 'car'] })

    expect(screen.getByText(/Personne/)).toBeInTheDocument()
    expect(screen.getByText(/Voiture/)).toBeInTheDocument()
    expect(screen.queryByText(/Chien/)).not.toBeInTheDocument()
  })

  it('calls onToggle with the label value when a chip is clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderSection({ onToggle })

    await user.click(screen.getByText(/Voiture/))

    expect(onToggle).toHaveBeenCalledWith('car')
  })

  it('warns when the person label is not selected', () => {
    renderSection({ labels: ['car'] })

    expect(screen.getByText(/reconnaissance faciale ne fonctionnera pas/)).toBeInTheDocument()
  })

  it('does not warn when the person label is selected', () => {
    renderSection()

    expect(screen.queryByText(/reconnaissance faciale ne fonctionnera pas/)).not.toBeInTheDocument()
  })

  it('shows the storage warning only when continuous recording is enabled', () => {
    const { unmount } = renderSection({ continuousRecordingEnabled: false })
    expect(screen.queryByText(/1 a 3 Go par jour/)).not.toBeInTheDocument()
    unmount()

    renderSection({ continuousRecordingEnabled: true })
    expect(screen.getByText(/1 a 3 Go par jour/)).toBeInTheDocument()
  })

  it('calls onToggleContinuousRecording when the checkbox is toggled', async () => {
    const onToggleContinuousRecording = vi.fn()
    const user = userEvent.setup()
    renderSection({ onToggleContinuousRecording })

    await user.click(screen.getByText('Enregistrement continu'))

    expect(onToggleContinuousRecording).toHaveBeenCalledOnce()
  })

  it('shows the sensitivity as read-only text while auto-tuning is on', () => {
    renderSection({ motionSensitivity: 'low', motionSensitivityPinned: false })

    expect(screen.getByText(/Sensibilité actuelle/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Sensibilité de détection')).not.toBeInTheDocument()
    expect(screen.getByText(/Vyzio ajuste ce niveau/)).toBeInTheDocument()
  })

  it('offers the level selector once auto-tuning is turned off', () => {
    renderSection({ motionSensitivity: 'medium', motionSensitivityPinned: true })

    expect(screen.getByLabelText('Sensibilité de détection')).toHaveValue('medium')
    expect(screen.queryByText(/Vyzio ajuste ce niveau/)).not.toBeInTheDocument()
  })

  it('explains what the current level means', () => {
    renderSection({ motionSensitivity: 'low' })

    expect(screen.getByText(/Seuls les mouvements francs sont analysés/)).toBeInTheDocument()
  })

  it('calls onChangeMotionSensitivity with the picked level', async () => {
    const onChangeMotionSensitivity = vi.fn()
    const user = userEvent.setup()
    renderSection({ motionSensitivityPinned: true, onChangeMotionSensitivity })

    await user.selectOptions(screen.getByLabelText('Sensibilité de détection'), 'low')

    expect(onChangeMotionSensitivity).toHaveBeenCalledWith('low')
  })

  it('calls onToggleMotionSensitivityPin when auto-tuning is toggled', async () => {
    const onToggleMotionSensitivityPin = vi.fn()
    const user = userEvent.setup()
    renderSection({ onToggleMotionSensitivityPin })

    await user.click(screen.getByText('Régler la sensibilité automatiquement'))

    expect(onToggleMotionSensitivityPin).toHaveBeenCalledOnce()
  })
})
