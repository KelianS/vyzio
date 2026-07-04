import { useState } from 'react'
import type {
  CameraCapabilityBinding,
  Capability,
  CapabilityProtocol,
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
  privacy_mode: 'Vie privée matérielle',
}

const PROTOCOL_LABELS: Record<CapabilityProtocol, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP (ICSee / XMEye)',
  tapo_klap: 'Tapo KLAP',
  ptz_parking: 'Parking PTZ',
  software_only: 'Logiciel uniquement',
  none: '—',
}

const PTZ_PROTOCOLS: { value: CapabilityProtocol; label: string }[] = [
  { value: 'onvif', label: 'ONVIF (Hikvision, Dahua, Reolink, V380…)' },
  { value: 'dvrip', label: 'DVRIP (ICSee / XMEye)' },
  { value: 'tapo_klap', label: 'Tapo KLAP (caméra motorisée Tapo)' },
]

const PRIVACY_PROTOCOLS: { value: CapabilityProtocol; label: string }[] = [
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

  const visibleBindings = (bindings ?? []).filter((b) => b.protocol !== 'ptz_parking')
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

      {offline && (
        <p className="camera-inline-state" style={{ marginBottom: 8 }}>
          Caméra hors ligne — les tests seront disponibles dès que la caméra sera joignable.
        </p>
      )}

      <div className="capability-list">
        {visibleBindings.map((b) => (
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
    () => configureCameraCapability.execute(cameraId, binding.capability, binding.protocol),
    {
      onSuccess: (result) => {
        if (result?.verified) {
          setLastResult('ok')
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
  const action = isConfigured ? probeAction : configureAction

  const verifiedAtLabel = binding.verifiedAt
    ? new Date(binding.verifiedAt).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="capability-row">
      <div className="capability-info">
        <div className="capability-label">
          {CAPABILITY_LABELS[binding.capability]}
          {isConfigured && (
            <span className={`capability-status-dot ${isVerified ? 'ok' : 'fail'}`} />
          )}
        </div>
        <div className="capability-protocol">{PROTOCOL_LABELS[binding.protocol]}</div>
        {!isVerified && (lastResult === 'fail' || binding.lastError) && (
          <div className="capability-error">{binding.lastError ?? 'Connexion échouée'}</div>
        )}
        {isVerified && verifiedAtLabel && lastResult === null && (
          <div className="capability-verified-at">Vérifié le {verifiedAtLabel}</div>
        )}
      </div>

      <button
        type="button"
        title={
          isConfigured
            ? 'Envoie une requête à la caméra pour vérifier que Vyzio peut y accéder via ce protocole'
            : 'Enregistre le protocole et teste immédiatement la connexion à la caméra'
        }
        className="secondary-cta capability-btn"
        disabled={action.loading || offline}
        onClick={() => action.run()}
      >
        {action.loading ? '…' : isConfigured ? 'Tester' : 'Configurer'}
      </button>
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
  const [selectedProtocol, setSelectedProtocol] = useState<CapabilityProtocol>('onvif')

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
            onChange={(e) => setSelectedCapability(e.target.value as Capability)}
          >
            <option value="ptz">PTZ</option>
            <option value="privacy_mode">Vie privée matérielle</option>
          </select>
        </label>

        <label>
          <span>Protocole</span>
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as CapabilityProtocol)}
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
