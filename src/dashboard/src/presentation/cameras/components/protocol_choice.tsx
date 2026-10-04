import { useState } from 'react'
import type { ChoiceOption } from '../../../common/settings/setting_declaration'
import type { SupportedProtocol } from '../../../domain/entities/camera_capability_binding.entity'
import type { ProtocolOption } from '../protocol_labels'
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
  options,
  current,
  configured,
  configuring,
  disabled,
  onConfigure,
}: {
  /** Never empty: the card says why instead when the camera has no protocol for it. */
  options: ProtocolOption[]
  current: SupportedProtocol
  configured: boolean
  configuring: boolean
  disabled: boolean
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (protocol: SupportedProtocol) => Promise<boolean>
}) {
  const [picked, setPicked] = useState<SupportedProtocol>(current)
  // A suggestion the camera has no protocol for, or a protocol since removed, falls back to the first offered.
  const selected = options.some((option) => option.value === picked) ? picked : options[0].value
  // The saved protocol, already tested: choosing it again would only repeat « Vérifier ».
  const unchanged = configured && selected === current

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Protocole</span>
        <Picker
          value={selected}
          options={options}
          onChange={(value) => setPicked(value as SupportedProtocol)}
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
  labelledBy,
}: {
  value: string
  options: readonly ChoiceOption[]
  onChange: (value: string) => void
  /** The id of a visible name kept outside a wrapping label, e.g. one followed by a help trigger. */
  labelledBy?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-full" aria-labelledby={labelledBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            title={option.hint}
            disabled={option.unavailable !== undefined}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
