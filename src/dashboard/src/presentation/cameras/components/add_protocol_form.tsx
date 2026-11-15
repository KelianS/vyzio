import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { SupportedProtocol } from '../../../domain/entities/camera_capability_binding.entity'
import type {
  CameraProtocol,
  CameraProtocolAddition,
} from '../../../domain/entities/camera_protocol.entity'
import { Button } from '../../../common/ui/button'
import { SecondaryButton } from '../../../common/components/secondary_button'
import { Input } from '../../../common/ui/input'
import { Switch } from '../../../common/ui/switch'
import { SECRET_KEYBOARD, TEXT_KEYBOARD } from '../../../common/settings/text_keyboard'
import { PROTOCOL_LABELS, SPECIFIC_ACCOUNT_HELP } from '../protocol_labels'
import { ALL_PROTOCOLS } from '../camera_connection_values'
import { Picker } from './protocol_choice'
import { Field } from '../../../common/components/field'

/** Adds a protocol the camera does not speak yet, checked at once (CAM-45). */
export function AddProtocol({
  protocols,
  open,
  adding,
  onOpen,
  onClose,
  onAdd,
}: {
  protocols: CameraProtocol[]
  open: boolean
  adding: boolean
  onOpen: () => void
  onClose: () => void
  onAdd: (addition: CameraProtocolAddition) => void
}) {
  const available = ALL_PROTOCOLS.filter((p) => !protocols.some((entry) => entry.protocol === p))
  if (available.length === 0) return null

  return open ? (
    <AddProtocolForm available={available} adding={adding} onAdd={onAdd} onCancel={onClose} />
  ) : (
    <SecondaryButton icon={Plus} type="button" size="sm" className="self-start" onClick={onOpen}>
      Ajouter un protocole
    </SecondaryButton>
  )
}

function AddProtocolForm({
  available,
  adding,
  onAdd,
  onCancel,
}: {
  available: SupportedProtocol[]
  adding: boolean
  onAdd: (addition: CameraProtocolAddition) => void
  onCancel: () => void
}) {
  const [protocol, setProtocol] = useState<SupportedProtocol>(available[0])
  const [port, setPort] = useState('')
  const [specificAccount, setSpecificAccount] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function add() {
    const typedPort = Number.parseInt(port, 10)
    onAdd({
      protocol,
      // Empty keeps the protocol's usual port; ONVIF's is asked of the camera.
      port: Number.isNaN(typedPort) ? null : typedPort,
      username: specificAccount ? username.trim() || null : null,
      password: specificAccount && password ? password : null,
    })
  }

  return (
    <div
      role="group"
      aria-label="Ajouter un protocole"
      className="rounded-inset border border-border p-3"
    >
      <p className="font-medium">Ajouter un protocole</p>
      <div className="mt-2 flex flex-col gap-3">
        <Field label="Protocole">
          <Picker
            value={protocol}
            options={available.map((p) => ({ value: p, label: PROTOCOL_LABELS[p] }))}
            onChange={(value) => setProtocol(value as SupportedProtocol)}
          />
        </Field>
        <Field label="Port">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            placeholder="Port habituel"
            value={port}
            onChange={(event) => setPort(event.target.value)}
          />
        </Field>
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium">Compte spécifique</span>
          <Switch checked={specificAccount} onCheckedChange={setSpecificAccount} />
        </label>
        <p className="-mt-2 text-sm text-muted-foreground">{SPECIFIC_ACCOUNT_HELP}</p>
        {specificAccount && (
          <>
            <Field label="Identifiant">
              <Input
                {...TEXT_KEYBOARD.identifier}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <Field label="Mot de passe">
              <Input
                {...SECRET_KEYBOARD}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <SecondaryButton icon={Check} type="button" size="sm" disabled={adding} onClick={add}>
            {adding ? 'Vérification…' : 'Ajouter et vérifier'}
          </SecondaryButton>
          <Button type="button" variant="ghost" size="sm" disabled={adding} onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Vyzio vérifie aussitôt que la caméra répond par ce protocole, avec le compte de la caméra ou
        le compte spécifique.
      </p>
    </div>
  )
}
