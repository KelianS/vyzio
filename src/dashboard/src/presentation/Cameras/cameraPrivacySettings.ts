import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'
import type { Camera } from '../../domain/entities/Camera'

export type PrivacyStrategy = Camera['privacyStrategy']

interface StrategyDefinition {
  readonly value: PrivacyStrategy
  readonly label: string
  readonly explanation: string
  /** What the camera must be able to do for the strategy to make sense. */
  readonly available: (camera: Camera) => boolean
}

/**
 * The ways of no longer being filmed, from the weakest to the strongest.
 *
 * Every option is described by **what it guarantees and what it does not
 * guarantee**: a software cut leaves the camera reachable on the local network,
 * and keeping quiet about that would promise a privacy that does not exist
 * (product principle #4).
 */
const STRATEGIES: readonly StrategyDefinition[] = [
  {
    value: 'none',
    label: 'Aucun',
    explanation: 'La caméra filme et enregistre en permanence.',
    available: () => true,
  },
  {
    value: 'software_blur',
    label: 'Arrêt logiciel',
    explanation:
      'Vyzio cesse d’enregistrer et d’analyser. La caméra continue de filmer et reste joignable sur votre réseau local.',
    available: () => true,
  },
  {
    value: 'ptz_parking',
    label: 'Orientation à l’écart',
    explanation:
      'La caméra pivote vers un endroit sans intérêt et Vyzio cesse d’enregistrer. Elle reste joignable sur votre réseau local.',
    available: (camera) => camera.ptzSupported,
  },
  {
    value: 'hardware',
    label: 'Coupure matérielle',
    explanation:
      'L’objectif est masqué dans la caméra elle-même. C’est la seule option où plus rien ne peut être filmé.',
    available: (camera) => camera.vendorFamily === 'tplink_tapo',
  },
]

function availableStrategies(camera: Camera): SettingOption<PrivacyStrategy>[] {
  // Only what this camera can actually do is offered: showing a greyed option
  // with no way to act on it would be one more opaque state.
  return STRATEGIES.filter((strategy) => strategy.available(camera)).map((strategy) => ({
    value: strategy.value,
    label: strategy.label,
  }))
}

function explanationOf(value: PrivacyStrategy): string {
  return STRATEGIES.find((strategy) => strategy.value === value)?.explanation ?? ''
}

export function buildPrivacySettings({
  camera,
  value,
  onChange,
}: {
  camera: Camera
  value: PrivacyStrategy
  onChange: (value: PrivacyStrategy) => void
}): SettingDeclaration[] {
  const options = availableStrategies(camera)

  return [
    {
      id: 'privacy-strategy',
      label: 'Quand vous coupez la surveillance',
      nature: { kind: 'choice', options },
      help: STRATEGIES.filter((strategy) => strategy.available(camera))
        .map((strategy) => `${strategy.label} — ${strategy.explanation}`)
        .join('\n\n'),
      // What the chosen option really guarantees stays visible without a gesture:
      // it is a consequence, not an explanation (ADR-43).
      consequence: explanationOf(value),
      value,
      onChange: (next) => onChange(next as PrivacyStrategy),
    },
  ]
}
