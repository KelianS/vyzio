import { useEffect, useState } from 'react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/CameraCapabilityBinding'
import type { Camera } from '../../domain/entities/Camera'
import { useAsync } from '../hooks/useAsync'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useToast } from './Toast'
import { Btn } from './Btn'
import { Select } from './Select'
import {
  getCameraCapabilities,
  configureCameraCapability,
  detectCameraCapabilities,
  removeCameraCapability,
  updateCamera,
} from '../../app/dependencies'

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

  const detectAction = useAsyncAction(
    () => detectCameraCapabilities.execute(camera.id),
    {
      onSuccess: () => {
        toast('Détection terminée.', 'success')
        handleReload()
      },
    },
  )

  // A capacity not already bound (preset or manual) can always be added by hand — even on a
  // recognized vendor, since a preset only declares what Vyzio *expects*, not an exhaustive
  // ceiling (e.g. an ICSee unit that also happens to speak ONVIF for image settings).
  const availableCapabilities = ALL_CAPABILITIES.filter(
    (c) => !bindings?.some((b) => b.capability === c),
  )

  if (loading) {
    return (
      <section className="camera-detail-section capability-section-compact">
        <h4>Capacités</h4>
        <p className="capability-protocol">Chargement…</p>
      </section>
    )
  }

  return (
    <section className="camera-detail-section capability-section-compact">
      <h4>Capacités</h4>

      {camera.supportedProtocols.length > 0 && (
        <div className="capability-protocol-badges">
          {camera.supportedProtocols.map((p) => (
            <span key={p} className="capability-protocol-badge">
              {SUPPORTED_PROTOCOL_LABELS[p] ?? p.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {offline && (
        <p className="camera-inline-state" style={{ marginBottom: 8 }}>
          Caméra hors ligne — la détection sera disponible dès que la caméra sera joignable.
        </p>
      )}

      <div className="capability-list">
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

        {availableCapabilities.length > 0 && !offline && (
          showManualForm ? (
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
            <button
              type="button"
              className="capability-manual-form-trigger"
              title="Configurer une capacité manuellement"
              aria-label="Configurer une capacité manuellement"
              onClick={() => setShowManualForm(true)}
            >
              +
            </button>
          )
        )}
      </div>

      <div className="capability-detect-row">
        <span className="capability-detect-hint">PTZ, vie privée matérielle, réglages image…</span>
        <Btn
          variant="ghost"
          disabled={detectAction.loading || offline}
          loading={detectAction.loading}
          onClick={() => detectAction.run()}
        >
          Détecter les capacités
        </Btn>
      </div>
    </section>
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
      <div className="capability-row capability-row--editing">
        <div className="capability-info">
          <div className="capability-label">{CAPABILITY_LABELS[binding.capability]}</div>
          <div className="capability-manual-form-fields" style={{ marginTop: 6 }}>
            <label>
              <span>Protocole</span>
              <Select
                size="sm"
                value={editProtocol}
                onChange={(e) => setEditProtocol(e.target.value as SupportedProtocol)}
              >
                {protocolOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
        <div className="capability-actions">
          <Btn
            variant="secondary"
            loading={configureAction.loading}
            onClick={() => configureAction.run()}
          >
            Enregistrer
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setEditProtocol(binding.protocol)
              setIsEditing(false)
            }}
          >
            Annuler
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="capability-row">
      <div className="capability-info">
        <div className="capability-label">
          {CAPABILITY_LABELS[binding.capability]}
          {isConfigured && (
            <span className={`capability-status-dot ${isVerified ? 'ok' : 'fail'}`} />
          )}
        </div>
        <div className="capability-protocol">{PROTOCOL_LABELS[binding.protocol] ?? binding.protocol}</div>
        {!isVerified && binding.lastError && (
          <div className="capability-error">{binding.lastError}</div>
        )}
        {isVerified && verifiedAtLabel && (
          <div className="capability-verified-at">Vérifié le {verifiedAtLabel}</div>
        )}

        {showV380IdInput && (
          <div className="capability-v380-id-form">
            <label>
              <span>Identifiant V380 (décimal)</span>
              <input
                type="text"
                placeholder="ex : 26970853"
                value={v380DeviceId}
                onChange={(e) => setV380DeviceId(e.target.value)}
              />
            </label>
            <Btn
              variant="secondary"
              disabled={!v380DeviceId}
              loading={configureAction.loading}
              onClick={() => configureAction.run()}
            >
              Appliquer
            </Btn>
          </div>
        )}
      </div>

      <div className="capability-actions">
        {binding.capability === 'ptz' && isConfigured && (
          <>
            <span className={`capability-status-badge ${ptzEnabled ? 'capability-status-badge--on' : 'capability-status-badge--off'}`}>
              {ptzEnabled ? 'Actif' : 'Inactif'}
            </span>
            {ptzEnabled ? (
              <Btn
                variant="danger-outline"
                disabled={offline}
                onClick={() => setConfirmDisable(true)}
              >
                Désactiver
              </Btn>
            ) : (
              <Btn
                variant="ghost"
                loading={toggleAction.loading}
                disabled={offline}
                onClick={() => toggleAction.run()}
              >
                Activer
              </Btn>
            )}
          </>
        )}
        {!isConfigured && (
          <Btn
            variant="secondary"
            loading={configureAction.loading}
            disabled={offline}
            onClick={() => configureAction.run()}
          >
            Configurer
          </Btn>
        )}
        {isConfigured && (
          <Btn variant="ghost" disabled={offline} onClick={() => setIsEditing(true)}>
            Modifier
          </Btn>
        )}
        {isConfigured && binding.capability !== 'ptz' && (
          <Btn variant="danger-outline" onClick={() => setConfirmRemove(true)}>
            Retirer
          </Btn>
        )}
      </div>

      {confirmDisable && (
        <ConfirmModal
          title="Désactiver le PTZ ?"
          description="Le panneau de contrôle PTZ sera masqué dans l'interface. La configuration reste sauvegardée et peut être réactivée à tout moment."
          confirmLabel="Désactiver"
          loading={toggleAction.loading}
          onConfirm={() => { setConfirmDisable(false); toggleAction.run() }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title={`Retirer « ${CAPABILITY_LABELS[binding.capability]} » ?`}
          description="La configuration de cette capacité sera supprimée. Vous pourrez la reconfigurer à tout moment via le bouton + ."
          confirmLabel="Retirer"
          loading={removeAction.loading}
          onConfirm={() => { setConfirmRemove(false); removeAction.run() }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}

// --- ConfirmModal ---

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ title, description, confirmLabel, loading, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-modal-title">{title}</p>
        <p className="confirm-modal-desc">{description}</p>
        <div className="confirm-modal-actions">
          <Btn variant="ghost" size="md" onClick={onCancel}>Annuler</Btn>
          <Btn variant="danger" size="md" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// --- ManualCapabilityForm ---

interface ManualCapabilityFormProps {
  cameraId: string
  availableCapabilities: Capability[]
  onDone: () => void
  onCancel: () => void
}

function ManualCapabilityForm({ cameraId, availableCapabilities, onDone, onCancel }: ManualCapabilityFormProps) {
  const [selectedCapability, setSelectedCapability] = useState<Capability>(availableCapabilities[0])
  const [selectedProtocol, setSelectedProtocol] = useState<SupportedProtocol>(
    protocolOptionsFor(availableCapabilities[0])[0].value,
  )

  useEffect(() => {
    if (!availableCapabilities.includes(selectedCapability)) {
      setSelectedCapability(availableCapabilities[0])
      setSelectedProtocol(protocolOptionsFor(availableCapabilities[0])[0].value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCapabilities])

  const protocolOptions = protocolOptionsFor(selectedCapability)

  const configureAction = useAsyncAction(
    () => configureCameraCapability.execute(cameraId, selectedCapability, selectedProtocol),
    { onSuccess: () => onDone() },
  )

  return (
    <div className="capability-manual-form">
      <div className="capability-manual-form-title">Configurer manuellement</div>
      <div className="capability-manual-form-fields">
        <label>
          <span>Capacité</span>
          <Select
            size="sm"
            value={selectedCapability}
            onChange={(e) => {
              const cap = e.target.value as Capability
              setSelectedCapability(cap)
              setSelectedProtocol(protocolOptionsFor(cap)[0].value)
            }}
          >
            {availableCapabilities.map((cap) => (
              <option key={cap} value={cap}>
                {CAPABILITY_LABELS[cap]}
              </option>
            ))}
          </Select>
        </label>

        <label>
          <span>Protocole</span>
          <Select
            size="sm"
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as SupportedProtocol)}
          >
            {protocolOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <Btn
          variant="secondary"
          loading={configureAction.loading}
          onClick={() => configureAction.run()}
        >
          Configurer
        </Btn>
        <Btn variant="ghost" disabled={configureAction.loading} onClick={onCancel}>
          Annuler
        </Btn>
      </div>
      <p className="capability-manual-form-hint">
        La capacité est testée immédiatement et activée en cas de succès.
      </p>
    </div>
  )
}
