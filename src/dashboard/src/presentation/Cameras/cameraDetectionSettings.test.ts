import { describe, expect, it, vi } from 'vitest'
import { buildDetectionSettings } from './cameraDetectionSettings'
import type { CameraStream, DetectionConfig } from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'

// Les natures « a options » sont les seules interrogees ici ; y acceder sans ce
// garde-fou obligerait a un cast qui masquerait une erreur de nature.
function optionsOf(setting: SettingDeclaration): readonly SettingOption[] {
  const { nature } = setting
  if (nature.kind !== 'choice' && nature.kind !== 'multiChoice') {
    throw new Error(`Le réglage « ${setting.id} » n'a pas d'options (nature : ${nature.kind}).`)
  }
  return nature.options
}

const ALL_LABELS: DetectionLabel[] = [
  { value: 'person', displayName: 'Personne', emoji: '🧑' },
  { value: 'car', displayName: 'Voiture', emoji: '🚗' },
  { value: 'dog', displayName: 'Chien', emoji: '🐕' },
]

const STREAMS: CameraStream[] = [
  { id: 'main', ordinal: 0, width: 1920, height: 1080, fps: 15 },
  { id: 'sub', ordinal: 1, width: 640, height: 360, fps: 10 },
]

function config(overrides: Partial<DetectionConfig> = {}): DetectionConfig {
  return {
    cameraId: 'camera-1',
    labels: ['person'],
    availableLabels: [],
    retention: {
      continuous: { override: null, installation: 0, effective: 0 },
      motion: { override: null, installation: 7, effective: 7 },
      eventClip: { override: null, installation: 14, effective: 14 },
      maxDays: 365,
    },
    motionSensitivity: 'medium',
    motionSensitivityPinned: false,
    streams: STREAMS,
    detectStreamId: 'sub',
    ...overrides,
  }
}

function values(overrides: Partial<Parameters<typeof buildDetectionSettings>[0]['values']> = {}) {
  return {
    labels: ['person'],
    motionSensitivity: 'medium' as const,
    motionSensitivityPinned: false,
    detectStreamId: 'sub' as string | null,
    ...overrides,
  }
}

type Setter = Parameters<typeof buildDetectionSettings>[0]['set']

function build(cfg: DetectionConfig, vals = values(), set: Setter = vi.fn()) {
  return {
    settings: buildDetectionSettings({ config: cfg, allLabels: ALL_LABELS, values: vals, set }),
    set,
  }
}

describe('Réglages de détection d’une caméra', () => {
  it('labels_When the camera reports what it can detect_Should offer only those', () => {
    const { settings } = build(config({ availableLabels: ['person', 'dog'] }))
    const labels = settings.find((setting) => setting.id === 'detection-labels')!

    expect(labels.nature).toMatchObject({ kind: 'multiChoice' })
    expect(optionsOf(labels).map((option) => option.value)).toEqual(['person', 'dog'])
  })

  it('labels_When the camera reports nothing_Should fall back to the full catalogue', () => {
    const { settings } = build(config({ availableLabels: [] }))
    const labels = settings.find((setting) => setting.id === 'detection-labels')!
    const options = optionsOf(labels)

    // Mieux vaut tout proposer que rien : une camera muette sur ses capacites
    // ne doit pas priver l'utilisateur du reglage.
    expect(options).toHaveLength(3)
  })

  it('sensitivity_When chosen by hand_Should stop the automatic adjustment', () => {
    const set = vi.fn()
    const { settings } = build(config(), values(), set)
    const sensitivity = settings.find((setting) => setting.id === 'detection-sensitivity')!

    sensitivity.onChange('low')

    // Un seul geste porte les deux faits : choisir une valeur *est* la fixer.
    // Deux controles separes seraient deux sources de verite (ADR-35).
    expect(set).toHaveBeenCalledWith('motionSensitivity', 'low')
    expect(set).toHaveBeenCalledWith('motionSensitivityPinned', true)
  })

  it('sensitivity_When still automatic_Should say so; once pinned, Should stop saying it', () => {
    const auto = build(config()).settings.find((s) => s.id === 'detection-sensitivity')!
    expect(auto.consequence).toContain('ajuste ce réglage tout seul')

    const pinned = build(config(), values({ motionSensitivityPinned: true })).settings.find(
      (s) => s.id === 'detection-sensitivity',
    )!
    expect(pinned.consequence).toBeUndefined()
  })

  it('stream_When the camera serves only one_Should not offer a choice', () => {
    const { settings } = build(config({ streams: [STREAMS[0]] }))
    // Un seul flux ne laisse rien a arbitrer (ADR-38).
    expect(settings.find((setting) => setting.id === 'detection-stream')).toBeUndefined()
  })

  it('stream_When several are served_Should describe each by what the camera reported', () => {
    const { settings } = build(config())
    const stream = settings.find((setting) => setting.id === 'detection-stream')!
    const options = optionsOf(stream)

    // Jamais un nom de palier invente : les pixels reels, et le rang seulement
    // en complement.
    expect(options[0].label).toContain('1920 × 1080')
    expect(options[0].label).toContain('la plus détaillée')
    expect(options[1].label).toContain('640 × 360')
    expect(options[1].label).toContain('la plus légère')
  })
})
