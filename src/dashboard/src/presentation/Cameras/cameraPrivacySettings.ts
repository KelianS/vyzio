import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'
import type { Camera } from '../../domain/entities/Camera'

export type PrivacyStrategy = Camera['privacyStrategy']

/** What the user has set up on the camera; null while it is not known. */
export interface PrivacySetup {
  readonly positionsSaved: boolean | null
}

interface StrategyDefinition {
  readonly value: PrivacyStrategy
  readonly label: string
  readonly explanation: string
  /** What the camera must be able to do for the strategy to make sense. */
  readonly available: (camera: Camera) => boolean
  /** What the user must still do first, when a step they own is missing (ADR-57). */
  readonly missingStep?: (setup: PrivacySetup) => string | null
}

const POSITIONS_FIRST =
  'Pour orienter la caméra à l’écart, enregistrez d’abord ses positions Surveillance et Parking dans « Image et pilotage » : elle pivote vers la seconde, puis revient sur la première.'

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
      'La caméra pivote vers sa position Parking et Vyzio cesse d’enregistrer, puis elle revient sur sa position Surveillance. Elle reste joignable sur votre réseau local.',
    available: (camera) => camera.ptzSupported,
    missingStep: (setup) => (setup.positionsSaved === false ? POSITIONS_FIRST : null),
  },
  {
    value: 'hardware',
    label: 'Coupure matérielle',
    explanation:
      'L’objectif est masqué dans la caméra elle-même. C’est la seule option où plus rien ne peut être filmé.',
    available: (camera) => camera.vendorFamily === 'tplink_tapo',
  },
]

function explanationOf(value: PrivacyStrategy): string {
  return STRATEGIES.find((strategy) => strategy.value === value)?.explanation ?? ''
}

export function buildPrivacySettings({
  camera,
  setup,
  value,
  onChange,
}: {
  camera: Camera
  setup: PrivacySetup
  value: PrivacyStrategy
  onChange: (value: PrivacyStrategy) => void
}): SettingDeclaration[] {
  const possible = STRATEGIES.filter((strategy) => strategy.available(camera))
  const missingSteps = possible.flatMap((strategy) => strategy.missingStep?.(setup) ?? [])
  // Only what can be chosen now is offered; the one already chosen stays, so the value never vanishes.
  const offered = possible.filter(
    (strategy) => !strategy.missingStep?.(setup) || strategy.value === camera.privacyStrategy,
  )
  const options: SettingOption<PrivacyStrategy>[] = offered.map((strategy) => ({
    value: strategy.value,
    label: strategy.label,
  }))

  return [
    {
      id: 'privacy-strategy',
      label: 'Quand vous coupez la surveillance',
      nature: { kind: 'choice', options },
      help: offered
        .map((strategy) => `${strategy.label} — ${strategy.explanation}`)
        .concat(missingSteps)
        .join('\n\n'),
      // What the chosen option really guarantees stays visible without a gesture:
      // it is a consequence, not an explanation (ADR-43).
      consequence: explanationOf(value),
      value,
      onChange: (next) => onChange(next as PrivacyStrategy),
    },
  ]
}
