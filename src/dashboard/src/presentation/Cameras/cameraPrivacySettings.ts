import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'
import type { Camera } from '../../domain/entities/Camera'

export type PrivacyStrategy = Camera['privacyStrategy']

interface StrategyDefinition {
  readonly value: PrivacyStrategy
  readonly label: string
  readonly explanation: string
  /** Ce que la camera doit savoir faire pour que la strategie ait un sens. */
  readonly available: (camera: Camera) => boolean
}

/**
 * Les facons de ne plus etre filme, de la plus faible a la plus forte.
 *
 * Chaque option est decrite par **ce qu'elle garantit et ce qu'elle ne
 * garantit pas** : une coupure logicielle laisse la camera accessible sur le
 * reseau local, et le taire serait promettre une confidentialite qui n'existe
 * pas (principe produit #4).
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

export function availableStrategies(camera: Camera): SettingOption<PrivacyStrategy>[] {
  // On ne propose que ce que cette camera sait faire : afficher une option
  // grisee sans pouvoir agir dessus serait un etat opaque de plus.
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
      // Ce que l'option choisie garantit reellement reste visible sans geste :
      // c'est une consequence, pas une explication (ADR-43).
      consequence: explanationOf(value),
      value,
      onChange: (next) => onChange(next as PrivacyStrategy),
    },
  ]
}
