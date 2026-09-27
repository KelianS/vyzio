import { useState } from 'react'
import { Plus } from 'lucide-react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import { Button } from '../../../common/ui/button'
import { CAPABILITY_LABELS } from '../cameras.formatters'
import { NO_PROTOCOL_YET, protocolOptions, type ProtocolOption } from '../protocol_labels'
import { Picker } from './protocol_choice'

// The stream is never added by hand: a camera is born with it (ADR-61).
const ADDABLE_CAPABILITIES: Capability[] = ['ptz', 'hardware_privacy', 'image_settings']

/** The manual path of SPECS 2.3: an unbound capability, over one of the camera's protocols, tested at once. */
export function ManualCapability({
  bindings,
  protocols,
  bindingsRead,
  open,
  configuring,
  testsSuspended,
  onOpen,
  onClose,
  onConfigure,
}: {
  bindings: CameraCapabilityBinding[]
  protocols: CameraProtocol[]
  /** False while the capabilities are unread: an unread list would offer every capability to add by hand. */
  bindingsRead: boolean
  open: boolean
  configuring: boolean
  testsSuspended: boolean
  onOpen: () => void
  onClose: () => void
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => void
}) {
  // A preset says what Vyzio expects, not a ceiling: any unbound capability can be added by hand.
  const unbound = ADDABLE_CAPABILITIES.filter((c) => !bindings.some((b) => b.capability === c))
  const choices = new Map(unbound.map((c) => [c, protocolOptions(c, protocols, null)]))
  const available = unbound.filter((c) => (choices.get(c) ?? []).length > 0)
  if (!bindingsRead) return null
  // A capability that already has its card changes its protocol there, failing or not.
  if (unbound.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Chaque capacité a déjà sa carte : pour en joindre une autrement, ouvrez ses options.
      </p>
    )
  // With no protocol at all, the stream card already says the way out.
  if (available.length === 0)
    return protocols.length === 0 ? null : (
      <p className="text-sm text-muted-foreground">{NO_PROTOCOL_YET}</p>
    )

  return open ? (
    <ManualCapabilityForm
      availableCapabilities={available}
      choices={choices}
      configuring={configuring}
      testsSuspended={testsSuspended}
      onConfigure={onConfigure}
      onCancel={onClose}
    />
  ) : (
    <Button type="button" variant="outline" size="sm" className="self-start" onClick={onOpen}>
      <Plus aria-hidden="true" />
      Ajouter une capacité
    </Button>
  )
}

interface ManualCapabilityFormProps {
  availableCapabilities: Capability[]
  /** Never empty for an available capability. */
  choices: Map<Capability, ProtocolOption[]>
  configuring: boolean
  testsSuspended: boolean
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => void
  onCancel: () => void
}

function ManualCapabilityForm({
  availableCapabilities,
  choices,
  configuring,
  testsSuspended,
  onConfigure,
  onCancel,
}: ManualCapabilityFormProps) {
  const optionsOf = (capability: Capability) => choices.get(capability) ?? []
  const firstOf = (capability: Capability) => optionsOf(capability)[0].value
  const [selectedCapability, setSelectedCapability] = useState<Capability>(availableCapabilities[0])
  const [selectedProtocol, setSelectedProtocol] = useState<SupportedProtocol>(
    firstOf(availableCapabilities[0]),
  )

  // Falls back to the first capability still available when the selection disappears, during render.
  const [prevAvailableCapabilities, setPrevAvailableCapabilities] = useState(availableCapabilities)
  if (availableCapabilities !== prevAvailableCapabilities) {
    setPrevAvailableCapabilities(availableCapabilities)
    if (!availableCapabilities.includes(selectedCapability)) {
      setSelectedCapability(availableCapabilities[0])
      setSelectedProtocol(firstOf(availableCapabilities[0]))
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
              setSelectedProtocol(firstOf(cap))
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Protocole</span>
          <Picker
            value={selectedProtocol}
            options={optionsOf(selectedCapability)}
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
