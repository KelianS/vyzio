import type {
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'

/** A protocol by its name: said only where a protocol is chosen or reached (SPECS 1.5). */
export const PROTOCOL_LABELS: Record<SupportedProtocol, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP (ICSee / XMEye)',
  tapo_klap: 'Tapo KLAP',
  v380: 'V380 natif',
  rtsp: 'RTSP',
}

/** Why a protocol may take another account, wherever one is entered: it never leaves the local network. */
export const SPECIFIC_ACCOUNT_HELP =
  'Pour une caméra qui demande un autre compte par ce seul moyen, comme le compte cloud Tapo pour la coupure matérielle. Il n’est présenté qu’à la caméra, sur votre réseau.'

interface ProtocolOption {
  value: SupportedProtocol
  label: string
}

/** Every protocol a capability can go through, answering or not: a sleeping camera stays configurable (ADR-61). */
export const PROTOCOL_OPTIONS: Record<Capability, ProtocolOption[]> = {
  stream: [
    { value: 'rtsp', label: 'RTSP : flux standard' },
    { value: 'dvrip', label: 'DVRIP (ICSee / XMEye) : sans RTSP' },
  ],
  ptz: [
    { value: 'v380', label: 'V380 natif' },
    { value: 'onvif', label: 'ONVIF : Hikvision, Dahua, Reolink, V380…' },
    { value: 'dvrip', label: 'DVRIP (ICSee / XMEye)' },
    { value: 'tapo_klap', label: 'Tapo KLAP : caméra motorisée Tapo' },
  ],
  hardware_privacy: [{ value: 'tapo_klap', label: 'Tapo KLAP : cache objectif et LED' }],
  image_settings: [
    { value: 'onvif', label: 'ONVIF : Hikvision, Dahua, Reolink, V380…' },
    { value: 'dvrip', label: 'DVRIP (ICSee / XMEye) : luminosité, contraste, saturation' },
  ],
}
