import { useState } from 'react'
import { Plus } from 'lucide-react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import { Button } from '../../../common/ui/button'
import { CAPABILITY_LABELS } from '../cameras.formatters'
import { PROTOCOL_OPTIONS } from '../protocol_labels'
import { Picker } from './protocol_choice'

// The stream is never added by hand: a camera is born with it (ADR-61).
const ADDABLE_CAPABILITIES: Capability[] = ['ptz', 'hardware_privacy', 'image_settings']

/** The manual path of SPECS 2.3: any unbound capability, declared by its protocol and tested at once. */
export function ManualCapability({
  bindings,
  bindingsRead,
  open,
  configuring,
  testsSuspended,
  onOpen,
  onClose,
  onConfigure,
}: {
  bindings: CameraCapabilityBinding[]
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
  const available = ADDABLE_CAPABILITIES.filter((c) => !bindings.some((b) => b.capability === c))
  if (!bindingsRead || available.length === 0) return null

  return open ? (
    <ManualCapabilityForm
      availableCapabilities={available}
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
