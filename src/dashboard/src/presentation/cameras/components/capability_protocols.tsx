import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { Camera } from '../../../domain/entities/camera.entity'
import { Button } from '../../../common/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../common/ui/select'
import { CAPABILITY_LABELS, STREAM_LABEL, TESTS_SUSPENDED } from '../cameras.formatters'
import { CapabilityTask } from '../camera_connection.uido'

/** What the protocol list asks of its screen. */
interface ProtocolIntents {
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => Promise<boolean>
  onOpenManual: () => void
  onCloseManual: () => void
  onConfigureManually: (capability: Capability, protocol: SupportedProtocol) => void
}

interface CapabilityProtocolsProps {
  camera: Camera
  bindings: CameraCapabilityBinding[]
  /** False while the capabilities are unread: an unread list would offer every capability to add by hand. */
  bindingsRead: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  manualFormOpen: boolean
  manualConfiguring: boolean
  testsSuspended: boolean
  intents: ProtocolIntents
}

const PROTOCOL_LABELS: Record<SupportedProtocol, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP (ICSee / XMEye)',
  tapo_klap: 'Tapo KLAP',
  v380: 'V380 natif',
  rtsp: 'RTSP',
}

const PTZ_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'v380', label: 'V380 Pro (port 8800, natif)' },
  { value: 'onvif', label: 'ONVIF (Hikvision, Dahua, Reolink, V380…)' },
  { value: 'dvrip', label: 'DVRIP (ICSee / XMEye)' },
  { value: 'tapo_klap', label: 'Tapo KLAP (caméra motorisée Tapo)' },
]

const PRIVACY_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'tapo_klap', label: 'Tapo KLAP : cache objectif et LED' },
]

const IMAGE_SETTINGS_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'onvif', label: 'ONVIF (Hikvision, Dahua, Reolink, V380…)' },
  { value: 'dvrip', label: 'DVRIP (ICSee / XMEye) : luminosité, contraste, saturation' },
]

const PROTOCOL_OPTIONS: Record<Capability, { value: SupportedProtocol; label: string }[]> = {
  ptz: PTZ_PROTOCOLS,
  hardware_privacy: PRIVACY_PROTOCOLS,
  image_settings: IMAGE_SETTINGS_PROTOCOLS,
}

const ALL_CAPABILITIES: Capability[] = ['ptz', 'hardware_privacy', 'image_settings']

/** How Vyzio reaches each capability, one row per capability in the same layout, the manual path beside it (SPECS 2.3). */
export function CapabilityProtocols({
  camera,
  bindings,
  bindingsRead,
  pending,
  manualFormOpen,
  manualConfiguring,
  testsSuspended,
  intents,
}: CapabilityProtocolsProps) {
  // A preset says what Vyzio expects, not a ceiling: any unbound capability can be added by hand.
  const availableCapabilities = ALL_CAPABILITIES.filter(
    (c) => !bindings.some((b) => b.capability === c),
  )

  return (
    <div className="mt-6 flex flex-col gap-3">
      <ul aria-label="Protocoles" className="divide-y divide-border border-t border-border">
        <ProtocolRow title={STREAM_LABEL} protocol={PROTOCOL_LABELS[camera.streamProtocol]} />
        {bindings.map((b) => (
          <BindingProtocolRow
            key={b.capability}
            binding={b}
            configuring={pending[b.capability] === CapabilityTask.Configure}
            testsSuspended={testsSuspended}
            onConfigure={intents.onConfigure}
          />
        ))}
      </ul>

      {testsSuspended && <p className="text-sm text-muted-foreground">{TESTS_SUSPENDED}</p>}

      {bindingsRead &&
        availableCapabilities.length > 0 &&
        (manualFormOpen ? (
          <ManualCapabilityForm
            availableCapabilities={availableCapabilities}
            configuring={manualConfiguring}
            testsSuspended={testsSuspended}
            onConfigure={intents.onConfigureManually}
            onCancel={intents.onCloseManual}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={intents.onOpenManual}
          >
            <Plus aria-hidden="true" />
            Ajouter une capacité
          </Button>
        ))}
    </div>
  )
}

function ProtocolRow({
  title,
  protocol,
  action,
}: {
  title: string
  protocol: string
  action?: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{protocol}</div>
      </div>
      {action}
    </li>
  )
}

function BindingProtocolRow({
  binding,
  configuring,
  testsSuspended,
  onConfigure,
}: {
  binding: CameraCapabilityBinding
  configuring: boolean
  testsSuspended: boolean
  onConfigure: ProtocolIntents['onConfigure']
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editProtocol, setEditProtocol] = useState<SupportedProtocol>(binding.protocol)
  const title = CAPABILITY_LABELS[binding.capability]

  if (!isEditing) {
    return (
      <ProtocolRow
        title={title}
        protocol={PROTOCOL_LABELS[binding.protocol]}
        action={
          binding.isConfigured && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Modifier
            </Button>
          )
        }
      />
    )
  }

  return (
    <li className="flex flex-wrap items-end justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <label className="mt-2 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Protocole</span>
          <Picker
            value={editProtocol}
            options={PROTOCOL_OPTIONS[binding.capability]}
            onChange={(value) => setEditProtocol(value as SupportedProtocol)}
          />
        </label>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={configuring || testsSuspended}
          onClick={() =>
            void onConfigure(binding.capability, editProtocol).then((verified) => {
              if (verified) setIsEditing(false)
            })
          }
        >
          {configuring ? 'Configuration…' : 'Configurer'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditProtocol(binding.protocol)
            setIsEditing(false)
          }}
        >
          Annuler
        </Button>
      </div>
    </li>
  )
}

interface ManualCapabilityFormProps {
  availableCapabilities: Capability[]
  configuring: boolean
  testsSuspended: boolean
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => void
  onCancel: () => void
}

function ManualCapabilityForm({
  availableCapabilities,
  configuring,
  testsSuspended,
  onConfigure,
  onCancel,
}: ManualCapabilityFormProps) {
  const [selectedCapability, setSelectedCapability] = useState<Capability>(availableCapabilities[0])
  const [selectedProtocol, setSelectedProtocol] = useState<SupportedProtocol>(
    PROTOCOL_OPTIONS[availableCapabilities[0]][0].value,
  )

  // Falls back to the first capability still available when the selection disappears, during render.
  const [prevAvailableCapabilities, setPrevAvailableCapabilities] = useState(availableCapabilities)
  if (availableCapabilities !== prevAvailableCapabilities) {
    setPrevAvailableCapabilities(availableCapabilities)
    if (!availableCapabilities.includes(selectedCapability)) {
      setSelectedCapability(availableCapabilities[0])
      setSelectedProtocol(PROTOCOL_OPTIONS[availableCapabilities[0]][0].value)
    }
  }

  return (
    <div className="rounded-inset border border-border p-3">
      <p className="font-medium">Configurer manuellement</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Capacité</span>
          <Picker
            value={selectedCapability}
            options={availableCapabilities.map((cap) => ({
              value: cap,
              label: CAPABILITY_LABELS[cap],
            }))}
            onChange={(value) => {
              const cap = value as Capability
              setSelectedCapability(cap)
              setSelectedProtocol(PROTOCOL_OPTIONS[cap][0].value)
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Protocole</span>
          <Picker
            value={selectedProtocol}
            options={PROTOCOL_OPTIONS[selectedCapability]}
            onChange={(value) => setSelectedProtocol(value as SupportedProtocol)}
          />
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={configuring || testsSuspended}
          onClick={() => onConfigure(selectedCapability, selectedProtocol)}
        >
          {configuring ? 'Configuration…' : 'Configurer'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={configuring} onClick={onCancel}>
          Annuler
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        La capacité est testée immédiatement et activée en cas de succès.
      </p>
    </div>
  )
}

/** Socle dropdown with pre-formatted options (ADR-42). */
function Picker({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
