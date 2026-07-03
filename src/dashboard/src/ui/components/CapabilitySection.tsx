import { useState } from 'react'
import type { CameraCapabilityBinding, Capability, CapabilityProtocol } from '../../domain/entities/CameraCapabilityBinding'
import type { Camera } from '../../domain/entities/Camera'
import { useAsync } from '../hooks/useAsync'
import { useAsyncAction } from '../hooks/useAsyncAction'
import {
  getCameraCapabilities,
  configureCameraCapability,
  probeCameraCapability,
} from '../../app/dependencies'

interface CapabilitySectionProps {
  camera: Camera
  onReload?: () => void
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  ptz: 'Contrôle PTZ (orientation motorisée)',
  privacy_mode: 'Coupure vie privée matérielle',
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
  { value: 'ptz_parking', label: 'PTZ Parking — orientation vers zone neutre' },
]

export function CapabilitySection({ camera, onReload }: CapabilitySectionProps) {
  const { data: bindings, loading, reload } = useAsync(
    () => getCameraCapabilities.execute(camera.id),
    [camera.id],
  )

  const handleReload = () => {
    reload()
    onReload?.()
  }

  // Preset entries (isPreset=true) come from the server for listed cameras; absence means unlisted.
  const isUnlisted = !bindings?.some((b) => b.isPreset)

  if (loading) {
    return (
      <section className="camera-detail-section">
        <h3>Capacités</h3>
        <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.9rem' }}>Chargement…</p>
      </section>
    )
  }

  return (
    <section className="camera-detail-section">
      <h3>Capacités</h3>

      {isUnlisted && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', marginBottom: 12 }}>
          Cette caméra n'est pas dans le catalogue. Vous pouvez configurer manuellement ses
          capacités — chaque capacité doit être testée et confirmée avant d'être activée.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(bindings ?? []).map((b) => (
          <CapabilityRow
            key={b.capability}
            cameraId={camera.id}
            binding={b}
            onDone={handleReload}
          />
        ))}

        {isUnlisted && (
          <ManualCapabilityForm
            cameraId={camera.id}
            onDone={handleReload}
          />
        )}
      </div>
    </section>
  )
}

// --- CapabilityRow ---

interface CapabilityRowProps {
  cameraId: string
  binding: CameraCapabilityBinding
  onDone: () => void
}

function CapabilityRow({ cameraId, binding, onDone }: CapabilityRowProps) {
  const probeAction = useAsyncAction(
    () => probeCameraCapability.execute(cameraId, binding.capability),
    { onSuccess: onDone },
  )

  const configureAction = useAsyncAction(
    () => configureCameraCapability.execute(cameraId, binding.capability, binding.protocol),
    { onSuccess: onDone },
  )

  const isVerified = binding.verified
  const isConfigured = binding.isConfigured
  const action = isConfigured ? probeAction : configureAction

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{CAPABILITY_LABELS[binding.capability]}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)', marginTop: 2 }}>
          {PROTOCOL_LABELS[binding.protocol]}
          {binding.lastError && !isVerified && (
            <span style={{ color: 'var(--error, #ef4444)', marginLeft: 8 }}>
              {binding.lastError}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isConfigured && (
          <span
            title={isVerified ? 'Capacité vérifiée' : 'Non vérifiée'}
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              background: isVerified ? 'var(--green-bg, #dcfce7)' : 'var(--yellow-bg, #fef9c3)',
              color: isVerified ? 'var(--green, #16a34a)' : 'var(--yellow, #854d0e)',
            }}
          >
            {isVerified ? '✓ Vérifiée' : '⚠ Non vérifiée'}
          </span>
        )}

        <button
          type="button"
          className={isConfigured ? 'btn-secondary' : 'btn-primary'}
          disabled={action.loading}
          onClick={() => action.run()}
          style={{ fontSize: '0.82rem', padding: '4px 10px' }}
        >
          {action.loading ? 'Test…' : isConfigured ? 'Tester' : 'Configurer et tester'}
        </button>
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
  const [selectedProtocol, setSelectedProtocol] = useState<CapabilityProtocol>('onvif')

  const protocolOptions = selectedCapability === 'ptz' ? PTZ_PROTOCOLS : PRIVACY_PROTOCOLS

  const configureAction = useAsyncAction(
    () => configureCameraCapability.execute(cameraId, selectedCapability, selectedProtocol),
    {
      onSuccess: (result) => {
        onDone()
        if (!result?.verified) return
      },
    },
  )

  return (
    <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-alt, #f9fafb)', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}>
      <div style={{ fontWeight: 500, fontSize: '0.88rem', marginBottom: 10 }}>
        Configurer une capacité manuellement
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem' }}>
          <span>Capacité</span>
          <select
            value={selectedCapability}
            onChange={(e) => setSelectedCapability(e.target.value as Capability)}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border, #d1d5db)' }}
          >
            <option value="ptz">Contrôle PTZ</option>
            <option value="privacy_mode">Coupure vie privée</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.82rem' }}>
          <span>Protocole</span>
          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value as CapabilityProtocol)}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border, #d1d5db)' }}
          >
            {protocolOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-primary"
          disabled={configureAction.loading}
          onClick={() => configureAction.run()}
          style={{ fontSize: '0.82rem', padding: '5px 12px', alignSelf: 'flex-end' }}
        >
          {configureAction.loading ? 'Test en cours…' : 'Configurer et tester'}
        </button>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: 8 }}>
        La caméra est testée immédiatement. La capacité n'est proposée qu'en cas de succès.
      </p>
    </div>
  )
}
