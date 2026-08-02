import type { SettingDeclaration, SettingOption } from '../../common/settings/settingDeclaration'
import type {
  CameraStream,
  DetectionConfig,
  DetectionConfigUpdate,
  MotionSensitivity,
} from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

// Les surcharges de conservation vivent sur leur propre page : les inclure ici
// ferait porter a un brouillon des reglages que l'ecran n'affiche pas.
export type DetectionUpdate = Omit<
  DetectionConfigUpdate,
  'continuousDaysOverride' | 'motionDaysOverride' | 'eventClipDaysOverride'
>

/**
 * « Automatique » est une **valeur du meme reglage**, pas un interrupteur a
 * cote : l'ajustement automatique (ADR-35) et un niveau fixe sont deux reponses
 * exclusives a la meme question. Les separer en deux controles ferait deux
 * sources de verite pour un seul fait — et, faute d'un chemin de retour, rendait
 * l'automatique irrecuperable des qu'un niveau avait ete choisi une fois.
 */
const AUTO = 'auto'

const SENSITIVITY_OPTIONS: SettingOption<MotionSensitivity | typeof AUTO>[] = [
  { value: AUTO, label: 'Automatique' },
  { value: 'high', label: 'Élevée' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Réduite' },
]

const SENSITIVITY_HELP =
  'Automatique : Vyzio ajuste le niveau tout seul selon ce que voit la caméra, et c’est le cas courant. Élevée : la caméra réagit au moindre mouvement. Moyenne : les petits mouvements sont ignorés pour éviter les alertes inutiles. Réduite : seuls les mouvements francs sont analysés, pour une scène très animée.'

const SENSITIVITY_CONSEQUENCE: Record<MotionSensitivity | typeof AUTO, string> = {
  auto: 'Vyzio suit ce que voit la caméra et corrige seul le niveau.',
  high: 'Le moindre mouvement est signalé, y compris la pluie ou un feuillage.',
  medium: 'Les petits mouvements sont ignorés.',
  low: 'Seuls les mouvements francs sont retenus — pour une scène très animée.',
}

const STREAM_HELP =
  'Vyzio réduit de toute façon l’image avant de l’analyser : une image plus légère ne lui retire quasiment rien et libère des ressources. En contrepartie, les visages éloignés risquent de ne plus être reconnus et les images d’alerte seront moins nettes. Ce choix ne change jamais la qualité de vos enregistrements.'

export const DETECTION_DRAFT_LABELS: Record<keyof DetectionUpdate, string> = {
  labels: 'Ce qui est détecté',
  motionSensitivity: 'Sensibilité au mouvement',
  motionSensitivityPinned: 'Sensibilité au mouvement',
  detectStreamId: 'Image analysée',
}

// Un flux est decrit par ce que la camera a reellement annonce, jamais par un
// nom de palier invente. Le rang ne sert que de repli quand le protocole liste
// ses flux sans les mesurer (ADR-38).
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

/**
 * Traduit l'etat d'une camera en reglages declares. Extrait du composant pour
 * rester verifiable : les regles qui vivent ici — quelles categories sont
 * proposees, le fait que choisir une sensibilite arrete l'ajustement
 * automatique, l'absence de choix quand il n'y a qu'un flux — sont du metier,
 * pas du rendu.
 */
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
  // Une camera ne propose que ce qu'elle sait reellement detecter, quand elle
  // le dit ; sinon le catalogue complet.
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
      // Tant que rien n'est fixe, c'est bien « Automatique » qui s'applique.
      value: values.motionSensitivityPinned ? values.motionSensitivity : AUTO,
      onChange: (value) => {
        if (value === AUTO) {
          // Le niveau atteint est conserve : il redevient simplement le point de
          // depart de l'ajustement, au lieu d'etre efface.
          set('motionSensitivityPinned', false)
          return
        }
        set('motionSensitivity', value as MotionSensitivity)
        set('motionSensitivityPinned', true)
      },
    },
  ]

  // Le choix n'apparait que si la camera offre vraiment plusieurs flux (ADR-38) :
  // un seul flux ne laisse rien a arbitrer.
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
      value: values.detectStreamId ?? config.streams[0].id,
      onChange: (value) => set('detectStreamId', value as string),
    })
  }

  return declarations
}
