import type { SettingDeclaration, SettingOption } from '../../common/settings/setting_declaration'
import type {
  DetectionConfig,
  DetectionConfigUpdate,
  MotionSensitivity,
} from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

// Retention overrides live on their own page; a shared draft here would track unrendered fields.
export type DetectionUpdate = Omit<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

/** "Auto" is a value of the same setting, not a side switch (ADR-35): auto-tune and a pinned level are exclusive answers to one question. */
const AUTO = 'auto'

const SENSITIVITY_OPTIONS: SettingOption<MotionSensitivity | typeof AUTO>[] = [
  { value: AUTO, label: 'Automatique' },
  { value: 'high', label: 'Élevée' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Réduite' },
]

// Two sentences (ADR-53): the detail of the levels is already said by the label and the consequence.
const SENSITIVITY_HELP =
  'Automatique : Vyzio ajuste le niveau tout seul selon l’agitation réelle de la caméra, et c’est le cas courant. Un niveau choisi s’applique aussitôt et cesse tout ajustement sur cette caméra.'

const SENSITIVITY_CONSEQUENCE: Record<MotionSensitivity | typeof AUTO, string> = {
  auto: 'Vyzio suit ce que voit la caméra et corrige seul le niveau.',
  high: 'Le moindre mouvement est détecté, y compris la pluie ou un feuillage.',
  medium: 'Les petits mouvements sont ignorés.',
  low: 'Seuls les mouvements francs sont retenus, pour une scène très animée.',
}

export const DETECTION_DRAFT_LABELS: Record<keyof DetectionUpdate, string> = {
  labels: 'Ce qui est détecté',
  motionSensitivity: 'Sensibilité au mouvement',
  motionSensitivityPinned: 'Sensibilité au mouvement',
}

/** Camera state -> declared settings. Kept out of the component so these business rules stay testable. */
export function buildDetectionSettings({
  config,
  allLabels,
  values,
  set,
}: {
  config: DetectionConfig
  allLabels: DetectionLabel[]
  values: DetectionUpdate
  set: <K extends keyof DetectionUpdate>(key: K, value: DetectionUpdate[K]) => void
}): SettingDeclaration[] {
  // Only what the camera actually reports detecting, when it says so; otherwise the full catalogue.
  const displayLabels =
    config.availableLabels.length > 0
      ? allLabels.filter((label) => config.availableLabels.includes(label.value))
      : allLabels

  const declarations: SettingDeclaration[] = [
    {
      id: 'detection-labels',
      label: 'Ce qui est détecté',
      nature: {
        kind: 'multiChoice',
        options: displayLabels.map((label) => ({
          value: label.value,
          label: `${label.emoji} ${label.displayName}`,
        })),
      },
      help: 'Vyzio ne détecte que ce qui est coché. Décocher une catégorie ne supprime rien de ce qui a déjà été enregistré.',
      value: values.labels,
      onChange: (value) => set('labels', value as string[]),
    },
    {
      id: 'detection-sensitivity',
      label: 'Sensibilité au mouvement',
      nature: { kind: 'choice', options: SENSITIVITY_OPTIONS },
      help: SENSITIVITY_HELP,
      consequence:
        SENSITIVITY_CONSEQUENCE[values.motionSensitivityPinned ? values.motionSensitivity : AUTO],
      // Auto applies as long as nothing is pinned.
      value: values.motionSensitivityPinned ? values.motionSensitivity : AUTO,
      onChange: (value) => {
        if (value === AUTO) {
          // The reached level is kept as auto-tune's new starting point, not erased.
          set('motionSensitivityPinned', false)
          return
        }
        set('motionSensitivity', value as MotionSensitivity)
        set('motionSensitivityPinned', true)
      },
    },
  ]

  return declarations
}
