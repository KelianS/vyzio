import { useState } from 'react'
import { Plus } from 'lucide-react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/CameraCapabilityBinding'
import type { Camera } from '../../domain/entities/Camera'
import { useAsync } from '../../common/hooks/useAsync'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useToast } from '../../common/components/Toast'
import { Badge } from '../../common/components/Badge'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { Button } from '../../common/ui/button'
import { Input } from '../../common/ui/input'
import { cn } from '../../common/ui/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../common/ui/select'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

interface CapabilitySectionProps {
  camera: Camera
  offline?: boolean
  onReload?: () => void
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  ptz: 'PTZ',
  hardware_privacy: 'Vie privée matérielle',
  image_settings: 'Réglages image',
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

function protocolOptionsFor(capability: Capability) {
  if (capability === 'ptz') return PTZ_PROTOCOLS
  if (capability === 'image_settings') return IMAGE_SETTINGS_PROTOCOLS
  return PRIVACY_PROTOCOLS
}

const ALL_CAPABILITIES: Capability[] = ['ptz', 'hardware_privacy', 'image_settings']

export function CapabilitySection({ camera, offline, onReload }: CapabilitySectionProps) {
  const { toast } = useToast()
  const { getCameraCapabilities, detectCameraCapabilities } = useAppContainer().cameras
  const [showManualForm, setShowManualForm] = useState(false)
  const {
    data: bindings,
    loading,
    reload,
  } = useAsync(() => getCameraCapabilities.execute(camera.id), [camera.id])

  const handleReload = () => {
    reload()
    onReload?.()
  }

  const detectAction = useAsyncAction(() => detectCameraCapabilities.execute(camera.id), {
    onSuccess: () => {
      toast('Détection terminée.', 'success')
      handleReload()
    },
  })

  // A capacity not already bound (preset or manual) can always be added by hand — even on a
  // recognized vendor, since a preset only declares what Vyzio *expects*, not an exhaustive
  // ceiling (e.g. an ICSee unit that also happens to speak ONVIF for image settings).
  const availableCapabilities = ALL_CAPABILITIES.filter(
    (c) => !bindings?.some((b) => b.capability === c),
  )

  if (loading) {
    return <p className="text-muted-foreground">Chargement…</p>
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

      {offline && (
        <p className="text-sm text-muted-foreground">
          Caméra hors ligne — la détection sera disponible dès que la caméra sera joignable.
        </p>
      )}

      <ul className="divide-y divide-border">
        {(bindings ?? []).map((b) => (
          <CapabilityRow
            key={b.capability}
            camera={camera}
            binding={b}
            offline={offline}
            onDone={handleReload}
            onToast={toast}
          />
        ))}
      </ul>

      {availableCapabilities.length > 0 &&
        !offline &&
        (showManualForm ? (
          <ManualCapabilityForm
            cameraId={camera.id}
            availableCapabilities={availableCapabilities}
            onDone={() => {
              setShowManualForm(false)
              handleReload()
            }}
            onCancel={() => setShowManualForm(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setShowManualForm(true)}
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
          disabled={detectAction.loading || offline}
          onClick={() => detectAction.run()}
        >
          {detectAction.loading ? 'Détection…' : 'Détecter les capacités'}
        </Button>
      </div>
    </div>
  )
}

// --- CapabilityRow ---

interface CapabilityRowProps {
  camera: Camera
  binding: CameraCapabilityBinding
  offline?: boolean
  onDone: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

function CapabilityRow({ camera, binding, offline, onDone, onToast }: CapabilityRowProps) {
  const { configureCameraCapability, updateCamera, removeCameraCapability } =
    useAppContainer().cameras
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editProtocol, setEditProtocol] = useState<SupportedProtocol>(binding.protocol)
  const [v380DeviceId, setV380DeviceId] = useState('')

  const protocolOptions = protocolOptionsFor(binding.capability)

  const configureAction = useAsyncAction(
    () =>
      configureCameraCapability.execute(
        camera.id,
        binding.capability,
        binding.isConfigured ? editProtocol : binding.protocol,
        v380DeviceId ? JSON.stringify({ device_id: parseInt(v380DeviceId, 10) }) : undefined,
      ),
    {
      onSuccess: (result) => {
        if (result?.verified) {
          setIsEditing(false)
          onToast(`${CAPABILITY_LABELS[binding.capability]} — connexion réussie.`, 'success')
        } else {
          onToast(
            result?.lastError
              ? `Connexion échouée : ${result.lastError}`
              : "Connexion échouée — vérifiez l'accès réseau et les identifiants.",
            'error',
          )
        }
        onDone()
      },
    },
  )

  const ptzEnabled = camera.ptzSupported
  const toggleAction = useAsyncAction(
    () =>
      updateCamera.execute(camera.id, {
        displayName: camera.displayName,
        host: camera.host,
        port: camera.port,
        username: camera.username ?? null,
        password: null,
        streamPath: camera.streamPath ?? null,
        vendorFamily: camera.vendorFamily,
        sourceType: camera.sourceType,
        streamProtocol: camera.streamProtocol,
        ptzSupported: !ptzEnabled,
      }),
    {
      onSuccess: () => {
        onToast(ptzEnabled ? 'PTZ désactivé.' : 'PTZ activé.', 'success')
        onDone()
      },
    },
  )

  const removeAction = useAsyncAction(
    () => removeCameraCapability.execute(camera.id, binding.capability),
    {
      onSuccess: () => {
        onToast(`${CAPABILITY_LABELS[binding.capability]} retiré.`, 'success')
        onDone()
      },
    },
  )

  const isVerified = binding.verified
  const isConfigured = binding.isConfigured

  const showV380IdInput =
    binding.protocol === 'v380' &&
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
              options={protocolOptions}
              onChange={(value) => setEditProtocol(value as SupportedProtocol)}
            />
          </label>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={configureAction.loading}
            onClick={() => configureAction.run()}
          >
            {configureAction.loading ? 'Enregistrement…' : 'Enregistrer'}
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
        <div className="text-sm text-muted-foreground">
          {PROTOCOL_LABELS[binding.protocol] ?? binding.protocol}
        </div>
        {!isVerified && binding.lastError && (
          <div className="text-sm text-destructive">{binding.lastError}</div>
        )}
        {isVerified && verifiedAtLabel && (
          <div className="text-sm text-muted-foreground">Vérifié le {verifiedAtLabel}</div>
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
              disabled={!v380DeviceId || configureAction.loading}
              onClick={() => configureAction.run()}
            >
              {configureAction.loading ? 'Envoi…' : 'Appliquer'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {binding.capability === 'ptz' && isConfigured && (
          <>
            <Badge tone={ptzEnabled ? 'ok' : 'neutral'}>{ptzEnabled ? 'Actif' : 'Inactif'}</Badge>
            {ptzEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10"
                disabled={offline}
                onClick={() => setConfirmDisable(true)}
              >
                Désactiver
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={toggleAction.loading || offline}
                onClick={() => toggleAction.run()}
              >
                {toggleAction.loading ? '…' : 'Activer'}
              </Button>
            )}
          </>
        )}
        {!isConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={configureAction.loading || offline}
            onClick={() => configureAction.run()}
          >
            {configureAction.loading ? 'Configuration…' : 'Configurer'}
          </Button>
        )}
        {isConfigured && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offline}
            onClick={() => setIsEditing(true)}
          >
            Modifier
          </Button>
        )}
        {isConfigured && binding.capability !== 'ptz' && (
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
          loading={toggleAction.loading}
          onConfirm={async () => {
            await toggleAction.run()
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
          loading={removeAction.loading}
          onConfirm={async () => {
            await removeAction.run()
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </li>
  )
}

// --- ManualCapabilityForm ---

interface ManualCapabilityFormProps {
  cameraId: string
  availableCapabilities: Capability[]
  onDone: () => void
  onCancel: () => void
}

function ManualCapabilityForm({
  cameraId,
  availableCapabilities,
  onDone,
  onCancel,
}: ManualCapabilityFormProps) {
  const { configureCameraCapability } = useAppContainer().cameras
  const [selectedCapability, setSelectedCapability] = useState<Capability>(availableCapabilities[0])
  const [selectedProtocol, setSelectedProtocol] = useState<SupportedProtocol>(
    protocolOptionsFor(availableCapabilities[0])[0].value,
  )

  // Falls back to the first still-available capability when the current selection disappears
  // (e.g. it just got configured elsewhere) — adjusted during render, not an effect.
  const [prevAvailableCapabilities, setPrevAvailableCapabilities] = useState(availableCapabilities)
  if (availableCapabilities !== prevAvailableCapabilities) {
    setPrevAvailableCapabilities(availableCapabilities)
    if (!availableCapabilities.includes(selectedCapability)) {
      setSelectedCapability(availableCapabilities[0])
      setSelectedProtocol(protocolOptionsFor(availableCapabilities[0])[0].value)
    }
  }

  const protocolOptions = protocolOptionsFor(selectedCapability)

  const configureAction = useAsyncAction(
    () => configureCameraCapability.execute(cameraId, selectedCapability, selectedProtocol),
    { onSuccess: () => onDone() },
  )

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
              setSelectedProtocol(protocolOptionsFor(cap)[0].value)
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Protocole</span>
          <Picker
            value={selectedProtocol}
            options={protocolOptions}
            onChange={(value) => setSelectedProtocol(value as SupportedProtocol)}
          />
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={configureAction.loading}
          onClick={() => configureAction.run()}
        >
          {configureAction.loading ? 'Configuration…' : 'Configurer'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={configureAction.loading}
          onClick={onCancel}
        >
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
