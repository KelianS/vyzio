import { useState } from 'react'
import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import type { Camera } from '../../../domain/entities/camera.entity'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { Button } from '../../../common/ui/button'
import { SettingRow } from '../../../common/settings/setting_row'
import { cn } from '../../../common/ui/utils'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import {
  CAPABILITY_LABELS,
  DESTRUCTIVE_OUTLINE,
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
  IS_STREAM,
  SWITCHED_ON_AND_OFF,
  capabilityFailureLine,
  capabilityState,
  streamBindingOf,
  streamProtocolFailureLine,
} from '../capability_state'
import { CapabilityCard } from './capability_card'
import { ProtocolChoice } from './protocol_choice'
import { ManualCapability } from './manual_capability_form'

/** What the capability cards ask of their screen. */
interface CapabilityIntents {
  onRetryRead: () => void
  onDetect: () => void
  onVerifyStream: () => void
  onVerify: (capability: Capability) => void
  /** Resolves true when the camera answered through the protocol. */
  onConfigure: (capability: Capability, protocol: SupportedProtocol) => Promise<boolean>
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
  protocols: CameraProtocol[]
  loading: boolean
  readError: AppError | null
  detecting: boolean
  verifyingStream: boolean
  /** Every other test goes through the stream's camera: while it fails, they are suspended (SPECS 2.2). */
  testsSuspended: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  manualFormOpen: boolean
  manualConfiguring: boolean
  /** The stream's main path, a declared setting that follows the page's draft (ADR-41). */
  streamPath: SettingDeclaration
  intents: CapabilityIntents
}

// Only an RTSP stream is addressed by a path; DVRIP derives it from the protocol (ADR-61).
const ASKS_STREAM_PATH: Record<SupportedProtocol, boolean> = {
  rtsp: true,
  dvrip: false,
  onvif: false,
  v380: false,
  tapo_klap: false,
}

export function CapabilitySection({
  camera,
  bindings,
  protocols,
  loading,
  readError,
  detecting,
  verifyingStream,
  testsSuspended,
  pending,
  manualFormOpen,
  manualConfiguring,
  streamPath,
  intents,
}: CapabilitySectionProps) {
  const read = !loading && !readError
  const stream = streamBindingOf(bindings)

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Capacités" className="flex flex-col gap-3">
        <StreamCard
          camera={camera}
          binding={stream}
          protocol={protocols.find((entry) => entry.protocol === stream?.protocol)}
          verifying={verifyingStream}
          configuring={pending.stream === CapabilityTask.Configure}
          streamPath={streamPath}
          onVerify={intents.onVerifyStream}
          onConfigure={(protocol) => intents.onConfigure('stream', protocol)}
        />
        {read &&
          bindings
            .filter((b) => !IS_STREAM[b.capability])
            .map((b) => (
              <BindingCard
                key={b.capability}
                camera={camera}
                binding={b}
                protocol={protocols.find((entry) => entry.protocol === b.protocol)}
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

      {/* Adding a capability closes the list: it is a capability's own action (DESIGN SYSTEM § Capability cards). */}
      <ManualCapability
        bindings={bindings}
        bindingsRead={read}
        open={manualFormOpen}
        configuring={manualConfiguring}
        testsSuspended={testsSuspended}
        onOpen={intents.onOpenManual}
        onClose={intents.onCloseManual}
        onConfigure={intents.onConfigureManually}
      />

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
  binding,
  protocol,
  verifying,
  configuring,
  streamPath,
  onVerify,
  onConfigure,
}: {
  camera: Camera
  /** Undefined until the capabilities are read. */
  binding: CameraCapabilityBinding | undefined
  /** The row of the stream's protocol, once read: its failure names the way out (ADR-61). */
  protocol: CameraProtocol | undefined
  verifying: boolean
  configuring: boolean
  streamPath: SettingDeclaration
  onVerify: () => void
  onConfigure: (protocol: SupportedProtocol) => Promise<boolean>
}) {
  const unconfigured = binding ? !binding.isConfigured : false
  const pill = unconfigured
    ? CAPABILITY_STATE_PILLS[CapabilityState.Unconfigured]
    : { label: formatCameraStatusLabel(camera.status), tone: formatStatusTone(camera) }

  return (
    <CapabilityCard
      title={STREAM_LABEL}
      pill={pill}
      options={
        binding && (
          <>
            <ProtocolChoice
              capability="stream"
              current={binding.protocol}
              configured={binding.isConfigured}
              configuring={configuring}
              disabled={false}
              onConfigure={onConfigure}
            />
            {binding.isConfigured && ASKS_STREAM_PATH[binding.protocol] && (
              <SettingRow setting={streamPath} />
            )}
          </>
        )
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={verifying || unconfigured}
          onClick={onVerify}
        >
          {verifying ? 'Vérification…' : 'Vérifier'}
        </Button>
      }
    >
      {unconfigured ? (
        <p className="text-sm text-muted-foreground">
          Choisissez comment Vyzio lit les images, dans les options ci-dessous.
        </p>
      ) : (
        <div
          className={cn('text-sm', camera.connected ? 'text-muted-foreground' : 'text-destructive')}
        >
          <p>
            {(!camera.connected && streamProtocolFailureLine(protocol?.status ?? null)) ||
              formatStreamStateLine(camera)}
          </p>
          {/* The verifier's own reason is support detail, kept since the last check (SPECS 1.5). */}
          {!camera.connected && binding?.lastError && (
            <DiagnosticLine text={scrubSecrets(binding.lastError)} />
          )}
        </div>
      )}
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

interface BindingCardProps {
  camera: Camera
  binding: CameraCapabilityBinding
  /** The row of the protocol the capability goes through, once read. */
  protocol: CameraProtocol | undefined
  task: CapabilityTask | undefined
  testsSuspended: boolean
  intents: CapabilityIntents
}

function BindingCard({
  camera,
  binding,
  protocol,
  task,
  testsSuspended,
  intents,
}: BindingCardProps) {
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const configuring = task === CapabilityTask.Configure
  const verifying = task === CapabilityTask.Verify
  const toggling = task === CapabilityTask.TogglePtz
  const panSaving = task === CapabilityTask.SetPanInverted
  const removing = task === CapabilityTask.Remove

  const label = CAPABILITY_LABELS[binding.capability]
  const state = capabilityState(binding, camera.ptzSupported)
  const switchedOnAndOff = SWITCHED_ON_AND_OFF[binding.capability]

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
            {/* Silence, a refused account or a failed test each have their own way out (ADR-61). */}
            <p>{capabilityFailureLine(protocol?.status ?? null)}</p>
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
            onClick={() => void intents.onConfigure(binding.capability, binding.protocol)}
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
                className={DESTRUCTIVE_OUTLINE}
                onClick={() => setConfirmDisable(true)}
              >
                Désactiver
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={DESTRUCTIVE_OUTLINE}
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
      <CapabilityCard
        title={label}
        pill={CAPABILITY_STATE_PILLS[state]}
        actions={actions()}
        options={
          <>
            <ProtocolChoice
              capability={binding.capability}
              current={binding.protocol}
              configured={binding.isConfigured}
              configuring={configuring}
              disabled={testsSuspended}
              onConfigure={(chosen) => intents.onConfigure(binding.capability, chosen)}
            />
            {/* Stored by Vyzio, not sent to the camera: it stays usable offline. */}
            {binding.isConfigured && binding.panInverted !== null && (
              <SettingRow
                setting={panInvertedSetting(
                  binding.panInverted,
                  panSaving,
                  intents.onSetPanInverted,
                )}
              />
            )}
          </>
        }
      >
        {stateLine()}
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
