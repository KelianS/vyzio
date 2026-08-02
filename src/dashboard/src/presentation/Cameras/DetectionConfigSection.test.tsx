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
    streams: [],
    detectStreamId: null,
    pendingChanges: false,
    applyLoading: false,
    onToggle: vi.fn(),
    onToggleContinuousRecording: vi.fn(),
    onChangeMotionSensitivity: vi.fn(),
    onToggleMotionSensitivityPin: vi.fn(),
    onChangeDetectStream: vi.fn(),
    onApplyConfiguration: vi.fn(),
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

    await user.click(screen.getByText('Enregistrer en continu'))

    expect(onToggleContinuousRecording).toHaveBeenCalledOnce()
  })

  // ── Analysed stream picker (ADR-38) ──

  const MAIN = { id: 'main-1', ordinal: 0, width: 2304, height: 1296, fps: 12 } as const
  const SUB = { id: 'sub-1', ordinal: 1, width: 640, height: 360, fps: 12 } as const

  it('hides the stream picker when the camera offers a single stream', () => {
    renderSection({ streams: [MAIN], detectStreamId: MAIN.id })

    expect(screen.queryByLabelText('Image analysée')).not.toBeInTheDocument()
  })

  // The camera's own measurements, not an invented tier name.
  it('lists each stream by its real resolution and frame rate', () => {
    renderSection({ streams: [MAIN, SUB], detectStreamId: MAIN.id })

    expect(
      screen.getByRole('option', { name: '2304 × 1296 · 12 img/s — la plus détaillée' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '640 × 360 · 12 img/s — la plus légère' }),
    ).toBeInTheDocument()
  })

  it('supports more than two streams', () => {
    const middle = { id: 'mid-1', ordinal: 1, width: 1280, height: 720, fps: 15 }
    renderSection({
      streams: [MAIN, middle, { ...SUB, ordinal: 2 }],
      detectStreamId: middle.id,
    })

    expect(screen.getByRole('option', { name: '1280 × 720 · 15 img/s' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('falls back to the rank when the camera reported no resolution', () => {
    renderSection({
      streams: [
        { ...MAIN, width: null, height: null },
        { ...SUB, width: null, height: null },
      ],
      detectStreamId: MAIN.id,
    })

    expect(
      screen.getByRole('option', { name: 'Flux principal · 12 img/s — la plus détaillée' }),
    ).toBeInTheDocument()
  })

  it('explains what the selected stream costs and what it preserves', () => {
    const { unmount } = renderSection({ streams: [MAIN, SUB], detectStreamId: MAIN.id })
    expect(screen.getByText(/visages sont mieux reconnus/)).toBeInTheDocument()
    unmount()

    renderSection({ streams: [MAIN, SUB], detectStreamId: SUB.id })
    expect(
      screen.getByText(/visages éloignés risquent de ne plus être reconnus/),
    ).toBeInTheDocument()
  })

  it('states that recordings are unaffected by the choice', () => {
    renderSection({ streams: [MAIN, SUB], detectStreamId: SUB.id })

    expect(
      screen.getByText(/enregistrements restent faits sur l’image la plus détaillée/),
    ).toBeInTheDocument()
  })

  it('warns that pending changes need the detection engine to restart', async () => {
    const onApplyConfiguration = vi.fn()
    const user = userEvent.setup()
    renderSection({ pendingChanges: true, onApplyConfiguration })

    expect(screen.getByText(/qu’après un redémarrage du moteur de détection/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Appliquer maintenant' }))

    expect(onApplyConfiguration).toHaveBeenCalledOnce()
  })

  it('says nothing about applying when there is nothing pending', () => {
    renderSection({ pendingChanges: false })

    expect(screen.queryByRole('button', { name: 'Appliquer maintenant' })).not.toBeInTheDocument()
  })

  it('calls onChangeDetectStream with the picked stream id', async () => {
    const onChangeDetectStream = vi.fn()
    const user = userEvent.setup()
    renderSection({ streams: [MAIN, SUB], detectStreamId: MAIN.id, onChangeDetectStream })

    await user.selectOptions(screen.getByLabelText('Image analysée'), SUB.id)

    expect(onChangeDetectStream).toHaveBeenCalledWith(SUB.id)
  })

  it('shows the sensitivity as read-only text while auto-tuning is on', () => {
    renderSection({ motionSensitivity: 'low', motionSensitivityPinned: false })

    expect(screen.getByText(/Actuellement/)).toBeInTheDocument()
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

    await user.click(screen.getByText('Régler automatiquement'))

    expect(onToggleMotionSensitivityPin).toHaveBeenCalledOnce()
  })
})
