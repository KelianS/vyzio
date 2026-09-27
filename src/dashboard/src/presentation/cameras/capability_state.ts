import type { BadgeTone } from '../../common/components/badge'
import type {
  CameraCapabilityBinding,
  Capability,
} from '../../domain/entities/camera_capability_binding.entity'

/** Where a capability stands, the pill of its card (DESIGN SYSTEM § Capability cards). */
export const CapabilityState = {
  Working: 'working',
  Failed: 'failed',
  Unconfigured: 'unconfigured',
  SwitchedOff: 'switched_off',
} as const
export type CapabilityState = (typeof CapabilityState)[keyof typeof CapabilityState]

// Orientation is switched on and off and never removed; the other capabilities are removed instead.
export const SWITCHED_ON_AND_OFF: Record<Capability, boolean> = {
  ptz: true,
  hardware_privacy: false,
  image_settings: false,
}

export const CAPABILITY_STATE_PILLS: Record<CapabilityState, { label: string; tone: BadgeTone }> = {
  working: { label: 'Fonctionne', tone: 'ok' },
  failed: { label: 'En échec', tone: 'danger' },
  unconfigured: { label: 'À configurer', tone: 'neutral' },
  switched_off: { label: 'Désactivée', tone: 'neutral' },
}

/** A switch the user turned off wins over the last test: the capability is not in use, whatever it answered. */
export function capabilityState(
  binding: CameraCapabilityBinding,
  switchedOn: boolean,
): CapabilityState {
  if (!binding.isConfigured) return CapabilityState.Unconfigured
  if (SWITCHED_ON_AND_OFF[binding.capability] && !switchedOn) return CapabilityState.SwitchedOff
  return binding.verified ? CapabilityState.Working : CapabilityState.Failed
}
