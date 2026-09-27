import { useState } from 'react'
import type {
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import { PROTOCOL_OPTIONS } from '../protocol_labels'
import { Button } from '../../../common/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../common/ui/select'

/** The protocol a capability goes through, inside its card's Options fold (DESIGN SYSTEM § Capability cards). */
export function ProtocolChoice({
  capability,
  current,
  configured,
  configuring,
  disabled,
  onConfigure,
}: {
  capability: Capability
  current: SupportedProtocol
  configured: boolean
  configuring: boolean
  disabled: boolean
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (protocol: SupportedProtocol) => Promise<boolean>
}) {
  const [selected, setSelected] = useState<SupportedProtocol>(current)
  // The saved protocol, already tested: choosing it again would only repeat « Vérifier ».
  const unchanged = configured && selected === current

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Protocole</span>
        <Picker
          value={selected}
          options={PROTOCOL_OPTIONS[capability]}
          onChange={(value) => setSelected(value as SupportedProtocol)}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={unchanged || configuring || disabled}
        onClick={() => void onConfigure(selected)}
      >
        {configuring ? 'Configuration…' : 'Configurer'}
      </Button>
    </div>
  )
}

/** Socle dropdown with pre-formatted options (ADR-42). */
export function Picker({
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
