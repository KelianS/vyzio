import { useState } from 'react'
import { DiagnosticLine, ReadFailure } from '../../../common/components/error_message'
import type { AppError } from '../../../common/errors/app_error'
import { scrubSecrets } from '../../../common/errors/scrub_secrets'
import type {
  CameraCapabilityBinding,
  Capability,
  StreamProtocol,
  SupportedProtocol,
} from '../../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../../domain/entities/camera_protocol.entity'
import type { Camera } from '../../../domain/entities/camera.entity'
import type {
  AvailableStream,
  CameraStreamLineup,
} from '../../../domain/entities/camera_stream.entity'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { Button } from '../../../common/ui/button'
import { SettingRow } from '../../../common/settings/setting_row'
import { cn } from '../../../common/ui/utils'
import type { SettingDeclaration } from '../../../common/settings/setting_declaration'
import {
  CAPABILITY_LABELS,
  DESTRUCTIVE_OUTLINE,
  STREAM_LABEL,
  STREAM_UNCHECKED,
  TESTS_SUSPENDED,
  formatCheckedAt,
  formatStreamFailureLine,
  formatStreamWorkingLine,
} from '../cameras.formatters'
import { CapabilityTask, type StreamTask } from '../camera_connection.uido'
import { DETECTION_SENTENCES, DetectionOutcome, type DetectionResult } from '../detection_outcome'
import {
  CAPABILITY_STATE_PILLS,
  CapabilityState,
  IS_STREAM,
  SWITCHED_ON_AND_OFF,
  capabilityFailureLine,
  capabilityState,
  shownState,
  streamBindingOf,
  streamCheckState,
  streamProtocolFailureLine,
} from '../capability_state'
import { NO_PROTOCOL_YET, protocolOptions } from '../protocol_labels'
import { CapabilityCard } from './capability_card'
import { ProtocolChoice } from './protocol_choice'
import { ManualCapability } from './manual_capability_form'
import { StreamLines, StreamPicker, type StreamLineIntents } from './stream_lines'
import {
  OTHER_PATH,
  STREAM_NOT_LISTED,
  asksStreamPath,
  streamCardState,
  streamCoverageLine,
  streamNotListed,
} from '../stream_lines'

/** A stream found reads as success; anything else is what the user has to act on. */
const DETECTION_TONE: Record<DetectionOutcome, string> = {
  [DetectionOutcome.StreamWorks]: 'text-success',
  [DetectionOutcome.StreamNotWorking]: 'text-foreground',
  [DetectionOutcome.AccountRefused]: 'text-destructive',
  [DetectionOutcome.NothingAnswers]: 'text-destructive',
}

/** What the capability cards ask of their screen. */
interface CapabilityIntents {
  onRetryRead: () => void
  onDetect: () => void
  onVerifyStream: () => void
  onVerify: (capability: Capability) => void
  /** Resolves true when the camera answered through the protocol; streamPath only for the stream over RTSP. */
  onConfigure: (
    capability: Capability,
    protocol: SupportedProtocol,
    streamPath?: string | null,
  ) => Promise<boolean>
  onTogglePtz: () => Promise<void>
  onSetPanInverted: (inverted: boolean) => void
  onRemove: (capability: Capability) => Promise<void>
  onTry: (capability: Capability) => void
  onAnswer: (capability: Capability, worked: boolean) => void
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
  /** Detection ran since the page opened: a stream it left unchosen says why. */
  detected: boolean
  /** What the last detection found, kept under its button to be read and photographed (SPECS 1.5). */
  detection: DetectionResult | null
  verifyingStream: boolean
  /** Every other test goes through the stream's camera: while its check does not pass, they wait (SPECS 2.2). */
  testsSuspended: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  /** The capabilities tried, whose card asks whether it worked. */
  asking: Partial<Record<Capability, true>>
  manualFormOpen: boolean
  manualConfiguring: boolean
  /** The stream lines of the stream card (ADR-65). */
  streams: StreamLinesState
  intents: CapabilityIntents
}

/** What the stream card needs to draw its stream lines. */
interface StreamLinesState {
  lineup: CameraStreamLineup | null
  loading: boolean
  readError: AppError | null
  available: Partial<Record<StreamProtocol, AvailableStream[]>>
  availableErrors: Partial<Record<StreamProtocol, AppError>>
  tasks: Partial<Record<string, StreamTask>>
  formOpen: boolean
  adding: boolean
  /** The camera listed no stream over RTSP: its protocol choice asks for the first one's path (ADR-65 e). */
  pathAsked: boolean
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
  detected,
  detection,
  verifyingStream,
  testsSuspended,
  pending,
  asking,
  manualFormOpen,
  manualConfiguring,
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
          detected={detected}
          verifying={verifyingStream}
          configuring={pending.stream === CapabilityTask.Configure}
          streams={streams}
          onVerify={intents.onVerifyStream}
          onConfigure={(protocol, streamPath) =>
            intents.onConfigure('stream', protocol, streamPath)
          }
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
                asking={asking[b.capability] === true}
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

      {detection && (
        <div role="status" className={cn('text-sm', DETECTION_TONE[detection.outcome])}>
          <p>{DETECTION_SENTENCES[detection.outcome]}</p>
          {detection.diagnostic && <DiagnosticLine text={detection.diagnostic} />}
        </div>
      )}

      {/* A stream never chosen is not waited for: its card already says what to do. */}
      {testsSuspended && stream?.isConfigured !== false && (
        <p className="text-sm text-muted-foreground">{TESTS_SUSPENDED}</p>
      )}
    </div>
  )
}

/** The stream is a capability like the others, in the same words; the camera's own status stays in its header. */
function StreamCard({
  camera,
  binding,
  protocols,
  protocolsRead,
  detected,
  verifying,
  configuring,
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
  detected: boolean
  verifying: boolean
  configuring: boolean
  streams: StreamLinesState
  onVerify: () => void
  onConfigure: (protocol: SupportedProtocol, streamPath: string | null) => Promise<boolean>
}) {
  const [typed, setTyped] = useState('')
  const notListed = binding ? streamNotListed(binding, protocols, detected) : false
  const typing = (picked: SupportedProtocol) =>
    (streams.pathAsked || notListed) && asksStreamPath(picked)
  const unconfigured = binding ? !binding.isConfigured : false
  const protocol = protocols.find((entry) => entry.protocol === binding?.protocol)
  const choices = binding
    ? protocolOptions('stream', protocols, binding.isConfigured ? binding.protocol : null)
    : []
  const check = binding ? streamCheckState(binding, camera) : undefined
  const state = check ? streamCardState(check, streams.lineup) : undefined

  /** What to do while no protocol is chosen: the path detection could not find, else where to choose. */
  function unconfiguredLine(): string {
    if (notListed) return STREAM_NOT_LISTED
    if (choices.length > 0 || !protocolsRead)
      return 'Choisissez comment Vyzio lit les images, dans les options ci-dessous.'
    return NO_PROTOCOL_YET
  }

  /** The line under the pill names which part fails: the stream's own check, or detection (SPECS 1.5). */
  function stateLine(shown: CapabilityState) {
    const coverage = streamCoverageLine(streams.lineup)
    switch (shown) {
      case CapabilityState.Unconfigured:
        return <p className="text-sm text-muted-foreground">{unconfiguredLine()}</p>
      case CapabilityState.Unchecked:
        return <p className="text-sm text-muted-foreground">{STREAM_UNCHECKED}</p>
      case CapabilityState.Working:
      case CapabilityState.Failed: {
        const working = formatStreamWorkingLine(camera, binding?.verifiedAt ?? null)
        // Each sentence in its own tone: what still works is never said in red (principle 4).
        const failing = shown === CapabilityState.Failed
        return (
          <div className="text-sm text-muted-foreground">
            {check === CapabilityState.Failed ? (
              <div className="text-destructive">
                <p>
                  {streamProtocolFailureLine(protocol?.status ?? null) ??
                    formatStreamFailureLine(camera)}
                </p>
                {/* The verifier's own reason is support detail, kept since the last check (SPECS 1.5). */}
                {binding?.lastError && <DiagnosticLine text={scrubSecrets(binding.lastError)} />}
              </div>
            ) : (
              working && <p>{working}</p>
            )}
            {/* Whether recording and detection are covered as chosen, outside the fold (ADR-65 c). */}
            {coverage && <p className={cn(failing && 'text-destructive')}>{coverage}</p>}
          </div>
        )
      }
      // Never the stream's: only a try asks the user, and the stream is never switched off.
      case CapabilityState.ToConfirm:
      case CapabilityState.Rejected:
      case CapabilityState.SwitchedOff:
        return null
      default: {
        const unknownState: never = shown
        return unknownState
      }
    }
  }

  return (
    <CapabilityCard
      title={STREAM_LABEL}
      pill={state && CAPABILITY_STATE_PILLS[state]}
      options={
        binding &&
        choices.length > 0 && (
          <>
            {binding.isConfigured && (
              <p className="text-sm text-muted-foreground">
                Changer de protocole remplace la liste des flux, y compris ceux que vous avez
                ajoutés.
              </p>
            )}
            <ProtocolChoice
              options={choices}
              current={binding.protocol}
              configured={binding.isConfigured}
              configuring={configuring}
              disabled={false}
              detail={(picked) =>
                typing(picked)
                  ? {
                      node: (
                        <StreamPicker
                          choices={[OTHER_PATH]}
                          selected={OTHER_PATH}
                          typed={typed}
                          onPick={() => undefined}
                          onType={setTyped}
                        />
                      ),
                      ready: typed.trim() !== '',
                    }
                  : null
              }
              onConfigure={(picked) => onConfigure(picked, typing(picked) ? typed.trim() : null)}
            />
            {binding.isConfigured && (
              <StreamLines
                lineup={streams.lineup}
                loading={streams.loading}
                readError={streams.readError}
                protocols={choices}
                available={streams.available}
                availableErrors={streams.availableErrors}
                tasks={streams.tasks}
                formOpen={streams.formOpen}
                adding={streams.adding}
                intents={streams.intents}
              />
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
      {state && stateLine(state)}
    </CapabilityCard>
  )
}

/** What the try does to the camera, said before it acts (ADR-66 d); only what no read can prove is ever tried. */
const TRY_COSTS: Record<Capability, string | null> = {
  ptz: 'Essayer fait tourner la caméra un peu, puis la ramène.',
  hardware_privacy: 'Essayer coupe la caméra quelques secondes.',
  stream: null,
  image_settings: null,
}

/** The one question after the try, in plain words; the answer is the user's. */
const TRY_QUESTIONS: Record<Capability, string | null> = {
  ptz: 'La caméra a bougé ?',
  hardware_privacy: 'La caméra s’est coupée ?',
  stream: null,
  image_settings: null,
}

/** What the user answered, recalled in their words; the card offers to try again on purpose (ADR-66 d). */
const USERS_NO: Record<Capability, string | null> = {
  ptz: 'Vous avez indiqué que la caméra n’a pas bougé.',
  hardware_privacy: 'Vous avez indiqué que la caméra ne s’est pas coupée.',
  stream: null,
  image_settings: null,
}

const TRY_REFUSED_IN_PRIVACY = 'Rendez la vue à la caméra pour l’essayer.'

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
  /** Tried: the card asks its one question instead of offering the try. */
  asking: boolean
  testsSuspended: boolean
  intents: CapabilityIntents
}

function BindingCard({
  camera,
  binding,
  protocols,
  protocolsRead,
  task,
  asking,
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
  const trying = task === CapabilityTask.Try
  const answering = task === CapabilityTask.Answer

  const label = CAPABILITY_LABELS[binding.capability]
  const state = shownState(capabilityState(binding, camera.ptzSupported), asking)
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
        // Confirmed by the user rests on their word, and says so (ADR-66).
        if (binding.confirmedAt)
          return (
            <p className="text-sm text-muted-foreground">
              Confirmé par vous le {formatCheckedAt(binding.confirmedAt)}
            </p>
          )
        return verifiedAtLabel ? (
          <p className="text-sm text-muted-foreground">Vérifié le {verifiedAtLabel}</p>
        ) : null
      case CapabilityState.ToConfirm:
        if (asking)
          return <p className="text-sm font-medium">{TRY_QUESTIONS[binding.capability]}</p>
        // The try acts on the camera without a confirmation: its cost is said above the button (DESIGN SYSTEM § Help).
        return (
          <p className="text-sm text-muted-foreground">
            {camera.privacyModeActive ? TRY_REFUSED_IN_PRIVACY : TRY_COSTS[binding.capability]}
          </p>
        )
      case CapabilityState.Rejected:
        return (
          <div className="text-sm text-muted-foreground">
            <p>{USERS_NO[binding.capability]}</p>
            {/* Trying again acts on the camera too: its cost stays above the button (DESIGN SYSTEM § Help). */}
            <p>
              {camera.privacyModeActive ? TRY_REFUSED_IN_PRIVACY : TRY_COSTS[binding.capability]}
            </p>
          </div>
        )
      case CapabilityState.Failed:
        // The camera's answer is support detail: a plain sentence leads (SPECS 1.5).
        return (
          <div className="text-sm text-destructive">
            {/* Silence, a refused account or a failed test each have their own way out (ADR-61). */}
            <p>{capabilityFailureLine(protocol?.status ?? null, binding.status)}</p>
            {binding.lastError && <DiagnosticLine text={scrubSecrets(binding.lastError)} />}
          </div>
        )
      case CapabilityState.Unconfigured:
        return suggested || !protocolsRead ? null : (
          <p className="text-sm text-muted-foreground">{NO_PROTOCOL_YET}</p>
        )
      // Only the stream is ever unchecked.
      case CapabilityState.Unchecked:
      case CapabilityState.SwitchedOff:
        return null
      default: {
        const unknownState: never = state
        return unknownState
      }
    }
  }

  function answerButtons() {
    return (
      <>
        <Button
          type="button"
          size="sm"
          disabled={answering}
          onClick={() => intents.onAnswer(binding.capability, true)}
        >
          Oui
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={answering}
          onClick={() => intents.onAnswer(binding.capability, false)}
        >
          Non
        </Button>
      </>
    )
  }

  function tryButton(label: string) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={trying || testsSuspended || camera.privacyModeActive}
        onClick={() => intents.onTry(binding.capability)}
      >
        {trying ? 'Essai…' : label}
      </Button>
    )
  }

  function removeButton() {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={DESTRUCTIVE_OUTLINE}
        onClick={() => setConfirmRemove(true)}
      >
        Retirer
      </Button>
    )
  }

  // Only an orientation in use is switched off; one never in use is removed like the others.
  function wayOutButton() {
    if (!switchedOnAndOff || !camera.ptzSupported) return removeButton()
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={DESTRUCTIVE_OUTLINE}
        onClick={() => setConfirmDisable(true)}
      >
        Désactiver
      </Button>
    )
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
      case CapabilityState.ToConfirm:
        return asking ? (
          answerButtons()
        ) : (
          <>
            {tryButton('Essayer')}
            {/* Never in use, so nothing to switch off: a camera without it is removed (DESIGN SYSTEM § Capability cards). */}
            {removeButton()}
          </>
        )
      case CapabilityState.Rejected:
        // The user's no stands until they try again on purpose (ADR-66 d).
        return (
          <>
            {tryButton('Essayer à nouveau')}
            {wayOutButton()}
          </>
        )
      case CapabilityState.Unchecked:
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
            {wayOutButton()}
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
