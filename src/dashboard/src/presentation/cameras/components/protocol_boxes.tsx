import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import { Badge } from '../../../common/components/badge'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import { Button } from '../../../common/ui/button'
import { SettingsList } from '../../../common/settings/settings_list'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import type { SupportedProtocol } from '../../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import { formatCheckedAt } from '../cameras.formatters'
import type { ProtocolValues } from '../camera_connection_values'
import { protocolFailureLine, protocolPill } from '../capability_state'
import { PROTOCOL_LABELS } from '../protocol_labels'

// V380 addresses the camera by a number the user types when discovery misses it.
const ASKS_DEVICE_ID: Record<SupportedProtocol, boolean> = {
  onvif: false,
  dvrip: false,
  tapo_klap: false,
  v380: true,
  rtsp: false,
}

/** The protocols the camera speaks, one box each: state, port, own account, its own check (DESIGN SYSTEM § Capability cards). */
export function ProtocolBoxes({
  protocols,
  loading,
  readError,
  values,
  checking,
  onChange,
  onCheck,
  onRetryRead,
}: {
  protocols: CameraProtocol[]
  loading: boolean
  readError: AppError | null
  /** Each box as the page's draft holds it (ADR-41). */
  values: (protocol: SupportedProtocol) => ProtocolValues
  checking: Partial<Record<SupportedProtocol, true>>
  onChange: (protocol: SupportedProtocol, patch: Partial<ProtocolValues>) => void
  onCheck: (protocol: SupportedProtocol) => void
  onRetryRead: () => void
}) {
  if (loading) return <p className="text-muted-foreground">Chargement…</p>
  if (readError)
    return (
      <ReadFailure
        error={readError}
        onRetry={onRetryRead}
        subject="Les protocoles de cette caméra n’ont pas pu être lus."
      />
    )

  return (
    <ul aria-label="Protocoles" className="flex flex-col gap-3">
      {protocols.map((entry) => (
        <ProtocolBox
          key={entry.protocol}
          entry={entry}
          values={values(entry.protocol)}
          checking={checking[entry.protocol] === true}
          onChange={(patch) => onChange(entry.protocol, patch)}
          onCheck={() => onCheck(entry.protocol)}
        />
      ))}
    </ul>
  )
}

function ProtocolBox({
  entry,
  values,
  checking,
  onChange,
  onCheck,
}: {
  entry: CameraProtocol
  values: ProtocolValues
  checking: boolean
  onChange: (patch: Partial<ProtocolValues>) => void
  onCheck: () => void
}) {
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
      nature: { kind: 'text', placeholder: 'ex : 26970853' },
      help: 'Affiché dans l’application V380. Vyzio le trouve seul le plus souvent : ne le renseignez que s’il le demande.',
      value: values.deviceId,
      onChange: (value) => onChange({ deviceId: value as string }),
    })
  }

  settings.push({
    id: `${id}-own-account`,
    label: 'Compte propre',
    nature: { kind: 'toggle' },
    help: 'Pour une caméra qui demande un autre compte par ce seul moyen, comme le compte cloud Tapo pour la coupure matérielle. Il n’est présenté qu’à la caméra, sur votre réseau.',
    value: values.ownAccount,
    onChange: (value) => onChange({ ownAccount: value as boolean }),
  })

  if (values.ownAccount) {
    settings.push(
      {
        id: `${id}-username`,
        label: 'Identifiant',
        nature: { kind: 'text' },
        value: values.username,
        onChange: (value) => onChange({ username: value as string }),
      },
      {
        id: `${id}-password`,
        label: 'Mot de passe',
        nature: { kind: 'secret', placeholder: entry.hasOwnAccount ? 'Inchangé' : '' },
        help: entry.hasOwnAccount
          ? 'Laissez vide pour conserver le mot de passe actuel.'
          : undefined,
        value: values.password,
        onChange: (value) => onChange({ password: value as string }),
      },
    )
  }

  const pill = protocolPill(entry.status)
  const failure = protocolFailureLine(entry.status)

  return (
    <li
      className="rounded-inset border border-border p-4"
      aria-label={PROTOCOL_LABELS[entry.protocol]}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{PROTOCOL_LABELS[entry.protocol]}</h4>
        <Badge tone={pill.tone}>{pill.label}</Badge>
      </div>
      {entry.checkedAt && (
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifié le {formatCheckedAt(entry.checkedAt)}
        </p>
      )}
      {failure && <p className="mt-1 text-sm text-destructive">{failure}</p>}
      {entry.lastError && <DiagnosticLine text={scrubSecrets(entry.lastError)} />}
      <div className="mt-2">
        <SettingsList settings={settings} />
      </div>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={onCheck}>
          {checking ? 'Vérification…' : 'Vérifier'}
        </Button>
      </div>
    </li>
  )
}
