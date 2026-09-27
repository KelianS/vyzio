import { useState } from 'react'
import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { Camera } from '../../../domain/entities/camera.entity'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { Button } from '../../../common/ui/button'
import { Input } from '../../../common/ui/input'
import { SettingRow } from '../../../common/settings/setting_row'
import { cn } from '../../../common/ui/utils'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import {
  CAPABILITY_LABELS,
  STREAM_LABEL,
  TESTS_SUSPENDED,
  formatCameraStatusLabel,
  formatCheckedAt,
  formatStatusTone,
  formatStreamStateLine,
} from '../cameras.formatters'
import { CapabilityTask } from '../camera_connection.uido'
import {
  CAPABILITY_STATE_PILLS,
  CapabilityState,
  SWITCHED_ON_AND_OFF,
  capabilityState,
} from '../capability_state'
import { CapabilityCard } from './capability_card'

/** What the capability cards ask of their screen. */
interface CapabilityIntents {
  onRetryRead: () => void
  onDetect: () => void
  onVerifyStream: () => void
  onVerify: (capability: Capability) => void
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (
    capability: Capability,
    protocol: SupportedProtocol,
    configJson?: string,
  ) => Promise<boolean>
  onTogglePtz: () => Promise<void>
  onSetPanInverted: (inverted: boolean) => void
  onRemove: (capability: Capability) => Promise<void>
}

interface CapabilitySectionProps {
  camera: Camera
  bindings: CameraCapabilityBinding[]
  loading: boolean
  readError: AppError | null
  detecting: boolean
  verifyingStream: boolean
  /** Every other test goes through the stream's camera: while it fails, they are suspended (SPECS 2.2). */
  testsSuspended: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  intents: CapabilityIntents
}

// V380 finds its camera by a device id, which the user types when discovery misses it.
const ASKS_DEVICE_ID: Record<SupportedProtocol, boolean> = {
  onvif: false,
  dvrip: false,
  tapo_klap: false,
  v380: true,
  rtsp: false,
}

export function CapabilitySection({
  camera,
  bindings,
  loading,
  readError,
  detecting,
  verifyingStream,
  testsSuspended,
  pending,
  intents,
}: CapabilitySectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Capacités" className="flex flex-col gap-3">
        <StreamCard camera={camera} verifying={verifyingStream} onVerify={intents.onVerifyStream} />
        {!loading &&
          !readError &&
          bindings.map((b) => (
            <BindingCard
              key={b.capability}
              camera={camera}
              binding={b}
              task={pending[b.capability]}
              testsSuspended={testsSuspended}
              intents={intents}
            />
          ))}
      </ul>

      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {readError && (
        <ReadFailure
          error={readError}
          onRetry={intents.onRetryRead}
          subject="Les capacités de cette caméra n’ont pas pu être lues."
        />
      )}

      {testsSuspended && <p className="text-sm text-muted-foreground">{TESTS_SUSPENDED}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">
          Orientation, coupure matérielle, réglages image…
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={detecting || testsSuspended}
          onClick={intents.onDetect}
        >
          {detecting ? 'Détection…' : 'Détecter les capacités'}
        </Button>
      </div>
    </div>
  )
}

/** The stream is a capability like the others; its state is the camera status, the words of the camera header. */
function StreamCard({
  camera,
  verifying,
  onVerify,
}: {
  camera: Camera
  verifying: boolean
  onVerify: () => void
}) {
  return (
    <CapabilityCard
      title={STREAM_LABEL}
      pill={{ label: formatCameraStatusLabel(camera.status), tone: formatStatusTone(camera) }}
      actions={
        <Button type="button" variant="outline" size="sm" disabled={verifying} onClick={onVerify}>
          {verifying ? 'Vérification…' : 'Vérifier'}
        </Button>
      }
    >
      <p className={cn('text-sm', camera.connected ? 'text-muted-foreground' : 'text-destructive')}>
        {formatStreamStateLine(camera)}
      </p>
    </CapabilityCard>
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

const destructiveOutline = 'border-destructive text-destructive hover:bg-destructive/10'

interface BindingCardProps {
  camera: Camera
  binding: CameraCapabilityBinding
  task: CapabilityTask | undefined
  testsSuspended: boolean
  intents: CapabilityIntents
}

function BindingCard({ camera, binding, task, testsSuspended, intents }: BindingCardProps) {
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [v380DeviceId, setV380DeviceId] = useState('')

  const configuring = task === CapabilityTask.Configure
  const verifying = task === CapabilityTask.Verify
  const toggling = task === CapabilityTask.TogglePtz
  const panSaving = task === CapabilityTask.SetPanInverted
  const removing = task === CapabilityTask.Remove

  const label = CAPABILITY_LABELS[binding.capability]
  const state = capabilityState(binding, camera.ptzSupported)
  const switchedOnAndOff = SWITCHED_ON_AND_OFF[binding.capability]

  function configure() {
    return intents.onConfigure(
      binding.capability,
      binding.protocol,
      v380DeviceId ? JSON.stringify({ device_id: parseInt(v380DeviceId, 10) }) : undefined,
    )
  }

  const showV380IdInput =
    ASKS_DEVICE_ID[binding.protocol] &&
    !binding.verified &&
    (binding.lastError?.includes('not found') ?? false)

  const verifiedAtLabel = binding.verifiedAt ? formatCheckedAt(binding.verifiedAt) : null

  function stateLine() {
    switch (state) {
      case CapabilityState.Working:
        return verifiedAtLabel ? (
          <p className="text-sm text-muted-foreground">Vérifié le {verifiedAtLabel}</p>
        ) : null
      case CapabilityState.Failed:
        // The camera's answer is support detail: a plain sentence leads (SPECS 1.5).
        return (
          <div className="text-sm text-destructive">
            <p>
              La dernière vérification a échoué : relancez-la, ou choisissez une autre façon de la
              joindre dans Avancé.
            </p>
            {binding.lastError && <DiagnosticLine text={scrubSecrets(binding.lastError)} />}
          </div>
        )
      case CapabilityState.Unconfigured:
      case CapabilityState.SwitchedOff:
        return null
      default: {
        const unknownState: never = state
        return unknownState
      }
    }
  }

  function actions() {
    switch (state) {
      case CapabilityState.Unconfigured:
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={configuring || testsSuspended}
            onClick={() => void configure()}
          >
            {configuring ? 'Configuration…' : 'Configurer'}
          </Button>
        )
      case CapabilityState.SwitchedOff:
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toggling}
            onClick={() => void intents.onTogglePtz()}
          >
            {toggling ? 'Activation…' : 'Activer'}
          </Button>
        )
      case CapabilityState.Working:
      case CapabilityState.Failed:
        return (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={verifying || testsSuspended}
              onClick={() => intents.onVerify(binding.capability)}
            >
              {verifying ? 'Vérification…' : 'Vérifier'}
            </Button>
            {switchedOnAndOff ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={destructiveOutline}
                onClick={() => setConfirmDisable(true)}
              >
                Désactiver
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={destructiveOutline}
                onClick={() => setConfirmRemove(true)}
              >
                Retirer
              </Button>
            )}
          </>
        )
      default: {
        const unknownState: never = state
        return unknownState
      }
    }
  }

  return (
    <>
      <CapabilityCard title={label} pill={CAPABILITY_STATE_PILLS[state]} actions={actions()}>
        {stateLine()}

        {/* Stored by Vyzio, not sent to the camera: it stays usable offline. */}
        {binding.isConfigured && binding.panInverted !== null && (
          <SettingRow
            setting={panInvertedSetting(binding.panInverted, panSaving, intents.onSetPanInverted)}
          />
        )}

        {showV380IdInput && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Numéro de la caméra</span>
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
              disabled={!v380DeviceId || configuring || testsSuspended}
              onClick={() => void configure()}
            >
              {configuring ? 'Configuration…' : 'Configurer'}
            </Button>
          </div>
        )}
      </CapabilityCard>

      {confirmDisable && (
        <ConfirmModal
          title="Désactiver l’orientation ?"
          body="Les commandes d’orientation seront masquées dans l’interface. La configuration reste enregistrée et peut être réactivée à tout moment."
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
          title={`Retirer « ${label} » ?`}
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
    </>
  )
}
