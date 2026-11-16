import type { ChoiceOption, SettingDeclaration } from '../../common/settings/setting_declaration'
import { PrivacyStrategy, type Camera } from '../../domain/entities/camera.entity'
import type { Capability } from '../../domain/entities/camera_capability_binding.entity'
import { ORIENTATION } from '../../common/orientation/orientation_control'
import { SurveillanceEntry, surveillanceEntryOf } from '../../common/camera/camera_status'

/** What the user has set up on the camera; null while it is not known. */
export interface PrivacySetup {
  readonly positionsSaved: boolean | null
}

interface StrategyDefinition {
  readonly value: PrivacyStrategy
  readonly label: string
  /** What it does in one line, honest about whether the camera still films (product principle #4). */
  readonly effect: string
  /** What happens to this camera while privacy mode is on, whoever turned it on, behind the setting's help. */
  readonly explanation: string
  /** Why the strategy cannot be chosen now and where to fix that; null when it can (PRIV-15). */
  readonly unavailable: (camera: Camera, setup: PrivacySetup) => string | null
}

const HARDWARE_PRIVACY: Capability = 'hardware_privacy'

const NOTHING_KEPT = 'Vyzio n’enregistre plus, ne détecte plus et ne notifie plus'
const STILL_FILMS = 'filme toujours, visible sur votre réseau local'
const MEANWHILE = `En attendant, seul Vyzio s’arrête : la caméra ${STILL_FILMS}.`

const ORIENTATION_UNVERIFIED = 'Orientation non vérifiée : voir « Connexion ».'
const ORIENTATION_OFF = 'Orientation désactivée : voir « Connexion ».'
// Positions are saved from the live view, which only a camera in surveillance has (PRIV-18).
const POSITIONS_WAIT_FOR_STREAM =
  'Positions réglables une fois son flux vidéo reçu : voir « Connexion ».'
const POSITIONS_WAIT_FOR_RESTART =
  'Positions réglables une fois les changements appliqués, en haut de l’écran.'
const POSITIONS_FIRST =
  'Enregistrez d’abord ses positions Surveillance et Parking dans « Image et pilotage ».'
const HARDWARE_UNVERIFIED = 'Coupure matérielle non vérifiée : voir « Connexion ».'

const always = () => null

/** The setting's name, shared with the draft bar that lists what changed. */
export const STRATEGY_LABEL = 'En mode vie privée'

/**
 * The ways of no longer being filmed, from the weakest to the strongest.
 *
 * Every option says **what it guarantees and what it does not**: a camera
 * that keeps filming stays viewable on the local network, and keeping quiet
 * about that would promise a privacy that does not exist (product principle #4).
 */
const STRATEGIES: readonly StrategyDefinition[] = [
  {
    value: PrivacyStrategy.SoftwareBlur,
    label: 'Arrêt logiciel',
    effect: `Vyzio s’arrête, la caméra ${STILL_FILMS}.`,
    explanation: `Rien n’est demandé à la caméra : ${NOTHING_KEPT}. Elle continue de filmer et son image reste accessible depuis votre réseau local.`,
    unavailable: always,
  },
  {
    value: PrivacyStrategy.PtzParking,
    label: 'Orientation à l’écart',
    effect: `La caméra se tourne, mais ${STILL_FILMS}.`,
    explanation: `La caméra pivote vers sa position Parking, puis revient sur sa position Surveillance à la fin du mode vie privée. ${NOTHING_KEPT}, mais tournée, elle filme toujours et son image reste accessible depuis votre réseau local.`,
    unavailable: (camera, setup) => {
      // The camera only turns on a verified orientation it is allowed to use (ADR-10).
      if (!camera.verifiedCapabilities.includes(ORIENTATION)) return ORIENTATION_UNVERIFIED
      if (!camera.ptzSupported) return ORIENTATION_OFF
      const waiting = positionsWaitOf(camera)
      if (waiting) return waiting
      // Unknown positions do not lock it: the failed read says so, and the API refuses a missing one (ADR-10).
      return setup.positionsSaved === false ? POSITIONS_FIRST : null
    },
  },
  {
    value: PrivacyStrategy.Hardware,
    label: 'Coupure matérielle',
    effect: 'L’objectif est masqué : plus rien n’est filmé.',
    explanation: `L’objectif est masqué dans la caméra elle-même : c’est la seule option où plus rien ne peut être filmé. ${NOTHING_KEPT}.`,
    unavailable: (camera) =>
      camera.verifiedCapabilities.includes(HARDWARE_PRIVACY) ? null : HARDWARE_UNVERIFIED,
  },
]

/** What the positions wait for before the camera is in surveillance; null once it is. */
function positionsWaitOf(camera: Camera): string | null {
  const entry = surveillanceEntryOf(camera)
  switch (entry) {
    case SurveillanceEntry.Watched:
      return null
    case SurveillanceEntry.AwaitsStream:
      return POSITIONS_WAIT_FOR_STREAM
    case SurveillanceEntry.AwaitsRestart:
      return POSITIONS_WAIT_FOR_RESTART
    default: {
      const unknown: never = entry
      return unknown
    }
  }
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
  // Every strategy stays listed; the saved one stays choosable and says its lack below (DESIGN SYSTEM § Settings screens).
  const options: ChoiceOption<PrivacyStrategy>[] = STRATEGIES.map((strategy) => ({
    value: strategy.value,
    label: strategy.label,
    unavailable:
      strategy.value === camera.privacyStrategy
        ? undefined
        : (strategy.unavailable(camera, setup) ?? undefined),
  }))
  const chosen = STRATEGIES.find((strategy) => strategy.value === value)
  const lack = chosen?.unavailable(camera, setup) ?? null
  // A strategy that cannot act must not promise its effect: what is missing, then what still holds.
  const lines = lack ? [lack, MEANWHILE] : [chosen?.effect ?? '']

  return [
    {
      id: 'privacy-strategy',
      label: STRATEGY_LABEL,
      nature: { kind: 'choice', options },
      help: chosen?.explanation,
      // Only what the chosen strategy does in one line, and what it still lacks, stays visible (ADR-15).
      consequence: lines.join(' '),
      value,
      onChange: (next) => onChange(next as PrivacyStrategy),
    },
  ]
}
