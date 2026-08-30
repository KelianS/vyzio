import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'
import type {
  CameraStream,
  DetectionConfig,
  DetectionConfigUpdate,
  MotionSensitivity,
} from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

// Retention overrides live on their own page; a shared draft here would track unrendered fields.
export type DetectionUpdate = Omit<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

/** "Auto" is a value of the same setting, not a side switch (ADR-35) — auto-tune and a pinned level are exclusive answers to one question. */
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
  high: 'Le moindre mouvement est signalé, y compris la pluie ou un feuillage.',
  medium: 'Les petits mouvements sont ignorés.',
  low: 'Seuls les mouvements francs sont retenus — pour une scène très animée.',
}

const STREAM_HELP =
  'Vyzio réduit de toute façon l’image avant de l’analyser : une image plus légère ne lui retire quasiment rien et libère des ressources. Ce choix ne change jamais la qualité de vos enregistrements.'

/** The cost stays visible without a gesture (ADR-43): it depends on the chosen image, either way. */
function streamConsequence(stream: CameraStream | undefined, total: number): string | undefined {
  if (stream === undefined) return undefined
  if (stream.ordinal === 0 && total > 1) return 'Cette caméra occupera davantage le boîtier.'
  return 'Les visages éloignés risquent de ne plus être reconnus, et les images d’alerte seront moins nettes.'
}

export const DETECTION_DRAFT_LABELS: Record<keyof DetectionUpdate, string> = {
  labels: 'Ce qui est détecté',
  motionSensitivity: 'Sensibilité au mouvement',
  motionSensitivityPinned: 'Sensibilité au mouvement',
  detectStreamId: 'Image analysée',
}

// A stream is described by what the camera actually reports; ordinal is only a fallback (ADR-38).
function describeStream(stream: CameraStream, total: number): string {
  const parts: string[] = []

  if (stream.width !== null && stream.height !== null) {
    parts.push(`${stream.width} × ${stream.height}`)
  } else {
    parts.push(stream.ordinal === 0 ? 'Flux principal' : `Flux secondaire ${stream.ordinal}`)
  }

  if (stream.fps !== null) parts.push(`${stream.fps} img/s`)

  const suffix =
    stream.ordinal === 0
      ? ' — la plus détaillée'
      : stream.ordinal === total - 1
        ? ' — la plus légère'
        : ''

  return parts.join(' · ') + suffix
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
      help: 'Vyzio ne signale que ce qui est coché. Décocher une catégorie ne supprime rien de ce qui a déjà été enregistré.',
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

  // Only shown with more than one stream (ADR-38) — a single stream leaves nothing to choose.
  if (config.streams.length > 1) {
    declarations.push({
      id: 'detection-stream',
      label: 'Image analysée',
      nature: {
        kind: 'choice',
        options: config.streams.map((stream) => ({
          value: stream.id,
          label: describeStream(stream, config.streams.length),
        })),
      },
      help: STREAM_HELP,
      consequence: streamConsequence(
        config.streams.find(
          (stream) => stream.id === (values.detectStreamId ?? config.streams[0].id),
        ),
        config.streams.length,
      ),
      value: values.detectStreamId ?? config.streams[0].id,
      onChange: (value) => set('detectStreamId', value as string),
    })
  }

  return declarations
}
