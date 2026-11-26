import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import type { SupportedProtocol } from '../../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import type { ProtocolValues } from '../camera_connection_values'
import { SPECIFIC_ACCOUNT_HELP } from '../protocol_labels'

// V380 addresses the camera by a number the user types when discovery misses it.
const ASKS_DEVICE_ID: Record<SupportedProtocol, boolean> = {
  onvif: false,
  dvrip: false,
  tapo_klap: false,
  v380: true,
  rtsp: false,
}

/** A protocol's own settings: its port, the camera's number for V380, its specific account (CAM-17). */
export function protocolSettings(
  entry: CameraProtocol,
  values: ProtocolValues,
  onChange: (patch: Partial<ProtocolValues>) => void,
  saving: boolean,
): SettingDeclaration[] {
  const id = `protocol-${entry.protocol}`
  const settings: SettingDeclaration[] = []

  // ONVIF says where it answers once asked; until then there is no port to show.
  if (values.port !== null) {
    settings.push({
      id: `${id}-port`,
      label: 'Port',
      nature: { kind: 'number', min: 1, max: 65535 },
      value: values.port,
      onChange: (value) => onChange({ port: value as number }),
    })
  }

  if (ASKS_DEVICE_ID[entry.protocol]) {
    settings.push({
      id: `${id}-device-id`,
      label: 'Numéro de la caméra',
      nature: { kind: 'text', placeholder: 'ex : 87654321', keyboard: 'identifier' },
      help: 'Affiché dans l’application V380. Vyzio le trouve seul le plus souvent : ne le renseignez que s’il le demande.',
      value: values.deviceId,
      onChange: (value) => onChange({ deviceId: value as string }),
    })
  }

  settings.push({
    id: `${id}-specific-account`,
    label: 'Compte spécifique',
    nature: { kind: 'toggle' },
    help: SPECIFIC_ACCOUNT_HELP,
    value: values.specificAccount,
    onChange: (value) => onChange({ specificAccount: value as boolean }),
  })

  if (values.specificAccount) {
    settings.push(
      {
        id: `${id}-username`,
        label: 'Identifiant',
        nature: { kind: 'text', keyboard: 'identifier' },
        value: values.username,
        onChange: (value) => onChange({ username: value as string }),
      },
      {
        id: `${id}-password`,
        label: 'Mot de passe',
        nature: {
          kind: 'secret',
          placeholder: entry.hasSpecificAccount ? 'Inchangé' : '',
          validating: saving,
        },
        help: entry.hasSpecificAccount
          ? 'Laissez vide pour conserver le mot de passe actuel.'
          : undefined,
        value: values.password,
        onChange: (value) => onChange({ password: value as string }),
      },
    )
  }

  return settings
}

/** Why a protocol cannot be removed now, in one plain line; null when it can. */
export function removalBlocker(capabilities: string[], edited: boolean): string | null {
  if (capabilities.length === 1) return `${capabilities[0]} passe par ce protocole.`
  if (capabilities.length > 1) return `${capabilities.join(' et ')} passent par ce protocole.`
  if (edited) return 'Enregistrez ou annulez d’abord vos modifications.'
  return null
}
