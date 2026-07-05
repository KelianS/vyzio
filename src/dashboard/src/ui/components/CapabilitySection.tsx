import { useState } from 'react'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/CameraCapabilityBinding'
import type { Camera } from '../../domain/entities/Camera'
import { useAsync } from '../hooks/useAsync'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useToast } from './Toast'
import {
  getCameraCapabilities,
  configureCameraCapability,
  probeCameraCapability,
} from '../../app/dependencies'

interface CapabilitySectionProps {
  camera: Camera
  offline?: boolean
  onReload?: () => void
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  ptz: 'PTZ',
  hardware_privacy: 'Vie privée matérielle',
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

export function CapabilitySection({ camera, offline, onReload }: CapabilitySectionProps) {
  const {
    data: bindings,
    loading,
    reload,
  } = useAsync(() => getCameraCapabilities.execute(camera.id), [camera.id])

  const handleReload = () => {
    reload()
    onReload?.()
  }

  const isUnlisted = !bindings?.some((b) => b.isPreset)

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

      {/* Item 6 — Badges protocoles détectés */}
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
          Caméra hors ligne — les tests seront disponibles dès que la caméra sera joignable.
        </p>
      )}

      <div className="capability-list">
        {(bindings ?? []).map((b) => (
          <CapabilityRow
            key={b.capability}
            cameraId={camera.id}
            binding={b}
            offline={offline}
            onDone={handleReload}
          />
        ))}

        {isUnlisted && !offline && (
          <ManualCapabilityForm cameraId={camera.id} onDone={handleReload} />
        )}
      </div>
    </section>
  )
}

// --- CapabilityRow ---

interface CapabilityRowProps {
  cameraId: string
  binding: CameraCapabilityBinding
  offline?: boolean
  onDone: () => void
}

function CapabilityRow({ cameraId, binding, offline, onDone }: CapabilityRowProps) {
  const { toast } = useToast()
  const [lastResult, setLastResult] = useState<'ok' | 'fail' | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editProtocol, setEditProtocol] = useState<SupportedProtocol>(binding.protocol)
  // Item 8 — V380 manual device ID when probe fails with "Identifiant V380 introuvable"
  const [v380DeviceId, setV380DeviceId] = useState('')

  const protocolOptions = binding.capability === 'ptz' ? PTZ_PROTOCOLS : PRIVACY_PROTOCOLS

  const showV380IdInput =
    binding.protocol === 'v380' &&
    !isVerified &&
    (binding.lastError?.includes('not found') ?? false)

  const probeAction = useAsyncAction(
    () => probeCameraCapability.execute(cameraId, binding.capability),
    {
      onSuccess: (result) => {
        if (result?.verified) {
          setLastResult('ok')
          toast('Connexion vérifiée — la capacité est opérationnelle.', 'success')
        } else {
          setLastResult('fail')
          toast(
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

  const configureAction = useAsyncAction(
    () =>
      configureCameraCapability.execute(
        cameraId,
        binding.capability,
        binding.isConfigured ? editProtocol : binding.protocol,
        v380DeviceId ? JSON.stringify({ device_id: parseInt(v380DeviceId, 10) }) : undefined,
      ),
    {
      onSuccess: (result) => {
        if (result?.verified) {
          setLastResult('ok')
          setIsEditing(false)
          toast(`${CAPABILITY_LABELS[binding.capability]} — connexion réussie.`, 'success')
        } else {
          setLastResult('fail')
          toast(
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

  const isVerified = lastResult === 'ok' || (lastResult === null && binding.verified)
  const isConfigured = binding.isConfigured

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
              <select
                value={editProtocol}
                onChange={(e) => setEditProtocol(e.target.value as SupportedProtocol)}
              >
                {protocolOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="capability-actions">
          <button
            type="button"
            className="secondary-cta capability-btn"
            disabled={configureAction.loading}
            onClick={() => configureAction.run()}
          >
            {configureAction.loading ? '…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            className="capability-btn-ghost"
            onClick={() => {
              setEditProtocol(binding.protocol)
              setIsEditing(false)
            }}
          >
            Annuler
          </button>
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
        {!isVerified && (lastResult === 'fail' || binding.lastError) && (
          <div className="capability-error">{binding.lastError ?? 'Connexion échouée'}</div>
        )}
        {isVerified && verifiedAtLabel && lastResult === null && (
          <div className="capability-verified-at">Vérifié le {verifiedAtLabel}</div>
        )}

        {/* Item 8 — Saisie manuelle ID V380 si probe échoue */}
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
            <button
              type="button"
              className="secondary-cta capability-btn"
              disabled={!v380DeviceId || configureAction.loading}
              onClick={() => configureAction.run()}
            >
              {configureAction.loading ? '…' : 'Appliquer'}
            </button>
          </div>
        )}
      </div>

      <div className="capability-actions">
        <button
          type="button"
          title={
            isConfigured
              ? 'Envoie une requête à la caméra pour vérifier que Vyzio peut y accéder via ce protocole'
              : 'Enregistre le protocole et teste immédiatement la connexion à la caméra'
          }
          className="secondary-cta capability-btn"
          disabled={probeAction.loading || (!isConfigured && configureAction.loading) || offline}
          onClick={() => (isConfigured ? probeAction.run() : configureAction.run())}
        >
          {(isConfigured ? probeAction.loading : configureAction.loading)
            ? '…'
            : isConfigured
              ? 'Tester'
              : 'Configurer'}
        </button>
        {isConfigured && (
          <button
            type="button"
            className="capability-btn-ghost"
            disabled={offline}
            onClick={() => setIsEditing(true)}
          >
            Modifier
          </button>
        )}
      </div>
    </div>
  )
}

// --- ManualCapabilityForm ---

interface ManualCapabilityFormProps {
  cameraId: string
  onDone: () => void
}

function ManualCapabilityForm({ cameraId, onDone }: ManualCapabilityFormProps) {
  const [selectedCapability, setSelectedCapability] = useState<Capability>('ptz')
  const [selectedProtocol, setSelectedProtocol] = useState<SupportedProtocol>('v380')

  const protocolOptions = selectedCapability === 'ptz' ? PTZ_PROTOCOLS : PRIVACY_PROTOCOLS

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
          <select
            value={selectedCapability}
            onChange={(e) => {
              const cap = e.target.value as Capability
              setSelectedCapability(cap)
              setSelectedProtocol(cap === 'ptz' ? 'v380' : 'tapo_klap')
            }}
          >
            <option value="ptz">PTZ</option>
            <option value="hardware_privacy">Vie privée matérielle</option>
          </select>
        </label>

        <label>
          <span>Protocole</span>
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as SupportedProtocol)}
          >
            {protocolOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary-cta capability-btn"
          disabled={configureAction.loading}
          onClick={() => configureAction.run()}
        >
          {configureAction.loading ? '…' : 'Configurer'}
        </button>
      </div>
      <p className="capability-manual-form-hint">
        La capacité est testée immédiatement et activée en cas de succès.
      </p>
    </div>
  )
}
