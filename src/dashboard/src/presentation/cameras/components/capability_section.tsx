import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { Camera } from '../../../domain/entities/camera.entity'
import { Badge } from '../../../common/components/badge'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { Button } from '../../../common/ui/button'
import { Input } from '../../../common/ui/input'
import { SettingRow } from '../../../common/settings/setting_row'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import { cn } from '../../../common/ui/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../common/ui/select'
import { CAPABILITY_LABELS } from '../cameras.formatters'
import { CapabilityTask } from '../camera_connection.uido'

/** What the capability section asks of its screen. */
interface CapabilityIntents {
  onRetryRead: () => void
  onDetect: () => void
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (
    capability: Capability,
    protocol: SupportedProtocol,
    configJson?: string,
  ) => Promise<boolean>
  onTogglePtz: () => Promise<void>
  onSetPanInverted: (inverted: boolean) => void
  onRemove: (capability: Capability) => Promise<void>
  onOpenManual: () => void
  onCloseManual: () => void
  onConfigureManually: (capability: Capability, protocol: SupportedProtocol) => void
}

interface CapabilitySectionProps {
  camera: Camera
  bindings: CameraCapabilityBinding[]
  loading: boolean
  readError: AppError | null
  detecting: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  manualFormOpen: boolean
  manualConfiguring: boolean
  intents: CapabilityIntents
}

const PROTOCOL_LABELS: Record<SupportedProtocol, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP (ICSee / XMEye)',
  tapo_klap: 'Tapo KLAP',
  v380: 'V380 natif',
  rtsp: 'RTSP',
}

const SUPPORTED_PROTOCOL_LABELS: Record<string, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP',
  tapo_klap: 'Tapo KLAP',
  v380: 'V380',
  rtsp: 'RTSP',
}

const PTZ_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'v380', label: 'V380 Pro (port 8800, natif)' },
  { value: 'onvif', label: 'ONVIF (Hikvision, Dahua, Reolink, V380…)' },
  { value: 'dvrip', label: 'DVRIP (ICSee / XMEye)' },
  { value: 'tapo_klap', label: 'Tapo KLAP (caméra motorisée Tapo)' },
]

const PRIVACY_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'tapo_klap', label: 'Tapo KLAP — cache objectif + LED' },
]

const IMAGE_SETTINGS_PROTOCOLS: { value: SupportedProtocol; label: string }[] = [
  { value: 'onvif', label: 'ONVIF (Hikvision, Dahua, Reolink, V380…)' },
  { value: 'dvrip', label: 'DVRIP (ICSee / XMEye) — luminosité, contraste, saturation' },
]

const PROTOCOL_OPTIONS: Record<Capability, { value: SupportedProtocol; label: string }[]> = {
  ptz: PTZ_PROTOCOLS,
  hardware_privacy: PRIVACY_PROTOCOLS,
  image_settings: IMAGE_SETTINGS_PROTOCOLS,
}

// PTZ is switched on and off and never removed; the other capabilities are removed instead.
const SWITCHED_ON_AND_OFF: Record<Capability, boolean> = {
  ptz: true,
  hardware_privacy: false,
  image_settings: false,
}

// V380 finds its camera by a device id, which the user types when discovery misses it.
const ASKS_DEVICE_ID: Record<SupportedProtocol, boolean> = {
  onvif: false,
  dvrip: false,
  tapo_klap: false,
  v380: true,
  rtsp: false,
}

const ALL_CAPABILITIES: Capability[] = ['ptz', 'hardware_privacy', 'image_settings']

export function CapabilitySection({
  camera,
  bindings,
  loading,
  readError,
  detecting,
  pending,
  manualFormOpen,
  manualConfiguring,
  intents,
}: CapabilitySectionProps) {
  // A preset says what Vyzio expects, not a ceiling: any unbound capability can be added by hand.
  const availableCapabilities = ALL_CAPABILITIES.filter(
    (c) => !bindings.some((b) => b.capability === c),
  )

  if (loading) {
    return <p className="text-muted-foreground">Chargement…</p>
  }
  if (readError) {
    return (
      <ReadFailure
        error={readError}
        onRetry={intents.onRetryRead}
        subject="Les capacités de cette caméra n’ont pas pu être lues."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {camera.supportedProtocols.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {camera.supportedProtocols.map((p) => (
            <Badge key={p} tone="neutral">
              {SUPPORTED_PROTOCOL_LABELS[p] ?? p.toUpperCase()}
            </Badge>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border">
        {bindings.map((b) => (
          <CapabilityRow
            key={b.capability}
            camera={camera}
            binding={b}
            task={pending[b.capability]}
            intents={intents}
          />
        ))}
      </ul>

      {availableCapabilities.length > 0 &&
        (manualFormOpen ? (
          <ManualCapabilityForm
            availableCapabilities={availableCapabilities}
            configuring={manualConfiguring}
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
            Configurer une capacité manuellement
          </Button>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">
          PTZ, vie privée matérielle, réglages image…
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={detecting}
          onClick={intents.onDetect}
        >
          {detecting ? 'Détection…' : 'Détecter les capacités'}
        </Button>
      </div>
    </div>
  )
}

/** The left and right swap of a camera that turns the other way (SPECS 11), in the settings grammar (ADR-43). */
function panInvertedSetting(
  inverted: boolean,
  saving: boolean,
  onChange: (inverted: boolean) => void,
): SettingDeclaration {
  return {
    id: 'ptz-pan-inverted',
    label: 'Inverser gauche et droite',
    nature: { kind: 'toggle' },
    help: 'Pour une caméra qui tourne à gauche quand vous appuyez à droite. Le haut, le bas et les positions enregistrées ne changent pas.',
    value: inverted,
    onChange: (value) => onChange(value as boolean),
    disabled: saving,
  }
}

interface CapabilityRowProps {
  camera: Camera
  binding: CameraCapabilityBinding
  task: CapabilityTask | undefined
  intents: CapabilityIntents
}

function CapabilityRow({ camera, binding, task, intents }: CapabilityRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editProtocol, setEditProtocol] = useState<SupportedProtocol>(binding.protocol)
  const [v380DeviceId, setV380DeviceId] = useState('')

  const configuring = task === CapabilityTask.Configure
  const toggling = task === CapabilityTask.TogglePtz
  const panSaving = task === CapabilityTask.SetPanInverted
  const removing = task === CapabilityTask.Remove

  async function configure() {
    const verified = await intents.onConfigure(
      binding.capability,
      binding.isConfigured ? editProtocol : binding.protocol,
      v380DeviceId ? JSON.stringify({ device_id: parseInt(v380DeviceId, 10) }) : undefined,
    )
    if (verified) setIsEditing(false)
  }

  const ptzEnabled = camera.ptzSupported
  const isVerified = binding.verified
  const isConfigured = binding.isConfigured
  const switchedOnAndOff = SWITCHED_ON_AND_OFF[binding.capability]

  const showV380IdInput =
    ASKS_DEVICE_ID[binding.protocol] &&
    !isVerified &&
    (binding.lastError?.includes('not found') ?? false)

  const verifiedAtLabel = binding.verifiedAt
    ? new Date(binding.verifiedAt).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  if (isEditing) {
    return (
      <li className="flex flex-wrap items-end justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{CAPABILITY_LABELS[binding.capability]}</div>
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
            disabled={configuring}
            onClick={() => void configure()}
          >
            {configuring ? 'Enregistrement…' : 'Enregistrer'}
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

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium">
          {CAPABILITY_LABELS[binding.capability]}
          {isConfigured && (
            <span
              className={cn('size-1.5 rounded-full', isVerified ? 'bg-success' : 'bg-destructive')}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="text-sm text-muted-foreground">{PROTOCOL_LABELS[binding.protocol]}</div>
        {!isVerified && binding.lastError && (
          // The camera's answer is support detail: a plain sentence leads (SPECS 1.5).
          <div className="text-sm text-destructive">
            <p>La dernière vérification a échoué.</p>
            <DiagnosticLine text={scrubSecrets(binding.lastError)} />
          </div>
        )}
        {isVerified && verifiedAtLabel && (
          <div className="text-sm text-muted-foreground">Vérifié le {verifiedAtLabel}</div>
        )}

        {/* Stored by Vyzio, not sent to the camera: it stays usable offline. */}
        {isConfigured && binding.panInverted !== null && (
          <SettingRow
            setting={panInvertedSetting(binding.panInverted, panSaving, intents.onSetPanInverted)}
          />
        )}

        {showV380IdInput && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Identifiant V380 (décimal)</span>
              <Input
                type="text"
                placeholder="ex : 26970853"
                value={v380DeviceId}
                onChange={(e) => setV380DeviceId(e.target.value)}
                className="w-40"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!v380DeviceId || configuring}
              onClick={() => void configure()}
            >
              {configuring ? 'Envoi…' : 'Appliquer'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {switchedOnAndOff && isConfigured && (
          <>
            <Badge tone={ptzEnabled ? 'ok' : 'neutral'}>{ptzEnabled ? 'Actif' : 'Inactif'}</Badge>
            {ptzEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDisable(true)}
              >
                Désactiver
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={toggling}
                onClick={() => void intents.onTogglePtz()}
              >
                {toggling ? '…' : 'Activer'}
              </Button>
            )}
          </>
        )}
        {!isConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={configuring}
            onClick={() => void configure()}
          >
            {configuring ? 'Configuration…' : 'Configurer'}
          </Button>
        )}
        {isConfigured && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            Modifier
          </Button>
        )}
        {isConfigured && !switchedOnAndOff && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmRemove(true)}
          >
            Retirer
          </Button>
        )}
      </div>

      {confirmDisable && (
        <ConfirmModal
          title="Désactiver le PTZ ?"
          body="Le panneau de contrôle PTZ sera masqué dans l'interface. La configuration reste sauvegardée et peut être réactivée à tout moment."
          confirmLabel="Désactiver"
          tone="warn"
          loading={toggling}
          onConfirm={async () => {
            await intents.onTogglePtz()
            setConfirmDisable(false)
          }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title={`Retirer « ${CAPABILITY_LABELS[binding.capability]} » ?`}
          body="La configuration de cette capacité sera supprimée. Vous pourrez la reconfigurer à tout moment."
          confirmLabel="Retirer"
          tone="danger"
          loading={removing}
          onConfirm={async () => {
            await intents.onRemove(binding.capability)
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </li>
  )
}

interface ManualCapabilityFormProps {
  availableCapabilities: Capability[]
  configuring: boolean
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => void
  onCancel: () => void
}

function ManualCapabilityForm({
  availableCapabilities,
  configuring,
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
          disabled={configuring}
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
