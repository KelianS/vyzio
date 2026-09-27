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
import type { CameraStreamLineup } from '../../../domain/entities/camera_stream.entity'
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
import { CapabilityTask, type StreamTask } from '../camera_connection.uido'
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
import { NO_PROTOCOL_YET, protocolOptions } from '../protocol_labels'
import { CapabilityCard } from './capability_card'
import { ProtocolChoice } from './protocol_choice'
import { ManualCapability } from './manual_capability_form'
import { StreamLines, type StreamLineIntents } from './stream_lines'
import { streamCoverageLine } from '../stream_lines'

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
  /** False while the protocols load or failed to: no card may then say the camera has none. */
  protocolsRead: boolean
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
  /** The stream lines of the stream card (ADR-65). */
  streams: StreamLinesState
  intents: CapabilityIntents
}

/** What the stream card needs to draw its stream lines. */
interface StreamLinesState {
  lineup: CameraStreamLineup | null
  loading: boolean
  readError: AppError | null
  tasks: Partial<Record<string, StreamTask>>
  formOpen: boolean
  adding: boolean
  intents: StreamLineIntents
}

export function CapabilitySection({
  camera,
  bindings,
  protocols,
  protocolsRead,
  loading,
  readError,
  detecting,
  verifyingStream,
  testsSuspended,
  pending,
  manualFormOpen,
  manualConfiguring,
  streamPath,
  streams,
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
          protocols={protocols}
          protocolsRead={protocolsRead}
          verifying={verifyingStream}
          configuring={pending.stream === CapabilityTask.Configure}
          streamPath={streamPath}
          streams={streams}
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
                protocols={protocols}
                protocolsRead={protocolsRead}
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
      <div className="flex flex-wrap items-center gap-2">
        <ManualCapability
          bindings={bindings}
          protocols={protocols}
          bindingsRead={read && protocolsRead}
          open={manualFormOpen}
          configuring={manualConfiguring}
          testsSuspended={testsSuspended}
          onOpen={intents.onOpenManual}
          onClose={intents.onCloseManual}
          onConfigure={intents.onConfigureManually}
        />
        {/* A stream not chosen yet is detection's to choose, so it does not wait for the stream (ADR-61 b). */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={detecting || (testsSuspended && stream?.isConfigured !== false)}
          onClick={intents.onDetect}
        >
          {detecting ? 'Détection…' : 'Détecter automatiquement'}
        </Button>
      </div>

      {/* A stream never chosen is not waited for: its card already says what to do. */}
      {testsSuspended && stream?.isConfigured !== false && (
        <p className="text-sm text-muted-foreground">{TESTS_SUSPENDED}</p>
      )}
    </div>
  )
}

/** The stream is a capability like the others; its state is the camera status, the words of the camera header. */
function StreamCard({
  camera,
  binding,
  protocols,
  protocolsRead,
  verifying,
  configuring,
  streamPath,
  streams,
  onVerify,
  onConfigure,
}: {
  camera: Camera
  /** Undefined until the capabilities are read. */
  binding: CameraCapabilityBinding | undefined
  /** The camera's protocols, once read: the stream's failure names the way out, its choice lists them (ADR-61). */
  protocols: CameraProtocol[]
  protocolsRead: boolean
  verifying: boolean
  configuring: boolean
  streamPath: SettingDeclaration
  streams: StreamLinesState
  onVerify: () => void
  onConfigure: (protocol: SupportedProtocol) => Promise<boolean>
}) {
  const coverage = binding?.isConfigured ? streamCoverageLine(streams.lineup) : null
  const unconfigured = binding ? !binding.isConfigured : false
  const protocol = protocols.find((entry) => entry.protocol === binding?.protocol)
  const choices = binding
    ? protocolOptions('stream', protocols, binding.isConfigured ? binding.protocol : null)
    : []
  const pill = unconfigured
    ? CAPABILITY_STATE_PILLS[CapabilityState.Unconfigured]
    : { label: formatCameraStatusLabel(camera.status), tone: formatStatusTone(camera) }

  return (
    <CapabilityCard
      title={STREAM_LABEL}
      pill={pill}
      options={
        binding &&
        choices.length > 0 && (
          <>
            <ProtocolChoice
              options={choices}
              current={binding.protocol}
              configured={binding.isConfigured}
              configuring={configuring}
              disabled={false}
              onConfigure={onConfigure}
            />
            {binding.isConfigured && (
              <>
                <p className="text-sm text-muted-foreground">
                  Changer de protocole remplace les flux par le flux principal de ce protocole ;
                  Vyzio retrouve les autres à la vérification suivante.
                </p>
                <StreamLines
                  lineup={streams.lineup}
                  loading={streams.loading}
                  readError={streams.readError}
                  protocols={choices}
                  mainPath={streamPath}
                  tasks={streams.tasks}
                  formOpen={streams.formOpen}
                  adding={streams.adding}
                  intents={streams.intents}
                />
              </>
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
          {choices.length > 0 || !protocolsRead
            ? 'Choisissez comment Vyzio lit les images, dans les options ci-dessous.'
            : NO_PROTOCOL_YET}
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
          {/* Whether recording and detection are covered as chosen, outside the fold (ADR-65 c). */}
          {coverage && <p>{coverage}</p>}
        </div>
      )}
    </CapabilityCard>
  )
}

/** Where a camera's positions are kept, and what it costs when Vyzio keeps them (SPECS 9.3). */
const POSITIONS_IN_CAMERA = 'Cette caméra garde elle-même ses positions enregistrées.'
const POSITIONS_KEPT_BY_VYZIO =
  'Cette caméra ne sait pas garder ses positions : Vyzio les retient à sa place, de façon moins fiable. Après chaque démarrage de Vyzio, calibrez-la depuis la vue live.'

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
  /** The camera's protocols, once read: the one the capability goes through, and those it may choose. */
  protocols: CameraProtocol[]
  protocolsRead: boolean
  task: CapabilityTask | undefined
  testsSuspended: boolean
  intents: CapabilityIntents
}

function BindingCard({
  camera,
  binding,
  protocols,
  protocolsRead,
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
  const protocol = protocols.find((entry) => entry.protocol === binding.protocol)
  const choices = protocolOptions(
    binding.capability,
    protocols,
    binding.isConfigured ? binding.protocol : null,
  )
  // An unconfigured card suggests its preset's protocol when the camera has it, else the first it has.
  const suggested =
    choices.find((choice) => choice.value === binding.protocol)?.value ?? choices[0]?.value

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
        return suggested || !protocolsRead ? null : (
          <p className="text-sm text-muted-foreground">{NO_PROTOCOL_YET}</p>
        )
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
          suggested && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={configuring || testsSuspended}
              onClick={() => void intents.onConfigure(binding.capability, suggested)}
            >
              {configuring ? 'Configuration…' : 'Configurer'}
            </Button>
          )
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
          choices.length > 0 && (
            <>
              <ProtocolChoice
                options={choices}
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
              {binding.isConfigured && binding.nativePositions !== null && (
                <p className="text-sm text-muted-foreground">
                  {binding.nativePositions ? POSITIONS_IN_CAMERA : POSITIONS_KEPT_BY_VYZIO}
                </p>
              )}
            </>
          )
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
